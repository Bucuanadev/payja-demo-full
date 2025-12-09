import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { CrossValidationService, CustomerData } from './cross-validation.service';
import { MockApiService } from './mock-api.service';

@Controller('api/v1/cross-validation')
export class CrossValidationController {
  private readonly logger = new Logger(CrossValidationController.name);

  constructor(
    private crossValidationService: CrossValidationService,
    private mockApiService: MockApiService,
  ) {}

  /**
   * Validar cliente (validação cruzada completa)
   */
  @Post('validate')
  async validateCustomer(@Body() customerData: CustomerData) {
    this.logger.log(`Requisição de validação: NUIT ${customerData.nuit}`);
    return this.crossValidationService.validateCustomer(customerData);
  }

  /**
   * Obter todos os clientes mock (para painel de controle)
   */
  @Get('mock/customers')
  getAllMockCustomers() {
    return this.mockApiService.getAllMockCustomers();
  }

  /**
   * Obter todas as contas bancárias mock
   */
  @Get('mock/bank-accounts')
  getAllMockBankAccounts() {
    return this.mockApiService.getAllMockBankAccounts();
  }

  /**
   * Buscar cliente mock por NUIT
   */
  @Get('mock/customer/:nuit')
  async getMockCustomer(@Param('nuit') nuit: string) {
    const customer = await this.mockApiService.getCustomerByNuit(nuit);
    const bankAccount = await this.mockApiService.getBankAccountByNuit(nuit);

    return {
      customer,
      bankAccount,
    };
  }

  /**
   * Adicionar cliente mock (para testes)
   */
  @Post('mock/customer')
  addMockCustomer(@Body() customerData: any) {
    return this.mockApiService.addMockCustomer(customerData);
  }

  /**
   * Obter estatísticas dos dados mock
   */
  @Get('mock/stats')
  getMockStats() {
    const customers = this.mockApiService.getAllMockCustomers();
    const bankAccounts = this.mockApiService.getAllMockBankAccounts();

    const stats = {
      totalCustomers: customers.length,
      totalBankAccounts: bankAccounts.length,
      activeCustomers: customers.filter(c => c.accountStatus === 'ACTIVE').length,
      customersWithLoans: customers.filter(c => c.hasActiveLoans).length,
      riskDistribution: {
        low: customers.filter(c => c.riskCategory === 'LOW').length,
        medium: customers.filter(c => c.riskCategory === 'MEDIUM').length,
        high: customers.filter(c => c.riskCategory === 'HIGH').length,
      },
      avgCreditLimit: Math.round(
        customers.reduce((sum, c) => sum + c.creditLimit, 0) / customers.length
      ),
      avgSalary: Math.round(
        customers.reduce((sum, c) => sum + c.salary, 0) / customers.length
      ),
      avgCreditScore: Math.round(
        customers.reduce((sum, c) => sum + c.creditScore, 0) / customers.length
      ),
    };

    return stats;
  }
}
