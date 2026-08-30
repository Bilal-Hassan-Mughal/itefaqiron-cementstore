'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import { Building2, CheckCircle2, Database, Server, ShieldCheck, Users } from 'lucide-react';

const CREATE_STATUS_MESSAGES = [
  'Creating dedicated store tables (sales, stock, ledger…)',
  'Provisioning branch database structure…',
  'Setting up branch record and login accounts…',
  'Almost done — finalizing branch setup…',
];

const SETUP_STEPS = [
  { icon: Database, label: 'Store tables' },
  { icon: Server, label: 'Database' },
  { icon: Building2, label: 'Branch record' },
  { icon: Users, label: 'Admin login' },
];

function BranchLoaderRing() {
  return (
    <Box sx={{ position: 'relative', width: 96, height: 96, mx: 'auto', mb: 3 }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid #e0e7ff',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#4338ca',
          borderRightColor: '#6366f1',
          animation: 'hqSpin 1.1s linear infinite',
          '@keyframes hqSpin': { to: { transform: 'rotate(360deg)' } },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 10,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #eef2ff 0%, #e0e7ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 8px rgba(67,56,202,0.08)',
        }}
      >
        <Building2 size={32} color="#4338ca" strokeWidth={2.2} />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: -6,
          borderRadius: '50%',
          border: '2px solid rgba(99,102,241,0.15)',
          animation: 'hqPulse 2s ease-in-out infinite',
          '@keyframes hqPulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.6 },
            '50%': { transform: 'scale(1.06)', opacity: 0.2 },
          },
        }}
      />
    </Box>
  );
}

