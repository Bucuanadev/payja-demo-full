import { Controller, Post, Body, Logger } from '@nestjs/common';
import { BankSyncService } from './bank-sync.service';

@Controller('webhooks/bank-sync')
export class BankSyncController {
  private readonly logger = new Logger(BankSyncController.name);

  constructor(private readonly bankSyncService: BankSyncService) {}

  @Post()
  async handleSync(@Body() payload: any) {
    this.logger.log('Recebido webhook de sincronização do banco');
    return await this.bankSyncService.handleSync(payload);
  }
}
