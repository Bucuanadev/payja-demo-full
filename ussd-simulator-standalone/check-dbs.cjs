const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const targets = [
  path.resolve(__dirname, '..', 'backend', 'prisma', 'dev.db'),
  path.resolve(__dirname, 'data', 'ussd.db')
];
const msisdn = '258865678901';

async function checkDb(dbPath){
  return new Promise((resolve)=>{
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err)=>{
      if(err){ console.error('OPEN ERR', dbPath, err.message); return resolve(null); }
      db.get("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='customers'", (e,r)=>{
        if(e){ console.error('MASTER ERR', dbPath, e.message); db.close(); return resolve(null); }
        if(!r || r.cnt===0){ console.log('NO customers TABLE IN', dbPath); db.close(); return resolve(null); }
        db.all('PRAGMA table_info(customers)', (errc, cols) => {
          if (errc) { console.error('PRAGMA ERR', dbPath, errc.message); db.close(); return resolve(null); }
          const colNames = (cols||[]).map(c=>c.name);
          const checks = [];
          const params = [];
          if (colNames.includes('msisdn')) { checks.push('msisdn = ?'); params.push(msisdn); }
          if (colNames.includes('phoneNumber')) { checks.push('phoneNumber = ?'); params.push(msisdn); }
          if (colNames.includes('phone')) { checks.push('phone = ?'); params.push(msisdn); }
          if (checks.length === 0) {
            console.log('NO MATCHABLE PHONE COLUMNS IN', dbPath);
            db.close();
            return resolve(null);
          }
          const q = `SELECT * FROM customers WHERE ${checks.join(' OR ')} LIMIT 1`;
          db.get(q, params, (er,row)=>{
            if(er) console.error('QUERY ERR', dbPath, er.message);
            else if(row) console.log('FOUND IN', dbPath, JSON.stringify(row));
            else console.log('NOT FOUND IN', dbPath);
            db.close();
            resolve(row);
          });
        });
      });
    });
  });
}

(async()=>{
  for(const p of targets){
    await checkDb(p);
  }
})();
