const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..')));

// Configurações
const PAYJA_API_URL = process.env.PAYJA_API_URL || 'http://216.128.152.177:3000/api/v1';
const BANCO_MOCK_API_URL = process.env.BANCO_MOCK_API_URL || 'http://216.128.152.177:4500/api';
const VPS_IP = process.env.VPS_IP || '216.128.152.177';

// Token JWT do PayJA (obtido no login)
let payjaToken = null;
let payjaTokenExpiry = 0;

// =============================================
// BASE DE DADOS LOCAL
// =============================================
let db;
async function initDatabase() {
  db = await open({
    filename: path.join(__dirname, '../ussd.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      msisdn TEXT UNIQUE,
      firstName TEXT,
      nuit TEXT,
      numeroConta TEXT,
      customerLimit REAL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      payjaCustomerId TEXT,
      updatedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msisdn TEXT,
      message TEXT,
      type TEXT DEFAULT 'SMS',
      sentAt INTEGER,
      status TEXT DEFAULT 'SENT'
    );

    CREATE TABLE IF NOT EXISTS ussd_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT UNIQUE,
      phoneNumber TEXT,
      step TEXT DEFAULT 'INIT',
      data TEXT DEFAULT '{}',
      createdAt INTEGER,
      updatedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS loan_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msisdn TEXT,
      amount REAL,
      termMonths INTEGER,
      termLabel TEXT,
      interestRate REAL,
      monthlyPayment REAL,
      totalAmount REAL,
      status TEXT DEFAULT 'PENDING',
      payjaLoanId TEXT,
      bancoDesembolsoId TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );
  `);

  // Migrar colunas em falta (caso DB antigo)
  const cols = await db.all("PRAGMA table_info(customers)");
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('nuit')) await db.run("ALTER TABLE customers ADD COLUMN nuit TEXT");
  if (!colNames.includes('numeroConta')) await db.run("ALTER TABLE customers ADD COLUMN numeroConta TEXT");
  if (!colNames.includes('payjaCustomerId')) await db.run("ALTER TABLE customers ADD COLUMN payjaCustomerId TEXT");

  console.log('✅ Database initialized');
}

// Sessões USSD em memória
const sessions = {};

// =============================================
// HELPERS
// =============================================
async function logSms(msisdn, message, type = 'SMS') {
  console.log(`📱 SMS [${type}] para ${msisdn}: ${message.substring(0, 80)}`);
  try {
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [msisdn, message, type, Date.now(), 'SENT']
    );
  } catch (err) {
    console.error('Erro ao salvar SMS:', err.message);
  }
}

const fmt = (n) => Number(n).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Calcular prestação mensal (juros simples)
const calcPrestacao = (principal, taxaPorc, anos) => {
  const meses = anos * 12;
  const r = taxaPorc / 100;
  return (principal * (1 + r * meses)) / meses;
};

// =============================================
// AUTENTICAÇÃO PAYJA
// =============================================
async function getPayjaToken() {
  if (payjaToken && Date.now() < payjaTokenExpiry) return payjaToken;
  try {
    const res = await axios.post(`${PAYJA_API_URL}/auth/login`, {
      email: 'admin@payja.mz',
      password: 'PayJA@2024'
    }, { timeout: 8000 });
    payjaToken = res.data.access_token;
    payjaTokenExpiry = Date.now() + 6 * 60 * 60 * 1000; // 6 horas
    console.log('✅ Token PayJA renovado');
    return payjaToken;
  } catch (err) {
    console.error('❌ Erro ao obter token PayJA:', err.message);
    return null;
  }
}

// =============================================
// SINCRONIZAÇÃO PAYJA → DB LOCAL
// =============================================
async function syncWithPayja() {
  try {
    console.log('🔄 Sincronizando clientes elegíveis do PayJA...');
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers`, { timeout: 10000 });
    const customers = response.data;

    if (!Array.isArray(customers)) return { success: 0, total: 0 };

    let count = 0;
    for (const c of customers) {
      if (c.status === 'APPROVED' || c.verified) {
        // Buscar dados completos do banco mock para obter NUIT e conta
        let nuit = c.nuit || null;
        let numeroConta = null;
        try {
          const bankRes = await axios.post(`${BANCO_MOCK_API_URL}/validacao/consultar`, {
            telefone: c.phoneNumber
          }, { timeout: 5000 });
          if (bankRes.data && bankRes.data.elegivel) {
            nuit = bankRes.data.cliente?.nuit || nuit;
            numeroConta = bankRes.data.cliente?.numero_conta || null;
          }
        } catch (e) { /* ignorar */ }

        const idNum = parseInt((c.id || '').replace(/\D/g, '').substring(0, 9)) || Math.floor(Math.random() * 900000000 + 100000000);
        await db.run(
          `INSERT OR REPLACE INTO customers
           (id, msisdn, firstName, nuit, numeroConta, customerLimit, isActive, status, payjaCustomerId, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'approved', ?, ?)`,
          [idNum, c.phoneNumber, c.name, nuit, numeroConta, c.creditLimit || 0, c.id, Date.now()]
        );
        count++;
      }
    }
    console.log(`✅ Sincronizados ${count} clientes elegíveis de ${customers.length} total`);
    return { success: count, total: customers.length };
  } catch (err) {
    console.error('❌ Erro na sincronização PayJA:', err.message);
    return { success: 0, error: err.message };
  }
}