export function BranchCreatingLoader({ label, statusIdx }) {
  const [progress, setProgress] = useState(8);
  const stepIndex = statusIdx ?? 0;
  const message = CREATE_STATUS_MESSAGES[stepIndex] ?? CREATE_STATUS_MESSAGES[0];

  useEffect(() => {
    const targets = [18, 42, 68, 88];
    setProgress(targets[stepIndex] ?? 8);
  }, [stepIndex]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setProgress((p) => {
        const cap = [28, 52, 78, 94][stepIndex] ?? 94;
        if (p >= cap) return p;
        return p + (stepIndex >= 3 ? 0.4 : 0.9);
      });
    }, 400);
    return () => window.clearInterval(tick);
  }, [stepIndex]);

  return (
    <>
      {/* Gradient header strip */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          background: 'linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: '0.12em', fontWeight: 700 }}>
          Head Office Setup
        </Typography>
        <Typography variant="h6" fontWeight={800} sx={{ mt: 0.25 }}>
          Creating Branch — Please Wait
        </Typography>
      </Box>

      <DialogContent sx={{ pb: 3.5, pt: 3, px: 3 }}>
        <BranchLoaderRing />

        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          {label && (
            <Chip
              label={label}
              sx={{
                mb: 1.5,
                fontWeight: 800,
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                bgcolor: '#eef2ff',
                color: '#3730a3',
                border: '1px solid #c7d2fe',
              }}
            />
          )}
          <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            {label ? `Setting up ${label}` : 'Setting up new branch'}
          </Typography>
          <Typography
            key={message}
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.75,
              maxWidth: 340,
              mx: 'auto',
              minHeight: 40,
              animation: 'hqFadeIn 0.45s ease',
              '@keyframes hqFadeIn': {
                from: { opacity: 0, transform: 'translateY(6px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            {message}
          </Typography>
        </Box>

        {/* Step indicators */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            mb: 2.5,
            p: 1.5,
            bgcolor: '#f8fafc',
            borderRadius: 2.5,
            border: '1px solid #e2e8f0',
          }}
        >
          {SETUP_STEPS.map(({ icon: Icon, label: stepLabel }, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <Box key={stepLabel} sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    mx: 'auto',
                    mb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: done ? '#dcfce7' : active ? '#eef2ff' : '#f1f5f9',
                    border: `2px solid ${done ? '#86efac' : active ? '#818cf8' : '#e2e8f0'}`,
                    color: done ? '#16a34a' : active ? '#4338ca' : '#94a3b8',
                    transition: 'all 0.35s ease',
                    ...(active && {
                      boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
                      animation: 'hqStepPulse 1.5s ease-in-out infinite',
                      '@keyframes hqStepPulse': {
                        '0%, 100%': { boxShadow: '0 0 0 4px rgba(99,102,241,0.15)' },
                        '50%': { boxShadow: '0 0 0 7px rgba(99,102,241,0.08)' },
                      },
                    }),
                  }}
                >
                  {done ? <CheckCircle2 size={18} /> : <Icon size={17} />}
                </Box>
                <Typography
                  variant="caption"
                  fontWeight={active ? 800 : 600}
                  sx={{
                    color: done ? '#16a34a' : active ? '#4338ca' : '#94a3b8',
                    fontSize: '0.65rem',
                    lineHeight: 1.2,
                    display: 'block',
                  }}
                >
                  {stepLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Progress bar with percentage */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Setup progress
            </Typography>
            <Typography variant="caption" fontWeight={800} sx={{ color: '#4338ca' }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{
              height: 8,
              borderRadius: 99,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 99,
                background: 'linear-gradient(90deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
                transition: 'transform 0.5s ease',
              },
            }}
          />
        </Box>

        <Alert
          severity="warning"
          icon={<ShieldCheck size={18} />}
          sx={{
            borderRadius: 2.5,
            bgcolor: '#fffbeb',
            border: '1px solid #fde68a',
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Typography variant="body2" sx={{ color: '#92400e' }}>
            <strong>Do not close this window.</strong> Table creation can take{' '}
            <strong>30–90 seconds</strong> depending on server speed.
          </Typography>
        </Alert>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            mt: 2,
            pt: 1.5,
            borderTop: '1px dashed #e2e8f0',
          }}
        >
          <Database size={15} color="#6366f1" />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Creating isolated store tables for this branch
          </Typography>
        </Box>
      </DialogContent>
    </>
  );
}

export function BranchCreateForm({ form, setForm, creating, onCancel, onSubmit }) {
  return (
    <>
      <Box
        sx={{
          px: 3,
          py: 2,
          background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h6" fontWeight={800}>Create New Shop Branch</Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Isolated tables + branch admin login
        </Typography>
      </Box>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5, px: 3 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Each branch receives its own isolated store tables and branch login credentials.
          Table setup may take up to a minute — a progress screen will appear after you click Create.
        </Alert>

        <TextField
          label="Branch Code *"
          placeholder="e.g. LHR, KHI, GRT01"
          value={form.branch_code}
          onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
          required
          helperText="Unique uppercase branch identifier for staff login"
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <TextField
          label="Shop Branch Name *"
          placeholder="e.g. Lahore Main Outlet"
          value={form.branch_name}
          onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
          required
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <TextField
          label="Physical Address"
          placeholder="e.g. GT Road, Gujrat"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <TextField
          label="Contact Phone"
          placeholder="e.g. 0346-7560306"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.5, color: '#334155' }}>
          Branch Administrator Credentials
        </Typography>

        <TextField
          label="Admin Full Name"
          placeholder="e.g. Branch Manager"
          value={form.admin_full_name}
          onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <TextField
          label="Admin Email *"
          type="email"
          placeholder="manager@branch.com"
          required
          value={form.admin_email}
          onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />

        <TextField
          label="Admin Password *"
          type="password"
          required
          value={form.admin_password}
          onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
          helperText="Minimum 6 characters"
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f8fafc' } }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button onClick={onCancel} disabled={creating} sx={{ fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={
            creating ||
            !form.branch_code.trim() ||
            !form.branch_name.trim() ||
            !form.admin_email.trim() ||
            form.admin_password.trim().length < 6
          }
          sx={{
            fontWeight: 800,
            borderRadius: 2,
            px: 3,
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
          }}
        >
          {creating ? 'Creating Shop…' : 'Create Shop Branch'}
        </Button>
      </DialogActions>
    </>
  );
}

export { CREATE_STATUS_MESSAGES };
