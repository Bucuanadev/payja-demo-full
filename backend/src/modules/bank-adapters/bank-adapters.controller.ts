import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BankAdaptersService } from './bank-adapters-v2.service';

@Controller('bank-adapters')
export class BankAdaptersController {
  constructor(private readonly bankAdaptersService: BankAdaptersService) {}

  /**
   * Verificar elegibilidade de cliente em todos os bancos
   */
  @Post('check-eligibility/:bankCode')
  async checkEligibility(
    @Param('bankCode') bankCode: string,
    @Body()
    body: {
      customerId: string;
      phoneNumber: string;
      nuit?: string;
    },
  ) {
    return await this.bankAdaptersService.checkEligibility(bankCode, body);
  }

  /**
   * Solicitar desembolso de empréstimo via banco
   */
  @Post('disburse')
  async requestDisbursement(
    @Body()
    body: {
      customerId: string;
      loanId: string;
      amount: number;
      bankCode: string;
      accountNumber?: string;
    },
  ) {
    return await this.bankAdaptersService.requestDisbursement(body);
  }

  /**
   * Listar bancos parceiros disponíveis
   */
  @Get('available-banks')
  async getAvailableBanks() {
    return this.bankAdaptersService.getAvailableBanks();
  }

  /**
   * Testar conexão com um banco
   */
  @Post('test-connection/:bankCode')
  async testConnection(@Param('bankCode') bankCode: string) {
    return await this.bankAdaptersService.testConnection(bankCode);
  }
}
