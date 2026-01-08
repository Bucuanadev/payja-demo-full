const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const candidates = ['ussd_simulator.db','ussd.db','ussd-react.db'];
const base = path.join(__dirname, '..', 'data');
const outPath = path.join(__dirname, '..', 'data_existing_dump.json');
const result = {};

(async ()=>{
  for (const name of candidates) {
    const p = path.join(base, name);
    if (!fs.existsSync(p)) { result[name] = { exists: false }; continue; }
    result[name] = { exists: true };
    const db = new sqlite3.Database(p);
    await new Promise((resolve)=>{
      db.serialize(()=>{
        db.get("SELECT COUNT(*) as count FROM customers", (err,row)=>{ result[name].total = err ? String(err) : (row?row.count:0); });
        db.get("SELECT COUNT(*) as count FROM customers WHERE synced_with_payja = 0", (err,row)=>{ result[name].unsynced = err ? String(err) : (row?row.count:0); });
        db.all("SELECT msisdn, name, created_at, synced_with_payja FROM customers ORDER BY created_at DESC LIMIT 20", (err,rows)=>{ result[name].rows = err ? String(err) : (rows||[]); });
        db.all("SELECT msisdn, sync_status, sync_date, details FROM sync_logs ORDER BY sync_date DESC LIMIT 20", (err,rows)=>{ result[name].logs = err ? String(err) : (rows||[]); });
        setTimeout(()=>{ db.close(); resolve(); }, 200);
      });
    });
  }
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Wrote', outPath);
})();
