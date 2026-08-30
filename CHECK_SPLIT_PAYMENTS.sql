-- Query to check if split_payments are being saved correctly

-- 1. Get the latest sale with its split payments
SELECT 
    s.sale_id,
    s.created_at,
    s.cus_id,
    c.cus_name as customer_name,
    s.total_amount,
    s.payment as total_payment,
    s.payment_type,
    s.bill_type,
    sp.split_payment_id,
    sp.amount as split_amount,
    sp.payment_type as split_type,
    sp.debit_account_id,
    bank.cus_name as bank_account_name
FROM sales s
LEFT JOIN customers c ON s.cus_id = c.cus_id
LEFT JOIN split_payments sp ON s.sale_id = sp.sale_id
LEFT JOIN customers bank ON sp.debit_account_id = bank.cus_id
WHERE s.sale_id >= (SELECT MAX(sale_id) - 5 FROM sales)
ORDER BY s.sale_id DESC, sp.split_payment_id;

-- Expected output for a sale with cash=1000 and bank=500:
-- sale_id | total_payment | split_amount | split_type     | bank_account_name
-- 47      | 1500          | 1000         | CASH           | NULL
-- 47      | 1500          | 500          | BANK_TRANSFER  | HBL Bank

-- 2. Check if any split_payments exist at all
SELECT COUNT(*) as total_split_payments FROM split_payments;

-- 3. Check the structure of split_payments table
DESCRIBE split_payments;

-- 4. Check customer balance after latest sale
SELECT 
    c.cus_id,
    c.cus_name,
    c.cus_balance,
    (SELECT SUM(s.total_amount - s.payment) 
     FROM sales s 
     WHERE s.cus_id = c.cus_id) as calculated_balance
FROM customers c
WHERE c.cus_id IN (
    SELECT DISTINCT cus_id FROM sales 
    ORDER BY sale_id DESC LIMIT 5
);

-- 5. Check if balance type is now DOUBLE
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'customers'
  AND COLUMN_NAME = 'cus_balance';

-- Expected: DATA_TYPE should be 'double'




