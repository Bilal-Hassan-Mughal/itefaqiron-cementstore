#!/usr/bin/env node

/**
 * delete-customer-and-related.js
 * --------------------------------
 * Deletes a single customer and all related records (sales, purchases, ledgers,
 * payments, split payments, returns, details). Requires --id and --force.
 * Usage: node delete-customer-and-related.js --id=1 --force
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArg(name) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split('=')[1];
}

const idArg = parseArg('id');
const force = process.argv.includes('--force');

if (!idArg) {
  console.error('Error: --id=<customerId> is required');
  process.exit(1);
}

const cusId = parseInt(idArg, 10);
if (Number.isNaN(cusId)) {
  console.error('Error: invalid id');
  process.exit(1);
}

async function getCountsForCustomer(id) {
  const counts = {};

  const sales = await prisma.sale.findMany({ where: { cus_id: id }, select: { sale_id: true } });
  const saleIds = sales.map(s => s.sale_id);
  counts.sales = saleIds.length;
  counts.saleDetails = await prisma.saleDetail.count({ where: { sale_id: { in: saleIds.length ? saleIds : [-1] } } }).catch(() => 0);
  counts.splitPaymentsBySale = await prisma.splitPayment.count({ where: { sale_id: { in: saleIds.length ? saleIds : [-1] } } }).catch(() => 0);

  counts.saleReturns = await prisma.saleReturn.count({ where: { cus_id: id } }).catch(() => 0);
  counts.saleReturnDetails = await prisma.saleReturnDetail.count({ where: { cus_id: id } }).catch(() => 0);

  const purchases = await prisma.purchase.findMany({ where: { cus_id: id }, select: { pur_id: true } });
  const purchaseIds = purchases.map(p => p.pur_id);
  counts.purchases = purchaseIds.length;
  counts.purchaseDetails = await prisma.purchaseDetail.count({ where: { purchase_id: { in: purchaseIds.length ? purchaseIds : [-1] } } }).catch(() => 0);
  counts.purchaseReturns = await prisma.purchaseReturn.count({ where: { cus_id: id } }).catch(() => 0);
  counts.purchaseReturnDetails = await prisma.purchaseReturnDetail.count({ where: { cus_id: id } }).catch(() => 0);

  counts.ledger = await prisma.ledger.count({ where: { cus_id: id } }).catch(() => 0);
  counts.payments = await prisma.payment.count({ where: { account_id: id } }).catch(() => 0);
  counts.splitPaymentsByAccount = await prisma.splitPayment.count({ where: { OR: [{ debit_account_id: id }, { credit_account_id: id }] } }).catch(() => 0);

  return { counts, saleIds, purchaseIds };
}

async function deleteCustomerAndRelated(id) {
  const { counts, saleIds, purchaseIds } = await getCountsForCustomer(id);

  console.log('\nFound related records for customer id=' + id + ':');
  Object.entries(counts).forEach(([k, v]) => console.log(`  • ${k}: ${v}`));

  if (!force) {
    console.log('\nRun with --force to actually delete. Example: node delete-customer-and-related.js --id=1 --force');
    process.exit(0);
  }

  console.log('\nDeleting (transactional, FK-safe order)...\n');

  await prisma.$transaction(async (tx) => {
    // Sale-related
    if (saleIds.length) {
      await tx.saleDetail.deleteMany({ where: { sale_id: { in: saleIds } } });
      await tx.splitPayment.deleteMany({ where: { sale_id: { in: saleIds } } });
      await tx.saleReturnDetail.deleteMany({ where: { sale_id: { in: saleIds } } }).catch(() => {});
      await tx.sale.deleteMany({ where: { sale_id: { in: saleIds } } });
    }

    // Purchase-related
    if (purchaseIds.length) {
      await tx.purchaseDetail.deleteMany({ where: { purchase_id: { in: purchaseIds } } });
      await tx.purchaseReturnDetail.deleteMany({ where: { purchase_id: { in: purchaseIds } } }).catch(() => {});
      await tx.purchase.deleteMany({ where: { pur_id: { in: purchaseIds } } });
    }

    // Returns directly referencing customer
    await tx.saleReturnDetail.deleteMany({ where: { cus_id: id } }).catch(() => {});
    await tx.saleReturn.deleteMany({ where: { cus_id: id } }).catch(() => {});
    await tx.purchaseReturnDetail.deleteMany({ where: { cus_id: id } }).catch(() => {});
    await tx.purchaseReturn.deleteMany({ where: { cus_id: id } }).catch(() => {});

    // Split payments that reference customer as an account
    await tx.splitPayment.deleteMany({ where: { OR: [{ debit_account_id: id }, { credit_account_id: id }] } }).catch(() => {});

    // Payments and ledger
    await tx.payment.deleteMany({ where: { account_id: id } }).catch(() => {});
    await tx.ledger.deleteMany({ where: { cus_id: id } }).catch(() => {});

    // Finally delete the customer
    await tx.customer.delete({ where: { cus_id: id } });
  });

  console.log('\n✅ Deletion completed for customer id=' + id + '\n');

  // Verify
  const { counts: afterCounts } = await getCountsForCustomer(id);
  console.log('Remaining counts (should be all 0):');
  Object.entries(afterCounts).forEach(([k, v]) => console.log(`  • ${k}: ${v}`));
}

// Run
(async () => {
  try {
    await deleteCustomerAndRelated(cusId);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error deleting customer and related records:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
