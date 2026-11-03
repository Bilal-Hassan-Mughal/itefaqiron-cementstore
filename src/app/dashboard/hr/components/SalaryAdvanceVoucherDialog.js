'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Stack,
  Box,
  CircularProgress,
} from '@mui/material';
import { Close, Download, Print, ReceiptLong } from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import SalaryAdvanceVoucherSheet from './SalaryAdvanceVoucherSheet';
import {
  downloadAdvanceVoucherPdf,
  printAdvanceVoucher,
  shareAdvanceVoucherWhatsApp,
} from '../lib/advance-voucher-actions';

const NAVY = '#0f172a';
const PRIMARY = BRAND.primary.blue;
const ADVANCE = '#b45309';

export default function SalaryAdvanceVoucherDialog({
  open,
  onClose,
  advance,
  paymentAccounts = [],
  employeeOptions = [],
  onNotify,
}) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  const notify = (msg, severity = 'success') => {
    if (onNotify) onNotify(msg, severity);
  };

  const ctx = { paymentAccounts, employeeOptions };

  async function handlePrint() {
    if (!advance) return;
    setPrinting(true);
    try {
      const opened = await printAdvanceVoucher(advance, ctx);
      if (opened === false) notify('Allow pop-ups to print A5 voucher', 'warning');
    } catch (err) {
      notify(err.message || 'Print failed', 'error');
    } finally {
      setPrinting(false);
    }
  }

  async function handlePdf() {
    if (!advance) return;
    setDownloading(true);
    try {
      await downloadAdvanceVoucherPdf(advance, ctx);
      notify('PDF downloaded', 'success');
    } catch (err) {
      notify(err.message || 'PDF download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleWhatsApp() {
    if (!advance) return;
    setSendingWa(true);
    try {
      const result = await shareAdvanceVoucherWhatsApp(advance, ctx);
      if (result?.cancelled) {
        notify('WhatsApp cancelled — phone number required', 'info');
        return;
      }
      notify(`✅ ${result.message}`, 'success');
    } catch (err) {
      notify(`❌ WhatsApp error: ${err.message}`, 'error');
    } finally {
      setSendingWa(false);
    }
  }

  const billNo = advance?.ledger_bill_no || (advance?.advance_id ? `ADV-${advance.advance_id}` : '');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden', width: 'auto', maxWidth: '96vw' } }}
    >
      <DialogTitle
        sx={{
          bgcolor: NAVY,
          color: '#fff',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <ReceiptLong />
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: '1rem', lineHeight: 1.2 }}>
              Advance Payment Voucher · A5
            </Typography>
            {advance && (
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 600 }}>
                {advance.employee?.emp_name || 'Employee'} · {billNo}
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} aria-label="Close">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, bgcolor: '#94a3b8', maxHeight: '82vh', overflow: 'auto' }}>
        {advance && (
          <SalaryAdvanceVoucherSheet
            advance={advance}
            paymentAccounts={paymentAccounts}
            employeeOptions={employeeOptions}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, bgcolor: '#fafbfd', borderTop: '1px solid #e8edf4', gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
          disabled={downloading || !advance}
          onClick={handlePdf}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
        >
          {downloading ? 'Downloading…' : 'Download PDF'}
        </Button>
        <Button
          variant="contained"
          disabled={!advance || sendingWa}
          onClick={handleWhatsApp}
          title="Copy voucher to clipboard and open WhatsApp Desktop"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: '#25D366',
            color: '#fff',
            '&:hover': { bgcolor: '#1da851' },
          }}
        >
          {sendingWa ? 'Copying…' : '📲 WhatsApp'}
        </Button>
        <Button
          variant="contained"
          startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <Print />}
          disabled={!advance || printing}
          onClick={handlePrint}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: PRIMARY,
            '&:hover': { bgcolor: '#1547c4' },
          }}
        >
          Print A5
        </Button>
      </DialogActions>
    </Dialog>
  );
}
