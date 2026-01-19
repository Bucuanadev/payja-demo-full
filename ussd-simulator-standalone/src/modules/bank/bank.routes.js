import express from 'express';
import axios from 'axios';

export function createBankRouter(db) {
  const router = express.Router();

  // Listar bancos cadastrados
  router.get('/', async (req, res) => {
    try {
      const banks = await db.all('SELECT * FROM bank_partners ORDER BY createdAt DESC');
      res.json(banks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obter banco específico
  router.get('/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const bank = await db.get(
        'SELECT * FROM bank_partners WHERE code = ?',
        [code]
      );

      if (!bank) {
        return res.status(404).json({ error: 'Banco não encontrado' });
      }

      res.json(bank);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Registrar novo banco
  router.post('/', async (req, res) => {
    try {
      const { code, name, apiUrl, apiKey } = req.body;

      if (!code || !name || !apiUrl) {
        return res.status(400).json({
          error: 'code, name e apiUrl são obrigatórios',
        });
      }

      // Verificar se já existe
      const existing = await db.get(
        'SELECT * FROM bank_partners WHERE code = ?',
        [code]
      );

      if (existing) {
        return res.status(409).json({
          error: 'Banco já registado',
        });
      }

      await db.run(
        `INSERT INTO bank_partners (code, name, apiUrl, apiKey, active)
         VALUES (?, ?, ?, ?, 1)`,
        [code, name, apiUrl, apiKey || null]
      );

      const bank = await db.get('SELECT * FROM bank_partners WHERE code = ?', [code]);
      res.status(201).json(bank);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Atualizar banco
  router.patch('/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const { name, apiUrl, apiKey, active } = req.body;

      const bank = await db.get(
        'SELECT * FROM bank_partners WHERE code = ?',
        [code]
      );

      if (!bank) {
        return res.status(404).json({ error: 'Banco não encontrado' });
      }

      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (apiUrl) {
        updates.push('apiUrl = ?');
        values.push(apiUrl);
      }
      if (apiKey) {
        updates.push('apiKey = ?');
        values.push(apiKey);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        values.push(active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      values.push(code);

      await db.run(
        `UPDATE bank_partners SET ${updates.join(', ')} WHERE code = ?`,
        values
      );

      const updated = await db.get('SELECT * FROM bank_partners WHERE code = ?', [code]);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Testar conexão com banco
  router.post('/:code/test-connection', async (req, res) => {
    try {
      const { code } = req.params;
      const bank = await db.get(
        'SELECT * FROM bank_partners WHERE code = ?',
        [code]
      );

      if (!bank) {
        return res.status(404).json({ error: 'Banco não encontrado' });
      }

      const timeout = parseInt(process.env.BANK_REQUEST_TIMEOUT || '10000');

      try {
        const response = await axios.get(`${bank.apiUrl}/api/health`, {
          timeout,
          headers: bank.apiKey ? { 'x-api-key': bank.apiKey } : {},
        });

        res.json({
          success: true,
          bankCode: code,
          message: 'Conexão bem-sucedida',
          response: response.data,
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          bankCode: code,
          error: 'Banco indisponível',
          details: error.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Verificar elegibilidade
  router.post('/:code/check-eligibility', async (req, res) => {
    try {
      const { code } = req.params;
      const { nuit, name, biNumber } = req.body;

      const bank = await db.get(
        'SELECT * FROM bank_partners WHERE code = ?',
        [code]
      );

      if (!bank) {
        return res.status(404).json({ error: 'Banco não encontrado' });
      }

      try {
        const response = await axios.post(
          `${bank.apiUrl}/api/validacao/verificar`,
          {
            nuit,
            nome: name,
            bi: biNumber,
          },
          {
            timeout: parseInt(process.env.BANK_REQUEST_TIMEOUT || '10000'),
            headers: bank.apiKey ? { 'x-api-key': bank.apiKey } : {},
          }
        );

        res.json({
          bankCode: code,
          eligible: response.data.elegivel,
          maxAmount: response.data.limite_aprovado,
          score: response.data.score_comparacao,
          response: response.data,
        });
      } catch (error) {
        res.status(503).json({
          bankCode: code,
          error: 'Falha ao verificar elegibilidade',
          details: error.message,
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
