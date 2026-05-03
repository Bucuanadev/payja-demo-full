const express = require('express');
const router = express.Router();
const db = require('../database');

// Função comum para processar a consulta de elegibilidade
const processarConsulta = (req, res) => {
  try {
    // Suportar tanto 'nuit' quanto 'telefone' (para compatibilidade com USSD Simulator)
    const { nuit, telefone, valor_solicitado } = req.body;
    
    let cliente = null;
    if (nuit) {
      cliente = db.getClienteByNuit(nuit);
    } else if (telefone) {
      cliente = db.db.get('clientes').find({ telefone }).value();
    }
    
    if (!cliente) {
      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: 'Cliente não encontrado no sistema bancário.',
        codigo: 'CLIENTE_NAO_ENCONTRADO'
      });
    }

    console.log(`[Validacao] Consulta de elegibilidade para: ${cliente.nome_completo} (${cliente.nuit})`);
    
    // REGRA: O Banco agora é PASSIVO. Ele apenas reporta o status vindo do PayJA.
    const status = cliente.payja_status || 'PENDING';
    const limiteAprovado = cliente.payja_limit || 0;
    const motivo = cliente.payja_rejection_reason || 'Análise pendente pelo PayJA';

    if (status === 'APROVADO' || status === 'APPROVED') {
      if (valor_solicitado && valor_solicitado > limiteAprovado) {
        return res.json({
          sucesso: true,
          elegivel: false,
          motivo: `O valor solicitado (${valor_solicitado} MZN) excede o seu limite aprovado pelo PayJA de ${limiteAprovado} MZN.`,
          codigo: 'VALOR_EXCEDE_LIMITE',
          limite_aprovado: limiteAprovado,
        });
      }

      return res.json({
        sucesso: true,
        elegivel: true,
        limite_aprovado: limiteAprovado,
        cliente: {
          nuit: cliente.nuit,
          nome: cliente.nome_completo,
          telefone: cliente.telefone,
          numero_conta: cliente.numero_conta,
        },
        observacoes: [`Status PayJA: APROVADO`],
      });
    } else if (status === 'REJEITADO' || status === 'REJECTED') {
      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: motivo,
        codigo: 'REJEITADO_PELO_PAYJA',
        orientacao: 'A sua solicitação foi recusada pelo sistema de análise PayJA.',
      });
    } else {
      return res.json({
        sucesso: true,
        elegivel: false,
        motivo: 'A sua conta está em processo de análise pelo PayJA.',
        codigo: 'ANALISE_PENDENTE',
        orientacao: 'Por favor, tente novamente em instantes ou aguarde a notificação SMS.',
      });
    }
  } catch (error) {
    console.error('❌ Erro na consulta de validação:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
};

// POST /api/validacao/ - Rota padrão
router.post('/', processarConsulta);

// POST /api/validacao/consultar - Compatibilidade com USSD Simulator
router.post('/consultar', processarConsulta);

// POST /api/validacao/resultado - Feedback do PayJA (Single Source of Truth)
router.post('/resultado', (req, res) => {
  try {
    const { nuit, status, motivo, limite_aprovado } = req.body;
    
    if (!nuit || !status) {
      return res.status(400).json({ sucesso: false, erro: 'NUIT e Status são obrigatórios' });
    }

    const cliente = db.getClienteByNuit(nuit);
    if (cliente) {
      db.updateCliente(cliente.id, {
        payja_status: status,
        payja_rejection_reason: motivo || null,
        payja_limit: limite_aprovado || 0,
        payja_last_sync: new Date().toISOString()
      });
      console.log(`✅ Cliente ${nuit} sincronizado com decisão do PayJA: ${status}`);
    }

    db.createValidacao({
      nuit,
      status,
      motivo_rejeicao: motivo,
      limite_aprovado,
      origem: 'PAYJA_FEEDBACK'
    });

    res.json({ sucesso: true, mensagem: 'Decisão do PayJA processada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao processar feedback do PayJA:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
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
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

module.exports = router;
