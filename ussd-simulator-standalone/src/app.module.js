import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { initializeDatabase } from './database/init.js';
import { createUssdRouter } from './modules/ussd/ussd.routes.js';
import { createCustomerRouter } from './modules/customer/customer.routes.js';
import { createBankRouter } from './modules/bank/bank.routes.js';
import { createIntegrationRouter } from './modules/integration/integration.routes.js';
import { PayjaSyncService } from './modules/payja/payja-sync.service.js';

dotenv.config();

const prisma = new PrismaClient();

const app = express();
// Allow overriding port via CLI args: --port <number>
let PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    const p = Number(process.argv[i + 1]);
    if (!Number.isNaN(p) && p > 0) PORT = p;
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir frontend estatico
app.use(express.static('public'));

// Server-Sent Events clients
const sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const clientId = Date.now() + Math.random();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send a ping
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ msg: 'connected', time: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'USSD Simulator Standalone',
    timestamp: new Date().toISOString(),
  });
});

// Inicializar banco de dados
let db;
let server;

async function startServer() {
  try {
    console.log('Inicializando banco de dados...');
    db = await initializeDatabase();
    console.log('Banco de dados pronto');

    // Iniciar sincronização com PayJA
    console.log('Iniciando sincronização com PayJA...');
    const payjaSyncService = new PayjaSyncService(db);
    payjaSyncService.startPeriodicSync(60000); // Sincronizar a cada 1 minuto

    // Poll PayJA for verification updates and apply them locally every 15s
    async function pollPayjaForVerifications() {
      try {
        const pending = await db.all('SELECT phoneNumber FROM customers WHERE verified = 0');
        if (!pending || pending.length === 0) return;
        const base = process.env.PAYJA_BACKEND_URL || 'http://155.138.228.89:3000';
        for (const p of pending) {
          try {
            // PayJA exposes the customer-status endpoint under /api/v1/integrations/ussd
            const statusUrl = new URL(`/api/v1/integrations/ussd/customer-status/${encodeURIComponent(p.phoneNumber)}`, base).toString();
            const resp = await fetch(statusUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (!resp.ok) continue;
            const json = await resp.json();
            if (json && json.success && json.verified) {
              await db.run(
                `UPDATE customers SET verified = 1, status = 'verified', creditLimit = ?, creditScore = ?, email = ?, salaryBank = ?, updatedAt = CURRENT_TIMESTAMP WHERE phoneNumber = ?`,
                [typeof json.creditLimit === 'number' ? json.creditLimit : null, typeof json.creditScore === 'number' ? json.creditScore : null, json.email || null, json.salaryBank || null, p.phoneNumber]
              );
              console.log(`Poll: marcando ${p.phoneNumber} como verificado (via PayJA)`);
              const payload = { type: 'customer-verified', phoneNumber: p.phoneNumber, creditLimit: json.creditLimit, verified: true, name: json.name || null, nuit: json.nuit || null };
              sseClients.forEach(c => {
                try { c.res.write(`event: customer-verified\n`); c.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {}
              });
              try { sendConfirmationSms(p.phoneNumber, json.creditLimit); } catch (e) {}
            }
          } catch (e) {
            // ignore per-customer errors
          }
        }
      } catch (e) {
        console.error('PollPayJA error:', e?.message || e);
      }
    }

    // Start polling loop
    setInterval(pollPayjaForVerifications, 15000);

    // Routes
    const ussdRouter = createUssdRouter(db);
    const customerRouter = createCustomerRouter(db);
    const bankRouter = createBankRouter(db);
    const integrationRouter = createIntegrationRouter(db);

    app.use('/api/ussd', ussdRouter);
    app.use('/api/customers', customerRouter);
    app.use('/api/banks', bankRouter);
    app.use('/api/integration', integrationRouter);
    // Simple SMS sender (mock) and log
    const smsLogs = [];
    const recentSmsSentApp = new Map();
    const RECENT_SMS_TTL_APP = parseInt(process.env.RECENT_SMS_TTL_MS || '86400000', 10);
    function sendConfirmationSms(phoneNumber, creditLimit) {
      const message = `PayJA: Seu cadastro foi verificado. Limite de crédito: ${Math.round(Number(creditLimit || 0))} MZN.`;
      const key = String(phoneNumber) + '|confirmation';
      const now = Date.now();
      const last = recentSmsSentApp.get(key);
      if (last && (now - last) < RECENT_SMS_TTL_APP) {
        console.log(`[SMS-DEDUPE] (app.module) Skipping duplicate confirmation SMS to ${phoneNumber}`);
        return;
      }
      const log = { id: Date.now().toString(), phoneNumber, message, sentAt: new Date().toISOString(), provider: null, success: true };
      smsLogs.push(log);
      recentSmsSentApp.set(key, now);
      setTimeout(() => { try { recentSmsSentApp.delete(key); } catch(e){} }, RECENT_SMS_TTL_APP + 1000);
      console.log(`📲 SMS preparado para ${phoneNumber}: ${message}`);

      // If an external SMS provider is configured, try to send the message there as well
      const SMS_PROVIDER_URL = process.env.SMS_PROVIDER_URL || null;
      if (SMS_PROVIDER_URL) {
        (async () => {
          try {
            const resp = await fetch(SMS_PROVIDER_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: phoneNumber, message }),
            });
            log.provider = SMS_PROVIDER_URL;
            log.httpStatus = resp.status;
            log.success = resp.ok;
            console.log(`📲 SMS enviado via provider ${SMS_PROVIDER_URL} status=${resp.status} to=${phoneNumber}`);
          } catch (err) {
            log.provider = SMS_PROVIDER_URL;
            log.success = false;
            log.error = String(err?.message || err);
            console.error(`❌ Falha ao enviar SMS via provider: ${err?.message || err}`);
          }
        })();
      }
    }

    function sendLoanDisbursedSms(phoneNumber, amount, dueDate) {
      const dt = dueDate ? new Date(dueDate) : null;
      const dueStr = dt ? dt.toLocaleDateString('pt-MZ') : 'próximo ciclo salarial';
      const message = `PayJA: Seu empréstimo de ${Number(amount).toLocaleString('pt-MZ')} MZN foi desembolsado. Pagamento em ${dueStr}. O corte será feito automaticamente no seu salário.`;
      const log = { id: Date.now().toString(), phoneNumber, message, sentAt: new Date().toISOString() };
      smsLogs.push(log);
      console.log(`📲 SMS desembolso enviado para ${phoneNumber}: ${message}`);
    }

    function sendLoanApprovedSms(phoneNumber, amount) {
      const message = `PayJA: Seu empréstimo de ${Number(amount).toLocaleString('pt-MZ')} MZN foi aprovado. Será desembolsado em breve.`;
      const log = { id: Date.now().toString(), phoneNumber, message, sentAt: new Date().toISOString() };
      smsLogs.push(log);
      console.log(`📲 SMS aprovação enviado para ${phoneNumber}: ${message}`);
    }

    function sendLoanRejectedSms(phoneNumber, amount) {
      const message = `PayJA: Seu empréstimo de ${Number(amount).toLocaleString('pt-MZ')} MZN foi rejeitado. Contacte-nos para mais informações.`;
      const log = { id: Date.now().toString(), phoneNumber, message, sentAt: new Date().toISOString() };
      smsLogs.push(log);
      console.log(`📲 SMS rejeição enviado para ${phoneNumber}: ${message}`);
    }

    app.get('/api/sms/logs', (req, res) => {
      res.json({ count: smsLogs.length, data: smsLogs.slice(-100) });
    });

    // Endpoint to send a test/custom SMS (used to emulate sending to phone)
    app.post('/api/sms/send', async (req, res) => {
      try {
        const { phoneNumber, message } = req.body || {};
        if (!phoneNumber || !message) return res.status(400).json({ error: 'phoneNumber and message required' });
        // Use the same internal sender
        try { sendConfirmationSms(phoneNumber, 0 /* creditLimit not needed here */); } catch (e) { /* ignore */ }
        // Log a custom entry for the message
        const entry = { id: Date.now().toString(), phoneNumber, message, sentAt: new Date().toISOString(), provider: process.env.SMS_PROVIDER_URL || null };
        smsLogs.push(entry);
        return res.json({ success: true, entry });
      } catch (err) {
        console.error('Erro ao enviar SMS:', err);
        return res.status(500).json({ error: 'Erro ao enviar SMS' });
      }
    });

    // PayJA Integration Endpoints (inline)
    // Debug: expose customers table schema
    app.get('/api/debug/schema/customers', async (req, res) => {
      try {
        const info = await db.all(`PRAGMA table_info(customers)`);
        res.json({ success: true, columns: info });
      } catch (e) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
      }
    });

    app.get('/api/payja/ussd/new-customers', async (req, res) => {
      try {
        const customers = await db.all(
          `SELECT id, phoneNumber, nuit, name, biNumber, institution, verified, status, createdAt, updatedAt
           FROM customers WHERE status IN ('active','pending') ORDER BY createdAt DESC`
        );
        res.json({ count: customers.length, data: customers });
      } catch (error) {
        console.error('Erro ao listar novos clientes:', error);
        res.status(500).json({ error: 'Erro ao obter novos clientes' });
      }
    });

    app.post('/api/payja/ussd/eligibility', async (req, res) => {
      try {
        const { phoneNumber, limit, min, reason } = req.body || {};
        if (!phoneNumber || typeof limit === 'undefined') {
          return res.status(400).json({ error: 'phoneNumber e limit sao obrigatorios' });
        }
        const customer = await db.get(`SELECT * FROM customers WHERE phoneNumber = ?`, [phoneNumber]);
        if (!customer) return res.status(404).json({ error: 'Cliente nao encontrado' });
        await db.run(`UPDATE customers SET creditLimit = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [limit, customer.id]);
        res.json({ success: true, phoneNumber, limit, min: min || 0, reason: reason || null });
      } catch (error) {
        console.error('Erro ao aplicar elegibilidade:', error);
        res.status(500).json({ error: 'Erro ao aplicar elegibilidade' });
      }
    });

    // Marcar cliente como verificado (chamado pelo PayJA)
    app.post('/api/payja/ussd/mark-verified', async (req, res) => {
      try {
        const { phoneNumber, creditLimit, name, nuit, biNumber, email, salary, salaryBank, creditScore } = req.body || {};
        if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber é obrigatório' });

        const customer = await db.get(`SELECT * FROM customers WHERE phoneNumber = ?`, [phoneNumber]);
        if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });

        const updateStmt = `UPDATE customers SET name = ?, nuit = ?, biNumber = ?, email = ?, salary = ?, salaryBank = ?, creditScore = ?, verified = 1, status = 'verified', creditLimit = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        await db.run(updateStmt, [
          name || customer.name,
          nuit || customer.nuit,
          biNumber || customer.biNumber,
          email || customer.email,
          typeof salary === 'number' ? salary : customer.salary || null,
          salaryBank || customer.institution || customer.salaryBank || null,
          typeof creditScore === 'number' ? creditScore : customer.creditScore || null,
          typeof creditLimit === 'number' ? creditLimit : customer.creditLimit || 0,
          customer.id
        ]);

        const updated = await db.get(`SELECT * FROM customers WHERE id = ?`, [customer.id]);
        try { sendConfirmationSms(phoneNumber, updated.creditLimit); } catch {}
        console.log(`✓ Cliente marcado como verificado no simulador: ${phoneNumber}`);
        try {
          const payload = { type: 'customer-verified', phoneNumber: updated.phoneNumber, creditLimit: updated.creditLimit, verified: !!updated.verified, name: updated.name, nuit: updated.nuit };
          sseClients.forEach(c => {
            try { c.res.write(`event: customer-verified\n`); c.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {}
          });
        } catch (e) {}

        res.json({ success: true, customer: updated });
      } catch (error) {
        console.error('Erro ao marcar cliente como verificado:', error);
        res.status(500).json({ error: 'Erro ao marcar cliente como verificado' });
      }
    });

    // Register customer endpoint (for USSD frontend)
    app.post('/api/customers/register', async (req, res) => {
      try {
        const payload = req.body || {};
        try { console.log('[Register-ESM] incoming payload:', JSON.stringify(payload)); } catch (e) { console.log('[Register-ESM] incoming payload (unserializable)'); }

        let { phoneNumber, name, nuit, biNumber, institution } = payload || {};
        phoneNumber = phoneNumber ? String(phoneNumber).trim() : '';
        name = name ? String(name).trim() : '';
        if (!phoneNumber || !name) return res.status(400).json({ error: 'phoneNumber and name are required' });

        const crypto = await import('crypto');
        const id = crypto.randomUUID();

        // Ensure nuit present to avoid NOT NULL/UNIQUE issues in some schemas
        if (!nuit) nuit = `MISSING-${id}`;

        // Inspect table columns to build a compatible insert
        const pragma = await db.all(`PRAGMA table_info(customers)`);
        const cols = pragma.map(p => p.name);

        const insertCols = ['id'];
        const insertPlaceholders = ['?'];
        const insertParams = [id];

        if (cols.includes('phoneNumber')) { insertCols.push('phoneNumber'); insertPlaceholders.push('?'); insertParams.push(phoneNumber); }
        else if (cols.includes('msisdn')) { insertCols.push('msisdn'); insertPlaceholders.push('?'); insertParams.push(phoneNumber); }
        else if (cols.includes('phone')) { insertCols.push('phone'); insertPlaceholders.push('?'); insertParams.push(phoneNumber); }

        if (cols.includes('name')) { insertCols.push('name'); insertPlaceholders.push('?'); insertParams.push(name); }
        else if (cols.includes('fullName')) { insertCols.push('fullName'); insertPlaceholders.push('?'); insertParams.push(name); }
        else if (cols.includes('firstName') && cols.includes('lastName')) {
          const parts = name.split(' ');
          insertCols.push('firstName'); insertPlaceholders.push('?'); insertParams.push(parts.shift() || '');
          insertCols.push('lastName'); insertPlaceholders.push('?'); insertParams.push(parts.join(' ') || '');
        }

        if (cols.includes('nuit')) { insertCols.push('nuit'); insertPlaceholders.push('?'); insertParams.push(nuit); }
        if (cols.includes('biNumber')) { insertCols.push('biNumber'); insertPlaceholders.push('?'); insertParams.push(biNumber || null); }
        if (cols.includes('institution')) { insertCols.push('institution'); insertPlaceholders.push('?'); insertParams.push(institution || null); }
        if (cols.includes('verified')) { insertCols.push('verified'); insertPlaceholders.push('?'); insertParams.push(0); }
        if (cols.includes('status')) { insertCols.push('status'); insertPlaceholders.push('?'); insertParams.push('active'); }
        if (cols.includes('creditLimit')) { insertCols.push('creditLimit'); insertPlaceholders.push('?'); insertParams.push(0); }

        const insertSql = `INSERT INTO customers (${insertCols.join(',')}) VALUES (${insertPlaceholders.join(',')})`;

        try {
          await db.run(insertSql, insertParams);
        } catch (dbErr) {
          const msg = String(dbErr?.message || dbErr);
          console.error('[Register-ESM] DB error on insert:', msg);
          if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
            // Build WHERE using available phone columns to avoid querying non-existent columns
            const pragma2 = await db.all(`PRAGMA table_info(customers)`);
            const cols2 = pragma2.map(p => p.name);
            const phoneCols = ['phoneNumber','msisdn','phone'].filter(c => cols2.includes(c));
            if (phoneCols.length > 0) {
              const where = phoneCols.map(c => `${c} = ?`).join(' OR ');
              const params = phoneCols.map(() => phoneNumber);
              try {
                const existing = await db.get(`SELECT * FROM customers WHERE ${where}`, params);
                if (existing) return res.status(200).json({ success: true, customer: existing, note: 'existing' });
              } catch (e) {
                console.error('[Register-ESM] error fetching existing after UNIQUE failure:', e && e.message ? e.message : e);
              }
            }
            return res.status(409).json({ error: 'duplicate' });
          }
          console.error('[Register-ESM] unexpected DB error:', dbErr && dbErr.stack ? dbErr.stack : dbErr);
          return res.status(500).json({ error: 'Erro ao registar cliente' });
        }

        const customer = await db.get(`SELECT * FROM customers WHERE id = ?`, [id]);
        console.log(`✓ Customer registered: ${name} (${phoneNumber})`);
        res.status(201).json({ success: true, customer });
      } catch (error) {
        console.error('Erro ao registar cliente:', error && error.message ? error.message : error);
        res.status(500).json({ error: 'Erro ao registar cliente' });
      }
    });

    // Sync customers from localStorage (customers.html) to database
    const ConfigStore = require('./config-store.cjs');
    app.post('/api/customers/sync-from-localStorage', async (req, res) => {
      try {
        const { customers } = req.body || {};
        if (!Array.isArray(customers)) return res.status(400).json({ error: 'customers array is required' });

        const crypto = await import('crypto');
        const synced = [];
        const failed = [];

        for (const c of customers) {
          try {
            const existing = await db.get(`SELECT * FROM customers WHERE phoneNumber = ?`, [c.phoneNumber]);
            if (existing) {
              await db.run(`UPDATE customers SET name = ?, nuit = ?, institution = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [c.name || existing.name, c.nuit || existing.nuit, c.institution || existing.institution, existing.id]);
              synced.push({ phoneNumber: c.phoneNumber, status: 'updated', id: existing.id });
            } else {
              const id = crypto.randomUUID();
              await db.run(`INSERT INTO customers (id, phoneNumber, name, nuit, biNumber, institution, verified, status, creditLimit) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)`, [id, c.phoneNumber, c.name, c.nuit, c.biNumber || null, c.institution || null, c.verified ? 1 : 0]);
              synced.push({ phoneNumber: c.phoneNumber, status: 'created', id });
            }
          } catch (err) {
            failed.push({ phoneNumber: c.phoneNumber, error: String(err?.message || err) });
          }
        }

        console.log(`✓ Synced ${synced.length} customers from localStorage`);
        // Persist a copy of the simulator localStorage customers so configuration survives restarts
        try {
          const existingCfg = ConfigStore.loadConfig() || {};
          existingCfg.customers = existingCfg.customers || [];
          // merge/overwrite based on phoneNumber
          const merged = existingCfg.customers.slice();
          for (const c of customers) {
            const phone = String(c.phoneNumber || c.msisdn || '').trim();
            const idx = merged.findIndex(x => (String(x.phoneNumber||x.msisdn||'') === phone));
            if (idx !== -1) merged[idx] = { ...merged[idx], ...c };
            else merged.push(c);
          }
          existingCfg.customers = merged;
          ConfigStore.saveConfig(existingCfg);
        } catch (e) { console.warn('[Sync] could not persist config:', e && e.message ? e.message : e); }

        res.json({ synced: synced.length, synced: synced, failed });
      } catch (error) {
        console.error('Erro ao sincronizar clientes:', error);
        res.status(500).json({ error: 'Erro ao sincronizar clientes' });
      }
    });

    // Expose endpoints to read/save simulator config persistently
    app.get('/api/simulator-config', async (req, res) => {
      try {
        const ConfigStore = require('./config-store.cjs');
        const cfg = ConfigStore.loadConfig() || {};
        res.json(cfg);
      } catch (e) {
        res.status(500).json({ error: 'could not load config' });
      }
    });

    app.post('/api/simulator-config', async (req, res) => {
      try {
        const cfg = req.body || {};
        const ConfigStore = require('./config-store.cjs');
        const ok = ConfigStore.saveConfig(cfg);
        if (!ok) return res.status(500).json({ error: 'could not save config' });
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: 'could not save config' });
      }
    });

    // Import persisted localStorage customers from simulator-config.json into the DB
    app.post('/api/customers/import-persisted', async (req, res) => {
      try {
        const ConfigStore = require('./config-store.cjs');
        const cfg = ConfigStore.loadConfig() || {};
        const customers = Array.isArray(cfg.customers) ? cfg.customers : [];
        if (!customers.length) return res.json({ imported: 0, message: 'no persisted customers' });

        const imported = [];
        const updated = [];

        for (const c of customers) {
          try {
            const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
            if (!phone) continue;
            // detect phone column(s)
            const pragma = await db.all('PRAGMA table_info(customers)');
            const cols = pragma.map(p => p.name);
            const phoneCols = ['phoneNumber','msisdn','phone'].filter(x => cols.includes(x));

            let existing = null;
            if (phoneCols.length > 0) {
              const where = phoneCols.map(cn => `${cn} = ?`).join(' OR ');
              existing = await db.get(`SELECT * FROM customers WHERE ${where}`, phoneCols.map(() => phone));
            }

            if (existing) {
              await db.run('UPDATE customers SET name = ?, nuit = ?, biNumber = ?, verified = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [c.name || existing.name, c.nuit || existing.nuit, c.biNumber || existing.biNumber, c.verified ? 1 : existing.verified, c.status || existing.status || 'registered', existing.id]);
              updated.push(phone);
            } else {
              const insertCols = [];
              const insertPlaceholders = [];
              const insertParams = [];
              if (cols.includes('msisdn')) { insertCols.push('msisdn'); insertPlaceholders.push('?'); insertParams.push(phone); }
              if (cols.includes('phoneNumber') && !insertCols.includes('phoneNumber')) { insertCols.push('phoneNumber'); insertPlaceholders.push('?'); insertParams.push(phone); }
              if (cols.includes('phone') && !insertCols.includes('phone')) { insertCols.push('phone'); insertPlaceholders.push('?'); insertParams.push(phone); }
              if (cols.includes('name')) { insertCols.push('name'); insertPlaceholders.push('?'); insertParams.push(c.name || 'Cliente'); }
              if (cols.includes('nuit')) { insertCols.push('nuit'); insertPlaceholders.push('?'); insertParams.push(c.nuit || null); }
              if (cols.includes('biNumber')) { insertCols.push('biNumber'); insertPlaceholders.push('?'); insertParams.push(c.biNumber || null); }
              if (cols.includes('verified')) { insertCols.push('verified'); insertPlaceholders.push('?'); insertParams.push(c.verified ? 1 : 0); }
              if (cols.includes('status')) { insertCols.push('status'); insertPlaceholders.push('?'); insertParams.push(c.status || 'registered'); }
              if (cols.includes('createdAt')) { insertCols.push('createdAt'); insertPlaceholders.push('?'); insertParams.push(c.createdAt || new Date().toISOString()); }
              if (cols.includes('updatedAt')) { insertCols.push('updatedAt'); insertPlaceholders.push('?'); insertParams.push(c.updatedAt || new Date().toISOString()); }

              if (insertCols.length > 0) {
                const q = `INSERT INTO customers (${insertCols.join(',')}) VALUES (${insertPlaceholders.join(',')})`;
                await db.run(q, insertParams);
                imported.push(phone);
              }
            }
          } catch (e) {
            console.warn('[ImportPersisted] error importing customer', c, e && e.message ? e.message : e);
          }
        }

        res.json({ imported: imported.length, updated: updated.length, importedPhones: imported, updatedPhones: updated });
      } catch (e) {
        console.error('Erro ao importar persisted customers:', e && e.message ? e.message : e);
        res.status(500).json({ error: 'could not import persisted customers' });
      }
    });

    // Reset all customers data
    app.post('/api/customers/reset-all', async (req, res) => {
      try {
        const result = await db.run(`DELETE FROM customers`);
        console.log(`✓ Deleted customers from database`);
        res.json({ success: true, message: 'Todos os clientes foram apagados' });
      } catch (error) {
        console.error('Erro ao apagar clientes:', error);
        res.status(500).json({ error: 'Erro ao apagar clientes' });
      }
    });

    // Loans endpoints
    app.get('/api/loans', async (req, res) => {
      try {
        const rows = await db.all(`SELECT t.id, c.phoneNumber, t.amount, t.status, t.description, t.metadata, t.createdAt, t.updatedAt
                                    FROM transactions t LEFT JOIN customers c ON c.id = t.customerId
                                    WHERE t.type = 'loan' ORDER BY t.createdAt DESC`);

        const loans = rows.map(r => {
          let parsedDesc = {};
          try { parsedDesc = r.description ? JSON.parse(r.description) : {}; } catch (e) { parsedDesc = {}; }
          let meta = r.metadata;
          let parsedMeta = {};
          try { parsedMeta = meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : {}; } catch (e) { parsedMeta = { raw: meta }; }

          const reason = parsedMeta.reason || parsedDesc.reason || (typeof meta === 'string' ? meta : null) || null;

          return {
            id: r.id,
            phoneNumber: r.phoneNumber,
            amount: r.amount,
            status: r.status,
            description: r.description,
            metadata: r.metadata,
            reason,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          };
        });

        res.json({ count: loans.length, data: loans });
      } catch (error) {
        console.error('Erro ao listar empréstimos:', error);
        res.status(500).json({ error: 'Erro ao listar empréstimos' });
      }
    });

    // PayJA-friendly loans endpoint (same shape as /api/payja/ussd/new-customers)
    app.get('/api/payja/ussd/loans', async (req, res) => {
      try {
        const rows = await db.all(`SELECT t.id, c.phoneNumber, t.amount, t.status, t.description, t.metadata, t.createdAt, t.updatedAt
                                    FROM transactions t LEFT JOIN customers c ON c.id = t.customerId
                                    WHERE t.type = 'loan' ORDER BY t.createdAt DESC`);

        const loans = rows.map(r => {
          let parsedDesc = {};
          try { parsedDesc = r.description ? JSON.parse(r.description) : {}; } catch (e) { parsedDesc = {}; }
          let meta = r.metadata;
          let parsedMeta = {};
          try { parsedMeta = meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : {}; } catch (e) { parsedMeta = { raw: meta }; }

          const reason = parsedMeta.reason || parsedDesc.reason || (typeof meta === 'string' ? meta : null) || null;

          return {
            id: r.id,
            phoneNumber: r.phoneNumber,
            amount: r.amount,
            status: r.status,
            description: r.description,
            metadata: r.metadata,
            reason,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          };
        });

        res.json({ count: loans.length, data: loans });
      } catch (error) {
        console.error('Erro ao listar empréstimos (payja endpoint):', error);
        res.status(500).json({ error: 'Erro ao listar empréstimos' });
      }
    });

    app.post('/api/loans', async (req, res) => {
      try {
        const { phoneNumber, customerName, amount, term, interest, reason, bank, status } = req.body || {};
        if (!phoneNumber || !amount) return res.status(400).json({ error: 'phoneNumber e amount são obrigatórios' });

        const crypto = await import('crypto');
        const customer = await db.get(`SELECT * FROM customers WHERE phoneNumber = ?`, [phoneNumber]);
        const customerId = customer ? customer.id : null;
        const id = crypto.randomUUID();
        const description = JSON.stringify({ customerName: customerName || phoneNumber, term, interest, reason, bank });
        // store description in description column and keep reason in metadata (as simple string)
        await db.run(`INSERT INTO transactions (id, customerId, type, amount, status, description, metadata) VALUES (?, ?, 'loan', ?, ?, ?, ?)`, [id, customerId, Number(amount), status || 'pending', description, reason || null]);
        const loan = await db.get(`SELECT id, ? AS phoneNumber, amount, status, description, createdAt, updatedAt FROM transactions WHERE id = ?`, [phoneNumber, id]);
        console.log(`✓ Empréstimo criado: ${id} - ${phoneNumber} - ${amount}`);
        // Emit SSE to connected clients so UI updates immediately
        try {
          const payload = { type: 'loan-created', loan: loan };
          sseClients.forEach(c => {
            try { c.res.write(`event: loan-created\n`); c.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {}
          });
        } catch (e) {
          console.warn('Aviso: falha ao emitir SSE loan-created:', e?.message || e);
        }

        // Try to notify PayJA to sync loans immediately (best-effort)
        (async () => {
          try {
            const payjaBase = process.env.PAYJA_BACKEND_URL || process.env.PAYJA_BASE_URL || 'http://155.138.228.89:3000';
            const syncUrl = new URL('/api/v1/integrations/ussd/sync-loans', payjaBase).toString();
            await fetch(syncUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'simulator', loanId: id }) });
            console.log(`-> Notificado PayJA para sincronizar empréstimos (loanId=${id})`);
          } catch (e) {
            console.warn('Aviso: falha ao notificar PayJA sobre novo empréstimo:', e?.message || e);
          }
        })();

        res.status(201).json({ success: true, loan });
      } catch (error) {
        console.error('Erro ao criar empréstimo:', error);
        res.status(500).json({ error: 'Erro ao criar empréstimo' });
      }
    });

    // Reset loans (delete loan transactions)
    app.post('/api/loans/reset-all', async (req, res) => {
      try {
        await db.run(`DELETE FROM transactions WHERE type = 'loan'`);
        console.log('✓ Todos os empréstimos foram apagados');
        res.json({ success: true, message: 'Todos os empréstimos foram apagados' });
      } catch (error) {
        console.error('Erro ao resetar empréstimos:', error);
        res.status(500).json({ error: 'Erro ao resetar empréstimos' });
      }
    });

    app.patch('/api/loans/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { status, disbursedAt } = req.body || {};
        if (!status) return res.status(400).json({ error: 'status é obrigatório' });

        await db.run(`UPDATE transactions SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
        const loan = await db.get(`SELECT id, customerId, amount, status FROM transactions WHERE id = ?`, [id]);

        console.log(`✓ Status do empréstimo ${id} atualizado para: ${status}`);
        const customer = loan && loan.customerId ? await db.get(`SELECT phoneNumber FROM customers WHERE id = ?`, [loan.customerId]) : null;
        const phone = customer ? customer.phoneNumber : null;
        const statusUpper = String(status).toUpperCase();
        if (phone) {
          if (statusUpper === 'APPROVED') {
            try { sendLoanApprovedSms(phone, loan.amount); } catch (e) { console.warn('Aviso: falha ao enviar SMS de aprovação:', e.message); }
          } else if (statusUpper === 'DISBURSED') {
            try {
              const base = disbursedAt ? new Date(disbursedAt) : new Date();
              const dueDate = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
              sendLoanDisbursedSms(phone, loan.amount, dueDate);
            } catch (e) { console.warn('Aviso: falha ao enviar SMS de desembolso:', e.message); }
          } else if (statusUpper === 'REJECTED') {
            try { sendLoanRejectedSms(phone, loan.amount); } catch (e) { console.warn('Aviso: falha ao enviar SMS de rejeição:', e.message); }
          }
        }

        res.json({ success: true, loan });
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status do empréstimo' });
      }
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint nao encontrado' });
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error('Erro no servidor:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    });

    // Start server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('==============================================');
      console.log('  USSD Simulator Standalone');
      console.log('==============================================');
      console.log(`  Servidor rodando em: http://localhost:${PORT}`);
      console.log(`  API Health Check: http://localhost:${PORT}/api/health`);
      console.log(`  Endpoints disponiveis:`);
      console.log(`    - POST /api/ussd/session`);
      console.log(`    - GET  /api/payja/ussd/new-customers`);
      console.log(`    - POST /api/payja/ussd/eligibility`);
      console.log(`    - GET  /api/customers`);
      console.log(`    - GET  /api/banks`);
      console.log(`    - POST /api/integration/configure`);
      console.log('==============================================');
      console.log('');

      // Polling: sync customer status from PayJA every 15 seconds
      setInterval(async () => {
        try {
          const customers = await db.all(`SELECT phoneNumber FROM customers WHERE verified = 0`);
          if (!customers || customers.length === 0) return;

          const payjaBaseUrl = process.env.PAYJA_BASE_URL || 'http://155.138.228.89:3000';
          let updatedCount = 0;

          for (const customer of customers) {
            try {
              const response = await fetch(`${payjaBaseUrl}/api/v1/integrations/ussd/customer-status/${customer.phoneNumber}`);
              if (!response.ok) continue;
              const data = await response.json();
              if (data.success && data.verified) {
                await db.run(`UPDATE customers SET verified = 1, status = 'verified', creditLimit = ?, updatedAt = CURRENT_TIMESTAMP WHERE phoneNumber = ?`, [data.creditLimit || 0, customer.phoneNumber]);
                try { sendConfirmationSms(customer.phoneNumber, data.creditLimit || 0); } catch {}
                updatedCount++;
              }
            } catch (err) {
              // continue
            }
          }

          if (updatedCount > 0) console.log(`[Auto-Sync] Atualizado status de ${updatedCount} clientes do PayJA`);
        } catch (err) {
          console.error('[Auto-Sync] Erro ao sincronizar status:', err.message);
        }
      }, 15000); // Run every 15 seconds

      // Setup shutdown handlers after server is listening
      const shutdown = async (signal) => {
        console.log(`Recebido ${signal}, encerrando...`);
        if (server) {
          server.close(() => {
            console.log('Servidor encerrado');
          });
        }
        if (db) {
          await db.close();
          console.log('Banco fechado');
        }
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
