-- Simple migration to add payment fields to sales table
-- Run this in phpMyAdmin SQL tab

-- Add the three columns (MySQL will ignore if they already exist with IF NOT EXISTS in newer versions)
-- For older MySQL versions, it will show an error if column exists, which is safe to ignore

ALTER TABLE `sales` 
ADD COLUMN IF NOT EXISTS `cash_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `payment_type`,
ADD COLUMN IF NOT EXISTS `bank_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `cash_payment`,
ADD COLUMN IF NOT EXISTS `bank_title` VARCHAR(255) NULL DEFAULT NULL AFTER `bank_payment`;

-- Verify the changes
SELECT 'Migration completed! Columns added:' AS Status;
SHOW COLUMNS FROM sales LIKE '%payment%';


