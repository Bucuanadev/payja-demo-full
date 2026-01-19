// src/routes/ussdRoutes.js
const express = require('express');
const router = express.Router();
const ussdController = require('../controllers/ussdController');

// Rota principal USSD
router.post('/', ussdController.processUssd.bind(ussdController));

// Rotas para API
router.get('/customers', ussdController.listCustomers.bind(ussdController));
router.get('/customers/:msisdn', ussdController.getCustomer.bind(ussdController));

// Rota para simular transação
router.post('/simulate-transaction', async (req, res) => {
  try {
    const { fromMsisdn, toMsisdn, amount, description } = req.body;
    console.log('💸 Transação simulada:', { fromMsisdn, toMsisdn, amount, description });
    setTimeout(() => {
      res.json({
        success: true,
        transactionId: `TXN-${Date.now()}`,
        message: 'Transação simulada com sucesso',
        amount: amount,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });
    }, 1000);
  } catch (error) {
    console.error('❌ Erro na transação simulada:', error);
    res.status(500).json({ error: 'Erro na transação' });
  }
});

module.exports = router;
