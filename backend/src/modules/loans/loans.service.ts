import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

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
  constructor(private prisma: PrismaService) {}

  async createLoan(data: CreateLoanDto) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + data.termMonths);

    return this.prisma.loan.create({
      data: {
        customerId: data.customerId,
        amount: data.amount,
        interestRate: 15,
        termMonths: data.termMonths,
        purpose: data.purpose,
        totalAmount: data.totalAmount,
        monthlyPayment: data.monthlyPayment,
        status: 'ANALYZING',
        dueDate,
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

  async acceptTerms(customerId: string, version: string) {
    // Record terms acceptance (implementation depends on your schema)
    return { success: true, message: 'Terms accepted' };
  }
}
