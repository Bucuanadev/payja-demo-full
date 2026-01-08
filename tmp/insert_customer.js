const path = require('path');
const Database = require('../ussd-simulator-standalone/src/database.cjs');

(async()=>{
  try{
    process.env.SIMULATOR_DB = path.resolve(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd.db');
    const db = new Database();
    await new Promise(r=>setTimeout(r,1200));
    const target = {
      phoneNumber: '862345678',
      msisdn: '862345678',
      name: 'Maria Santos Machado',
      nuit: '100345678',
      biNumber: '2345678901234M',
      institution: 'Hospital Central de Maputo',
      createdAt: '2026-01-03T18:13:58.406Z',
      status: 'Pendente',
      verified: 0
    };

    const cols = await db.all('PRAGMA table_info(customers)');
    const colNames = cols.map(c=>c.name);
    const insertCols = [];
    const placeholders = [];
    const values = [];

    const setIf = (col, val) => {
      if(colNames.includes(col)){
        insertCols.push(col);
        placeholders.push('?');
        values.push(val);
        return true;
      }
      return false;
    };

    setIf('phoneNumber', target.phoneNumber) || setIf('msisdn', target.msisdn) || setIf('phone', target.phoneNumber);
    setIf('msisdn', target.msisdn);
    setIf('name', target.name);
    setIf('nuit', target.nuit);
    setIf('biNumber', target.biNumber);
    setIf('institution', target.institution);
    if(colNames.includes('createdAt')){ insertCols.push('createdAt'); placeholders.push('?'); values.push(target.createdAt); }
    else if(colNames.includes('created_at')){ insertCols.push('created_at'); placeholders.push('?'); values.push(target.createdAt); }
    setIf('status', target.status);
    if(colNames.includes('verified')){ insertCols.push('verified'); placeholders.push('?'); values.push(target.verified); }

    if(insertCols.length === 0) throw new Error('No writable columns found');

    const sql = `INSERT OR REPLACE INTO customers (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`;
    const res = await db.run(sql, values);
    console.log('INSERT RES:', res);

    const found = await db.all('SELECT * FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ? LIMIT 5', [target.phoneNumber, target.msisdn, target.phoneNumber]);
    console.log('FOUND:', found);
    await db.close();
  }catch(e){ console.error('ERR', e); process.exit(1); }
})();
