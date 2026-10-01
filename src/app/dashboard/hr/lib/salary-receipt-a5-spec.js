/**
 * Official salary payment receipt — A5 portrait (148 × 210 mm).
 * Used by Salary Clearance (auto-open after pay) and Salary Receipt module.
 *
 * Render: `SalaryTab.js` → buildPayslipBody / buildPayslipHtml
 * Styles: `lib/salary-receipt-a5-styles.js`
 */

export const SALARY_RECEIPT_A5 = {
  widthMm: 148,
  heightMm: 210,
  width: '148mm',
  height: '210mm',
  padding: '4mm 5mm 4mm 5mm',
  orientation: 'portrait',
};

/** @page rule for browser print & PDF capture */
export const SALARY_RECEIPT_A5_PRINT_CSS = `
  @page { size: ${SALARY_RECEIPT_A5.width} ${SALARY_RECEIPT_A5.height}; margin: 0; }
`;

export const SALARY_RECEIPT_FEATURES = {
  language: 'en',
  format: 'A5 portrait',
  includes: [
    'Company header with logo',
    'Receipt no, payment date, salary month, PAID status',
    'Employee details',
    'Salary breakdown (basic, attendance, deductions, net)',
    'Employee account before/after clearance',
    'Cash / bank / split payment lines',
    'Total paid highlight',
    'Employee & authorized signature lines',
  ],
  outputs: ['Print A5', 'Download PDF', 'WhatsApp image'],
};
