import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

async function recalculateLedgerBalances(tx, cus_id) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    include: { customer_category: true }
  });
  if (!customer) return;

  const entries = await tx.ledger.findMany({
    where: { cus_id },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  // Re-sort in JS
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
      
      const closing = opening + debit - credit;

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

  const clientCustomer = typeof tx.customer === 'object' ? tx.customer : prisma.customer;
  await clientCustomer.update({
    where: { cus_id },
    data: {
      cus_balance: Number(runningBalance.toFixed(2))
    }
  });
}

// GET - Fetch all purchase returns
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Fetch single purchase return
      const purchaseReturn = await prisma.purchaseReturn.findUnique({
        where: { id: parseInt(id) },
        include: {
          purchase: {
            include: {
              customer: true,
              store: true,
              purchase_details: {
                include: {
                  product: true
                }
              }
            }
          },
          return_details: {
            include: {
              product: true
            }
          }
        }
      });

      if (!purchaseReturn) {
        return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });
      }

      return NextResponse.json(purchaseReturn);
    } else {
      // Fetch all purchase returns
      const purchaseReturns = await prisma.purchaseReturn.findMany({
        include: {
          purchase: {
            include: {
              customer: true,
              store: true,
              updated_by_user: {
                select: {
                  user_id: true,
                  full_name: true,
                  role: true
                }
              }
            }
          },
          return_details: {
            include: {
              product: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return NextResponse.json(purchaseReturns);
    }
  } catch (error) {
    console.error('Error fetching purchase returns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new purchase return
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      purchase_id,
      return_date,
      return_reason,
      return_details,
      total_return_amount,
      notes
    } = body;

    console.log('Creating purchase return:', body);

    // Validate required fields
    if (!purchase_id || !return_date || !return_reason || !return_details || return_details.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: purchase_id, return_date, return_reason, and return_details are required' 
      }, { status: 400 });
    }

    // Validate return quantities don't exceed original quantities
    const purchase = await prisma.purchase.findUnique({
      where: { pur_id: parseInt(purchase_id) },
      include: {
        purchase_details: true,
        customer: true,
        debit_account: true,
        credit_account: true
      }
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Check return quantities
    for (const returnDetail of return_details) {
      const originalDetail = purchase.purchase_details.find(pd => pd.pro_id === returnDetail.pro_id);
      if (!originalDetail) {
        return NextResponse.json({ 
          error: `Product ${returnDetail.pro_id} not found in original purchase` 
        }, { status: 400 });
      }
      
      if (returnDetail.return_quantity > originalDetail.qnty) {
        return NextResponse.json({ 
          error: `Return quantity for product ${returnDetail.pro_id} exceeds original quantity` 
        }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Create purchase return
        const newPurchaseReturn = await tx.purchaseReturn.create({
        data: {
          purchase_id: parseInt(purchase_id),
          return_date: new Date(return_date),
          return_reason,
          total_return_amount: parseFloat(total_return_amount || 0),
          notes: notes || null,
          status: 'COMPLETED'
        }
      });

      // Create return details
      const returnDetailsData = return_details.map(detail => ({
        return_id: newPurchaseReturn.id,
        pro_id: parseInt(detail.pro_id),
        return_quantity: parseInt(detail.return_quantity),
        unit_rate: parseFloat(detail.unit_rate || 0),
        return_amount: parseFloat(detail.return_amount || 0)
      }));

      await tx.purchaseReturnDetail.createMany({
        data: returnDetailsData
      });

      // Update store stock - DECREMENT stock when returning to supplier
      // (Items are going back to supplier, so our stock decreases)
      if (purchase.store_id) {
        for (const detail of return_details) {
          const storeIdInt = parseInt(purchase.store_id);
          const productIdInt = parseInt(detail.pro_id);
          const qtyChange = parseInt(detail.return_quantity);
          
          try {
            // Use single upsert-style query for faster execution
            await tx.$executeRaw`
              INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, created_at, updated_at) 
              VALUES (${storeIdInt}, ${productIdInt}, -${qtyChange}, 0, 1000, NOW(), NOW())
              ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity - ${qtyChange}, updated_at = NOW()
            `;
          } catch (stockError) {
            console.warn('Stock update warning:', stockError.message);
          }
        }
      }

      // Get supplier's current balance
      const supplier = await tx.customer.findUnique({
        where: { cus_id: purchase.cus_id }
      });
      if (!supplier) throw new Error('Supplier not found');

      let supplierBalance = parseFloat(supplier.cus_balance || 0);
      const returnAmount = parseFloat(total_return_amount || 0);

      // Track affected customer IDs for recalculation
      const affectedCusIds = [purchase.cus_id];

      // Entry 1: Main Return entry for Supplier (DEBIT)
      const l_id_pr = await getNextId('ledger', 'l_id', tx);
      const supplierClosingAfterReturn = supplierBalance + returnAmount; // under receivable formula: + debit

      await tx.ledger.create({
        data: {
          l_id: l_id_pr,
          cus_id: purchase.cus_id,
          opening_balance: supplierBalance,
          debit_amount: returnAmount,
          credit_amount: 0,
          closing_balance: supplierClosingAfterReturn,
          bill_no: `PR-${newPurchaseReturn.id}`,
          trnx_type: 'DEBIT',
          ledger_type: 'Purchase Return',
          details: `Purchase Return #${newPurchaseReturn.id} - ${return_reason} - Goods returned to ${supplier.cus_name}`,
          payments: 0,
          updated_by: null
        }
      });

      supplierBalance = supplierClosingAfterReturn;

      // Calculate cash and bank refund amounts based on original purchase payments
      const maxCashRefund = parseFloat(purchase.cash_payment || 0);
      const maxBankRefund = parseFloat(purchase.bank_payment || 0);

      let cashRefund = 0;
      let bankRefund = 0;

      if (maxCashRefund > 0 && purchase.debit_account_id) {
        cashRefund = Math.min(returnAmount, maxCashRefund);
      }
      if (returnAmount - cashRefund > 0 && maxBankRefund > 0 && purchase.credit_account_id) {
        bankRefund = Math.min(returnAmount - cashRefund, maxBankRefund);
      }

      // Entry 2: CASH Refund entries
      if (cashRefund > 0 && purchase.debit_account_id) {
        affectedCusIds.push(purchase.debit_account_id);
        const cashAccount = await tx.customer.findUnique({
          where: { cus_id: purchase.debit_account_id }
        });
        if (cashAccount) {
          const cashClosing = parseFloat(cashAccount.cus_balance || 0) + cashRefund; // Cash account debited (receives money)
          
          // Entry 2a: Cash Account Ledger Entry
          const l_id_cash = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_cash,
              cus_id: purchase.debit_account_id,
              opening_balance: parseFloat(cashAccount.cus_balance || 0),
              debit_amount: cashRefund,
              credit_amount: 0,
              closing_balance: cashClosing,
              bill_no: `PR-${newPurchaseReturn.id}`,
              trnx_type: 'DEBIT',
              ledger_type: 'Purchase Return',
              details: `Refund Received (CASH) - Purchase Return #${newPurchaseReturn.id} - Amount: ${cashRefund}`,
              payments: cashRefund,
              cash_payment: cashRefund,
              updated_by: null
            }
          });

          await tx.customer.update({
            where: { cus_id: purchase.debit_account_id },
            data: { cus_balance: cashClosing }
          });

          // Entry 2b: Supplier Account Payment/Refund Entry (CREDIT)
          const supplierClosingAfterCash = supplierBalance - cashRefund; // under receivable formula: - credit
          const l_id_sup_cash = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_sup_cash,
              cus_id: purchase.cus_id,
              opening_balance: supplierBalance,
              debit_amount: 0,
              credit_amount: cashRefund,
              closing_balance: supplierClosingAfterCash,
              bill_no: `PR-${newPurchaseReturn.id}`,
              trnx_type: 'CREDIT',
              ledger_type: 'Purchase Return',
              details: `CASH Refund Received: ${cashRefund} for Purchase Return #${newPurchaseReturn.id}`,
              payments: 0,
              updated_by: null
            }
          });

          supplierBalance = supplierClosingAfterCash;
        }
      }

      // Entry 3: BANK Refund entries
      if (bankRefund > 0 && purchase.credit_account_id) {
        affectedCusIds.push(purchase.credit_account_id);
        const bankAccount = await tx.customer.findUnique({
          where: { cus_id: purchase.credit_account_id }
        });
        if (bankAccount) {
          const bankClosing = parseFloat(bankAccount.cus_balance || 0) + bankRefund; // Bank account debited (receives money)

          // Entry 3a: Bank Account Ledger Entry
          const l_id_bank = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_bank,
              cus_id: purchase.credit_account_id,
              opening_balance: parseFloat(bankAccount.cus_balance || 0),
              debit_amount: bankRefund,
              credit_amount: 0,
              closing_balance: bankClosing,
              bill_no: `PR-${newPurchaseReturn.id}`,
              trnx_type: 'DEBIT',
              ledger_type: 'Purchase Return',
              details: `Refund Received (BANK) - Purchase Return #${newPurchaseReturn.id} - Amount: ${bankRefund}`,
              payments: bankRefund,
              bank_payment: bankRefund,
              updated_by: null
            }
          });

          await tx.customer.update({
            where: { cus_id: purchase.credit_account_id },
            data: { cus_balance: bankClosing }
          });

          // Entry 3b: Supplier Account Payment/Refund Entry (CREDIT)
          const supplierClosingAfterBank = supplierBalance - bankRefund; // under receivable formula: - credit
          const l_id_sup_bank = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_sup_bank,
              cus_id: purchase.cus_id,
              opening_balance: supplierBalance,
              debit_amount: 0,
              credit_amount: bankRefund,
              closing_balance: supplierClosingAfterBank,
              bill_no: `PR-${newPurchaseReturn.id}`,
              trnx_type: 'CREDIT',
              ledger_type: 'Purchase Return',
              details: `BANK Refund Received: ${bankRefund} for Purchase Return #${newPurchaseReturn.id}`,
              payments: 0,
              updated_by: null
            }
          });

          supplierBalance = supplierClosingAfterBank;
        }
      }

      // Update supplier's final balance
      await tx.customer.update({
        where: { cus_id: purchase.cus_id },
        data: { cus_balance: supplierBalance }
      });

      return {
        newPurchaseReturn,
        affectedCusIds
      };
      },
      {
        timeout: 30000, // 30 seconds
        maxWait: 60000   // 60 seconds max wait
      }
    );

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    for (const cid of result.affectedCusIds) {
      await recalculateLedgerBalances(prisma, cid);
    }

    console.log('Purchase return created successfully:', result.newPurchaseReturn);
    return NextResponse.json(result.newPurchaseReturn, { status: 201 });

  } catch (error) {
    console.error('Error creating purchase return:', error);
    return NextResponse.json({ 
      error: 'Failed to create purchase return',
      details: error.message 
    }, { status: 500 });
  }
}

