import { COMPANY } from '@/lib/brand-theme';
import { SALARY_RECEIPT_A5, SALARY_RECEIPT_A5_PRINT_CSS } from './salary-receipt-a5-spec';

const PAGE = {
  w: SALARY_RECEIPT_A5.width,
  pad: SALARY_RECEIPT_A5.padding,
  /** Fixed px width for html2canvas / WhatsApp (148mm @ 96dpi) */
  wPx: 560,
};

/** Teal — employee payment received (distinct from advance orange) */
export const EMP_RECEIVE_ACCENT = '#0d9488';

export const EMP_RECEIVE_RECEIPT_PREVIEW_ID = 'emp-receive-receipt-preview';
export const EMP_RECEIVE_RECEIPT_CAPTURE_ID = 'emp-receive-receipt-capture';
export const EMP_RECEIVE_RECEIPT_PRINT_MOUNT_ID = 'printable-emp-receive-receipt';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fmtAmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function paymentModeLabel(receipt) {
  if (receipt?.payment_method_label) return receipt.payment_method_label;
  const mode = String(receipt?.payment_mode || 'CASH').toUpperCase();
  if (mode === 'BANK_TRANSFER' || mode === 'BANK') return 'Bank transfer';
  return 'Cash';
}

export const EMP_RECEIVE_RECEIPT_BODY_STYLES = `
  .emp-rcv-sheet {
    width: ${PAGE.w};
    max-width: ${PAGE.w};
    min-width: ${PAGE.w};
    margin: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    page-break-inside: avoid;
  }
  .emp-rcv-root * { box-sizing: border-box; }
  .emp-rcv-root {
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    padding: ${PAGE.pad};
    color: #0f172a;
    font-size: 8pt;
    line-height: 1.35;
  }
  .emp-rcv-header {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-bottom: 2px solid ${EMP_RECEIVE_ACCENT};
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .emp-rcv-header .emp-rcv-co { display: table-cell; vertical-align: top; width: 62%; padding-right: 8px; }
  .emp-rcv-header .emp-rcv-badge { display: table-cell; vertical-align: top; width: 38%; text-align: right; }
  .emp-rcv-co h1 { font-size: 11pt; font-weight: 900; margin: 0; color: #0f172a; }
  .emp-rcv-co .ur { font-size: 10pt; font-weight: 800; direction: rtl; color: #334155; margin-top: 2px; }
  .emp-rcv-co .sub { font-size: 6.5pt; color: #64748b; margin-top: 4px; line-height: 1.3; }
  .emp-rcv-badge .title { font-size: 9pt; font-weight: 900; color: ${EMP_RECEIVE_ACCENT}; text-transform: uppercase; letter-spacing: 0.06em; }
  .emp-rcv-badge .sub { font-size: 7pt; font-weight: 700; color: #475569; margin-top: 2px; }
  .emp-rcv-meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .emp-rcv-meta-table td.meta-cell {
    width: 50%;
    vertical-align: top;
    padding: 6px 10px 12px 0;
    font-size: 7.5pt;
  }
  .emp-rcv-meta-table td.meta-cell:nth-child(2) { padding: 6px 0 12px 10px; }
  .emp-rcv-meta-stack {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .emp-rcv-meta-stack td {
    padding: 0;
    border: none;
    vertical-align: top;
  }
  .emp-rcv-meta-stack .meta-lbl {
    color: #64748b;
    font-weight: 700;
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1.35;
    padding: 0 0 6px 0;
  }
  .emp-rcv-meta-stack .meta-val {
    font-weight: 800;
    color: #0f172a;
    line-height: 1.45;
    padding: 0;
    word-break: break-word;
  }
  .emp-rcv-meta-stack .meta-val-pay {
    color: #0f766e;
    font-size: 8pt;
  }
  .emp-rcv-sec { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 8px 0 4px; }
  .emp-rcv-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
  .emp-rcv-table td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 7.5pt; vertical-align: middle; }
  .emp-rcv-table td.lbl { width: 38%; color: #64748b; font-weight: 700; background: #f8fafc; }
  .emp-rcv-table td.val { font-weight: 800; text-align: right; word-break: break-word; }
  .emp-rcv-pay-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
  .emp-rcv-pay-table th {
    background: #ecfdf5;
    color: ${EMP_RECEIVE_ACCENT};
    font-size: 6.5pt;
    font-weight: 800;
    padding: 4px 6px;
    border: 1px solid #99f6e4;
    text-transform: uppercase;
  }
  .emp-rcv-pay-table th:nth-child(1), .emp-rcv-pay-table td:nth-child(1) { width: 22%; }
  .emp-rcv-pay-table th:nth-child(2), .emp-rcv-pay-table td:nth-child(2) { width: 53%; }
  .emp-rcv-pay-table th:nth-child(3), .emp-rcv-pay-table td:nth-child(3) { width: 25%; }
  .emp-rcv-pay-table td { border: 1px solid #e2e8f0; padding: 5px 6px; font-size: 7.5pt; font-weight: 700; vertical-align: middle; word-break: break-word; }
  .emp-rcv-pay-table td.amt { text-align: right; font-weight: 900; color: #0f766e; }
  .emp-rcv-total {
    text-align: center;
    margin: 12px 0;
    padding: 10px;
    border: 2px solid ${EMP_RECEIVE_ACCENT};
    border-radius: 8px;
    background: #f0fdfa;
  }
  .emp-rcv-total .lbl { font-size: 7pt; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em; }
  .emp-rcv-total .amt { font-size: 16pt; font-weight: 900; color: ${EMP_RECEIVE_ACCENT}; margin-top: 4px; }
  .emp-rcv-note {
    font-size: 7pt;
    color: #475569;
    margin-bottom: 10px;
    padding: 6px 8px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
  .emp-rcv-bal-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 6px 0;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .emp-rcv-bal-table td.cell {
    width: 33.33%;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #ccfbf1;
    border-radius: 6px;
    background: #f0fdfa;
    vertical-align: middle;
  }
  .emp-rcv-bal .lbl { font-size: 6pt; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; }
  .emp-rcv-bal .val { font-size: 8.5pt; font-weight: 900; color: #0f172a; margin-top: 2px; display: block; }
  .emp-rcv-bal .cell.mid .val { color: ${EMP_RECEIVE_ACCENT}; }
  .emp-rcv-sheet.emp-rcv-wa-capture,
  .emp-rcv-sheet.emp-rcv-capture-ready {
    width: ${PAGE.wPx}px !important;
    min-width: ${PAGE.wPx}px !important;
    max-width: ${PAGE.wPx}px !important;
  }
  .emp-rcv-sig { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 7pt; }
  .emp-rcv-sig td { width: 50%; border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-weight: 700; color: #475569; vertical-align: top; }
  .emp-rcv-sig td:first-child { padding-right: 8px; }
  .emp-rcv-sig td:last-child { padding-left: 8px; }
  .emp-rcv-foot { margin-top: 10px; font-size: 6pt; color: #94a3b8; text-align: center; }
`;

