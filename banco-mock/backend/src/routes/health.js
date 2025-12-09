const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/health
 * Verifica status do sistema
 */
router.get('/', (req, res) => {
  try {
    const totalClientes = db.getAllClientes().length;
    const totalValidacoes = db.getAllValidacoes().length;
    const totalDesembolsos = db.getAllDesembolsos().length;

    res.json({
      status: 'online',
      banco: process.env.BANCO_NOME || 'Banco GHW',
      timestamp: new Date().toISOString(),
      versao: '1.0.0',
      estatisticas: {
        clientes_cadastrados: totalClientes,
        validacoes_processadas: totalValidacoes,
        desembolsos_realizados: totalDesembolsos,
      },
      servicos: {
        database: 'online',
        api: 'online',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      erro: error.message,
    });
  }
});

module.exports = router;
