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
      // Delete in order: first scoring results, then loans, then customers
      const deletedScoring = await this.prisma.scoringResult.deleteMany({});
      const deletedLoans = await this.prisma.loan.deleteMany({});
      const deletedCustomers = await this.prisma.customer.deleteMany({});
      
      console.log(`✓ Reset completed: ${deletedCustomers.count} customers, ${deletedLoans.count} loans, ${deletedScoring.count} scoring results deleted`);
      
      return {
        success: true,
        message: 'Todos os dados dos clientes foram apagados',
        deleted: {
          customers: deletedCustomers.count,
          loans: deletedLoans.count,
          scoringResults: deletedScoring.count,
        },
      };
    } catch (error) {
      console.error('Error resetting data:', error);
      throw new Error(`Erro ao apagar dados dos clientes: ${error.message}`);
    }
  }
}
