/** Plain-language employee ledger balance for HR UI (clearance, receive, register). */

export function defaultHrFmtAmt(v) {
  const n = parseFloat(v || 0);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function describeEmployeeLedgerBalance(signed, fmtAmt = defaultHrFmtAmt) {
  const n = parseFloat(signed || 0);
  if (n > 0.009) {
    return {
      headline: 'Employee owes company',
      sub: 'Advance / account balance — recovered from salary when possible',
      amount: n,
      amountText: fmtAmt(n),
      chip: 'Deduct from salary',
      bg: '#fef2f2',
      border: '#fecaca',
      color: '#b91c1c',
      deductLine: true,
      addLine: false,
    };
  }
  if (n < -0.009) {
    const amt = Math.abs(n);
    return {
      headline: 'Company owes employee',
      sub: 'Paid with this salary clearance',
      amount: amt,
      amountText: fmtAmt(amt),
      chip: 'Add to payment',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      color: '#15803d',
      deductLine: false,
      addLine: true,
    };
  }
  return {
    headline: 'No old balance',
    sub: 'Nothing to adjust from past advances',
    amount: 0,
    amountText: fmtAmt(0),
    chip: 'No adjustment',
    bg: '#f8fafc',
    border: '#e2e8f0',
    color: '#64748b',
    deductLine: false,
    addLine: false,
  };
}
