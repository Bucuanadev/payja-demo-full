import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LetsegoAdapter } from './adapters/letsego.adapter';
import { MbimAdapter } from './adapters/mbim.adapter';
import { BciAdapter } from './adapters/bci.adapter';
import { StandardBankAdapter } from './adapters/standard-bank.adapter';
import { GhwAdapter } from './adapters/ghw.adapter';

export interface BankEligibilityRequest {
  customerId: string;
  phoneNumber: string;
  nuit?: string;
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
  private adapters: Map<string, any>;

  constructor(
    private prisma: PrismaService,
    private letsegoAdapter: LetsegoAdapter,
    private mbimAdapter: MbimAdapter,
    private bciAdapter: BciAdapter,
    private standardBankAdapter: StandardBankAdapter,
    private ghwAdapter: GhwAdapter,
  ) {
    // Registrar todos os adaptadores disponíveis
    this.adapters = new Map<string, any>([
      ['LETSEGO', this.letsegoAdapter],
      ['MBIM', this.mbimAdapter],
      ['BCI', this.bciAdapter],
      ['STANDARD_BANK', this.standardBankAdapter],
      ['GHW', this.ghwAdapter],
    ]);
  }

  /**
   * Verificar elegibilidade do cliente em um banco específico
   * Busca os dados do funcionário público diretamente do banco
   */
  async checkEligibility(
    bankCode: string,
    request: BankEligibilityRequest,
  ): Promise<BankEligibilityResponse> {
    const adapter = this.adapters.get(bankCode);
    
    if (!adapter) {
      throw new BadRequestException(`Banco não suportado: ${bankCode}`);
    }

    try {
      // Chamar API do banco para verificar elegibilidade
      const eligibility = await adapter.checkEligibility(request);
      
      // Salvar resultado no banco de dados
      await this.saveEligibilityCheck(bankCode, request, eligibility);
      
      return eligibility;
    } catch (error) {
      console.error(`Erro ao verificar elegibilidade no ${bankCode}:`, error);
      throw new BadRequestException(
        `Erro ao verificar elegibilidade: ${error.message}`,
      );
    }
  }

