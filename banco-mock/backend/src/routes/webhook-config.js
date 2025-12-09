const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');

// Configuração de webhooks armazenada em memória (em produção, usar banco de dados)
let webhookConfig = {
  payjaBaseUrl: 'http://localhost:3000',
  disbursementEndpoint: '/api/v1/webhooks/banco/desembolso',
  paymentEndpoint: '/api/v1/webhooks/banco/pagamento',
  apiKey: 'banco-ghw-api-key-2025',
  enabled: true,
};

// Histórico de webhooks enviados
let webhookHistory = [];

/**
 * GET /api/webhook/config
 * Obter configuração atual de webhooks
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: webhookConfig,
  });
});

/**
 * POST /api/webhook/config
 * Atualizar configuração de webhooks
 */
router.post('/config', (req, res) => {
  try {
    const { payjaBaseUrl, disbursementEndpoint, paymentEndpoint, apiKey, enabled } = req.body;

    webhookConfig = {
      payjaBaseUrl: payjaBaseUrl || webhookConfig.payjaBaseUrl,
      disbursementEndpoint: disbursementEndpoint || webhookConfig.disbursementEndpoint,
      paymentEndpoint: paymentEndpoint || webhookConfig.paymentEndpoint,
      apiKey: apiKey || webhookConfig.apiKey,
      enabled: enabled !== undefined ? enabled : webhookConfig.enabled,
    };

    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      config: webhookConfig,
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração',
      error: error.message,
    });
  }
});

/**
 * GET /api/webhook/history
 * Obter histórico de webhooks enviados
 */
router.get('/history', (req, res) => {
  // Limitar aos últimos 100 registros
  const recentHistory = webhookHistory.slice(-100);
  
  res.json({
    success: true,
    history: recentHistory,
    total: webhookHistory.length,
  });
});

/**
 * POST /api/webhook/send/disbursement
 * Enviar webhook de desembolso para o PayJA
 */
router.post('/send/disbursement', async (req, res) => {
  try {
    if (!webhookConfig.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Webhooks desabilitados',
      });
    }

    const { transactionId, loanId, customerId, amount, status, bankReference } = req.body;

    const timestamp = new Date().toISOString();

    const payload = {
      event: 'disbursement.completed',
      timestamp,
      data: {
        transactionId: transactionId || 'TXN-' + Date.now(),
        loanId,
        customerId,
        amount,
        status: status || 'completed',
        bankReference: bankReference || 'BANK-REF-' + Date.now(),
      },
    };

    // Also include legacy/PayJA-specific fields so PayJA accepts the mock payload
    const legacyPayload = {
      evento: 'desembolso_concluido',
      dados: {
        nuit: customerId || null,
        numero_conta: loanId || 'ACC-UNKNOWN',
        valor: amount,
        referencia_payja: transactionId || 'TXN-' + Date.now(),
        status: status ? (status === 'completed' ? 'CONCLUIDO' : status) : 'CONCLUIDO',
      },
    };

    // combine both representations so the receiver can read whichever it expects
    const combined = Object.assign({}, payload, { evento: legacyPayload.evento, dados: legacyPayload.dados });

    const url = `${webhookConfig.payjaBaseUrl}${webhookConfig.disbursementEndpoint}`;
    
    const response = await axios.post(url, combined, {
      headers: {
        'Content-Type': 'application/json',
        'X-Bank-Code': 'GHW',
        'X-API-Key': webhookConfig.apiKey,
      },
    });

    const historyEntry = {
      timestamp: new Date().toISOString(),
      type: 'disbursement',
      endpoint: url,
      payload,
      status: 'success',
      statusCode: response.status,
    };

    webhookHistory.push(historyEntry);

    res.json({
      success: true,
      message: 'Webhook enviado com sucesso',
      data: historyEntry,
    });
  } catch (error) {
    console.error('Erro ao enviar webhook de desembolso:', error);
    
    const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
    const statusCode = error.response?.status || 0;
    
    webhookHistory.push({
      timestamp: new Date().toISOString(),
      type: 'disbursement',
      endpoint: `${webhookConfig.payjaBaseUrl}${webhookConfig.disbursementEndpoint}`,
      status: 'error',
      statusCode: statusCode,
      error: errorMessage,
    });

    res.status(statusCode || 500).json({
      success: false,
      message: 'Erro ao enviar webhook',
      error: errorMessage,
      details: error.code || 'UNKNOWN_ERROR',
    });
  }
});

/**
 * POST /api/webhook/send/payment
 * Enviar webhook de pagamento para o PayJA
 */
router.post('/send/payment', async (req, res) => {
  try {
    if (!webhookConfig.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Webhooks desabilitados',
      });
    }

    const { transactionId, loanId, installmentId, amount, paymentMethod, status, bankReference } = req.body;

    const timestamp = new Date().toISOString();

    const payload = {
      event: 'payment.received',
      timestamp,
      data: {
        transactionId: transactionId || 'TXN-' + Date.now(),
        loanId,
        installmentId,
        amount,
        paymentMethod: paymentMethod || 'bank_transfer',
        status: status || 'confirmed',
        bankReference: bankReference || 'BANK-REF-' + Date.now(),
      },
    };

    // legacy payload expected by PayJA
    const legacyPayload = {
      evento: 'pagamento_recebido',
      dados: {
        nuit: customerId || null,
        numero_emprestimo: loanId || null,
        valor_pago: amount,
        valor_pendente: 0,
        status_emprestimo: status === 'confirmed' ? 'PAGO' : status || 'PENDENTE',
        referencia: bankReference || 'BANK-REF-' + Date.now(),
        data_pagamento: timestamp,
        comissoes: {
          banco_welli: { valor: '0' },
          payja: { valor: '0' },
          emola: { valor: '0' },
        },
      },
    };

    const combined = Object.assign({}, payload, { evento: legacyPayload.evento, dados: legacyPayload.dados });

    const url = `${webhookConfig.payjaBaseUrl}${webhookConfig.paymentEndpoint}`;
    
    const response = await axios.post(url, combined, {
      headers: {
        'Content-Type': 'application/json',
        'X-Bank-Code': 'GHW',
        'X-API-Key': webhookConfig.apiKey,
      },
    });

    const historyEntry = {
      timestamp: new Date().toISOString(),
      type: 'payment',
      endpoint: url,
      payload,
      status: 'success',
      statusCode: response.status,
    };

    webhookHistory.push(historyEntry);

    res.json({
      success: true,
      message: 'Webhook enviado com sucesso',
      data: historyEntry,
    });
  } catch (error) {
    console.error('Erro ao enviar webhook de pagamento:', error);
    
    const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
    const statusCode = error.response?.status || 0;
    
    webhookHistory.push({
      timestamp: new Date().toISOString(),
      type: 'payment',
      endpoint: `${webhookConfig.payjaBaseUrl}${webhookConfig.paymentEndpoint}`,
      status: 'error',
      statusCode: statusCode,
      error: errorMessage,
    });

    res.status(statusCode || 500).json({
      success: false,
      message: 'Erro ao enviar webhook',
      error: errorMessage,
      details: error.code || 'UNKNOWN_ERROR',
    });
  }
});

/**
 * DELETE /api/webhook/history
 * Limpar histórico de webhooks
 */
router.delete('/history', (req, res) => {
  webhookHistory = [];
  res.json({
    success: true,
    message: 'Histórico limpo com sucesso',
  });
});

module.exports = router;
