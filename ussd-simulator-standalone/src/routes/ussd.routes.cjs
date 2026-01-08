const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/ussd/customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        fullName: true,
        nuit: true,
        birthDate: true,
        address: true,
        district: true,
        province: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccess: true
      }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      phoneNumber: c.phone || '',
      name: c.fullName || '',
      nuit: c.nuit || null,
      dateOfBirth: c.birthDate ? new Date(c.birthDate).toISOString() : null,
      address: c.address || '',
      district: c.district || '',
      province: c.province || '',
      verified: (c.status || '').toLowerCase() === 'active',
      blocked: (c.status || '').toLowerCase() === 'blocked',
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
      lastAccess: c.lastAccess ? new Date(c.lastAccess).toISOString() : null
    }));

    const stats = {
      total: formatted.length,
      verified: formatted.filter(c => c.verified).length,
      pending: formatted.filter(c => !c.verified && !c.blocked).length,
      blocked: formatted.filter(c => c.blocked).length
    };

    res.json({ success: true, customers: formatted, stats });
  } catch (error) {
    console.error('Erro ao buscar clientes (USSD):', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
  }
});

// GET /api/ussd/customers/:phoneNumber
router.get('/customers/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    const customer = await prisma.customer.findUnique({
      where: { phone: phoneNumber }
    });

    if (!customer) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

    const formatted = {
      id: customer.id,
      phoneNumber: customer.phone || '',
      name: customer.fullName || '',
      nuit: customer.nuit || null,
      dateOfBirth: customer.birthDate ? new Date(customer.birthDate).toISOString() : null,
      address: customer.address || '',
      district: customer.district || '',
      province: customer.province || '',
      verified: (customer.status || '').toLowerCase() === 'active',
      blocked: (customer.status || '').toLowerCase() === 'blocked',
      createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
      updatedAt: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : null,
      lastAccess: customer.lastAccess ? new Date(customer.lastAccess).toISOString() : null
    };

    res.json({ success: true, customer: formatted });
  } catch (error) {
    console.error('Erro ao buscar cliente (USSD):', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar cliente' });
  }
});

// POST /api/ussd/customers - criar/atualizar
router.post('/customers', async (req, res) => {
  try {
    const { phoneNumber, name, nuit, dateOfBirth, address, district, province } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, error: 'Número de telefone é obrigatório' });

    const existing = await prisma.customer.findUnique({ where: { phone: phoneNumber } });

    if (existing) {
      const updated = await prisma.customer.update({
        where: { phone: phoneNumber },
        data: {
          fullName: name || existing.fullName,
          nuit: nuit || existing.nuit,
          birthDate: dateOfBirth ? new Date(dateOfBirth) : existing.birthDate,
          address: address || existing.address,
          district: district || existing.district,
          province: province || existing.province,
          lastAccess: new Date()
        }
      });
      return res.json({ success: true, customer: updated, message: 'Cliente atualizado com sucesso' });
    }

    const created = await prisma.customer.create({
      data: {
        phone: phoneNumber,
        fullName: name || '',
        nuit,
        birthDate: dateOfBirth ? new Date(dateOfBirth) : null,
        address,
        district,
        province
      }
    });

    res.status(201).json({ success: true, customer: created, message: 'Cliente registado com sucesso' });
  } catch (error) {
    console.error('Erro ao criar/atualizar cliente (USSD):', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('nuit')) {
      return res.status(400).json({ success: false, error: 'NUIT já registado no sistema' });
    }
    res.status(500).json({ success: false, error: 'Erro ao registar cliente' });
  }
});

// PUT /api/ussd/customers/:phoneNumber
router.put('/customers/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    const updateData = { ...req.body };
    delete updateData.phoneNumber;
    delete updateData.createdAt;
    if (updateData.name) { updateData.fullName = updateData.name; delete updateData.name; }
    if (updateData.dateOfBirth) { updateData.birthDate = new Date(updateData.dateOfBirth); delete updateData.dateOfBirth; }
    updateData.updatedAt = new Date();

    const customer = await prisma.customer.update({ where: { phone: phoneNumber }, data: updateData });
    res.json({ success: true, customer, message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cliente (USSD):', error);
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    res.status(500).json({ success: false, error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/ussd/customers/:phoneNumber
router.delete('/customers/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    await prisma.customer.delete({ where: { phone: phoneNumber } });
    res.json({ success: true, message: 'Cliente eliminado com sucesso' });
  } catch (error) {
    console.error('Erro ao eliminar cliente (USSD):', error);
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    res.status(500).json({ success: false, error: 'Erro ao eliminar cliente' });
  }
});

module.exports = router;
