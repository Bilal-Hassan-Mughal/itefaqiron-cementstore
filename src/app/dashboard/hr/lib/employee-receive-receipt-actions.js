'use client';

import {
  EMP_RECEIVE_RECEIPT_CAPTURE_ID,
  EMP_RECEIVE_RECEIPT_PRINT_MOUNT_ID,
  buildEmployeeReceiveReceiptBody,
  buildEmployeeReceiveReceiptPrintHtml,
  employeeReceiveReceiptFileName,
  getEmployeeReceiveReceiptStylesheet,
} from './employee-receive-receipt-a5';

/** Match employee-receive-receipt-a5 PAGE.wPx — stable html2canvas width */
const RECEIPT_CAPTURE_PX = 560;

const WA_CAPTURE_STYLES = `
  .emp-rcv-sheet.emp-rcv-wa-capture {
    box-shadow: none !important;
    overflow: visible !important;
  }
`;

async function captureReceiptTight(sourceEl) {
  if (!sourceEl) throw new Error('Receipt element not found');

  const html2canvas = (await import('html2canvas')).default;
  const w = Math.ceil(
    Math.max(
      sourceEl.scrollWidth || 0,
      sourceEl.offsetWidth || 0,
      RECEIPT_CAPTURE_PX
    )
  );
  const h = Math.ceil(sourceEl.scrollHeight || sourceEl.offsetHeight || 0);
  if (h <= 0) throw new Error('Receipt has no size — wait for preview to load');

  const clone = sourceEl.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('emp-rcv-capture-ready');
  Object.assign(clone.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    width: `${w}px`,
    maxWidth: `${w}px`,
    minWidth: `${w}px`,
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    boxShadow: 'none',
  });

  document.body.appendChild(clone);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));

  try {
    const ch = Math.ceil(clone.scrollHeight || h);
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: w,
      height: ch,
      windowWidth: w,
      windowHeight: ch,
    });
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }
}

