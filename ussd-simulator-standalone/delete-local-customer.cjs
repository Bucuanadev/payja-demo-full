const path = require('path');
const Database = require('./src/database.cjs');

async function remove() {
  // Force using the simulator local DB file
  process.env.SIMULATOR_DB = path.resolve(__dirname, 'data', 'ussd.db');
  const db = new Database();
  await new Promise(r => setTimeout(r, 1500));
  try {
    const msisdn = '258865678901';
    console.log('Deleting customer', msisdn, 'from', process.env.SIMULATOR_DB);
    // Try deleting by phoneNumber first
    const res = await db.run('DELETE FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [msisdn, msisdn, msisdn]);
    console.log('Delete result:', res);
    const all = await db.getAllCustomers(true);
    console.log('TOTAL after delete:', all.length);
    const found = all.filter(c => (c.msisdn === msisdn) || (c.phoneNumber === msisdn) || (String(c.phone) === msisdn));
    if (found.length) console.log('STILL FOUND:', JSON.stringify(found, null, 2));
    else console.log('CONFIRMED REMOVED');
  } catch (e) {
    console.error('ERROR deleting local customer:', e);
  } finally {
    await db.close();
  }
}

remove();
