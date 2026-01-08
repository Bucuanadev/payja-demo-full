const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

class Database {
  constructor() {
    // Prefer simulator-local DB files in ../data so smartphone flow continues to write to the simulator DB.
    // If SIMULATOR_DB is set, use it instead (useful for testing against backend/prisma/dev.db).
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const candidates = [
      path.join(dataDir, 'ussd.db'),
      path.join(dataDir, 'ussd-react.db'),
      path.join(dataDir, 'ussd_simulator.db')
    ];
    let chosen = null;
    if (process.env.SIMULATOR_DB) {
      chosen = path.resolve(process.env.SIMULATOR_DB);
    } else {
      chosen = candidates.find(p => fs.existsSync(p));
      if (!chosen) chosen = path.join(dataDir, 'ussd_simulator.db');
    }
    // Fallback to backend dev.db only if chosen is not set for some reason
    const defaultBackendDb = path.resolve(__dirname, '..', '..', 'backend', 'prisma', 'dev.db');
    const dbPath = chosen || defaultBackendDb;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const isNewDb = !fs.existsSync(dbPath);

    console.log('[Database] opening DB file:', dbPath);
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('[Database] open error:', err.message);
    });
    this._initialized = false;
    this._seedOnInit = isNewDb;
    this.initDatabase().catch(err => console.error('[Database] init error:', err));
  }

  async initDatabase() {
    if (this._initialized) return;
    const queries = [
      `CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          msisdn VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced_with_payja INTEGER DEFAULT 0,
          last_sync_attempt DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS sync_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          msisdn VARCHAR(20),
          sync_status VARCHAR(50),
          sync_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          details TEXT,
          FOREIGN KEY (msisdn) REFERENCES customers(msisdn)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sync_logs_msisdn ON sync_logs(msisdn)`
    ];

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        const runQuery = (i) => {
          if (i >= queries.length) {
              const doMigrate = !this._seedOnInit;
              const migratePromise = doMigrate ? this.migrateIfNeeded() : Promise.resolve();
              migratePromise.then(() => {
                const doSeed = !!this._seedOnInit;
                const seedPromise = doSeed ? this.seedInitialData() : Promise.resolve();
                seedPromise.then(() => {
                  this._initialized = true;
                  try {
                    const marker = path.join(__dirname, '..', 'data', 'db_initialized');
                    fs.writeFileSync(marker, new Date().toISOString());
                  } catch (e) {}
                  resolve();
                }).catch(reject);
              }).catch(reject);
            return;
          }
          this.db.run(queries[i], (err) => {
            if (err) return reject(err);
            runQuery(i + 1);
          });
        };
        runQuery(0);
      });
    });
  }

  migrateIfNeeded() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'", (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve();
        this.db.all('PRAGMA table_info(customers)', (err2, cols) => {
          if (err2) return reject(err2);
          const colNames = (cols || []).map(c => c.name);
          const tasks = [];

          if (!colNames.includes('msisdn')) {
            tasks.push(new Promise((res) => {
              this.db.run('ALTER TABLE customers ADD COLUMN msisdn VARCHAR(20)', (e) => {
                if (e) {
                  console.warn('[Database] Could not add msisdn column:', e.message);
                  return res();
                }
                const candidates = ['phoneNumber', 'phone_number', 'phone', 'phone_no', 'number', 'telefone', 'tel'];
                const foundOld = colNames.find(n => candidates.includes(n));
                if (foundOld) {
                  this.db.run(`UPDATE customers SET msisdn = ${foundOld} WHERE ${foundOld} IS NOT NULL`, (erru) => { res(); });
                } else {
                  res();
                }
              });
            }));
          }

          if (!colNames.includes('created_at')) {
            tasks.push(new Promise((res) => {
              this.db.run("ALTER TABLE customers ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (e) => {
                if (e) {
                  console.warn('[Database] Could not add created_at column:', e.message);
                  return res();
                }
                const candidates = ['createdAt', 'created', 'created_on', 'created_at'];
                const foundOld = colNames.find(n => candidates.includes(n));
                if (foundOld) {
                  this.db.run(`UPDATE customers SET created_at = ${foundOld} WHERE ${foundOld} IS NOT NULL`, (erru) => { res(); });
                } else {
                  res();
                }
              });
            }));
          }

          if (!colNames.includes('updated_at')) {
            tasks.push(new Promise((res) => {
              this.db.run("ALTER TABLE customers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP", (e) => {
                if (e) {
                  console.warn('[Database] Could not add updated_at column:', e.message);
                  return res();
                }
                const candidates = ['updatedAt', 'updated', 'modified_at', 'updated_at'];
                const foundOld = colNames.find(n => candidates.includes(n));
                if (foundOld) {
                  this.db.run(`UPDATE customers SET updated_at = ${foundOld} WHERE ${foundOld} IS NOT NULL`, (erru) => { res(); });
                } else {
                  res();
                }
              });
            }));
          }

          if (!colNames.includes('synced_with_payja')) {
            tasks.push(new Promise((res) => {
              this.db.run('ALTER TABLE customers ADD COLUMN synced_with_payja INTEGER DEFAULT 0', (e) => { if (e) console.warn('[Database] add synced_with_payja failed', e.message); res(); });
            }));
          }

          // Ensure last_sync_attempt exists (used by markAsSynced)
          if (!colNames.includes('last_sync_attempt')) {
            tasks.push(new Promise((res) => {
              this.db.run("ALTER TABLE customers ADD COLUMN last_sync_attempt DATETIME", (e) => {
                if (e) console.warn('[Database] add last_sync_attempt failed', e.message);
                res();
              });
            }));
          }

          // Add PayJA-compatible columns if missing (non-destructive)
          const payjaCols = [
            { name: 'phoneNumber', sql: 'TEXT' },
            { name: 'nuit', sql: 'TEXT' },
            { name: 'biNumber', sql: 'TEXT' },
            { name: 'phone', sql: 'TEXT' },
            { name: 'creditLimit', sql: 'REAL DEFAULT 0' },
            { name: 'customerLimit', sql: 'REAL DEFAULT 0' },
            { name: 'verified', sql: 'INTEGER DEFAULT 0' },
            { name: 'isActive', sql: 'INTEGER DEFAULT 1' },
            { name: 'status', sql: "TEXT DEFAULT 'active'" },
            { name: 'createdAt', sql: 'DATETIME' },
            { name: 'updatedAt', sql: 'DATETIME' }
          ];

          payjaCols.forEach(col => {
            if (!colNames.includes(col.name)) {
              tasks.push(new Promise((res) => {
                this.db.run(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.sql}`, (e) => {
                  if (e) console.warn('[Database] add column', col.name, 'failed', e.message);
                  else {
                    // try to copy from common alternate names when applicable
                    if (col.name === 'phoneNumber') {
                      const candidates = ['msisdn', 'phone', 'phone_number', 'phone_no'];
                      const found = colNames.find(n => candidates.includes(n));
                      if (found) this.db.run(`UPDATE customers SET phoneNumber = ${found} WHERE ${found} IS NOT NULL`, () => res());
                      else res();
                    } else if (col.name === 'createdAt') {
                      const candidates = ['created_at', 'createdAt', 'created', 'created_on'];
                      const found = colNames.find(n => candidates.includes(n));
                      if (found) this.db.run(`UPDATE customers SET createdAt = ${found} WHERE ${found} IS NOT NULL`, () => res());
                      else res();
                    } else if (col.name === 'updatedAt') {
                      const candidates = ['updated_at', 'updatedAt', 'updated', 'modified_at'];
                      const found = colNames.find(n => candidates.includes(n));
                      if (found) this.db.run(`UPDATE customers SET updatedAt = ${found} WHERE ${found} IS NOT NULL`, () => res());
                      else res();
                    } else res();
                  }
                });
              }));
            }
          });

          Promise.all(tasks).then(() => {
            // After migration, ensure useful indexes exist if columns are present
            this.db.all('PRAGMA table_info(customers)', (err3, colsAfter) => {
              if (!err3 && colsAfter) {
                const present = (colsAfter || []).map(c => c.name);
                if (present.includes('msisdn')) {
                  this.db.run('CREATE INDEX IF NOT EXISTS idx_customers_msisdn ON customers(msisdn)', () => {});
                }
                if (present.includes('synced_with_payja')) {
                  this.db.run('CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(synced_with_payja)', () => {});
                }
              }
              resolve();
            });
          }).catch(reject);
        });
      });
    });
  }

  seedInitialData() {
    const initial = [
      { msisdn: '841234567', name: 'John Doe' },
      { msisdn: '842345678', name: 'Jane Smith' },
      { msisdn: '874567890', name: 'Ana Isabel Cossa' }
    ];
    return Promise.all(initial.map(c => this.addCustomer(c.msisdn, c.name).catch(()=>{})));
  }

  addCustomer(msisdn, name) {
    return new Promise((resolve, reject) => {
      if (!msisdn) return reject(new Error('msisdn required'));
      // Inspect columns to write compatible fields (phoneNumber, createdAt)
      this.db.all('PRAGMA table_info(customers)', (err, cols) => {
        if (err) return reject(err);
        const colNames = (cols || []).map(c => c.name);
        const idCol = (cols || []).find(c => c.name === 'id');
        const fields = [];
        const placeholders = [];
        const values = [];

        // if id is required (string primary key without integer autoincrement), generate one
        if (idCol && !(idCol.type && idCol.type.toLowerCase().includes('int') && idCol.pk === 1)) {
          if (colNames.includes('id')) {
            fields.push('id'); placeholders.push('?'); values.push(randomUUID());
          }
        }

        // always set msisdn if present
        if (colNames.includes('msisdn')) {
          fields.push('msisdn'); placeholders.push('?'); values.push(msisdn);
        }
        // also set PayJA phoneNumber to help backend discovery
        if (colNames.includes('phoneNumber')) {
          fields.push('phoneNumber'); placeholders.push('?'); values.push(msisdn);
        }
        if (colNames.includes('name')) {
          fields.push('name'); placeholders.push('?'); values.push(name || 'Cliente');
        }
        // set createdAt/created_at to now if present
        if (colNames.includes('createdAt')) {
          fields.push('createdAt'); placeholders.push('CURRENT_TIMESTAMP');
        } else if (colNames.includes('created_at')) {
          fields.push('created_at'); placeholders.push('CURRENT_TIMESTAMP');
        }
        // updatedAt/updated_at
        if (colNames.includes('updatedAt')) {
          fields.push('updatedAt'); placeholders.push('CURRENT_TIMESTAMP');
        } else if (colNames.includes('updated_at')) {
          fields.push('updated_at'); placeholders.push('CURRENT_TIMESTAMP');
        }

        if (fields.length === 0) return reject(new Error('no writable customer columns found'));

        const q = `INSERT OR REPLACE INTO customers (${fields.join(',')}) VALUES (${placeholders.join(',')})`;
        this.db.run(q, values, function(err2) {
          if (err2) return reject(err2);
          resolve({ id: this.lastID, msisdn, name });
        });
      });
    });
  }

  getAllCustomers(includeSynced = true) {
    return new Promise((resolve, reject) => {
      let q = 'SELECT * FROM customers';
      const params = [];
      if (!includeSynced) {
        q += ' WHERE synced_with_payja = 0';
      }
      q += ' ORDER BY COALESCE(createdAt, created_at, updatedAt, updated_at, CURRENT_TIMESTAMP) DESC';
      this.db.all(q, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getUnsyncedCustomers() {
    return new Promise((resolve, reject) => {
      const q = `SELECT *, COALESCE(phoneNumber, msisdn, phone) as msisdn, COALESCE(createdAt, created_at) as created_at FROM customers WHERE synced_with_payja = 0 ORDER BY COALESCE(createdAt, created_at)`;
      this.db.all(q, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getVerifiedCustomers() {
    return new Promise((resolve, reject) => {
      const q = `SELECT *, COALESCE(phoneNumber, msisdn, phone) as msisdn, COALESCE(createdAt, created_at) as created_at FROM customers WHERE synced_with_payja = 1`;
      this.db.all(q, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  markAsSynced(msisdn) {
    return new Promise((resolve, reject) => {
      const q = `UPDATE customers SET synced_with_payja = 1, last_sync_attempt = CURRENT_TIMESTAMP WHERE msisdn = ?`;
      this.db.run(q, [msisdn], function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  addSyncLog(msisdn, status, details = '') {
    return new Promise((resolve, reject) => {
      const q = `INSERT INTO sync_logs (msisdn, sync_status, details) VALUES (?, ?, ?)`;
      this.db.run(q, [msisdn, status, details], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      });
    });
  }

  getAllSyncLogs() {
    return new Promise((resolve, reject) => {
      const q = 'SELECT * FROM sync_logs ORDER BY sync_date DESC LIMIT 200';
      this.db.all(q, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getTotalCustomersCount() {
    return new Promise((resolve, reject) => {
      const q = 'SELECT COUNT(*) as count FROM customers';
      this.db.get(q, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    });
  }

  getUnsyncedCount() {
    return new Promise((resolve, reject) => {
      const q = 'SELECT COUNT(*) as count FROM customers WHERE synced_with_payja = 0';
      this.db.get(q, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => { if (err) return reject(err); resolve(); });
    });
  }

  // Convenience wrappers to match older code expecting Promise-based `run`, `all`, `get`, `exec` on the DB
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

module.exports = Database;
