import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UniversalBankAdapter } from './adapters/universal.adapter';

export interface BankEligibilityRequest {
  customerId: string;
  phoneNumber: string;
  nuit?: string;
  nome?: string;
  bi?: string;
  valor_solicitado?: number;
}

export interface BankEligibilityResponse {
  eligible: boolean;
  maxAmount?: number;
  interestRate?: number;
  maxTerm?: number;
  employerName?: string;
  monthlySalary?: number;
  employmentStatus?: string;
  reason?: string;
  bankData?: any;
}

export interface LoanDisbursementRequest {
  customerId: string;
  loanId: string;
  amount: number;
  bankCode: string;
  accountNumber?: string;
}

export interface LoanDisbursementResponse {
  success: boolean;
  transactionId?: string;
  disbursedAmount?: number;
  disbursedAt?: Date;
  error?: string;
}

@Injectable()
export class BankAdaptersService {
  private readonly logger = new Logger(BankAdaptersService.name);
  private adapters: Map<string, UniversalBankAdapter> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Inicializar adaptadores carregando bancos do banco de dados
   */
  async initializeAdapters() {
    try {
      const banks = await this.prisma.bankPartner.findMany({
        where: { active: true },
      });

      this.logger.log(`Inicializando ${banks.length} banco(s) parceiro(s)...`);

      for (const bank of banks) {
        const adapter = new UniversalBankAdapter();
        adapter.configure({
          code: bank.code,
          name: bank.name,
          apiUrl: bank.apiUrl,
          apiKey: bank.apiKey,
          timeout: bank.timeout,
          retryAttempts: bank.retryAttempts,
          healthEndpoint: bank.healthEndpoint,
          eligibilityEndpoint: bank.eligibilityEndpoint,
          capacityEndpoint: bank.capacityEndpoint,
          disbursementEndpoint: bank.disbursementEndpoint,
          loansEndpoint: bank.loansEndpoint,
          webhookEndpoint: bank.webhookEndpoint,
        });

        this.adapters.set(bank.code, adapter);
        this.logger.log(`✓ ${bank.name} (${bank.code}) inicializado`);
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar adaptadores:', error);
    }
  }

  /**
   * Obter adaptador de um banco
   */
  private getAdapter(bankCode: string): UniversalBankAdapter {
    const adapter = this.adapters.get(bankCode);
    if (!adapter) {
      throw new BadRequestException(`Banco não encontrado ou inativo: ${bankCode}`);
    }
    return adapter;
  }

  /**
   * Verificar elegibilidade do cliente em um banco específico
   */
  async checkEligibility(
    bankCode: string,
    request: BankEligibilityRequest,
  ): Promise<BankEligibilityResponse> {
    const adapter = this.getAdapter(bankCode);

    try {
      const eligibility = await adapter.checkEligibility({
        nuit: request.nuit,
        nome: request.nome,
        telefone: request.phoneNumber,
        bi: request.bi,
        valor_solicitado: request.valor_solicitado,
      });

      // Atualizar estatísticas
      await this.updateBankStats(bankCode, true);

      return eligibility;
    } catch (error) {
      await this.updateBankStats(bankCode, false);
      this.logger.error(`Erro ao verificar elegibilidade no ${bankCode}:`, error);
      throw new BadRequestException(`Erro ao verificar elegibilidade: ${error.message}`);
    }
  }

  /**
   * Solicitar desembolso
   */
  async requestDisbursement(request: LoanDisbursementRequest): Promise<LoanDisbursementResponse> {
    const adapter = this.getAdapter(request.bankCode);

    try {
      // Buscar dados do cliente e empréstimo
      const loan = await this.prisma.loan.findUnique({
        where: { id: request.loanId },
        include: { customer: true },
      });

      if (!loan) {
        throw new BadRequestException('Empréstimo não encontrado');
      }

      const response = await adapter.requestDisbursement({
        nuit: loan.customer.nuit,
        valor: request.amount,
        numero_emola: loan.customer.phoneNumber,
        referencia_payja: loan.id,
        descricao: `Desembolso empréstimo ${loan.id}`,
      });

      await this.updateBankStats(request.bankCode, response.success);

      // Registrar log de auditoria
      await this.prisma.auditLog.create({
        data: {
          userId: 'SYSTEM',
          userType: 'SYSTEM',
          action: 'BANK_DISBURSEMENT',
          entity: 'LOAN',
          entityId: request.loanId,
          changes: JSON.stringify({
            bankCode: request.bankCode,
            amount: request.amount,
            transactionId: response.transactionId,
            success: response.success,
          }),
        },
      });

      return response;
    } catch (error) {
      await this.updateBankStats(request.bankCode, false);
      this.logger.error(`Erro ao solicitar desembolso:`, error);
      throw error;
    }
  }

  /**
   * Testar conexão com um banco
   */
  async testConnection(bankCode: string) {
    const adapter = this.getAdapter(bankCode);
    const result = await adapter.testConnection();

    // Atualizar status do health check
    await this.prisma.bankPartner.update({
      where: { code: bankCode },
      data: {
        lastHealthCheck: new Date(),
        lastHealthStatus: result.success ? 'ONLINE' : 'OFFLINE',
        verified: result.success,
      },
    });

    return result;
  }

  /**
   * Criar novo banco parceiro
   */
  async createBank(data: {
    code: string;
    name: string;
    apiUrl: string;
    apiKey?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    healthEndpoint?: string;
    eligibilityEndpoint?: string;
    capacityEndpoint?: string;
    disbursementEndpoint?: string;
    loansEndpoint?: string;
    webhookEndpoint?: string;
    timeout?: number;
    retryAttempts?: number;
  }) {
    try {
      const bank = await this.prisma.bankPartner.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
          description: data.description,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          healthEndpoint: data.healthEndpoint || '/api/health',
          eligibilityEndpoint: data.eligibilityEndpoint || '/api/validacao/verificar',
          capacityEndpoint: data.capacityEndpoint || '/api/capacidade/consultar',
          disbursementEndpoint: data.disbursementEndpoint || '/api/desembolso/executar',
          loansEndpoint: data.loansEndpoint || '/api/emprestimos/consultar',
          webhookEndpoint: data.webhookEndpoint || '/api/webhooks/pagamento',
          timeout: data.timeout || 30000,
          retryAttempts: data.retryAttempts || 3,
          active: true,
        },
      });

