// Replaced main with Database-backed simulator while preserving smartphone flows and SSE
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('./database.cjs');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Lightweight health endpoints early to ensure frontend health checks succeed
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', service: 'ussd-simulator', uptime: process.uptime() });
});

// Handle malformed JSON payloads from clients (returns 400 instead of crashing)
app.use((err, req, res, next) => {
  if (!err) return next();
  // body-parser emits a SyntaxError for invalid JSON
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    console.warn('[JSON] Malformed JSON payload from', req.ip || req.hostname);
    return res.status(400).json({ error: 'malformed_json', message: 'Malformed JSON payload' });
  }
  next(err);
});
app.use(express.static(path.join(__dirname, '../public')));

const db = new Database();

// Short-lived in-memory cache to debounce duplicate register requests (phone -> timestamp)
const recentRegisters = new Map();
const RECENT_REGISTER_TTL = parseInt(process.env.RECENT_REGISTER_TTL_MS || '5000', 10);
// Short-lived in-memory cache to debounce duplicate SMS messages (key -> timestamp)
const recentSmsSent = new Map();
const RECENT_SMS_TTL = parseInt(process.env.RECENT_SMS_TTL_MS || '86400000', 10);

// SSE clients
const sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();
  const clientId = Date.now() + Math.random();
  const client = { id: clientId, res };
  sseClients.push(client);
  try { res.write(`event: connected\n`); res.write(`data: ${JSON.stringify({ msg: 'connected' })}\n\n`); } catch(e){}
  const hb = setInterval(()=>{ try{ res.write(`: heartbeat\n\n`); }catch(e){} }, 20000);
  client.hb = hb;
  req.on('close', () => { clearInterval(hb); const idx = sseClients.findIndex(c=>c.id===clientId); if (idx!==-1) sseClients.splice(idx,1); });
});

