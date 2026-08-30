#!/usr/bin/env node

/**
 * SIMPLE & DIRECT: Labour Charges Verification
 * Tests the exact workflow users experience
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n' + '='.repeat(70));
  console.log('✅ LABOUR CHARGES - SIMPLE VERIFICATION TEST');
  console.log('='.repeat(70) + '\n');

  try {
    // Get test data
    const customer = await prisma.customer.findFirst();
    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();

    if (!customer || !store || !product) {
      console.log('❌ Missing test data\n');
      await prisma.$disconnect();
      return;
    }

    console.log('📌 TEST SETUP:');
    console.log(`   Customer: ${customer.cus_name} (ID: ${customer.cus_id})`);
    console.log(`   Store: ${store.store_name} (ID: ${store.storeid})`);
    console.log(`   Product: ${product.pro_title} (ID: ${product.pro_id})\n`);

    // ════════════════════════════════════════════════════════════════════
    // TEST: Create Order with Labour Charges
    // ════════════════════════════════════════════════════════════════════

    console.log('─'.repeat(70));
    console.log('🧪 TEST: Creating order with labour_charges = 3000');
    console.log('─'.repeat(70) + '\n');

    const payload = {
      cus_id: customer.cus_id,
      store_id: store.storeid,
      total_amount: 10000,
      discount: 1000,
      payment: 5000,
      payment_type: 'CASH',
      cash_payment: 5000,
      bank_payment: 0,
      advance_payment: 0,
      labour_charges: 3000,  // ← TEST VALUE
      shipping_amount: 2000,
      bill_type: 'ORDER',
      reference: `TEST-${Date.now()}`,
      sale_details: [
        {
          pro_id: product.pro_id,
          qnty: 100,
          unit: product.pro_unit || 'PCS',
          unit_rate: 75,
          total_amount: 7500,
          discount: 0,
          cus_id: customer.cus_id
        }
      ],
      split_payments: [],
      updated_by: 1
    };

    console.log('Step 1️⃣  Sending to API: labour_charges = 3000');
    
    const response = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ API Error: ${error.error}\n`);
      await prisma.$disconnect();
      return;
    }

    const result = await response.json();
    const saleId = result.sale_id;
    console.log(`✅ Created: Sale ID = ${saleId}\n`);

    // ════════════════════════════════════════════════════════════════════
    // TEST: Check Database
    // ════════════════════════════════════════════════════════════════════

    console.log('Step 2️⃣  Checking database saved value...');
    
    await new Promise(r => setTimeout(r, 200));
    
    const sale = await prisma.sale.findUnique({
      where: { sale_id: saleId }
    });

    const savedLabour = parseFloat(sale.labour_charges);
    
    if (savedLabour === 3000) {
      console.log(`✅ Database CORRECT: labour_charges = ${savedLabour}\n`);
    } else {
      console.log(`❌ Database WRONG: labour_charges = ${savedLabour} (expected 3000)\n`);
      await prisma.$disconnect();
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // TEST: List All Orders with Labour
    // ════════════════════════════════════════════════════════════════════

    console.log('─'.repeat(70));
    console.log('📊 ORDERS WITH LABOUR CHARGES (Last 5):');
    console.log('─'.repeat(70) + '\n');

    const orders = await prisma.sale.findMany({
      take: 5,
      orderBy: { sale_id: 'desc' },
      select: {
        sale_id: true,
        total_amount: true,
        labour_charges: true,
        payment: true
      }
    });

    let successCount = 0;
    
    orders.forEach(order => {
      const labour = parseFloat(order.labour_charges);
      const status = labour > 0 ? '✅' : '❌';
      console.log(`${status} Sale ${order.sale_id}: Labour=${labour}, Total=${order.total_amount}, Paid=${order.payment}`);
      if (labour > 0) successCount++;
    });

    console.log(`\n✅ SUMMARY: ${successCount}/${orders.length} orders have labour charges\n`);

    // ════════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(70));
    console.log('🎉 TEST RESULTS');
    console.log('═'.repeat(70) + '\n');

    console.log('✅ PASS: Order created with labour_charges = 3000');
    console.log('✅ PASS: Database saved labour_charges correctly');
    console.log('✅ PASS: API is working correctly');
    console.log(`✅ PASS: Current Sale ID ${saleId} has labour = 3000\n`);

    console.log('─'.repeat(70));
    console.log('🔍 NEXT STEP - VERIFY IN BROWSER:');
    console.log('─'.repeat(70) + '\n');

    console.log(`1. Go to Sales page`);
    console.log(`2. Search for or load Sale ID: ${saleId}`);
    console.log(`3. Check Labour Charges field shows: 3000`);
    console.log(`\nIf it shows 0, the issue is browser caching.`);
    console.log(`Solution: Restart server (Ctrl+C, npm run dev) + Hard refresh (Ctrl+Shift+R)\n`);

    console.log('═'.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  }

  await prisma.$disconnect();
  process.exit(0);
})();
