'use client';

import {
  ADVANCE_VOUCHER_CAPTURE_ID,
  ADVANCE_VOUCHER_PRINT_MOUNT_ID,
  ADVANCE_VOUCHER_PREVIEW_ID,
  advanceVoucherFileName,
  buildAdvanceVoucherBody,
  buildAdvanceVoucherPrintHtml,
  getAdvanceVoucherStylesheet,
} from './advance-voucher-a5';

const WA_CAPTURE_STYLES = `
  .advance-voucher-sheet.adv-wa-capture {
    box-shadow: none !important;
    overflow: visible !important;
  }
`;

/** Tight PNG bounds — do not use whatsapp-local captureElementToCanvas (800px min width). */
async function captureAdvanceVoucherTight(sourceEl) {
  if (!sourceEl) throw new Error('Voucher element not found');

  const html2canvas = (await import('html2canvas')).default;
  const w = Math.ceil(sourceEl.scrollWidth || sourceEl.offsetWidth || 0);
  const h = Math.ceil(sourceEl.scrollHeight || sourceEl.offsetHeight || 0);
  if (w <= 0 || h <= 0) throw new Error('Voucher has no size — wait for preview to load');

  const clone = sourceEl.cloneNode(true);
  clone.removeAttribute('id');
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

function resolvePaymentMethodLabel(advance) {
  if (advance.payment_split) return 'Split (Cash + Bank)';
  if (advance.payment_method_label) return advance.payment_method_label;
  const mode = String(advance.payment_mode || 'CASH').toUpperCase();
  return mode === 'BANK_TRANSFER' || mode === 'BANK' ? 'Bank transfer' : 'Cash';
}

function parseReferenceFromLedgerDetails(details) {
  if (!details) return null;
  const m = details.match(/Ref:\s*([^·]+)/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {object} advance
 * @param {{ paymentAccounts?: array, employeeOptions?: array }} ctx
 */
export async function enrichAdvanceForVoucher(advance, ctx = {}) {
  if (!advance?.advance_id) return advance;

  const { paymentAccounts = [], employeeOptions = [] } = ctx;
  const billNo = advance.ledger_bill_no || `ADV-${advance.advance_id}`;

  let employee = { ...(advance.employee || {}) };
  const fullEmp = employeeOptions.find((e) => String(e.emp_id) === String(advance.emp_id));
  if (fullEmp) {
    employee = { ...fullEmp, ...employee };
  }

  let paymentLines = [];
  let referenceFromLedger = null;

  try {
    const res = await fetch(`/api/ledger?search=${encodeURIComponent(billNo)}&limit=30`);
    if (res.ok) {
      const entries = await res.json();
      const paymentEntries = (Array.isArray(entries) ? entries : []).filter(
        (e) =>
          String(e.bill_no) === billNo &&
          parseFloat(e.credit_amount || 0) > 0 &&
          String(e.ledger_type || '').toLowerCase().includes('salary advance')
      );
      paymentLines = paymentEntries.map((e) => {
        if (!referenceFromLedger) {
          referenceFromLedger = parseReferenceFromLedgerDetails(e.details);
        }
        const isBank = parseFloat(e.bank_payment || 0) > 0 && parseFloat(e.cash_payment || 0) === 0;
        const isSplitLine = parseFloat(e.cash_payment || 0) > 0 && parseFloat(e.bank_payment || 0) > 0;
        return {
          accountName: e.customer?.cus_name || 'Account',
          amount: parseFloat(e.credit_amount || 0),
          mode: isSplitLine ? 'Split' : isBank ? 'Bank' : 'Cash',
        };
      });
    }
  } catch {
    /* optional */
  }

  if (!paymentLines.length) {
    const acc = paymentAccounts.find((a) => String(a.cus_id) === String(advance.account_id));
    paymentLines = [
      {
        accountName: acc?.cus_name || 'Cash / Bank account',
        amount: parseFloat(advance.amount || 0),
        mode: resolvePaymentMethodLabel(advance).includes('Bank') ? 'Bank' : 'Cash',
      },
    ];
  }

  let employeeLedgerBalance = employee.ledger_balance;
  try {
    const elRes = await fetch(`/api/employee-ledger?emp_id=${advance.emp_id}`);
    if (elRes.ok) {
      const elData = await elRes.json();
      if (elData?.closing_balance != null) {
        employeeLedgerBalance = elData.closing_balance;
      } else if (elData?.ledger_balance != null) {
        employeeLedgerBalance = elData.ledger_balance;
      }
    }
  } catch {
    /* optional */
  }

  return {
    ...advance,
    ledger_bill_no: billNo,
    employee: {
      ...employee,
      ledger_balance: employeeLedgerBalance ?? employee.ledger_balance,
    },
    employee_ledger_balance_after: employeeLedgerBalance,
    payment_lines: paymentLines,
    payment_method_label: resolvePaymentMethodLabel(advance),
    payment_reference: advance.payment_reference || referenceFromLedger || null,
    reference_from_ledger: referenceFromLedger,
  };
}

function getPrintMount() {
  let el = document.getElementById(ADVANCE_VOUCHER_PRINT_MOUNT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = ADVANCE_VOUCHER_PRINT_MOUNT_ID;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

async function mountAdvanceVoucherForCapture(advance, ctx = {}) {
  const enriched = await enrichAdvanceForVoucher(advance, ctx);
  const printable = getPrintMount();
  printable.innerHTML = `<style>${getAdvanceVoucherStylesheet()}${WA_CAPTURE_STYLES}</style>${buildAdvanceVoucherBody(enriched)}`;
  Object.assign(printable.style, {
    display: 'block',
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: '148mm',
    height: 'auto',
    overflow: 'visible',
    background: '#fff',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const sheet = printable.querySelector('.advance-voucher-sheet');
  if (!sheet) throw new Error('Voucher layout not found');
  sheet.classList.add('adv-wa-capture');
  return { printable, sheet, enriched };
}

function unmountAdvanceCapture(printable) {
  if (!printable) return;
  printable.innerHTML = '';
  printable.style.display = 'none';
}

export async function captureAdvanceVoucherCanvas(advance, ctx = {}) {
  const { printable, sheet, enriched } = await mountAdvanceVoucherForCapture(advance, ctx);
  try {
    return {
      canvas: await captureAdvanceVoucherTight(sheet),
      enriched,
    };
  } finally {
    unmountAdvanceCapture(printable);
  }
}

export async function downloadAdvanceVoucherPdf(advance, ctx = {}) {
  const { printable, sheet, enriched } = await mountAdvanceVoucherForCapture(advance, ctx);
  try {
    const jsPDF = (await import('jspdf')).default;
    const canvas = await captureAdvanceVoucherTight(sheet);
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
    doc.save(advanceVoucherFileName(enriched));
  } finally {
    unmountAdvanceCapture(printable);
  }
}

export async function printAdvanceVoucher(advance, ctx) {
  const enriched = await enrichAdvanceForVoucher(advance, ctx);
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(buildAdvanceVoucherPrintHtml(enriched));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    setTimeout(() => w.close(), 300);
  }, 350);
  return true;
}

export async function shareAdvanceVoucherWhatsApp(advance, ctx) {
  const {
    shareCanvasViaWhatsAppDesktop,
    whatsAppSuccessMessage,
    formatWhatsAppPhone,
    resolveEmployeeWhatsAppPhone,
  } = await import('@/lib/whatsapp-local');

  const enriched = await enrichAdvanceForVoucher(advance, ctx);

  let phone = resolveEmployeeWhatsAppPhone(enriched.employee);
  if (!phone) {
    const manual = window.prompt(
      'Employee phone is missing or invalid.\nEnter WhatsApp number (e.g. 0300-7560306):',
      enriched.employee?.emp_phone || ''
    );
    if (!manual?.trim()) return { cancelled: true };
    phone = formatWhatsAppPhone(manual) || resolveEmployeeWhatsAppPhone({ emp_phone: manual });
    if (!phone) throw new Error('Invalid phone number. Use format 03XX-XXXXXXX');
  }

  const liveCapture = document.getElementById(ADVANCE_VOUCHER_CAPTURE_ID);
  let canvas;
  if (liveCapture) {
    canvas = await captureAdvanceVoucherTight(liveCapture);
  } else {
    ({ canvas } = await captureAdvanceVoucherCanvas(advance, ctx));
  }
  if (!canvas) throw new Error('Could not capture voucher');

  const { opened } = await shareCanvasViaWhatsAppDesktop(canvas, phone);
  return { opened, message: whatsAppSuccessMessage(opened) };
}

/** Capture from on-screen preview element (dialog open). */
export async function captureAdvancePreviewElement() {
  const root = document.getElementById(ADVANCE_VOUCHER_PREVIEW_ID);
  const sheet = root?.querySelector('.advance-voucher-sheet');
  if (!sheet) throw new Error('Open the voucher preview first');
  const html2canvas = (await import('html2canvas')).default;
  const w = Math.max(sheet.scrollWidth, sheet.offsetWidth, 559);
  const h = Math.max(sheet.scrollHeight, sheet.offsetHeight, 400);
  return html2canvas(sheet, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    width: w,
    height: h,
  });
}
