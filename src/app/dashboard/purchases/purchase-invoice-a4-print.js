'use client';

import React, { useMemo } from 'react';
import { COMPANY } from '@/lib/brand-theme';

/** A5 sheet (148 × 210 mm) — fewer rows than A4 so each page fits when printed. */
export const PURCHASE_INVOICE_PAGE_FORMAT = 'a5';
export const PURCHASE_INVOICE_PAGE_WIDTH_MM = 148;
export const PURCHASE_INVOICE_PAGE_HEIGHT_MM = 210;
export const PURCHASE_INVOICE_PAGE_AT_PAGE = 'A5';
export const PURCHASE_PRINT_MOUNT_ID = 'purchase-invoice-print-mount';

/** Hides the app shell in print so only the invoice mount is emitted (no trailing blank sheets). */
export const PURCHASE_SHEET_PRINT_HIDE_CSS = `
  @media print {
    html, body {
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: #fff !important;
    }
    body.purchase-sheet-print > *:not(#${PURCHASE_PRINT_MOUNT_ID}) {
      display: none !important;
    }
    body.purchase-sheet-print #${PURCHASE_PRINT_MOUNT_ID} {
      display: block !important;
      position: static !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
  }
`;
/**
 * A5 pagination tuned for readable type (not micro-fonts):
 * page 1 has header + supplier block → fewer rows; continuation pages fit more rows.
 */
export const PURCHASE_FIRST_PAGE_MAX_ITEMS = 20;
export const PURCHASE_NEXT_PAGE_MAX_ITEMS = 23;

export function purchaseDetailStartIndexForPage(pageIdx, pages) {
  if (Array.isArray(pages) && pages.length > 0) {
    let start = 0;
    for (let i = 0; i < pageIdx; i += 1) {
      start += pages[i]?.length || 0;
    }
    return start;
  }
  if (pageIdx <= 0) return 0;
  return PURCHASE_FIRST_PAGE_MAX_ITEMS + (pageIdx - 1) * PURCHASE_NEXT_PAGE_MAX_ITEMS;
}

