import { Injectable, Logger } from '@nestjs/common';

// Tipos temporários até recriar o módulo cross-validation
interface EmolaValidationRequestDto {
  phoneNumber: string;
  nuit: string;
  fullName: string;
  bi?: string;
}

interface EmolaValidationResponseDto {
  valid?: boolean;
  accountActive?: boolean;
  accountId?: string;
  registrationDate?: string;
  message?: string;
  success?: boolean;
  validated?: boolean;
  error?: string;
  data?: any;
}

@Injectable()
export class EmolaAdapter {
  private readonly logger = new Logger(EmolaAdapter.name);
  private readonly apiUrl = process.env.EMOLA_API_URL || 'https://api.emola.com';
  private readonly apiKey = process.env.EMOLA_API_KEY || 'test-api-key';

  /**
   * Valida cliente com API Emola
   */
  async validateCustomer(
    request: EmolaValidationRequestDto,
  ): Promise<EmolaValidationResponseDto> {
    this.logger.log(`Validando cliente com Emola: ${request.phoneNumber}`);

    try {
      // TODO: Integração real com API Emola
      // const response = await axios.post(`${this.apiUrl}/validate`, {
      //   nuit: request.nuit,
      //   bi: request.bi,
      //   phoneNumber: request.phoneNumber,
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      // });

      // Simulação por enquanto
      return this.simulateValidation(request);
    } catch (error) {
      this.logger.error(`Erro ao validar com Emola: ${error.message}`);
      return {
        success: false,
        validated: false,
        error: error.message,
        message: 'Falha na comunicação com Emola',
      };
    }
  }

  /**
   * Verifica se cliente possui conta Emola ativa
   */
  async checkAccountStatus(phoneNumber: string): Promise<{
    hasAccount: boolean;
    status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
    accountType?: string;
  }> {
    this.logger.log(`Verificando status da conta Emola: ${phoneNumber}`);

    try {
      // TODO: Chamada real à API
      // const response = await axios.get(`${this.apiUrl}/account/${phoneNumber}`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` },
      // });

      // Simulação
      return {
        hasAccount: true,
        status: 'ACTIVE',
        accountType: 'PERSONAL',
      };
    } catch (error) {
      this.logger.error(`Erro ao verificar conta Emola: ${error.message}`);
      return {
        hasAccount: false,
      };
    }
  }

  /**
   * Consulta limite de crédito disponível na Emola
   */
  async getCreditLimit(nuit: string): Promise<{
    limit: number;
    currency: string;
    availableCredit: number;
  }> {
    this.logger.log(`Consultando limite de crédito Emola: ${nuit}`);

    try {
      // TODO: Integração real
      // const response = await axios.get(`${this.apiUrl}/credit-limit/${nuit}`, {
      //   headers: { 'Authorization': `Bearer ${this.apiKey}` },
      // });

      // Simulação: limite padrão de 200.000 MZN
      return {
        limit: 200000,
        currency: 'MZN',
        availableCredit: 200000,
      };
    } catch (error) {
      this.logger.error(`Erro ao consultar limite Emola: ${error.message}`);
      return {
        limit: 0,
        currency: 'MZN',
        availableCredit: 0,
      };
    }
  }

  /**
   * Notifica Emola sobre desembolso realizado
   */
  async notifyDisbursement(data: {
    nuit: string;
    phoneNumber: string;
    loanId: number;
    amount: number;
    disbursementDate: Date;
  }): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Notificando Emola sobre desembolso: ${data.loanId}`);

    try {
      // TODO: Enviar notificação para Emola
      // const response = await axios.post(`${this.apiUrl}/disbursement-notification`, data, {
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      // });

      this.logger.log(`Emola notificada com sucesso para empréstimo ${data.loanId}`);
      return {
        success: true,
        message: 'Emola notificada com sucesso',
      };
    } catch (error) {
      this.logger.error(`Erro ao notificar Emola: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Notifica Emola sobre pagamento recebido
   */
  async notifyPayment(data: {
    nuit: string;
    loanId: number;
    installmentNumber: number;
    amount: number;
    paymentDate: Date;
  }): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Notificando Emola sobre pagamento: Empréstimo ${data.loanId}`);

    try {
      // TODO: Enviar notificação
      this.logger.log(`Emola notificada sobre pagamento da parcela ${data.installmentNumber}`);
      return {
        success: true,
        message: 'Pagamento notificado com sucesso',
      };
    } catch (error) {
      this.logger.error(`Erro ao notificar pagamento: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Simula validação com Emola (remover quando API real estiver disponível)
   */
  private simulateValidation(
    request: EmolaValidationRequestDto,
  ): EmolaValidationResponseDto {
    // Simula validação bem-sucedida para números Movitel válidos
    const isValidMovitel = request.phoneNumber.startsWith('258') && 
                          request.phoneNumber.length === 12;

    if (!isValidMovitel) {
      return {
        success: false,
        validated: false,
        error: 'Número de telefone inválido para Emola',
      };
    }

    // Simula dados validados
    return {
      success: true,
      validated: true,
      data: {
        nuit: request.nuit,
        bi: request.bi,
        fullName: request.fullName,
        phoneNumber: request.phoneNumber,
        accountStatus: 'ACTIVE',
        accountType: 'PERSONAL',
        registrationDate: new Date('2024-01-01'),
        isVerified: true,
      },
      message: 'Cliente validado com sucesso (simulado)',
    };
  }
}
