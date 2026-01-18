import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BankAdaptersService } from './bank-adapters-v2.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bank-partners')
@UseGuards(JwtAuthGuard)
export class BankPartnersController {
  private readonly logger = new Logger(BankPartnersController.name);

  constructor(private readonly bankAdaptersService: BankAdaptersService) {}

  /**
   * Listar todos os bancos parceiros
   */
  @Get()
  async listBanks() {
    return await this.bankAdaptersService.getAvailableBanks();
  }

  /**
   * Obter detalhes de um banco
   */
  @Get(':code')
  async getBankDetails(@Param('code') code: string) {
    return await this.bankAdaptersService.getBankDetails(code);
  }

  /**
   * Criar novo banco parceiro
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBank(
    @Body()
    body: {
      code: string;
      name: string;
      apiUrl: string;
      apiKey?: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      healthEndpoint?: string;
      eligibilityEndpoint?: string;
      capacityEndpoint?: string;
      disbursementEndpoint?: string;
      loansEndpoint?: string;
      webhookEndpoint?: string;
      timeout?: number;
      retryAttempts?: number;
    },
  ) {
    this.logger.log(`Criando novo banco parceiro: ${body.name}`);
    return await this.bankAdaptersService.createBank(body);
  }

  /**
   * Atualizar banco parceiro
   */
  @Put(':code')
  async updateBank(
    @Param('code') code: string,
    @Body()
    body: Partial<{
      name: string;
      apiUrl: string;
      apiKey: string;
      description: string;
      contactEmail: string;
      contactPhone: string;
      healthEndpoint: string;
      eligibilityEndpoint: string;
      capacityEndpoint: string;
      disbursementEndpoint: string;
      loansEndpoint: string;
      webhookEndpoint: string;
      timeout: number;
      retryAttempts: number;
      active: boolean;
    }>,
  ) {
    this.logger.log(`Atualizando banco parceiro: ${code}`);
    return await this.bankAdaptersService.updateBank(code, body);
  }

  /**
   * Deletar banco parceiro
   */
  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBank(@Param('code') code: string) {
    this.logger.log(`Deletando banco parceiro: ${code}`);
    await this.bankAdaptersService.deleteBank(code);
  }

  /**
   * Testar conexão com banco
   */
  @Post(':code/test-connection')
  async testConnection(@Param('code') code: string) {
    this.logger.log(`Testando conexão com: ${code}`);
    return await this.bankAdaptersService.testConnection(code);
  }

  /**
   * Verificar elegibilidade de cliente
   */
  @Post(':code/check-eligibility')
  async checkEligibility(
    @Param('code') code: string,
    @Body()
    body: {
      customerId: string;
      phoneNumber: string;
      nuit?: string;
      nome?: string;
      bi?: string;
      valor_solicitado?: number;
    },
  ) {
    this.logger.log(`Verificando elegibilidade no ${code} para cliente ${body.customerId}`);
    return await this.bankAdaptersService.checkEligibility(code, body);
  }

  /**
   * Solicitar desembolso
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
    this.logger.log(`Solicitando desembolso de ${body.amount} MZN para empréstimo ${body.loanId}`);
    return await this.bankAdaptersService.requestDisbursement(body);
  }
}
