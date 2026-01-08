const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('open error', err); process.exit(1); }
  db.all("SELECT id, phoneNumber, name, createdAt FROM customers WHERE phoneNumber LIKE '%700112233%' OR name LIKE '%Sim Teste Browser%'", (err, rows) => {
    if (err) { console.error('query error', err); db.close(); process.exit(1); }
    console.log('Matches:', rows.length);
    for (const r of rows) console.log(r);
    db.close();
  });
});
