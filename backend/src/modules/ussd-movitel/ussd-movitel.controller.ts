import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UssdMovitelService } from './ussd-movitel.service';

@Controller('movitel/ussd')
export class UssdMovitelController {
  constructor(private readonly ussdService: UssdMovitelService) {}

  @Post('callback')
  async handleCallback(@Body() body: any) {
    try {
      console.log('[USSD-CONTROLLER] Body recebido:', JSON.stringify(body));
      
      const sessionId = body?.sessionId || `auto_${Date.now()}`;
      const msisdn = body?.msisdn || '';
      const userInput = body?.userInput || '';

      console.log('[USSD-CONTROLLER] Processando:', {
        sessionId,
        msisdn,
        userInput,
      });

      const result = await this.ussdService.processRequest(
        sessionId,
        msisdn,
        userInput,
      );

      return {
        sessionId,
        msisdn,
        response: result.response,
        shouldClose: result.shouldClose,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[USSD-CONTROLLER] Erro:', error.message, error.stack);
      return {
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'OK',
      service: 'Txeneka Male USSD',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test')
  async test(): Promise<any> {
    try {
      // Teste básico de criação de sessão
      const testSession = await this.ussdService.processRequest(
        'debug-session',
        '258840000000',
        '',
      );
      return {
        success: true,
        result: testSession,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  async simulate(@Body() body: { msisdn: string; inputs: string[] }) {
    const { msisdn, inputs } = body;
    const sessionId = `sim_${Date.now()}`;
    const responses = [];

    console.log('[USSD-SIMULATE] Iniciando simulacao:', { msisdn, sessionId });

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      console.log(`[USSD-SIMULATE] Step ${i + 1}:`, input);

      const result = await this.ussdService.processRequest(
        sessionId,
        msisdn,
        input,
      );

      responses.push({
        step: i + 1,
        input: input,
        response: result.response,
        shouldClose: result.shouldClose,
      });

      if (result.shouldClose) {
        console.log('[USSD-SIMULATE] Sessao encerrada no step', i + 1);
        break;
      }
    }

    return {
      sessionId,
      msisdn,
      totalSteps: responses.length,
      responses,
      timestamp: new Date().toISOString(),
    };
  }
}
