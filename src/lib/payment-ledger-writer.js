import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';

/** Recalculate opening/closing balances for one account after ledger rows change */
export async function recalculateLedgerBalances(tx, cus_id) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    include: { customer_category: true },
  });
  if (!customer) return;

  const entries = await tx.ledger.findMany({
    where: { cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

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
              closing_balance: Number(closing.toFixed(2)),
            },
          })
        );
      }
      runningBalance = closing;
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  await tx.customer.update({
    where: { cus_id },
    data: { cus_balance: Number(runningBalance.toFixed(2)) },
  });
}

/**
 * Create payment_details + ledger rows for a payment (new or updated).
 * Mutates balanceMap as entries are written.
 */
export async function persistPaymentLedger(tx, ctx) {
  const {
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
  } = ctx;

  const paymentDetails = [];

  if (payment_type === 'RECEIVE') {
    paymentDetails.push({
      payment_id: payment.payment_id,
      account_id: parseInt(account_id),
      amount: netAmount,
      description: description || 'Payment received from account',
    });
  } else {
    paymentDetails.push({
      payment_id: payment.payment_id,
      account_id: parseInt(account_id),
      amount: parseFloat(total_amount),
      description: description || 'Payment made to account',
    });
  }

  if (cash_account_id && parseFloat(cash_amount) > 0) {
    paymentDetails.push({
      payment_id: payment.payment_id,
      account_id: parseInt(cash_account_id),
      amount: -parseFloat(cash_amount),
      description: payment_type === 'RECEIVE' ? 'Cash payment received' : 'Cash payment made',
    });
  }

  if (bank_account_id && parseFloat(bank_amount) > 0) {
    paymentDetails.push({
      payment_id: payment.payment_id,
      account_id: parseInt(bank_account_id),
      amount: -parseFloat(bank_amount),
      description: payment_type === 'RECEIVE' ? 'Bank payment received' : 'Bank payment made',
    });
  }

  if (paymentDetails.length > 0) {
    await tx.paymentDetail.createMany({ data: paymentDetails });
  }

  const ledgerEntries = [];
  let mainDebitAmount = 0;
  let mainCreditAmount = 0;
  let trnxTypeToUse = '';

  if (mainAccountIsBankOrCash) {
    if (payment_type === 'RECEIVE') {
      mainDebitAmount = parseFloat(total_amount);
      mainCreditAmount = 0;
      trnxTypeToUse = 'DEBIT';
    } else {
      mainDebitAmount = 0;
      mainCreditAmount = parseFloat(total_amount);
      trnxTypeToUse = 'CREDIT';
    }
  } else if (payment_type === 'RECEIVE') {
    mainDebitAmount = 0;
    mainCreditAmount = parseFloat(total_amount);
    trnxTypeToUse = 'CREDIT';
  } else {
    mainDebitAmount = parseFloat(total_amount);
    mainCreditAmount = 0;
    trnxTypeToUse = 'DEBIT';
  }

  const mainAccountEntry = createLedgerEntry({
    cus_id: parseInt(account_id),
    opening_balance: balanceMap[parseInt(account_id)] || 0,
    debit_amount: mainDebitAmount,
    credit_amount: mainCreditAmount,
    bill_no: `PAY-${payment.payment_id}`,
    trnx_type: trnxTypeToUse,
    ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
    details:
      parseFloat(discount_amount) > 0
        ? `${description || `${payment_type.toLowerCase()} payment`} (Total: ${total_amount}, Discount: ${discount_amount}, Net: ${netAmount})`
        : description || `${payment_type.toLowerCase()} payment`,
    payments: netAmount,
    updated_by: validatedCreatedBy,
  });

  if (payment_type === 'RECEIVE') {
    const isMainBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);
    if (isMainBankOrCash) {
      mainAccountEntry.debit_amount = parseFloat(total_amount);
      mainAccountEntry.credit_amount = 0;
      mainAccountEntry.closing_balance = mainAccountEntry.opening_balance + parseFloat(total_amount);
    } else {
      mainAccountEntry.debit_amount = 0;
      mainAccountEntry.credit_amount = parseFloat(total_amount);
      mainAccountEntry.closing_balance = mainAccountEntry.opening_balance - parseFloat(total_amount);
    }
  } else if (payment_type === 'PAY') {
    const isMainBankOrCash = bankCashCategoryIds.has(categoryMap[parseInt(account_id)]);
    if (isMainBankOrCash) {
      mainAccountEntry.debit_amount = 0;
      mainAccountEntry.credit_amount = parseFloat(total_amount);
      mainAccountEntry.closing_balance = mainAccountEntry.opening_balance - parseFloat(total_amount);
    } else {
      mainAccountEntry.debit_amount = parseFloat(total_amount);
      mainAccountEntry.credit_amount = 0;
      mainAccountEntry.closing_balance = mainAccountEntry.opening_balance + parseFloat(total_amount);
    }
  }

  ledgerEntries.push({
    ...mainAccountEntry,
    cash_payment: parseFloat(cash_amount),
    bank_payment: parseFloat(bank_amount),
  });

  balanceMap[parseInt(account_id)] = mainAccountEntry.closing_balance;

  if (cash_account_id && parseFloat(cash_amount) > 0) {
    let cashDebitAmount = 0;
    let cashCreditAmount = 0;
    let cashTrnxType = '';
    let cashClosingBalance = 0;

    if (mainAccountIsBankOrCash) {
      if (payment_type === 'RECEIVE') {
        cashDebitAmount = 0;
        cashCreditAmount = parseFloat(cash_amount);
        cashTrnxType = 'CREDIT';
        cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) - parseFloat(cash_amount);
      } else {
        cashDebitAmount = parseFloat(cash_amount);
        cashCreditAmount = 0;
        cashTrnxType = 'DEBIT';
        cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) + parseFloat(cash_amount);
      }
    } else if (payment_type === 'RECEIVE') {
      cashDebitAmount = parseFloat(cash_amount);
      cashCreditAmount = 0;
      cashTrnxType = 'DEBIT';
      cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) + parseFloat(cash_amount);
    } else {
      cashDebitAmount = 0;
      cashCreditAmount = parseFloat(cash_amount);
      cashTrnxType = 'CREDIT';
      cashClosingBalance = (balanceMap[parseInt(cash_account_id)] || 0) - parseFloat(cash_amount);
    }

    const cashAccountEntry = createLedgerEntry({
      cus_id: parseInt(cash_account_id),
      opening_balance: balanceMap[parseInt(cash_account_id)] || 0,
      debit_amount: cashDebitAmount,
      credit_amount: cashCreditAmount,
      bill_no: `PAY-${payment.payment_id}`,
      trnx_type: cashTrnxType,
      ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
      details:
        description ||
        (payment_type === 'RECEIVE'
          ? `payment received from customer account ${mainCustomerName}`
          : `payment made to customer account ${mainCustomerName}`),
      payments: parseFloat(cash_amount),
      updated_by: validatedCreatedBy,
    });
    cashAccountEntry.closing_balance = cashClosingBalance;

    ledgerEntries.push({
      ...cashAccountEntry,
      cash_payment: parseFloat(cash_amount),
      bank_payment: 0,
    });

    balanceMap[parseInt(cash_account_id)] = cashAccountEntry.closing_balance;
  }

  if (bank_account_id && parseFloat(bank_amount) > 0) {
    let bankDebitAmount = 0;
    let bankCreditAmount = 0;
    let bankTrnxType = '';
    let bankClosingBalance = 0;

    if (mainAccountIsBankOrCash) {
      if (payment_type === 'RECEIVE') {
        bankDebitAmount = 0;
        bankCreditAmount = parseFloat(bank_amount);
        bankTrnxType = 'CREDIT';
        bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) - parseFloat(bank_amount);
      } else {
        bankDebitAmount = parseFloat(bank_amount);
        bankCreditAmount = 0;
        bankTrnxType = 'DEBIT';
        bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) + parseFloat(bank_amount);
      }
    } else if (payment_type === 'RECEIVE') {
      bankDebitAmount = parseFloat(bank_amount);
      bankCreditAmount = 0;
      bankTrnxType = 'DEBIT';
      bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) + parseFloat(bank_amount);
    } else {
      bankDebitAmount = 0;
      bankCreditAmount = parseFloat(bank_amount);
      bankTrnxType = 'CREDIT';
      bankClosingBalance = (balanceMap[parseInt(bank_account_id)] || 0) - parseFloat(bank_amount);
    }

    const bankAccountEntry = createLedgerEntry({
      cus_id: parseInt(bank_account_id),
      opening_balance: balanceMap[parseInt(bank_account_id)] || 0,
      debit_amount: bankDebitAmount,
      credit_amount: bankCreditAmount,
      bill_no: `PAY-${payment.payment_id}`,
      trnx_type: bankTrnxType,
      ledger_type: payment_type === 'PAY' ? 'Payment' : 'Receiving',
      details:
        description ||
        (payment_type === 'RECEIVE'
          ? `payment received from customer account ${mainCustomerName}`
          : `payment made to customer account ${mainCustomerName}`),
      payments: parseFloat(bank_amount),
      updated_by: validatedCreatedBy,
    });
    bankAccountEntry.closing_balance = bankClosingBalance;

    ledgerEntries.push({
      ...bankAccountEntry,
      cash_payment: 0,
      bank_payment: parseFloat(bank_amount),
    });
  }

  const startLId = await getNextId('ledger', 'l_id', tx);
  const ledgerEntriesWithIds = ledgerEntries.map((entry, index) => ({
    l_id: startLId + index,
    ...entry,
  }));

  await tx.ledger.createMany({ data: ledgerEntriesWithIds });

  const balanceUpdates = [];
  const mainClosing = mainAccountEntry.closing_balance;
  balanceUpdates.push(
    tx.customer.update({
      where: { cus_id: parseInt(account_id) },
      data: { cus_balance: mainClosing },
    })
  );

  if (cash_account_id && parseFloat(cash_amount) > 0) {
    const cashEntry = ledgerEntries.find((e) => e.cus_id === parseInt(cash_account_id));
    if (cashEntry) {
      balanceUpdates.push(
        tx.customer.update({
          where: { cus_id: parseInt(cash_account_id) },
          data: { cus_balance: cashEntry.closing_balance },
        })
      );
    }
  }

  if (bank_account_id && parseFloat(bank_amount) > 0) {
    const bankEntry = ledgerEntries.find((e) => e.cus_id === parseInt(bank_account_id));
    if (bankEntry) {
      balanceUpdates.push(
        tx.customer.update({
          where: { cus_id: parseInt(bank_account_id) },
          data: { cus_balance: bankEntry.closing_balance },
        })
      );
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

  return {
    mainAccountEntry,
    createdLedgerEntries,
    updated_balances,
  };
}