function getPrintMount() {
  let el = document.getElementById(EMP_RECEIVE_RECEIPT_PRINT_MOUNT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = EMP_RECEIVE_RECEIPT_PRINT_MOUNT_ID;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function unmountReceiptCapture(printable) {
  if (!printable) return;
  printable.innerHTML = '';
  printable.style.display = 'none';
}

async function mountReceiptForCapture(receipt, ctx = {}) {
  const enriched = await enrichEmployeeReceiveReceipt(receipt, ctx);
  const printable = getPrintMount();
  printable.innerHTML = `<style>${getEmployeeReceiveReceiptStylesheet()}${WA_CAPTURE_STYLES}</style>${buildEmployeeReceiveReceiptBody(enriched)}`;
  Object.assign(printable.style, {
    display: 'block',
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${RECEIPT_CAPTURE_PX}px`,
    height: 'auto',
    overflow: 'visible',
    background: '#fff',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const sheet = printable.querySelector('.emp-rcv-sheet');
  if (!sheet) throw new Error('Receipt layout not found');
  sheet.classList.add('emp-rcv-wa-capture');
  return { printable, sheet, enriched };
}

export async function captureEmployeeReceiveReceiptCanvas(receipt, ctx = {}) {
  const { printable, sheet, enriched } = await mountReceiptForCapture(receipt, ctx);
  try {
    return {
      canvas: await captureReceiptTight(sheet),
      enriched,
    };
  } finally {
    unmountReceiptCapture(printable);
  }
}

/**
 * Fill balance_before/after from employee ledger when missing (e.g. printing from history).
 * @param {{ employeeOptions?: array }} ctx
 */
export async function enrichEmployeeReceiveReceipt(receipt, ctx = {}) {
  if (!receipt?.receipt_id) return receipt;

  const { employeeOptions = [] } = ctx;
  let employee = { ...(receipt.employee || {}) };
  const fullEmp = employeeOptions.find((e) => String(e.emp_id) === String(receipt.emp_id));
  if (fullEmp) {
    employee = { ...fullEmp, ...employee };
  }

  const billNo = receipt.ledger_bill_no || `EMP-RCV-${receipt.receipt_id}`;
  const hasBal =
    receipt.balance_before != null &&
    receipt.balance_after != null;

  const paymentMethodLabel =
    receipt.payment_mode === 'BANK_TRANSFER' || receipt.payment_mode === 'BANK'
      ? 'Bank transfer'
      : 'Cash';

  if (hasBal) {
    return {
      ...receipt,
      employee,
      payment_method_label: paymentMethodLabel,
    };
  }

  let balanceBefore = null;
  let balanceAfter = null;

  try {
    const empId = receipt.emp_id;
    if (empId) {
      const res = await fetch(`/api/employee-ledger?emp_id=${empId}&transactions=true&limit=200`);
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data)
          ? data
          : data?.entries || data?.transactions || [];
        const line = rows.find(
          (r) =>
            String(r.bill_no) === billNo ||
            String(r.bill_no) === String(receipt.ledger_bill_no)
        );
        if (line) {
          balanceBefore = line.opening_balance;
          balanceAfter = line.closing_balance;
        }
      }
    }
  } catch {
    /* optional enrichment */
  }

  return {
    ...receipt,
    employee,
    balance_before: balanceBefore ?? receipt.balance_before,
    balance_after: balanceAfter ?? receipt.balance_after,
    payment_method_label: paymentMethodLabel,
  };
}

export async function printEmployeeReceiveReceipt(receipt) {
  const enriched = await enrichEmployeeReceiveReceipt(receipt);
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(buildEmployeeReceiveReceiptPrintHtml(enriched));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    setTimeout(() => w.close(), 300);
  }, 350);
  return true;
}

export async function downloadEmployeeReceiveReceiptPdf(receipt) {
  const liveCapture = document.getElementById(EMP_RECEIVE_RECEIPT_CAPTURE_ID);
  let enriched = await enrichEmployeeReceiveReceipt(receipt);

  if (liveCapture) {
    const jsPDF = (await import('jspdf')).default;
    const canvas = await captureReceiptTight(liveCapture);
    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = 148;
    const pageH = 210;
    const imgData = canvas.toDataURL('image/png');
    let renderW = pageW;
    let renderH = (canvas.height * renderW) / canvas.width;
    if (renderH > pageH) {
      renderH = pageH;
      renderW = (canvas.width * renderH) / canvas.height;
    }
    const x = (pageW - renderW) / 2;
    doc.addImage(imgData, 'PNG', x, 0, renderW, renderH);
    doc.save(employeeReceiveReceiptFileName(enriched));
    return;
  }

  const { printable, sheet, enriched: row } = await mountReceiptForCapture(enriched);
  enriched = row;
  try {
    const jsPDF = (await import('jspdf')).default;
    const canvas = await captureReceiptTight(sheet);
    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = 148;
    const pageH = 210;
    const imgData = canvas.toDataURL('image/png');
    let renderW = pageW;
    let renderH = (canvas.height * renderW) / canvas.width;
    if (renderH > pageH) {
      renderH = pageH;
      renderW = (canvas.width * renderH) / canvas.height;
    }
    const x = (pageW - renderW) / 2;
    doc.addImage(imgData, 'PNG', x, 0, renderW, renderH);
    doc.save(employeeReceiveReceiptFileName(enriched));
  } finally {
    unmountReceiptCapture(printable);
  }
}

async function fetchEmployeePhoneForWhatsApp(empId) {
  const id = parseInt(empId, 10);
  if (!id) return null;
  try {
    const res = await fetch(`/api/employees?id=${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const emp = await res.json();
    return emp?.emp_phone || emp?.phone || null;
  } catch {
    return null;
  }
}

export async function shareEmployeeReceiveReceiptWhatsApp(receipt, ctx = {}) {
  const {
    shareCanvasViaWhatsAppDesktop,
    whatsAppSuccessMessage,
    formatWhatsAppPhone,
    resolveEmployeeWhatsAppPhone,
  } = await import('@/lib/whatsapp-local');

  const enriched = await enrichEmployeeReceiveReceipt(receipt, ctx);

  let phone = resolveEmployeeWhatsAppPhone(enriched.employee);
  if (!phone && receipt?.emp_id) {
    const fromApi = await fetchEmployeePhoneForWhatsApp(receipt.emp_id);
    if (fromApi) {
      phone = resolveEmployeeWhatsAppPhone({ emp_phone: fromApi });
      if (phone) {
        enriched.employee = { ...enriched.employee, emp_phone: fromApi };
      }
    }
  }
  if (!phone) {
    const manual = window.prompt(
      'Employee phone is missing or invalid.\nEnter WhatsApp number (e.g. 0300-7560306):',
      enriched.employee?.emp_phone || ''
    );
    if (!manual?.trim()) return { cancelled: true };
    phone = formatWhatsAppPhone(manual) || resolveEmployeeWhatsAppPhone({ emp_phone: manual });
    if (!phone) throw new Error('Invalid phone number. Use format 03XX-XXXXXXX');
  }

  const liveCapture = document.getElementById(EMP_RECEIVE_RECEIPT_CAPTURE_ID);
  let canvas;
  if (liveCapture) {
    canvas = await captureReceiptTight(liveCapture);
  } else {
    ({ canvas } = await captureEmployeeReceiveReceiptCanvas(receipt, ctx));
  }
  if (!canvas) throw new Error('Could not capture receipt');

  const { opened } = await shareCanvasViaWhatsAppDesktop(canvas, phone);
  return { opened, message: whatsAppSuccessMessage(opened) };
}
