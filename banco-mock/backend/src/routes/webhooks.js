const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/webhooks/payja/confirmacao
 * Receber confirmações do PayJA (ex: empréstimo aprovado, cliente registrado)
 */
router.post('/payja/confirmacao', (req, res) => {
  try {
    console.log('\n📬 Webhook recebido do PayJA:');
    console.log(JSON.stringify(req.body, null, 2));

    const { tipo, dados } = req.body;

    switch (tipo) {
      case 'CLIENTE_REGISTRADO':
        console.log(`✅ Cliente ${dados.nuit} registrado no PayJA`);
        // Pode atualizar status ou adicionar flag no banco
        break;

      case 'EMPRESTIMO_APROVADO':
        console.log(`✅ Empréstimo aprovado: ${dados.valor} MZN para ${dados.nuit}`);
        // Preparar para desembolso
        break;

      case 'PAGAMENTO_RECEBIDO':
        console.log(`✅ Pagamento recebido: ${dados.valor} MZN de ${dados.nuit}`);
        // Registrar pagamento de prestação
        break;

      default:
        console.log(`⚠️ Tipo de webhook desconhecido: ${tipo}`);
    }

    res.json({
      sucesso: true,
      mensagem: 'Webhook recebido e processado',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * GET /api/webhooks/teste
 * Endpoint de teste
 */
router.get('/teste', (req, res) => {
  res.json({
    sucesso: true,
    mensagem: 'Endpoint de webhooks funcionando',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
