const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/validacao/verificar
 * Endpoint para PayJA verificar elegibilidade do cliente
 */
router.post('/verificar', (req, res) => {
  try {
    console.log('\n🔍 Requisição de validação recebida do PayJA:');
    console.log(JSON.stringify(req.body, null, 2));

    const { nuit, nome, telefone, bi, valor_solicitado } = req.body;

    if (!nuit) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT é obrigatório',
      });
    }

    // Buscar cliente no banco
    const cliente = db.getClienteByNuit(nuit);

    if (!cliente) {
      console.log(`❌ Cliente com NUIT ${nuit} não encontrado`);
      
      // Registrar validação rejeitada
      db.createValidacao({
        nuit,
        requisicao: req.body,
        status: 'REJEITADO',
        motivo_rejeicao: 'Cliente não encontrado no banco',
      });

      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: 'Cliente não possui conta neste banco',
        codigo: 'CLIENTE_NAO_ENCONTRADO',
      });
    }

    // Verificar status da conta
    if (cliente.status_conta !== 'ATIVA') {
      console.log(`❌ Conta do cliente ${cliente.nome_completo} está ${cliente.status_conta}`);
      
      db.createValidacao({
        nuit,
        requisicao: req.body,
        status: 'REJEITADO',
        motivo_rejeicao: `Conta ${cliente.status_conta}`,
      });

      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: `Conta bancária ${cliente.status_conta.toLowerCase()}`,
        codigo: 'CONTA_INATIVA',
      });
    }

    // Calcular score de comparação (similar ao PayJA)
    let scoreComparacao = 0;
    let detalhesComparacao = [];

    // Comparar NUIT (sempre 100% se chegou aqui)
    scoreComparacao += 30;
    detalhesComparacao.push({ campo: 'NUIT', match: 100, peso: 30 });

    // Comparar Nome (fuzzy match)
    if (nome) {
      const nomeMatch = calcularSimilaridadeNome(nome, cliente.nome_completo);
      scoreComparacao += (nomeMatch / 100) * 25;
      detalhesComparacao.push({ campo: 'Nome', match: nomeMatch, peso: 25 });
    }

    // Comparar Telefone
    if (telefone && telefone === cliente.telefone) {
      scoreComparacao += 20;
      detalhesComparacao.push({ campo: 'Telefone', match: 100, peso: 20 });
    }

    // Comparar BI
    if (bi && bi === cliente.bi) {
      scoreComparacao += 15;
      detalhesComparacao.push({ campo: 'BI', match: 100, peso: 15 });
    }

    // Conta ativa adiciona 10%
    scoreComparacao += 10;
    detalhesComparacao.push({ campo: 'Conta Ativa', match: 100, peso: 10 });

    console.log(`📊 Score de comparação: ${scoreComparacao.toFixed(1)}%`);

    // Decisão de elegibilidade
    const scoreMinimo = 70;
    const elegivel = scoreComparacao >= scoreMinimo;

    if (!elegivel) {
      db.createValidacao({
        nuit,
        requisicao: req.body,
        status: 'REJEITADO',
        score_calculado: Math.round(scoreComparacao),
        motivo_rejeicao: 'Score de comparação abaixo do mínimo',
      });

      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: 'Dados não conferem suficientemente com os registros do banco',
        codigo: 'DADOS_INCONSISTENTES',
        score_comparacao: Math.round(scoreComparacao),
        detalhes: detalhesComparacao,
      });
    }

    // Calcular limite aprovado
    let limiteAprovado = cliente.limite_credito;

    // Ajustar baseado no score de crédito
    if (cliente.score_credito < 600) {
      limiteAprovado = limiteAprovado * 0.5; // 50% do limite
    } else if (cliente.score_credito < 700) {
      limiteAprovado = limiteAprovado * 0.7; // 70% do limite
    }

    // Verificar se tem empréstimos ativos
    if (cliente.emprestimos_ativos > 0) {
      limiteAprovado = limiteAprovado * 0.6;
    }

    // Verificar saldo mínimo
    if (cliente.saldo < 1000) {
      limiteAprovado = limiteAprovado * 0.8;
    }

    limiteAprovado = Math.round(limiteAprovado);

    // Verificar valor solicitado
    if (valor_solicitado && valor_solicitado > limiteAprovado) {
      db.createValidacao({
        nuit,
        requisicao: req.body,
        status: 'REJEITADO',
        score_calculado: Math.round(scoreComparacao),
        limite_aprovado: limiteAprovado,
        motivo_rejeicao: 'Valor solicitado excede limite aprovado',
      });

      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: `Valor solicitado (${valor_solicitado} MZN) excede limite aprovado (${limiteAprovado} MZN)`,
        codigo: 'VALOR_EXCEDE_LIMITE',
        limite_aprovado: limiteAprovado,
      });
    }

    // ✅ APROVADO!
    console.log(`✅ Cliente ${cliente.nome_completo} APROVADO`);
    console.log(`💰 Limite aprovado: ${limiteAprovado} MZN`);

    db.createValidacao({
      nuit,
      requisicao: req.body,
      status: 'APROVADO',
      score_calculado: Math.round(scoreComparacao),
      limite_aprovado: limiteAprovado,
    });

    res.json({
      sucesso: true,
      elegivel: true,
      cliente: {
        nuit: cliente.nuit,
        nome: cliente.nome_completo,
        telefone: cliente.telefone,
        email: cliente.email,
        numero_conta: cliente.numero_conta,
        tipo_conta: cliente.tipo_conta,
        score_credito: cliente.score_credito,
        renda_mensal: cliente.renda_mensal,
        empregador: cliente.empregador,
      },
      limite_aprovado: limiteAprovado,
      score_comparacao: Math.round(scoreComparacao),
      detalhes_comparacao: detalhesComparacao,
      observacoes: [
        `Score de crédito: ${cliente.score_credito}`,
        `Renda mensal: ${cliente.renda_mensal} MZN`,
        `Saldo atual: ${cliente.saldo} MZN`,
      ],
    });

  } catch (error) {
    console.error('❌ Erro na validação:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * GET /api/validacao/historico
 * Histórico de validações
 */
router.get('/historico', (req, res) => {
  try {
    const validacoes = db.getValidacoes();
    
    res.json({
      sucesso: true,
      total: validacoes.length,
      validacoes: validacoes.map(v => ({
        ...v,
        requisicao: JSON.parse(v.requisicao),
        resposta: v.resposta ? JSON.parse(v.resposta) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// Função auxiliar para calcular similaridade de nomes
function calcularSimilaridadeNome(nome1, nome2) {
  const n1 = nome1.toLowerCase().trim();
  const n2 = nome2.toLowerCase().trim();

  if (n1 === n2) return 100;

  // Levenshtein distance
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

module.exports = router;
