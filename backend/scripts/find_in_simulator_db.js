const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const candidates = [
  path.resolve(__dirname, '..', '..', 'ussd-simulator-standalone', 'prisma', 'dev.db'),
  path.resolve(__dirname, '..', 'ussd-simulator-standalone', 'prisma', 'dev.db'),
  path.resolve(__dirname, '..', '..', '..', 'ussd-simulator-standalone', 'prisma', 'dev.db')
];
let dbPath = null;
for (const c of candidates) if (require('fs').existsSync(c)) { dbPath = c; break; }
if (!dbPath) dbPath = path.resolve(__dirname, '..', '..', 'ussd-simulator-standalone', 'prisma', 'dev.db');
const phone = process.argv[2] || '258700112233';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('open error', err); process.exit(1); }
  db.get('SELECT * FROM customers WHERE phoneNumber = ?', [phone], (err, row) => {
    if (err) { console.error('query error', err); db.close(); process.exit(1); }
    if (!row) {
      console.log('Customer not found in simulator DB for phone', phone);
      db.close();
      return;
    }
    console.log('Simulator customer:', row);
    db.close();
  });
});
