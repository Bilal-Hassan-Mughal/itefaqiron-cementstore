import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';

export const dynamic = 'force-dynamic';
import { Prisma } from '@prisma/client';
import { updateStoreStock, bulkUpdateStoreStock, getStoreStock, checkStockAvailability } from '@/lib/storeStock';
import { calculateClosingBalance, createLedgerEntry } from '@/lib/ledger-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';
import { fetchPaginatedSalesList } from '@/lib/sales-list-query';
import { logActivity, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-logger';

const SPECIAL_ACCOUNTS_CACHE_TTL_MS = 10 * 60_000;
const saleLog = () => {};
let specialAccountsCache = { data: null, expiresAt: 0 };

/** Set customer balances from freshly computed ledger closing amounts (POST fast path). */
async function syncAccountBalancesFromEntries(tx, ledgerEntries) {
  if (!ledgerEntries?.length) return;
  const closingByCusId = new Map();
  for (const entry of ledgerEntries) {
    closingByCusId.set(entry.cus_id, parseFloat(entry.closing_balance || 0));
  }
  const entries = [...closingByCusId.entries()];
  if (!entries.length) return;

  if (entries.length === 1) {
    const [cusId, closingBal] = entries[0];
    await tx.customer.update({
      where: { cus_id: cusId },
      data: { cus_balance: Number(closingBal.toFixed(2)) }
    });
    return;
  }

  const caseClauses = entries
    .map(([cusId, closingBal]) => `WHEN ${cusId} THEN ${Number(closingBal.toFixed(2))}`)
    .join(' ');
  const cusIdsStr = entries.map(([cusId]) => cusId).join(', ');

  const sql = `
    UPDATE customers
    SET cus_balance = CASE cus_id ${caseClauses} END,
        updated_at = NOW()
    WHERE cus_id IN (${cusIdsStr})
  `;
  await tx.$executeRawUnsafe(sql);
}

// Helper function to get special accounts (query fresh from database to prevent stale balances)
async function getSpecialAccounts(branchId = null) {
  try {
    const rows = branchId
      ? await prisma.$queryRaw`
      SELECT c.*, cat.cus_cat_title
      FROM customers c
      JOIN customer_categories cat ON c.cus_category = cat.cus_cat_id
      WHERE c.branch_id = ${branchId}
        AND (
          LOWER(cat.cus_cat_title) LIKE '%cash%'
          OR LOWER(cat.cus_cat_title) LIKE '%bank%'
          OR LOWER(cat.cus_cat_title) LIKE '%creditor%'
          OR LOWER(cat.cus_cat_title) LIKE '%debtor%'
        )
      ORDER BY c.cus_id ASC
    `
      : await prisma.$queryRaw`
      SELECT c.*, cat.cus_cat_title
      FROM customers c
      JOIN customer_categories cat ON c.cus_category = cat.cus_cat_id
      WHERE LOWER(cat.cus_cat_title) LIKE '%cash%'
         OR LOWER(cat.cus_cat_title) LIKE '%bank%'
         OR LOWER(cat.cus_cat_title) LIKE '%creditor%'
         OR LOWER(cat.cus_cat_title) LIKE '%debtor%'
      ORDER BY c.cus_id ASC
    `;
    const accounts = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const lowerCat = (row.cus_cat_title || '').toLowerCase();
        const lowerName = (row.cus_name || '').toLowerCase();

        if (lowerCat.includes('cash') && (!accounts.cash || lowerName === 'cash account')) {
          accounts.cash = row;
        } else if (lowerCat.includes('bank') && !['bank account', 'bank', 'bank accounts'].includes(lowerName)) {
          accounts.bank = row;
        } else if (lowerCat.includes('creditor') && !accounts.sundryCreditors) {
          accounts.sundryCreditors = row;
        } else if (lowerCat.includes('debtor') && !accounts.sundryDebtors) {
          accounts.sundryDebtors = row;
        }
      }
    }
    return accounts;
  } catch (err) {
    console.error('getSpecialAccounts query error:', err);
    return {};
  }
}

/**
 * Find or create a default "Cash Account" customer (used for cash-in ledger on sales/orders).
 * Matches purchases route behavior when paying cash to a supplier.
 */
async function findOrCreateCashAccount(branchId = 1) {
  const allCategories = await prisma.customerCategory.findMany();
  let cashCatId = null;
  for (const cat of allCategories) {
    const lower = (cat.cus_cat_title || '').toLowerCase();
    if (lower.includes('cash') && lower.includes('account')) {
      cashCatId = cat.cus_cat_id;
      break;
    }
  }
  if (!cashCatId) {
    const nextCatId = await getNextId('customerCategory', 'cus_cat_id');
    const createdCat = await prisma.customerCategory.create({
      data: { cus_cat_id: nextCatId, cus_cat_title: 'Cash Account' }
    });
    cashCatId = createdCat.cus_cat_id;
  }

  const existing = await prisma.customer.findFirst({
    where: { cus_category: cashCatId, branch_id: branchId },
  });
  if (existing) return existing;

  const allTypes = await prisma.customerType.findMany();
  let cashType = allTypes.find(t => (t.cus_type_title || '').toLowerCase().includes('cash'));
  if (!cashType) {
    const nextTypeId = await getNextId('customerType', 'cus_type_id');
    cashType = await prisma.customerType.create({ data: { cus_type_id: nextTypeId, cus_type_title: 'Cash' } });
  }
  const aCity = await prisma.city.findFirst();
  const nextCusId = await getNextId('customer', 'cus_id');
  const created = await prisma.customer.create({
    data: {
      cus_id: nextCusId,
      branch_id: branchId,
      cus_name: 'Cash Account',
      cus_phone_no: '0000000000',
      cus_address: 'Main Office',
      cus_balance: 0,
      cus_type: cashType.cus_type_id,
      cus_category: cashCatId,
      city_id: aCity ? aCity.city_id : null
    }
  });
  return created;
}

