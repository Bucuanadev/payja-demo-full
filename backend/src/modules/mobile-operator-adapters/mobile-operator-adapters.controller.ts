import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MobileOperatorAdaptersService } from './mobile-operator-adapters.service';

@Controller('mobile-operators')
export class MobileOperatorAdaptersController {
  constructor(
    private readonly mobileOperatorService: MobileOperatorAdaptersService,
  ) {}

  /**
   * Desembolsar empréstimo para carteira móvel
   */
  @Post('disburse')
  async disburseToWallet(
    @Body()
    body: {
      phoneNumber: string;
      amount: number;
      loanId: number;
      reference: string;
    },
  ) {
    return await this.mobileOperatorService.disburseToWallet(body);
  }

  /**
   * Verificar status da carteira móvel
   */
  @Get('wallet-status/:phoneNumber')
  async checkWalletStatus(@Param('phoneNumber') phoneNumber: string) {
    return await this.mobileOperatorService.checkWalletStatus(phoneNumber);
  }

  /**
   * Coletar pagamento via mobile money
   */
  @Post('collect-payment')
  async collectPayment(
    @Body()
    body: {
      phoneNumber: string;
      amount: number;
      reference: string;
      description: string;
    },
  ) {
    return await this.mobileOperatorService.collectPayment(body);
  }

  /**
   * Listar operadoras disponíveis
   */
  @Get('available-operators')
  async getAvailableOperators() {
    return this.mobileOperatorService.getAvailableOperators();
  }
}
