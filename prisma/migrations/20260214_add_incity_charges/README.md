# Migration `20260214_add_incity_charges`

Added columns to `purchases`:
- `incity_own_labour` DECIMAL(10,2) DEFAULT 0.00
- `incity_own_delivery` DECIMAL(10,2) DEFAULT 0.00
- `incity_charges_total` DECIMAL(10,2) DEFAULT 0.00

This migration was created manually because the DB user cannot create the Prisma shadow database. Apply this migration on the target DB with appropriate privileges (`prisma migrate deploy` or run the SQL directly).