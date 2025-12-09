import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

interface DecisionResult {
  approved: boolean;
  reason: string;
  maxAmount?: number;
  recommendedTerms?: number[];
}

@Injectable()
export class DecisionService {
  constructor(private prisma: PrismaService) {}

  async makeDecision(loanId: string, scoringId: string): Promise<DecisionResult> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { customer: true },
    });

    const scoring = await this.prisma.scoringResult.findUnique({
      where: { id: scoringId },
    });

    if (!loan || !scoring) {
      throw new Error('Empréstimo ou scoring não encontrado');
    }

    // APROVAÇÃO AUTOMÁTICA para Funcionário Público
    if (loan.customer.profession === 'Funcionario Publico') {
      const decision = await this.evaluatePublicEmployee(loan, scoring);
      
      // Atualizar status
      await this.prisma.loan.update({
        where: { id: loanId },
        data: {
          status: decision.approved ? 'APPROVED' : 'REJECTED',
          rejectedReason: decision.approved ? null : decision.reason,
          approvedAt: decision.approved ? new Date() : null,
        },
      });

      return decision;
    }

    // Regras de decisão padrão
    const decision = this.evaluateDecision(scoring, loan);

    // Atualizar status do empréstimo
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: decision.approved ? 'APPROVED' : 'REJECTED',
        rejectedReason: decision.approved ? null : decision.reason,
        approvedAt: decision.approved ? new Date() : null,
      },
    });

    return decision;
  }

  private async evaluatePublicEmployee(loan: any, scoring: any): Promise<DecisionResult> {
    const customer = loan.customer;
    
    // Verificar se tem salário cadastrado
    const salary = customer.salary || 15000; // Salário mínimo padrão se não informado
    
    // Verificar se tem dívidas ativas
    const activeLoans = await this.prisma.loan.count({
      where: {
        customerId: customer.id,
        status: { in: ['ACTIVE', 'APPROVED', 'DISBURSED'] },
      },
    });

    // Se tem dívida ativa, rejeitar
    if (activeLoans > 0) {
      return {
        approved: false,
        reason: 'Cliente possui empréstimo ativo. Quite sua dívida antes de solicitar novo empréstimo.',
      };
    }

    // Limite: dobro do salário
    const maxAmount = salary * 2;

    // Se valor solicitado excede o dobro do salário, rejeitar
    if (loan.amount > maxAmount) {
      return {
        approved: false,
        reason: `Valor solicitado (${loan.amount} MZN) excede o limite aprovado (${maxAmount} MZN - 2x salário)`,
        maxAmount: maxAmount,
      };
    }

    // APROVADO AUTOMATICAMENTE
    return {
      approved: true,
      reason: 'Funcionário Público - Aprovação Automática',
      maxAmount: maxAmount,
      recommendedTerms: [3, 6, 12],
    };
  }

  private evaluateDecision(scoring: any, loan: any): DecisionResult {
    const { finalScore, risk } = scoring;
    const { amount, termMonths } = loan;

    // Regra 1: Score muito baixo - Rejeição automática
    if (finalScore < 500) {
      return {
        approved: false,
        reason: 'Score de crédito abaixo do mínimo aceitável',
      };
    }

    // Regra 2: Risco muito alto - Rejeição
    if (risk === 'VERY_HIGH') {
      return {
        approved: false,
        reason: 'Nível de risco muito elevado',
      };
    }

    // Regra 3: Score médio - Limitar valor
    if (finalScore >= 500 && finalScore < 600) {
      const maxAllowed = 10000; // Máximo 10.000 MZN

      if (amount > maxAllowed) {
        return {
          approved: false,
          reason: `Valor solicitado excede o limite aprovado (${maxAllowed} MZN)`,
          maxAmount: maxAllowed,
        };
      }

      return {
        approved: true,
        reason: 'Aprovado com limite reduzido',
        maxAmount: maxAllowed,
        recommendedTerms: [3, 6], // Apenas 3 ou 6 meses
      };
    }

    // Regra 4: Score bom - Aprovação com limites standard
    if (finalScore >= 600 && finalScore < 750) {
      const maxAllowed = 30000;

      if (amount > maxAllowed) {
        return {
          approved: false,
          reason: `Valor solicitado excede o limite aprovado (${maxAllowed} MZN)`,
          maxAmount: maxAllowed,
        };
      }

      return {
        approved: true,
        reason: 'Aprovado dentro dos limites standard',
        maxAmount: maxAllowed,
        recommendedTerms: [3, 6, 12],
      };
    }

    // Regra 5: Score excelente - Aprovação sem restrições
    if (finalScore >= 750) {
      return {
        approved: true,
        reason: 'Cliente premium - aprovado sem restrições',
        maxAmount: 50000,
        recommendedTerms: [3, 6, 12, 18, 24],
      };
    }

    // Fallback - Revisão manual
    return {
      approved: false,
      reason: 'Caso requer revisão manual',
    };
  }

  async getPendingDecisions() {
    return this.prisma.loan.findMany({
      where: {
        status: {
          in: ['PENDING', 'ANALYZING'],
        },
      },
      include: {
        customer: true,
        scoring: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDecisionStats() {
    const [total, approved, rejected, pending, approvalRate] = await Promise.all([
      this.prisma.loan.count(),
      this.prisma.loan.count({ where: { status: 'APPROVED' } }),
      this.prisma.loan.count({ where: { status: 'REJECTED' } }),
      this.prisma.loan.count({ where: { status: { in: ['PENDING', 'ANALYZING'] } } }),
      this.calculateApprovalRate(),
    ]);

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate: approvalRate.toFixed(2) + '%',
    };
  }

  private async calculateApprovalRate(): Promise<number> {
    const total = await this.prisma.loan.count({
      where: {
        status: {
          in: ['APPROVED', 'REJECTED'],
        },
      },
    });

    const approved = await this.prisma.loan.count({
      where: { status: 'APPROVED' },
    });

    return total > 0 ? (approved / total) * 100 : 0;
  }
}
