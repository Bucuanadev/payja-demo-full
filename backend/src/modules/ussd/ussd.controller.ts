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
    return this.ussdService.handleUssdRequest({
      sessionId,
      phoneNumber,
      text,
    });
  }

  @Post('simulate')
  async simulateUssd(@Body() body: any) {
    // Endpoint para simular USSD no desktop
    return this.ussdService.handleUssdRequest(body);
  }
}
