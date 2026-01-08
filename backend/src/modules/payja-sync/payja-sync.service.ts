import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Interval } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma.service';
import * as fs from 'fs';
import * as path from 'path';

interface SimCustomer {
  phoneNumber?: string;  // PayJA format
  msisdn?: string;       // Simulator format
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

  private ensureLogsDir() {
    const dir = path.join(__dirname, '../../../logs');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore
    }
    return dir;
  }

  private logMismatch(phone: string, simCustomer: any, bankData: any, reasons: string[], extra?: any) {
    try {
      const dir = this.ensureLogsDir();
      const file = path.join(dir, 'mismatch.log');
      const entry = { ts: new Date().toISOString(), phone, simCustomer, bankData, reasons, extra };
      fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    } catch (e) {
      console.warn('[PayJA Sync] Failed to write mismatch log:', e?.message || e);
    }
  }

  private getConfig(): PayjaConfig {
    // Support both legacy env names and new ones
    const simulatorBaseUrl = process.env.USSD_SIMULATOR_URL || process.env.USSD_SIM_BASE_URL || 'http://155.138.228.89:3001';
    const endpointNewCustomers = process.env.USSD_API_ENDPOINT || process.env.USSD_SIM_ENDPOINT_NEW || '/api/payja/ussd/new-customers';
    const endpointEligibility = process.env.USSD_SIM_ENDPOINT_ELIG || '/api/payja/ussd/eligibility';
    const endpointLoans = process.env.USSD_SIM_ENDPOINT_LOANS || '/api/loans';
    return { simulatorBaseUrl, endpointNewCustomers, endpointEligibility, endpointLoans };
  }

  async fetchNewCustomers(): Promise<SimCustomer[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointNewCustomers, cfg.simulatorBaseUrl).toString();
    try {
      const resp = await firstValueFrom(this.http.get(url, { timeout: 10000 }));
      const data = resp.data;
      try {
        const shape = Array.isArray(data) ? 'array' : (Array.isArray(data?.data) ? 'wrapped' : 'unknown');
        const count = Array.isArray(data) ? data.length : (Array.isArray(data?.data) ? data.data.length : 0);
        console.log(`[PayJA Sync] fetchNewCustomers url=${url} shape=${shape} count=${count}`);
      } catch (e) {
        // ignore logging errors
      }
      if (Array.isArray(data)) return data as SimCustomer[];
      return Array.isArray(data?.data) ? data.data : [];
    } catch (err) {
      console.warn(`[PayJA Sync] fetchNewCustomers failed url=${url} error=${String(err?.message || err)}`);
      return [];
    }
  }

  async fetchSimulatorLoans(): Promise<SimLoan[]> {
    const cfg = this.getConfig();
    const url = new URL(cfg.endpointLoans, cfg.simulatorBaseUrl).toString();
    try {
      const resp = await firstValueFrom(this.http.get(url));
      const data = resp.data;
      if (Array.isArray(data)) return data as SimLoan[];
      return Array.isArray(data?.data) ? data.data : [];
    } catch (error) {
      console.error('[Loan Sync] Erro ao buscar empréstimos do simulador:', error.message);
      return [];
    }
  }


  async validateWithBankByCustomer(
    customer: { nuit?: string | null; biNumber?: string | null; salaryBank?: string | null; phoneNumber?: string; name?: string }
  ) {
    const bankBase = process.env.BANK_BASE_URL || 'http://155.138.228.89:4500';
    try {
      const resp = await firstValueFrom(this.http.get(`${bankBase}/api/clientes`));
      const clientes = (resp as any).data?.clientes || [];
      // Try several matching strategies (best-effort):
      // 1) exact nuit + bi + empregador
      // 2) exact nuit
      // 3) exact bi
      // 4) normalized full name exact
      const normalize = (s: any) => (s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, '') : '');

      const byAll = clientes.find((c: any) => {
        const nuitMatch = customer.nuit && c.nuit && String(customer.nuit).trim() === String(c.nuit).trim();
        const biMatch = customer.biNumber && c.bi && String(customer.biNumber).trim() === String(c.bi).trim();
        const institutionMatch = customer.salaryBank && c.empregador &&
          String(customer.salaryBank).toLowerCase().trim() === String(c.empregador).toLowerCase().trim();
        return nuitMatch && biMatch && institutionMatch;
      });
      if (byAll) return { match: byAll, matchType: 'nuit+bi+institution' };

      const byNuit = clientes.find((c: any) => customer.nuit && c.nuit && String(customer.nuit).trim() === String(c.nuit).trim());
      if (byNuit) return { match: byNuit, matchType: 'nuit' };

      const byBi = clientes.find((c: any) => customer.biNumber && c.bi && String(customer.biNumber).trim() === String(c.bi).trim());
      if (byBi) return { match: byBi, matchType: 'bi' };

      // Try name match
      const byName = clientes.find((c: any) => {
        const n1 = normalize(c.nome_completo || c.nome || c.name);
        const n2 = normalize(customer['name'] || customer['phoneNumber'] || '');
        return n1 && n2 && n1 === n2;
      });
      if (byName) return { match: byName, matchType: 'name' };

      return null;
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
    // Handle both phoneNumber (PayJA) and msisdn (Simulator) field names
    const phone = sim.phoneNumber || sim.msisdn;
    if (!phone) {
      throw new Error('Customer must have phoneNumber or msisdn');
    }
    
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
    console.log(`[PayJA Sync] syncNewCustomers: received ${list.length} customers from simulator`);
    for (const c of list) {
      // Handle both field name formats
      const phone = c?.phoneNumber || c?.msisdn;
      console.log(`[PayJA Sync] Processing simulator customer phone=${phone} name=${c?.name || ''}`);
      try {
        // Normalize customer data to use phoneNumber
        const normalizedCustomer = {
          ...c,
          phoneNumber: phone,
        };
        
        // Importa cliente SEM validar no banco (fica como "Não verificado")
        const saved = await this.upsertCustomer(normalizedCustomer, null);
        console.log(`[PayJA Sync] Upserted customer phone=${phone} id=${saved.id} verified=${saved.verified}`);
        // Tenta validar imediatamente com o banco
        try {
          const validation = await this.validateAndUpdateCustomer(saved.phoneNumber);
          console.log(`[PayJA Sync] Validation result for phone=${phone}: success=${validation?.success} ${validation?.error ? ('error='+validation.error) : ''}`);
          importedCustomers.push({
            phoneNumber: phone,
            id: saved.id,
            status: validation?.success ? 'Verificado' : (saved.verified ? 'Verificado' : 'Não verificado'),
            validation
          });
        } catch (validationError) {
          console.warn(`[PayJA Sync] Validation threw for phone=${phone}: ${String(validationError?.message || validationError)}`);
          importedCustomers.push({
            phoneNumber: phone,
            id: saved.id,
            status: saved.verified ? 'Verificado' : 'Não verificado',
            validation: { success: false, error: String(validationError?.message || validationError) }
          });
        }
      } catch (err) {
        console.error(`[PayJA Sync] Failed to upsert customer phone=${phone}: ${String(err?.message || err)}`);
        failed.push({ phoneNumber: phone, error: String(err?.message || err) });
      }
      // After attempting import, try to mark customer as synced in simulator
      try {
        const cfg = this.getConfig();
        const markUrl = new URL(`/api/customers/${encodeURIComponent(phone)}/sync`, cfg.simulatorBaseUrl).toString();
        await firstValueFrom(this.http.post(markUrl, { sync_id: `payja_${Date.now()}`, sync_date: new Date().toISOString() }));
        // Optionally log
        console.log(`[PayJA Sync] Marked ${phone} as synced in simulator`);
      } catch (markErr) {
        // Non-fatal
        console.warn(`[PayJA Sync] Could not mark ${phone} as synced in simulator: ${String(markErr?.message || markErr)}`);
      }
    }
    return { synced: importedCustomers.length, importedCustomers, failed };
  }

  // Manual trigger wrapper used by admin controller
  async triggerManualSync(): Promise<{ success: boolean; message: string; synced: number }> {
    try {
      const res = await this.syncNewCustomers();
      return { success: true, message: `Synced ${res.synced} customers from USSD simulator`, synced: res.synced };
    } catch (e) {
      return { success: false, message: `Sync failed: ${String(e?.message || e)}`, synced: 0 };
    }
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

  // Provide a simple status object including simulator connectivity
  async getSyncStatus() {
    const cfg = this.getConfig();
    const candidates = ['/api/health', '/api/status', '/health', '/status'];
    for (const ep of candidates) {
      try {
        const url = new URL(ep, cfg.simulatorBaseUrl).toString();
        const resp = await firstValueFrom(this.http.get(url, { timeout: 5000 }));
        return { simulator_status: 'connected', simulator_url: cfg.simulatorBaseUrl, simulator_info: { endpoint: ep, data: resp.data }, last_sync: new Date().toISOString() };
      } catch (err) {
        // try next
      }
    }
    return { simulator_status: 'disconnected', simulator_url: cfg.simulatorBaseUrl, error: 'no health endpoint reachable', last_sync: null };
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

  // Reconcile all existing PayJA customers with bank records
  @Interval(60000) // run every 60 seconds
  async autoReconcileCustomers() {
    try {
      const result = await this.reconcileAllCustomers();
      if (result && result.updatedCount > 0) {
        console.log(`[Reconcile] Updated ${result.updatedCount} customers`);
      }
    } catch (error) {
      console.error('[Reconcile] Error reconciling customers:', error?.message || error);
    }
  }

  /**
   * Reconcile all customers in PayJA DB by querying the bank data and updating records
   * Returns summary of updates
   */
  async reconcileAllCustomers() {
    const pending = await this.prisma.customer.findMany({ where: { verified: false }, take: 200 });
    const updated: any[] = [];
    const failed: any[] = [];

    for (const c of pending) {
      try {
        const res = await this.validateAndUpdateCustomer(c.phoneNumber);
        if (res?.success) {
          updated.push({ phoneNumber: c.phoneNumber, id: c.id });
        } else {
          failed.push({ phoneNumber: c.phoneNumber, reason: res?.error || 'not matched' });
        }
      } catch (e) {
        failed.push({ phoneNumber: c.phoneNumber, error: String(e?.message || e) });
      }
    }

    return { total: pending.length, updatedCount: updated.length, updated, failed };
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
          // Guard against invalid date strings coming from simulator
          const safeCreatedAt = (() => {
            try {
              const d = new Date(simLoan.createdAt);
              return isNaN(d.getTime()) ? new Date() : d;
            } catch (_) {
              return new Date();
            }
          })();
          const safeUpdatedAt = (() => {
            try {
              const d = new Date(simLoan.updatedAt || simLoan.createdAt);
              return isNaN(d.getTime()) ? safeCreatedAt : d;
            } catch (_) {
              return safeCreatedAt;
            }
          })();

          const created = await this.prisma.loan.create({
              data: {
                id: simLoan.id,
                ...loanData,
                createdAt: safeCreatedAt,
                updatedAt: safeUpdatedAt,
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
    console.log(`[PayJA Sync] validateAndUpdateCustomer: checking phone=${phoneNumber} currentNuit=${customer.nuit} bi=${customer.biNumber}`);
    // Buscar no banco mock usando vários critérios
    const bankLookup = await this.validateWithBankByCustomer({
      nuit: customer.nuit,
      biNumber: customer.biNumber,
      salaryBank: customer.salaryBank,
      phoneNumber: customer.phoneNumber,
      name: customer.name,
    });
    console.log(`[PayJA Sync] Bank lookup for phone=${phoneNumber} result=${bankLookup ? JSON.stringify({ matchType: bankLookup.matchType || 'unknown', phone: bankLookup.match ? (bankLookup.match.phone || bankLookup.match.telefone || bankLookup.match.telefone_movel) : null }) : 'null'}`);
    if (!bankLookup) {
      return { success: false, error: 'Cliente não encontrado no banco' };
    }

    const bankData = bankLookup.match || bankLookup;
    const matchType = (bankLookup.matchType as any) || 'exact';

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

    // Accept if full validation passed or if we have a partial strong match
    // Also accept a name-based match or a telephone match (best-effort) to improve automation
    const partialAccept = ['nuit', 'bi', 'nuit+bi+institution', 'name'].includes(matchType);

    // If bankData contains a phone field and it matches the simulator phone, accept as well
    const bankPhone = bankData && (bankData.phone || bankData.telefone || bankData.phoneNumber || bankData.telefone_movel);
    const normalizeDigits = (s: any) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
    const bankPhoneDigits = normalizeDigits(bankPhone);
    const customerPhoneDigits = normalizeDigits(customer.phoneNumber || '');
    let phoneMatch = false;
    let phoneMatchType: string | null = null;
    if (bankPhoneDigits && customerPhoneDigits) {
      if (bankPhoneDigits === customerPhoneDigits) {
        phoneMatch = true;
        phoneMatchType = 'exact';
      } else if (bankPhoneDigits.endsWith(customerPhoneDigits)) {
        // bank has country prefix, simulator provided suffix
        phoneMatch = true;
        phoneMatchType = 'suffix';
      } else if (customerPhoneDigits.endsWith(bankPhoneDigits)) {
        // simulator provided extra prefix (rare), still accept
        phoneMatch = true;
        phoneMatchType = 'customer_ends_with_bank';
      } else {
        // fallback: match last N digits (best-effort). N chosen to balance false positives.
        const MIN_MATCH = 7;
        if (bankPhoneDigits.slice(-MIN_MATCH) === customerPhoneDigits.slice(-MIN_MATCH)) {
          phoneMatch = true;
          phoneMatchType = `last${MIN_MATCH}`;
        }
      }
    }
    console.log(`[PayJA Sync] phone match phone=${customer.phoneNumber} bankPhone=${bankPhone} match=${phoneMatch} type=${phoneMatchType}`);

    if (!isValid && !partialAccept && !phoneMatch) {
      // Prepare detailed mismatch info and persist to logs for debugging
      const nuitMatch = !!(customer.nuit && bankData.nuit && String(customer.nuit).trim() === String(bankData.nuit).trim());
      const biMatch = !!((customer.biNumber || (customer as any).bi) && bankData.bi && String((customer.biNumber || (customer as any).bi)).trim() === String(bankData.bi).trim());
      const institutionMatch = !!(customer.salaryBank && bankData.empregador && String(customer.salaryBank).toLowerCase().trim() === String(bankData.empregador).toLowerCase().trim());
      const reasons: string[] = [];
      if (!nuitMatch) reasons.push('nuit_mismatch');
      if (!biMatch) reasons.push('bi_mismatch');
      if (!institutionMatch) reasons.push('institution_mismatch');
      if (!phoneMatch) reasons.push('phone_mismatch');

      const simCustomerForLog = {
        phoneNumber: customer.phoneNumber,
        name: customer.name,
        nuit: customer.nuit,
        biNumber: customer.biNumber,
        institution: customer.salaryBank,
      };

      // Persist mismatch log (appends JSON line to backend/logs/mismatch.log)
      try {
        this.logMismatch(phoneNumber, simCustomerForLog, bankData, reasons, { matchType, phoneMatchType, nuitMatch, biMatch, institutionMatch });
      } catch (e) {
        console.warn('[PayJA Sync] Could not persist mismatch log:', e?.message || e);
      }

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
    // Notificar simulador para marcar como verificado (com retries)
    try {
      const cfg = this.getConfig();
      const markUrl = new URL('/api/payja/ussd/mark-verified', cfg.simulatorBaseUrl).toString();
      const payload = {
        phoneNumber,
        creditLimit: updated.creditLimit,
        name: updated.name,
        nuit: updated.nuit,
        biNumber: updated.biNumber || null,
        email: updated.email || null,
        salary: updated.salary ?? null,
        salaryBank: updated.salaryBank || null,
        creditScore: updated.creditScore ?? null,
      };

      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const resp = await firstValueFrom(this.http.post(markUrl, payload));
          console.log(`[PayJA Sync] Simulador notificado (mark-verified) attempt=${attempt} status=${resp.status || 'unknown'}`);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`[PayJA Sync] Tentativa ${attempt} falhou ao notificar simulador: ${err?.message || err}`);
          // small backoff
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
      if (lastErr) {
        console.error('[PayJA Sync] Falha ao notificar simulador para marcar verificado (todas as tentativas):', lastErr?.message || lastErr);
      }
    } catch (notifyErr) {
      console.error('[PayJA Sync] Erro inesperado ao notificar simulador:', notifyErr?.message || notifyErr);
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
