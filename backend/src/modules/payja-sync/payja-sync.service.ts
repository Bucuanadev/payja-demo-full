import { Injectable, OnModuleInit } from '@nestjs/common';
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
export class PayjaSyncService implements OnModuleInit {
  constructor(private http: HttpService, private prisma: PrismaService) {}

  private getConfig(): PayjaConfig {
    const simulatorBaseUrl = process.env.USSD_SIM_BASE_URL || 'http://155.138.227.26:3001';
    const endpointNewCustomers = process.env.USSD_SIM_ENDPOINT_NEW || '/api/payja/ussd/new-customers';
    const endpointEligibility = process.env.USSD_SIM_ENDPOINT_ELIG || '/api/payja/ussd/eligibility';
    const endpointEligibilityBatch = process.env.USSD_SIM_ENDPOINT_ELIG_BATCH || '/api/payja/ussd/eligibility/batch';
    const endpointLoans = process.env.USSD_SIM_ENDPOINT_LOANS || '/api/loans';
    return { simulatorBaseUrl, endpointNewCustomers, endpointEligibility, endpointLoans, endpointEligibilityBatch } as any;
  }

  async onModuleInit() {
    try {
      // Disparar uma sincronização inicial ao subir o serviço
      const result = await this.syncBankClientes();
      if (result?.synced) {
        console.log(`[Bank-Sync] Inicial: ${result.synced} clientes processados`);
      }
    } catch (e) {
      console.error('[Bank-Sync] Erro na sincronização inicial:', (e as any)?.message || e);
    }
  }

