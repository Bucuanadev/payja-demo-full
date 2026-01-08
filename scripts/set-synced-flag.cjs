#!/usr/bin/env node
const Database = require('../ussd-simulator-standalone/src/database.cjs');
const fetch = global.fetch || require('node-fetch');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/set-synced-flag.cjs <msisdn> [0|1] [--sync-backend http://localhost:3000]');
    process.exit(2);
  }
  const msisdn = args[0];
  const flag = args[1] === '1' ? 1 : 0;
  const syncArgIndex = args.findIndex(a => a === '--sync-backend');
  const syncUrl = (syncArgIndex !== -1 && args[syncArgIndex+1]) ? args[syncArgIndex+1] : null;

  const db = new Database();
  await new Promise(r => setTimeout(r, 300));
  try {
    const pragma = await db.all('PRAGMA table_info(customers)');
    const cols = pragma.map(c => c.name);
    if (!cols.includes('synced_with_payja')) {
      console.warn('DB has no synced_with_payja column; adding it');
      await db.run('ALTER TABLE customers ADD COLUMN synced_with_payja INTEGER DEFAULT 0');
    }
    const q = 'UPDATE customers SET synced_with_payja = ? WHERE msisdn = ? OR phoneNumber = ? OR phone = ?';
    const res = await db.run(q, [flag, msisdn, msisdn, msisdn]);
    console.log('DB update result:', res);
  } catch (e) {
    console.error('DB error:', e && e.message ? e.message : e);
  } finally {
    await db.close();
  }

  if (syncUrl) {
    try {
      const endpoint = syncUrl.replace(/\/$/, '') + '/api/v1/integrations/ussd/sync-new-customers';
      console.log('Triggering backend sync at', endpoint);
      const r = await fetch(endpoint, { method: 'POST' });
      console.log('Sync status:', r.status);
      try { const j = await r.json(); console.log('Sync response:', j); } catch (e) { const t = await r.text(); console.log('Sync body:', t); }
    } catch (e) {
      console.error('Sync request failed:', e && e.message ? e.message : e);
    }
  }
}

main().catch(e=>{ console.error(e && e.message ? e.message : e); process.exit(1); });
