import express from 'express';

export function createIntegrationRouter(db) {
  const router = express.Router();

  // Configurar URL do PayJA
  router.post('/configure', async (req, res) => {
    try {
      const { payjaApiUrl, apiKey } = req.body;

      if (!payjaApiUrl) {
        return res.status(400).json({ error: 'payjaApiUrl é obrigatório' });
      }

      // Salvar configuração no DB
      await db.run(
        `INSERT OR REPLACE INTO integration_config (key, value, updatedAt)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        ['PAYJA_API_URL', payjaApiUrl]
      );

      if (apiKey) {
        await db.run(
          `INSERT OR REPLACE INTO integration_config (key, value, updatedAt)
           VALUES (?, ?, CURRENT_TIMESTAMP)`,
          ['PAYJA_API_KEY', apiKey]
        );
      }

      res.json({
        success: true,
        message: 'Configuração salva',
        payjaApiUrl,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obter configuração atual
  router.get('/config', async (req, res) => {
    try {
      const apiUrl = await db.get(
        `SELECT value FROM integration_config WHERE key = ?`,
        ['PAYJA_API_URL']
      );
      const apiKey = await db.get(
        `SELECT value FROM integration_config WHERE key = ?`,
        ['PAYJA_API_KEY']
      );

      res.json({
        payjaApiUrl: apiUrl?.value || 'http://155.138.227.26:3000',
        hasApiKey: !!apiKey?.value,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Testar conexão com PayJA
  router.get('/test-connection', async (req, res) => {
    try {
      const apiUrl = await db.get(
        `SELECT value FROM integration_config WHERE key = ?`,
        ['PAYJA_API_URL']
      );

      const axios = (await import('axios')).default;
      const response = await axios.get(
        `${apiUrl?.value || 'http://155.138.227.26:3000'}/api/v1/health`,
        { timeout: 5000 }
      );

      res.json({
        success: true,
        payjaStatus: 'online',
        response: response.data,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'PayJA não está respondendo',
        details: error.message,
      });
    }
  });

  // ============ CROSS-VALIDATION ENDPOINTS ============

  // Obter dados de cliente para validação cruzada
  router.get('/cross-validate/customer/:nuit', async (req, res) => {
    try {
      const { nuit } = req.params;

      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ 
          success: false,
          error: 'Cliente não encontrado no simulador USSD',
          nuit 
        });
      }

      // Preparar dados para validação cruzada
      const validationData = {
        success: true,
        source: 'USSD_SIMULATOR',
        customer: {
          nuit: customer.nuit,
          phoneNumber: customer.phoneNumber,
          name: customer.name,
          biNumber: customer.biNumber,
          email: customer.email,
          institution: customer.institution,
          salary: customer.salary,
          creditScore: customer.creditScore,
          status: customer.status,
          registeredAt: customer.createdAt,
        },
        validatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h expiry
      };

      res.json(validationData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enviar resultado de validação de volta ao simulador
  router.post('/cross-validate/confirm', async (req, res) => {
    try {
      const { nuit, validationResult, validatedBy } = req.body;

      if (!nuit) {
        return res.status(400).json({ error: 'NUIT é obrigatório' });
      }

      // Salvar resultado da validação
      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      // Salvar confirmação de validação
      await db.run(
        `INSERT INTO validation_logs (customerId, validationResult, validatedBy, validatedAt)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [customer.id, JSON.stringify(validationResult), validatedBy || 'PAYJA']
      );

      // Atualizar status do cliente se passou na validação
      if (validationResult?.approved === true) {
        await db.run(
          `UPDATE customers SET status = ? WHERE nuit = ?`,
          ['VALIDATED', nuit]
        );
      }

      res.json({
        success: true,
        message: 'Validação confirmada',
        nuit,
        validationStatus: validationResult?.approved ? 'APPROVED' : 'REJECTED',
        confirmedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obter histórico de validações de um cliente
  router.get('/cross-validate/history/:nuit', async (req, res) => {
    try {
      const { nuit } = req.params;

      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      const validations = await db.all(
        `SELECT * FROM validation_logs WHERE customerId = ? ORDER BY validatedAt DESC`,
        [customer.id]
      );

      res.json({
        success: true,
        nuit,
        validations: validations.map(v => ({
          ...v,
          validationResult: JSON.parse(v.validationResult || '{}')
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
