const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'ussd_simulator.db');
const outPath = path.join(__dirname, '..', 'data_dump.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(outPath, JSON.stringify({ error: 'db_missing', dbPath }, null, 2));
  console.log('DB missing:', dbPath);
  process.exit(0);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    fs.writeFileSync(outPath, JSON.stringify({ error: err.message }, null, 2));
    console.error(err);
    process.exit(1);
  }
});

const result = {};

db.serialize(() => {
  db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
    result.total = err ? String(err) : (row ? row.count : 0);
  });
  db.get('SELECT COUNT(*) as count FROM customers WHERE synced_with_payja = 0', (err, row) => {
    result.unsynced = err ? String(err) : (row ? row.count : 0);
  });
  db.all('SELECT msisdn, name, created_at, synced_with_payja FROM customers ORDER BY created_at DESC LIMIT 20', (err, rows) => {
    result.rows = err ? String(err) : (rows || []);
  });
  db.all('SELECT msisdn, sync_status, sync_date, details FROM sync_logs ORDER BY sync_date DESC LIMIT 20', (err, rows) => {
    result.logs = err ? String(err) : (rows || []);
  });

  setTimeout(() => {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log('Wrote dump to', outPath);
    db.close();
  }, 300);
});
