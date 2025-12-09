import { Injectable, Logger } from '@nestjs/common';
import { MockApiService } from './mock-api.service';
import { PrismaService } from '../../prisma.service';

export interface ValidationResult {
  approved: boolean;
  creditLimit: number;
  reason: string;
  matchScore: number; // 0-100%
  details: {
    emolaData?: any;
    bankData?: any;
    comparison?: any;
  };
}

export interface CustomerData {
  nuit: string;
  biNumber: string;
  name: string;
  phoneNumber: string;
  institution?: string;
}

@Injectable()
export class CrossValidationService {
  private readonly logger = new Logger(CrossValidationService.name);

  constructor(
    private mockApiService: MockApiService,
    private prisma: PrismaService,
  ) {}

  /**
   * Validação cruzada: PayJA ↔ Emola ↔ Banco
   */
  async validateCustomer(customerData: CustomerData): Promise<ValidationResult> {
    this.logger.log(`Iniciando validação cruzada para NUIT: ${customerData.nuit}`);

    try {
      // 1. Buscar dados do cliente no Mock Emola
      let emolaData = await this.mockApiService.getCustomerByNuit(customerData.nuit);
      
      // Se cliente não existe em Emola, criar automaticamente (simulador assume que já existe)
      if (!emolaData) {
        this.logger.log(`Cliente não encontrado em Emola, criando registro mock para NUIT: ${customerData.nuit}`);
        const { customer, bankAccount } = this.mockApiService.addMockCustomer({
          nuit: customerData.nuit,
          biNumber: customerData.biNumber || '',
          fullName: customerData.name,
          phoneNumber: customerData.phoneNumber,
          institution: customerData.institution || 'Instituição Teste',
          salary: 15000,
          creditScore: 700, // Score bom por padrão no simulador
          accountStatus: 'ACTIVE',
          bankName: 'Banco de Moçambique',
          accountNumber: `ACC-${customerData.nuit}-001`,
          accountType: 'SALARY',
        });
        emolaData = customer;
      }

      // 2. Buscar dados do cliente no Mock Banco
      let bankData = await this.mockApiService.getBankAccountByNuit(customerData.nuit);
      
      // Se não tem conta bancária, criar automaticamente
      if (!bankData) {
        this.logger.log(`Cliente não possui conta bancária, criando registro para NUIT: ${customerData.nuit}`);
        const { bankAccount } = this.mockApiService.addMockCustomer({
          nuit: customerData.nuit,
          biNumber: customerData.biNumber || '',
          fullName: customerData.name,
          phoneNumber: customerData.phoneNumber,
          institution: customerData.institution || 'Instituição Teste',
          bankName: 'Banco de Moçambique',
          accountNumber: `ACC-${customerData.nuit}-001`,
          accountType: 'SALARY',
        });
        bankData = bankAccount;
      }

      // 3. Comparar dados entre sistemas
      const comparison = this.compareData(customerData, emolaData, bankData);

      // 4. Calcular score de correspondência
      const matchScore = this.calculateMatchScore(comparison);

      // 5. Definir limite de crédito baseado nos dados
      const creditLimit = this.calculateCreditLimit(emolaData, bankData, matchScore);

      // 6. Decisão final
      const approved = matchScore >= 70 && creditLimit > 0;

      const result: ValidationResult = {
        approved,
        creditLimit,
        reason: this.getApprovalReason(approved, matchScore, creditLimit),
        matchScore,
        details: {
          emolaData,
          bankData,
          comparison,
        },
      };

      this.logger.log(
        `Validação concluída - NUIT: ${customerData.nuit}, ` +
        `Aprovado: ${approved}, Limite: ${creditLimit} MZN, Score: ${matchScore}%`
      );

      return result;
    } catch (error) {
      this.logger.error(`Erro na validação cruzada: ${error.message}`, error.stack);
      return {
        approved: false,
        creditLimit: 0,
        reason: 'Erro ao validar dados do cliente',
        matchScore: 0,
        details: {},
      };
    }
  }

