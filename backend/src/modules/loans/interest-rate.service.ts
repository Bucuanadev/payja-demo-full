import { Injectable } from '@nestjs/common';

export interface InterestRateConfig {
  days?: number;
  months?: number;
  rate: number;
  label: string;
  description: string;
  installments: number;
  installmentType: 'SINGLE' | 'INSTALLMENT';
  earlyPaymentDiscount?: number;
  menuOption: number;
}

@Injectable()
export class InterestRateService {
  // Tabela de taxas de juros por prazo
  private readonly INTEREST_RATES: InterestRateConfig[] = [
    {
      days: 7,
      rate: 8,
      label: '7 dias',
      description: 'Uma semana - Taxa: 8% - Pagamento único',
      installments: 1,
      installmentType: 'SINGLE',
      menuOption: 1,
    },
    {
      days: 15,
      rate: 10,
      label: '15 dias',
      description: 'Quinze dias - Taxa: 10% - Pagamento único',
      installments: 1,
      installmentType: 'SINGLE',
      menuOption: 2,
    },
    {
      days: 30,
      rate: 12,
      label: '30 dias',
      description: 'Um mês - Taxa: 12% - 2 parcelas quinzenais',
      installments: 2,
      installmentType: 'INSTALLMENT',
      menuOption: 3,
    },
    {
      months: 3,
      rate: 15,
      label: '3 meses',
      description: 'Três meses - Taxa: 15% - 3 parcelas mensais',
      installments: 3,
      installmentType: 'INSTALLMENT',
      menuOption: 4,
    },
    {
      months: 6,
      rate: 18,
      label: '6 meses',
      description: 'Seis meses - Taxa: 18% - 6 parcelas mensais',
      installments: 6,
      installmentType: 'INSTALLMENT',
      earlyPaymentDiscount: 2,
      menuOption: 5,
    },
    {
      months: 12,
      rate: 20,
      label: '12 meses',
      description: 'Um ano - Taxa: 20% - 12 parcelas mensais',
      installments: 12,
      installmentType: 'INSTALLMENT',
      earlyPaymentDiscount: 2,
      menuOption: 6,
    },
  ];

  /**
   * Retorna todas as configurações de taxas
   */
  getAllRates(): InterestRateConfig[] {
    return this.INTEREST_RATES;
  }

  /**
   * Obtém a taxa de juros para um prazo específico em dias
   */
  getRateByDays(days: number): number {
    const config = this.INTEREST_RATES.find((r) => r.days === days);
    return config ? config.rate : 15; // Default 15%
  }

  /**
   * Obtém a taxa de juros para um prazo específico em meses
   */
  getRateByMonths(months: number): number {
    const config = this.INTEREST_RATES.find((r) => r.months === months);
    return config ? config.rate : 15; // Default 15%
  }

  /**
   * Obtém configuração completa por prazo em dias
   */
  getConfigByDays(days: number): InterestRateConfig | undefined {
    return this.INTEREST_RATES.find((r) => r.days === days);
  }

  /**
   * Obtém configuração completa por prazo em meses
   */
  getConfigByMonths(months: number): InterestRateConfig | undefined {
    return this.INTEREST_RATES.find((r) => r.months === months);
  }

  /**
   * Calcula o total a pagar com base no valor, prazo e taxa
   */
  calculateLoanAmount(
    principal: number,
    periodDays?: number,
    periodMonths?: number,
  ): {
    principal: number;
    interestRate: number;
    interest: number;
    totalAmount: number;
    periodLabel: string;
  } {
    let rate: number;
    let periodLabel: string;
    let daysInPeriod: number;

    if (periodDays) {
      rate = this.getRateByDays(periodDays);
      const config = this.getConfigByDays(periodDays);
      periodLabel = config ? config.label : `${periodDays} dias`;
      daysInPeriod = periodDays;
    } else if (periodMonths) {
      rate = this.getRateByMonths(periodMonths);
      const config = this.getConfigByMonths(periodMonths);
      periodLabel = config ? config.label : `${periodMonths} meses`;
      daysInPeriod = periodMonths * 30; // Aproximação
    } else {
      throw new Error('Período não especificado');
    }

    // Calcular juros
    // Para prazos em dias: juros proporcional ao período
    // Para prazos em meses: juros sobre o período completo
    const interest = (principal * rate) / 100;
    const totalAmount = principal + interest;

    return {
      principal,
      interestRate: rate,
      interest: Math.round(interest * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      periodLabel,
    };
  }

  /**
   * Calcula o pagamento por período (para empréstimos com múltiplas prestações)
   */
  calculateInstallmentPayment(
    principal: number,
    months: number,
  ): {
    monthlyPayment: number;
    totalAmount: number;
    totalInterest: number;
    interestRate: number;
  } {
    const rate = this.getRateByMonths(months);
    
    // Juros simples sobre o período
    const totalInterest = (principal * rate * months) / (12 * 100);
    const totalAmount = principal + totalInterest;
    const monthlyPayment = totalAmount / months;

    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      interestRate: rate,
    };
  }

  /**
   * Formata menu de opções de prazo para USSD
   */
  getUssdTermMenu(): string {
    const options = this.INTEREST_RATES.map((config, index) => {
      const period = config.days
        ? `${config.days} dias`
        : `${config.months} meses`;
      return `${index + 1}. ${period} (${config.rate}%)`;
    }).join('\n');

    return `Escolha o prazo:\n\n${options}`;
  }

  /**
   * Obtém configuração pelo índice do menu (1-6)
   */
  getConfigByMenuOption(option: number): InterestRateConfig | undefined {
    const index = option - 1;
    return this.INTEREST_RATES[index];
  }

  /**
   * Calcula o valor de cada parcela baseado na configuração
   */
  calculateInstallmentAmount(
    principal: number,
    config: InterestRateConfig,
  ): {
    installmentAmount: number;
    totalAmount: number;
    numberOfInstallments: number;
  } {
    const interest = (principal * config.rate) / 100;
    const totalAmount = principal + interest;
    const installmentAmount = totalAmount / config.installments;

    return {
      installmentAmount: Math.round(installmentAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      numberOfInstallments: config.installments,
    };
  }

  /**
   * Calcula valor para liquidação antecipada com desconto
   */
  calculateEarlyPaymentAmount(
    loanId: string,
    remainingAmount: number,
    config: InterestRateConfig,
  ): {
    originalAmount: number;
    discount: number;
    discountPercentage: number;
    finalAmount: number;
    eligibleForDiscount: boolean;
  } {
    const eligibleForDiscount = !!config.earlyPaymentDiscount;
    const discountPercentage = config.earlyPaymentDiscount || 0;
    const discount = eligibleForDiscount
      ? (remainingAmount * discountPercentage) / 100
      : 0;
    const finalAmount = remainingAmount - discount;

    return {
      originalAmount: remainingAmount,
      discount: Math.round(discount * 100) / 100,
      discountPercentage,
      finalAmount: Math.round(finalAmount * 100) / 100,
      eligibleForDiscount,
    };
  }

  /**
   * Verifica se um empréstimo é elegível para desconto na liquidação
   */
  isEligibleForEarlyPaymentDiscount(config: InterestRateConfig): boolean {
    return !!config.earlyPaymentDiscount && config.earlyPaymentDiscount > 0;
  }
}
