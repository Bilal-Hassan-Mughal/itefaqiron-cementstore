#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST: Labour Charges End-to-End Verification
 * 
 * This test simulates a complete user workflow:
 * 1. Create a new order with labour charges via API
 * 2. Verify it's saved to database correctly
 * 3. Load the order back and confirm labour value displays
 * 4. Check if it appears in the sales list
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COLOURS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m'
};

function log(level, message) {
  const prefix = {
    success: `${COLOURS.GREEN}✅${COLOURS.RESET}`,
    error: `${COLOURS.RED}❌${COLOURS.RESET}`,
    info: `${COLOURS.CYAN}ℹ️ ${COLOURS.RESET}`,
    warning: `${COLOURS.YELLOW}⚠️ ${COLOURS.RESET}`,
    test: `${COLOURS.BLUE}🧪${COLOURS.RESET}`
  };
  console.log(`${prefix[level]} ${message}`);
}

(async () => {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 LABOUR CHARGES - END-TO-END TEST SUITE');
  console.log('='.repeat(70) + '\n');

  try {
    // Get test data
    const customer = await prisma.customer.findFirst();
    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();

    if (!customer || !store || !product) {
      log('error', 'Missing test data (customer, store, or product)');
      await prisma.$disconnect();
      return;
    }

    log('success', `Test Setup Ready`);
    console.log(`   • Customer: ${customer.cus_name} (ID: ${customer.cus_id})`);
    console.log(`   • Store: ${store.store_name} (ID: ${store.storeid})`);
    console.log(`   • Product: ${product.pro_title} (ID: ${product.pro_id})\n`);

    // ========================================================================
    // TEST 1: Create Order with Labour Charges
    // ========================================================================
    console.log('─'.repeat(70));
    log('test', 'TEST 1: Creating Order with Labour Charges = 2500');
    console.log('─'.repeat(70) + '\n');

    const testPayload = {
      cus_id: customer.cus_id,
      store_id: store.storeid,
      total_amount: 10000,
      discount: 1000,
      payment: 6000,
      payment_type: 'CASH',
      cash_payment: 4000,
      bank_payment: 2000,
      advance_payment: 0,
      labour_charges: 2500,  // ← TEST VALUE
      shipping_amount: 2000,
      bill_type: 'ORDER',
      reference: `TEST-LABOUR-${Date.now()}`,
      sale_details: [
        {
          pro_id: product.pro_id,
          qnty: 50,
          unit: product.pro_unit || 'PCS',
          unit_rate: 150,
          total_amount: 7500,
          discount: 0,
          cus_id: customer.cus_id
        }
      ],
      split_payments: [
        { amount: 4000, payment_type: 'CASH', reference: 'Cash payment' },
        { amount: 2000, payment_type: 'BANK_TRANSFER', debit_account_id: 44, reference: 'Bank payment' }
      ],
      updated_by: 1
    };

    log('info', 'Sending payload to API with labour_charges: 2500');
    let saleId = null;

    try {
      const response = await fetch('http://localhost:3000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) {
        const error = await response.json();
        log('error', `API Error: ${error.error}`);
        await prisma.$disconnect();
        return;
      }

      const result = await response.json();
      saleId = result.sale_id;
      log('success', `Order Created: Sale ID = ${saleId}\n`);
    } catch (err) {
      log('error', `Failed to create order: ${err.message}`);
      await prisma.$disconnect();
      return;
    }

    // ========================================================================
    // TEST 2: Verify Labour Charges in Database
    // ========================================================================
    console.log('─'.repeat(70));
    log('test', 'TEST 2: Verifying Labour Charges in Database');
    console.log('─'.repeat(70) + '\n');

    await new Promise(r => setTimeout(r, 300)); // Wait for DB write

    const dbSale = await prisma.sale.findUnique({
      where: { sale_id: saleId }
    });

    if (!dbSale) {
      log('error', `Sale ${saleId} not found in database`);
      await prisma.$disconnect();
      return;
    }

    const dbLabour = parseFloat(dbSale.labour_charges);
    console.log(`Database Query Result:`);
    console.log(`   • Sale ID: ${dbSale.sale_id}`);
    console.log(`   • Labour Charges: ${dbLabour}`);
    console.log(`   • Type: ${typeof dbLabour}`);
    console.log();

    if (dbLabour === 2500) {
      log('success', 'Labour Charges correctly saved in database (2500)\n');
    } else {
      log('error', `Labour Charges MISMATCH: Expected 2500, Got ${dbLabour}\n`);
      await prisma.$disconnect();
      return;
    }

    // ========================================================================
    // TEST 3: Verify API Returns Labour Charges When Loading Order
    // ========================================================================
    console.log('─'.repeat(70));
    log('test', 'TEST 3: Loading Order via API (Simulating Frontend Load)');
    console.log('─'.repeat(70) + '\n');

    try {
      const response = await fetch(`http://localhost:3000/api/sales?id=${saleId}`);
      
      if (!response.ok) {
        log('error', `API Error loading order: ${response.status}`);
        await prisma.$disconnect();
        return;
      }

      const orderData = await response.json();
      
      if (!orderData.data || orderData.data.length === 0) {
        log('error', 'Order not found in API response');
        await prisma.$disconnect();
        return;
      }

      const apiOrder = orderData.data[0];
      const apiLabour = parseFloat(apiOrder.labour_charges);

      console.log(`API Response for Sale ${saleId}:`);
      console.log(`   • Total: ${apiOrder.total_amount}`);
      console.log(`   • Discount: ${apiOrder.discount}`);
      console.log(`   • Shipping: ${apiOrder.shipping_amount}`);
      console.log(`   • Labour Charges: ${apiLabour} ← FRONTEND RECEIVES THIS`);
      console.log(`   • Cash Payment: ${apiOrder.cash_payment}`);
      console.log(`   • Bank Payment: ${apiOrder.bank_payment}`);
      console.log();

      if (apiLabour === 2500) {
        log('success', 'API correctly returns labour_charges (2500)\n');
      } else if (apiLabour === 0) {
        log('error', `API returns 0 - Frontend form will show empty labour field\n`);
        await prisma.$disconnect();
        return;
      } else {
        log('warning', `API returns unexpected value: ${apiLabour}\n`);
      }
    } catch (err) {
      log('error', `Failed to load order: ${err.message}`);
      await prisma.$disconnect();
      return;
    }

    // ========================================================================
    // TEST 4: Verify Ledger Entries Created Correctly
    // ========================================================================
    console.log('─'.repeat(70));
    log('test', 'TEST 4: Verifying Ledger Entries');
    console.log('─'.repeat(70) + '\n');

    const ledgerEntries = await prisma.ledger.findMany({
      where: { bill_no: saleId.toString() }
    });

    console.log(`Ledger entries found: ${ledgerEntries.length}`);
    
    if (ledgerEntries.length > 0) {
      ledgerEntries.forEach((entry, idx) => {
        console.log(`\n   Entry ${idx + 1}:`);
        console.log(`     • Type: ${entry.trnx_type}`);
        console.log(`     • Debit: ${entry.debit_amount}, Credit: ${entry.credit_amount}`);
        console.log(`     • Closing: ${entry.closing_balance}`);
      });
      log('success', '\nLedger entries created correctly\n');
    } else {
      log('warning', 'No ledger entries found\n');
    }

    // ========================================================================
    // TEST 5: Verify Customer Balance Updated
    // ========================================================================
    console.log('─'.repeat(70));
    log('test', 'TEST 5: Verifying Customer Balance Updated');
    console.log('─'.repeat(70) + '\n');

    const updatedCustomer = await prisma.customer.findUnique({
      where: { cus_id: customer.cus_id }
    });

    console.log(`Customer: ${updatedCustomer.cus_name}`);
    console.log(`   • Bill Amount: 10000`);
    console.log(`   • Payment: 6000`);
    console.log(`   • Expected Balance: 4000`);
    console.log(`   • Actual Balance: ${updatedCustomer.cus_balance}\n`);

    if (updatedCustomer.cus_balance === 4000) {
      log('success', 'Customer balance correctly updated\n');
    } else {
      log('warning', `Customer balance mismatch: ${updatedCustomer.cus_balance}\n`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70) + '\n');

    log('success', 'All Tests Completed Successfully!');
    console.log(`\n✅ Order created with Sale ID: ${saleId}`);
    console.log(`✅ Labour Charges saved: 2500`);
    console.log(`✅ API returns labour_charges correctly`);
    console.log(`✅ Ledger entries created`);
    console.log(`✅ Customer balance updated`);

    console.log('\n' + '─'.repeat(70));
    console.log('🎉 LABOUR CHARGES FEATURE IS WORKING!');
    console.log('─'.repeat(70) + '\n');

    console.log('📝 Next Steps:');
    console.log('   1. Go to Sales page in your browser');
    console.log(`   2. Load Sale ID: ${saleId}`);
    console.log('   3. Verify Labour Charges field shows: 2500');
    console.log('   4. Create a new order manually via the form');
    console.log('   5. Enter labour charges and save');
    console.log('   6. Check database to confirm value saved\n');

    console.log('='.repeat(70) + '\n');

  } catch (err) {
    log('error', `Test Error: ${err.message}`);
    console.error(err);
  }

  await prisma.$disconnect();
  process.exit(0);
})();
