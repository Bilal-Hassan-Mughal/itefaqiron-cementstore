import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateStoreStock } from '@/lib/storeStock';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

export const dynamic = 'force-dynamic';

function saleReturnBillNo(returnId) {
  return `SR-${returnId}`;
}

function saleReturnBillNoVariants(returnId) {
  const id = String(returnId);
  return id.startsWith('SR-') ? [id] : [saleReturnBillNo(returnId), id];
}

function returnIdFromLedgerBillNo(billNo) {
  const s = String(billNo || '');
  return s.startsWith('SR-') ? s.slice(3) : s;
}

function ledgerBillNoWhere(returnId) {
  return { bill_no: { in: saleReturnBillNoVariants(returnId) } };
}

function saleReturnHttpStatus(error) {
  const msg = String(error?.message || '');
  if (
    msg.includes('Return customer cannot') ||
    msg.includes('Transport account must') ||
    msg.includes('Transport account is required') ||
    msg.includes('Customer not found') ||
    msg.includes('Sale not found') ||
    msg.includes('Sale return not found') ||
    msg.includes('Invalid return') ||
    msg.includes('Return qty') ||
    msg.includes('Missing required')
  ) {
    return 400;
  }
  return 500;
}

function isTransportCategoryTitle(title) {
  const t = String(title || '').toLowerCase();
  return t.includes('transport') || t.includes('transporter');
}

async function validateReturnCustomer(tx, cus_id, transport_details) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    include: { customer_category: true, customer_type: true },
  });
  if (!customer) {
    throw new Error('Customer not found');
  }
  const catTitle = customer.customer_category?.cus_cat_title || '';
  const typeTitle = customer.customer_type?.cus_type_title || '';
  if (isTransportCategoryTitle(catTitle) || isTransportCategoryTitle(typeTitle)) {
    throw new Error(
      'Return customer cannot be a Transport account. Select the actual customer (e.g. Walk-in Customer), and pick the transporter separately.'
    );
  }
  const transportIds = (transport_details || [])
    .map((td) => parseInt(td.account_id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (transportIds.includes(cus_id)) {
    throw new Error('Transport account must be different from the return customer.');
  }
  return customer;
}

/** Resolves the correct opening balance for any customer/account at a target created_at timestamp. */
async function resolveOpeningBalance(tx, cus_id, target_created_at) {
  const priorEntry = await tx.ledger.findFirst({
    where: { cus_id, created_at: { lt: target_created_at } },
    orderBy: [
      { created_at: 'desc' },
      { l_id: 'desc' },
    ],
    select: { closing_balance: true },
  });

  if (priorEntry) {
    return parseFloat(priorEntry.closing_balance || 0);
  }

  const nextEntry = await tx.ledger.findFirst({
    where: { cus_id, created_at: { gte: target_created_at } },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' },
    ],
    select: { opening_balance: true },
  });

  if (nextEntry) {
    return parseFloat(nextEntry.opening_balance || 0);
  }

  const customer = await tx.customer.findUnique({
    where: { cus_id },
    select: { cus_balance: true },
  });
  return parseFloat(customer?.cus_balance || 0);
}

/**
 * Post transporter ledger on sale return.
 * - Manual return (no linked sale): CREDIT transporter — same direction as a normal sale transport line.
 * - Linked return (reversing original bill transport): DEBIT transporter — undo the original sale credit.
 */
async function postReturnTransportLedger(tx, {
  returnId,
  saleId,
  shippingAmount,
  transport_details,
  customerName,
  validatedUpdatedBy,
  affectedCusIds,
  entryTimestamp,
}) {
  const shipping = parseFloat(shippingAmount || 0);
  if (shipping <= 0) return;

  const targets = [];

  if (Array.isArray(transport_details) && transport_details.length > 0) {
    for (const td of transport_details) {
      const accountId = parseInt(td.account_id, 10);
      if (!Number.isFinite(accountId) || accountId <= 0) continue;
      let amt = parseFloat(td.amount) || 0;
      if (amt <= 0) {
        amt = shipping / transport_details.length;
      }
      if (amt > 0) targets.push({ cus_id: accountId, amount: amt });
    }
  } else if (saleId) {
    const originalTransportLedgerEntries = await tx.ledger.findMany({
      where: {
        bill_no: String(saleId),
        details: { contains: 'Transport' },
        credit_amount: { gt: 0 },
      },
      orderBy: { l_id: 'asc' },
    });
    for (const entry of originalTransportLedgerEntries) {
      const amt = parseFloat(entry.credit_amount || 0);
      if (amt > 0) targets.push({ cus_id: entry.cus_id, amount: amt });
    }
  }

  if (targets.length === 0) {
    console.warn(`Sale Return #${returnId}: delivery ${shipping} but no transport ledger targets`);
    return;
  }

  const ts = entryTimestamp || new Date();
  const isManualReturn = !saleId;
  const useTransportCredit = isManualReturn;

  for (const { cus_id, amount } of targets) {
    const lineAmount = Number(parseFloat(amount).toFixed(2));
    if (lineAmount <= 0) continue;

    if (Array.isArray(affectedCusIds)) {
      if (!affectedCusIds.includes(cus_id)) affectedCusIds.push(cus_id);
    } else if (affectedCusIds?.add) {
      affectedCusIds.add(cus_id);
    }

    const opening = await resolveOpeningBalance(tx, cus_id, ts);
    const transportReturnEntry = createLedgerEntry({
      cus_id,
      opening_balance: opening,
      debit_amount: useTransportCredit ? 0 : lineAmount,
      credit_amount: useTransportCredit ? lineAmount : 0,
      bill_no: saleReturnBillNo(returnId),
      trnx_type: useTransportCredit ? 'CREDIT' : 'DEBIT',
      details: useTransportCredit
        ? `Transport Charges - Sale Return #${returnId} - ${customerName || 'Customer'} (Credit)`
        : `Transport Charges - Sale Return #${returnId} - Original Bill #${saleId} (Debit/Reversal)`,
      payments: 0,
      updated_by: validatedUpdatedBy,
      ledger_type: 'Sale Return',
    });

    const l_id_trans = await getNextId('ledger', 'l_id', tx);
    await tx.ledger.create({
      data: {
        l_id: l_id_trans,
        ...transportReturnEntry,
      },
    });
  }
}

