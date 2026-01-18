const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/sync/status - retorna timestamps de sincronização
router.get('/status', (req, res) => {
  try {
    const metrics = db.getMetrics();
    res.json({
      sucesso: true,
      data: {
        last_payja_pull_at: metrics.last_payja_pull_at,
        last_payja_loans_sync_at: metrics.last_payja_loans_sync_at,
        server_time: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

module.exports = router;
