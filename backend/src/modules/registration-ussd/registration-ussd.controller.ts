import { Controller, Post, Body } from '@nestjs/common';
import { RegistrationUssdService } from './registration-ussd.service';

@Controller('ussd/registration')
export class RegistrationUssdController {
  constructor(private registrationUssdService: RegistrationUssdService) {}

  @Post()
  async handleRegistration(
    @Body('sessionId') sessionId: string,
    @Body('phoneNumber') phoneNumber: string,
    @Body('text') text: string,
  ): Promise<{ message: string; continueSession: boolean }> {
    try {
      return await this.registrationUssdService.handleRegistrationUssd(
        sessionId,
        phoneNumber,
        text,
      );
    } catch (error) {
      console.error('Erro USSD Registro:', error);
      return {
        message: `Erro: ${error.message}`,
        continueSession: false,
      };
    }
  }

  @Post('simulate')
  async simulateRegistration(@Body() body: any): Promise<{ message: string; continueSession: boolean }> {
    try {
      return await this.registrationUssdService.handleRegistrationUssd(
        body.sessionId,
        body.phoneNumber,
        body.text,
      );
    } catch (error) {
      console.error('Erro simulação USSD Registro:', error);
      return {
        message: `Erro: ${error.message}`,
        continueSession: false,
      };
    }
  }
}
