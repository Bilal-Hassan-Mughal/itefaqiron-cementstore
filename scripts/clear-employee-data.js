#!/usr/bin/env node

/**
 * Remove all HR / employee records (employees, attendance, payroll, advances).
 *
 * Usage:
 *   node scripts/clear-employee-data.js --check   # counts only
 *   node scripts/clear-employee-data.js --force   # delete all employee data
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

async function countRows() {
  return {
    employees: await prisma.employee.count(),
    attendance: await prisma.attendance.count(),
    payrolls: await prisma.payroll.count(),
    advances: await prisma.employeeAdvance.count(),
  };
}

async function main() {
  console.log('\nClear employee data\n');

  const before = await countRows();
  console.log('Current row counts:');
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k}: ${v}`);
  }

  const total = Object.values(before).reduce((s, n) => s + n, 0);
  if (total === 0) {
    console.log('\nNothing to delete — employee tables are already empty.\n');
    return;
  }

  if (checkOnly) {
    console.log('\nRun with --force to delete all employee data.\n');
    return;
  }

  if (!force) {
    console.log('\nThis permanently deletes ALL employees, attendance, payroll, and advances.');
    console.log('Run: node scripts/clear-employee-data.js --force\n');
    return;
  }

  await prisma.$executeRawUnsafe('DELETE FROM employee_advances');
  await prisma.$executeRawUnsafe('DELETE FROM payrolls');
  await prisma.$executeRawUnsafe('DELETE FROM attendance');
  await prisma.$executeRawUnsafe('DELETE FROM employees');

  const after = await countRows();
  console.log('\nAfter delete:');
  for (const [k, v] of Object.entries(after)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\nEmployee data cleared. You can add new employees now.\n');
}

main()
  .catch((e) => {
    console.error('Failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
