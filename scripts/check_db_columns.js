const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
(async ()=>{
  try {
    const db = await open({ filename: 'ussd-simulator-standalone/prisma/dev.db', driver: sqlite3.Database });
    const rows = await db.all("PRAGMA table_info(customers)");
    console.log(JSON.stringify(rows, null, 2));
    await db.close();
  } catch (err) {
    console.error('ERR', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
