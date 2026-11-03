import { COMPANY } from '@/lib/brand-theme';
import { SALARY_RECEIPT_A5, SALARY_RECEIPT_A5_PRINT_CSS } from './salary-receipt-a5-spec';

const PAGE = {
  w: SALARY_RECEIPT_A5.width,
  pad: SALARY_RECEIPT_A5.padding,
};

const ADVANCE_ACCENT = '#b45309';

export const ADVANCE_VOUCHER_PREVIEW_ID = 'advance-voucher-preview';
/** Same flow as sales `receipt-preview` — target for whatsapp-local capture + clipboard. */
export const ADVANCE_VOUCHER_CAPTURE_ID = 'advance-voucher-capture';
export const ADVANCE_VOUCHER_PRINT_MOUNT_ID = 'printable-advance-voucher';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fmtAmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const ADVANCE_VOUCHER_BODY_STYLES = `
  .advance-voucher-sheet {
    width: ${PAGE.w};
    max-width: ${PAGE.w};
    min-width: ${PAGE.w};
    margin: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    page-break-inside: avoid;
  }
  .advance-voucher-root * { box-sizing: border-box; }
  .advance-voucher-root {
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    padding: ${PAGE.pad};
    color: #0f172a;
    font-size: 8pt;
    line-height: 1.35;
  }
  .adv-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 2px solid ${ADVANCE_ACCENT};
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .adv-co h1 { font-size: 11pt; font-weight: 900; margin: 0; color: #0f172a; }
  .adv-co .ur { font-size: 10pt; font-weight: 800; direction: rtl; color: #334155; margin-top: 2px; }
  .adv-co .sub { font-size: 6.5pt; color: #64748b; margin-top: 4px; line-height: 1.3; }
  .adv-badge { text-align: right; flex-shrink: 0; }
  .adv-badge .title { font-size: 9pt; font-weight: 900; color: ${ADVANCE_ACCENT}; text-transform: uppercase; letter-spacing: 0.06em; }
  .adv-badge .sub { font-size: 7pt; font-weight: 700; color: #475569; margin-top: 2px; }
  .adv-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
    margin-bottom: 10px;
    font-size: 7.5pt;
  }
  .adv-meta .lbl { color: #64748b; font-weight: 700; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .adv-meta .val { font-weight: 800; color: #0f172a; }
  .adv-sec { font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 8px 0 4px; }
  .adv-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .adv-table td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 7.5pt; }
  .adv-table td.lbl { width: 38%; color: #64748b; font-weight: 700; background: #f8fafc; }
  .adv-table td.val { font-weight: 800; text-align: right; }
  .adv-pay-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .adv-pay-table th {
    background: #fff7ed;
    color: ${ADVANCE_ACCENT};
    font-size: 6.5pt;
    font-weight: 800;
    padding: 4px 6px;
    border: 1px solid #fed7aa;
    text-transform: uppercase;
  }
  .adv-pay-table td { border: 1px solid #e2e8f0; padding: 5px 6px; font-size: 7.5pt; font-weight: 700; }
  .adv-pay-table td.amt { text-align: right; font-weight: 900; }
  .adv-total {
    text-align: center;
    margin: 12px 0;
    padding: 10px;
    border: 2px solid ${ADVANCE_ACCENT};
    border-radius: 8px;
    background: #fff7ed;
  }
  .adv-total .lbl { font-size: 7pt; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.08em; }
  .adv-total .amt { font-size: 16pt; font-weight: 900; color: ${ADVANCE_ACCENT}; margin-top: 4px; }
  .adv-reason { font-size: 7pt; color: #475569; margin-bottom: 10px; padding: 6px 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .adv-sig { display: flex; gap: 16px; margin-top: 18px; font-size: 7pt; }
  .adv-sig div { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; font-weight: 700; color: #475569; }
  .adv-foot { margin-top: 10px; font-size: 6pt; color: #94a3b8; text-align: center; }
  .adv-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 6.5pt;
    font-weight: 800;
    background: #fef3c7;
    color: #b45309;
  }
`;

export const ADVANCE_VOUCHER_PRINT_STYLES = `
  ${SALARY_RECEIPT_A5_PRINT_CSS}
  @media print {
    html, body { margin: 0; padding: 0; background: #fff; }
    .advance-voucher-sheet {
      box-shadow: none !important;
      border: none !important;
      width: ${PAGE.w} !important;
    }
  }
`;

export function getAdvanceVoucherStylesheet() {
  return `${ADVANCE_VOUCHER_BODY_STYLES}${ADVANCE_VOUCHER_PRINT_STYLES}`;
}

export function advanceVoucherFileName(advance) {
  const id = advance?.advance_id ?? 'advance';
  const name = (advance?.employee?.emp_name || 'employee').replace(/[^\w\-]+/g, '-');
  return `Advance-Voucher-${id}-${name}.pdf`;
}

