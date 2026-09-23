const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDrafts() {
  const drafts = await prisma.draftSale.findMany({
    where: { created_at: { gte: new Date('2026-09-22T00:00:00.000Z') } },
    select: { draft_id: true, cus_id: true, created_at: true }
  });
  const d = await prisma.draftSale.findUnique({ where: { draft_id: 573 }, include: { customer: true } });
  console.log('Draft 573:', { id: d.draft_id, customer: d.customer?.cus_name, date: d.created_at, state: JSON.parse(d.form_state_json || '{}') });

  await prisma.$disconnect();
}

checkDrafts().catch(console.error);
