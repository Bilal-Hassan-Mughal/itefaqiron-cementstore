/**
 * Rebuild day_ends from Cash Report ledger (zero variance on closed days).
 * Usage: node scripts/repair-day-end-from-ledger.js [--dry-run] [--branch=1]
 */
require('dotenv').config();
const path = require('path');
const Module = require('module');

const srcRoot = path.join(__dirname, '..', 'src');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(srcRoot, request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { PrismaClient } = require('@prisma/client');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const branchArg = process.argv.find((a) => a.startsWith('--branch='));
  const branchId = branchArg ? parseInt(branchArg.split('=')[1], 10) : 1;

  const jiti = require('jiti')(__filename, { interopDefault: true, alias: { '@': srcRoot } });
  const { repairDayEndRecords } = jiti('../src/lib/repair-day-end-ledger.js');
  const prisma = new PrismaClient();

  try {
    const out = await repairDayEndRecords(prisma, { branchId, dryRun });
    console.log(`${dryRun ? 'DRY RUN' : 'REPAIRED'} branch ${branchId}: ${out.count} day end row(s)\n`);
    for (const r of out.results) {
      const changed =
        r.before.opening_cash !== r.after.opening_cash ||
        r.before.cash_in_hand !== r.after.cash_in_hand ||
        r.before.closing_cash !== r.after.closing_cash;
      if (changed || dryRun) {
        console.log(
          `#${r.day_end_id} ${r.business_date} ${r.status}`,
          `open ${r.before.opening_cash} -> ${r.after.opening_cash}`,
          `expected ${r.before.cash_in_hand} -> ${r.after.cash_in_hand}`,
          `close ${r.before.closing_cash} -> ${r.after.closing_cash}`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
