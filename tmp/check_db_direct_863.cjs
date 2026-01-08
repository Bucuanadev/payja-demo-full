const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd.db');
console.log('Checking DB file:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Could not open DB:', err.message);
    process.exit(1);
  }
});

const msisdn = '863456789';
const q = `SELECT * FROM customers WHERE msisdn = ? OR phoneNumber = ? OR phone = ? OR phoneNumber LIKE ?`;

db.all(q, [msisdn, msisdn, msisdn, msisdn + '%'], (err, rows) => {
  if (err) {
    console.error('Query error:', err.message);
    db.close();
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    db.get('SELECT COUNT(*) as count FROM customers', (err2, row) => {
      if (err2) console.error('Count error:', err2.message);
      else console.log('NOT FOUND:', msisdn, '- total customers:', row ? row.count : 'unknown');
      db.close();
    });
  } else {
    console.log('FOUND', rows.length, 'row(s):');
    console.log(JSON.stringify(rows, null, 2));
    db.close();
  }
});