function metaField(label, valueHtml, { payMode = false } = {}) {
  const valClass = payMode ? 'meta-val meta-val-pay' : 'meta-val';
  return `<td class="meta-cell"><table class="emp-rcv-meta-stack" role="presentation"><tr>
    <td class="meta-lbl">${escapeHtml(label)}</td></tr><tr>
    <td class="${valClass}">${valueHtml}</td></tr></table></td>`;
}

export const EMP_RECEIVE_RECEIPT_PRINT_STYLES = `
  ${SALARY_RECEIPT_A5_PRINT_CSS}
  @media print {
    html, body { margin: 0; padding: 0; background: #fff; }
    .emp-rcv-sheet {
      box-shadow: none !important;
      border: none !important;
      width: ${PAGE.w} !important;
    }
  }
`;

export function getEmployeeReceiveReceiptStylesheet() {
  return `${EMP_RECEIVE_RECEIPT_BODY_STYLES}${EMP_RECEIVE_RECEIPT_PRINT_STYLES}`;
}

export function employeeReceiveReceiptFileName(receipt) {
  const id = receipt?.receipt_id ?? 'receipt';
  const name = (receipt?.employee?.emp_name || 'employee').replace(/[^\w\-]+/g, '-');
  return `Employee-Receive-${id}-${name}.pdf`;
}

/**
 * @param {object} receipt — employee_receipts row + employee, account, optional balance_before/after
 */
