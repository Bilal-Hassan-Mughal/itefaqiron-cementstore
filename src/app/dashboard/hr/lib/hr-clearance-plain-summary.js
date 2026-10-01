/** Plain-language salary clearance summary for non-technical users. */

export function plainAccountHeadline(signed, fmtAmt) {
  const n = parseFloat(signed || 0);
  if (n > 0.009) {
    return { title: 'Employee owes you', amount: fmtAmt(n), tone: 'owe' };
  }
  if (n < -0.009) {
    return { title: 'You owe employee', amount: fmtAmt(Math.abs(n)), tone: 'payable' };
  }
  return { title: 'No old balance', amount: '—', tone: 'clear' };
}

/**
 * Only lines worth showing — no formulas, no ledger jargon.
 */
export function buildPlainClearanceLines(clearancePreview, clearForm) {
  if (!clearancePreview) return [];
  const lines = [];
  const net = parseFloat(clearancePreview.derived?.net_salary ?? 0);
  const recovery = parseFloat(
    clearancePreview.advanceAppliedThisMonth
    ?? clearancePreview.recoveryDeduction
    ?? clearancePreview.ledgerOwed
    ?? 0
  );
  const prev = parseFloat(clearancePreview.prevBal ?? 0);
  const companyOwes = parseFloat(clearancePreview.ledgerPayableCredit ?? 0);
  const bonus = parseFloat(clearForm?.bonus || 0);
  const extraDed = parseFloat(clearForm?.extra_deduction || 0);
  const advWith = parseFloat(clearancePreview.advanceWithSalary ?? clearForm?.advance_with_salary ?? 0);

  lines.push({ id: 'month', label: 'This month\'s salary', amount: net, kind: 'base' });

  if (bonus > 0.009) {
    lines.push({ id: 'bonus', label: 'Bonus', amount: bonus, kind: 'add' });
  }
  if (extraDed > 0.009) {
    lines.push({ id: 'extra', label: 'Extra cut', amount: extraDed, kind: 'sub' });
  }
  if (recovery > 0.009) {
    lines.push({ id: 'recovery', label: 'Old advance / balance', amount: recovery, kind: 'sub' });
  }
  if (companyOwes > 0.009) {
    lines.push({ id: 'company', label: 'You already owed them', amount: companyOwes, kind: 'add' });
  }
  if (prev > 0.009) {
    lines.push({ id: 'prev', label: 'Last month not paid yet', amount: prev, kind: 'add' });
  }
  if (advWith > 0.009) {
    lines.push({ id: 'advw', label: 'Extra advance with this pay', amount: advWith, kind: 'add' });
  }

  return lines;
}

export function plainAfterPaymentText(beforeSigned, afterSigned, recoveryAmt, fmtAmt) {
  const before = parseFloat(beforeSigned || 0);
  const after = parseFloat(afterSigned ?? beforeSigned ?? 0);
  if (Math.abs(after) < 0.009) {
    return 'After this payment, old balance will be cleared.';
  }
  if (after > 0.009) {
    return `After payment, employee will still owe you ${fmtAmt(after)}.`;
  }
  return `After payment, you will still owe employee ${fmtAmt(Math.abs(after))}.`;
}
