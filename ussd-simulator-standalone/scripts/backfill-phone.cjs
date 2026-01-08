#!/usr/bin/env node
const Database = require('../src/database.cjs');

(async () => {
  const db = new Database();
  // wait briefly for init
  await new Promise(r => setTimeout(r, 800));
  try {
    const pragma = await db.all('PRAGMA table_info(customers)');
    const cols = (pragma || []).map(c => c.name);

    if (cols.includes('phoneNumber') && cols.includes('msisdn')) {
      const res = await db.run("UPDATE customers SET phoneNumber = msisdn WHERE (phoneNumber IS NULL OR phoneNumber = '') AND msisdn IS NOT NULL");
      console.log('Backfill: phoneNumber <- msisdn, changes=', res.changes || 0);
    }
    if (cols.includes('phoneNumber') && cols.includes('phone')) {
      const res = await db.run("UPDATE customers SET phoneNumber = phone WHERE (phoneNumber IS NULL OR phoneNumber = '') AND phone IS NOT NULL");
      console.log('Backfill: phoneNumber <- phone, changes=', res.changes || 0);
    }
    if (cols.includes('createdAt') && cols.includes('created_at')) {
      const res = await db.run("UPDATE customers SET createdAt = created_at WHERE (createdAt IS NULL OR createdAt = '') AND created_at IS NOT NULL");
      console.log('Backfill: createdAt <- created_at, changes=', res.changes || 0);
    }

    console.log('Backfill complete');
  } catch (e) {
    console.error('Backfill error:', e && e.message ? e.message : e);
  }
  await db.close();
  process.exit(0);
})();