/**
 * Customer sale-return bill lines (mirror sale bill on customer, separate transport account).
 * - Credit gross product total (reverse of sale bill debit on products)
 * - Debit delivery / labour / discount withheld from cash refund
 * Net on customer: -(computedTotal - deductions) = -grandTotal
 */
async function createCustomerSaleReturnBillEntries(tx, {
  cus_id,
  returnId,
  computedTotal,
  shippingAmount,
  labourChargesAmount,
  discountAmount,
  openingBalance,
  validatedUpdatedBy,
}) {
  let running = parseFloat(openingBalance || 0);
  const billNo = saleReturnBillNo(returnId);
  const productTotal = parseFloat(computedTotal || 0);
  const shipping = parseFloat(shippingAmount || 0);
  const labour = parseFloat(labourChargesAmount || 0);
  const discount = parseFloat(discountAmount || 0);
  const deductions = shipping + labour + discount;

  if (productTotal > 0) {
    const billEntry = createLedgerEntry({
      cus_id,
      opening_balance: running,
      debit_amount: 0,
      credit_amount: productTotal,
      bill_no: billNo,
      trnx_type: 'CREDIT',
      details: 'Sale Return Bill - SALE_RETURN - Customer Account (Credit)',
      payments: 0,
      updated_by: validatedUpdatedBy,
      ledger_type: 'Sale Return',
    });
    const l_id_bill = await getNextId('ledger', 'l_id', tx);
    await tx.ledger.create({
      data: { l_id: l_id_bill, ...billEntry },
    });
    running = billEntry.closing_balance;
  }

  if (deductions > 0) {
    const parts = [];
    if (shipping > 0) parts.push(`Delivery: ${shipping}`);
    if (labour > 0) parts.push(`Labour: ${labour}`);
    if (discount > 0) parts.push(`Discount: ${discount}`);
    const deductEntry = createLedgerEntry({
      cus_id,
      opening_balance: running,
      debit_amount: deductions,
      credit_amount: 0,
      bill_no: billNo,
      trnx_type: 'DEBIT',
      details: `Sale Return - ${parts.join(', ')} (Debit)`,
      payments: 0,
      updated_by: validatedUpdatedBy,
      ledger_type: 'Sale Return',
    });
    const l_id_ded = await getNextId('ledger', 'l_id', tx);
    await tx.ledger.create({
      data: { l_id: l_id_ded, ...deductEntry },
    });
    running = deductEntry.closing_balance;
  }

  return running;
}

