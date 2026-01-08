// Endpoint para salvar clientes no arquivo simulator-customers.json
app.post('/api/customers/save-to-json', async (req, res) => {
  try {
    const clientes = req.body.customers || [];
    fs.writeFileSync(PRISMA_JSON_PATH, JSON.stringify(clientes, null, 2));
    res.json({ ok: true, saved: clientes.length });
    console.log(`[SaveToJson] ${new Date().toISOString()}: ${clientes.length} clientes salvos em simulator-customers.json`);
  } catch (err) {
    console.error('Erro ao salvar clientes no JSON:', err.message);
    res.status(500).json({ error: 'Erro ao salvar clientes no JSON' });
  }
});
// Importação automática de simulator-customers.json para o banco Prisma
const fs = require('fs');
const path = require('path');
const PRISMA_JSON_PATH = path.join(__dirname, '../simulator-customers.json');

async function autoImportCustomersFromJson() {
  if (!fs.existsSync(PRISMA_JSON_PATH)) return;
  try {
    const raw = fs.readFileSync(PRISMA_JSON_PATH, 'utf-8');
    const customers = JSON.parse(raw);
    let count = 0;
    for (const c of customers) {
      await prisma.customer.upsert({
        where: { phone: c.phoneNumber },
        update: {
          fullName: c.registrationData?.name || '',
          nuit: c.registrationData?.nuit || '',
          status: c.status ? c.status.toUpperCase() : 'PENDING',
          registrationDate: c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date(),
        },
        create: {
          phone: c.phoneNumber,
          fullName: c.registrationData?.name || '',
          nuit: c.registrationData?.nuit || '',
          status: c.status ? c.status.toUpperCase() : 'PENDING',
          registrationDate: c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date(),
        }
      });
      count++;
    }
    if (count > 0) {
      console.log(`[AutoImport] ${new Date().toISOString()}: ${count} clientes importados do simulator-customers.json para o Prisma.`);
    }
  } catch (err) {
    console.error('Erro no auto-import de clientes:', err.message);
  }
}

