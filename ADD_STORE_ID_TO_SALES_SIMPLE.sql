-- Simple Migration: Add store_id to sales and sale_details tables
-- This version uses simpler syntax that works with most MySQL versions

-- Add store_id to sales table
ALTER TABLE `sales` 
ADD COLUMN `store_id` INT NULL AFTER `cus_id`;

-- Add index for store_id in sales table
ALTER TABLE `sales` 
ADD INDEX `sales_store_id_fkey` (`store_id`);

-- Add foreign key constraint (may fail if constraint already exists)
-- If it fails, ignore the error
ALTER TABLE `sales` 
ADD CONSTRAINT `sales_store_id_fkey` 
FOREIGN KEY (`store_id`) REFERENCES `stores` (`storeid`) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add store_id to sale_details table
ALTER TABLE `sale_details` 
ADD COLUMN `store_id` INT NULL AFTER `sale_id`;

-- Add index for store_id in sale_details table
ALTER TABLE `sale_details` 
ADD INDEX `sale_details_store_id_fkey` (`store_id`);

-- Add foreign key constraint (may fail if constraint already exists)
-- If it fails, ignore the error
ALTER TABLE `sale_details` 
ADD CONSTRAINT `sale_details_store_id_fkey` 
FOREIGN KEY (`store_id`) REFERENCES `stores` (`storeid`) 
ON DELETE SET NULL ON UPDATE CASCADE;

SELECT 'Migration completed!' as Status;







