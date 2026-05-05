// routes/dossier.js — Gestão de dossier de clientes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');

// Directório de uploads
const UPLOADS_DIR = path.join(__dirname, '../../uploads/dossiers');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clienteDir = path.join(UPLOADS_DIR, req.params.clienteId || 'temp');
    if (!fs.existsSync(clienteDir)) fs.mkdirSync(clienteDir, { recursive: true });
    cb(null, clienteDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const tipo = req.body.tipo_documento || 'documento';
    cb(null, `${tipo}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo de ficheiro não permitido. Use PDF, JPG, PNG ou DOC.'));
  }
});

// ─── GET /api/dossier/:clienteId ─── Listar documentos do cliente
router.get('/:clienteId', (req, res) => {
  try {
    const { clienteId } = req.params;
    const clienteDir = path.join(UPLOADS_DIR, clienteId);
    
    // Buscar cliente para confirmar que existe
    const cliente = db.getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    // Listar ficheiros
    let documentos = [];
    if (fs.existsSync(clienteDir)) {
      const files = fs.readdirSync(clienteDir);
      documentos = files.map(f => {
        const filePath = path.join(clienteDir, f);
        const stats = fs.statSync(filePath);
        const ext = path.extname(f).toLowerCase();
        const tipoDoc = f.split('_')[0];
        return {
          id: f,
          nome: f,
          tipo_documento: tipoDoc,
          tamanho: stats.size,
          tamanho_formatado: formatBytes(stats.size),
          data_upload: stats.mtime,
          extensao: ext,
          url: `/api/dossier/${clienteId}/download/${f}`
        };
      });
    }

    // Metadados do dossier (guardados no banco.json)
    const metadados = cliente.dossier || {
      completo: false,
      documentos_requeridos: ['BI', 'NUIT', 'COMPROVATIVO_RENDIMENTO', 'EXTRATO_BANCARIO'],
      observacoes: '',
      ultima_atualizacao: null
    };

    res.json({
      cliente_id: clienteId,
      cliente_nome: cliente.nome_completo,
      documentos,
      metadados,
      total_documentos: documentos.length
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── POST /api/dossier/:clienteId/upload ─── Upload de documento
router.post('/:clienteId/upload', (req, res) => {
  const uploadSingle = upload.single('ficheiro');
  uploadSingle(req, res, async (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro enviado' });

    try {
      const { clienteId } = req.params;
      const cliente = db.getClienteById(clienteId);
      if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

      const { tipo_documento, descricao } = req.body;

      // Actualizar metadados do dossier no cliente
      const dossier = cliente.dossier || {
        completo: false,
        documentos_requeridos: ['BI', 'NUIT', 'COMPROVATIVO_RENDIMENTO', 'EXTRATO_BANCARIO'],
        observacoes: '',
        ultima_atualizacao: null,
        documentos_meta: []
      };

      if (!dossier.documentos_meta) dossier.documentos_meta = [];
      dossier.documentos_meta.push({
        ficheiro: req.file.filename,
        tipo_documento: tipo_documento || 'OUTRO',
        descricao: descricao || '',
        data_upload: new Date().toISOString()
      });
      dossier.ultima_atualizacao = new Date().toISOString();

      // Verificar se dossier está completo
      const tiposCarregados = dossier.documentos_meta.map(d => d.tipo_documento);
      dossier.completo = dossier.documentos_requeridos.every(r => tiposCarregados.includes(r));

      // Guardar no banco
      db.updateCliente(clienteId, { dossier });

      res.json({
        sucesso: true,
        ficheiro: {
          id: req.file.filename,
          nome: req.file.filename,
          tipo_documento: tipo_documento || 'OUTRO',
          tamanho: req.file.size,
          tamanho_formatado: formatBytes(req.file.size),
          url: `/api/dossier/${clienteId}/download/${req.file.filename}`
        },
        dossier_completo: dossier.completo
      });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });
});

// ─── GET /api/dossier/:clienteId/download/:ficheiro ─── Download de documento
router.get('/:clienteId/download/:ficheiro', (req, res) => {
  try {
    const { clienteId, ficheiro } = req.params;
    const filePath = path.join(UPLOADS_DIR, clienteId, ficheiro);
    if (!fs.existsSync(filePath)) return res.status(404).json({ erro: 'Ficheiro não encontrado' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── DELETE /api/dossier/:clienteId/:ficheiro ─── Apagar documento
router.delete('/:clienteId/:ficheiro', (req, res) => {
  try {
    const { clienteId, ficheiro } = req.params;
    const filePath = path.join(UPLOADS_DIR, clienteId, ficheiro);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Actualizar metadados
    const cliente = db.getClienteById(clienteId);
    if (cliente && cliente.dossier && cliente.dossier.documentos_meta) {
      cliente.dossier.documentos_meta = cliente.dossier.documentos_meta.filter(d => d.ficheiro !== ficheiro);
      cliente.dossier.ultima_atualizacao = new Date().toISOString();
      db.updateCliente(clienteId, { dossier: cliente.dossier });
    }

    res.json({ sucesso: true, mensagem: 'Documento apagado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── PATCH /api/dossier/:clienteId/metadados ─── Actualizar metadados do dossier
router.patch('/:clienteId/metadados', (req, res) => {
  try {
    const { clienteId } = req.params;
    const cliente = db.getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    const { observacoes, documentos_requeridos } = req.body;
    const dossier = cliente.dossier || { completo: false, documentos_meta: [] };
    if (observacoes !== undefined) dossier.observacoes = observacoes;
    if (documentos_requeridos) dossier.documentos_requeridos = documentos_requeridos;
    dossier.ultima_atualizacao = new Date().toISOString();

    db.updateCliente(clienteId, { dossier });
    res.json({ sucesso: true, dossier });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = router;
