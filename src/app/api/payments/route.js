import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateClosingBalance, createLedgerEntry, createPayableLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';
import { persistPaymentLedger, recalculateLedgerBalances } from '@/lib/payment-ledger-writer';
import { logActivity, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-logger';

// GET - Fetch all payments with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const accountId = searchParams.get('account_id') ? parseInt(searchParams.get('account_id')) : null;
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    if (id) {
      // Fetch single payment
      const payment = await prisma.payment.findUnique({
        where: { payment_id: id },
        include: {
          account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          cash_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          bank_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          payment_details: {
            include: {
              account: {
                select: {
                  cus_id: true,
                  cus_name: true
                }
              }
            }
          },
          created_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        }
      });

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      return NextResponse.json(payment);
    } else {
      // Fetch all payments with filters
      const where = {};
      if (accountId) where.account_id = accountId;
      if (type) where.payment_type = type;
      if (status) where.status = status;

      const payments = await prisma.payment.findMany({
        where,
        include: {
          account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          cash_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          bank_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          created_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return NextResponse.json(payments);
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST - Create a new payment
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      payment_date,
      payment_type,
      account_id,
      total_amount,
      discount_amount = 0,
      cash_account_id,
      cash_amount = 0,
      bank_account_id,
      bank_amount = 0,
      description,
      created_by
    } = body;

    // Validate required fields
    if (!payment_date || !payment_type || !account_id || !total_amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validatedCreatedBy = await resolveUpdatedByUserId(request, created_by, prisma);
    if (!validatedCreatedBy) {
      return NextResponse.json(
        { error: 'Invalid user session. Please log in again and retry.' },
        { status: 400 }
      );
    }

    const netAmount = parseFloat(total_amount) - parseFloat(discount_amount);
    const totalPaymentAmount = parseFloat(cash_amount) + parseFloat(bank_amount);

    // Validate payment amounts
    if (Math.abs(netAmount - totalPaymentAmount) > 0.01) {
      return NextResponse.json({
        error: 'Payment amounts do not match net amount'
      }, { status: 400 });
    }

    // Get current balances and categories for all affected accounts (BEFORE transaction)
    const affectedAccountIds = [parseInt(account_id)];
    if (cash_account_id) affectedAccountIds.push(parseInt(cash_account_id));
    if (bank_account_id) affectedAccountIds.push(parseInt(bank_account_id));

    const accountBalances = await prisma.customer.findMany({
      where: { cus_id: { in: affectedAccountIds } },
      select: {
        cus_id: true,
        cus_name: true,
        cus_balance: true,
        cus_category: true,
        customer_category: { select: { cus_cat_title: true } }
      }
    });

    const balanceMap = {};
    const categoryMap = {};
    const supplierAccountIds = new Set();
    const bankCashCategoryIds = new Set();
    accountBalances.forEach(acc => {
      balanceMap[acc.cus_id] = parseFloat(acc.cus_balance || 0);
      categoryMap[acc.cus_id] = acc.cus_category;
      const catTitle = (acc.customer_category?.cus_cat_title || '').toLowerCase();
      if (catTitle.includes('supplier')) supplierAccountIds.add(acc.cus_id);
      if (catTitle.includes('cash') || catTitle.includes('bank')) {
        if (acc.cus_category) bankCashCategoryIds.add(acc.cus_category);
      }
    });

    // Resolve main customer name
    const mainCustomer = accountBalances.find(acc => acc.cus_id === parseInt(account_id));
    const mainCustomerName = mainCustomer?.cus_name || '';

    // Bank and Cash are asset accounts — same direction as customer/supplier now
    // PAY (Pay Amount)    = money OUT → CREDIT → selected account balance decreases
    // RECEIVE (Receive Amount) = money IN → DEBIT → selected account balance increases
    const mainAccountIsBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);
    const mainAccountIsSupplier = supplierAccountIds.has(parseInt(account_id));

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(
      async (tx) => {
        // Create payment
        const payment = await tx.payment.create({
          data: {
            payment_date: new Date(payment_date),
            payment_type,
            account_id: parseInt(account_id),
            total_amount: parseFloat(total_amount),
            discount_amount: parseFloat(discount_amount),
            net_amount: netAmount,
            cash_account_id: cash_account_id ? parseInt(cash_account_id) : null,
            cash_amount: parseFloat(cash_amount),
            bank_account_id: bank_account_id ? parseInt(bank_account_id) : null,
            bank_amount: parseFloat(bank_amount),
            description,
            created_by: validatedCreatedBy
          }
        });

        // Create payment details for ledger entries
        const paymentDetails = [];

        // Main account entry (debit for receive, credit for pay)
        if (payment_type === 'RECEIVE') {
          paymentDetails.push({
            payment_id: payment.payment_id,
            account_id: parseInt(account_id),
            amount: netAmount,
            description: description || `Payment received from account`
          });
        } else { // PAY
          paymentDetails.push({
            payment_id: payment.payment_id,
            account_id: parseInt(account_id),
            amount: parseFloat(total_amount), // Total amount for supplier credit
            description: description || `Payment made to account`
          });
        }

        // Cash account entry (if cash payment exists)
        if (cash_account_id && parseFloat(cash_amount) > 0) {
          if (payment_type === 'RECEIVE') {
            paymentDetails.push({
              payment_id: payment.payment_id,
              account_id: parseInt(cash_account_id),
              amount: -parseFloat(cash_amount), // Cash out for receive
              description: `Cash payment received`
            });
          } else { // PAY
            paymentDetails.push({
              payment_id: payment.payment_id,
              account_id: parseInt(cash_account_id),
              amount: -parseFloat(cash_amount), // Cash out for pay
              description: `Cash payment made`
            });
          }
        }

        // Bank account entry (if bank payment exists)
        if (bank_account_id && parseFloat(bank_amount) > 0) {
          if (payment_type === 'RECEIVE') {
            paymentDetails.push({
              payment_id: payment.payment_id,
              account_id: parseInt(bank_account_id),
              amount: -parseFloat(bank_amount), // Bank out for receive
              description: `Bank payment received`
            });
          } else { // PAY
            paymentDetails.push({
              payment_id: payment.payment_id,
              account_id: parseInt(bank_account_id),
              amount: -parseFloat(bank_amount), // Bank out for pay
              description: `Bank payment made`
            });
          }
        }

        // Create payment details
        if (paymentDetails.length > 0) {
          await tx.paymentDetail.createMany({
            data: paymentDetails
          });
        }
      const ledgerEntries = [];

      // Main account line:
      //   Bank/Cash (asset): RECEIVE → DEBIT, PAY → CREDIT
      //   Supplier (payable): purchase/bill → DEBIT, payment → CREDIT (PAY = credit)
      //   Customer (receivable): RECEIVE → DEBIT, PAY → CREDIT
      let mainDebitAmount = 0;
      let mainCreditAmount = 0;
      let trnxTypeToUse = '';

      if (mainAccountIsBankOrCash) {
        if (payment_type === 'RECEIVE') {
          // Bank/Cash receiving money gets a DEBIT entry
          mainDebitAmount = parseFloat(total_amount);
          mainCreditAmount = 0;
          trnxTypeToUse = 'DEBIT';
        } else {
          // Bank/Cash paying money gets a CREDIT entry
          mainDebitAmount = 0;
          mainCreditAmount = parseFloat(total_amount);
          trnxTypeToUse = 'CREDIT';
        }
      } else {
        // Customer or Supplier (non-cash/bank)
        if (payment_type === 'RECEIVE') {
          // Receiving money from customer/supplier gets a CREDIT entry
          mainDebitAmount = 0;
          mainCreditAmount = parseFloat(total_amount);
          trnxTypeToUse = 'CREDIT';
        } else {
          // Paying money to customer/supplier gets a DEBIT entry
          mainDebitAmount = parseFloat(total_amount);
          mainCreditAmount = 0;
          trnxTypeToUse = 'DEBIT';
        }
      }

      const mainAccountEntry = createLedgerEntry({
        cus_id: parseInt(account_id),
        opening_balance: balanceMap[parseInt(account_id)] || 0,
        debit_amount: mainDebitAmount,
        credit_amount: mainCreditAmount,
        bill_no: `PAY-${payment.payment_id}`,
        trnx_type: trnxTypeToUse,
        ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
        details: parseFloat(discount_amount) > 0 
          ? `${description || `${payment_type.toLowerCase()} payment`} (Total: ${total_amount}, Discount: ${discount_amount}, Net: ${netAmount})`
          : (description || `${payment_type.toLowerCase()} payment`),
        payments: netAmount,
        updated_by: validatedCreatedBy
      });

      // Apply custom payment requirement
      if (payment_type === 'RECEIVE') {
        const isMainBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);
        if (isMainBankOrCash) {
          // Cash/Bank account receives payment: debit column, balance increases
          mainAccountEntry.debit_amount = parseFloat(total_amount);
          mainAccountEntry.credit_amount = 0;
          mainAccountEntry.closing_balance = mainAccountEntry.opening_balance + parseFloat(total_amount);
        } else {
          // Customer/Supplier account paying us: credit column, balance decreases
          mainAccountEntry.debit_amount = 0;
          mainAccountEntry.credit_amount = parseFloat(total_amount);
          mainAccountEntry.closing_balance = mainAccountEntry.opening_balance - parseFloat(total_amount);
        }
      } else if (payment_type === 'PAY') {
        const isMainBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);
        if (isMainBankOrCash) {
          // Cash/Bank account paying out: credit column, balance decreases
          mainAccountEntry.debit_amount = 0;
          mainAccountEntry.credit_amount = parseFloat(total_amount);
          mainAccountEntry.closing_balance = mainAccountEntry.opening_balance - parseFloat(total_amount);
        } else {
          // Customer/Supplier account receiving payment from us: debit column, balance increases
          mainAccountEntry.debit_amount = parseFloat(total_amount);
          mainAccountEntry.credit_amount = 0;
          mainAccountEntry.closing_balance = mainAccountEntry.opening_balance + parseFloat(total_amount);
        }
      }

      ledgerEntries.push({
        ...mainAccountEntry,
        cash_payment: parseFloat(cash_amount),
        bank_payment: parseFloat(bank_amount)
      });

      // Update balance map for next entries
      balanceMap[parseInt(account_id)] = mainAccountEntry.closing_balance;

      // Cash account ledger entry (if applicable)
      if (cash_account_id && parseFloat(cash_amount) > 0) {
        let cashDebitAmount = 0;
        let cashCreditAmount = 0;
        let cashTrnxType = '';
        let cashClosingBalance = 0;

        if (mainAccountIsBankOrCash) {
          if (payment_type === 'RECEIVE') {
            // bank is receiving money from cash: cash balance decreases (credit)
            cashDebitAmount = 0;
            cashCreditAmount = parseFloat(cash_amount);
            cashTrnxType = 'CREDIT';
            cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) - parseFloat(cash_amount);
          } else {
            // bank is paying money to cash: cash balance increases (debit)
            cashDebitAmount = parseFloat(cash_amount);
            cashCreditAmount = 0;
            cashTrnxType = 'DEBIT';
            cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) + parseFloat(cash_amount);
          }
        } else {
          // main account is customer/supplier
          if (payment_type === 'RECEIVE') {
            // we receive payment: cash balance increases (debit)
            cashDebitAmount = parseFloat(cash_amount);
            cashCreditAmount = 0;
            cashTrnxType = 'DEBIT';
            cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) + parseFloat(cash_amount);
          } else {
            // we pay customer: cash balance decreases (credit)
            cashDebitAmount = 0;
            cashCreditAmount = parseFloat(cash_amount);
            cashTrnxType = 'CREDIT';
            cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) - parseFloat(cash_amount);
          }
        }

        const cashAccountEntry = createLedgerEntry({
          cus_id: parseInt(cash_account_id),
          opening_balance: balanceMap[parseInt(cash_account_id)] || 0,
          debit_amount: cashDebitAmount,
          credit_amount: cashCreditAmount,
          bill_no: `PAY-${payment.payment_id}`,
          trnx_type: cashTrnxType,
          ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
          details: description || (payment_type === 'RECEIVE'
            ? `payment received from customer account ${mainCustomerName}`
            : `payment made to customer account ${mainCustomerName}`),
          payments: parseFloat(cash_amount),
          updated_by: validatedCreatedBy
        });
        cashAccountEntry.closing_balance = cashClosingBalance;

        ledgerEntries.push({
          ...cashAccountEntry,
          cash_payment: parseFloat(cash_amount),
          bank_payment: 0
        });

        // Update balance map
        balanceMap[parseInt(cash_account_id)] = cashAccountEntry.closing_balance;
      }

      // Bank account ledger entry (if applicable)
      if (bank_account_id && parseFloat(bank_amount) > 0) {
        let bankDebitAmount = 0;
        let bankCreditAmount = 0;
        let bankTrnxType = '';
        let bankClosingBalance = 0;

        if (mainAccountIsBankOrCash) {
          if (payment_type === 'RECEIVE') {
            // bank (main) receives from bank (counter-party): bank (counter-party) decreases (credit)
            bankDebitAmount = 0;
            bankCreditAmount = parseFloat(bank_amount);
            bankTrnxType = 'CREDIT';
            bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) - parseFloat(bank_amount);
          } else {
            // bank (main) pays to bank (counter-party): bank (counter-party) increases (debit)
            bankDebitAmount = parseFloat(bank_amount);
            bankCreditAmount = 0;
            bankTrnxType = 'DEBIT';
            bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) + parseFloat(bank_amount);
          }
        } else {
          // main account is customer/supplier
          if (payment_type === 'RECEIVE') {
            // we receive payment: bank balance increases (debit)
            bankDebitAmount = parseFloat(bank_amount);
            bankCreditAmount = 0;
            bankTrnxType = 'DEBIT';
            bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) + parseFloat(bank_amount);
          } else {
            // we pay customer: bank balance decreases (credit)
            bankDebitAmount = 0;
            bankCreditAmount = parseFloat(bank_amount);
            bankTrnxType = 'CREDIT';
            bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) - parseFloat(bank_amount);
          }
        }

        const bankAccountEntry = createLedgerEntry({
          cus_id: parseInt(bank_account_id),
          opening_balance: balanceMap[parseInt(bank_account_id)] || 0,
          debit_amount: bankDebitAmount,
          credit_amount: bankCreditAmount,
          bill_no: `PAY-${payment.payment_id}`,
          trnx_type: bankTrnxType,
          ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
          details: description || (payment_type === 'RECEIVE'
            ? `payment received from customer account ${mainCustomerName}`
            : `payment made to customer account ${mainCustomerName}`),
          payments: parseFloat(bank_amount),
          updated_by: validatedCreatedBy
        });
        bankAccountEntry.closing_balance = bankClosingBalance;

        ledgerEntries.push({
          ...bankAccountEntry,
          cash_payment: 0,
          bank_payment: parseFloat(bank_amount)
        });
      }

      // Create ledger entries
      const startLId = await getNextId('ledger', 'l_id', tx);
      const ledgerEntriesWithIds = ledgerEntries.map((entry, index) => ({
        l_id: startLId + index,
        ...entry
      }));

      await tx.ledger.createMany({
        data: ledgerEntriesWithIds
      });

      // Update cus_balance for all affected accounts using ledger closing balances
      const balanceUpdates = [];

      // Main account balance
      const mainClosing = mainAccountEntry.closing_balance;
      balanceUpdates.push(tx.customer.update({
        where: { cus_id: parseInt(account_id) },
        data: { cus_balance: mainClosing }
      }));

      // Cash account balance (if used)
      if (cash_account_id && parseFloat(cash_amount) > 0) {
        const cashEntry = ledgerEntries.find(e => e.cus_id === parseInt(cash_account_id));
        if (cashEntry) {
          balanceUpdates.push(tx.customer.update({
            where: { cus_id: parseInt(cash_account_id) },
            data: { cus_balance: cashEntry.closing_balance }
          }));
        }
      }

      // Bank account balance (if used)
      if (bank_account_id && parseFloat(bank_amount) > 0) {
        const bankEntry = ledgerEntries.find(e => e.cus_id === parseInt(bank_account_id));
        if (bankEntry) {
          balanceUpdates.push(tx.customer.update({
            where: { cus_id: parseInt(bank_account_id) },
            data: { cus_balance: bankEntry.closing_balance }
          }));
        }
      }

      await Promise.all(balanceUpdates);

      const ledgerIds = ledgerEntriesWithIds.map((e) => e.l_id);
      const createdLedgerEntries = await tx.ledger.findMany({
        where: { l_id: { in: ledgerIds } },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true,
              cus_category: true,
              cus_type: true,
              customer_category: { select: { cus_cat_title: true } },
              customer_type: { select: { cus_type_title: true } },
            },
          },
          updated_by_user: {
            select: { user_id: true, full_name: true, role: true },
          },
        },
      });

      const updated_balances = { [parseInt(account_id)]: mainClosing };
      if (cash_account_id && parseFloat(cash_amount) > 0) {
        const cashEntry = ledgerEntries.find((e) => e.cus_id === parseInt(cash_account_id));
        if (cashEntry) updated_balances[parseInt(cash_account_id)] = cashEntry.closing_balance;
      }
      if (bank_account_id && parseFloat(bank_amount) > 0) {
        const bankEntry = ledgerEntries.find((e) => e.cus_id === parseInt(bank_account_id));
        if (bankEntry) updated_balances[parseInt(bank_account_id)] = bankEntry.closing_balance;
      }

      const paymentRecord = await tx.payment.findUnique({
        where: { payment_id: payment.payment_id },
        include: {
          account: {
            select: { cus_id: true, cus_name: true, cus_phone_no: true },
          },
          cash_account: {
            select: { cus_id: true, cus_name: true },
          },
          bank_account: {
            select: { cus_id: true, cus_name: true },
          },
          created_by_user: {
            select: { full_name: true, role: true },
          },
        },
      });

      return {
        ...paymentRecord,
        customer_opening_balance: mainAccountEntry.opening_balance,
        customer_closing_balance: mainAccountEntry.closing_balance,
        ledger_entries: createdLedgerEntries,
        updated_balances,
      };
    }, { timeout: 15000 });

    const actionDesc = result.payment_type === 'RECEIVE' ? 'Received from' : 'Paid to';
    const partyName = result.account?.cus_name || `Account #${result.account_id}`;
    logActivity({
      request,
      branchId: __branchScope.branchId,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.PAYMENTS,
      entityId: result.payment_id,
      description: `Payment #${result.payment_id} (${result.payment_type}): Rs ${result.net_amount || 0} ${actionDesc} ${partyName}.`,
      details: {
        payment_id: result.payment_id,
        account_id: result.account_id,
        payment_type: result.payment_type,
        net_amount: result.net_amount,
        cash_amount: result.cash_amount,
        bank_amount: result.bank_amount,
      },
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

// PUT - Update payment transaction (full edit) or status-only
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      status,
      payment_date,
      payment_type,
      account_id,
      total_amount,
      discount_amount = 0,
      cash_account_id,
      cash_amount = 0,
      bank_account_id,
      bank_amount = 0,
      description,
      created_by,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const paymentId = parseInt(id, 10);
    const isFullUpdate = payment_type && account_id != null && total_amount != null;

    if (!isFullUpdate) {
      if (!status) {
        return NextResponse.json({ error: 'Payment ID and status are required' }, { status: 400 });
      }
      const payment = await prisma.payment.update({
        where: { payment_id: paymentId },
        data: { status },
      });
      return NextResponse.json(payment);
    }

    if (!payment_date) {
      return NextResponse.json({ error: 'Payment date is required' }, { status: 400 });
    }

    const validatedCreatedBy = await resolveUpdatedByUserId(request, created_by, prisma);
    if (!validatedCreatedBy) {
      return NextResponse.json(
        { error: 'Invalid user session. Please log in again and retry.' },
        { status: 400 }
      );
    }

    const netAmount = parseFloat(total_amount) - parseFloat(discount_amount);
    const totalPaymentAmount = parseFloat(cash_amount) + parseFloat(bank_amount);
    if (Math.abs(netAmount - totalPaymentAmount) > 0.01) {
      return NextResponse.json({ error: 'Payment amounts do not match net amount' }, { status: 400 });
    }

    const existing = await prisma.payment.findUnique({ where: { payment_id: paymentId } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const affectedAccountIds = new Set([
      existing.account_id,
      existing.cash_account_id,
      existing.bank_account_id,
      parseInt(account_id),
      cash_account_id ? parseInt(cash_account_id) : null,
      bank_account_id ? parseInt(bank_account_id) : null,
    ].filter(Boolean));

    const result = await prisma.$transaction(async (tx) => {
      const billRef = `PAY-${paymentId}`;

      await tx.ledger.deleteMany({ where: { bill_no: billRef } });
      await tx.paymentDetail.deleteMany({ where: { payment_id: paymentId } });

      for (const cusId of affectedAccountIds) {
        await recalculateLedgerBalances(tx, cusId);
      }

      const payment = await tx.payment.update({
        where: { payment_id: paymentId },
        data: {
          payment_date: new Date(payment_date),
          payment_type,
          account_id: parseInt(account_id),
          total_amount: parseFloat(total_amount),
          discount_amount: parseFloat(discount_amount),
          net_amount: netAmount,
          cash_account_id: cash_account_id ? parseInt(cash_account_id) : null,
          cash_amount: parseFloat(cash_amount),
          bank_account_id: bank_account_id ? parseInt(bank_account_id) : null,
          bank_amount: parseFloat(bank_amount),
          description,
        },
      });

      const accountBalances = await tx.customer.findMany({
        where: { cus_id: { in: [...affectedAccountIds] } },
        select: {
          cus_id: true,
          cus_name: true,
          cus_balance: true,
          cus_category: true,
          customer_category: { select: { cus_cat_title: true } },
        },
      });

      const balanceMap = {};
      const categoryMap = {};
      const supplierAccountIds = new Set();
      const bankCashCategoryIds = new Set();
      accountBalances.forEach((acc) => {
        balanceMap[acc.cus_id] = parseFloat(acc.cus_balance || 0);
        categoryMap[acc.cus_id] = acc.cus_category;
        const catTitle = (acc.customer_category?.cus_cat_title || '').toLowerCase();
        if (catTitle.includes('supplier')) supplierAccountIds.add(acc.cus_id);
        if (catTitle.includes('cash') || catTitle.includes('bank')) {
          if (acc.cus_category) bankCashCategoryIds.add(acc.cus_category);
        }
      });

      const mainCustomer = accountBalances.find((acc) => acc.cus_id === parseInt(account_id));
      const mainCustomerName = mainCustomer?.cus_name || '';
      const mainAccountIsBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);

      const ledgerResult = await persistPaymentLedger(tx, {
        payment,
        payment_type,
        account_id,
        total_amount,
        discount_amount,
        netAmount,
        cash_account_id,
        cash_amount,
        bank_account_id,
        bank_amount,
        description,
        validatedCreatedBy,
        balanceMap,
        categoryMap,
        bankCashCategoryIds,
        mainCustomerName,
        mainAccountIsBankOrCash,
      });

      const paymentRecord = await tx.payment.findUnique({
        where: { payment_id: payment.payment_id },
        include: {
          account: {
            select: { cus_id: true, cus_name: true, cus_phone_no: true },
          },
          cash_account: {
            select: { cus_id: true, cus_name: true },
          },
          bank_account: {
            select: { cus_id: true, cus_name: true },
          },
          created_by_user: {
            select: { full_name: true, role: true },
          },
        },
      });

      return {
        ...paymentRecord,
        customer_opening_balance: ledgerResult.mainAccountEntry.opening_balance,
        customer_closing_balance: ledgerResult.mainAccountEntry.closing_balance,
        ledger_entries: ledgerResult.createdLedgerEntries,
        updated_balances: ledgerResult.updated_balances,
      };
    }, { timeout: 20000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE - Cancel payment
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Use transaction to reverse the payment
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { payment_id: parseInt(id) },
        include: { payment_details: true }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Reverse customer balance
      const currentCustomer = await tx.customer.findUnique({
        where: { cus_id: payment.account_id },
        select: { cus_balance: true }
      });

      let newBalance = parseFloat(currentCustomer.cus_balance || 0);
      if (payment.payment_type === 'RECEIVE') {
        // RECEIVE (Receive Amount) subtracted balance (credited customer) → reverse by adding back
        newBalance += parseFloat(payment.net_amount);
      } else {
        // PAY (Pay Amount) added balance (debited customer) → reverse by subtracting
        newBalance -= parseFloat(payment.net_amount);
      }

      await tx.customer.update({
        where: { cus_id: payment.account_id },
        data: { cus_balance: newBalance }
      });

      // Mark payment as cancelled
      await tx.payment.update({
        where: { payment_id: parseInt(id) },
        data: { status: 'CANCELLED' }
      });

      // Note: In a real application, you might want to create reversing ledger entries
      // For now, we'll just mark the payment as cancelled
    }, { timeout: 20000 });

    logActivity({
      request,
      branchId: __branchScope.branchId,
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      module: AUDIT_MODULES.PAYMENTS,
      entityId: id,
      description: `Payment #${id} was cancelled.`,
      details: { payment_id: id, status: 'CANCELLED' },
    }).catch(() => {});

    return NextResponse.json({ message: 'Payment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return NextResponse.json({ error: 'Failed to cancel payment' }, { status: 500 });
  }
}