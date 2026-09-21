import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { updateStoreStock } from '@/lib/storeStock';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolves the correct opening balance for any customer/account at a target created_at timestamp. */
async function resolveOpeningBalance(tx, cus_id, target_created_at) {
  const priorEntry = await tx.ledger.findFirst({
    where: { cus_id, created_at: { lt: target_created_at } },
    orderBy: [
      { created_at: 'desc' },
      { l_id: 'desc' }
    ],
    select: { closing_balance: true }
  });

  if (priorEntry) {
    return parseFloat(priorEntry.closing_balance || 0);
  }

  const nextEntry = await tx.ledger.findFirst({
    where: { cus_id, created_at: { gte: target_created_at } },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ],
    select: { opening_balance: true }
  });

  if (nextEntry) {
    return parseFloat(nextEntry.opening_balance || 0);
  }

  const customer = await tx.customer.findUnique({
    where: { cus_id },
    select: { cus_balance: true }
  });
  return parseFloat(customer?.cus_balance || 0);
}

/** Helper to build a comprehensive WHERE clause matching all ledger entries associated with a purchase bill. */
function getPurchaseLedgerWhere(id) {
  const purIdStr = String(id);
  return {
    OR: [
      { bill_no: purIdStr },
      { bill_no: `PUR-${purIdStr}` },
      { bill_no: `PURCHASE-${purIdStr}` },
      { bill_no: `INC-${purIdStr}` },
      { bill_no: `incity-${purIdStr}` },
      { details: { contains: `Purchase #${purIdStr}` } },
      { details: { contains: `Purchase Update #${purIdStr}` } },
      { details: { contains: `Purchase Return #${purIdStr}` } }
    ]
  };
}

/** Prepares a list of ledger entries about to be deleted by re-linking any subsequent entries to preserve the starting opening balance. */
async function prepareLedgerDeletion(tx, bill_no) {
  const entriesToDelete = await tx.ledger.findMany({
    where: getPurchaseLedgerWhere(bill_no),
    orderBy: { l_id: 'asc' }
  });

  const accountEntries = {};
  for (const entry of entriesToDelete) {
    if (!accountEntries[entry.cus_id]) {
      accountEntries[entry.cus_id] = [];
    }
    accountEntries[entry.cus_id].push(entry);
  }

  for (const cusIdStr in accountEntries) {
    const cus_id = parseInt(cusIdStr);
    const deletedForAccount = accountEntries[cus_id];
    
    deletedForAccount.sort((a, b) => {
      const timeDiff = a.created_at.getTime() - b.created_at.getTime();
      return timeDiff !== 0 ? timeDiff : a.l_id - b.l_id;
    });

    const earliestDeleted = deletedForAccount[0];
    const latestDeleted = deletedForAccount[deletedForAccount.length - 1];

    const nextEntry = await tx.ledger.findFirst({
      where: {
        cus_id,
        bill_no: { notIn: [String(bill_no), `PUR-${bill_no}`, `PURCHASE-${bill_no}`, `INC-${bill_no}`, `incity-${bill_no}`] },
        OR: [
          { created_at: { gt: latestDeleted.created_at } },
          {
            created_at: latestDeleted.created_at,
            l_id: { gt: latestDeleted.l_id }
          }
        ]
      },
      orderBy: [
        { created_at: 'asc' },
        { l_id: 'asc' }
      ]
    });

    if (nextEntry) {
      await tx.ledger.update({
        where: { l_id: nextEntry.l_id },
        data: { opening_balance: earliestDeleted.opening_balance }
      });
      console.log(`🔗 Re-linked next ledger entry for customer ${cus_id}: updated entry ${nextEntry.l_id} opening balance to ${earliestDeleted.opening_balance}`);
    }
  }
}