/** Resolves getSpecialAccounts() and ensures a cash account customer exists for ledger / balance updates. */
async function getSpecialAccountsForSale(branchId) {
  const bid = branchId || 1;
  let accounts = await getSpecialAccounts(bid);
  if (!accounts.cash) {
    const cash = await findOrCreateCashAccount(bid);
    if (cash) accounts = { ...accounts, cash };
  }
  return accounts;
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

/** Fast path for new live sales — account table balance matches latest ledger state. */
function accountOpeningBalance(account) {
  return parseFloat(account?.cus_balance ?? 0);
}

/** Prepares a list of ledger entries about to be deleted by re-linking any subsequent entries to preserve the starting opening balance. */
async function prepareLedgerDeletion(tx, bill_no) {
  const entriesToDelete = await tx.ledger.findMany({
    where: { bill_no: String(bill_no) },
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
        bill_no: { not: String(bill_no) },
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
      saleLog(`🔗 Re-linked next ledger entry for customer ${cus_id}: updated entry ${nextEntry.l_id} opening balance to ${earliestDeleted.opening_balance}`);
    }
  }
}

/** Parse date string preserving time in Karachi timezone (+05:00) */
function parseLocalDateInKarachi(dateStr, timeSource = new Date()) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const str = String(dateStr).trim();

  let datePart = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    datePart = str;
  } else {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      datePart = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
    } else {
      return null;
    }
  }

  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const now = timeSource instanceof Date && !isNaN(timeSource.getTime()) ? timeSource : new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const timeFormatted = timeFormatter.format(now);
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timeFormatted}.000+05:00`;
  const result = new Date(iso);
  return isNaN(result.getTime()) ? new Date(str) : result;
}

/**
 * Calculates previous customer balance for a sale receipt / invoice:
 * Closing balance of the last ledger entry for this customer strictly before this sale bill.
 */
async function getPreviousCustomerBalance(tx, cus_id, sale_id, target_created_at) {
  const parsedCusId = parseInt(cus_id, 10);
  const saleIdStr = String(sale_id || '');
  const billNoMatches = saleIdStr ? [
    saleIdStr,
    `SALE-${saleIdStr}`,
    `BILL-${saleIdStr}`,
    `ORDER-${saleIdStr}`
  ] : [];

  // 1. If this bill has an existing ledger entry for this customer, its opening_balance is the exact pre-bill balance!
  if (billNoMatches.length) {
    const billFirstEntry = await tx.ledger.findFirst({
      where: {
        cus_id: parsedCusId,
        bill_no: { in: billNoMatches }
      },
      orderBy: [
        { created_at: 'asc' },
        { l_id: 'asc' }
      ],
      select: { opening_balance: true }
    });
    if (billFirstEntry) {
      return parseFloat(billFirstEntry.opening_balance || 0);
    }
  }

  // 2. Otherwise find the last entry strictly before target_created_at
  const lastEntryBefore = await tx.ledger.findFirst({
    where: {
      cus_id: parsedCusId,
      ...(billNoMatches.length ? { bill_no: { notIn: billNoMatches } } : {}),
      created_at: { lt: target_created_at }
    },
    orderBy: [
      { created_at: 'desc' },
      { l_id: 'desc' }
    ],
    select: { closing_balance: true }
  });

  if (lastEntryBefore) {
    return parseFloat(lastEntryBefore.closing_balance || 0);
  }

  // 3. Fallback: entries at exact same timestamp before this bill
  const sameTimeEntryBefore = await tx.ledger.findFirst({
    where: {
      cus_id: parsedCusId,
      ...(billNoMatches.length ? { bill_no: { notIn: billNoMatches } } : {}),
      created_at: target_created_at
    },
    orderBy: [
      { l_id: 'desc' }
    ],
    select: { closing_balance: true }
  });

  if (sameTimeEntryBefore) {
    return parseFloat(sameTimeEntryBefore.closing_balance || 0);
  }

  return 0;
}

/** Chronologically recalculates all ledger entry opening/closing balances for a customer and updates their customer table balance. */
async function recalculateLedgerBalances(tx, cus_id, startFromDate = null) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    select: { cus_id: true, cus_name: true }
  });
  if (!customer) return;

  let prior = null;
  if (startFromDate) {
    prior = await tx.ledger.findFirst({
      where: {
        cus_id,
        created_at: { lt: startFromDate }
      },
      orderBy: [
        { created_at: 'desc' },
        { l_id: 'desc' }
      ],
      select: {
        l_id: true,
        closing_balance: true
      }
    });
  }

  let runningBalance = prior ? parseFloat(prior.closing_balance || 0) : 0;

  const entries = await tx.ledger.findMany({
    where: {
      cus_id,
      ...(prior ? { created_at: { gte: startFromDate } } : {})
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ],
    select: {
      l_id: true,
      created_at: true,
      bill_no: true,
      opening_balance: true,
      closing_balance: true,
      debit_amount: true,
      credit_amount: true
    }
  });

  if (!prior && entries.length > 0) {
    runningBalance = parseFloat(entries[0].opening_balance || 0);
  }

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

  const rowUpdates = [];
  for (const entry of entries) {
    const opening = runningBalance;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const change = debit - credit;
    const closing = opening + change;

    if (
      Math.abs(parseFloat(entry.opening_balance) - opening) > 0.009 ||
      Math.abs(parseFloat(entry.closing_balance) - closing) > 0.009
    ) {
      rowUpdates.push({
        l_id: entry.l_id,
        opening_balance: Number(opening.toFixed(2)),
        closing_balance: Number(closing.toFixed(2))
      });
    }
    runningBalance = closing;
  }

  if (rowUpdates.length === 1) {
    await tx.ledger.update({
      where: { l_id: rowUpdates[0].l_id },
      data: {
        opening_balance: rowUpdates[0].opening_balance,
        closing_balance: rowUpdates[0].closing_balance
      }
    });
  } else if (rowUpdates.length > 1) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < rowUpdates.length; i += CHUNK_SIZE) {
      const chunk = rowUpdates.slice(i, i + CHUNK_SIZE);
      const openCases = chunk.map((u) => `WHEN ${u.l_id} THEN ${u.opening_balance}`).join(' ');
      const closeCases = chunk.map((u) => `WHEN ${u.l_id} THEN ${u.closing_balance}`).join(' ');
      const idsStr = chunk.map((u) => u.l_id).join(', ');
      await tx.$executeRawUnsafe(`
        UPDATE ledger
        SET opening_balance = CASE l_id ${openCases} END,
            closing_balance = CASE l_id ${closeCases} END
        WHERE l_id IN (${idsStr})
      `);
    }
  }

  await tx.customer.update({
    where: { cus_id },
    data: { cus_balance: Number(runningBalance.toFixed(2)) }
  });
  saleLog(`   📊 Recalculated ledger for ${customer.cus_name} (ID: ${cus_id}) from ${startFromDate ? startFromDate.toISOString() : 'start'}. Final balance: ${runningBalance.toFixed(2)} (${rowUpdates.length} rows patched)`);
}

function isLockWaitError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('1205') || msg.includes('Lock wait timeout');
}

async function recalculateLedgerBalancesWithRetry(cus_id, maxAttempts = 3, startFromDate = null) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await recalculateLedgerBalances(prisma, cus_id, startFromDate);
      return;
    } catch (err) {
      if (!isLockWaitError(err) || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

// GET - Fetch all sales with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : searchParams.get('sale_id') ? parseInt(searchParams.get('sale_id')) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : null;
    const listMode = searchParams.get('list') === 'true';
    const slimList = searchParams.get('slim') === 'true';
    const billTypeFilter = searchParams.get('bill_type');
    const billTypesParam = searchParams.get('bill_types');
    const billTypeIn = billTypesParam
      ? billTypesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
    const pageParam = searchParams.get('page');

    const listBillTypeWhere = () => {
      if (billTypeIn?.length) return { bill_type: { in: billTypeIn } };
      if (billTypeFilter) return { bill_type: billTypeFilter };
      return {};
    };

    if (id) {
      // Fetch single sale
      try {
        let sale = await prisma.sale.findUnique({
          where: { sale_id: id },
          include: {
            customer: {
              include: {
                customer_category: true
              }
            },
            sale_details: {
              include: {
                product: {
                  include: {
                    category: true,
                    sub_category: true
                  }
                }
              }
            },
            debit_account: {
              select: {
                cus_id: true,
                cus_name: true,
                cus_phone_no: true
              }
            },
            credit_account: {
              select: {
                cus_id: true,
                cus_name: true,
                cus_phone_no: true
              }
            },
            loader: {
              select: {
                loader_id: true,
                loader_name: true,
                loader_number: true,
                loader_phone: true
              }
            },
            split_payments: {
              include: {
                debit_account: true,
                credit_account: true
              }
            },
            updated_by_user: {
              select: {
                full_name: true,
                role: true
              }
            }
          }
        });

        if (!sale) {
          const cleanId = String(id).replace(/^[A-Za-z]+-/, '');
          sale = await prisma.sale.findFirst({
            where: {
              OR: [
                { bill_number: String(id) },
                { bill_number: `B-${id}` },
                { bill_number: cleanId },
                { bill_number: `B-${cleanId}` }
              ]
            },
            include: {
              customer: {
                include: {
                  customer_category: true
                }
              },
              sale_details: {
                include: {
                  product: {
                    include: {
                      category: true,
                      sub_category: true
                    }
                  }
                }
              },
              debit_account: {
                select: {
                  cus_id: true,
                  cus_name: true,
                  cus_phone_no: true
                }
              },
              credit_account: {
                select: {
                  cus_id: true,
                  cus_name: true,
                  cus_phone_no: true
                }
              },
              loader: {
                select: {
                  loader_id: true,
                  loader_name: true,
                  loader_number: true,
                  loader_phone: true
                }
              },
              split_payments: {
                include: {
                  debit_account: true,
                  credit_account: true
                }
              },
              updated_by_user: {
                select: {
                  full_name: true,
                  role: true
                }
              }
            }
          });
        }

        if (!sale) {
          return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Fetch transport details from ledger
        // Match both legacy 'SALE' and new 'CREDIT' trnx_type for backward compatibility
        const transportLedgerEntries = await prisma.ledger.findMany({
          where: {
            bill_no: id.toString(),
            trnx_type: { in: ['SALE', 'CREDIT'] },
            credit_amount: { gt: 0 },
            cus_id: { not: sale.cus_id },
            details: { contains: 'Transport' }
          },
          include: {
            customer: {
              select: {
                cus_id: true,
                cus_name: true
              }
            }
          }
        });

        const splitCreditAccountIds = (sale.split_payments || [])
          .map(sp => sp.credit_account_id)
          .filter(Boolean);

        const transportDetails = transportLedgerEntries
          .filter(entry => !splitCreditAccountIds.includes(entry.cus_id))
          .map(entry => ({
            account_id: entry.cus_id,
            amount: parseFloat(entry.credit_amount),
            account: entry.customer
          }));

        let previousCustomerBalance = 0;
        try {
          previousCustomerBalance = await getPreviousCustomerBalance(
            prisma,
            sale.cus_id,
            sale.sale_id,
            sale.created_at
          );
        } catch (err) {
          console.warn('Could not compute previous customer balance for sale in GET', sale.sale_id, err.message);
        }

        const saleWithBillNumber = { 
          ...sale, 
          notes: sale.notes || sale.reference || null,
          bill_number: sale.bill_number ?? null,
          transport_details: transportDetails,
          previous_customer_balance: previousCustomerBalance,
          previous_balance: previousCustomerBalance
        };

        return NextResponse.json(saleWithBillNumber);
      } catch (prismaError) {
        console.error('❌ Prisma error:', prismaError.code, prismaError.message);

        // Handle missing advance_payment column
        if (prismaError.code === 'P2022' && prismaError.message?.includes('advance_payment')) {
          return NextResponse.json({
            error: 'Database migration required: advance_payment column is missing',
            details: 'Please run the migration SQL to add advance_payment column to sales table.',
            sql: 'ALTER TABLE `sales` ADD COLUMN `advance_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `bank_title`;'
          }, { status: 500 });
        }

        // If store_id column doesn't exist, use raw SQL
        if (prismaError.code === 'P2022' && prismaError.message?.includes('store_id')) {
          console.warn('⚠️ store_id column not found in GET, using raw SQL fallback');
          const sale = await prisma.$queryRaw`
            SELECT s.*, 
              c.cus_id as customer_cus_id, c.cus_name as customer_cus_name, c.cus_phone_no as customer_cus_phone_no,
              c.cus_category as customer_cus_category, c.cus_type as customer_cus_type, c.cus_address as customer_cus_address,
              c.name_urdu as customer_name_urdu
            FROM sales s
            LEFT JOIN customers c ON s.cus_id = c.cus_id
            WHERE s.sale_id = ${id}
              AND s.branch_id = ${branchId}
            LIMIT 1
          `;

          if (!sale || sale.length === 0) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
          }

          // Fetch sale_details separately - explicitly select columns to avoid datetime issues
          const saleDetails = await prisma.$queryRaw`
            SELECT 
              sd.sale_detail_id, sd.sale_id, sd.pro_id, sd.vehicle_no, sd.size,
              sd.qnty, sd.unit, sd.unit_rate, sd.total_amount, sd.discount, 
              sd.net_total, sd.cus_id,
              p.pro_title, p.pro_stock_qnty
            FROM sale_details sd
            LEFT JOIN products p ON sd.pro_id = p.pro_id
            WHERE sd.sale_id = ${id}
            ORDER BY sd.sale_detail_id ASC
          `;

          // Fetch split_payments separately for this sale
          const splitPayments = await prisma.$queryRaw`
            SELECT 
              sp.split_payment_id, sp.sale_id, sp.amount, sp.payment_type,
              sp.debit_account_id, sp.credit_account_id, sp.reference,
              debit.cus_id as debit_cus_id, debit.cus_name as debit_cus_name,
              credit.cus_id as credit_cus_id, credit.cus_name as credit_cus_name
            FROM split_payments sp
            LEFT JOIN customers debit ON sp.debit_account_id = debit.cus_id
            LEFT JOIN customers credit ON sp.credit_account_id = credit.cus_id
            WHERE sp.sale_id = ${id}
          `;

          // Transform split_payments to match Prisma format
          const transformedSplitPayments = splitPayments.map(sp => ({
            split_payment_id: sp.split_payment_id,
            sale_id: sp.sale_id,
            amount: sp.amount,
            payment_type: sp.payment_type,
            debit_account_id: sp.debit_account_id,
            credit_account_id: sp.credit_account_id,
            reference: sp.reference,
            debit_account: sp.debit_account_id ? {
              cus_id: sp.debit_cus_id,
              cus_name: sp.debit_cus_name
            } : null,
            credit_account: sp.credit_account_id ? {
              cus_id: sp.credit_cus_id,
              cus_name: sp.credit_cus_name
            } : null
          }));

          // Fetch transport details from ledger for fallback path
          const transportLedgerEntries = await prisma.$queryRaw`
            SELECT l.*, c.cus_name
            FROM ledger l
            LEFT JOIN customers c ON l.cus_id = c.cus_id
            WHERE l.bill_no = ${id.toString()}
              AND l.branch_id = ${branchId}
              AND l.trnx_type IN ('SALE', 'CREDIT')
              AND l.credit_amount > 0
              AND l.cus_id != ${sale[0].cus_id}
          `;

          const splitCreditAccountIdsFallback = (transformedSplitPayments || [])
            .map(sp => sp.credit_account_id)
            .filter(Boolean);

          const transportDetailsFallback = transportLedgerEntries
            .filter(entry => !splitCreditAccountIdsFallback.includes(entry.cus_id))
            .map(entry => ({
              account_id: entry.cus_id,
              amount: parseFloat(entry.credit_amount || 0),
              account: {
                cus_id: entry.cus_id,
                cus_name: entry.cus_name
              }
            }));

          let previousCustomerBalance = 0;
          try {
            previousCustomerBalance = await getPreviousCustomerBalance(
              prisma,
              Number(sale[0].cus_id),
              sale[0].sale_id,
              sale[0].created_at
            );
          } catch (err) {
            console.warn('Could not compute previous customer balance for sale in raw GET fallback', err.message);
          }

          const result = {
            ...sale[0],
            notes: sale[0].notes || sale[0].reference || null,
            customer: sale[0].customer_cus_name ? {
              cus_id: Number(sale[0].customer_cus_id),
              cus_name: sale[0].customer_cus_name,
              cus_phone_no: sale[0].customer_cus_phone_no,
              cus_category: sale[0].customer_cus_category ? Number(sale[0].customer_cus_category) : null,
              cus_type: sale[0].customer_cus_type ? Number(sale[0].customer_cus_type) : null,
              cus_address: sale[0].customer_cus_address || null,
              name_urdu: sale[0].customer_name_urdu || null
            } : null,
            sale_details: saleDetails || [],
            split_payments: transformedSplitPayments || [],
            transport_details: transportDetailsFallback,
            previous_customer_balance: previousCustomerBalance,
            previous_balance: previousCustomerBalance
          };

          return NextResponse.json(result);
        } else {
          throw prismaError;
        }
      }
    } else {
      if (listMode && pageParam) {
        const result = await fetchPaginatedSalesList(prisma, branchId, {
          page: pageParam,
          pageSize: searchParams.get('pageSize'),
          q: searchParams.get('q'),
          item: searchParams.get('item'),
          quantity: searchParams.get('quantity'),
          notes: searchParams.get('notes'),
          cusId: searchParams.get('cus_id'),
          storeId: searchParams.get('store_id'),
          paymentType: searchParams.get('payment_type'),
          fromDate: searchParams.get('from'),
          toDate: searchParams.get('to'),
          minAmount: searchParams.get('min_amount'),
          maxAmount: searchParams.get('max_amount'),
          amount: searchParams.get('amount'),
          balanceStatus: searchParams.get('balance'),
          billType: billTypeFilter,
          sortBy: searchParams.get('sort_by'),
          sortOrder: searchParams.get('sort_order'),
        });
        return NextResponse.json(result);
      }

      // Fetch all sales
      try {
        const findOptions = listMode
          ? {
              select: {
                sale_id: true,
                bill_number: true,
                total_amount: true,
                discount: true,
                payment: true,
                payment_type: true,
                shipping_amount: true,
                labour_charges: true,
                bill_type: true,
                reference: true,
                created_at: true,
                updated_at: true,
                cus_id: true,
                cash_payment: true,
                bank_payment: true,
                advance_payment: true,
                store_id: true,
                customer: {
                  select: {
                    cus_id: true,
                    cus_name: true,
                    cus_phone_no: true,
                    cus_phone_no2: true,
                    cus_address: true,
                    cus_balance: true,
                    name_urdu: true,
                  },
                },
                ...(slimList
                  ? {}
                  : {
                      sale_details: {
                        select: {
                          sale_detail_id: true,
                          qnty: true,
                          unit_rate: true,
                          total_amount: true,
                          store_id: true,
                          product: {
                            select: { pro_id: true, pro_title: true },
                          },
                        },
                      },
                    }),
              },
              where: {
                branch_id: branchId,
                ...listBillTypeWhere(),
              },
              orderBy: { created_at: 'desc' },
            }
          : {
              where: {
                branch_id: branchId,
                ...listBillTypeWhere(),
              },
              include: {
                customer: {
                  include: {
                    customer_category: true
                  }
                },
                sale_details: {
                  include: {
                    product: {
                      include: {
                        category: true,
                        sub_category: true
                      }
                    }
                  }
                },
                debit_account: {
                  select: {
                    cus_id: true,
                    cus_name: true,
                    cus_phone_no: true
                  }
                },
                credit_account: {
                  select: {
                    cus_id: true,
                    cus_name: true,
                    cus_phone_no: true
                  }
                },
                loader: {
                  select: {
                    loader_id: true,
                    loader_name: true,
                    loader_number: true,
                    loader_phone: true
                  }
                },
                split_payments: {
                  include: {
                    debit_account: true,
                    credit_account: true
                  }
                },
                updated_by_user: {
                  select: {
                    full_name: true,
                    role: true
                  }
                }
              },
              orderBy: {
                created_at: 'desc'
              }
            };

        if (limit && limit > 0) {
          findOptions.take = limit;
        } else if (listMode && !billTypeFilter && !billTypeIn?.length) {
          findOptions.take = 500;
        }

        const sales = await prisma.sale.findMany(findOptions);

        const salesWithBillNumber = sales.map(s => ({
          ...s,
          notes: s.reference || s.notes || null,
          bill_number: s.bill_number ?? null
        }));

        saleLog('✅ Sales fetched via Prisma:', sales.length);
        return NextResponse.json(salesWithBillNumber);
      } catch (prismaError) {
        console.error('❌ Prisma error:', prismaError.code, prismaError.message);
        // If datetime parsing error or store_id column doesn't exist, use raw SQL
        if (prismaError.code === 'P2020' || (prismaError.code === 'P2022' && prismaError.message?.includes('store_id'))) {
          console.warn('⚠️ Prisma error detected (P2020/P2022), using raw SQL fallback to avoid datetime parsing issues');
          try {
            const sales = await prisma.$queryRaw`
              SELECT 
                s.sale_id, s.total_amount, s.discount, s.payment, s.payment_type,
                s.cash_payment, s.bank_payment, s.bank_title, s.advance_payment, s.previous_balance,
                s.shipping_amount, s.bill_type, s.reference, s.cus_id, s.loader_id,
                s.debit_account_id, s.credit_account_id, s.store_id,
                CASE 
                  WHEN s.created_at IS NULL OR s.created_at = '0000-00-00 00:00:00' THEN NULL
                  ELSE CONCAT(DATE_FORMAT(s.created_at, '%Y-%m-%dT%H:%i:%s'), '.000+05:00')
                END as created_at,
                CASE 
                  WHEN s.updated_at IS NULL OR s.updated_at = '0000-00-00 00:00:00' THEN NULL
                  ELSE CONCAT(DATE_FORMAT(s.updated_at, '%Y-%m-%dT%H:%i:%s'), '.000+05:00')
                END as updated_at,
                c.cus_id as customer_cus_id, c.cus_name as customer_cus_name, 
                c.cus_phone_no as customer_cus_phone_no, c.cus_category as customer_cus_category,
                c.cus_type as customer_cus_type, c.cus_balance as customer_cus_balance,
                c.cus_address as customer_cus_address, c.cus_reference as customer_cus_reference,
                c.name_urdu as customer_name_urdu
              FROM sales s
              LEFT JOIN customers c ON s.cus_id = c.cus_id
              WHERE s.branch_id = ${branchId}
                AND s.created_at IS NOT NULL 
                AND s.created_at != '0000-00-00 00:00:00'
                AND YEAR(s.created_at) > 1970
              ORDER BY s.created_at DESC
            `;

            saleLog('📊 Raw SQL sales count:', sales?.length || 0);
            saleLog('📊 Raw SQL sales data:', JSON.stringify(sales?.slice(0, 2), null, 2));

            if (!sales || sales.length === 0) {
              console.warn('⚠️ No sales found in database');
              return NextResponse.json([]);
            }

            // Fetch sale_details for all sales
            const saleIds = sales.map(s => Number(s.sale_id)).filter(id => id != null && !isNaN(id));
            saleLog('📊 Sale IDs to fetch details for:', saleIds);
            let saleDetails = [];
            if (saleIds.length > 0) {
              try {
                // Try with subcategories first - use Prisma.join for safe IN clause
                saleDetails = await prisma.$queryRaw`
                  SELECT 
                    sd.sale_detail_id, sd.sale_id, sd.pro_id, sd.vehicle_no, sd.size,
                    sd.qnty, sd.unit, sd.unit_rate, sd.total_amount, sd.discount, 
                    sd.net_total, sd.cus_id,
                    p.pro_title, p.pro_stock_qnty, 
                    cat.cat_name, sub.sub_cat_name
                  FROM sale_details sd
                  LEFT JOIN products p ON sd.pro_id = p.pro_id
                  LEFT JOIN categories cat ON p.cat_id = cat.cat_id
                  LEFT JOIN subcategories sub ON p.sub_cat_id = sub.sub_cat_id
                  WHERE sd.sale_id IN (${Prisma.join(saleIds)})
                  ORDER BY sd.sale_id ASC, sd.sale_detail_id ASC
                `;
                saleLog('📊 Sale details fetched:', saleDetails?.length || 0);
              } catch (subcatError) {
                // If subcategories table doesn't exist, try without it
                if (subcatError.message?.includes('subcategories') || subcatError.message?.includes("doesn't exist") || subcatError.code === '1146') {
                  console.warn('⚠️ subcategories table not found, fetching without it');
                  saleDetails = await prisma.$queryRaw`
                    SELECT 
                      sd.sale_detail_id, sd.sale_id, sd.pro_id, sd.vehicle_no, sd.size,
                      sd.qnty, sd.unit, sd.unit_rate, sd.total_amount, sd.discount, 
                      sd.net_total, sd.cus_id,
                      p.pro_title, p.pro_stock_qnty, 
                      cat.cat_name, NULL as sub_cat_name
                    FROM sale_details sd
                    LEFT JOIN products p ON sd.pro_id = p.pro_id
                    LEFT JOIN categories cat ON p.cat_id = cat.cat_id
                    WHERE sd.sale_id IN (${Prisma.join(saleIds)})
                  ORDER BY sd.sale_id ASC, sd.sale_detail_id ASC
                  `;
                  saleLog('📊 Sale details fetched (without subcategories):', saleDetails?.length || 0);
                } else {
                  console.error('❌ Error fetching sale details:', subcatError);
                  throw subcatError;
                }
              }
            }

            // Fetch customer categories for nested structure (optional - don't fail if this fails)
            const customerCategoryIds = [...new Set(sales.map(s => s.customer_cus_category).filter(id => id != null))];
            let customerCategories = [];
            const categoriesMap = {};

            if (customerCategoryIds.length > 0) {
              try {
                // Use correct column name: cus_cat_id - convert to numbers
                const numericCatIds = customerCategoryIds.map(id => Number(id)).filter(id => !isNaN(id));
                customerCategories = await prisma.$queryRaw`
                  SELECT cus_cat_id, cus_cat_title 
                  FROM customer_categories 
                  WHERE branch_id = ${branchId}
                    AND cus_cat_id IN (${Prisma.join(numericCatIds)})
                `;
                saleLog('📊 Customer categories fetched:', customerCategories?.length || 0);

                // Map categories
                customerCategories.forEach(cat => {
                  const catId = cat.cus_cat_id;
                  if (catId) {
                    categoriesMap[catId] = {
                      cus_cat_id: cat.cus_cat_id,
                      cus_cat_title: cat.cus_cat_title
                    };
                  }
                });
              } catch (catError) {
                // Silently skip customer categories if there's an error - not critical for sales display
                console.warn('⚠️ Could not fetch customer categories (non-critical):', catError.message);
                // Continue without categories - sales will still work
              }
            }

            // Group sale_details by sale_id and format properly
            // Convert sale_ids to numbers for consistent matching
            const detailsBySaleId = {};
            if (saleDetails && saleDetails.length > 0) {
              saleDetails.forEach(detail => {
                const detailSaleId = Number(detail.sale_id);
                if (!detailsBySaleId[detailSaleId]) {
                  detailsBySaleId[detailSaleId] = [];
                }
                detailsBySaleId[detailSaleId].push({
                  sale_detail_id: detail.sale_detail_id ? Number(detail.sale_detail_id) : null,
                  sale_id: detailSaleId,
                  pro_id: detail.pro_id ? Number(detail.pro_id) : null,
                  vehicle_no: detail.vehicle_no,
                  qnty: detail.qnty ? Number(detail.qnty) : 0,
                  unit: detail.unit,
                  unit_rate: detail.unit_rate ? Number(detail.unit_rate) : 0,
                  total_amount: detail.total_amount ? Number(detail.total_amount) : 0,
                  discount: detail.discount ? Number(detail.discount) : 0,
                  net_total: detail.net_total ? Number(detail.net_total) : 0,
                  cus_id: detail.cus_id ? Number(detail.cus_id) : null,
                  product: detail.pro_title ? {
                    pro_id: detail.pro_id ? Number(detail.pro_id) : null,
                    pro_title: detail.pro_title,
                    pro_name: detail.pro_title, // Also include as pro_name for backward compatibility
                    pro_stock_qnty: detail.pro_stock_qnty ? Number(detail.pro_stock_qnty) : 0,
                    category: detail.cat_name ? { cat_name: detail.cat_name } : null,
                    sub_category: detail.sub_cat_name ? { sub_cat_name: detail.sub_cat_name } : null
                  } : null
                });
              });
            }

            // Fetch split_payments for all sales
            let splitPayments = [];
            const splitPaymentsBySaleId = {};
            if (saleIds.length > 0) {
              try {
                splitPayments = await prisma.$queryRaw`
                  SELECT 
                    sp.split_payment_id, sp.sale_id, sp.amount, sp.payment_type,
                    sp.debit_account_id, sp.credit_account_id, sp.reference,
                    debit.cus_id as debit_cus_id, debit.cus_name as debit_cus_name,
                    credit.cus_id as credit_cus_id, credit.cus_name as credit_cus_name
                  FROM split_payments sp
                  LEFT JOIN customers debit ON sp.debit_account_id = debit.cus_id
                  LEFT JOIN customers credit ON sp.credit_account_id = credit.cus_id
                  WHERE sp.sale_id IN (${Prisma.join(saleIds)})
                `;
                saleLog('📊 Split payments fetched:', splitPayments?.length || 0);

                // Group split_payments by sale_id
                splitPayments.forEach(sp => {
                  const spSaleId = Number(sp.sale_id);
                  if (!splitPaymentsBySaleId[spSaleId]) {
                    splitPaymentsBySaleId[spSaleId] = [];
                  }
                  splitPaymentsBySaleId[spSaleId].push({
                    split_payment_id: sp.split_payment_id ? Number(sp.split_payment_id) : null,
                    sale_id: spSaleId,
                    amount: Number(sp.amount) || 0,
                    payment_type: sp.payment_type,
                    debit_account_id: sp.debit_account_id ? Number(sp.debit_account_id) : null,
                    credit_account_id: sp.credit_account_id ? Number(sp.credit_account_id) : null,
                    reference: sp.reference,
                    debit_account: sp.debit_account_id ? {
                      cus_id: Number(sp.debit_cus_id),
                      cus_name: sp.debit_cus_name
                    } : null,
                    credit_account: sp.credit_account_id ? {
                      cus_id: Number(sp.credit_cus_id),
                      cus_name: sp.credit_cus_name
                    } : null
                  });
                });
              } catch (splitError) {
                console.warn('⚠️ Could not fetch split_payments (non-critical):', splitError.message);
                // Continue without split_payments - sales will still work
              }
            }

            // Format sales to match Prisma structure
            const result = sales.map(sale => {
              const saleIdNum = Number(sale.sale_id);
              // Handle BigInt values (like sale_id, total_amount) by converting to Number
              const formattedSale = {
                sale_id: saleIdNum,
                total_amount: Number(sale.total_amount) || 0,
                discount: Number(sale.discount) || 0,
                payment: Number(sale.payment) || 0,
                payment_type: sale.payment_type,
                cash_payment: Number(sale.cash_payment) || 0,
                bank_payment: Number(sale.bank_payment) || 0,
                bank_title: sale.bank_title || null,
                advance_payment: Number(sale.advance_payment) || 0,
                previous_balance: Number(sale.previous_balance) || 0,
                shipping_amount: Number(sale.shipping_amount) || 0,
                bill_type: sale.bill_type,
                reference: sale.reference,
                notes: sale.notes || sale.reference || null,
                created_at: sale.created_at,
                updated_at: sale.updated_at,
                cus_id: sale.cus_id ? Number(sale.cus_id) : null,
                loader_id: sale.loader_id ? Number(sale.loader_id) : null,
                debit_account_id: sale.debit_account_id ? Number(sale.debit_account_id) : null,
                credit_account_id: sale.credit_account_id ? Number(sale.credit_account_id) : null,
                customer: sale.customer_cus_name ? {
                  cus_id: Number(sale.customer_cus_id),
                  cus_name: sale.customer_cus_name,
                  cus_phone_no: sale.customer_cus_phone_no,
                  cus_category: sale.customer_cus_category ? Number(sale.customer_cus_category) : null,
                  cus_type: sale.customer_cus_type ? Number(sale.customer_cus_type) : null,
                  cus_balance: Number(sale.customer_cus_balance) || 0,
                  cus_address: sale.customer_cus_address,
                  cus_reference: sale.customer_cus_reference,
                  name_urdu: sale.customer_name_urdu || null,
                  customer_category: sale.customer_cus_category && categoriesMap[sale.customer_cus_category] ? {
                    cus_cat_id: categoriesMap[sale.customer_cus_category].cus_cat_id || categoriesMap[sale.customer_cus_category].cus_category_id,
                    cus_cat_title: categoriesMap[sale.customer_cus_category].cus_cat_title || categoriesMap[sale.customer_cus_category].title
                  } : null
                } : null,
                sale_details: detailsBySaleId[saleIdNum] || [],
                loader: null,
                debit_account: null,
                credit_account: null,
                split_payments: splitPaymentsBySaleId[saleIdNum] || []
              };
              return formattedSale;
            });

            if (result.length > 0) {
              saleLog('📊 Sample formatted sale:', JSON.stringify(result[0], null, 2));
              saleLog('📊 Sample sale keys:', Object.keys(result[0]));
              saleLog('📊 Sample sale customer:', result[0].customer);
            }

            saleLog('✅ Formatted sales result count:', result.length);
            saleLog('✅ Response ready to send');
            return NextResponse.json(result);
          } catch (rawSqlError) {
            console.error('❌ Raw SQL error:', rawSqlError);
            throw rawSqlError;
          }
        } else {
          throw prismaError;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching sales:', error);

    // Provide helpful error message for store_id issues
    if (error.code === 'P2022' && error.message?.includes('store_id')) {
      return NextResponse.json({
        error: 'Database migration required: store_id column is missing',
        details: 'Please run the migration SQL to add store_id column. See ADD_STORE_ID_TO_SALES_SIMPLE.sql'
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Failed to fetch sales',
      details: error.message
    }, { status: 500 });
  }
}

// POST - Create new sale
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    saleLog('🔍 Sales API - Received data:', body);

    const {
      cus_id,
      store_id, // Added store_id for multi-store functionality
      total_amount,
      discount,
      payment,
      payment_type,
      cash_payment,
      bank_payment,
      bank_title,
      advance_payment, // Added advance_payment field
      previous_balance, // Customer balance before this sale
      debit_account_id,
      credit_account_id,
      loader_id,
      labour_charges, // Added labour_charges field
      shipping_amount,
      bill_type,
      reference,
      sale_details,
      transport_details,
      split_payments,
      is_loaded_order, // Flag to indicate if this is a loaded order
      order_id,
      loaded_order_id,
      updated_by,
      date = null,
      created_at: body_created_at = null
    } = body;

    // Debug: Log received labour_charges
    saleLog('🔍 API RECEIVED labour_charges:', labour_charges, '(type:', typeof labour_charges, ')');
    saleLog('🔍 API RECEIVED advance_payment:', advance_payment, '(type:', typeof advance_payment, ')');

    // Validate required fields
    saleLog('🔍 Sales API - Validating fields:', { cus_id, store_id, total_amount, payment, sale_details });
    saleLog('💰💰💰 SPLIT PAYMENTS IN REQUEST:', split_payments);
    saleLog('💰💰💰 SPLIT PAYMENTS TYPE:', typeof split_payments);
    saleLog('💰💰💰 SPLIT PAYMENTS IS ARRAY:', Array.isArray(split_payments));
    saleLog('💰💰💰 SPLIT PAYMENTS LENGTH:', split_payments?.length);

    if (!cus_id || !store_id || total_amount === undefined || total_amount === null || payment === undefined || payment === null || !sale_details || sale_details.length === 0) {
      saleLog('❌ Sales API - Missing required fields:', { cus_id, store_id, total_amount, payment, sale_details });
      return NextResponse.json({ error: 'Missing required fields including store_id' }, { status: 400 });
    }

    // Additional validation for numeric values (allow zero-total sales if discount matches subtotal)
    if (isNaN(parseFloat(total_amount)) || parseFloat(total_amount) < 0) {
      saleLog('❌ Sales API - Invalid total_amount:', total_amount);
      return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 });
    }

    if (isNaN(parseFloat(payment)) || parseFloat(payment) < 0) {
      saleLog('❌ Sales API - Invalid payment:', payment);
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    // Calculate net total (what customer owes for the bill)
    // IMPORTANT: Discount is NOT deducted from customer's bill - it's a company expense/profit sharing
    // Customer owes exactly what is stated on the invoice (products + shipping)
    // Discount is recorded separately for accounting but doesn't affect customer balance
    const netTotal = parseFloat(total_amount);

    // Check if this is a quotation or order-like record (skip stock checks)
    const isQuotation = bill_type === 'QUOTATION';
    const isOrder = bill_type === 'ORDER' || bill_type === 'ORDER_TRASH';

    // When the client sends total `payment` but leaves cash_payment/bank_payment at 0, infer split from payment_type
    const payValNorm = parseFloat(payment) || 0;
    let eff_cash = parseFloat(cash_payment ?? 0) || 0;
    let eff_bank = parseFloat(bank_payment ?? 0) || 0;
    const payTypeNorm = String(payment_type || 'CASH').toUpperCase();
    if (payValNorm > 0 && eff_cash === 0 && eff_bank === 0) {
      if (payTypeNorm === 'BANK_TRANSFER' || payTypeNorm === 'CHEQUE') {
        eff_bank = payValNorm;
      } else {
        eff_cash = payValNorm;
      }
    }

    // Stock validation removed - allow negative stock
    // if (!isQuotation) {
    // for (const detail of sale_details) {
    //   const hasStock = await checkStockAvailability(store_id, detail.pro_id, parseInt(detail.qnty));
    //   if (!hasStock) {
    //     const currentStock = await getStoreStock(store_id, detail.pro_id);
    //     return NextResponse.json({ 
    //       error: `Insufficient stock for product ${detail.pro_id}. Available: ${currentStock}, Required: ${detail.qnty}` 
    //     }, { status: 400 });
    //     }
    //   }
    // }

    // Get special accounts BEFORE transaction (for better performance)
    const specialAccounts = isQuotation ? null : await getSpecialAccountsForSale(branchId);
    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    // Detect if this is a loaded order (order being converted to sale)
    // Check: (1) explicit flag, or (2) reference contains "Converted from Order"
    const actualIsLoadedOrder = is_loaded_order || (reference && reference.includes('Converted from Order'));

    saleLog(`\n🔍 SALE/ORDER CREATION DEBUG:`);
    saleLog(`   is_loaded_order flag: ${is_loaded_order}`);
    saleLog(`   reference: ${reference}`);
    saleLog(`   actualIsLoadedOrder: ${actualIsLoadedOrder}`);
    saleLog(`   bill_type: ${bill_type}`);
    saleLog(`   Customer ID: ${cus_id}`);

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Pre-fetch all involved account IDs in 1 batch query for instant performance
      const targetAccountIds = new Set([
        cus_id,
        debit_account_id ? parseInt(debit_account_id) : null,
        credit_account_id ? parseInt(credit_account_id) : null,
        specialAccounts?.cash?.cus_id,
        specialAccounts?.bank?.cus_id,
        specialAccounts?.sundryCreditors?.cus_id,
        specialAccounts?.sundryDebtors?.cus_id,
      ]);
      if (transport_details?.length) {
        transport_details.forEach((td) => { if (td.account_id) targetAccountIds.add(parseInt(td.account_id)); });
      }
      if (split_payments?.length) {
        split_payments.forEach((sp) => {
          if (sp.debit_account_id) targetAccountIds.add(parseInt(sp.debit_account_id));
          if (sp.credit_account_id) targetAccountIds.add(parseInt(sp.credit_account_id));
        });
      }
      targetAccountIds.delete(null);
      targetAccountIds.delete(undefined);

      const accountList = await tx.customer.findMany({
        where: { cus_id: { in: Array.from(targetAccountIds).filter(Boolean) } },
        include: { city: true }
      });
      const accountMap = new Map(accountList.map((a) => [a.cus_id, a]));

      const cusIdNum = parseInt(cus_id, 10);
      const customer = accountMap.get(cusIdNum) || accountMap.get(cus_id) || await tx.customer.findUnique({
        where: { cus_id: cusIdNum },
        include: { city: true }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      saleLog(`   Customer name: ${customer.cus_name}`);

      let saleCreatedAt = new Date();
      if (date) {
        const parsed = parseLocalDateInKarachi(date);
        if (parsed && !isNaN(parsed.getTime())) saleCreatedAt = parsed;
      } else if (body_created_at) {
        const parsed = new Date(body_created_at);
        if (!isNaN(parsed.getTime())) saleCreatedAt = parsed;
      }
      const customerOpeningBalance = await resolveOpeningBalance(tx, cusIdNum, saleCreatedAt);
      saleLog(`   Customer opening balance (pre-sale): ${customerOpeningBalance}`);

      // Calculate bill_number before create using indexed query
      const isOrderGroup = ['ORDER', 'ORDER_TRASH'].includes(bill_type || 'BILL');
      let maxRow;
      if (isOrderGroup) {
        [maxRow] = await tx.$queryRaw`
          SELECT COALESCE(MAX(bill_number), 0) AS maxNum FROM sales
          WHERE branch_id = ${branchId} AND (bill_type = 'ORDER' OR bill_type = 'ORDER_TRASH')
        `;
      } else {
        const bt = bill_type || 'BILL';
        [maxRow] = await tx.$queryRaw`
          SELECT COALESCE(MAX(bill_number), 0) AS maxNum FROM sales WHERE branch_id = ${branchId} AND bill_type = ${bt}
        `;
      }
      const nextBillNumber = Number(maxRow?.maxNum || 0) + 1;

      // Create sale - try with store_id first, fallback if column doesn't exist
      let sale;
      try {
        sale = await tx.sale.create({
          data: {
            branch_id: branchId,
            cus_id,
            store_id: parseInt(store_id),
            total_amount: Number(parseFloat(total_amount).toFixed(2)),
            discount: Number(parseFloat(discount || 0).toFixed(2)),
            payment: Number(parseFloat(payment).toFixed(2)),
            payment_type,
            cash_payment: Number(eff_cash.toFixed(2)),
            bank_payment: Number(eff_bank.toFixed(2)),
            bank_title: bank_title || null,
            advance_payment: Number(parseFloat(advance_payment || 0).toFixed(2)),
            previous_balance: Number(parseFloat(
              isOrder
                ? customerOpeningBalance
                : (previous_balance != null && previous_balance !== ''
                    ? previous_balance
                    : customerOpeningBalance)
            ).toFixed(2)),
            debit_account_id: debit_account_id || null,
            credit_account_id: credit_account_id || null,
            loader_id: loader_id || null,
            labour_charges: Number(parseFloat(labour_charges || 0).toFixed(2)),
            shipping_amount: Number(parseFloat(shipping_amount || 0).toFixed(2)),
            bill_type: bill_type || 'BILL',
            bill_number: nextBillNumber,
            reference: reference || null,
            created_at: saleCreatedAt,
            updated_by: validatedUpdatedBy
          }
        });
      } catch (storeIdError) {
        // If store_id column doesn't exist, use raw SQL to create sale without store_id
        if (storeIdError.code === 'P2022' && storeIdError.message?.includes('store_id')) {
          console.warn('⚠️ store_id column not found, creating sale using raw SQL. Please run migration!');

          await tx.$executeRaw`
            INSERT INTO sales (
              branch_id, cus_id, total_amount, discount, payment, payment_type,
              cash_payment, bank_payment, bank_title, advance_payment,
              debit_account_id, credit_account_id, loader_id, labour_charges, shipping_amount,
              bill_type, bill_number, reference, updated_by, created_at, updated_at
            ) VALUES (
              ${branchId}, ${cus_id}, ${Number(parseFloat(total_amount).toFixed(2))}, ${Number(parseFloat(discount || 0).toFixed(2))},
              ${Number(parseFloat(payment).toFixed(2))}, ${payment_type},
              ${Number(eff_cash.toFixed(2))}, ${Number(eff_bank.toFixed(2))}, ${bank_title || null},
              ${Number(parseFloat(advance_payment || 0).toFixed(2))},
              ${debit_account_id || null}, ${credit_account_id || null},
              ${loader_id || null}, ${Number(parseFloat(labour_charges || 0).toFixed(2))}, ${Number(parseFloat(shipping_amount || 0).toFixed(2))},
              ${bill_type || 'BILL'}, ${nextBillNumber}, ${reference || null}, ${validatedUpdatedBy},
              NOW(), NOW()
            )
          `;

          const insertedSales = await tx.$queryRaw`
            SELECT * FROM sales 
            WHERE branch_id = ${branchId}
            AND cus_id = ${cus_id} 
            AND total_amount = ${parseFloat(total_amount)}
            AND payment = ${parseFloat(payment)}
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
            ORDER BY sale_id DESC LIMIT 1
          `;

          if (!insertedSales || insertedSales.length === 0) {
            throw new Error('Failed to retrieve created sale');
          }

          sale = insertedSales[0];
        } else {
          throw storeIdError;
        }
      }

      const detailRows = sale_details.map((detail) => ({
        sale_id: sale.sale_id,
        store_id: parseInt(store_id),
        pro_id: detail.pro_id,
        vehicle_no: detail.vehicle_no || null,
        size: detail.size ? String(detail.size) : null,
        qnty: Number(parseFloat(detail.qnty || 0).toFixed(2)),
        unit: detail.unit,
        unit_rate: Number(parseFloat(detail.unit_rate || 0).toFixed(2)),
        total_amount: Number(parseFloat(detail.total_amount || 0).toFixed(2)),
        discount: Number(parseFloat(detail.discount || 0).toFixed(2)),
        net_total: Number((parseFloat(detail.total_amount || 0) - parseFloat(detail.discount || 0)).toFixed(2)),
        cus_id,
        updated_by: validatedUpdatedBy
      }));

      if (detailRows.length) {
        try {
          await tx.saleDetail.createMany({ data: detailRows });
        } catch (storeIdError) {
          if (storeIdError.code === 'P2022' && storeIdError.message?.includes('store_id')) {
            await Promise.all(detailRows.map((row) => tx.$executeRaw`
              INSERT INTO sale_details (
                sale_id, pro_id, vehicle_no, size, qnty, unit, unit_rate,
                total_amount, discount, net_total, cus_id, updated_by
              ) VALUES (
                ${row.sale_id}, ${row.pro_id},
                ${row.vehicle_no}, ${row.size || null}, ${row.qnty},
                ${row.unit}, ${row.unit_rate},
                ${row.total_amount}, ${row.discount},
                ${row.net_total}, ${row.cus_id},
                ${row.updated_by}
              )
            `));
          } else {
            throw storeIdError;
          }
        }
      }

      // Create split payments if provided
      saleLog('💰 Split payments received:', split_payments);
      saleLog('💰 Split payments length:', split_payments?.length);

      if (split_payments && split_payments.length > 0) {
        saleLog('✅ Creating split payments for sale:', sale.sale_id);

        const createdSplitPayments = await tx.splitPayment.createMany({
          data: split_payments.map((splitPayment) => ({
            sale_id: sale.sale_id,
            amount: parseFloat(splitPayment.amount),
            payment_type: splitPayment.payment_type,
            debit_account_id: splitPayment.debit_account_id || null,
            credit_account_id: splitPayment.credit_account_id || null,
            reference: splitPayment.reference || null
          }))
        });
        saleLog('✅ Split payments created:', createdSplitPayments.count);
      } else {
        saleLog('⚠️ No split payments to create - array is', split_payments === null ? 'NULL' : split_payments === undefined ? 'UNDEFINED' : 'EMPTY');
      }

      // isQuotation and isOrder are already defined above (before transaction)
      // Update store stock quantities (instead of global product stock) - Skip for quotations and orders
      if (!isQuotation && !isOrder && store_id) {
        await bulkUpdateStoreStock(store_id, sale_details, 'decrement', validatedUpdatedBy, tx);
      }

      // Special accounts already fetched before transaction
      // Create comprehensive ledger entries (only for non-quotations)
      const ledgerEntries = [];
      let runningBalance = customerOpeningBalance;

      const getRunningBalanceForAccount = async (accountId) => {
        const priorEntries = ledgerEntries.filter(e => e.cus_id === accountId);
        if (priorEntries.length > 0) {
          return priorEntries[priorEntries.length - 1].closing_balance;
        }
        return await resolveOpeningBalance(tx, accountId, saleCreatedAt);
      };

      if (!isQuotation) {
        // Create bill/order entry for both BILL and ORDER types
        // Only skip for quotations (which are just estimates)
        // IMPORTANT: For loaded orders, SKIP the bill entry because it was already created when the order was made
        saleLog(`\n${'='.repeat(60)}`);
        saleLog(`📝 ${actualIsLoadedOrder ? 'SKIPPING BILL ENTRY (Already exists from order)' : 'CREATING BILL ENTRY'}`);
        saleLog(`${'='.repeat(60)}`);
        saleLog(`Customer Previous Balance: ${runningBalance}`);
        saleLog(`Bill Amount (final after discount): ${total_amount}`);
        saleLog(`Discount Already Applied: ${discount}`);
        saleLog(`Bill Type: ${bill_type} (${isOrder ? 'ORDER' : 'REGULAR BILL'})`);
        saleLog(`Is Loaded Order: ${actualIsLoadedOrder}`);
        saleLog(`Today's Payments: Cash=${eff_cash}, Bank=${eff_bank}, Advance=${parseFloat(advance_payment || 0)}`);
        saleLog(`Expected Final Balance: ${runningBalance + parseFloat(total_amount) - (eff_cash + eff_bank)}`);
        saleLog(`${'='.repeat(60)}\n`);

        // ORDER: no full SALE debit (only payment credits). Regular BILL: full amount debit.
        // Order → sale conversion: full total_amount debited, then advance re-credited + combined cash/bank credit.
        if (!actualIsLoadedOrder && !isOrder) {
          // Bill credit amount is the final amount (discount already applied)
          const debitAmount = parseFloat(total_amount);

          if (debitAmount > 0) {
            // Build details showing discount information
            let billDetails = `Sale Bill - ${bill_type || 'BILL'} - Customer Account (Debit)`;
            if (parseFloat(discount || 0) > 0) {
              billDetails += ` [Discount Applied: ${parseFloat(discount || 0)}]`;
            }

            const billEntry = createLedgerEntry({
              cus_id,
              opening_balance: runningBalance,
              debit_amount: debitAmount,
              credit_amount: 0,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'DEBIT',
              details: billDetails,
              payments: 0,
              updated_by: validatedUpdatedBy
            });
            saleLog(`📝 Bill Entry Created: Opening=${billEntry.opening_balance}, Debit=${billEntry.debit_amount}, Closing=${billEntry.closing_balance}`);
            saleLog(`   Details: ${billDetails}`);
            ledgerEntries.push(billEntry);
            runningBalance = billEntry.closing_balance;  // Update running balance
          }
        } else if (isOrder) {
          saleLog(`⏭️ SKIPPED: Debit entry for ORDER — only advance payment ledger will be created`);
        } else if (actualIsLoadedOrder) {
          const orderTotal = parseFloat(total_amount) || 0;
          if (orderTotal > 0) {
            let billDetails = `Sale Bill (order conversion) - ${bill_type || 'BILL'} - Customer Account (Debit)`;
            if (parseFloat(discount || 0) > 0) {
              billDetails += ` [Discount Applied: ${parseFloat(discount || 0)}]`;
            }
            const billEntry = createLedgerEntry({
              cus_id,
              opening_balance: runningBalance,
              debit_amount: orderTotal,
              credit_amount: 0,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'DEBIT',
              details: billDetails,
              payments: 0,
              updated_by: validatedUpdatedBy
            });
            saleLog(`📝 Bill Entry (order conversion, full amount): Opening=${billEntry.opening_balance}, Credit=${billEntry.credit_amount}, Closing=${billEntry.closing_balance}`);
            ledgerEntries.push(billEntry);
            runningBalance = billEntry.closing_balance;
          }
        }

        // 2. Customer account (debit) for payments
        // Order → BILL conversion: full bill credited above; then advance debit + single combined cash+bank debit.
        // Other cases: one combined line (cash + bank + advance when applicable).
        const cashAmount = eff_cash;
        const bankAmount = eff_bank;
        const advancePaymentAmount = parseFloat(advance_payment || 0);
        // Advance is debited at ORDER creation time; never re-debit it here for regular bills.
        // The actualIsLoadedOrder path handles advance explicitly with its own conditional logic.
        const totalPaymentForCustomer = cashAmount + bankAmount;

        if (actualIsLoadedOrder) {
          const orderTotal = parseFloat(total_amount) || 0;
          const orderPrepaid = parseFloat(advance_payment || 0);
          const remaining = Math.max(0, orderTotal - orderPrepaid - cashAmount - bankAmount);

          // Single combined payment credit (cash + bank)
          const totalNewPayment = cashAmount + bankAmount;
          if (totalNewPayment > 0) {
            const paymentParts = [];
            if (cashAmount > 0) paymentParts.push(`Cash: ${cashAmount}`);
            if (bankAmount > 0) paymentParts.push(`Bank (${bank_title || 'Bank'}): ${bankAmount}`);
            const combinedPayEntry = createLedgerEntry({
              cus_id,
              opening_balance: runningBalance,
              debit_amount: 0,
              credit_amount: totalNewPayment,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'CREDIT',
              details: `Payment Received - ${bill_type || 'BILL'} - Customer Account (Credit) [${paymentParts.join(', ')}]`,
              payments: totalNewPayment,
              cash_payment: cashAmount,
              bank_payment: bankAmount,
              updated_by: validatedUpdatedBy
            });
            saleLog(`💳 Combined payment credit: ${totalNewPayment}, remaining=${remaining}, Closing=${combinedPayEntry.closing_balance}`);
            ledgerEntries.push(combinedPayEntry);
            runningBalance = combinedPayEntry.closing_balance;
          }
        } else if (!isOrder && totalPaymentForCustomer > 0) {
          // BILL / other: customer A/R is adjusted by this payment credit.
          // ORDER: do not post to the customer's ledger — only Cash/Bank (below); cus_balance stays unchanged.
          const salePaymentParts = [];
          if (cashAmount > 0) salePaymentParts.push(`Cash: ${cashAmount}`);
          if (bankAmount > 0) salePaymentParts.push(`Bank (${bank_title || 'Bank Account'}): ${bankAmount}`);
          if (advancePaymentAmount > 0) salePaymentParts.push(`Advance: ${advancePaymentAmount}`);
          const salePaymentDesc = salePaymentParts.length > 0 ? ` [${salePaymentParts.join(', ')}]` : '';
          const billLabel = isOrder ? 'ORDER' : (bill_type || 'BILL');

          const paymentEntry = createLedgerEntry({
            cus_id,
            opening_balance: runningBalance,
            debit_amount: 0,
            credit_amount: totalPaymentForCustomer,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'CREDIT',
            details: `Payment Received - ${billLabel} - Customer Account (Credit)${salePaymentDesc}`,
            payments: totalPaymentForCustomer,
            cash_payment: cashAmount,
            bank_payment: bankAmount,
            updated_by: validatedUpdatedBy
          });
          saleLog(`💳 Payment Entry: Opening=${paymentEntry.opening_balance}, Credit=${paymentEntry.credit_amount}, Closing=${paymentEntry.closing_balance}`);
          ledgerEntries.push(paymentEntry);
          runningBalance = paymentEntry.closing_balance;
        } else if (isOrder && (cashAmount > 0 || bankAmount > 0)) {
          // ORDER advance payment: single combined credit on customer account (reduces their balance)
          const totalAdvance = cashAmount + bankAmount;
          const advanceParts = [];
          if (cashAmount > 0) advanceParts.push(`${cashAmount.toLocaleString('en-PK')} Cash Account`);
          if (bankAmount > 0) advanceParts.push(`${bankAmount.toLocaleString('en-PK')} Bank Account (${bank_title || 'Bank'})`);

          const orderAdvanceEntry = createLedgerEntry({
            cus_id,
            opening_balance: runningBalance,
            debit_amount: 0,
            credit_amount: totalAdvance,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'CREDIT',
            details: `Advance Payment — ${advanceParts.join(' + ')}`,
            payments: totalAdvance,
            cash_payment: cashAmount,
            bank_payment: bankAmount,
            updated_by: validatedUpdatedBy,
            ledger_type: 'Order'
          });
          saleLog(`💳 ORDER advance: Credit=${orderAdvanceEntry.credit_amount}, Closing=${orderAdvanceEntry.closing_balance}, Desc="${orderAdvanceEntry.details}"`);
          ledgerEntries.push(orderAdvanceEntry);
          runningBalance = orderAdvanceEntry.closing_balance;
        }

        // 3. Bank Account - DEBIT (when bank payment is received)
        // When bank payment is received, bank account balance INCREASES (debit increases asset)
        // Always create ledger entry for bank payments
        let usedBankAccountId = null;  // Track which bank account is being used

        if (eff_bank > 0) {
          let bankAccountToUse = null;

          // 1. Try to resolve by debit_account_id if provided
          if (debit_account_id) {
            const specificBank = accountMap.get(Number(debit_account_id)) || await tx.customer.findUnique({
              where: { cus_id: Number(debit_account_id) }
            });
            if (specificBank) {
              bankAccountToUse = specificBank;
              saleLog(`🏦 Found bank by debit_account_id: ${specificBank.cus_name} (ID: ${specificBank.cus_id})`);
            }
          }

          // 2. Try to resolve by bank_title
          if (!bankAccountToUse && bank_title && bank_title.trim()) {
            saleLog(`🏦 BANK PAYMENT DETECTED with specific bank title: ${bank_title}`);

            // Find the specific bank account by name
            const specificBank = await tx.customer.findFirst({
              where: {
                cus_name: {
                  contains: bank_title
                },
                cus_category: specialAccounts?.bank?.cus_category
              }
            });

            if (specificBank) {
              bankAccountToUse = specificBank;
              saleLog(`🏦 Found specific bank by title: ${specificBank.cus_name} (ID: ${specificBank.cus_id})`);
            } else {
              saleLog(`⚠️ Bank "${bank_title}" not found, using generic Bank Account`);
            }
          }

          // 3. Fallback to generic bank account
          if (!bankAccountToUse) {
            bankAccountToUse = specialAccounts?.bank;
            if (bankAccountToUse) {
              saleLog(`🏦 Using generic bank account: ${bankAccountToUse.cus_name} (ID: ${bankAccountToUse.cus_id})`);
            }
          }

          if (bankAccountToUse) {
            usedBankAccountId = bankAccountToUse.cus_id;  // Store the bank ID we're using
            saleLog(`🏦 Bank Account Before: ID=${bankAccountToUse.cus_id}, Name=${bankAccountToUse.cus_name}, Balance=${bankAccountToUse.cus_balance}`);

            const bankEntry = createLedgerEntry({
              cus_id: bankAccountToUse.cus_id,
              opening_balance: await getRunningBalanceForAccount(bankAccountToUse.cus_id),
              debit_amount: Number(eff_bank.toFixed(2)),
              credit_amount: 0,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'DEBIT',
              details: `Payment Received - ${isOrder ? 'ORDER' : (bill_type || 'BILL')} - ${customer?.cus_name || 'Customer'} - BANK Account: ${bankAccountToUse.cus_name} (Debit)`,
              payments: Number(eff_bank.toFixed(2)),
              cash_payment: 0,
              bank_payment: Number(eff_bank.toFixed(2)),  // Mark as bank payment
              updated_by: validatedUpdatedBy,
              ledger_type: isOrder ? 'Order' : 'Sale'
            });
            saleLog(`🏦 Bank Ledger Entry: Opening=${bankEntry.opening_balance}, Debit=${bankEntry.debit_amount}, Closing=${bankEntry.closing_balance}`);
            ledgerEntries.push(bankEntry);
          }
        }

        // 4. Cash Account - DEBIT (when cash payment is received)
        // When cash payment is received, cash account balance INCREASES (debit increases asset)
        // Always create ledger entry for cash payments
        if (eff_cash > 0 && specialAccounts.cash) {
          saleLog(`💵 CASH PAYMENT DETECTED: ${eff_cash}`);
          saleLog(`💵 Cash Account Before: ID=${specialAccounts.cash.cus_id}, Name=${specialAccounts.cash.cus_name}, Balance=${specialAccounts.cash.cus_balance}`);

          const cashEntry = createLedgerEntry({
            cus_id: specialAccounts.cash.cus_id,
            opening_balance: await getRunningBalanceForAccount(specialAccounts.cash.cus_id),
            debit_amount: Number(eff_cash.toFixed(2)),
            credit_amount: 0,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'DEBIT',
            details: `Payment Received - ${isOrder ? 'ORDER' : (bill_type || 'BILL')} - ${customer?.cus_name || 'Customer'} - CASH Account (Debit)`,
            payments: Number(eff_cash.toFixed(2)),
            cash_payment: Number(eff_cash.toFixed(2)),  // Mark as cash payment
            bank_payment: 0,
            updated_by: validatedUpdatedBy,
            ledger_type: isOrder ? 'Order' : 'Sale'
          });
          saleLog(`💵 Cash Ledger Entry: Opening=${cashEntry.opening_balance}, Debit=${cashEntry.debit_amount}, Closing=${cashEntry.closing_balance}`);
          ledgerEntries.push(cashEntry);
        } else if (eff_cash > 0) {
          console.error(
            '❌ Cash payment recorded but Cash Account is missing after auto-create — no cash-side ledger line was added. Check customers / customer_categories.'
          );
        }

        // 5. Transport account entries — credit each transport account for its delivery charge share
        if (transport_details && transport_details.length > 0) {
          for (const td of transport_details) {
            let transportAmount = parseFloat(td.amount) || 0;
            if (transportAmount <= 0 && parseFloat(shipping_amount || 0) > 0) {
              transportAmount = parseFloat(shipping_amount) / transport_details.length;
            }
            if (!td.account_id || transportAmount <= 0) continue;

            const transportAccount = accountMap.get(parseInt(td.account_id)) || await tx.customer.findUnique({ where: { cus_id: parseInt(td.account_id) } });
            if (!transportAccount) {
              console.warn(`⚠️ Transport account ${td.account_id} not found — skipping ledger entry`);
              continue;
            }

            const transportEntry = createLedgerEntry({
              cus_id: transportAccount.cus_id,
              opening_balance: await getRunningBalanceForAccount(transportAccount.cus_id),
              debit_amount: 0,
              credit_amount: Number(transportAmount.toFixed(2)),
              bill_no: sale.sale_id.toString(),
              trnx_type: 'CREDIT',
              details: `Transport Charges - ${bill_type || 'BILL'} - ${customer?.cus_name || 'Customer'} (Credit)`,
              payments: 0,
              updated_by: validatedUpdatedBy
            });

            ledgerEntries.push(transportEntry);

            saleLog(`🚚 Transport Entry: Account=${transportAccount.cus_name}, Credit=${transportAmount}, Closing=${transportEntry.closing_balance}`);
          }
        }

        // 6. Split Payment Entries (if any) - Skip entries for bank/cash accounts (already created separately)
        // For ORDER: do not add split lines that post to the sale customer (advance is not a customer A/R line)
        if (split_payments && split_payments.length > 0) {
          for (const splitPayment of split_payments) {
            const splitAmount = parseFloat(splitPayment.amount);

            // Skip ledger entry if this is the bank account that was actually used (already created separately)
            if (usedBankAccountId && splitPayment.debit_account_id === usedBankAccountId) {
              saleLog(`⏭️ SKIPPING split payment ledger entry for bank account (ID: ${splitPayment.debit_account_id}) - already created separately`);
              continue;
            }

            // Skip ledger entry if this is the cash account (already created above)
            if (splitPayment.debit_account_id === specialAccounts.cash?.cus_id) {
              saleLog(`⏭️ SKIPPING split payment ledger entry for cash account (ID: ${splitPayment.debit_account_id}) - already created separately`);
              continue;
            }

            if (isOrder && splitPayment.debit_account_id === cus_id) {
              saleLog('⏭️ ORDER: Skipping split debit on sale customer — customer balance not affected');
              continue;
            }
            if (isOrder && splitPayment.credit_account_id === cus_id) {
              saleLog('⏭️ ORDER: Skipping split credit on sale customer — customer balance not affected');
              continue;
            }

            // Debit Split Payment Account (only if not bank/cash)
            if (splitPayment.debit_account_id) {
              const debitAccount = accountMap.get(splitPayment.debit_account_id) || await tx.customer.findUnique({
                where: { cus_id: splitPayment.debit_account_id }
              });

              if (debitAccount) {
                const splitDebitEntry = createLedgerEntry({
                  cus_id: splitPayment.debit_account_id,
                  opening_balance: await getRunningBalanceForAccount(splitPayment.debit_account_id),
                  debit_amount: splitAmount,
                  credit_amount: 0,
                  bill_no: sale.sale_id.toString(),
                  trnx_type: 'DEBIT',
                  details: `Split Payment - ${bill_type || 'BILL'} - Debit Account`,
                  payments: splitAmount,
                  updated_by: validatedUpdatedBy
                });
                ledgerEntries.push(splitDebitEntry);
              }
            }

            // Credit Split Payment Account
            if (splitPayment.credit_account_id) {
              const creditAccount = accountMap.get(splitPayment.credit_account_id) || await tx.customer.findUnique({
                where: { cus_id: splitPayment.credit_account_id }
              });

              if (creditAccount) {
                const splitCreditEntry = createLedgerEntry({
                  cus_id: splitPayment.credit_account_id,
                  opening_balance: await getRunningBalanceForAccount(splitPayment.credit_account_id),
                  debit_amount: 0,
                  credit_amount: splitAmount,
                  bill_no: sale.sale_id.toString(),
                  trnx_type: 'CREDIT',
                  details: `Split Payment - ${bill_type || 'BILL'} - Credit Account`,
                  payments: splitAmount,
                  updated_by: validatedUpdatedBy
                });
                ledgerEntries.push(splitCreditEntry);
              }
            }
          }
        }

        // Create all ledger entries (skip for quotations)
        if (!isQuotation) {
          await tx.ledger.createMany({
            data: ledgerEntries.map((entry) => ({
              branch_id: branchId,
              cus_id: entry.cus_id,
              opening_balance: entry.opening_balance,
              debit_amount: entry.debit_amount,
              credit_amount: entry.credit_amount,
              closing_balance: entry.closing_balance,
              bill_no: entry.bill_no,
              trnx_type: entry.trnx_type,
              details: entry.details,
              payments: entry.payments,
              cash_payment: entry.cash_payment || 0,
              bank_payment: entry.bank_payment || 0,
              updated_by: entry.updated_by,
              ledger_type: entry.ledger_type || null,
              created_at: saleCreatedAt
            }))
          });

          await syncAccountBalancesFromEntries(tx, ledgerEntries);

          // Update customer balance from ledger lines for this sale
          const customerLedgerEntries = ledgerEntries.filter(e => e.cus_id === cus_id);
          if (customerLedgerEntries.length > 0) {
            const lastCustomerEntry = customerLedgerEntries[customerLedgerEntries.length - 1];
            const ledgerClosingBalance = parseFloat(lastCustomerEntry.closing_balance);

            saleLog(`\n========== CUSTOMER BALANCE UPDATE START ==========`);
            saleLog(`Customer: ${customer.cus_name} (ID: ${cus_id})`);
            saleLog(`Customer Previous Balance: ${customer.cus_balance}`);
            saleLog(`Bill Type: ${bill_type}`);
            saleLog(`Bill Amount (netTotal): ${netTotal}`);
            saleLog(`Payment Received - Cash: ${eff_cash}, Bank: ${eff_bank}, Advance: ${advance_payment}`);
            saleLog(`Found ${customerLedgerEntries.length} ledger entries for customer`);

            // Show all customer ledger entries
            customerLedgerEntries.forEach((entry, idx) => {
              saleLog(`\n  Ledger Entry ${idx + 1}:`);
              saleLog(`    Opening: ${entry.opening_balance}`);
              saleLog(`    Debit: ${entry.debit_amount}, Credit: ${entry.credit_amount}`);
              saleLog(`    Closing: ${entry.closing_balance}`);
              saleLog(`    Details: ${entry.details.substring(0, 60)}`);
            });

            saleLog(`\nCustomer ledger closing balance: ${ledgerClosingBalance}`);
            saleLog(`========== CUSTOMER BALANCE UPDATE END ==========\n`);
          }
        }



        // Update cash account balance - SET directly to closing balance
        // IMPORTANT: Always update cash balance if cash payment exists, regardless of split payments
        // Skip only if split payments explicitly handle cash separately (cash in debit_account_id)
        const cashHandledBysSplitPayment = split_payments && split_payments.some(sp => sp.debit_account_id === specialAccounts.cash?.cus_id);

        if (eff_cash > 0 && specialAccounts.cash && !cashHandledBysSplitPayment) {
          // Find the cash account ledger entry to get its closing balance
          const cashLedgerEntry = ledgerEntries.find(e => e.cus_id === specialAccounts.cash.cus_id);
          if (cashLedgerEntry) {
            saleLog(`💵 CASH ACCOUNT: Ledger closing balance = ${cashLedgerEntry.closing_balance}`);
          }
        } else if (eff_cash > 0 && cashHandledBysSplitPayment) {
          saleLog(`💵 SKIPPING CASH BALANCE UPDATE: Split payments will handle it`);
        }

        // Update bank account balance - SET directly to closing balance
        // IMPORTANT: Always update bank balance if bank payment exists, regardless of split payments
        // Skip only if split payments explicitly handle bank separately (bank in debit_account_id)
        const bankHandledBySplitPayment = split_payments && split_payments.some(sp => sp.debit_account_id === usedBankAccountId);

        if (eff_bank > 0 && usedBankAccountId && !bankHandledBySplitPayment) {
          // Find the bank account ledger entry - it will be the DEBIT entry with bank_payment
          const bankLedgerEntry = ledgerEntries.find(e =>
            e.cus_id === usedBankAccountId && e.trnx_type === 'CREDIT' && e.bank_payment > 0
          );

          if (bankLedgerEntry) {
            saleLog(`🏦 BANK ACCOUNT: Ledger closing balance = ${bankLedgerEntry.closing_balance}`);
          }
        } else if (eff_bank > 0 && bankHandledBySplitPayment) {
          saleLog(`🏦 SKIPPING BANK BALANCE UPDATE: Split payments will handle it`);
        }

        // Update transporter balance (skip for quotations)
        if (loader_id && parseFloat(shipping_amount || 0) > 0) {
          await tx.loader.update({
            where: { loader_id },
            data: {
              loader_balance: {
                increment: parseFloat(shipping_amount || 0)
              }
            }
          });
        }

        // Update sundry debtors balance (skip for quotations)
        if (loader_id && specialAccounts && specialAccounts.sundryDebtors && parseFloat(shipping_amount || 0) > 0) {
          await tx.customer.update({
            where: { cus_id: specialAccounts.sundryDebtors.cus_id },
            data: {
              cus_balance: {
                decrement: parseFloat(shipping_amount || 0)
              }
            }
          });
        }

        // Update split payment account balances (skip for quotations)
        // NOTE: Use ledger entry closing balance instead of increment/decrement for accuracy
        if (split_payments && split_payments.length > 0) {
          for (const splitPayment of split_payments) {
            const splitAmount = parseFloat(splitPayment.amount);

            // Find the ledger entry for this split payment to get accurate closing balance
            if (splitPayment.debit_account_id) {
              // Find the ledger entry for this account to get closing balance
              const splitLedgerEntry = ledgerEntries.find(e => e.cus_id === splitPayment.debit_account_id);
              if (splitLedgerEntry) {
                saleLog(`💳 Debit account ${splitPayment.debit_account_id} balance to ledger closing: ${splitLedgerEntry.closing_balance}`);
              }
            }

            if (splitPayment.credit_account_id) {
              // Find the ledger entry for this account to get closing balance
              const splitLedgerEntry = ledgerEntries.find(e => e.cus_id === splitPayment.credit_account_id);
              if (splitLedgerEntry) {
                saleLog(`💳 Credit account ${splitPayment.credit_account_id} balance to ledger closing: ${splitLedgerEntry.closing_balance}`);
              }
            }
          }
        }

      } // End of if (!isQuotation) for all financial transactions

      // Automatically update converted order bill_type to ORDER_TRASH
      const targetOrdId = order_id || loaded_order_id;
      if (targetOrdId) {
        const ordId = parseInt(targetOrdId);
        if (Number.isFinite(ordId)) {
          await tx.$executeRaw`
            UPDATE sales SET bill_type = 'ORDER_TRASH', updated_at = NOW() WHERE sale_id = ${ordId}
          `;
          saleLog(`✅ Backend POST: Order #${ordId} automatically moved to ORDER_TRASH upon conversion to sale`);
        }
      }

      const affectedCusIds = [...new Set(ledgerEntries.map(e => e.cus_id))];

      return {
        ...sale,
        affectedCusIds,
        _debug: {
          isQuotation,
          ledgerEntriesCreated: ledgerEntries ? ledgerEntries.length : 0,
          specialAccountsAvailable: specialAccounts ? {
            hasCash: !!specialAccounts.cash,
            hasBank: !!specialAccounts.bank,
            hasSundryCreditors: !!specialAccounts.sundryCreditors,
            hasSundryDebtors: !!specialAccounts.sundryDebtors
          } : null
        }
      };
    }, {
      timeout: 120000,
      maxWait: 60000
    });

    const targetCreatedAt = result.created_at || new Date();
    // Non-blocking background recalculation: only run for main customer, skip system Cash/Bank accounts for instant response
    if (result.affectedCusIds?.length > 0) {
      const targetCusIds = result.affectedCusIds.filter(cid => cid === result.cus_id);
      if (targetCusIds.length > 0) {
        Promise.all(targetCusIds.map(cid => recalculateLedgerBalancesWithRetry(cid, 1, targetCreatedAt))).catch(err => {
          console.error('Async background ledger recalc error:', err);
        });
      }
    }

    let previousCustomerBalance = 0;
    try {
      previousCustomerBalance = await getPreviousCustomerBalance(
        prisma,
        result.cus_id,
        result.sale_id,
        targetCreatedAt
      );
    } catch (err) {
      console.warn('Could not compute previous customer balance in POST:', err.message);
    }

    const freshCustomer = await prisma.customer.findUnique({
      where: { cus_id: result.cus_id }
    });

    // Record activity log for sale creation
    logActivity({
      request,
      branchId,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.SALES,
      entityId: result.sale_id,
      description: `Sale/Invoice #${result.sale_id} (${result.bill_type || 'BILL'}) created for customer ID ${result.cus_id}. Total: Rs ${result.total_bill_amount || 0}.`,
      details: {
        sale_id: result.sale_id,
        cus_id: result.cus_id,
        bill_type: result.bill_type,
        total_amount: result.total_amount,
        total_bill_amount: result.total_bill_amount,
        cash_payment: result.cash_payment,
        bank_payment: result.bank_payment,
      },
    }).catch(() => {});

    return NextResponse.json({
      ...result,
      customer: freshCustomer || result.customer,
      previous_balance: previousCustomerBalance,
      previous_customer_balance: previousCustomerBalance
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    const errorMessage = error.message || 'Failed to create sale';

    // Provide more specific error messages for store_id column missing
    if (error.code === 'P2022' && error.message?.includes('store_id')) {
      return NextResponse.json({
        error: 'Database migration required: store_id column is missing',
        details: 'Please run the migration SQL to add store_id column to sales and sale_details tables.',
        instructions: [
          '1. Open phpMyAdmin or your MySQL client',
          '2. Select your database',
          '3. Go to SQL tab',
          '4. Run the SQL from ADD_STORE_ID_TO_SALES_SIMPLE.sql file',
          '5. After migration, run: npx prisma generate',
          '6. Restart your server'
        ],
        sql: `
ALTER TABLE \`sales\` ADD COLUMN \`store_id\` INT NULL AFTER \`cus_id\`;
ALTER TABLE \`sales\` ADD INDEX \`sales_store_id_fkey\` (\`store_id\`);
ALTER TABLE \`sales\` ADD CONSTRAINT \`sales_store_id_fkey\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`storeid\`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE \`sale_details\` ADD COLUMN \`store_id\` INT NULL AFTER \`sale_id\`;
ALTER TABLE \`sale_details\` ADD INDEX \`sale_details_store_id_fkey\` (\`store_id\`);
ALTER TABLE \`sale_details\` ADD CONSTRAINT \`sale_details_store_id_fkey\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`storeid\`) ON DELETE SET NULL ON UPDATE CASCADE;
        `.trim()
      }, { status: 500 });
    }

    // Check if this is a ledger-related error
    let isLedgerError = false;
    if (error.message?.includes('ledger') || error.message?.includes('Ledger') ||
      error.code === 'P1000' || error.code === 'P2002' || error.code === 'P2017') {
      isLedgerError = true;
      console.error('⚠️ LEDGER ERROR DETECTED - This might indicate missing special accounts (Cash Account, Bank Account) or category setup issues');
    }

    return NextResponse.json({
      error: errorMessage,
      type: error.name || 'UnknownError',
      code: error.code || 'UNKNOWN',
      isLedgerError: isLedgerError,
      hint: isLedgerError ? 'Verify that "Cash Account" and "Bank Account" categories exist in Customer Categories' : null,
      fullError: error.toString()
    }, { status: 500 });
  }
}

// PUT - Update sale (Reverse & Recreate ledger approach)
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      cus_id,
      store_id,
      total_amount,
      discount,
      payment,
      payment_type,
      cash_payment = 0,
      bank_payment = 0,
      bank_title,
      advance_payment = 0,
      debit_account_id,
      credit_account_id,
      loader_id,
      shipping_amount,
      labour_charges = 0,
      bill_type,
      reference,
      sale_details,
      transport_details,
      split_payments,
      updated_by,
      date = null,
      created_at: body_created_at = null
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
    }

    // Calculate net total (what customer owes for the bill)
    const netTotal = parseFloat(total_amount);

    // Determine if this update is for a quotation (skip finance)
    const isQuotationFromBody = bill_type === 'QUOTATION';
    const isOrder = bill_type === 'ORDER' || bill_type === 'ORDER_TRASH';
    const isSkipLedger = isQuotationFromBody;

    // Normalize effective cash/bank amounts
    const payValNorm = parseFloat(payment) || 0;
    let eff_cash = parseFloat(cash_payment ?? 0) || 0;
    let eff_bank = parseFloat(bank_payment ?? 0) || 0;
    const payTypeNorm = String(payment_type || 'CASH').toUpperCase();
    if (payValNorm > 0 && eff_cash === 0 && eff_bank === 0) {
      if (payTypeNorm === 'BANK_TRANSFER' || payTypeNorm === 'CHEQUE') {
        eff_bank = payValNorm;
      } else {
        eff_cash = payValNorm;
      }
    }

    // Get special accounts BEFORE transaction
    const specialAccounts = isSkipLedger ? null : await getSpecialAccountsForSale(branchId);

    const affectedCusIds = new Set();
    const oldOpeningBalances = {};
    let existingSale = null;
    let targetCreatedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // ═══════════════════════════════════════════
      // 1. FETCH EXISTING DATA
      // ═══════════════════════════════════════════
      existingSale = await tx.sale.findUnique({
        where: { sale_id: id },
        include: { sale_details: true }
      });

      if (!existingSale) {
        throw new Error('Sale not found');
      }

      // Determine target sale date:
      // If user explicitly changed the date to a different day, use the new date.
      // Otherwise, preserve the original created_at timestamp of the existing sale.
      targetCreatedAt = existingSale.created_at;
      if (date) {
        const existingDateStr = new Date(existingSale.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        let bodyDateStr = '';
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
          bodyDateStr = date.trim();
        } else {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            bodyDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
          }
        }
        if (bodyDateStr && bodyDateStr !== existingDateStr) {
          const parsed = parseLocalDateInKarachi(bodyDateStr, existingSale.created_at);
          if (parsed && !isNaN(parsed.getTime())) {
            targetCreatedAt = parsed;
          }
        }
      } else if (body_created_at) {
        const parsed = new Date(body_created_at);
        if (!isNaN(parsed.getTime())) {
          targetCreatedAt = parsed;
        }
      }

      const customer = await tx.customer.findUnique({
        where: { cus_id },
        include: { city: true }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Validate updated_by
      let validatedUpdatedBy = null;
      if (updated_by) {
        try {
          const userId = parseInt(updated_by);
          if (!isNaN(userId)) {
            const userExists = await tx.users.findUnique({ where: { user_id: userId } });
            if (userExists) validatedUpdatedBy = userId;
          }
        } catch (e) { /* leave null */ }
      }

      // ═══════════════════════════════════════════
      // 2. REVERSE OLD FINANCIAL EFFECTS
      // ═══════════════════════════════════════════
      const wasSkipLedger =
        existingSale.bill_type === 'QUOTATION';

      let oldAdvanceCash = 0;
      let oldAdvanceBank = 0;
      let oldAdvanceBankAccountId = null;

      if (!wasSkipLedger) {
        // 2a. Find all old ledger entries for this sale
        const oldLedgerEntries = await tx.ledger.findMany({
          where: { bill_no: String(id) }
        });
        oldLedgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

        for (const entry of oldLedgerEntries) {
          const cid = entry.cus_id;
          if (!oldOpeningBalances[cid]) {
            oldOpeningBalances[cid] = entry;
          } else {
            const currentEarliest = oldOpeningBalances[cid];
            const timeDiff = entry.created_at.getTime() - currentEarliest.created_at.getTime();
            if (timeDiff < 0 || (timeDiff === 0 && entry.l_id < currentEarliest.l_id)) {
              oldOpeningBalances[cid] = entry;
            }
          }
        }

        saleLog(`\n${'='.repeat(60)}`);
        saleLog(`🔄 BILL EDIT: REVERSING OLD LEDGER ENTRIES`);
        saleLog(`   Sale ID: ${id}`);
        saleLog(`   Old ledger entries found: ${oldLedgerEntries.length}`);
        saleLog(`${'='.repeat(60)}`);

        // Extract old advance payment breakdown if any
        // Handle both legacy types (CASH, BANK_TRANSFER) and new types (DEBIT, CREDIT)
        for (const entry of oldLedgerEntries) {
          const detailsLower = (entry.details || '').toLowerCase();
          if (detailsLower.includes('advance payment') || detailsLower.includes('payment received - order')) {
            // For legacy entries: CASH / BANK_TRANSFER; for new entries: DEBIT with cash_payment or bank_payment
            const isCashEntry = entry.trnx_type === 'CASH' || 
              (entry.trnx_type === 'DEBIT' && parseFloat(entry.cash_payment || 0) > 0 && parseFloat(entry.bank_payment || 0) === 0);
            const isBankEntry = entry.trnx_type === 'BANK_TRANSFER' ||
              (entry.trnx_type === 'DEBIT' && parseFloat(entry.bank_payment || 0) > 0);
            
            if (isCashEntry) {
              oldAdvanceCash = parseFloat(entry.debit_amount || entry.credit_amount || 0);
            } else if (isBankEntry) {
              oldAdvanceBank = parseFloat(entry.debit_amount || entry.credit_amount || 0);
              oldAdvanceBankAccountId = entry.cus_id;
            }
          }
        }

        // 2b. Reverse balance changes for each affected account
        // Group ledger entries by cus_id and calculate net effect per account
        const accountEffects = {};
        for (const entry of oldLedgerEntries) {
          const accountId = entry.cus_id;
          if (!accountEffects[accountId]) {
            accountEffects[accountId] = { totalDebit: 0, totalCredit: 0 };
          }
          accountEffects[accountId].totalDebit += parseFloat(entry.debit_amount || 0);
          accountEffects[accountId].totalCredit += parseFloat(entry.credit_amount || 0);
        }

        // Reverse each account's balance: undo (debit - credit) = subtract debit, add credit
        // Call prepareLedgerDeletion to re-link subsequent entries
        await prepareLedgerDeletion(tx, id);

        // 2c. Reverse old sundry debtors balance if existed
        if (existingSale.loader_id && parseFloat(existingSale.shipping_amount || 0) > 0) {
          if (specialAccounts?.sundryDebtors) {
            const oldShippingAmt = parseFloat(existingSale.shipping_amount || 0);
            await tx.customer.update({
              where: { cus_id: specialAccounts.sundryDebtors.cus_id },
              data: { cus_balance: { increment: oldShippingAmt } }
            });
            saleLog(`   🔄 Reversed sundry debtors balance: +${oldShippingAmt}`);
          }
        }

        // 2d. Delete all old ledger entries
        await tx.ledger.deleteMany({
          where: { bill_no: String(id) }
        });
        saleLog(`   🗑️ Deleted ${oldLedgerEntries.length} old ledger entries`);
      }

      // ═══════════════════════════════════════════
      // 3. UPDATE SALE RECORD & DETAILS
      // ═══════════════════════════════════════════

      // 3a. Restore store stock from old sale details
      const wasStockDeducted =
        existingSale.bill_type !== 'QUOTATION' &&
        existingSale.bill_type !== 'ORDER' &&
        existingSale.bill_type !== 'ORDER_TRASH';

      if (existingSale.store_id && wasStockDeducted) {
        const stockRestorePromises = existingSale.sale_details.map(async detail => {
          await updateStoreStock(existingSale.store_id, detail.pro_id, detail.qnty, 'increment', updated_by);
        });
        await Promise.all(stockRestorePromises);
      }

      // 3b. Delete old sale details
      await tx.saleDetail.deleteMany({ where: { sale_id: id } });

      // 3c. Update sale record
      const sale = await tx.sale.update({
        where: { sale_id: id },
        data: {
          cus_id,
          store_id: store_id ? parseInt(store_id) : existingSale.store_id,
          total_amount: Number(parseFloat(total_amount).toFixed(2)),
          discount: Number(parseFloat(discount || 0).toFixed(2)),
          payment: Number(parseFloat(payment).toFixed(2)),
          cash_payment: Number(eff_cash.toFixed(2)),
          bank_payment: Number(eff_bank.toFixed(2)),
          bank_title: bank_title || existingSale.bank_title || null,
          advance_payment: Number(parseFloat(advance_payment || 0).toFixed(2)),
          payment_type,
          debit_account_id: debit_account_id || null,
          credit_account_id: credit_account_id || null,
          loader_id: loader_id || null,
          shipping_amount: Number(parseFloat(shipping_amount || 0).toFixed(2)),
          labour_charges: Number(parseFloat(labour_charges || 0).toFixed(2)),
          bill_type: bill_type || 'BILL',
          reference: reference || null,
          created_at: targetCreatedAt,
          updated_by: validatedUpdatedBy
        }
      });

      // 3d. Create new sale details
      const finalStoreId = store_id ? parseInt(store_id) : existingSale.store_id;
      const saleDetailPromises = sale_details.map(detail =>
        tx.saleDetail.create({
          data: {
            sale_id: sale.sale_id,
            store_id: finalStoreId,
            pro_id: detail.pro_id,
            vehicle_no: detail.vehicle_no || null,
            size: detail.size ? String(detail.size) : null,
            qnty: Number(parseFloat(detail.qnty || 0).toFixed(2)),
            unit: detail.unit,
            unit_rate: Number(parseFloat(detail.unit_rate || 0).toFixed(2)),
            total_amount: Number(parseFloat(detail.total_amount || 0).toFixed(2)),
            discount: Number(parseFloat(detail.discount || 0).toFixed(2)),
            net_total: Number((parseFloat(detail.total_amount || 0) - parseFloat(detail.discount || 0)).toFixed(2)),
            cus_id,
            updated_by: validatedUpdatedBy
          }
        })
      );
      await Promise.all(saleDetailPromises);

      // 3e. Delete and recreate split payments
      await tx.splitPayment.deleteMany({ where: { sale_id: id } });

      if (split_payments && split_payments.length > 0) {
        const splitPaymentPromises = split_payments.map(splitPayment =>
          tx.splitPayment.create({
            data: {
              sale_id: sale.sale_id,
              amount: parseFloat(splitPayment.amount),
              payment_type: splitPayment.payment_type,
              debit_account_id: splitPayment.debit_account_id || null,
              credit_account_id: splitPayment.credit_account_id || null,
              reference: splitPayment.reference || null
            }
          })
        );
        await Promise.all(splitPaymentPromises);
      }

      // 3f. Update store stock with new quantities
      const isNewBillQuotationOrOrder =
        bill_type === 'QUOTATION' || bill_type === 'ORDER' || bill_type === 'ORDER_TRASH';

      if (!isNewBillQuotationOrOrder && finalStoreId) {
        const storeStockUpdatePromises = sale_details.map(async detail => {
          await updateStoreStock(finalStoreId, detail.pro_id, parseFloat(detail.qnty || 0), 'decrement', validatedUpdatedBy);
        });
        await Promise.all(storeStockUpdatePromises);
      }

      // ═══════════════════════════════════════════
      // 4. RECREATE ALL LEDGER ENTRIES (same as POST)
      // ═══════════════════════════════════════════
      if (!isSkipLedger) {
        const ledgerEntries = [];

        // Helper to query running balance from database or ledgerEntries array to chain them
        const getRunningBalanceForAccount = async (accountId) => {
          const priorEntries = ledgerEntries.filter(e => e.cus_id === accountId);
          if (priorEntries.length > 0) {
            return priorEntries[priorEntries.length - 1].closing_balance;
          }
          if (oldOpeningBalances[accountId]) {
            return parseFloat(oldOpeningBalances[accountId].opening_balance || 0);
          }
          return await resolveOpeningBalance(tx, accountId, targetCreatedAt);
        };

        // Re-fetch customer balance AFTER reversals to get the clean pre-sale state
        const freshCustomer = await tx.customer.findUnique({
          where: { cus_id },
          select: { cus_balance: true, cus_name: true }
        });
        let runningBalance = await getRunningBalanceForAccount(cus_id);

        saleLog(`\n${'='.repeat(60)}`);
        saleLog(`📝 BILL EDIT: RECREATING LEDGER ENTRIES`);
        saleLog(`   Customer: ${freshCustomer.cus_name} (ID: ${cus_id})`);
        saleLog(`   Pre-sale Balance: ${runningBalance}`);
        saleLog(`   New Bill Amount: ${total_amount}`);
        saleLog(`   New Payment: Cash=${eff_cash}, Bank=${eff_bank}`);
        saleLog(`   Advance Payment: ${advance_payment}`);
        saleLog(`${'='.repeat(60)}`);

        // ── 4a. Customer SALE credit (bill amount) — FIRST: add amount to customer ledger ──
        const debitAmount = parseFloat(total_amount);
        if (!isOrder && debitAmount > 0) {
          let billDetails = `Sale Bill - ${bill_type || 'BILL'} - Customer Account (Debit)`;
          if (parseFloat(discount || 0) > 0) {
            billDetails += ` [Discount Applied: ${parseFloat(discount || 0)}]`;
          }

          const billEntry = createLedgerEntry({
            cus_id,
            opening_balance: runningBalance,
            debit_amount: debitAmount,
            credit_amount: 0,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'DEBIT',
            details: billDetails,
            payments: 0,
            updated_by: validatedUpdatedBy
          });
          saleLog(`   📝 Bill Debit: ${debitAmount}, Closing=${billEntry.closing_balance}`);
          ledgerEntries.push(billEntry);
          runningBalance = billEntry.closing_balance;
        }

        // ── 4b. ORDER Stage Advance Payment entries — SECOND: record advance payment ──
        const advPaymentAmt = parseFloat(advance_payment || 0);
        if (!isOrder && advPaymentAmt > 0) {
          let advCash = oldAdvanceCash;
          let advBank = oldAdvanceBank;
          if (advCash === 0 && advBank === 0) {
            // Fallback if missing
            if (bank_title && bank_title.trim()) {
              advBank = advPaymentAmt;
            } else {
              advCash = advPaymentAmt;
            }
          }

          const advanceParts = [];
          if (advCash > 0) advanceParts.push(`${advCash.toLocaleString('en-PK')} Cash Account`);
          if (advBank > 0) advanceParts.push(`${advBank.toLocaleString('en-PK')} Bank Account (${bank_title || 'Bank'})`);

          const orderAdvanceEntry = createLedgerEntry({
            cus_id,
            opening_balance: runningBalance,
            debit_amount: 0,
            credit_amount: advPaymentAmt,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'CREDIT',
            details: `Advance Payment — ${advanceParts.join(' + ')}`,
            payments: advPaymentAmt,
            cash_payment: advCash,
            bank_payment: advBank,
            updated_by: validatedUpdatedBy,
            ledger_type: 'Order'
          });
          saleLog(`   💳 Advance Credit: ${advPaymentAmt}, Closing=${orderAdvanceEntry.closing_balance}`);
          ledgerEntries.push(orderAdvanceEntry);
          runningBalance = orderAdvanceEntry.closing_balance;

          // Bank debit for advance
          if (advBank > 0) {
            let bankAccountToUse = null;
            if (debit_account_id) {
              const specificBank = await tx.customer.findUnique({
                where: { cus_id: Number(debit_account_id) }
              });
              if (specificBank) {
                bankAccountToUse = specificBank;
              }
            }
            if (!bankAccountToUse && bank_title && bank_title.trim()) {
              const specificBank = await tx.customer.findFirst({
                where: {
                  cus_name: { contains: bank_title },
                  cus_category: specialAccounts?.bank?.cus_category
                }
              });
              if (specificBank) {
                bankAccountToUse = specificBank;
              }
            }
            if (!bankAccountToUse) {
              bankAccountToUse = specialAccounts?.bank;
            }

            if (bankAccountToUse) {
              const currentBankBalance = await getRunningBalanceForAccount(bankAccountToUse.cus_id);
              const bankEntry = createLedgerEntry({
                cus_id: bankAccountToUse.cus_id,
                opening_balance: currentBankBalance,
                debit_amount: Number(advBank.toFixed(2)),
                credit_amount: 0,
                bill_no: sale.sale_id.toString(),
                trnx_type: 'DEBIT',
                details: `Payment Received - ORDER - ${freshCustomer.cus_name} - BANK Account: ${bankAccountToUse.cus_name} (Debit)`,
                payments: Number(advBank.toFixed(2)),
                cash_payment: 0,
                bank_payment: Number(advBank.toFixed(2)),
                updated_by: validatedUpdatedBy,
                ledger_type: 'Order'
              });
              saleLog(`   🏦 Advance Bank Debit: ${advBank}, Closing=${bankEntry.closing_balance}`);
              ledgerEntries.push(bankEntry);
            }
          }

          // Cash debit for advance
          if (advCash > 0 && specialAccounts?.cash) {
            const currentCashBalance = await getRunningBalanceForAccount(specialAccounts.cash.cus_id);
            const cashEntry = createLedgerEntry({
              cus_id: specialAccounts.cash.cus_id,
              opening_balance: currentCashBalance,
              debit_amount: Number(advCash.toFixed(2)),
              credit_amount: 0,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'DEBIT',
              details: `Payment Received - ORDER - ${freshCustomer.cus_name} - CASH Account (Debit)`,
              payments: Number(advCash.toFixed(2)),
              cash_payment: Number(advCash.toFixed(2)),
              bank_payment: 0,
              updated_by: validatedUpdatedBy,
              ledger_type: 'Order'
            });
            saleLog(`   💵 Advance Cash Debit: ${advCash}, Closing=${cashEntry.closing_balance}`);
            ledgerEntries.push(cashEntry);
          }
        }

        // ── 4c. Customer payment debit ──
        const cashAmount = eff_cash;
        const bankAmount = eff_bank;
        const totalPaymentForCustomer = cashAmount + bankAmount;

        if (totalPaymentForCustomer > 0) {
          const paymentParts = [];
          if (cashAmount > 0) paymentParts.push(`Cash: ${cashAmount}`);
          if (bankAmount > 0) paymentParts.push(`Bank (${bank_title || 'Bank Account'}): ${bankAmount}`);
          
          let paymentDetails;
          if (isOrder) {
            const advanceParts = [];
            if (cashAmount > 0) advanceParts.push(`${cashAmount.toLocaleString('en-PK')} Cash Account`);
            if (bankAmount > 0) advanceParts.push(`${bankAmount.toLocaleString('en-PK')} Bank Account (${bank_title || 'Bank'})`);
            paymentDetails = `Advance Payment — ${advanceParts.join(' + ')}`;
          } else {
            const paymentDesc = paymentParts.length > 0 ? ` [${paymentParts.join(', ')}]` : '';
            paymentDetails = `Payment Received - ${bill_type || 'BILL'} - Customer Account (Credit)${paymentDesc}`;
          }

          const paymentEntry = createLedgerEntry({
            cus_id,
            opening_balance: runningBalance,
            debit_amount: 0,
            credit_amount: totalPaymentForCustomer,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'CREDIT',
            details: paymentDetails,
            payments: totalPaymentForCustomer,
            cash_payment: cashAmount,
            bank_payment: bankAmount,
            updated_by: validatedUpdatedBy,
            ledger_type: isOrder ? 'Order' : 'Sale'
          });
          saleLog(`   💳 Payment Credit: ${totalPaymentForCustomer}, Closing=${paymentEntry.closing_balance}`);
          ledgerEntries.push(paymentEntry);
          runningBalance = paymentEntry.closing_balance;
        }

        // ── 4d. Bank Account DEBIT (bank payment received) ──
        let usedBankAccountId = null;

        if (eff_bank > 0) {
          let bankAccountToUse = null;

          // 1. Try to resolve by debit_account_id if provided
          if (debit_account_id) {
            const specificBank = await tx.customer.findUnique({
              where: { cus_id: Number(debit_account_id) }
            });
            if (specificBank) {
              bankAccountToUse = specificBank;
            }
          }

          // 2. Try to resolve by bank_title
          const effectiveBankTitle = bank_title || existingSale.bank_title;
          if (!bankAccountToUse && effectiveBankTitle && effectiveBankTitle.trim()) {
            const specificBank = await tx.customer.findFirst({
              where: {
                cus_name: { contains: effectiveBankTitle },
                cus_category: specialAccounts?.bank?.cus_category
              }
            });
            if (specificBank) {
              bankAccountToUse = specificBank;
            }
          }

          // 3. Fallback to generic bank account
          if (!bankAccountToUse) {
            bankAccountToUse = specialAccounts?.bank;
          }

          if (bankAccountToUse) {
            usedBankAccountId = bankAccountToUse.cus_id;
            const currentBankBalance = await getRunningBalanceForAccount(bankAccountToUse.cus_id);

            const bankEntry = createLedgerEntry({
              cus_id: bankAccountToUse.cus_id,
              opening_balance: currentBankBalance,
              debit_amount: Number(eff_bank.toFixed(2)),
              credit_amount: 0,
              bill_no: sale.sale_id.toString(),
              trnx_type: 'DEBIT',
              details: `Payment Received - ${bill_type || 'BILL'} - ${freshCustomer.cus_name} - BANK Account: ${bankAccountToUse.cus_name} (Debit)`,
              payments: Number(eff_bank.toFixed(2)),
              cash_payment: 0,
              bank_payment: Number(eff_bank.toFixed(2)),
              updated_by: validatedUpdatedBy,
              ledger_type: isOrder ? 'Order' : 'Sale'
            });
            saleLog(`   🏦 Bank Debit: ${eff_bank}, Closing=${bankEntry.closing_balance}`);
            ledgerEntries.push(bankEntry);
          }
        }

        // ── 4e. Cash Account DEBIT (cash payment received) ──
        if (eff_cash > 0 && specialAccounts?.cash) {
          const currentCashBalance = await getRunningBalanceForAccount(specialAccounts.cash.cus_id);

          const cashEntry = createLedgerEntry({
            cus_id: specialAccounts.cash.cus_id,
            opening_balance: currentCashBalance,
            debit_amount: Number(eff_cash.toFixed(2)),
            credit_amount: 0,
            bill_no: sale.sale_id.toString(),
            trnx_type: 'DEBIT',
            details: `Payment Received - ${isOrder ? 'ORDER' : (bill_type || 'BILL')} - ${freshCustomer.cus_name} - CASH Account (Debit)`,
            payments: Number(eff_cash.toFixed(2)),
            cash_payment: Number(eff_cash.toFixed(2)),
            bank_payment: 0,
            updated_by: validatedUpdatedBy,
            ledger_type: isOrder ? 'Order' : 'Sale'
          });
          saleLog(`   💵 Cash Debit: ${eff_cash}, Closing=${cashEntry.closing_balance}`);
          ledgerEntries.push(cashEntry);
        }

        // ── 4f. Transport account entries ──
        if (transport_details && transport_details.length > 0) {
          for (const td of transport_details) {
            let transportAmount = parseFloat(td.amount) || 0;
            if (transportAmount <= 0 && parseFloat(shipping_amount || 0) > 0) {
              transportAmount = parseFloat(shipping_amount) / transport_details.length;
            }
            if (!td.account_id || transportAmount <= 0) continue;

            const transportAccount = await tx.customer.findUnique({ where: { cus_id: parseInt(td.account_id) } });
            if (!transportAccount) continue;

            const currentTransportBalance = await getRunningBalanceForAccount(transportAccount.cus_id);

            const transportEntry = createLedgerEntry({
              cus_id: transportAccount.cus_id,
              opening_balance: currentTransportBalance,
              debit_amount: 0,
              credit_amount: Number(transportAmount.toFixed(2)),
              bill_no: sale.sale_id.toString(),
              trnx_type: 'CREDIT',
              details: `Transport Charges - ${bill_type || 'BILL'} - ${freshCustomer.cus_name} (Credit)`,
              payments: 0,
              updated_by: validatedUpdatedBy
            });
            ledgerEntries.push(transportEntry);

            saleLog(`   🚚 Transport Credit: Account=${transportAccount.cus_name}, Amount=${transportAmount}`);
          }
        }

        // ── 4g. Split Payment ledger entries ──
        if (split_payments && split_payments.length > 0) {
          for (const splitPayment of split_payments) {
            const splitAmount = parseFloat(splitPayment.amount);

            // Skip if already handled by bank/cash entries above
            if (usedBankAccountId && splitPayment.debit_account_id === usedBankAccountId) continue;
            if (splitPayment.debit_account_id === specialAccounts?.cash?.cus_id) continue;

            // Debit split payment account
            if (splitPayment.debit_account_id) {
              const currentSplitDebitBalance = await getRunningBalanceForAccount(splitPayment.debit_account_id);
              const splitDebitEntry = createLedgerEntry({
                cus_id: splitPayment.debit_account_id,
                opening_balance: currentSplitDebitBalance,
                debit_amount: splitAmount,
                credit_amount: 0,
                bill_no: sale.sale_id.toString(),
                trnx_type: 'DEBIT',
                details: `Split Payment - ${bill_type || 'BILL'} - Debit Account`,
                payments: splitAmount,
                updated_by: validatedUpdatedBy
              });
              ledgerEntries.push(splitDebitEntry);
            }

            // Credit split payment account
            if (splitPayment.credit_account_id) {
              const currentSplitCreditBalance = await getRunningBalanceForAccount(splitPayment.credit_account_id);
              const splitCreditEntry = createLedgerEntry({
                cus_id: splitPayment.credit_account_id,
                opening_balance: currentSplitCreditBalance,
                debit_amount: 0,
                credit_amount: splitAmount,
                bill_no: sale.sale_id.toString(),
                trnx_type: 'CREDIT',
                details: `Split Payment - ${bill_type || 'BILL'} - Credit Account`,
                payments: splitAmount,
                updated_by: validatedUpdatedBy
              });
              ledgerEntries.push(splitCreditEntry);
            }
          }
        }

        // ═══════════════════════════════════════════
        // 5. PERSIST LEDGER ENTRIES & UPDATE BALANCES
        // ═══════════════════════════════════════════
        saleLog(`\n   📊 PERSISTING ${ledgerEntries.length} LEDGER ENTRIES`);

        for (let i = 0; i < ledgerEntries.length; i++) {
          const entry = ledgerEntries[i];
          const nextLId = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: nextLId,
              cus_id: entry.cus_id,
              opening_balance: entry.opening_balance,
              debit_amount: entry.debit_amount,
              credit_amount: entry.credit_amount,
              closing_balance: entry.closing_balance,
              bill_no: entry.bill_no,
              trnx_type: entry.trnx_type,
              details: entry.details,
              payments: entry.payments,
              cash_payment: entry.cash_payment || 0,
              bank_payment: entry.bank_payment || 0,
              updated_by: entry.updated_by,
              ledger_type: entry.ledger_type,
              created_at: targetCreatedAt // PRESERVE TIMESTAMP!
            }
          });
          saleLog(`   ✅ Entry ${i + 1}/${ledgerEntries.length}: ${entry.trnx_type} on account ${entry.cus_id}`);
        }

        // Add new ledger entries accounts to affected set
        ledgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

        // ── 5b. Update sundry debtors balance ──
        if (loader_id && specialAccounts?.sundryDebtors && parseFloat(shipping_amount || 0) > 0) {
          await tx.customer.update({
            where: { cus_id: specialAccounts.sundryDebtors.cus_id },
            data: {
              cus_balance: {
                decrement: parseFloat(shipping_amount || 0)
              }
            }
          });
          saleLog(`   🚚 Sundry debtors balance updated: -${parseFloat(shipping_amount || 0)}`);
        }

        // ── 5c. Update loader balance ──
        if (loader_id && parseFloat(shipping_amount || 0) > 0) {
          // Reverse old loader balance if existed
          if (existingSale.loader_id && parseFloat(existingSale.shipping_amount || 0) > 0) {
            await tx.loader.update({
              where: { loader_id: existingSale.loader_id },
              data: { loader_balance: { decrement: parseFloat(existingSale.shipping_amount || 0) } }
            });
          }
          // Apply new loader balance
          await tx.loader.update({
            where: { loader_id },
            data: { loader_balance: { increment: parseFloat(shipping_amount || 0) } }
          });
        } else if (existingSale.loader_id && parseFloat(existingSale.shipping_amount || 0) > 0) {
          // Old sale had loader but new one doesn't — reverse old
          await tx.loader.update({
            where: { loader_id: existingSale.loader_id },
            data: { loader_balance: { decrement: parseFloat(existingSale.shipping_amount || 0) } }
          });
        }

        // ── 5d. Update sale previous_balance to align with pre-sale state ──
        const firstCustEntry = await tx.ledger.findFirst({
          where: { bill_no: String(id), cus_id: cus_id },
          orderBy: { l_id: 'asc' },
          select: { opening_balance: true }
        });
        if (firstCustEntry) {
          await tx.sale.update({
            where: { sale_id: id },
            data: { previous_balance: firstCustEntry.opening_balance }
          });
        }

        saleLog(`\n${'='.repeat(60)}`);
        saleLog(`✅ BILL EDIT COMPLETE: ${ledgerEntries.length} ledger entries created and balances recalculated`);
        saleLog(`${'='.repeat(60)}\n`);

      } // End of if (!isSkipLedger)

      return sale;
    }, {
      timeout: 120000 // 120 seconds timeout
    });

    // Recalculate balances chronologically for all affected accounts synchronously with retry
    const recalcStartDate = existingSale?.created_at && existingSale.created_at < targetCreatedAt
      ? existingSale.created_at
      : targetCreatedAt;

    const uniqueIds = [...new Set(Array.from(affectedCusIds).filter(Boolean))];
    for (const cid of uniqueIds) {
      try {
        await recalculateLedgerBalancesWithRetry(cid, 3, recalcStartDate);
      } catch (err) {
        console.error(`Ledger recalc failed for account ${cid}:`, err);
      }
    }

    let previousCustomerBalance = 0;
    try {
      previousCustomerBalance = await getPreviousCustomerBalance(
        prisma,
        parseInt(cus_id),
        id,
        targetCreatedAt
      );
    } catch (err) {
      console.warn('Could not compute previous customer balance for sale', id, err.message);
    }

    const freshCustomer = await prisma.customer.findUnique({
      where: { cus_id: parseInt(cus_id) }
    });

    // Record activity log for sale update
    logActivity({
      request,
      branchId,
      action: AUDIT_ACTIONS.UPDATE,
      module: AUDIT_MODULES.SALES,
      entityId: id,
      description: `Sale/Invoice #${id} (${bill_type || 'BILL'}) was updated. Customer ID: ${cus_id}. Total: Rs ${total_bill_amount || 0}.`,
      details: {
        sale_id: id,
        cus_id,
        bill_type,
        total_amount,
        total_bill_amount,
      },
    }).catch(() => {});

    return NextResponse.json({
      ...result,
      customer: freshCustomer || result.customer,
      previous_balance: previousCustomerBalance,
      previous_customer_balance: previousCustomerBalance,
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    return NextResponse.json({ error: 'Failed to update sale', details: error.message }, { status: 500 });
  }
}

