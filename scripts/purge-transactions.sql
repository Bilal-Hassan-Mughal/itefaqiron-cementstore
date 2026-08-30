-- Run in phpMyAdmin / Hostinger MySQL when Node cannot reach the server.
-- WARNING: Deletes ALL sales, purchases, ledger, payments, etc. Cannot be undone.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE payment_details;
TRUNCATE TABLE payments;
TRUNCATE TABLE journal_details;
TRUNCATE TABLE journals;
TRUNCATE TABLE sale_return_details;
TRUNCATE TABLE sale_returns;
TRUNCATE TABLE sale_details;
TRUNCATE TABLE split_payments;
TRUNCATE TABLE sales;
TRUNCATE TABLE purchase_return_details;
TRUNCATE TABLE purchase_returns;
TRUNCATE TABLE purchase_details;
TRUNCATE TABLE purchases;
TRUNCATE TABLE ledger;
TRUNCATE TABLE hold_bill_details;
TRUNCATE TABLE hold_bills;
TRUNCATE TABLE draft_sales;
TRUNCATE TABLE day_end_details;
TRUNCATE TABLE day_ends;

UPDATE customers SET cus_balance = 0;
UPDATE loaders SET loader_balance = 0;

SET FOREIGN_KEY_CHECKS = 1;
