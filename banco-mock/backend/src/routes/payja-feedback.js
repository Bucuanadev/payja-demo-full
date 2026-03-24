const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * @route POST /api/payja-feedback/eligibility
 * @desc Recebe feedback de elegibilidade do PayJA
 */
router.post('/eligibility', (req, res) => {
  const { phoneNumber, status, rejectionReason, creditLimit } = req.body;

  if (!phoneNumber || !status) {
    return res.status(400).json({ error: 'Telefone e status são obrigatórios' });
  }

  try {
    const cliente = db.getClienteByTelefone(phoneNumber);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado no banco' });
    }

    // Atualiza o status de elegibilidade no banco mock
    // Adicionamos campos extras ao objeto do cliente para persistir o feedback
    const updatedData = {
      payja_status: status, // APPROVED ou REJECTED
      payja_rejection_reason: rejectionReason || null,
      payja_limit: creditLimit || 0,
      payja_last_sync: new Date().toISOString()
    };

    db.updateCliente(cliente.id, updatedData);

    console.log(`[PayJA-Feedback] Cliente ${phoneNumber} atualizado: ${status}`);
    
    res.json({ success: true, message: 'Feedback processado com sucesso' });
  } catch (error) {
    console.error('[PayJA-Feedback] Erro:', error.message);
    res.status(500).json({ error: 'Erro interno ao processar feedback' });
  }
});

module.exports = router;
