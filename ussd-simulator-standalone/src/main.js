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

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..')));

// Configurações - usar IP local da VPS
const PAYJA_API_URL = process.env.PAYJA_API_URL || 'http://216.128.152.177:3000/api/v1';
const BANCO_MOCK_API_URL = process.env.BANCO_MOCK_API_URL || 'http://216.128.152.177:4500/api';
const VPS_IP = process.env.VPS_IP || '216.128.152.177';

// Banco de dados local para o simulador
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
      customerLimit REAL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
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
  `);
  
  console.log('✅ Database initialized');
}

// Memória para sessões USSD ativas
const sessions = {};

// Função para logar SMS
async function logSms(msisdn, message, type = 'SMS') {
  console.log(`📱 SMS para ${msisdn}: ${message}`);
  try {
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [msisdn, message, type, Date.now(), 'SENT']
    );
  } catch (err) {
    console.error('Erro ao salvar SMS:', err.message);
  }
}

// Função para sincronizar com PayJA
async function syncWithPayja() {
  try {
    console.log('🔄 Sincronizando clientes elegíveis do PayJA...');
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers`, { timeout: 10000 });
    const customers = response.data;
    
    if (Array.isArray(customers)) {
      let count = 0;
      for (const c of customers) {
        if (c.status === 'APPROVED' || c.verified) {
          const id = parseInt(c.id.replace(/\D/g, '').substring(0, 9)) || Date.now();
          await db.run(
            'INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, c.phoneNumber, c.name, c.creditLimit || 0, 1, 'approved', Date.now()]
          );
          count++;
        }
      }
      console.log(`✅ Sincronizados ${count} clientes elegíveis de ${customers.length} total`);
      return { success: count, total: customers.length };
    }
    return { success: 0, total: 0 };
  } catch (err) {
    console.error('❌ Erro na sincronização PayJA:', err.message);
    return { success: 0, error: err.message };
  }
}

// Função para verificar elegibilidade via Banco Mock
async function checkEligibility(phoneNumber) {
  try {
    const bankRes = await axios.post(`${BANCO_MOCK_API_URL}/validacao/consultar`, {
      telefone: phoneNumber
    }, { timeout: 8000 });
    return bankRes.data;
  } catch (err) {
    console.error(`❌ Erro ao consultar banco para ${phoneNumber}:`, err.message);
    return { elegivel: false, motivo: 'Erro de conexão com o banco.' };
  }
}

// --- ENDPOINTS ---

// Rota raiz - servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  service: 'USSD Simulator',
  version: '2.0.0',
  payjaUrl: PAYJA_API_URL,
  bancoMockUrl: BANCO_MOCK_API_URL,
  timestamp: new Date().toISOString()
}));

// =============================================
// ROTAS DE CLIENTES
// =============================================

