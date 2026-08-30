/**
 * Ledger Reporter Module
 * Generates comprehensive console reports for sales and order transactions
 * Tracks ledger values, balances, and transaction details
 */

/**
 * Generate a detailed console report for a sale or order creation
 * @param {Object} config - Configuration object
 * @param {string} config.transactionType - Type of transaction ('SALE' or 'ORDER')
 * @param {number} config.saleId - Sale/Order ID
 * @param {number} config.customerId - Customer ID
 * @param {string} config.customerName - Customer name
 * @param {number} config.previousBalance - Customer's balance before transaction
 * @param {number} config.netTotal - Net total amount (total - discount + shipping)
 * @param {number} config.totalAmount - Total amount before discounts
 * @param {number} config.discount - Discount amount
 * @param {number} config.shippingAmount - Shipping amount
 * @param {number} config.paymentReceived - Total payment received (cash + bank)
 * @param {number} config.cashPayment - Cash payment received
 * @param {number} config.bankPayment - Bank payment received
 * @param {number} config.advancePayment - Advance payment (if any)
 * @param {number} config.newBalance - Customer's balance after transaction
 * @param {Array} config.ledgerEntries - Array of all ledger entries created
 * @param {string} config.billType - Type of bill (BILL, QUOTATION, etc.)
 * @param {Object} config.specialAccounts - Special accounts (Cash, Bank, etc.)
 * @returns {void}
 */
export function reportSaleCreation(config) {
  const {
    transactionType = 'SALE',
    saleId,
    customerId,
    customerName,
    previousBalance,
    netTotal,
    totalAmount,
    discount,
    shippingAmount,
    paymentReceived = 0,
    cashPayment = 0,
    bankPayment = 0,
    advancePayment = 0,
    newBalance,
    ledgerEntries = [],
    billType = 'BILL',
    specialAccounts = {}
  } = config;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`📊 ${transactionType} CREATION REPORT - LEDGER & BALANCE TRACKING`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  // Transaction Header
  console.log('\n📋 TRANSACTION DETAILS:');
  console.log(`   ${transactionType} ID: ${saleId}`);
  console.log(`   Bill Type: ${billType}`);
  console.log(`   Timestamp: ${new Date().toLocaleString()}`);

  // Customer Information
  console.log('\n👤 CUSTOMER INFORMATION:');
  console.log(`   Customer ID: ${customerId}`);
  console.log(`   Customer Name: ${customerName}`);

  // Amount Breakdown
  console.log('\n💰 AMOUNT BREAKDOWN:');
  console.log(`   Gross Total: PKR ${parseFloat(totalAmount).toFixed(2)}`);
  console.log(`   Discount: PKR ${parseFloat(discount || 0).toFixed(2)}`);
  console.log(`   Shipping: PKR ${parseFloat(shippingAmount || 0).toFixed(2)}`);
  console.log(`   Net Total: PKR ${parseFloat(netTotal).toFixed(2)}`);

  // Payment Received
  console.log('\n💵 PAYMENTS RECEIVED:');
  console.log(`   Cash: PKR ${parseFloat(cashPayment || 0).toFixed(2)}`);
  console.log(`   Bank: PKR ${parseFloat(bankPayment || 0).toFixed(2)}`);
  console.log(`   Advance: PKR ${parseFloat(advancePayment || 0).toFixed(2)}`);
  console.log(`   Total Payment: PKR ${parseFloat(paymentReceived).toFixed(2)}`);
  console.log(`   Outstanding Balance: PKR ${(parseFloat(netTotal) - parseFloat(paymentReceived)).toFixed(2)}`);

  // Balance Update
  console.log('\n📈 BALANCE UPDATE:');
  console.log(`   Opening Balance: PKR ${parseFloat(previousBalance).toFixed(2)}`);
  console.log(`   Amount Charged: PKR +${parseFloat(netTotal).toFixed(2)}`);
  console.log(`   Amount Paid: PKR -${parseFloat(paymentReceived).toFixed(2)}`);
  console.log(`   Closing Balance: PKR ${parseFloat(newBalance).toFixed(2)}`);
  
  // Balance Change Indicator
  const balanceChange = parseFloat(newBalance) - parseFloat(previousBalance);
  const balanceChangeStr = balanceChange > 0 ? `+${balanceChange.toFixed(2)}` : `${balanceChange.toFixed(2)}`;
  const balanceStatus = balanceChange > 0 ? '⬆️ INCREASED' : balanceChange < 0 ? '⬇️ DECREASED' : '➡️ NO CHANGE';
  console.log(`   Net Change: ${balanceChangeStr} (${balanceStatus})`);

  // Ledger Entries Summary
  console.log('\n📚 LEDGER ENTRIES CREATED: (' + ledgerEntries.length + ' entries)');
  
  if (ledgerEntries.length > 0) {
    console.log('   ┌─────────────────────────────────────────────────────────────┐');
    
    ledgerEntries.forEach((entry, index) => {
      const entryNum = index + 1;
      const debitStr = entry.debit_amount > 0 ? `Dr: PKR ${parseFloat(entry.debit_amount).toFixed(2)}` : '';
      const creditStr = entry.credit_amount > 0 ? `Cr: PKR ${parseFloat(entry.credit_amount).toFixed(2)}` : '';
      
      console.log(`   │ Entry ${entryNum}: ${entry.details}`);
      console.log(`   │   Opening: PKR ${parseFloat(entry.opening_balance).toFixed(2)}`);
      if (debitStr) console.log(`   │   ${debitStr}`);
      if (creditStr) console.log(`   │   ${creditStr}`);
      console.log(`   │   Closing: PKR ${parseFloat(entry.closing_balance).toFixed(2)}`);
    });
    
    console.log('   └─────────────────────────────────────────────────────────────┘');
  } else {
    console.log('   ⚠️  No ledger entries created (likely a QUOTATION)');
  }

  // Special Accounts Impact
  if (specialAccounts && Object.keys(specialAccounts).length > 0) {
    console.log('\n🏦 SPECIAL ACCOUNTS UPDATED:');
    
    if (specialAccounts.cash && parseFloat(cashPayment || 0) > 0) {
      console.log(`   Cash Account:`);
      console.log(`      Name: ${specialAccounts.cash.cus_name}`);
      console.log(`      Credit: PKR ${parseFloat(cashPayment).toFixed(2)}`);
    }
    
    if (specialAccounts.bank && parseFloat(bankPayment || 0) > 0) {
      console.log(`   Bank Account:`);
      console.log(`      Name: ${specialAccounts.bank.cus_name}`);
      console.log(`      Credit: PKR ${parseFloat(bankPayment).toFixed(2)}`);
    }
  }

  // Status Summary
  console.log('\n✅ SUMMARY:');
  console.log(`   Status: ${ledgerEntries.length > 0 ? 'POSTED TO LEDGER' : 'NOT POSTED (QUOTATION)'}`);
  console.log(`   Total Entries: ${ledgerEntries.length}`);
  console.log(`   Customer Balance Updated: ${newBalance !== undefined ? 'YES' : 'NO'}`);
  
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}

