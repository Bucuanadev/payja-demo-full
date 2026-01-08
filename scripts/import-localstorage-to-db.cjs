#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('../ussd-simulator-standalone/src/database.cjs');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/import-localstorage-to-db.cjs <localstorage.json>');
    process.exit(2);
  }
  const file = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(file)) { console.error('File not found:', file); process.exit(1); }
  const raw = fs.readFileSync(file, 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.error('Invalid JSON:', e.message); process.exit(1); }
  // Accept several shapes: top-level array, { customers: [...] }, { data: [...] } or { success:..., data: [...] }
  const customers = Array.isArray(obj)
    ? obj
    : Array.isArray(obj.customers)
    ? obj.customers
    : Array.isArray(obj.data)
    ? obj.data
    : (obj && obj.success && Array.isArray(obj.data))
    ? obj.data
    : [];
  if (!customers || customers.length === 0) { console.log('No customers to import'); process.exit(0); }

  const db = new Database();
  // wait a bit for DB init
  await new Promise(r => setTimeout(r, 500));

  for (const c of customers) {
    const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
    if (!phone) {
      console.warn('Skipping customer with no phone:', JSON.stringify(c));
      continue;
    }
    const name = c.name || c.fullName || 'Cliente';
    const nuit = c.nuit || c.NUIT || (`MISSING-${Date.now()}`);
    const bi = c.biNumber || c.bi || null;
    try {
      // try to detect columns and upsert similarly to server
      const colsInfo = await db.all('PRAGMA table_info(customers)');
      const cols = colsInfo.map(x => x.name);
      // see if existing
      const phoneCols = ['phoneNumber','msisdn','phone'].filter(x => cols.includes(x));
      let existing = null;
      if (phoneCols.length > 0) {
        const where = phoneCols.map(() => `${phoneCols[0]} = ?`).join(' OR ');
        // simple lookup by phone in any of those columns
        const params = phoneCols.map(() => phone);
        try { existing = await db.get(`SELECT * FROM customers WHERE ${phoneCols.map(cn => `${cn} = ?`).join(' OR ')}`, params); } catch(e) {}
      }
      if (existing) {
        await db.run('UPDATE customers SET name = ?, nuit = ?, biNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [name, nuit, bi, existing.id]);
        console.log('Updated', phone);
      } else {
        // build insert based on available columns
        const insertCols = [];
        const insertPlaceholders = [];
        const insertParams = [];
        if (cols.includes('msisdn')) { insertCols.push('msisdn'); insertPlaceholders.push('?'); insertParams.push(phone); }
        if (cols.includes('phoneNumber') && !insertCols.includes('phoneNumber')) { insertCols.push('phoneNumber'); insertPlaceholders.push('?'); insertParams.push(phone); }
        if (cols.includes('phone') && !insertCols.includes('phone')) { insertCols.push('phone'); insertPlaceholders.push('?'); insertParams.push(phone); }
        if (cols.includes('name')) { insertCols.push('name'); insertPlaceholders.push('?'); insertParams.push(name); }
        if (cols.includes('fullName') && !insertCols.includes('fullName')) { insertCols.push('fullName'); insertPlaceholders.push('?'); insertParams.push(name); }
        if (cols.includes('nuit')) { insertCols.push('nuit'); insertPlaceholders.push('?'); insertParams.push(nuit); }
        if (cols.includes('biNumber')) { insertCols.push('biNumber'); insertPlaceholders.push('?'); insertParams.push(bi); }
        if (cols.includes('verified')) { insertCols.push('verified'); insertPlaceholders.push('?'); insertParams.push(c.verified ? 1 : 0); }
        if (cols.includes('status')) { insertCols.push('status'); insertPlaceholders.push('?'); insertParams.push(c.status || 'registered'); }
        if (cols.includes('createdAt')) { insertCols.push('createdAt'); insertPlaceholders.push('?'); insertParams.push(new Date().toISOString()); }
        if (cols.includes('updatedAt')) { insertCols.push('updatedAt'); insertPlaceholders.push('?'); insertParams.push(new Date().toISOString()); }

        if (insertCols.length === 0) {
          console.warn('No compatible columns to insert for', phone);
          continue;
        }
        const q = `INSERT INTO customers (${insertCols.join(',')}) VALUES (${insertPlaceholders.join(',')})`;
        await db.run(q, insertParams);
        console.log('Inserted', phone);
      }
    } catch (e) {
      console.error('Error processing', phone, e && e.message ? e.message : e);
    }
  }

  await db.close();
  console.log('Done');
}

main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