// Executa a cada 15 segundos
setInterval(autoImportCustomersFromJson, 15000);
// src/main.js - VERSÃO CORRIGIDA E INTEGRADA
const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./prismaClient');
// Log do caminho do banco usado pelo Prisma
const { Prisma } = require('@prisma/client');
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith('file:')) {
  const path = require('path');
  const dbPath = dbUrl.replace('file:', '').replace(/"/g, '');
  console.log('[Prisma] Usando banco de dados:', path.resolve(__dirname, '../prisma', dbPath));
} else {
  console.log('[Prisma] DATABASE_URL:', dbUrl);
}

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
    console.log(`📥 Processando cliente: ${customer.phoneNumber}`);
    
    // Converter dados - SEMPRE tratar creditScore como string
    const id = parseInt(customer.phoneNumber, 10);
    const nameParts = customer.name ? customer.name.trim().split(' ') : ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // creditScore como string (ou null se undefined)
    const creditScore = customer.creditScore !== undefined && customer.creditScore !== null 
      ? String(customer.creditScore) 
      : null;
    
    // Converter outros campos
    const balance = parseFloat(customer.salary) || 0;
    const customerLimit = parseFloat(customer.creditLimit) || 0;
    const isActive = customer.verified === 1 ? 1 : 0;
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
    
    // Inserir no banco
    const result = await db.run(
      `INSERT OR REPLACE INTO customers 
       (id, msisdn, firstName, lastName, creditScore, 
        nuit, biNumber, balance, customerLimit, 
        isActive, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        customer.phoneNumber || '',
        firstName,
        lastName,
        creditScore, // Agora sempre string ou null
        customer.nuit || null,
        customer.biNumber || null,
        balance,
        customerLimit,
        isActive,
        status,
        updatedAt
      ]
    );
    
    console.log(`✅ Cliente ${customer.phoneNumber} sincronizado: ${result.changes} linha(s) afetada(s)`);
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
    
    const PAYJA_API_URL = process.env.PAYJA_API_URL || 'http://155.138.228.89:3000/api/v1/integrations/ussd/customers';
    
    const response = await fetch(PAYJA_API_URL);
    
    if (!response.ok) {
      throw new Error(`API PayJA retornou status ${response.status}`);
    }
    
    const customers = await response.json();
    
    console.log(`📊 Encontrados ${customers.length} clientes na API PayJA`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const customer of customers) {
      try {
        await syncCustomerToDatabase(customer);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Falha ao sincronizar ${customer.phoneNumber}:`, error.message);
        errorCount++;
      }
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
    
      // Ensure compatibility with older/newer schemas: add missing columns if needed
      try {
        const pragma = await db.all("PRAGMA table_info(customers)");
        const existing = pragma.map(p => p.name);
        const needed = [];
        if (!existing.includes('msisdn')) needed.push({ name: 'msisdn', type: 'TEXT' });
        if (!existing.includes('phoneNumber')) needed.push({ name: 'phoneNumber', type: 'TEXT' });
        if (!existing.includes('phone')) needed.push({ name: 'phone', type: 'TEXT' });
        if (!existing.includes('customerLimit')) needed.push({ name: 'customerLimit', type: 'REAL DEFAULT 0' });
        if (!existing.includes('verified')) needed.push({ name: 'verified', type: 'INTEGER DEFAULT 0' });
        if (!existing.includes('status')) needed.push({ name: 'status', type: "TEXT DEFAULT 'unknown'" });
        if (!existing.includes('isActive')) needed.push({ name: 'isActive', type: 'INTEGER DEFAULT 0' });
        for (const col of needed) {
          try {
            console.log(`🔧 Adicionando coluna ausente: ${col.name} ${col.type}`);
            await db.exec(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.type}`);
          } catch (err) {
            console.warn(`⚠️ Falha ao adicionar coluna ${col.name}:`, err && err.message ? err.message : err);
          }
        }
        try {
          await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_msisdn ON customers(msisdn)');
        } catch (e) {
          console.warn('⚠️ Não foi possível criar índice único msisdn:', e && e.message ? e.message : e);
        }
        try {
          await db.run("UPDATE customers SET isActive = 1, verified = 1 WHERE lower(status) IN ('registered','active','verified')");
        } catch (e) {
          console.warn('⚠️ Falha ao backfill de status para isActive/verified:', e && e.message ? e.message : e);
        }
      } catch (err) {
        console.warn('⚠️ Não foi possível verificar/escrever colunas extras no DB:', err && err.message ? err.message : err);
      }

      console.log('✅ Banco de dados inicializado');

      // Adicionar db ao app para uso nas rotas
      app.locals.db = db;

      return db;
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// 7. Rotas básicas

// Health check (compatível)
app.get('/api/health', (req, res) => {
  res.json({ service: 'ussd-simulator', status: 'ok' });
});

// Lista clientes ativos para o PayJA importar
app.get('/api/payja/ussd/new-customers', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  const customers = await db.all('SELECT * FROM customers WHERE isActive = 1 OR verified = 1');
  res.json(customers.map(c => ({
    phoneNumber: c.msisdn,
    name: c.firstName + ' ' + c.lastName,
    nuit: c.nuit,
    biNumber: c.biNumber,
    institution: c.salaryBank,
    verified: c.isActive === 1 || c.verified === 1
  })));
});

// PayJA devolve limite e elegibilidade ao simulador
app.post('/api/payja/ussd/eligibility', async (req, res) => {
  const { phoneNumber, creditLimit } = req.body;
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  await db.run('UPDATE customers SET customerLimit = ? WHERE msisdn = ?', [creditLimit, phoneNumber]);
  res.json({ ok: true });
});

// PayJA marca cliente como verificado
app.post('/api/payja/ussd/mark-verified', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!db) return res.status(500).json({ error: 'DB não disponível' });
  await db.run('UPDATE customers SET isActive = 1 WHERE msisdn = ?', [phoneNumber]);
  sendConfirmationSms(phoneNumber, '');
  res.json({ ok: true });
});

// Logs de SMS simulados
let smsLogs = [];
const recentSmsSentMain = new Map();
const RECENT_SMS_TTL_MAIN = parseInt(process.env.RECENT_SMS_TTL_MS || '86400000', 10);
app.get('/api/sms/logs', (req, res) => {
  res.json({ data: smsLogs });
});

function sendConfirmationSms(phoneNumber, name) {
  const key = String(phoneNumber) + '|confirmation';
  const now = Date.now();
  const last = recentSmsSentMain.get(key);
  if (last && (now - last) < RECENT_SMS_TTL_MAIN) {
    console.log(`[SMS-DEDUPE] (main.js) Skipping duplicate confirmation SMS to ${phoneNumber}`);
    return;
  }
  const entry = {
    id: String(Date.now()),
    phoneNumber,
    message: `✓ Registo confirmado${name ? ' para ' + name : ''}`,
    sentAt: new Date().toISOString()
  };
  smsLogs.push(entry);
  recentSmsSentMain.set(key, now);
  setTimeout(() => { try { recentSmsSentMain.delete(key); } catch(e){} }, RECENT_SMS_TTL_MAIN + 1000);
}

function sendLoanDisbursedSms(phoneNumber, amount) {
  smsLogs.push({
    id: String(Date.now()),
    phoneNumber,
    message: `💰 Empréstimo desembolsado: ${amount} MZN`,
    sentAt: new Date().toISOString()
  });
}

// Cria empréstimo no simulador
let loans = [];
app.post('/api/loans', (req, res) => {
  const loan = { ...req.body, id: String(Date.now()), status: 'pending', createdAt: new Date().toISOString() };
  loans.push(loan);
  res.json(loan);
});

// Lista empréstimos criados no simulador
app.get('/api/loans', (req, res) => {
  res.json(loans);
});

// Atualiza status do empréstimo
app.patch('/api/loans/:id/status', (req, res) => {
  const loan = loans.find(l => l.id === req.params.id);
  if (loan) {
    loan.status = req.body.status;
    if (loan.status === 'DISBURSED') {
      sendLoanDisbursedSms(loan.phoneNumber, loan.amount);
    }
    res.json(loan);
  } else {
    res.status(404).json({ error: 'Empréstimo não encontrado' });
  }
});

// Cadastro de cliente via UI/USSD
app.post('/api/customers/register', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, biNumber, institution } = req.body;
    if (!phoneNumber || !name || !nuit) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }
    const customer = await prisma.customer.upsert({
      where: { phone: phoneNumber },
      update: {
        fullName: name,
        nuit,
        status: 'PENDING',
        province: null,
        district: null,
        address: null,
        birthDate: null,
        lastAccess: new Date(),
      },
      create: {
        phone: phoneNumber,
        fullName: name,
        nuit,
        status: 'PENDING',
        province: null,
        district: null,
        address: null,
        birthDate: null,
        registrationDate: new Date(),
        lastAccess: new Date(),
      },
    });
    res.json({ ok: true, customer });
  } catch (error) {
    console.error('Erro ao registrar cliente (Prisma):', error);
    res.status(500).json({ error: 'Erro ao registrar cliente' });
  }
});

// Importa clientes de storage da UI
app.post('/api/customers/sync-from-localStorage', async (req, res) => {
  const imported = req.body.customers || [];
  let importedCount = 0;
  for (const c of imported) {
    try {
      await prisma.customer.upsert({
        where: { phone: c.phoneNumber },
        update: {
          fullName: c.name || c.registrationData?.name || '',
          nuit: c.nuit || c.registrationData?.nuit || '',
          status: c.status ? c.status.toUpperCase() : 'PENDING',
          registrationDate: c.createdAt ? new Date(c.createdAt) : (c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date()),
        },
        create: {
          phone: c.phoneNumber,
          fullName: c.name || c.registrationData?.name || '',
          nuit: c.nuit || c.registrationData?.nuit || '',
          status: c.status ? c.status.toUpperCase() : 'PENDING',
          registrationDate: c.createdAt ? new Date(c.createdAt) : (c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date()),
        }
      });
      importedCount++;
    } catch (err) {
      // Se houver erro de unique, ignora
    }
  }
  res.json({ imported: importedCount });
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
      path: './database.sqlite'
    }
  });
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

// 9. Rota para forçar sincronização
app.post('/api/sync', async (req, res) => {
  try {
    console.log('🔄 Sincronização manual solicitada');
    const result = await syncWithPayja();
    
    res.json({
      message: 'Sincronização manual executada',
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro na sincronização manual:', error);
    res.status(500).json({ 
      error: 'Erro na sincronização',
      message: error.message 
    });
  }
});

// 10. Rota para ver clientes
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
    res.json({
      success: true,
      count: customers.length,
      customers: customers.map(c => ({
        phoneNumber: c.phone,
        name: c.fullName,
        nuit: c.nuit,
        status: c.status,
        registrationDate: c.registrationDate ? c.registrationDate.toISOString() : null,
        createdAt: c.createdAt ? c.createdAt.toISOString() : null,
        updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null
      }))
    });
  } catch (error) {
    console.error('❌ Erro ao buscar clientes (Prisma):', error);
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
    
    const customer = await db.get(
      'SELECT * FROM customers WHERE msisdn = ?', 
      [msisdn]
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    res.json({
      success: true,
      customer: {
        ...customer,
        isActive: customer.isActive === 1,
        updatedAt: new Date(customer.updatedAt).toISOString()
      }
    });
    
  } catch (error) {
    console.error(`❌ Erro ao buscar cliente ${req.params.msisdn}:`, error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// 12. Inicialização do servidor
async function startServer() {
  try {
    const PORT = process.env.PORT || 3002;
    
    console.log('🚀 Iniciando USSD Simulator...');
    
    // Inicializar banco de dados
    await initDatabase();
    
    // Executar primeira sincronização
    setTimeout(async () => {
      console.log('🔄 Executando sincronização inicial...');
      const syncResult = await syncWithPayja();
      console.log(`📊 Resultado inicial: ${syncResult.success} sucessos, ${syncResult.errors} erros`);
      
      // Configurar sincronização periódica (5 minutos)
      setInterval(async () => {
        console.log('⏰ Executando sincronização periódica...');
        await syncWithPayja();
      }, 5 * 60 * 1000);
      
    }, 3000); // Esperar 3 segundos após o servidor subir
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
✅ Servidor iniciado com sucesso!
📡 Porta: ${PORT}

📋 Endpoints disponíveis:
  • Health check:   GET    http://localhost:${PORT}/health
  • Status:         GET    http://localhost:${PORT}/api/status
  • USSD:           POST   http://localhost:${PORT}/api/ussd
  • Sincronizar:    POST   http://localhost:${PORT}/api/sync
  • Clientes:       GET    http://localhost:${PORT}/api/customers
  • Cliente:        GET    http://localhost:${PORT}/api/customers/:msisdn
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
