'use client';

import { COMPANY } from '@/lib/brand-theme';

const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB');
}

function balanceLabel(closing) {
  const n = parseFloat(closing || 0);
  if (n > 0.009) return `Employee owes: Rs ${fmt(n)}`;
  if (n < -0.009) return `Company owes: Rs ${fmt(Math.abs(n))}`;
  return 'Settled (Rs 0)';
}

function typeLabel(type, entryTypes) {
  const found = (entryTypes || []).find((x) => x.value === type);
  return found?.label || type || '—';
}

function safeFilePart(s) {
  return String(s || 'ledger')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
}

/**
 * @param {object} opts
 * @param {Array} opts.entries — rows to export (already filtered in UI)
 * @param {object|null} opts.employee — selected employee summary row
 * @param {number|null} opts.closingBalance
 * @param {boolean} opts.showEmployeeColumn
 * @param {string} opts.filterSummary — human-readable filter line
 * @param {Array} opts.entryTypes — { value, label } for type labels
 */
export async function downloadEmployeeLedgerPdf({
  entries = [],
  employee = null,
  closingBalance = null,
  showEmployeeColumn = false,
  filterSummary = '',
  entryTypes = [],
} = {}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(COMPANY.name || 'Employee ledger', 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (COMPANY.address) {
    doc.text(String(COMPANY.address), 14, y);
    y += 4;
  }
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(13, 71, 196);
  doc.text('Employee account ledger', 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  if (employee) {
    doc.text(
      `Account: ${employee.emp_name}${employee.designation ? ` · ${employee.designation}` : ''}`,
      14,
      y
    );
    y += 5;
    doc.text(`Opening (pre-system): Rs ${fmt(employee.opening_balance)}`, 14, y);
    y += 5;
    const close = closingBalance ?? employee.closing_balance;
    doc.text(`Closing: ${balanceLabel(close)}`, 14, y);
    y += 5;
  } else {
    doc.text('All employees — combined transactions (as shown on screen)', 14, y);
    y += 5;
  }

  if (filterSummary) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filters: ${filterSummary}`, 14, y);
    y += 6;
  }

  const head = showEmployeeColumn
    ? ['Date', 'Employee', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance']
    : ['Date', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance'];

  const body = entries.map((row) => {
    const base = [
      fmtDate(row.created_at),
      typeLabel(row.trnx_type, entryTypes),
      row.bill_no || '—',
      String(row.details || '—').slice(0, 120),
      row.debit_amount > 0 ? fmt(row.debit_amount) : '—',
      row.credit_amount > 0 ? fmt(row.credit_amount) : '—',
      fmt(row.closing_balance),
    ];
    if (showEmployeeColumn) {
      return [base[0], row.emp_name || '—', ...base.slice(1)];
    }
    return base;
  });

  const totals = entries.reduce(
    (acc, r) => ({
      debit: acc.debit + parseFloat(r.debit_amount || 0),
      credit: acc.credit + parseFloat(r.credit_amount || 0),
    }),
    { debit: 0, credit: 0 }
  );

  autoTable(doc, {
    startY: y + 2,
    head: [head],
    body: body.length
      ? body
      : [[{ content: 'No transactions to export.', colSpan: head.length, styles: { halign: 'center' } }]],
    foot: body.length
      ? [[
        {
          content: 'Totals (shown rows)',
          colSpan: head.length - 3,
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        { content: fmt(totals.debit), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: fmt(totals.credit), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
      ]]
      : undefined,
    theme: 'grid',
    headStyles: { fillColor: [19, 71, 196], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: 15, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    styles: { overflow: 'linebreak' },
    columnStyles: showEmployeeColumn
      ? {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        4: { cellWidth: 52 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 24 },
      }
      : {
        0: { cellWidth: 24 },
        3: { cellWidth: 62 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 26 },
      },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    const ph = doc.internal.pageSize.getHeight();
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, ph - 8, { align: 'right' });
  }

  const namePart = employee ? safeFilePart(employee.emp_name) : 'all-employees';
  const datePart = new Date().toISOString().slice(0, 10);
  doc.save(`employee-ledger-${namePart}-${datePart}.pdf`);
}
