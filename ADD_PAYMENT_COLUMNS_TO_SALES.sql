-- ============================================================
-- ADD PAYMENT COLUMNS TO SALES TABLE
-- ============================================================
-- This script adds cash_payment, bank_payment, and bank_title
-- columns to the sales table if they don't already exist
-- ============================================================

-- Check if columns exist and add them if they don't
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS cash_payment DOUBLE PRECISION DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS bank_payment DOUBLE PRECISION DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS bank_title VARCHAR(255);

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'sales' 
  AND column_name IN ('cash_payment', 'bank_payment', 'bank_title')
ORDER BY ordinal_position;

-- Update existing sales to set cash_payment = payment where payment_type = 'CASH'
-- This will help show payment data for old sales
UPDATE sales 
SET cash_payment = payment::DOUBLE PRECISION
WHERE payment_type = 'CASH' 
  AND cash_payment = 0;

-- Update existing sales to set bank_payment = payment where payment_type is BANK_TRANSFER
UPDATE sales 
SET bank_payment = payment::DOUBLE PRECISION,
    bank_title = COALESCE(
      (SELECT cus_name FROM customers WHERE cus_id = sales.debit_account_id LIMIT 1),
      'Bank Account'
    )
WHERE payment_type IN ('BANK_TRANSFER', 'BANK', 'CHEQUE')
  AND bank_payment = 0;

-- Show sample of updated data
SELECT 
    sale_id,
    payment,
    payment_type,
    cash_payment,
    bank_payment,
    bank_title,
    created_at
FROM sales
ORDER BY sale_id DESC
LIMIT 10;



