import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initializeDatabase() {
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'ussd-react.db');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await createTables(db);
  await seedInitialData(db);

  return db;
}

async function createTables(db) {
  const schema = `
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phoneNumber TEXT UNIQUE NOT NULL,
      nuit TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      biNumber TEXT,
      email TEXT,
      institution TEXT,
      salary REAL,
      creditScore INTEGER,
      creditLimit REAL DEFAULT 0,
      salaryBank TEXT,
      verified BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'active',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ussd_sessions (
      id TEXT PRIMARY KEY,
      phoneNumber TEXT NOT NULL,
      flow TEXT NOT NULL,
      currentStep INTEGER DEFAULT 0,
      data TEXT,
      status TEXT DEFAULT 'active',
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expiresAt TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_partners (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      apiUrl TEXT NOT NULL,
      apiKey TEXT,
      active BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      phoneNumber TEXT NOT NULL,
      message TEXT,
      type TEXT,
      status TEXT DEFAULT 'sent',
      sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phoneNumber) REFERENCES customers(phoneNumber)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL,
      status TEXT DEFAULT 'pending',
      description TEXT,
      metadata TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS integration_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS validation_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      customerId TEXT NOT NULL,
      validationResult TEXT,
      validatedBy TEXT DEFAULT 'PAYJA',
      validatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phoneNumber ON customers(phoneNumber);
    CREATE INDEX IF NOT EXISTS idx_customers_nuit ON customers(nuit);
    CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phoneNumber ON ussd_sessions(phoneNumber);
    CREATE INDEX IF NOT EXISTS idx_sms_logs_phoneNumber ON sms_logs(phoneNumber);
    CREATE INDEX IF NOT EXISTS idx_transactions_customerId ON transactions(customerId);
    CREATE INDEX IF NOT EXISTS idx_validation_logs_customerId ON validation_logs(customerId);
  `;

  const statements = schema.split(';').filter((s) => s.trim());
  for (const statement of statements) {
    await db.exec(statement);
  }
}

async function seedInitialData(db) {
  // Banco inicial permanece vazio; clientes só entram via fluxo USSD + validação PayJA.
  const existingCustomers = await db.get('SELECT COUNT(*) as count FROM customers');
  if (existingCustomers.count > 0) {
    console.log('✅ Banco de dados já contém dados');
  } else {
    console.log('📭 Banco inicial vazio (nenhum seed aplicado)');
  }
}

export async function closeDatabase(db) {
  await db.close();
}
