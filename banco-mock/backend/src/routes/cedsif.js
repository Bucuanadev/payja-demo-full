const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/cedsif/consultar
 * Consulta no CEDSIF (Central de Riscos de Crédito)
 * Simula consulta a histórico de crédito do cliente
 */
router.post('/consultar', (req, res) => {
  try {
    console.log('\n🔍 Consulta CEDSIF:');
    console.log(JSON.stringify(req.body, null, 2));

    const { nuit, bi, nome } = req.body;

    if (!nuit && !bi) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT ou BI são obrigatórios',
      });
    }

    // Buscar cliente
    let cliente;
    if (nuit) {
      cliente = db.getClienteByNuit(nuit);
    }

    if (!cliente) {
      console.log(`❌ Cliente não encontrado no CEDSIF`);
      return res.json({
        sucesso: true,
        encontrado: false,
        mensagem: 'Cliente sem histórico de crédito no CEDSIF',
      });
    }

    // Simular dados do CEDSIF
    const emprestimos = db.getEmprestimosByNuit(cliente.nuit);
    const totalEmprestimos = emprestimos.length;
    const emprestimosAtivos = emprestimos.filter(e => e.status === 'ATIVO').length;
    const emprestimosQuitados = emprestimos.filter(e => e.status === 'QUITADO').length;
    const emprestimosEmAtraso = emprestimos.filter(e => e.status === 'EM_ATRASO').length;

    console.log(`✅ Consulta CEDSIF realizada para ${cliente.nome_completo}`);

    res.json({
      sucesso: true,
      encontrado: true,
      cliente: {
        nuit: cliente.nuit,
        bi: cliente.bi,
        nome: cliente.nome_completo,
      },
      score_cedsif: cliente.score_credito,
      classificacao: cliente.score_credito >= 750 ? 'BAIXO_RISCO' : 
                     cliente.score_credito >= 650 ? 'RISCO_MEDIO' : 'ALTO_RISCO',
      historico_credito: {
        total_emprestimos: totalEmprestimos,
        emprestimos_ativos: emprestimosAtivos,
        emprestimos_quitados: emprestimosQuitados,
        emprestimos_em_atraso: emprestimosEmAtraso,
        divida_total: cliente.divida_total || 0,
        maior_atraso_dias: 0,
        historico_pagamentos: cliente.historico_pagamentos || 'SEM_DADOS',
      },
      instituicoes_financeiras: [
        {
          nome: process.env.BANCO_NOME || 'Banco GHW',
          emprestimos_ativos: emprestimosAtivos,
          divida_total: cliente.divida_total || 0,
        },
      ],
      ultima_consulta: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro ao consultar CEDSIF:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao consultar CEDSIF',
      mensagem: error.message,
    });
  }
});

module.exports = router;
