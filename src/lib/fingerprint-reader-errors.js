/**
 * Human-readable messages for DigitalPersona / HID reader HRESULT codes.
 * 0x80070057 = E_INVALIDARG — usually wrong driver (WBF) or reader busy.
 */
const READER_ERROR_MESSAGES = {
  '0x80070057': 'Invalid scanner configuration. Install the Legacy (Non-WBF) U.are.U 4500 driver, not the Windows Hello (WBF) driver. Close other apps using the reader, then replug USB.',
  '80070057': 'Invalid scanner configuration. Install the Legacy (Non-WBF) U.are.U 4500 driver, not the Windows Hello (WBF) driver. Close other apps using the reader, then replug USB.',
  '0x800706b3': 'DigitalPersona service not running. Restart the HID Authentication Device Client and replug the scanner.',
  '800706b3': 'DigitalPersona service not running. Restart the HID Authentication Device Client and replug the scanner.',
};

export function translateReaderError(code) {
  if (code == null || code === '') return 'Unknown reader error.';
  const key = String(code).trim().toLowerCase();
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  const plain = normalized.replace(/^0x/, '');

  for (const [k, msg] of Object.entries(READER_ERROR_MESSAGES)) {
    if (k.toLowerCase() === normalized || k.toLowerCase() === plain) return msg;
  }

  return `Reader error (${code}). Check USB connection, HID Client, and Legacy Non-WBF driver.`;
}
