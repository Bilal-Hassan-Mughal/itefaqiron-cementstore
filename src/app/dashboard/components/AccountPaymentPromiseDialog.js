'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  Chip,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Calendar, CheckCircle2, XCircle, BellOff } from 'lucide-react';
import {
  formatPromiseDate,
  getPromiseBalanceMeta,
  getPromiseUrgency,
  PROMISE_STATUS,
  shouldSuppressBalanceReminder,
} from '@/lib/account-payment-promise';

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function getCurrentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.user_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Reusable payment-promise panel for any screen that shows an account/customer.
 * Set commit date → suppress auto balance reminders while ACTIVE; fulfill or cancel to clear.
 */
export default function AccountPaymentPromiseDialog({
  open,
  onClose,
  customer,
  onChanged,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [promisedPayDate, setPromisedPayDate] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  const cusId = customer?.cus_id;
  const balance = parseFloat(customer?.cus_balance ?? 0) || 0;
  const balanceMeta = getPromiseBalanceMeta(balance);
  const urgency = getPromiseUrgency(active?.promised_pay_date || promisedPayDate);

  const setQuickDue = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setPromisedPayDate(d.toISOString().slice(0, 10));
  };

  const loadPromise = useCallback(async () => {
    if (!cusId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/payment-promise?cus_id=${cusId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          open: true,
          message: data.error || 'Could not load payment promise',
          severity: 'error',
        });
        return;
      }
      setActive(data.active || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      if (data.active) {
        setPromisedPayDate(toInputDate(data.active.promised_pay_date));
        setPromisedAmount(
          data.active.promised_amount != null && data.active.promised_amount !== ''
            ? String(data.active.promised_amount)
            : '',
        );
        setNote(data.active.note || '');
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 7);
        setPromisedPayDate(toInputDate(tomorrow));
        setPromisedAmount(balance !== 0 ? String(Math.abs(balance)) : '');
        setNote('');
      }
    } catch {
      setFeedback({ open: true, message: 'Network error loading promise', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [cusId, balance]);

  useEffect(() => {
    if (open && cusId) loadPromise();
  }, [open, cusId, loadPromise]);

  const notifyParent = (promise) => {
    onChanged?.({ cusId, active: shouldSuppressBalanceReminder(promise) ? promise : null });
  };

  const handleSave = async () => {
    if (!promisedPayDate) {
      setFeedback({ open: true, message: 'Please choose a committed payment date', severity: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers/payment-promise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cus_id: cusId,
          promised_pay_date: promisedPayDate,
          promised_amount: promisedAmount === '' ? null : promisedAmount,
          note,
          created_by: getCurrentUserId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ open: true, message: data.error || 'Save failed', severity: 'error' });
        return;
      }
      setActive(data.promise);
      setFeedback({
        open: true,
        message: 'Payment commitment saved — balance auto-reminders paused until paid or removed',
        severity: 'success',
      });
      notifyParent(data.promise);
      await loadPromise();
    } catch {
      setFeedback({ open: true, message: 'Network error while saving', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePatch = async (action) => {
    if (!active?.promise_id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/customers/payment-promise', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promise_id: active.promise_id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ open: true, message: data.error || 'Update failed', severity: 'error' });
        return;
      }
      setActive(null);
      setFeedback({
        open: true,
        message:
          action === 'fulfill'
            ? 'Marked as paid — reminders can resume for this account'
            : 'Commitment removed — reminders can resume',
        severity: 'success',
      });
      notifyParent(null);
      await loadPromise();
    } catch {
      setFeedback({ open: true, message: 'Network error', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1, bgcolor: '#1A55E3', color: 'white' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Calendar className="w-5 h-5" />
          <span style={{ fontWeight: 800 }}>Payment commitment</span>
        </Stack>
        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, opacity: 0.95 }}>
          {customer.cus_name} · Account #{customer.cus_id}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#f8fafc' }}>
        {feedback.open && (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback((f) => ({ ...f, open: false }))}
            sx={{ mb: 2 }}
          >
            {feedback.message}
          </Alert>
        )}

        {loading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={32} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            {active && shouldSuppressBalanceReminder(active) && (
              <Alert
                icon={<BellOff className="w-5 h-5" />}
                severity="info"
                sx={{ '& .MuiAlert-message': { width: '100%' } }}
              >
                <Typography variant="body2" fontWeight={700}>
                  Auto balance WhatsApp is paused
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Until {formatPromiseDate(active.promised_pay_date)} or you mark paid / remove this commitment.
                </Typography>
              </Alert>
            )}

            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              sx={{ p: 1.5, borderRadius: 2, border: '1px solid #dce3ed', bgcolor: 'white' }}
            >
              <Chip
                size="small"
                label={`Rs. ${Math.abs(balance).toLocaleString('en-PK', { maximumFractionDigits: 2 })} · ${balanceMeta.label}`}
                sx={{ fontWeight: 700, borderColor: '#c5d4f0' }}
                variant="outlined"
              />
              {active?.status === PROMISE_STATUS.ACTIVE && (
                <Chip size="small" color="primary" label={`Due ${formatPromiseDate(active.promised_pay_date)}`} />
              )}
              {urgency.id !== 'none' && (
                <Chip size="small" variant="outlined" label={urgency.label} sx={{ fontWeight: 700 }} />
              )}
              {active?.whatsapp_reminder_sent_at && (
                <Chip size="small" color="success" variant="outlined" label="WhatsApp sent" />
              )}
            </Stack>

            <TextField
              label="Committed payment date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={promisedPayDate}
              onChange={(e) => setPromisedPayDate(e.target.value)}
              disabled={saving}
            />
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {[
                { d: 0, l: 'Today' },
                { d: 3, l: '+3 days' },
                { d: 7, l: '+7 days' },
                { d: 15, l: '+15 days' },
                { d: 30, l: '+30 days' },
              ].map((q) => (
                <Button key={q.l} size="small" variant="outlined" disabled={saving} onClick={() => setQuickDue(q.d)}>
                  {q.l}
                </Button>
              ))}
            </Stack>
            <TextField
              label="Amount (optional)"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: '0.01' }}
              value={promisedAmount}
              onChange={(e) => setPromisedAmount(e.target.value)}
              disabled={saving}
            />
            <TextField
              label="Note (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
            />

            {history.length > 0 && (
              <>
                <Divider />
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                  Recent history
                </Typography>
                <List dense disablePadding sx={{ bgcolor: 'white', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                  {history.slice(0, 5).map((row) => (
                    <ListItem key={row.promise_id} divider>
                      <ListItemText
                        primary={`${formatPromiseDate(row.promised_pay_date)} · ${row.status}`}
                        secondary={row.note || undefined}
                        primaryTypographyProps={{ fontSize: 12, fontWeight: 600 }}
                        secondaryTypographyProps={{ fontSize: 11 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {active?.status === PROMISE_STATUS.ACTIVE && (
            <>
              <Button
                startIcon={<CheckCircle2 className="w-4 h-4" />}
                color="primary"
                variant="contained"
                disabled={saving}
                onClick={() => handlePatch('fulfill')}
              >
                Mark paid
              </Button>
              <Button
                startIcon={<XCircle className="w-4 h-4" />}
                color="inherit"
                variant="outlined"
                disabled={saving}
                onClick={() => handlePatch('cancel')}
              >
                Remove
              </Button>
            </>
          )}
          <Button variant="contained" disabled={saving || loading} onClick={handleSave}>
            {active ? 'Update commitment' : 'Save commitment'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
