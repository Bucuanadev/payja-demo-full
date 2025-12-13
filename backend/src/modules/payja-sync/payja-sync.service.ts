import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Interval } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma.service';

interface SimCustomer {
  phoneNumber: string;
  name?: string;

  nuit?: string;
  biNumber?: string;
  bi?: string;
  institution?: string;
  registeredAt?: string;
}

interface SimLoan {
  id: string;
  phoneNumber: string;
  customerName?: string;
  amount: number;
  term: string;
  interest: number;
  status: string;
  reason?: string;
  bank?: string;
  score?: number;
  createdAt: string;
  updatedAt: string;
}

interface PayjaConfig {
  simulatorBaseUrl: string;
  endpointNewCustomers: string;
  endpointEligibility: string;
  endpointLoans: string;
}

@Injectable()
export class PayjaSyncService {
  constructor(private http: HttpService, private prisma: PrismaService) {}

  private getConfig(): PayjaConfig {
    const simulatorBaseUrl = process.env.USSD_SIM_BASE_URL || 'http://localhost:3001';
    const endpointNewCustomers = process.env.USSD_SIM_ENDPOINT_NEW || '/api/payja/ussd/new-customers';
    const endpointEligibility = process.env.USSD_SIM_ENDPOINT_ELIG || '/api/payja/ussd/eligibility';
    const endpointLoans = process.env.USSD_SIM_ENDPOINT_LOANS || '/api/loans';
    return { simulatorBaseUrl, endpointNewCustomers, endpointEligibility, endpointLoans };
  }

