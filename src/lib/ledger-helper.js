/**
 * Ledger Helper Functions
 * Standardized ledger entry creation and balance calculation
 * Ensures consistent accounting across all modules (Sales, Purchases, Orders)
 */

/** @typedef {'RECEIVABLE' | 'PAYABLE'} AccountNature */

export const ACCOUNT_NATURE = {
  RECEIVABLE: 'RECEIVABLE',
  PAYABLE: 'PAYABLE'
};

/**
 * Calculate closing balance for a party ledger account.
 * - RECEIVABLE (customers): what they owe us — opening + debit - credit (debit increases balance)
 * - PAYABLE (suppliers): bill/purchase = debit, payment = credit; balance negative when we owe
 *   closing = opening - debit + credit (e.g. bill 2500 → -2500, pay 1000 credit → -1500)
 */
export function calculateClosingBalance(openingBalance, debitAmount = 0, creditAmount = 0) {
  const opening = parseFloat(openingBalance || 0);
  const debit = parseFloat(debitAmount || 0);
  const credit = parseFloat(creditAmount || 0);

  return opening + debit - credit;
}

/**
 * Create standardized ledger entry data
 * Ensures all modules use same structure and formula
 * 
 * @param {Object} config - Configuration object
 * @param {number} config.cus_id - Customer ID
 * @param {number} config.opening_balance - Opening balance
 * @param {number} config.debit_amount - Debit amount (default 0)
 * @param {number} config.credit_amount - Credit amount (default 0)
 * @param {string} config.bill_no - Bill number
 * @param {string} config.trnx_type - Transaction type (CASH, BANK_TRANSFER, etc.)
 * @param {string} config.details - Description of entry
 * @param {number} config.payments - Payment amount (default 0)
 * @param {number} config.updated_by - User ID who created entry (optional)
 * @returns {Object} Standardized ledger entry data
 */
export function createLedgerEntry(config) {
  const {
    cus_id,
    opening_balance,
    debit_amount = 0,
    credit_amount = 0,
    bill_no,
    trnx_type,
    details,
    payments = 0,
    cash_payment = 0,
    bank_payment = 0,
    updated_by = null,
    ledger_type = null,
    account_nature = ACCOUNT_NATURE.RECEIVABLE
  } = config;

  // Validate required fields
  if (!cus_id) {
    throw new Error('Customer ID (cus_id) is required for ledger entry');
  }

  const closing_balance = calculateClosingBalance(opening_balance, debit_amount, credit_amount, account_nature);

  let finalLedgerType = ledger_type;
  if (!finalLedgerType && bill_no) {
    const bStr = bill_no.toString().toUpperCase();
    const detLower = (details || '').toLowerCase();
    
    if (bStr.startsWith('PR-')) {
      finalLedgerType = 'Purchase Return';
    } else if (bStr.startsWith('EXP-')) {
      finalLedgerType = 'Expense';
    } else if (detLower.includes('package subscription')) {
      finalLedgerType = 'Order';
    } else if (detLower.includes('sale return') || detLower.includes('refund paid out')) {
      finalLedgerType = 'Sale Return';
    } else if (detLower.includes('purchase return')) {
      finalLedgerType = 'Purchase Return';
    } else if (bStr.startsWith('PAY-')) {
      finalLedgerType = detLower.includes('payment received') || detLower.includes('receive') ? 'Receiving' : 'Payment';
    } else if (bStr.startsWith('JRN-')) {
      finalLedgerType = 'Journal';
    } else if (trnx_type === 'PURCHASE') {
      finalLedgerType = 'Purchase';
    } else if (trnx_type === 'SALE') {
      finalLedgerType = detLower.includes('order') ? 'Order' : 'Sale';
    } else if (detLower.includes('purchase')) {
      finalLedgerType = 'Purchase';
    } else if (detLower.includes('sale') || detLower.includes('bill')) {
      finalLedgerType = detLower.includes('order') ? 'Order' : 'Sale';
    } else if (detLower.includes('cargo') || detLower.includes('labour') || detLower.includes('delivery') || detLower.includes('fare')) {
      finalLedgerType = 'Purchase'; // transport/labour charges from purchase
    } else if (detLower.includes('order') || detLower.includes('advance payment')) {
      finalLedgerType = 'Order';
    }
  }

  return {
    cus_id,
    opening_balance: parseFloat(opening_balance),
    debit_amount: parseFloat(debit_amount || 0),
    credit_amount: parseFloat(credit_amount || 0),
    closing_balance,
    bill_no: bill_no.toString(),
    trnx_type,
    details,
    payments: parseFloat(payments || 0),
    // Preserve explicit cash/bank breakdown when provided so UI/reports can show amounts in Cash/Bank columns
    cash_payment: parseFloat(cash_payment || 0),
    bank_payment: parseFloat(bank_payment || 0),
    updated_by: updated_by ? parseInt(updated_by) : null,
    ledger_type: finalLedgerType
  };
}

