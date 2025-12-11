import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

interface ScoringFactors {
  historyScore: number;
  amountScore: number;
  frequencyScore: number;
  paymentHistoryScore: number;
  baseScore: number;
}

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  async calculateScoring(customerId: string, loanId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loans: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    // Calcular fatores de scoring
    const factors = this.calculateFactors(customer, loan);
    const finalScore = this.calculateFinalScore(factors);
    const risk = this.calculateRisk(finalScore);
    const decision = this.makeDecision(finalScore, loan.amount);

    // Salvar resultado
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

    // Atualizar empréstimo
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        scoringId: scoringResult.id,
        status: decision.decision === 'APPROVED' ? 'APPROVED' : 
                decision.decision === 'REJECTED' ? 'REJECTED' : 'ANALYZING',
      },
    });

    return scoringResult;
  }

  private calculateFactors(customer: any, loan: any): ScoringFactors {
    // 1. Score base (novo cliente vs. existente)
    const baseScore = customer.loans.length > 0 ? 500 : 400;

    // 2. Histórico de empréstimos
    const completedLoans = customer.loans.filter(l => l.status === 'COMPLETED').length;
    const historyScore = Math.min(completedLoans * 50, 150);

    // 3. Score baseado no valor solicitado (menor = melhor)
    const amountRatio = loan.amount / 50000; // Normalizar para max
    const amountScore = Math.round((1 - amountRatio) * 100);

    // 4. Frequência de solicitações (não muito frequente)
    const recentLoans = customer.loans.filter(l => {
      const daysSince = (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    }).length;
    const frequencyScore = recentLoans > 2 ? -50 : 50;

    // 5. Histórico de pagamentos
    const overdueLoans = customer.loans.filter(l => l.status === 'OVERDUE' || l.status === 'DEFAULTED').length;
    const paymentHistoryScore = overdueLoans > 0 ? -100 : 100;

    return {
      baseScore,
      historyScore,
      amountScore,
      frequencyScore,
      paymentHistoryScore,
    };
  }

  private calculateFinalScore(factors: ScoringFactors): number {
    const total = factors.baseScore +
                  factors.historyScore +
                  factors.amountScore +
                  factors.frequencyScore +
                  factors.paymentHistoryScore;

    // Normalizar para range 300-850
    return Math.max(300, Math.min(850, total));
  }

  private calculateRisk(score: number): string {
    if (score >= 750) return 'VERY_LOW';
    if (score >= 650) return 'LOW';
    if (score >= 550) return 'MEDIUM';
    if (score >= 450) return 'HIGH';
    return 'VERY_HIGH';
  }

  private makeDecision(score: number, requestedAmount: number) {
    const approvalThreshold = 600;

    if (score >= approvalThreshold) {
      // Aprovado
      const maxAmount = this.calculateMaxAmount(score);
      return {
        decision: 'APPROVED',
        maxAmount: Math.max(requestedAmount, maxAmount),
      };
    } else if (score >= 500) {
      // Revisão manual
      return {
        decision: 'MANUAL_REVIEW',
        maxAmount: null,
      };
    } else {
      // Rejeitado
      return {
        decision: 'REJECTED',
        maxAmount: null,
      };
    }
  }

  private calculateMaxAmount(score: number): number {
    // Score 600-850 -> 5.000 a 50.000 MZN
    const minAmount = 5000;
    const maxAmount = 50000;
    const normalizedScore = (score - 600) / (850 - 600);
    return Math.round(minAmount + (normalizedScore * (maxAmount - minAmount)));
  }

  async getCustomerScore(customerId: string) {
    return this.prisma.scoringResult.findFirst({
      where: { customerId },
      orderBy: { calculatedAt: 'desc' },
    });
  }
}