// GET /api/customers - Listar clientes registados
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db.all('SELECT * FROM customers ORDER BY updatedAt DESC LIMIT 100');
    res.json(customers);
  } catch (err) {
    console.error('Erro ao listar clientes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers - Registar novo cliente
app.post('/api/customers', async (req, res) => {
  try {
    const { msisdn, phoneNumber, firstName, name, customerLimit, status } = req.body || {};
    const phone = msisdn || phoneNumber;
    const clientName = firstName || name || 'Cliente';
    
    if (!phone) {
      return res.status(400).json({ error: 'Número de telefone é obrigatório' });
    }
    
    const id = parseInt(phone.replace(/\D/g, '').substring(0, 9)) || Date.now();
    await db.run(
      'INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, phone, clientName, customerLimit || 0, 1, status || 'pending', Date.now()]
    );
    
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phone]);
    res.json({ success: true, customer });
  } catch (err) {
    console.error('Erro ao registar cliente:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:phone - Obter cliente por telefone
app.get('/api/customers/:phone', async (req, res) => {
  try {
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [req.params.phone]);
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SMS
// =============================================

// GET /api/sms/logs - Logs de SMS (rota que estava a dar 404)
app.get('/api/sms/logs', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM sms_logs ORDER BY sentAt DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms-logs - Alias para compatibilidade
app.get('/api/sms-logs', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM sms_logs ORDER BY sentAt DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sms/send - Enviar SMS
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, message, type } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ error: 'Destinatário e mensagem são obrigatórios' });
    }
    await logSms(to, message, type || 'SMS');
    res.json({ success: true, message: 'SMS enviado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SESSÕES USSD
// =============================================

// GET /api/ussd/session - Listar sessões ativas
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

// GET /api/ussd/session/:sessionId - Obter sessão específica
app.get('/api/ussd/session/:sessionId', async (req, res) => {
  try {
    const session = sessions[req.params.sessionId];
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ENDPOINT USSD PRINCIPAL
// =============================================

// POST /api/ussd - Processar sessão USSD
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
    
    // 1. Início da Sessão - Verificar elegibilidade
    if (!t || t === '*299#' || t === '*898#' || s.step === 'INIT') {
      try {
        const eligData = await checkEligibility(phoneNumber);
        
        if (eligData.elegivel) {
          const limit = eligData.limite_aprovado || 0;
          response = `CON Bem-vindo ao PayJA Nedbank!\nLimite pré-aprovado: ${limit.toLocaleString('pt-MZ')} MZN\n\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`;
          s.step = 'MENU';
          s.limit = limit;
          s.clienteInfo = eligData.cliente || {};
          
          // SMS de confirmação de elegibilidade
          await logSms(phoneNumber, `PayJA: Parabéns! Tem um limite pré-aprovado de ${limit.toLocaleString('pt-MZ')} MZN. Marque *299# para solicitar.`, 'ELIGIBILITY');
          
        } else {
          const motivo = eligData.motivo || 'Critérios de elegibilidade não atendidos.';
          const orientacao = eligData.orientacao || 'Aproxime-se de um balcão Nedbank.';
          
          // SMS de inelegibilidade
          const smsMsg = `PayJA: Lamentamos, mas não é elegível para crédito. Motivo: ${motivo} ${orientacao}`;
          await logSms(phoneNumber, smsMsg, 'INELIGIBILITY');
          
          response = `END Desculpe, não é elegível no momento.\n\nMotivo: ${motivo}\n\nEnviámos um SMS com mais detalhes.`;
          delete sessions[sessionId];
        }
      } catch (err) {
        console.error('Erro ao verificar elegibilidade:', err.message);
        response = 'END Erro de conexão. Tente mais tarde.';
        delete sessions[sessionId];
      }
    }
    // 2. Menu Principal
    else if (s.step === 'MENU') {
      if (t === '1') {
        response = `CON Valor a solicitar (MZN):\nLimite disponível: ${(s.limit || 0).toLocaleString('pt-MZ')} MZN\n\nDigite o valor:`;
        s.step = 'AMOUNT';
      } else if (t === '2') {
        response = `END Saldo disponível: 0.00 MZN\nLimite aprovado: ${(s.limit || 0).toLocaleString('pt-MZ')} MZN`;
        delete sessions[sessionId];
      } else if (t === '3') {
        response = 'END Ajuda: Ligue 800-PAYJA ou WhatsApp 84 123 4567';
        delete sessions[sessionId];
      } else if (t === '0') {
        response = 'END Sessão encerrada. Obrigado.';
        delete sessions[sessionId];
      } else {
        response = `CON Opção inválida.\n\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`;
      }
    }
    // 3. Valor do Empréstimo
    else if (s.step === 'AMOUNT') {
      const amount = parseFloat(t.replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        response = `CON Valor inválido. Insira um valor numérico:`;
      } else if (amount > s.limit) {
        response = `CON Valor excede o limite (${(s.limit || 0).toLocaleString('pt-MZ')} MZN).\nInsira um valor menor:`;
      } else {
        const total = amount * 1.15;
        response = `CON Confirmar pedido:\nValor: ${amount.toLocaleString('pt-MZ')} MZN\nJuros: 15%\nTotal a pagar: ${total.toLocaleString('pt-MZ')} MZN\n\n1. Confirmar\n2. Cancelar`;
        s.amount = amount;
        s.step = 'CONFIRM';
      }
    }
    // 4. Confirmação Final
    else if (s.step === 'CONFIRM') {
      if (t === '1') {
        response = `END Pedido enviado com sucesso!\nReceberá o valor em breve na sua conta e-Mola.\nObrigado por usar o PayJA!`;
        await logSms(phoneNumber, `PayJA: O seu crédito de ${(s.amount || 0).toLocaleString('pt-MZ')} MZN foi aprovado e está a ser processado. Receberá em breve.`, 'APPROVAL');
      } else {
        response = 'END Operação cancelada.';
      }
      delete sessions[sessionId];
    }
    else {
      response = 'END Sessão expirada. Marque *299# para iniciar.';
      delete sessions[sessionId];
    }
    
    res.set('Content-Type', 'text/plain');
    return res.send(response);
  } catch (err) {
    console.error('❌ Erro USSD:', err);
    res.status(500).send('END Erro interno do sistema.');
  }
});

// =============================================
// ROTAS DE ELEGIBILIDADE (para o PayJA enviar)
// =============================================

// POST /api/payja/ussd/eligibility - Receber decisão do PayJA
app.post('/api/payja/ussd/eligibility', async (req, res) => {
  try {
    const { phoneNumber, eligible, creditLimit, minAmount, reason } = req.body || {};
    console.log(`📨 Decisão PayJA recebida para ${phoneNumber}: ${eligible ? 'APROVADO' : 'REJEITADO'} (${creditLimit} MZN)`);
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    }
    
    const id = parseInt(phoneNumber.replace(/\D/g, '').substring(0, 9)) || Date.now();
    await db.run(
      'INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, phoneNumber, 'Cliente', creditLimit || 0, 1, eligible ? 'approved' : 'rejected', Date.now()]
    );
    
    // Enviar SMS baseado na decisão
    if (eligible) {
      await logSms(phoneNumber, `PayJA: Parabéns! Foi aprovado para crédito até ${(creditLimit || 0).toLocaleString('pt-MZ')} MZN. Marque *299# para solicitar.`, 'ELIGIBILITY_APPROVED');
    } else {
      await logSms(phoneNumber, `PayJA: Lamentamos, não é elegível. Motivo: ${reason || 'Critérios não atendidos'}. Dirija-se ao balcão.`, 'ELIGIBILITY_REJECTED');
    }
    
    res.json({ success: true, message: 'Decisão processada' });
  } catch (err) {
    console.error('Erro ao processar decisão PayJA:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// ROTAS DE SINCRONIZAÇÃO
// =============================================

// POST /api/sync - Sincronizar com PayJA
app.post('/api/sync', async (req, res) => {
  const result = await syncWithPayja();
  res.json(result);
});

// GET /api/sync/status - Status da sincronização
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
// ROTAS ADICIONAIS (compatibilidade frontend)
// =============================================

// GET /api/health - Alias para /health
app.get('/api/health', async (req, res) => {
  try {
    const customers = await db.get('SELECT COUNT(*) as total FROM customers');
    const approved = await db.get('SELECT COUNT(*) as total FROM customers WHERE status = "approved"');
    const smsCount = await db.get('SELECT COUNT(*) as total FROM sms_logs');
    res.json({
      status: 'ok',
      service: 'USSD Simulator',
      version: '2.0.0',
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

// POST /api/ussd/session - Iniciar sessão USSD (usado pelo frontend)
app.post('/api/ussd/session', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    }
    
    // Normalizar número
    let phone = phoneNumber.replace(/\D/g, '');
    if (phone.startsWith('258') && phone.length === 12) {
      // ok
    } else if (phone.length === 9) {
      phone = '258' + phone;
    } else if (phone.length === 8) {
      phone = '2588' + phone;
    }
    
    // Gerar sessionId único
    const sessionId = 'SESS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Chamar o endpoint USSD principal para iniciar a sessão
    const ussdReq = { sessionId, phoneNumber: phone, text: '' };
    
    // Processar internamente
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phone]);
    
    // Registar sessão na DB
    const now = Date.now();
    await db.run(
      `INSERT OR REPLACE INTO ussd_sessions (sessionId, phoneNumber, step, data, createdAt, updatedAt)
       VALUES (?, ?, 'INIT', '{}', ?, ?)`,
      [sessionId, phone, now, now]
    );
    
    // Enviar SMS de elegibilidade se cliente existir
    if (customer && customer.status === 'approved' && customer.isActive) {
      const limit = new Intl.NumberFormat('pt-MZ').format(customer.customerLimit);
      const smsMsg = `PayJA: Parabéns! Tem um limite pré-aprovado de ${limit} MZN. Marque *299# para solicitar.`;
      await db.run(
        'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
        [phone, smsMsg, 'ELIGIBILITY', Date.now(), 'SENT']
      );
      console.log(`📱 SMS elegibilidade para ${phone}: ${smsMsg}`);
      
      const limit2 = new Intl.NumberFormat('pt-MZ').format(customer.customerLimit);
      return res.json({
        sessionId,
        phoneNumber: phone,
        eligible: true,
        limit: customer.customerLimit,
        message: `CON Bem-vindo ao PayJA Nedbank!\nLimite pré-aprovado: ${limit2} MZN\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`,
        customerName: customer.firstName
      });
    } else {
      // Não elegível
      const reason = customer ? 'Conta não aprovada' : 'Cliente não encontrado no sistema bancário';
      const smsMsg = `PayJA: Lamentamos, mas não é elegível para crédito. Motivo: ${reason}. Aproxime-se de um balcão Nedbank.`;
      await db.run(
        'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
        [phone, smsMsg, 'INELIGIBILITY', Date.now(), 'SENT']
      );
      console.log(`📱 SMS inelegibilidade para ${phone}`);
      
      return res.json({
        sessionId,
        phoneNumber: phone,
        eligible: false,
        message: `END Desculpe, não é elegível no momento.\nMotivo: ${reason}.\nEnviámos um SMS com mais detalhes.`
      });
    }
  } catch (err) {
    console.error('Erro POST /api/ussd/session:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loans - Registar empréstimo
app.post('/api/loans', async (req, res) => {
  try {
    const { phoneNumber, customerName, amount, term, interest, reason, bank, status } = req.body;
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'phoneNumber e amount são obrigatórios' });
    }
    
    // Tentar registar no PayJA backend
    try {
      const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
      if (customer) {
        await axios.post(`${PAYJA_API_URL}/loans`, {
          phoneNumber,
          amount: parseFloat(amount),
          termMonths: 1,
          reason: reason || 'Pedido via USSD',
          bankPartner: bank || 'Nedbank'
        }, { timeout: 5000 });
        console.log(`💰 Empréstimo registado no PayJA: ${phoneNumber} - ${amount} MZN`);
      }
    } catch (payjaErr) {
      console.warn('Aviso: não foi possível registar no PayJA:', payjaErr.message);
    }
    
    // Enviar SMS de confirmação
    const formattedAmount = new Intl.NumberFormat('pt-MZ').format(parseFloat(amount));
    const smsMsg = `PayJA: O seu crédito de ${formattedAmount} MZN foi aprovado e está a ser processado. Receberá em breve.`;
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [phoneNumber, smsMsg, 'LOAN_APPROVED', Date.now(), 'SENT']
    );
    
    res.json({ success: true, message: 'Empréstimo registado com sucesso', amount, phoneNumber });
  } catch (err) {
    console.error('Erro POST /api/loans:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/register - Registar novo cliente
app.post('/api/customers/register', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, bi, institution, otp } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    }
    
    // Verificar/criar cliente na DB local
    const existing = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
    if (existing) {
      return res.json({ success: true, message: 'Cliente já registado', customer: existing });
    }
    
    // Tentar registar no PayJA
    try {
      await axios.post(`${PAYJA_API_URL}/customers/register`, {
        msisdn: phoneNumber,
        name: name || 'Cliente USSD',
        nuit,
        bi,
        institution
      }, { timeout: 5000 });
    } catch (payjaErr) {
      console.warn('Aviso: não foi possível registar no PayJA:', payjaErr.message);
    }
    
    // Inserir na DB local com status pending
    const id = Math.floor(Math.random() * 900000000) + 100000000;
    await db.run(
      `INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt)
       VALUES (?, ?, ?, 0, 1, 'pending', ?)`,
      [id, phoneNumber, name || 'Cliente USSD', Date.now()]
    );
    
    // SMS de confirmação de registo
    const smsMsg = `PayJA: O seu registo foi recebido. Aguarde a análise do seu pedido. Será notificado em breve.`;
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [phoneNumber, smsMsg, 'REGISTRATION', Date.now(), 'SENT']
    );
    
    res.json({ success: true, message: 'Registo submetido com sucesso', phoneNumber });
  } catch (err) {
    console.error('Erro POST /api/customers/register:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms/logs/:id - Apagar SMS específico
app.delete('/api/sms/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM sms_logs WHERE id = ?', [id]);
    res.json({ success: true, message: `SMS ${id} apagado` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms/logs - Apagar todos os SMS
app.delete('/api/sms/logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true, message: 'Todos os SMS apagados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms-logs/:id - Alias
app.delete('/api/sms-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM sms_logs WHERE id = ?', [id]);
    res.json({ success: true, message: `SMS ${id} apagado` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms-logs - Alias
app.delete('/api/sms-logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true, message: 'Todos os SMS apagados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loans - Listar empréstimos
app.get('/api/loans', async (req, res) => {
  try {
    // Tentar buscar do PayJA
    try {
      const response = await axios.get(`${PAYJA_API_URL}/loans`, { timeout: 5000 });
      return res.json(response.data);
    } catch (payjaErr) {
      // Retornar lista vazia se PayJA não disponível
      return res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =============================================
// ROTAS ADICIONAIS (compatibilidade frontend)
// =============================================

// GET /api/health - Alias para /health
app.get('/api/health', async (req, res) => {
  try {
    const customers = await db.get('SELECT COUNT(*) as total FROM customers');
    const approved = await db.get('SELECT COUNT(*) as total FROM customers WHERE status = "approved"');
    const smsCount = await db.get('SELECT COUNT(*) as total FROM sms_logs');
    res.json({
      status: 'ok',
      service: 'USSD Simulator',
      version: '2.0.0',
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

// POST /api/ussd/session - Iniciar sessão USSD (usado pelo frontend)
app.post('/api/ussd/session', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    }
    
    // Normalizar número
    let phone = phoneNumber.replace(/\D/g, '');
    if (phone.startsWith('258') && phone.length === 12) {
      // ok
    } else if (phone.length === 9) {
      phone = '258' + phone;
    } else if (phone.length === 8) {
      phone = '2588' + phone;
    }
    
    // Gerar sessionId único
    const sessionId = 'SESS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Chamar o endpoint USSD principal para iniciar a sessão
    const ussdReq = { sessionId, phoneNumber: phone, text: '' };
    
    // Processar internamente
    const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phone]);
    
    // Registar sessão na DB
    const now = Date.now();
    await db.run(
      `INSERT OR REPLACE INTO ussd_sessions (sessionId, phoneNumber, step, data, createdAt, updatedAt)
       VALUES (?, ?, 'INIT', '{}', ?, ?)`,
      [sessionId, phone, now, now]
    );
    
    // Enviar SMS de elegibilidade se cliente existir
    if (customer && customer.status === 'approved' && customer.isActive) {
      const limit = new Intl.NumberFormat('pt-MZ').format(customer.customerLimit);
      const smsMsg = `PayJA: Parabéns! Tem um limite pré-aprovado de ${limit} MZN. Marque *299# para solicitar.`;
      await db.run(
        'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
        [phone, smsMsg, 'ELIGIBILITY', Date.now(), 'SENT']
      );
      console.log(`📱 SMS elegibilidade para ${phone}: ${smsMsg}`);
      
      const limit2 = new Intl.NumberFormat('pt-MZ').format(customer.customerLimit);
      return res.json({
        sessionId,
        phoneNumber: phone,
        eligible: true,
        limit: customer.customerLimit,
        message: `CON Bem-vindo ao PayJA Nedbank!\nLimite pré-aprovado: ${limit2} MZN\n1. Solicitar Crédito\n2. Consultar Saldo\n3. Ajuda\n0. Sair`,
        customerName: customer.firstName
      });
    } else {
      // Não elegível
      const reason = customer ? 'Conta não aprovada' : 'Cliente não encontrado no sistema bancário';
      const smsMsg = `PayJA: Lamentamos, mas não é elegível para crédito. Motivo: ${reason}. Aproxime-se de um balcão Nedbank.`;
      await db.run(
        'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
        [phone, smsMsg, 'INELIGIBILITY', Date.now(), 'SENT']
      );
      console.log(`📱 SMS inelegibilidade para ${phone}`);
      
      return res.json({
        sessionId,
        phoneNumber: phone,
        eligible: false,
        message: `END Desculpe, não é elegível no momento.\nMotivo: ${reason}.\nEnviámos um SMS com mais detalhes.`
      });
    }
  } catch (err) {
    console.error('Erro POST /api/ussd/session:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loans - Registar empréstimo
app.post('/api/loans', async (req, res) => {
  try {
    const { phoneNumber, customerName, amount, term, interest, reason, bank, status } = req.body;
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'phoneNumber e amount são obrigatórios' });
    }
    
    // Tentar registar no PayJA backend
    try {
      const customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
      if (customer) {
        await axios.post(`${PAYJA_API_URL}/loans`, {
          phoneNumber,
          amount: parseFloat(amount),
          termMonths: 1,
          reason: reason || 'Pedido via USSD',
          bankPartner: bank || 'Nedbank'
        }, { timeout: 5000 });
        console.log(`💰 Empréstimo registado no PayJA: ${phoneNumber} - ${amount} MZN`);
      }
    } catch (payjaErr) {
      console.warn('Aviso: não foi possível registar no PayJA:', payjaErr.message);
    }
    
    // Enviar SMS de confirmação
    const formattedAmount = new Intl.NumberFormat('pt-MZ').format(parseFloat(amount));
    const smsMsg = `PayJA: O seu crédito de ${formattedAmount} MZN foi aprovado e está a ser processado. Receberá em breve.`;
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [phoneNumber, smsMsg, 'LOAN_APPROVED', Date.now(), 'SENT']
    );
    
    res.json({ success: true, message: 'Empréstimo registado com sucesso', amount, phoneNumber });
  } catch (err) {
    console.error('Erro POST /api/loans:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/register - Registar novo cliente
app.post('/api/customers/register', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, bi, institution, otp } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber é obrigatório' });
    }
    
    // Verificar/criar cliente na DB local
    const existing = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
    if (existing) {
      return res.json({ success: true, message: 'Cliente já registado', customer: existing });
    }
    
    // Tentar registar no PayJA
    try {
      await axios.post(`${PAYJA_API_URL}/customers/register`, {
        msisdn: phoneNumber,
        name: name || 'Cliente USSD',
        nuit,
        bi,
        institution
      }, { timeout: 5000 });
    } catch (payjaErr) {
      console.warn('Aviso: não foi possível registar no PayJA:', payjaErr.message);
    }
    
    // Inserir na DB local com status pending
    const id = Math.floor(Math.random() * 900000000) + 100000000;
    await db.run(
      `INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt)
       VALUES (?, ?, ?, 0, 1, 'pending', ?)`,
      [id, phoneNumber, name || 'Cliente USSD', Date.now()]
    );
    
    // SMS de confirmação de registo
    const smsMsg = `PayJA: O seu registo foi recebido. Aguarde a análise do seu pedido. Será notificado em breve.`;
    await db.run(
      'INSERT INTO sms_logs (msisdn, message, type, sentAt, status) VALUES (?, ?, ?, ?, ?)',
      [phoneNumber, smsMsg, 'REGISTRATION', Date.now(), 'SENT']
    );
    
    res.json({ success: true, message: 'Registo submetido com sucesso', phoneNumber });
  } catch (err) {
    console.error('Erro POST /api/customers/register:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms/logs/:id - Apagar SMS específico
app.delete('/api/sms/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM sms_logs WHERE id = ?', [id]);
    res.json({ success: true, message: `SMS ${id} apagado` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms/logs - Apagar todos os SMS
app.delete('/api/sms/logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true, message: 'Todos os SMS apagados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms-logs/:id - Alias
app.delete('/api/sms-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM sms_logs WHERE id = ?', [id]);
    res.json({ success: true, message: `SMS ${id} apagado` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sms-logs - Alias
app.delete('/api/sms-logs', async (req, res) => {
  try {
    await db.run('DELETE FROM sms_logs');
    res.json({ success: true, message: 'Todos os SMS apagados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loans - Listar empréstimos
app.get('/api/loans', async (req, res) => {
  try {
    // Tentar buscar do PayJA
    try {
      const response = await axios.get(`${PAYJA_API_URL}/loans`, { timeout: 5000 });
      return res.json(response.data);
    } catch (payjaErr) {
      // Retornar lista vazia se PayJA não disponível
      return res.json([]);
    }
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ USSD Simulator rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://${VPS_IP}:${PORT}`);
    console.log(`🔗 PayJA API: ${PAYJA_API_URL}`);
    console.log(`🏦 Banco Mock API: ${BANCO_MOCK_API_URL}`);
  });
}

startServer();
