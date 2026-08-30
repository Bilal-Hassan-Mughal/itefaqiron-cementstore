'use client';

import { useState } from 'react';
import {
  Paper, Typography, Box, Divider, Chip, TextField, Button, Grid,
  Alert, Snackbar, CircularProgress, InputAdornment, IconButton
} from '@mui/material';
import { Settings, Shield, Building2, Key, Eye, EyeOff, CheckCircle2, Copy } from 'lucide-react';
import HqPageHeader from '../components/hq-page-header';
import { useHqSession } from '../components/use-hq-session';
import { branchFetch } from '@/lib/branch-client';

export default function HqSettingsPage() {
  const { user, ready } = useHqSession();

  // Password update form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordErrorSuccess] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!user) return;

    setPasswordError('');
    setPasswordErrorSuccess('');

    if (!currentPassword.trim()) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await branchFetch(user, '/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setPasswordErrorSuccess('HQ Administrator password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCopyBranchPortalUrl = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  if (!ready || !user) return null;

  return (
    <>
      <HqPageHeader
        icon={Settings}
        title="HQ Settings & Security"
        subtitle="Manage Head Office security credentials, update administrator password, and view multi-branch system configuration."
      />

      <Grid container spacing={3}>
        {/* Section 1: Password Update Form */}
        <Grid item xs={12} md={6}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 3,
              borderColor: '#e2e8f0',
              bgcolor: 'white',
              boxShadow: '0 2px 12px rgba(15,23,42,0.03)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Key size={20} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                  Update HQ Password
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Change your Head Office administrator account password
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {passwordError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setPasswordError('')}>
                {passwordError}
              </Alert>
            )}

            {passwordSuccess && (
              <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setPasswordErrorSuccess('')}>
                {passwordSuccess}
              </Alert>
            )}

            <form onSubmit={handleUpdatePassword}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowCurrent(!showCurrent)} edge="end">
                          {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="New Password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  helperText="Minimum 6 characters long"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNew(!showNew)} edge="end">
                          {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={savingPassword}
                  sx={{
                    py: 1.2,
                    fontWeight: 700,
                    borderRadius: 2.5,
                    bgcolor: '#4338ca',
                    '&:hover': { bgcolor: '#3730a3' },
                    boxShadow: '0 4px 14px rgba(67,56,202,0.3)',
                  }}
                >
                  {savingPassword ? <CircularProgress size={22} color="inherit" /> : 'Update Password Now'}
                </Button>
              </Box>
            </form>
          </Paper>
        </Grid>

        {/* Section 2: Account Details & System Config */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Account Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                borderColor: '#e2e8f0',
                bgcolor: 'white',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: '#dcfce7',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={20} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                    HQ Account Profile
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active session identity details
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 2.5 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Administrator Name
                  </Typography>
                  <Typography fontWeight={700} sx={{ color: '#0f172a' }}>
                    {user.full_name || 'System Owner'}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Email Address
                  </Typography>
                  <Typography fontWeight={700} sx={{ color: '#0f172a' }}>
                    {user.email}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    System Role
                  </Typography>
                  <Chip
                    size="small"
                    label={user.role?.replace(/_/g, ' ')}
                    color="primary"
                    sx={{ fontWeight: 800, mt: 0.5 }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Security Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <Typography variant="caption" fontWeight={700} color="#16a34a">
                      Verified Active HQ Session
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* System Info Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                borderColor: '#e2e8f0',
                bgcolor: 'white',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: '#f1f5f9',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={20} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                    System Isolation & Login Details
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Multi-tenant architecture information
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="body2" color="text.secondary" paragraph>
                Each store branch maintains distinct data isolation (Logical or Physical tables). Branch staff sign in via the main landing page Branch tab using their Branch Code.
              </Typography>

              <Box
                sx={{
                  p: 2,
                  bgcolor: '#f8fafc',
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Branch Login Portal URL
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={copiedUrl ? <CheckCircle2 size={14} color="#16a34a" /> : <Copy size={14} />}
                  onClick={handleCopyBranchPortalUrl}
                  sx={{ borderRadius: 2 }}
                >
                  {copiedUrl ? 'Copied' : 'Copy Link'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