/**
 * Report order/load-order creation with ledger details
 * @param {Object} config - Configuration object (same as reportSaleCreation)
 */
export function reportOrderCreation(config) {
  const {
    orderId,
    ...rest
  } = config;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📦 ORDER CREATION REPORT - LEDGER & BALANCE TRACKING');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  // Call the common reporting function
  reportSaleCreation({
    transactionType: 'ORDER',
    saleId: orderId,
    ...rest
  });
}

/**
 * Report ledger value check - shows current state of critical accounts
 * @param {Object} config - Configuration object
 * @param {Array} config.accounts - Array of accounts to report
 * @param {Object} config.customer - Customer object with balance
 * @param {Object} config.cashAccount - Cash account object
 * @param {Object} config.bankAccount - Bank account object
 */
export function reportLedgerCheck(config) {
  const {
    accounts = [],
    customer,
    cashAccount,
    bankAccount
  } = config;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🔍 LEDGER VALUES CHECK - ACCOUNT BALANCES');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  if (customer) {
    console.log('👤 CUSTOMER ACCOUNT:');
    console.log(`   ID: ${customer.cus_id}`);
    console.log(`   Name: ${customer.cus_name}`);
    console.log(`   Balance: PKR ${parseFloat(customer.cus_balance || 0).toFixed(2)}`);
    console.log(`   Status: ${parseFloat(customer.cus_balance || 0) > 0 ? '⚠️  CREDITOR' : parseFloat(customer.cus_balance || 0) < 0 ? '✅ DEBTOR' : '➡️ ZERO'}\n`);
  }

  if (cashAccount) {
    console.log('💵 CASH ACCOUNT:');
    console.log(`   ID: ${cashAccount.cus_id}`);
    console.log(`   Name: ${cashAccount.cus_name}`);
    console.log(`   Balance: PKR ${parseFloat(cashAccount.cus_balance || 0).toFixed(2)}\n`);
  }

  if (bankAccount) {
    console.log('🏦 BANK ACCOUNT:');
    console.log(`   ID: ${bankAccount.cus_id}`);
    console.log(`   Name: ${bankAccount.cus_name}`);
    console.log(`   Balance: PKR ${parseFloat(bankAccount.cus_balance || 0).toFixed(2)}\n`);
  }

  if (accounts.length > 0) {
    console.log('📊 OTHER ACCOUNTS:');
    accounts.forEach(account => {
      console.log(`   ${account.cus_name}: PKR ${parseFloat(account.cus_balance || 0).toFixed(2)}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}

/**
 * Report transaction verification - validates ledger integrity
 * @param {Object} config - Configuration object
 * @param {number} config.saleId - Sale ID
 * @param {number} config.totalDebits - Sum of all debits
 * @param {number} config.totalCredits - Sum of all credits
 * @param {number} config.entriesCount - Number of entries
 */
export function reportTransactionVerification(config) {
  const {
    saleId,
    totalDebits = 0,
    totalCredits = 0,
    entriesCount = 0
  } = config;

  const isBalanced = Math.abs(parseFloat(totalDebits) - parseFloat(totalCredits)) < 0.01;
  const status = isBalanced ? '✅ BALANCED' : '❌ UNBALANCED';

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`🔐 TRANSACTION VERIFICATION - ${status}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`Sale ID: ${saleId}`);
  console.log(`Total Entries: ${entriesCount}`);
  console.log(`Total Debits: PKR ${parseFloat(totalDebits).toFixed(2)}`);
  console.log(`Total Credits: PKR ${parseFloat(totalCredits).toFixed(2)}`);
  console.log(`Difference: PKR ${Math.abs(parseFloat(totalDebits) - parseFloat(totalCredits)).toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}
