const Database = require('./src/database.cjs');

async function check() {
  const db = new Database();
  await new Promise(r => setTimeout(r, 2000));
  try {
    const customers = await db.getAllCustomers();
    console.log('TOTAL_CUSTOMERS:', customers.length);
    const target = '258865678901';
    const found = customers.filter(c => (c.msisdn === target) || (c.phoneNumber === target) || (String(c.phone) === target) );
    if (found.length) {
      console.log('FOUND:', JSON.stringify(found, null, 2));
    } else {
      console.log('NOT FOUND: customer', target);
    }
  } catch (e) {
    console.error('ERROR listing customers:', e);
  } finally {
    await db.close();
  }
}

check();
