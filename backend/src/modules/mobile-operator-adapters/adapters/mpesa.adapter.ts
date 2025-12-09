import { Injectable } from '@nestjs/common';

/**
 * Adaptador para M-Pesa (Vodacom)
 * Integração com API de mobile money da Vodacom
 */
@Injectable()
export class MpesaAdapter {
  private readonly apiUrl = process.env.MPESA_API_URL || 'https://api.vm.co.mz:18352';
  private readonly apiKey = process.env.MPESA_API_KEY;
  private readonly publicKey = process.env.MPESA_PUBLIC_KEY;

  async disburseLoan(request: {
    phoneNumber: string;
    amount: number;
    loanId: number;
    reference: string;
  }) {
    try {
      const response = await this.mockApiCall('/ipg/v1x/b2cPayment', {
        input_Amount: request.amount,
        input_CustomerMSISDN: this.formatPhoneNumber(request.phoneNumber),
        input_TransactionReference: request.reference,
        input_ThirdPartyReference: `LOAN-${request.loanId}`,
      });

      return {
        success: true,
        transactionId: response.output_TransactionID,
        amount: request.amount,
        timestamp: new Date(),
        newBalance: response.output_CustomerBalance,
      };
    } catch (error) {
      console.error('Erro ao desembolsar via M-Pesa:', error);
      throw error;
    }
  }

  async collectPayment(request: {
    phoneNumber: string;
    amount: number;
    reference: string;
    description: string;
  }) {
    try {
      const response = await this.mockApiCall('/ipg/v1x/c2bPayment/singleStage', {
        input_Amount: request.amount,
        input_CustomerMSISDN: this.formatPhoneNumber(request.phoneNumber),
        input_TransactionReference: request.reference,
        input_ThirdPartyReference: request.reference,
      });

      return {
        transactionId: response.output_TransactionID,
        amount: request.amount,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Erro ao coletar pagamento via M-Pesa:', error);
      throw error;
    }
  }

  async checkBalance(phoneNumber: string) {
    try {
      const response = await this.mockApiCall('/ipg/v1x/queryBalance', {
        input_CustomerMSISDN: this.formatPhoneNumber(phoneNumber),
      });

      return {
        active: true,
        balance: response.output_Balance,
        accountName: response.output_CustomerName,
      };
    } catch (error) {
      return {
        active: false,
        balance: 0,
        accountName: null,
      };
    }
  }

  private formatPhoneNumber(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('258')) {
      return clean;
    }
    return `258${clean}`;
  }

  private async mockApiCall(endpoint: string, data: any) {
    // Simular latência de rede
    await new Promise(resolve => setTimeout(resolve, 800));

    if (endpoint === '/ipg/v1x/b2cPayment') {
      return {
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Request processed successfully',
        output_TransactionID: `MPESA-${Date.now()}`,
        output_ConversationID: `CON-${Date.now()}`,
        output_ThirdPartyReference: data.input_ThirdPartyReference,
        output_CustomerBalance: '15000.00 MZN',
      };
    }

    if (endpoint === '/ipg/v1x/c2bPayment/singleStage') {
      return {
        output_ResponseCode: 'INS-0',
        output_ResponseDesc: 'Payment collected successfully',
        output_TransactionID: `MPESA-PAY-${Date.now()}`,
        output_ConversationID: `CON-${Date.now()}`,
        output_ThirdPartyReference: data.input_ThirdPartyReference,
      };
    }

    if (endpoint === '/ipg/v1x/queryBalance') {
      return {
        output_ResponseCode: 'INS-0',
        output_Balance: '15000.00 MZN',
        output_CustomerName: 'Cliente M-Pesa',
      };
    }

    return {};
  }
}
