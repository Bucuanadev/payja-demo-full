import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Get()
  async getAllLoans(@Query() filters: any) {
    return this.loansService.getAllLoans(filters);
  }

  @Get('statistics')
  async getStatistics() {
    return this.loansService.getStatistics();
  }

  @Get(':id')
  async getLoanById(@Param('id') id: string) {
    return this.loansService.getLoanById(id);
  }

  @Patch(':id/status')
  async updateLoanStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req,
  ) {
    return this.loansService.updateLoanStatus(id, status, req.user.userId);
  }

  @Get('customer/:customerId')
  async getCustomerLoans(@Param('customerId') customerId: string) {
    return this.loansService.getCustomerLoans(customerId);
  }
}
