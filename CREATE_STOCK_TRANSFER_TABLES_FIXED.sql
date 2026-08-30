-- ============================================
-- CREATE STOCK TRANSFER TABLES (FIXED VERSION)
-- ============================================
-- This version fixes foreign key constraint errors
-- Run this SQL in your database
-- ============================================

-- Step 1: Create stock_transfers table (without foreign keys first)
CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `transfer_id` INT NOT NULL AUTO_INCREMENT,
  `transfer_no` VARCHAR(255) NULL,
  `transfer_date` DATE NOT NULL,
  `from_store_id` INT NOT NULL,
  `to_store_id` INT NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `updated_by` INT NULL,
  PRIMARY KEY (`transfer_id`),
  UNIQUE INDEX `stock_transfers_transfer_no_key` (`transfer_no`),
  INDEX `stock_transfers_from_store_id_fkey` (`from_store_id`),
  INDEX `stock_transfers_to_store_id_fkey` (`to_store_id`),
  INDEX `stock_transfers_updated_by_fkey` (`updated_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Add foreign keys to stock_transfers (if they don't exist)
ALTER TABLE `stock_transfers` 
  ADD CONSTRAINT `stock_transfers_from_store_id_fkey` 
  FOREIGN KEY (`from_store_id`) REFERENCES `stores` (`storeid`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_transfers` 
  ADD CONSTRAINT `stock_transfers_to_store_id_fkey` 
  FOREIGN KEY (`to_store_id`) REFERENCES `stores` (`storeid`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only add if users table exists
ALTER TABLE `stock_transfers` 
  ADD CONSTRAINT `stock_transfers_updated_by_fkey` 
  FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Create stock_transfer_details table (without foreign keys first)
CREATE TABLE IF NOT EXISTS `stock_transfer_details` (
  `transfer_detail_id` INT NOT NULL AUTO_INCREMENT,
  `transfer_id` INT NOT NULL,
  `pro_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `packing` INT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`transfer_detail_id`),
  INDEX `stock_transfer_details_transfer_id_fkey` (`transfer_id`),
  INDEX `stock_transfer_details_pro_id_fkey` (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Add foreign keys to stock_transfer_details
ALTER TABLE `stock_transfer_details` 
  ADD CONSTRAINT `stock_transfer_details_transfer_id_fkey` 
  FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`transfer_id`) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_details` 
  ADD CONSTRAINT `stock_transfer_details_pro_id_fkey` 
  FOREIGN KEY (`pro_id`) REFERENCES `products` (`pro_id`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;






