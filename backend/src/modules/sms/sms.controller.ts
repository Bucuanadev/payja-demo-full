import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sms')
export class SmsController {
  constructor(private smsService: SmsService) {}

  // Buscar logs de SMS por query parameter
  @Get('logs')
  async getSmsLogs(
    @Query('phoneNumber') phoneNumber?: string,
    @Query('limit') limit?: string,
  ) {
    if (phoneNumber) {
      return this.smsService.getReceivedSms(
        phoneNumber,
        limit ? parseInt(limit) : 20,
      );
    }
    return this.smsService.getAllRecentSms(limit ? parseInt(limit) : 50);
  }

  // Simulador de SMS - sem auth para facilitar
  @Get('received/:phoneNumber')
  async getReceivedSms(
    @Param('phoneNumber') phoneNumber: string,
    @Query('limit') limit?: string,
  ) {
    return this.smsService.getReceivedSms(
      phoneNumber,
      limit ? parseInt(limit) : 10,
    );
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string) {
    await this.smsService.markAsRead(id);
    return { success: true };
  }

  // Endpoints protegidos para admin
  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendSms(
    @Body('phoneNumber') phoneNumber: string,
    @Body('message') message: string,
    @Body('type') type: any,
  ) {
    return this.smsService.sendSms(phoneNumber, message, type);
  }

  @Post('verification/:phoneNumber')
  async sendVerification(@Param('phoneNumber') phoneNumber: string) {
    const code = await this.smsService.sendVerificationCode(phoneNumber);
    return { 
      success: true, 
      message: 'Código enviado',
      // Em produção, NÃO retornar o código
      code: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  }

  @Post('verify')
  async verifyCode(
    @Body('phoneNumber') phoneNumber: string,
    @Body('code') code: string,
  ) {
    const valid = await this.smsService.verifyCode(phoneNumber, code);
    return { valid };
  }
}
