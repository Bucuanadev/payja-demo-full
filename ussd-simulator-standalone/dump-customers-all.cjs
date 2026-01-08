const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const candidates = [
  path.resolve(__dirname, '..', 'backend', 'prisma', 'dev.db'),
  path.resolve(__dirname, 'data', 'ussd.db')
];

(async()=>{
  for(const dbPath of candidates){
    console.log('\n--- DB:', dbPath);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err)=>{
      if(err){ console.error('OPEN ERR', err.message); return; }
    });
    try{
      const tables = await new Promise((res,rej)=> db.all("SELECT name FROM sqlite_master WHERE type='table'", (e,r)=> e?rej(e):res(r)));
      const hasCustomers = tables.some(t=>t.name==='customers');
      if(!hasCustomers){ console.log(' no customers table'); db.close(); continue; }
      const cols = await new Promise((res,rej)=> db.all('PRAGMA table_info(customers)', (e,r)=> e?rej(e):res(r)));
      const colNames = cols.map(c=>c.name);
      console.log(' columns:', colNames.join(','));
      const rows = await new Promise((res,rej)=> db.all('SELECT * FROM customers LIMIT 50', (e,r)=> e?rej(e):res(r)));
      console.log(' rows count:', rows.length);
      rows.forEach((row,i)=>{
        const phones = ['msisdn','phoneNumber','phone'].map(k=> row[k] ? `${k}=${row[k]}` : null).filter(Boolean).join(', ');
        console.log(i+1, phones || JSON.stringify(row));
      });
    }catch(err){ console.error('ERR', err && err.message); }
    finally{ db.close(); }
  }
})();
