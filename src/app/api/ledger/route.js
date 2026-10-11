import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateClosingBalance, ACCOUNT_NATURE } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

export const dynamic = 'force-dynamic';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const LEDGER_TX_OPTIONS = { timeout: 60000, maxWait: 60000 };

function parseBillNoSortKey(billNo) {
  return parseInt(String(billNo || '').replace(/\D/g, ''), 10) || 0;
}

async function applyLedgerBalanceUpdates(tx, updates) {
  const BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ l_id, opening_balance, closing_balance }) =>
        tx.ledger.update({
          where: { l_id },
          data: { opening_balance, closing_balance },
        })
      )
    );
  }
}

// ========================================
// GET — Get all ledger entries or one entry
// ========================================
// Helper to parse dates in Pakistan Standard Time (UTC+5)
function parseLocalDateRange(startDateStr, endDateStr) {
  if (!startDateStr && !endDateStr) return null;
  const tzOffset = '+05:00';
  const range = {};
  if (startDateStr) {
    range.gte = new Date(`${startDateStr}T00:00:00.000${tzOffset}`);
  }
  if (endDateStr) {
    range.lte = new Date(`${endDateStr}T23:59:59.999${tzOffset}`);
  }
  return range;
}

// ========================================
// GET — Get all ledger entries or one entry
// ========================================
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // optional: ?id=1
  const customerId = searchParams.get('customerId') ? parseInt(searchParams.get('customerId')) : null; // optional: ?customerId=1
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')) : null;
  const typeId = searchParams.get('typeId') ? parseInt(searchParams.get('typeId')) : null;
  const search = searchParams.get('search');
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : null;
  const all = searchParams.get('all') === 'true' || searchParams.get('allTime') === 'true';

  try {
    if (id) {
      const ledger = await prisma.ledger.findUnique({
        where: { l_id: id },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true,
              cus_category: true,
              cus_type: true,
              customer_category: {
                select: {
                  cus_cat_title: true
                }
              },
              customer_type: {
                select: {
                  cus_type_title: true
                }
              }
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              role: true
            }
          }
        }
      });

      if (!ledger) {
        return errorResponse('Ledger entry not found', 404);
      }

      return NextResponse.json(ledger);
    }

    // Build where clause
    const where = {};
    if (customerId) {
      where.cus_id = customerId;
    }

    if (startDate || endDate) {
      where.created_at = parseLocalDateRange(startDate, endDate);
    }

    if (categoryId || typeId) {
      where.customer = {};
      if (categoryId) {
        where.customer.cus_category = categoryId;
      }
      if (typeId) {
        where.customer.cus_type = typeId;
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      const orConditions = [
        { details: { contains: searchLower } },
        { bill_no: { contains: searchLower } },
        {
          customer: {
            OR: [
              { cus_name: { contains: searchLower } },
              { cus_phone_no: { contains: searchLower } },
              { cus_phone_no2: { contains: searchLower } },
              { cus_reference: { contains: searchLower } }
            ]
          }
        }
      ];

      const searchInt = parseInt(search);
      if (!isNaN(searchInt)) {
        orConditions.push({ cus_id: searchInt });
      }

      const searchFloat = parseFloat(search);
      if (!isNaN(searchFloat)) {
        orConditions.push({ debit_amount: searchFloat });
        orConditions.push({ credit_amount: searchFloat });
        orConditions.push({ closing_balance: searchFloat });
      }

      where.OR = orConditions;
    }

    const hasFilters = customerId || startDate || endDate || categoryId || typeId || search || all;

    // HIGH-PERFORMANCE PATH: When querying for a specific customer/account,
    // fetch customer metadata ONCE rather than duplicating deeply nested
    // customer/category/type relations across thousands of ledger rows.
    if (customerId) {
      const [singleCustomer, ledgerEntries] = await Promise.all([
        prisma.customer.findUnique({
          where: { cus_id: customerId },
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true,
            cus_phone_no2: true,
            cus_reference: true,
            cus_category: true,
            cus_type: true,
            customer_category: {
              select: {
                cus_cat_title: true
              }
            },
            customer_type: {
              select: {
                cus_type_title: true
              }
            }
          }
        }),
        prisma.ledger.findMany({
          where,
          select: {
            l_id: true,
            branch_id: true,
            cus_id: true,
            opening_balance: true,
            debit_amount: true,
            credit_amount: true,
            closing_balance: true,
            bill_no: true,
            trnx_type: true,
            details: true,
            payments: true,
            cash_payment: true,
            bank_payment: true,
            updated_by: true,
            ledger_type: true,
            created_at: true,
            updated_at: true,
            updated_by_user: {
              select: {
                user_id: true,
                full_name: true,
                role: true
              }
            }
          },
          orderBy: { l_id: 'desc' },
          ...(limit ? { take: limit } : {})
        })
      ]);

      if (singleCustomer) {
        for (let i = 0; i < ledgerEntries.length; i++) {
          ledgerEntries[i].customer = singleCustomer;
        }
      }

      return NextResponse.json(ledgerEntries);
    }

    const queryOptions = {
      where,
      include: {
        customer: {
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true,
            cus_phone_no2: true,
            cus_reference: true,
            cus_category: true,
            cus_type: true,
            customer_category: {
              select: {
                cus_cat_title: true
              }
            },
            customer_type: {
              select: {
                cus_type_title: true
              }
            }
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        }
      },
      orderBy: { l_id: 'desc' }
    };

    if (limit) {
      queryOptions.take = limit;
    } else if (!hasFilters && !all) {
      // Limit to 200 entries by default to make initial unfocused loading fast
      queryOptions.take = 200;
    }

    const ledgerEntries = await prisma.ledger.findMany(queryOptions);

    return NextResponse.json(ledgerEntries);
  } catch (err) {
    console.error('❌ Error fetching ledger entries:', err);
    return errorResponse('Failed to fetch ledger entries', 500);
  }
}

