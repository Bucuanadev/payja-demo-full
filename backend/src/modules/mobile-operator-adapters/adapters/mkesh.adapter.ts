import { Injectable } from '@nestjs/common';

/**
 * Adaptador para Mkesh (mcel)
 * Integração com plataforma Mkesh da mcel
 */
@Injectable()
export class MkeshAdapter {
  private readonly apiUrl = process.env.MKESH_API_URL || 'https://api.mcel.co.mz/mkesh';
  private readonly apiKey = process.env.MKESH_API_KEY;
  private readonly partnerId = process.env.MKESH_PARTNER_ID;

  async disburseLoan(request: {
    phoneNumber: string;
    amount: number;
    loanId: number;
    reference: string;
  }) {
    try {
      const response = await this.mockApiCall('/v1/disburse', {
        msisdn: this.formatPhoneNumber(request.phoneNumber),
        amount: request.amount,
        transactionRef: request.reference,
        narration: `Empréstimo PayJA #${request.loanId}`,
      });

      return {
        success: true,
        transactionId: response.txnId,
        amount: request.amount,
        timestamp: new Date(response.processedAt),
        newBalance: response.walletBalance,
      };
    } catch (error) {
      console.error('Erro ao desembolsar via Mkesh:', error);
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
      const response = await this.mockApiCall('/v1/collect', {
        msisdn: this.formatPhoneNumber(request.phoneNumber),
        amount: request.amount,
        transactionRef: request.reference,
        narration: request.description,
      });

      return {
        transactionId: response.txnId,
        amount: request.amount,
        timestamp: new Date(response.processedAt),
      };
    } catch (error) {
      console.error('Erro ao coletar pagamento via Mkesh:', error);
      throw error;
    }
  }

  async checkBalance(phoneNumber: string) {
    try {
      const response = await this.mockApiCall('/v1/balance', {
        msisdn: this.formatPhoneNumber(phoneNumber),
      });

      return {
        active: response.accountStatus === 'ACTIVE',
        balance: response.availableBalance,
        accountName: response.customerName,
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
    await new Promise(resolve => setTimeout(resolve, 750));

    if (endpoint === '/v1/disburse') {
      return {
        status: 'SUCCESS',
        txnId: `MKESH-${Date.now()}`,
        processedAt: new Date().toISOString(),
        walletBalance: 18500,
      };
    }

    if (endpoint === '/v1/collect') {
      return {
        status: 'PROCESSING',
        txnId: `MKESH-COL-${Date.now()}`,
        processedAt: new Date().toISOString(),
      };
    }

    if (endpoint === '/v1/balance') {
      return {
        accountStatus: 'ACTIVE',
        availableBalance: 18500,
        customerName: 'Cliente Mkesh',
      };
    }

    return {};
  }
}
