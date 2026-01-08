import { Body, Controller, Post, Get, Param, Patch } from '@nestjs/common';
import { PayjaSyncService } from './payja-sync.service';

@Controller('integrations/ussd')
export class PayjaSyncController {
  constructor(private readonly service: PayjaSyncService) {}

  @Post('sync-new-customers')
  async syncNewCustomers(@Body() body: any) {
    return this.service.syncNewCustomers();
  }

  @Post('validate-customer/:phoneNumber')
  async validateCustomer(@Param('phoneNumber') phoneNumber: string) {
    return this.service.validateAndUpdateCustomer(phoneNumber);
  }

  @Get('customer-status/:phoneNumber')
  async getCustomerStatus(@Param('phoneNumber') phoneNumber: string) {
    return this.service.getCustomerStatus(phoneNumber);
  }

  @Post('sync-loans')
  async syncLoans(@Body() body: any) {
    return this.service.syncLoans();
  }

  @Get('loans')
  async getLoans() {
    const loans = await this.service.getLoans();
    return { count: loans.length, data: loans };
  }

  @Post('loans/:id/disburse')
  async confirmDisbursal(@Param('id') loanId: string, @Body() body: any) {
    return this.service.confirmDisbursal(loanId, body);
  }

  @Patch('loans/:id/disburse')
  async confirmDisbursalPatch(@Param('id') loanId: string, @Body() body: any) {
    return this.service.confirmDisbursal(loanId, body);
  }

  // Manual trigger to reconcile all customers with bank data
  @Post('reconcile-customers')
  async reconcileCustomers() {
    return this.service.reconcileAllCustomers();
  }
}