/**
 * Create multiple ledger entries with running balance tracking
 * Ensures each entry uses previous entry's closing balance as opening
 * 
 * @param {Array} entries - Array of entry configurations
 * @returns {Array} Array of processed ledger entries with proper balance chaining
 */
export function createChainedLedgerEntries(entries) {
  const processedEntries = [];
  let runningBalance = entries[0]?.opening_balance || 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Update opening balance for chained entries
    if (i > 0) {
      entry.opening_balance = runningBalance;
    }

    const processedEntry = createLedgerEntry(entry);
    processedEntries.push(processedEntry);
    
    // Update running balance for next entry
    runningBalance = processedEntry.closing_balance;
  }

  return processedEntries;
}

/**
 * Validate ledger entry consistency
 * Check if closing balance matches the nature-specific formula.
 * 
 * @param {Object} entry - Ledger entry to validate
 * @returns {boolean} True if entry is valid, throws error if not
 */
export function validateLedgerEntry(entry, accountNature = ACCOUNT_NATURE.RECEIVABLE) {
  const calculated = calculateClosingBalance(
    entry.opening_balance,
    entry.debit_amount,
    entry.credit_amount,
    accountNature
  );

  const difference = Math.abs(calculated - parseFloat(entry.closing_balance));
  
  // Allow for floating point precision errors
  if (difference > 0.01) {
    throw new Error(
      `Ledger entry validation failed. ` +
      `Expected closing: ${calculated.toFixed(2)}, ` +
      `Got: ${parseFloat(entry.closing_balance).toFixed(2)}`
    );
  }

  return true;
}

/**
 * Get balance summary for multiple ledger entries
 * Useful for reports and verification
 * 
 * @param {Array} entries - Array of ledger entries
 * @returns {Object} Summary with opening, total debit, total credit, closing
 */
export function getLedgerSummary(entries) {
  if (!entries || entries.length === 0) {
    return {
      openingBalance: 0,
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: 0,
      entryCount: 0
    };
  }

  const totalDebit = entries.reduce((sum, e) => sum + parseFloat(e.debit_amount || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + parseFloat(e.credit_amount || 0), 0);
  const openingBalance = parseFloat(entries[0]?.opening_balance || 0);
  const closingBalance = parseFloat(entries[entries.length - 1]?.closing_balance || 0);

  return {
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance,
    entryCount: entries.length,
    netChange: totalDebit - totalCredit
  };
}

/** Supplier / accounts-payable (purchase = debit, payment = credit; negative balance = we owe). */
export function createPayableLedgerEntry(config) {
  return createLedgerEntry({ ...config, account_nature: ACCOUNT_NATURE.PAYABLE });
}

export default {
  ACCOUNT_NATURE,
  calculateClosingBalance,
  createLedgerEntry,
  createPayableLedgerEntry,
  createChainedLedgerEntries,
  validateLedgerEntry,
  getLedgerSummary
};