/**
 * @param {object} advance — enriched (payment_lines, payment_method_label, ledger_bill_no, …)
 */
export function buildAdvanceVoucherBody(advance) {
  if (!advance) return '';

  const emp = advance.employee || {};
  const billNo = advance.ledger_bill_no || `ADV-${advance.advance_id || ''}`;
  const dateStr = advance.advance_date
    ? new Date(advance.advance_date).toLocaleDateString('en-GB')
    : '—';
  const printed = new Date().toLocaleString('en-GB');
  const amount = parseFloat(advance.amount || 0);
  const status = advance.status || 'PENDING';
  const reason = (advance.reason || '').startsWith('__CLR_ADV__')
    ? 'With salary clearance'
    : (advance.reason || '—');
  const ref = advance.payment_reference || advance.reference_from_ledger || '—';
  const lines = Array.isArray(advance.payment_lines) && advance.payment_lines.length
    ? advance.payment_lines
    : [{
      accountName: advance.paid_from_label || 'Cash / Bank account',
      amount,
      mode: advance.payment_method_label || 'Cash',
    }];

  const payRows = lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.mode || '—')}</td>
        <td>${escapeHtml(line.accountName || '—')}</td>
        <td class="amt">${fmtAmt(line.amount)}</td>
      </tr>`
    )
    .join('');

  const phone = emp.emp_phone || emp.phone || '—';
  const ledgerBal = advance.employee_ledger_balance_after != null
    ? fmtAmt(advance.employee_ledger_balance_after)
    : (emp.ledger_balance != null ? fmtAmt(emp.ledger_balance) : '—');

  return `
<div class="advance-voucher-sheet" id="${ADVANCE_VOUCHER_CAPTURE_ID}">
  <div class="advance-voucher-root">
    <div class="adv-header">
      <div class="adv-co">
        <h1>${escapeHtml(COMPANY.name)}</h1>
        <div class="ur">${escapeHtml(COMPANY.nameUr || '')}</div>
        <div class="sub">${escapeHtml(COMPANY.address || '')}<br/>Ph: ${escapeHtml((COMPANY.phones || []).join(', '))}</div>
      </div>
      <div class="adv-badge">
        <div class="title">Advance Payment Voucher</div>
        <div class="sub">Salary advance · A5</div>
      </div>
    </div>

    <div class="adv-meta">
      <div><div class="lbl">Voucher no.</div><div class="val">${escapeHtml(billNo)}</div></div>
      <div><div class="lbl">Advance date</div><div class="val">${escapeHtml(dateStr)}</div></div>
      <div><div class="lbl">Payment method</div><div class="val">${escapeHtml(advance.payment_method_label || 'Cash')}</div></div>
      <div><div class="lbl">Status</div><div class="val"><span class="adv-status">${escapeHtml(status)}</span></div></div>
    </div>

    <div class="adv-sec">Employee</div>
    <table class="adv-table">
      <tr><td class="lbl">Name</td><td class="val">${escapeHtml(emp.emp_name || '—')}</td></tr>
      <tr><td class="lbl">Designation</td><td class="val">${escapeHtml(emp.designation || '—')}</td></tr>
      <tr><td class="lbl">Department</td><td class="val">${escapeHtml(emp.department || '—')}</td></tr>
      <tr><td class="lbl">Phone</td><td class="val">${escapeHtml(phone)}</td></tr>
      <tr><td class="lbl">Basic salary</td><td class="val">${fmtAmt(emp.basic_salary)}</td></tr>
      <tr><td class="lbl">Advance balance (ledger)</td><td class="val">${ledgerBal}</td></tr>
    </table>

    <div class="adv-sec">Paid from (cash / bank)</div>
    <table class="adv-pay-table">
      <thead><tr><th>Mode</th><th>Account</th><th style="text-align:right">Amount (Rs)</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>

    <div class="adv-total">
      <div class="lbl">Total advance paid</div>
      <div class="amt">Rs ${fmtAmt(amount)}</div>
    </div>

    <div class="adv-reason"><strong>Reason:</strong> ${escapeHtml(reason)}</div>
    <table class="adv-table">
      <tr><td class="lbl">Reference</td><td class="val">${escapeHtml(ref)}</td></tr>
    </table>

    <div class="adv-sig">
      <div>Employee signature</div>
      <div>Authorized signature</div>
    </div>
    <div class="adv-foot">Printed ${escapeHtml(printed)} · ${escapeHtml(COMPANY.name)}</div>
  </div>
</div>`;
}

export function buildAdvanceVoucherPrintHtml(advance) {
  const title = `Advance Voucher ${advance?.ledger_bill_no || advance?.advance_id || ''}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>${getAdvanceVoucherStylesheet()}</style></head><body>
${buildAdvanceVoucherBody(advance)}
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}
