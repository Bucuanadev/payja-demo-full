const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/emprestimos/consultar
 * Consulta empréstimos do cliente
 */
router.post('/consultar', (req, res) => {
  try {
    console.log('\n📋 Consulta de empréstimos:');
    console.log(JSON.stringify(req.body, null, 2));

    const { nuit, telefone, numero_conta } = req.body;

    if (!nuit && !telefone && !numero_conta) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT, telefone ou número de conta são obrigatórios',
      });
    }

    // Buscar cliente
    let cliente;
    if (nuit) {
      cliente = db.getClienteByNuit(nuit);
    } else if (telefone) {
      cliente = db.getClienteByTelefone(telefone);
    } else if (numero_conta) {
      cliente = db.getClienteByNumeroConta(numero_conta);
    }

    if (!cliente) {
      console.log(`❌ Cliente não encontrado`);
      return res.json({
        sucesso: false,
        erro: 'Cliente não encontrado',
        codigo: 'CLIENTE_NAO_ENCONTRADO',
      });
    }

    // Buscar empréstimos do cliente
    const emprestimos = db.getEmprestimosByNuit(cliente.nuit);

    console.log(`✅ Encontrados ${emprestimos.length} empréstimos para ${cliente.nome_completo}`);

    res.json({
      sucesso: true,
      cliente: {
        nuit: cliente.nuit,
        nome: cliente.nome_completo,
        numero_conta: cliente.numero_conta,
        telefone: cliente.telefone,
      },
      emprestimos: {
        total: emprestimos.length,
        ativos: emprestimos.filter(e => e.status === 'ATIVO').length,
        quitados: emprestimos.filter(e => e.status === 'QUITADO').length,
        em_atraso: emprestimos.filter(e => e.status === 'EM_ATRASO').length,
        lista: emprestimos.map(emp => ({
          id: emp.id,
          valor_original: emp.valor_original,
          valor_pago: emp.valor_pago,
          saldo_devedor: emp.saldo_devedor,
          taxa_juros: emp.taxa_juros,
          parcelas_total: emp.parcelas_total,
          parcelas_pagas: emp.parcelas_pagas,
          status: emp.status,
          data_contratacao: emp.criado_em,
          data_vencimento: emp.data_vencimento,
        })),
      },
      resumo_financeiro: {
        divida_total: cliente.divida_total || 0,
        limite_credito: cliente.limite_credito,
        limite_disponivel: cliente.limite_credito - (cliente.divida_total || 0),
        score_credito: cliente.score_credito,
      },
    });

  } catch (error) {
    console.error('Erro ao consultar empréstimos:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao consultar empréstimos',
      mensagem: error.message,
    });
  }
});

/**
 * GET /api/emprestimos/historico
 * Lista todos os empréstimos
 */
router.get('/historico', (req, res) => {
  try {
    const emprestimos = db.getAllEmprestimos();
    
    res.json({
      sucesso: true,
      total: emprestimos.length,
      emprestimos: emprestimos.slice(-50).reverse(),
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * GET /api/emprestimos/:id
 * Consulta empréstimo específico
 */
router.get('/:id', (req, res) => {
  try {
    const emprestimo = db.getEmprestimoById(req.params.id);
    
    if (!emprestimo) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Empréstimo não encontrado',
      });
    }

    res.json({
      sucesso: true,
      emprestimo,
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

module.exports = router;
