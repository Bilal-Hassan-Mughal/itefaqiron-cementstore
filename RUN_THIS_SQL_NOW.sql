-- Simple SQL to add payment fields to sales table
-- Run this in your MySQL database

-- Add cash_payment column
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS cash_payment DOUBLE DEFAULT 0 
AFTER payment_type;

-- Add bank_payment column
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS bank_payment DOUBLE DEFAULT 0 
AFTER cash_payment;

-- Add bank_title column
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS bank_title VARCHAR(255) NULL 
AFTER bank_payment;

-- Show result
SELECT 'Payment fields added successfully!' AS Status;

-- Show updated table structure
DESCRIBE sales;




