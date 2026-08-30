#!/usr/bin/env node

/**
 * Delete financial / operational transaction history while keeping master data.
 *
 * Usage:
 *   node scripts/reset-financial-transactions.js --check     # counts only
 *   node scripts/reset-financial-transactions.js --force       # full wipe
 *   node scripts/reset-financial-transactions.js --force --core
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Load .env from project root (Prisma does not always load it for standalone scripts)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const coreOnly = process.argv.includes('--core');
const checkOnly = process.argv.includes('--check');

function dbTargetLabel() {
  const url = process.env.DATABASE_URL || '';
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '3306'} / ${(u.pathname || '').replace(/^\//, '')}`;
  } catch {
    return '(could not parse DATABASE_URL — fix @ in password as %40)';
  }
}

async function countRows(tx) {
  const db = tx || prisma;
  return {
    saleReturnDetail: await db.saleReturnDetail.count(),
    saleReturn: await db.saleReturn.count(),
    sale: await db.sale.count(),
    purchase: await db.purchase.count(),
    ledger: await db.ledger.count(),
    payment: await db.payment.count(),
    journal: await db.journal.count(),
    holdBill: await db.holdBill.count(),
    draftSale: await db.draftSale.count(),
    dayEnd: await db.dayEnd.count()
  };
}

async function main() {
  console.log('\nReset financial transactions\n');
  console.log(`Database: ${dbTargetLabel()}\n`);

  let before;
  try {
    before = await countRows();
  } catch (e) {
    console.error('Cannot connect to database:', e.message);
    console.error('\nIf your password contains @, encode it as %40 in DATABASE_URL.');
    console.error('Example: mysql://USER:pass%40word@195.35.59.84:3306/DATABASE_NAME\n');
    process.exit(1);
  }

  console.log('Current row counts:');
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k}: ${v}`);
  }

  if (checkOnly) {
    console.log('\n(--check only — no changes made)\n');
    return;
  }

  if (!force) {
    console.log('\nRefusing to delete without --force');
    console.log('  node scripts/reset-financial-transactions.js --force\n');
    process.exit(1);
  }

  console.log(coreOnly ? '\nMode: CORE\n' : '\nMode: FULL\n');

  const result = await prisma.$transaction(
    async (tx) => {
      const out = {};

      out.saleReturnDetail = (await tx.saleReturnDetail.deleteMany({})).count;
      out.saleReturn = (await tx.saleReturn.deleteMany({})).count;
      out.sale = (await tx.sale.deleteMany({})).count;
      out.purchase = (await tx.purchase.deleteMany({})).count;
      out.ledger = (await tx.ledger.deleteMany({})).count;

      if (!coreOnly) {
        out.paymentDetail = (await tx.paymentDetail.deleteMany({})).count;
        out.payment = (await tx.payment.deleteMany({})).count;
        out.journalDetail = (await tx.journalDetail.deleteMany({})).count;
        out.journal = (await tx.journal.deleteMany({})).count;
        out.holdBillDetail = (await tx.holdBillDetail.deleteMany({})).count;
        out.holdBill = (await tx.holdBill.deleteMany({})).count;
        out.draftSale = (await tx.draftSale.deleteMany({})).count;
        out.dayEndDetail = (await tx.dayEndDetail.deleteMany({})).count;
        out.dayEnd = (await tx.dayEnd.deleteMany({})).count;
      }

      out.customersBalanceReset = (await tx.customer.updateMany({ data: { cus_balance: 0 } })).count;
      out.loadersBalanceReset = (await tx.loader.updateMany({ data: { loader_balance: 0 } })).count;

      return out;
    },
    { maxWait: 60_000, timeout: 600_000 }
  );

  const after = await countRows();

  console.log('\nDeleted:');
  for (const [k, v] of Object.entries(result)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log('\nRemaining row counts:');
  for (const [k, v] of Object.entries(after)) {
    console.log(`  ${k}: ${v}`);
  }

  if (after.sale > 0 || after.purchase > 0 || after.ledger > 0) {
    console.error('\nWARNING: Some sales/purchases/ledger rows still remain.');
    process.exit(1);
  }

  console.log('\nDone. Refresh the browser (hard refresh) to clear cached lists.\n');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