// Chronologically recalculates all ledger entry opening/closing balances for a customer and updates their customer table balance.
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
  entries.sort((a, b) => {
    const timeDiff = a.created_at.getTime() - b.created_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    const billA = parseInt(a.bill_no) || 0;
    const billB = parseInt(b.bill_no) || 0;
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

// Helper: get special accounts (Cash, Bank, Sundry Debtors/Creditors)
async function getSpecialAccounts(tx) {
  // Find special accounts by category, not by exact name
  // This is more flexible and works regardless of the account's specific name
  const allCategories = await tx.customerCategory.findMany();

  const categoryMap = {};
  allCategories.forEach(cat => {
    const lowerTitle = cat.cus_cat_title.toLowerCase();
    if (lowerTitle === 'cash' || (lowerTitle.includes('cash') && lowerTitle.includes('account'))) {
      categoryMap['Cash Account'] = cat.cus_cat_id;
    } else if (lowerTitle === 'bank' || (lowerTitle.includes('bank') && lowerTitle.includes('account'))) {
      categoryMap['Bank Account'] = cat.cus_cat_id;
    } else if (lowerTitle.includes('sundry') && lowerTitle.includes('creditor')) {
      categoryMap['Sundry Creditors'] = cat.cus_cat_id;
    } else if (lowerTitle.includes('sundry') && lowerTitle.includes('debtor')) {
      categoryMap['Sundry Debtors'] = cat.cus_cat_id;
    }
  });

  // Now find accounts using these category IDs
  const categoryIds = Object.values(categoryMap);
  const specialAccounts = await tx.customer.findMany({
    where: {
      cus_category: {
        in: categoryIds
      }
    }
  });

  const accounts = {};
  specialAccounts.forEach(account => {
    const categoryTitle = account.cus_category === categoryMap['Cash Account'] ? 'Cash Account' :
                        account.cus_category === categoryMap['Bank Account'] ? 'Bank Account' :
                        account.cus_category === categoryMap['Sundry Creditors'] ? 'Sundry Creditors' :
                        account.cus_category === categoryMap['Sundry Debtors'] ? 'Sundry Debtors' : null;
    
    if (categoryTitle === 'Cash Account') accounts.cash = account;
    if (categoryTitle === 'Bank Account') accounts.bank = account;
    if (categoryTitle === 'Sundry Creditors') accounts.sundryCreditors = account;
    if (categoryTitle === 'Sundry Debtors') accounts.sundryDebtors = account;
  });

  console.log('✅ Special accounts found:', {
    cash: accounts.cash ? `${accounts.cash.cus_name} (ID: ${accounts.cash.cus_id})` : 'Not found',
    bank: accounts.bank ? `${accounts.bank.cus_name} (ID: ${accounts.bank.cus_id})` : 'Not found',
    sundryCreditors: accounts.sundryCreditors ? `${accounts.sundryCreditors.cus_name} (ID: ${accounts.sundryCreditors.cus_id})` : 'Not found',
    sundryDebtors: accounts.sundryDebtors ? `${accounts.sundryDebtors.cus_name} (ID: ${accounts.sundryDebtors.cus_id})` : 'Not found'
  });

  return accounts;
}

// GET - Fetch all sale returns with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const listMode = searchParams.get('list') === 'true';

    if (id) {
      // Fetch single sale return
      const saleReturn = await prisma.saleReturn.findUnique({
        where: { return_id: id },
        include: {
          sale: true,
          customer: {
            include: {
              customer_category: true
            }
          },
          return_details: {
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
              loader_phone: true,
              loader_balance: true
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

      if (!saleReturn) {
        return NextResponse.json({ error: 'Sale return not found' }, { status: 404 });
      }

      const ledgerEntry = await prisma.ledger.findFirst({
        where: {
          ...ledgerBillNoWhere(saleReturn.return_id),
          cus_id: saleReturn.cus_id,
          ledger_type: { contains: 'Return' }
        },
        orderBy: { l_id: 'asc' },
        select: { opening_balance: true }
      });

      const netCredit = parseFloat(saleReturn.total_amount || 0)
        - parseFloat(saleReturn.labour_charges || 0)
        - parseFloat(saleReturn.shipping_amount || 0)
        - parseFloat(saleReturn.discount || 0)
        - parseFloat(saleReturn.payment || 0);

      const prevBal = ledgerEntry
        ? parseFloat(ledgerEntry.opening_balance)
        : (parseFloat(saleReturn.customer?.cus_balance || 0) + netCredit);

      const enhancedSaleReturn = {
        ...saleReturn,
        previous_balance: prevBal,
        previous_customer_balance: prevBal
      };

      return NextResponse.json(enhancedSaleReturn);
    } else {
      // Fetch all sale returns
      if (listMode) {
        const saleReturns = await prisma.saleReturn.findMany({
          select: {
            return_id: true,
            sale_id: true,
            total_amount: true,
            discount: true,
            payment: true,
            payment_type: true,
            shipping_amount: true,
            labour_charges: true,
            reference: true,
            created_at: true,
            updated_at: true,
            cus_id: true,
            customer: {
              select: {
                cus_id: true,
                cus_name: true,
                cus_phone_no: true,
                cus_address: true,
                cus_balance: true,
                name_urdu: true,
              },
            },
            return_details: {
              select: {
                return_detail_id: true,
                qnty: true,
                unit_rate: true,
                total_amount: true,
                store_id: true,
                product: {
                  select: { pro_id: true, pro_title: true },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
        });
        return NextResponse.json(saleReturns);
      }

      const saleReturns = await prisma.saleReturn.findMany({
        include: {
          sale: true,
          customer: {
            include: {
              customer_category: true
            }
          },
          return_details: {
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
              loader_phone: true,
              loader_balance: true
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
      });

      const returnBillNos = saleReturns.flatMap((sr) => saleReturnBillNoVariants(sr.return_id));
      const ledgerEntries = await prisma.ledger.findMany({
        where: {
          bill_no: { in: returnBillNos },
          ledger_type: { contains: 'Return' }
        },
        orderBy: { l_id: 'asc' },
        select: { bill_no: true, cus_id: true, opening_balance: true }
      });

      const ledgerMap = new Map();
      for (const entry of ledgerEntries) {
        const key = `${returnIdFromLedgerBillNo(entry.bill_no)}_${entry.cus_id}`;
        if (!ledgerMap.has(key)) {
          ledgerMap.set(key, parseFloat(entry.opening_balance));
        }
      }

      const enhancedSaleReturns = saleReturns.map(sr => {
        const key = `${sr.return_id}_${sr.cus_id}`;
        const netCredit = parseFloat(sr.total_amount || 0)
          - parseFloat(sr.labour_charges || 0)
          - parseFloat(sr.shipping_amount || 0)
          - parseFloat(sr.discount || 0)
          - parseFloat(sr.payment || 0);

        const prevBal = ledgerMap.has(key)
          ? ledgerMap.get(key)
          : (parseFloat(sr.customer?.cus_balance || 0) + netCredit);

        return {
          ...sr,
          previous_balance: prevBal,
          previous_customer_balance: prevBal
        };
      });

      return NextResponse.json(enhancedSaleReturns);
    }
  } catch (error) {
    console.error('Error fetching sale returns:', error);
    return NextResponse.json({ error: 'Failed to fetch sale returns' }, { status: 500 });
  }
}

// POST - Create new sale return
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      sale_id,
      cus_id,
      total_amount,
      discount,
      payment,
      payment_type,
      cash_return,
      bank_return,
      bank_account_id,
      debit_account_id,
      credit_account_id,
      loader_id,
      labour_charges,
      shipping_amount,
      bill_type,
      reason,
      reference,
      return_details,
      manual_sale_inv,
      transport_details,
      updated_by
    } = body;

    // Validate required fields
    if (!cus_id || !total_amount || payment === undefined || payment === null || !return_details || return_details.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate totals from return_details for safety and consistency
    const computedTotal = Array.isArray(return_details)
      ? return_details.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
      : 0;
    const discountAmount = parseFloat(discount || 0);
    const labourChargesAmount = parseFloat(labour_charges || 0);
    const shippingAmount = parseFloat(shipping_amount || 0);

    const parsedSaleIdForPost = sale_id ? parseInt(sale_id, 10) : null;
    const hasTransportDetails = Array.isArray(transport_details)
      && transport_details.some((td) => td?.account_id && (parseFloat(td.amount) || shippingAmount) > 0);
    if (shippingAmount > 0 && !parsedSaleIdForPost && !hasTransportDetails) {
      return NextResponse.json(
        { error: 'Transport account is required when delivery charges are set on a manual sale return (no linked invoice).' },
        { status: 400 }
      );
    }

    // Grand Total = Product Total - Delivery Charges - Labour Charges - Discount
    const grandTotal = computedTotal - labourChargesAmount - shippingAmount - discountAmount;
    const refundAmount = parseFloat(payment || 0); // Amount being refunded to customer
    const cashRefund = parseFloat(cash_return || 0);
    const bankRefund = parseFloat(bank_return || 0);

    console.log('📥 Sale Return Request Received:', {
      sale_id,
      cus_id,
      payment,
      payment_type,
      cash_return,
      bank_return,
      bank_account_id,
      refundAmount,
      cashRefund,
      bankRefund,
      grandTotal
    });

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get the original sale to get store_id and verify bill_type
      let sale = null;
      if (sale_id) {
        sale = await tx.sale.findUnique({
          where: { sale_id },
          include: { sale_details: true }
        });

        if (!sale) {
          throw new Error('Sale not found');
        }
      }

      // Use bill_type from sale if not provided in body
      const finalBillType = bill_type || sale?.bill_type || 'BILL';
      const isQuotationReturn = finalBillType === 'QUOTATION';

      // Validate each return detail if sale exists
      if (sale) {
        const qtyByProduct = new Map();
        for (const d of sale.sale_details) {
          qtyByProduct.set(d.pro_id, (qtyByProduct.get(d.pro_id) || 0) + Number(d.qnty || 0));
        }
        for (const rd of return_details) {
          const soldQty = qtyByProduct.get(rd.pro_id) || 0;
          const returnQty = parseInt(rd.qnty) || 0;
          if (returnQty <= 0) {
            throw new Error(`Invalid return quantity for product ${rd.pro_id}`);
          }
          if (returnQty > soldQty) {
            throw new Error(`Return qty (${returnQty}) exceeds sold qty (${soldQty}) for product ${rd.pro_id}`);
          }
        }
      }

      const customer = await validateReturnCustomer(tx, cus_id, transport_details);

      // Create sale return
      const saleReturn = await tx.saleReturn.create({
        data: {
          branch_id: __branchScope.branchId || 1,
          sale_id: sale_id || null,
          cus_id,
          total_amount: computedTotal,
          discount: parseFloat(discount || 0),
          payment: parseFloat(payment || 0),
          payment_type,
          debit_account_id: debit_account_id || null,
          credit_account_id: credit_account_id || null,
          loader_id: loader_id || null,
          labour_charges: parseFloat(labour_charges || 0),
          shipping_amount: parseFloat(shipping_amount || 0),
          reason: reason || null,
          reference: reference || null,
          manual_sale_inv: manual_sale_inv || null,
          updated_by: validatedUpdatedBy
        }
      });

      // Create return details
      const returnDetailPromises = return_details.map(async detail => {
        // Get unit from original sale details or default
        let unit = 'PCS';
        if (sale) {
          const originalDetail = sale.sale_details.find(sd => sd.pro_id === detail.pro_id);
          if (originalDetail) unit = originalDetail.unit;
        } else if (detail.unit) {
          unit = detail.unit;
        }

        const rawStoreId = detail.store_id || detail.storeid || sale?.store_id;
        const targetStoreId = rawStoreId ? parseInt(rawStoreId) : null;

        return tx.saleReturnDetail.create({
          data: {
            return_id: saleReturn.return_id,
            pro_id: detail.pro_id,
            qnty: parseInt(detail.qnty),
            unit: unit,
            unit_rate: parseFloat(detail.unit_rate),
            total_amount: parseFloat(detail.total_amount),
            discount: parseFloat(detail.discount || 0),
            net_total: parseFloat(detail.total_amount) - parseFloat(detail.discount || 0),
            cus_id,
            store_id: targetStoreId && !isNaN(targetStoreId) ? targetStoreId : null,
            updated_by: validatedUpdatedBy
          }
        });
      });

      await Promise.all(returnDetailPromises);

      // Skip financial transactions for quotation returns
      let affectedCusIds = [];
      if (!isQuotationReturn) {
        // Restore store stock quantities (skip for quotations)
        // Use detail.store_id / storeid if available (for manual items), otherwise sale.store_id
        const storeStockRestorePromises = return_details.map(async detail => {
          const rawStoreId = detail.store_id || detail.storeid || sale?.store_id;
          const targetStoreId = rawStoreId ? parseInt(rawStoreId) : null;
          if (targetStoreId && !isNaN(targetStoreId)) {
            await updateStoreStock(targetStoreId, detail.pro_id, parseInt(detail.qnty), 'increment', validatedUpdatedBy, tx);
          }
        });

        await Promise.all(storeStockRestorePromises);

        // Track all affected customer account IDs for recalculating balances
        affectedCusIds = [cus_id];

        await createCustomerSaleReturnBillEntries(tx, {
          cus_id,
          returnId: saleReturn.return_id,
          computedTotal,
          shippingAmount,
          labourChargesAmount,
          discountAmount,
          openingBalance: customer.cus_balance,
          validatedUpdatedBy,
        });

        // Refund entries - Handle CASH and BANK separately if both exist
        const specialAccounts = await getSpecialAccounts(tx);

        console.log('🔄 Refund Processing:', {
          cashRefund,
          bankRefund,
          totalRefund: refundAmount,
          bank_account_id,
          specialAccounts: {
            cash: specialAccounts.cash?.cus_name,
            bank: specialAccounts.bank?.cus_name
          }
        });

        // SEQUENCE: CASH Account → CASH Customer → BANK Account → BANK Customer

        // Entry 2a: CASH Account Deduction if cash_return > 0
        if (cashRefund > 0) {
          const cashAccount = specialAccounts.cash;
          if (cashAccount) {
            affectedCusIds.push(cashAccount.cus_id);

            // Ledger entry: Cash account DEBIT (money going out reduces cash balance)
            // Ledger entry: Cash account DEBIT (money going out reduces cash balance, Debit column entry, type CREDIT)
            const l_id_cash_out = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
              data: {
                l_id: l_id_cash_out,
                cus_id: cashAccount.cus_id,
                opening_balance: cashAccount.cus_balance,
                debit_amount: 0,
                credit_amount: cashRefund,
                closing_balance: cashAccount.cus_balance - cashRefund,
                bill_no: saleReturnBillNo(saleReturn.return_id),
                trnx_type: 'CREDIT',
                ledger_type: 'Sale Return',
                details: `Refund Paid Out (CASH) - Sale Return #${saleReturn.return_id} - Amount: ${cashRefund}`,
                payments: cashRefund,
                updated_by: validatedUpdatedBy
              }
            });

            console.log('✅ CASH ACCOUNT: Refund paid out:', { cashRefund, account: cashAccount.cus_name });

            // Update cash account balance - DECREASE
            await tx.customer.update({
              where: { cus_id: cashAccount.cus_id },
              data: {
                cus_balance: cashAccount.cus_balance - cashRefund
              }
            });

            // Entry 2b: CUSTOMER Balance Update after CASH Refund (immediately after cash account, Debit column, type DEBIT)
            const customerAfterCash = customer.cus_balance - grandTotal + cashRefund;
            const l_id_cus_cash = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
              data: {
                l_id: l_id_cus_cash,
                cus_id,
                opening_balance: customer.cus_balance - grandTotal, // Balance after main return
                debit_amount: cashRefund,
                credit_amount: 0,
                closing_balance: customerAfterCash,
                bill_no: saleReturnBillNo(saleReturn.return_id),
                trnx_type: 'DEBIT',
                ledger_type: 'Sale Return',
                details: `Customer Balance Update - CASH Refund Received: ${cashRefund} for Sale Return #${saleReturn.return_id}`,
                payments: 0,
                updated_by: validatedUpdatedBy
              }
            });
            console.log('✅ CUSTOMER: Balance updated after CASH refund:', { customerAfterCash, cashRefund });
          }
        }

        // Entry 3: BANK Account Deduction if bank_return > 0
        if (bankRefund > 0) {
          // If bank_account_id provided from frontend, use it directly (priority)
          // Otherwise try to find bank account from special accounts
          let bankAccount = null;

          if (bank_account_id) {
            console.log('🔍 Looking up bank account by ID:', bank_account_id);
            bankAccount = await tx.customer.findUnique({
              where: { cus_id: parseInt(bank_account_id) }
            });
            if (bankAccount) {
              console.log('✅ Found bank account by ID:', { id: bank_account_id, name: bankAccount.cus_name });
            }
          }

          // Fallback to special accounts if not found by ID
          if (!bankAccount) {
            console.log('📍 Falling back to special accounts for bank account');
            bankAccount = specialAccounts.bank;
          }

          if (bankAccount) {
            affectedCusIds.push(bankAccount.cus_id);

            // Ledger entry: Bank account DEBIT (money going out reduces bank balance)
            // Ledger entry: Bank account DEBIT (money going out reduces bank balance, Debit column, type CREDIT)
            const l_id_bank_out = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
              data: {
                l_id: l_id_bank_out,
                cus_id: bankAccount.cus_id,
                opening_balance: bankAccount.cus_balance,
                debit_amount: 0,
                credit_amount: bankRefund,
                closing_balance: bankAccount.cus_balance - bankRefund,
                bill_no: saleReturnBillNo(saleReturn.return_id),
                trnx_type: 'CREDIT',
                ledger_type: 'Sale Return',
                details: `Refund Paid Out (BANK) - Sale Return #${saleReturn.return_id} - Amount: ${bankRefund}`,
                payments: bankRefund,
                updated_by: validatedUpdatedBy
              }
            });

            console.log('✅ BANK ACCOUNT: Refund paid out:', { bankRefund, account: bankAccount.cus_name, cus_id: bankAccount.cus_id });

            // Update bank account balance - DECREASE
            await tx.customer.update({
              where: { cus_id: bankAccount.cus_id },
              data: {
                cus_balance: bankAccount.cus_balance - bankRefund
              }
            });

            // Entry 3b: CUSTOMER Balance Update after BANK Refund (immediately after bank account, Debit column, type DEBIT)
            const customerAfterBank = customer.cus_balance - grandTotal + cashRefund + bankRefund;
            const l_id_cus_bank = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
              data: {
                l_id: l_id_cus_bank,
                cus_id,
                opening_balance: customer.cus_balance - grandTotal + cashRefund, // Balance after cash refund
                debit_amount: bankRefund,
                credit_amount: 0,
                closing_balance: customerAfterBank,
                bill_no: saleReturnBillNo(saleReturn.return_id),
                trnx_type: 'DEBIT',
                ledger_type: 'Sale Return',
                details: `Customer Balance Update - BANK Refund Received: ${bankRefund} for Sale Return #${saleReturn.return_id}`,
                payments: 0,
                updated_by: validatedUpdatedBy
              }
            });
            console.log('✅ CUSTOMER: Balance updated after BANK refund:', { customerAfterBank, bankRefund });
          } else {
            console.log('❌ Bank account not found - checked both bank_account_id and specialAccounts:', { bank_account_id, specialAccounts });
          }
        } else {
          console.log('⚠️ Bank refund is 0:', { bankRefund });
        }

        // Update customer balance - decrease by grand total, but add back the refund amount
        // Net effect: customer owes less (return reduces debt) + refund paid increases their receivable
        await tx.customer.update({
          where: { cus_id },
          data: {
            cus_balance: customer.cus_balance - grandTotal + refundAmount
          }
        });

        // If loader is involved, update loader balance for shipping (decrement using Prisma safe operation)
        if (loader_id && shippingAmount > 0) {
          await tx.loader.update({
            where: { loader_id },
            data: {
              loader_balance: {
                decrement: shippingAmount
              }
            }
          });
        }

        await postReturnTransportLedger(tx, {
          returnId: saleReturn.return_id,
          saleId: sale_id || null,
          shippingAmount,
          transport_details,
          customerName: customer.cus_name,
          validatedUpdatedBy,
          affectedCusIds,
          entryTimestamp: saleReturn.created_at,
        });
      } // End of if (!isQuotationReturn)

      return { saleReturn, affectedCusIds: isQuotationReturn ? [] : affectedCusIds };
    }, {
      timeout: 60000,
      maxWait: 60000
    });

    // Recalculate in background — transaction already wrote correct balances; don't block the invoice response.
    if (result.affectedCusIds?.length > 0) {
      const uniqueIds = [...new Set(result.affectedCusIds)];
      void Promise.all(uniqueIds.map((cid) => recalculateLedgerBalances(prisma, cid))).catch((err) => {
        console.error('Background ledger recalc after sale return failed:', err);
      });
    }

    return NextResponse.json(result.saleReturn, { status: 201 });
  } catch (error) {
    console.error('Error creating sale return:', error);
    const status = saleReturnHttpStatus(error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create sale return' },
      { status }
    );
  }
}

