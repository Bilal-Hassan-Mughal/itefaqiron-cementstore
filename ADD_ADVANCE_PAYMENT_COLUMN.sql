-- Add advance_payment column to sales table
ALTER TABLE `sales` ADD COLUMN `advance_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `bank_title`;

-- Verify the column was added
DESCRIBE `sales`;