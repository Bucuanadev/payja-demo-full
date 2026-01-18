import { Injectable } from '@nestjs/common';

/**
 * Adaptador para e-Mola (Movitel)
 * Integração com sistema de mobile money da Movitel
 */
@Injectable()
export class EMolaAdapter {
  private readonly apiUrl = process.env.EMOLA_API_URL || 'https://api.movitel.co.mz/emola';
  private readonly apiKey = process.env.EMOLA_API_KEY;
  private readonly merchantId = process.env.EMOLA_MERCHANT_ID;

  async disburseLoan(request: {
    phoneNumber: string;
    amount: number;
    loanId: number;
    reference: string;
  }) {
    try {
      const response = await this.mockApiCall('/transfer/business-to-customer', {
        phoneNumber: this.formatPhoneNumber(request.phoneNumber),
        amount: request.amount,
        currency: 'MZN',
        reference: request.reference,
        description: `Desembolso empréstimo ${request.loanId}`,
      });

      return {
        success: true,
        transactionId: response.transactionId,
        amount: request.amount,
        timestamp: new Date(response.timestamp),
        newBalance: response.recipientBalance,
      };
    } catch (error) {
      console.error('Erro ao desembolsar via e-Mola:', error);
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
      const response = await this.mockApiCall('/payment/request', {
        phoneNumber: this.formatPhoneNumber(request.phoneNumber),
        amount: request.amount,
        currency: 'MZN',
        reference: request.reference,
        description: request.description,
      });

      return {
        transactionId: response.transactionId,
        amount: request.amount,
        timestamp: new Date(response.timestamp),
      };
    } catch (error) {
      console.error('Erro ao coletar pagamento via e-Mola:', error);
      throw error;
    }
  }

  async checkBalance(phoneNumber: string) {
    try {
      const response = await this.mockApiCall('/account/balance', {
        phoneNumber: this.formatPhoneNumber(phoneNumber),
      });

      return {
        active: response.status === 'ACTIVE',
        balance: response.balance,
        accountName: response.accountHolder,
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
    await new Promise(resolve => setTimeout(resolve, 700));

    if (endpoint === '/transfer/business-to-customer') {
      return {
        status: 'SUCCESS',
        transactionId: `EMOLA-${Date.now()}`,
        timestamp: new Date().toISOString(),
        recipientBalance: 22000,
      };
    }

    if (endpoint === '/payment/request') {
      return {
        status: 'PENDING',
        transactionId: `EMOLA-PAY-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }

    if (endpoint === '/account/balance') {
      return {
        status: 'ACTIVE',
        balance: 22000,
        accountHolder: 'Cliente e-Mola',
      };
    }

    return {};
  }
}
