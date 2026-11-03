'use client';

/**
 * Re-exports A5 employee receive receipt (print + PDF).
 * Implementation: dashboard/hr/lib/employee-receive-receipt-a5.js
 */

export {
  buildEmployeeReceiptPrintHtml,
  buildEmployeeReceiveReceiptPrintHtml,
  buildEmployeeReceiveReceiptBody,
} from '@/app/dashboard/hr/lib/employee-receive-receipt-a5';

export {
  downloadEmployeeReceiveReceiptPdf as downloadEmployeeReceiptPdf,
  printEmployeeReceiveReceipt,
  shareEmployeeReceiveReceiptWhatsApp,
} from '@/app/dashboard/hr/lib/employee-receive-receipt-actions';
