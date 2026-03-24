import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PayjaSyncService implements OnModuleInit {
  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    // Sincronização automática a cada 5 minutos
    setInterval(() => this.syncBankClientes(), 5 * 60 * 1000);
  }

  private getConfig() {
    return {
      simulatorBaseUrl: process.env.SIMULATOR_URL || 'http://104.207.142.188:3001',
      endpointEligibility: '/api/payja/ussd/eligibility',
    };
  }

  async syncBankClientes() {
    const bankBase = process.env.BANK_BASE_URL || 'http://104.207.142.188:4500';
    
    try {
      const resp = await firstValueFrom(this.http.get(`${bankBase}/api/clientes`));
      const clientes = (resp as any).data?.clientes || [];
      
      console.log(`[Bank-Sync] Sincronizando ${clientes.length} clientes do banco`);

      for (const bankCliente of clientes) {
        try {
          const eligibility = this.checkEligibility(bankCliente);
          
          const data = {
            phoneNumber: bankCliente.telefone,
            name: bankCliente.nome_completo,
            nuit: bankCliente.nuit,
            biNumber: bankCliente.bi,
            biExpiryDate: bankCliente.bi_validade,
            email: bankCliente.email || null,
            creditLimit: eligibility.eligible ? this.calculateLimit(bankCliente) : 0,
            creditScore: bankCliente.score_credito ?? null,
            salary: bankCliente.renda_mensal || null,
            salaryBank: bankCliente.empregador || null,
            accountNumber: bankCliente.numero_conta,
            accountType: bankCliente.tipo_conta,
            verified: eligibility.eligible,
            blocked: !eligibility.eligible,
            status: eligibility.eligible ? 'APPROVED' : 'REJECTED',
            rejectionReason: eligibility.eligible ? null : eligibility.reason,
          } as any;

          const existing = await this.prisma.customer.findUnique({
            where: { phoneNumber: bankCliente.telefone }
          });

          if (existing) {
            await this.prisma.customer.update({
              where: { id: existing.id },
              data
            });
          } else {
            await this.prisma.customer.create({ data });
          }

          if (!eligibility.eligible) {
            await this.sendIneligibilitySms(bankCliente.telefone, eligibility.reason);
          }

          // Enviar feedback para o Banco Mock
          await this.sendFeedbackToBank(bankCliente.telefone, data.status, data.rejectionReason, data.creditLimit);

          await this.postEligibility(
            { phoneNumber: bankCliente.telefone, name: bankCliente.nome_completo },
            data.creditLimit,
            eligibility.eligible,
            eligibility.reason
          );
        } catch (err) {
          console.error(`[Bank-Sync] Erro ao processar cliente ${bankCliente.nuit}:`, err.message);
        }
      }
      return { success: true, count: clientes.length };
    } catch (error) {
      console.error('[Bank-Sync] Erro fatal:', error.message);
      return { success: false, error: error.message };
    }
  }

  private checkEligibility(c: any): { eligible: boolean; reason: string } {
    // 1. Conta Ativa
    if (c.status_conta !== 'ATIVA') {
      return { eligible: false, reason: 'Conta bancária inativa.' };
    }

    // 2. BI em dia
    const biExpiry = new Date(c.bi_validade);
    if (biExpiry < new Date()) {
      return { eligible: false, reason: 'B.I. expirado.' };
    }

    // 3. Tempo de conta (mínimo 6 meses)
    const createdDate = new Date(c.conta_criada_em);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (createdDate > sixMonthsAgo) {
      return { eligible: false, reason: 'Conta com menos de 6 meses.' };
    }

    // 4. Salário Domiciliado
    if (c.tipo_conta === 'SALARIO' && !c.salario_domiciliado) {
      return { eligible: false, reason: 'Salário não domiciliado.' };
    }

    // 5. Crédito Incumpridor
    if (c.status_credito === 'INCUMPRIDOR') {
      return { eligible: false, reason: 'Histórico de crédito incumpridor.' };
    }

    // 6. Taxa de Esforço (30-40%)
    const maxDebt = c.renda_mensal * 0.4;
    if (c.divida_total > maxDebt) {
      return { eligible: false, reason: 'Capacidade de pagamento excedida (Taxa de esforço > 40%).' };
    }

    return { eligible: true, reason: 'Elegível' };
  }

  private calculateLimit(c: any): number {
    const baseLimit = c.renda_mensal * 0.35;
    const scoreMultiplier = (c.score_credito || 500) / 1000;
    return Math.max(30000, Math.floor(baseLimit * scoreMultiplier));
  }

  private async sendIneligibilitySms(phone: string, reason: string) {
    try {
      await this.prisma.smsLog.create({
        data: {
          phoneNumber: phone,
          message: `PayJA: Infelizmente você não é elegível para o crédito. Motivo: ${reason}. Por favor, dirija-se ao balcão.`,
          type: 'INELIGIBILITY_NOTICE',
          status: 'SENT',
          sentAt: new Date(),
        }
      });
    } catch (e) {}
  }

  private async sendFeedbackToBank(phoneNumber: string, status: string, rejectionReason: string, creditLimit: number) {
    const bankBase = process.env.BANK_BASE_URL || 'http://104.207.142.188:4500';
    try {
      await firstValueFrom(this.http.post(`${bankBase}/api/payja-feedback/eligibility`, {
        phoneNumber,
        status,
        rejectionReason,
        creditLimit
      }));
      console.log(`[Bank-Feedback] Feedback enviado para ${phoneNumber}: ${status}`);
    } catch (error) {
      console.error(`[Bank-Feedback] Erro ao enviar feedback para ${phoneNumber}:`, error.message);
    }
  }

  async postEligibility(sim: any, limit: number, eligible: boolean, reason?: string) {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointEligibility, cfg.simulatorBaseUrl).toString();
    const payload = {
      phoneNumber: sim.phoneNumber,
      eligible,
      creditLimit: limit,
      minAmount: eligible ? 30000 : 0,
      reason: reason || (eligible ? 'Elegível' : 'Não elegível'),
    };
    try {
      await firstValueFrom(this.http.post(url, payload));
    } catch (e) {}
  }

  async getCustomerStatus(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phoneNumber } });
    if (!customer) return { success: false, error: 'Cliente não encontrado' };
    return { success: true, ...customer };
  }

  async getLoans() {
    return this.prisma.loan.findMany({
      include: { customer: { select: { name: true, phoneNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmDisbursal(loanId: string, disbursalData: any) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return { success: false, error: 'Empréstimo não encontrado' };
    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'DISBURSED', disbursedAt: new Date() },
    });
    return { success: true, loan: updated };
  }
}
