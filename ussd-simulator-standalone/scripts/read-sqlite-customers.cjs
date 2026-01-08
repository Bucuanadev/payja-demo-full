const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../backend/prisma/dev.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error('open err', err); process.exit(1); }
});

db.all("SELECT id, phoneNumber, name, nuit, createdAt FROM customers ORDER BY createdAt DESC LIMIT 200", [], (err, rows) => {
  if (err) {
    console.error('query err', err.message);
    process.exit(1);
  }
  console.log('rows:', rows.length);
  rows.forEach(r => console.log(r));
  db.close();
});
