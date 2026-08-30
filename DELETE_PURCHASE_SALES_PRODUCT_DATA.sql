-- ============================================
-- DELETE PURCHASE, SALES, AND PRODUCT DATA
-- ============================================
-- This script deletes ONLY transactional data related to:
-- - Purchases (Purchase details, Purchase Returns)
-- - Sales (Sale details, Sale Returns, Split Payments)
-- - Products
-- - Store Stock
--
-- DOES NOT DELETE: Customers, Stores, Categories, Users, etc.
-- ============================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Delete Split Payments (associated with Sales)
DELETE FROM split_payments;

-- Delete Sale Details (child of Sales)
DELETE FROM sale_details;

-- Delete Sale Returns
DELETE FROM sale_return_details;
DELETE FROM sale_returns;

-- Delete Sales
DELETE FROM sales;

-- Delete Purchase Returns
DELETE FROM purchase_return_details;
DELETE FROM purchase_returns;

-- Delete Purchase Details (child of Purchases)
DELETE FROM purchase_details;

-- Delete Purchases
DELETE FROM purchases;

-- Delete Store Stock
DELETE FROM store_stocks;

-- Delete Products
DELETE FROM products;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify data was deleted:

-- SELECT COUNT(*) as purchase_count FROM purchases;
-- SELECT COUNT(*) as purchase_details_count FROM purchase_details;
-- SELECT COUNT(*) as sales_count FROM sales;
-- SELECT COUNT(*) as sale_details_count FROM sale_details;
-- SELECT COUNT(*) as products_count FROM products;
-- SELECT COUNT(*) as store_stocks_count FROM store_stocks;

-- ============================================
-- NOTES:
-- ============================================
-- 1. This will NOT affect:
--    - Customers
--    - Stores
--    - Categories & Subcategories
--    - Users
--    - Cities
--    - Customer Categories & Types
--    - Vehicles
--    - Loaders
--    - Expenses
--    - Ledger entries
--    - Hold Bills
--    - Day Ends
--    - Journals
--    - Cargo
--
-- 2. Auto-increment IDs will be reset to 1 on next insert
--    if you run: ALTER TABLE table_name AUTO_INCREMENT = 1
--
-- 3. Make sure to backup your data before running this script!
-- ============================================








