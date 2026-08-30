#!/usr/bin/env node

/**
 * check-deleted-bills.js
 * -------------------------------------------------------------
 * Test script to detect and report:
 * 1. Total `sale_id` gaps (both from ID 1 to Max ID, and within active range)
 * 2. Deleted bill numbers per bill type (BILL, ORDER, DISPATCHED, QUOTATION)
 * 3. Soft-deleted / trashed orders (ORDER_TRASH)
 * 4. Orphaned ledger entries belonging to deleted bills
 * 
 * Usage:
 *   node scripts/check-deleted-bills.js
 *   node scripts/check-deleted-bills.js --json
 *   node scripts/check-deleted-bills.js --export
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const isJsonOutput = args.includes('--json');
const isExportReport = args.includes('--export');

function formatRanges(numbers) {
  if (!numbers || numbers.length === 0) return 'None';
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = start;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = start;
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

async function checkDeletedBills() {
  const sales = await prisma.sale.findMany({
    select: {
      sale_id: true,
      bill_number: true,
      bill_type: true,
      total_amount: true,
      payment: true,
      created_at: true,
      cus_id: true,
      customer: {
        select: {
          cus_name: true,
          cus_phone_no: true
        }
      }
    },
    orderBy: { sale_id: 'asc' }
  });

  const resultData = {
    summary: {
      totalExistingSales: sales.length,
      totalSaleIdGapsFrom1: 0,
      totalSaleIdGapsWithinRange: 0,
      trashedOrdersCount: 0,
      orphanedLedgerCount: 0
    },
    saleIdGapsFrom1: [],
    saleIdGapsFrom1Ranges: '',
    saleIdGapsWithinRange: [],
    saleIdGapsWithinRangeRanges: '',
    deletedBillNumbersByType: {},
    trashedOrders: [],
    orphanedLedgerEntries: []
  };

  if (sales.length > 0) {
    const existingSaleIds = new Set(sales.map(s => s.sale_id));
    const minSaleId = Math.min(...existingSaleIds);
    const maxSaleId = Math.max(...existingSaleIds);

    // 1. Gaps starting from ID 1 to Max sale_id
    const gapsFrom1 = [];
    for (let id = 1; id <= maxSaleId; id++) {
      if (!existingSaleIds.has(id)) {
        gapsFrom1.push(id);
      }
    }

    // 2. Gaps within current Min to Max sale_id range
    const gapsWithinRange = [];
    for (let id = minSaleId; id <= maxSaleId; id++) {
      if (!existingSaleIds.has(id)) {
        gapsWithinRange.push(id);
      }
    }

    resultData.summary.totalSaleIdGapsFrom1 = gapsFrom1.length;
    resultData.summary.totalSaleIdGapsWithinRange = gapsWithinRange.length;

    resultData.saleIdGapsFrom1 = gapsFrom1;
    resultData.saleIdGapsFrom1Ranges = formatRanges(gapsFrom1);

    resultData.saleIdGapsWithinRange = gapsWithinRange;
    resultData.saleIdGapsWithinRangeRanges = formatRanges(gapsWithinRange);

    resultData.saleIdRange = { min: minSaleId, max: maxSaleId };

    // B. Bill number gaps per type
    const billTypes = ['BILL', 'ORDER', 'QUOTATION', 'DISPATCHED'];
    for (const bType of billTypes) {
      const typeSales = sales.filter(s => s.bill_type === bType && s.bill_number !== null && s.bill_number !== undefined);
      if (typeSales.length === 0) continue;

      const existingBillNos = new Set(typeSales.map(s => s.bill_number));
      const minBillNo = Math.min(...existingBillNos);
      const maxBillNo = Math.max(...existingBillNos);

      const deletedBillNos = [];
      for (let num = minBillNo; num <= maxBillNo; num++) {
        if (!existingBillNos.has(num)) {
          deletedBillNos.push(num);
        }
      }

      resultData.deletedBillNumbersByType[bType] = {
        existingCount: typeSales.length,
        minBillNo,
        maxBillNo,
        deletedCount: deletedBillNos.length,
        deletedBillNos,
        deletedBillNosRanges: formatRanges(deletedBillNos)
      };
    }

    // C. Trashed orders
    const trashedSales = sales.filter(s => s.bill_type === 'ORDER_TRASH');
    resultData.summary.trashedOrdersCount = trashedSales.length;
    resultData.trashedOrders = trashedSales.map(t => ({
      sale_id: t.sale_id,
      bill_number: t.bill_number,
      customer_id: t.cus_id,
      customer_name: t.customer?.cus_name || 'N/A',
      customer_phone: t.customer?.cus_phone_no || 'N/A',
      total_amount: Number(t.total_amount),
      created_at: t.created_at
    }));
  }

  // D. Orphaned Ledgers
  const existingSaleIdStrings = new Set(sales.map(s => String(s.sale_id)));
  const ledgerEntries = await prisma.ledger.findMany({
    where: {
      bill_no: { not: null },
      trnx_type: 'SALE'
    },
    select: {
      l_id: true,
      cus_id: true,
      bill_no: true,
      trnx_type: true,
      debit_amount: true,
      credit_amount: true,
      details: true,
      created_at: true,
      customer: { select: { cus_name: true } }
    }
  });

  const orphanedLedgers = ledgerEntries.filter(l => {
    const num = parseInt(l.bill_no);
    if (!isNaN(num)) {
      return !existingSaleIdStrings.has(String(num));
    }
    return false;
  });

  resultData.summary.orphanedLedgerCount = orphanedLedgers.length;
  resultData.orphanedLedgerEntries = orphanedLedgers.map(l => ({
    ledger_id: l.l_id,
    deleted_bill_id: l.bill_no,
    customer_id: l.cus_id,
    customer_name: l.customer?.cus_name || 'N/A',
    trnx_type: l.trnx_type,
    debit_amount: l.debit_amount,
    credit_amount: l.credit_amount,
    details: l.details,
    created_at: l.created_at
  }));

  if (isJsonOutput) {
    console.log(JSON.stringify(resultData, null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log('================================================================');
  console.log('            DELETED BILLS & GAP DETECTION REPORT                ');
  console.log('================================================================\n');

  console.log(`📊 Active Sales & Orders in Database: ${resultData.summary.totalExistingSales}`);

  console.log('\n----------------------------------------------------------------');
  console.log('1. TOTAL `sale_id` GAPS ANALYSIS');
  console.log('----------------------------------------------------------------');
  if (resultData.saleIdRange) {
    console.log(`• ID Range in DB                 : Min ${resultData.saleIdRange.min} to Max ${resultData.saleIdRange.max}`);
  }
  console.log(`• Total Gaps from ID 1 to Max ID : ${resultData.summary.totalSaleIdGapsFrom1}`);
  console.log(`  └─ IDs Range (1 to Max ID)     : ${resultData.saleIdGapsFrom1Ranges}`);

  console.log(`\n• Total Gaps within DB Range (${resultData.saleIdRange.min}-${resultData.saleIdRange.max}): ${resultData.summary.totalSaleIdGapsWithinRange}`);
  console.log(`  └─ Gaps List                   : ${resultData.saleIdGapsWithinRange.length > 0 ? resultData.saleIdGapsWithinRange.join(', ') : 'None'}`);

  console.log('\n----------------------------------------------------------------');
  console.log('2. DELETED BILL NUMBERS (Sequence Gaps per Bill Type)');
  console.log('----------------------------------------------------------------');
  for (const [type, data] of Object.entries(resultData.deletedBillNumbersByType)) {
    console.log(`\n📌 Bill Type: ${type}`);
    console.log(`   • Existing Records : ${data.existingCount}`);
    console.log(`   • Bill # Range     : Min ${data.minBillNo} to Max ${data.maxBillNo}`);
    console.log(`   • Deleted Count    : ${data.deletedCount}`);
    console.log(`   • Deleted Numbers  : ${data.deletedBillNos.length > 0 ? data.deletedBillNos.join(', ') : 'None'}`);
    console.log(`   • Compact Ranges   : ${data.deletedBillNosRanges}`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('3. SOFT-DELETED / TRASHED ORDERS (ORDER_TRASH)');
  console.log('----------------------------------------------------------------');
  console.log(`• Total Trashed Orders: ${resultData.summary.trashedOrdersCount}`);
  if (resultData.trashedOrders.length > 0) {
    const trashedIds = resultData.trashedOrders.map(t => t.sale_id);
    console.log(`• Trashed Sale IDs    : ${trashedIds.join(', ')}`);
    console.log(`• Compact ID Ranges   : ${formatRanges(trashedIds)}`);
  }

  console.log('\n================================================================');
  console.log('                          SUMMARY                               ');
  console.log('================================================================');
  console.log(`• Total sale_id Gaps (from ID 1 to Max ID ${resultData.saleIdRange?.max}) : ${resultData.summary.totalSaleIdGapsFrom1}`);
  console.log(`• Total sale_id Gaps (inside range ${resultData.saleIdRange?.min}-${resultData.saleIdRange?.max})   : ${resultData.summary.totalSaleIdGapsWithinRange}`);
  console.log(`• Total Soft-Deleted / Trashed Orders                       : ${resultData.summary.trashedOrdersCount}`);
  console.log('================================================================\n');

  if (isExportReport) {
    const reportPath = path.join(process.cwd(), 'deleted_bills_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(resultData, null, 2), 'utf-8');
    console.log(`📁 Detailed report exported to: ${reportPath}\n`);
  }

  await prisma.$disconnect();
}

checkDeletedBills().catch(err => {
  console.error('❌ Error executing check-deleted-bills:', err);
  prisma.$disconnect();
  process.exit(1);
});
