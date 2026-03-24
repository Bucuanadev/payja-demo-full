import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { BankSyncService } from './bank-sync.service';
import axios from 'axios';

@Controller('bank-sync')
export class BankSyncController {
  private readonly logger = new Logger(BankSyncController.name);
  private readonly BANCO_MOCK_URL = 'http://104.207.142.188:4500';

  constructor(private bankSyncService: BankSyncService) {}

  @Post('sync')
  async handleSync(@Body() payload: any) {
    this.logger.log('Recebido payload de sincronização do Banco Mock');
    return await this.bankSyncService.handleSync(payload);
  }

  @Get('sync-all')
  async syncAll() {
    this.logger.log('Iniciando sincronização completa com o Banco Mock');
    return await this.bankSyncService.syncAllFromBank();
  }

  @Post('send-decision')
  async sendDecision(@Body() payload: any) {
    /**
     * Payload esperado:
     * {
     *   nuit: string,
     *   nome_completo: string,
     *   telefone: string,
     *   decision: 'APPROVED' | 'REJECTED',
     *   creditLimit?: number,
     *   rejectionReasons?: string[],
     *   score: number
     * }
     */
    try {
      this.logger.log(`Enviando decisão para o Banco Mock: ${payload.nuit} - ${payload.decision}`);
      
      const response = await axios.post(
        `${this.BANCO_MOCK_URL}/api/payja-decisions`,
        {
          nuit: payload.nuit,
          nome_completo: payload.nome_completo,
          telefone: payload.telefone,
          decision: payload.decision,
          creditLimit: payload.creditLimit || 0,
          rejectionReasons: payload.rejectionReasons || [],
          score: payload.score || 0,
          decidedAt: new Date().toISOString(),
        }
      );

      this.logger.log(`✓ Decisão enviada com sucesso para ${payload.nuit}`);
      return { success: true, message: 'Decisão enviada ao Banco Mock' };
    } catch (error) {
      this.logger.error(`Erro ao enviar decisão ao Banco Mock: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        message: 'Falha ao enviar decisão ao Banco Mock'
      };
    }
  }

  @Post('send-batch-decisions')
  async sendBatchDecisions(@Body() payload: any) {
    /**
     * Payload esperado:
     * {
     *   decisions: [
     *     {
     *       nuit: string,
     *       nome_completo: string,
     *       telefone: string,
     *       decision: 'APPROVED' | 'REJECTED',
     *       creditLimit?: number,
     *       rejectionReasons?: string[],
     *       score: number
     *     }
     *   ]
     * }
     */
    try {
      const { decisions } = payload;
      this.logger.log(`Enviando ${decisions.length} decisões em lote para o Banco Mock`);

      const results = [];
      for (const decision of decisions) {
        try {
          const response = await axios.post(
            `${this.BANCO_MOCK_URL}/api/payja-decisions`,
            {
              nuit: decision.nuit,
              nome_completo: decision.nome_completo,
              telefone: decision.telefone,
              decision: decision.decision,
              creditLimit: decision.creditLimit || 0,
              rejectionReasons: decision.rejectionReasons || [],
              score: decision.score || 0,
              decidedAt: new Date().toISOString(),
            }
          );
          results.push({ nuit: decision.nuit, success: true });
        } catch (error) {
          this.logger.error(`Erro ao enviar decisão para ${decision.nuit}: ${error.message}`);
          results.push({ nuit: decision.nuit, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      this.logger.log(`✓ ${successCount}/${decisions.length} decisões enviadas com sucesso`);
      
      return { 
        success: true, 
        message: `${successCount}/${decisions.length} decisões enviadas`,
        results
      };
    } catch (error) {
      this.logger.error(`Erro ao enviar decisões em lote: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        message: 'Falha ao enviar decisões em lote'
      };
    }
  }
}
