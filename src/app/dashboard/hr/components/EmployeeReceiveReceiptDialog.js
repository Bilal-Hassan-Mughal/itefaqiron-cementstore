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
import EmployeeReceiveReceiptSheet from './EmployeeReceiveReceiptSheet';
import {
  downloadEmployeeReceiveReceiptPdf,
  printEmployeeReceiveReceipt,
  shareEmployeeReceiveReceiptWhatsApp,
} from '../lib/employee-receive-receipt-actions';
import { EMP_RECEIVE_ACCENT } from '../lib/employee-receive-receipt-a5';

export default function EmployeeReceiveReceiptDialog({
  open,
  onClose,
  receipt,
  onNotify,
  employeeOptions = [],
}) {
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  const notify = (msg, severity = 'success') => {
    if (onNotify) onNotify(msg, severity);
  };

  const billNo = receipt?.ledger_bill_no || (receipt?.receipt_id ? `EMP-RCV-${receipt.receipt_id}` : '');

  async function handlePrint() {
    if (!receipt) return;
    setPrinting(true);
    try {
      const opened = await printEmployeeReceiveReceipt(receipt);
      if (opened === false) notify('Allow pop-ups to print A5 receipt', 'warning');
    } catch (err) {
      notify(err.message || 'Print failed', 'error');
    } finally {
      setPrinting(false);
    }
  }

  async function handlePdf() {
    if (!receipt) return;
    setDownloading(true);
    try {
      await downloadEmployeeReceiveReceiptPdf(receipt);
      notify('PDF downloaded', 'success');
    } catch (err) {
      notify(err.message || 'PDF download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleWhatsApp() {
    if (!receipt) return;
    setSendingWa(true);
    try {
      const result = await shareEmployeeReceiveReceiptWhatsApp(receipt, { employeeOptions });
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden', width: 'auto', maxWidth: '96vw' } }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${EMP_RECEIVE_ACCENT} 0%, #14b8a6 100%)`,
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1.25,
          px: 2,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLong />
          <Stack spacing={0}>
            <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Employee payment receipt
            </Typography>
            {billNo ? (
              <Typography component="span" sx={{ fontSize: '0.72rem', opacity: 0.92 }}>
                {billNo}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} size="small" aria-label="Close">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: '#f1f5f9' }}>
        {receipt ? (
          <EmployeeReceiveReceiptSheet receipt={receipt} employeeOptions={employeeOptions} />
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, bgcolor: '#f8fafc', gap: 1, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
          disabled={downloading || !receipt}
          onClick={handlePdf}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
        >
          {downloading ? 'Downloading…' : 'Download PDF'}
        </Button>
        <Button
          variant="contained"
          disabled={!receipt || sendingWa}
          onClick={handleWhatsApp}
          title="Copy receipt to clipboard and open WhatsApp Desktop"
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
          disabled={printing || !receipt}
          onClick={handlePrint}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: EMP_RECEIVE_ACCENT,
            '&:hover': { bgcolor: '#0f766e' },
          }}
        >
          Print A5
        </Button>
      </DialogActions>
    </Dialog>
  );
}
