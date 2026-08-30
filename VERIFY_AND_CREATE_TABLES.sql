-- ============================================
-- STEP-BY-STEP: Verify and Create Tables
-- ============================================
-- Run each section separately in phpMyAdmin
-- ============================================

-- STEP 1: Check if tables already exist
SELECT 'Checking existing tables...' AS Status;
SHOW TABLES LIKE 'stock_transfer%';

-- STEP 2: If tables don't exist, run this to create stock_transfers
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
  INDEX `idx_from_store` (`from_store_id`),
  INDEX `idx_to_store` (`to_store_id`),
  INDEX `idx_updated_by` (`updated_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STEP 3: Create stock_transfer_details (after stock_transfers exists)
CREATE TABLE IF NOT EXISTS `stock_transfer_details` (
  `transfer_detail_id` INT NOT NULL AUTO_INCREMENT,
  `transfer_id` INT NOT NULL,
  `pro_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `packing` INT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`transfer_detail_id`),
  INDEX `idx_transfer_id` (`transfer_id`),
  INDEX `idx_pro_id` (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STEP 4: Verify tables were created
SELECT 'Verifying tables were created...' AS Status;
SHOW TABLES LIKE 'stock_transfer%';

-- STEP 5: Check table structure
DESCRIBE `stock_transfers`;
DESCRIBE `stock_transfer_details`;