  /**
   * Verificar elegibilidade em TODOS os bancos parceiros
   */
  async checkEligibilityAllBanks(
    request: BankEligibilityRequest,
  ): Promise<Record<string, BankEligibilityResponse>> {
    const results: Record<string, BankEligibilityResponse> = {};

    // Executar verificação em paralelo em todos os bancos
    const promises = Array.from(this.adapters.entries()).map(
      async ([bankCode, adapter]) => {
        try {
          const eligibility = await adapter.checkEligibility(request);
          results[bankCode] = eligibility;
        } catch (error) {
          results[bankCode] = {
            eligible: false,
            reason: `Erro ao consultar: ${error.message}`,
          };
        }
      },
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Solicitar desembolso do empréstimo via banco
   */
  async requestDisbursement(
    request: LoanDisbursementRequest,
  ): Promise<LoanDisbursementResponse> {
    const adapter = this.adapters.get(request.bankCode);
    
    if (!adapter) {
      throw new BadRequestException(`Banco não suportado: ${request.bankCode}`);
    }

    try {
      // Solicitar desembolso ao banco
      const disbursement = await adapter.requestDisbursement(request);
      
      // Atualizar empréstimo no banco de dados
      if (disbursement.success) {
        await this.prisma.loan.update({
          where: { id: request.loanId },
          data: {
            status: 'DISBURSED',
            disbursedAt: new Date(),
          },
        });

        // Registrar transação
        await this.saveDisbursementTransaction(request, disbursement);
      }
      
      return disbursement;
    } catch (error) {
      console.error(`Erro ao solicitar desembolso do ${request.bankCode}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obter lista de bancos parceiros ativos
   */
  async getActiveBanks() {
    return Array.from(this.adapters.keys()).map(code => ({
      code,
      name: this.getBankName(code),
      active: true,
    }));
  }

  /**
   * Sincronizar dados de funcionários públicos de um banco
   */
  async syncPublicEmployees(bankCode: string) {
    const adapter = this.adapters.get(bankCode);
    
    if (!adapter || !adapter.syncEmployees) {
      throw new BadRequestException(
        `Banco não suporta sincronização: ${bankCode}`,
      );
    }

    try {
      const employees = await adapter.syncEmployees();
      
      // Processar e salvar dados dos funcionários
      for (const employee of employees) {
        await this.processEmployeeData(bankCode, employee);
      }
      
      return {
        success: true,
        count: employees.length,
        bankCode,
      };
    } catch (error) {
      console.error(`Erro ao sincronizar funcionários do ${bankCode}:`, error);
      throw new BadRequestException(
        `Erro na sincronização: ${error.message}`,
      );
    }
  }

  private async saveEligibilityCheck(
    bankCode: string,
    request: BankEligibilityRequest,
    response: BankEligibilityResponse,
  ) {
    // Salvar histórico de consulta de elegibilidade
    // Implementar conforme necessidade
  }

  private async saveDisbursementTransaction(
    request: LoanDisbursementRequest,
    response: LoanDisbursementResponse,
  ) {
    // Salvar registro da transação de desembolso
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
        }),
      },
    });
  }

  private async processEmployeeData(bankCode: string, employee: any) {
    // Criar ou atualizar dados do funcionário público
    const customer = await this.prisma.customer.upsert({
      where: { phoneNumber: employee.phoneNumber },
      update: {
        name: employee.name,
        nuit: employee.nuit,
        verified: true,
      },
      create: {
        phoneNumber: employee.phoneNumber,
        name: employee.name,
        nuit: employee.nuit,
        verified: true,
      },
    });

    // Salvar metadados de elegibilidade
    // Implementar tabela específica se necessário
  }

  private getBankName(code: string): string {
    const names = {
      LETSEGO: 'Let\'sego Bank',
      MBIM: 'Millennium BIM',
      BCI: 'BCI - Banco Comercial e de Investimentos',
      STANDARD_BANK: 'Standard Bank Moçambique',
      GHW: 'Banco GHW',
    };
    return names[code] || code;
  }

  /**
   * Obter lista de bancos parceiros disponíveis
   */
  getAvailableBanks() {
    return [
      {
        code: 'LETSEGO',
        name: "Let'sego Bank",
        active: true,
      },
      {
        code: 'MBIM',
        name: 'Millennium BIM',
        active: true,
      },
      {
        code: 'BCI',
        name: 'BCI - Banco Comercial e de Investimentos',
        active: true,
      },
      {
        code: 'STANDARD_BANK',
        name: 'Standard Bank Moçambique',
        active: true,
      },
      {
        code: 'GHW',
        name: 'Banco GHW',
        active: true,
        configurable: true,
      },
    ];
  }

  /**
   * Testar conexão com um banco
   */
  async testConnection(bankCode: string) {
    const adapter = this.adapters.get(bankCode);
    
    if (!adapter) {
      throw new BadRequestException(`Banco não suportado: ${bankCode}`);
    }

    if (typeof adapter.testConnection === 'function') {
      return await adapter.testConnection();
    }

    return {
      success: false,
      message: 'Teste de conexão não disponível para este banco',
    };
  }

  /**
   * Configurar API de um banco
   */
  async configureBank(bankCode: string, config: { apiUrl?: string; apiKey?: string }) {
    const adapter = this.adapters.get(bankCode);
    
    if (!adapter) {
      throw new BadRequestException(`Banco não suportado: ${bankCode}`);
    }

    if (typeof adapter.configure === 'function') {
      adapter.configure(config);
      return {
        success: true,
        message: `${this.getBankName(bankCode)} configurado com sucesso`,
        config: {
          apiUrl: config.apiUrl,
          apiKeyConfigured: !!config.apiKey,
        },
      };
    }

    return {
      success: false,
      message: 'Configuração não disponível para este banco',
    };
  }
}
