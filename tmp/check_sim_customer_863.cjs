const Database = require('../ussd-simulator-standalone/src/database.cjs');

(async () => {
  try {
    const db = new Database();
    // wait a short moment for init
    await new Promise(r => setTimeout(r, 300));
    const msisdn = '863456789';
    const q = `SELECT * FROM customers WHERE msisdn = ? OR phoneNumber = ? OR phone = ? OR phoneNumber LIKE ?`;
    const rows = await db.all(q, [msisdn, msisdn, msisdn, msisdn + '%']);
    if (!rows || rows.length === 0) {
      const total = await db.get('SELECT COUNT(*) as count FROM customers');
      console.log('NOT FOUND:', msisdn);
      console.log('Total customers in DB:', total ? total.count : 0);
    } else {
      console.log('FOUND', rows.length, 'row(s):');
      console.log(JSON.stringify(rows, null, 2));
    }
    await db.close();
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
