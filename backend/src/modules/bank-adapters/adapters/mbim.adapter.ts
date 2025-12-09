import { Injectable } from '@nestjs/common';

/**
 * Adaptador para Millennium BIM
 * Integração com sistema bancário do Millennium BIM
 */
@Injectable()
export class MbimAdapter {
  private readonly apiUrl = process.env.MBIM_API_URL || 'https://api.millenniumbim.co.mz';
  private readonly apiKey = process.env.MBIM_API_KEY;

  async checkEligibility(request: any) {
    try {
      const response = await this.mockApiCall('/api/credit/eligibility', {
        nuit: request.nuit,
        phoneNumber: request.phoneNumber,
      });

      return {
        eligible: response.isEligible,
        maxAmount: response.creditLimit,
        interestRate: response.rate,
        maxTerm: response.maxDuration,
        employerName: response.employerInfo?.name,
        monthlySalary: response.employerInfo?.salary,
        employmentStatus: response.employmentType,
      };
    } catch (error) {
      console.error('Erro ao consultar Millennium BIM:', error);
      throw error;
    }
  }

  async requestDisbursement(request: any) {
    try {
      const response = await this.mockApiCall('/api/credit/disburse', {
        clientId: request.customerId,
        loanAmount: request.amount,
        account: request.accountNumber,
      });

      return {
        success: true,
        transactionId: response.referenceNumber,
        disbursedAmount: response.disbursedAmount,
        disbursedAt: new Date(response.processedDate),
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
      const response = await this.mockApiCall('/api/employees/list', {
        segment: 'PUBLIC_SECTOR',
      });
      return response.data || [];
    } catch (error) {
      console.error('Erro ao sincronizar funcionários Millennium BIM:', error);
      return [];
    }
  }

  private async mockApiCall(endpoint: string, data: any) {
    await new Promise(resolve => setTimeout(resolve, 600));

    if (endpoint === '/api/credit/eligibility') {
      return {
        isEligible: true,
        creditLimit: 75000,
        rate: 11.0,
        maxDuration: 36,
        employerInfo: {
          name: 'Governo Provincial de Maputo',
          salary: 35000,
        },
        employmentType: 'CIVIL_SERVANT',
      };
    }

    if (endpoint === '/api/credit/disburse') {
      return {
        referenceNumber: `MBIM-${Date.now()}`,
        disbursedAmount: data.loanAmount,
        processedDate: new Date().toISOString(),
      };
    }

    if (endpoint === '/api/employees/list') {
      return {
        data: [
          {
            phoneNumber: '258850000200',
            name: 'Funcionário MBIM 1',
            nuit: '100000200',
            employer: 'Ministério da Educação',
            salary: 28000,
          },
        ],
      };
    }

    return {};
  }
}
