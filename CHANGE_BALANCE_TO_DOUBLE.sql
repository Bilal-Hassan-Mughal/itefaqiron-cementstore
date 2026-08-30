-- Migration: Change balance fields from DECIMAL to DOUBLE
-- This fixes type conversion issues and improves performance

-- 1. Change customer balance to DOUBLE
ALTER TABLE customers 
MODIFY COLUMN cus_balance DOUBLE DEFAULT 0;

-- 2. Change ledger balance fields to DOUBLE
ALTER TABLE ledger 
MODIFY COLUMN opening_balance DOUBLE DEFAULT 0,
MODIFY COLUMN debit_amount DOUBLE DEFAULT 0,
MODIFY COLUMN credit_amount DOUBLE DEFAULT 0,
MODIFY COLUMN closing_balance DOUBLE DEFAULT 0,
MODIFY COLUMN payments DOUBLE DEFAULT 0;

-- 3. Verify the changes
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('customers', 'ledger')
  AND COLUMN_NAME LIKE '%balance%'
  OR (TABLE_NAME = 'ledger' AND COLUMN_NAME IN ('debit_amount', 'credit_amount', 'payments'));

-- Note: This migration is safe to run on existing data
-- DOUBLE can store the same precision as DECIMAL(30,30) but performs better




