const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'data', 'ussd.db');
const backupPath = dbPath + '.bak.' + Date.now();

async function run() {
  if (!fs.existsSync(dbPath)) {
    console.error('DB file not found:', dbPath);
    process.exit(1);
  }
  fs.copyFileSync(dbPath, backupPath);
  console.log('Backup created at', backupPath);

  const db = new sqlite3.Database(dbPath);

  const runAsync = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(err){ if(err) return rej(err); res(this); }));
  const allAsync = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (err, rows)=>{ if(err) return rej(err); res(rows); }));
  try {
    const cols = await allAsync("PRAGMA table_info(customers)");
    const names = (cols||[]).map(c=>c.name);
    console.log('Existing columns:', names.join(', '));

    const need = (col) => !names.includes(col);

    // Add columns if missing
    const alterOps = [];
    if (need('phoneNumber')) alterOps.push("ALTER TABLE customers ADD COLUMN phoneNumber TEXT");
    if (need('nuit')) alterOps.push("ALTER TABLE customers ADD COLUMN nuit TEXT");
    if (need('biNumber')) alterOps.push("ALTER TABLE customers ADD COLUMN biNumber TEXT");
    if (need('verified')) alterOps.push("ALTER TABLE customers ADD COLUMN verified INTEGER DEFAULT 0");
    if (need('isActive')) alterOps.push("ALTER TABLE customers ADD COLUMN isActive INTEGER DEFAULT 1");
    if (need('status')) alterOps.push("ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'registered'");
    if (need('createdAt')) alterOps.push("ALTER TABLE customers ADD COLUMN createdAt DATETIME");
    if (need('updatedAt')) alterOps.push("ALTER TABLE customers ADD COLUMN updatedAt DATETIME");

    for (const s of alterOps) {
      try {
        console.log('Running:', s);
        await runAsync(s);
      } catch (e) {
        console.warn('Alter failed (continuing):', e.message);
      }
    }

    // Refresh columns
    const cols2 = await allAsync("PRAGMA table_info(customers)");
    const names2 = (cols2||[]).map(c=>c.name);

    // Backfill phoneNumber
    if (names2.includes('phoneNumber')) {
      console.log('Backfilling phoneNumber from msisdn/phone if empty');
      try { await runAsync("UPDATE customers SET phoneNumber = msisdn WHERE (phoneNumber IS NULL OR phoneNumber = '') AND (msisdn IS NOT NULL AND msisdn != '')"); } catch(e){}
      try { await runAsync("UPDATE customers SET phoneNumber = phone WHERE (phoneNumber IS NULL OR phoneNumber = '') AND (phone IS NOT NULL AND phone != '')"); } catch(e){}
    }

    // Backfill createdAt/updatedAt
    if (names2.includes('createdAt') && names2.includes('created_at')) {
      try { await runAsync("UPDATE customers SET createdAt = created_at WHERE (createdAt IS NULL OR createdAt = '') AND (created_at IS NOT NULL AND created_at != '')"); } catch(e){}
    }
    if (names2.includes('updatedAt') && names2.includes('updated_at')) {
      try { await runAsync("UPDATE customers SET updatedAt = updated_at WHERE (updatedAt IS NULL OR updatedAt = '') AND (updated_at IS NOT NULL AND updated_at != '')"); } catch(e){}
    }

    // Ensure nuit not null: set placeholder where NULL or empty
    if (names2.includes('nuit')) {
      try { await runAsync("UPDATE customers SET nuit = 'MISSING' WHERE nuit IS NULL OR nuit = ''"); } catch(e){}
    }

    // Create indexes
    try { await runAsync('CREATE INDEX IF NOT EXISTS idx_customers_phoneNumber ON customers(phoneNumber)'); } catch(e){}
    try { await runAsync('CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(synced_with_payja)'); } catch(e){}

    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    db.close();
  }
}

run();
