-- Clearance snapshots were truncated at 191 chars; store full JSON in TEXT
ALTER TABLE `payrolls` MODIFY COLUMN `notes` TEXT NULL;
