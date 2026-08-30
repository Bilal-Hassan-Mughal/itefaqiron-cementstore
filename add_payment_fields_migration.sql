-- Migration to add cash_payment, bank_payment, and bank_title columns to sales table
-- Run this in phpMyAdmin or your MySQL client

-- Check if columns exist and add them if they don't
SET @dbname = DATABASE();
SET @tablename = 'sales';

-- Add cash_payment column if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = @tablename 
  AND COLUMN_NAME = 'cash_payment'
);

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE `sales` ADD COLUMN `cash_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `payment_type`',
  'SELECT "Column cash_payment already exists" AS message'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add bank_payment column if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = @tablename 
  AND COLUMN_NAME = 'bank_payment'
);

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE `sales` ADD COLUMN `bank_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `cash_payment`',
  'SELECT "Column bank_payment already exists" AS message'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add bank_title column if it doesn't exist
SET @col_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = @tablename 
  AND COLUMN_NAME = 'bank_title'
);

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE `sales` ADD COLUMN `bank_title` VARCHAR(255) NULL DEFAULT NULL AFTER `bank_payment`',
  'SELECT "Column bank_title already exists" AS message'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the columns were added
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'sales'
  AND COLUMN_NAME IN ('cash_payment', 'bank_payment', 'bank_title')
ORDER BY ORDINAL_POSITION;

-- Show a sample of the updated table structure
SHOW COLUMNS FROM sales WHERE Field IN ('payment_type', 'cash_payment', 'bank_payment', 'bank_title');


