import { Controller, Post, Body, Headers, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BancoWebhooksService } from './banco-webhooks.service';

@Controller('webhooks/banco')
export class BancoWebhooksController {
  private readonly logger = new Logger(BancoWebhooksController.name);

  constructor(private readonly bancoWebhooksService: BancoWebhooksService) {}

  @Post('pagamento')
  async handlePagamento(
    @Body() payload: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    this.logger.log('📨 Webhook de pagamento recebido do Banco Welli');
    this.logger.debug(`Payload: ${JSON.stringify(payload)}`);

    // Validar API Key (opcional, dependendo da segurança desejada)
    // if (apiKey !== process.env.BANCO_API_KEY) {
    //   throw new HttpException('API Key inválida', HttpStatus.UNAUTHORIZED);
    // }

    try {
      const result = await this.bancoWebhooksService.processarPagamento(payload);
      
      return {
        success: true,
        message: 'Webhook processado com sucesso',
        data: result,
      };
    } catch (error) {
      this.logger.error('Erro ao processar webhook de pagamento:', error);
      throw new HttpException(
        error.message || 'Erro ao processar webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('desembolso')
  async handleDesembolso(
    @Body() payload: any,
    @Headers('x-api-key') apiKey: string,
  ) {
    this.logger.log('📨 Webhook de desembolso recebido do Banco Welli');
    this.logger.debug(`Payload: ${JSON.stringify(payload)}`);

    try {
      const result = await this.bancoWebhooksService.processarDesembolso(payload);
      
      return {
        success: true,
        message: 'Webhook processado com sucesso',
        data: result,
      };
    } catch (error) {
      this.logger.error('Erro ao processar webhook de desembolso:', error);
      throw new HttpException(
        error.message || 'Erro ao processar webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
