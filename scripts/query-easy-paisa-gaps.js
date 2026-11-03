const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const before = await p.ledger.findFirst({ where: { cus_id: 1654, l_id: { lt: 32476 } }, orderBy: { l_id: "desc" } });
  console.log("BEFORE_32476", before && { l_id: before.l_id, bill: before.bill_no, close: before.closing_balance, at: before.created_at });
  const first = await p.ledger.findFirst({ where: { cus_id: 1654 }, orderBy: { l_id: "asc" } });
  console.log("FIRST_ENTRY", { l_id: first.l_id, open: first.opening_balance, close: first.closing_balance, details: first.details });
  const chronBefore681 = await p.ledger.findMany({ where: { cus_id: 1654, created_at: { lt: new Date("2026-11-03T18:03:51.987Z") } }, orderBy: [{ created_at: "desc" }, { l_id: "desc" }], take: 3 });
  console.log("CHRON_BEFORE_EXP681");
  chronBefore681.forEach(r => console.log(r.l_id, r.bill_no, r.closing_balance, r.created_at.toISOString()));
})();
