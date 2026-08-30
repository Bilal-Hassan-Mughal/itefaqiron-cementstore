-- AlterTable sales: Change labour_charges and shipping_amount from DECIMAL to FLOAT
ALTER TABLE `sales` MODIFY COLUMN `labour_charges` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `sales` MODIFY COLUMN `shipping_amount` DOUBLE NOT NULL DEFAULT 0;
