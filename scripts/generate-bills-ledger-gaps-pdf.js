/**
 * Simple PDF: bills missing ledger + deleted sales list.
 * Run: node scripts/generate-bills-ledger-gaps-pdf.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JSON_PATH = path.join(__dirname, 'bills-ledger-gaps-list.json');
const OUT_PDF = path.join(__dirname, 'bills-ledger-gaps-report.pdf');

function rs(n) {
  if (n == null || n === '' || Number(n) === 0) return '0';
  return Number(n).toLocaleString('en-PK');
}

async function loadReport() {
  if (!fs.existsSync(JSON_PATH)) {
    execSync('node scripts/export-bills-ledger-gaps-list.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

async function main() {
  const report = await loadReport();
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = margin;

  const title = 'Bills & Ledger Gap Report';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${report.generated_at?.slice(0, 19).replace('T', ' ') || new Date().toISOString()}`, margin, y);
  y += 5;
  doc.text(report.activity_log_note || '', margin, y, { maxWidth: 180 });
  y += 10;

  const s = report.summary || {};
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const summaryLines = [
    `Sales in system with missing ledger: ${s.sales_missing_ledger ?? 0} (${s.sales_missing_ledger_with_amount ?? 0} with amount > 0)`,
    `Payments with missing ledger: ${s.payments_missing_ledger ?? 0}`,
    `Deleted sale IDs (gap): ${s.deleted_sale_ids ?? 0}`,
    `Deleted sales with ledger still left: ${s.deleted_with_ledger_left ?? 0}`,
    `Deleted sales with logged delete date: ${s.deleted_with_delete_log ?? 0}`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  y += 4;

  const addSection = (heading) => {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(heading, margin, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
  };

  const sales = report.bills_missing_ledger?.sales || [];
  addSection('A) Sales — bill exists, ledger missing');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Sale ID', 'Bill #', 'Account', 'Amount', 'Paid', 'Date', 'Type']],
    body: sales.map((r) => [
      String(r.sale_id),
      r.printed_bill_number != null ? String(r.printed_bill_number) : '—',
      (r.account || '').slice(0, 28),
      rs(r.amount),
      rs(r.paid),
      r.bill_date || '—',
      r.bill_type || '',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60] },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 8;

  const payments = report.bills_missing_ledger?.payments || [];
  addSection('B) Pay / Receive — payment exists, ledger missing');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Payment ID', 'Ref', 'Type', 'Account', 'Net', 'Date']],
    body: payments.map((r) => [
      String(r.payment_id),
      r.bill_ref,
      r.payment_type,
      (r.account || '').slice(0, 32),
      rs(r.amount),
      r.payment_date || '—',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60] },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 8;

  const deleted = report.deleted_sales || [];
  addSection('C) Deleted sales (row removed from sales table)');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Sale ID', 'Ledger rows', 'Est. amount', 'Last ledger date', 'Delete logged', 'Account']],
    body: deleted.map((r) => [
      String(r.sale_id),
      String(r.ledger_rows_remaining),
      r.estimated_amount_from_ledger != null ? rs(r.estimated_amount_from_ledger) : '—',
      r.last_ledger_activity_date || '—',
      r.deleted_logged_date || 'NO LOG',
      (r.account || '—').slice(0, 26),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60] },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 8;

  const orphan = report.deleted_payment_or_return_ledger_only || {};
  const orphanRows = [
    ...(orphan.payments || []).map((r) => ['Payment', r.bill_ref, rs(r.amount_hint), r.last_ledger_date || '—']),
    ...(orphan.sale_returns || []).map((r) => ['Sale return', r.bill_ref, rs(r.amount_hint), r.last_ledger_date || '—']),
  ];
  if (orphanRows.length) {
    addSection('D) Deleted payment/return — ledger still present');
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Kind', 'Ref', 'Amount hint', 'Last ledger date']],
      body: orphanRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      theme: 'grid',
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: 'right' });
  }

  const buf = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(OUT_PDF, buf);
  console.log('PDF written:', OUT_PDF);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
