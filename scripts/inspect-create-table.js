const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectSchema() {
  try {
    const ledgerTable = await prisma.$queryRawUnsafe('SHOW CREATE TABLE ledger');
    console.log('--- CREATE TABLE ledger ---');
    console.log(ledgerTable[0]['Create Table']);

    const salesTable = await prisma.$queryRawUnsafe('SHOW CREATE TABLE sales');
    console.log('--- CREATE TABLE sales ---');
    console.log(salesTable[0]['Create Table']);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

inspectSchema();
