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

const app = express();
const PORT = process.env.PORT || 4000;

console.log(`\n🔧 PORT configurada para: ${PORT}`);
console.log(`\n📝 Variáveis de ambiente:`, {PORT: process.env.PORT, NODE_ENV: process.env.NODE_ENV});

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

console.log('\n⏳ Iniciando servidor Express...');
console.log('Tentando ouvir em 127.0.0.1:' + PORT);

// Iniciar servidor
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ Servidor iniciado com sucesso!`);
  console.log(`\n🏦 ${process.env.BANCO_NOME} - Sistema Mock`);
  console.log(`📡 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${process.env.API_KEY}`);
  console.log(`\n✅ Pronto para receber requisições!\n`);
  console.log('Endereco de escuta:', server.address());
});

server.on('listening', () => {
  console.log('Evento listening dispara! Porta:', server.address().port);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

module.exports = app;
