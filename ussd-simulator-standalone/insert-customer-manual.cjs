const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'backend', 'prisma', 'dev.db');
const phone = '258865678901';
const name = 'Pedro Manuel Sitoe';
const nuit = '100567892';

const { randomUUID } = require('crypto');
const db = new sqlite3.Database(dbPath, (err)=>{ if(err) return console.error('open err', err); });
(async()=>{
  try{
    const now = new Date().toISOString();
    // Use INSERT OR REPLACE to avoid UNIQUE conflicts and ensure row exists
    const id = randomUUID();
    const sql = `INSERT OR REPLACE INTO customers (id, phoneNumber, msisdn, name, nuit, createdAt, updatedAt, verified, isActive, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await new Promise((res,rej)=> db.run(sql, [id, phone, phone, name, nuit, now, now, 1, 1, 'verified'], function(err){ if(err) return rej(err); res(this); }));
    console.log('Inserted/replaced customer', phone);
    const row = await new Promise((res,rej)=> db.get('SELECT * FROM customers WHERE phoneNumber = ? OR msisdn = ? LIMIT 1', [phone, phone], (e,r)=> e?rej(e):res(r)));
    console.log('ROW:', row);
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); }
  finally{ db.close(); }
})();