// PUT - Update an existing sale return
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      return_id,
      sale_id,
      cus_id,
      total_amount,
      discount,
      payment,
      payment_type,
      cash_return,
      bank_return,
      bank_account_id,
      debit_account_id,
      credit_account_id,
      loader_id,
      labour_charges,
      shipping_amount,
      bill_type,
      reason,
      reference,
      return_details,
      manual_sale_inv,
      transport_details,
      updated_by
    } = body;

    const targetReturnId = id ? parseInt(id) : (return_id ? parseInt(return_id) : null);
    if (!targetReturnId || isNaN(targetReturnId)) {
      return NextResponse.json({ error: 'Sale return ID is required' }, { status: 400 });
    }

    if (!cus_id || !return_details || return_details.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const computedTotal = Array.isArray(return_details)
      ? return_details.reduce((sum, d) => sum + (parseFloat(d.total_amount) || (parseFloat(d.qnty || 0) * parseFloat(d.unit_rate || 0)) || 0), 0)
      : 0;
    const discountAmount = parseFloat(discount || 0);
    const labourChargesAmount = parseFloat(labour_charges || 0);
    const shippingAmount = parseFloat(shipping_amount || 0);
    const grandTotal = computedTotal - labourChargesAmount - shippingAmount - discountAmount;
    const refundAmount = parseFloat(payment || 0);
    const cashRefund = parseFloat(cash_return || 0);
    const bankRefund = parseFloat(bank_return || 0);

    const parsedSaleIdPut = (sale_id && typeof sale_id === 'string' && !sale_id.startsWith('SR-'))
      ? parseInt(sale_id, 10)
      : (typeof sale_id === 'number' && !isNaN(sale_id) ? sale_id : null);

    const hasTransportDetailsPut = Array.isArray(transport_details)
      && transport_details.some((td) => td?.account_id && (parseFloat(td.amount) || shippingAmount) > 0);
    if (shippingAmount > 0 && !parsedSaleIdPut && !hasTransportDetailsPut) {
      return NextResponse.json(
        { error: 'Transport account is required when delivery charges are set on a manual sale return (no linked invoice).' },
        { status: 400 }
      );
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch existing return
      const existingReturn = await tx.saleReturn.findUnique({
        where: { return_id: targetReturnId },
        include: {
          return_details: true,
          sale: true
        }
      });

      if (!existingReturn) {
        throw new Error('Sale return not found');
      }

      // Collect affected account IDs
      const oldEntries = await tx.ledger.findMany({
        where: ledgerBillNoWhere(targetReturnId),
        select: { cus_id: true }
      });
      const affectedCusIds = new Set(oldEntries.map(e => e.cus_id));
      affectedCusIds.add(cus_id);
      affectedCusIds.add(existingReturn.cus_id);

      // 2. Reverse previous store stock
      for (const d of existingReturn.return_details) {
        const rawStoreId = d.store_id || existingReturn.sale?.store_id;
        const targetStoreId = rawStoreId ? parseInt(rawStoreId) : null;
        if (targetStoreId && !isNaN(targetStoreId)) {
          await updateStoreStock(targetStoreId, d.pro_id, parseInt(d.qnty), 'decrement', validatedUpdatedBy, tx);
        }
      }

      // 3. If loader was involved previously, restore loader balance
      if (existingReturn.loader_id && parseFloat(existingReturn.shipping_amount || 0) > 0) {
        await tx.loader.update({
          where: { loader_id: existingReturn.loader_id },
          data: {
            loader_balance: {
              increment: parseFloat(existingReturn.shipping_amount)
            }
          }
        });
      }

      // 4. Delete old ledger entries & return details
      await tx.ledger.deleteMany({
        where: ledgerBillNoWhere(targetReturnId)
      });
      await tx.saleReturnDetail.deleteMany({
        where: { return_id: targetReturnId }
      });

      // 5. Update SaleReturn record
      const parsedSaleId = (sale_id && typeof sale_id === 'string' && !sale_id.startsWith('SR-'))
        ? parseInt(sale_id, 10)
        : (typeof sale_id === 'number' && !isNaN(sale_id) ? sale_id : (existingReturn.sale_id || null));

      const updatedReturn = await tx.saleReturn.update({
        where: { return_id: targetReturnId },
        data: {
          sale_id: parsedSaleId,
          cus_id,
          total_amount: computedTotal,
          discount: discountAmount,
          payment: refundAmount,
          payment_type: payment_type || existingReturn.payment_type || 'CASH',
          debit_account_id: debit_account_id || null,
          credit_account_id: credit_account_id || null,
          loader_id: loader_id || null,
          labour_charges: labourChargesAmount,
          shipping_amount: shippingAmount,
          reason: reason || existingReturn.reason || null,
          reference: reference || existingReturn.reference || null,
          manual_sale_inv: manual_sale_inv || existingReturn.manual_sale_inv || null,
          updated_by: validatedUpdatedBy
        }
      });

      // 6. Create new return details and increment store stock
      for (const detail of return_details) {
        let unit = 'PCS';
        if (existingReturn.sale) {
          const originalDetail = existingReturn.sale.sale_details?.find(sd => sd.pro_id === detail.pro_id);
          if (originalDetail) unit = originalDetail.unit;
        } else if (detail.unit) {
          unit = detail.unit;
        }

        const rawStoreId = detail.store_id || detail.storeid || existingReturn.sale?.store_id;
        const targetStoreId = rawStoreId ? parseInt(rawStoreId) : null;
        const qntyNum = parseInt(detail.qnty || detail.return_quantity || 0);
        const rateNum = parseFloat(detail.unit_rate || 0);
        const lineTotal = parseFloat(detail.total_amount || detail.return_amount || (qntyNum * rateNum) || 0);
        const lineDiscount = parseFloat(detail.discount || 0);

        await tx.saleReturnDetail.create({
          data: {
            return_id: targetReturnId,
            pro_id: detail.pro_id,
            qnty: qntyNum,
            unit: unit,
            unit_rate: rateNum,
            total_amount: lineTotal,
            discount: lineDiscount,
            net_total: lineTotal - lineDiscount,
            cus_id,
            store_id: targetStoreId && !isNaN(targetStoreId) ? targetStoreId : null,
            updated_by: validatedUpdatedBy
          }
        });

        if (targetStoreId && !isNaN(targetStoreId) && qntyNum > 0) {
          await updateStoreStock(targetStoreId, detail.pro_id, qntyNum, 'increment', validatedUpdatedBy, tx);
        }
      }

      const customer = await validateReturnCustomer(tx, cus_id, transport_details);
      const cusBal = parseFloat(customer.cus_balance || 0);

      await createCustomerSaleReturnBillEntries(tx, {
        cus_id,
        returnId: targetReturnId,
        computedTotal,
        shippingAmount,
        labourChargesAmount,
        discountAmount,
        openingBalance: cusBal,
        validatedUpdatedBy,
      });

      // Special accounts for refund
      const specialAccounts = await getSpecialAccounts(tx);

      // Ledger Entry 2: Cash Refund
      if (cashRefund > 0) {
        const cashAccount = specialAccounts.cash;
        if (cashAccount) {
          affectedCusIds.add(cashAccount.cus_id);

          const l_id_cash_out = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_cash_out,
              cus_id: cashAccount.cus_id,
              opening_balance: cashAccount.cus_balance,
              debit_amount: 0,
              credit_amount: cashRefund,
              closing_balance: cashAccount.cus_balance - cashRefund,
              bill_no: saleReturnBillNo(targetReturnId),
              trnx_type: 'CREDIT',
              ledger_type: 'Sale Return',
              details: `Refund Paid Out (CASH) - Sale Return #${targetReturnId} - Amount: ${cashRefund}`,
              payments: cashRefund,
              updated_by: validatedUpdatedBy
            }
          });

          await tx.customer.update({
            where: { cus_id: cashAccount.cus_id },
            data: { cus_balance: cashAccount.cus_balance - cashRefund }
          });

          const l_id_cus_cash = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_cus_cash,
              cus_id,
              opening_balance: cusBal - grandTotal,
              debit_amount: cashRefund,
              credit_amount: 0,
              closing_balance: cusBal - grandTotal + cashRefund,
              bill_no: saleReturnBillNo(targetReturnId),
              trnx_type: 'DEBIT',
              ledger_type: 'Sale Return',
              details: `Customer Balance Update - CASH Refund Received: ${cashRefund} for Sale Return #${targetReturnId}`,
              payments: 0,
              updated_by: validatedUpdatedBy
            }
          });
        }
      }

      // Ledger Entry 3: Bank Refund
      if (bankRefund > 0) {
        let bankAccount = null;
        if (bank_account_id) {
          bankAccount = await tx.customer.findUnique({
            where: { cus_id: parseInt(bank_account_id) }
          });
        }
        if (!bankAccount) {
          bankAccount = specialAccounts.bank;
        }

        if (bankAccount) {
          affectedCusIds.add(bankAccount.cus_id);

          const l_id_bank_out = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_bank_out,
              cus_id: bankAccount.cus_id,
              opening_balance: bankAccount.cus_balance,
              debit_amount: 0,
              credit_amount: bankRefund,
              closing_balance: bankAccount.cus_balance - bankRefund,
              bill_no: saleReturnBillNo(targetReturnId),
              trnx_type: 'CREDIT',
              ledger_type: 'Sale Return',
              details: `Refund Paid Out (BANK) - Sale Return #${targetReturnId} - Amount: ${bankRefund}`,
              payments: bankRefund,
              updated_by: validatedUpdatedBy
            }
          });

          await tx.customer.update({
            where: { cus_id: bankAccount.cus_id },
            data: { cus_balance: bankAccount.cus_balance - bankRefund }
          });

          const customerAfterBank = cusBal - grandTotal + cashRefund + bankRefund;
          const l_id_cus_bank = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_cus_bank,
              cus_id,
              opening_balance: cusBal - grandTotal + cashRefund,
              debit_amount: bankRefund,
              credit_amount: 0,
              closing_balance: customerAfterBank,
              bill_no: saleReturnBillNo(targetReturnId),
              trnx_type: 'DEBIT',
              ledger_type: 'Sale Return',
              details: `Customer Balance Update - BANK Refund Received: ${bankRefund} for Sale Return #${targetReturnId}`,
              payments: 0,
              updated_by: validatedUpdatedBy
            }
          });
        }
      }

      // Customer balance net update
      await tx.customer.update({
        where: { cus_id },
        data: {
          cus_balance: cusBal - grandTotal + refundAmount
        }
      });

      // Loader update
      if (loader_id && shippingAmount > 0) {
        await tx.loader.update({
          where: { loader_id },
          data: { loader_balance: { decrement: shippingAmount } }
        });
      }

      const customerForTransport = await tx.customer.findUnique({
        where: { cus_id },
        select: { cus_name: true },
      });

      await postReturnTransportLedger(tx, {
        returnId: targetReturnId,
        saleId: parsedSaleId ?? existingReturn.sale_id ?? null,
        shippingAmount,
        transport_details,
        customerName: customerForTransport?.cus_name,
        validatedUpdatedBy,
        affectedCusIds,
        entryTimestamp: updatedReturn.updated_at || updatedReturn.created_at,
      });

      return { saleReturn: updatedReturn, affectedCusIds: Array.from(affectedCusIds) };
    }, {
      timeout: 60000,
      maxWait: 60000
    });

    if (result.affectedCusIds?.length > 0) {
      const uniqueIds = [...new Set(result.affectedCusIds)];
      void Promise.all(uniqueIds.map((cid) => recalculateLedgerBalances(prisma, cid))).catch((err) => {
        console.error('Background ledger recalc after sale return PUT failed:', err);
      });
    }

    return NextResponse.json(result.saleReturn, { status: 200 });
  } catch (error) {
    console.error('Error updating sale return:', error);
    const status = saleReturnHttpStatus(error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update sale return' },
      { status }
    );
  }
}

