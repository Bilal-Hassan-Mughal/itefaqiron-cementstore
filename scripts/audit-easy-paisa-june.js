/**
 * Deep cross-check: easy paisa account, June 2026 — ledger, PAY/RECEIVE payments, gaps.
 * node scripts/audit-easy-paisa-june.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const JUNE_START = new Date('2026-06-01T00:00:00.000+05:00');
const JUNE_END = new Date('2026-07-01T00:00:00.000+05:00');

function inJune(d) {
  const t = new Date(d);
  return t >= JUNE_START && t < JUNE_END;
}

function num(x) {
  return Number(x || 0);
}

async function main() {
  const cust = await prisma.customer.findFirst({
    where: { cus_name: { contains: 'easy paisa' } },
    include: { customer_category: true },
  });
  if (!cust) {
    console.log('easy paisa account not found');
    return;
  }
  const cusId = cust.cus_id;

  const juneLedger = await prisma.ledger.findMany({
    where: {
      cus_id: cusId,
      created_at: { gte: JUNE_START, lt: JUNE_END },
    },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  const allLedgerPay = await prisma.ledger.findMany({
    where: {
      cus_id: cusId,
      bill_no: { startsWith: 'PAY-' },
    },
    orderBy: { l_id: 'asc' },
  });

  const junePayLedger = allLedgerPay.filter((r) => inJune(r.created_at));

  const junePaymentsOnAccount = await prisma.payment.findMany({
    where: {
      account_id: cusId,
      payment_date: { gte: JUNE_START, lt: JUNE_END },
    },
    orderBy: { payment_id: 'asc' },
  });

  const junePaymentsUsingEasyPaisaAsCashBank = await prisma.payment.findMany({
    where: {
      OR: [{ cash_account_id: cusId }, { bank_account_id: cusId }],
      payment_date: { gte: JUNE_START, lt: JUNE_END },
    },
    include: { account: { select: { cus_name: true, cus_id: true } } },
    orderBy: { payment_id: 'asc' },
  });

  const paymentIdsJune = new Set(junePaymentsOnAccount.map((p) => p.payment_id));

  const payBillNosJune = new Set(junePayLedger.map((r) => r.bill_no));

  const paymentsMissingLedger = [];
  for (const p of junePaymentsOnAccount) {
    const ref = `PAY-${p.payment_id}`;
    const rows = await prisma.ledger.count({
      where: { bill_no: ref, cus_id: cusId },
    });
    const rowsAny = await prisma.ledger.count({ where: { bill_no: ref } });
    if (rowsAny === 0) {
      paymentsMissingLedger.push({ ...p, bill_ref: ref });
    } else if (rows === 0 && rowsAny > 0) {
      paymentsMissingLedger.push({ ...p, bill_ref: ref, note: 'ledger on other accounts only' });
    }
  }

  const ledgerPayMissingPayment = [];
  const ledgerPayCashBankLeg = [];
  for (const row of junePayLedger) {
    const m = String(row.bill_no || '').match(/^PAY-(\d+)$/i);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const pay = await prisma.payment.findUnique({
      where: { payment_id: pid },
      include: { account: { select: { cus_name: true } } },
    });
    if (!pay) {
      ledgerPayMissingPayment.push({ l_id: row.l_id, bill_no: row.bill_no, created_at: row.created_at });
    } else if (pay.account_id !== cusId) {
      ledgerPayCashBankLeg.push({
        l_id: row.l_id,
        bill_no: row.bill_no,
        payment_id: pid,
        payment_type: pay.payment_type,
        party_account: pay.account?.cus_name,
        party_cus_id: pay.account_id,
        note: 'easy paisa is cash/bank leg — expected',
      });
    }
  }

  const chainGaps = [];
  const beforeJune = await prisma.ledger.findMany({
    where: { cus_id: cusId, created_at: { lt: JUNE_START } },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
    take: 1,
  });
  let prevClose = beforeJune[0] ? num(beforeJune[0].closing_balance) : 0;

  const juneChron = [...juneLedger].sort((a, b) => {
    const td = a.created_at - b.created_at;
    if (td !== 0) return td;
    return a.l_id - b.l_id;
  });

  for (const e of juneChron) {
    const ob = num(e.opening_balance);
    if (Math.abs(ob - prevClose) > 0.02) {
      chainGaps.push({
        l_id: e.l_id,
        bill_no: e.bill_no,
        created_at: e.created_at,
        expected_open: prevClose,
        actual_open: ob,
        jump: ob - prevClose,
        ledger_type: e.ledger_type,
        details: (e.details || '').slice(0, 80),
      });
    }
    prevClose = num(e.closing_balance);
  }

  const uniqueBills = [...new Set(juneLedger.map((e) => e.bill_no).filter(Boolean))];
  const billSourceCheck = [];
  for (const bill of uniqueBills) {
    if (/^PAY-\d+$/i.test(bill)) continue;
    if (/^EXP-/i.test(bill)) continue;
    const id = parseInt(String(bill).replace(/\D/g, ''), 10);
    if (!id) continue;
    const [sale, pur, exp] = await Promise.all([
      prisma.sale.findUnique({ where: { sale_id: id }, select: { sale_id: true, created_at: true } }),
      prisma.purchase.findUnique({ where: { pur_id: id }, select: { pur_id: true } }),
      prisma.expense.findUnique({ where: { exp_id: id }, select: { exp_id: true } }),
    ]);
    if (!sale && !pur && !exp) {
      billSourceCheck.push({ bill_no: bill, parsed_id: id, issue: 'no sale/purchase/expense row' });
    } else if (sale && !inJune(sale.created_at) && inJune(juneLedger.find((x) => x.bill_no === bill)?.created_at)) {
      billSourceCheck.push({ bill_no: bill, issue: 'ledger in June but sale outside June', sale_date: sale.created_at });
    }
  }

  const report = {
    account: { cus_id: cusId, name: cust.cus_name, balance: cust.cus_balance },
    period: '2026-06 (PK)',
    summary: {
      june_ledger_rows: juneLedger.length,
      june_pay_bill_ledger_rows: junePayLedger.length,
      june_payments_on_account: junePaymentsOnAccount.length,
      june_payments_using_easy_paisa_cash_bank: junePaymentsUsingEasyPaisaAsCashBank.length,
      payments_missing_any_ledger: paymentsMissingLedger.length,
      june_pay_ledger_missing_payment_record: ledgerPayMissingPayment.length,
      june_pay_ledger_cash_bank_leg: ledgerPayCashBankLeg.length,
      opening_chain_gaps_in_june: chainGaps.length,
      suspicious_bill_refs: billSourceCheck.length,
    },
    june_payments: junePaymentsOnAccount.map((p) => ({
      payment_id: p.payment_id,
      type: p.payment_type,
      net: num(p.net_amount),
      date: p.payment_date,
      status: p.status,
      description: p.description,
      bill_ref: `PAY-${p.payment_id}`,
    })),
    june_payments_cash_bank_leg: junePaymentsUsingEasyPaisaAsCashBank.map((p) => ({
      payment_id: p.payment_id,
      type: p.payment_type,
      party: p.account?.cus_name,
      party_cus_id: p.account_id,
      net: num(p.net_amount),
      cash: num(p.cash_amount),
      bank: num(p.bank_amount),
      bill_ref: `PAY-${p.payment_id}`,
      date: p.payment_date,
    })),
    payments_missing_ledger: paymentsMissingLedger,
    ledger_pay_missing_payment: ledgerPayMissingPayment,
    ledger_pay_cash_bank_leg: ledgerPayCashBankLeg,
    chain_gaps: chainGaps,
    bill_source_issues: billSourceCheck,
    june_ledger_detail: juneLedger.map((e) => ({
      l_id: e.l_id,
      bill_no: e.bill_no,
      type: e.ledger_type,
      trnx: e.trnx_type,
      debit: num(e.debit_amount),
      credit: num(e.credit_amount),
      open: num(e.opening_balance),
      close: num(e.closing_balance),
      at: e.created_at,
      details: e.details,
    })),
  };

  console.log('=== EASY PAISA JUNE 2026 AUDIT ===');
  console.log('Account:', cust.cus_name, 'cus_id', cusId, 'balance', num(cust.cus_balance));
  console.log('Summary:', report.summary);
  console.log('\n--- June payments (Pay/Receive on this account) ---');
  report.june_payments.forEach((p) =>
    console.log(`#${p.payment_id} ${p.type} net ${p.net} ${p.date?.toISOString?.()?.slice(0, 10)} ${p.status} → ${p.bill_ref}`)
  );
  console.log('\n--- Payments missing ledger ---');
  paymentsMissingLedger.forEach((p) => console.log(p));
  console.log('\n--- June Pay/Receive using easy paisa as cash/bank ---');
  report.june_payments_cash_bank_leg.forEach((p) =>
    console.log(`#${p.payment_id} ${p.type} party ${p.party} net ${p.net} → ${p.bill_ref}`)
  );
  console.log('\n--- PAY-* on easy paisa with NO payment record ---');
  ledgerPayMissingPayment.forEach((x) => console.log(x));
  console.log('\n--- PAY-* cash/bank leg rows (normal) count:', ledgerPayCashBankLeg.length);
  console.log('\n--- Opening chain gaps (June) ---');
  chainGaps.forEach((g) => console.log(g));
  console.log('\n--- Bill reference issues ---');
  billSourceCheck.forEach((b) => console.log(b));

  const out = path.join(__dirname, 'easy-paisa-june-audit.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nWrote', out);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
