import { Injectable, Logger } from '@nestjs/common';

export interface MockCustomer {
  id: string;
  nuit: string;
  biNumber: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  institution: string;
  salary: number;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  creditLimit: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  creditScore: number;
  employmentStatus: 'PERMANENT' | 'CONTRACT' | 'TEMPORARY';
  employmentYears: number;
  hasActiveLoans: boolean;
  totalDebt: number;
  createdAt: Date;
}

export interface MockBankAccount {
  accountNumber: string;
  nuit: string;
  accountHolder: string;
  bank: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'SALARY' | 'CURRENT';
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  balance: number;
  creditLimit: number;
  monthlyIncome: number;
  hasOverdraft: boolean;
  overdraftAmount: number;
}

@Injectable()
export class MockApiService {
  private readonly logger = new Logger(MockApiService.name);
  private mockCustomers: MockCustomer[] = this.generateMockCustomers();
  private mockBankAccounts: MockBankAccount[] = this.generateMockBankAccounts();

  async getCustomerByNuit(nuit: string): Promise<MockCustomer | null> {
    this.logger.debug(`Buscando cliente: NUIT ${nuit}`);
    return this.mockCustomers.find(c => c.nuit === nuit) || null;
  }

  async getBankAccountByNuit(nuit: string): Promise<MockBankAccount | null> {
    this.logger.debug(`Buscando conta: NUIT ${nuit}`);
    return this.mockBankAccounts.find(a => a.nuit === nuit) || null;
  }

  getAllMockCustomers(): MockCustomer[] {
    return this.mockCustomers;
  }

  getAllMockBankAccounts(): MockBankAccount[] {
    return this.mockBankAccounts;
  }

  addMockCustomer(data: any): { customer: MockCustomer; bankAccount?: MockBankAccount } {
    // Calcular categoria de risco baseado no credit score
    let riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
    const creditScore = data.creditScore || 650;
    if (creditScore >= 700) riskCategory = 'LOW';
    else if (creditScore >= 550) riskCategory = 'MEDIUM';
    else riskCategory = 'HIGH';

    const salary = data.salary || 15000;
    const creditLimit = this.calculateCreditLimitByRisk(salary, riskCategory, creditScore);

    // Criar cliente
    const newCustomer: MockCustomer = {
      id: `MOCK-${Date.now()}`,
      nuit: data.nuit || this.generateNuit(),
      biNumber: data.biNumber || this.generateBI(),
      fullName: data.fullName || 'Cliente Teste',
      phoneNumber: data.phoneNumber || '+258840000000',
      email: data.email || 'teste@email.com',
      institution: data.institution || 'Instituição Teste',
      salary,
      accountStatus: data.accountStatus || 'ACTIVE',
      creditLimit,
      riskCategory,
      creditScore,
      employmentStatus: data.employmentStatus || 'PERMANENT',
      employmentYears: data.employmentYears || 5,
      hasActiveLoans: data.hasActiveLoans || false,
      totalDebt: data.totalDebt || 0,
      createdAt: new Date(),
    };
    
    this.mockCustomers.push(newCustomer);
    this.logger.log(`Cliente mock adicionado: ${newCustomer.fullName} (NUIT: ${newCustomer.nuit})`);

    // Criar conta bancária se dados foram fornecidos
    let newBankAccount: MockBankAccount | undefined;
    if (data.bankName && data.accountNumber) {
      // Mapear tipo de conta
      let accountType: 'CHECKING' | 'SAVINGS' | 'SALARY' | 'CURRENT' = 'CHECKING';
      if (data.accountType === 'SALARY') accountType = 'SALARY';
      else if (data.accountType === 'SAVINGS') accountType = 'SAVINGS';
      else if (data.accountType === 'CURRENT') accountType = 'CURRENT';

      newBankAccount = {
        accountNumber: data.accountNumber,
        nuit: newCustomer.nuit,
        accountHolder: newCustomer.fullName,
        bank: data.bankName,
        accountType,
        accountStatus: newCustomer.accountStatus,
        balance: data.balance || 5000,
        creditLimit: data.bankCreditLimit || creditLimit,
        monthlyIncome: salary,
        hasOverdraft: false,
        overdraftAmount: 0,
      };
      
      this.mockBankAccounts.push(newBankAccount);
      this.logger.log(`Conta bancária adicionada: ${newBankAccount.bank} - ${newBankAccount.accountNumber}`);
    }

    return {
      customer: newCustomer,
      bankAccount: newBankAccount,
    };
  }

