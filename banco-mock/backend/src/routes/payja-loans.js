const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// Configuração
const PAYJA_BASE_URL = process.env.PAYJA_API_URL || 'http://localhost:3000';
const API_PREFIX = process.env.PAYJA_API_PREFIX || '/api/v1';
// Ensures we never double-apply the API prefix (env may already include it)
const buildPayjaUrl = (path = '/') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${API_PREFIX}${normalizedPath}`, PAYJA_BASE_URL).toString();
};
const SYNC_INTERVAL = 15000; // 15 segundos

// In-memory storage para empréstimos sincronizados
let disbursals = [];

// Função para sincronizar empréstimos do PayJA
async function syncLoansFromPayJA() {
  try {
    const response = await axios.get(buildPayjaUrl('/integrations/ussd/loans'));
    const loans = response.data?.data || [];

    console.log(`[Loan Sync] Sincronizando ${loans.length} empréstimos do PayJA`);

    for (const loan of loans) {
      console.log(`[Loan Sync] Processando loan:`, { id: loan.id, customerName: loan.customerName, status: loan.status });
      
      // Verificar se já existe
      const existingIndex = disbursals.findIndex(d => d.loanId === loan.id);

      // Tentar encontrar cliente no banco pelo nome
      let clienteEncontrado = null;
      let numeroConta = '0000000000';
      let numeroEmola = null;

      if (loan.customerName) {
        console.log(`[Loan Sync] Buscando cliente: ${loan.customerName}`);

        clienteEncontrado = db.getClienteByNome(loan.customerName);
        if (clienteEncontrado) {
          numeroConta = clienteEncontrado.numero_conta;
          numeroEmola = clienteEncontrado.numero_emola || clienteEncontrado.telefone;
          console.log(`[Loan Sync] Cliente encontrado: ${clienteEncontrado.nome_completo} - Conta: ${numeroConta}`);
        }
      }

      // Preservar status local se já houve processamento
      const existingStatus = existingIndex >= 0 ? disbursals[existingIndex].status : null;
      const mappedStatus = mapLoanStatus(loan.status);
      const finalStatus = existingStatus && existingStatus !== 'PENDENTE' ? existingStatus : mappedStatus;

      const disbursal = {
        id: existingIndex >= 0 ? disbursals[existingIndex].id : uuidv4(),
        loanId: loan.id,
        cliente: loan.customerName || loan.phoneNumber || 'N/A',
        conta: numeroConta,
        valor: loan.amount,
        numeroEmola: numeroEmola,
        referenciaPayJA: loan.id,
        status: finalStatus,
        tentativas: existingIndex >= 0 ? disbursals[existingIndex].tentativas : 0,
        dataCriacao: loan.createdAt || new Date().toISOString(),
        dataProcessamento: existingIndex >= 0 ? disbursals[existingIndex].dataProcessamento : null,
        motivoRejeicao: loan.status === 'REJECTED' ? 'Rejeitado pelo PayJA' : null,
        phoneNumber: loan.phoneNumber,
        bank: loan.bank || null,
        reason: loan.reason || null,
        interest: loan.interest || 15,
        clienteEncontrado: !!clienteEncontrado,
      };

      if (existingIndex >= 0) {
        // Atualizar
        disbursals[existingIndex] = disbursal;
      } else {
        // Criar novo
        disbursals.push(disbursal);
      }

      // Auto-confirmar desembolso se cliente encontrado e status PENDING e ainda não foi processado
      if (clienteEncontrado && loan.status === 'PENDING' && disbursal.status === 'PENDENTE') {
        const alreadyProcessed = existingIndex >= 0 && disbursals[existingIndex].status !== 'PENDENTE';
        if (!alreadyProcessed) {
          console.log(`[Auto-Confirm] Processando desembolso automático para ${clienteEncontrado.nome_completo}`);
          await autoConfirmDisbursal(disbursal, clienteEncontrado);
        }
      }
    }

    console.log(`[Loan Sync] Total de desembolsos: ${disbursals.length}`);
  } catch (error) {
    console.error('[Loan Sync] Erro ao sincronizar:', error.message);
  }
}

// Mapear status do PayJA para status do banco
function mapLoanStatus(payjaStatus) {
  const statusMap = {
    'PENDING': 'PENDENTE',
    'APPROVED': 'PROCESSANDO',
    'REJECTED': 'ERRO',
    'DISBURSED': 'CONCLUIDO',
    'ACTIVE': 'PROCESSANDO',
  };
  return statusMap[payjaStatus] || 'PENDENTE';
}

// Função para auto-confirmar desembolso
async function autoConfirmDisbursal(disbursal, cliente) {
  try {
    console.log(`[Auto-Confirm] Iniciando desembolso: ${disbursal.valor} MZN para ${cliente.nome_completo}`);

    // Verificar limite de crédito do cliente
    const limiteCredito = Number(cliente.limite_credito || 0);
    if (disbursal.valor > limiteCredito) {
      console.log(`[Auto-Confirm] Valor solicitado (${disbursal.valor}) excede o limite de crédito (${limiteCredito})`);
      // marcar como ERRO e avisar PayJA
      const idx = disbursals.findIndex(d => d.id === disbursal.id);
      if (idx >= 0) {
        disbursals[idx].status = 'ERRO';
        disbursals[idx].motivoRejeicao = 'Limite de crédito insuficiente';
        disbursals[idx].tentativas = (disbursals[idx].tentativas || 0) + 1;
      }
      await notifyPayJADisbursal(disbursal.loanId, 'REJECTED', {
        motivo: 'Limite de crédito insuficiente',
        valor_solicitado: disbursal.valor,
        limite_credito: limiteCredito,
      });
      return;
    }

    // Verificar se cliente tem saldo suficiente
    if (cliente.saldo < disbursal.valor) {
      console.log(`[Auto-Confirm] Saldo insuficiente: ${cliente.saldo} < ${disbursal.valor}`);
      return;
    }

    // Atualizar status para PROCESSANDO
    const disbursalIndex = disbursals.findIndex(d => d.id === disbursal.id);
    if (disbursalIndex >= 0) {
      disbursals[disbursalIndex].status = 'PROCESSANDO';
      disbursals[disbursalIndex].dataProcessamento = new Date().toISOString();
    }

    // Simular processamento (2 segundos)
    setTimeout(async () => {
      try {
        // Debitar saldo do cliente
        db.updateCliente(cliente.id, {
          saldo: cliente.saldo - disbursal.valor,
        });

        // Atualizar status para CONCLUIDO
        if (disbursalIndex >= 0) {
          disbursals[disbursalIndex].status = 'CONCLUIDO';
          disbursals[disbursalIndex].tentativas += 1;
        }

        console.log(`[Auto-Confirm] Desembolso concluído com sucesso`);

        // Notificar PayJA
        await notifyPayJADisbursal(disbursal.loanId, 'DISBURSED', {
          numero_conta: cliente.numero_conta,
          numero_emola: disbursal.numeroEmola,
          valor_desembolsado: disbursal.valor,
          data_processamento: new Date().toISOString(),
        });

      } catch (error) {
        console.error('[Auto-Confirm] Erro no processamento:', error.message);
        if (disbursalIndex >= 0) {
          disbursals[disbursalIndex].status = 'ERRO';
          disbursals[disbursalIndex].motivoRejeicao = error.message;
        }
      }
    }, 2000);

  } catch (error) {
    console.error('[Auto-Confirm] Erro:', error.message);
  }
}

// Função para notificar PayJA sobre desembolso
async function notifyPayJADisbursal(loanId, status, details) {
  const url = buildPayjaUrl(`/integrations/ussd/loans/${loanId}/disburse`);
  let attempt = 0;
  const maxAttempts = 3;
  let lastError = null;
  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`[PayJA Webhook] Notificando PayJA (tentativa ${attempt}): Loan ${loanId} -> ${status}`);
      const response = await axios.patch(url, { status, ...details });
      console.log(`[PayJA Webhook] PayJA confirmou: ${response.data?.message || 'OK'}`);
      return true;
    } catch (error) {
      lastError = error;
      console.error('[PayJA Webhook] Falha:', error.response?.data || error.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.error('[PayJA Webhook] Erro ao notificar PayJA após múltiplas tentativas:', lastError?.message || lastError);
  return false;
}

// Iniciar sync automático quando o servidor inicia
let syncInterval = null;
function startAutoSync() {
  if (!syncInterval) {
    console.log('[Loan Sync] Iniciando sincronização automática (15s)');
    syncLoansFromPayJA(); // Primeira sincronização imediata
    syncInterval = setInterval(syncLoansFromPayJA, SYNC_INTERVAL);
  }
}

// GET /api/payja-loans - Listar empréstimos sincronizados do PayJA
router.get('/', (req, res) => {
  res.json({
    count: disbursals.length,
    data: disbursals,
  });
});

// GET /api/payja-loans/:id - Detalhes de um empréstimo
router.get('/:id', (req, res) => {
  const disbursal = disbursals.find(d => d.id === req.params.id);
  if (!disbursal) {
    return res.status(404).json({ erro: 'Desembolso não encontrado' });
  }
  res.json(disbursal);
});

// PATCH /api/payja-loans/:id/status - Atualizar status do desembolso
router.patch('/:id/status', (req, res) => {
  const { status, dataProcessamento, motivoRejeicao } = req.body || {};
  const disbursal = disbursals.find(d => d.id === req.params.id);

  if (!disbursal) {
    return res.status(404).json({ erro: 'Desembolso não encontrado' });
  }

  if (status) disbursal.status = status;
  if (dataProcessamento) disbursal.dataProcessamento = dataProcessamento;
  if (motivoRejeicao) disbursal.motivoRejeicao = motivoRejeicao;
  disbursal.tentativas = (disbursal.tentativas || 0) + 1;

  res.json({
    success: true,
    disbursal,
    message: `Desembolso atualizado para: ${status}`,
  });
});

// POST /api/payja-loans/sync - Sincronização manual
router.post('/sync', async (req, res) => {
  await syncLoansFromPayJA();
  res.json({
    success: true,
    count: disbursals.length,
    message: 'Sincronização concluída',
  });
});

// Iniciar sync automático quando o módulo é carregado
startAutoSync();

module.exports = router;
