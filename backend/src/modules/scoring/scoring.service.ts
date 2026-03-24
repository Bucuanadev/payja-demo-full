import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BankAdaptersService, BankEligibilityResponse } from '../bank-adapters/bank-adapters-v2.service';

interface ScoringFactors {
  baseScore: number;
  historyScore: number;
  amountScore: number;
  frequencyScore: number;
  paymentHistoryScore: number;
  bankEligibilityScore: number;
}

interface ScoringDecision {
  decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  maxAmount: number;
  bankLimit?: number;
  finalLimit?: number;
  reason?: string;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private prisma: PrismaService,
    private bankAdapters: BankAdaptersService,
  ) {}

  async calculateScore(loanId: string) {
    this.logger.log('Iniciando cálculo de score para empréstimo: ' + loanId);

    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        customer: {
          include: {
            loans: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Empréstimo não encontrado');
    }

    const { customerId, customer } = loan;
    
    let bankLimit = null;
    let bankReason = '';
    let bankData = null;

    // Tentar consultar elegibilidade no banco parceiro (Banco GHW por padrão)
    try {
      const eligibility: BankEligibilityResponse = await this.bankAdapters.checkEligibility('GHW', {
        customerId: customer.id,
        phoneNumber: customer.phoneNumber,
        nuit: customer.nuit,
        nome: customer.name,
        bi: customer.biNumber,
        valor_solicitado: loan.amount
      });

      if (eligibility.eligible) {
        bankLimit = eligibility.maxAmount || 0;
        bankData = eligibility.bankData;
      } else {
        bankLimit = 0;
        bankReason = eligibility.reason || 'Não elegível pelo banco parceiro';
      }
    } catch (error) {
      this.logger.error('Erro ao consultar banco parceiro:', error.message);
      // Se falhar a comunicação, mantemos bankLimit como null para usar apenas dados locais
      bankLimit = 0;
      bankReason = 'Erro de comunicação com o banco parceiro';
    }

    const factors = this.calculateFactors(customer, loan, bankLimit);
    const finalScore = this.calculateFinalScore(factors);
    const risk = this.calculateRisk(finalScore);
    const decision = this.makeDecision(finalScore, loan.amount, bankLimit, bankReason);

    const scoringResult = await this.prisma.scoringResult.create({
      data: {
        customerId,
        finalScore,
        risk,
        factors: JSON.stringify({
          ...factors,
          bankReason,
          bankData
        }),
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

    // Atualizar status do cliente se necessário
    if (decision.decision === 'APPROVED') {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { 
          verified: true,
          creditLimit: decision.maxAmount
        }
      });
    }

    // FEEDBACK LOOP: Notificar o banco sobre o resultado da validação do PayJA
    try {
      this.logger.log(`Iniciando feedback loop para o banco GHW: NUIT=${customer.nuit}`);
      await this.bankAdapters.notifyValidationResult('GHW', {
        nuit: customer.nuit,
        status: decision.decision === 'APPROVED' ? 'APROVADO' : 'REJEITADO',
        motivo: decision.reason || bankReason || 'Score de crédito insuficiente',
        limite_aprovado: decision.maxAmount
      });
    } catch (error) {
      this.logger.error('Erro no feedback loop para o banco:', error.message);
    }

    return {
      ...scoringResult,
      bankLimit: decision.bankLimit,
      finalLimit: decision.finalLimit,
      reason: decision.reason
    };
  }

  private calculateFactors(customer: any, loan: any, bankLimit: number | null): ScoringFactors {
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
    const bankEligibilityScore = bankLimit && bankLimit > 0 ? 100 : 0;

    return {
      baseScore,
      historyScore,
      amountScore,
      frequencyScore,
      paymentHistoryScore,
      bankEligibilityScore
    };
  }

  private calculateFinalScore(factors: ScoringFactors): number {
    const { baseScore, historyScore, amountScore, frequencyScore, paymentHistoryScore, bankEligibilityScore } = factors;
    
    // Peso maior para elegibilidade bancária e histórico de pagamentos
    const score = baseScore + 
                  historyScore + 
                  (amountScore * 0.3) + 
                  (frequencyScore * 0.3) + 
                  (paymentHistoryScore * 1.0) +
                  (bankEligibilityScore * 1.5);
                  
    return Math.round(Math.min(850, Math.max(300, score)));
  }

  private calculateRisk(score: number): string {
    if (score >= 750) return 'VERY_LOW';
    if (score >= 650) return 'LOW';
    if (score >= 550) return 'MEDIUM';
    if (score >= 450) return 'HIGH';
    return 'VERY_HIGH';
  }

  private makeDecision(score: number, requestedAmount: number, bankLimit: number | null, bankReason?: string): ScoringDecision {
    const scoringMaxAmount = this.calculateMaxAmount(score);
    const effectiveBankLimit = bankLimit !== null ? bankLimit : Infinity;
    const finalLimit = Math.min(scoringMaxAmount, effectiveBankLimit);
    
    const approvalThreshold = 550;

    if (bankLimit === 0) {
      return {
        decision: 'REJECTED',
        maxAmount: 0,
        reason: bankReason || 'Não elegível pelo banco parceiro'
      };
    }

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
          reason: 'Valor solicitado acima do limite calculado'
        };
      }
    } else {
      return {
        decision: 'REJECTED',
        maxAmount: 0,
        reason: 'Score de crédito insuficiente'
      };
    }
  }

  private calculateMaxAmount(score: number): number {
    if (score < 550) return 0;
    const normalizedScore = (score - 550) / (850 - 550);
    return Math.round(2000 + normalizedScore * 48000); // Limite entre 2k e 50k
  }

  async getCustomerScore(customerId: string) {
    return this.prisma.scoringResult.findFirst({
      where: { customerId },
      orderBy: { calculatedAt: 'desc' },
    });
  }
}
