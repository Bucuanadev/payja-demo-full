import { Controller, Post, Body } from '@nestjs/common';
import { UssdService } from './ussd.service';

@Controller('ussd')
export class UssdController {
  constructor(private ussdService: UssdService) {}

  @Post()
  async handleUssd(
    @Body('sessionId') sessionId: string,
    @Body('phoneNumber') phoneNumber: string,
    @Body('text') text: string,
  ) {
    try {
      return await this.ussdService.handleUssdRequest({
        sessionId,
        phoneNumber,
        text,
      });
    } catch (error) {
      console.error('Erro USSD:', error);
      return {
        message: `Erro: ${error.message}`,
        continueSession: false,
      };
    }
  }

  @Post('simulate')
  async simulateUssd(@Body() body: any) {
    try {
      // Endpoint para simular USSD no desktop
      return await this.ussdService.handleUssdRequest(body);
    } catch (error) {
      console.error('Erro simulação USSD:', error);
      return {
        message: `Erro ao processar: ${error.message}`,
        continueSession: false,
      };
    }
  }
}
