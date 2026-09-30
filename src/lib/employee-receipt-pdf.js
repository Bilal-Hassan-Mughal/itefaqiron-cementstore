'use client';

import { COMPANY } from '@/lib/brand-theme';

const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function buildEmployeeReceiptPrintHtml(receipt) {
  const billNo = receipt?.ledger_bill_no || `EMP-RCV-${receipt?.receipt_id || ''}`;
  const dateStr = receipt?.receipt_date
    ? new Date(receipt.receipt_date).toLocaleDateString('en-GB')
    : '—';
  const mode = receipt?.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash';
  const empName = receipt?.employee?.emp_name || receipt?.emp_name || 'Employee';
  const accountName = receipt?.account?.cus_name || '—';
  const before = parseFloat(receipt?.balance_before ?? 0);
  const after = parseFloat(receipt?.balance_after ?? 0);
  const amount = parseFloat(receipt?.amount || 0);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${billNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:16px;max-width:420px;margin:0 auto}
  .head{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:12px}
  .ur{font-size:18px;font-weight:800;direction:rtl}
  .sub{font-size:11px;color:#64748b;margin-top:4px}
  h2{font-size:14px;text-align:center;margin:12px 0;letter-spacing:1px;color:#0d9488}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0}
  td{padding:6px 8px;border:1px solid #e2e8f0}
  td.lbl{color:#64748b;font-weight:600;width:42%}
  td.val{font-weight:700;text-align:right}
  .amt{font-size:22px;font-weight:900;text-align:center;margin:14px 0;color:#0d9488}
  .sig{display:flex;gap:24px;margin-top:28px;font-size:11px}
  .sig div{flex:1;border-top:1px solid #000;padding-top:4px;text-align:center}
  @media print{body{padding:8px}}
</style></head><body>
  <div class="head">
    <div class="ur">${COMPANY.nameUr || COMPANY.name}</div>
    <div class="sub">${COMPANY.address || ''}</div>
    <div class="sub">Ph: ${(COMPANY.phones || []).join(', ')}</div>
  </div>
  <h2>EMPLOYEE PAYMENT RECEIPT</h2>
  <p style="text-align:center;font-size:12px;font-weight:700;margin-bottom:8px">Receipt # ${billNo}</p>
  <table>
    <tr><td class="lbl">Date</td><td class="val">${dateStr}</td></tr>
    <tr><td class="lbl">Employee</td><td class="val">${empName}</td></tr>
    <tr><td class="lbl">Payment mode</td><td class="val">${mode}</td></tr>
    <tr><td class="lbl">Received in</td><td class="val">${accountName}</td></tr>
    ${receipt?.reference ? `<tr><td class="lbl">Reference</td><td class="val">${receipt.reference}</td></tr>` : ''}
    <tr><td class="lbl">Balance before</td><td class="val">${fmt(before)}</td></tr>
    <tr><td class="lbl">Balance after</td><td class="val">${fmt(after)}</td></tr>
  </table>
  <div class="amt">Received: Rs ${fmt(amount)}</div>
  ${receipt?.notes ? `<p style="font-size:11px;margin-top:8px"><strong>Note:</strong> ${receipt.notes}</p>` : ''}
  <div class="sig">
    <div>Employee signature</div>
    <div>Authorized signature</div>
  </div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export async function downloadEmployeeReceiptPdf(receipt) {
  const html = buildEmployeeReceiptPrintHtml({ ...receipt, ledger_bill_no: receipt?.ledger_bill_no });
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-9999px';
  wrap.style.width = '420px';
  wrap.style.background = '#fff';
  wrap.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(img, 'PNG', (pageW - w) / 2, 8, w, h);
    pdf.save(`employee-receipt-${receipt?.receipt_id || 'new'}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
