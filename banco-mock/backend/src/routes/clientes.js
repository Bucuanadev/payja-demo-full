const express = require('express');
const router = express.Router();
const db = require('../database');

// GET - Listar todos os clientes
router.get('/', (req, res) => {
  try {
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

    // Buscar transações
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
router.post('/', (req, res) => {
  try {
    const cliente = db.createCliente(req.body);
    
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
router.patch('/:id', (req, res) => {
  try {
    const cliente = db.updateCliente(req.params.id, req.body);
    
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

module.exports = router;
