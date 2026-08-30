-- Add payment tracking fields to expenses table
ALTER TABLE `expenses` 
ADD COLUMN `is_paid` BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN `paid_from_account_id` INT NULL,
ADD COLUMN `payment_date` DATETIME NULL,
ADD COLUMN `payment_reference` VARCHAR(255) NULL;

-- Add foreign key constraint for paid_from_account_id
ALTER TABLE `expenses`
ADD CONSTRAINT `expenses_paid_from_account_id_fkey` 
FOREIGN KEY (`paid_from_account_id`) REFERENCES `customers`(`cus_id`) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX `expenses_paid_from_account_id_idx` ON `expenses`(`paid_from_account_id`);
CREATE INDEX `expenses_is_paid_idx` ON `expenses`(`is_paid`);
