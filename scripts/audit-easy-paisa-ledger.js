const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const CUS_NAME = 'easy paisa';

async function billExists(billNo, ledgerType) {
  if (!billNo) return { kind: 'none', exists: false };
  const id = parseInt(String(billNo).replace(/\D/g, ''), 10);
  if (!id) return { kind: 'unknown', exists: null, billNo };

  const lt = (ledgerType || '').toLowerCase();
  if (lt.includes('sale') || lt === 'sale') {
    const s = await prisma.sale.findUnique({ where: { sale_id: id }, select: { sale_id: true } });
    return { kind: 'sale', exists: !!s, id };
  }
  if (lt.includes('purchase') || lt === 'purchase') {
    const p = await prisma.purchase.findUnique({ where: { pur_id: id }, select: { pur_id: true } });
    return { kind: 'purchase', exists: !!p, id };
  }
  if (lt.includes('expense') || lt === 'expense') {
    const e = await prisma.expense.findUnique({ where: { exp_id: id }, select: { exp_id: true } });
    return { kind: 'expense', exists: !!e, id };
  }

  const [sale, purchase, expense] = await Promise.all([
    prisma.sale.findUnique({ where: { sale_id: id }, select: { sale_id: true } }),
    prisma.purchase.findUnique({ where: { pur_id: id }, select: { pur_id: true } }),
    prisma.expense.findUnique({ where: { exp_id: id }, select: { exp_id: true } }),
  ]);
  if (sale) return { kind: 'sale', exists: true, id };
  if (purchase) return { kind: 'purchase', exists: true, id };
  if (expense) return { kind: 'expense', exists: true, id };
  return { kind: 'missing_all', exists: false, id };
}

async function main() {
  const cust = await prisma.customer.findFirst({
    where: { cus_name: { contains: CUS_NAME } },
    include: { customer_category: true, customer_type: true },
  });

  if (!cust) {
    console.log('Customer not found:', CUS_NAME);
    return;
  }

  const cusId = cust.cus_id;
  const entriesLid = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: { l_id: 'asc' },
  });
  const entriesChron = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  function chainGaps(entries, label) {
    const gaps = [];
    let prevClose = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const ob = Number(e.opening_balance);
      const db = Number(e.debit_amount || 0);
      const cr = Number(e.credit_amount || 0);
      const cl = Number(e.closing_balance);
      const expectedOpen = i === 0 ? ob : prevClose;
      if (i > 0 && Math.abs(ob - prevClose) > 0.01) {
        gaps.push({
          chain: label,
          l_id: e.l_id,
          created_at: e.created_at,
          bill_no: e.bill_no,
          ledger_type: e.ledger_type,
          trnx_type: e.trnx_type,
          details: e.details,
          prev_closing: prevClose,
          opening: ob,
          jump: ob - prevClose,
          debit: db,
          credit: cr,
        });
      }
      const calc = ob + db - cr;
      if (Math.abs(cl - calc) > 0.01) {
        gaps.push({
          chain: label,
          l_id: e.l_id,
          error: 'formula',
          closing: cl,
          calculated: calc,
          diff: cl - calc,
        });
      }
      prevClose = cl;
    }
    return gaps;
  }

  const gapsLid = chainGaps(entriesLid, 'l_id');
  const gapsChron = chainGaps(entriesChron, 'created_at');

  const missingBills = [];
  const billCache = new Map();
  for (const e of entriesLid) {
    if (!e.bill_no) continue;
    const key = `${e.bill_no}|${e.ledger_type || ''}`;
    if (billCache.has(key)) continue;
    billCache.set(key, true);
    const check = await billExists(e.bill_no, e.ledger_type);
    if (check.exists === false) {
      missingBills.push({
        l_id: e.l_id,
        bill_no: e.bill_no,
        ledger_type: e.ledger_type,
        created_at: e.created_at,
        debit: e.debit_amount,
        credit: e.credit_amount,
        details: e.details,
        check,
      });
    }
  }

  let activity = [];
  try {
    activity = await prisma.activityLog.findMany({
      where: {
        OR: [
          { description: { contains: 'easy paisa' } },
          { description: { contains: String(cusId) } },
          { entity_id: String(cusId) },
        ],
        action: { contains: 'delete' },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  } catch (err) {
    activity = { error: err.message };
  }

  const last = entriesLid[entriesLid.length - 1];
  const report = {
    generatedAt: new Date().toISOString(),
    customer: {
      cus_id: cusId,
      cus_name: cust.cus_name,
      cus_balance: Number(cust.cus_balance),
      category: cust.customer_category?.cus_cat_title,
      type: cust.customer_type?.cus_type_title,
    },
    ledgerEntryCount: entriesLid.length,
    lastLedgerClosing: last ? Number(last.closing_balance) : null,
    balanceMatchesLedger: last ? Math.abs(Number(cust.cus_balance) - Number(last.closing_balance)) < 0.02 : null,
    gapsByLId: gapsLid,
    gapsByCreatedAt: gapsChron,
    missingSourceBills: missingBills,
    deletionActivityLogs: Array.isArray(activity)
      ? activity.map((a) => ({
          id: a.id,
          action: a.action,
          module: a.module,
          description: a.description,
          details: a.details,
          created_at: a.created_at,
        }))
      : activity,
  };

  const outPath = 'easy-paisa-ledger-audit.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('=== EASY PAISA LEDGER AUDIT ===');
  console.log('Customer ID:', cusId, '| Entries:', entriesLid.length);
  console.log('Customer balance:', cust.cus_balance, '| Last ledger closing:', last?.closing_balance);
  console.log('Chain gaps (by l_id):', gapsLid.length);
  console.log('Chain gaps (by created_at):', gapsChron.length);
  console.log('Ledger rows with missing sale/purchase/expense bill:', missingBills.length);
  console.log('Full report:', outPath);
  console.log('\n--- GAPS BY L_ID (first 10) ---');
  gapsLid.slice(0, 10).forEach((g) => console.log(JSON.stringify(g, null, 0)));
  console.log('\n--- MISSING BILLS (first 15) ---');
  missingBills.slice(0, 15).forEach((m) => console.log(JSON.stringify(m, null, 0)));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
