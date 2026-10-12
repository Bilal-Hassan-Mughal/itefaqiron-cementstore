const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const missing = await prisma.$queryRaw`
    SELECT p.payment_id, p.payment_type, p.bank_amount, p.created_at, p.description
    FROM payments p
    LEFT JOIN ledger l ON l.bill_no = CONCAT('PAY-', p.payment_id) AND l.cus_id = 1650
    WHERE p.bank_account_id = 1650
      AND p.bank_amount > 0
      AND p.status = 'COMPLETED'
      AND l.l_id IS NULL
    ORDER BY p.payment_id
  `;
  console.log('Payments missing UBL ledger row:', missing.length);
  let missReceive = 0;
  let missPay = 0;
  for (const row of missing) {
    const amt = parseFloat(row.bank_amount);
    if (row.payment_type === 'RECEIVE') missReceive += amt;
    else missPay += amt;
    console.log(`PAY-${row.payment_id}`, row.payment_type, amt, String(row.created_at).slice(0, 10));
  }
  console.log('Missing RECEIVE total (should add to bank if posted):', missReceive);
  console.log('Missing PAY total:', missPay);
  console.log('Net missing effect if RECEIVE=debit PAY=credit:', missReceive - missPay);
}

main().finally(() => prisma.$disconnect());
