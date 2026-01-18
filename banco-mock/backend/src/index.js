const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./database');
const clientesRoutes = require('./routes/clientes');
const validacaoRoutes = require('./routes/validacao');
const desembolsoRoutes = require('./routes/desembolso');
const webhooksRoutes = require('./routes/webhooks');
const webhookConfigRoutes = require('./routes/webhook-config');
const capacidadeRoutes = require('./routes/capacidade');
const healthRoutes = require('./routes/health');
const emprestimosRoutes = require('./routes/emprestimos');
const cedsifRoutes = require('./routes/cedsif');
const syncStatusRoutes = require('./routes/sync-status');
const payjaLoansRoutes = require('./routes/payja-loans');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    banco: process.env.BANCO_NOME,
    status: 'online',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/clientes', clientesRoutes);
app.use('/api/validacao', validacaoRoutes);
app.use('/api/desembolso', desembolsoRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/webhook', webhookConfigRoutes);
app.use('/api/capacidade', capacidadeRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/emprestimos', emprestimosRoutes);
app.use('/api/cedsif', cedsifRoutes);
app.use('/api/payja-loans', payjaLoansRoutes);
app.use('/api/sync', syncStatusRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({
    erro: 'Erro interno do servidor',
    mensagem: err.message,
  });
});

// Inicializar banco de dados
db.init();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🏦 ${process.env.BANCO_NOME} - Sistema Mock`);
  console.log(`📡 Servidor rodando em http://155.138.227.26:${PORT}`);
  console.log(`🔑 API Key: ${process.env.API_KEY}`);
  console.log(`\n✅ Pronto para receber requisições!\n`);
});

module.exports = app;
