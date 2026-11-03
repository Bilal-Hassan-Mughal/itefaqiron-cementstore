const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const SALE_ID = 443;

async function main() {
  const sale = await prisma.sale.findUnique({
    where: { sale_id: SALE_ID },
    include: {
      customer: true,
      sale_details: { include: { product: { select: { pro_title: true } } } },
    },
  });
  if (!sale) {
    console.log('Sale 443 not found');
    return;
  }

  const exactBills = ['443', 'PAY-443', 'SR-443'];
  const exactLedger = await prisma.ledger.findMany({
    where: { bill_no: { in: exactBills } },
    orderBy: { l_id: 'asc' },
    include: { customer: { select: { cus_name: true, cus_id: true } } },
  });

  const custLedger443 = await prisma.ledger.findMany({
    where: { cus_id: sale.cus_id, bill_no: { in: exactBills } },
    orderBy: { l_id: 'asc' },
  });

  const netBill =
    Number(sale.total_amount) +
    Number(sale.shipping_amount || 0) +
    Number(sale.labour_charges || 0) -
    Number(sale.discount || 0);

  console.log('=== SALE #443 (exact) ===');
  console.log('Date:', sale.created_at.toISOString());
  console.log('Customer:', sale.customer?.cus_name, 'cus_id', sale.cus_id);
  console.log('Items:', sale.sale_details.map((d) => `${d.product?.pro_title} x${d.qnty}`).join(', '));
  console.log('Total:', sale.total_amount, 'Shipping:', sale.shipping_amount, 'Discount:', sale.discount);
  console.log('Net bill amount (approx):', netBill);
  console.log('Payment on sale record:', sale.payment, '| Type:', sale.payment_type);
  console.log('Outstanding per sale row:', netBill - Number(sale.payment || 0));
  console.log('Customer current balance:', sale.customer?.cus_balance);

  console.log('\n=== LEDGER (exact bill_no 443 / PAY-443 / SR-443) ===');
  console.log('All accounts:', exactLedger.length, 'rows');
  exactLedger.forEach((r) => {
    console.log(
      `l_id ${r.l_id} | ${r.customer?.cus_name} | ${r.bill_no} | ${r.ledger_type} | ${r.trnx_type} | D ${r.debit_amount} C ${r.credit_amount} | close ${r.closing_balance}`
    );
    console.log('  ', (r.details || '').slice(0, 100));
  });

  console.log('\n=== CUSTOMER ali mirza ledger for this bill ===');
  custLedger443.forEach((r) => {
    console.log(
      `l_id ${r.l_id} | ${r.bill_no} | ${r.ledger_type} | D ${r.debit_amount} C ${r.credit_amount} | close ${r.closing_balance}`
    );
    console.log('  ', r.details);
  });

  const saleDebit = custLedger443.filter((r) => r.bill_no === '443' && Number(r.debit_amount) > 0);
  const payments = custLedger443.filter((r) => r.bill_no === 'PAY-443' || (r.bill_no === '443' && Number(r.credit_amount) > 0));
  const returns = custLedger443.filter((r) => r.bill_no === 'SR-443');

  console.log('\n=== RECONCILIATION ===');
  console.log('Sale debit entries on customer:', saleDebit.length, 'sum debit', saleDebit.reduce((s, r) => s + Number(r.debit_amount), 0));
  console.log('Payment/credit entries:', payments.length, 'sum credit', payments.reduce((s, r) => s + Number(r.credit_amount), 0));
  console.log('Return entries:', returns.length, 'sum credit', returns.reduce((s, r) => s + Number(r.credit_amount), 0));

  const allBill443 = await prisma.ledger.findMany({
    where: { bill_no: String(SALE_ID) },
    orderBy: { l_id: 'asc' },
    include: { customer: { select: { cus_name: true } } },
  });
  console.log('\n=== ALL LEDGER ROWS bill_no = sale_id 443 ===');
  console.log('count', allBill443.length);
  allBill443.forEach((r) => {
    console.log(
      `l_id ${r.l_id} | ${r.customer?.cus_name} | ${r.ledger_type || '-'} | D ${r.debit_amount} C ${r.credit_amount}`
    );
    console.log(' ', (r.details || '').slice(0, 100));
  });

  const expectedDebit = Number(sale.total_amount);
  console.log('\n=== GAP ===');
  console.log(
    'Expected customer SALE debit:',
    expectedDebit,
    '| Found:',
    saleDebit.reduce((s, r) => s + Number(r.debit_amount), 0),
    '| Missing from ledger:',
    expectedDebit - saleDebit.reduce((s, r) => s + Number(r.debit_amount), 0)
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
