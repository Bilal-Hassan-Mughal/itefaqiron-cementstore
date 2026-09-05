-- Per-employee leave / absent allowance + payroll absent tracking
ALTER TABLE `employees`
  ADD COLUMN `allowed_leaves_per_month` INT NOT NULL DEFAULT 2 AFTER `basic_salary`,
  ADD COLUMN `allowed_absents_per_month` INT NOT NULL DEFAULT 0 AFTER `allowed_leaves_per_month`;

ALTER TABLE `payrolls`
  ADD COLUMN `absents_taken` INT NOT NULL DEFAULT 0 AFTER `leaves_taken`,
  ADD COLUMN `allowed_absents` INT NOT NULL DEFAULT 0 AFTER `allowed_leaves`,
  ADD COLUMN `excess_absents` INT NOT NULL DEFAULT 0 AFTER `excess_leaves`;
