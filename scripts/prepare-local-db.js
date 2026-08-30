#!/usr/bin/env node
/**
 * Local XAMPP/MariaDB setup — does NOT modify prisma/schema.prisma.
 *
 * Imported SQL dumps already contain tables + foreign keys. Prisma db push
 * fails on MariaDB because it tries to re-add constraints that already exist.
 *
 * Usage:
 *   node scripts/prepare-local-db.js          # verify DB + generate client (safe)
 *   node scripts/prepare-local-db.js --sync   # drop & recreate FKs via db push
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const syncMode = process.argv.includes('--sync');

async function main() {
  const prisma = new PrismaClient();

  try {
    const versionRows = await prisma.$queryRawUnsafe('SELECT VERSION() AS v');
    const version = versionRows[0].v;
    console.log(`Connected to: ${version}`);

    const dbRows = await prisma.$queryRawUnsafe('SELECT DATABASE() AS db');
    console.log(`Database: ${dbRows[0].db}`);

    const tables = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
    `);
    const tableCount = Number(tables[0].cnt);
    console.log(`Tables: ${tableCount}`);

    if (tableCount === 0) {
      console.error('\nNo tables found. Import your .sql backup into XAMPP first.');
      process.exit(1);
    }

    const users = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    `);
    if (Number(users[0].cnt) === 0) {
      console.error('\nMissing "users" table. Import your .sql backup first.');
      process.exit(1);
    }

    const fkRows = await prisma.$queryRawUnsafe(`
      SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS tc
      WHERE tc.TABLE_SCHEMA = DATABASE()
        AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
      ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME
    `);

    console.log(`Foreign keys in database: ${fkRows.length}`);

    if (syncMode) {
      if (fkRows.length === 0) {
        console.log('\nNo foreign keys to drop. Running prisma db push...');
      } else {
        console.log('\nSync mode: dropping existing foreign keys so db push can recreate them...');
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
        for (const row of fkRows) {
          const sql = `ALTER TABLE \`${row.TABLE_NAME}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``;
          await prisma.$executeRawUnsafe(sql);
        }
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
        console.log(`Dropped ${fkRows.length} foreign key(s).`);
      }

      console.log('\nRunning: npx prisma db push');
      execSync('npx prisma db push', { stdio: 'inherit', cwd: process.cwd() });
    } else {
      const diff = execSync(
        'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
        { encoding: 'utf8', cwd: process.cwd() }
      );
      const pendingFk = (diff.match(/^-- AddForeignKey/gm) || []).length;

      if (pendingFk > 0 && fkRows.length > 0) {
        console.log(`\nPrisma reports ${pendingFk} foreign key(s) to add, but ${fkRows.length} already exist in MariaDB.`);
        console.log('This is normal for imported XAMPP databases — skip "db push".');
        console.log('\nIf db push keeps failing, run:');
        console.log('  node scripts/prepare-local-db.js --sync');
      } else if (pendingFk > 0) {
        console.log(`\nSchema is ahead of DB (${pendingFk} FK(s)). Run with --sync or import a newer dump.`);
      } else {
        console.log('\nDatabase structure matches Prisma schema.');
      }
    }

    console.log('\nRunning: npx prisma generate');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: process.cwd() });

    console.log('\nLocal database ready. Start the app with: npm run dev:next');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
