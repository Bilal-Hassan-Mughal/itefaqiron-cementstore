-- Migration: Add cash_payment and bank_payment fields to purchases table
-- This will allow proper storage and retrieval of split payment data

ALTER TABLE purchases 
ADD COLUMN cash_payment DECIMAL(10,2) DEFAULT 0.00 AFTER payment_type,
ADD COLUMN bank_payment DECIMAL(10,2) DEFAULT 0.00 AFTER cash_payment,
ADD COLUMN bank_title VARCHAR(255) NULL AFTER bank_payment;

-- Update existing records to populate the new fields based on payment_type
UPDATE purchases 
SET 
  cash_payment = CASE 
    WHEN payment_type = 'CASH' THEN payment 
    ELSE 0.00 
  END,
  bank_payment = CASE 
    WHEN payment_type IN ('BANK_TRANSFER', 'CHEQUE') THEN payment 
    ELSE 0.00 
  END
WHERE cash_payment IS NULL OR bank_payment IS NULL;

-- Verify the changes
SELECT pur_id, payment_type, payment, cash_payment, bank_payment, bank_title 
FROM purchases 
LIMIT 10;