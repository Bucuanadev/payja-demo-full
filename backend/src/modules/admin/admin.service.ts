import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalCustomers,
      totalLoans,
      pendingLoans,
      approvedLoans,
      activeLoans,
      totalDisbursed,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.loan.count(),
      this.prisma.loan.count({ where: { status: 'PENDING' } }),
      this.prisma.loan.count({ where: { status: 'APPROVED' } }),
      this.prisma.loan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.loan.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['DISBURSED', 'ACTIVE', 'COMPLETED'] } },
      }),
    ]);

    const recentLoans = await this.prisma.loan.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        scoring: true,
      },
    });

    return {
      stats: {
        totalCustomers,
        totalLoans,
        pendingLoans,
        approvedLoans,
        activeLoans,
        totalDisbursed: totalDisbursed._sum.amount || 0,
      },
      recentLoans,
    };
  }

  async getCustomers(filters?: any) {
    return this.prisma.customer.findMany({
      where: filters,
      include: {
        loans: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        scoringResults: {
          take: 1,
          orderBy: { calculatedAt: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCustomerById(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        loans: {
          orderBy: { createdAt: 'desc' },
        },
        scoringResults: {
          orderBy: { calculatedAt: 'desc' },
        },
      },
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async getAuditLogs(filters?: any) {
    return this.prisma.auditLog.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createAuditLog(data: any) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        userType: data.userType || 'ADMIN',
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async resetTestData() {
    try {
      console.log('🧹 Iniciando limpeza de dados de teste...');

      // Primeiro, buscar IDs de clientes de teste
      const testCustomers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { phoneNumber: { startsWith: '25886' } },
            { nuit: '123456789' },
          ],
        },
        select: { id: true, phoneNumber: true, nuit: true },
      });

      if (testCustomers.length === 0) {
        return {
          success: true,
          message: 'Nenhum dado de teste encontrado.',
          deleted: {
            customers: 0,
            loans: 0,
            sessions: 0,
            sms: 0,
          },
        };
      }

      const customerIds = testCustomers.map((c) => c.id);

      // Buscar IDs dos empréstimos
      const testLoans = await this.prisma.loan.findMany({
        where: { customerId: { in: customerIds } },
        select: { id: true },
      });
      const loanIds = testLoans.map((l) => l.id);

      // 1. Deletar installments
      const installments = await this.prisma.installment.deleteMany({
        where: { loanId: { in: loanIds } },
      });

      // 2. Deletar transações
      const transactions = await this.prisma.transaction.deleteMany({
        where: { loanId: { in: loanIds } },
      });

      // 3. Deletar pagamentos
      const payments = await this.prisma.payment.deleteMany({
        where: { loanId: { in: loanIds } },
      });

      // 4. Deletar empréstimos
      const loans = await this.prisma.loan.deleteMany({
        where: { customerId: { in: customerIds } },
      });

      // 5. Deletar scoring results
      const scoring = await this.prisma.scoringResult.deleteMany({
        where: { customerId: { in: customerIds } },
      });

      // 6. Deletar sessões USSD
      const sessions = await this.prisma.ussdSession.deleteMany({
        where: {
          OR: [
            { phoneNumber: { startsWith: '25886' } },
            { customerId: { in: customerIds } },
          ],
        },
      });

      // 7. Deletar SMS
      const sms = await this.prisma.smsLog.deleteMany({
        where: { phoneNumber: { startsWith: '25886' } },
      });

      // 8. Deletar clientes
      const customers = await this.prisma.customer.deleteMany({
        where: { id: { in: customerIds } },
      });

      console.log('✅ Limpeza concluída!');

      return {
        success: true,
        message: 'Dados de teste removidos com sucesso!',
        deleted: {
          customers: customers.count,
          loans: loans.count,
          installments: installments.count,
          transactions: transactions.count,
          payments: payments.count,
          scoring: scoring.count,
          sessions: sessions.count,
          sms: sms.count,
        },
      };
    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
      throw error;
    }
  }
}
