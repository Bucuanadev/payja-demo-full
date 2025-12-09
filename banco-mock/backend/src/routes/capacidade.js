const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/capacidade/consultar
 * Consulta capacidade financeira do cliente
 */
router.post('/consultar', (req, res) => {
  try {
    console.log('\n💰 Consulta de capacidade financeira:');
    console.log(JSON.stringify(req.body, null, 2));

    const { nuit, telefone } = req.body;

    if (!nuit && !telefone) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT ou telefone são obrigatórios',
      });
    }

    // Buscar cliente
    let cliente;
    if (nuit) {
      cliente = db.getClienteByNuit(nuit);
    } else if (telefone) {
      cliente = db.getClienteByTelefone(telefone);
    }

    if (!cliente) {
      console.log(`❌ Cliente não encontrado`);
      
      // Registrar consulta
      db.createConsultaCapacidade({
        nuit: nuit || null,
        telefone: telefone || null,
        requisicao: req.body,
        status: 'CLIENTE_NAO_ENCONTRADO',
      });

      return res.json({
        sucesso: false,
        erro: 'Cliente não encontrado',
        codigo: 'CLIENTE_NAO_ENCONTRADO',
      });
    }

    // Calcular capacidade de pagamento
    const rendaMensal = cliente.renda_mensal || cliente.salario || 0;
    const dividaTotal = cliente.divida_total || 0;
    const rendaDisponivel = rendaMensal - dividaTotal;
    
    // 30% da renda disponível para novo empréstimo
    const capacidadePagamento = rendaDisponivel * 0.3;
    
    // Limite baseado em score
    let limiteAprovado = cliente.limite_credito;
    
    if (cliente.score_credito < 600) {
      limiteAprovado = limiteAprovado * 0.5;
    } else if (cliente.score_credito < 700) {
      limiteAprovado = limiteAprovado * 0.7;
    }

    // Registrar consulta
    db.createConsultaCapacidade({
      nuit: cliente.nuit,
      telefone: cliente.telefone,
      requisicao: req.body,
      status: 'SUCESSO',
      capacidade_calculada: Math.round(capacidadePagamento),
      limite_aprovado: Math.round(limiteAprovado),
    });

    console.log(`✅ Capacidade calculada para ${cliente.nome_completo}`);

    res.json({
      sucesso: true,
      cliente: {
        nuit: cliente.nuit,
        nome: cliente.nome_completo,
        numero_conta: cliente.numero_conta,
        telefone: cliente.telefone,
      },
      capacidade_financeira: {
        renda_mensal: rendaMensal,
        divida_total: dividaTotal,
        renda_disponivel: rendaDisponivel,
        capacidade_pagamento_mensal: Math.round(capacidadePagamento),
        limite_credito_aprovado: Math.round(limiteAprovado),
        score_credito: cliente.score_credito,
        classificacao_risco: cliente.score_credito >= 750 ? 'BAIXO' : 
                             cliente.score_credito >= 650 ? 'MEDIO' : 'ALTO',
      },
      conta: {
        saldo_disponivel: cliente.saldo,
        status: cliente.status_conta,
        tipo: cliente.tipo_conta,
      },
    });

  } catch (error) {
    console.error('Erro ao consultar capacidade:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao consultar capacidade financeira',
      mensagem: error.message,
    });
  }
});

/**
 * GET /api/capacidade/historico
 * Lista histórico de consultas de capacidade
 */
router.get('/historico', (req, res) => {
  try {
    const consultas = db.getAllConsultasCapacidade();
    
    res.json({
      sucesso: true,
      total: consultas.length,
      consultas: consultas.slice(-50).reverse(), // Últimas 50
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

module.exports = router;