  async fetchNewCustomers(): Promise<SimCustomer[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointNewCustomers, cfg.simulatorBaseUrl).toString();
    const resp = await firstValueFrom(this.http.get(url));
    const data = resp.data;
    return Array.isArray(data?.data) ? data.data : [];
  }

  async fetchSimulatorLoans(): Promise<SimLoan[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointLoans, cfg.simulatorBaseUrl).toString();
    try {
      const resp = await firstValueFrom(this.http.get(url));
      const data = resp.data;
      return Array.isArray(data?.data) ? data.data : [];
    } catch (error) {
      console.error('[Loan Sync] Erro ao buscar empréstimos do simulador:', error.message);
      return [];
    }
  }


  async validateWithBankByCustomer(
    customer: { nuit?: string | null; biNumber?: string | null; salaryBank?: string | null; phoneNumber?: string }
  ) {
    const bankBase = process.env.BANK_BASE_URL || 'http://localhost:4500';
    try {
      const resp = await firstValueFrom(this.http.get(`${bankBase}/api/clientes`));
      const clientes = (resp as any).data?.clientes || [];
      // Match by nuit + bi + empregador
      const found = clientes.find((c: any) => {
        const nuitMatch = customer.nuit && c.nuit && String(customer.nuit).trim() === String(c.nuit).trim();
        const biMatch = customer.biNumber && c.bi && String(customer.biNumber).trim() === String(c.bi).trim();
        const institutionMatch = customer.salaryBank && c.empregador &&
          String(customer.salaryBank).toLowerCase().trim() === String(c.empregador).toLowerCase().trim();
        return nuitMatch && biMatch && institutionMatch;
      });
      return found || null;
    } catch (e) {
      console.error('Erro ao buscar no banco:', e.message);
      return null;
    }
  }

  async validateCustomerData(simCustomer: SimCustomer, bankCustomer: any): Promise<boolean> {
    // Comparar NUIT, BI e instituição de trabalho (todos devem coincidir)
    const nuitMatch = !!(simCustomer.nuit && bankCustomer.nuit && 
                      String(simCustomer.nuit).trim() === String(bankCustomer.nuit).trim());
    const biValue = simCustomer.biNumber || simCustomer.bi;
    const biMatch = !!(biValue && bankCustomer.bi && 
                    String(biValue).trim() === String(bankCustomer.bi).trim());
    const institutionMatch = !!(simCustomer.institution && bankCustomer.empregador && 
                             String(simCustomer.institution).toLowerCase().trim() === 
                             String(bankCustomer.empregador).toLowerCase().trim());
    return nuitMatch && biMatch && institutionMatch;
  }

  async upsertCustomer(sim: SimCustomer, bankData: any) {
    const phone = sim.phoneNumber;
    const existing = await this.prisma.customer.findUnique({ where: { phoneNumber: phone } });
    const data = {
      phoneNumber: phone,
      name: sim.name || 'Cliente USSD',
      nuit: sim.nuit || null,
      biNumber: sim.biNumber || sim.bi || null,
      creditLimit: bankData?.limite_credito || 0,
      creditScore: bankData?.score_credito ?? null,
      salary: bankData?.salario ?? null,
      salaryBank: sim.institution || bankData?.empregador || null,
      verified: !!bankData, // Apenas verifica se há dados do banco
    } as any;

    // Se houver dados do banco, adicionar email e outras informações
    if (bankData) {
      data.email = bankData.email || null;
      data.creditLimit = bankData.limite_credito || 0;
      data.creditScore = bankData.score_credito ?? null;
      data.salary = bankData.salario ?? null;
      data.salaryBank = bankData.empregador || null;
    }

    if (existing) {
      return await this.prisma.customer.update({ where: { id: existing.id }, data });
    }
    return await this.prisma.customer.create({ data });
  }

  async postEligibility(sim: SimCustomer, limit: number, eligible: boolean, reason?: string) {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointEligibility, cfg.simulatorBaseUrl).toString();
    const payload = {
      phoneNumber: sim.phoneNumber,
      eligible,
      creditLimit: limit,
      minAmount: Math.min(eligible ? Math.floor(limit * 0.05) : 0, limit),
      reason: reason || (eligible ? 'Elegível' : 'Não elegível'),
    };
    try {
      await firstValueFrom(this.http.post(url, payload));
    } catch (e) {
      // ignore
    }
  }

  async syncNewCustomers() {
    const importedCustomers: any[] = [];
    const failed: any[] = [];
    const list = await this.fetchNewCustomers();
    for (const c of list) {
      try {
        // Importa cliente SEM validar no banco (fica como "Não verificado")
        const saved = await this.upsertCustomer(c, null);
        // Tenta validar imediatamente com o banco
        try {
          const validation = await this.validateAndUpdateCustomer(saved.phoneNumber);
          importedCustomers.push({
            phoneNumber: c.phoneNumber,
            id: saved.id,
            status: validation?.success ? 'Verificado' : (saved.verified ? 'Verificado' : 'Não verificado'),
            validation
          });
        } catch (validationError) {
          importedCustomers.push({
            phoneNumber: c.phoneNumber,
            id: saved.id,
            status: saved.verified ? 'Verificado' : 'Não verificado',
            validation: { success: false, error: String(validationError?.message || validationError) }
          });
        }
      } catch (err) {
        failed.push({ phoneNumber: c.phoneNumber, error: String(err?.message || err) });
      }
    }
    return { synced: importedCustomers.length, importedCustomers, failed };
  }

  @Interval(15000) // Run every 15 seconds
  async autoSyncNewCustomers() {
    try {
      const result = await this.syncNewCustomers();
      if (result.synced > 0) {
        console.log(`[Auto-Sync] Synced ${result.synced} customers from simulator`);
      }
    } catch (error) {
      console.error('[Auto-Sync] Error syncing customers:', error.message);
    }
  }

  @Interval(15000) // Run every 15 seconds (same interval)
  async autoSyncLoans() {
    try {
      const result = await this.syncLoans();
      if ((result.syncedCount as any) > 0) {
        console.log(`[Loan-Sync] Synced ${result.syncedCount} loans from simulator`);
      }
    } catch (error) {
      console.error('[Loan-Sync] Error syncing loans:', error.message);
    }
  }

  async syncLoans() {
    const loans = await this.fetchSimulatorLoans();
    const synced: any[] = [];
    const failed: any[] = [];

    for (const simLoan of loans) {
      try {
        // Buscar cliente pelo phoneNumber
        const customer = await this.prisma.customer.findUnique({
          where: { phoneNumber: simLoan.phoneNumber },
        });

        if (!customer) {
          failed.push({
            id: simLoan.id,
            phoneNumber: simLoan.phoneNumber,
            error: 'Cliente não encontrado no PayJA',
          });
          continue;
        }

        const existing = await this.prisma.loan.findUnique({
          where: { id: simLoan.id },
        });

        // Calcular valores
        const totalAmount = simLoan.amount * (1 + simLoan.interest / 100);
        const termMonths = simLoan.term.includes('30') || simLoan.term.includes('mês') ? 1 : 12;
        const monthlyPayment = totalAmount / termMonths;

        const loanData = {
          customerId: customer.id,
          amount: simLoan.amount,
          interestRate: simLoan.interest || 15,
          termMonths,
          purpose: simLoan.reason || 'N/A',
          bankCode: simLoan.bank ? simLoan.bank.replace('Banco ', '').substring(0, 3) : null,
          bankName: simLoan.bank || null,
          channel: 'MOVITEL',
          totalAmount,
          monthlyPayment,
          status: this.mapSimulatorStatus(simLoan.status),
        };

        if (existing) {
          // Update existing loan
          const updated = await this.prisma.loan.update({
            where: { id: simLoan.id },
            data: {
              ...loanData,
              updatedAt: new Date(),
            },
          });
          synced.push({
            id: simLoan.id,
            phoneNumber: simLoan.phoneNumber,
            status: 'updated',
          });
        } else {
          // Create new loan
          const created = await this.prisma.loan.create({
            data: {
              id: simLoan.id,
              ...loanData,
              createdAt: new Date(simLoan.createdAt),
              updatedAt: new Date(simLoan.updatedAt),
            },
          });
          synced.push({
            id: simLoan.id,
            phoneNumber: simLoan.phoneNumber,
            status: 'created',
          });
        }
      } catch (err) {
        failed.push({
          id: simLoan.id,
          phoneNumber: simLoan.phoneNumber,
          error: String(err?.message || err),
        });
      }
    }

    return { syncedCount: synced.length, loans: synced, failed };
  }

  private mapSimulatorStatus(simStatus: string): string {
    // Mapear status do simulador para PayJA
    const key = String(simStatus || '').toUpperCase();
    const statusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'ENVIADO_PAYJA': 'PENDING',
      'APPROVED': 'APPROVED',
      'REJECTED': 'REJECTED',
      'DISBURSED': 'DISBURSED',
      'ACTIVE': 'ACTIVE',
      'COMPLETED': 'COMPLETED',
    };
    return statusMap[key] || 'PENDING';
  }



  async validateAndUpdateCustomer(phoneNumber: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phoneNumber } });
    if (!customer) {
      return { success: false, error: 'Cliente não encontrado no PayJA' };
    }
    // Buscar no banco mock usando nuit, bi e instituição
    const bankData = await this.validateWithBankByCustomer({
      nuit: customer.nuit,
      biNumber: customer.biNumber,
      salaryBank: customer.salaryBank,
      phoneNumber: customer.phoneNumber,
    });
    if (!bankData) {
      return { success: false, error: 'Cliente não encontrado no banco' };
    }

    // Comparar dados do cliente USSD com banco
    const isValid = await this.validateCustomerData(
      {
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        nuit: customer.nuit,
        biNumber: customer.biNumber,
        bi: customer.biNumber,
        institution: customer.salaryBank,
      },
      bankData
    );

    if (!isValid) {
      return { 
        success: false, 
        error: 'Dados não correspondem. NUIT e BI devem ser iguais aos registados no banco.' 
      };
    }

    // Validação sucesso - atualizar cliente com dados do banco
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: bankData.nome_completo || customer.name,
        nuit: bankData.nuit || customer.nuit,
        biNumber: bankData.bi || customer.biNumber,
        creditScore: bankData.score_credito ?? customer['creditScore' as any],
        email: bankData.email || null,
        salary: bankData.salario ?? customer.salary ?? 0,
        salaryBank: bankData.empregador || null,
        creditLimit: bankData.limite_credito || 0,
        verified: true,
      },
    });

    // Notificar simulador para marcar como verificado
    try {
      const cfg = this.getConfig();
      const markUrl = new URL('/api/payja/ussd/mark-verified', cfg.simulatorBaseUrl).toString();
      await firstValueFrom(
        this.http.post(markUrl, {
          phoneNumber,
          creditLimit: updated.creditLimit,
        })
      );
    } catch (notifyErr) {
      console.error('[PayJA Sync] Falha ao notificar simulador para marcar verificado:', notifyErr?.message || notifyErr);
    }

    // Envia elegibilidade para o simulador
    await this.postEligibility(
      { phoneNumber, name: updated.name },
      updated.creditLimit,
      true,
      'Cliente verificado e validado'
    );

    return { 
      success: true, 
      customer: {
        id: updated.id,
        phoneNumber: updated.phoneNumber,
        name: updated.name,
        nuit: updated.nuit,
        verified: updated.verified,
        creditLimit: updated.creditLimit,
        email: updated.email,
        salary: updated.salary,
        salaryBank: updated.salaryBank,
      }
    };
  }

  async getCustomerStatus(phoneNumber: string) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { phoneNumber },
        select: {
          phoneNumber: true,
          verified: true,
          creditLimit: true,
          creditScore: true,
          email: true,
          salaryBank: true,
        },
      });

      if (!customer) {
        return { success: false, error: 'Cliente não encontrado' };
      }

      return {
        success: true,
        phoneNumber: customer.phoneNumber,
        verified: customer.verified,
        creditLimit: customer.creditLimit,
        creditScore: customer.creditScore,
        email: customer.email,
        salaryBank: customer.salaryBank,
      };
    } catch (error) {
      console.error('Erro ao buscar status do cliente:', error);
      return { success: false, error: 'Erro ao buscar status do cliente' };
    }
  }

  async getLoans() {
    try {
      const loans = await this.prisma.loan.findMany({
        include: {
          customer: {
            select: {
              name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Map to include customerName in the response
      return loans.map(loan => ({
        ...loan,
        customerName: loan.customer?.name || null,
        phoneNumber: loan.customer?.phoneNumber || null,
      }));
    } catch (error) {
      console.error('Erro ao buscar empréstimos:', error);
      return [];
    }
  }

  async confirmDisbursal(loanId: string, disbursalData: any) {
    try {
      console.log(`[Confirm Disbursal] Confirmando desembolso do loan ${loanId}`);

      // Buscar loan
      const loan = await this.prisma.loan.findUnique({
        where: { id: loanId },
      });

      if (!loan) {
        return { 
          success: false, 
          error: 'Empréstimo não encontrado' 
        };
      }

      // Atualizar status do loan para DISBURSED
      const updated = await this.prisma.loan.update({
        where: { id: loanId },
        data: {
          status: 'DISBURSED',
          disbursedAt: new Date(),
        },
      });

      console.log(`[Confirm Disbursal] Loan ${loanId} atualizado para DISBURSED`);

      // Notificar simulador sobre status atualizado
      try {
        const cfg = this.getConfig();
        const updateUrl = new URL(`/api/loans/${loanId}/status`, cfg.simulatorBaseUrl).toString();
        await firstValueFrom(
          this.http.patch(updateUrl, {
            status: 'DISBURSED',
            disbursedAt: new Date().toISOString(),
          })
        );
        console.log(`[Confirm Disbursal] Simulador notificado`);
      } catch (notifyErr) {
        console.error('[Confirm Disbursal] Erro ao notificar simulador:', notifyErr?.message || notifyErr);
      }

      return {
        success: true,
        message: 'Desembolso confirmado com sucesso',
        loan: {
          id: updated.id,
          status: updated.status,
          amount: updated.amount,
          disbursedAt: updated.disbursedAt,
        },
      };
    } catch (error) {
      console.error('[Confirm Disbursal] Erro:', error);
      return {
        success: false,
        error: error.message || 'Erro ao confirmar desembolso',
      };
    }
  }
}
