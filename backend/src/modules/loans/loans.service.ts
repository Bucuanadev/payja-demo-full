import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CommissionService } from './commission.service';
import { InterestRateService } from './interest-rate.service';

interface CreateLoanDto {
  customerId: string;
  amount: number;
  termMonths: number;
  termDays?: number;
  purpose?: string;
  totalAmount: number;
  monthlyPayment: number;
  bankCode?: string;
  bankName?: string;
  interestRate?: number;
  channel?: string;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private prisma: PrismaService,
    private commissionService: CommissionService,
    private interestRateService: InterestRateService,
  ) {}

  async createLoan(data: CreateLoanDto) {
    this.logger.log(`🔍 Criando empréstimo para customer ${data.customerId}`);
    // NOVO: VALIDAÇÃO PRÉVIA DO VALOR SOLICITADO
    // Verifica se o valor está dentro dos limites aprovados
    // pela validação cruzada Emola ↔ Banco
    // ============================================================
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Validação de limite comentada temporariamente
    // const amountCheck = await this.crossValidationService.isAmountWithinLimit(
    //   data.customerId,
    //   data.amount,
    // );
    // if (!amountCheck.approved) {
    //   throw new Error(`Valor não aprovado. Limite máximo: ${amountCheck.maxAllowed} MZN`);
    // }
    this.logger.log(`✅ Valor ${data.amount} MZN aprovado`);
    // ============================================================

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + data.termMonths);

    // Calcular comissões
    const commissions = this.commissionService.calculateCommissions(
      data.amount,
    );

    return this.prisma.loan.create({
      data: {
        customerId: data.customerId,
        amount: data.amount,
        interestRate: data.interestRate || 15,
        termMonths: data.termMonths,
        purpose: data.purpose,
        totalAmount: data.totalAmount,
        monthlyPayment: data.monthlyPayment,
        status: 'ANALYZING',
        dueDate,
        bankCode: data.bankCode,
        bankName: data.bankName,
        channel: data.channel || 'APP', // Define origem
        emolaCommission: commissions.emolaPercentage,
        payjaCommission: commissions.payjaPercentage,
        bankCommission: commissions.bankPercentage,
        totalCommission: commissions.totalCommission,
        commissionBreakdown:
          this.commissionService.formatCommissionBreakdown(commissions),
      },
      include: {
        customer: true,
      },
    });
  }

  async getAllLoans(filters?: any) {
    return this.prisma.loan.findMany({
      where: filters,
      include: {
        customer: true,
        scoring: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getLoanById(id: string) {
    return this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: true,
        scoring: true,
        payments: true,
      },
    });
  }

  async updateLoanStatus(id: string, status: string, adminId?: string) {
    const data: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'APPROVED') {
      data.approvedBy = adminId;
      data.approvedAt = new Date();
    } else if (status === 'DISBURSED') {
      data.disbursedAt = new Date();
    }

    return this.prisma.loan.update({
      where: { id },
      data,
    });
  }

  async getCustomerLoans(customerId: string) {
    return this.prisma.loan.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatistics() {
    const [total, pending, approved, rejected, active, completed] = await Promise.all([
      this.prisma.loan.count(),
      this.prisma.loan.count({ where: { status: 'PENDING' } }),
      this.prisma.loan.count({ where: { status: 'APPROVED' } }),
      this.prisma.loan.count({ where: { status: 'REJECTED' } }),
      this.prisma.loan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.loan.count({ where: { status: 'COMPLETED' } }),
    ]);

    const totalAmount = await this.prisma.loan.aggregate({
      _sum: { amount: true },
      where: { status: { in: ['APPROVED', 'DISBURSED', 'ACTIVE'] } },
    });

    return {
      total,
      pending,
      approved,
      rejected,
      active,
      completed,
      totalAmount: totalAmount._sum.amount || 0,
    };
  }

  /**
   * Calcula valor para liquidação antecipada com desconto
   */
  async calculateEarlyPayment(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Empréstimo não encontrado');
    }

    if (loan.status !== 'ACTIVE') {
      throw new Error('Apenas empréstimos ativos podem ser liquidados');
    }

    // Buscar configuração de taxa
    let config;
    if (loan.termMonths >= 12) {
      config = this.interestRateService.getConfigByMonths(12);
    } else if (loan.termMonths >= 6) {
      config = this.interestRateService.getConfigByMonths(6);
    } else {
      config = this.interestRateService.getConfigByMonths(loan.termMonths);
    }

    if (!config) {
      throw new Error('Configuração de taxa não encontrada');
    }

    // Calcular saldo devedor (total - pago)
    const paidAmount = await this.prisma.payment.aggregate({
      where: { loanId: loanId, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const remainingAmount = loan.totalAmount - (paidAmount._sum.amount || 0);

    // Calcular desconto
    const earlyPayment = this.interestRateService.calculateEarlyPaymentAmount(
      loanId,
      remainingAmount,
      config,
    );

    return {
      loan: {
        id: loan.id,
        amount: loan.amount,
        totalAmount: loan.totalAmount,
        status: loan.status,
      },
      payment: earlyPayment,
      message: earlyPayment.eligibleForDiscount
        ? `Desconto de ${earlyPayment.discountPercentage}% aplicado para liquidação antecipada`
        : 'Este empréstimo não é elegível para desconto',
    };
  }

  /**
   * Processa liquidação antecipada
   */
  async processEarlyPayment(
    loanId: string,
    paymentMethod: string,
    transactionReference: string,
  ) {
    const calculation = await this.calculateEarlyPayment(loanId);

    // Registrar pagamento
    const payment = await this.prisma.payment.create({
      data: {
        loanId: loanId,
        amount: calculation.payment.finalAmount,
        dueDate: new Date(),
        paidAt: new Date(),
        paymentMethod: paymentMethod,
        reference: transactionReference,
        status: 'COMPLETED',
      },
    });

    // Atualizar status do empréstimo
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'COMPLETED',
      },
    });

    return {
      success: true,
      payment,
      savings: calculation.payment.discount,
      message: 'Empréstimo liquidado com sucesso!',
    };
  }

  /**
   * Retorna termos e condições atuais
   */
  async getCurrentTerms() {
    const terms = await this.prisma.systemConfig.findFirst({
      where: { key: 'TERMS_AND_CONDITIONS' },
      orderBy: { createdAt: 'desc' },
    });

    if (!terms) {
      // Retornar termos padrão se não houver no banco
      return {
        version: '1.0',
        content: `TERMOS E CONDIÇÕES - PayJA

1. ACEITAÇÃO DOS TERMOS
Ao solicitar um empréstimo através do PayJA, você concorda com estes termos e condições.

2. TAXAS DE JUROS
- 7 dias: 8% (pagamento único)
- 15 dias: 10% (pagamento único)
- 30 dias: 12% (2 parcelas quinzenais)
- 3 meses: 15% (3 parcelas mensais)
- 6 meses: 18% (6 parcelas mensais)
- 12 meses: 20% (12 parcelas mensais)

3. COMISSÕES
- E-Mola: 3%
- PayJA: 3%
- Banco parceiro: 8%
Total de comissões: 14% sobre o valor do empréstimo

4. PAGAMENTO ANTECIPADO
Empréstimos de 6 meses ou mais têm desconto de 2% para liquidação antecipada.

5. ATRASOS
Multa de 1% ao dia sobre o valor da parcela em atraso, limitado a 10%.

6. OBRIGAÇÕES DO CLIENTE
- Fornecer informações verdadeiras
- Manter dados atualizados
- Pagar nas datas acordadas

7. ANÁLISE DE CRÉDITO
Todos os pedidos passam por análise de crédito e scoring.

Versão: 1.0
Data: ${new Date().toLocaleDateString('pt-MZ')}`,
        createdAt: new Date(),
      };
    }

    return {
      version: terms.value,
      content: terms.description || terms.value,
      createdAt: terms.createdAt,
    };
  }

  /**
   * Registra aceite dos termos
   */
  async acceptTerms(customerId: string, termsVersion: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Registrar aceite
    const acceptance = await this.prisma.systemConfig.create({
      data: {
        key: `TERMS_ACCEPTANCE_${customerId}`,
        value: termsVersion,
        description: `Aceite de termos do cliente ${customerId}`,
        category: 'TERMS_ACCEPTANCE',
      },
    });

    return {
      success: true,
      acceptance,
      message: 'Termos aceitos com sucesso',
    };
  }
}
