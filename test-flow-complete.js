#!/usr/bin/env node

/**
 * Complete Labour Charges Test Flow
 * Creates real orders and shows exactly what gets saved
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 CREATING TEST ORDERS - LABOUR CHARGES FLOW');
    console.log('='.repeat(70) + '\n');
    
    // Get test data
    const customer = await prisma.customer.findFirst();
    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();
    
    if (!customer || !store || !product) {
      console.log('❌ Missing test data. Creating minimal test setup...\n');
      process.exit(1);
    }
    
    console.log(`📌 Using:`);
    console.log(`   Customer: ${customer.cus_name} (ID: ${customer.cus_id})`);
    console.log(`   Store: ${store.store_name} (ID: ${store.storeid})`);
    console.log(`   Product: ${product.pro_name} (ID: ${product.pro_id})\n`);
    
    // Test scenarios
    const testCases = [
      { labour_charges: 0, name: 'Zero Labour' },
      { labour_charges: 500, name: 'Labour 500' },
      { labour_charges: 1000, name: 'Labour 1000' },
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📝 TEST: ${testCase.name} (labour_charges: ${testCase.labour_charges})`);
      console.log('─'.repeat(70));
      
      const payload = {
        cus_id: customer.cus_id,
        store_id: store.storeid,
        total_amount: 5000,
        discount: 500,
        payment: 3000,
        payment_type: 'CASH',
        cash_payment: 3000,
        bank_payment: 0,
        advance_payment: 0,
        labour_charges: testCase.labour_charges,  // ← TEST VALUE
        shipping_amount: 500,
        bill_type: 'ORDER',
        reference: `TEST-${testCase.labour_charges}-${Date.now()}`,
        sale_details: [
          {
            pro_id: product.pro_id,
            qnty: 10,
            unit: product.unit_type || 'PCS',
            unit_rate: 450,
            total_amount: 4500,
            discount: 0,
            cus_id: customer.cus_id
          }
        ],
        split_payments: [],
        updated_by: 1
      };
      
      console.log(`\n→ Sending to API:`);
      console.log(`  labour_charges: ${testCase.labour_charges}`);
      
      const response = await fetch('http://localhost:3000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.log(`✗ API Error: ${error.error}`);
        continue;
      }
      
      const result = await response.json();
      console.log(`✓ Created - Sale ID: ${result.sale_id}`);
      
      // Wait a moment for database write
      await new Promise(r => setTimeout(r, 200));
      
      // Query what was saved
      const savedOrder = await prisma.sale.findUnique({
        where: { sale_id: result.sale_id }
      });
      
      if (!savedOrder) {
        console.log(`✗ Not found in database!`);
        continue;
      }
      
      const saved = parseFloat(savedOrder.labour_charges);
      const expected = testCase.labour_charges;
      const match = saved === expected;
      
      console.log(`\n← Retrieved from database:`);
      console.log(`  labour_charges: ${saved}`);
      
      const status = match ? '✅ MATCH' : '❌ MISMATCH';
      console.log(`\n${status}: Expected ${expected}, Got ${saved}`);
      
      results.push({
        test: testCase.name,
        sent: expected,
        saved: saved,
        match: match,
        saleId: result.sale_id
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(70) + '\n');
    
    results.forEach((r, idx) => {
      const icon = r.match ? '✅' : '❌';
      console.log(`${icon} ${r.test}: Sent ${r.sent} → Saved ${r.saved}`);
    });
    
    const allPassed = results.every(r => r.match);
    
    console.log('\n' + '─'.repeat(70));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('✅ API correctly saves labour_charges when provided');
      console.log('✅ Frontend should be sending labour values');
      console.log('\n⚠️  If frontend form is NOT entering labour values,');
      console.log('   check browser console for debug logs when creating orders.');
    } else {
      console.log('❌ TESTS FAILED');
      console.log('API not properly saving labour_charges');
    }
    
    console.log('─'.repeat(70));
    console.log('\nDatabase now contains:');
    
    const testOrders = await prisma.sale.findMany({
      where: {
        reference: {
          startsWith: 'TEST-'
        }
      },
      orderBy: { sale_id: 'desc' },
      take: 5
    });
    
    testOrders.forEach(order => {
      console.log(`  Order ${order.sale_id}: labour=${order.labour_charges}, ref=${order.reference}`);
    });
    
    console.log('\n' + '='.repeat(70) + '\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  }
  
  await prisma.$disconnect();
  process.exit(0);
})();
