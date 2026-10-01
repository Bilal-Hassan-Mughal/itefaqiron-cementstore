require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PK_OFFSET = '+05:00';

function pkRange(start, end) {
  return {
    gte: new Date(`${start}T00:00:00.000${PK_OFFSET}`),
    lte: new Date(`${end}T23:59:59.999${PK_OFFSET}`),
  };
}

async function main() {
  const date = process.argv[2] || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const range = pkRange(date, date);
  const sales = await prisma.sale.findMany({
    where: { created_at: range, bill_type: 'BILL' },
    select: {
      sale_id: true,
      total_amount: true,
      discount: true,
      shipping_amount: true,
      labour_charges: true,
    },
  });

  let sumAmount = 0;
  let sumDisc = 0;
  let sumShip = 0;
  let sumLabour = 0;
  let sumReportNet = 0;
  let sumCorrectNet = 0;
  let mismatchReport = 0;
  let mismatchStored = 0;

  for (const s of sales) {
    const amt = Number(s.total_amount);
    const disc = Number(s.discount || 0);
    const ship = Number(s.shipping_amount || 0);
    const labour = Number(s.labour_charges || 0);
    sumAmount += amt;
    sumDisc += disc;
    sumShip += ship;
    sumLabour += labour;
    const reportNet = amt - disc + ship;
    const correctNet = amt; // POS stores grand total in total_amount
    const altNet = amt - disc + labour + ship;
    sumReportNet += reportNet;
    sumCorrectNet += correctNet;
    if (Math.abs(reportNet - correctNet) > 0.02) mismatchReport++;
    if (Math.abs(amt - (amt - disc + labour + ship)) > 0.02 && disc + labour + ship > 0) {
      // total_amount should equal product+labour+ship-disc if consistent
    }
    if (Math.abs(reportNet - altNet) > 0.02 && labour > 0) mismatchStored++;
  }

  console.log('Date', date, 'BILL sales', sales.length);
  console.log('Sum AMOUNT (total_amount):', sumAmount);
  console.log('Sum discount:', sumDisc);
  console.log('Sum shipping:', sumShip);
  console.log('Sum labour:', sumLabour);
  console.log('Footer NET (report formula amt-disc+ship):', sumReportNet);
  console.log('Footer NET (use total_amount only):', sumCorrectNet);
  console.log('Rows where report net != total_amount:', mismatchReport);
  console.log('Rows with labour where report omits labour:', mismatchStored);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