/** Chronologically recalculates all ledger entry opening/closing balances for a customer/supplier/account and updates their customer table balance. */
async function recalculateLedgerBalances(tx, cus_id) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    include: { customer_category: true }
  });
  if (!customer) return;

  const categoryTitle = (customer.customer_category?.cus_cat_title || '').toLowerCase();

  const entries = await tx.ledger.findMany({
    where: { cus_id },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  // Re-sort in JS: created_at ASC → bill_no (numeric) ASC → l_id ASC
  // This is critical for PUT (edit) operations: when entries are deleted and
  // re-created, the new auto-increment l_id values are higher than subsequent
  // bills' entries, which would put the edited bill at the END of the chain.
  // Sorting by bill_no (numeric) as secondary key preserves original position.
  entries.sort((a, b) => {
    const timeDiff = a.created_at.getTime() - b.created_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  let runningBalance = 0;
  const updates = [];
  if (entries.length > 0) {
    runningBalance = parseFloat(entries[0].opening_balance || 0);
    
    for (const entry of entries) {
      const opening = runningBalance;
      const debit = parseFloat(entry.debit_amount || 0);
      const credit = parseFloat(entry.credit_amount || 0);
      
      let change = 0;
      if (categoryTitle.includes('cash') || categoryTitle.includes('bank')) {
        change = debit - credit;
      } else {
        change = debit - credit;
      }
      const closing = opening + change;

      if (
        Math.abs(parseFloat(entry.opening_balance) - opening) > 0.01 ||
        Math.abs(parseFloat(entry.closing_balance) - closing) > 0.01
      ) {
        updates.push(
          tx.ledger.update({
            where: { l_id: entry.l_id },
            data: {
              opening_balance: Number(opening.toFixed(2)),
              closing_balance: Number(closing.toFixed(2))
            }
          })
        );
      }
      runningBalance = closing;
    }
  }

  if (updates.length > 0) {
    const client = typeof tx.$transaction === 'function' ? tx : prisma;
    await client.$transaction(updates);
  }

  await tx.customer.update({
    where: { cus_id },
    data: { cus_balance: Number(runningBalance.toFixed(2)) }
  });
  console.log(`   📊 Recalculated ledger for ${customer.cus_name} (ID: ${cus_id}). Final balance: ${runningBalance.toFixed(2)} (${updates.length} entries updated in batch)`);
}

/** Run full ledger chain recalc without blocking the HTTP response (same pattern as sales PUT). */
function scheduleLedgerRecalc(cusIds) {
  const uniqueIds = [...new Set((cusIds || []).filter((id) => id != null))];
  if (uniqueIds.length === 0) return;
  void Promise.all(uniqueIds.map((cid) => recalculateLedgerBalances(prisma, cid))).catch((err) => {
    console.error('Background ledger recalc after purchase operation failed:', err);
  });
}

/** Persist ledger rows with one MAX(l_id) query instead of one per row. */
async function persistLedgerEntries(tx, ledgerEntries, options = {}) {
  const { entryCreatedAt = null } = options;
  if (!ledgerEntries?.length) return;

  let nextLId = await getNextId('ledger', 'l_id', tx);
  for (const entry of ledgerEntries) {
    await tx.ledger.create({
      data: {
        l_id: nextLId++,
        cus_id: entry.cus_id,
        opening_balance: entry.opening_balance,
        debit_amount: entry.debit_amount,
        credit_amount: entry.credit_amount,
        closing_balance: entry.closing_balance,
        bill_no: entry.bill_no,
        trnx_type: entry.trnx_type,
        details: entry.details,
        payments: entry.payments,
        cash_payment: entry.cash_payment,
        bank_payment: entry.bank_payment,
        updated_by: entry.updated_by,
        ledger_type: entry.ledger_type,
        ...(entryCreatedAt ? { created_at: entryCreatedAt } : {})
      }
    });
  }
}

// ========================================
// GET — Get all purchases or one purchase
// ========================================
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // optional: ?id=1
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : null;
  const invoice = searchParams.get('invoice');

  try {
    if (id) {
      let purchase = await prisma.purchase.findUnique({
        where: { pur_id: id },
        include: {
          customer: true,
          cargo_account: true,
          store: true,
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              role: true
            }
          },
          purchase_details: {
            include: {
              product: {
                select: {
                  pro_id: true,
                  pro_title: true,
                  pro_unit: true
                }
              }
            }
          }
        }
      });

      if (!purchase) {
        purchase = await prisma.purchase.findFirst({
          where: { invoice_number: String(id) },
          include: {
            customer: true,
            cargo_account: true,
            store: true,
            updated_by_user: {
              select: {
                user_id: true,
                full_name: true,
                role: true
              }
            },
            purchase_details: {
              include: {
                product: {
                  select: {
                    pro_id: true,
                    pro_title: true,
                    pro_unit: true
                  }
                }
              }
            }
          }
        });
      }

      if (!purchase) {
        return errorResponse('Purchase not found', 404);
      }

      // Calculate previous customer balance (closing balance of the last ledger entry before this purchase)
      let previousCustomerBalance = 0;
      try {
        const lastLedgerBefore = await prisma.ledger.findFirst({
          where: { cus_id: purchase.cus_id, created_at: { lt: purchase.created_at } },
          orderBy: { created_at: 'desc' },
          select: { closing_balance: true }
        });
        previousCustomerBalance = lastLedgerBefore ? parseFloat(lastLedgerBefore.closing_balance || 0) : 0;
      } catch (err) {
        console.warn('Could not compute previous customer balance for purchase', purchase.pur_id, err.message);
      }

      // Find bank account ID from ledger entries for this purchase
      let bankAccountId = null;
      try {
        const bankLedgerEntry = await prisma.ledger.findFirst({
          where: {
            bill_no: String(purchase.pur_id),
            customer: {
              customer_category: { cus_cat_title: { contains: 'bank' } },
              customer_type: { cus_type_title: { contains: 'bank' } }
            }
          },
          select: { cus_id: true }
        });
        if (bankLedgerEntry) {
          bankAccountId = bankLedgerEntry.cus_id;
        } else if (parseFloat(purchase.bank_payment || 0) > 0) {
          // Fallback if no ledger entry found but bank_payment > 0, check if credit_account_id is a bank account
          const creditAcc = await prisma.customer.findUnique({
            where: { cus_id: purchase.credit_account_id || 0 },
            include: { customer_category: true, customer_type: true }
          });
          if (creditAcc &&
              (creditAcc.customer_category?.cus_cat_title.toLowerCase().includes('bank') ||
               creditAcc.customer_type?.cus_type_title.toLowerCase().includes('bank'))) {
            bankAccountId = purchase.credit_account_id;
          }
        }
      } catch (err) {
        console.warn('Could not compute bank account ID for purchase', purchase.pur_id, err.message);
      }

      const purchaseWithPrev = Object.assign({}, purchase, { 
        previous_customer_balance: previousCustomerBalance,
        bank_account_id: bankAccountId
      });
      return NextResponse.json(purchaseWithPrev);
    }

    if (invoice) {
      const purchase = await prisma.purchase.findFirst({
        where: { invoice_number: invoice },
        include: {
          customer: true,
          cargo_account: true,
          store: true,
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              role: true
            }
          },
          purchase_details: {
            include: {
              product: {
                select: {
                  pro_id: true,
                  pro_title: true,
                  pro_unit: true
                }
              }
            }
          }
        }
      });

      if (!purchase) {
        return errorResponse('Purchase not found', 404);
      }

      // Calculate previous customer balance (closing balance of the last ledger entry before this purchase)
      let previousCustomerBalance = 0;
      try {
        const lastLedgerBefore = await prisma.ledger.findFirst({
          where: { cus_id: purchase.cus_id, created_at: { lt: purchase.created_at } },
          orderBy: { created_at: 'desc' },
          select: { closing_balance: true }
        });
        previousCustomerBalance = lastLedgerBefore ? parseFloat(lastLedgerBefore.closing_balance || 0) : 0;
      } catch (err) {
        console.warn('Could not compute previous customer balance for purchase (invoice lookup)', purchase.pur_id, err.message);
      }

      // Find bank account ID from ledger entries for this purchase
      let bankAccountId = null;
      try {
        const bankLedgerEntry = await prisma.ledger.findFirst({
          where: {
            bill_no: String(purchase.pur_id),
            customer: {
              customer_category: { cus_cat_title: { contains: 'bank' } },
              customer_type: { cus_type_title: { contains: 'bank' } }
            }
          },
          select: { cus_id: true }
        });
        if (bankLedgerEntry) {
          bankAccountId = bankLedgerEntry.cus_id;
        } else if (parseFloat(purchase.bank_payment || 0) > 0) {
          const creditAcc = await prisma.customer.findUnique({
            where: { cus_id: purchase.credit_account_id || 0 },
            include: { customer_category: true, customer_type: true }
          });
          if (creditAcc &&
              (creditAcc.customer_category?.cus_cat_title.toLowerCase().includes('bank') ||
               creditAcc.customer_type?.cus_type_title.toLowerCase().includes('bank'))) {
            bankAccountId = purchase.credit_account_id;
          }
        }
      } catch (err) {
        console.warn('Could not compute bank account ID for purchase (invoice lookup)', purchase.pur_id, err.message);
      }

      const purchaseWithPrev = Object.assign({}, purchase, { 
        previous_customer_balance: previousCustomerBalance,
        bank_account_id: bankAccountId
      });
      return NextResponse.json(purchaseWithPrev);
    }

    const findOptions = {
      include: {
        customer: {
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true
          }
        },
        cargo_account: {
          select: { cus_id: true, cus_name: true, cus_phone_no: true }
        },
        store: {
          select: {
            storeid: true,
            store_name: true,
            store_address: true
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        },
        purchase_details: {
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    };

    if (limit && limit > 0) {
      findOptions.take = limit;
    }

    const purchases = await prisma.purchase.findMany(findOptions);

    // Resolve bank account ID for each purchase in list
    const purchaseIds = purchases.map(p => String(p.pur_id));
    let bankLedgerEntries = [];
    try {
      bankLedgerEntries = await prisma.ledger.findMany({
        where: {
          bill_no: { in: purchaseIds },
          customer: {
            customer_category: { cus_cat_title: { contains: 'bank' } },
            customer_type: { cus_type_title: { contains: 'bank' } }
          }
        },
        select: { bill_no: true, cus_id: true }
      });
    } catch (err) {
      console.warn('Could not load bank ledger entries for purchase list', err.message);
    }

    const bankAccountMap = {};
    bankLedgerEntries.forEach(entry => {
      bankAccountMap[entry.bill_no] = entry.cus_id;
    });

    const enhancedPurchases = purchases.map(p => {
      let resolvedBankAccountId = bankAccountMap[String(p.pur_id)] || null;
      if (!resolvedBankAccountId && parseFloat(p.bank_payment || 0) > 0) {
        resolvedBankAccountId = p.credit_account_id;
      }
      return Object.assign({}, p, { bank_account_id: resolvedBankAccountId });
    });

    return NextResponse.json(enhancedPurchases);
  } catch (err) {
    console.error('❌ Error fetching purchases:', err);
    return errorResponse('Failed to fetch purchases', 500);
  }
}

