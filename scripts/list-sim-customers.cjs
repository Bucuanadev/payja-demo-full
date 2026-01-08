#!/usr/bin/env node
const Database = require('../ussd-simulator-standalone/src/database.cjs');
(async () => {
  const db = new Database();
  await new Promise(r => setTimeout(r, 500));
  try {
    const rows = await db.all('SELECT id, msisdn, phoneNumber, phone, name, nuit, synced_with_payja, createdAt FROM customers ORDER BY createdAt DESC LIMIT 50');
    console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
  } catch (e) {
    console.error('Error querying DB:', e && e.message ? e.message : e);
    process.exit(2);
  } finally {
    await db.close();
  }
})();
