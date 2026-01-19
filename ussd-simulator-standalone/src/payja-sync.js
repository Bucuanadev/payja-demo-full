const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class PayjaSync {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      this.db = await open({
        filename: './payja-customers.sqlite',
        driver: sqlite3.Database
      });
      await this.ensureTable();
      this.initialized = true;
      console.log('✅ PayjaSync inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar PayjaSync:', error);
      throw error;
    }
  }

  async ensureTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        msisdn TEXT NOT NULL UNIQUE,
        firstName TEXT,
        lastName TEXT,
        creditScore TEXT,
        nuit TEXT,
        biNumber TEXT,
        email TEXT,
        accountNumber TEXT,
        accountType TEXT,
        balance REAL DEFAULT 0,
        customerLimit REAL DEFAULT 0,
        isActive INTEGER DEFAULT 0,
        hasCredit INTEGER DEFAULT 0,
        userId INTEGER,
        status TEXT DEFAULT 'unknown',
        salaryBank TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      )
    `;
    await this.db.run(sql);
  }

  mapPayjaToCustomer(payjaData) {
    let firstName = '';
    let lastName = '';
    if (payjaData.name) {
      const nameParts = payjaData.name.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    let createdAt = Date.now();
    let updatedAt = Date.now();
    if (payjaData.createdAt) {
      const date = new Date(payjaData.createdAt);
      createdAt = isNaN(date.getTime()) ? Date.now() : date.getTime();
    }
    if (payjaData.updatedAt) {
      const date = new Date(payjaData.updatedAt);
      updatedAt = isNaN(date.getTime()) ? Date.now() : date.getTime();
    }
    return {
      id: parseInt(payjaData.phoneNumber, 10),
      msisdn: payjaData.phoneNumber || '',
      firstName: firstName,
      lastName: lastName,
      creditScore: payjaData.creditScore !== undefined ? String(payjaData.creditScore) : null,
      nuit: payjaData.nuit || null,
      biNumber: payjaData.biNumber || null,
      email: payjaData.email || null,
      accountNumber: payjaData.accountNumber || null,
      accountType: payjaData.accountType || null,
      balance: parseFloat(payjaData.salary) || 0,
      customerLimit: parseFloat(payjaData.creditLimit) || 0,
      isActive: payjaData.verified === 1 ? 1 : 0,
      hasCredit: (parseFloat(payjaData.creditLimit) || 0) > 0 ? 1 : 0,
      userId: null,
      status: payjaData.status || 'unknown',
      salaryBank: payjaData.salaryBank || null,
      createdAt: createdAt,
      updatedAt: updatedAt
    };
  }

  async safeInsertCustomer(customer) {
    try {
      console.log(`\n📥 Inserindo cliente: ${customer.id} (${customer.msisdn})`);
      const params = [
        customer.id,
        customer.msisdn,
        customer.firstName || '',
        customer.lastName || '',
        customer.creditScore,
        customer.nuit,
        customer.biNumber,
        customer.email,
        customer.accountNumber,
        customer.accountType,
        customer.balance,
        customer.customerLimit,
        customer.isActive,
        customer.hasCredit,
        customer.userId,
        customer.status,
        customer.salaryBank,
        customer.createdAt,
        customer.updatedAt
      ];
      const sql = `
        INSERT OR REPLACE INTO customers 
        (id, msisdn, firstName, lastName, creditScore, 
         nuit, biNumber, email, accountNumber, accountType,
         balance, customerLimit, isActive, hasCredit, userId,
         status, salaryBank, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.run(sql, params);
      console.log(`✅ Cliente ${customer.msisdn} sincronizado com sucesso`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao inserir cliente ${customer.msisdn}:`, error.message);
      if (error.message.includes('SQLITE_MISMATCH')) {
        console.error('🔍 DEBUG SQLITE_MISMATCH:');
        console.error('Customer data:', customer);
        console.error('Params types:', params.map(p => typeof p));
      }
      throw error;
    }
  }

  async sync() {
    if (!this.initialized) {
      await this.init();
    }
    try {
      console.log('[PayjaSync] Buscando clientes do PayJA...');
      const response = await fetch('http://155.138.227.26:3000/api/v1/integrations/ussd/customers');
      const apiData = await response.json();
      const payjaCustomers = Array.isArray(apiData.data) ? apiData.data : [];
      console.log(`[PayjaSync] ✓ Busquei ${payjaCustomers.length} clientes do PayJA`);
      let successCount = 0;
      let errorCount = 0;
      for (const payjaCustomer of payjaCustomers) {
        try {
          const localCustomer = this.mapPayjaToCustomer(payjaCustomer);
          console.log(`\n🔄 Mapeando: ${payjaCustomer.phoneNumber}`);
          console.log(`  Nome: ${payjaCustomer.name} → ${localCustomer.firstName} ${localCustomer.lastName}`);
          await this.safeInsertCustomer(localCustomer);
          successCount++;
        } catch (error) {
          console.error(`[PayjaSync] Erro ao sincronizar ${payjaCustomer.phoneNumber}:`, error.message);
          errorCount++;
        }
      }
      console.log(`\n[PayjaSync] ✅ Sincronização concluída: ${successCount} processados, ${errorCount} falhas`);
      return { success: successCount, errors: errorCount };
    } catch (error) {
      console.error('[PayjaSync] ❌ Erro na sincronização:', error.message);
      throw error;
    }
  }

  async listCustomers() {
    if (!this.initialized) await this.init();
    const customers = await this.db.all('SELECT id, msisdn, firstName, lastName, status FROM customers ORDER BY id');
    console.log(`\n📋 Clientes no banco (${customers.length}):`);
    customers.forEach(c => {
      console.log(`  ${c.id}: ${c.msisdn} - ${c.firstName} ${c.lastName} (${c.status})`);
    });
    return customers;
  }
}

const payjaSync = new PayjaSync();
module.exports = {
  PayjaSync,
  payjaSync
};
