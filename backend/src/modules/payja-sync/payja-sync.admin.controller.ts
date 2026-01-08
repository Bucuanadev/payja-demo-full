import { Controller, Get, Post } from '@nestjs/common';
import { PayjaSyncService } from './payja-sync.service';

@Controller('payja/sync')
export class PayjaSyncAdminController {
  constructor(private readonly payjaSyncService: PayjaSyncService) {}

  @Get('status')
  async getStatus() {
    return this.payjaSyncService.getSyncStatus();
  }

  @Post('trigger')
  async triggerSync() {
    return this.payjaSyncService.triggerManualSync();
  }

  @Get('simulator/customers')
  async getSimulatorCustomers(): Promise<any> {
    const customers = await this.payjaSyncService.fetchNewCustomers();
    return {
      source: 'ussd_simulator',
      count: customers.length,
      customers,
      timestamp: new Date().toISOString(),
    };
  }

  
}
