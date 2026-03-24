const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const fs = require('fs');

const DB_PATH = '/root/payja-demo-full/backend/prisma/dev.db';
const BANCO_API_URL = 'http://localhost:4500/api/payja-decisions';

async function syncDecisions() {
  console.log('🔄 Iniciando sincronização de decisões do PayJA para o Banco Mock...');
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.all(`
    SELECT c.nuit, c.name, c.phoneNumber, s.decision, s.maxAmount, s.factors, s.calculatedAt
    FROM customers c
    JOIN scoring_results s ON c.id = s.customerId
    WHERE s.id IN (SELECT MAX(id) FROM scoring_results GROUP BY customerId)
  `, async (err, rows) => {
    if (err) {
      console.error('❌ Erro ao ler banco de dados do PayJA:', err);
      return;
    }

    console.log(`📊 Encontrados ${rows.length} resultados de scoring para sincronizar.`);

    for (const row of rows) {
      try {
        const factors = JSON.parse(row.factors);
        const bankReason = factors.bankReason || '';
        
        const payload = {
          nuit: row.nuit,
          nome_completo: row.name,
          telefone: row.phoneNumber,
          decision: row.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          creditLimit: row.maxAmount,
          rejectionReasons: bankReason ? bankReason.split(' | ') : [],
          score: row.finalScore || 0,
          decidedAt: row.calculatedAt
        };

        const response = await axios.post(BANCO_API_URL, payload);
        if (response.data.success) {
          console.log(`✅ Sincronizado: ${row.nuit} (${row.decision})`);
        }
      } catch (error) {
        console.error(`❌ Erro ao sincronizar ${row.nuit}:`, error.message);
      }
    }
    
    db.close();
    console.log('🏁 Sincronização concluída.');
  });
}

syncDecisions();
