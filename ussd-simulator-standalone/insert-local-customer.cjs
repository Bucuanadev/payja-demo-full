const path = require('path');
const Database = require('./src/database.cjs');

async function insert() {
  // Force using the simulator local DB file
  process.env.SIMULATOR_DB = path.resolve(__dirname, 'data', 'ussd.db');
  const db = new Database();
  await new Promise(r => setTimeout(r, 1500));
  try {
    const msisdn = '258865678901';
    const name = 'Pedro Manuel Sitoe';
    console.log('Inserting', msisdn, name, 'into', process.env.SIMULATOR_DB);
    // Inspect columns to satisfy NOT NULL constraints (e.g., nuit)
    const pragma = await db.all('PRAGMA table_info(customers)');
    const cols = pragma.map(p => p.name);
    const insertCols = [];
    const placeholders = [];
    const values = [];

    // Ensure PayJA-required phoneNumber is set when present
    if (cols.includes('phoneNumber')) { insertCols.push('phoneNumber'); placeholders.push('?'); values.push(msisdn); }
    else if (cols.includes('msisdn')) { insertCols.push('msisdn'); placeholders.push('?'); values.push(msisdn); }
    else if (cols.includes('phone')) { insertCols.push('phone'); placeholders.push('?'); values.push(msisdn); }

    if (cols.includes('name')) { insertCols.push('name'); placeholders.push('?'); values.push(name); }
    else if (cols.includes('fullName')) { insertCols.push('fullName'); placeholders.push('?'); values.push(name); }
    else {
      // if name column is required but missing, still proceed (some schemas may have firstName/lastName)
    }

    // Provide a nuit if column exists and is NOT NULL
    if (cols.includes('nuit')) {
      const nuitVal = '100567892';
      insertCols.push('nuit'); placeholders.push('?'); values.push(nuitVal);
    }

    // createdAt/updatedAt
    if (cols.includes('createdAt')) { insertCols.push('createdAt'); placeholders.push('?'); values.push(new Date().toISOString()); }
    else if (cols.includes('created_at')) { insertCols.push('created_at'); placeholders.push('?'); values.push(new Date().toISOString()); }

    if (insertCols.length === 0) throw new Error('No writable customer columns found');

    const sql = `INSERT OR REPLACE INTO customers (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`;
    const runRes = await db.run(sql, values);
    console.log('Inserted result:', runRes);

    const all = await db.getAllCustomers(true);
    console.log('TOTAL after insert:', all.length);
    const found = all.filter(c => (c.msisdn === msisdn) || (c.phoneNumber === msisdn) || (String(c.phone) === msisdn));
    if (found.length) console.log('FOUND:', JSON.stringify(found, null, 2));
    else console.log('NOT FOUND after insert (unexpected)');
  } catch (e) {
    console.error('ERROR inserting local customer:', e);
  } finally {
    await db.close();
  }
}

insert();
