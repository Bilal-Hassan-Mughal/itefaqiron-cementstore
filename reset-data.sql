-- ============================================================
-- DATA RESET SCRIPT
-- WARNING: This will permanently delete sales, purchases,
-- ledger entries, orders and reset balances & stock.
-- Run this only on a test/fresh database.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Remove all Sale-related records
TRUNCATE TABLE split_payments;
TRUNCATE TABLE sale_return_details;
TRUNCATE TABLE sale_returns;
TRUNCATE TABLE sale_details;
TRUNCATE TABLE draft_sales;
TRUNCATE TABLE hold_bill_details;
TRUNCATE TABLE hold_bills;
TRUNCATE TABLE sales;           -- includes BILL, ORDER, QUOTATION, DISPATCHED

-- 2. Remove all Purchase-related records
TRUNCATE TABLE purchase_return_details;
TRUNCATE TABLE purchase_returns;
TRUNCATE TABLE purchase_details;
TRUNCATE TABLE purchases;

-- 3. Remove all Ledger entries
TRUNCATE TABLE ledger;

-- 4. Remove Journal entries
TRUNCATE TABLE journal_details;
TRUNCATE TABLE journals;

-- 5. Remove Day-End records
TRUNCATE TABLE day_end_details;
TRUNCATE TABLE day_ends;

-- 6. Remove Payment records
TRUNCATE TABLE payment_details;
TRUNCATE TABLE payments;

-- 7. Remove Stock Transfers
TRUNCATE TABLE stock_transfer_details;
TRUNCATE TABLE stock_transfers;

-- 8. Set all customer balances to 0
UPDATE customers SET cus_balance = 0;

-- 9. Set all store-wise stock to 100
UPDATE store_stocks SET stock_quantity = 100;

-- 10. Set all product global stock to 100
UPDATE products SET pro_stock_qnty = 100;

SET FOREIGN_KEY_CHECKS = 1;

-- Done
SELECT 'Reset complete.' AS status;
SELECT CONCAT('Customers reset: ', COUNT(*)) AS info FROM customers;
SELECT CONCAT('Products reset: ', COUNT(*)) AS info FROM products;
SELECT CONCAT('Store stocks reset: ', COUNT(*)) AS info FROM store_stocks;