export function buildEmployeeReceiveReceiptBody(receipt) {
  if (!receipt) return '';

  const emp = receipt.employee || {};
  const billNo = receipt.ledger_bill_no || `EMP-RCV-${receipt.receipt_id || ''}`;
  const dateStr = receipt.receipt_date
    ? new Date(receipt.receipt_date).toLocaleDateString('en-GB')
    : '—';
  const printed = new Date().toLocaleString('en-GB');
  const amount = parseFloat(receipt.amount || 0);
  const mode = paymentModeLabel(receipt);
  const accountName = receipt.account?.cus_name || receipt.account_name || '—';
  const ref = receipt.reference || '—';
  const notes = receipt.notes || '';

  const hasBal =
    receipt.balance_before != null &&
    receipt.balance_after != null &&
    !Number.isNaN(parseFloat(receipt.balance_before));

  const balBlock = hasBal
    ? `<table class="emp-rcv-bal-table emp-rcv-bal" role="presentation"><tr>
        <td class="cell"><span class="lbl">Ledger before</span><span class="val">${fmtAmt(receipt.balance_before)}</span></td>
        <td class="cell mid"><span class="lbl">Received</span><span class="val">${fmtAmt(amount)}</span></td>
        <td class="cell"><span class="lbl">Ledger after</span><span class="val">${fmtAmt(receipt.balance_after)}</span></td>
      </tr></table>`
    : '';

  return `
<div class="emp-rcv-sheet" id="${EMP_RECEIVE_RECEIPT_CAPTURE_ID}">
  <div class="emp-rcv-root">
    <div class="emp-rcv-header">
      <div class="emp-rcv-co">
        <h1>${escapeHtml(COMPANY.name)}</h1>
        <div class="ur">${escapeHtml(COMPANY.nameUr || '')}</div>
        <div class="sub">${escapeHtml(COMPANY.address || '')}<br/>Ph: ${escapeHtml((COMPANY.phones || []).join(', '))}</div>
      </div>
      <div class="emp-rcv-badge">
        <div class="title">Payment Receipt</div>
        <div class="sub">Received from employee · A5</div>
      </div>
    </div>

    <table class="emp-rcv-meta-table emp-rcv-meta" role="presentation">
      <tr>
        ${metaField('Receipt no.', escapeHtml(billNo))}
        ${metaField('Receipt date', escapeHtml(dateStr))}
      </tr>
      <tr>
        ${metaField('Payment method', escapeHtml(mode), { payMode: true })}
        ${metaField('Document', 'Employee recovery')}
      </tr>
    </table>

    <div class="emp-rcv-sec">Employee</div>
    <table class="emp-rcv-table">
      <tr><td class="lbl">Name</td><td class="val">${escapeHtml(emp.emp_name || receipt.emp_name || '—')}</td></tr>
      <tr><td class="lbl">Designation</td><td class="val">${escapeHtml(emp.designation || '—')}</td></tr>
    </table>

    <div class="emp-rcv-sec">Received into (cash / bank)</div>
    <table class="emp-rcv-pay-table">
      <thead><tr><th>Mode</th><th>Account</th><th style="text-align:right">Amount (Rs)</th></tr></thead>
      <tbody>
        <tr>
          <td>${escapeHtml(mode)}</td>
          <td>${escapeHtml(accountName)}</td>
          <td class="amt">${fmtAmt(amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="emp-rcv-total">
      <div class="lbl">Total received from employee</div>
      <div class="amt">Rs ${fmtAmt(amount)}</div>
    </div>

    ${balBlock}

    <table class="emp-rcv-table">
      <tr><td class="lbl">Reference</td><td class="val">${escapeHtml(ref)}</td></tr>
    </table>

    ${notes ? `<div class="emp-rcv-note"><strong>Note:</strong> ${escapeHtml(notes)}</div>` : ''}

    <p style="font-size:6.5pt;color:#64748b;margin-bottom:8px;line-height:1.4">
      This receipt confirms payment received from the employee and credited to their staff ledger.
      Amount is deposited into the selected cash or bank account above.
    </p>

    <table class="emp-rcv-sig" role="presentation"><tr>
      <td>Employee signature</td>
      <td>Received by (authorized)</td>
    </tr></table>
    <div class="emp-rcv-foot">Printed ${escapeHtml(printed)} · ${escapeHtml(COMPANY.name)}</div>
  </div>
</div>`;
}

export function buildEmployeeReceiveReceiptPrintHtml(receipt, { autoPrint = true } = {}) {
  const title = `Employee Receipt ${receipt?.ledger_bill_no || receipt?.receipt_id || ''}`;
  const printScript = autoPrint
    ? '<script>window.onload=function(){window.print();}</script>'
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>${getEmployeeReceiveReceiptStylesheet()}</style></head><body>
${buildEmployeeReceiveReceiptBody(receipt)}
${printScript}
</body></html>`;
}

/** @deprecated use buildEmployeeReceiveReceiptPrintHtml — kept for imports from @/lib/employee-receipt-pdf */
export function buildEmployeeReceiptPrintHtml(receipt) {
  return buildEmployeeReceiveReceiptPrintHtml(receipt);
}
