const express = require('express');
const router = express.Router();
const axios = require('axios');

// URL do Backend do PayJA
const PAYJA_API_URL = 'http://localhost:3000/api/v1';

/**
 * Rota para obter clientes diretamente do PayJA
 * Isso garante que o Banco Mock mostre exatamente o que o PayJA decidiu
 */
router.get('/customers', async (req, res) => {
  try {
    console.log('[Banco Mock] Procurando clientes diretamente no PayJA...');
    
    // Chamada interna para o admin do PayJA (sem necessidade de token se estiver no localhost ou configurado)
    // Nota: Como estamos no mesmo servidor, podemos tentar acessar a API de admin
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers`);
    
    // Mapear os dados do PayJA para o formato esperado pelo frontend do Banco
    const customers = response.data.map(c => ({
      id: c.id,
      nuit: c.nuit,
      name: c.name,
      phoneNumber: c.phoneNumber,
      salary: c.salary,
      creditLimit: c.creditLimit,
      creditScore: c.creditScore,
      status: c.status, // APPROVED, REJECTED, PENDING
      rejectionReason: c.rejectionReason,
      createdAt: c.createdAt,
      scoringResults: c.scoringResults
    }));

    res.json(customers);
  } catch (error) {
    console.error('❌ Erro ao buscar clientes no PayJA:', error.message);
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Não foi possível sincronizar com o PayJA',
      detalhes: error.message 
    });
  }
});

/**
 * Rota para obter detalhes de um cliente específico do PayJA
 */
router.get('/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PAYJA_API_URL}/public-admin/customers/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`❌ Erro ao buscar detalhes do cliente ${req.params.id} no PayJA:`, error.message);
    res.status(500).json({ sucesso: false, erro: 'Erro na comunicação com PayJA' });
  }
});

module.exports = router;
