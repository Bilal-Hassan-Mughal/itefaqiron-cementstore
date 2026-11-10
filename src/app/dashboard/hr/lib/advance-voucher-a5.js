import { COMPANY } from '@/lib/brand-theme';
import { SALARY_RECEIPT_A5, SALARY_RECEIPT_A5_PRINT_CSS } from './salary-receipt-a5-spec';

const PAGE = {
  w: SALARY_RECEIPT_A5.width,
  h: SALARY_RECEIPT_A5.height,
  pad: SALARY_RECEIPT_A5.padding,
  /** Fixed px width for html2canvas / WhatsApp (148mm @ 96dpi) */
  wPx: 560,
};

const ADVANCE_ACCENT = '#b45309';
const ADVANCE_ACCENT_DARK = '#92400e';

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

const ADV_DETAIL_COLGROUP = `<colgroup>
  <col class="adv-col-lbl" span="1" /><col class="adv-col-val" span="1" />
  <col class="adv-col-lbl" span="1" /><col class="adv-col-val" span="1" />
  <col class="adv-col-lbl" span="1" /><col class="adv-col-val" span="1" />
  <col class="adv-col-lbl" span="1" /><col class="adv-col-val" span="1" />
</colgroup>`;

function advSectionRow(title) {
  return `<tr class="adv-sec-in"><td colspan="8">${escapeHtml(title)}</td></tr>`;
}

/** Two fields on one row — spans full table width (8 logical columns). */
function advDetailPairRow(label1, value1Html, label2, value2Html, { val1Class = '', val2Class = '' } = {}) {
  return `<tr class="adv-pair-line">
    <td class="lbl">${escapeHtml(label1)}</td>
    <td class="val ${val1Class}" colspan="3">${value1Html}</td>
    <td class="lbl">${escapeHtml(label2)}</td>
    <td class="val ${val2Class}" colspan="3">${value2Html}</td>
  </tr>`;
}

/** Voucher no., date, payment, status — all on one row (4 label + 4 value cells). */
function advVoucherOneLineRow(pairs) {
  return `<tr class="adv-voucher-line">${pairs
    .map(
      (p) =>
        `<td class="lbl">${escapeHtml(p.label)}</td><td class="val ${p.valClass || ''}">${p.valueHtml}</td>`
    )
    .join('')}</tr>`;
}