// ========================================
// POST — Create a new purchase
// ========================================
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      cus_id,
      store_id,
      debit_account_id,
      total_amount,
      unloading_amount = 0,
      fare_amount = 0,
      transport_amount = 0,
      labour_amount = 0,
      // Cargo / Out charges
      out_labour_amount = 0,
      out_delivery_amount = 0,
      include_cargo_in_costprice = false,
      // Incity fields
      incity_own_labour = 0,
      incity_own_delivery = 0,
      incity_charges_total = 0,
      discount = 0,
      payment,
      payment_type,
      cash_payment = 0,
      bank_payment = 0,
      vehicle_no,
      invoice_number,
      updated_by,
      cargo_account_id = null,
      cargo_account_ids = null,
      purchase_type = 'new',
      return_for_purchase_id = null,
      purchase_details = [],
      bank_account_id = null
    } = body;

    // Ensure bank_account_id is always a proper integer (or null)
    const bankAccountIdInt = bank_account_id ? parseInt(bank_account_id) : null;

    let { credit_account_id } = body;
    const creditAccountIdInt = credit_account_id ? parseInt(credit_account_id) : null;

    console.log('🏦 PURCHASE POST - Payment fields received:', {
      cash_payment, bank_payment,
      bank_account_id, bankAccountIdInt,
      credit_account_id, creditAccountIdInt,
      payment_type
    });

    // Helper function to safely parse numbers and avoid NaN
    const safeParseFloat = (value, defaultValue = 0) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const safeParseInt = (value, defaultValue = null) => {
      const parsed = parseInt(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Validation for required fields
    if (!cus_id) {
      return errorResponse('Customer ID is required');
    }
    if (!total_amount || total_amount <= 0) {
      return errorResponse('Total amount is required and must be greater than 0');
    }

    // Validate store_id exists to avoid FK constraint errors (e.g. stale localStorage draft)
    if (store_id) {
      const storeExists = await prisma.store.findUnique({ where: { storeid: safeParseInt(store_id) } });
      if (!storeExists) {
        return errorResponse(`Store ID ${store_id} not found. Please refresh and reselect the store.`, 400);
      }
    }

    // Validate payment amounts
    const cashPaymentAmount = safeParseFloat(cash_payment);
    const bankPaymentAmount = safeParseFloat(bank_payment);
    const totalPaymentAmount = cashPaymentAmount + bankPaymentAmount;

    if (totalPaymentAmount < 0) {
      return errorResponse('Total payment amount must be non-negative');
    }

    // Determine payment type based on split payments
    // Note: Using BANK_TRANSFER for split payments since SPLIT is not in PaymentType enum
    let actualPaymentType = 'CASH';
    let isSplitPayment = false;

    if (cashPaymentAmount > 0 && bankPaymentAmount > 0) {
      actualPaymentType = 'BANK_TRANSFER'; // Use BANK_TRANSFER for split payments
      isSplitPayment = true;
    } else if (bankPaymentAmount > 0) {
      actualPaymentType = 'BANK_TRANSFER';
    }

    console.log('💳 Payment Type Logic:', {
      frontend_payment_type: payment_type,
      cashPaymentAmount,
      bankPaymentAmount,
      actualPaymentType,
      isSplitPayment
    });

    // Validate that we have a valid payment type (we'll use actualPaymentType for the database)
    if (!actualPaymentType || !['CASH', 'CHEQUE', 'BANK_TRANSFER'].includes(actualPaymentType)) {
      return errorResponse('Valid payment type is required (CASH, CHEQUE, BANK_TRANSFER)');
    }

    // Calculate net total: product subtotal + internal charges (unloading, fare, transport, labour) - discount
    // OUT charges (out_labour/out_delivery) are treated as external and should NOT be included in the supplier-facing net_total
    const net_total = safeParseFloat(total_amount) + safeParseFloat(unloading_amount) + safeParseFloat(fare_amount) + safeParseFloat(transport_amount) + safeParseFloat(labour_amount) - safeParseFloat(discount);

    // Update payment amount to use total payment from split payments
    // payment is now calculated as totalPaymentAmount

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { cus_id }
    });

    if (!customer) {
      return errorResponse('Customer not found', 404);
    }

    // Ensure special accounts exist before transaction
    if (actualPaymentType === 'CASH' && cashPaymentAmount > 0) {
      // Find Cash Account by category, not by exact name
      const cashCategory = await prisma.customerCategory.findFirst({
        where: { cus_cat_title: 'Cash Account' }
      });

      let cashAccount = null;
      if (cashCategory) {
        cashAccount = await prisma.customer.findFirst({
          where: { cus_category: cashCategory.cus_cat_id }
        });
      }

      console.log('🔍 Cash Account search result (pre-transaction):', {
        found: !!cashAccount,
        cashAccount: cashAccount ? { id: cashAccount.cus_id, name: cashAccount.cus_name, category: cashCategory?.cus_cat_title } : null,
        credit_account_id_from_frontend: credit_account_id
      });

      if (!cashAccount && cashCategory) {
        // Get the cash type from database
        const cashType = await prisma.customerType.findFirst({
          where: { cus_type_title: 'cash' }
        });

        if (cashType) {
          const nextCusId = await getNextId('customer', 'cus_id');
          cashAccount = await prisma.customer.create({
            data: {
              cus_id: nextCusId,
              cus_name: 'Cash Account',
              cus_phone_no: '0000000000',
              cus_address: 'Main Office',
              cus_balance: 0,
              cus_type: cashType.cus_type_id,
              cus_category: cashCategory.cus_cat_id,
              city_id: 1, // Default city
              updated_by: updated_by ? parseInt(updated_by) : null
            }
          });
          console.log('✅ Created Cash Account (pre-transaction):', cashAccount);
        }
      }

      if (cashAccount) {
        credit_account_id = cashAccount.cus_id;
        console.log('✅ Using Cash Account ID (pre-transaction):', credit_account_id);
      }
    }

    // Create purchase with details and ledger entries in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Determine if this is a return (do this first so it can be used throughout)
      const isReturn = purchase_type === 'return';

      // Get customer's current balance
      const customerData = await tx.customer.findUnique({
        where: { cus_id },
        select: { cus_balance: true }
      });

      const currentBalance = parseFloat(customerData?.cus_balance || 0);


      console.log('🔍 Purchase data before parsing:', {
        cus_id,
        store_id,
        debit_account_id,
        credit_account_id,
        total_amount,
        unloading_amount,
        fare_amount,
        transport_amount,
        labour_amount,
        discount,
        net_total,
        payment,
        payment_type,
        vehicle_no,
        invoice_number,
        updated_by
      });

      // Prepare the data object for purchase creation
      const purchaseData = {
        cus_id: parseInt(cus_id),
        store_id: store_id ? safeParseInt(store_id) : null,
        debit_account_id: debit_account_id ? safeParseInt(debit_account_id) : null,
        credit_account_id: credit_account_id ? safeParseInt(credit_account_id) : null,
        total_amount: Number(safeParseFloat(total_amount).toFixed(2)),
        unloading_amount: Number(safeParseFloat(unloading_amount).toFixed(2)),
        fare_amount: Number(safeParseFloat(fare_amount).toFixed(2)),
        transport_amount: Number(safeParseFloat(transport_amount).toFixed(2)),
        labour_amount: Number(safeParseFloat(labour_amount).toFixed(2)),
        out_labour_amount: Number(safeParseFloat(out_labour_amount).toFixed(2)),
        out_delivery_amount: Number(safeParseFloat(out_delivery_amount).toFixed(2)),
        include_cargo_in_costprice: include_cargo_in_costprice ? true : false,
        // Incity fields
        incity_own_labour: Number(safeParseFloat(incity_own_labour).toFixed(2)),
        incity_own_delivery: Number(safeParseFloat(incity_own_delivery).toFixed(2)),
        incity_charges_total: Number(safeParseFloat(incity_charges_total).toFixed(2)),
        discount: Number(safeParseFloat(discount).toFixed(2)),
        cargo_account_id: cargo_account_id ? safeParseInt(cargo_account_id) : null,
        cargo_account_ids: cargo_account_ids ? (Array.isArray(cargo_account_ids) ? JSON.stringify(cargo_account_ids) : String(cargo_account_ids)) : null,
        net_total: Number(safeParseFloat(net_total).toFixed(2)),
        payment: Number(totalPaymentAmount.toFixed(2)),
        payment_type: actualPaymentType,
        cash_payment: Number(cashPaymentAmount.toFixed(2)),
        bank_payment: Number(bankPaymentAmount.toFixed(2)),
        bank_title: isSplitPayment && bankPaymentAmount > 0 ? 'Bank Payment' : null,
        vehicle_no: vehicle_no || null,
        invoice_number: invoice_number || null,
        updated_by: updated_by ? safeParseInt(updated_by) : null
      };

      console.log('🔍 Processed purchase data:', purchaseData);

      // Create the purchase using the prepared data
      const newPurchase = await tx.purchase.create({
        data: purchaseData
      });

      // Create purchase details if provided
      if (purchase_details && purchase_details.length > 0) {
        console.log('🔍 Processing purchase details:', purchase_details);

        const detailsData = purchase_details.map(detail => {
          const processedDetail = {
            pur_id: newPurchase.pur_id,
            vehicle_no: vehicle_no || null,
            cus_id: parseInt(cus_id),
            pro_id: safeParseInt(detail.pro_id, 0),
            qnty: Number(safeParseFloat(detail.qnty || detail.quantity, 1).toFixed(2)),
            unit: detail.unit || 'pcs',
            unit_rate: Number(safeParseFloat(detail.unit_rate || detail.rate).toFixed(2)),
            prate: Number(safeParseFloat(detail.prate || detail.unit_rate || detail.rate).toFixed(2)),
            crate: Number(safeParseFloat(detail.crate != null && detail.crate !== '' ? detail.crate : 0).toFixed(2)),
            total_amount: Number(safeParseFloat(detail.total_amount).toFixed(2)),
            net_total: Number(safeParseFloat(detail.total_amount).toFixed(2)), // Use total_amount as net_total for now
            updated_by: updated_by ? safeParseInt(updated_by) : null
          };

          console.log('🔍 Processed detail:', processedDetail);
          return processedDetail;
        });

        await tx.purchaseDetail.createMany({
          data: detailsData
        });
        // Update store stock for each product using per-detail store_id (fallback to purchase-level store_id)
        const storeStockUpdatePromises = purchase_details.map(async (detail, index) => {
          const detailStoreId = detail.store_id || store_id;
          if (!detailStoreId) return;
          const stockOperation = isReturn ? 'decrement' : 'increment';
          await updateStoreStock(detailStoreId, detailsData[index].pro_id, detailsData[index].qnty, stockOperation, updated_by, tx);
        });
        await Promise.all(storeStockUpdatePromises);

        // Update product table sale rate (pro_sale_price), cost rate (pro_cost_price), and purchase rate (pro_crate)
        const productUpdatePromises = purchase_details.map(async (detail) => {
          const proId = safeParseInt(detail.pro_id, 0);
          const saleRate = safeParseFloat(detail.unit_rate || detail.sale_rate || detail.pro_sale_price || detail.rate, 0);
          const costRate = safeParseFloat(detail.cost_rate || detail.original_cost_rate, 0);
          const purchaseRate = safeParseFloat(detail.crate != null && detail.crate !== '' ? detail.crate : 0, 0);

          if (proId > 0) {
            const updateData = {};
            if (saleRate > 0) updateData.pro_sale_price = Number(saleRate.toFixed(2));
            if (costRate > 0) updateData.pro_cost_price = Number(costRate.toFixed(2));
            if (purchaseRate > 0) updateData.pro_crate = Number(purchaseRate.toFixed(2));

            if (Object.keys(updateData).length > 0) {
              await tx.product.update({
                where: { pro_id: proId },
                data: updateData
              });
              console.log(`🏷️ Updated product ${proId} rates in DB:`, updateData);
            }
          }
        });
        await Promise.all(productUpdatePromises);
      }

      // All entries use RECEIVABLE formula: closing = opening + debit - credit
      //   Supplier purchase = CREDIT (0 - 5000 = -5000, balance negative = we owe)
      //   Supplier payment  = DEBIT  (-5000 + 4000 = -1000, balance rises toward 0)
      //   Supplier cargo    = DEBIT  (-1000 + 1000 = 0, cargo deducted from payable)
      //   Cash/bank payment = CREDIT (balance decreases when we pay out)
      //   Cargo account     = CREDIT (we owe them for transport)
      // NOTE: Only product amount (minus discount) goes to supplier ledger

      const ledgerEntries = [];
      let runningSupplierBalance = 0;

      // Calculate supplier amount — EXCLUDE OUT charges (Out labour/Out delivery are not billed to supplier)
      const supplierAmount = safeParseFloat(total_amount) - safeParseFloat(discount) + safeParseFloat(labour_amount) + safeParseFloat(transport_amount);

      // 1. Supplier Account Entry — includes product + labour + delivery (OUT charges are NOT included)
      if (cus_id) {
        runningSupplierBalance = await resolveOpeningBalance(tx, cus_id, newPurchase.created_at);
        const supplierData = await tx.customer.findUnique({ where: { cus_id: cus_id }, select: { cus_name: true } });

        console.log(`\n📊 PURCHASE LEDGER ENTRY DEBUG`);
        console.log(`   Supplier: ${supplierData?.cus_name} (ID: ${cus_id})`);
        console.log(`   Opening Balance: ${runningSupplierBalance}`);
        console.log(`   Bill Amount (products + labour + delivery) [OUT charges excluded]: ${supplierAmount}${safeParseFloat(discount) > 0 ? ` (After Discount: ${safeParseFloat(discount)})` : ''}`);

        const supplierEntry = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: isReturn ? supplierAmount : 0,
          credit_amount: isReturn ? 0 : supplierAmount,
          bill_no: newPurchase.pur_id.toString(),
          trnx_type: isReturn ? 'DEBIT' : 'CREDIT',
          details: `${isReturn ? 'Purchase Return' : 'Purchase Invoice'}${invoice_number ? ` #${invoice_number}` : ''} ${isReturn ? 'to' : 'from'} ${supplierData?.cus_name || 'Supplier'}${vehicle_no ? ` - Vehicle: ${vehicle_no}` : ''}${safeParseFloat(discount) > 0 ? ` [After Discount: ${safeParseFloat(discount)}]` : ''}`,
          payments: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(supplierEntry);
        runningSupplierBalance = supplierEntry.closing_balance;

        console.log(`📝 Supplier Entry Created: Opening=${supplierEntry.opening_balance}, Debit=${supplierEntry.debit_amount}, Closing=${supplierEntry.closing_balance}`);
        console.log(`   Note: OUT charges will NOT be credited to the supplier; they are posted to Labour/Cargo and offset against Cash/Bank.`);
      }

      // 2. Payment entry against Supplier: DEBIT raises balance toward 0 (receivable formula)
      const totalPaymentAmount2 = cashPaymentAmount + bankPaymentAmount;

      if (totalPaymentAmount2 > 0) {
        const supplierData = await tx.customer.findUnique({
          where: { cus_id: cus_id },
          select: { cus_name: true }
        });

        let bankNameForDesc = null;
        if (bankPaymentAmount > 0 && bankAccountIdInt) {
          bankNameForDesc = (await tx.customer.findUnique({ where: { cus_id: bankAccountIdInt }, select: { cus_name: true } }))?.cus_name || null;
        }

        const paymentParts = [];
        if (cashPaymentAmount > 0) paymentParts.push(`${cashPaymentAmount.toLocaleString('en-PK')} Cash Account`);
        if (bankPaymentAmount > 0) paymentParts.push(`${bankPaymentAmount.toLocaleString('en-PK')} Bank Account (${bankNameForDesc || 'Bank'})`);
        const paymentBreakdown = paymentParts.join(' + ');

        const paymentEntry = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: isReturn ? 0 : totalPaymentAmount2,
          credit_amount: isReturn ? totalPaymentAmount2 : 0,
          bill_no: newPurchase.pur_id.toString(),
          trnx_type: isReturn ? 'CREDIT' : 'DEBIT',
          details: `${isReturn ? 'Payment received from' : 'Payment to'} ${supplierData?.cus_name || 'Supplier'} — ${paymentBreakdown}`,
          payments: totalPaymentAmount2,
          cash_payment: cashPaymentAmount,
          bank_payment: bankPaymentAmount,
          updated_by: updated_by ? parseInt(updated_by) : null
        });
        ledgerEntries.push(paymentEntry);
        runningSupplierBalance = paymentEntry.closing_balance;
        console.log(`💳 Payment Entry: Opening=${paymentEntry.opening_balance}, Debit=${paymentEntry.debit_amount}, Credit=${paymentEntry.credit_amount}, Closing=${paymentEntry.closing_balance}`);
      }

      // 3. Bank Account - CREDIT (when bank payment is made)
      // When bank payment is made, bank account balance DECREASES (credit decreases asset)
      let usedBankAccountId = null;  // Track which bank account is being used

      if (parseFloat(bank_payment || 0) > 0) {
        let bankAccountToUse = null;

        console.log(`🏦 DEBUG: bank_account_id=${bankAccountIdInt}, credit_account_id=${creditAccountIdInt}, cash=${cashPaymentAmount}, bank=${bankPaymentAmount}`);

        // Primary: use bank_account_id if provided
        if (bankAccountIdInt) {
          const specificBank = await tx.customer.findUnique({
            where: { cus_id: bankAccountIdInt }
          });
          if (specificBank) {
            bankAccountToUse = specificBank;
            console.log(`🏦 Found via bank_account_id: ${specificBank.cus_name} (ID: ${specificBank.cus_id})`);
          } else {
            console.log(`⚠️ bank_account_id ${bankAccountIdInt} not found in customers`);
          }
        }

        // Fallback: for pure bank payment (no cash), credit_account_id IS the bank account
        if (!bankAccountToUse && cashPaymentAmount === 0 && creditAccountIdInt) {
          const fallbackBank = await tx.customer.findUnique({
            where: { cus_id: creditAccountIdInt }
          });
          if (fallbackBank) {
            bankAccountToUse = fallbackBank;
            console.log(`🏦 Fallback via credit_account_id: ${fallbackBank.cus_name} (ID: ${fallbackBank.cus_id})`);
          }
        }

        if (!bankAccountToUse) {
          console.log(`⚠️ No bank account resolved. bank_account_id=${bankAccountIdInt}, credit_account_id=${creditAccountIdInt}`);
        }

        if (bankAccountToUse) {
          usedBankAccountId = bankAccountToUse.cus_id;
          console.log(`🏦 BANK PAYMENT DETECTED: ${bank_payment}`);
          
          const bankOpeningBalance = await resolveOpeningBalance(tx, bankAccountToUse.cus_id, newPurchase.created_at);
          console.log(`🏦 Bank Account Before: ID=${bankAccountToUse.cus_id}, Name=${bankAccountToUse.cus_name}, Resolved Balance=${bankOpeningBalance}`);

          const supplierForPayment = await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } });

          const bankEntry = createLedgerEntry({
            cus_id: bankAccountToUse.cus_id,
            opening_balance: bankOpeningBalance,
            debit_amount: isReturn ? parseFloat(bank_payment) : 0,
            credit_amount: isReturn ? 0 : parseFloat(bank_payment),
            bill_no: newPurchase.pur_id.toString(),
            trnx_type: isReturn ? 'DEBIT' : 'CREDIT',
            details: `${isReturn ? 'Refund from' : 'Payment to'} ${supplierForPayment?.cus_name || 'Supplier'} — Bank Account (${bankAccountToUse.cus_name})`,
            payments: parseFloat(bank_payment),
            cash_payment: 0,
            bank_payment: parseFloat(bank_payment),
            updated_by: updated_by ? parseInt(updated_by) : null
          });
          console.log(`🏦 Bank Ledger Entry: Opening=${bankEntry.opening_balance}, Credit=${bankEntry.credit_amount}, Closing=${bankEntry.closing_balance}`);
          ledgerEntries.push(bankEntry);
        } else {
          console.log(`⚠️ ERROR: Bank payment of ${bank_payment} requested but no valid bank account found`);
        }
      }

      // 4. Cash Account Entry (if cash payment exists)
      // Resolve cash account — never use the supplier ID as cash account
      const resolvedCashAccountId = (creditAccountIdInt && creditAccountIdInt !== cus_id) ? creditAccountIdInt : null;
      const effectiveCashAccountId = resolvedCashAccountId || await (async () => {
        const cashCat = await tx.customerCategory.findFirst({ where: { cus_cat_title: { contains: 'Cash' } } });
        if (!cashCat) return null;
        const acc = await tx.customer.findFirst({ where: { cus_category: cashCat.cus_cat_id }, select: { cus_id: true } });
        return acc?.cus_id || null;
      })();

      if (cashPaymentAmount > 0 && effectiveCashAccountId) {
        const cashAccountData = await tx.customer.findUnique({
          where: { cus_id: effectiveCashAccountId },
          select: { cus_name: true }
        });
        const cashOpeningBalance = await resolveOpeningBalance(tx, effectiveCashAccountId, newPurchase.created_at);

        console.log(`💵 CASH PAYMENT DETECTED: ${cashPaymentAmount}`);
        console.log(`💵 Cash Account Before: ID=${effectiveCashAccountId}, Name=${cashAccountData?.cus_name}, Resolved Balance=${cashOpeningBalance}`);

        const supplierForPaymentCash = await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } });

        const cashEntry = createLedgerEntry({
          cus_id: effectiveCashAccountId,
          opening_balance: cashOpeningBalance,
          debit_amount: isReturn ? cashPaymentAmount : 0,
          credit_amount: isReturn ? 0 : cashPaymentAmount,
          bill_no: newPurchase.pur_id.toString(),
          trnx_type: isReturn ? 'DEBIT' : 'CREDIT',
          details: `${isReturn ? 'Cash Refund from' : 'Payment to'} ${supplierForPaymentCash?.cus_name || 'Supplier'} — Cash Account${vehicle_no ? ` (Vehicle: ${vehicle_no})` : ''}`,
          payments: cashPaymentAmount,
          cash_payment: cashPaymentAmount,
          bank_payment: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(cashEntry);
        console.log(`💵 Cash Account Entry Created: Opening=${cashEntry.opening_balance}, Debit=${cashEntry.debit_amount}, Credit=${cashEntry.credit_amount}, Closing=${cashEntry.closing_balance}`);
      }

      // --- CARGO / OUT CHARGES LEDGER POSTINGS ---
      const outDeliveryAmt = safeParseFloat(out_delivery_amount || 0);
      const outLabourAmt = safeParseFloat(out_labour_amount || 0);
      const totalOutCharges = outDeliveryAmt + outLabourAmt;

      // Supplier DEBIT for out charges — cargo/delivery added to supplier payable balance.
      if (totalOutCharges > 0 && cus_id) {
        const supplierForOut = await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } });
        const outParts = [];
        if (outDeliveryAmt > 0) outParts.push(`Delivery: ${outDeliveryAmt}`);
        if (outLabourAmt > 0) outParts.push(`Labour: ${outLabourAmt}`);

        const supplierOutDebit = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: totalOutCharges,
          credit_amount: 0,
          bill_no: newPurchase.pur_id.toString(),
          trnx_type: 'DEBIT',
          details: `Cargo/Out Charges added to ${supplierForOut?.cus_name || 'Supplier'} — ${outParts.join(' + ')} - Purchase #${newPurchase.pur_id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
          payments: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });
        ledgerEntries.push(supplierOutDebit);
        runningSupplierBalance = supplierOutDebit.closing_balance;
        console.log(`📦 Supplier cargo debit: ${supplierForOut?.cus_name} credited ${totalOutCharges} (added to supplier balance)`);
      }

      // Debit cargo accounts for out_delivery
      if (outDeliveryAmt > 0) {
        let cargoIds = [];
        try {
          if (cargo_account_ids) {
            cargoIds = Array.isArray(cargo_account_ids) ? cargo_account_ids : JSON.parse(cargo_account_ids || '[]');
          } else if (cargo_account_id) {
            cargoIds = [cargo_account_id];
          }
        } catch (err) {
          cargoIds = cargo_account_ids ? (Array.isArray(cargo_account_ids) ? cargo_account_ids : [cargo_account_ids]) : (cargo_account_id ? [cargo_account_id] : []);
        }
        if (cargoIds.length === 0 && cargo_account_id) cargoIds = [cargo_account_id];

        if (cargoIds.length > 0) {
          const perAccount = parseFloat((outDeliveryAmt / cargoIds.length).toFixed(2));
          let remainder = parseFloat((outDeliveryAmt - (perAccount * cargoIds.length)).toFixed(2));

          for (let i = 0; i < cargoIds.length; i++) {
            const aid = parseInt(cargoIds[i]);
            const cargoAcc = await tx.customer.findUnique({ where: { cus_id: aid }, select: { cus_id: true, cus_name: true } });
            if (!cargoAcc) { console.log(`⚠️ Cargo account ID ${aid} not found — skipping`); continue; }

            let allocate = perAccount;
            if (i === 0) allocate = parseFloat((perAccount + remainder).toFixed(2));

            const cargoOpeningBalance = await resolveOpeningBalance(tx, cargoAcc.cus_id, newPurchase.created_at);
            const cargoEntry = createLedgerEntry({
              cus_id: cargoAcc.cus_id,
              opening_balance: cargoOpeningBalance,
              debit_amount: 0,
              credit_amount: allocate,
              bill_no: newPurchase.pur_id.toString(),
              trnx_type: 'CREDIT',
              details: `Out Delivery - Purchase #${newPurchase.pur_id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
              payments: 0,
              updated_by: updated_by ? parseInt(updated_by) : null
            });
            ledgerEntries.push(cargoEntry);
            console.log(`📦 Cargo account ${cargoAcc.cus_name} credited ${allocate}`);
          }
        } else {
          console.log('⚠️ Out delivery present but no cargo account selected — supplier already credited, cargo credit skipped');
        }
      }

      // Debit labour account for out_labour
      if (outLabourAmt > 0) {
        const labourAccount = await tx.customer.findFirst({
          where: {
            OR: [
              { cus_name: 'Labour' },
              { cus_name: 'Labour Account' },
              {
                customer_category: { cus_cat_title: 'Labour' },
                customer_type: { cus_type_title: 'labour' }
              }
            ]
          },
          select: { cus_id: true, cus_name: true }
        });

        if (labourAccount) {
          const priorLabourEntries = ledgerEntries.filter(e => e.cus_id === labourAccount.cus_id);
          const labourOpeningBalance = priorLabourEntries.length > 0
            ? priorLabourEntries[priorLabourEntries.length - 1].closing_balance
            : await resolveOpeningBalance(tx, labourAccount.cus_id, newPurchase.created_at);

          const labourEntry = createLedgerEntry({
            cus_id: labourAccount.cus_id,
            opening_balance: labourOpeningBalance,
            debit_amount: 0,
            credit_amount: outLabourAmt,
            bill_no: newPurchase.pur_id.toString(),
            trnx_type: 'CREDIT',
            details: `Out Labour - Purchase #${newPurchase.pur_id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
            payments: 0,
            updated_by: updated_by ? parseInt(updated_by) : null
          });
          ledgerEntries.push(labourEntry);
          console.log(`🔧 Labour account ${labourAccount.cus_name} debited ${outLabourAmt}`);
        } else {
          console.log('⚠️ Out labour amount present but Labour account not found — supplier already credited, labour debit skipped');
        }
      }

      // --- INCITY CHARGES: Deduct from cash account directly ---
      const incityTotal = safeParseFloat(incity_own_labour || 0) + safeParseFloat(incity_own_delivery || 0);

      if (incityTotal > 0) {
        // Resolve Cash Account ALWAYS for Incity charges (Category: "Cash Account", ID: 2551)
        const cashAcc = await tx.customer.findFirst({
          where: {
            OR: [
              { customer_category: { cus_cat_title: 'Cash Account' } },
              { cus_name: 'Cash Account' },
              { customer_category: { cus_cat_title: { contains: 'Cash Account' } } }
            ],
            NOT: [
              { cus_name: { contains: 'Cash Sales' } },
              { cus_name: { contains: 'cash purchase' } }
            ]
          },
          select: { cus_id: true }
        });
        const incityCashAccountId = cashAcc?.cus_id || null;

        const incityCashAccount = incityCashAccountId
          ? await tx.customer.findUnique({ where: { cus_id: incityCashAccountId }, select: { cus_id: true, cus_name: true } })
          : null;

        if (incityCashAccount) {
          // Use closing balance from any prior entry for this account in this transaction
          const priorCashEntries = ledgerEntries.filter(e => e.cus_id === incityCashAccount.cus_id);
          const incityOpeningBalance = priorCashEntries.length > 0
            ? priorCashEntries[priorCashEntries.length - 1].closing_balance
            : await resolveOpeningBalance(tx, incityCashAccount.cus_id, newPurchase.created_at);

          const supplierForIncity = cus_id ? await tx.customer.findUnique({ where: { cus_id: parseInt(cus_id) }, select: { cus_name: true } }) : null;
          const incityParts = [];
          if (safeParseFloat(incity_own_labour) > 0) incityParts.push(`Own Labour: ${incity_own_labour}`);
          if (safeParseFloat(incity_own_delivery) > 0) incityParts.push(`Own Delivery: ${incity_own_delivery}`);

          const incityCashEntry = createLedgerEntry({
            cus_id: incityCashAccount.cus_id,
            opening_balance: incityOpeningBalance,
            debit_amount: 0,
            credit_amount: incityTotal,
            bill_no: newPurchase.pur_id.toString(),
            trnx_type: 'CREDIT',
            details: `Incity Charges Payment (${incityParts.join(', ')}) - Purchase #${newPurchase.pur_id}${supplierForIncity?.cus_name ? ` - Supplier: ${supplierForIncity.cus_name}` : ''}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
            payments: incityTotal,
            cash_payment: incityTotal,
            bank_payment: 0,
            updated_by: updated_by ? parseInt(updated_by) : null
          });
          ledgerEntries.push(incityCashEntry);
          console.log(`🏙️ Incity cash entry: ${incityCashAccount.cus_name} (ID: ${incityCashAccount.cus_id}) credited ${incityTotal} for Incity Charges`);
        } else {
          console.warn('⚠️ Incity charges present but cash account not found — skipping cash deduction');
        }
      }

      console.log(`📊 CREATING ${ledgerEntries.length} LEDGER ENTRIES IN DATABASE (POST)`);
      await persistLedgerEntries(tx, ledgerEntries);
      console.log(`📊 All ${ledgerEntries.length} ledger entries created successfully\n`);

      const affectedCusIds = [...new Set(ledgerEntries.map(e => e.cus_id))];

      return {
        purchase: newPurchase,
        affectedCusIds
      };
    }, { maxWait: 20000, timeout: 60000 });

    const completePurchase = await prisma.purchase.findUnique({
      where: { pur_id: result.purchase.pur_id },
      include: {
        customer: true,
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        },
        purchase_details: {
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true
              }
            }
          }
        }
      }
    });

    scheduleLedgerRecalc(result.affectedCusIds);

    return NextResponse.json(completePurchase, { status: 201 });
  } catch (err) {
    console.error('❌ Error creating purchase:', err);
    return errorResponse('Failed to create purchase', 500);
  }
}

