import express from 'express';
import { v4 as uuidv4 } from 'uuid';

export function createCustomerRouter(db) {
  const router = express.Router();

  // Listar todos os clientes
  router.get('/', async (req, res) => {
    try {
      const customers = await db.all('SELECT * FROM customers ORDER BY createdAt DESC');
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obter cliente por NUIT
  router.get('/:nuit', async (req, res) => {
    try {
      const { nuit } = req.params;
      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Registrar novo cliente
  router.post('/', async (req, res) => {
    try {
      console.log('[Register] incoming payload:', req.body);
      // Accept multiple possible phone fields and normalize (trim/remove whitespace/tabs)
      const { phoneNumber, nuit, name, biNumber } = req.body;
      const altPhone = req.body.msisdn || req.body.phone || req.body.phone_number || req.body.phoneNo || req.body.phone_no;
      const rawPhone = phoneNumber || altPhone || '';
      const normalizedPhone = (rawPhone === null || rawPhone === undefined) ? '' : String(rawPhone).trim().replace(/\s+/g, '');

      console.log('[Register] normalizedPhone:', normalizedPhone);

      if (!normalizedPhone || !nuit || !name) {
        return res.status(400).json({ error: 'phoneNumber, nuit e name são obrigatórios' });
      }

      // Verificar se já existe (use normalized phone)
      const existing = await db.get(
        'SELECT * FROM customers WHERE phoneNumber = ? OR nuit = ?',
        [normalizedPhone, nuit]
      );

      if (existing) {
        return res.status(409).json({
          error: 'Cliente já registado',
        });
      }

      const id = uuidv4();
      try {
        await db.run(
          `INSERT INTO customers (id, phoneNumber, nuit, name, biNumber, verified)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [id, normalizedPhone, nuit, name, biNumber || null]
        );
      } catch (e) {
        console.error('[Register] DB insert error:', e && e.message ? e.message : e);
        return res.status(500).json({ error: 'DB insert error', details: e && e.message });
      }

      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Atualizar cliente
  router.patch('/:nuit', async (req, res) => {
    try {
      const { nuit } = req.params;
      const updates = req.body;

      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(updates)) {
        if (['creditLimit', 'salaryBank', 'verified', 'status'].includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
      }

      updateFields.push('updatedAt = CURRENT_TIMESTAMP');
      updateValues.push(nuit);

      await db.run(
        `UPDATE customers SET ${updateFields.join(', ')} WHERE nuit = ?`,
        updateValues
      );

      const updated = await db.get('SELECT * FROM customers WHERE nuit = ?', [nuit]);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Deletar cliente
  router.delete('/:nuit', async (req, res) => {
    try {
      const { nuit } = req.params;

      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      await db.run('DELETE FROM customers WHERE nuit = ?', [nuit]);

      res.json({ message: 'Cliente deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obter transações de cliente
  router.get('/:nuit/transactions', async (req, res) => {
    try {
      const { nuit } = req.params;

      const customer = await db.get(
        'SELECT * FROM customers WHERE nuit = ?',
        [nuit]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      const transactions = await db.all(
        'SELECT * FROM transactions WHERE customerId = ? ORDER BY createdAt DESC',
        [customer.id]
      );

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
