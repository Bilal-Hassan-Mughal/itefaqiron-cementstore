'use client';

import { useCallback, useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Mail, Shield, Store } from 'lucide-react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BRANCH_LOGIN_PORTAL,
  buildBranchLoginUrl,
  formatBranchLoginCredentialsText,
  formatRoleLabel,
} from '@/lib/branch-login-credentials';

async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState(null);

  const copy = useCallback(async (key, text) => {
    await copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  return { copiedKey, copy };
}

function CopyBtn({ fieldKey, value, copiedKey, onCopy, className = '', size = 16 }) {
  const done = copiedKey === fieldKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(fieldKey, value)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
        done
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-white/80 text-slate-600 hover:bg-white hover:text-indigo-700 border border-slate-200'
      } ${className}`}
      title="Copy to clipboard"
    >
      {done ? <Check size={size} /> : <Copy size={size} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function MuiCopyBtn({ fieldKey, value, copiedKey, onCopy, label = 'Copy' }) {
  const done = copiedKey === fieldKey;
  return (
    <Tooltip title={done ? 'Copied!' : 'Copy to clipboard'}>
      <IconButton
        size="small"
        onClick={() => onCopy(fieldKey, value)}
        color={done ? 'success' : 'default'}
        sx={{ ml: 0.5 }}
      >
        {done ? <Check size={16} /> : <Copy size={16} />}
      </IconButton>
    </Tooltip>
  );
}

function CredentialRowTailwind({ label, value, fieldKey, mono, copiedKey, onCopy, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
          {Icon && <Icon size={12} />}
          {label}
        </div>
        <p className={`text-sm text-slate-900 break-all ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
      </div>
      <CopyBtn fieldKey={fieldKey} value={value} copiedKey={copiedKey} onCopy={onCopy} />
    </div>
  );
}

function CredentialRowMui({ label, value, fieldKey, mono, copiedKey, onCopy }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', py: 1.25, gap: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ wordBreak: 'break-all', fontFamily: mono ? 'monospace' : undefined }}
        >
          {value}
        </Typography>
      </Box>
      <MuiCopyBtn fieldKey={fieldKey} value={value} copiedKey={copiedKey} onCopy={onCopy} />
    </Box>
  );
}

/**
 * Professional branch login credentials card with per-field and copy-all actions.
 * @param {{ variant?: 'tailwind'|'mui', credentials: object, title?: string, subtitle?: string, compact?: boolean, onClose?: () => void }} props
 */