// ========================================
// PUT — Update an existing purchase
// ========================================
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      cus_id,
      store_id,
      debit_account_id,
      credit_account_id,
      cargo_account_id = null,
      cargo_account_ids = null,
      total_amount,
      unloading_amount = 0,
      fare_amount = 0,
      transport_amount = 0,
      labour_amount = 0,
      out_labour_amount = 0,
      out_delivery_amount = 0,
      include_cargo_in_costprice = false,
      // Incity fields
      incity_own_labour = 0,
      incity_own_delivery = 0,
      incity_charges_total = 0,
      discount = 0,
      payment,
      cash_payment = 0,
      bank_payment = 0,
      bank_account_id = null,
      payment_type,
      vehicle_no,
      invoice_number,
      updated_by,
      purchase_details = []
    } = body;

    const bankAccountIdInt = bank_account_id ? parseInt(bank_account_id) : null;
    const cashPaymentAmt = parseFloat(cash_payment || 0);
    const bankPaymentAmt = parseFloat(bank_payment || 0);

    // Normalize SPLIT → BANK_TRANSFER (SPLIT is not in DB enum)
    let normalizedPaymentType = payment_type;
    if (normalizedPaymentType === 'SPLIT') normalizedPaymentType = 'BANK_TRANSFER';

    if (!id) return errorResponse('Purchase ID is required');
    if (!cus_id) return errorResponse('Customer ID is required');
    if (!total_amount || total_amount <= 0) return errorResponse('Total amount is required and must be greater than 0');
    if (payment === undefined || payment === null || parseFloat(payment) < 0) return errorResponse('Payment amount must be non-negative');
    if (!normalizedPaymentType || !['CASH', 'CHEQUE', 'BANK_TRANSFER'].includes(normalizedPaymentType)) {
      return errorResponse('Valid payment type is required (CASH, CHEQUE, BANK_TRANSFER)');
    }

    // Helper function to safely parse numbers and avoid NaN
    const safeParseFloat = (value, defaultValue = 0) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const safeParseInt = (value, defaultValue = null) => {
      const parsed = parseInt(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Calculate net total: exclude OUT charges (they are posted separately as external expenses)
    const net_total = safeParseFloat(total_amount) + safeParseFloat(unloading_amount) + safeParseFloat(fare_amount) + safeParseFloat(transport_amount) + safeParseFloat(labour_amount) - safeParseFloat(discount);

    // Check if purchase exists
    const existingPurchase = await prisma.purchase.findUnique({
      where: { pur_id: id }
    });

    if (!existingPurchase) {
      return errorResponse('Purchase not found', 404);
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { cus_id }
    });

    if (!customer) {
      return errorResponse('Customer not found', 404);
    }

    const affectedCusIds = new Set();

    // Update purchase with details and ledger entries in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Bill + ledger rows use edit time (not the original purchase date).
      const ledgerEditedAt = new Date();

      // ── Step 1: Read old purchase details so we can reverse their stock ──
      const oldDetails = await tx.purchaseDetail.findMany({ where: { pur_id: id } });

      // ── Collect affected account IDs for chronological recalculation ──
      const oldLedgerEntries = await tx.ledger.findMany({
        where: getPurchaseLedgerWhere(id)
      });
      oldLedgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

      // ── Call prepareLedgerDeletion to re-link subsequent entries of deleted items ──
      await prepareLedgerDeletion(tx, id);

      // ── Step 2: Delete old ledger entries for this bill ──
      await tx.ledger.deleteMany({ where: getPurchaseLedgerWhere(id) });

      const getOpeningBalanceForAccount = async (accountId) =>
        resolveOpeningBalance(tx, accountId, ledgerEditedAt);

      // ── Step 3: Reverse stock for old quantities ──
      for (const old of oldDetails) {
        const oldStoreId = old.store_id || store_id;
        if (oldStoreId && old.pro_id && old.qnty) {
          await updateStoreStock(oldStoreId, old.pro_id, old.qnty, 'decrement', updated_by, tx);
        }
      }

      // ── Step 4: Delete old purchase details ──
      await tx.purchaseDetail.deleteMany({ where: { pur_id: id } });

      // ── Step 5: Update the purchase record ──
      const updatedPurchase = await tx.purchase.update({
        where: { pur_id: id },
        data: {
          cus_id: parseInt(cus_id),
          store_id: store_id ? parseInt(store_id) : null,
          debit_account_id: debit_account_id ? parseInt(debit_account_id) : null,
          credit_account_id: credit_account_id ? parseInt(credit_account_id) : null,
          total_amount: parseFloat(total_amount),
          unloading_amount: parseFloat(unloading_amount),
          fare_amount: parseFloat(fare_amount),
          transport_amount: parseFloat(transport_amount),
          labour_amount: parseFloat(labour_amount),
          out_labour_amount: parseFloat(out_labour_amount),
          out_delivery_amount: parseFloat(out_delivery_amount),
          include_cargo_in_costprice: include_cargo_in_costprice ? true : false,
          incity_own_labour: parseFloat(incity_own_labour),
          incity_own_delivery: parseFloat(incity_own_delivery),
          incity_charges_total: parseFloat(incity_charges_total),
          discount: parseFloat(discount),
          cargo_account_id: cargo_account_id ? parseInt(cargo_account_id) : null,
          cargo_account_ids: cargo_account_ids ? (Array.isArray(cargo_account_ids) ? JSON.stringify(cargo_account_ids) : String(cargo_account_ids)) : null,
          net_total: parseFloat(net_total),
          payment: parseFloat(payment),
          cash_payment: cashPaymentAmt,
          bank_payment: bankPaymentAmt,
          payment_type: normalizedPaymentType,
          vehicle_no: vehicle_no || null,
          invoice_number: invoice_number || null,
          updated_by: updated_by || existingPurchase.updated_by,
          created_at: ledgerEditedAt
        }
      });

      // Create new purchase details if provided
      if (purchase_details && purchase_details.length > 0) {
        const detailsData = purchase_details.map(detail => ({
          pur_id: id,
          vehicle_no: vehicle_no || null,
          cus_id: parseInt(cus_id),
          pro_id: parseInt(detail.pro_id),
          qnty: parseInt(detail.qnty || detail.quantity || 1),
          unit: detail.unit || 'pcs',
          unit_rate: parseFloat(detail.unit_rate || detail.rate),
          prate: parseFloat(detail.prate || detail.unit_rate || detail.rate),
          crate: parseFloat(detail.crate != null && detail.crate !== '' ? detail.crate : 0),
          total_amount: parseFloat(detail.total_amount),
          net_total: parseFloat(detail.total_amount),
          updated_by: updated_by || existingPurchase.updated_by
        }));

        await tx.purchaseDetail.createMany({ data: detailsData });

        // Update store stock for each product using per-detail store_id (fallback to purchase-level store_id)
        const storeStockUpdatePromises = purchase_details.map(async (detail, index) => {
          const detailStoreId = detail.store_id || store_id;
          if (!detailStoreId) return;
          await updateStoreStock(detailStoreId, detailsData[index].pro_id, detailsData[index].qnty, 'increment', updated_by, tx);
        });
        await Promise.all(storeStockUpdatePromises);

        // Update product table sale rate (pro_sale_price), cost rate (pro_cost_price), and purchase rate (pro_crate)
        const productUpdatePromises = purchase_details.map(async (detail) => {
          const proId = safeParseInt(detail.pro_id, 0);
          const saleRate = safeParseFloat(detail.unit_rate || detail.sale_rate || detail.pro_sale_price || detail.rate, 0);
          const costRate = safeParseFloat(detail.cost_rate || detail.original_cost_rate, 0);
          const purchaseRate = safeParseFloat(detail.crate != null && detail.crate !== '' ? detail.crate : 0, 0);

          if (proId > 0) {
            const updateData = {};
            if (saleRate > 0) updateData.pro_sale_price = Number(saleRate.toFixed(2));
            if (costRate > 0) updateData.pro_cost_price = Number(costRate.toFixed(2));
            if (purchaseRate > 0) updateData.pro_crate = Number(purchaseRate.toFixed(2));

            if (Object.keys(updateData).length > 0) {
              await tx.product.update({
                where: { pro_id: proId },
                data: updateData
              });
              console.log(`🏷️ Updated product ${proId} rates in DB:`, updateData);
            }
          }
        });
        await Promise.all(productUpdatePromises);
      }

      const ledgerEntries = [];
      let runningSupplierBalance = 0;
      if (cus_id) {
        runningSupplierBalance = await getOpeningBalanceForAccount(cus_id);
      }

      // Calculate supplier amount — EXCLUDE OUT charges (Out labour/Out delivery are not billed to supplier)
      const supplierAmount = safeParseFloat(total_amount) - safeParseFloat(discount) + safeParseFloat(labour_amount) + safeParseFloat(transport_amount);

      // 1. Supplier Account Entry
      if (cus_id) {
        const supplierData = await tx.customer.findUnique({
          where: { cus_id: cus_id },
          select: { cus_name: true }
        });

        const supplierEntry = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: 0,
          credit_amount: supplierAmount,
          bill_no: id.toString(),
          trnx_type: 'CREDIT',
          details: `Purchase Update from ${supplierData?.cus_name || 'Supplier'}${invoice_number ? ` #${invoice_number}` : ''}${vehicle_no ? ` - Vehicle: ${vehicle_no}` : ''}`,
          payments: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(supplierEntry);
        runningSupplierBalance = supplierEntry.closing_balance;
      }

      // 2. Payment Entry on supplier account - only if payment > 0
      const paymentAmount = safeParseFloat(payment);
      if (paymentAmount > 0 && cus_id) {
        const supplierData = await tx.customer.findUnique({
          where: { cus_id: cus_id },
          select: { cus_name: true }
        });

        const paymentEntry = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: paymentAmount,
          credit_amount: 0,
          bill_no: id.toString(),
          trnx_type: 'DEBIT',
          details: `Payment to ${supplierData?.cus_name || 'Supplier'} - Purchase Update${vehicle_no ? ` - Vehicle: ${vehicle_no}` : ''}`,
          payments: paymentAmount,
          cash_payment: cashPaymentAmt,
          bank_payment: bankPaymentAmt,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(paymentEntry);
        runningSupplierBalance = paymentEntry.closing_balance;
      }

      // 3. Cash Account Entry (if cash was paid)
      if (cashPaymentAmt > 0 && credit_account_id) {
        const cashAccountData = await tx.customer.findUnique({
          where: { cus_id: credit_account_id },
          select: { cus_name: true }
        });
        const cashOpeningBalance = await getOpeningBalanceForAccount(credit_account_id);
        const supplierName = (await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } }))?.cus_name || 'Supplier';

        const cashEntry = createLedgerEntry({
          cus_id: credit_account_id,
          opening_balance: cashOpeningBalance,
          debit_amount: 0,
          credit_amount: cashPaymentAmt,
          bill_no: id.toString(),
          trnx_type: 'CREDIT',
          details: `Cash Payment for Purchase Update to ${supplierName}${vehicle_no ? ` - Vehicle: ${vehicle_no}` : ''}`,
          payments: cashPaymentAmt,
          cash_payment: cashPaymentAmt,
          bank_payment: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(cashEntry);
      }

      // 4. Bank Account Entry (if bank was paid)
      const bankAccIdForEntry = bankAccountIdInt || (normalizedPaymentType === 'BANK_TRANSFER' ? (credit_account_id || null) : null);
      if (bankPaymentAmt > 0 && bankAccIdForEntry) {
        const bankAccountData = await tx.customer.findUnique({
          where: { cus_id: bankAccIdForEntry },
          select: { cus_name: true }
        });
        const bankOpeningBalance = await getOpeningBalanceForAccount(bankAccIdForEntry);
        const supplierName = (await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } }))?.cus_name || 'Supplier';

        const bankEntry = createLedgerEntry({
          cus_id: bankAccIdForEntry,
          opening_balance: bankOpeningBalance,
          debit_amount: 0,
          credit_amount: bankPaymentAmt,
          bill_no: id.toString(),
          trnx_type: 'CREDIT',
          details: `Bank Payment for Purchase Update to ${supplierName}${vehicle_no ? ` - Vehicle: ${vehicle_no}` : ''}`,
          payments: bankPaymentAmt,
          cash_payment: 0,
          bank_payment: bankPaymentAmt,
          updated_by: updated_by ? parseInt(updated_by) : null
        });

        ledgerEntries.push(bankEntry);
      }

      // --- CARGO / OUT CHARGES LEDGER POSTINGS (PUT) ---
      const outLabourAmtPUT = safeParseFloat(out_labour_amount || 0);
      const outDeliveryAmtPUT = safeParseFloat(out_delivery_amount || 0);
      const totalOutChargesPUT = outLabourAmtPUT + outDeliveryAmtPUT;

      // Supplier DEBIT for out charges — cargo/delivery added to supplier payable balance.
      if (totalOutChargesPUT > 0 && cus_id) {
        const supplierForOutPUT = await tx.customer.findUnique({ where: { cus_id }, select: { cus_name: true } });
        const outPartsPUT = [];
        if (outDeliveryAmtPUT > 0) outPartsPUT.push(`Delivery: ${outDeliveryAmtPUT}`);
        if (outLabourAmtPUT > 0) outPartsPUT.push(`Labour: ${outLabourAmtPUT}`);

        const supplierOutDebitPUT = createLedgerEntry({
          cus_id: cus_id,
          opening_balance: runningSupplierBalance,
          debit_amount: totalOutChargesPUT,
          credit_amount: 0,
          bill_no: id.toString(),
          trnx_type: 'DEBIT',
          details: `Cargo/Out Charges added to ${supplierForOutPUT?.cus_name || 'Supplier'} — ${outPartsPUT.join(' + ')} - Purchase #${id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
          payments: 0,
          updated_by: updated_by ? parseInt(updated_by) : null
        });
        ledgerEntries.push(supplierOutDebitPUT);
        runningSupplierBalance = supplierOutDebitPUT.closing_balance;
        console.log(`📦 Supplier cargo addition (PUT): ${supplierForOutPUT?.cus_name} credited ${totalOutChargesPUT}`);
      }

      // Debit cargo accounts for out_delivery
      if (outDeliveryAmtPUT > 0) {
        let cargoIdsPUT = [];
        try {
          if (cargo_account_ids) {
            cargoIdsPUT = Array.isArray(cargo_account_ids) ? cargo_account_ids : JSON.parse(cargo_account_ids || '[]');
          } else if (cargo_account_id) {
            cargoIdsPUT = [cargo_account_id];
          }
        } catch (err) {
          cargoIdsPUT = cargo_account_ids ? (Array.isArray(cargo_account_ids) ? cargo_account_ids : [cargo_account_ids]) : (cargo_account_id ? [cargo_account_id] : []);
        }
        if (cargoIdsPUT.length === 0 && cargo_account_id) cargoIdsPUT = [cargo_account_id];

        if (cargoIdsPUT.length > 0) {
          const perAccountPUT = parseFloat((outDeliveryAmtPUT / cargoIdsPUT.length).toFixed(2));
          let remainderPUT = parseFloat((outDeliveryAmtPUT - (perAccountPUT * cargoIdsPUT.length)).toFixed(2));

          for (let i = 0; i < cargoIdsPUT.length; i++) {
            const aid = parseInt(cargoIdsPUT[i]);
            const cargoAcc = await tx.customer.findUnique({ where: { cus_id: aid }, select: { cus_id: true, cus_name: true } });
            if (!cargoAcc) { continue; }

            let allocatePUT = perAccountPUT;
            if (i === 0) allocatePUT = parseFloat((perAccountPUT + remainderPUT).toFixed(2));

            const cargoOpeningBalance = await getOpeningBalanceForAccount(cargoAcc.cus_id);
            const cargoEntry = createLedgerEntry({
              cus_id: cargoAcc.cus_id,
              opening_balance: cargoOpeningBalance,
              debit_amount: 0,
              credit_amount: allocatePUT,
              bill_no: id.toString(),
              trnx_type: 'CREDIT',
              details: `Out Delivery - Purchase #${id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
              payments: 0,
              updated_by: updated_by ? parseInt(updated_by) : null
            });
            ledgerEntries.push(cargoEntry);
          }
        }
      }

      // Debit labour account for out_labour
      if (outLabourAmtPUT > 0) {
        const labourAccountPUT = await tx.customer.findFirst({
          where: {
            OR: [
              { cus_name: 'Labour' },
              { cus_name: 'Labour Account' },
              {
                customer_category: { cus_cat_title: 'Labour' },
                customer_type: { cus_type_title: 'labour' }
              }
            ]
          },
          select: { cus_id: true, cus_name: true }
        });

        if (labourAccountPUT) {
          const priorLabourEntriesPUT = ledgerEntries.filter(e => e.cus_id === labourAccountPUT.cus_id);
          const labourOpeningBalancePUT = priorLabourEntriesPUT.length > 0
            ? priorLabourEntriesPUT[priorLabourEntriesPUT.length - 1].closing_balance
            : await getOpeningBalanceForAccount(labourAccountPUT.cus_id);

          const labourEntryPUT = createLedgerEntry({
            cus_id: labourAccountPUT.cus_id,
            opening_balance: labourOpeningBalancePUT,
            debit_amount: 0,
            credit_amount: outLabourAmtPUT,
            bill_no: id.toString(),
            trnx_type: 'CREDIT',
            details: `Out Labour - Purchase #${id}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
            payments: 0,
            updated_by: updated_by ? parseInt(updated_by) : null
          });
          ledgerEntries.push(labourEntryPUT);
        }
      }

      // --- INCITY CHARGES: Deduct from cash account directly (PUT) ---
      const incityTotalPUT = safeParseFloat(incity_own_labour || 0) + safeParseFloat(incity_own_delivery || 0);

      if (incityTotalPUT > 0) {
        // Resolve Cash Account ALWAYS for Incity charges in PUT (Category: "Cash Account", ID: 2551)
        const cashAccPUT = await tx.customer.findFirst({
          where: {
            OR: [
              { customer_category: { cus_cat_title: 'Cash Account' } },
              { cus_name: 'Cash Account' },
              { customer_category: { cus_cat_title: { contains: 'Cash Account' } } }
            ],
            NOT: [
              { cus_name: { contains: 'Cash Sales' } },
              { cus_name: { contains: 'cash purchase' } }
            ]
          },
          select: { cus_id: true }
        });
        const incityCashAccountIdPUT = cashAccPUT?.cus_id || null;

        const incityCashAccountPUT = incityCashAccountIdPUT
          ? await tx.customer.findUnique({ where: { cus_id: incityCashAccountIdPUT }, select: { cus_id: true, cus_name: true } })
          : null;

        if (incityCashAccountPUT) {
          const priorCashEntriesPUT = ledgerEntries.filter(e => e.cus_id === incityCashAccountPUT.cus_id);
          const incityOpeningBalancePUT = priorCashEntriesPUT.length > 0
            ? priorCashEntriesPUT[priorCashEntriesPUT.length - 1].closing_balance
            : await getOpeningBalanceForAccount(incityCashAccountPUT.cus_id);

          const supplierForIncityPUT = cus_id ? await tx.customer.findUnique({ where: { cus_id: parseInt(cus_id) }, select: { cus_name: true } }) : null;
          const incityPartsPUT = [];
          if (safeParseFloat(incity_own_labour) > 0) incityPartsPUT.push(`Own Labour: ${incity_own_labour}`);
          if (safeParseFloat(incity_own_delivery) > 0) incityPartsPUT.push(`Own Delivery: ${incity_own_delivery}`);

          const incityCashEntryPUT = createLedgerEntry({
            cus_id: incityCashAccountPUT.cus_id,
            opening_balance: incityOpeningBalancePUT,
            debit_amount: 0,
            credit_amount: incityTotalPUT,
            bill_no: id.toString(),
            trnx_type: 'CREDIT',
            details: `Incity Charges Payment (${incityPartsPUT.join(', ')}) - Purchase Update #${id}${supplierForIncityPUT?.cus_name ? ` - Supplier: ${supplierForIncityPUT.cus_name}` : ''}${invoice_number ? ` (Inv: ${invoice_number})` : ''}`,
            payments: incityTotalPUT,
            cash_payment: incityTotalPUT,
            bank_payment: 0,
            updated_by: updated_by ? parseInt(updated_by) : null
          });
          ledgerEntries.push(incityCashEntryPUT);
          console.log(`🏙️ Incity cash entry (PUT): ${incityCashAccountPUT.cus_name} (ID: ${incityCashAccountPUT.cus_id}) credited ${incityTotalPUT} for Incity Charges`);
        } else {
          console.warn('⚠️ Incity charges present in PUT but cash account not found — skipping cash deduction');
        }
      }

      console.log(`📊 CREATING ${ledgerEntries.length} LEDGER ENTRIES IN DATABASE (PUT) at ${ledgerEditedAt.toISOString()}`);
      await persistLedgerEntries(tx, ledgerEntries, { entryCreatedAt: ledgerEditedAt });

      // Add new ledger entries accounts to affected set
      ledgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

      return { purchase: updatedPurchase };
    }, { maxWait: 20000, timeout: 90000 });

    const completePurchase = await prisma.purchase.findUnique({
      where: { pur_id: result.purchase.pur_id },
      include: {
        customer: true,
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        },
        purchase_details: {
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true
              }
            }
          }
        }
      }
    });

    scheduleLedgerRecalc([...affectedCusIds]);

    return NextResponse.json(completePurchase);
  } catch (err) {
    console.error('❌ Error updating purchase:', err);
    return errorResponse('Failed to update purchase', 500);
  }
}

