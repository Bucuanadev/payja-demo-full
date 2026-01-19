
// src/main.js - VERSÃO CORRIGIDA E INTEGRADA
const express = require('express');
const cors = require('cors');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();

// 1. Criar app primeiro
const app = express();

// 2. Configurar middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 3. Banco de dados global
let db = null;

// 4. FUNÇÃO DE SINCRONIZAÇÃO INTEGRADA (não mais em arquivo separado)
async function syncCustomerToDatabase(customer) {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }

  try {
    const rawPhone = customer.phoneNumber || customer.msisdn || customer.phone || '';
    const variants = msisdnVariants(rawPhone);
    const normalizedMsisdn = variants.length ? variants[0] : String(rawPhone).replace(/\D/g, '');

    console.log(`📥 Processando cliente: ${normalizedMsisdn}`);

    // Converter dados - SEMPRE tratar creditScore como string
    const id = parseInt(String(normalizedMsisdn).replace(/^258/, ''), 10) || Date.now();
    const nameParts = customer.name ? String(customer.name).trim().split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // creditScore como string (ou null se undefined)
    const creditScore = customer.creditScore !== undefined && customer.creditScore !== null 
      ? String(customer.creditScore) 
      : null;
    
    // Converter outros campos
    const balance = parseFloat(customer.salary) || 0;
    const customerLimit = parseFloat(customer.creditLimit || customer.customerLimit || customer.limit || customer.credit_limit) || 0;
    const verifiedRaw = customer.verified !== undefined ? customer.verified : (customer.isActive !== undefined ? customer.isActive : null);
    const isActive = (verifiedRaw === true || verifiedRaw === 'true' || verifiedRaw === 1 || verifiedRaw === '1') ? 1 : 0;
    const status = customer.status || 'unknown';
    
    // Converter data ISO para timestamp
    let updatedAt = Date.now();
    if (customer.updatedAt) {
      try {
        const date = new Date(customer.updatedAt);
        if (!isNaN(date.getTime())) {
          updatedAt = date.getTime();
        }
      } catch (e) {
        // Usar timestamp atual se falhar
      }
    }
    
    // Preserve hasCredit flag across upserts to avoid duplicate eligibility SMS
    let existingHasCredit = 0;
    try {
      const prevRow = await db.get('SELECT hasCredit FROM customers WHERE msisdn = ? OR msisdn = ?', [normalizedMsisdn, normalizedMsisdn.slice(-9)]);
      if (prevRow && prevRow.hasCredit) existingHasCredit = Number(prevRow.hasCredit) || 0;
    } catch (e) {
      existingHasCredit = 0;
    }

    // Inserir no banco (preservando hasCredit) usando msisdn normalizado
    const result = await db.run(
      `INSERT OR REPLACE INTO customers 
       (id, msisdn, firstName, lastName, creditScore, 
        nuit, biNumber, balance, customerLimit, 
        isActive, hasCredit, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalizedMsisdn || '',
        firstName,
        lastName,
        creditScore,
        customer.nuit || null,
        customer.biNumber || null,
        balance,
        customerLimit,
        isActive,
        existingHasCredit,
        status,
        updatedAt
      ]
    );

    console.log(`✅ Cliente ${normalizedMsisdn} sincronizado: ${result.changes} linha(s) afetada(s)`);
    return result;
    
  } catch (error) {
    console.error(`❌ Erro ao sincronizar ${customer.phoneNumber}:`, error.message);
    
    // Debug adicional para SQLITE_MISMATCH
    if (error.message.includes('SQLITE_MISMATCH')) {
      console.error('🔍 DEBUG SQLITE_MISMATCH - Tipos de dados:');
      console.error('  creditScore:', customer.creditScore, 'tipo:', typeof customer.creditScore);
      console.error('  balance:', customer.salary, 'tipo:', typeof customer.salary);
      console.error('  customerLimit:', customer.creditLimit, 'tipo:', typeof customer.creditLimit);
    }
    
    throw error;
  }
}

// 5. Função para sincronizar com PayJA
async function syncWithPayja() {
  try {
    if (!db) {
      console.warn('⚠️ Banco de dados não disponível para sincronização');
      return { success: 0, errors: 1 };
    }
    
    console.log('🔄 Sincronizando com PayJA...');
    
    const PAYJA_API_URL = process.env.PAYJA_API_URL || 'http://155.138.227.26:3000/api/v1/integrations/ussd/customers';
    
    const response = await fetch(PAYJA_API_URL);
    
    if (!response.ok) {
      throw new Error(`API PayJA retornou status ${response.status}`);
    }
    
    const payload = await response.json();

    // Normalizar vários formatos possíveis de resposta da API PayJA
    let customers = [];
    if (Array.isArray(payload)) {
      customers = payload;
    } else if (payload && Array.isArray(payload.customers)) {
      customers = payload.customers;
    } else if (payload && Array.isArray(payload.data)) {
      customers = payload.data;
    } else if (payload && payload.data && Array.isArray(payload.data.customers)) {
      customers = payload.data.customers;
    } else {
      console.warn('⚠️ Formato inesperado de resposta PayJA, mostrando amostra para debug:');
      try {
        console.warn(JSON.stringify(payload).slice(0, 2000));
      } catch (e) {
        console.warn('⚠️ Falha ao serializar payload para log');
      }
      return { success: 0, errors: 1 };
    }

    console.log(`📊 Encontrados ${customers.length} clientes na API PayJA`);
    // Vamos sincronizar estritamente com o PayJA:
    // - Upsert todos os clientes presentes no PayJA
    // - Remover do DB local clientes que NÃO estejam no PayJA
    // - Se PayJA indicar que o cliente foi pago/disbursed/paid, remover também
    let successCount = 0;
    let errorCount = 0;

    // Construir conjuntos para comparação
    const payjaMsisdns = new Set();
    const payjaShouldDelete = new Set();

    for (const customer of customers) {
      const phoneNumber = customer.phoneNumber || customer.msisdn || customer.phone || null;
      if (!phoneNumber) continue;
      payjaMsisdns.add(String(phoneNumber).trim());

      // Detectar marcações de pago/disbursed em diferentes propriedades
      const status = (customer.status || '').toString().toUpperCase();
      const paidFlag = customer.paid === true || customer.isPaid === true || customer.disbursed === true || ['DISBURSED','PAID','SETTLED','CLOSED'].includes(status);
      if (paidFlag) {
        payjaShouldDelete.add(String(phoneNumber).trim());
        continue; // não vamos upsertar clientes pagos
      }

      try {
        // Check previous state to avoid duplicate SMS notifications
        let prev = null;
        try {
          const variants = msisdnVariants(phoneNumber);
          const params = variants.length >= 2 ? [variants[0], variants[1]] : [variants[0], variants[0]];
          prev = await db.get('SELECT customerLimit, hasCredit FROM customers WHERE msisdn = ? OR msisdn = ?', params);
        } catch (e) {
          prev = null;
        }

        await syncCustomerToDatabase(customer);
        successCount++;

        // If PayJA provided a credit limit, notify via SMS only on transition (hasCredit from 0->1)
        try {
          const possibleLimit = customer.creditLimit || customer.customerLimit || customer.limit || customer.credit_limit;
          const limitNum = Number(possibleLimit || 0);
          const prevLimit = prev ? Number(prev.customerLimit || 0) : 0;
          const alreadyHad = prev && Number(prev.hasCredit || 0) === 1;
          // Notify only if customer newly eligible OR limit increased compared to previous value
          const shouldNotify = limitNum > 0 && phoneNumber && (!alreadyHad || limitNum > prevLimit);
          if (shouldNotify) {
            console.log(`🎉 Cliente elegível detectado: ${phoneNumber} - ${customer.name || customer.firstName || ''} - limite: ${limitNum}`);
            const name = (customer.name || customer.firstName || '').trim() || phoneNumber;
            const smsMsg = `Parabéns ${name}! Você é elegível ao Crédito Instantâneo. Seu limite é de ${limitNum} MZN.`;
            try {
              logSms(phoneNumber, smsMsg);
              // mark hasCredit so future syncs won't resend
              try {
                // use same variants/params used to query prev
                const markParams = params && params.length ? params : (msisdnVariants(phoneNumber).length >= 2 ? msisdnVariants(phoneNumber) : [phoneNumber, phoneNumber]);
                await db.run('UPDATE customers SET hasCredit = 1 WHERE msisdn = ? OR msisdn = ?', markParams);
              } catch (u) {
                // ignore update failures
              }
            } catch (e) { /* ignore */ }
          } else if (limitNum === 0 && prev && Number(prev.hasCredit || 0) === 1) {
            // credit removed -> clear flag
            try { await db.run('UPDATE customers SET hasCredit = 0 WHERE msisdn = ? OR msisdn = ?', [phoneNumber, phoneNumber]); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          /* non-fatal */
        }

      } catch (error) {
        console.error(`❌ Falha ao sincronizar ${phoneNumber}:`, error && error.message ? error.message : error);
        errorCount++;
      }
    }

    // Remover clientes locais marcados como pagos pelo PayJA
    if (payjaShouldDelete.size > 0) {
      for (const msisdn of payjaShouldDelete) {
        try {
          await db.run('DELETE FROM customers WHERE msisdn = ?', [msisdn]);
          console.log(`🗑️ Removido cliente marcado como pago: ${msisdn}`);
        } catch (e) {
          console.warn('Falha ao remover cliente pago:', msisdn, e.message || e);
        }
      }
    }

    // Remover clientes locais que não existem no PayJA
    try {
      const local = await db.all('SELECT msisdn FROM customers');
      for (const row of local) {
        const msisdn = String(row.msisdn || '').trim();
        if (!msisdn) continue;
        if (!payjaMsisdns.has(msisdn)) {
          try {
            await db.run('DELETE FROM customers WHERE msisdn = ?', [msisdn]);
            console.log(`🧽 Removido cliente local ausente no PayJA: ${msisdn}`);
          } catch (e) {
            console.warn('Falha ao remover cliente local:', msisdn, e.message || e);
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao listar clientes locais para limpeza:', e.message || e);
    }

    console.log(`✅ Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`);

    return { success: successCount, errors: errorCount };
    
  } catch (error) {
    console.error('❌ Erro na sincronização com PayJA:', error.message);
    return { success: 0, errors: 1 };
  }
}

// 6. Função para inicializar banco de dados
async function initDatabase() {
  try {
    console.log('📁 Inicializando banco de dados...');
    
    db = await open({
      filename: path.join(__dirname, '../database.sqlite'),
      driver: sqlite3.Database
    });
    
    // Criar tabela com tipos EXPLÍCITOS
    await db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        msisdn TEXT NOT NULL UNIQUE,
        firstName TEXT,
        lastName TEXT,
        creditScore TEXT,  -- EXPLICITAMENTE TEXT
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
    `);
      // Create loans table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS loans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phoneNumber TEXT,
          amount REAL,
          term INTEGER,
          monthlyPayment REAL,
          interestPct REAL,
          reason TEXT,
          status TEXT DEFAULT 'PENDING',
          createdAt INTEGER,
          updatedAt INTEGER,
          disbursedAt INTEGER
        )
      `);
    
    // Create sms_logs table for persisting SMS messages
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phoneNumber TEXT,
        message TEXT,
        sentAt INTEGER
      )
    `);

    console.log('✅ Banco de dados inicializado');

    // Load existing sms logs into in-memory cache
    try {
      const rows = await db.all('SELECT id, phoneNumber, message, sentAt FROM sms_logs ORDER BY sentAt ASC');
      smsLogs = rows.map(r => ({ id: r.id, phoneNumber: String(r.phoneNumber), message: r.message, sentAt: new Date(r.sentAt).toISOString() }));
      console.log(`ℹ️ Carregados ${smsLogs.length} SMS logs do banco`);
    } catch (e) {
      console.warn('⚠️ Falha ao carregar sms_logs do DB:', e && e.message ? e.message : e);
    }

    // Adicionar db ao app para uso nas rotas
    app.locals.db = db;

    return db;
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// 7. Rotas básicas

