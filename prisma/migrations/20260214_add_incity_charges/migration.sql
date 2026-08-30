-- Migration: add incity fields to purchases
-- Adds: incity_own_labour, incity_own_delivery, incity_charges_total

ALTER TABLE `purchases`
  ADD COLUMN `incity_own_labour` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `incity_own_delivery` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `incity_charges_total` DECIMAL(10,2) NOT NULL DEFAULT 0.00;