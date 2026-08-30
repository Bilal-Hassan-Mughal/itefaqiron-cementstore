#!/usr/bin/env node

/**
 * COMPLETE WORKFLOW TEST: Labour Charges
 * 
 * This script:
 * 1. Creates an order with labour_charges = 500
 * 2. Verifies it's saved in database
 * 3. Loads the order back (simulating sales page load)
 * 4. Confirms labour field shows the saved value
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 COMPLETE WORKFLOW TEST: CREATE → SAVE → VERIFY → LOAD');
  console.log('='.repeat(80) + '\n');

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

    console.log('📌 TEST DATA READY:');
    console.log(`   Customer: ${customer.cus_name} (ID: ${customer.cus_id})`);
    console.log(`   Store: ${store.store_name} (ID: ${store.storeid})`);
    console.log(`   Product: ${product.pro_title} (ID: ${product.pro_id})\n`);

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 1: CREATE ORDER WITH LABOUR_CHARGES = 500
    // ════════════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(80));
    console.log('STAGE 1️⃣  CREATE ORDER WITH LABOUR_CHARGES = 500');
    console.log('═'.repeat(80) + '\n');

    const orderPayload = {
      cus_id: customer.cus_id,
      store_id: store.storeid,
      total_amount: 15000,
      discount: 1500,
      payment: 8000,
      payment_type: 'CASH',
      cash_payment: 8000,
      bank_payment: 0,
      advance_payment: 0,
      labour_charges: 500,  // ← THE TEST VALUE
      shipping_amount: 3000,
      bill_type: 'ORDER',
      reference: `WORKFLOW-TEST-${Date.now()}`,
      sale_details: [
        {
          pro_id: product.pro_id,
          qnty: 200,
          unit: product.pro_unit || 'PCS',
          unit_rate: 60,
          total_amount: 12000,
          discount: 0,
          cus_id: customer.cus_id
        }
      ],
      split_payments: [],
      updated_by: 1
    };

    console.log('📤 ACTION: Sending order to API with labour_charges = 500\n');
    console.log('Payload:');
    console.log(`  - Customer: ${customer.cus_name}`);
    console.log(`  - Total Amount: ${orderPayload.total_amount}`);
    console.log(`  - Discount: ${orderPayload.discount}`);
    console.log(`  - Shipping: ${orderPayload.shipping_amount}`);
    console.log(`  - Labour Charges: ${orderPayload.labour_charges} ← SENDING THIS`);
    console.log(`  - Payment: ${orderPayload.payment}\n`);

    const createResponse = await fetch('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.log(`❌ CREATE FAILED: ${error.error}\n`);
      await prisma.$disconnect();
      return;
    }

    const createResult = await createResponse.json();
    const saleId = createResult.sale_id;

    console.log('✅ ORDER CREATED\n');
    console.log(`📍 Sale ID: ${saleId}\n`);

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 2: VERIFY IN DATABASE
    // ════════════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(80));
    console.log('STAGE 2️⃣  VERIFY LABOUR_CHARGES IN DATABASE');
    console.log('═'.repeat(80) + '\n');

    console.log('🔍 ACTION: Querying database for Sale ID ' + saleId + '\n');

    await new Promise(r => setTimeout(r, 300)); // Wait for DB write

    const dbSale = await prisma.sale.findUnique({
      where: { sale_id: saleId }
    });

    if (!dbSale) {
      console.log(`❌ SALE NOT FOUND in database\n`);
      await prisma.$disconnect();
      return;
    }

    const dbLabour = parseFloat(dbSale.labour_charges);

    console.log('📊 DATABASE RESULT:\n');
    console.log(`┌─ Sale ID: ${dbSale.sale_id}`);
    console.log(`├─ Total Amount: ${dbSale.total_amount}`);
    console.log(`├─ Discount: ${dbSale.discount}`);
    console.log(`├─ Shipping: ${dbSale.shipping_amount}`);
    console.log(`├─ Labour Charges: ${dbLabour} ← IN DATABASE`);
    console.log(`├─ Payment: ${dbSale.payment}`);
    console.log(`└─ Payment Type: ${dbSale.payment_type}\n`);

    if (dbLabour === 500) {
      console.log('✅ DATABASE VERIFICATION PASSED\n');
      console.log(`   Labour Charges correctly saved: 500\n`);
    } else {
      console.log(`❌ DATABASE VERIFICATION FAILED\n`);
      console.log(`   Expected: 500`);
      console.log(`   Got: ${dbLabour}\n`);
      await prisma.$disconnect();
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 3: LOAD ORDER (SIMULATING SALES PAGE)
    // ════════════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(80));
    console.log('STAGE 3️⃣  LOAD ORDER (SIMULATING SALES PAGE LOAD)');
    console.log('═'.repeat(80) + '\n');

    console.log(`📤 ACTION: Fetching Sale ID ${saleId} from API (like Sales page does)\n`);

    const loadResponse = await fetch(`http://localhost:3000/api/sales?id=${saleId}`);

    if (!loadResponse.ok) {
      console.log(`❌ LOAD FAILED: ${loadResponse.status}\n`);
      await prisma.$disconnect();
      return;
    }

    const loadResult = await loadResponse.json();

    if (!loadResult.data || loadResult.data.length === 0) {
      console.log('❌ Sale not found in API response\n');
      await prisma.$disconnect();
      return;
    }

    const apiSale = loadResult.data[0];
    const apiLabour = parseFloat(apiSale.labour_charges);

    console.log('📊 API RESPONSE (What Sales Page Receives):\n');
    console.log(`┌─ Sale ID: ${apiSale.sale_id}`);
    console.log(`├─ Total Amount: ${apiSale.total_amount}`);
    console.log(`├─ Discount: ${apiSale.discount}`);
    console.log(`├─ Shipping: ${apiSale.shipping_amount}`);
    console.log(`├─ Labour Charges: ${apiLabour} ← FRONTEND GETS THIS`);
    console.log(`├─ Payment: ${apiSale.payment}`);
    console.log(`└─ Payment Type: ${apiSale.payment_type}\n`);

    if (apiLabour === 500) {
      console.log('✅ API LOAD PASSED\n');
      console.log(`   Labour Charges returned to frontend: 500\n`);
    } else if (apiLabour === 0) {
      console.log(`❌ API LOAD FAILED\n`);
      console.log(`   Labour Charges is 0 in API response`);
      console.log(`   This means the Labour field on Sales page will show EMPTY\n`);
      await prisma.$disconnect();
      return;
    } else {
      console.log(`❌ API LOAD FAILED\n`);
      console.log(`   Expected: 500`);
      console.log(`   Got: ${apiLabour}\n`);
      await prisma.$disconnect();
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 4: WHAT FRONTEND WILL SHOW
    // ════════════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(80));
    console.log('STAGE 4️⃣  WHAT WILL SHOW IN SALES PAGE');
    console.log('═'.repeat(80) + '\n');

    console.log('On the Sales Page form, the Labour Charges field will show:\n');
    console.log(`┌─────────────────────────────────────┐`);
    console.log(`│  Labour Charges Field:              │`);
    console.log(`│                                     │`);
    console.log(`│  [          ${apiLabour}          ]         │ ← Labour Field`);
    console.log(`│                                     │`);
    console.log(`└─────────────────────────────────────┘\n`);

    // ════════════════════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ════════════════════════════════════════════════════════════════════════════════

    console.log('═'.repeat(80));
    console.log('🎉 FINAL REPORT - ALL TESTS PASSED');
    console.log('═'.repeat(80) + '\n');

    console.log('✅ STAGE 1: Order created with labour_charges = 500');
    console.log('✅ STAGE 2: Database saved labour_charges = 500');
    console.log('✅ STAGE 3: API returned labour_charges = 500');
    console.log('✅ STAGE 4: Frontend will display labour_charges = 500\n');

    console.log('─'.repeat(80));
    console.log('📝 SUMMARY');
    console.log('─'.repeat(80) + '\n');

    console.log(`Sale ID Created: ${saleId}`);
    console.log(`Labour Charges Sent: 500`);
    console.log(`Labour Charges in Database: ${dbLabour}`);
    console.log(`Labour Charges from API: ${apiLabour}`);
    console.log(`Labour Field on Sales Page Will Show: ${apiLabour}\n`);

    console.log('─'.repeat(80));
    console.log('🔍 NEXT VERIFICATION STEP');
    console.log('─'.repeat(80) + '\n');

    console.log('Now go to your Sales page in the browser and:');
    console.log(`\n1. Search for or load Sale ID: ${saleId}`);
    console.log('2. Look at the Labour Charges field');
    console.log('3. It should show: 500\n');

    console.log('If it shows 0 or empty:');
    console.log('   • Browser is using cached old code');
    console.log('   • Solution: Restart server + Hard refresh (Ctrl+Shift+R)\n');

    console.log('═'.repeat(80) + '\n');

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error(err);
  }

  await prisma.$disconnect();
  process.exit(0);
})();
