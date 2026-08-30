import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateStoreStock } from '@/lib/storeStock';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';

export const dynamic = 'force-dynamic';


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
          bill_no: String(saleReturn.return_id),
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

      const returnIds = saleReturns.map(sr => String(sr.return_id));
      const ledgerEntries = await prisma.ledger.findMany({
        where: {
          bill_no: { in: returnIds },
          ledger_type: { contains: 'Return' }
        },
        orderBy: { l_id: 'asc' },
        select: { bill_no: true, cus_id: true, opening_balance: true }
      });

      const ledgerMap = new Map();
      for (const entry of ledgerEntries) {
        const key = `${entry.bill_no}_${entry.cus_id}`;
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

      // Get customer's current balance
      const customer = await tx.customer.findUnique({
        where: { cus_id }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

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

        // Create ledger entries for Sale Return
        // Entry 1: Main return entry - Customer side (debit because return reduces customer's balance)
        const l_id_sr = await getNextId('ledger', 'l_id', tx);
        await tx.ledger.create({
          data: {
            l_id: l_id_sr,
            cus_id,
            opening_balance: customer.cus_balance,
            debit_amount: 0,
            credit_amount: grandTotal, // Sale return reduces customer balance (credit)
            closing_balance: customer.cus_balance - grandTotal,
            bill_no: saleReturn.return_id.toString(),
            trnx_type: 'CREDIT',
            ledger_type: 'Sale Return',
            details: `Sale Return - Product: ${computedTotal}, Delivery: -${shippingAmount}, Labour: -${labourChargesAmount}, Discount: -${discountAmount}, Net: ${grandTotal}`,
            payments: 0,
            updated_by: validatedUpdatedBy
          }
        });

        // Entry 2: Refund entries - Handle CASH and BANK separately if both exist
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
                bill_no: saleReturn.return_id.toString(),
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
                bill_no: saleReturn.return_id.toString(),
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
                bill_no: saleReturn.return_id.toString(),
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
                bill_no: saleReturn.return_id.toString(),
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

        // Re-adjust transporter customer account balance if original sale transport ledger entry exists
        if (sale_id && shippingAmount > 0) {
          const originalTransportLedgerEntry = await tx.ledger.findFirst({
            where: {
              bill_no: sale_id.toString(),
              details: { contains: 'Transport' }
            }
          });

          if (originalTransportLedgerEntry) {
            const transportCusId = originalTransportLedgerEntry.cus_id;
            affectedCusIds.push(transportCusId);

            const currentTransportBalance = await resolveOpeningBalance(tx, transportCusId, saleReturn.created_at);

            // Create a DEBIT entry to reverse the original CREDIT transport charge
            const l_id_trans = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
              data: {
                l_id: l_id_trans,
                cus_id: transportCusId,
                opening_balance: currentTransportBalance,
                debit_amount: shippingAmount,
                credit_amount: 0,
                closing_balance: currentTransportBalance + shippingAmount,
                bill_no: saleReturn.return_id.toString(),
                trnx_type: 'DEBIT',
                ledger_type: 'Sale Return',
                details: `Transport Fare Deduction - Sale Return #${saleReturn.return_id} - Original Bill #${sale_id}`,
                payments: 0,
                updated_by: validatedUpdatedBy
              }
            });
          }
        }
      } // End of if (!isQuotationReturn)

      return { saleReturn, affectedCusIds: isQuotationReturn ? [] : affectedCusIds };
    }, {
      timeout: 60000 // 60 seconds timeout for complex transactions with multiple operations
    });

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    if (result.affectedCusIds && result.affectedCusIds.length > 0) {
      for (const cid of result.affectedCusIds) {
        await recalculateLedgerBalances(prisma, cid);
      }
    }

    return NextResponse.json(result.saleReturn, { status: 201 });
  } catch (error) {
    console.error('Error creating sale return:', error);
    return NextResponse.json({ error: 'Failed to create sale return: ' + error.message }, { status: 500 });
  }
}

// DELETE - Delete sale return
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

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
        where: { bill_no: id.toString() },
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
        where: { bill_no: id.toString() }
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

