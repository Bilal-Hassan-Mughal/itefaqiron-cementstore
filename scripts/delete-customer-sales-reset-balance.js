/**
 * One-off: delete all sales/orders/quotations (and returns) for a customer by name, remove
 * related ledger lines (by sale/return bill_no) and all remaining ledger for that
 * customer, then set cus_balance to 0.
 *
 * Also removes draft sales and hold bills for that customer.
 *
 * Usage: node scripts/delete-customer-sales-reset-balance.js
 *
 * Safety: if more than one customer name matches "Waqas" + "Umar", the script exits without changes.
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function nameMatchesWaqasUmar(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim().toLowerCase();
  return n.includes('waqas') && n.includes('umar');
}

async function main() {
  const customers = await prisma.customer.findMany();
  const targets = customers.filter((c) => nameMatchesWaqasUmar(c.cus_name));

  if (targets.length === 0) {
    console.log('No customer found with "Waqas" and "Umar" in cus_name.');
    process.exit(1);
  }

  if (targets.length > 1) {
    console.log('Multiple matches — abort. Resolve manually:');
    targets.forEach((t) => console.log(`  cus_id=${t.cus_id} name="${t.cus_name}"`));
    process.exit(1);
  }

  const { cus_id: cusId, cus_name: cusName } = targets[0];
  console.log(`Target: cus_id=${cusId} name="${cusName}"`);

  const sales = await prisma.sale.findMany({
    where: { cus_id: cusId },
    select: { sale_id: true, bill_type: true },
  });
  const saleIds = sales.map((s) => s.sale_id);
  const returnWhere =
    saleIds.length > 0
      ? { OR: [{ sale_id: { in: saleIds } }, { cus_id: cusId }] }
      : { cus_id: cusId };

  const returns = await prisma.saleReturn.findMany({
    where: returnWhere,
    select: { return_id: true },
  });
  const returnIds = returns.map((r) => r.return_id);

  const billNos = [...new Set([...saleIds.map(String), ...returnIds.map(String)])];
  console.log(
    `Sales/orders/quotations: ${sales.length}; sale returns: ${returns.length}; ledger bill_nos: ${billNos.length}`
  );
  if (sales.length) console.log('  sample sale bill_types:', [...new Set(sales.map((s) => s.bill_type))].join(', '));

  await prisma.$transaction(
    async (tx) => {
      // 1) Ledger for sale & sale-return bill numbers (all accounts: customer, cash, bank, etc.)
      if (billNos.length > 0) {
        const led = await tx.ledger.deleteMany({ where: { bill_no: { in: billNos } } });
        console.log('Deleted ledger rows for sale/return bill_no set:', led.count);
      }

      // 2) Sale returns (details cascade)
      const ret = await tx.saleReturn.deleteMany({ where: returnWhere });
      console.log('Deleted sale_returns:', ret.count);

      // 3) Draft + hold
      const drafts = await tx.draftSale.deleteMany({ where: { cus_id: cusId } });
      console.log('Deleted draft_sales:', drafts.count);
      const holds = await tx.holdBill.deleteMany({ where: { cus_id: cusId } });
      console.log('Deleted hold_bills:', holds.count);

      // 4) Sales (cascades sale_details, split_payments)
      const delSales = await tx.sale.deleteMany({ where: { cus_id: cusId } });
      console.log('Deleted sales:', delSales.count);

      // 5) All remaining customer-account ledger (Receive/Pay lines, any orphans)
      const ledCus = await tx.ledger.deleteMany({ where: { cus_id: cusId } });
      console.log('Deleted remaining ledger for customer cus_id:', ledCus.count);

      // 6) Balance
      await tx.customer.update({
        where: { cus_id: cusId },
        data: { cus_balance: 0 },
      });
      console.log('Set cus_balance to 0.');
    },
    { timeout: 120000 }
  );

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
