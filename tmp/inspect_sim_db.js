const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd.db');
const db = new sqlite3.Database(dbPath, (e)=>{ if(e){ console.error('OPEN ERROR', e); process.exit(1);} });
db.all("PRAGMA table_info(customers)", (err, rows)=>{
  if(err){ console.error('PRAGMA ERROR', err); process.exit(1); }
  console.log('DB_PATH:', dbPath);
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