export const ADVANCE_VOUCHER_BODY_STYLES = `
  .advance-voucher-sheet {
    width: ${PAGE.w};
    max-width: ${PAGE.w};
    min-width: ${PAGE.w};
    min-height: ${PAGE.h};
    margin: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    page-break-inside: avoid;
  }
  .advance-voucher-sheet.adv-wa-capture,
  .advance-voucher-sheet.adv-capture-ready {
    width: ${PAGE.wPx}px !important;
    min-width: ${PAGE.wPx}px !important;
    max-width: ${PAGE.wPx}px !important;
  }
  .advance-voucher-root * { box-sizing: border-box; }
  .advance-voucher-root {
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    padding: ${PAGE.pad};
    color: #0f172a;
    font-size: 8pt;
    line-height: 1.35;
    min-height: ${PAGE.h};
    display: flex;
    flex-direction: column;
  }
  .adv-header {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-bottom: 2px solid ${ADVANCE_ACCENT};
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .adv-header .adv-co { display: table-cell; vertical-align: top; width: 58%; padding-right: 8px; }
  .adv-header .adv-badge { display: table-cell; vertical-align: top; width: 42%; text-align: right; }
  .adv-co h1 { font-size: 11pt; font-weight: 900; margin: 0; color: #0f172a; line-height: 1.2; }
  .adv-co .ur { font-size: 10pt; font-weight: 800; direction: rtl; color: #334155; margin-top: 2px; }
  .adv-co .sub { font-size: 6.5pt; color: #64748b; margin-top: 4px; line-height: 1.35; }
  .adv-badge .title { font-size: 8.5pt; font-weight: 900; color: ${ADVANCE_ACCENT}; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.25; }
  .adv-badge .sub { font-size: 7pt; font-weight: 700; color: #475569; margin-top: 3px; }
  .adv-detail-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    table-layout: fixed;
    border: 1px solid #e2e8f0;
  }
  .adv-detail-table td {
    border: 1px solid #e2e8f0;
    padding: 5px 8px;
    font-size: 7.5pt;
    vertical-align: middle;
    word-break: break-word;
  }
  .adv-detail-table .adv-col-lbl { width: 11%; }
  .adv-detail-table .adv-col-val { width: 14%; }
  .adv-detail-table td.lbl {
    background: #f8fafc;
    color: #64748b;
    font-weight: 700;
    font-size: 7pt;
    text-align: left;
  }
  .adv-detail-table td.val {
    font-weight: 800;
    color: #0f172a;
    text-align: left;
  }
  .adv-detail-table tr.adv-pair-line td.lbl { font-size: 7pt; }
  .adv-detail-table tr.adv-pair-line td.val { font-size: 7.5pt; }
  .adv-detail-table td.val.val-adv { color: ${ADVANCE_ACCENT_DARK}; }
  .adv-detail-table td.val.txt { font-weight: 700; line-height: 1.35; }
  .adv-detail-table tr.adv-sec-in td {
    background: #fff7ed;
    color: ${ADVANCE_ACCENT_DARK};
    font-size: 6.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 4px 8px;
    border-color: #fed7aa;
  }
  .adv-detail-table tr.adv-voucher-line td.lbl {
    font-size: 6pt;
    padding: 4px 5px;
    line-height: 1.25;
  }
  .adv-detail-table tr.adv-voucher-line td.val {
    font-size: 7pt;
    padding: 4px 5px;
    line-height: 1.25;
  }
  .adv-detail-table tr.adv-voucher-line td.val .adv-status {
    white-space: nowrap;
    font-size: 6pt;
    padding: 1px 6px;
  }
  .adv-sec {
    font-size: 6.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin: 7px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #f1f5f9;
  }
  .adv-bal-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 5px 0;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .adv-bal-table td.cell {
    width: 33.33%;
    text-align: center;
    padding: 7px 4px;
    border: 1px solid #fed7aa;
    border-radius: 6px;
    background: #fff7ed;
    vertical-align: middle;
  }
  .adv-bal .lbl {
    font-size: 6pt;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    display: block;
    letter-spacing: 0.04em;
    line-height: 1.3;
  }
  .adv-bal .val {
    font-size: 9pt;
    font-weight: 900;
    color: #0f172a;
    margin-top: 3px;
    display: block;
    font-variant-numeric: tabular-nums;
  }
  .adv-bal .cell.mid .val { color: ${ADVANCE_ACCENT}; }
  .adv-pay-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    table-layout: fixed;
  }
  .adv-pay-table th {
    background: #fff7ed;
    color: ${ADVANCE_ACCENT};
    font-size: 6.5pt;
    font-weight: 800;
    padding: 4px 6px;
    border: 1px solid #fed7aa;
    text-transform: uppercase;
    text-align: left;
  }
  .adv-pay-table th.amt-h { text-align: right; }
  .adv-pay-table th:nth-child(1), .adv-pay-table td:nth-child(1) { width: 24%; }
  .adv-pay-table th:nth-child(2), .adv-pay-table td:nth-child(2) { width: 76%; }
  .adv-pay-table.adv-pay-split th:nth-child(1), .adv-pay-table.adv-pay-split td:nth-child(1) { width: 22%; }
  .adv-pay-table.adv-pay-split th:nth-child(2), .adv-pay-table.adv-pay-split td:nth-child(2) { width: 48%; }
  .adv-pay-table.adv-pay-split th:nth-child(3), .adv-pay-table.adv-pay-split td:nth-child(3) { width: 30%; }
  .adv-pay-table td {
    border: 1px solid #e2e8f0;
    padding: 5px 6px;
    font-size: 7.5pt;
    font-weight: 700;
    vertical-align: middle;
    word-break: break-word;
  }
  .adv-pay-table td.amt {
    text-align: right;
    font-weight: 900;
    color: ${ADVANCE_ACCENT_DARK};
    font-variant-numeric: tabular-nums;
  }
  .adv-total {
    text-align: center;
    margin: 10px 0;
    padding: 10px 8px;
    border: 2px solid ${ADVANCE_ACCENT};
    border-radius: 8px;
    background: linear-gradient(180deg, #fffbeb 0%, #fff7ed 100%);
  }
  .adv-total .lbl {
    font-size: 7pt;
    font-weight: 800;
    color: ${ADVANCE_ACCENT_DARK};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .adv-total .amt {
    font-size: 17pt;
    font-weight: 900;
    color: ${ADVANCE_ACCENT};
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .adv-notes-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    table-layout: fixed;
  }
  .adv-notes-table td {
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    font-size: 7pt;
    vertical-align: middle;
  }
  .adv-notes-table td.lbl {
    width: 18%;
    color: #64748b;
    font-weight: 800;
    font-size: 6.5pt;
    text-transform: uppercase;
    background: #f8fafc;
  }
  .adv-notes-table td.val { font-weight: 600; color: #334155; text-align: left; word-break: break-word; }
  .adv-note-fallback { font-size: 6.5pt; color: #94a3b8; margin-bottom: 8px; font-style: italic; }
  .adv-sig {
    width: 100%;
    border-collapse: collapse;
    margin-top: auto;
    padding-top: 16px;
    font-size: 7pt;
  }
  .adv-sig td {
    width: 50%;
    border-top: 1px solid #0f172a;
    padding-top: 6px;
    text-align: center;
    font-weight: 700;
    color: #475569;
    vertical-align: top;
  }
  .adv-sig td:first-child { padding-right: 8px; }
  .adv-sig td:last-child { padding-left: 8px; }
  .adv-foot {
    margin-top: 8px;
    font-size: 6pt;
    color: #94a3b8;
    text-align: center;
  }
  .adv-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 99px;
    font-size: 6.5pt;
    font-weight: 800;
    background: #fef3c7;
    color: #b45309;
    text-transform: uppercase;
    letter-spacing: 0.03em;
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
      min-height: ${PAGE.h} !important;
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
  const reasonRaw = (advance.reason || '').startsWith('__CLR_ADV__')
    ? 'With salary clearance'
    : String(advance.reason || '').trim();
  const reasonShort = reasonRaw.length > 56 ? `${reasonRaw.slice(0, 53)}…` : reasonRaw;
  const refRaw = advance.payment_reference || advance.reference_from_ledger || '';
  const refShort = refRaw.length > 40 ? `${String(refRaw).slice(0, 37)}…` : refRaw;

  const lines = Array.isArray(advance.payment_lines) && advance.payment_lines.length
    ? advance.payment_lines
    : [{
      accountName: advance.paid_from_label || 'Cash / Bank account',
      amount,
      mode: advance.payment_method_label || 'Cash',
    }];

  const splitPayment = lines.length > 1;
  const payRows = lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.mode || '—')}</td>
        <td>${escapeHtml(line.accountName || '—')}</td>
        ${splitPayment ? `<td class="amt">${fmtAmt(line.amount)}</td>` : ''}
      </tr>`
    )
    .join('');
  const payTableHead = splitPayment
    ? `<thead><tr><th>Mode</th><th>Account</th><th class="amt-h">Split (Rs)</th></tr></thead>`
    : `<thead><tr><th>Mode</th><th>Account</th></tr></thead>`;

  const phone = emp.emp_phone || emp.phone || '—';
  const address = String(emp.emp_address || '').trim() || '—';
  const role = [emp.designation, emp.department].filter(Boolean).join(' · ') || '—';

  const balBefore = advance.balance_before;
  const balAfter = advance.balance_after ?? advance.employee_ledger_balance_after;
  const hasBal =
    balBefore != null &&
    balAfter != null &&
    !Number.isNaN(parseFloat(balBefore));

  const balBlock = hasBal
    ? `<table class="adv-bal-table adv-bal" role="presentation"><tr>
        <td class="cell"><span class="lbl">Balance before</span><span class="val">${fmtAmt(balBefore)}</span></td>
        <td class="cell mid"><span class="lbl">Advance paid</span><span class="val">Rs ${fmtAmt(amount)}</span></td>
        <td class="cell"><span class="lbl">Balance after</span><span class="val">${fmtAmt(balAfter)}</span></td>
      </tr></table>`
    : `<table class="adv-bal-table adv-bal" role="presentation"><tr>
        <td class="cell mid" style="width:100%"><span class="lbl">Advance paid</span><span class="val">Rs ${fmtAmt(amount)}</span></td>
      </tr></table>`;

  const notesBlock =
    reasonShort || refShort
      ? `<table class="adv-notes-table" role="presentation">
      ${reasonShort ? `<tr><td class="lbl">Reason</td><td class="val">${escapeHtml(reasonShort)}</td></tr>` : ''}
      ${refShort ? `<tr><td class="lbl">Ref</td><td class="val">${escapeHtml(refShort)}</td></tr>` : ''}
    </table>`
      : '';

  const statusHtml = `<span class="adv-status">${escapeHtml(status)}</span>`;

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

    <table class="adv-detail-table" role="presentation">
      ${ADV_DETAIL_COLGROUP}
      ${advSectionRow('Voucher details')}
      ${advVoucherOneLineRow([
        { label: 'Voucher no.', valueHtml: escapeHtml(billNo) },
        { label: 'Advance date', valueHtml: escapeHtml(dateStr) },
        {
          label: 'Payment method',
          valueHtml: escapeHtml(advance.payment_method_label || 'Cash'),
          valClass: 'val-adv',
        },
        { label: 'Status', valueHtml: statusHtml },
      ])}
      ${advSectionRow('Employee')}
      ${advDetailPairRow(
        'Name',
        escapeHtml(emp.emp_name || '—'),
        'Role',
        escapeHtml(role),
        { val1Class: 'txt', val2Class: 'txt' }
      )}
      ${advDetailPairRow(
        'Phone',
        escapeHtml(phone),
        'Address',
        escapeHtml(address),
        { val1Class: 'txt', val2Class: 'txt' }
      )}
    </table>

    <div class="adv-sec">Ledger flow &amp; payment</div>
    ${balBlock}
    <table class="adv-pay-table${splitPayment ? ' adv-pay-split' : ''}" style="margin-top:6px">
      ${payTableHead}
      <tbody>${payRows}</tbody>
    </table>

    ${notesBlock}

    <table class="adv-sig" role="presentation"><tr>
      <td>Employee signature</td>
      <td>Authorized signature</td>
    </tr></table>
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