// =============================================
// VERIFICAR ELEGIBILIDADE (via DB local primeiro)
// =============================================
async function checkEligibilityLocal(phoneNumber) {
  const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
  if (customer && customer.status === 'approved' && customer.isActive && customer.customerLimit > 0) {
    return {
      elegivel: true,
      limite_aprovado: customer.customerLimit,
      cliente: {
        nuit: customer.nuit,
        nome: customer.firstName,
        telefone: customer.msisdn,
        numero_conta: customer.numeroConta,
        payjaCustomerId: customer.payjaCustomerId
      },
      fonte: 'local'
    };
  }
  // Fallback: consultar banco mock
  try {
    const bankRes = await axios.post(`${BANCO_MOCK_API_URL}/validacao/consultar`, {
      telefone: phoneNumber
    }, { timeout: 8000 });
    return { ...bankRes.data, fonte: 'banco_mock' };
  } catch (err) {
    console.error(`❌ Erro ao consultar banco para ${phoneNumber}:`, err.message);
    return { elegivel: false, motivo: 'Erro de conexão com o banco.' };
  }
}

// =============================================
// PROCESSAR EMPRÉSTIMO: Simulador → PayJA → Banco Mock → SMS
// =============================================
async function processLoanRequest(msisdn, amount, plan, customerInfo) {
  console.log(`\n💰 Processando empréstimo: ${msisdn} | ${amount} MZN | ${plan.label}`);

  const totalAmount = plan.monthly * plan.years * 12;

  // 1. Registar no DB local
  const loanId = await db.run(
    `INSERT INTO loan_requests (msisdn, amount, termMonths, termLabel, interestRate, monthlyPayment, totalAmount, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?)`,
    [msisdn, amount, plan.years * 12, plan.label, plan.rate, plan.monthly, totalAmount, Date.now(), Date.now()]
  );
  const loanDbId = loanId.lastID;

  // 2. Enviar ao PayJA Backend
  let payjaLoanId = null;
  try {
    const token = await getPayjaToken();
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [msisdn]);
    if (token && customer && customer.payjaCustomerId) {
      const payjaRes = await axios.post(`${PAYJA_API_URL}/loans`, {
        customerId: customer.payjaCustomerId,
        amount: amount,
        termMonths: plan.years * 12,
        totalAmount: totalAmount,
        monthlyPayment: plan.monthly,
        interestRate: plan.rate,
        purpose: 'Solicitação via USSD *299#',
        channel: 'USSD'
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      payjaLoanId = payjaRes.data?.id || payjaRes.data?.loanId;
      console.log(`✅ Empréstimo registado no PayJA: ${payjaLoanId}`);
      await db.run('UPDATE loan_requests SET payjaLoanId = ? WHERE id = ?', [payjaLoanId, loanDbId]);
    }
  } catch (payjaErr) {
    console.warn(`⚠️ Aviso PayJA: ${payjaErr.message} — continuando com banco mock`);
  }

  // 3. Enviar desembolso ao Banco Mock
  let desembolsoId = null;
  let bancoAprovado = false;
  try {
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [msisdn]);
    const nuit = customer?.nuit || customerInfo?.nuit;
    const emola = msisdn; // número e-Mola = número de telefone

    if (!nuit) throw new Error('NUIT não disponível para desembolso');

    const bancoRes = await axios.post(`${BANCO_MOCK_API_URL}/desembolso/executar`, {
      nuit: nuit,
      valor: amount,
      numero_emola: emola,
      referencia_payja: payjaLoanId || `PAYJA-${Date.now()}`,
      descricao: `Crédito PayJA - ${plan.label} - ${fmt(plan.monthly)} MZN/mês`
    }, { timeout: 15000 });

    if (bancoRes.data?.sucesso) {
      bancoAprovado = true;
      desembolsoId = bancoRes.data?.desembolso?.id;
      console.log(`✅ Desembolso aprovado pelo Banco Mock: ${desembolsoId}`);
      await db.run(
        'UPDATE loan_requests SET status = ?, bancoDesembolsoId = ?, updatedAt = ? WHERE id = ?',
        ['APPROVED', desembolsoId, Date.now(), loanDbId]
      );
    } else {
      throw new Error(bancoRes.data?.erro || 'Banco recusou o desembolso');
    }
  } catch (bancoErr) {
    console.error(`❌ Erro no desembolso: ${bancoErr.message}`);
    await db.run('UPDATE loan_requests SET status = ?, updatedAt = ? WHERE id = ?', ['FAILED', Date.now(), loanDbId]);
  }

  // 4. Enviar SMS de confirmação
  if (bancoAprovado) {
    const smsMsg =
      `PayJA ✅ CRÉDITO APROVADO!\n` +
      `Valor: ${fmt(amount)} MZN\n` +
      `Prazo: ${plan.label} | ${fmt(plan.monthly)} MZN/mês\n` +
      `Total a pagar: ${fmt(totalAmount)} MZN\n` +
      `Ref: ${desembolsoId || payjaLoanId || 'N/A'}\n` +
      `O valor foi enviado para o seu e-Mola. Obrigado!`;
    await logSms(msisdn, smsMsg, 'LOAN_APPROVED');
    return { success: true, message: smsMsg, desembolsoId, payjaLoanId };
  } else {
    const smsMsg =
      `PayJA ❌ Pedido não processado.\n` +
      `Valor: ${fmt(amount)} MZN\n` +
      `Motivo: Erro no processamento bancário.\n` +
      `Contacte o suporte: 800-PAYJA`;
    await logSms(msisdn, smsMsg, 'LOAN_FAILED');
    return { success: false, message: smsMsg };
  }
}

