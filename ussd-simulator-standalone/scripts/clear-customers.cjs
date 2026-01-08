const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();

(async function main() {
  try {
    const dbPath = path.join(__dirname, '../../backend/prisma/dev.db');
    console.log('Opening DB at', dbPath);
    const db = await open({ filename: dbPath, driver: sqlite3.Database });

    // Delete all customers
    const result = await db.run('DELETE FROM customers');
    console.log('Deleted customers, result:', result);

    const row = await db.get('SELECT COUNT(*) as c FROM customers');
    console.log('Remaining customers:', row ? row.c : 0);

    await db.close();
    console.log('DB closed');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing customers:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
