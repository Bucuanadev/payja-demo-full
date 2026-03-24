import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';

@Injectable()
export class BankSyncService implements OnModuleInit {
  private readonly logger = new Logger(BankSyncService.name);
  private readonly BANCO_MOCK_URL = 'http://104.207.142.188:4500';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Iniciando sincronização automática com o Banco Mock (Intervalo: 1 min)...');
    setTimeout(() => {
      this.syncAllFromBank().catch(err => 
        this.logger.error('Erro na sincronização inicial:', err.message)
      );
    }, 5000);
  }

  @Interval(60000)
  async handleIntervalSync() {
    this.logger.log('Executando sincronização periódica (Interval)...');
    await this.syncAllFromBank();
  }

  async syncAllFromBank() {
    try {
      this.logger.log(`Buscando todos os clientes do Banco Mock: ${this.BANCO_MOCK_URL}/api/clientes`);
      const response = await axios.get(`${this.BANCO_MOCK_URL}/api/clientes`);
      
      if (response.data && response.data.clientes) {
        const clientes = response.data.clientes;
        this.logger.log(`Sincronizando ${clientes.length} clientes do banco...`);
        
        for (const cliente of clientes) {
          await this.upsertCustomer(cliente);
        }
        
        return { success: true, count: clientes.length };
      }
      return { success: false, message: 'Nenhum cliente retornado pelo banco' };
    } catch (error) {
      this.logger.error(`Erro ao sincronizar com Banco Mock: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async handleSync(payload: any) {
    const { event, data } = payload;
    this.logger.log(`Recebido evento de sincronização: ${event}`);
    switch (event) {
      case 'customer.created':
      case 'customer.updated':
        return await this.upsertCustomer(data);
      case 'customer.deleted':
        return await this.deleteCustomer(data.nuit);
      case 'sync.all':
        return await this.syncAllFromBank();
      default:
        this.logger.warn(`Evento desconhecido: ${event}`);
        return { success: false, message: 'Evento desconhecido' };
    }
  }

  private async sendDecisionToBank(data: {
    nuit: string,
    nome_completo: string,
    telefone: string,
    decision: 'APPROVED' | 'REJECTED',
    creditLimit: number,
    rejectionReasons: string[],
    score: number
  }) {
    try {
      await axios.post(`${this.BANCO_MOCK_URL}/api/payja-decisions`, {
        ...data,
        decidedAt: new Date().toISOString()
      });
      this.logger.log(`✓ Decisão enviada para o Banco Mock: ${data.nuit} - ${data.decision}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar decisão para o Banco Mock (${data.nuit}): ${error.message}`);
    }
  }

  private async upsertCustomer(data: any) {
    try {
      // 1. Validação de Conta Ativa
      const isAccountActive = data.status_conta === 'ATIVA';
      
      // 2. Validação de B.I. (Deve ser data futura)
      const biValidadeDate = data.bi_validade ? new Date(data.bi_validade) : null;
      const isBiValid = biValidadeDate ? biValidadeDate > new Date() : false;
      
      // 3. Validação de Histórico de Crédito (Deve ser LIMPO ou ATIVO, nunca INCUMPRIDOR)
      const isCreditClean = data.status_credito === 'LIMPO' || data.status_credito === 'ATIVO';
      const isIncumpridor = data.status_credito === 'INCUMPRIDOR';
      
      // 4. Antiguidade da Conta (Mínimo 6 meses)
      const accountCreationDate = data.conta_criada_em ? new Date(data.conta_criada_em) : (data.criado_em ? new Date(data.criado_em) : null);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const hasMinimumAccountAge = accountCreationDate && accountCreationDate <= sixMonthsAgo;
      
      // 5. Domiciliação de Salário
      const hasSalaryDomiciliation = data.salario_domiciliado === true || data.salario_domiciliado === 'true' || data.salario_domiciliado === 1;
      
      // 6. Taxa de Esforço e Dívida
      const salary = data.renda_mensal || 0;
      const totalDebt = data.divida_total || 0;
      let monthlyCommitment = data.compromisso_mensal || 0;
      if (data.tem_emprestimo_ativo && monthlyCommitment === 0) {
        monthlyCommitment = salary * 0.1; // Estimativa se não fornecido
      }
      const effortRate = salary > 0 ? (monthlyCommitment / salary) : 1;
      const hasAcceptableEffortRate = effortRate <= 0.4;
      const hasExcessiveDebt = totalDebt > (salary * 3); // Limite de 3x o salário

      // DECISÃO FINAL
      const isEligible = isAccountActive && isBiValid && !isIncumpridor && isCreditClean && hasMinimumAccountAge && hasSalaryDomiciliation && hasAcceptableEffortRate && !hasExcessiveDebt;
      
      const calculatedLimit = isEligible ? (salary * 0.4) : 0;

      const customerData = {
        phoneNumber: data.telefone || `BANCO-${data.nuit}`,
        name: data.nome_completo,
        nuit: data.nuit,
        biNumber: data.bi,
        email: data.email || null,
        creditLimit: calculatedLimit,
        creditScore: data.score_credito || 500,
        salary: salary,
        salaryBank: 'Banco GHW',
        verified: isEligible,
        status: isEligible ? "APPROVED" : "REJECTED",
        bankGhW_validadeBI: data.validade_bi ? new Date(data.validade_bi) : null,
        bankGhW_saldo: data.saldo || 0,
        bankGhW_dividaTotal: data.divida_total || 0,
        bankGhW_incumprimento: data.historico_incumprimento || "Nenhum",
      };

      const existing = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { nuit: data.nuit },
            { biNumber: data.bi },
            { phoneNumber: data.telefone }
          ]
        }
      });

      let customerId: string;
      if (existing) {
        const updated = await this.prisma.customer.update({
          where: { id: existing.id },
          data: customerData,
        });
        customerId = updated.id;
      } else {
        const created = await this.prisma.customer.create({
          data: customerData,
        });
        customerId = created.id;
      }

      let rejectionReasons: string[] = [];
      if (!isEligible) {
        if (!isAccountActive) rejectionReasons.push('Conta Bancária Inativa');
        if (!isBiValid) rejectionReasons.push('B.I. Expirado ou Inválido');
        if (isIncumpridor) rejectionReasons.push('Cliente INCUMPRIDOR (Lista Negra)');
        if (!isCreditClean && !isIncumpridor) rejectionReasons.push('Histórico de Crédito Irregular');
        if (!hasMinimumAccountAge) rejectionReasons.push('Conta com menos de 6 meses');
        if (!hasSalaryDomiciliation) rejectionReasons.push('Sem Domiciliação de Salário');
        if (!hasAcceptableEffortRate) rejectionReasons.push(`Taxa de Esforço Elevada (${(effortRate * 100).toFixed(2)}%)`);
        if (hasExcessiveDebt) rejectionReasons.push('Dívida Total Excessiva');
      }

      await this.sendDecisionToBank({
        nuit: data.nuit,
        nome_completo: data.nome_completo,
        telefone: data.telefone,
        decision: isEligible ? 'APPROVED' : 'REJECTED',
        creditLimit: calculatedLimit,
        rejectionReasons: rejectionReasons,
        score: data.score_credito || 500
      });

      const bankReason = isEligible ? 'Cliente cumpre todos os requisitos bancários' : rejectionReasons.join(' | ');
      
      await this.prisma.scoringResult.deleteMany({ where: { customerId } });
      await this.prisma.scoringResult.create({
        data: {
          customerId,
          finalScore: data.score_credito || (isEligible ? 700 : 300),
          risk: isEligible ? 'LOW' : 'HIGH',
          decision: isEligible ? 'APPROVED' : 'REJECTED',
          maxAmount: calculatedLimit,
          factors: JSON.stringify({
            bankReason,
            isAccountActive,
            isBiValid,
            status_credito: data.status_credito,
            isIncumpridor,
            hasMinimumAccountAge,
            hasSalaryDomiciliation,
            effortRate: (effortRate * 100).toFixed(2),
            hasAcceptableEffortRate,
            hasExcessiveDebt,
            salary,
            monthlyCommitment,
            totalDebt,
            bankData: data
          })
        }
      });

      return { success: true, verified: isEligible };
    } catch (error) {
      this.logger.error(`Erro ao upsert cliente ${data?.nuit}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async deleteCustomer(nuit: string) {
    try {
      const existing = await this.prisma.customer.findUnique({ where: { nuit } });
      if (existing) {
        await this.prisma.scoringResult.deleteMany({ where: { customerId: existing.id } });
        await this.prisma.loan.deleteMany({ where: { customerId: existing.id } });
        await this.prisma.customer.delete({ where: { id: existing.id } });
        return { success: true };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