// DELETE - Delete sale return
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Sale return ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const affectedCusIds = await prisma.$transaction(async (tx) => {
      // Get existing sale return with details
      const existingReturn = await tx.saleReturn.findUnique({
        where: { return_id: id },
        include: {
          return_details: true,
          sale: true
        }
      });

      if (!existingReturn) {
        throw new Error('Sale return not found');
      }

      // Get affected customer accounts from ledger before deletion
      const entries = await tx.ledger.findMany({
        where: ledgerBillNoWhere(id),
        select: { cus_id: true }
      });
      const affected = [...new Set(entries.map(e => e.cus_id))];

      // Reverse store stock quantities
      const storeStockReversePromises = existingReturn.return_details.map(async detail => {
        const rawStoreId = detail.store_id || existingReturn.sale?.store_id;
        const targetStoreId = rawStoreId ? parseInt(rawStoreId) : null;
        if (targetStoreId && !isNaN(targetStoreId)) {
          await updateStoreStock(targetStoreId, detail.pro_id, detail.qnty, 'decrement', 1, tx);
        }
      });

      await Promise.all(storeStockReversePromises);

      // If loader was involved, add back shipping amount to loader balance
      if (existingReturn.loader_id && parseFloat(existingReturn.shipping_amount || 0) > 0) {
        const loader = await tx.loader.findUnique({
          where: { loader_id: existingReturn.loader_id }
        });

        if (loader) {
          await tx.loader.update({
            where: { loader_id: existingReturn.loader_id },
            data: {
              loader_balance: loader.loader_balance + parseFloat(existingReturn.shipping_amount)
            }
          });
        }
      }

      // Delete ledger entries for this return
      await tx.ledger.deleteMany({
        where: ledgerBillNoWhere(id)
      });

      // Delete return details
      await tx.saleReturnDetail.deleteMany({
        where: { return_id: id }
      });

      // Delete sale return
      await tx.saleReturn.delete({
        where: { return_id: id }
      });

      return affected;
    }, {
      timeout: 15000 // 15 seconds timeout for complex transactions
    });

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    if (affectedCusIds && affectedCusIds.length > 0) {
      for (const cid of affectedCusIds) {
        await recalculateLedgerBalances(prisma, cid);
      }
    }

    return NextResponse.json({ message: 'Sale return deleted successfully' });
  } catch (error) {
    console.error('Error deleting sale return:', error);
    return NextResponse.json({ error: 'Failed to delete sale return: ' + error.message }, { status: 500 });
  }
}

