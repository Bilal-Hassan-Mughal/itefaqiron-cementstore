'use client';

import EmployeeSalaryMonthBreakdown from './EmployeeSalaryMonthBreakdown';

/** Pay dialog — same full month breakdown as the list detail panel. */
export default function SalaryClearanceSummaryCard({
  clearancePreview,
  clearForm,
  fmtAmt,
  employeeName,
  periodLabel,
  payroll,
  month,
  year,
}) {
  return (
    <EmployeeSalaryMonthBreakdown
      payroll={payroll}
      preview={clearancePreview}
      clearForm={clearForm}
      month={month}
      year={year}
      fmtAmt={fmtAmt}
      periodLabel={periodLabel}
      compact
    />
  );
}
