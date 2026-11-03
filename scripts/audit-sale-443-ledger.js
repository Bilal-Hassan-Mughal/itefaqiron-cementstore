const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const SALE_ID = 443;

async function main() {
  const sale = await prisma.sale.findUnique({
    where: { sale_id: SALE_ID },
    include: {
      customer: { select: { cus_id: true, cus_name: true, cus_balance: true } },
      sale_details: { include: { product: { select: { pro_title: true } } } },
      split_payments: true,
    },
  });

  if (!sale) {
    console.log('Sale not found:', SALE_ID);
    return;
  }

  const billKeys = [
    String(SALE_ID),
    `PAY-${SALE_ID}`,
    sale.bill_number ? String(sale.bill_number) : null,
  ].filter(Boolean);

  const ledgerByBill = await prisma.ledger.findMany({
    where: {
      OR: billKeys.flatMap((b) => [
        { bill_no: b },
        { bill_no: { contains: b } },
      ]),
    },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
    include: {
      customer: { select: { cus_id: true, cus_name: true } },
      updated_by_user: { select: { full_name: true } },
    },
  });

  const customerLedger = sale.cus_id
    ? await prisma.ledger.findMany({
        where: {
          cus_id: sale.cus_id,
          OR: [
            { details: { contains: String(SALE_ID) } },
            ...billKeys.map((b) => ({ bill_no: b })),
          ],
        },
        orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
      })
    : [];

  const easyPaisa = await prisma.customer.findFirst({
    where: { cus_name: { contains: 'easy paisa' } },
    select: { cus_id: true, cus_name: true },
  });

  let easyPaisaOnSale = [];
  if (easyPaisa) {
    easyPaisaOnSale = await prisma.ledger.findMany({
      where: {
        cus_id: easyPaisa.cus_id,
        OR: [
          { bill_no: String(SALE_ID) },
          { bill_no: `PAY-${SALE_ID}` },
          { details: { contains: String(SALE_ID) } },
          { details: { contains: sale.customer?.cus_name || '' } },
        ],
      },
      orderBy: { l_id: 'asc' },
    });
  }

  const returns = await prisma.saleReturn.findMany({
    where: { sale_id: SALE_ID },
    select: { return_id: true, total_amount: true, payment: true, created_at: true },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sale: {
      sale_id: sale.sale_id,
      date: sale.created_at,
      customer: sale.customer,
      bill_number: sale.bill_number,
      bill_type: sale.bill_type,
      total_amount: Number(sale.total_amount),
      discount: Number(sale.discount || 0),
      shipping: Number(sale.shipping_amount || 0),
      payment: Number(sale.payment || 0),
      cash_payment: Number(sale.cash_payment || 0),
      bank_payment: Number(sale.bank_payment || 0),
      payment_type: sale.payment_type,
      reference: sale.reference,
      items: sale.sale_details.map((d) => ({
        product: d.product?.pro_title,
        qnty: Number(d.qnty),
        rate: Number(d.unit_rate),
        amount: Number(d.total_amount),
      })),
      split_payments: sale.split_payments,
      impliedBalance: Number(sale.total_amount) + Number(sale.shipping_amount || 0) - Number(sale.discount || 0) - Number(sale.payment || 0),
    },
    ledgerRowsMatchingBill: ledgerByBill.map((r) => ({
      l_id: r.l_id,
      cus_id: r.cus_id,
      customer: r.customer?.cus_name,
      bill_no: r.bill_no,
      ledger_type: r.ledger_type,
      trnx_type: r.trnx_type,
      opening: Number(r.opening_balance),
      debit: Number(r.debit_amount),
      credit: Number(r.credit_amount),
      closing: Number(r.closing_balance),
      cash: Number(r.cash_payment || 0),
      bank: Number(r.bank_payment || 0),
      details: r.details,
      created_at: r.created_at,
      updated_by: r.updated_by_user?.full_name,
    })),
    customerLedgerRelated: customerLedger.map((r) => ({
      l_id: r.l_id,
      bill_no: r.bill_no,
      ledger_type: r.ledger_type,
      trnx_type: r.trnx_type,
      debit: Number(r.debit_amount),
      credit: Number(r.credit_amount),
      closing: Number(r.closing_balance),
      details: r.details,
      created_at: r.created_at,
    })),
    easyPaisaLedgerRelated: easyPaisaOnSale.map((r) => ({
      l_id: r.l_id,
      bill_no: r.bill_no,
      debit: Number(r.debit_amount),
      credit: Number(r.credit_amount),
      details: r.details,
      created_at: r.created_at,
    })),
    saleReturns: returns,
  };

  const out = 'sale-443-ledger-audit.json';
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  console.log('=== SALE #443 ===');
  console.log('Customer:', sale.customer?.cus_name, '| cus_id', sale.cus_id);
  console.log('Total:', sale.total_amount, 'Shipping:', sale.shipping_amount, 'Payment:', sale.payment);
  console.log('Bill type:', sale.bill_type, '| Payment type:', sale.payment_type);
  console.log('Ledger rows (bill match):', ledgerByBill.length);
  console.log('Customer ledger related:', customerLedger.length);
  console.log('Easy Paisa related:', easyPaisaOnSale.length);
  console.log('Report:', out);
  ledgerByBill.forEach((r) => {
    console.log('---');
    console.log(`l_id ${r.l_id} | ${r.customer?.cus_name} | bill ${r.bill_no} | ${r.ledger_type} | D ${r.debit_amount} C ${r.credit_amount} | close ${r.closing_balance}`);
    console.log(String(r.details || '').slice(0, 120));
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
