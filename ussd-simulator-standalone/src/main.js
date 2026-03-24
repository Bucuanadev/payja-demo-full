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

// Configurações
const PAYJA_API_URL = process.env.PAYJA_API_URL || 'http://104.207.142.188:3000/api/v1';
const BANCO_MOCK_API_URL = process.env.BANCO_MOCK_API_URL || 'http://104.207.142.188:4500/api';

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
      customerLimit REAL,
      isActive INTEGER DEFAULT 1,
      status TEXT,
      updatedAt INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msisdn TEXT,
      message TEXT,
      sentAt INTEGER
    );
  `);
}

// Memória para sessões USSD
const sessions = {};

// Função para logar SMS
async function logSms(msisdn, message) {
  console.log(`📱 SMS para ${msisdn}: ${message}`);
  await db.run('INSERT INTO sms_logs (msisdn, message, sentAt) VALUES (?, ?, ?)', [msisdn, message, Date.now()]);
}

// Função para sincronizar com PayJA
async function syncWithPayja() {
  try {
    console.log('🔄 Sincronizando clientes elegíveis do PayJA...');
    const response = await axios.get(`${PAYJA_API_URL}/admin/customers`, { timeout: 5000 });
    const customers = response.data;
    
    if (Array.isArray(customers)) {
      let count = 0;
      for (const c of customers) {
        if (c.verified) {
          await db.run(
            'INSERT OR REPLACE INTO customers (id, msisdn, firstName, customerLimit, isActive, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [parseInt(c.id.replace(/\D/g, '').substring(0, 9)) || Date.now(), c.phoneNumber, c.name, c.creditLimit || 0, 1, 'verified', Date.now()]
          );
          count++;
        }
      }
      return { success: count, total: customers.length };
    }
    return { success: 0, total: 0 };
  } catch (err) {
    console.error('❌ Erro na sincronização:', err.message);
    return { success: 0, error: err.message };
  }
}

// --- ENDPOINTS ---

// Rota raiz - servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Endpoint USSD
app.post('/api/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text = '' } = req.body || {};
    console.log(`📞 USSD: ${phoneNumber} - "${text}" (session=${sessionId})`);
    
    let s = sessions[sessionId] || (sessions[sessionId] = { id: sessionId, phoneNumber, step: 'INIT' });
    const t = String(text || '').trim();
    let response = '';
    
    // 1. Início da Sessão
    if (!t || s.step === 'INIT') {
      // Verificar elegibilidade no Banco Mock em tempo real
      try {
        const bankRes = await axios.post(`${BANCO_MOCK_API_URL}/validacao/consultar`, {
          telefone: phoneNumber
        }, { timeout: 5000 });
        
        const data = bankRes.data;
        
        if (data.elegivel) {
          response = `CON Bem-vindo ao PayJA Nedbank!\nVocê tem um limite pré-aprovado de ${data.limite_aprovado} MZN.\n\n1. Solicitar Crédito\n2. Consultar Saldo\n0. Sair`;
          s.step = 'MENU';
          s.limit = data.limite_aprovado;
        } else {
          // NÃO ELEGÍVEL - Enviar SMS Automático e encerrar
          const motivo = data.motivo || 'Critérios de elegibilidade não atendidos.';
          const orientacao = data.orientacao || 'Aproxime-se de um balcão Nedbank.';
          
          const smsMsg = `PayJA: Lamentamos, mas o seu pedido de crédito não foi aprovado. Motivo: ${motivo} ${orientacao}`;
          await logSms(phoneNumber, smsMsg);
          
          response = `END Desculpe, você não é elegível no momento.\n\nMotivo: ${motivo}\n\nEnviamos um SMS com mais detalhes.`;
          delete sessions[sessionId];
        }
      } catch (err) {
        console.error('Erro ao consultar banco:', err.message);
        response = 'END Erro de conexão com o banco. Tente mais tarde.';
        delete sessions[sessionId];
      }
    } 
    // 2. Menu Principal
    else if (s.step === 'MENU') {
      if (t === '1') {
        response = `CON Quanto deseja solicitar? (Máx: ${s.limit} MZN)`;
        s.step = 'AMOUNT';
      } else if (t === '2') {
        response = `END O seu saldo actual é de 0.00 MZN.`;
        delete sessions[sessionId];
      } else {
        response = 'END Sessão encerrada.';
        delete sessions[sessionId];
      }
    }
    // 3. Valor do Empréstimo
    else if (s.step === 'AMOUNT') {
      const amount = parseFloat(t);
      if (isNaN(amount) || amount <= 0 || amount > s.limit) {
        response = `CON Valor inválido. Insira um valor entre 1 e ${s.limit} MZN:`;
      } else {
        response = `CON Confirmar crédito de ${amount} MZN?\n1. Sim\n2. Não`;
        s.amount = amount;
        s.step = 'CONFIRM';
      }
    }
    // 4. Confirmação Final
    else if (s.step === 'CONFIRM') {
      if (t === '1') {
        // Simular envio para o PayJA
        response = `END Pedido enviado com sucesso!\nEm instantes receberá o valor na sua conta e-Mola.\nObrigado por usar o PayJA.`;
        await logSms(phoneNumber, `PayJA: O seu crédito de ${s.amount} MZN foi aprovado e está a ser processado.`);
      } else {
        response = 'END Operação cancelada.';
      }
      delete sessions[sessionId];
    }
    
    res.set('Content-Type', 'text/plain');
    return res.send(response);
  } catch (err) {
    console.error('❌ Erro USSD:', err);
    res.status(500).send('END Erro interno do sistema.');
  }
});

// Endpoint para obter logs de SMS
app.get('/api/sms-logs', async (req, res) => {
  const logs = await db.all('SELECT * FROM sms_logs ORDER BY sentAt DESC LIMIT 50');
  res.json(logs);
});

// Endpoint para sincronizar com PayJA
app.post('/api/sync', async (req, res) => {
  const result = await syncWithPayja();
  res.json(result);
});

async function startServer() {
  await initDatabase();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ USSD Simulator rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
  });
}

startServer();
