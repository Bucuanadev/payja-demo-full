import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Adaptador para Banco GHW
 * Integração com sistema bancário do Banco GHW
 */
@Injectable()
export class GhwAdapter {
  private readonly logger = new Logger(GhwAdapter.name);
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.GHW_API_URL || 'http://localhost:4500';
    this.apiKey = process.env.GHW_API_KEY || 'banco-ghw-api-key-2025';
  }

  /**
   * Configurar URL e API Key dinamicamente
   */
  configure(config: { apiUrl?: string; apiKey?: string }) {
    if (config.apiUrl) this.apiUrl = config.apiUrl;
    if (config.apiKey) this.apiKey = config.apiKey;
    this.logger.log(`Banco GHW configurado: ${this.apiUrl}`);
  }

  /**
   * Testar conexão com o banco
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/health`, {
        headers: { 'x-api-key': this.apiKey },
        timeout: 5000,
      });

      return {
        success: true,
        message: 'Conexão estabelecida com sucesso',
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Erro ao testar conexão com Banco GHW:', error.message);
      return {
        success: false,
        message: `Erro: ${error.message}`,
      };
    }
  }

  /**
   * Verificar elegibilidade do cliente
   */
  async checkEligibility(request: {
    nuit: string;
    nome?: string;
    telefone?: string;
    bi?: string;
    valor_solicitado?: number;
  }) {
    try {
      this.logger.log(`Verificando elegibilidade no Banco GHW para NUIT: ${request.nuit}`);

      const response = await axios.post(
        `${this.apiUrl}/api/validacao/verificar`,
        {
          nuit: request.nuit,
          nome: request.nome,
          telefone: request.telefone,
          bi: request.bi,
          valor_solicitado: request.valor_solicitado,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 10000,
        },
      );

      const data = response.data;

      if (!data.elegivel) {
        return {
          eligible: false,
          reason: data.motivo || 'Cliente não elegível',
          code: data.codigo,
        };
      }

      return {
        eligible: true,
        maxAmount: data.limite_aprovado,
        interestRate: 12.5, // Taxa padrão do banco
        maxTerm: 36,
        employerName: data.cliente?.empregador,
        monthlySalary: data.cliente?.renda_mensal || data.cliente?.salario,
        employmentStatus: 'ACTIVE',
        bankData: {
          numero_conta: data.cliente?.numero_conta,
          score_credito: data.cliente?.score_credito,
          score_comparacao: data.score_comparacao,
        },
      };
    } catch (error) {
      this.logger.error('Erro ao consultar elegibilidade Banco GHW:', error.message);
      throw new Error(`Erro ao consultar Banco GHW: ${error.message}`);
    }
  }

  /**
   * Consultar capacidade financeira
   */
  async checkCapacity(request: { nuit: string; telefone?: string }) {
    try {
      this.logger.log(`Consultando capacidade financeira no Banco GHW: ${request.nuit}`);

      const response = await axios.post(
        `${this.apiUrl}/api/capacidade/consultar`,
        {
          nuit: request.nuit,
          telefone: request.telefone,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao consultar capacidade Banco GHW:', error.message);
      throw error;
    }
  }

  /**
   * Executar desembolso
   */
  async requestDisbursement(request: {
    nuit: string;
    valor: number;
    numero_emola: string;
    referencia_payja: string;
    descricao?: string;
  }) {
    try {
      this.logger.log(`Solicitando desembolso no Banco GHW: ${request.referencia_payja}`);

      const response = await axios.post(
        `${this.apiUrl}/api/desembolso/executar`,
        {
          nuit: request.nuit,
          valor: request.valor,
          numero_emola: request.numero_emola,
          referencia_payja: request.referencia_payja,
          descricao: request.descricao || 'Desembolso de empréstimo PayJA',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 30000, // Desembolso pode demorar
        },
      );

      const data = response.data;

      if (!data.sucesso) {
        return {
          success: false,
          error: data.mensagem || 'Erro ao executar desembolso',
        };
      }

      return {
        success: true,
        transactionId: data.desembolso?.id,
        disbursedAmount: data.desembolso?.valor,
        status: data.desembolso?.status,
        disbursedAt: data.desembolso?.criado_em ? new Date(data.desembolso.criado_em) : new Date(),
      };
    } catch (error) {
      this.logger.error('Erro ao solicitar desembolso Banco GHW:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Consultar empréstimos do cliente
   */
  async getLoans(request: { nuit: string; telefone?: string; numero_conta?: string }) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/emprestimos/consultar`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao consultar empréstimos Banco GHW:', error.message);
      throw error;
    }
  }

  /**
   * Notificar banco sobre pagamento
   */
  async notifyPayment(request: {
    nuit: string;
    numero_emprestimo: string;
    valor_pago: number;
    data_pagamento: string;
    referencia: string;
  }) {
    try {
      this.logger.log(`Notificando pagamento ao Banco GHW: ${request.referencia}`);

      const response = await axios.post(
        `${this.apiUrl}/api/webhooks/pagamento`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao notificar pagamento Banco GHW:', error.message);
      throw error;
    }
  }

  /**
   * Sincronizar funcionários (não aplicável para GHW Mock)
   */
  async syncEmployees() {
    this.logger.log('Sincronização de funcionários não implementada para Banco GHW Mock');
    return [];
  }
}