// PATCH - Update sale status only (lightweight, no finance/stock recalculation)
export async function PATCH(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { id, bill_type } = body;

    if (!id) return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
    if (!bill_type) return NextResponse.json({ error: 'bill_type is required' }, { status: 400 });

    const saleId = parseInt(id);
    if (!Number.isFinite(saleId)) {
      return NextResponse.json({ error: 'Invalid sale id' }, { status: 400 });
    }

    // Use raw SQL to bypass Prisma client-side enum validation.
    // The DB enum column already supports ORDER_TRASH via `prisma db push`,
    // but the cached client may be older and reject newly-added enum values.
    const allowed = new Set(['QUOTATION', 'ORDER', 'ORDER_TRASH', 'BILL', 'DISPATCHED']);
    const nextType = String(bill_type).toUpperCase();
    if (!allowed.has(nextType)) {
      return NextResponse.json({ error: `Invalid bill_type: ${bill_type}` }, { status: 400 });
    }

    const affected = await prisma.$executeRaw`
      UPDATE sales SET bill_type = ${nextType}, updated_at = NOW() WHERE sale_id = ${saleId}
    `;

    if (!affected) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    logActivity({
      request,
      branchId,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      module: AUDIT_MODULES.SALES,
      entityId: saleId,
      description: `Sale/Order #${saleId} status changed to ${nextType}.`,
      details: { sale_id: saleId, bill_type: nextType },
    }).catch(() => {});

    return NextResponse.json({ success: true, sale_id: saleId, bill_type: nextType });
  } catch (err) {
    console.error('❌ Error updating sale status:', err);
    return NextResponse.json({ error: 'Failed to update sale status', details: err?.message }, { status: 500 });
  }
}

