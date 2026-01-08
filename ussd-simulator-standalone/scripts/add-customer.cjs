const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

(async () => {
  try {
    const dbPath = path.resolve(__dirname, '../../backend/prisma/dev.db');
    const db = new sqlite3.Database(dbPath);

    const id = uuidv4();
    const phoneNumber = '875551234';
    const name = 'Nome Completo';
    const nuit = '000000000';
    const dateOfBirth = null; // unknown
    const address = null;
    const district = null;
    const province = null;
    const verified = 0;
    const blocked = 0;
    const isActive = 1;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO customers (
        id, phoneNumber, name, nuit, dateOfBirth, address, district, province,
        verified, blocked, isActive, createdAt, updatedAt, lastAccess
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phoneNumber) DO UPDATE SET
        name=excluded.name,
        nuit=excluded.nuit,
        dateOfBirth=excluded.dateOfBirth,
        address=excluded.address,
        district=excluded.district,
        province=excluded.province,
        verified=excluded.verified,
        blocked=excluded.blocked,
        isActive=excluded.isActive,
        lastAccess=excluded.lastAccess,
        updatedAt=CURRENT_TIMESTAMP;
    `;

    const params = [id, phoneNumber, name, nuit, dateOfBirth, address, district, province, verified, blocked, isActive, now, now, null];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error inserting customer:', err.message);
        process.exit(1);
      }
      console.log('Inserted/updated customer with phoneNumber=', phoneNumber);
      db.get('SELECT phoneNumber, name, nuit, dateOfBirth, address, district, province, verified, blocked, isActive, createdAt, lastAccess FROM customers WHERE phoneNumber = ?', [phoneNumber], (err2, row) => {
        if (err2) console.error(err2);
        console.log('Row:', row);
        db.close();
        process.exit(0);
      });
    });

  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
