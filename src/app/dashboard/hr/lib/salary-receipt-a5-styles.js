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
    min-height: ${PAGE.h};
    margin: 0 auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
  }
  .salary-payslip-root * { box-sizing: border-box; }
  .salary-payslip-root {
    direction: ltr;
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    width: 100%;
    min-height: ${PAGE.h};
    padding: ${PAGE.pad};
    color: #0f172a;
    background: #fff;
    font-size: 8.5pt;
    line-height: 1.45;
    display: flex;
    flex-direction: column;
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
    gap: 10px;
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
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${PAGE.w} !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .salary-payslip-sheet {
      width: ${PAGE.w} !important;
      max-width: ${PAGE.w} !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border: 1px solid #cbd5e1 !important;
      page-break-inside: avoid !important;
    }
  }
`;

export function getSalaryReceiptA5Stylesheet() {
  return `${SALARY_RECEIPT_BODY_STYLES}${SALARY_RECEIPT_PRINT_STYLES}`;
}
