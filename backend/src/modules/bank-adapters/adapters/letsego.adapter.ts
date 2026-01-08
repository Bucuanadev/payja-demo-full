import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Adaptador para Let'sego Bank
 * Conecta com API do banco para verificar elegibilidade de funcionários públicos
 */
@Injectable()
export class LetsegoAdapter {
  private readonly apiUrl = process.env.LETSEGO_API_URL || 'https://api.letsego.co.mz';
  private readonly apiKey = process.env.LETSEGO_API_KEY;

  async checkEligibility(request: any) {
    try {
      // Simular chamada à API do Let'sego
      // Em produção, fazer requisição real
      const response = await this.mockApiCall('/v1/eligibility/check', {
        nuit: request.nuit,
        phoneNumber: request.phoneNumber,
      });

      return {
        eligible: response.eligible,
        maxAmount: response.maxLoanAmount,
        interestRate: response.interestRate,
        maxTerm: response.maxTermMonths,
        employerName: response.employer,
        monthlySalary: response.salary,
        employmentStatus: response.employmentStatus,
      };
    } catch (error) {
      console.error('Erro ao consultar Let\'sego:', error);
      throw error;
    }
  }

  async requestDisbursement(request: any) {
    try {
      // Simular desembolso via Let'sego
      const response = await this.mockApiCall('/v1/loans/disburse', {
        customerId: request.customerId,
        amount: request.amount,
        accountNumber: request.accountNumber,
      });

      return {
        success: true,
        transactionId: response.transactionId,
        disbursedAmount: response.amount,
        disbursedAt: new Date(response.disbursedAt),
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
      // Buscar lista de funcionários públicos elegíveis
      const response = await this.mockApiCall('/v1/employees/public-sector', {});
      return response.employees || [];
    } catch (error) {
      console.error('Erro ao sincronizar funcionários Let\'sego:', error);
      return [];
    }
  }

  // Mock para demonstração - substituir por chamadas reais em produção
  private async mockApiCall(endpoint: string, data: any) {
    // Simular resposta da API
    await new Promise(resolve => setTimeout(resolve, 500));

    if (endpoint === '/v1/eligibility/check') {
      return {
        eligible: true,
        maxLoanAmount: 50000,
        interestRate: 12.5,
        maxTermMonths: 24,
        employer: 'Governo de Moçambique',
        salary: 25000,
        employmentStatus: 'PERMANENT',
      };
    }

    if (endpoint === '/v1/loans/disburse') {
      return {
        transactionId: `LETSEGO-${Date.now()}`,
        amount: data.amount,
        disbursedAt: new Date().toISOString(),
      };
    }

    if (endpoint === '/v1/employees/public-sector') {
      return {
        employees: [
          {
            phoneNumber: '258840000100',
            name: 'Funcionário Público 1',
            nuit: '100000100',
            employer: 'Ministério da Saúde',
            salary: 30000,
          },
        ],
      };
    }

    return {};
  }
}
