/**
 * Test Script for Ledger Reporter
 * This script tests the ledger reporting functionality
 * Run this in your Node environment to verify console output formatting
 */

import { reportSaleCreation, reportLedgerCheck, reportTransactionVerification } from './src/lib/ledger-reporter.js';

console.log('\n\n');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                   LEDGER REPORTER - TEST SUITE                           ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');

// Test 1: Sample Sale Creation Report
console.log('\n🧪 TEST 1: Sale Creation Report\n');

reportSaleCreation({
  transactionType: 'SALE',
  saleId: 1001,
  customerId: 5,
  customerName: 'ABC Construction Company',
  previousBalance: 50000,
  netTotal: 75000,
  totalAmount: 80000,
  discount: 5000,
  shippingAmount: 3000,
  paymentReceived: 25000,
  cashPayment: 15000,
  bankPayment: 10000,
  advancePayment: 0,
  newBalance: 100000,
  ledgerEntries: [
    {
      cus_id: 5,
      opening_balance: 50000,
      debit_amount: 75000,
      credit_amount: 0,
      closing_balance: 125000,
      bill_no: '1001',
      trnx_type: 'CASH',
      details: 'Sale Bill - BILL - Customer Account (Debit)',
      payments: 0,
      updated_by: 1
    },
    {
      cus_id: 5,
      opening_balance: 125000,
      debit_amount: 0,
      credit_amount: 25000,
      closing_balance: 100000,
      bill_no: '1001',
      trnx_type: 'CASH',
      details: 'Payment Received - BILL - Customer Account (Credit)',
      payments: 25000,
      updated_by: 1
    },
    {
      cus_id: 1,
      opening_balance: 10000,
      debit_amount: 15000,
      credit_amount: 0,
      closing_balance: 25000,
      bill_no: '1001',
      trnx_type: 'CASH',
      details: 'Payment Received - BILL - CASH Account (Debit)',
      payments: 15000,
      updated_by: 1
    },
    {
      cus_id: 2,
      opening_balance: 5000,
      debit_amount: 10000,
      credit_amount: 0,
      closing_balance: 15000,
      bill_no: '1001',
      trnx_type: 'BANK_TRANSFER',
      details: 'Payment Received - BILL - BANK Account (Debit)',
      payments: 10000,
      updated_by: 1
    }
  ],
  billType: 'BILL',
  specialAccounts: {
    cash: {
      cus_id: 1,
      cus_name: 'Cash Account',
      cus_balance: 25000
    },
    bank: {
      cus_id: 2,
      cus_name: 'Bank Account',
      cus_balance: 15000
    }
  }
});

// Test 2: Order Creation Report
console.log('\n🧪 TEST 2: Order Creation Report\n');

reportSaleCreation({
  transactionType: 'ORDER',
  saleId: 2001,
  customerId: 7,
  customerName: 'XYZ Traders',
  previousBalance: 25000,
  netTotal: 45000,
  totalAmount: 50000,
  discount: 5000,
  shippingAmount: 0,
  paymentReceived: 45000,
  cashPayment: 25000,
  bankPayment: 20000,
  advancePayment: 0,
  newBalance: 25000,
  ledgerEntries: [
    {
      cus_id: 7,
      opening_balance: 25000,
      debit_amount: 45000,
      credit_amount: 0,
      closing_balance: 70000,
      bill_no: '2001',
      trnx_type: 'CASH',
      details: 'Sale Bill - ORDER - Customer Account (Debit)',
      payments: 0,
      updated_by: 1
    },
    {
      cus_id: 7,
      opening_balance: 70000,
      debit_amount: 0,
      credit_amount: 45000,
      closing_balance: 25000,
      bill_no: '2001',
      trnx_type: 'CASH',
      details: 'Payment Received - ORDER - Customer Account (Credit)',
      payments: 45000,
      updated_by: 1
    }
  ],
  billType: 'ORDER',
  specialAccounts: {}
});

// Test 3: Ledger Check Report
console.log('\n🧪 TEST 3: Ledger Values Check\n');

reportLedgerCheck({
  customer: {
    cus_id: 5,
    cus_name: 'ABC Construction Company',
    cus_balance: 100000
  },
  cashAccount: {
    cus_id: 1,
    cus_name: 'Cash Account',
    cus_balance: 25000
  },
  bankAccount: {
    cus_id: 2,
    cus_name: 'Bank Account',
    cus_balance: 15000
  },
  accounts: [
    { cus_name: 'Sundry Debtors', cus_balance: 5000 },
    { cus_name: 'Sundry Creditors', cus_balance: -8000 }
  ]
});

// Test 4: Transaction Verification Report
console.log('\n🧪 TEST 4: Transaction Verification\n');

reportTransactionVerification({
  saleId: 1001,
  totalDebits: 100000,
  totalCredits: 100000,
  entriesCount: 4
});

console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                        TEST SUITE COMPLETED                               ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n\n');