// Health check para compatibilidade com frontend
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'USSD Simulator',
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Rota antiga (opcional, pode ser removida se não usada)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'USSD Simulator',
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    name: 'USSD Simulator',
    version: '1.0.0',
    status: 'operational',
    uptime: process.uptime(),
    database: {
      connected: !!db,
      path: './database.sqlite'
    }
  });
});

// In-memory cache for SMS logs (backed by sqlite)
let smsLogs = [];
const sessions = {};
const loans = [];
let nextLoanId = 1;

// Normalize msisdn variants: returns [primary, secondary]
function msisdnVariants(input) {
  if (!input) return [];
  let s = String(input).trim().replace(/\D/g, '');
  if (!s) return [];
  // If starts with country code
  if (s.startsWith('258') && s.length === 12) {
    return [s, s.slice(3)];
  }
  // If local 9-digit
  if (s.length === 9) {
    return ['258' + s, s];
  }
  return [s];
}

async function logSms(phoneNumber, message) {
  try {
    // Check in-memory cache first to avoid unnecessary DB queries
    const exists = smsLogs.some(s => String(s.phoneNumber) === String(phoneNumber) && String(s.message) === String(message));
    if (exists) {
      console.log(`✉️ Duplicate SMS suppressed for ${phoneNumber}: ${message.slice(0, 80)}`);
      return null;
    }

    // Persist to DB if available
    let id = null;
    const sentAtTs = Date.now();
    if (db) {
      try {
        const ins = await db.run('INSERT INTO sms_logs (phoneNumber, message, sentAt) VALUES (?, ?, ?)', [String(phoneNumber), String(message), sentAtTs]);
        id = ins.lastID || null;
      } catch (e) {
        console.warn('⚠️ Falha ao persistir SMS no DB, seguirá em memória:', e && e.message ? e.message : e);
      }
    }

    const entry = { id: id || (smsLogs.length ? smsLogs[smsLogs.length - 1].id + 1 : 1), phoneNumber: String(phoneNumber), message: String(message), sentAt: new Date(sentAtTs).toISOString() };
    smsLogs.push(entry);
    console.log(`✉️ SMS logged for ${phoneNumber}: ${message.slice(0, 80)}`);
    return entry;
  } catch (err) {
    console.error('❌ logSms error:', err && err.message ? err.message : err);
    return null;
  }
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `${Math.round(num).toLocaleString('pt-MZ')} MZN`;
}