  /**
   * Comparar dados entre PayJA, Emola e Banco
   */
  private compareData(payjaData: CustomerData, emolaData: any, bankData: any) {
    return {
      nuit: {
        payja: payjaData.nuit,
        emola: emolaData.nuit,
        bank: bankData.nuit,
        match: payjaData.nuit === emolaData.nuit && emolaData.nuit === bankData.nuit,
      },
      name: {
        payja: payjaData.name,
        emola: emolaData.fullName,
        bank: bankData.accountHolder,
        match: this.fuzzyMatch(payjaData.name, emolaData.fullName, bankData.accountHolder),
      },
      phone: {
        payja: payjaData.phoneNumber,
        emola: emolaData.phoneNumber,
        match: payjaData.phoneNumber === emolaData.phoneNumber,
      },
      biNumber: {
        payja: payjaData.biNumber,
        emola: emolaData.biNumber,
        match: payjaData.biNumber === emolaData.biNumber,
      },
      accountStatus: {
        emola: emolaData.accountStatus,
        bank: bankData.accountStatus,
        emolaActive: emolaData.accountStatus === 'ACTIVE',
        bankActive: bankData.accountStatus === 'ACTIVE',
      },
    };
  }

  /**
   * Calcular score de correspondência (0-100%)
   */
  private calculateMatchScore(comparison: any): number {
    let score = 0;
    let totalChecks = 0;

    // NUIT deve bater 100% (crítico)
    if (comparison.nuit.match) {
      score += 30;
    }
    totalChecks += 30;

    // Nome (tolerância para pequenas diferenças)
    if (comparison.name.match) {
      score += 25;
    }
    totalChecks += 25;

    // Telefone
    if (comparison.phone.match) {
      score += 20;
    }
    totalChecks += 20;

    // BI
    if (comparison.biNumber.match) {
      score += 15;
    }
    totalChecks += 15;

    // Contas ativas
    if (comparison.accountStatus.emolaActive && comparison.accountStatus.bankActive) {
      score += 10;
    }
    totalChecks += 10;

    return Math.round((score / totalChecks) * 100);
  }

  /**
   * Calcular limite de crédito baseado nos dados validados
   */
  private calculateCreditLimit(emolaData: any, bankData: any, matchScore: number): number {
    // Se score baixo, não aprovar
    if (matchScore < 70) {
      return 0;
    }

    // Fatores para cálculo do limite
    const emolaCreditLimit = emolaData.creditLimit || 0;
    const bankCreditLimit = bankData.creditLimit || 0;
    const salary = emolaData.salary || 0;
    const riskCategory = emolaData.riskCategory || 'HIGH';

    // Limite base: menor valor entre Emola e Banco
    let baseLimit = Math.min(emolaCreditLimit, bankCreditLimit);

    // Se não houver limites definidos, usar salário como base
    if (baseLimit === 0 && salary > 0) {
      baseLimit = salary * 0.3; // 30% do salário
    }

    // Ajustar baseado no risco
    const riskMultipliers = {
      LOW: 1.0,
      MEDIUM: 0.7,
      HIGH: 0.4,
    };

    const riskMultiplier = riskMultipliers[riskCategory] || 0.4;
    let finalLimit = baseLimit * riskMultiplier;

    // Ajustar baseado no match score
    const scoreMultiplier = matchScore / 100;
    finalLimit = finalLimit * scoreMultiplier;

    // Arredondar para centenas
    finalLimit = Math.round(finalLimit / 100) * 100;

    // Limites mínimo e máximo
    const MIN_LIMIT = 500;
    const MAX_LIMIT = 50000;

    if (finalLimit < MIN_LIMIT) {
      return 0; // Muito baixo, rejeitar
    }

    return Math.min(finalLimit, MAX_LIMIT);
  }

  /**
   * Gerar razão de aprovação/rejeição
   */
  private getApprovalReason(approved: boolean, matchScore: number, creditLimit: number): string {
    if (approved) {
      return `Cliente aprovado com ${matchScore}% de correspondência. Limite: ${creditLimit} MZN`;
    }

    if (matchScore < 70) {
      return `Dados não correspondem entre sistemas (${matchScore}% match)`;
    }

    if (creditLimit === 0) {
      return 'Cliente não possui limite de crédito disponível';
    }

    return 'Cliente não aprovado pelos critérios de validação';
  }

  /**
   * Comparação fuzzy de nomes (tolerância a pequenas diferenças)
   */
  private fuzzyMatch(...names: string[]): boolean {
    const normalized = names.map(name => 
      name.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .split(/\s+/)
        .sort()
        .join(' ')
    );

    // Verificar se todos são similares
    const reference = normalized[0];
    return normalized.every(name => {
      const similarity = this.similarity(reference, name);
      return similarity > 0.8; // 80% de similaridade
    });
  }

  /**
   * Calcular similaridade entre strings (Levenshtein simplificado)
   */
  private similarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Distância de Levenshtein
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }

  /**
   * Obter histórico de validações
   */
  async getValidationHistory(customerId?: string) {
    // TODO: Implementar log de validações no banco
    return [];
  }
}
