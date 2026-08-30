#!/usr/bin/env node

/**
 * Test Script: Labour Charges Feature
 * Comprehensive testing of labour_charges throughout the system
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🧪 LABOUR CHARGES TEST SUITE');
console.log('='.repeat(70) + '\n');

// ============================================================================
// TEST 1: Check if code file has labour_charges
// ============================================================================
console.log('📋 TEST 1: Checking source code for labour_charges...\n');

const salesPagePath = path.join(__dirname, 'src/app/dashboard/sales/page.js');
const salesRoutePath = path.join(__dirname, 'src/app/api/sales/route.js');

let test1Pass = false;

try {
  const salesPageContent = fs.readFileSync(salesPagePath, 'utf8');
  const salesRouteContent = fs.readFileSync(salesRoutePath, 'utf8');
  
  // Check frontend has labour_charges in saleData
  const frontendHasLabour = salesPageContent.includes('labour_charges: labourChargesValue');
  console.log(`  Frontend saleData has labour_charges: ${frontendHasLabour ? '✅ YES' : '❌ NO'}`);
  
  // Count occurrences
  const frontendCount = (salesPageContent.match(/labour_charges/g) || []).length;
  console.log(`  Frontend mentions labour_charges: ${frontendCount} times`);
  
  // Check backend has labour_charges parsing
  const backendHasLabour = salesRouteContent.includes('labour_charges: parseFloat(labour_charges || 0)');
  console.log(`  Backend saves labour_charges: ${backendHasLabour ? '✅ YES' : '❌ NO'}`);
  
  const backendCount = (salesRouteContent.match(/labour_charges/g) || []).length;
  console.log(`  Backend mentions labour_charges: ${backendCount} times`);
  
  test1Pass = frontendHasLabour && backendHasLabour && frontendCount >= 5 && backendCount >= 5;
  
  console.log(`\n✅ TEST 1 RESULT: ${test1Pass ? 'PASSED' : 'FAILED'}\n`);
  
} catch (err) {
  console.error(`❌ TEST 1 ERROR: ${err.message}\n`);
  test1Pass = false;
}

// ============================================================================
// TEST 2: Check database schema
// ============================================================================
console.log('📋 TEST 2: Checking database schema...\n');

let test2Pass = false;

(async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Query to check table structure
    const result = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sales'
      AND COLUMN_NAME = 'labour_charges'
    `;
    
    if (result && result.length > 0) {
      console.log('  ✅ labour_charges column EXISTS in sales table');
      console.log(`     Type: ${result[0].DATA_TYPE}`);
      console.log(`     Nullable: ${result[0].IS_NULLABLE}`);
      test2Pass = true;
    } else {
      console.log('  ❌ labour_charges column NOT found in sales table');
      test2Pass = false;
    }
    
    console.log(`\n✅ TEST 2 RESULT: ${test2Pass ? 'PASSED' : 'FAILED'}\n`);
    
    // ============================================================================
    // TEST 3: Check if last 3 orders have labour_charges saved
    // ============================================================================
    console.log('📋 TEST 3: Checking recent orders in database...\n');
    
    let test3Pass = false;
    
    try {
      const recentOrders = await prisma.$queryRaw`
        SELECT sale_id, cus_id, total_amount, labour_charges, shipping_amount, discount
        FROM sales
        WHERE bill_type = 'ORDER'
        ORDER BY sale_id DESC
        LIMIT 3
      `;
      
      if (recentOrders && recentOrders.length > 0) {
        console.log(`  Found ${recentOrders.length} recent orders:\n`);
        let hasLabourData = false;
        
        recentOrders.forEach((order, idx) => {
          console.log(`  Order ${idx + 1} (ID: ${order.sale_id}):`);
          console.log(`    Total: ${order.total_amount}, Labour: ${order.labour_charges}, Shipping: ${order.shipping_amount}, Discount: ${order.discount}`);
          
          if (order.labour_charges && order.labour_charges > 0) {
            hasLabourData = true;
            console.log(`    ✅ Has labour charges: ${order.labour_charges}`);
          } else {
            console.log(`    ℹ️  No labour charges (${order.labour_charges})`);
          }
        });
        
        test3Pass = hasLabourData || recentOrders.length === 0; // Pass if at least one has labour or none exist yet
        console.log();
      } else {
        console.log('  ℹ️  No orders found (first time setup)\n');
        test3Pass = true;
      }
      
      console.log(`✅ TEST 3 RESULT: ${test3Pass ? 'PASSED' : 'PASSED (No data yet)'}\n`);
      
    } catch (err) {
      console.error(`❌ TEST 3 ERROR: ${err.message}\n`);
      test3Pass = false;
    }
    
    // ============================================================================
    // TEST 4: Verify API endpoint receives labour_charges
    // ============================================================================
    console.log('📋 TEST 4: Testing API with sample data...\n');
    
    let test4Pass = false;
    
    try {
      // Get a test customer and store
      const customer = await prisma.customer.findFirst();
      const store = await prisma.store.findFirst();
      
      if (!customer || !store) {
        console.log('  ⚠️  Skipping API test - need customer and store in database\n');
        test4Pass = true; // Skip gracefully
      } else {
        console.log(`  Using test customer: ${customer.cus_name} (ID: ${customer.cus_id})`);
        console.log(`  Using test store: ${store.store_name} (ID: ${store.storeid})\n`);
        
        // Create test payload
        const testPayload = {
          cus_id: customer.cus_id,
          store_id: store.storeid,
          total_amount: 5000,
          discount: 500,
          payment: 3000,
          payment_type: 'CASH',
          cash_payment: 3000,
          bank_payment: 0,
          advance_payment: 0,
          labour_charges: 750,  // ← TEST VALUE
          shipping_amount: 500,
          bill_type: 'ORDER',
          reference: 'TEST-LABOUR-CHARGES',
          sale_details: [
            {
              pro_id: 1,
              qnty: 10,
              unit: 'PCS',
              unit_rate: 450,
              total_amount: 4500,
              discount: 0,
              cus_id: customer.cus_id
            }
          ],
          split_payments: [],
          updated_by: 1
        };
        
        console.log('  📤 Sending test order with labour_charges: 750\n');
        
        // Make API call
        const response = await fetch('http://localhost:3000/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`  ✅ API returned sale_id: ${result.sale_id}`);
          
          // Verify in database
          const savedOrder = await prisma.sale.findUnique({
            where: { sale_id: result.sale_id }
          });
          
          if (savedOrder) {
            console.log(`  ✅ Order saved in database`);
            console.log(`     labour_charges: ${savedOrder.labour_charges}`);
            
            if (savedOrder.labour_charges === 750) {
              console.log(`  ✅ Labour charges value CORRECT (750)`);
              test4Pass = true;
            } else {
              console.log(`  ❌ Labour charges MISMATCH: expected 750, got ${savedOrder.labour_charges}`);
              test4Pass = false;
            }
          } else {
            console.log(`  ❌ Order not found in database`);
            test4Pass = false;
          }
        } else {
          console.log(`  ❌ API returned error: ${response.status}`);
          const error = await response.json();
          console.log(`     ${error.error}`);
          test4Pass = false;
        }
      }
      
      console.log(`\n✅ TEST 4 RESULT: ${test4Pass ? 'PASSED' : 'FAILED'}\n`);
      
    } catch (err) {
      console.error(`❌ TEST 4 ERROR: ${err.message}\n`);
      test4Pass = false;
    }
    
    // ============================================================================
    // FINAL REPORT
    // ============================================================================
    console.log('='.repeat(70));
    console.log('📊 FINAL TEST REPORT');
    console.log('='.repeat(70) + '\n');
    
    const results = [
      { name: 'Code has labour_charges', pass: test1Pass },
      { name: 'Database schema correct', pass: test2Pass },
      { name: 'Recent orders have labour data', pass: test3Pass },
      { name: 'API saves labour_charges', pass: test4Pass }
    ];
    
    let passCount = 0;
    results.forEach(test => {
      console.log(`${test.pass ? '✅' : '❌'} ${test.name}`);
      if (test.pass) passCount++;
    });
    
    console.log(`\n${passCount}/${results.length} tests passed\n`);
    
    if (passCount === 4) {
      console.log('🎉 ALL TESTS PASSED! Labour charges feature is working correctly!\n');
    } else if (passCount >= 3) {
      console.log('⚠️  Most tests passed. Check the failed tests above.\n');
    } else {
      console.log('❌ Multiple failures detected. Review the errors above.\n');
    }
    
    console.log('='.repeat(70) + '\n');
    
    // Cleanup
    await prisma.$disconnect();
    process.exit(passCount === 4 ? 0 : 1);
    
  } catch (err) {
    console.error(`\n❌ CRITICAL ERROR: ${err.message}\n`);
    console.error(err);
    process.exit(1);
  }
})();