export function chunkPurchaseDetails(details) {
  const list = Array.isArray(details) ? details : [];
  if (list.length === 0) return [[]];
  const pages = [list.slice(0, PURCHASE_FIRST_PAGE_MAX_ITEMS)];
  let offset = PURCHASE_FIRST_PAGE_MAX_ITEMS;
  while (offset < list.length) {
    pages.push(list.slice(offset, offset + PURCHASE_NEXT_PAGE_MAX_ITEMS));
    offset += PURCHASE_NEXT_PAGE_MAX_ITEMS;
  }
  return pages.filter((page) => page.length > 0);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lineTitle(detail) {
  return detail?.product?.pro_title || detail?.pro_title || 'N/A';
}

function lineRate(detail) {
  return detail?.crate ?? detail?.unit_rate ?? detail?.rate ?? 0;
}

function lineAmount(detail) {
  return detail?.total_amount ?? detail?.amount ?? 0;
}

function sumDetails(details, pick) {
  return (details || []).reduce((s, d) => s + parseFloat(pick(d) || 0), 0);
}

/** Layout only — @page (A5, 0.5cm 1cm) is injected by purchase print handlers. */
export const PURCHASE_A4_PRINT_CSS = `
  .purchase-a4-root {
    font-family: Arial, Helvetica, sans-serif;
    color: #1e293b;
    font-size: 10.5px;
    line-height: 1.35;
    width: 100%;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .purchase-a4-page {
    box-sizing: border-box;
    width: 100%;
    padding: 0;
  }
  .purchase-a4-page--continued {
    page-break-before: always;
    break-before: page;
  }
  @media screen {
    .purchase-a4-page:not(:last-child) {
      margin-bottom: 20px;
      border-bottom: 2px dashed #cbd5e1;
      padding-bottom: 12px;
    }
  }
  @media print {
    .purchase-a4-page {
      margin: 0 !important;
      border: none !important;
      padding: 0 !important;
    }
    .purchase-a4-page--continued {
      page-break-before: always !important;
      break-before: page !important;
    }
    .pi-table tr { page-break-inside: avoid; break-inside: avoid; }
    .pi-footer { page-break-inside: auto; break-inside: auto; }
  }
  .pi-header-full {
    text-align: center;
    border-bottom: 2px solid #0f172a;
    padding: 6px 0 8px;
    margin-bottom: 8px;
  }
  .pi-header-full .pi-ur {
    font-size: 17px;
    font-weight: 800;
    direction: rtl;
    margin: 0 0 3px;
    line-height: 1.25;
    color: #0f172a;
  }
  .pi-header-full .pi-addr {
    direction: rtl;
    color: #047857;
    font-weight: 700;
    margin: 0 0 3px;
    font-size: 10px;
    line-height: 1.3;
  }
  .pi-header-full .pi-phone {
    font-weight: 700;
    margin: 0 0 4px;
    font-size: 10.5px;
    color: #334155;
  }
  .pi-header-full .pi-title {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin: 2px 0 0;
    padding: 3px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #f8fafc;
  }
  .pi-header-mini {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #94a3b8;
    padding-bottom: 5px;
    margin-bottom: 7px;
    font-size: 10.5px;
    font-weight: 700;
    color: #334155;
  }
  .pi-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 10px;
    line-height: 1.35;
  }
  .pi-meta-col { flex: 1; min-width: 0; }
  .pi-meta-right { text-align: right; }
  .pi-meta-row { margin: 0 0 4px; }
  .pi-meta-row:last-child { margin-bottom: 0; }
  .pi-meta-label { color: #64748b; font-weight: 600; margin-right: 4px; }
  .pi-meta-value { color: #0f172a; font-weight: 700; }
  .pi-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0 0 4px;
  }
  .pi-table th,
  .pi-table td {
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    vertical-align: middle;
    word-wrap: break-word;
    font-size: 10px;
    line-height: 1.3;
  }
  .pi-table th {
    background: #475569;
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    padding: 5px 6px;
  }
  .pi-table tbody tr:nth-child(even) { background: #f8fafc; }
  .pi-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pi-table td.pi-product { font-weight: 600; color: #0f172a; }
  .pi-table tr.pi-total td {
    background: #e2e8f0;
    font-weight: 800;
    border-top: 2px solid #94a3b8;
  }
  .pi-footer {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    align-items: flex-start;
  }
  .pi-footer-col { flex: 1; min-width: 0; }
  .pi-sum-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .pi-sum-table td {
    border: 1px solid #cbd5e1;
    padding: 3px 6px;
    font-size: 10px;
    line-height: 1.3;
  }
  .pi-sum-table td:first-child { font-weight: 700; color: #334155; }
  .pi-sum-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .pi-sum-table tr.pi-highlight td { background: #f1f5f9; font-weight: 800; }
  .pi-section-title td { text-align: center; font-weight: 800; font-size: 10px; }
  .pi-section-blue td { background: #e3f2fd !important; color: #1565c0; }
  .pi-section-orange td { background: #fff3e0 !important; color: #e65100; }
  .pi-page-no { font-size: 10px; color: #64748b; font-weight: 600; }
`;

function renderItemsTableHtml(pageDetails, startIndex, ctx, { showGrandTotal, allDetails }) {
  const { fmtAmt } = ctx;
  let body = pageDetails.map((detail, i) => {
    const sn = startIndex + i + 1;
    return `<tr>
      <td class="num">${sn}</td>
      <td class="pi-product">${esc(lineTitle(detail))}</td>
      <td class="num">${esc(detail.qnty ?? 0)}</td>
      <td class="num">${esc(fmtAmt(lineRate(detail)))}</td>
      <td class="num">${esc(fmtAmt(lineAmount(detail)))}</td>
    </tr>`;
  }).join('');

  if (showGrandTotal) {
    const totalQty = sumDetails(allDetails, (d) => d.qnty);
    const totalAmt = sumDetails(allDetails, lineAmount);
    body += `<tr class="pi-total">
      <td></td>
      <td><strong>Total</strong></td>
      <td class="num"><strong>${esc(totalQty)}</strong></td>
      <td></td>
      <td class="num"><strong>${esc(fmtAmt(totalAmt))}</strong></td>
    </tr>`;
  }

  return `<table class="pi-table">
    <thead><tr>
      <th style="width:8%">S#</th>
      <th style="width:44%">Product Name</th>
      <th style="width:12%">Qty</th>
      <th style="width:18%">Rate</th>
      <th style="width:18%">Amount</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderFooterHtml(bill, ctx) {
  const { fmtAmt, getInvoiceNet, getInvoiceRemainingDue, getSupplierBalanceAfterBill } = ctx;
  const outLab = parseFloat(bill.out_labour_amount || 0);
  const outDel = parseFloat(bill.out_delivery_amount || 0);
  const inLab = parseFloat(bill.incity_own_labour || 0);
  const inDel = parseFloat(bill.incity_own_delivery || 0);
  const showOuter = outLab > 0 || outDel > 0;
  const showIncity = inLab > 0 || inDel > 0;

  let left = `<table class="pi-sum-table">
    <tr><td>Previous Balance</td><td>${esc(fmtAmt(bill.previous_customer_balance ?? bill.customer?.cus_balance ?? 0))}</td></tr>
    <tr><td>Current Due</td><td>${esc(fmtAmt(getInvoiceRemainingDue(bill)))}</td></tr>
    <tr class="pi-highlight"><td>Total Due</td><td>${esc(fmtAmt(getSupplierBalanceAfterBill(bill)))}</td></tr>
  </table>`;

  if (showOuter) {
    left += `<table class="pi-sum-table"><tr class="pi-section-title pi-section-blue"><td colspan="2">Outer Cargo Charges</td></tr>`;
    if (outLab > 0) left += `<tr><td>Out Labour</td><td>${esc(fmtAmt(outLab))}</td></tr>`;
    if (outDel > 0) left += `<tr><td>Out Delivery</td><td>${esc(fmtAmt(outDel))}</td></tr>`;
    left += `<tr class="pi-highlight pi-section-blue"><td>Total Outer Charges</td><td>${esc(fmtAmt(outLab + outDel))}</td></tr></table>`;
  }

  if (showIncity) {
    left += `<table class="pi-sum-table"><tr class="pi-section-title pi-section-orange"><td colspan="2">Incity Charges</td></tr>`;
    if (inLab > 0) left += `<tr><td>Incity Labour</td><td>${esc(fmtAmt(inLab))}</td></tr>`;
    if (inDel > 0) left += `<tr><td>Incity Delivery</td><td>${esc(fmtAmt(inDel))}</td></tr>`;
    left += `<tr class="pi-highlight pi-section-orange"><td>Total Incity Charges</td><td>${esc(fmtAmt(inLab + inDel))}</td></tr></table>`;
  }

  const bankLabel = bill?.bank_title ? `Bank Payment (${bill.bank_title})` : 'Bank Payment';
  let right = `<table class="pi-sum-table">
    <tr><td>Bill Amount</td><td>${esc(fmtAmt(bill.total_amount || 0))}</td></tr>
    <tr><td>Labour</td><td>${esc(fmtAmt(bill.labour_amount || 0))}</td></tr>
    <tr><td>Transport</td><td>${esc(fmtAmt(bill.transport_amount || 0))}</td></tr>`;
  if (parseFloat(bill.discount || 0) > 0) {
    right += `<tr><td>Discount</td><td>-${esc(fmtAmt(bill.discount))}</td></tr>`;
  }
  right += `<tr class="pi-highlight"><td>Total Amount</td><td>${esc(fmtAmt(getInvoiceNet(bill)))}</td></tr>
    <tr><td>Cash</td><td>${esc(fmtAmt(bill.cash_payment || 0))}</td></tr>
    <tr><td>${esc(bankLabel)}</td><td>${esc(fmtAmt(bill.bank_payment || 0))}</td></tr>
    <tr><td>Total Received</td><td>${esc(fmtAmt(bill.payment || 0))}</td></tr>
    <tr class="pi-highlight"><td>Remaining Due</td><td>${esc(fmtAmt(getInvoiceRemainingDue(bill)))}</td></tr>
  </table>`;

  return `<div class="pi-footer"><div class="pi-footer-col">${left}</div><div class="pi-footer-col">${right}</div></div>`;
}

function renderMetaHtml(bill, ctx) {
  const { formatDatePK, formatTimePK, createdByFor } = ctx;
  const createdBy = typeof createdByFor === 'function' ? createdByFor(bill) : (createdByFor || '—');
  return `<div class="pi-meta">
    <div class="pi-meta-col">
      <p class="pi-meta-row"><span class="pi-meta-label">Customer:</span><span class="pi-meta-value">${esc(bill.customer?.cus_name || 'N/A')}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Phone:</span><span class="pi-meta-value">${esc(bill.customer?.cus_phone_no || 'N/A')}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Address:</span><span class="pi-meta-value">${esc(bill.customer?.cus_address || 'N/A')}</span></p>
    </div>
    <div class="pi-meta-col pi-meta-right">
      <p class="pi-meta-row"><span class="pi-meta-label">Invoice No:</span><span class="pi-meta-value">#${esc(bill.pur_id)}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Date:</span><span class="pi-meta-value">${esc(formatDatePK(bill?.created_at) || '—')}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Time:</span><span class="pi-meta-value">${esc(formatTimePK(bill?.created_at) || '—')}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Bill Type:</span><span class="pi-meta-value">${esc(bill.bill_type || 'PURCHASE')}</span></p>
      <p class="pi-meta-row"><span class="pi-meta-label">Created By:</span><span class="pi-meta-value">${esc(createdBy)}</span></p>
    </div>
  </div>`;
}

function renderFullHeaderHtml(ctx) {
  const phone = ctx.phoneLine || `Ph:- ${(COMPANY.phones || ['0300-7560306']).join(', ')}`;
  return `<div class="pi-header-full">
    <p class="pi-ur">${esc(COMPANY.nameUr)}</p>
    <p class="pi-addr">گجرات سرگودھا روڈ، پاہڑیانوالی</p>
    <p class="pi-phone">${esc(phone)}</p>
    <p class="pi-title">Purchase Invoice</p>
  </div>`;
}

function renderMiniHeaderHtml(bill, pageNo, totalPages) {
  return `<div class="pi-header-mini">
    <span>${esc(COMPANY.nameUr)} — PURCHASE INVOICE #${esc(bill.pur_id)}</span>
    <span class="pi-page-no">Page ${pageNo} of ${totalPages}</span>
  </div>`;
}

export function removePurchasePrintMount() {
  document.getElementById(PURCHASE_PRINT_MOUNT_ID)?.remove();
}

export function mountPurchasePrintHtml(html) {
  removePurchasePrintMount();
  const mount = document.createElement('div');
  mount.id = PURCHASE_PRINT_MOUNT_ID;
  mount.innerHTML = html;
  document.body.appendChild(mount);
  return mount;
}

export function buildPurchaseA4PrintHtml(bill, ctx) {
  if (!bill) return '';
  const allDetails = bill.purchase_details || [];
  const pages = chunkPurchaseDetails(allDetails).filter((p) => p.length > 0);
  const totalPages = pages.length;
  const parts = [`<style>${PURCHASE_A4_PRINT_CSS}</style><div class="purchase-a4-root">`];

  pages.forEach((pageDetails, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast = pageIdx === totalPages - 1;
    const startIndex = purchaseDetailStartIndexForPage(pageIdx, pages);
    const pageClass = pageIdx > 0 ? 'purchase-a4-page purchase-a4-page--continued' : 'purchase-a4-page';
    parts.push(`<div class="${pageClass}">`);
    parts.push(isFirst ? renderFullHeaderHtml(ctx) : renderMiniHeaderHtml(bill, pageIdx + 1, totalPages));
    if (isFirst) parts.push(renderMetaHtml(bill, ctx));
    parts.push(renderItemsTableHtml(pageDetails, startIndex, ctx, {
      showGrandTotal: isLast,
      allDetails,
    }));
    if (isLast) {
      parts.push(renderFooterHtml(bill, ctx));
    }
    parts.push('</div>');
  });

  parts.push('</div>');
  return parts.join('');
}

export function purchaseInvoicePdfFileName(bill) {
  const id = bill?.pur_id ?? 'invoice';
  const date = bill?.created_at
    ? String(bill.created_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `Purchase-Invoice-${id}-${date}.pdf`;
}

/** Multi-page PDF — one jsPDF page per `.purchase-a4-page` (same HTML as print). */
export async function downloadPurchaseInvoicePdf(bill, ctx) {
  if (!bill) throw new Error('No purchase invoice to download');

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${PURCHASE_INVOICE_PAGE_WIDTH_MM}mm`,
    'box-sizing:border-box',
    'padding:0.5cm 1cm',
    'background:#fff',
    'z-index:-1',
    'pointer-events:none',
  ].join(';');
  host.innerHTML = buildPurchaseA4PrintHtml(bill, ctx);
  document.body.appendChild(host);

  try {
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    await new Promise((r) => setTimeout(r, 120));

    const pages = [...host.querySelectorAll('.purchase-a4-page')].filter((el) => {
      if (el.offsetHeight < 48) return false;
      const dataRows = el.querySelectorAll('.pi-table tbody tr:not(.pi-total)');
      return dataRows.length > 0;
    });
    if (!pages.length) throw new Error('Invoice pages not found');

    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF({
      unit: 'mm',
      format: PURCHASE_INVOICE_PAGE_FORMAT,
      orientation: 'portrait',
    });
    const pageW = PURCHASE_INVOICE_PAGE_WIDTH_MM;
    const pageH = PURCHASE_INVOICE_PAGE_HEIGHT_MM;

    let pdfPagesAdded = 0;
    for (let i = 0; i < pages.length; i += 1) {
      const pageEl = pages[i];
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        width: pageEl.scrollWidth,
        height: pageEl.scrollHeight,
        windowWidth: pageEl.scrollWidth,
        windowHeight: pageEl.scrollHeight,
      });

      if (canvas.height < 20 || canvas.width < 20) continue;

      if (pdfPagesAdded > 0) doc.addPage();

      const imgData = canvas.toDataURL('image/png');
      let renderW = pageW;
      let renderH = (canvas.height * renderW) / canvas.width;
      if (renderH > pageH) {
        renderH = pageH;
        renderW = (canvas.width * renderH) / canvas.height;
      }
      const x = (pageW - renderW) / 2;
      doc.addImage(imgData, 'PNG', x, 0, renderW, renderH);
      pdfPagesAdded += 1;
    }

    if (pdfPagesAdded === 0) throw new Error('PDF had no printable pages');

    doc.save(purchaseInvoicePdfFileName(bill));
  } finally {
    host.remove();
  }
}