// DELETE - Delete sale
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
    }

    // Get special accounts BEFORE transaction
    const specialAccounts = await getSpecialAccountsForSale(branchId);

    const affectedCusIds = new Set();
    let existingSale = null;

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Get existing sale with details
      existingSale = await tx.sale.findUnique({
        where: { sale_id: id },
        include: {
          sale_details: true
        }
      });

      if (!existingSale) {
        throw new Error('Sale not found');
      }

      // Restore store stock quantities
      // Only restore if it wasn't a QUOTATION or ORDER-like type (which don't deduct stock)
      const shouldRestoreStock =
        existingSale.bill_type !== 'QUOTATION' &&
        existingSale.bill_type !== 'ORDER' &&
        existingSale.bill_type !== 'ORDER_TRASH';

      if (existingSale.store_id && shouldRestoreStock) {
        const stockRestorePromises = existingSale.sale_details.map(async detail => {
          await updateStoreStock(existingSale.store_id, detail.pro_id, detail.qnty, 'increment', null);
        });
        await Promise.all(stockRestorePromises);
      }

      // Get all ledger entries associated with this sale/order before deleting them
      const oldLedgerEntries = await tx.ledger.findMany({
        where: { bill_no: String(id) }
      });

      oldLedgerEntries.forEach(entry => affectedCusIds.add(entry.cus_id));

      saleLog(`🗑️ DELETING SALE/ORDER: Reversing balances for ${oldLedgerEntries.length} ledger entries`);

      // Call prepareLedgerDeletion to re-link subsequent entries
      await prepareLedgerDeletion(tx, id);

      // Delete ledger entries for this sale
      await tx.ledger.deleteMany({
        where: { bill_no: String(id) }
      });

      // Reverse loader balance
      if (existingSale.loader_id && parseFloat(existingSale.shipping_amount || 0) > 0) {
        await tx.loader.update({
          where: { loader_id: existingSale.loader_id },
          data: { loader_balance: { decrement: parseFloat(existingSale.shipping_amount || 0) } }
        });
      }

      // Reverse sundry debtors balance
      if (existingSale.loader_id && specialAccounts?.sundryDebtors && parseFloat(existingSale.shipping_amount || 0) > 0) {
        await tx.customer.update({
          where: { cus_id: specialAccounts.sundryDebtors.cus_id },
          data: { cus_balance: { increment: parseFloat(existingSale.shipping_amount || 0) } }
        });
      }

      // Delete sale details (cascade should handle this, but being explicit)
      await tx.saleDetail.deleteMany({
        where: { sale_id: id }
      });

      // Delete sale
      await tx.sale.delete({
        where: { sale_id: id }
      });
    }, {
      timeout: 120000 // 120 seconds (2 minutes) timeout for complex transactions with ledger entries
    });

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    const recalcStartDate = existingSale?.created_at || new Date();
    for (const cid of affectedCusIds) {
      try {
        await recalculateLedgerBalancesWithRetry(cid, 3, recalcStartDate);
      } catch (err) {
        console.error(`Ledger recalc failed for customer ${cid} after DELETE:`, err);
      }
    }

    // Record activity log for sale deletion
    logActivity({
      request,
      branchId,
      action: AUDIT_ACTIONS.DELETE,
      module: AUDIT_MODULES.SALES,
      entityId: id,
      description: `Sale/Invoice #${id} was deleted. Total: Rs ${existingSale?.total_bill_amount || 0}.`,
      details: {
        sale_id: id,
        customer_id: existingSale?.cus_id,
        total_bill_amount: existingSale?.total_bill_amount,
        bill_type: existingSale?.bill_type,
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json({ error: 'Failed to delete sale', details: error.message }, { status: 500 });
  }
}
