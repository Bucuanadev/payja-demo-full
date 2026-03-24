const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Caminho correto do banco.json (um nível acima do diretório src)
const BANCO_FILE = path.join(__dirname, '../../banco.json');

// Função auxiliar para ler o banco
function readBanco() {
  try {
    const data = fs.readFileSync(BANCO_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler banco.json:', error);
    return { clientes: [] };
  }
}

// Função auxiliar para escrever no banco
function writeBanco(data) {
  try {
    fs.writeFileSync(BANCO_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✓ banco.json atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao escrever banco.json:', error);
    return false;
  }
}

/**
 * POST /api/payja-decisions
 * Recebe decisão de aprovação/rejeição do PayJA para um cliente
 * 
 * Payload esperado:
 * {
 *   nuit: string,
 *   nome_completo: string,
 *   telefone: string,
 *   decision: 'APPROVED' | 'REJECTED',
 *   creditLimit: number,
 *   rejectionReasons: string[],
 *   score: number,
 *   decidedAt: ISO string
 * }
 */
router.post('/payja-decisions', (req, res) => {
  try {
    const { nuit, nome_completo, telefone, decision, creditLimit, rejectionReasons, score, decidedAt } = req.body;

    console.log(`📨 Recebido decisão do PayJA: ${nuit} - ${decision}`);

    // Validar campos obrigatórios
    if (!nuit || !decision) {
      return res.status(400).json({ 
        success: false, 
        message: 'NUIT e decision são obrigatórios' 
      });
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Decision deve ser APPROVED ou REJECTED' 
      });
    }

    // Ler banco atual
    const banco = readBanco();

    // Encontrar cliente pelo NUIT
    const clienteIndex = banco.clientes.findIndex(c => c.nuit === nuit);
    if (clienteIndex === -1) {
      console.warn(`⚠️ Cliente com NUIT ${nuit} não encontrado no banco`);
      return res.status(404).json({ 
        success: false, 
        message: `Cliente com NUIT ${nuit} não encontrado` 
      });
    }

    // Atualizar cliente com decisão do PayJA
    const cliente = banco.clientes[clienteIndex];
    cliente.payja_decision = decision;
    cliente.payja_credit_limit = creditLimit || 0;
    cliente.payja_rejection_reasons = rejectionReasons || [];
    cliente.payja_score = score || 0;
    cliente.payja_decided_at = decidedAt || new Date().toISOString();

    // Salvar banco atualizado
    if (!writeBanco(banco)) {
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao atualizar banco' 
      });
    }

    console.log(`✓ Decisão registrada para cliente ${nuit}: ${decision} - Limite: ${creditLimit}`);

    return res.status(200).json({ 
      success: true, 
      message: `Decisão ${decision} registrada para cliente ${nuit}`,
      cliente: {
        nuit: cliente.nuit,
        nome_completo: cliente.nome_completo,
        decision: cliente.payja_decision,
        creditLimit: cliente.payja_credit_limit
      }
    });

  } catch (error) {
    console.error('Erro ao processar decisão do PayJA:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar decisão',
      error: error.message 
    });
  }
});

/**
 * GET /api/payja-decisions/stats
 * Retorna estatísticas das decisões do PayJA
 */
router.get('/payja-decisions/stats', (req, res) => {
  try {
    const banco = readBanco();
    
    const approved = banco.clientes.filter(c => c.payja_decision === 'APPROVED').length;
    const rejected = banco.clientes.filter(c => c.payja_decision === 'REJECTED').length;
    const pending = banco.clientes.filter(c => !c.payja_decision).length;

    return res.status(200).json({
      success: true,
      stats: {
        total: banco.clientes.length,
        approved,
        rejected,
        pending
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao obter estatísticas',
      error: error.message 
    });
  }
});

/**
 * GET /api/clientes/approved
 * Retorna apenas clientes aprovados pelo PayJA
 */
router.get('/clientes/approved', (req, res) => {
  try {
    const banco = readBanco();
    const approved = banco.clientes.filter(c => c.payja_decision === 'APPROVED');

    return res.status(200).json({
      success: true,
      count: approved.length,
      clientes: approved
    });
  } catch (error) {
    console.error('Erro ao obter clientes aprovados:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao obter clientes aprovados',
      error: error.message 
    });
  }
});

/**
 * GET /api/clientes/rejected
 * Retorna apenas clientes rejeitados pelo PayJA
 */
router.get('/clientes/rejected', (req, res) => {
  try {
    const banco = readBanco();
    const rejected = banco.clientes.filter(c => c.payja_decision === 'REJECTED');

    return res.status(200).json({
      success: true,
      count: rejected.length,
      clientes: rejected
    });
  } catch (error) {
    console.error('Erro ao obter clientes rejeitados:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao obter clientes rejeitados',
      error: error.message 
    });
  }
});

module.exports = router;