// ========================================
// DELETE — Delete a purchase
// ========================================
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // /api/purchases?id=1

  if (!id) {
    return errorResponse('Purchase ID is required');
  }

  try {
    const existingPurchase = await prisma.purchase.findUnique({
      where: { pur_id: id },
      include: { purchase_details: true }
    });

    if (!existingPurchase) {
      return errorResponse('Purchase not found', 404);
    }

    const affectedCusIds = new Set();

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // 1. Reverse store stock
      const storeId = existingPurchase.store_id;
      for (const detail of existingPurchase.purchase_details) {
        if (storeId && detail.pro_id && detail.qnty) {
          await updateStoreStock(storeId, detail.pro_id, detail.qnty, 'decrement', existingPurchase.updated_by, tx);
        }
      }

      // 2. Collect all affected accounts from ledger entries before deletion
      const oldLedgerEntries = await tx.ledger.findMany({
        where: getPurchaseLedgerWhere(id)
      });
      oldLedgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

      // Call prepareLedgerDeletion to re-link subsequent entries
      await prepareLedgerDeletion(tx, id);

      // 3. Delete ledger entries for this bill
      await tx.ledger.deleteMany({
        where: getPurchaseLedgerWhere(id)
      });

      // 5. Delete purchase details
      await tx.purchaseDetail.deleteMany({
        where: { pur_id: id }
      });

      // 6. Delete the purchase
      await tx.purchase.delete({
        where: { pur_id: id }
      });
    }, { maxWait: 20000, timeout: 90000 });

    scheduleLedgerRecalc([...affectedCusIds]);

    return NextResponse.json({ message: 'Purchase deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting purchase:', err);
    return errorResponse('Failed to delete purchase', 500);
  }
}