// ========================================
// POST — Create a new ledger entry
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
      debit_amount = 0,
      credit_amount = 0,
      bill_no,
      trnx_type,
      details,
      payments = 0,
      updated_by
    } = body;

    // Validation for required fields
    if (!cus_id) {
      return errorResponse('Customer ID is required');
    }
    if (!trnx_type || !['CASH', 'CHEQUE', 'BANK_TRANSFER', 'REBATE', 'PURCHASE', 'PURCHASE_RETURN', 'SALE', 'SALE_RETURN', 'CASH_PAYMENT', 'BANK_PAYMENT', 'ADJUSTMENT'].includes(trnx_type)) {
      return errorResponse('Valid transaction type is required');
    }
    if (debit_amount < 0 || credit_amount < 0) {
      return errorResponse('Debit and credit amounts must be non-negative');
    }
    if (debit_amount === 0 && credit_amount === 0) {
      return errorResponse('Either debit or credit amount must be greater than 0');
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { cus_id: parseInt(cus_id) },
      include: { customer_category: true }
    });

    if (!customer) {
      return errorResponse('Customer not found', 404);
    }

    // Verify updated_by user exists to avoid foreign key violation
    let validUpdatedBy = null;
    if (updated_by) {
      const userExists = await prisma.users.findUnique({
        where: { user_id: parseInt(updated_by) }
      });
      if (userExists) {
        validUpdatedBy = parseInt(updated_by);
      } else {
        console.warn(`⚠️ User with id ${updated_by} not found. Setting updated_by to null.`);
      }
    }

    // Get customer's current balance
    const customerData = await prisma.customer.findUnique({
      where: { cus_id: parseInt(cus_id) },
      select: { cus_balance: true }
    });

    if (!customerData) {
      return errorResponse('Customer data not found', 404);
    }

    const openingBalance = parseFloat(customerData.cus_balance || 0);
    const debitNum = parseFloat(debit_amount || 0);
    const creditNum = parseFloat(credit_amount || 0);
    const closingBalance = calculateClosingBalance(openingBalance, debitNum, creditNum);

    const l_id = body.l_id || await getNextId('ledger', 'l_id');

    let ledgerTypeVal = body.ledger_type;
    if (!ledgerTypeVal) {
      const bStr = (bill_no || '').toString().toUpperCase();
      const detLower = (details || '').toLowerCase();
      if (bStr.startsWith('PR-')) {
        ledgerTypeVal = 'Purchase Return';
      } else if (bStr.startsWith('EXP-')) {
        ledgerTypeVal = 'Expense';
      } else if (detLower.includes('package subscription')) {
        ledgerTypeVal = 'Order';
      } else if (detLower.includes('sale return') || detLower.includes('refund paid out')) {
        ledgerTypeVal = 'Sale Return';
      } else if (bStr.startsWith('PAY-')) {
        ledgerTypeVal = detLower.includes('payment received') || detLower.includes('receive') ? 'Receiving' : 'Payment';
      } else if (bStr.startsWith('JRN-')) {
        ledgerTypeVal = 'Journal';
      } else if (trnx_type === 'PURCHASE') {
        ledgerTypeVal = 'Purchase';
      } else if (trnx_type === 'SALE') {
        ledgerTypeVal = detLower.includes('order') ? 'Order' : 'Sale';
      } else if (detLower.includes('purchase')) {
        ledgerTypeVal = 'Purchase';
      } else if (detLower.includes('sale') || detLower.includes('bill')) {
        ledgerTypeVal = detLower.includes('order') ? 'Order' : 'Sale';
      } else if (detLower.includes('cargo') || detLower.includes('labour') || detLower.includes('delivery') || detLower.includes('fare')) {
        ledgerTypeVal = 'Purchase';
      }
    }

    // Create the ledger entry
    const result = await prisma.ledger.create({
      data: {
        l_id,
        cus_id: parseInt(cus_id),
        opening_balance: openingBalance,
        debit_amount: debitNum,
        credit_amount: creditNum,
        closing_balance: closingBalance,
        bill_no: bill_no ? String(bill_no) : null,
        trnx_type: trnx_type,
        details: details || null,
        payments: parseFloat(payments || 0),
        updated_by: validUpdatedBy,
        ledger_type: ledgerTypeVal || null
      }
    });

    // Update customer balance
    await prisma.customer.update({
      where: { cus_id: parseInt(cus_id) },
      data: { cus_balance: closingBalance }
    });

    // Fetch the complete ledger entry with relations
    const completeLedger = await prisma.ledger.findUnique({
      where: { l_id: result.l_id },
      include: {
        customer: {
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true,
            cus_category: true,
            cus_type: true,
            customer_category: {
              select: {
                cus_cat_title: true
              }
            },
            customer_type: {
              select: {
                cus_type_title: true
              }
            }
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(completeLedger, { status: 201 });
  } catch (err) {
    console.error('❌ Error creating ledger entry:', err);
    return errorResponse(`Failed to create ledger entry: ${err.message}`, 500);
  }
}

// ========================================
// PUT — Update an existing ledger entry
// ========================================
// Payment/Receiving entries: original entry kept intact; a new ADJUSTMENT entry
// is created for the net amount difference and the customer balance is updated
// by that delta only.
// Sale / Purchase / Return entries: cannot be edited here — edit the source
// document instead (which handles its own ledger adjustments).
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
      debit_amount,
      credit_amount,
      closing_balance,
      bill_no,
      trnx_type,
      details,
      updated_by,
      direct_edit = false
    } = body;

    if (!id) return errorResponse('Ledger ID is required');
    if (!cus_id) return errorResponse('Customer ID is required');

    // Fetch existing entry
    const existingLedger = await prisma.ledger.findUnique({ where: { l_id: id } });
    if (!existingLedger) return errorResponse('Ledger entry not found', 404);

    if (direct_edit) {
      const NON_EDITABLE_DIRECT = ['SALE', 'SALE_RETURN', 'PURCHASE', 'PURCHASE_RETURN', 'ORDER'];
      if (NON_EDITABLE_DIRECT.includes(existingLedger.trnx_type)) {
        return errorResponse(
          'Sale, purchase and order ledger entries cannot be edited here. Edit the source document instead.',
          403
        );
      }

      const billRef = String(existingLedger.bill_no || '').trim().toUpperCase();
      if (/^PAY-\d+$/.test(billRef)) {
        return errorResponse(
          'Payment entries are linked to cash/bank accounts. Use Edit Latest Transaction or open the payment from the row menu so all legs stay in sync.',
          403
        );
      }
      if (/^JRN-\d+$/.test(billRef)) {
        return errorResponse('Journal entries must be edited from General Journal.', 403);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update the target ledger entry with the new values
        const updateData = {};
        if (debit_amount !== undefined) updateData.debit_amount = parseFloat(debit_amount || 0);
        if (credit_amount !== undefined) updateData.credit_amount = parseFloat(credit_amount || 0);
        if (closing_balance !== undefined) updateData.closing_balance = parseFloat(closing_balance || 0);
        if (details !== undefined) updateData.details = details;
        if (bill_no !== undefined) updateData.bill_no = bill_no ? String(bill_no) : null;
        if (updated_by !== undefined) updateData.updated_by = updated_by;

        const updatedEntry = await tx.ledger.update({
          where: { l_id: id },
          data: updateData
        });

        // 2. Fetch all ledger entries for this customer to recalculate running balances
        const customer = await tx.customer.findUnique({
          where: { cus_id: existingLedger.cus_id },
          include: { customer_category: true }
        });
        if (!customer) throw new Error('Customer not found');

        const entries = await tx.ledger.findMany({
          where: { cus_id: existingLedger.cus_id },
          orderBy: [
            { created_at: 'asc' },
            { l_id: 'asc' }
          ]
        });

        // Re-sort in JS to match standard chronological order: created_at ASC → bill_no ASC → l_id ASC
        entries.sort((a, b) => {
          const timeDiff = a.created_at.getTime() - b.created_at.getTime();
          if (timeDiff !== 0) return timeDiff;
          const billA = parseBillNoSortKey(a.bill_no);
          const billB = parseBillNoSortKey(b.bill_no);
          if (billA !== billB) return billA - billB;
          return a.l_id - b.l_id;
        });

        let runningBalance = entries.length > 0 ? parseFloat(entries[0].opening_balance || 0) : 0;
        const balanceUpdates = [];

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          let opening = runningBalance;
          let closing = entry.closing_balance;

          // If this is the entry we just updated and user provided a new closing balance, lock it
          if (entry.l_id === id && closing_balance !== undefined) {
            opening = runningBalance;
            closing = parseFloat(closing_balance || 0);
          } else {
            // Otherwise calculate chronologically
            opening = runningBalance;
            const debit = parseFloat(entry.debit_amount || 0);
            const credit = parseFloat(entry.credit_amount || 0);
            closing = opening + debit - credit;
          }

          if (
            Math.abs(parseFloat(entry.opening_balance) - opening) > 0.01 ||
            Math.abs(parseFloat(entry.closing_balance) - closing) > 0.01 ||
            entry.l_id === id
          ) {
            balanceUpdates.push({
              l_id: entry.l_id,
              opening_balance: Number(opening.toFixed(2)),
              closing_balance: Number(closing.toFixed(2)),
            });
            entry.opening_balance = opening;
            entry.closing_balance = closing;
          }

          runningBalance = closing;
        }

        if (balanceUpdates.length > 0) {
          await applyLedgerBalanceUpdates(tx, balanceUpdates);
        }

        // Update customer balance
        await tx.customer.update({
          where: { cus_id: existingLedger.cus_id },
          data: { cus_balance: Number(runningBalance.toFixed(2)) }
        });

        return updatedEntry;
      }, LEDGER_TX_OPTIONS);

      // Return complete entry
      const completeLedger = await prisma.ledger.findUnique({
        where: { l_id: result.l_id },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true,
              cus_category: true,
              cus_type: true,
              customer_category: { select: { cus_cat_title: true } },
              customer_type: { select: { cus_type_title: true } }
            }
          },
          updated_by_user: {
            select: { user_id: true, full_name: true, role: true }
          }
        }
      });
      return NextResponse.json(completeLedger);
    }

    if (parseFloat(debit_amount || 0) < 0 || parseFloat(credit_amount || 0) < 0) {
      return errorResponse('Debit and credit amounts must be non-negative');
    }

    // Only payment/receiving entries may be edited here
    const NON_EDITABLE = ['SALE', 'SALE_RETURN', 'PURCHASE', 'PURCHASE_RETURN', 'ORDER'];
    if (NON_EDITABLE.includes(existingLedger.trnx_type)) {
      return errorResponse(
        'Sale, purchase and order ledger entries cannot be edited here. Edit the source document instead.',
        403
      );
    }

    // Fetch customer
    const customer = await prisma.customer.findUnique({
      where: { cus_id },
      include: { customer_category: true }
    });
    if (!customer) return errorResponse('Customer not found', 404);

    const result = await prisma.$transaction(async (tx) => {
      // ── Calculate net change in customer balance ──
      // Old effect on balance = old_debit - old_credit
      // Desired new effect    = new_debit - new_credit
      // Adjustment            = desired - old
      const oldDebit = Number(parseFloat(existingLedger.debit_amount || 0).toFixed(2));
      const oldCredit = Number(parseFloat(existingLedger.credit_amount || 0).toFixed(2));
      const newDebit = Number(parseFloat(debit_amount || 0).toFixed(2));
      const newCredit = Number(parseFloat(credit_amount || 0).toFixed(2));

      const netChange = Number(((newDebit - newCredit) - (oldDebit - oldCredit)).toFixed(2));

      // ── Update only the metadata on the original entry (amounts unchanged) ──
      const updatedLedger = await tx.ledger.update({
        where: { l_id: id },
        data: {
          bill_no: bill_no !== undefined ? (bill_no ? String(bill_no) : null) : existingLedger.bill_no,
          trnx_type: trnx_type || existingLedger.trnx_type,
          details: details !== undefined ? (details || null) : existingLedger.details,
          updated_by: updated_by || existingLedger.updated_by
        }
      });

      // ── Create adjustment entry if the amount changed ──
      if (netChange !== 0) {
        const currentBalance = Number(parseFloat(customer.cus_balance || 0).toFixed(2));
        const isIncrease = netChange > 0;
        const adjustmentAmt = Math.abs(netChange);
        const newBalance = Number((currentBalance + netChange).toFixed(2));
        const entryBillNo = bill_no ? String(bill_no) : existingLedger.bill_no;
        const entryDesc = details || existingLedger.details || '';

        const debitAmt = isIncrease ? adjustmentAmt : 0;
        const creditAmt = isIncrease ? 0 : adjustmentAmt;
        const typeLabel = isIncrease ? 'Debit' : 'Credit';

        const l_id_adj = await getNextId('ledger', 'l_id', tx);

        await tx.ledger.create({
          data: {
            l_id: l_id_adj,
            cus_id,
            opening_balance: currentBalance,
            debit_amount: debitAmt,
            credit_amount: creditAmt,
            closing_balance: newBalance,
            bill_no: entryBillNo,
            trnx_type: 'ADJUSTMENT',
            details: `Payment Edit - ${typeLabel} Adjustment ${adjustmentAmt}${entryDesc ? ' | ' + entryDesc : ''}`,
            payments: 0,
            cash_payment: 0,
            bank_payment: 0,
            updated_by: updated_by || null,
            ledger_type: 'Adjustment'
          }
        });

        await tx.customer.update({
          where: { cus_id },
          data: { cus_balance: newBalance }
        });
      }

      return updatedLedger;
    }, LEDGER_TX_OPTIONS);

    // Return updated entry with relations
    const completeLedger = await prisma.ledger.findUnique({
      where: { l_id: result.l_id },
      include: {
        customer: {
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true,
            cus_category: true,
            cus_type: true,
            customer_category: {
              select: {
                cus_cat_title: true
              }
            },
            customer_type: {
              select: {
                cus_type_title: true
              }
            }
          }
        },
        updated_by_user: {
          select: { user_id: true, full_name: true, role: true }
        }
      }
    });

    return NextResponse.json(completeLedger);
  } catch (err) {
    console.error('❌ Error updating ledger entry:', err);
    return errorResponse(`Failed to update ledger entry: ${err.message}`, 500);
  }
}

// ========================================
// DELETE — Delete a ledger entry
// ========================================
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // /api/ledger?id=1

  if (!id) {
    return errorResponse('Ledger ID is required');
  }

  try {
    const existingLedger = await prisma.ledger.findUnique({
      where: { l_id: id }
    });

    if (!existingLedger) {
      return errorResponse('Ledger entry not found', 404);
    }

    // Delete the ledger entry
    await prisma.ledger.delete({
      where: { l_id: id }
    });

    return NextResponse.json({ message: 'Ledger entry deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting ledger entry:', err);
    return errorResponse('Failed to delete ledger entry', 500);
  }
}