function monthlyPayment(principal, monthlyRate, months) {
  const P = Number(principal || 0);
  const r = Number(monthlyRate || 0);
  const n = Number(months || 1);
  if (!P || n <= 0) return 0;
  if (!r) return Math.round(P / n);
  const pow = Math.pow(1 + r, n);
  const payment = (P * r * pow) / (pow - 1);
  return Math.round(payment);
}

// 8. Rotas USSD (versão simplificada)

// Create a USSD session (used by frontend)
app.post('/api/ussd/session', async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const sessionId = `s_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    sessions[sessionId] = { id: sessionId, phoneNumber, createdAt: new Date().toISOString(), step: 'INIT' };

    // If this phoneNumber exists in our DB and has a positive customerLimit, return the congratulatory message
    let message = `CON Menu Principal:\n    1. Crédito Instantâneo\n    2. Estado do Empréstimo\n    3. Ajuda\n    0. Voltar/Sair`;
    try {
      if (db && phoneNumber) {
        const variants = msisdnVariants(phoneNumber);
        const params = variants.length >= 2 ? [variants[0], variants[1]] : [variants[0], variants[0]];
        const row = await db.get('SELECT firstName, msisdn, customerLimit FROM customers WHERE msisdn = ? OR msisdn = ?', params);
        // Require that the phone exists in the local customers table to be allowed
        if (row) {
          const name = (row.firstName || row.msisdn || '').trim();
          const limit = Number(row.customerLimit || 0);
          // Start directly at the Crédito Instantâneo menu if present in DB
          message = `CON Crédito Instantâneo\n\n1. Solicitar empréstimo\n2. Meus empréstimos\n3. Ajuda\n0. Voltar`;
          if (sessions[sessionId]) sessions[sessionId].step = 'CREDIT_MENU';
          try { logSms(phoneNumber, `Parabéns ${name || phoneNumber}! Você é elegível ao Crédito Instantâneo. Seu limite é de ${limit} MZN.`); } catch (e) { /* ignore */ }
        } else {
          // Not in DB - immediately reject eligibility
          message = 'END Você não é elegível ao Crédito Instantâneo. Dirija-se ao balcão Nedbank mais próximo.';
          if (sessions[sessionId]) sessions[sessionId].step = null;
        }
      } else {
        // No DB or no phone provided - reject
        message = 'END Você não é elegível ao Crédito Instantâneo. Dirija-se ao balcão Nedbank mais próximo.';
        if (sessions[sessionId]) sessions[sessionId].step = null;
      }
    } catch (e) {
      console.warn('Falha ao verificar elegibilidade na criação de sessão:', e && e.message ? e.message : e);
      message = 'END Erro no sistema. Tente novamente mais tarde.';
      if (sessions[sessionId]) sessions[sessionId].step = null;
    }

    res.json({ sessionId, message });
  } catch (err) {
    console.error('❌ Erro ao criar sessão USSD:', err);
    res.status(500).json({ error: 'Erro ao criar sessão' });
  }
});

app.post('/api/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text = '' } = req.body || {};

    console.log(`📞 USSD: ${phoneNumber} - "${text}" (session=${sessionId})`);

    // Ensure we have a session object to track flow
    let s = null;
    if (sessionId) {
      s = sessions[sessionId] || (sessions[sessionId] = { id: sessionId, phoneNumber, createdAt: new Date().toISOString(), step: 'INIT' });
    }

    const t = String(text || '').trim();
    let response = '';

    // If no input, check if the phone is authorized (came from PayJA / present in local DB)
    if (!t) {
      try {
        // If no phone provided, treat as not eligible
        if (!phoneNumber) {
          response = 'END Você não é elegível ao Crédito Instantâneo. Dirija-se ao balcão Nedbank mais próximo.';
          if (s) s.step = null;
          res.set('Content-Type', 'text/plain');
          return res.send(response);
        }

        // Lookup in DB for a matching customer (normalized variants)
        let allowed = false;
        if (db) {
          const variants = msisdnVariants(phoneNumber);
          const params = variants.length >= 2 ? [variants[0], variants[1]] : [variants[0], variants[0]];
          const row = await db.get('SELECT msisdn FROM customers WHERE msisdn = ? OR msisdn = ?', params);
          if (row) {
            allowed = true;
          }
        }

        if (!allowed) {
          // Not found
          response = 'END Você não é elegível ao Crédito Instantâneo. Dirija-se ao balcão Nedbank mais próximo.';
          if (s) s.step = null;
          res.set('Content-Type', 'text/plain');
          return res.send(response);
        }

        // Authorized -> show main credit menu
        response = 'CON Menu Principal:\n    1. Crédito Instantâneo\n    2. Estado do Empréstimo\n    3. Ajuda\n    0. Voltar/Sair';
        if (s) s.step = 'CREDIT_MENU';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      } catch (e) {
        console.warn('⚠️ Falha ao verificar elegibilidade no início do fluxo USSD:', e && e.message ? e.message : e);
        response = 'END Erro no sistema. Tente novamente mais tarde.';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }
    }

    // Handle input according to session state
    const state = s ? s.step : null;

    if (state === 'CREDIT_MENU') {
      if (t === '1') {
        // Ask for loan amount between 15000 and customer's eligible limit
        const MIN = 30000;
        let max = MIN;
        try {
            if (db && phoneNumber) {
            const variants = msisdnVariants(phoneNumber);
            const params = variants.length >= 2 ? [variants[0], variants[1]] : [variants[0], variants[0]];
            const row = await db.get('SELECT customerLimit FROM customers WHERE msisdn = ? OR msisdn = ?', params);
            if (row && row.customerLimit) {
              const parsed = Number(row.customerLimit);
              if (!isNaN(parsed) && parsed > 0) max = Math.max(MIN, parsed);
            }
          }
        } catch (e) {
          console.warn('⚠️ Falha ao obter limite do cliente:', e.message);
        }

        // Store limits in session
        if (s) {
          s.step = 'ASK_LOAN_AMOUNT';
          s.min = MIN;
          s.max = max;
        }

        response = `CON Digite o valor entre ${MIN} MZN e ${max} MZN:`;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      if (t === '2') {
        // List recent loans for this phone
        const list = loans.filter(l => l.phoneNumber === phoneNumber).slice(-5);
        if (!list.length) response = 'CON Ainda não tem empréstimos.\n\n0. Voltar';
        else response = 'CON Meus empréstimos:\n\n' + list.map((l, i) => `${i+1}. ${l.amount} MZN - ${l.status}`).join('\n') + '\n\n0. Voltar';
        if (s) s.step = 'CREDIT_MENU';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      if (t === '3') {
        response = `CON Ajuda - Suporte PayJA\n\nPara suporte ligue 800-PAYJA ou envie WhatsApp para +258 84 123 4567.\n\n0. Voltar`;
        if (s) s.step = 'CREDIT_MENU';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      if (t === '0') {
        response = 'END Obrigado. Até logo!';
        if (s) s.step = null;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      // Fallback invalid
      response = 'CON Opção inválida\n\n0. Voltar';
      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }

    // If asking for loan amount
    if (state === 'ASK_LOAN_AMOUNT') {
      const digits = (t || '').replace(/[^0-9]/g, '');
      const value = Number(digits);
      const min = s?.min || 30000;
      const max = s?.max || min;

      if (!value || isNaN(value)) {
        response = `CON Valor inválido. Digite apenas números entre ${min} e ${max}:`;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      if (value < min) {
        response = `CON Valor abaixo do mínimo (${min} MZN). Digite outro valor:`;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      if (value > max) {
        response = `CON Valor excede o limite (${max} MZN). Digite outro valor:`;
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      // Save draft and ask confirmation
      if (s) {
        s.draft = s.draft || {};
        s.draft.amount = value;
        // Determine available terms based on amount
        const terms = Number(value) >= 50000 ? [3, 4, 5] : [4, 5];
        // monthly rates (decimal)
        const rates = { 3: 0.042017, 4: 0.03551, 5: 0.0318252 };
        const options = terms.map((yrs) => {
          const months = yrs * 12;
          const monthly = monthlyPayment(value, rates[yrs], months);
          return { yrs, months, monthly };
        });
        s.draft.termOptions = options;
        s.step = 'ASK_LOAN_TERM';
      }

      // Build options list for USSD
      if (s && s.draft && Array.isArray(s.draft.termOptions)) {
        const opts = s.draft.termOptions.map((o, idx) => `${idx + 1}. ${o.yrs} anos - ${formatMoney(o.monthly)}/mês`).join('\n');
        response = `CON Valor escolhido: ${value} MZN\n\nSelecione prazo:\n${opts}\n0. Voltar`;
      } else {
        response = `CON Valor escolhido: ${value} MZN\n\nErro ao calcular prazos. Tente novamente.`;
      }

      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }

    // Confirm loan
    // If selecting loan term after entering amount
    if (state === 'ASK_LOAN_TERM') {
      // 0 to go back
      if (t === '0') {
        if (s) s.step = 'CREDIT_MENU';
        response = 'CON Operação cancelada.\n\n0. Voltar';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      const idx = Number(t);
      const options = s?.draft?.termOptions || [];
      if (!options.length || isNaN(idx) || idx < 1 || idx > options.length) {
        response = 'CON Opção inválida. Escolha um prazo válido.';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }

      const sel = options[idx - 1];
      if (s) {
        s.draft = s.draft || {};
        s.draft.term = sel.yrs;
        s.draft.monthlyPayment = sel.monthly;
        s.step = 'LOAN_REASON_CHOICES';
      }

      response = `CON Por que você precisa do empréstimo?\n1. Negócio\n2. Educação\n3. Saúde\n4. Emergência\n5. Outro`;
      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }

    if (state === 'LOAN_REASON_CHOICES') {
      const map = { '1': 'Negócio', '2': 'Educação', '3': 'Saúde', '4': 'Emergência', '5': 'Outro' };
      const reason = map[t];
      if (!reason) {
        response = 'CON Escolha 1, 2, 3, 4 ou 5.';
        res.set('Content-Type', 'text/plain');
        return res.send(response);
      }
      if (s) s.draft = { ...(s.draft || {}), reason };

      // Prepare final confirmation menu
      const amount = s?.draft?.amount || 0;
      const term = s?.draft?.term || 0; // in years
      const monthly = s?.draft?.monthlyPayment || 0;
      const rates = { 3: 0.042017, 4: 0.03551, 5: 0.0318252 };
      const interestPct = term && rates[term] ? (rates[term] * 100).toFixed(4) : '0';

      if (s) {
        s.draft = { ...(s.draft || {}), interestPct };
        // Final confirmation expects user to press 1 to confirm — use CONFIRM_LOAN
        s.step = 'CONFIRM_LOAN';
      }

      response = `CON Valor: ${Math.round(amount)} MZN\nJuros: ${interestPct}%\nTotal a pagar mensalmente: ${Math.round(monthly)} MZN\nTempo de pagamento: ${term} anos\nTermos e Condições:\n1. A aprovação do crédito é condicionada à análise de risco.\n2. Empréstimos solicitados até o dia 24 são cobrados no mesmo mês. Solicitações feitas a partir do dia 25 têm a cobrança efetuada no ciclo do mês seguinte.\n\n1. Confirmar\n2. Cancelar`;
      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }

    // Confirm loan
    if (state === 'CONFIRM_LOAN') {
      if (t === '1') {
        const amount = s?.draft?.amount || 0;
        try {
          if (!db) throw new Error('Banco não disponível');
          const now = Date.now();
          const ins = await db.run(`INSERT INTO loans (phoneNumber, amount, term, monthlyPayment, interestPct, reason, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [phoneNumber || null, amount, s?.draft?.term || null, s?.draft?.monthlyPayment || null, s?.draft?.interestPct || null, s?.draft?.reason || null, 'PENDING', now, now]
          );
          const id = ins.lastID || null;
          const loan = { id, phoneNumber, amount, term: s?.draft?.term || null, monthlyPayment: s?.draft?.monthlyPayment || null, interestPct: s?.draft?.interestPct || null, reason: s?.draft?.reason || null, status: 'PENDING', createdAt: new Date(now).toISOString() };

          // Log immediate receipt to SMS log
          if (loan.phoneNumber) logSms(loan.phoneNumber, `💰 Solicitação de Empréstimo recebida: ${loan.amount} MZN`);

          // Schedule a simulated forwarding job after 1 minute
          setTimeout(() => {
            (async () => {
              try {
                // update status to indicate it was forwarded to PayJA
                if (id && db) {
                  const ts = Date.now();
                  await db.run('UPDATE loans SET status = ?, updatedAt = ? WHERE id = ?', ['FORWARDED', ts, id]);
                  const row = await db.get('SELECT * FROM loans WHERE id = ?', [id]);
                  if (row && row.phoneNumber) {
                    logSms(row.phoneNumber, `🔔 Seu pedido de ${Math.round(row.amount)} MZN foi encaminhado para análise.`);
                  }
                }
              } catch (e) {
                console.error('❌ Erro ao encaminhar empréstimo após 1min:', e && e.message ? e.message : e);
              }
            })();
          }, 60 * 1000);

          // Inform user and end session - ask them to wait 1 minute
          response = 'END Pedido encaminhado. Aguarde 1 minuto para processamento.';
          if (s) s.step = null;
          res.set('Content-Type', 'text/plain');
          return res.send(response);
        } catch (e) {
          console.error('❌ Falha ao persistir empréstimo:', e && e.message ? e.message : e);
          response = 'END Erro ao processar solicitação. Tente novamente.';
          if (s) s.step = null;
          res.set('Content-Type', 'text/plain');
          return res.send(response);
        }
      }

      // cancel
      response = 'END Solicitação cancelada.';
      if (s) s.step = null;
      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }

    // Default fallback: show credit menu
    response = 'CON Crédito Instantâneo\n\n1. Solicitar empréstimo\n2. Meus empréstimos\n3. Ajuda\n0. Voltar';
    if (s) s.step = 'CREDIT_MENU';
    res.set('Content-Type', 'text/plain');
    return res.send(response);

  } catch (error) {
    console.error('❌ Erro no USSD:', error);
    res.status(500).send('END Erro no sistema. Tente novamente.');
  }
});
app.post('/api/customers/register', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Banco não disponível' });
    const { phoneNumber, name, nuit, biNumber, institution, createdAt } = req.body || {};
    const msisdn = phoneNumber || '';
    const id = parseInt(msisdn.replace(/\D/g, ''), 10) || Date.now();

    await db.run(`INSERT OR REPLACE INTO customers (id, msisdn, firstName, lastName, nuit, biNumber, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, msisdn, name || '', '', nuit || null, biNumber || null, 'registered', Date.now()]
    );

    logSms(msisdn, `✓ Registo confirmado para ${name || msisdn}`);

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao registrar cliente:', err);
    res.status(500).json({ error: 'Erro ao registrar cliente' });
  }
});

// Expor logs de SMS para o frontend
app.get('/api/sms/logs', (req, res) => {
  try {
    // permitir filtro por phone via query
    const phone = req.query.phone;
    const data = phone ? smsLogs.filter(s => String(s.phoneNumber) === String(phone)) : smsLogs;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Erro ao obter logs SMS:', err);
    res.status(500).json({ success: false, error: 'Erro ao obter logs' });
  }
});

// Apagar um SMS específico
app.delete('/api/sms/logs/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'id inválido' });
    const idx = smsLogs.findIndex(s => Number(s.id) === id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
    // remove from in-memory cache
    smsLogs.splice(idx, 1);
    // remove from DB if available
    try {
      if (db) await db.run('DELETE FROM sms_logs WHERE id = ?', [id]);
    } catch (e) {
      console.warn('⚠️ Falha ao apagar sms_logs do DB:', e && e.message ? e.message : e);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao apagar SMS:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Apagar SMSs (todas ou por telefone via query ?phone=...)
app.delete('/api/sms/logs', async (req, res) => {
  try {
    const phone = req.query.phone;
    if (phone) {
      const before = smsLogs.length;
      for (let i = smsLogs.length - 1; i >= 0; i--) {
        if (String(smsLogs[i].phoneNumber) === String(phone)) smsLogs.splice(i, 1);
      }
      // delete from DB
      try { if (db) await db.run('DELETE FROM sms_logs WHERE phoneNumber = ?', [String(phone)]); } catch (e) { console.warn('⚠️ Falha ao apagar sms_logs por telefone do DB:', e && e.message ? e.message : e); }
      const deleted = before - smsLogs.length;
      return res.json({ success: true, deleted });
    }
    const deleted = smsLogs.length;
    smsLogs.length = 0;
    try { if (db) await db.run('DELETE FROM sms_logs'); } catch (e) { console.warn('⚠️ Falha ao truncar sms_logs no DB:', e && e.message ? e.message : e); }
    return res.json({ success: true, deleted });
  } catch (err) {
    console.error('Erro ao apagar SMSs:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Loans endpoints (in-memory mock)
app.post('/api/loans', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Banco não disponível' });
    const payload = req.body || {};
    const now = Date.now();
    const result = await db.run(`INSERT INTO loans (phoneNumber, amount, term, monthlyPayment, interestPct, reason, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.phoneNumber || null, payload.amount || 0, payload.term || null, payload.monthlyPayment || null, payload.interestPct || null, payload.reason || null, (payload.status || 'PENDING').toUpperCase(), now, now]
    );

    const id = result.lastID || null;
    const loan = {
      id,
      phoneNumber: payload.phoneNumber || null,
      amount: payload.amount || 0,
      term: payload.term || null,
      monthlyPayment: payload.monthlyPayment || null,
      interestPct: payload.interestPct || null,
      reason: payload.reason || null,
      status: (payload.status || 'PENDING').toUpperCase(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString()
    };

    if (loan.phoneNumber) logSms(loan.phoneNumber, `💰 Solicitação de Empréstimo recebida: ${loan.amount} MZN`);

    res.json({ success: true, loan });
  } catch (err) {
    console.error('❌ Erro ao criar empréstimo:', err);
    res.status(500).json({ error: 'Erro ao criar empréstimo' });
  }
});

