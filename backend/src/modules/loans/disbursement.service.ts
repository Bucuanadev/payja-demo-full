import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface DisbursementRequest {
  loanId: string;
  bankCode: string;
  amount: number;
  emolaPhoneNumber: string;
}

export interface DisbursementResult {
  success: boolean;
  message: string;
  transactions?: any[];
  errorCode?: string;
}

@Injectable()
export class DisbursementService {
  constructor(private prisma: PrismaService) {}

  /**
   * Processa o desembolso completo: Banco -> PayJA -> E-Mola -> Cliente
   */
  async processDisbursement(
    request: DisbursementRequest,
  ): Promise<DisbursementResult> {
    try {
      const loan = await this.prisma.loan.findUnique({
        where: { id: request.loanId },
        include: { customer: true },
      });

      if (!loan) {
        return {
          success: false,
          message: 'Empréstimo não encontrado',
          errorCode: 'LOAN_NOT_FOUND',
        };
      }

      if (loan.status !== 'APPROVED') {
        return {
          success: false,
          message: 'Empréstimo não está aprovado',
          errorCode: 'LOAN_NOT_APPROVED',
        };
      }

      const transactions = [];

      // 1. Transação: Banco -> PayJA (valor total do empréstimo)
      const bankToPayja = await this.createTransaction({
        loanId: loan.id,
        type: 'DISBURSEMENT',
        description: `Desembolso do banco ${request.bankCode} para PayJA`,
        from: 'BANK',
        to: 'PAYJA',
        amount: loan.amount,
        externalRef: `BANK-${Date.now()}`,
      });
      transactions.push(bankToPayja);

      // 2. Comissão do Banco (retida pelo banco)
      const bankCommission = await this.createTransaction({
        loanId: loan.id,
        type: 'COMMISSION',
        description: `Comissão do banco ${request.bankCode}`,
        from: 'PAYJA',
        to: 'BANK',
        amount: loan.amount * (loan.bankCommission || 0.08),
        externalRef: `COMM-BANK-${Date.now()}`,
      });
      transactions.push(bankCommission);

      // 3. Comissão do PayJA (retida)
      const payjaCommission = await this.createTransaction({
        loanId: loan.id,
        type: 'COMMISSION',
        description: 'Comissão PayJA',
        from: 'PAYJA',
        to: 'PAYJA',
        amount: loan.amount * (loan.payjaCommission || 0.03),
        externalRef: `COMM-PAYJA-${Date.now()}`,
      });
      transactions.push(payjaCommission);

      // 4. Transação: PayJA -> E-Mola
      const payjaToEmola = await this.createTransaction({
        loanId: loan.id,
        type: 'DISBURSEMENT',
        description: 'Transferência PayJA para E-Mola',
        from: 'PAYJA',
        to: 'EMOLA',
        amount: loan.amount - bankCommission.amount - payjaCommission.amount,
        externalRef: `PAYJA-EMOLA-${Date.now()}`,
      });
      transactions.push(payjaToEmola);

      // 5. Comissão do E-Mola
      const emolaCommission = await this.createTransaction({
        loanId: loan.id,
        type: 'COMMISSION',
        description: 'Comissão E-Mola',
        from: 'EMOLA',
        to: 'EMOLA',
        amount: loan.amount * (loan.emolaCommission || 0.03),
        externalRef: `COMM-EMOLA-${Date.now()}`,
      });
      transactions.push(emolaCommission);

      // 6. Transação final: E-Mola -> Cliente
      const emolaToCustomer = await this.createTransaction({
        loanId: loan.id,
        type: 'DISBURSEMENT',
        description: `Desembolso para cliente ${loan.customer.phoneNumber}`,
        from: 'EMOLA',
        to: 'CUSTOMER',
        amount: payjaToEmola.amount - emolaCommission.amount,
        externalRef: `EMOLA-CUSTOMER-${Date.now()}`,
      });
      transactions.push(emolaToCustomer);

      // 7. Atualizar status do empréstimo
      await this.prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'DISBURSED',
          disbursedAt: new Date(),
        },
      });

      // 8. Simular envio para E-Mola (em produção seria chamada real à API)
      await this.sendToEMola({
        phoneNumber: request.emolaPhoneNumber,
        amount: emolaToCustomer.amount,
        reference: emolaToCustomer.externalRef,
      });

      return {
        success: true,
        message: 'Desembolso processado com sucesso',
        transactions,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao processar desembolso',
        errorCode: 'DISBURSEMENT_ERROR',
      };
    }
  }

  /**
   * Cria uma transação no banco de dados
   */
  private async createTransaction(data: {
    loanId: string;
    type: string;
    description: string;
    from: string;
    to: string;
    amount: number;
    externalRef?: string;
  }) {
    return this.prisma.transaction.create({
      data: {
        ...data,
        status: 'COMPLETED',
        processedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  /**
   * Simula envio de fundos para E-Mola
   * Em produção, seria uma chamada à API real do E-Mola
   */
  private async sendToEMola(data: {
    phoneNumber: string;
    amount: number;
    reference: string;
  }): Promise<boolean> {
    // Simular delay de processamento
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('📱 E-Mola Transfer:', {
      to: data.phoneNumber,
      amount: `${data.amount.toFixed(2)} MZN`,
      reference: data.reference,
      status: 'SUCCESS',
    });

    return true;
  }

  /**
   * Busca histórico de transações de um empréstimo
   */
  async getLoanTransactions(loanId: string) {
    return this.prisma.transaction.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Gera relatório de desembolsos por período
   */
  async getDisbursementReport(startDate: Date, endDate: Date) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        type: 'DISBURSEMENT',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });

    const totalDisbursed = transactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      totalTransactions: transactions.length,
      totalDisbursed: Math.round(totalDisbursed * 100) / 100,
      transactions,
    };
  }
}
