import { Injectable } from '@nestjs/common';

export interface CommissionBreakdown {
  loanAmount: number;
  emolaCommission: number;
  emolaPercentage: number;
  payjaCommission: number;
  payjaPercentage: number;
  bankCommission: number;
  bankPercentage: number;
  totalCommission: number;
  totalPercentage: number;
  netDisbursement: number; // Valor que o cliente realmente recebe
}

@Injectable()
export class CommissionService {
  // Percentagens padrão (podem ser configuráveis no futuro)
  private readonly DEFAULT_EMOLA_COMMISSION = 0.03; // 3%
  private readonly DEFAULT_PAYJA_COMMISSION = 0.03; // 3%
  private readonly DEFAULT_BANK_COMMISSION = 0.08; // 8%

  /**
   * Calcula o breakdown completo de comissões para um empréstimo
   */
  calculateCommissions(
    loanAmount: number,
    emolaRate?: number,
    payjaRate?: number,
    bankRate?: number,
  ): CommissionBreakdown {
    // Usar taxas customizadas ou padrão
    const emolaPercentage = emolaRate ?? this.DEFAULT_EMOLA_COMMISSION;
    const payjaPercentage = payjaRate ?? this.DEFAULT_PAYJA_COMMISSION;
    const bankPercentage = bankRate ?? this.DEFAULT_BANK_COMMISSION;

    // Calcular valores em MZN
    const emolaCommission = loanAmount * emolaPercentage;
    const payjaCommission = loanAmount * payjaPercentage;
    const bankCommission = loanAmount * bankPercentage;

    // Total de comissões
    const totalCommission =
      emolaCommission + payjaCommission + bankCommission;
    const totalPercentage =
      emolaPercentage + payjaPercentage + bankPercentage;

    // Valor líquido que o cliente recebe (descontando as comissões)
    const netDisbursement = loanAmount - totalCommission;

    return {
      loanAmount,
      emolaCommission: Math.round(emolaCommission * 100) / 100,
      emolaPercentage,
      payjaCommission: Math.round(payjaCommission * 100) / 100,
      payjaPercentage,
      bankCommission: Math.round(bankCommission * 100) / 100,
      bankPercentage,
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalPercentage,
      netDisbursement: Math.round(netDisbursement * 100) / 100,
    };
  }

  /**
   * Formata o breakdown de comissões em JSON string para armazenamento
   */
  formatCommissionBreakdown(breakdown: CommissionBreakdown): string {
    return JSON.stringify(breakdown);
  }

  /**
   * Parse do JSON de comissões armazenado
   */
  parseCommissionBreakdown(json: string): CommissionBreakdown {
    try {
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  /**
   * Gera relatório de comissões para múltiplos empréstimos
   */
  generateCommissionReport(loans: Array<{
    amount: number;
    emolaCommission?: number;
    payjaCommission?: number;
    bankCommission?: number;
  }>): {
    totalLoans: number;
    totalAmount: number;
    totalEmolaCommission: number;
    totalPayjaCommission: number;
    totalBankCommission: number;
    totalCommissions: number;
  } {
    let totalAmount = 0;
    let totalEmolaCommission = 0;
    let totalPayjaCommission = 0;
    let totalBankCommission = 0;

    loans.forEach((loan) => {
      totalAmount += loan.amount;

      const breakdown = this.calculateCommissions(
        loan.amount,
        loan.emolaCommission,
        loan.payjaCommission,
        loan.bankCommission,
      );

      totalEmolaCommission += breakdown.emolaCommission;
      totalPayjaCommission += breakdown.payjaCommission;
      totalBankCommission += breakdown.bankCommission;
    });

    return {
      totalLoans: loans.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalEmolaCommission: Math.round(totalEmolaCommission * 100) / 100,
      totalPayjaCommission: Math.round(totalPayjaCommission * 100) / 100,
      totalBankCommission: Math.round(totalBankCommission * 100) / 100,
      totalCommissions: Math.round(
        (totalEmolaCommission + totalPayjaCommission + totalBankCommission) *
          100,
      ) / 100,
    };
  }
}
