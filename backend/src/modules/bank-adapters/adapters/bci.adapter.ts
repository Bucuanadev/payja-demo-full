import { Injectable } from '@nestjs/common';

/**
 * Adaptador para BCI - Banco Comercial e de Investimentos
 */
@Injectable()
export class BciAdapter {
  private readonly apiUrl = process.env.BCI_API_URL || 'https://api.bci.co.mz';
  private readonly apiKey = process.env.BCI_API_KEY;

  async checkEligibility(request: any) {
    try {
      const response = await this.mockApiCall('/eligibility', {
        taxId: request.nuit,
        mobile: request.phoneNumber,
      });

      return {
        eligible: response.approved,
        maxAmount: response.maxCredit,
        interestRate: response.annualRate,
        maxTerm: response.maxPeriod,
        employerName: response.employer,
        monthlySalary: response.income,
        employmentStatus: response.status,
      };
    } catch (error) {
      console.error('Erro ao consultar BCI:', error);
      throw error;
    }
  }

  async requestDisbursement(request: any) {
    try {
      const response = await this.mockApiCall('/disburse', {
        customer: request.customerId,
        value: request.amount,
        destination: request.accountNumber,
      });

      return {
        success: true,
        transactionId: response.txId,
        disbursedAmount: response.value,
        disbursedAt: new Date(response.timestamp),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async syncEmployees() {
    try {
      const response = await this.mockApiCall('/public-employees', {});
      return response.list || [];
    } catch (error) {
      console.error('Erro ao sincronizar funcionários BCI:', error);
      return [];
    }
  }

  private async mockApiCall(endpoint: string, data: any) {
    await new Promise(resolve => setTimeout(resolve, 550));

    if (endpoint === '/eligibility') {
      return {
        approved: true,
        maxCredit: 60000,
        annualRate: 13.5,
        maxPeriod: 30,
        employer: 'Ministério das Finanças',
        income: 32000,
        status: 'EMPLOYED',
      };
    }

    if (endpoint === '/disburse') {
      return {
        txId: `BCI-TXN-${Date.now()}`,
        value: data.value,
        timestamp: new Date().toISOString(),
      };
    }

    if (endpoint === '/public-employees') {
      return {
        list: [
          {
            phoneNumber: '258860000300',
            name: 'Funcionário BCI 1',
            nuit: '100000300',
            employer: 'Ministério do Interior',
            salary: 27000,
          },
        ],
      };
    }

    return {};
  }
}
