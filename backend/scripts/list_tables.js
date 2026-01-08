const sqlite3 = require('sqlite3').verbose();
const dbPath = require('path').resolve(__dirname, '..', 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('open error', err);
    process.exit(1);
  }
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) { console.error('query error', err); process.exit(1); }
    console.log('DB:', dbPath);
    console.log(rows.map(r => r.name).join('\n'));
    db.close();
  });
});
