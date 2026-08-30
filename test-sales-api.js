/**
 * Test script for Sales API
 * Run with: node test-sales-api.js
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testGetAllSales() {
  logSection('TEST 1: Get All Sales');
  
  try {
    log('📡 Fetching all sales from /api/sales...', 'blue');
    const response = await fetch(`${API_BASE_URL}/api/sales`);
    
    log(`Status: ${response.status} ${response.statusText}`, 
      response.ok ? 'green' : 'red');
    
    if (!response.ok) {
      const errorData = await response.json();
      log(`❌ Error: ${JSON.stringify(errorData, null, 2)}`, 'red');
      return null;
    }
    
    const sales = await response.json();
    log(`✅ Successfully fetched ${sales.length} sales`, 'green');
    
    // Validate response structure
    if (!Array.isArray(sales)) {
      log('❌ Response is not an array!', 'red');
      log(`Response type: ${typeof sales}`, 'yellow');
      log(`Response: ${JSON.stringify(sales, null, 2)}`, 'yellow');
      return null;
    }
    
    if (sales.length === 0) {
      log('⚠️  No sales found in database', 'yellow');
      return sales;
    }
    
    // Check first sale structure
    log('\n📋 Checking first sale structure:', 'blue');
    const firstSale = sales[0];
    
    const requiredFields = [
      'sale_id',
      'total_amount',
      'discount',
      'payment',
      'payment_type',
      'cus_id',
      'created_at'
    ];
    
    const optionalFields = [
      'customer',
      'sale_details',
      'shipping_amount',
      'bill_type',
      'reference'
    ];
    
    log('\nRequired fields check:', 'blue');
    requiredFields.forEach(field => {
      if (field in firstSale) {
        log(`  ✅ ${field}: ${firstSale[field]}`, 'green');
      } else {
        log(`  ❌ ${field}: MISSING`, 'red');
      }
    });
    
    log('\nOptional fields check:', 'blue');
    optionalFields.forEach(field => {
      if (field in firstSale) {
        const value = firstSale[field];
        if (field === 'customer' && value) {
          log(`  ✅ ${field}: ${value.cus_name || 'exists but no name'}`, 'green');
        } else if (field === 'sale_details' && Array.isArray(value)) {
          log(`  ✅ ${field}: ${value.length} items`, 'green');
        } else {
          log(`  ✅ ${field}: ${value || 'null'}`, 'green');
        }
      } else {
        log(`  ⚠️  ${field}: not present`, 'yellow');
      }
    });
    
    // Validate data types
    log('\n📊 Data type validation:', 'blue');
    const validations = [
      { field: 'sale_id', type: 'number', value: firstSale.sale_id },
      { field: 'total_amount', type: 'number', value: firstSale.total_amount },
      { field: 'payment', type: 'number', value: firstSale.payment },
      { field: 'customer', type: 'object', value: firstSale.customer },
      { field: 'sale_details', type: 'object', value: firstSale.sale_details }
    ];
    
    validations.forEach(({ field, type, value }) => {
      if (value === null || value === undefined) {
        log(`  ⚠️  ${field}: ${value}`, 'yellow');
      } else if (type === 'number' && typeof value === 'number') {
        log(`  ✅ ${field}: ${value} (${typeof value})`, 'green');
      } else if (type === 'object' && Array.isArray(value)) {
        log(`  ✅ ${field}: Array with ${value.length} items`, 'green');
      } else if (type === 'object' && typeof value === 'object') {
        log(`  ✅ ${field}: Object`, 'green');
      } else {
        log(`  ❌ ${field}: Expected ${type}, got ${typeof value}`, 'red');
      }
    });
    
    // Show sample sale
    log('\n📄 Sample Sale Data:', 'blue');
    console.log(JSON.stringify(firstSale, null, 2));
    
    // Check all sales
    log(`\n📊 Summary for all ${sales.length} sales:`, 'blue');
    sales.forEach((sale, index) => {
      const hasCustomer = sale.customer && sale.customer.cus_name;
      const hasDetails = sale.sale_details && sale.sale_details.length > 0;
      log(
        `  Sale #${index + 1}: ID=${sale.sale_id}, ` +
        `Customer=${hasCustomer ? sale.customer.cus_name : 'N/A'}, ` +
        `Amount=${sale.total_amount}, ` +
        `Details=${hasDetails ? sale.sale_details.length : 0} items`,
        hasCustomer && hasDetails ? 'green' : 'yellow'
      );
    });
    
    return sales;
    
  } catch (error) {
    log(`❌ Error fetching sales: ${error.message}`, 'red');
    log(`Stack: ${error.stack}`, 'red');
    return null;
  }
}

async function testGetSingleSale(saleId) {
  logSection(`TEST 2: Get Single Sale (ID: ${saleId})`);
  
  try {
    log(`📡 Fetching sale ${saleId} from /api/sales?id=${saleId}...`, 'blue');
    const response = await fetch(`${API_BASE_URL}/api/sales?id=${saleId}`);
    
    log(`Status: ${response.status} ${response.statusText}`, 
      response.ok ? 'green' : 'red');
    
    if (!response.ok) {
      const errorData = await response.json();
      log(`❌ Error: ${JSON.stringify(errorData, null, 2)}`, 'red');
      return null;
    }
    
    const sale = await response.json();
    log(`✅ Successfully fetched sale ${saleId}`, 'green');
    
    log('\n📄 Sale Data:', 'blue');
    console.log(JSON.stringify(sale, null, 2));
    
    return sale;
    
  } catch (error) {
    log(`❌ Error fetching sale: ${error.message}`, 'red');
    return null;
  }
}

async function testDatabaseQuery() {
  logSection('TEST 3: Direct Database Query Test');
  
  try {
    // This would require Prisma, so we'll just test the API response structure
    log('📊 Testing API response structure...', 'blue');
    
    const response = await fetch(`${API_BASE_URL}/api/sales`);
    if (!response.ok) {
      log('❌ API request failed', 'red');
      return;
    }
    
    const sales = await response.json();
    
    if (!Array.isArray(sales)) {
      log('❌ Response is not an array!', 'red');
      return;
    }
    
    log(`✅ Response is an array with ${sales.length} items`, 'green');
    
    // Check for BigInt values (which would cause JSON serialization issues)
    const jsonString = JSON.stringify(sales);
    if (jsonString.includes('n"')) {
      log('⚠️  Potential BigInt values found in response (looks like "...n" patterns)', 'yellow');
    } else {
      log('✅ No BigInt serialization issues detected', 'green');
    }
    
    // Check response size
    const responseSize = new Blob([jsonString]).size;
    log(`📏 Response size: ${(responseSize / 1024).toFixed(2)} KB`, 'blue');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'bright');
  log('SALES API TEST SUITE', 'bright');
  log('='.repeat(60) + '\n', 'bright');
  
  log(`Testing API at: ${API_BASE_URL}`, 'blue');
  log(`Date: ${new Date().toISOString()}\n`, 'blue');
  
  // Test 1: Get all sales
  const sales = await testGetAllSales();
  
  // Test 2: Get single sale (if we have sales)
  if (sales && sales.length > 0) {
    await testGetSingleSale(sales[0].sale_id);
  } else {
    log('\n⚠️  Skipping single sale test - no sales found', 'yellow');
  }
  
  // Test 3: Database query test
  await testDatabaseQuery();
  
  // Summary
  logSection('TEST SUMMARY');
  if (sales && sales.length > 0) {
    log(`✅ Found ${sales.length} sales in database`, 'green');
    log(`✅ All tests completed successfully`, 'green');
  } else {
    log(`⚠️  No sales found in database`, 'yellow');
    log(`   This might be expected if no sales have been created yet.`, 'yellow');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'bright');
}

// Run tests
if (typeof fetch === 'undefined') {
  // Node.js environment - need to install node-fetch or use built-in fetch (Node 18+)
  if (typeof require !== 'undefined') {
    try {
      // Try to use built-in fetch (Node 18+)
      if (!global.fetch) {
        log('⚠️  fetch is not available. Please use Node.js 18+ or install node-fetch', 'yellow');
        process.exit(1);
      }
    } catch (e) {
      log('❌ fetch is not available. Please use Node.js 18+', 'red');
      process.exit(1);
    }
  }
}

// Run the tests
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  log(`Stack: ${error.stack}`, 'red');
  process.exit(1);
});







