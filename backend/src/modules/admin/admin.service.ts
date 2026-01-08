import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as path from 'path';

// sqlite3 used only for admin destructive operations to ensure PRAGMA runs on the same connection
// We require at runtime to avoid build-time type issues when dependency is missing in other environments
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite3 = require('sqlite3');

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
    // Try by primary `id` (UUID). If not found, try by `phoneNumber`, then by suffix match.
    const include = {
      loans: {
        orderBy: { createdAt: 'desc' },
      },
      scoringResults: {
        orderBy: { calculatedAt: 'desc' },
      },
    };

    let customer = await this.prisma.customer.findUnique({ where: { id }, include: include as any });
    if (customer) return customer;

    // Try lookup by phoneNumber exact
    try {
      customer = await this.prisma.customer.findUnique({ where: { phoneNumber: id }, include: include as any });
      if (customer) return customer;
    } catch (e) {
      // findUnique by phoneNumber may throw if phoneNumber is not a unique field in this schema
      // ignore and continue to findFirst
    }

    // Fallback: try suffix match on phoneNumber (best-effort)
    try {
      const suffix = String(id).replace(/\D/g, '').slice(-9); // last 9 digits
      if (suffix) {
        customer = await this.prisma.customer.findFirst({
          where: { phoneNumber: { endsWith: suffix } },
          include: include as any,
        });
        if (customer) return customer;
      }
    } catch (e) {
      // ignore
    }

    return null;
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
      // Gather counts before destructive deletes (for reporting)
      const countInstallments = await this.prisma.installment.count();
      const countPayments = await this.prisma.payment.count();
      const countTransactions = await this.prisma.transaction.count();
      const countSmsLogs = await this.prisma.smsLog.count();
      const countBankValidations = await this.prisma.bankValidation.count();
      const countLoans = await this.prisma.loan.count();
      const countScoring = await this.prisma.scoringResult.count();
      const countCustomers = await this.prisma.customer.count();

      // Delete child records in the proper order inside a transaction to avoid FK violations.
      // Order: installments -> payments -> transactions -> loans -> scoringResult -> bankValidation -> smsLog -> ussdSession -> customers
      try {
        await this.prisma.$transaction([
          this.prisma.installment.deleteMany(),
          this.prisma.payment.deleteMany(),
          this.prisma.transaction.deleteMany(),
          this.prisma.loan.deleteMany(),
          this.prisma.scoringResult.deleteMany(),
          this.prisma.bankValidation.deleteMany(),
          this.prisma.smsLog.deleteMany(),
          // ussdSession may not be present on all schemas; guard via any
          // @ts-ignore
          (this.prisma as any).ussdSession ? (this.prisma as any).ussdSession.deleteMany() : Promise.resolve(),
          this.prisma.customer.deleteMany(),
        ]);
      } catch (txErr) {
        console.warn('Transaction-ordered deletes failed, attempting individual deletes', txErr);
        // Try individual ordered deletes as a best-effort fallback
        await this.prisma.installment.deleteMany();
        await this.prisma.payment.deleteMany();
        await this.prisma.transaction.deleteMany();
        await this.prisma.loan.deleteMany();
        await this.prisma.scoringResult.deleteMany();
        await this.prisma.bankValidation.deleteMany();
        await this.prisma.smsLog.deleteMany();
        // @ts-ignore
        if ((this.prisma as any).ussdSession) await (this.prisma as any).ussdSession.deleteMany();
        await this.prisma.customer.deleteMany();
      }

      console.log(`✓ Reset completed: ${countCustomers} customers, ${countLoans} loans, ${countScoring} scoring results deleted`);

      return {
        success: true,
        message: 'Todos os dados dos clientes foram apagados',
        deleted: {
          customers: countCustomers,
          loans: countLoans,
          scoringResults: countScoring,
          payments: countPayments,
          installments: countInstallments,
          transactions: countTransactions,
          smsLogs: countSmsLogs,
          bankValidations: countBankValidations,
        },
      };
    } catch (error) {
      console.error('Error resetting data:', error);
      throw new Error(`Erro ao apagar dados dos clientes: ${error.message}`);
    }
  }

  // Reset only loans and related records (installments, payments, transactions)
  async resetLoans() {
    try {
      const countInstallments = await this.prisma.installment.count();
      const countPayments = await this.prisma.payment.count();
      const countTransactions = await this.prisma.transaction.count();
      const countLoans = await this.prisma.loan.count();

      // Delete in order: installments -> payments -> transactions -> loans
      try {
        await this.prisma.$transaction([
          this.prisma.installment.deleteMany(),
          this.prisma.payment.deleteMany(),
          this.prisma.transaction.deleteMany(),
          this.prisma.loan.deleteMany(),
        ]);
      } catch (err) {
        console.warn('Loan-ordered transaction failed, falling back to individual deletes', err);
        await this.prisma.installment.deleteMany();
        await this.prisma.payment.deleteMany();
        await this.prisma.transaction.deleteMany();
        await this.prisma.loan.deleteMany();
      }

      return {
        success: true,
        message: 'Empréstimos e registros relacionados apagados',
        deleted: {
          installments: countInstallments,
          payments: countPayments,
          transactions: countTransactions,
          loans: countLoans,
        },
      };
    } catch (error) {
      console.error('Error resetting loans:', error);
      throw new Error(`Erro ao apagar empréstimos: ${error.message}`);
    }
  }

  // Reset only customers and directly related records (will remove loans first)
  async resetCustomers() {
    try {
      const countInstallments = await this.prisma.installment.count();
      const countPayments = await this.prisma.payment.count();
      const countTransactions = await this.prisma.transaction.count();
      const countSmsLogs = await this.prisma.smsLog.count();
      const countBankValidations = await this.prisma.bankValidation.count();
      const countLoans = await this.prisma.loan.count();
      const countScoring = await this.prisma.scoringResult.count();
      const countCustomers = await this.prisma.customer.count();

      // Attempt direct SQLite deletes with PRAGMA foreign_keys = OFF on the same connection.
      // This approach avoids Prisma-level FK enforcement errors when constraints are complex.
      try {
        const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
        const dbPath = dbUrl.replace(/^file:\/\//, '').replace(/^file:/, '');
        // Prefer the prisma folder dev.db if present
        // When code is compiled to dist the __dirname changes, so look for prisma/dev.db up the tree from dist
        const prismaDbCandidates = [
          path.resolve(__dirname, '..', '..', 'prisma', 'dev.db'),
          path.resolve(__dirname, '..', '..', '..', '..', 'prisma', 'dev.db'),
        ];
        let resolved = null;
        for (const candidate of prismaDbCandidates) {
          if (require('fs').existsSync(candidate)) { resolved = candidate; break; }
        }
        if (!resolved) resolved = path.resolve(process.cwd(), dbPath);

        await new Promise<void>((resolve, reject) => {
          const DB = sqlite3.verbose().Database;
          console.log('Admin reset using sqlite DB at', resolved);
          const db = new DB(resolved, (err: any) => {
            if (err) return reject(err);
            const sql = [
              'PRAGMA foreign_keys = OFF;',
              'DELETE FROM installments;',
              'DELETE FROM payments;',
              'DELETE FROM transactions;',
              'DELETE FROM loans;',
              'DELETE FROM scoring_results;',
              'DELETE FROM bank_validations;',
              'DELETE FROM sms_logs;',
              'DELETE FROM ussd_sessions;',
              'DELETE FROM customers;',
              'PRAGMA foreign_keys = ON;'
            ].join('\n');

            db.exec(sql, (execErr: any) => {
              db.close(() => {});
              if (execErr) return reject(execErr);
              resolve();
            });
          });
        });
      } catch (sqliteErr) {
        console.warn('Direct SQLite delete approach failed, falling back to Prisma deletes', sqliteErr);
        // Fallback: delete in order via Prisma (best-effort)
        await this.prisma.installment.deleteMany();
        await this.prisma.payment.deleteMany();
        await this.prisma.transaction.deleteMany();
        await this.prisma.loan.deleteMany();
        await this.prisma.scoringResult.deleteMany();
        await this.prisma.bankValidation.deleteMany();
        await this.prisma.smsLog.deleteMany();
        // @ts-ignore
        if ((this.prisma as any).ussdSession) await (this.prisma as any).ussdSession.deleteMany();
        await this.prisma.customer.deleteMany();
      }

      return {
        success: true,
        message: 'Clientes e dados relacionados apagados',
        deleted: {
          customers: countCustomers,
          loans: countLoans,
          scoringResults: countScoring,
          payments: countPayments,
          installments: countInstallments,
          transactions: countTransactions,
          smsLogs: countSmsLogs,
          bankValidations: countBankValidations,
        },
      };
    } catch (error) {
      console.error('Error resetting customers:', error);
      throw new Error(`Erro ao apagar dados dos clientes: ${error.message}`);
    }
  }
}
