const sqlite3 = require('sqlite3').verbose();
const dbPath = 'ussd-simulator-standalone/data/ussd.db';
const db = new sqlite3.Database(dbPath, (e)=>{ if(e){ console.error('OPEN ERROR', e); process.exit(1);} });
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'", (err, row) => {
  if (err) { console.error('ERROR', err); process.exit(1); }
  console.log('CREATE_SQL:');
  console.log(row ? row.sql : 'NO_TABLE');
  db.close();
});
