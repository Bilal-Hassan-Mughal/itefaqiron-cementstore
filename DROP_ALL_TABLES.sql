-- Script to drop all tables before migration
-- Run this in your MySQL client BEFORE running prisma db push

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `sale_return_details`;
DROP TABLE IF EXISTS `sale_returns`;
DROP TABLE IF EXISTS `split_payments`;
DROP TABLE IF EXISTS `sale_details`;
DROP TABLE IF EXISTS `sales`;
DROP TABLE IF EXISTS `purchase_details`;
DROP TABLE IF EXISTS `purchases`;
DROP TABLE IF EXISTS `ledger`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `expense_titles`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `sub_categories`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `customer_types`;
DROP TABLE IF EXISTS `customer_categories`;
DROP TABLE IF EXISTS `cities`;
DROP TABLE IF EXISTS `vehicles`;
DROP TABLE IF EXISTS `loaders`;
DROP TABLE IF EXISTS `cargo`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- After running this, execute: npx prisma db push
















