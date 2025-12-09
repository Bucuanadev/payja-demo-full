import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommissionService } from './commission.service';
import { BankValidationService } from './bank-validation.service';
import { DisbursementService } from './disbursement.service';
import { InstallmentService } from './installment.service';
import { InterestRateService } from './interest-rate.service';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(
    private loansService: LoansService,
    private commissionService: CommissionService,
    private bankValidationService: BankValidationService,
    private disbursementService: DisbursementService,
    private installmentService: InstallmentService,
  ) {}

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

  // ===== NOVOS ENDPOINTS =====

  // Calcular comissões
  @Post('calculate-commission')
  async calculateCommission(@Body('amount') amount: number) {
    return this.commissionService.calculateCommissions(amount);
  }

  // Validar cliente com banco
  @Post('validate-bank')
  async validateWithBank(
    @Body() body: {
      customerId: string;
      phoneNumber: string;
      bankCode: string;
      nuit?: string;
      fullName?: string;
    },
  ) {
    return this.bankValidationService.validateCustomerWithBank(body.customerId, {
      phoneNumber: body.phoneNumber,
      bankCode: body.bankCode,
      nuit: body.nuit,
      fullName: body.fullName,
    });
  }

  // Processar desembolso
  @Post(':id/disburse')
  async disburseLoan(
    @Param('id') loanId: string,
    @Body() body: { emolaPhoneNumber: string },
  ) {
    const loan = await this.loansService.getLoanById(loanId);
    return this.disbursementService.processDisbursement({
      loanId,
      bankCode: loan.bankCode || 'LETSEGO',
      amount: loan.amount,
      emolaPhoneNumber: body.emolaPhoneNumber,
    });
  }

  // Buscar transações de um empréstimo
  @Get(':id/transactions')
  async getLoanTransactions(@Param('id') loanId: string) {
    return this.disbursementService.getLoanTransactions(loanId);
  }

  // Gerar cronograma de prestações
  @Get(':id/installments/schedule')
  async getInstallmentSchedule(@Param('id') loanId: string) {
    return this.installmentService.generateInstallmentSchedule(loanId);
  }

  // Criar prestações
  @Post(':id/installments/create')
  async createInstallments(@Param('id') loanId: string) {
    return this.installmentService.createInstallments(loanId);
  }

  // Buscar prestações pendentes
  @Get(':id/installments/pending')
  async getPendingInstallments(@Param('id') loanId: string) {
    return this.installmentService.getPendingInstallments(loanId);
  }

  // Pagar prestação
  @Post('installments/:installmentId/pay')
  async payInstallment(
    @Param('installmentId') installmentId: string,
    @Body() body: { paymentMethod: string; reference?: string },
  ) {
    return this.installmentService.processInstallmentPayment(
      installmentId,
      body.paymentMethod,
      body.reference,
    );
  }

  // Buscar prestações vencidas
  @Get('installments/overdue')
  async getOverdueInstallments() {
    return this.installmentService.getOverdueInstallments();
  }

  // Relatório de comissões
  @Post('reports/commissions')
  async getCommissionReport(@Body('loans') loans: any[]) {
    return this.commissionService.generateCommissionReport(loans);
  }

  // Relatório de desembolsos
  @Get('reports/disbursements')
  async getDisbursementReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.disbursementService.getDisbursementReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  // Relatório de prestações
  @Get('reports/installments')
  async getInstallmentReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.installmentService.getInstallmentReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  // Calcular liquidação antecipada com desconto
  @Post(':id/calculate-early-payment')
  async calculateEarlyPayment(@Param('id') id: string) {
    return this.loansService.calculateEarlyPayment(id);
  }

  // Processar liquidação antecipada
  @Post(':id/process-early-payment')
  async processEarlyPayment(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod: string,
    @Body('transactionReference') transactionReference: string,
  ) {
    return this.loansService.processEarlyPayment(
      id,
      paymentMethod,
      transactionReference,
    );
  }

  // Obter termos e condições
  @Get('terms/current')
  async getCurrentTerms() {
    return this.loansService.getCurrentTerms();
  }

  // Registrar aceite dos termos e condições
  @Post('terms/accept')
  async acceptTerms(
    @Body('customerId') customerId: string,
    @Body('termsVersion') termsVersion: string,
  ) {
    return this.loansService.acceptTerms(customerId, termsVersion);
  }
}
