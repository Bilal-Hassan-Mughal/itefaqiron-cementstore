-- Add MANAGER, ACCOUNTANT, STOCK_MANAGER to users.role enum (MySQL)
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM(
    'SUPER_ADMIN',
    'HQ_SUPER_ADMIN',
    'BRANCH_SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'ACCOUNTANT',
    'STOCK_MANAGER',
    'SALESMAN'
  ) NOT NULL;

-- Heuristic backfill: ADMIN rows that look like operational roles (no user_management)
UPDATE `users` u
SET u.`role` = 'ACCOUNTANT'
WHERE u.`role` = 'ADMIN'
  AND (
    u.`allowed_modules` LIKE '%profit_report%'
    OR u.`allowed_modules` LIKE '%profit-report%'
  )
  AND u.`allowed_modules` NOT LIKE '%user_management%'
  AND u.`allowed_modules` NOT LIKE '%usermanagement%'
  AND u.`allowed_modules` NOT LIKE '%products%'
  AND u.`allowed_modules` NOT LIKE '%purchases%';

UPDATE `users` u
SET u.`role` = 'STOCK_MANAGER'
WHERE u.`role` = 'ADMIN'
  AND (
    u.`allowed_modules` LIKE '%store_stock%'
    OR u.`allowed_modules` LIKE '%store-stock%'
    OR u.`allowed_modules` LIKE '%stock_transfer%'
  )
  AND u.`allowed_modules` NOT LIKE '%sales%'
  AND u.`allowed_modules` NOT LIKE '%user_management%'
  AND u.`allowed_modules` NOT LIKE '%usermanagement%'
  AND u.`allowed_modules` NOT LIKE '%reports%';

UPDATE `users` u
SET u.`role` = 'MANAGER'
WHERE u.`role` = 'ADMIN'
  AND u.`allowed_modules` IS NOT NULL
  AND u.`allowed_modules` NOT LIKE '%user_management%'
  AND u.`allowed_modules` NOT LIKE '%usermanagement%'
  AND u.`allowed_modules` NOT LIKE '%biometrics%'
  AND u.`allowed_modules` NOT LIKE '%import%'
  AND (
    u.`allowed_modules` LIKE '%reports%'
    OR u.`allowed_modules` LIKE '%hr%'
    OR u.`allowed_modules` LIKE '%purchases%'
    OR u.`allowed_modules` LIKE '%store_management%'
  );
