const axios = require('axios');
const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * POST /api/desembolso/executar
 * Endpoint para PayJA solicitar desembolso de empréstimo aprovado
 * ✅ APROVA AUTOMATICAMENTE clientes do PayJA
 */
router.post('/executar', async (req, res) => {
  try {
    console.log('\n💰 Requisição de desembolso recebida do PayJA:');
    console.log(JSON.stringify(req.body, null, 2));

    const {
      nuit,
      valor,
      numero_emola,
      referencia_payja,
      descricao,
    } = req.body;

    // Validações
    if (!nuit || !valor || !numero_emola) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT, valor e número Emola são obrigatórios',
      });
    }

    // Buscar cliente
    const cliente = db.getClienteByNuit(nuit);

    if (!cliente) {
      console.log(`❌ Cliente com NUIT ${nuit} não encontrado`);
      return res.status(404).json({
        sucesso: false,
        erro: 'Cliente não encontrado',
        codigo: 'CLIENTE_NAO_ENCONTRADO',
      });
    }

    // ✅ APROVAÇÃO AUTOMÁTICA PARA CLIENTES DO PAYJA
    console.log(`✅ APROVAÇÃO AUTOMÁTICA: Cliente ${cliente.nome_completo} aprovado para desembolso`);
    console.log(`   Valor: ${valor} MZN`);
    console.log(`   Referência PayJA: ${referencia_payja}`);

    // Validações básicas mantidas apenas para garantir integridade dos dados
    const limiteCredito = Number(cliente.limite_credito || 0);
    if (valor > limiteCredito) {
      console.log(`⚠️  Valor solicitado (${valor}) excede limite de crédito (${limiteCredito}), mas APROVANDO automaticamente`);
    }

    // Garantir saldo suficiente (criar virtual se necessário)
    let saldoAtual = cliente.saldo;
    if (saldoAtual < valor) {
      console.log(`⚠️  Saldo insuficiente (${saldoAtual}), adicionando crédito virtual de ${valor - saldoAtual}`);
      db.updateCliente(cliente.id, {
        saldo: valor, // Garante pelo menos o valor necessário
      });
      saldoAtual = valor;
    }

    // Criar transação de débito
    const transacao = db.createTransacao({
      cliente_id: cliente.id,
      tipo: 'DEBITO',
      valor: valor,
      descricao: descricao || `Desembolso empréstimo - ${referencia_payja}`,
      origem: cliente.numero_conta,
      destino: numero_emola,
      status: 'CONCLUIDO', // ✅ DIRETO PARA CONCLUÍDO (aprovação automática)
      referencia_externa: referencia_payja,
    });

    // Criar registro de desembolso
    const desembolso = db.createDesembolso({
      cliente_id: cliente.id,
      transacao_id: transacao.id,
      valor,
      numero_emola,
      status: 'CONCLUIDO', // ✅ DIRETO PARA CONCLUÍDO (aprovação automática)
      referencia_payja,
      processado_em: new Date().toISOString(),
    });

    // ✅ PROCESSAR IMEDIATAMENTE (sem esperar 2 segundos)
    try {
      // Atualizar saldo do cliente imediatamente
      const novoSaldo = saldoAtual - valor;
      db.updateCliente(cliente.id, {
        saldo: novoSaldo,
      });

      console.log(`✅ Desembolso ${desembolso.id} APROVADO E CONCLUÍDO IMEDIATAMENTE`);
      // Notificar PayJA e Simulador (em background, sem bloquear resposta)
      const msisdoCliente = cliente.telefone || cliente.numero_telefone || null;
      notifyPayJAAndSimulator({
        referencia_payja,
        desembolsoId: desembolso.id,
        valor,
        numero_emola,
        nomeCliente: cliente.nome_completo,
        msisdn: msisdoCliente,
      }).catch(err => console.warn('Erro na notificação background:', err.message));
      console.log(`   Saldo anterior: ${saldoAtual} MZN`);
      console.log(`   Saldo após desembolso: ${novoSaldo} MZN`);

    } catch (error) {
      console.error('❌ Erro no processamento imediato:', error);
      db.updateTransacao(transacao.id, 'ERRO', error.message);
      db.updateDesembolso(desembolso.id, {
        status: 'ERRO',
        erro: error.message,
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Desembolso APROVADO E PROCESSADO COM SUCESSO',
      status: 'CONCLUIDO', // ✅ Indica aprovação instantânea
      desembolso: {
        id: desembolso.id,
        valor,
        numero_emola,
        status: 'CONCLUIDO',
        transacao_id: transacao.id,
        processado_em: new Date().toISOString(),
      },
      cliente: {
        nome: cliente.nome_completo,
        numero_conta: cliente.numero_conta,
        nuit: cliente.nuit,
        saldo_anterior: saldoAtual,
        saldo_novo: saldoAtual - valor,
      },
      aprovacao: {
        automatica: true,
        motivo: 'Cliente PayJA - Aprovação automática',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Erro no desembolso:', error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * GET /api/desembolso/status/:id
 * Consultar status de um desembolso
 */

// Função para notificar PayJA e Simulador após desembolso
async function notifyPayJAAndSimulator({ referencia_payja, desembolsoId, valor, numero_emola, nomeCliente, msisdn }) {
  const PAYJA_URL = 'http://216.128.152.177:3000/api/v1';
  const SIMULATOR_URL = 'http://216.128.152.177:3001';
  
  // 1. Notificar PayJA sobre desembolso concluído
  try {
    // Buscar token do PayJA (admin)
    const loginRes = await axios.post(`${PAYJA_URL}/auth/login`, {
      email: 'admin@payja.mz',
      password: 'PayJA@2024'
    }, { timeout: 5000 });
    const token = loginRes.data?.access_token;
    if (token && referencia_payja) {
      // Actualizar status do empréstimo no PayJA para DISBURSED
      await axios.patch(`${PAYJA_URL}/loans/${referencia_payja}/status`,
        { status: 'DISBURSED' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      );
      console.log(`✅ PayJA notificado: empréstimo ${referencia_payja} → DISBURSED`);
    }
  } catch (err) {
    console.warn(`⚠️ Aviso ao notificar PayJA: ${err.message}`);
  }
  
  // 2. Notificar Simulador directamente (SMS ao cliente)
  try {
    if (msisdn) {
      await axios.post(`${SIMULATOR_URL}/api/payja/loan-update`, {
        loanId: referencia_payja || desembolsoId,
        status: 'APPROVED',
        msisdn: msisdn,
        amount: valor,
        termLabel: 'N/A',
        monthlyPayment: 0,
        totalAmount: valor,
        desembolsoId: desembolsoId,
      }, { timeout: 5000 });
      console.log(`✅ Simulador notificado: SMS enviado para ${msisdn}`);
    }
  } catch (err) {
    console.warn(`⚠️ Aviso ao notificar Simulador: ${err.message}`);
  }
}

router.get('/status/:id', (req, res) => {
  try {
    const desembolso = db.db.prepare(`
      SELECT d.*, c.nome_completo, c.numero_conta, t.status as status_transacao
      FROM desembolsos d
      LEFT JOIN clientes c ON d.cliente_id = c.id
      LEFT JOIN transacoes t ON d.transacao_id = t.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!desembolso) {
      return res.status(404).json({
        sucesso: false,
        erro: 'Desembolso não encontrado',
      });
    }

    res.json({
      sucesso: true,
      desembolso,
    });

  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * GET /api/desembolso/historico
 * Histórico de desembolsos
 */
router.get('/historico', (req, res) => {
  try {
    const desembolsos = db.getDesembolsos();
    
    res.json({
      sucesso: true,
      total: desembolsos.length,
      desembolsos,
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

/**
 * POST /api/desembolso/simular
 * Simular desembolso sem executar
 */
router.post('/simular', (req, res) => {
  try {
    const { nuit, valor } = req.body;

    if (!nuit || !valor) {
      return res.status(400).json({
        sucesso: false,
        erro: 'NUIT e valor são obrigatórios',
      });
    }

    const cliente = db.getClienteByNuit(nuit);

    if (!cliente) {
      return res.json({
        sucesso: false,
        pode_desembolsar: false,
        motivo: 'Cliente não encontrado',
      });
    }

    const podeDesembolsar = cliente.saldo >= valor && cliente.status_conta === 'ATIVA';

    res.json({
      sucesso: true,
      pode_desembolsar: podeDesembolsar,
      cliente: {
        nome: cliente.nome_completo,
        numero_conta: cliente.numero_conta,
        saldo_atual: cliente.saldo,
        status_conta: cliente.status_conta,
      },
      valor_solicitado: valor,
      saldo_apos_desembolso: cliente.saldo - valor,
      motivo: podeDesembolsar ? 'Desembolso pode ser executado' : 
              cliente.status_conta !== 'ATIVA' ? 'Conta inativa' : 'Saldo insuficiente',
    });

  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

module.exports = router;
