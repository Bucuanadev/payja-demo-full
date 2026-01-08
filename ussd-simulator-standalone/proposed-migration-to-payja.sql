-- Proposed non-destructive migration to align simulator DB with PayJA schema
-- Run against the simulator local DB (ussd-simulator-standalone/data/ussd.db)
-- Steps:
-- 1) Add PayJA columns if missing
-- 2) Backfill from existing columns (msisdn, created_at, createdAt)
-- 3) Add indexes

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Add missing columns (safe: ALTER TABLE ADD COLUMN is supported and non-destructive)
ALTER TABLE customers ADD COLUMN phoneNumber TEXT;
ALTER TABLE customers ADD COLUMN nuit TEXT;
ALTER TABLE customers ADD COLUMN biNumber TEXT;
ALTER TABLE customers ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN isActive INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'registered';
ALTER TABLE customers ADD COLUMN createdAt DATETIME;
ALTER TABLE customers ADD COLUMN updatedAt DATETIME;

-- Backfill phoneNumber from msisdn or phone
UPDATE customers SET phoneNumber = msisdn WHERE (phoneNumber IS NULL OR phoneNumber = '') AND (msisdn IS NOT NULL AND msisdn <> '');
UPDATE customers SET phoneNumber = phone WHERE (phoneNumber IS NULL OR phoneNumber = '') AND (phone IS NOT NULL AND phone <> '');

-- Backfill createdAt/updatedAt
UPDATE customers SET createdAt = created_at WHERE (createdAt IS NULL OR createdAt = '') AND (created_at IS NOT NULL AND created_at <> '');
UPDATE customers SET updatedAt = updated_at WHERE (updatedAt IS NULL OR updatedAt = '') AND (updated_at IS NOT NULL AND updated_at <> '');

-- If nuit is required and missing, set placeholder
UPDATE customers SET nuit = 'MISSING' WHERE nuit IS NULL OR nuit = '';

-- Add indexes to speed lookups
CREATE INDEX IF NOT EXISTS idx_customers_phoneNumber ON customers(phoneNumber);
CREATE INDEX IF NOT EXISTS idx_customers_synced ON customers(synced_with_payja);

COMMIT;
PRAGMA foreign_keys=ON;

-- Notes:
-- - This migration uses only ADD COLUMN and UPDATE statements to avoid table rebuilds.
-- - If your DB enforces NOT NULL on new columns, run ALTERs that include DEFAULT values or create a new table and copy data.
-- - Review results before applying in production.
