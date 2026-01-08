import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BankAdaptersService } from '../bank-adapters/bank-adapters-v2.service';

interface ScoringFactors {
  historyScore: number;
  amountScore: number;
  frequencyScore: number;
  paymentHistoryScore: number;
  baseScore: number;
}

interface ScoringDecision {
  decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  maxAmount: number | null;
  bankLimit?: number;
  finalLimit?: number;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  
  constructor(
    private prisma: PrismaService,
    private bankAdaptersService: BankAdaptersService,
  ) {}

  async calculateScoring(customerId: string, loanId: string, bankCode?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loans: true,
      },
    });

    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    let bankLimit: number | null = null;
    if (bankCode) {
      try {
        const eligibility = await this.bankAdaptersService.checkEligibility(
          bankCode,
          {
            customerId: customer.id,
            phoneNumber: customer.phoneNumber,
            nuit: customer.nuit,
          }
        );
        bankLimit = eligibility.eligible ? 200000 : 0;
      } catch (error) {
        this.logger.error(`Erro ao consultar banco: ${error.message}`);
        bankLimit = 200000;
      }
    }

    const factors = this.calculateFactors(customer, loan);
    const finalScore = this.calculateFinalScore(factors);
    const risk = this.calculateRisk(finalScore);
    const decision = this.makeDecision(finalScore, loan.amount, bankLimit);

    const scoringResult = await this.prisma.scoringResult.create({
      data: {
        customerId,
        finalScore,
        risk,
        factors: JSON.stringify(factors),
        decision: decision.decision,
        maxAmount: decision.maxAmount,
      },
    });

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        scoringId: scoringResult.id,
        status: decision.decision === 'APPROVED' ? 'APPROVED' : 
                decision.decision === 'REJECTED' ? 'REJECTED' : 'ANALYZING',
      },
    });

    return {
      ...scoringResult,
      bankLimit: decision.bankLimit,
      finalLimit: decision.finalLimit,
    };
  }

  private calculateFactors(customer: any, loan: any): ScoringFactors {
    const baseScore = customer.loans.length > 0 ? 500 : 400;
    const completedLoans = customer.loans.filter(l => l.status === 'COMPLETED').length;
    const historyScore = Math.min(completedLoans * 50, 150);
    const amountRatio = loan.amount / 50000;
    const amountScore = Math.max(0, 100 - amountRatio * 100);
    const recentLoans = customer.loans.filter(l => {
      const daysSince = (new Date().getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    }).length;
    const frequencyScore = recentLoans > 2 ? 0 : 100;
    const overdueLoans = customer.loans.filter(l => l.status === 'OVERDUE' || l.status === 'DEFAULTED').length;
    const paymentHistoryScore = Math.max(0, 100 - overdueLoans * 50);

    return {
      baseScore,
      historyScore,
      amountScore,
      frequencyScore,
      paymentHistoryScore,
    };
  }

  private calculateFinalScore(factors: ScoringFactors): number {
    const { baseScore, historyScore, amountScore, frequencyScore, paymentHistoryScore } = factors;
    const score = baseScore + historyScore + amountScore * 0.5 + frequencyScore * 0.5 + paymentHistoryScore * 0.8;
    return Math.round(Math.min(850, Math.max(300, score)));
  }

  private calculateRisk(score: number): string {
    if (score >= 750) return 'VERY_LOW';
    if (score >= 650) return 'LOW';
    if (score >= 550) return 'MEDIUM';
    if (score >= 450) return 'HIGH';
    return 'VERY_HIGH';
  }

  private makeDecision(score: number, requestedAmount: number, bankLimit: number | null): ScoringDecision {
    const scoringMaxAmount = this.calculateMaxAmount(score);
    const effectiveBankLimit = bankLimit !== null ? bankLimit : Infinity;
    const finalLimit = Math.min(scoringMaxAmount, effectiveBankLimit);

    const approvalThreshold = 550;

    if (score >= approvalThreshold) {
      if (requestedAmount <= finalLimit) {
        return {
          decision: 'APPROVED',
          maxAmount: finalLimit,
          bankLimit: bankLimit !== null ? bankLimit : undefined,
          finalLimit,
        };
      } else {
        return {
          decision: 'MANUAL_REVIEW',
          maxAmount: finalLimit,
          bankLimit: bankLimit !== null ? bankLimit : undefined,
          finalLimit,
        };
      }
    } else {
      return {
        decision: 'REJECTED',
        maxAmount: 0,
      };
    }
  }

  private calculateMaxAmount(score: number): number {
    if (score < 550) return 0;
    const normalizedScore = (score - 600) / (850 - 600);
    return Math.round(5000 + normalizedScore * 45000);
  }

  async getCustomerScore(customerId: string) {
    return this.prisma.scoringResult.findFirst({
      where: { customerId },
      orderBy: { calculatedAt: 'desc' },
    });
  }
}