app.get('/api/events/broadcast', async (req, res) => {
  try {
    const rows = await db.getVerifiedCustomers();
    for (const c of rows) {
      const payload = { type: 'customer-verified', phoneNumber: c.msisdn, name: c.name, verified: true };
      sseClients.forEach(cl => { try { cl.res.write(`event: customer-verified\n`); cl.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {} });
    }
    res.json({ ok: true, sent: rows.length });
  } catch (e) { console.error('broadcast error', e); res.status(500).json({ error: String(e) }); }
});

// Verifica diretamente no PayJA o estado de um único msisdn e atualiza localmente + emite SSE
async function checkPayjaStatusAndUpdate(msisdn) {
  try {
    if (!db) return;
    const payjaBase = process.env.PAYJA_BASE_URL || 'http://155.138.228.89:3000';
    const statusUrl = `${payjaBase}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(msisdn)}`;
    const resp = await fetch(statusUrl);
    if (!resp || !resp.ok) return;
    const json = await resp.json().catch(() => null);
    if (json && (json.success || json.verified) && json.verified) {
      await db.run('UPDATE customers SET isActive = 1, verified = 1, status = ?, updatedAt = ? WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', ['verified', Date.now(), msisdn, msisdn, msisdn]);
      try { sendConfirmationSms(msisdn, json.name || ''); } catch (e) {}
      if (json.creditLimit != null) {
        try {
          await db.run('UPDATE customers SET creditLimit = ?, status = ? WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [json.creditLimit, 'eligible', msisdn, msisdn, msisdn]);
          try { sendEligibilitySms(msisdn, true, json.creditLimit, 'Elegível'); } catch (e) {}
        } catch (e) {}
      }
      const payload = { type: 'customer-verified', phoneNumber: msisdn, creditLimit: json.creditLimit || null, verified: true, name: json.name || null, nuit: json.nuit || null };
      try {
        sseClients.forEach(cl => { try { cl.res.write(`event: customer-verified\n`); cl.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {} });
      } catch (e) {}
      console.log(`[AutoCheck] ${msisdn} marcado como verificado a partir do PayJA`);
    }
  } catch (err) {
    console.warn('[AutoCheck] erro ao verificar PayJA para', msisdn, err && err.message ? err.message : err);
  }
}

// Global handlers para logar erros não tratados (evita reinicios súbitos sem log)
process.on('unhandledRejection', (reason, p) => {
  console.error('❌ UnhandledRejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ UncaughtException:', err && err.stack ? err.stack : err);
});
 

// PayJA devolve limite e elegibilidade ao simulador
app.post('/api/payja/ussd/eligibility', async (req, res) => {
  const { phoneNumber, creditLimit } = req.body;
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  await db.run('UPDATE customers SET creditLimit = ?, status = ? WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [creditLimit, 'eligible', phoneNumber, phoneNumber, phoneNumber]);
  try { sendEligibilitySms(phoneNumber, true, creditLimit, 'Elegível'); } catch (e) {}
  res.json({ ok: true });
});

// PayJA marca cliente como verificado
app.post('/api/payja/ussd/mark-verified', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  // Only send confirmation SMS if the customer was not already verified
  try {
    const existing = await db.get('SELECT verified, isActive FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]);
    await db.run('UPDATE customers SET isActive = 1, verified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]);
    if (!existing || !existing.verified) {
      sendConfirmationSms(phoneNumber, '');
    }
  } catch (e) {
    // best-effort
    try { await db.run('UPDATE customers SET isActive = 1, verified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]); } catch (ee) {}
  }
  try {
    const payload = { type: 'customer-verified', phoneNumber: phoneNumber, creditLimit: null, verified: true };
    sseClients.forEach(c => {
      try { c.res.write(`event: customer-verified\n`); c.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {}
    });
  } catch (e) {}
  res.json({ ok: true });
});

async function sendEligibilitySms(phoneNumber, eligible, creditLimit = 0, reason = '') {
  try {
    // Ensure DB has column to persist eligibility notification
    try { await db.run('ALTER TABLE customers ADD COLUMN eligibility_notified INTEGER DEFAULT 0'); } catch(e) {}
    try {
      const row = await db.get('SELECT eligibility_notified FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]);
      if (row && (row.eligibility_notified === 1 || row.eligibility_notified === '1')) {
        console.log(`[SMS-PERSIST] eligibility already recorded for ${phoneNumber}, skipping`);
        return null;
      }
    } catch (e) {}

    const message = eligible ? `✓ Parabéns! Seu número foi verificado. Limite aprovado: ${creditLimit} MZN.` : `Sua inscrição foi processada. ${reason || ''}`;
    const key = String(phoneNumber) + '|eligibility';
    const last = recentSmsSent.get(key);
    const now = Date.now();
    if (last && (now - last) < RECENT_SMS_TTL) {
      console.log(`[SMS-DEDUPE] Skipping duplicate eligibility SMS to ${phoneNumber}`);
      return null;
    }
    const entry = {
      id: String(now),
      phoneNumber,
      message,
      sentAt: new Date().toISOString()
    };
    smsLogs.push(entry);
    recentSmsSent.set(key, now);
    try { console.log(`[SMS-SENT] eligibility -> ${phoneNumber} | ${message} | stack:\n${(new Error()).stack.split('\n').slice(1,6).join('\n')}`); } catch(e){}
    setTimeout(() => { try { recentSmsSent.delete(key); } catch (e) {} }, RECENT_SMS_TTL + 1000);
    try { const gateway = process.env.SMS_GATEWAY_URL || null; if (gateway) { try { fetch(gateway, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phoneNumber, message: entry.message }) }).catch(()=>{}); } catch(e) {} } } catch (e) {}
    // Persist that we notified eligibility to avoid duplicate sends from other modules/instances
    try { await db.run('UPDATE customers SET eligibility_notified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]); } catch (e) {}
    return entry;
  } catch (e) { return null; }
}

// Logs de SMS simulados
let smsLogs = [];
app.get('/api/sms/logs', (req, res) => {
  res.json({ data: smsLogs });
});

async function sendConfirmationSms(phoneNumber, name) {
  try {
    try { await db.run('ALTER TABLE customers ADD COLUMN confirmation_notified INTEGER DEFAULT 0'); } catch(e) {}
    try {
      const row = await db.get('SELECT confirmation_notified FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]);
      if (row && (row.confirmation_notified === 1 || row.confirmation_notified === '1')) {
        console.log(`[SMS-PERSIST] confirmation already recorded for ${phoneNumber}, skipping`);
        return null;
      }
    } catch (e) {}

    const message = `✓ Registo confirmado${name ? ' para ' + name : ''}`;
    const key = String(phoneNumber) + '|confirmation';
    const last = recentSmsSent.get(key);
    const now = Date.now();
    if (last && (now - last) < RECENT_SMS_TTL) {
      try { console.log(`[SMS-DEDUPE] Skipping duplicate confirmation SMS to ${phoneNumber} | stack:\n${(new Error()).stack.split('\n').slice(1,6).join('\n')}`); } catch(e){}
      return null;
    }
    const entry = {
      id: String(now),
      phoneNumber,
      message,
      sentAt: new Date().toISOString()
    };
    smsLogs.push(entry);
    recentSmsSent.set(key, now);
    try { console.log(`[SMS-SENT] confirmation -> ${phoneNumber} | ${message} | stack:\n${(new Error()).stack.split('\n').slice(1,6).join('\n')}`); } catch(e){}
    setTimeout(() => { try { recentSmsSent.delete(key); } catch (e) {} }, RECENT_SMS_TTL + 1000);
    try { const gateway = process.env.SMS_GATEWAY_URL || null; if (gateway) { try { fetch(gateway, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phoneNumber, message: entry.message }) }).catch(()=>{}); } catch(e) {} } } catch (e) {}
    try { await db.run('UPDATE customers SET confirmation_notified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]); } catch (e) {}
    return entry;
  } catch (e) { return null; }
}

function sendLoanDisbursedSms(phoneNumber, amount) {
  const entry = {
    id: String(Date.now()),
    phoneNumber,
    message: `💰 Empréstimo desembolsado: ${amount} MZN`,
    sentAt: new Date().toISOString()
  };
  smsLogs.push(entry);
  try {
    const gateway = process.env.SMS_GATEWAY_URL || null;
    if (gateway) {
      try { fetch(gateway, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phoneNumber, message: entry.message }) }).catch(()=>{}); } catch(e) {}
    }
  } catch (e) {}
}

// Cria empréstimo no simulador
let loans = [];
app.post('/api/loans', (req, res) => {
  const iso = new Date().toISOString();
  const loan = { ...req.body, id: String(Date.now()), status: 'pending', createdAt: iso, updatedAt: iso };
  loans.push(loan);
  res.json(loan);
});

// Lista empréstimos criados no simulador
app.get('/api/loans', (req, res) => {
  res.json(loans);
});

// Atualiza status do empréstimo
app.patch('/api/loans/:id/status', async (req, res) => {
  const loan = loans.find(l => l.id === req.params.id);
  if (!loan) {
    return res.status(404).json({ error: 'Empréstimo não encontrado' });
  }
  
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status é obrigatório' });
  }
  
  loan.status = status;
  loan.updatedAt = new Date().toISOString();
  
  if (String(status).toLowerCase() === 'disbursed') {
    sendLoanDisbursedSms(loan.phoneNumber, loan.amount);
  }
  
  res.json(loan);
});

// Lista todos os clientes (para smartphone flow e customers.html)
app.get('/api/customers', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'DB não disponível' });
    }

    const customers = await db.all('SELECT * FROM customers ORDER BY created_at DESC');
    console.log(`📊 Retornando ${customers.length} clientes`);

    const formatted = customers.map(c => {
      // Corrigir nome - remover "null" e espaços extras
      let fullName = c.name || '';
      if (!fullName && (c.firstName || c.lastName)) {
        const firstName = c.firstName || '';
        const lastName = c.lastName || '';
        fullName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+null$/i, '').trim();
      }
      if (!fullName) fullName = 'Cliente';

      return {
        id: c.id,
        msisdn: c.msisdn || c.phoneNumber || c.phone || '',
        phoneNumber: c.msisdn || c.phoneNumber || c.phone || '', // For compatibility
        name: fullName,
        nuit: c.nuit || null,
        biNumber: c.biNumber || null,
        email: c.email || null,
        status: c.status || 'active',
        creditLimit: c.creditLimit != null ? c.creditLimit : null,
        eligibility: c.creditLimit != null ? { limit: c.creditLimit } : null,
        isActive: c.isActive === 1 || c.verified === 1,
        verified: c.synced_with_payja === 1 || c.verified === 1,
        synced_with_payja: c.synced_with_payja || 0,
        created_at: c.created_at,
        updated_at: c.updated_at,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : null,
        updatedAt: c.updated_at ? new Date(c.updated_at).toISOString() : null
      };
    });

    res.json(formatted);

  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// PayJA-compatible endpoint: new customers to sync
app.get('/api/payja/ussd/new-customers', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'DB não disponível' });
    }

    // Get unsynced customers
    const customers = await db.getUnsyncedCustomers();
    console.log(`📊 [PayJA Sync] Retornando ${customers.length} clientes não sincronizados`);

    const formatted = customers.map(c => {
      let fullName = c.name || '';
      if (!fullName && (c.firstName || c.lastName)) {
        const firstName = c.firstName || '';
        const lastName = c.lastName || '';
        fullName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+null$/i, '').trim();
      }
      if (!fullName) fullName = 'Cliente';

      return {
        phoneNumber: c.msisdn || '', // PayJA expects phoneNumber
        name: fullName,
        nuit: c.nuit || null,
        biNumber: c.biNumber || null,
        email: c.email || null,
        verified: false, // New customers are not verified yet
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : null
      };
    });

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=30');

    console.log(`✅ [PayJA Sync] Enviando ${formatted.length} clientes formatados`);
    res.json(formatted);

  } catch (error) {
    console.error('❌ [PayJA Sync] Erro ao buscar clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark customer as synced (called by PayJA after successful sync)
app.post('/api/customers/:phoneNumber/sync', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    if (!db) {
      return res.status(500).json({ error: 'DB não disponível' });
    }

    await db.markAsSynced(phoneNumber);
    await db.addSyncLog(phoneNumber, 'SUCCESS', 'Synced with PayJA');

    console.log(`✅ Cliente ${phoneNumber} marcado como sincronizado`);
    res.json({ ok: true, phoneNumber, synced: true });

  } catch (error) {
    console.error(`❌ Erro ao marcar cliente ${req.params.phoneNumber} como sincronizado:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Limpa clientes (utilitário)
app.post('/api/customers/reset-all', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  await db.run('DELETE FROM customers');
  res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
  res.json({
    name: 'USSD Simulator',
    version: '1.0.0',
    status: 'operational',
    uptime: process.uptime(),
    database: {
      connected: !!db,
      path: '../../backend/prisma/dev.db'
    }
  });
});

// Backwards-compatible health endpoint used by some integrations
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ussd-simulator', uptime: process.uptime() });
});

// 8. Rotas USSD (versão simplificada)
app.post('/api/ussd', (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    
    console.log(`📞 USSD: ${phoneNumber} - "${text}"`);
    
    let response = '';
    
    if (!text || text === '') {
      response = `CON Bem-vindo ao PayJA USSD Simulator

1. Verificar meus dados
2. Verificar saldo
3. Testar sincronização
4. Ver status do serviço

0. Sair`;
    } else {
      switch (text) {
        case '1':
          response = 'CON Dados do sistema:\n\nCliente: Teste\nStatus: Ativo\n\n0. Voltar';
          break;
        case '2':
          response = 'CON Saldo disponível:\n\n1.500,00 MZN\n\n1. Extrato\n0. Voltar';
          break;
        case '3':
          response = 'CON Teste de sincronização\n\nSincronizando com PayJA...\n\n0. Voltar';
          break;
        case '4':
          response = `CON Status do serviço:
          
Banco de dados: ${db ? '✅ Conectado' : '❌ Desconectado'}
Servidor: ✅ Online
API PayJA: ✅ Disponível

0. Voltar`;
          break;
        case '0':
          response = 'END Obrigado. Até logo!';
          break;
        default:
          response = 'CON Opção inválida\n\n0. Voltar ao menu';
      }
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(response);
    
  } catch (error) {
    console.error('❌ Erro no USSD:', error);
    res.status(500).send('END Erro no sistema. Tente novamente.');
  }
});

// 9. Rota para forçar sincronização com PayJA
app.post('/api/sync', async (req, res) => {
  try {
    console.log('🔄 Sincronização manual solicitada');
    
    if (!db) {
      return res.status(500).json({ error: 'DB não disponível' });
    }

    // Get unsynced customers
    const unsyncedCustomers = await db.getUnsyncedCustomers();
    console.log(`📊 Encontrados ${unsyncedCustomers.length} clientes não sincronizados`);

    // Try to sync with PayJA
    const payjaBase = process.env.PAYJA_BASE_URL || 'http://155.138.228.89:3000';
    const syncEndpoint = `${payjaBase}/api/v1/integrations/ussd/sync-new-customers`;

    try {
      const response = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual-sync' })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Sincronização com PayJA bem-sucedida:', result);
        
        res.json({
          success: true,
          message: 'Sincronização iniciada',
          unsyncedCount: unsyncedCustomers.length,
          payjaResponse: result
        });
      } else {
        console.warn('⚠️ PayJA retornou erro:', response.status);
        res.json({
          success: false,
          message: 'PayJA não disponível, mas clientes estão prontos para sync',
          unsyncedCount: unsyncedCustomers.length
        });
      }
    } catch (fetchError) {
      console.warn('⚠️ Não foi possível conectar ao PayJA:', fetchError.message);
      res.json({
        success: false,
        message: 'PayJA não disponível, mas clientes estão prontos para sync',
        unsyncedCount: unsyncedCustomers.length,
        error: fetchError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao sincronizar:', error);
    res.status(500).json({ error: 'Erro ao sincronizar clientes' });
  }
});

// 11. Rota para buscar cliente específico
app.get('/api/customers/:msisdn', async (req, res) => {
  try {
    const { msisdn } = req.params;
    if (!db) {
      return res.status(500).json({ error: 'Banco de dados não disponível' });
    }
    // Buscar por phone OU msisdn OU phoneNumber - construir query dinamicamente
    const pragma = await db.all("PRAGMA table_info(customers)");
    const cols = pragma.map(p => p.name);
    const candidates = [];
    if (cols.includes('phone')) candidates.push('phone');
    if (cols.includes('msisdn')) candidates.push('msisdn');
    if (cols.includes('phoneNumber')) candidates.push('phoneNumber');
    if (candidates.length === 0) return res.status(500).json({ error: 'Nenhuma coluna de telefone encontrada no DB' });
    const where = candidates.map(c => `${c} = ?`).join(' OR ');
    const params = candidates.map(() => msisdn);
    const customer = await db.get(`SELECT * FROM customers WHERE ${where}`, params);
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    let fullName = '';
    if (customer.fullName) {
      fullName = customer.fullName;
    } else {
      const firstName = customer.firstName || '';
      const lastName = customer.lastName || '';
      fullName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+null$/i, '').trim();
    }
    if (!fullName) fullName = 'Cliente';
    res.json({
      success: true,
      customer: {
        msisdn: customer.phone || customer.msisdn || '',
        name: fullName,
        email: customer.email || '',
        balance: typeof customer.balance === 'number' ? customer.balance : (parseFloat(customer.balance) || 0),
        nuit: customer.nuit || null,
        biNumber: customer.biNumber || null,
        status: customer.status || 'active',
        createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
        updatedAt: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : null
      }
    });
  } catch (error) {
    console.error(`❌ Erro ao buscar cliente ${req.params.msisdn}:`, error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// 12. Inicialização do servidor

// Override /api/customers/register to use the local sqlite DB directly (avoid Prisma errors)
app.post('/api/customers/register', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'DB not initialized' });
    const payload = req.body || {};
    try { console.log('[Register-Override] incoming payload:', JSON.stringify(payload)); } catch (e) { console.log('[Register-Override] incoming payload (unserializable)'); }

    // Normalize phone early
    const rawPhone = String(payload.phoneNumber || payload.msisdn || payload.phone || '').trim();
    const phone = rawPhone.replace(/\D/g, '').replace(/^0+/, '');

    // Basic validation
    const validationErrors = [];
    if (!phone) validationErrors.push({ field: 'phoneNumber', message: 'required' });
    else if (phone.length < 6) validationErrors.push({ field: 'phoneNumber', message: 'too_short' });

    if (payload.nuit && typeof payload.nuit !== 'string' && typeof payload.nuit !== 'number') validationErrors.push({ field: 'nuit', message: 'invalid_type' });
    if (payload.name && typeof payload.name !== 'string') validationErrors.push({ field: 'name', message: 'invalid_type' });

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'validation_failed', details: validationErrors });
    }

    // Debounce rapid duplicate register requests for the same phone
    try {
      const now = Date.now();
      const last = recentRegisters.get(phone) || 0;
      if (last && (now - last) < RECENT_REGISTER_TTL) {
        return res.status(200).json({ ok: true, note: 'duplicate_inflight' });
      }
      recentRegisters.set(phone, now);
    } catch (e) { /* noop */ }

    const name = (payload.name || payload.fullName || '').trim();
    const nameParts = name ? name.split(' ') : ['',''];
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ') || '';
    let nuit = payload.nuit || null;
    const biNumber = payload.biNumber || payload.bi || null;
    const verified = payload.verified ? 1 : 0;
    const isActive = payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : 1;
    const status = payload.status || (verified ? 'verified' : 'pending');

    const nowIso = new Date().toISOString();

    if (!nuit) {
      const { v4: uuidv4 } = require('uuid');
      nuit = `MISSING-${uuidv4()}`;
    }

    // Inspect DB columns and insert using available ones to avoid 'no such column' errors
    const pragma = await db.all('PRAGMA table_info(customers)');
    const cols = pragma.map(p => p.name);

    // Pre-check existing customer by available phone columns to avoid duplicate INSERT attempts
    try {
      const phoneCols = ['phoneNumber','msisdn','phone'].filter(c => cols.includes(c));
      if (phoneCols.length > 0) {
        const whereCheck = phoneCols.map(c => `${c} = ?`).join(' OR ');
        const existing = await db.get(`SELECT * FROM customers WHERE ${whereCheck}`, phoneCols.map(() => phone));
        if (existing) {
          // schedule cleanup of recentRegisters key and return existing to caller
          setTimeout(() => { try { recentRegisters.delete(phone); } catch (e) {} }, RECENT_REGISTER_TTL + 100);
          return res.status(200).json({ ok: true, customer: existing, note: 'existing' });
        }
      }
    } catch (e) {
      // if pre-check fails, continue to main insert flow and let DB handle errors
      console.warn('[Register-Override] pre-check error:', e && e.message ? e.message : e);
    }

    const insertCols = [];
    const insertPlaceholders = [];
    const insertParams = [];

    // Prefer inserting into `phoneNumber` when available to satisfy NOT NULL schemas
    if (cols.includes('phoneNumber')) { insertCols.push('phoneNumber'); insertPlaceholders.push('?'); insertParams.push(phone); }
    else if (cols.includes('msisdn')) { insertCols.push('msisdn'); insertPlaceholders.push('?'); insertParams.push(phone); }
    else if (cols.includes('phone')) { insertCols.push('phone'); insertPlaceholders.push('?'); insertParams.push(phone); }

    if (cols.includes('fullName')) { insertCols.push('fullName'); insertPlaceholders.push('?'); insertParams.push(name || `${firstName} ${lastName}`.trim()); }
    else if (cols.includes('name')) { insertCols.push('name'); insertPlaceholders.push('?'); insertParams.push(name || `${firstName} ${lastName}`.trim()); }
    else if (cols.includes('firstName') && cols.includes('lastName')) { insertCols.push('firstName'); insertPlaceholders.push('?'); insertParams.push(firstName); insertCols.push('lastName'); insertPlaceholders.push('?'); insertParams.push(lastName); }

    if (cols.includes('nuit')) { insertCols.push('nuit'); insertPlaceholders.push('?'); insertParams.push(nuit); }
    if (cols.includes('biNumber')) { insertCols.push('biNumber'); insertPlaceholders.push('?'); insertParams.push(biNumber || null); }
    if (cols.includes('isActive')) { insertCols.push('isActive'); insertPlaceholders.push('?'); insertParams.push(isActive); }
    if (cols.includes('status')) { insertCols.push('status'); insertPlaceholders.push('?'); insertParams.push(status); }
    if (cols.includes('createdAt')) { insertCols.push('createdAt'); insertPlaceholders.push('?'); insertParams.push(nowIso); }
    if (cols.includes('updatedAt')) { insertCols.push('updatedAt'); insertPlaceholders.push('?'); insertParams.push(nowIso); }

    if (insertCols.length === 0) return res.status(400).json({ error: 'No compatible customer columns found in DB' });

    const insertSql = `INSERT INTO customers (${insertCols.join(',')}) VALUES (${insertPlaceholders.join(',')})`;

    try {
      await db.run(insertSql, insertParams);
    } catch (dbErr) {
      const msg = String(dbErr && dbErr.message ? dbErr.message : dbErr);
      console.error('[Register-Override] DB insert error:', msg);

      // Missing required phone column
      if (msg.includes('NOT NULL constraint failed') && msg.includes('customers.phoneNumber')) {
        return res.status(400).json({ error: 'phoneNumber is required' });
      }

      // Try to return existing customer on unique constraint failures
      if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
        // Prefer lookup by phone columns, then by nuit
        const phoneCols2 = ['phoneNumber','msisdn','phone'].filter(c => cols.includes(c));
        if (phoneCols2.length > 0) {
          const where2 = phoneCols2.map(c => `${c} = ?`).join(' OR ');
          const params2 = phoneCols2.map(() => phone);
          try {
            const existing = await db.get(`SELECT * FROM customers WHERE ${where2}`, params2);
            if (existing) return res.status(200).json({ ok: true, customer: existing, note: 'existing' });
          } catch (e) {
            console.error('[Register-Override] error fetching existing after UNIQUE (phone):', e && e.message ? e.message : e);
          }
        }

        // If no phone match, try matching by NUIT if available
        if (nuit) {
          try {
            const byNuit = await db.get('SELECT * FROM customers WHERE nuit = ?', [nuit]);
            if (byNuit) return res.status(200).json({ ok: true, customer: byNuit, note: 'existing_by_nuit' });
          } catch (e) {
            console.error('[Register-Override] error fetching existing after UNIQUE (nuit):', e && e.message ? e.message : e);
          }
        }

        // Fallback: report duplicate
        return res.status(409).json({ error: 'duplicate' });
      }

      console.error('[Register-Override] unexpected DB error:', dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return res.status(500).json({ error: 'internal error' });
    }

    const phoneCols3 = ['phoneNumber','msisdn','phone'].filter(c => cols.includes(c));
    let row = null;
    if (phoneCols3.length > 0) {
      const where3 = phoneCols3.map(c => `${c} = ?`).join(' OR ');
      row = await db.get(`SELECT * FROM customers WHERE ${where3}`, phoneCols3.map(() => phone));
    }

    try { setImmediate(() => { try { checkPayjaStatusAndUpdate(phone).catch(() => {}); } catch (e) {} }); } catch (e) {}
    try { setImmediate(() => { try { const PAYJA_SYNC_ENDPOINT = process.env.PAYJA_SYNC_ENDPOINT || 'http://155.138.228.89:3000/api/v1/integrations/ussd/sync-new-customers'; fetch(PAYJA_SYNC_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'simulator', phone }) }).catch(() => {}); } catch (e) {} }); } catch (e) {}

    // cleanup recentRegisters shortly after finishing
    try { setTimeout(() => { try { recentRegisters.delete(phone); } catch (e) {} }, 50); } catch (e) {}
    return res.status(200).json({ ok: true, customer: row });
  } catch (err) {
    console.error('[Register-Override] error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'internal error', message: err && err.message });
  }
});

// Sync customers from localStorage (customers.html) to database
const ConfigStore = require('./config-store.cjs');
app.post('/api/customers/sync-from-localStorage', async (req, res) => {
  try {
    const { customers } = req.body || {};
    if (!Array.isArray(customers)) return res.status(400).json({ error: 'customers array is required' });

    const { v4: uuidv4 } = require('uuid');
    const synced = [];
    const failed = [];

    for (const c of customers) {
      try {
        const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
        if (!phone) { failed.push({ error: 'missing phone', customer: c }); continue; }
        const existing = await db.get('SELECT * FROM customers WHERE msisdn = ? OR phoneNumber = ? OR phone = ?', [phone, phone, phone]);
        if (existing) {
          await db.run('UPDATE customers SET name = ?, nuit = ?, institution = ?, updatedAt = ? WHERE id = ?', [c.name || existing.name, c.nuit || existing.nuit, c.institution || existing.institution, Date.now(), existing.id]);
          synced.push({ phoneNumber: phone, status: 'updated', id: existing.id });
        } else {
          const id = uuidv4();
          // try to insert with common columns; ignore failures
          try {
            await db.run('INSERT INTO customers (id, msisdn, phoneNumber, name, nuit, biNumber, institution, verified, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, phone, phone, c.name || 'Cliente', c.nuit || null, c.biNumber || null, c.institution || null, c.verified ? 1 : 0, 'active', Date.now(), Date.now()]);
            synced.push({ phoneNumber: phone, status: 'created', id });
          } catch (ie) {
            // fallback: attempt minimal insert
            try { await db.run('INSERT INTO customers (msisdn, name) VALUES (?, ?)', [phone, c.name || 'Cliente']); synced.push({ phoneNumber: phone, status: 'created_minimal' }); } catch (e) { failed.push({ phoneNumber: phone, error: String(e && e.message ? e.message : e) }); }
          }
        }
      } catch (err) {
        failed.push({ customer: c, error: String(err && err.message ? err.message : err) });
      }
    }

    // Persist to simulator-config
    try {
      const existingCfg = ConfigStore.loadConfig() || {};
      existingCfg.customers = existingCfg.customers || [];
      const merged = existingCfg.customers.slice();
      for (const c of customers) {
        const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
        const idx = merged.findIndex(x => (String(x.phoneNumber||x.msisdn||'') === phone));
        if (idx !== -1) merged[idx] = { ...merged[idx], ...c };
        else merged.push(c);
      }
      existingCfg.customers = merged;
      ConfigStore.saveConfig(existingCfg);
    } catch (e) { console.warn('[Sync] could not persist config:', e && e.message ? e.message : e); }

    res.json({ synced: synced.length, synced, failed });
  } catch (error) {
    console.error('Erro ao sincronizar clientes:', error);
    res.status(500).json({ error: 'Erro ao sincronizar clientes' });
  }
});

// Expose endpoints to read/save simulator config persistently
app.get('/api/simulator-config', async (req, res) => {
  try {
    const cfg = ConfigStore.loadConfig() || {};
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: 'could not load config' });
  }
});

app.post('/api/simulator-config', async (req, res) => {
  try {
    const cfg = req.body || {};
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
    const cfg = ConfigStore.loadConfig() || {};
    const customers = Array.isArray(cfg.customers) ? cfg.customers : [];
    if (!customers.length) return res.json({ imported: 0, message: 'no persisted customers' });

    const imported = [];
    const updated = [];

    for (const c of customers) {
      try {
        const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
        if (!phone) continue;
        const pragma = await db.all('PRAGMA table_info(customers)');
        const cols = pragma.map(p => p.name);
        const phoneCols = ['phoneNumber','msisdn','phone'].filter(x => cols.includes(x));

        let existing = null;
        if (phoneCols.length > 0) {
          const where = phoneCols.map(cn => `${cn} = ?`).join(' OR ');
          existing = await db.get(`SELECT * FROM customers WHERE ${where}`, phoneCols.map(() => phone));
        }

        if (existing) {
          await db.run('UPDATE customers SET name = ?, nuit = ?, biNumber = ?, verified = ?, status = ?, updatedAt = ? WHERE id = ?', [c.name || existing.name, c.nuit || existing.nuit, c.biNumber || existing.biNumber, c.verified ? 1 : existing.verified, c.status || existing.status || 'registered', Date.now(), existing.id]);
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

async function startServer() {
  try {
    const PORT = process.env.PORT || process.env.USSD_SIM_PORT || 3001;
    
    console.log('🚀 Iniciando USSD Simulator...');
    
    // Wait for database to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
✅ Servidor iniciado com sucesso!
📡 Porta: ${PORT}

📋 Endpoints disponíveis:
  • Health check:      GET    http://localhost:${PORT}/health
  • Status:            GET    http://localhost:${PORT}/api/status
  • USSD:              POST   http://localhost:${PORT}/api/ussd
  • Sincronizar:       POST   http://localhost:${PORT}/api/sync
  • Clientes:          GET    http://localhost:${PORT}/api/customers
  • Cliente:           GET    http://localhost:${PORT}/api/customers/:msisdn
  • Registrar:         POST   http://localhost:${PORT}/api/customers/register
  
📡 Endpoints PayJA:
  • Novos clientes:    GET    http://localhost:${PORT}/api/payja/ussd/new-customers
  • Marcar verificado: POST   http://localhost:${PORT}/api/payja/ussd/mark-verified
  • Elegibilidade:     POST   http://localhost:${PORT}/api/payja/ussd/eligibility
      `);
      
      // Executar primeira sincronização após servidor iniciar
      setTimeout(async () => {
        try {
          console.log('🔄 Verificando clientes não sincronizados...');
          const unsynced = await db.getUnsyncedCustomers();
          console.log(`📊 Encontrados ${unsynced.length} clientes não sincronizados`);
          
          if (unsynced.length > 0) {
            console.log('📋 Clientes pendentes:');
            unsynced.forEach(c => {
              console.log(`  - ${c.msisdn} (${c.name})`);
            });
          }
        } catch (err) {
          console.error('❌ Erro ao verificar clientes:', err);
        }
      }, 2000);
    });
    
    // Poll PayJA for verification updates every 15 seconds
    setInterval(async () => {
      try {
        if (!db) return;
        // Try to select any phone column available (msisdn, phoneNumber, phone)
        const pragmaCols = await db.all("PRAGMA table_info(customers)");
        const cols = pragmaCols.map(p => p.name);
        let pending;
        if (cols.includes('msisdn')) {
          pending = await db.all(`SELECT COALESCE(msisdn, phoneNumber, phone) AS msisdn FROM customers WHERE (isActive = 0 OR verified = 0 OR verified IS NULL)`);
        } else {
          pending = await db.all(`SELECT COALESCE(phoneNumber, phone) AS msisdn FROM customers WHERE (isActive = 0 OR verified = 0 OR verified IS NULL)`);
        }
        if (!pending || pending.length === 0) return;
        const payjaBase = process.env.PAYJA_BASE_URL || 'http://155.138.228.89:3000';
        for (const c of pending) {
          try {
            const statusUrl = `${payjaBase}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(c.msisdn)}`;
            const resp = await fetch(statusUrl);
            if (!resp || !resp.ok) continue;
            const json = await resp.json();
            if (json && json.success && json.verified) {
              // Mark customer as active/verified trying available phone columns
              if (cols.includes('msisdn')) {
                await db.run('UPDATE customers SET isActive = 1, verified = 1, status = ?, updatedAt = ? WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', ['verified', Date.now(), c.msisdn, c.msisdn, c.msisdn]);
              } else {
                await db.run('UPDATE customers SET isActive = 1, verified = 1, status = ?, updatedAt = ? WHERE phoneNumber = ? OR phone = ?', ['verified', Date.now(), c.msisdn, c.msisdn]);
              }
              try { sendConfirmationSms(c.msisdn, json.name || ''); } catch (e) {}
              console.log(`[Poll] marcando ${c.msisdn} como verificado (via PayJA)`);
                    try {
                      const payload = { type: 'customer-verified', phoneNumber: c.msisdn, creditLimit: json.creditLimit || null, verified: true, name: json.name || null, nuit: json.nuit || null };
                      sseClients.forEach(cl => {
                        try { cl.res.write(`event: customer-verified\n`); cl.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch (e) {}
                      });
                    } catch (e) {}
            }
          } catch (err) {
            console.error('[Poll] erro ao verificar cliente', c.msisdn, err && err.message ? err.message : err);
          }
        }
      } catch (err) {
        console.error('[Poll] erro no loop de verificação:', err && err.message ? err.message : err);
      }
    }, 15000);
    
    // Tratamento de graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Encerrando servidor...');
      if (db) {
        await db.close();
        console.log('✅ Banco de dados fechado');
      }
      console.log('👋 Servidor encerrado');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar servidor:', error);
    process.exit(1);
  }
}

// 13. Iniciar servidor
startServer();

// Exportar para testes
module.exports = app;