// PUT - Update purchase return
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      purchase_id,
      return_date,
      return_reason,
      return_details,
      total_return_amount,
      notes
    } = body;

    console.log('Updating purchase return:', body);

    if (!id) {
      return NextResponse.json({ error: 'Purchase return ID is required' }, { status: 400 });
    }

    // Check if purchase return exists
    const existingReturn = await prisma.purchaseReturn.findUnique({
      where: { id: parseInt(id) },
      include: {
        return_details: true,
        purchase: {
          include: {
            debit_account: true,
            credit_account: true
          }
        }
      }
    });

    if (!existingReturn) {
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });
    }

    const purchase = existingReturn.purchase;

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. First, REVERSE the old return effects
        
        // Reverse old stock changes (increment back what was decremented)
        if (purchase.store_id) {
          for (const detail of existingReturn.return_details) {
            const storeIdInt = parseInt(purchase.store_id);
            const productIdInt = parseInt(detail.pro_id);
            const qtyChange = parseInt(detail.return_quantity);
            try {
              await tx.$executeRaw`
                UPDATE store_stocks 
                SET stock_quantity = stock_quantity + ${qtyChange}, updated_at = NOW() 
                WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}
              `;
            } catch (stockError) {
              console.warn('Stock reversal warning:', stockError.message);
          }
        }
      }

      // Fetch all old ledger entries for this return to calculate and reverse their effects
      const oldLedgerEntries = await tx.ledger.findMany({
        where: { bill_no: `PR-${id}` }
      });

      // Reverse old entries on the customer table balances
      for (const entry of oldLedgerEntries) {
        const acc = await tx.customer.findUnique({
          where: { cus_id: entry.cus_id }
        });
        if (acc) {
          const effect = parseFloat(entry.debit_amount || 0) - parseFloat(entry.credit_amount || 0);
          await tx.customer.update({
            where: { cus_id: entry.cus_id },
            data: {
              cus_balance: parseFloat(acc.cus_balance || 0) - effect
            }
          });
        }
      }

      // Re-read supplier's reverted balance
      const supplierReverted = await tx.customer.findUnique({
        where: { cus_id: purchase.cus_id }
      });
      if (!supplierReverted) throw new Error('Supplier not found');
      let supplierBalance = parseFloat(supplierReverted.cus_balance || 0);

      // Track all affected customer IDs (old + new)
      const oldAffectedCusIds = oldLedgerEntries.map(e => e.cus_id);
      const affectedCusIds = [purchase.cus_id, ...oldAffectedCusIds];

      // Delete old return details
      await tx.purchaseReturnDetail.deleteMany({
        where: { return_id: parseInt(id) }
      });

      // Delete old ledger entries for this return
      await tx.ledger.deleteMany({
        where: { bill_no: `PR-${id}` }
      });

      // 2. Now apply the NEW return effects
      
      // Update purchase return record
      const updatedReturn = await tx.purchaseReturn.update({
        where: { id: parseInt(id) },
        data: {
          return_date: new Date(return_date),
          return_reason,
          total_return_amount: parseFloat(total_return_amount || 0),
          notes: notes || null
        }
      });

      // Create new return details
      if (return_details && return_details.length > 0) {
        const returnDetailsData = return_details.map(detail => ({
          return_id: parseInt(id),
          pro_id: parseInt(detail.pro_id),
          return_quantity: parseInt(detail.return_quantity),
          unit_rate: parseFloat(detail.unit_rate || 0),
          return_amount: parseFloat(detail.return_amount || 0)
        }));

        await tx.purchaseReturnDetail.createMany({
          data: returnDetailsData
        });

        // Apply new stock changes (decrement for return)
        if (purchase.store_id) {
          for (const detail of return_details) {
            const storeIdInt = parseInt(purchase.store_id);
            const productIdInt = parseInt(detail.pro_id);
            const qtyChange = parseInt(detail.return_quantity);
            try {
              await tx.$executeRaw`
                INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, created_at, updated_at) 
                VALUES (${storeIdInt}, ${productIdInt}, -${qtyChange}, 0, 1000, NOW(), NOW())
                ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity - ${qtyChange}, updated_at = NOW()
              `;
            } catch (stockError) {
              console.warn('Stock update warning:', stockError.message);
            }
          }
        }
      }

      const returnAmount = parseFloat(total_return_amount || 0);

      // Entry 1: Main Return entry for Supplier (DEBIT)
      const l_id_pr = await getNextId('ledger', 'l_id', tx);
      const supplierClosingAfterReturn = supplierBalance + returnAmount; // under receivable formula: + debit

      await tx.ledger.create({
        data: {
          l_id: l_id_pr,
          cus_id: purchase.cus_id,
          opening_balance: supplierBalance,
          debit_amount: returnAmount,
          credit_amount: 0,
          closing_balance: supplierClosingAfterReturn,
          bill_no: `PR-${id}`,
          trnx_type: 'DEBIT',
          ledger_type: 'Purchase Return',
          details: `Purchase Return #${id} (Updated) - ${return_reason} - Goods returned to ${supplierReverted.cus_name}`,
          payments: 0,
          updated_by: null
        }
      });

      supplierBalance = supplierClosingAfterReturn;

      // Calculate cash and bank refund amounts based on original purchase payments
      const maxCashRefund = parseFloat(purchase.cash_payment || 0);
      const maxBankRefund = parseFloat(purchase.bank_payment || 0);

      let cashRefund = 0;
      let bankRefund = 0;

      if (maxCashRefund > 0 && purchase.debit_account_id) {
        cashRefund = Math.min(returnAmount, maxCashRefund);
      }
      if (returnAmount - cashRefund > 0 && maxBankRefund > 0 && purchase.credit_account_id) {
        bankRefund = Math.min(returnAmount - cashRefund, maxBankRefund);
      }

      // Entry 2: CASH Refund entries
      if (cashRefund > 0 && purchase.debit_account_id) {
        if (!affectedCusIds.includes(purchase.debit_account_id)) {
          affectedCusIds.push(purchase.debit_account_id);
        }
        const cashAccount = await tx.customer.findUnique({
          where: { cus_id: purchase.debit_account_id }
        });
        if (cashAccount) {
          const cashClosing = parseFloat(cashAccount.cus_balance || 0) + cashRefund; // Cash account debited (receives money)
          
          // Entry 2a: Cash Account Ledger Entry
          const l_id_cash = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_cash,
              cus_id: purchase.debit_account_id,
              opening_balance: parseFloat(cashAccount.cus_balance || 0),
              debit_amount: cashRefund,
              credit_amount: 0,
              closing_balance: cashClosing,
              bill_no: `PR-${id}`,
              trnx_type: 'DEBIT',
              ledger_type: 'Purchase Return',
              details: `Refund Received (CASH) - Purchase Return #${id} - Amount: ${cashRefund}`,
              payments: cashRefund,
              cash_payment: cashRefund,
              updated_by: null
            }
          });

          await tx.customer.update({
            where: { cus_id: purchase.debit_account_id },
            data: { cus_balance: cashClosing }
          });

          // Entry 2b: Supplier Account Payment/Refund Entry (CREDIT)
          const supplierClosingAfterCash = supplierBalance - cashRefund; // under receivable formula: - credit
          const l_id_sup_cash = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_sup_cash,
              cus_id: purchase.cus_id,
              opening_balance: supplierBalance,
              debit_amount: 0,
              credit_amount: cashRefund,
              closing_balance: supplierClosingAfterCash,
              bill_no: `PR-${id}`,
              trnx_type: 'CREDIT',
              ledger_type: 'Purchase Return',
              details: `CASH Refund Received: ${cashRefund} for Purchase Return #${id}`,
              payments: 0,
              updated_by: null
            }
          });

          supplierBalance = supplierClosingAfterCash;
        }
      }

      // Entry 3: BANK Refund entries
      if (bankRefund > 0 && purchase.credit_account_id) {
        if (!affectedCusIds.includes(purchase.credit_account_id)) {
          affectedCusIds.push(purchase.credit_account_id);
        }
        const bankAccount = await tx.customer.findUnique({
          where: { cus_id: purchase.credit_account_id }
        });
        if (bankAccount) {
          const bankClosing = parseFloat(bankAccount.cus_balance || 0) + bankRefund; // Bank account debited (receives money)

          // Entry 3a: Bank Account Ledger Entry
          const l_id_bank = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_bank,
              cus_id: purchase.credit_account_id,
              opening_balance: parseFloat(bankAccount.cus_balance || 0),
              debit_amount: bankRefund,
              credit_amount: 0,
              closing_balance: bankClosing,
              bill_no: `PR-${id}`,
              trnx_type: 'DEBIT',
              ledger_type: 'Purchase Return',
              details: `Refund Received (BANK) - Purchase Return #${id} - Amount: ${bankRefund}`,
              payments: bankRefund,
              bank_payment: bankRefund,
              updated_by: null
            }
          });

          await tx.customer.update({
            where: { cus_id: purchase.credit_account_id },
            data: { cus_balance: bankClosing }
          });

          // Entry 3b: Supplier Account Payment/Refund Entry (CREDIT)
          const supplierClosingAfterBank = supplierBalance - bankRefund; // under receivable formula: - credit
          const l_id_sup_bank = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_sup_bank,
              cus_id: purchase.cus_id,
              opening_balance: supplierBalance,
              debit_amount: 0,
              credit_amount: bankRefund,
              closing_balance: supplierClosingAfterBank,
              bill_no: `PR-${id}`,
              trnx_type: 'CREDIT',
              ledger_type: 'Purchase Return',
              details: `BANK Refund Received: ${bankRefund} for Purchase Return #${id}`,
              payments: 0,
              updated_by: null
            }
          });

          supplierBalance = supplierClosingAfterBank;
        }
      }

      // Update supplier's final balance
      await tx.customer.update({
        where: { cus_id: purchase.cus_id },
        data: { cus_balance: supplierBalance }
      });

      return {
        updatedReturn,
        affectedCusIds
      };
      },
      {
        timeout: 30000, // 30 seconds
        maxWait: 60000   // 60 seconds max wait
      }
    );

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    const uniqueAffectedCusIds = [...new Set(result.affectedCusIds)];
    for (const cid of uniqueAffectedCusIds) {
      await recalculateLedgerBalances(prisma, cid);
    }

    console.log('Purchase return updated successfully:', result.updatedReturn);
    return NextResponse.json(result.updatedReturn);

  } catch (error) {
    console.error('Error updating purchase return:', error);
    return NextResponse.json({ 
      error: 'Failed to update purchase return',
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE - Delete purchase return
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Purchase return ID is required' }, { status: 400 });
    }

    // Check if purchase return exists
    const existingReturn = await prisma.purchaseReturn.findUnique({
      where: { id: parseInt(id) },
      include: {
        return_details: true,
        purchase: true
      }
    });

    if (!existingReturn) {
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });
    }

    const purchase = existingReturn.purchase;

    const result = await prisma.$transaction(
      async (tx) => {
        // Revert store stock changes - INCREMENT back what was decremented
        // (Items that were returned to supplier are now back in our stock conceptually)
        if (purchase.store_id) {
          for (const detail of existingReturn.return_details) {
            const storeIdInt = parseInt(purchase.store_id);
            const productIdInt = parseInt(detail.pro_id);
            const qtyChange = parseInt(detail.return_quantity);
            try {
              await tx.$executeRaw`
                UPDATE store_stocks 
                SET stock_quantity = stock_quantity + ${qtyChange}, updated_at = NOW() 
                WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}
              `;
            } catch (stockError) {
            console.warn('Stock reversal warning:', stockError.message);
          }
        }
      }

      // Fetch all old ledger entries for this return to calculate and reverse their effects
      const oldLedgerEntries = await tx.ledger.findMany({
        where: { bill_no: `PR-${id}` }
      });

      // Reverse old entries on the customer table balances
      for (const entry of oldLedgerEntries) {
        const acc = await tx.customer.findUnique({
          where: { cus_id: entry.cus_id }
        });
        if (acc) {
          const effect = parseFloat(entry.debit_amount || 0) - parseFloat(entry.credit_amount || 0);
          await tx.customer.update({
            where: { cus_id: entry.cus_id },
            data: {
              cus_balance: parseFloat(acc.cus_balance || 0) - effect
            }
          });
        }
      }

      // Track all affected customer IDs
      const affectedCusIds = oldLedgerEntries.map(e => e.cus_id);
      if (!affectedCusIds.includes(purchase.cus_id)) {
        affectedCusIds.push(purchase.cus_id);
      }

      // Delete return details
      await tx.purchaseReturnDetail.deleteMany({
        where: { return_id: parseInt(id) }
      });

      // Delete original ledger entries related to this return
      await tx.ledger.deleteMany({
        where: { bill_no: `PR-${id}` }
      });

      // Delete purchase return
      const deletedReturn = await tx.purchaseReturn.delete({
        where: { id: parseInt(id) }
      });

      return {
        deletedReturn,
        affectedCusIds
      };
      },
      {
        timeout: 30000, // 30 seconds
        maxWait: 60000   // 60 seconds max wait
      }
    );

    // Recalculate balances chronologically for all affected accounts (outside transaction)
    const uniqueAffectedCusIds = [...new Set(result.affectedCusIds)];
    for (const cid of uniqueAffectedCusIds) {
      await recalculateLedgerBalances(prisma, cid);
    }

    console.log('Purchase return deleted successfully:', result.deletedReturn);
    return NextResponse.json({ message: 'Purchase return deleted successfully' });

  } catch (error) {
    console.error('Error deleting purchase return:', error);
    return NextResponse.json({ 
      error: 'Failed to delete purchase return',
      details: error.message 
    }, { status: 500 });
  }
}



