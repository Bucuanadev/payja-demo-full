import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface InstallmentSchedule {
  loanId: string;
  totalAmount: number;
  termMonths: number;
  monthlyPayment: number;
  installments: Array<{
    number: number;
    principal: number;
    interest: number;
    total: number;
    dueDate: Date;
  }>;
}

@Injectable()
export class InstallmentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Gera o cronograma de prestações para um empréstimo
   */
  async generateInstallmentSchedule(loanId: string): Promise<InstallmentSchedule> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Empréstimo não encontrado');
    }

    const installments = [];
    const monthlyInterestRate = loan.interestRate / 100 / 12;
    const principal = loan.amount;
    const months = loan.termMonths;

    // Calcular pagamento mensal usando fórmula de amortização
    const monthlyPayment =
      (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, months)) /
      (Math.pow(1 + monthlyInterestRate, months) - 1);

    let remainingPrincipal = principal;
    const startDate = loan.disbursedAt || new Date();

    for (let i = 1; i <= months; i++) {
      const interestAmount = remainingPrincipal * monthlyInterestRate;
      const principalAmount = monthlyPayment - interestAmount;
      remainingPrincipal -= principalAmount;

      // Calcular data de vencimento (próximo mês)
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      installments.push({
        number: i,
        principal: Math.round(principalAmount * 100) / 100,
        interest: Math.round(interestAmount * 100) / 100,
        total: Math.round(monthlyPayment * 100) / 100,
        dueDate,
      });
    }

    return {
      loanId,
      totalAmount: loan.totalAmount,
      termMonths: months,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      installments,
    };
  }

  /**
   * Cria as prestações no banco de dados
   */
  async createInstallments(loanId: string) {
    const schedule = await this.generateInstallmentSchedule(loanId);

    const createdInstallments = await Promise.all(
      schedule.installments.map((inst) =>
        this.prisma.installment.create({
          data: {
            loanId,
            installmentNumber: inst.number,
            principalAmount: inst.principal,
            interestAmount: inst.interest,
            totalAmount: inst.total,
            dueDate: inst.dueDate,
            status: 'PENDING',
          },
        }),
      ),
    );

    return createdInstallments;
  }

  /**
   * Registra o pagamento de uma prestação
   */
  async processInstallmentPayment(
    installmentId: string,
    paymentMethod: string,
    reference?: string,
  ) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
    });

    if (!installment) {
      throw new Error('Prestação não encontrada');
    }

    if (installment.status === 'PAID') {
      throw new Error('Prestação já foi paga');
    }

    // Calcular multa por atraso (se houver)
    const today = new Date();
    const dueDate = new Date(installment.dueDate);
    const lateDays = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let lateFee = 0;
    if (lateDays > 0) {
      // 1% de multa por dia de atraso, máximo 10%
      const lateFeePercentage = Math.min(lateDays * 0.01, 0.10);
      lateFee = installment.totalAmount * lateFeePercentage;
    }

    const totalToPay = installment.totalAmount + lateFee;

    // Criar registro de pagamento
    const payment = await this.prisma.payment.create({
      data: {
        loanId: installment.loanId,
        amount: totalToPay,
        paymentMethod,
        reference,
        status: 'COMPLETED',
        dueDate: installment.dueDate,
        paidAt: new Date(),
      },
    });

    // Atualizar prestação
    const updatedInstallment = await this.prisma.installment.update({
      where: { id: installmentId },
      data: {
        status: 'PAID',
        paidDate: new Date(),
        lateFee,
        lateDays: Math.max(lateDays, 0),
        paymentId: payment.id,
      },
    });

    // Verificar se todas as prestações foram pagas
    await this.checkLoanCompletion(installment.loanId);

    return {
      installment: updatedInstallment,
      payment,
      lateFee,
      lateDays: Math.max(lateDays, 0),
      totalPaid: totalToPay,
    };
  }

  /**
   * Verifica se todas as prestações foram pagas e atualiza status do empréstimo
   */
  private async checkLoanCompletion(loanId: string) {
    const installments = await this.prisma.installment.findMany({
      where: { loanId },
    });

    const allPaid = installments.every((inst) => inst.status === 'PAID');

    if (allPaid) {
      await this.prisma.loan.update({
        where: { id: loanId },
        data: { status: 'COMPLETED' },
      });
    }
  }

  /**
   * Busca prestações pendentes
   */
  async getPendingInstallments(loanId: string) {
    return this.prisma.installment.findMany({
      where: {
        loanId,
        status: 'PENDING',
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Busca prestações vencidas (overdue)
   */
  async getOverdueInstallments() {
    const today = new Date();

    const overdueInstallments = await this.prisma.installment.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: today,
        },
      },
      include: {
        payment: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Atualizar status do empréstimo para OVERDUE se necessário
    const loanIds = [...new Set(overdueInstallments.map((i) => i.loanId))];

    await Promise.all(
      loanIds.map((loanId) =>
        this.prisma.loan.update({
          where: { id: loanId },
          data: { status: 'OVERDUE' },
        }),
      ),
    );

    return overdueInstallments;
  }

  /**
   * Gera relatório de prestações
   */
  async getInstallmentReport(startDate: Date, endDate: Date) {
    const installments = await this.prisma.installment.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        payment: true,
      },
    });

    const paid = installments.filter((i) => i.status === 'PAID');
    const pending = installments.filter((i) => i.status === 'PENDING');
    const overdue = pending.filter((i) => new Date(i.dueDate) < new Date());

    const totalExpected = installments.reduce(
      (sum, i) => sum + i.totalAmount,
      0,
    );
    const totalReceived = paid.reduce((sum, i) => sum + i.totalAmount + i.lateFee, 0);
    const totalLateFees = paid.reduce((sum, i) => sum + i.lateFee, 0);

    return {
      period: { start: startDate, end: endDate },
      total: installments.length,
      paid: paid.length,
      pending: pending.length,
      overdue: overdue.length,
      totalExpected: Math.round(totalExpected * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      totalLateFees: Math.round(totalLateFees * 100) / 100,
      collectionRate: (paid.length / installments.length) * 100,
    };
  }

  /**
   * Busca próximas prestações a vencer (para notificações)
   */
  async getUpcomingInstallments(daysAhead: number = 7) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.installment.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}
