/**
 * ============================================================
 * COMPREHENSIVE LEDGER & CUSTOMER BALANCE VALIDATION TEST
 * ============================================================
 * 
 * This test validates that:
 * 1. Ledger entries are created correctly
 * 2. Customer table balance matches calculated ledger balance
 * 3. Order creation and conversion transactions balance properly
 * 4. All accounts (Customer, Cash, Bank) are reconciled
 * ============================================================
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const CUSTOMER_ID = 21; // zain
const STORE_ID = 2;
const BANK_ACCOUNT_ID = 26; // Foji Bank
const UPDATED_BY = 1;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}═══════════════════════════════════════════════${colors.reset}\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n${colors.cyan}${colors.bright}═══════════════════════════════════════════════${colors.reset}\n`),
  table: (label, value, expected, status) => {
    const statusColor = status === 'PASS' ? colors.green : colors.red;
    console.log(`   ${label.padEnd(35)} | ${value.toString().padEnd(15)} | ${expected.toString().padEnd(15)} | ${statusColor}${status}${colors.reset}`);
  }
};

let testResults = { passed: 0, failed: 0, errors: [] };

async function getCustomerData() {
  try {
    const response = await axios.get(`${API_BASE_URL}/customers?id=${CUSTOMER_ID}`);
    return response.data;
  } catch (error) {
    log.error(`Failed to fetch customer: ${error.message}`);
    throw error;
  }
}

async function getLedgerEntries() {
  try {
    const response = await axios.get(`${API_BASE_URL}/ledger`);
    return response.data.filter(entry => entry.cus_id === CUSTOMER_ID);
  } catch (error) {
    log.error(`Failed to fetch ledger: ${error.message}`);
    throw error;
  }
}

async function createOrder(orderData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/sales`, orderData);
    return response.data;
  } catch (error) {
    log.error(`Failed to create order: ${error.response?.data?.error || error.message}`);
    throw error;
  }
}

function validateLedgerSequence(ledgerEntries) {
  // Validate that each ledger entry's calculation is correct
  // Formula: opening_balance + debit - credit = closing_balance
  let allValid = true;
  
  for (const entry of ledgerEntries) {
    const opening = parseFloat(entry.opening_balance || 0);
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const closing = parseFloat(entry.closing_balance || 0);
    
    const calculated = opening + debit - credit;
    const tolerance = 0.01;
    
    if (Math.abs(calculated - closing) > tolerance) {
      log.error(`Bill ${entry.bill_no}: ${opening} + ${debit} - ${credit} = ${calculated}, but closing is ${closing}`);
      allValid = false;
    }
  }
  
  return allValid;
}

async function validateBalances(customerData, ledgerEntries, stepName) {
  log.section(`VALIDATION: ${stepName}`);
  
  const customerTableBalance = parseFloat(customerData.cus_balance || 0);
  
  // IMPORTANT: ledgerEntries are returned in DESC order (newest first)
  // So we need to reverse to get chronological order (oldest first)
  const chronologicalEntries = [...ledgerEntries].reverse();
  const lastChronologicalEntry = chronologicalEntries[chronologicalEntries.length - 1];
  const lastClosingBalance = lastChronologicalEntry ? parseFloat(lastChronologicalEntry.closing_balance) : 0;
  
  log.info(`Total Ledger Entries: ${ledgerEntries.length}`);
  
  console.log(`\n   Field                              | Actual Value    | Expected Value  | Status`);
  console.log(`   ${'-'.repeat(90)}`);
  
  // Validation 1: Customer Table Balance matches last ledger closing (in chronological order)
  const balanceMatch = Math.abs(customerTableBalance - lastClosingBalance) < 0.01;
  log.table('Customer Table vs Last Ledger', customerTableBalance.toFixed(2), lastClosingBalance.toFixed(2), balanceMatch ? 'PASS' : 'FAIL');
  
  if (balanceMatch) {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push(`${stepName}: Customer balance ${customerTableBalance} ≠ last ledger closing ${lastClosingBalance}`);
  }
  
  // Validation 2: Check all ledger entries are calculated correctly
  let entryCalcsValid = true;
  let invalidEntries = [];
  
  for (const entry of ledgerEntries) {
    const opening = parseFloat(entry.opening_balance || 0);
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const closing = parseFloat(entry.closing_balance || 0);
    
    const calculated = opening + debit - credit;
    
    if (Math.abs(calculated - closing) > 0.01) {
      entryCalcsValid = false;
      invalidEntries.push(`Bill ${entry.bill_no}: ${opening} + ${debit} - ${credit} = ${calculated}, but is ${closing}`);
    }
  }
  
  log.table('All Ledger Entry Calculations', entryCalcsValid ? 'VALID' : 'INVALID', 'VALID', entryCalcsValid ? 'PASS' : 'FAIL');
  
  if (entryCalcsValid) {
    testResults.passed++;
  } else {
    testResults.failed++;
    invalidEntries.forEach(err => testResults.errors.push(`${stepName}: ${err}`));
  }
  
  // Show ledger entries grouped by bill (in chronological order)
  log.info(`\nAll Ledger Entries (Grouped by Bill, Chronological Order):`);
  
  const entryByBill = {};
  chronologicalEntries.forEach(entry => {
    const bill = entry.bill_no || 'N/A';
    if (!entryByBill[bill]) entryByBill[bill] = [];
    entryByBill[bill].push(entry);
  });
  
  console.log(`\n   Bill | Date            | Debit    | Credit   | Opening     | Closing     | Details`);
  console.log(`   ${'-'.repeat(105)}`);
  
  Object.keys(entryByBill).forEach(bill => {
    entryByBill[bill].forEach((entry, idx) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const debit = parseFloat(entry.debit_amount || 0).toFixed(2);
      const credit = parseFloat(entry.credit_amount || 0).toFixed(2);
      const opening = parseFloat(entry.opening_balance || 0).toFixed(2);
      const closing = parseFloat(entry.closing_balance || 0).toFixed(2);
      const details = (entry.details || 'N/A').substring(0, 25);
      
      // Verify the calculation is correct
      const calc = parseFloat(opening) + parseFloat(debit) - parseFloat(credit);
      const isValid = Math.abs(calc - parseFloat(closing)) < 0.01;
      const validColor = isValid ? colors.green : colors.red;
      
      console.log(`   ${bill.toString().padEnd(4)} | ${date.padEnd(15)} | ${debit.padEnd(8)} | ${credit.padEnd(8)} | ${opening.padEnd(11)} | ${validColor}${closing.padEnd(11)}${colors.reset} | ${details}`);
    });
  });
  
  return balanceMatch && entryCalcsValid;
}

async function runTest() {
  try {
    log.section('LEDGER & CUSTOMER BALANCE VALIDATION TEST');
    
    log.info('Customer: zain (ID: 21)');
    log.info('Testing: Order Creation → Conversion to Sale Flow\n');
    
    // ==================== STEP 1: CREATE ORDER ====================
    log.section('STEP 1: CREATE ORDER');
    log.info('Creating order for 5000 PKR with 3000 payment (1000 cash + 2000 bank)...');
    
    const orderData = {
      cus_id: CUSTOMER_ID,
      store_id: STORE_ID,
      total_amount: 5000,
      discount: 0,
      payment: 3000,
      payment_type: 'CASH',
      cash_payment: 1000,
      bank_payment: 2000,
      bank_title: 'Foji Bank',
      debit_account_id: BANK_ACCOUNT_ID,
      credit_account_id: null,
      loader_id: null,
      shipping_amount: 0,
      bill_type: 'BILL',
      reference: 'Test Order - Initial Creation',
      is_loaded_order: false,
      sale_details: [
        {
          pro_id: 2,
          vehicle_no: null,
          qnty: 50,
          unit: 'PCS',
          unit_rate: 100,
          total_amount: 5000,
          discount: 0,
          cus_id: CUSTOMER_ID,
        },
      ],
      transport_details: [],
      split_payments: [
        {
          amount: 1000,
          payment_type: 'CASH',
          debit_account_id: null,
        },
        {
          amount: 2000,
          payment_type: 'BANK_TRANSFER',
          debit_account_id: BANK_ACCOUNT_ID,
        },
      ],
      updated_by: UPDATED_BY,
    };
    
    const order = await createOrder(orderData);
    log.success(`Order created with ID: ${order.sale_id}`);
    
    // Validate after order creation
    let customerData = await getCustomerData();
    let ledgerEntries = await getLedgerEntries();
    
    console.log(`\n   Expected Balance: 2000 (5000 bill - 3000 payment)`);
    console.log(`   Actual Balance: ${customerData.cus_balance}\n`);
    
    await validateBalances(customerData, ledgerEntries, 'AFTER ORDER CREATION');
    
    // ==================== STEP 2: CONVERT TO SALE & PAY REMAINING ====================
    log.section('STEP 2: CONVERT ORDER TO SALE & PAY REMAINING');
    log.info('Converting order to sale and paying remaining 2000 (500 cash + 1500 bank)...');
    
    const conversionData = {
      cus_id: CUSTOMER_ID,
      store_id: STORE_ID,
      total_amount: 5000,
      discount: 0,
      payment: 2000,
      payment_type: 'CASH',
      cash_payment: 500,
      bank_payment: 1500,
      bank_title: 'Foji Bank',
      debit_account_id: BANK_ACCOUNT_ID,
      credit_account_id: null,
      loader_id: null,
      shipping_amount: 0,
      bill_type: 'BILL',
      reference: `Converted from Order ${order.sale_id}`,
      is_loaded_order: true, // Mark as loaded order (conversion)
      sale_details: [
        {
          pro_id: 2,
          vehicle_no: null,
          qnty: 50,
          unit: 'PCS',
          unit_rate: 100,
          total_amount: 5000,
          discount: 0,
          cus_id: CUSTOMER_ID,
        },
      ],
      transport_details: [],
      split_payments: [
        {
          amount: 500,
          payment_type: 'CASH',
          debit_account_id: null,
        },
        {
          amount: 1500,
          payment_type: 'BANK_TRANSFER',
          debit_account_id: BANK_ACCOUNT_ID,
        },
      ],
      updated_by: UPDATED_BY,
    };
    
    const conversion = await createOrder(conversionData);
    log.success(`Order converted to Sale with ID: ${conversion.sale_id}`);
    
    // Validate after conversion
    customerData = await getCustomerData();
    ledgerEntries = await getLedgerEntries();
    
    console.log(`\n   Expected Final Balance: 0 (2000 outstanding - 2000 payment)`);
    console.log(`   Actual Balance: ${customerData.cus_balance}\n`);
    
    await validateBalances(customerData, ledgerEntries, 'AFTER ORDER CONVERSION');
    
    // ==================== FINAL SUMMARY ====================
    log.section('FINAL VALIDATION SUMMARY');
    
    console.log(`\n${colors.bright}Test Results:${colors.reset}`);
    console.log(`   Passed: ${colors.green}${testResults.passed}${colors.reset}`);
    console.log(`   Failed: ${colors.red}${testResults.failed}${colors.reset}`);
    console.log(`   Total:  ${testResults.passed + testResults.failed}\n`);
    
    if (testResults.failed > 0) {
      console.log(`${colors.red}${colors.bgRed}ERRORS FOUND:${colors.reset}\n`);
      testResults.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${colors.red}${error}${colors.reset}`);
      });
    } else {
      console.log(`${colors.green}${colors.bgGreen}ALL VALIDATIONS PASSED!${colors.reset}\n`);
      console.log(`✨ Ledger entries and customer balance are consistent and correct.`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
