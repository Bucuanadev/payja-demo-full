const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');

// URL do Backend do PayJA
const PAYJA_API_URL = 'http://localhost:3000/api/v1';

/**
 * @route POST /api/payja-decisions
 * @desc Recebe decisão de elegibilidade do PayJA com critérios detalhados
 */
router.post('/payja-decisions', (req, res) => {
  const { nuit, nome_completo, telefone, decision, creditLimit, rejectionReasons, score, decidedAt } = req.body;

  if (!telefone || !decision) {
    return res.status(400).json({ error: 'Telefone e decision são obrigatórios' });
  }

  try {
    const cliente = db.getClienteByTelefone(telefone) || (nuit ? db.getClienteByNuit(nuit) : null);

    if (!cliente) {
      // Guardar mesmo assim para quando o cliente for criado
      console.log(`[PayJA-Decisions] Cliente ${telefone} não encontrado no banco mock`);
      return res.json({ success: true, message: 'Decisão recebida (cliente não encontrado localmente)' });
    }

    // Normalizar status: APPROVED → APROVADO, REJECTED → REJEITADO
    const statusMap = { APPROVED: 'APROVADO', REJECTED: 'REJEITADO', PENDING: 'PENDENTE' };
    const payjaStatus = statusMap[decision] || decision;

    // Construir motivo legível a partir do array de razões
    let motivoPrincipal = null;
    if (decision === 'REJECTED' && rejectionReasons && rejectionReasons.length > 0) {
      motivoPrincipal = rejectionReasons[0]; // Primeiro motivo como principal
    }

    const updatedData = {
      payja_status: payjaStatus,
      payja_rejection_reason: motivoPrincipal,
      payja_rejection_reasons: rejectionReasons || [],  // Array completo de critérios
      payja_credit_limit: creditLimit || 0,
      payja_score: score || null,
      payja_last_sync: decidedAt || new Date().toISOString()
    };

    db.updateCliente(cliente.id, updatedData);
    console.log(`[PayJA-Decisions] ${nome_completo || telefone}: ${decision} | Motivos: ${(rejectionReasons || []).join(' | ')}`);

    res.json({ success: true, message: 'Decisão processada com sucesso' });
  } catch (error) {
    console.error('[PayJA-Decisions] Erro:', error.message);
    res.status(500).json({ error: 'Erro interno ao processar decisão' });
  }
});

/**
 * Rota para obter clientes diretamente do PayJA
 */
router.get('/payja-decisions/customers', async (req, res) => {
  try {
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers`);
    const customers = response.data.map(c => ({
      id: c.id,
      nuit: c.nuit,
      name: c.name,
      phoneNumber: c.phoneNumber,
      salary: c.salary,
      creditLimit: c.creditLimit,
      creditScore: c.creditScore,
      status: c.status,
      rejectionReason: c.rejectionReason,
      createdAt: c.createdAt,
      scoringResults: c.scoringResults
    }));
    res.json(customers);
  } catch (error) {
    console.error('Erro ao buscar clientes no PayJA:', error.message);
    res.status(500).json({ sucesso: false, erro: 'Não foi possível sincronizar com o PayJA' });
  }
});

router.get('/payja-decisions/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers/${id}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro na comunicação com PayJA' });
  }
});

module.exports = router;