export default function BranchLoginCredentialsPanel({
  variant = 'tailwind',
  credentials,
  title = 'Branch Login Credentials',
  subtitle = 'Share these details securely with the user. Password is shown only at creation time.',
  compact = false,
  onClose,
}) {
  const { copiedKey, copy } = useCopyFeedback();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portal = credentials.portal || BRANCH_LOGIN_PORTAL;
  const loginUrl = buildBranchLoginUrl(origin, portal);
  const allText = formatBranchLoginCredentialsText(credentials, origin);

  const handleCopyAll = () => copy('all', allText);

  if (variant === 'mui') {
    return (
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          borderColor: '#c7d2fe',
          bgcolor: '#f8fafc',
        }}
      >
        <Box sx={{ px: 2.5, py: 2, background: 'linear-gradient(135deg, #4338ca 0%, #0284c7 100%)', color: 'white' }}>
          <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
          {!compact && (
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mt: 0.5 }}>{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{ px: 2.5, py: 1.5 }}>
          <CredentialRowMui label="Branch code" value={credentials.branchCode} fieldKey="code" mono copiedKey={copiedKey} onCopy={copy} />
          <CredentialRowMui label="Login URL" value={loginUrl} fieldKey="url" mono copiedKey={copiedKey} onCopy={copy} />
          {credentials.fullName && (
            <CredentialRowMui label="Full name" value={credentials.fullName} fieldKey="name" copiedKey={copiedKey} onCopy={copy} />
          )}
          {credentials.role && (
            <CredentialRowMui label="Role" value={formatRoleLabel(credentials.role)} fieldKey="role" copiedKey={copiedKey} onCopy={copy} />
          )}
          <CredentialRowMui label="Email" value={credentials.email} fieldKey="email" mono copiedKey={copiedKey} onCopy={copy} />
          {credentials.password && (
            <CredentialRowMui label="Password" value={credentials.password} fieldKey="password" mono copiedKey={copiedKey} onCopy={copy} />
          )}
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="contained"
              startIcon={copiedKey === 'all' ? <Check size={16} /> : <Copy size={16} />}
              onClick={handleCopyAll}
              color={copiedKey === 'all' ? 'success' : 'primary'}
            >
              {copiedKey === 'all' ? 'Copied all' : 'Copy all credentials'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ExternalLink size={16} />}
              href={portal}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Branch Login
            </Button>
            {onClose && (
              <Button size="small" onClick={onClose}>Done</Button>
            )}
          </Box>
          {credentials.password && (
            <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 1.5 }}>
              Save the password now — it will not be shown again after you close this panel.
            </Typography>
          )}
        </Box>
      </Paper>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 overflow-hidden shadow-sm bg-white">
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
        <h3 className="text-lg font-bold">{title}</h3>
        {!compact && <p className="text-sm text-indigo-100 mt-1">{subtitle}</p>}
      </div>
      <div className="px-5 py-3">
        <CredentialRowTailwind label="Branch code" value={credentials.branchCode} fieldKey="code" mono copiedKey={copiedKey} onCopy={copy} icon={Store} />
        <CredentialRowTailwind label="Login URL" value={loginUrl} fieldKey="url" mono copiedKey={copiedKey} onCopy={copy} icon={ExternalLink} />
        {credentials.fullName && (
          <CredentialRowTailwind label="Full name" value={credentials.fullName} fieldKey="name" copiedKey={copiedKey} onCopy={copy} icon={Shield} />
        )}
        {credentials.role && (
          <CredentialRowTailwind label="Role" value={formatRoleLabel(credentials.role)} fieldKey="role" copiedKey={copiedKey} onCopy={copy} icon={Shield} />
        )}
        <CredentialRowTailwind label="Email" value={credentials.email} fieldKey="email" mono copiedKey={copiedKey} onCopy={copy} icon={Mail} />
        {credentials.password && (
          <CredentialRowTailwind label="Password" value={credentials.password} fieldKey="password" mono copiedKey={copiedKey} onCopy={copy} icon={KeyRound} />
        )}
        <div className="flex flex-wrap gap-2 pt-4 mt-1">
          <button
            type="button"
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              copiedKey === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
            }`}
          >
            {copiedKey === 'all' ? <Check size={16} /> : <Copy size={16} />}
            {copiedKey === 'all' ? 'Copied all' : 'Copy all credentials'}
          </button>
          <a
            href={portal}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={16} /> Open Branch Login
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Done
            </button>
          )}
        </div>
        {credentials.password && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Save the password now — it will not be shown again after you close this panel.
          </p>
        )}
      </div>
    </div>
  );
}

/** Small inline branch code chip with copy — tailwind */
export function BranchCodeCopyChip({ branchCode, className = '' }) {
  const { copiedKey, copy } = useCopyFeedback();
  if (!branchCode) return null;
  const done = copiedKey === 'code';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-mono font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">
        {branchCode}
      </span>
      <CopyBtn fieldKey="code" value={branchCode} copiedKey={copiedKey} onCopy={copy} />
    </span>
  );
}

/** MUI branch code row with copy */
export function BranchCodeCopyRow({ branchCode, label = 'Branch code (for login)' }) {
  const { copiedKey, copy } = useCopyFeedback();
  if (!branchCode) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {label ? (
        <Typography variant="body2" color="text.secondary">{label}:</Typography>
      ) : null}
      <Chip label={branchCode} color="primary" size="small" sx={{ fontWeight: 800, fontFamily: 'monospace' }} />
      <Button
        size="small"
        variant="outlined"
        startIcon={copiedKey === 'code' ? <Check size={14} /> : <Copy size={14} />}
        onClick={() => copy('code', branchCode)}
        color={copiedKey === 'code' ? 'success' : 'primary'}
      >
        {copiedKey === 'code' ? 'Copied' : 'Copy code'}
      </Button>
    </Box>
  );
}
