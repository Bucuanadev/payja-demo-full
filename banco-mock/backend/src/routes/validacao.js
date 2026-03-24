const express = require('express');
const router = express.Router();
const db = require('../database');

// POST - Verificar elegibilidade do cliente (Chamado pelo PayJA ou Simulador)
router.post('/verificar', (req, res) => {
  try {
    const { nuit, telefone, valor_solicitado } = req.body;
    
    if (!nuit && !telefone) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT ou Telefone obrigatório para validação',
      });
    }

    // Buscar cliente
    let cliente = null;
    if (nuit) {
      cliente = db.getClienteByNuit(nuit);
    } else if (telefone) {
      cliente = db.getClienteByTelefone(telefone);
    }

    if (!cliente) {
      console.log(`❌ Cliente não encontrado: NUIT=${nuit}, Tel=${telefone}`);
      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: 'Cliente não encontrado na base de dados do banco.',
        codigo: 'CLIENTE_NAO_ENCONTRADO',
        orientacao: 'Por favor, aproxime-se de um balcão do banco para abrir uma conta.',
      });
    }

    // --- CRITÉRIOS DE ELEGIBILIDADE ---
    const motivosRejeicao = [];

    // 1. Status da Conta
    if (cliente.status_conta !== 'ATIVA') {
      motivosRejeicao.push('A sua conta bancária está inativa ou bloqueada.');
    }

    // 2. Validade do B.I.
    const hoje = new Date();
    const validadeBI = new Date(cliente.bi_validade);
    if (validadeBI < hoje) {
      motivosRejeicao.push('O seu B.I. está fora do prazo de validade. Por favor, actualize os seus dados no balcão.');
    }

    // 3. Tempo de Conta (Mínimo 6 meses)
    const dataCriacaoConta = new Date(cliente.conta_criada_em);
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
    if (dataCriacaoConta > seisMesesAtras) {
      motivosRejeicao.push('A sua conta deve ter pelo menos 6 meses de domiciliação para ser elegível ao crédito.');
    }

    // 4. Salário Domiciliado (Se for assalariado)
    if (cliente.tipo_cliente === 'ASSALARIADO' && !cliente.salario_domiciliado) {
      motivosRejeicao.push('A sua conta salário não está domiciliada neste banco.');
    }

    // 5. Histórico de Crédito (Incumpridor)
    if (cliente.status_credito === 'INCUMPRIDOR') {
      motivosRejeicao.push('Possui registo de incumprimento em créditos anteriores.');
    }

    // 6. Capacidade de Pagamento e Taxa de Esforço (30-40%)
    const rendaLiquida = cliente.renda_mensal || 0;
    const dividaExistente = cliente.divida_total || 0;
    const taxaEsforcoMaxima = 0.4; // 40%
    const capacidadeMensalDisponivel = (rendaLiquida * taxaEsforcoMaxima) - (dividaExistente * 0.1); // Estimativa de prestação de dívida existente
    
    // Limite máximo baseado na capacidade (ex: 5x a capacidade mensal disponível)
    const limiteMaximoCapacidade = Math.max(0, capacidadeMensalDisponivel * 5);
    if (limiteMaximoCapacidade <= 0) {
      motivosRejeicao.push('A sua taxa de esforço actual não permite a contratação de novos créditos.');
    }

    // Se houver motivos de rejeição
    if (motivosRejeicao.length > 0) {
      console.log(`❌ Cliente ${cliente.nome_completo} REJEITADO: ${motivosRejeicao[0]}`);
      
      db.createValidacao({
        nuit: cliente.nuit,
        requisicao: req.body,
        status: 'REJEITADO',
        motivo_rejeicao: motivosRejeicao.join(' | '),
      });

      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: motivosRejeicao[0], // Retorna o primeiro motivo principal
        todos_motivos: motivosRejeicao,
        codigo: 'CRITERIOS_NAO_ATENDIDOS',
        orientacao: 'Por favor, aproxime-se de um balcão do banco para regularizar a sua situação.',
      });
    }

    // --- CÁLCULO DE LIMITE APROVADO ---
    let limiteAprovado = Math.min(limiteMaximoCapacidade, rendaLiquida * 2); // Limite de até 2 salários ou capacidade
    
    // Ajuste por Score
    if (cliente.score_credito > 800) limiteAprovado *= 1.2;
    if (cliente.score_credito < 600) limiteAprovado *= 0.7;
    limiteAprovado = Math.round(limiteAprovado / 100) * 100; // Arredondar para centenas

    // Verificar valor solicitado
    if (valor_solicitado && valor_solicitado > limiteAprovado) {
      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: `O valor solicitado (${valor_solicitado} MZN) excede o seu limite aprovado de ${limiteAprovado} MZN.`,
        codigo: 'VALOR_EXCEDE_LIMITE',
        limite_aprovado: limiteAprovado,
      });
    }

    // ✅ APROVADO!
    console.log(`✅ Cliente ${cliente.nome_completo} APROVADO com limite de ${limiteAprovado} MZN`);
    
    db.createValidacao({
      nuit: cliente.nuit,
      requisicao: req.body,
      status: 'APROVADO',
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
        tipo_cliente: cliente.tipo_cliente,
      },
      limite_aprovado: limiteAprovado,
      observacoes: [
        `Score de crédito: ${cliente.score_credito}`,
        `Renda mensal: ${cliente.renda_mensal} MZN`,
        `Capacidade mensal: ${Math.round(capacidadeMensalDisponivel)} MZN`,
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

// POST - Receber resultado de validação do PayJA (Feedback Loop)
// Rota corrigida para /resultado (conforme o script de sincronização)
router.post('/resultado', (req, res) => {
  try {
    const { nuit, status, motivo, limite_aprovado } = req.body;
    
    if (!nuit || !status) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT e Status são obrigatórios',
      });
    }

    console.log(`[Feedback PayJA] Recebido status ${status} para NUIT ${nuit}`);

    // 1. Buscar o cliente no banco
    const cliente = db.getClienteByNuit(nuit);
    if (cliente) {
      // 2. Atualizar o status do cliente diretamente no banco.json
      db.updateCliente(cliente.id, {
        payja_status: status,
        payja_rejection_reason: motivo || null,
        payja_limit: limite_aprovado || 0,
        payja_last_sync: new Date().toISOString()
      });
      console.log(`✅ Cliente ${nuit} atualizado no banco.json com status ${status}`);
    }

    // 3. Criar um registro de validação para histórico
    db.createValidacao({
      nuit,
      status,
      motivo_rejeicao: motivo,
      limite_aprovado,
      origem: 'PAYJA_FEEDBACK'
    });

    res.json({
      sucesso: true,
      mensagem: 'Resultado processado e salvo com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao processar feedback do PayJA:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

router.get('/historico', (req, res) => {
  try {
    const validacoes = db.getValidacoes();
    res.json({
      sucesso: true,
      total: validacoes.length,
      validacoes: validacoes.map(v => ({
        ...v,
        requisicao: typeof v.requisicao === 'string' ? JSON.parse(v.requisicao) : v.requisicao,
        resposta: v.resposta ? (typeof v.resposta === 'string' ? JSON.parse(v.resposta) : v.resposta) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

module.exports = router;
