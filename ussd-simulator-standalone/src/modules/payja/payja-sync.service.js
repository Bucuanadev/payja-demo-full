// Função para debug completo dos tipos de dados do cliente
async function debugCustomerTypes(customer) {
  console.log('\n🔍 DEBUG COMPLETO - TIPOS DE DADOS');
  console.log('ID do cliente:', customer.id);
  const typeAnalysis = {};
  for (const [key, value] of Object.entries(customer)) {
    typeAnalysis[key] = {
      valor: value,
      tipo: typeof value,
      valorJSON: JSON.stringify(value),
      isNull: value === null,
      isUndefined: value === undefined,
      asNumber: Number(value),
      asString: String(value),
      isNaN: isNaN(Number(value))
    };
  }
  console.table(typeAnalysis);
  // Verificar campos específicos problemáticos
  const problematicFields = [];
  for (const [key, data] of Object.entries(typeAnalysis)) {
    if (data.isNaN && data.tipo === 'string' && data.valor !== null && data.valor !== undefined) {
      problematicFields.push({ campo: key, ...data });
    }
  }
  if (problematicFields.length > 0) {
    console.log('⚠️ CAMPOS POTENCIALMENTE PROBLEMÁTICOS:');
    console.table(problematicFields);
  }
}
// Função para normalizar tipos de dados dos clientes
function normalizeCustomerData(customer) {
  const normalized = { ...customer };
  // Campos que devem ser números
  const numericFields = [
    'salary', 'creditLimit', 'verified', 'createdAt', 'updatedAt'
  ];
  numericFields.forEach(field => {
    if (normalized[field] !== undefined && normalized[field] !== null) {
      const numValue = Number(normalized[field]);
      if (!isNaN(numValue)) {
        normalized[field] = numValue;
      }
    }
  });
  // creditScore deve ser STRING (conforme schema da tabela)
  if (normalized.creditScore !== undefined && normalized.creditScore !== null) {
    normalized.creditScore = String(normalized.creditScore);
  }
  // Campos booleanos
  const booleanFields = ['isActive', 'hasCredit'];
  booleanFields.forEach(field => {
    if (normalized[field] !== undefined) {
      normalized[field] = Boolean(normalized[field]);
    }
  });
  return normalized;
}
import axios from 'axios';
import { randomUUID } from 'crypto';

export class PayjaSyncService {
  constructor(db, baseUrl = process.env.PAYJA_API_URL || 'http://104.207.142.188:3000') {
    this.db = db;
    this.baseUrl = baseUrl;
    this.apiKey = process.env.PAYJA_API_KEY;
  }

  /**
   * Busca todos os clientes do PayJA sync API (endpoint público para simulador)
   */
  async fetchPayjaCustomers() {
    try {
      // Usar endpoint público local do PayJA exposto pelo módulo integrations/ussd
      const url = `${this.baseUrl}/api/v1/integrations/ussd/customers`;

      console.log(`[PayjaSync] Fetching from: ${url}`);
      const response = await axios.get(url, { timeout: 30000 });

      // Resposta esperada: { count: N, data: [...] }
      if (Array.isArray(response.data?.data)) {
        console.log(`[PayjaSync] ✓ Busquei ${response.data.count} clientes do PayJA`);
        return response.data.data;
      }

      console.warn('[PayjaSync] Resposta inesperada:', response.data);
      return [];
    } catch (error) {
      console.error('[PayjaSync] Erro ao buscar clientes do PayJA:', error.message);
      if (error.response) {
        console.error('[PayjaSync] Status:', error.response.status, error.response.statusText);
      }
      return [];
    }
  }

