/**
 * Export readable lists: bills missing ledger + deleted sale IDs (with dates from ledger/logs).
 * Run: node scripts/export-bills-ledger-gaps-list.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const COLLATE = 'utf8mb4_unicode_ci';
const OUT = path.join(__dirname, 'bills-ledger-gaps-list.json');

function fmtDate(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().replace('T', ' ').slice(0, 19);
}

function num(v) {
  return v == null ? 0 : Number(v);
}

async function salesMissingLedger() {
  return prisma.$queryRawUnsafe(`
    SELECT s.sale_id, s.bill_number, s.bill_type, s.total_amount,
           s.payment, s.created_at, c.cus_id, c.cus_name
    FROM sales s
    INNER JOIN customers c ON c.cus_id = s.cus_id
    WHERE s.bill_type IN ('BILL', 'DISPATCHED')
      AND NOT EXISTS (
        SELECT 1 FROM ledger l
        WHERE l.bill_no COLLATE ${COLLATE} = CAST(s.sale_id AS CHAR) COLLATE ${COLLATE}
      )
    ORDER BY s.total_amount DESC, s.created_at DESC
  `);
}

async function paymentsMissingLedger() {
  return prisma.$queryRawUnsafe(`
    SELECT pay.payment_id, pay.payment_type, pay.net_amount, pay.cash_amount, pay.bank_amount,
           pay.payment_date, pay.created_at, pay.status, c.cus_id, c.cus_name
    FROM payments pay
    INNER JOIN customers c ON c.cus_id = pay.account_id
    WHERE pay.status != 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM ledger l
        WHERE l.bill_no COLLATE ${COLLATE} = CONCAT('PAY-', pay.payment_id) COLLATE ${COLLATE}
      )
    ORDER BY pay.net_amount DESC, pay.payment_date DESC
  `);
}

async function saleIdGaps() {
  const rows = await prisma.$queryRawUnsafe(`SELECT sale_id FROM sales ORDER BY sale_id ASC`);
  const ids = rows.map((r) => Number(r.sale_id));
  const gaps = [];
  for (let i = 1; i < ids.length; i++) {
    for (let m = ids[i - 1] + 1; m < ids[i]; m++) gaps.push(m);
  }
  return gaps;
}

async function deletedSaleEvidence(missingSaleIds) {
  const list = [];
  for (const saleId of missingSaleIds) {
    const billNo = String(saleId);
    const ledger = await prisma.ledger.findMany({
      where: { bill_no: billNo },
      orderBy: { l_id: 'asc' },
      select: {
        l_id: true,
        cus_id: true,
        debit_amount: true,
        credit_amount: true,
        ledger_type: true,
        details: true,
        created_at: true,
      },
    });

    let customerName = null;
    if (ledger.length) {
      const c = await prisma.customer.findUnique({
        where: { cus_id: ledger[0].cus_id },
        select: { cus_name: true },
      });
      customerName = c?.cus_name ?? null;
    }

    const deleteLog = await prisma.activityLog.findFirst({
      where: {
        action: 'DELETE',
        module: 'Sales & POS',
        entity_id: billNo,
      },
      orderBy: { created_at: 'desc' },
      select: { created_at: true, user_name: true, description: true },
    });

    const mentionLog = deleteLog
      ? null
      : await prisma.activityLog.findFirst({
          where: {
            OR: [
              { description: { contains: `Sale/Invoice #${saleId}` } },
              { description: { contains: `Sale #${saleId}` } },
              { description: { contains: `Invoice #${saleId}` } },
            ],
            action: 'DELETE',
          },
          orderBy: { created_at: 'desc' },
          select: { created_at: true, user_name: true, description: true },
        });

    const log = deleteLog || mentionLog;

    const debitSum = ledger.reduce((s, r) => s + num(r.debit_amount), 0);
    const creditSum = ledger.reduce((s, r) => s + num(r.credit_amount), 0);
    const firstLedger = ledger[0]?.created_at ?? null;
    const lastLedger = ledger.length ? ledger[ledger.length - 1].created_at : null;

    list.push({
      sale_id: saleId,
      system_bill_ref: billNo,
      printed_bill_number: null,
      status: 'DELETED_FROM_SALES_TABLE',
      account: customerName,
      estimated_amount_from_ledger: Math.max(debitSum, creditSum) || null,
      ledger_rows_remaining: ledger.length,
      last_ledger_activity_date: fmtDate(lastLedger),
      first_ledger_activity_date: fmtDate(firstLedger),
      deleted_logged_date: log ? fmtDate(log.created_at) : null,
      deleted_logged_at: log ? fmtDateTime(log.created_at) : null,
      deleted_by: log?.user_name ?? null,
      delete_note: log?.description ?? null,
      note:
        ledger.length > 0
          ? 'Sale row missing but ledger still exists (orphan ledger).'
          : 'Sale row missing; no ledger on this bill_no; no delete log since activity logging started.',
    });
  }
  return list;
}

async function orphanPaymentsAndReturns() {
  const pay = await prisma.$queryRawUnsafe(`
    SELECT l.bill_no, COUNT(*) AS ledger_rows, MIN(l.created_at) AS first_at, MAX(l.created_at) AS last_at,
           SUM(l.debit_amount) AS debit_sum, SUM(l.credit_amount) AS credit_sum
    FROM ledger l
    WHERE l.bill_no REGEXP '^PAY-[0-9]+$'
      AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE CONCAT('PAY-', p.payment_id) COLLATE ${COLLATE} = l.bill_no COLLATE ${COLLATE}
      )
    GROUP BY l.bill_no
  `);
  const sr = await prisma.$queryRawUnsafe(`
    SELECT l.bill_no, COUNT(*) AS ledger_rows, MIN(l.created_at) AS first_at, MAX(l.created_at) AS last_at,
           SUM(l.debit_amount) AS debit_sum, SUM(l.credit_amount) AS credit_sum
    FROM ledger l
    WHERE l.bill_no REGEXP '^SR-[0-9]+$'
      AND NOT EXISTS (
        SELECT 1 FROM sale_returns sr WHERE CONCAT('SR-', sr.return_id) COLLATE ${COLLATE} = l.bill_no COLLATE ${COLLATE}
      )
    GROUP BY l.bill_no
  `);
  return { pay, sr };
}

function printMissingSales(rows) {
  console.log('\n=== BILLS IN SYSTEM — LEDGER MISSING (Sales BILL/Dispatched) ===');
  console.log(
    'Sale ID | Printed Bill # | Account | Amount | Paid | Bill date | Type'
  );
  console.log('-'.repeat(100));
  rows.forEach((r) => {
    const amt = num(r.total_amount);
    console.log(
      `${r.sale_id} | ${r.bill_number ?? '—'} | ${r.cus_name} | Rs ${amt} | Rs ${num(r.payment)} | ${fmtDate(r.created_at)} | ${r.bill_type}`
    );
  });
}

function printMissingPayments(rows) {
  console.log('\n=== PAY/RECEIVE — LEDGER MISSING (active payments) ===');
  console.log('Payment ID | Type | Account | Net | Date');
  console.log('-'.repeat(90));
  rows.forEach((r) => {
    console.log(
      `${r.payment_id} | ${r.payment_type} | ${r.cus_name} | Rs ${num(r.net_amount)} | ${fmtDate(r.payment_date)}`
    );
  });
}

function printDeleted(rows) {
  console.log('\n=== DELETED SALES (missing sale_id in database) ===');
  console.log(
    'Sale ID | Ledger rows left | Est. amount (ledger) | Last ledger date | Delete logged date | Deleted by | Account'
  );
  console.log('-'.repeat(120));
  rows.forEach((r) => {
    console.log(
      `${r.sale_id} | ${r.ledger_rows_remaining} | ${r.estimated_amount_from_ledger != null ? 'Rs ' + r.estimated_amount_from_ledger : '—'} | ${r.last_ledger_activity_date ?? '—'} | ${r.deleted_logged_date ?? 'NO LOG'} | ${r.deleted_by ?? '—'} | ${r.account ?? '—'}`
    );
  });
}

async function main() {
  const [sales, payments, gaps, orphans] = await Promise.all([
    salesMissingLedger(),
    paymentsMissingLedger(),
    saleIdGaps(),
    orphanPaymentsAndReturns(),
  ]);
  const deleted = await deletedSaleEvidence(gaps);

  const missingSalesList = sales.map((r) => ({
    sale_id: Number(r.sale_id),
    printed_bill_number: r.bill_number != null ? Number(r.bill_number) : null,
    bill_type: r.bill_type,
    account: r.cus_name,
    cus_id: Number(r.cus_id),
    amount: num(r.total_amount),
    paid: num(r.payment),
    bill_date: fmtDate(r.created_at),
    ledger_bill_no_expected: String(r.sale_id),
    issue: 'BILL_EXISTS_LEDGER_MISSING',
  }));

  const missingPaymentsList = payments.map((r) => ({
    payment_id: Number(r.payment_id),
    bill_ref: `PAY-${r.payment_id}`,
    payment_type: r.payment_type,
    account: r.cus_name,
    cus_id: Number(r.cus_id),
    amount: num(r.net_amount),
    cash: num(r.cash_amount),
    bank: num(r.bank_amount),
    payment_date: fmtDate(r.payment_date),
    created_at: fmtDate(r.created_at),
    issue: 'PAYMENT_EXISTS_LEDGER_MISSING',
  }));

  const report = {
    generated_at: new Date().toISOString(),
    activity_log_note:
      'Delete dates are only available if logged in activity_logs (logging started ~2025-10-25). Older deletes show NO LOG.',
    summary: {
      sales_missing_ledger: missingSalesList.length,
      sales_missing_ledger_with_amount: missingSalesList.filter((x) => x.amount > 0).length,
      payments_missing_ledger: missingPaymentsList.length,
      deleted_sale_ids: deleted.length,
      deleted_with_ledger_left: deleted.filter((x) => x.ledger_rows_remaining > 0).length,
      deleted_with_delete_log: deleted.filter((x) => x.deleted_logged_date).length,
    },
    bills_missing_ledger: {
      sales: missingSalesList,
      payments: missingPaymentsList,
    },
    deleted_sales: deleted,
    deleted_payment_or_return_ledger_only: {
      payments: orphans.pay.map((r) => ({
        bill_ref: r.bill_no,
        ledger_rows: Number(r.ledger_rows),
        amount_hint: Math.max(num(r.debit_sum), num(r.credit_sum)),
        first_ledger_date: fmtDate(r.first_at),
        last_ledger_date: fmtDate(r.last_at),
      })),
      sale_returns: orphans.sr.map((r) => ({
        bill_ref: r.bill_no,
        ledger_rows: Number(r.ledger_rows),
        amount_hint: Math.max(num(r.debit_sum), num(r.credit_sum)),
        first_ledger_date: fmtDate(r.first_at),
        last_ledger_date: fmtDate(r.last_at),
      })),
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('=== BILLS / LEDGER GAP LIST ===');
  console.log('Summary:', report.summary);
  printMissingSales(sales);
  printMissingPayments(payments);
  printDeleted(deleted);
  console.log('\nFull JSON:', OUT);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
