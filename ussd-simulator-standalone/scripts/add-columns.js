import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function ensureColumns() {
  const dbPath = 'C:/Users/User/Downloads/ussd/payja-demo/ussd-simulator-standalone/data/ussd-react.db';
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const cols = await db.all("PRAGMA table_info(customers)");
  const names = cols.map(c => c.name);
  if (!names.includes('institution')) {
    console.log('Adding institution column to customers...');
    await db.exec('ALTER TABLE customers ADD COLUMN institution TEXT');
  } else {
    console.log('institution column already exists');
  }
  await db.close();
}

ensureColumns().catch(err => { console.error(err); process.exit(1); });