// =============================================
// ROTAS ESTÁTICAS
// =============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'USSD Simulator',
  version: '3.0.0',
  timestamp: new Date().toISOString()
}));

app.get('/api/health', async (req, res) => {
  try {
    const customers = await db.get('SELECT COUNT(*) as total FROM customers');
    const approved = await db.get('SELECT COUNT(*) as total FROM customers WHERE status = "approved"');
    const smsCount = await db.get('SELECT COUNT(*) as total FROM sms_logs');
    const loans = await db.get('SELECT COUNT(*) as total FROM loan_requests');
    res.json({
      status: 'ok',
      service: 'USSD Simulator',
      version: '3.0.0',
      customers: customers.total,
      approved: approved.total,
      smsSent: smsCount.total,
      loans: loans.total,
      payjaUrl: PAYJA_API_URL,
      bancoMockUrl: BANCO_MOCK_API_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE CLIENTES
// =============================================
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db.all('SELECT * FROM customers ORDER BY customerLimit DESC');
    res.json(customers.map(c => ({
      id: c.id,
      phoneNumber: c.msisdn,
      name: c.firstName,
      nuit: c.nuit,
      numeroConta: c.numeroConta,
      creditLimit: c.customerLimit,
      customerLimit: c.customerLimit,
      isActive: c.isActive === 1,
      status: c.status,
      verified: c.status === 'approved',
      payjaCustomerId: c.payjaCustomerId,
      updatedAt: c.updatedAt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/:phone', async (req, res) => {
  try {
    const c = await db.get('SELECT * FROM customers WHERE msisdn = ?', [req.params.phone]);
    if (!c) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({
      phoneNumber: c.msisdn,
      name: c.firstName,
      nuit: c.nuit,
      numeroConta: c.numeroConta,
      creditLimit: c.customerLimit,
      customerLimit: c.customerLimit,
      isActive: c.isActive === 1,
      status: c.status,
      verified: c.status === 'approved',
      payjaCustomerId: c.payjaCustomerId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, numeroConta, creditLimit, status } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    const id = Math.floor(Math.random() * 900000000 + 100000000);
    await db.run(
      `INSERT OR REPLACE INTO customers (id, msisdn, firstName, nuit, numeroConta, customerLimit, isActive, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, phoneNumber, name || 'Cliente', nuit || null, numeroConta || null, creditLimit || 0, status || 'pending', Date.now()]
    );
    res.json({ success: true, id, phoneNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/register', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, bi, institution } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    const existing = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
    if (existing) return res.json({ success: true, message: 'Cliente já registado', customer: existing });
    const id = Math.floor(Math.random() * 900000000 + 100000000);
    await db.run(
      `INSERT OR REPLACE INTO customers (id, msisdn, firstName, nuit, customerLimit, isActive, status, updatedAt)
       VALUES (?, ?, ?, ?, 0, 1, 'pending', ?)`,
      [id, phoneNumber, name || 'Cliente USSD', nuit || null, Date.now()]
    );
    await logSms(phoneNumber, `PayJA: O seu registo foi recebido. Aguarde a análise do seu pedido. Será notificado em breve.`, 'REGISTRATION');
    res.json({ success: true, message: 'Registo submetido com sucesso', phoneNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SMS
// =============================================
app.get('/api/sms/logs', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM sms_logs ORDER BY sentAt DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sms-logs', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM sms_logs ORDER BY sentAt DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sms/send', async (req, res) => {
  try {
    const { msisdn, message, type } = req.body;
    if (!msisdn || !message) return res.status(400).json({ error: 'msisdn e message são obrigatórios' });
    await logSms(msisdn, message, type || 'MANUAL');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms/logs/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms/logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true, message: 'Todos os SMS apagados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms-logs/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms-logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE EMPRÉSTIMOS
// =============================================
app.get('/api/loans', async (req, res) => {
  try {
    const loans = await db.all('SELECT * FROM loan_requests ORDER BY createdAt DESC LIMIT 50');
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    const { phoneNumber, amount, termMonths, termLabel, interestRate, monthlyPayment, totalAmount } = req.body;
    if (!phoneNumber || !amount) return res.status(400).json({ error: 'phoneNumber e amount são obrigatórios' });
    const plan = {
      label: termLabel || `${Math.round((termMonths || 48) / 12)} anos`,
      years: Math.round((termMonths || 48) / 12),
      rate: interestRate || 3.55,
      monthly: monthlyPayment || amount * 0.0355
    };
    const result = await processLoanRequest(phoneNumber, parseFloat(amount), plan, {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SESSÃO USSD
// =============================================
app.get('/api/ussd/session', async (req, res) => {
  try {
    const activeSessions = Object.keys(sessions).map(id => ({
      sessionId: id,
      phoneNumber: sessions[id].phoneNumber,
      step: sessions[id].step,
      createdAt: sessions[id].createdAt
    }));
    res.json({ sessions: activeSessions, count: activeSessions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ussd/session/:sessionId', async (req, res) => {
  try {
    const session = sessions[req.params.sessionId];
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ussd/session — iniciar sessão e verificar elegibilidade no DB local
app.post('/api/ussd/session', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber é obrigatório' });

    let phone = phoneNumber.replace(/\D/g, '');
    if (phone.length === 9) phone = '258' + phone;
    else if (phone.length === 8) phone = '2588' + phone;

    const sessionId = 'SESS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phone]);

    if (customer && customer.status === 'approved' && customer.isActive && customer.customerLimit > 0) {
      const limit = customer.customerLimit;
      await logSms(phone,
        `PayJA: Parabéns ${customer.firstName}! Tem um limite pré-aprovado de ${fmt(limit)} MZN. Marque *299# para solicitar.`,
        'ELIGIBILITY');
      return res.json({
        sessionId, phoneNumber: phone, eligible: true, limit,
        customerName: customer.firstName,
        message: `CON Bem-vindo ao PayJA Nedbank!\nLimite pré-aprovado: ${fmt(limit)} MZN\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`
      });
    } else {
      const reason = customer ? 'Conta não aprovada para crédito' : 'Cliente não encontrado no sistema';
      await logSms(phone,
        `PayJA: Lamentamos, mas não é elegível para crédito. Motivo: ${reason}. Aproxime-se de um balcão Nedbank.`,
        'INELIGIBILITY');
      return res.json({
        sessionId, phoneNumber: phone, eligible: false,
        message: `END Desculpe, não é elegível no momento.\nMotivo: ${reason}.\nEnviámos um SMS com mais detalhes.`
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ENDPOINT USSD PRINCIPAL — fluxo completo
// =============================================
app.post('/api/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text = '' } = req.body || {};
    console.log(`📞 USSD: ${phoneNumber} - "${text}" (session=${sessionId})`);

    let s = sessions[sessionId] || (sessions[sessionId] = {
      id: sessionId,
      phoneNumber,
      step: 'INIT',
      createdAt: new Date().toISOString()
    });

    const t = String(text || '').trim();
    let response = '';

    // ── 1. INÍCIO — verificar elegibilidade no DB local ─────
    if (!t || t === '*299#' || t === '*898#' || s.step === 'INIT') {
      const eligData = await checkEligibilityLocal(phoneNumber);

      if (eligData.elegivel) {
        const limit = eligData.limite_aprovado || 0;
        s.step = 'MENU';
        s.limit = limit;
        s.clienteInfo = eligData.cliente || {};

        await logSms(phoneNumber,
          `PayJA: Parabéns! Tem um limite pré-aprovado de ${fmt(limit)} MZN. Marque *299# para solicitar.`,
          'ELIGIBILITY');

        response = `CON Bem-vindo ao PayJA Nedbank!\nLimite pré-aprovado: ${fmt(limit)} MZN\n\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`;
      } else {
        const motivo = eligData.motivo || 'Critérios de elegibilidade não atendidos.';
        await logSms(phoneNumber,
          `PayJA: Lamentamos, mas não é elegível para crédito. Motivo: ${motivo} Aproxime-se de um balcão Nedbank.`,
          'INELIGIBILITY');
        response = `END Desculpe, não é elegível no momento.\n\nMotivo: ${motivo}\n\nEnviámos um SMS com mais detalhes.`;
        delete sessions[sessionId];
      }
    }

    // ── 2. MENU PRINCIPAL ───────────────────────────────────
    else if (s.step === 'MENU') {
      if (t === '1') {
        s.step = 'AMOUNT';
        response = `CON Solicitar Crédito\nLimite disponível: ${fmt(s.limit || 0)} MZN\nMínimo: 4.000,00 MZN\n\nIntroduza o valor desejado (MZN):`;
      } else if (t === '2') {
        // Consultar empréstimos activos no DB local
        const loans = await db.all('SELECT * FROM loan_requests WHERE msisdn = ? AND status = "APPROVED" ORDER BY createdAt DESC LIMIT 3', [phoneNumber]);
        if (loans.length > 0) {
          const l = loans[0];
          response = `END Último empréstimo:\nValor: ${fmt(l.amount)} MZN\nPrazo: ${l.termLabel}\nPrestação: ${fmt(l.monthlyPayment)} MZN/mês\nEstado: ${l.status}`;
        } else {
          response = `END Sem empréstimos activos.\nLimite aprovado: ${fmt(s.limit || 0)} MZN\nMarque *299# para solicitar.`;
        }
        delete sessions[sessionId];
      } else if (t === '3') {
        response = 'END Ajuda: Ligue 800-PAYJA (gratuito)\nou WhatsApp +258 84 123 4567';
        delete sessions[sessionId];
      } else if (t === '0') {
        response = 'END Sessão encerrada. Obrigado por usar o PayJA!';
        delete sessions[sessionId];
      } else {
        response = `CON Opção inválida. Tente novamente.\n\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`;
      }
    }

    // ── 3. VALOR DO EMPRÉSTIMO ──────────────────────────────
    else if (s.step === 'AMOUNT') {
      const amount = parseFloat(t.replace(/[^0-9.]/g, ''));
      const minAmt = 4000;
      const maxAmt = s.limit || 0;

      if (isNaN(amount) || amount <= 0) {
        response = `CON Valor inválido. Introduza apenas números:\n(Mínimo: 4.000,00 MZN)`;
      } else if (amount < minAmt) {
        response = `CON Valor abaixo do mínimo permitido.\nMínimo: 4.000,00 MZN\n\nIntroduza outro valor:`;
      } else if (amount > maxAmt) {
        response = `CON Valor excede o seu limite aprovado.\nLimite: ${fmt(maxAmt)} MZN\n\nIntroduza um valor até ${fmt(maxAmt)} MZN:`;
      } else {
        s.amount = amount;
        s.step = 'PLAN';

        let planMenu = '';
        if (amount < 50000) {
          const p4 = calcPrestacao(amount, 3.55, 4);
          const p5 = calcPrestacao(amount, 3.18, 5);
          planMenu =
            `CON Valor: ${fmt(amount)} MZN\nEscolha o prazo de pagamento:\n\n` +
            `1. 4 anos - ${fmt(p4)} MZN/mês (3,55%/mês)\n` +
            `2. 5 anos - ${fmt(p5)} MZN/mês (3,18%/mês)\n` +
            `0. Voltar`;
          s.plans = [
            { label: '4 anos', years: 4, rate: 3.55, monthly: p4 },
            { label: '5 anos', years: 5, rate: 3.18, monthly: p5 }
          ];
        } else {
          const p3 = calcPrestacao(amount, 4.00, 3);
          const p4 = calcPrestacao(amount, 3.55, 4);
          const p5 = calcPrestacao(amount, 3.18, 5);
          planMenu =
            `CON Valor: ${fmt(amount)} MZN\nEscolha o prazo de pagamento:\n\n` +
            `1. 3 anos - ${fmt(p3)} MZN/mês (4,00%/mês)\n` +
            `2. 4 anos - ${fmt(p4)} MZN/mês (3,55%/mês)\n` +
            `3. 5 anos - ${fmt(p5)} MZN/mês (3,18%/mês)\n` +
            `0. Voltar`;
          s.plans = [
            { label: '3 anos', years: 3, rate: 4.00, monthly: p3 },
            { label: '4 anos', years: 4, rate: 3.55, monthly: p4 },
            { label: '5 anos', years: 5, rate: 3.18, monthly: p5 }
          ];
        }
        response = planMenu;
      }
    }

    // ── 4. ESCOLHA DO PLANO ─────────────────────────────────
    else if (s.step === 'PLAN') {
      if (t === '0') {
        s.step = 'AMOUNT';
        response = `CON Introduza o valor desejado (MZN):\n(Mínimo: 4.000,00 MZN | Máximo: ${fmt(s.limit || 0)} MZN)`;
      } else {
        const idx = parseInt(t, 10) - 1;
        const plans = s.plans || [];
        if (isNaN(idx) || idx < 0 || idx >= plans.length) {
          const lines = plans.map((p, i) => `${i + 1}. ${p.label} - ${fmt(p.monthly)} MZN/mês (${p.rate.toFixed(2).replace('.', ',')}%/mês)`).join('\n');
          response = `CON Opção inválida. Escolha:\n\n${lines}\n0. Voltar`;
        } else {
          const chosen = plans[idx];
          s.chosenPlan = chosen;
          s.step = 'CONFIRM';
          const totalMeses = chosen.years * 12;
          const totalPagar = chosen.monthly * totalMeses;
          response =
            `CON Resumo do Pedido:\n` +
            `Valor: ${fmt(s.amount)} MZN\n` +
            `Prazo: ${chosen.label} (${totalMeses} meses)\n` +
            `Taxa: ${chosen.rate.toFixed(2).replace('.', ',')}%/mês\n` +
            `Prestação: ${fmt(chosen.monthly)} MZN/mês\n` +
            `Total a pagar: ${fmt(totalPagar)} MZN\n\n` +
            `1. Confirmar\n2. Cancelar`;
        }
      }
    }

    // ── 5. CONFIRMAÇÃO — enviar ao PayJA → Banco Mock → SMS ─
    else if (s.step === 'CONFIRM') {
      if (t === '1') {
        const plan = s.chosenPlan || {};
        response = `END A processar o seu pedido...\nReceberá um SMS de confirmação em breve.\nObrigado por usar o PayJA!`;

        // Processar em background (não bloquear resposta USSD)
        setImmediate(async () => {
          await processLoanRequest(phoneNumber, s.amount, plan, s.clienteInfo);
        });

        delete sessions[sessionId];
      } else if (t === '2') {
        response = 'END Operação cancelada. Pode iniciar novamente com *299#.';
        delete sessions[sessionId];
      } else {
        response = `CON Opção inválida.\n\n1. Confirmar\n2. Cancelar`;
      }
    }

    // ── SESSÃO EXPIRADA ─────────────────────────────────────
    else {
      response = 'END Sessão expirada. Marque *299# para iniciar.';
      delete sessions[sessionId];
    }

    res.set('Content-Type', 'text/plain');
    return res.send(response);
  } catch (err) {
    console.error('❌ Erro USSD:', err);
    res.status(500).send('END Erro interno do sistema. Tente mais tarde.');
  }
});

// =============================================
// ROTAS DE ELEGIBILIDADE (webhook do PayJA)
// =============================================
app.post('/api/payja/ussd/eligibility', async (req, res) => {
  try {
    const { phoneNumber, eligible, creditLimit, minAmount, reason } = req.body || {};
    console.log(`📨 Decisão PayJA para ${phoneNumber}: ${eligible ? 'APROVADO' : 'REJEITADO'} (${creditLimit} MZN)`);

    if (eligible && creditLimit > 0) {
      const id = Math.floor(Math.random() * 900000000 + 100000000);
      await db.run(
        `INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt)
         VALUES (?, ?, ?, ?, 1, 'approved', ?)`,
        [id, phoneNumber, 'Cliente PayJA', creditLimit, Date.now()]
      );
      await logSms(phoneNumber,
        `PayJA: Parabéns! Foi pré-aprovado para crédito até ${fmt(creditLimit)} MZN. Marque *299# para solicitar.`,
        'ELIGIBILITY');
    }

    res.json({ success: true, message: 'Decisão registada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SINCRONIZAÇÃO
// =============================================
app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncWithPayja();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/status', async (req, res) => {
  try {
    const customers = await db.get('SELECT COUNT(*) as total FROM customers');
    const approved = await db.get('SELECT COUNT(*) as total FROM customers WHERE status = "approved"');
    const smsCount = await db.get('SELECT COUNT(*) as total FROM sms_logs');
    res.json({
      status: 'ok',
      customers: customers.total,
      approved: approved.total,
      smsSent: smsCount.total,
      payjaUrl: PAYJA_API_URL,
      bancoMockUrl: BANCO_MOCK_API_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// INICIALIZAÇÃO
// =============================================
async function startServer() {
  await initDatabase();

  // Sincronizar com PayJA ao iniciar
  setTimeout(async () => {
    console.log('🔄 Sincronização inicial com PayJA...');
    await syncWithPayja();
  }, 3000);

  // Sincronização periódica a cada 5 minutos
  setInterval(async () => {
    console.log(`⏰ Sincronização periódica em ${new Date().toISOString()}`);
    await syncWithPayja();
  }, 5 * 60 * 1000);

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ USSD Simulator v3.0 rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://${VPS_IP}:${PORT}`);
    console.log(`🔗 PayJA API: ${PAYJA_API_URL}`);
    console.log(`🏦 Banco Mock API: ${BANCO_MOCK_API_URL}`);
  });
}

startServer();
