/**
 * Local WhatsApp Desktop flow (no Twilio):
 * capture document → clipboard → whatsapp:// protocol
 */

export function formatWhatsAppPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10) digits = `92${digits}`;
  return digits;
}

export async function captureElementToCanvas(sourceEl) {
  if (!sourceEl) return null;

  const html2canvas = (await import('html2canvas')).default;
  const w = Math.max(sourceEl.scrollWidth || 0, sourceEl.offsetWidth || 0, 800);
  const h = Math.max(sourceEl.scrollHeight || 0, sourceEl.offsetHeight || 0, 200);

  const clone = sourceEl.cloneNode(true);
  clone.removeAttribute('id');
  Object.assign(clone.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    width: `${w}px`,
    minHeight: `${h}px`,
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    padding: '24px',
  });

  document.body.appendChild(clone);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    await new Promise((r) => setTimeout(r, 80));
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: w,
      height: Math.max(clone.scrollHeight, h),
    });
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }
}

export async function copyCanvasToClipboard(canvas) {
  if (!canvas || !navigator.clipboard?.write) {
    throw new Error('Clipboard is not supported in this browser');
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png');
  });

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function copyBlobToClipboard(blob, mimeType) {
  if (!blob || !navigator.clipboard?.write) {
    throw new Error('Clipboard is not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
}

export function openWhatsAppDesktop(phone, text = '') {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return false;

  const params = new URLSearchParams({ phone: formatted });
  if (text?.trim()) params.set('text', text.trim());

  const anchor = document.createElement('a');
  anchor.href = `whatsapp://send?${params.toString()}`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}

export function whatsAppSuccessMessage(opened) {
  if (opened) {
    return 'Copied to clipboard! WhatsApp opened.';
  }
  return 'Copied to clipboard! Open WhatsApp to send.';
}

/** Capture DOM element by id/ref, copy PNG to clipboard, open WhatsApp Desktop. */
export async function shareViaWhatsAppDesktop({ elementId, element, phone }) {
  const sourceEl = element ?? (elementId ? document.getElementById(elementId) : null);
  if (!sourceEl) throw new Error('Preview not found');

  const canvas = await captureElementToCanvas(sourceEl);
  if (!canvas) throw new Error('Could not capture document');

  await copyCanvasToClipboard(canvas);
  const opened = openWhatsAppDesktop(phone);
  return { opened, copied: true };
}

/** Copy an existing canvas PNG to clipboard and open WhatsApp Desktop. */
export async function shareCanvasViaWhatsAppDesktop(canvas, phone) {
  await copyCanvasToClipboard(canvas);
  const opened = openWhatsAppDesktop(phone);
  return { opened, copied: true };
}

/** Copy jsPDF document to clipboard and open WhatsApp Desktop. */
export async function sharePdfViaWhatsAppDesktop(pdfDoc, phone) {
  const blob = pdfDoc.output('blob');
  try {
    await copyBlobToClipboard(blob, 'application/pdf');
  } catch {
    throw new Error('Could not copy PDF to clipboard — use Chrome or Edge');
  }
  const opened = openWhatsAppDesktop(phone);
  return { opened, copied: true };
}
