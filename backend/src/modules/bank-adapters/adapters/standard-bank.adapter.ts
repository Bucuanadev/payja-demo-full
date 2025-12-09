import { Injectable } from '@nestjs/common';

/**
 * Adaptador para Standard Bank Moçambique
 */
@Injectable()
export class StandardBankAdapter {
  private readonly apiUrl = process.env.STANDARD_BANK_API_URL || 'https://api.standardbank.co.mz';
  private readonly apiKey = process.env.STANDARD_BANK_API_KEY;

  async checkEligibility(request: any) {
    try {
      const response = await this.mockApiCall('/loan/check-eligibility', {
        nationalId: request.nuit,
        contactNumber: request.phoneNumber,
      });

      return {
        eligible: response.qualifies,
        maxAmount: response.maximumLoanAmount,
        interestRate: response.interestRate,
        maxTerm: response.maximumTenure,
        employerName: response.employerDetails?.name,
        monthlySalary: response.employerDetails?.monthlySalary,
        employmentStatus: response.employerDetails?.status,
      };
    } catch (error) {
      console.error('Erro ao consultar Standard Bank:', error);
      throw error;
    }
  }

  async requestDisbursement(request: any) {
    try {
      const response = await this.mockApiCall('/loan/disbursement-request', {
        clientReference: request.customerId,
        loanAmount: request.amount,
        accountId: request.accountNumber,
      });

      return {
        success: true,
        transactionId: response.transactionReference,
        disbursedAmount: response.amountDisbursed,
        disbursedAt: new Date(response.disbursementDate),
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
      const response = await this.mockApiCall('/clients/public-sector', {
        employmentType: 'GOVERNMENT',
      });
      return response.clients || [];
    } catch (error) {
      console.error('Erro ao sincronizar funcionários Standard Bank:', error);
      return [];
    }
  }

  private async mockApiCall(endpoint: string, data: any) {
    await new Promise(resolve => setTimeout(resolve, 650));

    if (endpoint === '/loan/check-eligibility') {
      return {
        qualifies: true,
        maximumLoanAmount: 100000,
        interestRate: 10.5,
        maximumTenure: 48,
        employerDetails: {
          name: 'Assembleia da República',
          monthlySalary: 45000,
          status: 'PERMANENT_EMPLOYEE',
        },
      };
    }

    if (endpoint === '/loan/disbursement-request') {
      return {
        transactionReference: `STD-${Date.now()}`,
        amountDisbursed: data.loanAmount,
        disbursementDate: new Date().toISOString(),
      };
    }

    if (endpoint === '/clients/public-sector') {
      return {
        clients: [
          {
            phoneNumber: '258870000400',
            name: 'Funcionário Standard 1',
            nuit: '100000400',
            employer: 'Tribunal Supremo',
            salary: 40000,
          },
        ],
      };
    }

    return {};
  }
}
