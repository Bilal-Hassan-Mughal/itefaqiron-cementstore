#!/usr/bin/env node

/**
 * FOCUSED TEST: Labour Charges 500
 * Simple step-by-step verification
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 FOCUSED TEST: Labour Charges = 500');
  console.log('═'.repeat(80) + '\n');

  try {
    const customer = await prisma.customer.findFirst();
    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();

    if (!customer || !store || !product) {
      console.log('❌ Missing test data\n');
      await prisma.$disconnect();
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 1: CREATE
    // ════════════════════════════════════════════════════════════════════
    console.log('STEP 1️⃣  CREATE ORDER\n');

    const payload = {
      cus_id: customer.cus_id,
      store_id: store.storeid,
      total_amount: 12000,
      discount: 1000,
      payment: 6000,
      payment_type: 'CASH',
      cash_payment: 6000,
      bank_payment: 0,
      advance_payment: 0,
      labour_charges: 500,  
      shipping_amount: 2000,
      bill_type: 'ORDER',
      reference: `FOCUSED-${Date.now()}`,
      sale_details: [{
        pro_id: product.pro_id,
        qnty: 100,
        unit: product.pro_unit || 'PCS',
        unit_rate: 100,
        total_amount: 10000,
        discount: 0,
        cus_id: customer.cus_id
      }],
      split_payments: [],
      updated_by: 1
    };

    console.log('Creating order with labour_charges = 500...');
    
    const createResp = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!createResp.ok) {
      console.log(`❌ Creation failed: ${createResp.status}`);
      const err = await createResp.json();
      console.log(err.error);
      await prisma.$disconnect();
      return;
    }

    const { sale_id } = await createResp.json();
    console.log(`✅ Created: Sale ID = ${sale_id}\n`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 2: CHECK DATABASE
    // ════════════════════════════════════════════════════════════════════
    console.log('STEP 2️⃣  CHECK DATABASE\n');

    await new Promise(r => setTimeout(r, 400));

    const sale = await prisma.sale.findUnique({
      where: { sale_id }
    });

    const dbLabour = parseFloat(sale.labour_charges);

    console.log(`Sale ID: ${sale.sale_id}`);
    console.log(`Total: ${sale.total_amount}`);
    console.log(`Discount: ${sale.discount}`);
    console.log(`Shipping: ${sale.shipping_amount}`);
    console.log(`Labour Charges: ${dbLabour}`);
    console.log(`Payment: ${sale.payment}\n`);

    if (dbLabour === 500) {
      console.log(`✅ Database CORRECT: labour_charges = 500\n`);
    } else {
      console.log(`❌ Database WRONG: labour_charges = ${dbLabour}\n`);
      await prisma.$disconnect();
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 3: CHECK API RESPONSE
    // ════════════════════════════════════════════════════════════════════
    console.log('STEP 3️⃣  LOAD FROM API\n');

    const loadResp = await fetch(`http://localhost:3000/api/sales?id=${sale_id}`, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!loadResp.ok) {
      console.log(`❌ API failed: ${loadResp.status}\n`);
      await prisma.$disconnect();
      return;
    }

    const loadData = await loadResp.json();
    console.log('API Response:');
    console.log(JSON.stringify(loadData, null, 2));
    console.log();

    // ════════════════════════════════════════════════════════════════════
    // STEP 4: SUMMARY
    // ════════════════════════════════════════════════════════════════════
    console.log('═'.repeat(80));
    console.log('SUMMARY\n');

    let apiLabour = 0;
    
    // Handle different response formats
    if (loadData.data && Array.isArray(loadData.data) && loadData.data.length > 0) {
      apiLabour = parseFloat(loadData.data[0].labour_charges);
      console.log(`API returned labour_charges: ${apiLabour}`);
    } else if (loadData.labour_charges !== undefined) {
      apiLabour = parseFloat(loadData.labour_charges);
      console.log(`API returned labour_charges: ${apiLabour}`);
    } else {
      console.log(`API response format different, checking all fields...`);
      console.log(JSON.stringify(loadData, null, 2));
    }

    console.log(`\n✅ WORKFLOW COMPLETE\n`);
    console.log(`Sale ID: ${sale_id}`);
    console.log(`Sent to API: 500`);
    console.log(`Database Saved: ${dbLabour}`);
    console.log(`API Returns: ${apiLabour}`);
    console.log(`\nBrowser will display Labour Charges = ${apiLabour}\n`);

    if (apiLabour === 500) {
      console.log('🎉 SUCCESS! Labour Charges working correctly!');
    } else if (apiLabour === 0) {
      console.log('⚠️  Labour shows as 0 - browser may show empty field');
      console.log('   Solution: Restart server + Hard refresh');
    }

    console.log('\n═'.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  await prisma.$disconnect();
})();