  /**
   * Sincroniza clientes do PayJA para o DB local do simulador
   */
  async syncPayjaCustomers() {
    try {
      const payjaCustomers = await this.fetchPayjaCustomers();

      if (payjaCustomers.length === 0) {
        console.log('[PayjaSync] Nenhum cliente para sincronizar');
        return { synced: 0, updated: 0, failed: 0 };
      }

      let synced = 0;
      let updated = 0;
      let failed = 0;

      for (const customer of payjaCustomers) {
        try {
          const existing = await this.db.get(
            'SELECT id FROM customers WHERE phoneNumber = ?',
            [customer.phoneNumber]
          );

          // Normaliza os dados do cliente para garantir tipos compatíveis
          const data = normalizeCustomerData({
            phoneNumber: customer.phoneNumber,
            nuit: customer.nuit || null,
            name: customer.name || 'Sem nome',
            biNumber: customer.biNumber || null,
            email: customer.email || null,
            accountNumber: customer.accountNumber || null,
            accountType: customer.accountType || null,
            salary: customer.salary || 0,
            creditLimit: customer.creditLimit || 0,
            creditScore: customer.creditScore,
            salaryBank: customer.salaryBank || null,
            verified: customer.verified ? 1 : 0,
            status: customer.verified ? 'verified' : (customer.status || 'active'),
            updatedAt: new Date().toISOString(),
          });
          await debugCustomerTypes(data);

          if (existing) {
            // Atualizar cliente existente
            await this.db.run(
              `UPDATE customers 
               SET nuit = ?, name = ?, biNumber = ?, email = ?, accountNumber = ?, accountType = ?,
                   salary = ?, creditLimit = ?, salaryBank = ?, verified = ?, updatedAt = ?
               WHERE phoneNumber = ?`,
              [
                data.nuit,
                data.name,
                data.biNumber,
                data.email,
                data.accountNumber,
                data.accountType,
                data.salary,
                data.creditLimit,
                data.salaryBank,
                data.verified,
                data.updatedAt,
                customer.phoneNumber,
              ]
            );
            updated++;
          } else {
            // Caso não exista pelo telefone, tentar reconciliar por NUIT (único)
            let existingByNuit = null;
            if (data.nuit) {
              existingByNuit = await this.db.get('SELECT id, phoneNumber FROM customers WHERE nuit = ?', [data.nuit]);
            }

            if (existingByNuit) {
              // Atualizar registro existente (mesmo cliente com telefone diferente)
              await this.db.run(
                `UPDATE customers 
                 SET phoneNumber = ?, name = ?, biNumber = ?, email = ?, accountNumber = ?, accountType = ?,
                     salary = ?, creditLimit = ?, salaryBank = ?, verified = ?, status = ?, updatedAt = ?
                 WHERE id = ?`,
                [
                  customer.phoneNumber,
                  data.name,
                  data.biNumber,
                  data.email,
                  data.accountNumber,
                  data.accountType,
                  data.salary,
                  data.creditLimit,
                  data.salaryBank,
                  data.verified,
                  data.status,
                  data.updatedAt,
                  existingByNuit.id,
                ]
              );
              updated++;
              continue;
            }

            // Inserir novo cliente usando função segura
            if (typeof safeInsertCustomer !== 'function') {
              // Importa dinamicamente se não estiver disponível
              const mod = await import('../../../src/main.js');
              const sic = mod.safeInsertCustomer || (mod.default && mod.default.safeInsertCustomer);
              global.safeInsertCustomer = sic;
            }
            await safeInsertCustomer(this.db, {
              phoneNumber: customer.phoneNumber,
              nuit: data.nuit,
              name: data.name,
              biNumber: data.biNumber,
              email: data.email,
              accountNumber: data.accountNumber,
              accountType: data.accountType,
              salary: data.salary,
              creditLimit: data.creditLimit,
              salaryBank: data.salaryBank,
              verified: data.verified,
              status: data.status,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              creditScore: data.creditScore
            });
            synced++;
          }
        } catch (err) {
          console.error(`[PayjaSync] Erro ao sincronizar ${customer.phoneNumber}:`, err.message);
          failed++;
        }
      }

      console.log(`[PayjaSync] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${failed} falhados`);
      return { synced, updated, failed };
    } catch (error) {
      console.error('[PayjaSync] Erro durante sincronização:', error.message);
      return { synced: 0, updated: 0, failed: 0 };
    }
  }

  /**
   * Começa sincronização periódica
   */
  startPeriodicSync(intervalMs = 60000) {
    // Sincroniza a cada 1 minuto por padrão
    console.log(`[PayjaSync] Iniciando sincronização periódica a cada ${intervalMs / 1000}s`);
    setInterval(() => this.syncPayjaCustomers(), intervalMs);
    // Sincroniza logo na startup
    this.syncPayjaCustomers();
  }
}