function ItemsTable({ pageDetails, startIndex, ctx, showGrandTotal, allDetails }) {
  const { fmtAmt } = ctx;
  return (
    <table className="pi-table">
      <thead>
        <tr>
          <th style={{ width: '8%' }}>S#</th>
          <th style={{ width: '44%' }}>Product Name</th>
          <th style={{ width: '12%' }}>Qty</th>
          <th style={{ width: '18%' }}>Rate</th>
          <th style={{ width: '18%' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {pageDetails.map((detail, i) => (
          <tr key={detail.pur_detail_id || `${startIndex}-${i}`}>
            <td className="num">{startIndex + i + 1}</td>
            <td className="pi-product">{lineTitle(detail)}</td>
            <td className="num">{detail.qnty ?? 0}</td>
            <td className="num">{fmtAmt(lineRate(detail))}</td>
            <td className="num">{fmtAmt(lineAmount(detail))}</td>
          </tr>
        ))}
        {showGrandTotal && (
          <tr className="pi-total">
            <td />
            <td><strong>Total</strong></td>
            <td className="num"><strong>{sumDetails(allDetails, (d) => d.qnty)}</strong></td>
            <td />
            <td className="num"><strong>{fmtAmt(sumDetails(allDetails, lineAmount))}</strong></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function FooterSection({ bill, ctx }) {
  const { fmtAmt, getInvoiceNet, getInvoiceRemainingDue, getSupplierBalanceAfterBill } = ctx;
  const outLab = parseFloat(bill.out_labour_amount || 0);
  const outDel = parseFloat(bill.out_delivery_amount || 0);
  const inLab = parseFloat(bill.incity_own_labour || 0);
  const inDel = parseFloat(bill.incity_own_delivery || 0);

  return (
    <div className="pi-footer">
      <div className="pi-footer-col">
        <table className="pi-sum-table">
          <tbody>
            <tr><td>Previous Balance</td><td>{fmtAmt(bill.previous_customer_balance ?? bill.customer?.cus_balance ?? 0)}</td></tr>
            <tr><td>Current Due</td><td>{fmtAmt(getInvoiceRemainingDue(bill))}</td></tr>
            <tr className="pi-highlight"><td>Total Due</td><td>{fmtAmt(getSupplierBalanceAfterBill(bill))}</td></tr>
          </tbody>
        </table>
        {(outLab > 0 || outDel > 0) && (
          <table className="pi-sum-table">
            <tbody>
              <tr className="pi-section-title pi-section-blue"><td colSpan={2}>Outer Cargo Charges</td></tr>
              {outLab > 0 && <tr><td>Out Labour</td><td>{fmtAmt(outLab)}</td></tr>}
              {outDel > 0 && <tr><td>Out Delivery</td><td>{fmtAmt(outDel)}</td></tr>}
              <tr className="pi-highlight pi-section-blue"><td>Total Outer Charges</td><td>{fmtAmt(outLab + outDel)}</td></tr>
            </tbody>
          </table>
        )}
        {(inLab > 0 || inDel > 0) && (
          <table className="pi-sum-table">
            <tbody>
              <tr className="pi-section-title pi-section-orange"><td colSpan={2}>Incity Charges</td></tr>
              {inLab > 0 && <tr><td>Incity Labour</td><td>{fmtAmt(inLab)}</td></tr>}
              {inDel > 0 && <tr><td>Incity Delivery</td><td>{fmtAmt(inDel)}</td></tr>}
              <tr className="pi-highlight pi-section-orange"><td>Total Incity Charges</td><td>{fmtAmt(inLab + inDel)}</td></tr>
            </tbody>
          </table>
        )}
      </div>
      <div className="pi-footer-col">
        <table className="pi-sum-table">
          <tbody>
            <tr><td>Bill Amount</td><td>{fmtAmt(bill.total_amount || 0)}</td></tr>
            <tr><td>Labour</td><td>{fmtAmt(bill.labour_amount || 0)}</td></tr>
            <tr><td>Transport</td><td>{fmtAmt(bill.transport_amount || 0)}</td></tr>
            {parseFloat(bill.discount || 0) > 0 && (
              <tr><td>Discount</td><td>-{fmtAmt(bill.discount)}</td></tr>
            )}
            <tr className="pi-highlight"><td>Total Amount</td><td>{fmtAmt(getInvoiceNet(bill))}</td></tr>
            <tr><td>Cash</td><td>{fmtAmt(bill.cash_payment || 0)}</td></tr>
            <tr><td>{bill?.bank_title ? `Bank Payment (${bill.bank_title})` : 'Bank Payment'}</td><td>{fmtAmt(bill.bank_payment || 0)}</td></tr>
            <tr><td>Total Received</td><td>{fmtAmt(bill.payment || 0)}</td></tr>
            <tr className="pi-highlight"><td>Remaining Due</td><td>{fmtAmt(getInvoiceRemainingDue(bill))}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchaseInvoiceA4Document({ bill, ctx }) {
  const pages = useMemo(
    () => chunkPurchaseDetails(bill?.purchase_details).filter((p) => p.length > 0),
    [bill?.purchase_details]
  );
  if (!bill) return null;
  const allDetails = bill.purchase_details || [];
  const totalPages = pages.length;
  const createdBy = typeof ctx.createdByFor === 'function' ? ctx.createdByFor(bill) : '—';
  const phone = ctx.phoneLine || `Ph:- ${(COMPANY.phones || ['0300-7560306']).join(', ')}`;

  return (
    <>
      <style>{PURCHASE_A4_PRINT_CSS}</style>
      <div className="purchase-a4-root">
        {pages.map((pageDetails, pageIdx) => {
          if (!pageDetails.length) return null;
          const isFirst = pageIdx === 0;
          const isLast = pageIdx === totalPages - 1;
          const startIndex = purchaseDetailStartIndexForPage(pageIdx, pages);
          return (
            <div
              key={`pi-page-${pageIdx}`}
              className={pageIdx > 0 ? 'purchase-a4-page purchase-a4-page--continued' : 'purchase-a4-page'}
            >
              {isFirst ? (
                <div className="pi-header-full">
                  <p className="pi-ur">{COMPANY.nameUr}</p>
                  <p className="pi-addr">گجرات سرگودھا روڈ، پاہڑیانوالی</p>
                  <p className="pi-phone">{phone}</p>
                  <p className="pi-title">Purchase Invoice</p>
                </div>
              ) : (
                <div className="pi-header-mini">
                  <span>{COMPANY.nameUr} — PURCHASE INVOICE #{bill.pur_id}</span>
                  <span className="pi-page-no">Page {pageIdx + 1} of {totalPages}</span>
                </div>
              )}
              {isFirst && (
                <div className="pi-meta">
                  <div className="pi-meta-col">
                    <p className="pi-meta-row"><span className="pi-meta-label">Customer:</span><span className="pi-meta-value">{bill.customer?.cus_name || 'N/A'}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Phone:</span><span className="pi-meta-value">{bill.customer?.cus_phone_no || 'N/A'}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Address:</span><span className="pi-meta-value">{bill.customer?.cus_address || 'N/A'}</span></p>
                  </div>
                  <div className="pi-meta-col pi-meta-right">
                    <p className="pi-meta-row"><span className="pi-meta-label">Invoice No:</span><span className="pi-meta-value">#{bill.pur_id}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Date:</span><span className="pi-meta-value">{ctx.formatDatePK(bill?.created_at) || '—'}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Time:</span><span className="pi-meta-value">{ctx.formatTimePK(bill?.created_at) || '—'}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Bill Type:</span><span className="pi-meta-value">{bill.bill_type || 'PURCHASE'}</span></p>
                    <p className="pi-meta-row"><span className="pi-meta-label">Created By:</span><span className="pi-meta-value">{createdBy}</span></p>
                  </div>
                </div>
              )}
              <ItemsTable
                pageDetails={pageDetails}
                startIndex={startIndex}
                ctx={ctx}
                showGrandTotal={isLast}
                allDetails={allDetails}
              />
              {isLast ? <FooterSection bill={bill} ctx={ctx} /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