      // Criar e configurar adaptador
      const adapter = new UniversalBankAdapter();
      adapter.configure({
        code: bank.code,
        name: bank.name,
        apiUrl: bank.apiUrl,
        apiKey: bank.apiKey,
        timeout: bank.timeout,
        retryAttempts: bank.retryAttempts,
        healthEndpoint: bank.healthEndpoint,
        eligibilityEndpoint: bank.eligibilityEndpoint,
        capacityEndpoint: bank.capacityEndpoint,
        disbursementEndpoint: bank.disbursementEndpoint,
        loansEndpoint: bank.loansEndpoint,
        webhookEndpoint: bank.webhookEndpoint,
      });

      this.adapters.set(bank.code, adapter);

      this.logger.log(`✓ Banco ${bank.name} criado e configurado`);

      return bank;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Já existe um banco com este código');
      }
      throw error;
    }
  }

  /**
   * Atualizar banco parceiro
   */
  async updateBank(code: string, data: Partial<{
    name: string;
    apiUrl: string;
    apiKey: string;
    description: string;
    contactEmail: string;
    contactPhone: string;
    healthEndpoint: string;
    eligibilityEndpoint: string;
    capacityEndpoint: string;
    disbursementEndpoint: string;
    loansEndpoint: string;
    webhookEndpoint: string;
    timeout: number;
    retryAttempts: number;
    active: boolean;
  }>) {
    const bank = await this.prisma.bankPartner.update({
      where: { code },
      data,
    });

    // Reconfigurar adaptador se estiver ativo
    if (bank.active) {
      const adapter = new UniversalBankAdapter();
      adapter.configure({
        code: bank.code,
        name: bank.name,
        apiUrl: bank.apiUrl,
        apiKey: bank.apiKey,
        timeout: bank.timeout,
        retryAttempts: bank.retryAttempts,
        healthEndpoint: bank.healthEndpoint,
        eligibilityEndpoint: bank.eligibilityEndpoint,
        capacityEndpoint: bank.capacityEndpoint,
        disbursementEndpoint: bank.disbursementEndpoint,
        loansEndpoint: bank.loansEndpoint,
        webhookEndpoint: bank.webhookEndpoint,
      });

      this.adapters.set(bank.code, adapter);
    } else {
      this.adapters.delete(bank.code);
    }

    this.logger.log(`✓ Banco ${bank.name} atualizado`);

    return bank;
  }

  /**
   * Deletar banco parceiro
   */
  async deleteBank(code: string) {
    await this.prisma.bankPartner.delete({
      where: { code },
    });

    this.adapters.delete(code);

    this.logger.log(`✓ Banco ${code} removido`);

    return { success: true, message: 'Banco removido com sucesso' };
  }

  /**
   * Listar todos os bancos parceiros
   */
  async getAvailableBanks() {
    const banks = await this.prisma.bankPartner.findMany({
      orderBy: { name: 'asc' },
    });

    return banks.map(bank => ({
      id: bank.id,
      code: bank.code,
      name: bank.name,
      apiUrl: bank.apiUrl,
      active: bank.active,
      verified: bank.verified,
      lastHealthCheck: bank.lastHealthCheck,
      lastHealthStatus: bank.lastHealthStatus,
      description: bank.description,
      contactEmail: bank.contactEmail,
      contactPhone: bank.contactPhone,
      totalRequests: bank.totalRequests,
      successfulRequests: bank.successfulRequests,
      failedRequests: bank.failedRequests,
      successRate: bank.totalRequests > 0 
        ? Math.round((bank.successfulRequests / bank.totalRequests) * 100) 
        : 0,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    }));
  }

  /**
   * Obter detalhes de um banco
   */
  async getBankDetails(code: string) {
    const bank = await this.prisma.bankPartner.findUnique({
      where: { code },
    });

    if (!bank) {
      throw new BadRequestException('Banco não encontrado');
    }

    return bank;
  }

  /**
   * Atualizar estatísticas de uso do banco
   */
  private async updateBankStats(bankCode: string, success: boolean) {
    try {
      await this.prisma.bankPartner.update({
        where: { code: bankCode },
        data: {
          totalRequests: { increment: 1 },
          ...(success 
            ? { successfulRequests: { increment: 1 } }
            : { failedRequests: { increment: 1 } }
          ),
        },
      });
    } catch (error) {
      this.logger.warn(`Erro ao atualizar estatísticas do banco ${bankCode}`);
    }
  }
}
