import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BankAdaptersService } from './bank-adapters.service';

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
   * Sincronizar funcionários públicos de um banco específico
   */
  @Post('sync-employees/:bankCode')
  async syncEmployees(@Param('bankCode') bankCode: string) {
    const result = await this.bankAdaptersService.syncPublicEmployees(bankCode);
    return result;
  }

  /**
   * Listar bancos parceiros disponíveis
   */
  @Get('available-banks')
  async getAvailableBanks() {
    return this.bankAdaptersService.getAvailableBanks();
  }
}
