import { Body, Controller, Post, Get, Param, Patch } from '@nestjs/common';
import { PayjaSyncService } from './payja-sync.service';

@Controller('integrations/ussd')
export class PayjaSyncController {
  constructor(private readonly service: PayjaSyncService) {}

  @Post('sync-new-customers')
  async syncNewCustomers(@Body() body: any) {
    const result = await this.service.syncNewCustomers();
    return result;
  }

  @Post('sync-bank-clientes')
  async syncBankClientes(@Body() body: any) {
    const result = await this.service.syncBankClientes();
    return result;
  }

  @Post('validate-customer/:phoneNumber')
  async validateCustomer(@Param('phoneNumber') phoneNumber: string) {
    const result = await this.service.validateAndUpdateCustomer(phoneNumber);
    return result;
  }

  @Get('customer-status/:phoneNumber')
  async getCustomerStatus(@Param('phoneNumber') phoneNumber: string) {
    return this.service.getCustomerStatus(phoneNumber);
  }

  @Post('sync-loans')
  async syncLoans(@Body() body: any) {
    const result = await this.service.syncLoans();
    return result;
  }

  @Get('loans')
  async getLoans() {
    const loans = await this.service.getLoans();
    return { count: loans.length, data: loans };
  }

  @Get('customers')
  async listCustomers() {
    // Exposição simples para verificação rápida (sem auth apenas ambiente local)
    const data = await (this as any).service['prisma'].customer.findMany({
      select: { id: true, phoneNumber: true, name: true, nuit: true, biNumber: true, verified: true, creditLimit: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { count: data.length, data };
  }

  @Post('loans/:id/disburse')
  async confirmDisbursal(@Param('id') loanId: string, @Body() body: any) {
    const result = await this.service.confirmDisbursal(loanId, body);
    return result;
  }

  @Patch('loans/:id/disburse')
  async confirmDisbursalPatch(@Param('id') loanId: string, @Body() body: any) {
    const result = await this.service.confirmDisbursal(loanId, body);
    return result;
  }
}
