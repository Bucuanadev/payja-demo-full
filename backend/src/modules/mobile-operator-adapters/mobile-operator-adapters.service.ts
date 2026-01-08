import { Injectable } from '@nestjs/common';
import { MpesaAdapter } from './adapters/mpesa.adapter';
import { EMolaAdapter } from './adapters/emola.adapter';
import { MkeshAdapter } from './adapters/mkesh.adapter';

/**
 * Serviço de Adaptadores de Operadoras Móveis
 * Gerencia integração com M-Pesa, e-Mola e Mkesh para desembolso de empréstimos
 */
@Injectable()
export class MobileOperatorAdaptersService {
  constructor(
    private readonly mpesaAdapter: MpesaAdapter,
    private readonly emolaAdapter: EMolaAdapter,
    private readonly mkeshAdapter: MkeshAdapter,
  ) {}

  /**
   * Desembolsar empréstimo para carteira móvel
   */
  async disburseToWallet(request: {
    phoneNumber: string;
    amount: number;
    loanId: number;
    reference: string;
  }) {
    const operator = this.detectOperator(request.phoneNumber);

    try {
      let result;

      switch (operator) {
        case 'MPESA':
          result = await this.mpesaAdapter.disburseLoan(request);
          break;
        case 'EMOLA':
          result = await this.emolaAdapter.disburseLoan(request);
          break;
        case 'MKESH':
          result = await this.mkeshAdapter.disburseLoan(request);
          break;
        default:
          throw new Error(`Operadora não suportada para número: ${request.phoneNumber}`);
      }

      return {
        success: true,
        operator,
        transactionId: result.transactionId,
        disbursedAmount: result.amount,
        disbursedAt: result.timestamp,
        walletBalance: result.newBalance,
      };
    } catch (error) {
      return {
        success: false,
        operator,
        error: error.message,
      };
    }
  }

  /**
   * Verificar status de carteira móvel
   */
  async checkWalletStatus(phoneNumber: string) {
    const operator = this.detectOperator(phoneNumber);

    try {
      let result;

      switch (operator) {
        case 'MPESA':
          result = await this.mpesaAdapter.checkBalance(phoneNumber);
          break;
        case 'EMOLA':
          result = await this.emolaAdapter.checkBalance(phoneNumber);
          break;
        case 'MKESH':
          result = await this.mkeshAdapter.checkBalance(phoneNumber);
          break;
        default:
          throw new Error('Operadora não identificada');
      }

      return {
        operator,
        active: result.active,
        balance: result.balance,
        accountName: result.accountName,
      };
    } catch (error) {
      return {
        operator,
        active: false,
        error: error.message,
      };
    }
  }

  /**
   * Coletar pagamento via mobile money
   */
  async collectPayment(request: {
    phoneNumber: string;
    amount: number;
    reference: string;
    description: string;
  }) {
    const operator = this.detectOperator(request.phoneNumber);

    try {
      let result;

      switch (operator) {
        case 'MPESA':
          result = await this.mpesaAdapter.collectPayment(request);
          break;
        case 'EMOLA':
          result = await this.emolaAdapter.collectPayment(request);
          break;
        case 'MKESH':
          result = await this.mkeshAdapter.collectPayment(request);
          break;
        default:
          throw new Error('Operadora não suportada');
      }

      return {
        success: true,
        operator,
        transactionId: result.transactionId,
        collectedAmount: result.amount,
        collectedAt: result.timestamp,
      };
    } catch (error) {
      return {
        success: false,
        operator,
        error: error.message,
      };
    }
  }

  /**
   * Detectar operadora pelo número de telefone
   */
  private detectOperator(phoneNumber: string): string {
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // M-Pesa (Vodacom): 84XXXXXXX ou 85XXXXXXX
    if (cleanNumber.startsWith('25884') || cleanNumber.startsWith('84') ||
        cleanNumber.startsWith('25885') || cleanNumber.startsWith('85')) {
      return 'MPESA';
    }

    // e-Mola (Movitel): 86XXXXXXX ou 87XXXXXXX
    if (cleanNumber.startsWith('25886') || cleanNumber.startsWith('86') ||
        cleanNumber.startsWith('25887') || cleanNumber.startsWith('87')) {
      return 'EMOLA';
    }

    // Mkesh (mcel): 82XXXXXXX ou 83XXXXXXX
    if (cleanNumber.startsWith('25882') || cleanNumber.startsWith('82') ||
        cleanNumber.startsWith('25883') || cleanNumber.startsWith('83')) {
      return 'MKESH';
    }

    throw new Error('Número de telefone não corresponde a nenhuma operadora conhecida');
  }

  /**
   * Obter lista de operadoras disponíveis
   */
  getAvailableOperators() {
    return [
      {
        code: 'MPESA',
        name: 'M-Pesa',
        provider: 'Vodacom',
        prefix: ['84', '85'],
        active: true,
      },
      {
        code: 'EMOLA',
        name: 'e-Mola',
        provider: 'Movitel',
        prefix: ['86', '87'],
        active: true,
      },
      {
        code: 'MKESH',
        name: 'Mkesh',
        provider: 'mcel',
        prefix: ['82', '83'],
        active: true,
      },
    ];
  }
}