  private generateMockCustomers(): MockCustomer[] {
    const firstNames = ['João', 'Maria', 'António', 'Ana', 'Pedro', 'Isabel', 'Carlos', 'Sofia', 'Manuel', 'Beatriz'];
    const lastNames = ['Silva', 'Santos', 'Ferreira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Pereira'];
    const institutions = [
      'Ministério da Educação',
      'Ministério da Saúde',
      'EDM - Eletricidade de Moçambique',
      'Banco de Moçambique',
      'Hospital Central de Maputo',
    ];

    const customers: MockCustomer[] = [];
    for (let i = 0; i < 50; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const salary = Math.floor(Math.random() * 45000) + 10000;
      const creditScore = Math.floor(Math.random() * 550) + 300;
      
      let riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
      if (creditScore >= 700) riskCategory = 'LOW';
      else if (creditScore >= 550) riskCategory = 'MEDIUM';
      else riskCategory = 'HIGH';

      const creditLimit = this.calculateCreditLimitByRisk(salary, riskCategory, creditScore);

      customers.push({
        id: `EMO-${1000 + i}`,
        nuit: this.generateNuit(),
        biNumber: this.generateBI(),
        fullName: `${firstName} ${lastName}`,
        phoneNumber: `+25884${String(1000000 + i).padStart(7, '0')}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gov.mz`,
        institution: institutions[Math.floor(Math.random() * institutions.length)],
        salary,
        accountStatus: Math.random() > 0.1 ? 'ACTIVE' : 'INACTIVE',
        creditLimit,
        riskCategory,
        creditScore,
        employmentStatus: Math.random() > 0.2 ? 'PERMANENT' : 'CONTRACT',
        employmentYears: Math.floor(Math.random() * 20) + 1,
        hasActiveLoans: Math.random() > 0.7,
        totalDebt: Math.random() > 0.7 ? Math.floor(Math.random() * 20000) : 0,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      });
    }
    return customers;
  }

  private generateMockBankAccounts(): MockBankAccount[] {
    const banks = ['Millennium BIM', 'Standard Bank', 'BCI', 'Absa', 'Ecobank'];
    const accounts: MockBankAccount[] = [];
    const customersWithAccounts = this.mockCustomers.slice(0, 40);

    customersWithAccounts.forEach((customer, index) => {
      const bank = banks[Math.floor(Math.random() * banks.length)];
      const balance = Math.floor(Math.random() * 50000);
      const creditLimit = Math.floor(customer.creditLimit * 1.2);

      accounts.push({
        accountNumber: `${bank === 'Millennium BIM' ? '0001' : '0002'}${String(100000 + index).padStart(10, '0')}`,
        nuit: customer.nuit,
        accountHolder: customer.fullName,
        bank,
        accountType: Math.random() > 0.5 ? 'CHECKING' : 'SAVINGS',
        accountStatus: customer.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        balance,
        creditLimit,
        monthlyIncome: customer.salary,
        hasOverdraft: Math.random() > 0.7,
        overdraftAmount: Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : 0,
      });
    });
    return accounts;
  }

  private generateNuit(): string {
    return String(100000000 + Math.floor(Math.random() * 900000000));
  }

  private generateBI(): string {
    return `${String(100000000 + Math.floor(Math.random() * 900000000))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  }

  private calculateCreditLimitByRisk(salary: number, risk: string, score: number): number {
    let multiplier = 0.3;
    if (risk === 'LOW' && score >= 700) multiplier = 0.8;
    else if (risk === 'MEDIUM' && score >= 550) multiplier = 0.5;
    else multiplier = 0.2;
    return Math.round((salary * multiplier) / 100) * 100;
  }
}
