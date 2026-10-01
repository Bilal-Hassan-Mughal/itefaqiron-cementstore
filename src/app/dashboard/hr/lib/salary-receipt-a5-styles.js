import { SALARY_RECEIPT_A5 } from './salary-receipt-a5-spec';

const PAGE = {
  w: SALARY_RECEIPT_A5.width,
  h: SALARY_RECEIPT_A5.height,
  pad: SALARY_RECEIPT_A5.padding,
};

export { PAGE as SALARY_RECEIPT_PAGE };

export const SALARY_RECEIPT_BODY_STYLES = `
  .salary-payslip-sheet {
    width: ${PAGE.w};
    max-width: ${PAGE.w};
    min-height: 0;
    height: auto;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: visible;
  }
  .salary-payslip-root * { box-sizing: border-box; }
  .salary-payslip-root {
    direction: ltr;
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    width: 100%;
    min-height: 0;
    max-height: none;
    padding: ${PAGE.pad};
    color: #0f172a;
    background: #fff;
    font-size: 7.5pt;
    line-height: 1.32;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .salary-payslip-root.sr-compact .receipt-header {
    padding-bottom: 4px;
    margin-bottom: 4px;
    border-bottom-width: 1px;
  }
  .salary-payslip-root.sr-compact .co-logo {
    width: 40px;
    height: 40px;
  }
  .salary-payslip-root.sr-compact .co-info h1 {
    font-size: 9pt;
  }
  .salary-payslip-root.sr-compact .title-badge {
    text-align: right;
    flex-shrink: 0;
  }
  .salary-payslip-root.sr-compact .title-badge .en {
    font-size: 8pt;
    font-weight: 900;
    color: #1A55E3;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .salary-payslip-root.sr-compact .title-badge .sub {
    font-size: 7.5pt;
    font-weight: 800;
    color: #475569;
    margin-top: 1px;
  }
  .salary-payslip-root.sr-compact .sec-label {
    margin: 4px 0 2px;
    font-size: 6.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }
  .salary-payslip-root.sr-compact .att-strip {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #cbd5e1;
    margin-bottom: 4px;
    table-layout: fixed;
  }
  .salary-payslip-root.sr-compact .att-strip th {
    background: #f1f5f9;
    font-size: 6pt;
    font-weight: 800;
    padding: 3px 2px;
    border: 1px solid #e2e8f0;
    color: #475569;
  }
  .salary-payslip-root.sr-compact .att-strip td {
    text-align: center;
    font-size: 8pt;
    font-weight: 900;
    padding: 4px 2px;
    border: 1px solid #e2e8f0;
    color: #0f172a;
  }
  .salary-payslip-root.sr-compact .meta-compact td {
    padding: 3px 6px;
    font-size: 7pt;
  }
  .salary-payslip-root.sr-compact .receipt-header {
    gap: 6px;
    align-items: flex-start;
  }
  .salary-payslip-root.sr-compact .co-info h1 {
    font-size: 8.5pt;
    word-break: break-word;
  }
  .salary-payslip-root.sr-compact .title-badge .en {
    white-space: normal;
    line-height: 1.2;
    max-width: 28mm;
  }
  .salary-payslip-root.sr-compact .inv-compact tbody td {
    padding: 2px 4px;
    font-size: 6.75pt;
  }
  .salary-payslip-root.sr-compact .inv-compact thead th {
    padding: 3px 4px;
    font-size: 6.25pt;
  }
  .salary-payslip-root.sr-compact .inv-table td.amt {
    white-space: normal;
    word-break: break-word;
    font-size: 6.75pt;
    padding-left: 2px;
  }
  .salary-payslip-root.sr-compact .inv-table col.col-desc { width: 52%; }
  .salary-payslip-root.sr-compact .inv-table col.col-amt { width: 48%; }
  .salary-payslip-root.sr-compact .inv-table td.amt.muted {
    color: #94a3b8;
    font-weight: 600;
  }
  .salary-payslip-root.sr-compact .inv-table td.amt.net-amt {
    color: #1A55E3;
    font-weight: 900;
  }
  .salary-payslip-root.sr-compact .inv-table td.amt.val-txt {
    font-size: 6.5pt;
    font-weight: 600;
    text-align: right;
    white-space: normal;
  }
  .salary-payslip-root.sr-compact .paid-banner {
    margin-top: 4px;
    padding: 6px 8px;
  }
  .salary-payslip-root.sr-compact .paid-banner .val {
    font-size: 10pt;
  }
  .salary-payslip-root.sr-compact .sign span {
    padding-top: 18px;
    font-size: 6.5pt;
  }
  .salary-payslip-root.sr-compact .inv-footer {
    padding-top: 6px;
  }
  .salary-payslip-root .inv-main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .salary-payslip-root .receipt-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 2px solid #1A55E3;
    margin-bottom: 8px;
  }
  .salary-payslip-root .co-logo {
    width: 52px;
    height: 52px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .salary-payslip-root .co-info { flex: 1; min-width: 0; }
  .salary-payslip-root .co-info h1 {
    margin: 0;
    font-size: 11pt;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .salary-payslip-root .co-info .tagline {
    margin: 2px 0 0;
    font-size: 7.5pt;
    font-weight: 600;
    color: #1A55E3;
  }
  .salary-payslip-root .co-info .addr,
  .salary-payslip-root .co-info .phone {
    margin: 2px 0 0;
    font-size: 7pt;
    color: #64748b;
    font-weight: 600;
  }
  .salary-payslip-root .title-strip {
    text-align: center;
    background: linear-gradient(135deg, #1A55E3 0%, #0f172a 100%);
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .salary-payslip-root .title-strip .en {
    font-size: 10.5pt;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #fff;
  }
  .salary-payslip-root .title-strip .sub {
    font-size: 7.5pt;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    margin-top: 2px;
  }
  .salary-payslip-root .meta-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #cbd5e1;
    table-layout: fixed;
    border-radius: 6px;
    overflow: hidden;
  }
  .salary-payslip-root .meta-table td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
    font-size: 7.5pt;
  }
  .salary-payslip-root .meta-table .mk {
    width: 22%;
    background: #f1f5f9;
    font-weight: 700;
    color: #475569;
    text-align: left;
  }
  .salary-payslip-root .meta-table .mv {
    width: 28%;
    font-weight: 800;
    color: #0f172a;
    text-align: left;
  }
  .salary-payslip-root .meta-table tr.meta-emp td {
    background: #f8fafc;
  }
  .salary-payslip-root .meta-table .emp-name {
    font-weight: 900;
    font-size: 9pt;
    color: #0f172a;
  }
  .salary-payslip-root .status-paid {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: #dcfce7;
    color: #15803d;
    font-size: 7pt;
    font-weight: 900;
    letter-spacing: 0.06em;
  }
  .salary-payslip-root .inv-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1px solid #cbd5e1;
  }
  .salary-payslip-root .inv-table col.col-desc { width: 58%; }
  .salary-payslip-root .inv-table col.col-amt { width: 42%; }
  .salary-payslip-root .inv-table thead th {
    background: #0f172a;
    color: #fff;
    font-size: 8pt;
    font-weight: 800;
    padding: 6px 10px;
    text-align: left;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .salary-payslip-root .inv-table thead th.amt-h {
    text-align: right;
  }
  .salary-payslip-root .inv-table tbody td {
    padding: 5px 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
    font-size: 8pt;
  }
  .salary-payslip-root .inv-table tbody tr.data-row:nth-child(even) td {
    background: #fafbfc;
  }
  .salary-payslip-root .inv-table td.desc {
    text-align: left;
    color: #334155;
    font-weight: 600;
  }
  .salary-payslip-root .inv-table td.amt,
  .salary-payslip-root .inv-table td.val {
    text-align: right;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .salary-payslip-root .inv-table td.val {
    font-weight: 700;
    font-size: 7.5pt;
    color: #475569;
    white-space: normal;
    text-align: left;
  }
  .salary-payslip-root .inv-table .earn-amt { color: #047857; }
  .salary-payslip-root .inv-table .ded-amt { color: #b91c1c; }
  .salary-payslip-root .inv-table td.amt .acct-tag {
    font-size: 6.5pt;
    font-weight: 800;
    margin-left: 4px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(15,23,42,0.06);
    color: inherit;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .salary-payslip-root .inv-table tr.sep.sub td {
    font-size: 7pt;
    font-weight: 700;
    color: #64748b;
    padding-top: 6px;
    background: #f8fafc;
  }
  .salary-payslip-root .inv-table tr.sep td {
    background: #e2e8f0;
    color: #0f172a;
    padding: 5px 10px;
    font-size: 7.5pt;
    font-weight: 900;
    text-align: left;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 1px solid #cbd5e1;
  }
  .salary-payslip-root .inv-table tr.net-row td {
    background: #eff6ff;
    border-top: 2px solid #1A55E3;
    border-bottom: 2px solid #1A55E3;
  }
  .salary-payslip-root .inv-table tr.net-row td.desc { font-weight: 900; color: #1e3a8a; }
  .salary-payslip-root .inv-table tr.net-row td.amt {
    color: #1A55E3;
    font-size: 9pt;
    font-weight: 900;
  }
  .salary-payslip-root .inv-table tr.total-row td {
    background: #ecfdf5;
    border-top: 2px solid #059669;
  }
  .salary-payslip-root .inv-table tr.total-row td.desc { font-weight: 900; color: #065f46; }
  .salary-payslip-root .inv-table tr.total-row td.amt {
    color: #047857;
    font-size: 10pt;
    font-weight: 900;
  }
  .salary-payslip-root .paid-banner {
    margin-top: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 2px solid #059669;
    background: linear-gradient(180deg, #ecfdf5 0%, #fff 100%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .salary-payslip-root .paid-banner .lbl {
    font-size: 8pt;
    font-weight: 800;
    color: #065f46;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .salary-payslip-root .paid-banner .val {
    font-size: 12pt;
    font-weight: 900;
    color: #047857;
    font-variant-numeric: tabular-nums;
  }
  .salary-payslip-root .inv-footer {
    margin-top: auto;
    padding-top: 12px;
    flex-shrink: 0;
  }
  .salary-payslip-root .sign {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }
  .salary-payslip-root .sign span {
    flex: 1;
    border-top: 1.5px solid #94a3b8;
    padding-top: 32px;
    text-align: center;
    font-weight: 700;
    font-size: 7.5pt;
    color: #64748b;
  }
  .salary-payslip-root .foot {
    font-size: 6.5pt;
    color: #94a3b8;
    text-align: center;
    margin: 0;
  }
`;

export const SALARY_RECEIPT_PRINT_STYLES = `
  @page { size: ${PAGE.w} ${PAGE.h}; margin: 0; }
  html.salary-receipt-print-root,
  html.salary-receipt-print-root body {
    margin: 0;
    padding: 0;
    width: ${PAGE.w};
    height: auto;
    background: #fff;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${PAGE.w} !important;
      height: auto !important;
      min-height: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body > *:not(.salary-payslip-sheet) {
      display: none !important;
    }
    .salary-payslip-sheet {
      width: ${PAGE.w} !important;
      max-width: ${PAGE.w} !important;
      min-height: 0 !important;
      height: auto !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .salary-payslip-root {
      min-height: 0 !important;
      max-height: none !important;
      height: auto !important;
      overflow: visible !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .salary-payslip-root .foot {
      display: none;
    }
  }
`;

export function getSalaryReceiptA5Stylesheet() {
  return `${SALARY_RECEIPT_BODY_STYLES}${SALARY_RECEIPT_PRINT_STYLES}`;
}
