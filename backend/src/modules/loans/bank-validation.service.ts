import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface ValidationRequest {
  phoneNumber: string;
  bankCode: string;
  nuit?: string;
  fullName?: string;
}

export interface ValidationResult {
  success: boolean;
  validated: boolean;
  message: string;
  data?: any;
  errorCode?: string;
}

@Injectable()
export class BankValidationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Valida um cliente contra a base de dados do banco
   */
  async validateCustomerWithBank(
    customerId: string,
    request: ValidationRequest,
  ): Promise<ValidationResult> {
    try {
      // Simular chamada à API do banco
      const bankValidationResponse = await this.callBankValidationAPI(request);

      // Registrar a validação no banco de dados
      const validation = await this.prisma.bankValidation.create({
        data: {
          customerId,
          bankCode: request.bankCode,
          phoneNumber: request.phoneNumber,
          nuit: request.nuit,
          fullName: request.fullName,
          validated: bankValidationResponse.validated,
          validatedAt: bankValidationResponse.validated ? new Date() : null,
          validationData: JSON.stringify(bankValidationResponse.data),
          status: bankValidationResponse.validated ? 'VALIDATED' : 'REJECTED',
          errorMessage: bankValidationResponse.message,
        },
      });

      return {
        success: true,
        validated: validation.validated,
        message: bankValidationResponse.message,
        data: {
          validationId: validation.id,
          ...bankValidationResponse.data,
        },
      };
    } catch (error) {
      return {
        success: false,
        validated: false,
        message: 'Erro ao validar com o banco',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Simula chamada à API do banco para validação
   * Em produção, isso seria uma chamada real à API do banco
   */
  private async callBankValidationAPI(
    request: ValidationRequest,
  ): Promise<{
    validated: boolean;
    message: string;
    data: any;
  }> {
    // Simular delay de rede
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Validação simulada baseada no bankCode
    switch (request.bankCode) {
      case 'LETSEGO':
        return this.validateLetsego(request);

      case 'BAYPORT':
        return this.validateBayport(request);

      case 'BCI':
        return this.validateBCI(request);

      case 'STANDARD_BANK':
        return this.validateStandardBank(request);

      default:
        return {
          validated: false,
          message: 'Banco não suportado',
          data: null,
        };
    }
  }

  /**
   * Validação específica para Letsego
   */
  private async validateLetsego(request: ValidationRequest): Promise<{
    validated: boolean;
    message: string;
    data: any;
  }> {
    // Simular validação: números que terminam em 1, 3, 5, 7, 9 são válidos
    const lastDigit = parseInt(
      request.phoneNumber.charAt(request.phoneNumber.length - 1),
    );
    const isValid = lastDigit % 2 !== 0;

    return {
      validated: isValid,
      message: isValid
        ? 'Cliente verificado com sucesso no Letsego'
        : 'Cliente não encontrado na base de dados do Letsego',
      data: {
        bankCode: 'LETSEGO',
        bankName: 'Letsego',
        phoneVerified: isValid,
        accountStatus: isValid ? 'ACTIVE' : 'NOT_FOUND',
        eligibleForLoan: isValid,
      },
    };
  }

  /**
   * Validação específica para Bayport
   */
  private async validateBayport(request: ValidationRequest): Promise<{
    validated: boolean;
    message: string;
    data: any;
  }> {
    // Simular validação: números que terminam em 0, 2, 4, 6, 8 são válidos
    const lastDigit = parseInt(
      request.phoneNumber.charAt(request.phoneNumber.length - 1),
    );
    const isValid = lastDigit % 2 === 0;

    return {
      validated: isValid,
      message: isValid
        ? 'Cliente verificado com sucesso no Bayport'
        : 'Cliente não encontrado na base de dados do Bayport',
      data: {
        bankCode: 'BAYPORT',
        bankName: 'Bayport',
        phoneVerified: isValid,
        accountStatus: isValid ? 'ACTIVE' : 'NOT_FOUND',
        eligibleForLoan: isValid,
        creditLimit: isValid ? 50000 : 0,
      },
    };
  }

  /**
   * Validação específica para BCI
   */
  private async validateBCI(request: ValidationRequest): Promise<{
    validated: boolean;
    message: string;
    data: any;
  }> {
    // Simular validação: sempre válido para demonstração
    return {
      validated: true,
      message: 'Cliente verificado com sucesso no BCI',
      data: {
        bankCode: 'BCI',
        bankName: 'BCI',
        phoneVerified: true,
        accountStatus: 'ACTIVE',
        eligibleForLoan: true,
        yearsAsCustomer: 3,
      },
    };
  }

  /**
   * Validação específica para Standard Bank
   */
  private async validateStandardBank(request: ValidationRequest): Promise<{
    validated: boolean;
    message: string;
    data: any;
  }> {
    // Simular validação: válido se tiver NUIT
    const isValid = !!request.nuit && request.nuit.length >= 9;

    return {
      validated: isValid,
      message: isValid
        ? 'Cliente verificado com sucesso no Standard Bank'
        : 'NUIT não encontrado ou inválido no Standard Bank',
      data: {
        bankCode: 'STANDARD_BANK',
        bankName: 'Standard Bank',
        phoneVerified: isValid,
        nuitVerified: isValid,
        accountStatus: isValid ? 'ACTIVE' : 'NOT_FOUND',
        eligibleForLoan: isValid,
      },
    };
  }

  /**
   * Busca histórico de validações de um cliente
   */
  async getCustomerValidations(customerId: string) {
    return this.prisma.bankValidation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Verifica se cliente já tem validação ativa com um banco
   */
  async hasActiveValidation(
    customerId: string,
    bankCode: string,
  ): Promise<boolean> {
    const validation = await this.prisma.bankValidation.findFirst({
      where: {
        customerId,
        bankCode,
        status: 'VALIDATED',
        validated: true,
      },
      orderBy: { validatedAt: 'desc' },
    });

    return !!validation;
  }
}
