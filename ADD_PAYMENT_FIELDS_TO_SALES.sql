-- Add payment fields to sales table
-- These fields will store payment information directly in the sale record
-- while also maintaining split_payments table for detailed payment tracking

-- Check if columns exist and add them if they don't
SET @dbname = DATABASE();
SET @tablename = 'sales';
SET @columnname1 = 'cash_payment';
SET @columnname2 = 'bank_payment';
SET @columnname3 = 'bank_title';
SET @preparedStatement1 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE 
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname1
  ) > 0,
  'SELECT ''Column cash_payment already exists.'' AS msg',
  'ALTER TABLE sales ADD COLUMN cash_payment DOUBLE DEFAULT 0'
));
PREPARE alterStatement1 FROM @preparedStatement1;
EXECUTE alterStatement1;
DEALLOCATE PREPARE alterStatement1;

SET @preparedStatement2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE 
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname2
  ) > 0,
  'SELECT ''Column bank_payment already exists.'' AS msg',
  'ALTER TABLE sales ADD COLUMN bank_payment DOUBLE DEFAULT 0'
));
PREPARE alterStatement2 FROM @preparedStatement2;
EXECUTE alterStatement2;
DEALLOCATE PREPARE alterStatement2;

SET @preparedStatement3 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE 
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname3
  ) > 0,
  'SELECT ''Column bank_title already exists.'' AS msg',
  'ALTER TABLE sales ADD COLUMN bank_title VARCHAR(255) NULL'
));
PREPARE alterStatement3 FROM @preparedStatement3;
EXECUTE alterStatement3;
DEALLOCATE PREPARE alterStatement3;

-- Change balance columns from DECIMAL to DOUBLE in customers table
ALTER TABLE customers MODIFY COLUMN cus_balance DOUBLE DEFAULT 0;

-- Change balance columns from DECIMAL to DOUBLE in ledger table
ALTER TABLE ledger
  MODIFY COLUMN opening_balance DOUBLE DEFAULT 0,
  MODIFY COLUMN debit_amount DOUBLE DEFAULT 0,
  MODIFY COLUMN credit_amount DOUBLE DEFAULT 0,
  MODIFY COLUMN closing_balance DOUBLE DEFAULT 0,
  MODIFY COLUMN payments DOUBLE DEFAULT 0;

-- Show results
SELECT 'Payment fields migration completed!' AS status;

-- Show the new structure
DESCRIBE sales;
