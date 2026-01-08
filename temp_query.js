const Database = require('./ussd-simulator-standalone/src/database.cjs');
(async()=>{
  const db = new Database();
  await new Promise(r => setTimeout(r, 800));
  try {
    const row = await db.get("SELECT * FROM customers WHERE nuit = '100567890' LIMIT 1");
    console.log(JSON.stringify(row, null, 2));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await db.close();
  }
})();