app.get('/api/loans', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Banco não disponível' });
    const rows = await db.all('SELECT * FROM loans ORDER BY createdAt DESC LIMIT 200');
    const loansOut = rows.map(r => ({
      id: r.id,
      phoneNumber: r.phoneNumber,
      amount: r.amount,
      term: r.term,
      monthlyPayment: r.monthlyPayment,
      interestPct: r.interestPct,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      disbursedAt: r.disbursedAt ? new Date(r.disbursedAt).toISOString() : null
    }));
    res.json({ success: true, loans: loansOut });
  } catch (err) {
    console.error('❌ Erro ao listar empréstimos:', err);
    res.status(500).json({ error: 'Erro ao listar empréstimos' });
  }
});

app.patch('/api/loans/:id/status', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Banco não disponível' });
    const id = Number(req.params.id);
    const status = (req.body.status || '').toString().toUpperCase();
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const now = Date.now();
    const upd = await db.run('UPDATE loans SET status = ?, updatedAt = ? WHERE id = ?', [status || 'PENDING', now, id]);
    if (upd.changes === 0) return res.status(404).json({ error: 'Empréstimo não encontrado' });
    const loanRow = await db.get('SELECT * FROM loans WHERE id = ?', [id]);
    if (loanRow && loanRow.phoneNumber) {
      logSms(loanRow.phoneNumber, `🔔 Empréstimo ${loanRow.id} atualizado: ${loanRow.status}`);

      // If disbursed, update disbursedAt and send a detailed confirmation SMS
      if (String(status).toUpperCase() === 'DISBURSED') {
        try {
          const disbursedAt = Date.now();
          await db.run('UPDATE loans SET disbursedAt = ? WHERE id = ?', [disbursedAt, id]);

          const amount = Math.round(loanRow.amount || 0);
          const monthly = Math.round(loanRow.monthlyPayment || 0);
          // Interpret term: prefer years if small, otherwise treat as months
          let termText = '';
          const termVal = Number(loanRow.term || 0);
          if (!termVal) termText = 'prazo não informado';
          else if (termVal <= 10) termText = `${termVal} ano${termVal > 1 ? 's' : ''}`;
          else termText = `${termVal} meses`;

          const sms = `✅ Seu crédito de ${amount} MZN foi desembolsado. Prazo: ${termText}. Prestação mensal: ${monthly} MZN.`;
          logSms(loanRow.phoneNumber, sms);
        } catch (e) {
          console.error('❌ Erro ao atualizar disbursedAt / enviar SMS de desembolso:', e && e.message ? e.message : e);
        }
      }
    }
    res.json({ success: true, loan: loanRow });
  } catch (err) {
    console.error('❌ Erro ao atualizar status do empréstimo:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

app.post('/api/loans/reset-all', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Banco não disponível' });
    await db.run('DELETE FROM loans');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao resetar empréstimos:', err);
    res.status(500).json({ error: 'Erro ao resetar empréstimos' });
  }
});

