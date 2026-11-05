const { PrismaClient } = require('@prisma/client');
const { fetchHrEmployeeExpenseLines } = require('../src/lib/hr-profit-expenses');

const p = new PrismaClient();
const start = process.argv[2] || '2026-11-05';
const end = process.argv[3] || start;

(async () => {
  const finance = await p.expense.findMany({
    where: {
      created_at: {
        gte: new Date(`${start}T00:00:00+05:00`),
        lte: new Date(`${end}T23:59:59.999+05:00`),
      },
    },
    include: { expense_title: true },
  });
  const hr = await fetchHrEmployeeExpenseLines(p, { startDate: start, endDate: end, branchId: 1 });
  console.log('Date', start, 'to', end);
  console.log('Finance expenses:', finance.length, 'total', finance.reduce((s, e) => s + Number(e.exp_amount), 0));
  finance.forEach((e) => console.log(' EXP', e.exp_id, e.expense_title?.title, e.exp_amount, e.exp_title));
  console.log('\nHR lines for profit report:', hr.length, 'total', hr.reduce((s, e) => s + Number(e.exp_amount), 0));
  hr.forEach((e) => console.log(' HR', e.hr_source, e.exp_title, e.exp_amount));
  await p.$disconnect();
})();
