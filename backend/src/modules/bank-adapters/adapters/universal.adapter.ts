import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Adaptador Universal para qualquer banco
 * Permite configuração dinâmica de endpoints
 */
@Injectable()
export class UniversalBankAdapter {
  private readonly logger = new Logger(UniversalBankAdapter.name);
  private client: AxiosInstance;
  private config: {
    code: string;
    name: string;
    apiUrl: string;
    apiKey?: string;
    timeout: number;
    retryAttempts: number;
    endpoints: {
      health: string;
      eligibility: string;
      capacity: string;
      disbursement: string;
      loans: string;
      webhook: string;
    };
  };

  constructor() {
    this.config = {
      code: 'UNIVERSAL',
      name: 'Banco Universal',
      apiUrl: '',
      timeout: 30000,
      retryAttempts: 3,
      endpoints: {
        health: '/api/health',
        eligibility: '/api/validacao/verificar',
        capacity: '/api/capacidade/consultar',
        disbursement: '/api/desembolso/executar',
        loans: '/api/emprestimos/consultar',
        webhook: '/api/webhooks/pagamento',
      },
    };
  }

  /**
   * Configurar o adaptador com dados do banco
   */
  configure(bankConfig: {
    code: string;
    name: string;
    apiUrl: string;
    apiKey?: string;
    timeout?: number;
    retryAttempts?: number;
    healthEndpoint?: string;
    eligibilityEndpoint?: string;
    capacityEndpoint?: string;
    disbursementEndpoint?: string;
    loansEndpoint?: string;
    webhookEndpoint?: string;
  }) {
    this.config.code = bankConfig.code;
    this.config.name = bankConfig.name;
    this.config.apiUrl = bankConfig.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.config.apiKey = bankConfig.apiKey;
    this.config.timeout = bankConfig.timeout || 30000;
    this.config.retryAttempts = bankConfig.retryAttempts || 3;

    // Configurar endpoints customizados
    if (bankConfig.healthEndpoint) this.config.endpoints.health = bankConfig.healthEndpoint;
    if (bankConfig.eligibilityEndpoint) this.config.endpoints.eligibility = bankConfig.eligibilityEndpoint;
    if (bankConfig.capacityEndpoint) this.config.endpoints.capacity = bankConfig.capacityEndpoint;
    if (bankConfig.disbursementEndpoint) this.config.endpoints.disbursement = bankConfig.disbursementEndpoint;
    if (bankConfig.loansEndpoint) this.config.endpoints.loans = bankConfig.loansEndpoint;
    if (bankConfig.webhookEndpoint) this.config.endpoints.webhook = bankConfig.webhookEndpoint;

    // Criar cliente HTTP
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
      },
    });

    this.logger.log(`${this.config.name} (${this.config.code}) configurado: ${this.config.apiUrl}`);
  }

  /**
   * Testar conexão com o banco
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!this.config.apiUrl) {
        throw new Error('Banco não configurado. Configure primeiro usando configure()');
      }

      this.logger.log(`Testando conexão com ${this.config.name}...`);

      const response = await this.client.get(this.config.endpoints.health);

      this.logger.log(`✓ Conexão com ${this.config.name} estabelecida`);

      return {
        success: true,
        message: 'Conexão estabelecida com sucesso',
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`✗ Erro ao conectar com ${this.config.name}:`, error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Verificar elegibilidade do cliente
   */
  async checkEligibility(request: {
    nuit?: string;
    nome?: string;
    telefone?: string;
    bi?: string;
    valor_solicitado?: number;
  }) {
    try {
      this.logger.log(`Verificando elegibilidade no ${this.config.name} para NUIT: ${request.nuit}`);

      const response = await this.retry(async () => {
        return await this.client.post(this.config.endpoints.eligibility, request);
      });

      const data = response.data;

      // Normalizar resposta para formato padrão PayJA
      if (!data.elegivel && !data.eligible) {
        return {
          eligible: false,
          reason: data.motivo || data.reason || 'Cliente não elegível',
          code: data.codigo || data.code,
        };
      }

      return {
        eligible: data.elegivel || data.eligible || true,
        maxAmount: data.limite_aprovado || data.maxAmount || data.creditLimit,
        interestRate: data.taxa_juros || data.interestRate || 12.5,
        maxTerm: data.prazo_maximo || data.maxTerm || 36,
        employerName: data.cliente?.empregador || data.employerName,
        monthlySalary: data.cliente?.renda_mensal || data.cliente?.salario || data.monthlySalary,
        employmentStatus: 'ACTIVE',
        bankData: {
          numero_conta: data.cliente?.numero_conta || data.accountNumber,
          score_credito: data.cliente?.score_credito || data.creditScore,
          score_comparacao: data.score_comparacao || data.matchScore,
          raw: data, // Dados originais
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao consultar elegibilidade ${this.config.name}:`, error.message);
      throw new Error(`Erro ao consultar ${this.config.name}: ${error.message}`);
    }
  }

  /**
   * Consultar capacidade financeira
   */
  async checkCapacity(request: { nuit: string; telefone?: string }) {
    try {
      this.logger.log(`Consultando capacidade financeira no ${this.config.name}: ${request.nuit}`);

      const response = await this.retry(async () => {
        return await this.client.post(this.config.endpoints.capacity, request);
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao consultar capacidade ${this.config.name}:`, error.message);
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
      this.logger.log(`Solicitando desembolso no ${this.config.name}: ${request.referencia_payja}`);

      const response = await this.retry(async () => {
        return await this.client.post(this.config.endpoints.disbursement, {
          nuit: request.nuit,
          valor: request.valor,
          numero_emola: request.numero_emola,
          referencia_payja: request.referencia_payja,
          descricao: request.descricao || `Desembolso de empréstimo PayJA`,
        });
      });

      const data = response.data;

      if (!data.sucesso && !data.success) {
        return {
          success: false,
          error: data.mensagem || data.message || 'Erro ao executar desembolso',
        };
      }

      return {
        success: true,
        transactionId: data.desembolso?.id || data.transactionId || data.id,
        disbursedAmount: data.desembolso?.valor || data.amount || request.valor,
        status: data.desembolso?.status || data.status || 'PROCESSING',
        disbursedAt: data.desembolso?.criado_em ? new Date(data.desembolso.criado_em) : new Date(),
      };
    } catch (error) {
      this.logger.error(`Erro ao solicitar desembolso ${this.config.name}:`, error.message);
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
      const response = await this.retry(async () => {
        return await this.client.post(this.config.endpoints.loans, request);
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao consultar empréstimos ${this.config.name}:`, error.message);
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
      this.logger.log(`Notificando pagamento ao ${this.config.name}: ${request.referencia}`);

      const response = await this.retry(async () => {
        return await this.client.post(this.config.endpoints.webhook, request);
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao notificar pagamento ${this.config.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Retry logic com backoff exponencial
   */
  private async retry<T>(fn: () => Promise<T>, attempts = this.config.retryAttempts): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        
        const delay = Math.min(1000 * Math.pow(2, i), 10000); // Max 10s
        this.logger.warn(`Tentativa ${i + 1} falhou. Aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries reached');
  }

  /**
   * Obter informações do banco configurado
   */
  getInfo() {
    return {
      code: this.config.code,
      name: this.config.name,
      apiUrl: this.config.apiUrl,
      configured: !!this.config.apiUrl,
      endpoints: this.config.endpoints,
    };
  }
}