// 10. Rota para ver clientes
app.get('/api/customers', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Banco de dados não disponível' });
    }
    
    const customers = await db.all(`
      SELECT id, msisdn, firstName, lastName,
             creditScore, balance, customerLimit,
             status, isActive, updatedAt
      FROM customers
      ORDER BY updatedAt DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      count: customers.length,
      customers: customers.map(c => ({
        id: c.id,
        phoneNumber: c.msisdn,
        name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim(),
        firstName: c.firstName,
        lastName: c.lastName,
        creditLimit: Number(c.customerLimit || 0),
        creditScore: c.creditScore,
        status: c.status,
        verified: c.isActive === 1,
        updatedAt: new Date(c.updatedAt).toISOString()
      }))
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// 11. Rota para buscar cliente específico
app.get('/api/customers/:msisdn', async (req, res) => {
  try {
    const { msisdn } = req.params;
    
    if (!db) {
      return res.status(500).json({ error: 'Banco de dados não disponível' });
    }
    
    const variants = msisdnVariants(msisdn);
    const params = variants.length >= 2 ? [variants[0], variants[1]] : [variants[0], variants[0]];
    const customer = await db.get(
      'SELECT * FROM customers WHERE msisdn = ? OR msisdn = ?',
      params
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    res.json({
      success: true,
      customer: {
        id: customer.id,
        phoneNumber: customer.msisdn,
        name: ((customer.firstName || '') + ' ' + (customer.lastName || '')).trim(),
        firstName: customer.firstName,
        lastName: customer.lastName,
        creditLimit: Number(customer.customerLimit || 0),
        creditScore: customer.creditScore,
        status: customer.status,
        verified: customer.isActive === 1,
        updatedAt: new Date(customer.updatedAt).toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Erro ao buscar cliente ${req.params.msisdn}:`, error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// Endpoint to receive a single eligibility notification from PayJA
app.post('/api/payja/ussd/eligibility', async (req, res) => {
  try {
    const payload = req.body || {};
    const phoneNumber = payload.phoneNumber || payload.msisdn || payload.phone || null;
    const creditLimit = Number(payload.creditLimit || payload.customerLimit || 0);
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

    // Upsert minimal customer record with credit limit
    await syncCustomerToDatabase({ phoneNumber, name: payload.name || null, creditLimit: creditLimit, creditScore: payload.creditScore || null });

    // Log an SMS to notify the simulator UI
    try { logSms(phoneNumber, `Parabéns ${payload.name || phoneNumber}! Você é elegível ao Crédito Instantâneo. Seu limite é de ${creditLimit} MZN.`); } catch (e) { /* ignore */ }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao receber elegibilidade:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Endpoint to receive batch eligibility notifications from PayJA
app.post('/api/payja/ussd/eligibility/batch', async (req, res) => {
  try {
    const body = req.body || {};
    const customers = Array.isArray(body.customers) ? body.customers : body.data || [];
    if (!Array.isArray(customers)) return res.status(400).json({ error: 'customers array required' });

    let processed = 0;
    for (const c of customers) {
      try {
        await syncCustomerToDatabase({ phoneNumber: c.phoneNumber, name: c.name || null, creditLimit: c.creditLimit || 0, creditScore: c.creditScore || null });
        try { logSms(c.phoneNumber, `Parabéns ${c.name || c.phoneNumber}! Você é elegível ao Crédito Instantâneo. Seu limite é de ${c.creditLimit} MZN.`); } catch (e) { /* ignore */ }
        processed++;
      } catch (e) {
        console.warn('Falha ao processar cliente elegível:', c && c.phoneNumber, e.message || e);
      }
    }

    res.json({ success: true, processed });
  } catch (err) {
    console.error('❌ Erro ao receber batch de elegíveis:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Endpoint used by PayJA to mark a customer as verified and set limit
// Endpoint to manually trigger sync from UI
app.post('/api/sync-customers', async (req, res) => {
  try {
    console.log('🔄 Sincronização manual solicitada via UI...');
    const result = await syncWithPayja();
    res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      details: result
    });
  } catch (err) {
    console.error('❌ Erro na sincronização manual:', err);
    res.status(500).json({ error: 'Erro ao sincronizar' });
  }
});

app.post('/api/payja/ussd/mark-verified', async (req, res) => {
  try {
    const { phoneNumber, creditLimit } = req.body || {};
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });
    const limit = Number(creditLimit || 0);
    const id = parseInt((phoneNumber || '').replace(/\D/g, ''), 10) || Date.now();

    await db.run(`INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, phoneNumber, '', limit, 1, 'verified', Date.now()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao marcar verificado:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// 12. Inicialização do servidor
async function startServer() {
  try {
    const PORT = process.env.PORT || 3002;
    
    console.log('🚀 Iniciando USSD Simulator...');
    
    // Inicializar banco de dados
    await initDatabase();
    
    // Limpar clientes locais no lançamento: origem passa a ser PayJA
    try {
      console.log('🧹 Removendo todos clientes locais para usar PayJA como fonte de verdade...');
      await db.run('DELETE FROM customers');
      console.log('✅ Tabela customers truncada');
    } catch (e) {
      console.warn('⚠️ Falha ao truncar tabela customers:', e.message || e);
    }

    // Executar primeira sincronização (com trava para evitar execuções concorrentes)
    let isSyncing = false;
    setTimeout(async () => {
      if (isSyncing) return;
      try {
        isSyncing = true;
        console.log('🔄 Executando sincronização inicial...');
        const syncResult = await syncWithPayja();
        console.log(`📊 Resultado inicial: ${syncResult.success} sucessos, ${syncResult.errors} erros`);
      } catch (e) {
        console.warn('⚠️ Falha na sincronização inicial:', e && e.message ? e.message : e);
      } finally {
        isSyncing = false;
      }

      // Configurar sincronização periódica (15 segundos) com proteção contra overlap
      setInterval(async () => {
        if (isSyncing) {
          console.log('⏳ Sincronização em andamento, pulando ciclo.');
          return;
        }
        try {
          isSyncing = true;
          console.log('⏰ Executando sincronização periódica (15s)...');
          await syncWithPayja();
        } catch (e) {
          console.warn('⚠️ Erro durante sincronização periódica:', e && e.message ? e.message : e);
        } finally {
          isSyncing = false;
        }
      }, 15 * 1000);

    }, 3000); // Esperar 3 segundos após o servidor subir
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
✅ Servidor iniciado com sucesso!
📡 Porta: ${PORT}

📋 Endpoints disponíveis:
  • Health check:   GET    http://155.138.227.26:${PORT}/health
  • Status:         GET    http://155.138.227.26:${PORT}/api/status
  • USSD:           POST   http://155.138.227.26:${PORT}/api/ussd
  • Sincronizar:    POST   http://155.138.227.26:${PORT}/api/sync
  • Clientes:       GET    http://155.138.227.26:${PORT}/api/customers
  • Cliente:        GET    http://155.138.227.26:${PORT}/api/customers/:msisdn
      `);
    });
    
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
