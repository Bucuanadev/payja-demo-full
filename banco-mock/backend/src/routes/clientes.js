const express = require('express');
const router = express.Router();
const db = require('../database');
const axios = require('axios');

// Função auxiliar para disparar webhook de sincronização
async function notifyPayja(event, data) {
  const payjaUrl = process.env.PAYJA_API_URL || 'http://216.128.152.177:3000/api/v1';
  try {
    await axios.post(`${payjaUrl}/webhooks/bank-sync`, {
      event,
      data,
      timestamp: new Date().toISOString()
    });
    console.log(`[Sync] Notificação enviada ao PayJA: ${event}`);
  } catch (error) {
    console.error(`[Sync] Erro ao notificar PayJA (${event}):`, error.message);
  }
}

// GET - Listar todos os clientes
router.get('/', (req, res) => {
  try {
    try { db.setLastPayjaPull(); } catch (_e) {}
    const clientes = db.getAllClientes();
    res.json({
      sucesso: true,
      total: clientes.length,
      clientes,
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// GET - Buscar cliente por NUIT
router.get('/nuit/:nuit', (req, res) => {
  try {
    const cliente = db.getClienteByNuit(req.params.nuit);
    if (!cliente) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Cliente não encontrado',
      });
    }
    res.json({
      sucesso: true,
      cliente,
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// GET - Buscar cliente por ID
router.get('/:id', (req, res) => {
  try {
    const cliente = db.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Cliente não encontrado',
      });
    }
    const transacoes = db.getTransacoesByCliente(req.params.id);
    res.json({
      sucesso: true,
      cliente,
      transacoes,
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// POST - Criar novo cliente
router.post('/', async (req, res) => {
  try {
    const cliente = db.createCliente(req.body);
    // Notificar PayJA em tempo real
    await notifyPayja('customer.created', cliente);
    res.status(201).json({
      sucesso: true,
      mensagem: 'Cliente criado com sucesso',
      cliente,
    });
  } catch (error) {
    res.status(400).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// PATCH - Atualizar cliente
router.patch('/:id', async (req, res) => {
  try {
    const cliente = db.updateCliente(req.params.id, req.body);
    // Notificar PayJA em tempo real
    await notifyPayja('customer.updated', cliente);
    res.json({
      sucesso: true,
      mensagem: 'Cliente atualizado com sucesso',
      cliente,
    });
  } catch (error) {
    res.status(400).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

// DELETE - Remover cliente
router.delete('/:id', async (req, res) => {
  try {
    const cliente = db.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
    }
    const nuit = cliente.nuit;
    db.db.get('clientes').remove({ id: req.params.id }).write();
    // Notificar PayJA em tempo real
    await notifyPayja('customer.deleted', { nuit });
    res.json({
      sucesso: true,
      mensagem: 'Cliente removido com sucesso',
    });
  } catch (error) {
    res.status(400).json({
      sucesso: false,
      erro: error.message,
    });
  }
});


// POST - Sincronizar cliente com PayJA manualmente
router.post('/sync-payja', async (req, res) => {
  try {
    const { id } = req.body;
    const cliente = db.getClienteById(id);
    if (!cliente) return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });
    await notifyPayja('customer.sync_requested', cliente);
    res.json({ sucesso: true, mensagem: 'Sincronização com PayJA iniciada', cliente });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

// POST - Simular pagamento de dívida
router.post('/simular-pagamento', async (req, res) => {
  try {
    const { cliente_id, nuit, telefone, nome, valor, tipo, descricao, emprestimo_id } = req.body;
    if (!cliente_id || !valor) {
      return res.status(400).json({ sucesso: false, erro: 'cliente_id e valor são obrigatórios' });
    }
    const cliente = db.getClienteById(cliente_id);
    if (!cliente) return res.status(404).json({ sucesso: false, erro: 'Cliente não encontrado' });

    // 1. Registar pagamento no banco
    const pagamento = db.createPagamento({
      cliente_id,
      nuit: nuit || cliente.nuit,
      numero_conta: cliente.numero_conta,
      valor: parseFloat(valor),
      tipo: tipo || 'PRESTACAO',
      descricao: descricao || 'Pagamento de prestação',
      data: new Date().toISOString(),
      status: 'PROCESSADO',
    });

    // 2. Actualizar dívida do cliente
    const novasDivida = Math.max(0, (cliente.divida_total || 0) - parseFloat(valor));
    const novoStatus = novasDivida === 0 ? 'LIMPO' : cliente.status_credito;
    db.updateCliente(cliente_id, {
      divida_total: novasDivida,
      status_credito: novoStatus,
      tem_emprestimo_ativo: novasDivida > 0,
    });

    // 3. Actualizar empréstimo se fornecido
    if (emprestimo_id) {
      try {
        const emp = db.getEmprestimoById ? db.getEmprestimoById(emprestimo_id) : null;
        if (emp) {
          const novoSaldo = Math.max(0, (emp.saldo_devedor || 0) - parseFloat(valor));
          const novoStatusEmp = novoSaldo === 0 ? 'QUITADO' : 'ATIVO';
          db.db.get('emprestimos').find({ id: emprestimo_id }).assign({
            saldo_devedor: novoSaldo,
            valor_pago: (emp.valor_pago || 0) + parseFloat(valor),
            status: novoStatusEmp,
          }).write();
        }
      } catch (_e) {}
    }

    // 4. Notificar PayJA
    let payjaNotificado = false;
    let novoLimitePayja = 0;
    try {
      const payjaUrl = process.env.PAYJA_API_URL || 'http://216.128.152.177:3000/api/v1';
      const payjaRes = await axios.post(`${payjaUrl}/webhooks/bank-sync`, {
        event: 'payment.received',
        data: {
          cliente_id,
          nuit: nuit || cliente.nuit,
          telefone: telefone || cliente.telefone,
          nome: nome || cliente.nome_completo,
          valor: parseFloat(valor),
          tipo,
          divida_restante: novasDivida,
          status_credito: novoStatus,
          pagamento_id: pagamento.id,
        },
        timestamp: new Date().toISOString(),
      }, { timeout: 5000 });
      payjaNotificado = true;
      novoLimitePayja = payjaRes.data?.creditLimit || 0;
      console.log('[Pagamento] PayJA notificado:', payjaRes.data);
    } catch (payjaErr) {
      console.error('[Pagamento] Erro ao notificar PayJA:', payjaErr.message);
    }

    // 5. Enviar SMS ao cliente via simulador
    let smsEnviado = false;
    try {
      const simUrl = 'http://216.128.152.177:3001';
      const smsMsg = novasDivida === 0
        ? `PayJA 🎉 Parabéns ${nome || cliente.nome_completo}!\nA sua dívida foi totalmente liquidada.\nValor pago: ${parseFloat(valor).toLocaleString('pt-MZ', {minimumFractionDigits:2})} MZN\nO seu crédito está agora LIMPO.\nObrigado pela sua pontualidade!`
        : `PayJA ✅ Pagamento Recebido!\n${nome || cliente.nome_completo}, recebemos o seu pagamento.\nValor: ${parseFloat(valor).toLocaleString('pt-MZ', {minimumFractionDigits:2})} MZN\nTipo: ${tipo || 'PRESTACAO'}\nSaldo devedor restante: ${novasDivida.toLocaleString('pt-MZ', {minimumFractionDigits:2})} MZN\nObrigado!`;

      await axios.post(`${simUrl}/api/sms/send`, {
        msisdn: telefone || cliente.telefone,
        message: smsMsg,
        type: 'PAYMENT_RECEIVED',
      }, { timeout: 5000 });
      smsEnviado = true;
      console.log('[Pagamento] SMS enviado ao cliente');
    } catch (smsErr) {
      console.error('[Pagamento] Erro ao enviar SMS:', smsErr.message);
    }

    res.json({
      sucesso: true,
      mensagem: 'Pagamento processado com sucesso',
      pagamento,
      saldo_devedor_atualizado: novasDivida,
      payja_notificado: payjaNotificado,
      sms_enviado: smsEnviado,
      novo_limite_payja: novoLimitePayja,
    });
  } catch (error) {
    console.error('[Pagamento] Erro:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

module.exports = router;