  async fetchNewCustomers(): Promise<SimCustomer[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointNewCustomers, cfg.simulatorBaseUrl).toString();
    try {
      console.log(`[Customer Sync] requesting ${url}`);
      const resp = await firstValueFrom(this.http.get(url));
      const data = resp.data;
      // Support multiple response shapes: direct array, { customers: [...] }, { data: [...] }, { success: true, customers: [...] }
      if (Array.isArray(data)) {
        console.log(`[Customer Sync] fetched ${data.length} customers (array)`);
        return data as any;
      }
      if (Array.isArray(data?.customers)) {
        console.log(`[Customer Sync] fetched ${data.customers.length} customers (data.customers)`);
        return data.customers as any;
      }
      if (Array.isArray(data?.data)) {
        console.log(`[Customer Sync] fetched ${data.data.length} customers (data.data)`);
        return data.data as any;
      }
      console.log('[Customer Sync] fetched 0 customers (no recognized shape)');
      return [];
    } catch (error) {
      console.error('[Customer Sync] Erro ao buscar novos clientes do simulador:', error?.message || error);
      return [];
    }
  }

  async fetchSimulatorLoans(): Promise<SimLoan[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointLoans, cfg.simulatorBaseUrl).toString();
    try {
      const resp = await firstValueFrom(this.http.get(url));
      const data = resp.data;
      // Support multiple response shapes from simulator: direct array, { loans: [...] }, { data: [...] }, { success: true, loans: [...] }
      if (Array.isArray(data)) {
        console.log(`[Loan Sync] fetched ${data.length} loans (array)`);
        return data as any;
      }
      if (Array.isArray(data?.loans)) {
        console.log(`[Loan Sync] fetched ${data.loans.length} loans (data.loans)`);
        return data.loans as any;
      }
      if (Array.isArray(data?.data)) {
        console.log(`[Loan Sync] fetched ${data.data.length} loans (data.data)`);
        return data.data as any;
      }
      if (Array.isArray(data?.result)) {
        console.log(`[Loan Sync] fetched ${data.result.length} loans (data.result)`);
        return data.result as any;
      }
      console.log('[Loan Sync] fetched 0 loans (no recognized shape)');
      return [];
    } catch (error) {
      console.error('[Loan Sync] Erro ao buscar empréstimos do simulador:', error?.message || error);
      return [];
    }
  }


  async validateWithBankByCustomer(
    customer: { nuit?: string | null; biNumber?: string | null; salaryBank?: string | null; phoneNumber?: string }
  ) {
    const bankBase = process.env.BANK_BASE_URL || 'http://155.138.227.26:4500';
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
    console.warn('[Customer Sync] Simulator->PayJA import is disabled in this deployment. Use bank sync instead.');
    return { synced: 0, importedCustomers: [], failed: [] };
  }

  // Push eligible customers (creditLimit > 0) to simulator in batch
  @Interval(15000)
  async pushEligiblesToSimulator() {
    try {
      const cfg: any = this.getConfig();
      const simulUrl = new URL(cfg.endpointEligibilityBatch || '/api/payja/ussd/eligibility/batch', cfg.simulatorBaseUrl).toString();

      // Find eligible customers in PayJA DB
      const eligibles = await this.prisma.customer.findMany({ where: { creditLimit: { gt: 0 } }, select: { phoneNumber: true, name: true, creditLimit: true, creditScore: true } });
      if (!eligibles || eligibles.length === 0) return;

      const payload = { customers: eligibles.map(c => ({ phoneNumber: c.phoneNumber, name: c.name, creditLimit: c.creditLimit, creditScore: c.creditScore })) };
      try {
        await firstValueFrom(this.http.post(simulUrl, payload));
        console.log(`[Push-Eligibles] Enviados ${eligibles.length} clientes elegíveis ao simulador`);
      } catch (err) {
        console.warn('[Push-Eligibles] Falha ao enviar elegíveis para simulador:', err?.message || err);
      }
    } catch (err) {
      console.error('[Push-Eligibles] Erro interno:', err?.message || err);
    }
  }

  async syncBankClientes() {
    const importedCustomers: any[] = [];
    const failed: any[] = [];
    const removedCustomers: any[] = [];
    const bankBase = process.env.BANK_BASE_URL || 'http://155.138.227.26:4500';
    
    try {
      const resp = await firstValueFrom(this.http.get(`${bankBase}/api/clientes`));
      const clientes = (resp as any).data?.clientes || [];
      
      console.log(`[Bank-Sync] Sincronizando ${clientes.length} clientes da Gestão de Clientes do banco`);

      for (const bankCliente of clientes) {
        try {
          // Buscar cliente existente pelo NUIT
          const existing = await this.prisma.customer.findFirst({
            where: {
              OR: [
                { nuit: bankCliente.nuit },
                { biNumber: bankCliente.bi },
                { phoneNumber: bankCliente.telefone }
              ]
            }
          });

          const data = {
            phoneNumber: bankCliente.telefone || `BANCO-${bankCliente.nuit}`,
            name: bankCliente.nome_completo,
            nuit: bankCliente.nuit,
            biNumber: bankCliente.bi,
            email: bankCliente.email || null,
            creditLimit: bankCliente.limite_credito || 0,
            creditScore: bankCliente.score_credito ?? null,
            salary: bankCliente.salario || null,
            salaryBank: bankCliente.empregador || null,
            verified: true, // Veio do banco, então é verificado
          } as any;

          if (existing) {
            const updated = await this.prisma.customer.update({
              where: { id: existing.id },
              data
            });
            importedCustomers.push({
              nuit: bankCliente.nuit,
              nome: bankCliente.nome_completo,
              status: 'atualizado',
              id: updated.id
            });
          } else {
            const created = await this.prisma.customer.create({ data });
            importedCustomers.push({
              nuit: bankCliente.nuit,
              nome: bankCliente.nome_completo,
              status: 'criado',
              id: created.id
            });
          }
        } catch (err) {
          failed.push({
            nuit: bankCliente.nuit,
            nome: bankCliente.nome_completo,
            error: String(err?.message || err)
          });
        }
      }

      // Remover clientes que não existem mais no banco (comparando NUIT/BI)
      const bankNuits = new Set<string>(clientes.filter((c: any) => c.nuit).map((c: any) => String(c.nuit)));
      const bankBis = new Set<string>(clientes.filter((c: any) => c.bi).map((c: any) => String(c.bi)));

      const deletable = await this.prisma.customer.findMany({
        where: {
          verified: true,
          OR: [
            { nuit: { not: null, notIn: Array.from(bankNuits) } },
            { biNumber: { not: null, notIn: Array.from(bankBis) } },
          ],
        },
        select: { id: true, phoneNumber: true, nuit: true, biNumber: true, name: true },
      });

      if (deletable.length > 0) {
        const nuitsToDelete = deletable.filter((c) => c.nuit).map((c) => String(c.nuit));
        const bisToDelete = deletable.filter((c) => c.biNumber).map((c) => String(c.biNumber));

        await this.prisma.customer.deleteMany({
          where: {
            OR: [
              { nuit: { in: nuitsToDelete } },
              { biNumber: { in: bisToDelete } },
            ],
          },
        });

        removedCustomers.push(
          ...deletable.map((c) => ({
            id: c.id,
            phoneNumber: c.phoneNumber,
            nuit: c.nuit,
            biNumber: c.biNumber,
            status: 'removido (não existe mais no banco)',
          }))
        );

        console.log(`[Bank-Sync] Removi ${deletable.length} clientes que saíram da Gestão de Clientes do banco`);
      }

      console.log(`[Bank-Sync] Sincronização concluída: ${importedCustomers.length} clientes processados`);
      return {
        synced: importedCustomers.length,
        importedCustomers,
        failed,
        removed: removedCustomers.length,
        removedCustomers,
      };
    } catch (error) {
      console.error('[Bank-Sync] Erro ao sincronizar clientes do banco:', error.message);
      return {
        synced: importedCustomers.length,
        importedCustomers,
        failed,
        removed: removedCustomers.length,
        removedCustomers,
        error: String(error?.message || error),
      };
    }
  }



  @Interval(15000) // Run every 15 seconds (banco sync)
  async autoSyncBankClientes() {
    try {
      const result = await this.syncBankClientes();
      if (result.synced > 0) {
        console.log(`[Bank-Sync] Synced ${result.synced} customers from bank`);
      }
    } catch (error) {
      console.error('[Bank-Sync] Error syncing customers from bank:', error.message);
    }
  }

  @Interval(15000) // Run every 15 seconds (loans sync)
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
    console.log(`[Loan-Sync] syncLoans: fetched ${loans.length} loans`);
    const synced: any[] = [];
    const failed: any[] = [];

    for (const simLoan of loans) {
      const loanId = String(simLoan.id);
      console.log(`[Loan-Sync] processing simLoan id=${loanId} phone=${simLoan.phoneNumber}`);
      try {
        // Buscar cliente pelo phoneNumber (tentar variantes: direto, com prefixo 258, +258, por últimos 9 dígitos)
        const rawPhone = String(simLoan.phoneNumber || '').replace(/[^0-9]/g, '');
        let customer = null as any;
        if (rawPhone) {
          // direct match
          customer = await this.prisma.customer.findUnique({ where: { phoneNumber: rawPhone } }).catch(() => null);
          // try with country code
          if (!customer) {
            const with258 = rawPhone.startsWith('258') ? rawPhone : '258' + rawPhone;
            customer = await this.prisma.customer.findUnique({ where: { phoneNumber: with258 } }).catch(() => null);
          }
          if (!customer) {
            const withPlus = rawPhone.startsWith('+') ? rawPhone : '+258' + rawPhone.replace(/^\+?258/, '');
            customer = await this.prisma.customer.findUnique({ where: { phoneNumber: withPlus } }).catch(() => null);
          }
          // fallback: match by last 9 digits
          if (!customer) {
            const last9 = rawPhone.slice(-9);
            customer = await this.prisma.customer.findFirst({ where: { phoneNumber: { endsWith: last9 } } }).catch(() => null);
          }
        }

        if (!customer) {
          console.log(`[Loan-Sync] no matching customer found for phone=${simLoan.phoneNumber}`);
          failed.push({
            id: simLoan.id,
            phoneNumber: simLoan.phoneNumber,
            error: 'Cliente não encontrado no PayJA',
          });
          continue;
        }
        console.log(`[Loan-Sync] matched customer id=${customer.id} phone=${customer.phoneNumber}`);

        const existing = await this.prisma.loan.findUnique({
          where: { id: loanId },
        });

        // Calcular valores e normalizar campos do simulador
        let interestNum = 0;
        if (simLoan.interest !== undefined && simLoan.interest !== null) {
          interestNum = Number(simLoan.interest) || 0;
        } else if ((simLoan as any).interestPct) {
          interestNum = Number((simLoan as any).interestPct) || 0;
        }

        // Normalize term: could be number of years or a string like '4' or '48 meses' or '4 anos'
        let termYears = 0;
        if (typeof simLoan.term === 'number') termYears = simLoan.term as any;
        else if (typeof simLoan.term === 'string') {
          const t = simLoan.term.trim();
          const anosMatch = t.match(/(\d+)\s*anos?/i);
          const mesesMatch = t.match(/(\d+)\s*mes/i);
          if (anosMatch && anosMatch[1]) termYears = Number(anosMatch[1]);
          else if (mesesMatch && mesesMatch[1]) termYears = Math.ceil(Number(mesesMatch[1]) / 12);
          else {
            const n = Number(t);
            if (!isNaN(n)) termYears = n <= 10 ? n : Math.ceil(n / 12);
          }
        }

        const termMonths = Math.max(1, termYears * 12);
        const totalAmount = Number(simLoan.amount || 0) * (1 + (interestNum || 0) / 100);
        const monthlyPayment = simLoan['monthlyPayment'] ? Number(simLoan['monthlyPayment']) : Math.round(totalAmount / termMonths);

        const loanData = {
          customerId: customer.id,
          amount: Number(simLoan.amount || 0),
          interestRate: interestNum || 0,
          termMonths,
          purpose: simLoan.reason || 'N/A',
          bankCode: simLoan.bank ? String(simLoan.bank).replace('Banco ', '').substring(0, 3) : null,
          bankName: simLoan.bank || null,
          channel: 'USSD',
          totalAmount,
          monthlyPayment,
          status: this.mapSimulatorStatus(simLoan.status),
        } as any;

        if (existing) {
          // Update existing loan
          const updated = await this.prisma.loan.update({
            where: { id: loanId },
            data: {
              ...loanData,
              updatedAt: new Date(),
            },
          });
          synced.push({
            id: loanId,
            phoneNumber: simLoan.phoneNumber,
            status: 'updated',
          });
        } else {
          // Create new loan
          const created = await this.prisma.loan.create({
            data: {
              id: loanId,
              ...loanData,
              createdAt: new Date(simLoan.createdAt),
              updatedAt: new Date(simLoan.updatedAt),
            },
          });
          synced.push({
            id: loanId,
            phoneNumber: simLoan.phoneNumber,
            status: 'created',
          });
        }
      } catch (err) {
        failed.push({
          id: loanId,
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
