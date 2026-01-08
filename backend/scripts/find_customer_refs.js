const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const phone = process.argv[2] || '258700112233';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('open error', err); process.exit(1); }
  db.get('SELECT id, phoneNumber, name FROM customers WHERE phoneNumber = ?', [phone], (err, customer) => {
    if (err) { console.error('query error', err); db.close(); process.exit(1); }
    if (!customer) { console.log('Customer not found for phone', phone); db.close(); return; }
    console.log('Customer:', customer);

    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
      if (err) { console.error(err); db.close(); process.exit(1); }
      const tables = rows.map(r => r.name);
      (async () => {
        for (const t of tables) {
          await new Promise((res, rej) => {
            db.all(`PRAGMA foreign_key_list(${t})`, (err, fks) => {
              if (err) return res();
              if (!fks || fks.length === 0) return res();
              // check if any fk references customers
              const refs = fks.filter(f => f.table === 'customers');
              if (refs.length === 0) return res();
              // for each fk, check count
              (async () => {
                for (const fk of refs) {
                  const col = fk.from;
                  db.get(`SELECT COUNT(*) as c FROM ${t} WHERE ${col} = ?`, [customer.id], (err, r) => {
                    if (err) { console.error(`Error counting refs in ${t}.${col}`, err); return; }
                    console.log(`Table ${t} -> column ${col} references customers: count=${r.c}`);
                  });
                }
                res();
              })();
            });
          });
        }
        console.log('Done checking foreign-key references.');
        db.close();
      })();
    });
  });
});
