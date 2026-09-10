'use client';

import { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { getCreatedByName } from '@/lib/date-helper';
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  DollarSign,
  Search,
  Hash,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  Eye,
  CreditCard,
  Banknote,
  Printer as Print,
  Download,
  Minimize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
import SaveProgressBackdrop from '../components/save-progress-backdrop';
import { BRAND, COMPANY } from '@/lib/brand-theme';

// Material-UI imports
import {

  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Divider,
  CardHeader,
  CardActions,
  TablePagination,
  Chip as MuiChip,
  LinearProgress
} from '@mui/material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const customerOptionKey = (option) => String(option?.cus_id ?? '');
const isSameCustomerOption = (a, b) => Number(a?.cus_id) === Number(b?.cus_id);

const LEDGER_FILTER_OUTLINED_SX = {
  borderRadius: '12px',
  bgcolor: '#ffffff',
  fontSize: '0.875rem',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  '& fieldset': { borderColor: '#e2e8f0' },
  '&:hover fieldset': { borderColor: '#93c5fd' },
  '&.Mui-focused fieldset': {
    borderColor: '#1A55E3',
    borderWidth: '1.5px',
    boxShadow: '0 0 0 3px rgba(26, 85, 227, 0.08)',
  },
};

const LEDGER_FILTER_FIELD_SX = {
  '& .MuiOutlinedInput-root': LEDGER_FILTER_OUTLINED_SX,
  '& .MuiInputLabel-root': {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#64748b',
    '&.Mui-focused': { color: '#1A55E3' },
  },
};

const LEDGER_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: { xs: 2, md: 2.25 },
  width: '100%',
};

const LEDGER_FILTER_COMPACT_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: '1fr 1fr 1.4fr 1.6fr auto',
  },
  gap: 1.5,
  alignItems: 'center',
  width: '100%',
};

/** PDF palette — matches on-screen ledger Excel-style colours */
const LEDGER_PDF = {
  blue: [26, 85, 227],
  blueDark: [19, 71, 196],
  blueTint: [232, 239, 253],
  debitHead: [0, 97, 0],
  creditHead: [156, 0, 6],
  debitRow: [226, 239, 218],
  creditRow: [252, 228, 214],
  debitText: [0, 97, 0],
  creditText: [156, 0, 6],
  summaryRow: [217, 225, 242],
  summaryDebit: [198, 239, 206],
  summaryCredit: [244, 204, 204],
  summaryBalance: [189, 215, 238],
  border: [197, 197, 197],
  white: [255, 255, 255],
  slate: [71, 85, 105],
  dark: [30, 41, 59],
};

/** Render ledger PDF header as image so Urdu renders correctly */
async function captureLedgerPdfHeader({ contentW, custName, typeLabel, today, entryCount, compact = false }) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'left:-10000px', 'top:0',
    `width:${Math.round(contentW)}px`,
    'background:linear-gradient(180deg,#e8effd 0%,#ffffff 100%)',
    'border:1px solid #c5d4f5', 'border-radius:8px',
    compact ? 'padding:14px 18px 12px' : 'padding:22px 28px 20px',
    'text-align:center',
    "font-family:'Segoe UI',system-ui,sans-serif", 'box-sizing:border-box',
  ].join(';');

  el.innerHTML = `
    <div style="font-size:${compact ? '15px' : '19px'};font-weight:700;color:#1A55E3;line-height:1.3">${COMPANY.name}</div>
    <div style="font-size:${compact ? '13px' : '15px'};font-weight:600;color:#475569;margin-top:4px;line-height:1.5;font-family:'Segoe UI','Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif">${COMPANY.nameUr}</div>
    <div style="width:56px;height:2px;background:linear-gradient(90deg,#1A55E3,#5E6EED);margin:10px auto 0;border-radius:99px"></div>
    <div style="font-size:${compact ? '15px' : '18px'};font-weight:800;color:#1e293b;margin-top:10px;line-height:1.25">${custName}</div>
    ${typeLabel ? `<div style="font-size:10px;color:#64748b;margin-top:3px">${typeLabel}</div>` : ''}
    <div style="font-size:9px;color:#94a3b8;margin-top:8px;line-height:1.4">${today} · ${entryCount} entries · ${COMPANY.address} · Ph: ${COMPANY.phones.join(', ')}</div>
  `;

  document.body.appendChild(el);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
  document.body.removeChild(el);
  const imgH = (canvas.height / canvas.width) * contentW;
  return { imgData: canvas.toDataURL('image/png'), imgH };
}

function drawLedgerPdfStatBoxes(doc, { marginX, statY, contentW, opening, totalDebit, totalCredit, closing, fmtAmt, compact = false }) {
  const gap = compact ? 6 : 8;
  const boxW = (contentW - gap * 3) / 4;
  const boxH = compact ? 34 : 40;
  const stats = [
    { label: 'Opening Balance', value: fmtAmt(opening), bg: LEDGER_PDF.blueTint, accent: LEDGER_PDF.blueDark },
    { label: 'Total Debit', value: fmtAmt(totalDebit), bg: LEDGER_PDF.debitRow, accent: LEDGER_PDF.debitText },
    { label: 'Total Credit', value: fmtAmt(totalCredit), bg: LEDGER_PDF.creditRow, accent: LEDGER_PDF.creditText },
    { label: 'Closing Balance', value: fmtAmt(closing), bg: LEDGER_PDF.summaryBalance, accent: LEDGER_PDF.blueDark },
  ];

  stats.forEach((stat, i) => {
    const x = marginX + i * (boxW + gap);
    doc.setFillColor(...stat.bg);
    doc.setDrawColor(...LEDGER_PDF.border);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, statY, boxW, boxH, 4, 4, 'FD');
    doc.setFontSize(compact ? 6.5 : 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...LEDGER_PDF.slate);
    doc.text(stat.label.toUpperCase(), x + boxW / 2, statY + (compact ? 11 : 13), { align: 'center' });
    doc.setFontSize(compact ? 9 : 10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...stat.accent);
    doc.text(`PKR ${stat.value}`, x + boxW / 2, statY + (compact ? 26 : 30), { align: 'center' });
  });
  doc.setFont('helvetica', 'normal');
  return statY + boxH;
}

function drawLedgerPdfPageFooter(doc, { marginX, pageW, pageH, pageNum, pageCount }) {
  doc.setDrawColor(...LEDGER_PDF.border);
  doc.setLineWidth(0.5);
  doc.line(marginX, pageH - 24, pageW - marginX, pageH - 24);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...LEDGER_PDF.slate);
  doc.text(`${COMPANY.name}  ·  Account Ledger Report`, marginX, pageH - 12);
  doc.text(`Page ${pageNum} of ${pageCount}`, pageW - marginX, pageH - 12, { align: 'right' });
}

const LEDGER_VALUE_COLORS = {
  debit: '#006100',
  credit: '#9c0006',
  balance: '#1347c4',
};

/** Suppliers & customers: credit = green, debit = red (opposite of cash/bank ledger). */
const LEDGER_VALUE_COLORS_PARTY = {
  debit: '#9c0006',
  credit: '#006100',
  balance: '#1347c4',
};

function isSupplierOrCustomerLedgerEntry(entry) {
  const cat = (entry?.customer?.customer_category?.cus_cat_title || '').toLowerCase();
  const type = (entry?.customer?.customer_type?.cus_type_title || '').toLowerCase();
  const label = `${cat} ${type}`.trim();
  if (!label) return false;
  if (/cash|bank|expense|labour|delivery|transport|staff|employee|loader|cargo/.test(label)) {
    return false;
  }
  return /supplier|creditor|customer|debtor|client/.test(label);
}

function getLedgerValueColors(entry) {
  return isSupplierOrCustomerLedgerEntry(entry) ? LEDGER_VALUE_COLORS_PARTY : LEDGER_VALUE_COLORS;
}

const LEDGER_TYPE_COLORS = {
  sale: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  purchase: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  payment: { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
  receiving: { bg: '#d1fae5', text: '#047857', border: '#6ee7b7' },
  expense: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  order: { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' },
  'sale return': { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  'purchase return': { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
  journal: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
  adjustment: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  rebate: { bg: '#ecfdf5', text: '#059669', border: '#6ee7b7' },
  transfer: { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' },
  receipt: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  default: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

function getLedgerTypeStyle(ledgerType) {
  const key = String(ledgerType || '').trim().toLowerCase();
  return LEDGER_TYPE_COLORS[key] || LEDGER_TYPE_COLORS.default;
}

function formatLedgerParticulars(details) {
  if (!details || !String(details).trim()) return '';
  return String(details).replace(/\{.*?\}/g, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}

function mergeParticularsBoldRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function getParticularsBoldRanges(text, entry) {
  if (!text) return [];
  const ranges = [];
  const addRange = (start, end) => {
    if (start < 0 || end <= start || end > text.length) return;
    ranges.push({ start, end });
  };
  const addMatch = (match) => {
    if (!match?.[1]) return;
    const label = match[1].trim();
    if (!label) return;
    const start = text.indexOf(label, Math.max(0, match.index || 0));
    addRange(start, start + label.length);
  };

  addMatch(text.match(/^Payment for\s+([^-]+?)(?:\s-\s Ref:|$)/i));
  addMatch(text.match(/^Rebate\s+(.+?)\s+MonthKey:/i));

  const inlinePatterns = [
    /\bfrom\s+([^—\-|]+?)(?:\s*[—\-|]|$)/i,
    /\bto\s+([^—\-|]+?)(?:\s*[—\-|]|$)/i,
    /Payment (?:to|received from)\s+([^—]+?)\s*[—\-]/i,
    /added to\s+([^—]+?)\s*[—\-]/i,
    /returned to\s+([^—]+?)(?:\s*[—\-]|$)/i,
    /-\s+([^—\-(]+?)\s*\((?:Credit|Debit)\)/i,
  ];
  inlinePatterns.forEach((pattern) => addMatch(text.match(pattern)));

  const cusName = entry?.customer?.cus_name?.trim();
  if (cusName && cusName.toLowerCase() !== 'cash account') {
    const lowerText = text.toLowerCase();
    const lowerName = cusName.toLowerCase();
    let idx = 0;
    while ((idx = lowerText.indexOf(lowerName, idx)) !== -1) {
      addRange(idx, idx + cusName.length);
      idx += cusName.length;
    }
  }

  return mergeParticularsBoldRanges(ranges);
}

function renderLedgerParticulars(details, entry) {
  const text = formatLedgerParticulars(details);
  if (!text) return null;

  const ranges = getParticularsBoldRanges(text, entry);
  if (!ranges.length) return text;

  const parts = [];
  let cursor = 0;
  ranges.forEach(({ start, end }, i) => {
    if (cursor < start) parts.push(text.slice(cursor, start));
    parts.push(
      <Box component="span" key={`part-bold-${i}`} sx={{ fontWeight: 800, color: '#0f172a' }}>
        {text.slice(start, end)}
      </Box>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const getLedgerRowStyle = (isDebit, isCredit, entry) => {
  const colors = getLedgerValueColors(entry);
  const linkColor = isDebit ? colors.debit : isCredit ? colors.credit : '#334155';
  return {
    bg: '#ffffff',
    hover: '#f8fafc',
    text: '#1e293b',
    sub: '#475569',
    amount: linkColor,
    border: '#e2e8f0',
    chipBg: '#f8fafc',
    chipText: '#475569',
  };
};

const LEDGER_UI = {
  page: { bgcolor: '#f4f6f9', minHeight: '100%' },
  sectionCard: {
    borderRadius: '20px',
    border: '1px solid #eef1f6',
    boxShadow: '0 2px 16px rgba(15, 23, 42, 0.04)',
    bgcolor: '#ffffff',
    overflow: 'hidden',
  },
  statCard: (color) => ({
    p: 2,
    borderRadius: '16px',
    bgcolor: '#fff',
    border: '1px solid #eef1f6',
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1.75,
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
      borderColor: `${color}33`,
    },
  }),
  tableCard: {
    borderRadius: '12px',
    border: '1px solid #b4b4b4',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    bgcolor: '#fff',
  },
  tableHeadRow: {
    '& .MuiTableCell-head': {
      bgcolor: '#1A55E3',
      color: '#ffffff',
      fontWeight: 800,
      fontSize: '0.875rem',
      letterSpacing: '0.02em',
      textTransform: 'none',
      border: '1px solid #1347c4',
      borderTop: 'none',
      py: 1.2,
      whiteSpace: 'nowrap',
    },
  },
  ledgerHeaderWrap: {
    m: 0,
    p: 0,
    flexShrink: 0,
    lineHeight: 0,
    '& table': { lineHeight: 1.4 },
  },
  ledgerHeaderTable: {
    borderCollapse: 'collapse',
    width: '100%',
    tableLayout: 'fixed',
    border: '1px solid #b4b4b4',
    borderBottom: 'none',
    bgcolor: '#ffffff',
    '& .MuiTableCell-root': {
      border: '1px solid #c5c5c5',
      py: 1.1,
      px: 1.1,
      fontSize: '0.75rem',
      verticalAlign: 'middle',
      lineHeight: 1.4,
    },
    '& .MuiTableCell-head': {
      fontWeight: 800,
      fontSize: '0.875rem',
      color: '#ffffff',
    },
  },
  tableGrid: {
    borderCollapse: 'collapse',
    width: '100%',
    tableLayout: 'fixed',
    border: '1px solid #b4b4b4',
    bgcolor: '#ffffff',
    '& .MuiTableCell-root': {
      border: '1px solid #c5c5c5',
      py: 0.85,
      px: 1.1,
      fontSize: '0.8125rem',
      verticalAlign: 'middle',
      lineHeight: 1.4,
    },
  },
  ledgerTitleBar: {
    background: '#ffffff',
    borderBottom: 'none',
    color: '#0f172a',
    px: { xs: 2, md: 3 },
    pt: { xs: 2, md: 2.5 },
    pb: 0,
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: BRAND.primary.blue,
    },
  },
  ledgerTitleEn: {
    fontWeight: 600,
    fontSize: { xs: '0.9375rem', md: '1rem' },
    color: BRAND.primary.blue,
    lineHeight: 1.35,
    textAlign: 'center',
  },
  ledgerTitleUr: {
    fontWeight: 500,
    fontSize: { xs: '0.8125rem', md: '0.875rem' },
    color: '#64748b',
    mt: 0.35,
    lineHeight: 1.5,
    textAlign: 'center',
    fontFamily: '"Segoe UI", "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", serif',
  },
  ledgerTitleMain: {
    fontWeight: 700,
    fontSize: { xs: '1.2rem', md: '1.35rem' },
    color: '#1e293b',
    mt: 1,
    mb: 0,
    lineHeight: 1.25,
    textAlign: 'center',
  },
  ledgerActionBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 0.75,
    justifyContent: 'flex-end',
    px: { xs: 2, md: 3 },
    py: 1.25,
    mt: 1.5,
    borderTop: '1px solid #eef1f6',
    bgcolor: '#fafbfd',
  },
  summaryRow: {
    '& .MuiTableCell-root': {
      py: 1.1,
      fontWeight: 700,
      bgcolor: '#ffffff',
      border: '1px solid #c5c5c5',
      fontSize: '0.8125rem',
    },
  },
  accountTab: (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    overflow: 'hidden',
    bgcolor: active ? BRAND.primary.blue : '#fff',
    color: active ? '#fff' : '#334155',
    border: active ? `2px solid ${BRAND.primary.blue}` : '1px solid #cbd5e1',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  }),
  minimizedTab: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    bgcolor: '#fffbeb',
    border: '1px dashed #fbbf24',
    overflow: 'hidden',
    flexShrink: 0,
  },
  toolbarBtn: {
    textTransform: 'none',
    fontWeight: 700,
    borderRadius: '10px',
    fontSize: '0.8125rem',
    px: 1.75,
    py: 0.65,
    boxShadow: 'none',
  },
};

const LedgerTableColGroup = () => (
  <colgroup>
    <col style={{ width: '4%' }} />
    <col style={{ width: '10%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '28%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '10%' }} />
  </colgroup>
);

const LedgerTableHeaderRow = () => (
  <TableRow sx={LEDGER_UI.tableHeadRow}>
    <TableCell sx={{ textAlign: 'center', borderTop: 'none !important' }}>
      #
    </TableCell>
    <TableCell sx={{ borderTop: 'none !important' }}>
      Date
    </TableCell>
    <TableCell sx={{ borderTop: 'none !important' }}>
      Account
    </TableCell>
    <TableCell sx={{ borderTop: 'none !important' }}>
      Particulars
    </TableCell>
    <TableCell sx={{ textAlign: 'right', borderTop: 'none !important' }}>
      Debit (PKR)
    </TableCell>
    <TableCell sx={{ textAlign: 'right', borderTop: 'none !important' }}>
      Credit (PKR)
    </TableCell>
    <TableCell sx={{ textAlign: 'right', borderTop: 'none !important' }}>
      Balance (PKR)
    </TableCell>
    <TableCell sx={{ textAlign: 'center', borderTop: 'none !important' }}>
      Type
    </TableCell>
  </TableRow>
);

const LEDGER_TABS_STORAGE_PREFIX = 'finance_open_ledger_tabs';

function getLedgerTabsStorageKey() {
  if (typeof window === 'undefined') return `${LEDGER_TABS_STORAGE_PREFIX}_default`;
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const branchId = user?.branch_id ?? localStorage.getItem('active_branch_id') ?? 'default';
    return `${LEDGER_TABS_STORAGE_PREFIX}_${branchId}`;
  } catch {
    return `${LEDGER_TABS_STORAGE_PREFIX}_default`;
  }
}

function loadPersistedLedgerTabs() {
  if (typeof window === 'undefined') return { openLedgers: [], activeLedgerId: null };
  try {
    const raw = localStorage.getItem(getLedgerTabsStorageKey());
    if (!raw) return { openLedgers: [], activeLedgerId: null };
    const parsed = JSON.parse(raw);
    const openLedgers = Array.isArray(parsed?.openLedgers)
      ? parsed.openLedgers
          .filter((t) => t && Number(t.id) > 0)
          .map((t) => ({
            id: Number(t.id),
            name: String(t.name || `Account #${t.id}`),
            minimized: Boolean(t.minimized),
          }))
      : [];
    const activeLedgerId =
      parsed?.activeLedgerId != null && parsed.activeLedgerId !== ''
        ? Number(parsed.activeLedgerId)
        : null;
    return { openLedgers, activeLedgerId };
  } catch {
    return { openLedgers: [], activeLedgerId: null };
  }
}

function savePersistedLedgerTabs(openLedgers, activeLedgerId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getLedgerTabsStorageKey(),
      JSON.stringify({ openLedgers, activeLedgerId })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

const getLocalDateString = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
};

const getKarachiDateKey = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
};

const getLedgerEntryDisplayAmounts = (entry) => {
  const debitAmt = parseFloat(entry.debit_amount || 0);
  const creditAmt = parseFloat(entry.credit_amount || 0);
  const entryAmount = debitAmt > 0 ? debitAmt : creditAmt;

  const customer = entry.customer;
  const categoryTitle = (customer?.customer_category?.cus_cat_title || '').toLowerCase();
  const isCashBank = categoryTitle.includes('cash') || categoryTitle.includes('bank');

  if (isCashBank) {
    const type = (entry.ledger_type || '').toLowerCase();
    const billNo = (entry.bill_no || '').toString();
    const detailsLower = (entry.details || '').toLowerCase();
    const isReversal = billNo.endsWith('-REV') || detailsLower.includes('reversal —') || detailsLower.includes('reversal -');
    if (isReversal) {
      return { debit: entryAmount, credit: 0 };
    }
    if (type === 'transfer' || type === 'adjustment') {
      return { debit: debitAmt, credit: creditAmt };
    }
    const isDebitType = ['sale', 'receiving', 'order', 'purchase return', 'receipt'].includes(type);
    if (isDebitType) {
      return { debit: entryAmount, credit: 0 };
    } else {
      return { debit: 0, credit: entryAmount };
    }
  }

  if (entry.trnx_type === 'DEBIT') {
    return { debit: entryAmount, credit: 0 };
  } else if (entry.trnx_type === 'CREDIT') {
    return { debit: 0, credit: entryAmount };
  } else {
    return { debit: debitAmt, credit: creditAmt };
  }
};

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;

  const billA = parseInt(a.bill_no) || 0;
  const billB = parseInt(b.bill_no) || 0;
  if (billA !== billB) return billA - billB;

  return (a.l_id || 0) - (b.l_id || 0);
};

/** All Accounts default: all of today's entries + last entry before today */
function buildAllAccountsRecentEntryIdSet(entries) {
  if (!entries.length) return new Set();
  const todayKey = getKarachiDateKey(new Date());
  const ids = new Set();

  for (const entry of entries) {
    if (getKarachiDateKey(entry.created_at) === todayKey) {
      ids.add(entry.l_id);
    }
  }

  const beforeToday = entries.filter((e) => {
    const entryKey = getKarachiDateKey(e.created_at);
    return entryKey && entryKey < todayKey;
  });
  if (beforeToday.length) {
    const latestBeforeToday = [...beforeToday].sort((a, b) => compareChronologically(b, a))[0];
    if (latestBeforeToday) ids.add(latestBeforeToday.l_id);
  }

  return ids;
}

/** Bank / Cash display amounts for a ledger row — must match the table body logic (finance ledger columns). */
function getLedgerEntryBankCashForSummary(entry) {
  const displayAmts = getLedgerEntryDisplayAmounts(entry);
  const isDebit = displayAmts.debit > 0;
  const isCredit = displayAmts.credit > 0;
  const entryAmount = isDebit ? displayAmts.debit : displayAmts.credit;

  let splitCashAmount = 0;
  let splitBankAmount = 0;
  let isSplitPayment = false;
  if (entry.details) {
    const splitMatch = entry.details.match(/\{\s*cash_amount:\s*([\d.]+),\s*bank_amount:\s*([\d.]+)\s*\}/);
    if (splitMatch) {
      splitCashAmount = parseFloat(splitMatch[1]);
      splitBankAmount = parseFloat(splitMatch[2]);
      isSplitPayment = true;
    }
  }
  let bankAmount = parseFloat(entry.bank_payment || 0);
  let cashAmount = parseFloat(entry.cash_payment || 0);
  const isLabourOrDeliveryAccount =
    /(labour|delivery|transport)/i.test(entry.customer?.cus_name || '') || /incity \(own\)/i.test(entry.details || '');

  if (bankAmount === 0 && cashAmount === 0) {
    if (isSplitPayment) {
      bankAmount = splitBankAmount;
      cashAmount = splitCashAmount;
    } else if (!isLabourOrDeliveryAccount) {
      if (entry.trnx_type === 'BANK_TRANSFER' || entry.trnx_type === 'CHEQUE') {
        bankAmount = parseFloat(entryAmount || 0);
        cashAmount = 0;
      } else if (entry.trnx_type === 'CASH') {
        bankAmount = 0;
        cashAmount = parseFloat(entryAmount || 0);
      }
    }
  }
  return { bankAmount, cashAmount };
}

/**
 * Sales ORDER “memo” lines on the customer: equal debit & credit, only for display.
 * They duplicate the economic cash/bank rows — exclude from summary debit/credit and bank/cash footers
 * so totals match “customer paid X + cash/bank received X” without double-counting.
 */
function isOrderCustomerMemoLedgerEntry(entry) {
  const det = entry.details || '';
  if (!det.includes('no receivable change')) return false;
  const d = parseFloat(entry.debit_amount || 0);
  const c = parseFloat(entry.credit_amount || 0);
  return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
}

const buildFinancePaymentDescription = (mode, accountName, cashAmount, bankAmount, bankAccountId, bankAccountsList, discountAmount) => {
  const bits = [];
  const cash = parseFloat(cashAmount || 0);
  const bank = parseFloat(bankAmount || 0);
  const disc = parseFloat(discountAmount || 0);
  if (cash > 0) bits.push(`Cash PKR ${fmtAmt(cash)}`);
  if (bank > 0 && bankAccountId) {
    const bankName = bankAccountsList.find((b) => String(b.cus_id) === String(bankAccountId))?.cus_name || 'Bank';
    bits.push(`${bankName} PKR ${fmtAmt(bank)}`);
  } else if (bank > 0) {
    bits.push(`Bank PKR ${fmtAmt(bank)}`);
  }
  if (disc > 0) bits.push(`Discount PKR ${fmtAmt(disc)}`);
  
  const prefix = mode === 'PAY' ? 'Payment ' : mode === 'RECEIVE' ? 'Receiving ' : '';
  const content = bits.join(' | ');
  if (accountName && content) {
    return `${prefix}${accountName} - ${content}`;
  }
  return prefix ? `${prefix}${content}` : content;
};

const getInvoiceNet = (bill) => {
  if (!bill) return 0;
  if (bill.display_net_total != null) return parseFloat(bill.display_net_total);
  return parseFloat(bill.total_amount || 0) + parseFloat(bill.unloading_amount || 0) + parseFloat(bill.transport_amount || 0) + parseFloat(bill.labour_amount || 0) + parseFloat(bill.fare_amount || 0) - parseFloat(bill.discount || 0);
};

const getInvoiceRemainingDue = (bill) => {
  const net = getInvoiceNet(bill);
  const payment = parseFloat(bill?.payment || 0);
  return net - payment;
};

const getSupplierBalanceAfterBill = (bill) => {
  const prev = parseFloat(bill?.previous_customer_balance ?? bill?.customer?.cus_balance ?? 0);
  return Number((prev - getInvoiceRemainingDue(bill)).toFixed(2));
};

const numberToUrduWords = (amount) => {
  const num = Math.round(parseFloat(amount));
  if (isNaN(num) || num <= 0) return '';

  const urduNumbers = [
    '', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس',
    'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس', 'بیس',
    'اکیس', 'بائیس', 'تیئیس', 'چوبیس', 'پچیس', 'چھبیس', 'ستائیس', 'اٹھائیس', 'انتیس', 'تیس',
    'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اٹھتیس', 'انتالیس', 'چالیس',
    'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اٹھتالیس', 'انچاس', 'پچاس',
    'اکیاون', 'باون', 'تریپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ', 'ساٹھ',
    'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چونسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اٹھسٹھ', 'انہتر', 'ستر',
    'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچہتر', 'چھیہتر', 'ستتر', 'اٹھہتر', 'انیاسی', 'اسی',
    'اکیاسی', 'بیاسی', 'تیاسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی', 'نوے',
    'اکیانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے'
  ];

  const convert = (n) => {
    if (n < 100) return urduNumbers[n];
    
    let parts = [];
    
    // Crore (1,00,00,000)
    if (n >= 10000000) {
      parts.push(convert(Math.floor(n / 10000000)) + ' کروڑ');
      n %= 10000000;
    }
    
    // Lakh (1,00,000)
    if (n >= 100000) {
      parts.push(convert(Math.floor(n / 100000)) + ' لاکھ');
      n %= 100000;
    }
    
    // Thousand (1,000)
    if (n >= 1000) {
      parts.push(convert(Math.floor(n / 1000)) + ' ہزار');
      n %= 1000;
    }
    
    // Hundred (100)
    if (n >= 100) {
      parts.push(urduNumbers[Math.floor(n / 100)] + ' سو');
      n %= 100;
    }
    
    // Remaining below 100
    if (n > 0) {
      parts.push(urduNumbers[n]);
    }
    
    return parts.filter(Boolean).join(' ');
  };

  const words = convert(num);
  return words ? words + ' روپے فقط' : '';
};

const numberToWords = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return '';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  const convertChunk = (n) => {
    let parts = [];
    if (n >= 100) {
      parts.push(ones[Math.floor(n / 100)] + ' Hundred');
      n %= 100;
    }
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)]);
      n %= 10;
    }
    if (n > 0) {
      parts.push(ones[n]);
    }
    return parts.filter(Boolean).join(' ');
  };

  let numInt = Math.floor(num);
  let numDec = Math.round((num - numInt) * 100);

  if (numInt === 0 && numDec === 0) return 'Zero Rupees Only';

  let chunks = [];
  let scaleIndex = 0;

  while (numInt > 0) {
    let chunk = numInt % 1000;
    if (chunk > 0) {
      let chunkStr = convertChunk(chunk);
      if (scales[scaleIndex]) {
        chunkStr += ' ' + scales[scaleIndex];
      }
      chunks.unshift(chunkStr);
    }
    numInt = Math.floor(numInt / 1000);
    scaleIndex++;
  }

  let words = chunks.filter(Boolean).join(', ');
  if (words) {
    words = words.trim() + ' Rupees';
  }

  if (numDec > 0) {
    const decWords = convertChunk(numDec);
    if (decWords) {
      if (words) {
        words += ' and ' + decWords + ' Paisa';
      } else {
        words = decWords + ' Paisa';
      }
    }
  }

  return words ? words + ' Only' : '';
};

export default function FinancePage() {
  // PIN auth
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();

  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    } catch (e) {
      console.error('Error loading user from localStorage:', e);
    }
  }, []);

  const getCurrentUserId = () => {
    const raw = currentUser?.user_id ?? currentUser?.id;
    if (raw == null || raw === '') return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [editingLedger, setEditingLedger] = useState(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [journalStatus, setJournalStatus] = useState({ loading: false, error: null });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAmount, setFilterAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(''); // This will be customer category ID
  const [selectedSubCategory, setSelectedSubCategory] = useState(''); // This will be customer type ID
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLedgerType, setSelectedLedgerType] = useState('');
  const [staticDataLoaded, setStaticDataLoaded] = useState(false);
  /** All Accounts: default recent rows; Clear shows full ledger */
  const [allAccountsFullLedger, setAllAccountsFullLedger] = useState(false);

  // Customer dropdown filter states
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Multi-ledger tabs: open several account ledgers, minimize/restore like windows
  const [openLedgers, setOpenLedgers] = useState([]); // { id, name, minimized }
  const [activeLedgerId, setActiveLedgerId] = useState(null);
  const [ledgerTabsHydrated, setLedgerTabsHydrated] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    cus_id: '',
    debit_amount: '',
    credit_amount: '',
    bill_no: '',
    trnx_type: 'CASH',
    details: '',
    cash_amount: '',
    bank_amount: '',
  });

  // Purchase viewer state (opened when clicking the eye / Bill)
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [viewPurchaseDialogOpen, setViewPurchaseDialogOpen] = useState(false);
  // Sale/Order/Quote invoice viewer (from ledger; numeric bill_no = sale_id)
  const [viewingSale, setViewingSale] = useState(null);
  const [viewSaleDialogOpen, setViewSaleDialogOpen] = useState(false);
  const [viewingSaleReturn, setViewingSaleReturn] = useState(null);
  const [viewSaleReturnDialogOpen, setViewSaleReturnDialogOpen] = useState(false);
  const [viewingPurchaseReturn, setViewingPurchaseReturn] = useState(null);
  const [viewPurchaseReturnDialogOpen, setViewPurchaseReturnDialogOpen] = useState(false);

  // Journal Form Data
  const [journalData, setJournalData] = useState({
    journal_date: new Date().toISOString().split('T')[0],
    journal_type: 'PAYMENT',
    reference: '',
    description: '',
  });

  const [journalLines, setJournalLines] = useState([
    { account_id: '', debit_amount: '', credit_amount: '', description: '', accountSearch: '' },
    { account_id: '', debit_amount: '', credit_amount: '', description: '', accountSearch: '' }
  ]);

  // Payment Form States
  const [showReceivePaymentForm, setShowReceivePaymentForm] = useState(false);
  const [showPayPaymentForm, setShowPayPaymentForm] = useState(false);
  const [paymentReceiptData, setPaymentReceiptData] = useState(null);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [receivePaymentData, setReceivePaymentData] = useState({
    total_payment: '',
    discount: '',
    cash_account: '',
    cash_amount: '',
    bank_account: '',
    bank_amount: '',
    description: ''
  });
  const [payPaymentData, setPayPaymentData] = useState({
    total_payment: '',
    discount: '',
    cash_account: '',
    cash_amount: '',
    bank_account: '',
    bank_amount: '',
    description: ''
  });
  const [cashAccounts, setCashAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState({ loading: false, error: null });
  const [saveStatusMessage, setSaveStatusMessage] = useState('');

  const beginSavingPayment = (message) => {
    setPaymentStatus({ loading: true, error: null });
    setSaveStatusMessage(message);
  };

  const updateSaveStatus = (message) => {
    setSaveStatusMessage(message);
  };

  const endSavingPayment = () => {
    setPaymentStatus({ loading: false, error: null });
    setSaveStatusMessage('');
  };

  const [selectedLedgerBankAccount, setSelectedLedgerBankAccount] = useState(null);
  const [isSubmittingLedger, setIsSubmittingLedger] = useState(false);
  const [isSendingPaymentWhatsApp, setIsSendingPaymentWhatsApp] = useState(false);
  const [isDownloadingLedgerPdf, setIsDownloadingLedgerPdf] = useState(false);
  const [isSendingSaleWhatsApp, setIsSendingSaleWhatsApp] = useState(false);

  // Inline Cell Editing States & Handlers
  const [inlineEditing, setInlineEditing] = useState(null); // { l_id, field, value }
  const [savingInline, setSavingInline] = useState(false);

  const handleInlineSave = async (entry, field, newValue) => {
    if (savingInline) return;
    setSavingInline(true);
    try {
      const parsedValue = parseFloat(newValue) || 0;
      const payload = {
        id: entry.l_id,
        cus_id: entry.cus_id,
        direct_edit: true
      };

      if (field === 'credit') {
        payload.credit_amount = parsedValue;
      } else if (field === 'debit') {
        payload.debit_amount = parsedValue;
      } else if (field === 'balance') {
        payload.closing_balance = parsedValue;
      }

      const res = await fetch('/api/ledger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Refresh the ledger data to recalculate running balances
        await fetchData();
      } else {
        const errData = await res.json();
        alert('❌ Error: ' + (errData.message || 'Failed to update entry'));
      }
    } catch (error) {
      console.error('Error saving inline edit:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setInlineEditing(null);
      setSavingInline(false);
    }
  };

  // Print Ledger Dialog states
  const [showPrintLedgerDialog, setShowPrintLedgerDialog] = useState(false);
  const [printFromDate, setPrintFromDate] = useState('');
  const [printToDate, setPrintToDate] = useState('');

  const fetchStaticData = async () => {
    try {
      const [customersRes, categoriesRes, typesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/customer-category'),
        fetch('/api/customer-types')
      ]);

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCustomerCategories(categoriesData);
      }
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setCustomerTypes(typesData);
      }

      await fetchCashBankAccounts();
      setStaticDataLoaded(true);
    } catch (error) {
      console.error('Error fetching static data:', error);
    }
  };

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCustomer) params.append('customerId', selectedCustomer);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedSubCategory) params.append('typeId', selectedSubCategory);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/ledger?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount — restore persisted ledger tabs first
  useEffect(() => {
    setMounted(true);

    const { openLedgers: savedTabs, activeLedgerId: savedActiveId } = loadPersistedLedgerTabs();
    if (savedTabs.length > 0) {
      setOpenLedgers(savedTabs);
      const activeTab = savedTabs.find((t) => t.id === Number(savedActiveId));
      const firstVisible = savedTabs.find((t) => !t.minimized);

      if (activeTab && !activeTab.minimized) {
        setActiveLedgerId(activeTab.id);
        setSelectedCustomer(String(activeTab.id));
        setAccountSearchTerm(activeTab.name);
      } else if (firstVisible) {
        setActiveLedgerId(firstVisible.id);
        setSelectedCustomer(String(firstVisible.id));
        setAccountSearchTerm(firstVisible.name);
      } else {
        setActiveLedgerId(savedActiveId);
      }
    }

    setLedgerTabsHydrated(true);
  }, []);

  useEffect(() => {
    if (!ledgerTabsHydrated) return;
    const init = async () => {
      await fetchStaticData();
      await fetchLedgerData();
      setInitialLoading(false);
    };
    init();
  }, [ledgerTabsHydrated]);

  // Persist open ledger tabs (survives page navigation & browser restart)
  useEffect(() => {
    if (!ledgerTabsHydrated) return;
    savePersistedLedgerTabs(openLedgers, activeLedgerId);
  }, [openLedgers, activeLedgerId, ledgerTabsHydrated]);

  // Reload tabs when HQ user switches branch
  useEffect(() => {
    const onBranchChanged = () => {
      const { openLedgers: savedTabs, activeLedgerId: savedActiveId } = loadPersistedLedgerTabs();
      setOpenLedgers(savedTabs);
      const activeTab = savedTabs.find((t) => t.id === Number(savedActiveId));
      const firstVisible = savedTabs.find((t) => !t.minimized);
      if (activeTab && !activeTab.minimized) {
        setActiveLedgerId(activeTab.id);
        setSelectedCustomer(String(activeTab.id));
        setAccountSearchTerm(activeTab.name);
      } else if (firstVisible) {
        setActiveLedgerId(firstVisible.id);
        setSelectedCustomer(String(firstVisible.id));
        setAccountSearchTerm(firstVisible.name);
      } else {
        setActiveLedgerId(null);
        setSelectedCustomer('');
        setAccountSearchTerm('');
        setAllAccountsFullLedger(false);
      }
      fetchLedgerData();
    };
    window.addEventListener('branch-changed', onBranchChanged);
    return () => window.removeEventListener('branch-changed', onBranchChanged);
  }, []);

  // Reactive effect when filters change
  useEffect(() => {
    if (staticDataLoaded) {
      const timer = setTimeout(() => {
        fetchLedgerData();
      }, 300); // 300ms debounce
      return () => clearTimeout(timer);
    }
  }, [selectedCustomer, selectedCategory, selectedSubCategory, startDate, endDate, searchTerm, staticDataLoaded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerDropdown && !event.target.closest('.customer-dropdown')) {
        setShowCustomerDropdown(false);
      }
      if (showAccountDropdown && !event.target.closest('.account-dropdown')) {
        setShowAccountDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown, showAccountDropdown]);

  const fetchData = async () => {
    await Promise.all([
      fetchLedgerData(),
      fetchStaticData()
    ]);
  };

  // Open purchase invoice (used by eye icon / Bill links)
  const handleViewPaymentVoucher = async (paymentId) => {
    if (!paymentId) return;
    try {
      const res = await fetch(`/api/payments?id=${paymentId}`);
      if (!res.ok) {
        console.warn('Payment not found:', paymentId);
        return;
      }
      const p = await res.json();
      const disc = parseFloat(p.discount_amount || 0);
      const totalAmt = parseFloat(p.total_amount || 0);
      const cashA = parseFloat(p.cash_amount || 0);
      const bankA = parseFloat(p.bank_amount || 0);
      
      // Correct visual voucher type matching the database payment_type ('RECEIVE' or 'PAY')
      const type = p.payment_type;
      const acc = p.account;

      // Populate previousBalance and remainingBalance from the ledger entry
      let prevBal = null;
      let remBal = null;
      
      const paymentRef = `PAY-${paymentId}`;
      let matchingEntry = ledgerEntries.find(
        (e) => String(e.bill_no || '') === paymentRef && Number(e.cus_id) === Number(p.account_id)
      );
      
      if (!matchingEntry) {
        try {
          const ledgerRes = await fetch(`/api/ledger?customerId=${p.account_id}`);
          if (ledgerRes.ok) {
            const customerLedger = await ledgerRes.json();
            matchingEntry = customerLedger.find(
              (e) => String(e.bill_no || '') === paymentRef
            );
          }
        } catch (err) {
          console.warn('Error fetching customer ledger entries as fallback:', err);
        }
      }
      
      if (matchingEntry) {
        prevBal = parseFloat(matchingEntry.opening_balance);
        remBal = parseFloat(matchingEntry.closing_balance);
      }

      setPaymentReceiptData({
        type,
        viewOnly: true,
        paymentId: p.payment_id,
        date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : '—',
        time: p.created_at ? new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
        customer: acc,
        previousBalance: prevBal,
        remainingBalance: remBal,
        cashAmount: cashA,
        bankAmount: bankA,
        discountAmount: disc,
        totalAmount: totalAmt,
        bankAcc: p.bank_account,
        cashAcc: p.cash_account,
        description: p.description
      });
      setShowPaymentReceipt(true);
    } catch (err) {
      console.error('Error fetching payment for voucher view:', err);
    }
  };

  const handleViewSale = async (saleId) => {
    if (!saleId) return;
    try {
      const res = await fetch(`/api/sales?id=${saleId}`);
      if (!res.ok) {
        console.warn('Sale not found:', saleId);
        return;
      }
      const sale = await res.json();
      setViewingSale(sale);
      setViewSaleDialogOpen(true);
    } catch (err) {
      console.error('Error fetching sale for viewer:', err);
    }
  };

  const handleViewSaleReturn = async (returnId) => {
    if (!returnId) return;
    try {
      const res = await fetch(`/api/sale-returns?id=${returnId}`);
      if (!res.ok) {
        console.warn('Sale return not found:', returnId);
        return;
      }
      const saleReturn = await res.json();
      setViewingSaleReturn(saleReturn);
      setViewSaleReturnDialogOpen(true);
    } catch (err) {
      console.error('Error fetching sale return for viewer:', err);
    }
  };

  const openDocumentFromLedgerEntry = (entry) => {
    if (!entry || !entry.bill_no) return;
    const ref = String(entry.bill_no).trim();
    if (!ref) return;
    const details = String(entry.details || '').toLowerCase();
    const ledgerType = String(entry.ledger_type || '').toLowerCase();
    const trnxType = String(entry.trnx_type || '').toUpperCase();

    // 1. Payment Voucher (PAY-...)
    const payMatch = ref.match(/^PAY-(\d+)$/i);
    if (payMatch) {
      handleViewPaymentVoucher(parseInt(payMatch[1], 10));
      return;
    }

    // 2. Purchase Return (PR-...)
    const prMatch = ref.match(/^PR-(\d+)$/i);
    if (prMatch) {
      handleViewPurchaseReturn(prMatch[1]);
      return;
    }

    // 3. Sale Return (SR-...)
    const srMatch = ref.match(/^SR-(\d+)$/i);
    if (srMatch || details.includes('sale return') || ledgerType === 'sale return') {
      const cleanId = srMatch ? srMatch[1] : ref.replace(/^[A-Za-z]+-/, '');
      handleViewSaleReturn(cleanId);
      return;
    }

    // 4. Journal Entry (JRN-...)
    const jrnMatch = ref.match(/^JRN-(\d+)$/i);
    if (jrnMatch || ledgerType === 'journal' || details.includes('journal')) {
      const cleanId = jrnMatch ? jrnMatch[1] : ref.replace(/^[A-Za-z]+-/, '');
      alert(`Journal Entry #${cleanId || ref}\nDetails: ${entry.details || 'Journal Voucher'}`);
      return;
    }

    // 5. Expense Entry (EXP-...)
    const expMatch = ref.match(/^EXP-(\d+)$/i);
    if (expMatch || ledgerType === 'expense' || details.includes('expense')) {
      const cleanId = expMatch ? expMatch[1] : ref.replace(/^[A-Za-z]+-/, '');
      alert(`Expense Voucher #${cleanId || ref}\nDetails: ${entry.details || 'Expense Voucher'}`);
      return;
    }

    // 6. Rebate Entry (REB-...)
    const rebMatch = ref.match(/^REB-(\d+)$/i);
    if (rebMatch || ledgerType === 'rebate' || details.includes('rebate')) {
      alert(`Rebate Voucher #${ref}\nDetails: ${entry.details || 'Rebate Entry'}`);
      return;
    }

    // 7. Check if Supplier / Purchase
    const categoryId = entry.customer?.cus_category;
    const category = customerCategories.find(c => String(c.cus_cat_id) === String(categoryId));
    const title = (category?.cus_cat_title || '').toLowerCase();
    const isSupplier = title.includes('supplier') || title.includes('creditor');

    const isPurchase = (trnxType === 'PURCHASE' || 
                        ledgerType === 'purchase' || 
                        ledgerType === 'purchase return' ||
                        details.includes('purchase'));

    const cleanRef = ref.replace(/^[A-Za-z]+-/, '');

    if (isPurchase || isSupplier) {
      const isReturnVariant = details.includes('purchase return') || ledgerType === 'purchase return';
      handleViewPurchase(cleanRef || ref, isReturnVariant);
      return;
    }

    // 8. Default to Sale / Order / Quotation
    handleViewSale(cleanRef || ref);
  };

  const handleViewPurchaseReturn = async (returnId) => {
    if (!returnId) return;
    try {
      const res = await fetch(`/api/purchase-returns?id=${returnId}`);
      if (!res.ok) {
        console.warn('Purchase return not found:', returnId);
        return;
      }
      const purchaseReturn = await res.json();
      setViewingPurchaseReturn(purchaseReturn);
      setViewPurchaseReturnDialogOpen(true);
    } catch (err) {
      console.error('Error fetching purchase return for viewer:', err);
    }
  };

  const handleViewPurchase = async (billNo, isReturnVariant = false) => {
    if (!billNo) return;
    try {
      const res = await fetch(`/api/purchases?id=${billNo}`);
      if (!res.ok) {
        console.warn('Purchase not found for bill:', billNo);
        return;
      }
      let purchaseData = await res.json();
      if (isReturnVariant) {
        purchaseData._isReturnVariant = true;
      }

      // Compute display_net_total (same fallback logic as purchases page)
      const productTotal = (purchaseData.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || 0), 0) || parseFloat(purchaseData.total_amount || 0);
      const calculatedNetTotal = productTotal +
        parseFloat(purchaseData.unloading_amount || 0) +
        parseFloat(purchaseData.transport_amount || 0) +
        parseFloat(purchaseData.labour_amount || 0) +
        parseFloat(purchaseData.fare_amount || 0) -
        parseFloat(purchaseData.discount || 0);

      // Payment breakdown fallback for older records
      let cashPayment = parseFloat(purchaseData.cash_payment || 0);
      let bankPayment = parseFloat(purchaseData.bank_payment || 0);
      if (cashPayment === 0 && bankPayment === 0 && parseFloat(purchaseData.payment || 0) > 0) {
        const totalPayment = parseFloat(purchaseData.payment || 0);
        if (purchaseData.payment_type === 'CASH') cashPayment = totalPayment;
        else if (purchaseData.payment_type === 'BANK_TRANSFER') bankPayment = totalPayment;
        else cashPayment = totalPayment;
      }

      purchaseData = {
        ...purchaseData,
        display_net_total: calculatedNetTotal,
        cash_payment: cashPayment,
        bank_payment: bankPayment
      };

      setViewingPurchase(purchaseData);
      setViewPurchaseDialogOpen(true);
    } catch (err) {
      console.error('Error fetching purchase for viewer:', err);
    }
  };

  const handlePrintPurchaseReceipt = (mode = 'A4') => {
    try {
      const className = mode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const isThermal = mode === 'THERMAL';
      const printableContainer = isThermal
        ? document.getElementById('printable-invoice-thermal-finance')
        : document.getElementById('printable-invoice-a4-finance');
      if (!printableContainer) return;

      if (!isThermal) {
        const preview = document.getElementById('purchase-invoice-ledger');
        if (preview) printableContainer.innerHTML = preview.innerHTML;
      }

      const styleId = 'dynamic-print-style-finance';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = isThermal
        ? `@media print { @page { size: 80mm portrait !important; margin: 0 !important; } body { margin: 0 !important; padding: 0 !important; } }`
        : `@media print { @page { size: A4 portrait !important; margin: 0.5cm 1cm !important; } }`;
      document.body.classList.add(className);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');
          if (styleEl) styleEl.remove();
        }, 150);
      }, 150);
    } catch (e) {
      console.error('Print error (finance):', e);
      window.print();
    }
  };

  const handlePrintPurchaseReturnReceipt = (mode = 'A4') => {
    try {
      const className = mode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const isThermal = mode === 'THERMAL';
      const printableContainer = isThermal
        ? document.getElementById('printable-invoice-thermal-finance')
        : document.getElementById('printable-invoice-a4-finance');
      if (!printableContainer) return;

      if (!isThermal) {
        const preview = document.getElementById('purchase-return-invoice-ledger');
        if (preview) printableContainer.innerHTML = preview.innerHTML;
      }

      const styleId = 'dynamic-print-style-finance';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = isThermal
        ? `@media print { @page { size: 80mm portrait !important; margin: 0 !important; } body { margin: 0 !important; padding: 0 !important; } }`
        : `@media print { @page { size: A4 portrait !important; margin: 0.5cm 1cm !important; } }`;
      document.body.classList.add(className);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');
          if (styleEl) styleEl.remove();
        }, 150);
      }, 150);
    } catch (e) {
      console.error('Print error (finance):', e);
      window.print();
    }
  };

  const handleSendPurchaseReturnWhatsApp = async () => {
    const preview = document.getElementById('purchase-return-invoice-ledger');
    if (!preview || !viewingPurchaseReturn) return;
    try {
      const supplierPhone = viewingPurchaseReturn.purchase?.customer?.cus_phone_no || '';
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const { opened } = await shareViaWhatsAppDesktop({
        element: preview,
        phone: supplierPhone,
      });
      alert(whatsAppSuccessMessage(opened));
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      alert(`An error occurred: ${error.message}`);
    }
  };


  const getBillDisplayNo = (sale) => {
    if (!sale) return '';
    const bn = sale.bill_number;
    const bt = sale.bill_type || 'BILL';
    const prefix = bt === 'BILL' ? 'B' : ['ORDER', 'ORDER_TRASH'].includes(bt) ? 'O' : bt === 'QUOTATION' ? 'Q' : 'O';
    return bn ? `${prefix}-${bn}` : `#${sale.sale_id || ''}`;
  };

  const handlePrintSaleReceipt = (mode = 'A4', elementId = 'sale-invoice-ledger') => {
    try {
      const className = mode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const isThermal = mode === 'THERMAL';
      const printableContainer = isThermal
        ? document.getElementById('printable-invoice-thermal-finance')
        : document.getElementById('printable-invoice-a4-finance');
      if (!printableContainer) return;

      if (!isThermal) {
        const preview = document.getElementById(elementId);
        if (preview) printableContainer.innerHTML = preview.innerHTML;
      }

      const styleId = 'dynamic-print-style-finance';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = isThermal
        ? `@media print { @page { size: 80mm portrait !important; margin: 0 !important; } body { margin: 0 !important; padding: 0 !important; } }`
        : `@media print { @page { size: A4 portrait !important; margin: 0.5cm 1cm !important; } }`;
      document.body.classList.add(className);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');
          if (styleEl) styleEl.remove();
        }, 150);
      }, 150);
    } catch (e) {
      console.error('Print error (finance):', e);
      window.print();
    }
  };

  const handleSendSaleWhatsApp = async (sale, elementId = 'sale-invoice-ledger') => {
    try {
      setIsSendingSaleWhatsApp(true);
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const { opened } = await shareViaWhatsAppDesktop({
        elementId,
        phone: sale?.customer?.cus_phone_no,
      });
      alert(`✅ ${whatsAppSuccessMessage(opened)}`);
    } catch (err) {
      alert(`❌ WhatsApp error: ${err.message}`);
    } finally {
      setIsSendingSaleWhatsApp(false);
    }
  };

  const isAllAccountsLedgerView = !selectedCustomer && !activeLedgerId;
  const useAllAccountsRecentDefault =
    isAllAccountsLedgerView && !allAccountsFullLedger && !startDate && !endDate;

  const allAccountsRecentViewIds = useMemo(() => {
    if (!useAllAccountsRecentDefault) return null;
    return buildAllAccountsRecentEntryIdSet(ledgerEntries);
  }, [ledgerEntries, useAllAccountsRecentDefault]);

  // Filter and sort logic
  const filteredLedgerEntries = ledgerEntries.filter(entry => {
    const displayAmts = getLedgerEntryDisplayAmounts(entry);
    const searchLower = searchTerm.trim().toLowerCase();
    const searchNum = parseFloat(searchTerm.trim());

    const matchesSearch = !searchTerm ||
      entry.customer?.cus_name?.toLowerCase().includes(searchLower) ||
      entry.details?.toLowerCase().includes(searchLower) ||
      entry.bill_no?.toLowerCase().includes(searchLower) ||
      entry.customer?.cus_phone_no?.toLowerCase().includes(searchLower) ||
      entry.customer?.cus_phone_no2?.toLowerCase().includes(searchLower) ||
      entry.customer?.cus_reference?.toLowerCase().includes(searchLower) ||
      entry.cus_id?.toString().includes(searchTerm) ||
      entry.customer?.cus_id?.toString().includes(searchTerm) ||
      entry.debit_amount?.toString().includes(searchTerm) ||
      entry.credit_amount?.toString().includes(searchTerm) ||
      entry.closing_balance?.toString().includes(searchTerm) ||
      displayAmts.debit.toString().includes(searchTerm) ||
      displayAmts.credit.toString().includes(searchTerm) ||
      (!isNaN(searchNum) && (
        Math.abs(parseFloat(entry.debit_amount || 0) - searchNum) < 0.01 ||
        Math.abs(parseFloat(entry.credit_amount || 0) - searchNum) < 0.01 ||
        Math.abs(parseFloat(entry.closing_balance || 0) - searchNum) < 0.01 ||
        Math.abs(displayAmts.debit - searchNum) < 0.01 ||
        Math.abs(displayAmts.credit - searchNum) < 0.01
      ));

    // Dedicated Search by Amount filter (debit, credit, or balance match)
    let matchesAmount = true;
    if (filterAmount && filterAmount.trim() !== '') {
      const targetStr = filterAmount.trim();
      const targetNum = parseFloat(targetStr);
      const debitRaw = entry.debit_amount ? parseFloat(entry.debit_amount) : 0;
      const creditRaw = entry.credit_amount ? parseFloat(entry.credit_amount) : 0;
      const closingRaw = entry.closing_balance ? parseFloat(entry.closing_balance) : 0;
      const debitDisp = displayAmts.debit || 0;
      const creditDisp = displayAmts.credit || 0;

      const numMatch = !isNaN(targetNum) && (
        Math.abs(debitRaw - targetNum) < 0.01 ||
        Math.abs(creditRaw - targetNum) < 0.01 ||
        Math.abs(closingRaw - targetNum) < 0.01 ||
        Math.abs(debitDisp - targetNum) < 0.01 ||
        Math.abs(creditDisp - targetNum) < 0.01
      );

      const strMatch =
        entry.debit_amount?.toString().includes(targetStr) ||
        entry.credit_amount?.toString().includes(targetStr) ||
        entry.closing_balance?.toString().includes(targetStr) ||
        debitDisp.toString().includes(targetStr) ||
        creditDisp.toString().includes(targetStr);

      matchesAmount = numMatch || strMatch;
    }

    // Cascading filter logic for ledger entries
    const matchesCustomer = !selectedCustomer || entry.cus_id == selectedCustomer;
    const matchesCategory = !selectedCategory || entry.customer?.cus_category == selectedCategory;
    const matchesSubCategory = !selectedSubCategory || entry.customer?.cus_type == selectedSubCategory;
    const matchesLedgerType = !selectedLedgerType || entry.ledger_type === selectedLedgerType;

    // Date range filter
    let matchesDate = true;
    if (startDate || endDate) {
      const entryDateStr = new Date(entry.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      if (startDate) matchesDate = matchesDate && entryDateStr >= startDate;
      if (endDate) matchesDate = matchesDate && entryDateStr <= endDate;
    }

    if (allAccountsRecentViewIds && !allAccountsRecentViewIds.has(entry.l_id)) return false;

    return matchesSearch && matchesCustomer && matchesCategory && matchesSubCategory && matchesLedgerType && matchesDate && matchesAmount;
  });

  // Customer filtering logic
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.cus_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_email?.toLowerCase().includes(customerSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Account filtering logic for filter dropdown
  const filteredAccounts = customers.filter(customer => {
    const matchesCategory = !selectedCategory || customer.cus_category == selectedCategory;
    const matchesSubCategory = !selectedSubCategory || customer.cus_type == selectedSubCategory;

    if (!matchesCategory || !matchesSubCategory) return false;

    if (!accountSearchTerm) return true;
    const matchesSearch = customer.cus_name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_phone_no2?.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_reference?.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_email?.toLowerCase().includes(accountSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Dynamic Sub-Category Filtering logic based on selected Category
  const availableSubCategories = customerTypes.filter(type => {
    if (!selectedCategory) return true;
    // Show only types that have customers in the selected category
    return customers.some(customer =>
      customer.cus_category == selectedCategory &&
      customer.cus_type == type.cus_type_id
    );
  });

  const sortedLedgerEntries = filteredLedgerEntries.sort((a, b) => {
    if (sortBy === 'created_at') {
      return sortOrder === 'asc' ? compareChronologically(a, b) : compareChronologically(b, a);
    }

    let aValue, bValue;
    if (sortBy === 'debit_amount') {
      aValue = parseFloat(a.debit_amount);
      bValue = parseFloat(b.debit_amount);
    } else if (sortBy === 'credit_amount') {
      aValue = parseFloat(a.credit_amount);
      bValue = parseFloat(b.credit_amount);
    } else if (sortBy === 'closing_balance') {
      aValue = parseFloat(a.closing_balance);
      bValue = parseFloat(b.closing_balance);
    } else if (sortBy === 'customer') {
      aValue = a.customer?.cus_name.toLowerCase();
      bValue = b.customer?.cus_name.toLowerCase();
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (aValue === bValue) {
      return sortOrder === 'asc' ? compareChronologically(a, b) : compareChronologically(b, a);
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const finalLedgerEntries = sortedLedgerEntries.map((entry, index) => ({
    ...entry,
    sequentialId: index + 1
  }));

  // Bill amount per bill_no = sum of SALE-type debit entries only (excludes CASH/BANK_TRANSFER account entries)
  const billAmountMap = useMemo(() => {
    const map = {};
    for (const e of finalLedgerEntries) {
      if (!e.bill_no) continue;
      if (e.trnx_type !== 'SALE') continue;
      map[e.bill_no] = (map[e.bill_no] || 0) + parseFloat(e.debit_amount || 0);
    }
    return map;
  }, [finalLedgerEntries]);

  // Footer totals: debit/credit from ledger entry amounts; balance = last visible row (matches BALANCE column)
  const ledgerViewSummary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of finalLedgerEntries) {
      if (isOrderCustomerMemoLedgerEntry(entry)) continue;
      const displayAmts = getLedgerEntryDisplayAmounts(entry);
      totalDebit += displayAmts.debit;
      totalCredit += displayAmts.credit;
    }
    // Closing balance: use the chronologically latest row in the current view (not the bottom table row, which depends on sort)
    const byTime = [...finalLedgerEntries].sort(compareChronologically);
    const nonMemo = byTime.filter((e) => !isOrderCustomerMemoLedgerEntry(e));
    const lastForBalance = nonMemo.length > 0 ? nonMemo[nonMemo.length - 1] : byTime[byTime.length - 1];
    const lastClosing =
      lastForBalance != null ? parseFloat(lastForBalance.closing_balance || 0) : 0;
    return { totalDebit, totalCredit, lastClosing };
  }, [finalLedgerEntries]);

  const ledgerSummaryValueColors = useMemo(() => {
    const viewId = selectedCustomer || activeLedgerId;
    if (!viewId) return LEDGER_VALUE_COLORS;
    const viewCust = customers.find((c) => Number(c.cus_id) === Number(viewId));
    return viewCust && isSupplierOrCustomerLedgerEntry({ customer: viewCust })
      ? LEDGER_VALUE_COLORS_PARTY
      : LEDGER_VALUE_COLORS;
  }, [selectedCustomer, activeLedgerId, customers]);

  // Stats calculations - use filtered entries for accuracy when filters are applied
  const statsEntries = (selectedCustomer || searchTerm || selectedCategory || selectedSubCategory || startDate || endDate || useAllAccountsRecentDefault)
    ? filteredLedgerEntries
    : ledgerEntries;

  const statsEntriesForTotals = statsEntries.filter((e) => !isOrderCustomerMemoLedgerEntry(e));
  const totalDebit = statsEntriesForTotals.reduce((sum, entry) => {
    const displayAmts = getLedgerEntryDisplayAmounts(entry);
    return sum + displayAmts.debit;
  }, 0);
  const totalCredit = statsEntriesForTotals.reduce((sum, entry) => {
    const displayAmts = getLedgerEntryDisplayAmounts(entry);
    return sum + displayAmts.credit;
  }, 0);
  const totalPayments = statsEntriesForTotals.reduce((sum, entry) => sum + parseFloat(entry.payments || 0), 0);

  // Get the most accurate current balance: 
  // 1. For a selected customer, use their direct balance from the customer record
  // 2. Otherwise, use the closing balance from the most recent ledger entry (index 0 as it's sorted DESC from API)
  const currentBalance = selectedCustomer
    ? parseFloat(customers.find(c => Number(c.cus_id) === Number(selectedCustomer))?.cus_balance || 0)
    : (ledgerEntries.length > 0 ? parseFloat(ledgerEntries[0].closing_balance || 0) : 0);

  // Opening balance calculation for a selected account (first ledger transaction or current balance fallback)
  const accountOpeningBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    const customerEntries = ledgerEntries.filter(e => Number(e.cus_id) === Number(selectedCustomer));
    if (customerEntries.length === 0) {
      const cust = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      return cust ? parseFloat(cust.cus_balance || 0) : 0;
    }
    const sorted = [...customerEntries].sort(compareChronologically);
    return parseFloat(sorted[0].opening_balance || 0);
  }, [selectedCustomer, ledgerEntries, customers]);

  const receiveTotalPreview =
    parseFloat(receivePaymentData.cash_amount || 0) +
    parseFloat(receivePaymentData.bank_amount || 0) +
    parseFloat(receivePaymentData.discount || 0);
  const receiveBalanceAfter = currentBalance - receiveTotalPreview;

  const payTotalPreview =
    parseFloat(payPaymentData.cash_amount || 0) +
    parseFloat(payPaymentData.bank_amount || 0) +
    parseFloat(payPaymentData.discount || 0);
  const payBalanceAfter = currentBalance + payTotalPreview;

  const handleNewJournalEntry = () => {
    if (selectedCustomer) {
      const customer = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      if (customer) {
        setJournalData({
          journal_date: new Date().toISOString().split('T')[0],
          journal_type: 'PAYMENT',
          reference: '',
          description: `Entry for ${customer.cus_name}`,
        });
        setJournalLines([
          { account_id: customer.cus_id, debit_amount: '', credit_amount: '', description: '', accountSearch: customer.cus_name },
          { account_id: '', debit_amount: '', credit_amount: '', description: '', accountSearch: '' }
        ]);
        setShowJournalForm(true);
      }
    }
  };

  const addJournalLine = () => {
    setJournalLines([...journalLines, { account_id: '', debit_amount: '', credit_amount: '', description: '', accountSearch: '' }]);
  };

  const removeJournalLine = (index) => {
    if (journalLines.length <= 2) return;
    setJournalLines(journalLines.filter((_, i) => i !== index));
  };

  const handleJournalLineChange = (index, field, value) => {
    const newLines = [...journalLines];
    newLines[index][field] = value;
    setJournalLines(newLines);
  };

  const handleJournalSubmit = async (e) => {
    e.preventDefault();

    // Validations
    const validLines = journalLines.filter(l => l.account_id && (parseFloat(l.debit_amount || 0) > 0 || parseFloat(l.credit_amount || 0) > 0));
    if (validLines.length < 2) {
      alert('A journal entry must have at least two lines with accounts and amounts.');
      return;
    }

    const totalDebits = validLines.reduce((sum, l) => sum + parseFloat(l.debit_amount || 0), 0);
    const totalCredits = validLines.reduce((sum, l) => sum + parseFloat(l.credit_amount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      alert(`Totals are not balanced! Debit: ${fmtAmt(totalDebits)} | Credit: ${fmtAmt(totalCredits)}`);
      return;
    }

    try {
      const actorUserId = getCurrentUserId();
      if (!actorUserId) {
        alert('Session expired. Please log in again.');
        return;
      }

      setJournalStatus({ loading: true, error: null });
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...journalData,
          total_amount: totalDebits,
          journal_details: validLines.map(l => ({
            account_id: l.account_id,
            debit_amount: l.debit_amount || 0,
            credit_amount: l.credit_amount || 0,
            description: l.description || journalData.description
          })),
          created_by: getCurrentUserId()
        })
      });

      if (response.ok) {
        setShowJournalForm(false);
        fetchData();
        alert('Journal Entry saved as DRAFT successfully.');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save Journal Entry');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving journal entry');
    } finally {
      setJournalStatus({ loading: false, error: null });
    }
  };

  // Utility function for creating discount expenses
  const createDiscountExpense = async (discountAmount, description) => {
    try {
      // First, check if "Discount" expense title exists
      const expenseTitlesResponse = await fetch('/api/expense-titles');
      const expenseTitles = await expenseTitlesResponse.json();

      let discountTitleId = expenseTitles.find(title => title.title.toLowerCase() === 'discount')?.id;

      // If discount title doesn't exist, create it
      if (!discountTitleId) {
        const createTitleResponse = await fetch('/api/expense-titles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Discount' })
        });

        if (createTitleResponse.ok) {
          const newTitle = await createTitleResponse.json();
          discountTitleId = newTitle.id;
        } else {
          console.error('Failed to create discount expense title');
          return;
        }
      }

      // Create the expense entry
      const expenseData = {
        exp_title: `Discount - ${description}`,
        exp_type: discountTitleId,
        exp_detail: `Payment discount of PKR ${discountAmount}`,
        exp_amount: discountAmount,
        updated_by: getCurrentUserId()
      };

      const expenseResponse = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      });

      if (expenseResponse.ok) {
        console.log('Discount expense created successfully');
      } else {
        console.error('Failed to create discount expense');
      }
    } catch (error) {
      console.error('Error creating discount expense:', error);
    }
  };

  // Payment Functions
  const handleReceivePayment = () => {
    if (selectedCustomer) {
      const customer = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      if (customer) {
        setReceivePaymentData({
          total_payment: '',
          discount: '',
          cash_account: cashAccounts.length > 0 ? cashAccounts[0].cus_id : '',
          cash_amount: '',
          bank_account: '',
          bank_amount: '',
          description: buildFinancePaymentDescription('RECEIVE', customer.cus_name, '', '', '', bankAccounts, ''),
        });
        setShowReceivePaymentForm(true);
      }
    }
  };

  const handlePayPayment = () => {
    if (selectedCustomer) {
      const customer = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      if (customer) {
        setPayPaymentData({
          total_payment: '',
          discount: '',
          cash_account: cashAccounts.length > 0 ? cashAccounts[0].cus_id : '',
          cash_amount: '',
          bank_account: '',
          bank_amount: '',
          description: buildFinancePaymentDescription('PAY', customer.cus_name, '', '', '', bankAccounts, ''),
        });
        setShowPayPaymentForm(true);
      }
    }
  };

  const fetchCashBankAccounts = async () => {
    try {
      // Fetch customers with their categories and types
      const response = await fetch('/api/customers?dropdown=true');
      const allCustomers = await response.json();

      // Filter for cash accounts: category includes "cash"
      const cashAccs = allCustomers.filter(c => {
        const title = (c.customer_category?.cus_cat_title || '').toLowerCase();
        return title.includes('cash');
      });

      // Filter for bank accounts: category includes "bank"
      const bankAccs = allCustomers.filter(c => {
        const title = (c.customer_category?.cus_cat_title || '').toLowerCase();
        return title.includes('bank');
      });

      setCashAccounts(cashAccs);
      setBankAccounts(bankAccs);
    } catch (error) {
      console.error('Error fetching cash/bank accounts:', error);
    }
  };

  const handleReceivePaymentSubmit = async () => {
    try {
      const cashAmount = parseFloat(receivePaymentData.cash_amount || 0);
      const bankAmount = parseFloat(receivePaymentData.bank_amount || 0);
      const discountAmount = parseFloat(receivePaymentData.discount || 0);
      const totalAmount = cashAmount + bankAmount + discountAmount;

      if (totalAmount <= 0) {
        alert('Please enter at least one amount (Cash, Bank, or Discount)');
        return;
      }

      const authOk = await requireAuth();
      if (!authOk) return;

      const actorUserId = getCurrentUserId();
      if (!actorUserId) {
        alert('Session expired. Please log in again.');
        return;
      }

      beginSavingPayment('Processing amount received...');

      const paymentData = {
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'RECEIVE',
        account_id: selectedCustomer,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        cash_account_id: receivePaymentData.cash_account || null,
        cash_amount: cashAmount,
        bank_account_id: receivePaymentData.bank_account || null,
        bank_amount: bankAmount,
        description: receivePaymentData.description,
        created_by: actorUserId
      };

      const customer = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      const previousBalance = parseFloat(customer?.cus_balance || 0);

      updateSaveStatus('Saving payment to server...');
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        const result = await response.json();
        if (parseFloat(receivePaymentData.discount || 0) > 0) {
          updateSaveStatus('Recording discount...');
          await createDiscountExpense(-parseFloat(receivePaymentData.discount), receivePaymentData.description || 'Payment discount');
        }

        updateSaveStatus('Updating ledger...');
        const bankAcc = bankAccounts.find(b => b.cus_id === parseInt(receivePaymentData.bank_account));
        const cashAcc = cashAccounts.find(c => c.cus_id === parseInt(receivePaymentData.cash_account));
        
        const displayPrevBal = result.customer_opening_balance !== undefined ? result.customer_opening_balance : previousBalance;
        const displayRemBal = result.customer_closing_balance !== undefined ? result.customer_closing_balance : (previousBalance - totalAmount);

        setPaymentReceiptData({
          type: 'RECEIVE',
          paymentId: result.payment_id,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          customer: {
            ...customer,
            cus_balance: displayRemBal
          },
          previousBalance: displayPrevBal,
          remainingBalance: displayRemBal,
          cashAmount,
          bankAmount,
          discountAmount,
          totalAmount,
          bankAcc,
          cashAcc,
          description: receivePaymentData.description
        });

        setShowReceivePaymentForm(false);
        setReceivePaymentData({ total_payment: '', discount: '', cash_account: '', cash_amount: '', bank_account: '', bank_amount: '', description: '' });
        updateSaveStatus('Refreshing ledger...');
        fetchData();
        updateSaveStatus('Generating receipt...');
        setShowPaymentReceipt(true);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      alert('Failed to process payment');
    } finally {
      endSavingPayment();
    }
  };

  const handlePayPaymentSubmit = async () => {
    try {
      const cashAmount = parseFloat(payPaymentData.cash_amount || 0);
      const bankAmount = parseFloat(payPaymentData.bank_amount || 0);
      const discountAmount = parseFloat(payPaymentData.discount || 0);
      const totalAmount = cashAmount + bankAmount + discountAmount;

      if (totalAmount <= 0) {
        alert('Please enter at least one amount (Cash, Bank, or Discount)');
        return;
      }

      const authOk = await requireAuth();
      if (!authOk) return;

      const actorUserId = getCurrentUserId();
      if (!actorUserId) {
        alert('Session expired. Please log in again.');
        return;
      }

      beginSavingPayment('Processing payout...');

      const paymentData = {
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'PAY',
        account_id: selectedCustomer,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        cash_account_id: payPaymentData.cash_account || null,
        cash_amount: cashAmount,
        bank_account_id: payPaymentData.bank_account || null,
        bank_amount: bankAmount,
        description: payPaymentData.description,
        created_by: actorUserId
      };

      const customer = customers.find(c => Number(c.cus_id) === Number(selectedCustomer));
      const previousBalance = parseFloat(customer?.cus_balance || 0);

      updateSaveStatus('Saving payment to server...');
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        const result = await response.json();
        if (parseFloat(payPaymentData.discount || 0) > 0) {
          updateSaveStatus('Recording discount...');
          await createDiscountExpense(parseFloat(payPaymentData.discount), payPaymentData.description || 'Payment discount');
        }

        updateSaveStatus('Updating ledger...');
        const bankAcc = bankAccounts.find(b => b.cus_id === parseInt(payPaymentData.bank_account));
        const cashAcc = cashAccounts.find(c => c.cus_id === parseInt(payPaymentData.cash_account));
        
        const displayPrevBal = result.customer_opening_balance !== undefined ? result.customer_opening_balance : previousBalance;
        const displayRemBal = result.customer_closing_balance !== undefined ? result.customer_closing_balance : (previousBalance + totalAmount);

        setPaymentReceiptData({
          type: 'PAY',
          paymentId: result.payment_id,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          customer: {
            ...customer,
            cus_balance: displayRemBal
          },
          previousBalance: displayPrevBal,
          remainingBalance: displayRemBal,
          cashAmount,
          bankAmount,
          discountAmount,
          totalAmount,
          bankAcc,
          cashAcc,
          description: payPaymentData.description
        });

        setShowPayPaymentForm(false);
        setPayPaymentData({ total_payment: '', discount: '', cash_account: '', cash_amount: '', bank_account: '', bank_amount: '', description: '' });
        updateSaveStatus('Refreshing ledger...');
        fetchData();
        updateSaveStatus('Generating receipt...');
        setShowPaymentReceipt(true);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      alert('Failed to process payment');
    } finally {
      endSavingPayment();
    }
  };

  const handleSendPaymentWhatsApp = async () => {
    const d = paymentReceiptData;
    if (!d?.customer?.cus_phone_no) {
      alert('No phone number on file for this account. Add a phone on the customer record to send WhatsApp.');
      return;
    }
    const fmt = (v) => (v == null || v === '' ? '—' : fmtAmt(v));
    const isPay = d.type === 'PAY';
    const accentColor = isPay ? '#ef4444' : '#16a34a';
    const rows = [];
    rows.push(`<tr style="background:#f9fafb"><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600">Previous Balance (سابقہ بقایا)</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmt(d.previousBalance)}</td></tr>`);
    if (d.cashAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Cash${d.cashAcc ? ` (${d.cashAcc.cus_name})` : ''}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.cashAmount)}</td></tr>`);
    if (d.bankAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Bank${d.bankAcc ? ` (${d.bankAcc.cus_name})` : ''}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.bankAmount)}</td></tr>`);
    if (d.discountAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Discount</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.discountAmount)}</td></tr>`);
    rows.push(`<tr style="background:#f1f5f9"><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:700">Total Paid</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${fmt(d.totalAmount)}</td></tr>`);
    const remRowBg = isPay ? '#ef4444' : '#16a34a';
    rows.push(`<tr style="background:${remRowBg}"><td style="padding:12px 14px;color:white;font-weight:700">Remaining Balance (کل بقایا)</td><td style="padding:12px 14px;text-align:right;font-weight:700;color:#ffffff">${d.remainingBalance == null ? '—' : `PKR ${fmt(d.remainingBalance)}`}</td></tr>`);

    let tempEl = null;
    try {
      setIsSendingPaymentWhatsApp(true);
      tempEl = document.createElement('div');
      Object.assign(tempEl.style, {
        position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
        width: '680px', background: '#fff', padding: '28px',
        fontFamily: 'Arial, sans-serif', boxSizing: 'border-box',
      });
      tempEl.innerHTML = `
        <div style="text-align:center;padding-bottom:14px;border-bottom:2px solid #000;margin-bottom:16px;">
          <h2 style="margin:0;font-size:20px;direction:rtl;">اتفاق آئرن اینڈ سیمنٹ سٹور</h2>
          <p style="margin:4px 0;direction:rtl;">گجرات سرگودھا روڈ، پاہڑیانوالی</p>
          <p style="margin:4px 0;">Ph:- 0346-7560306, 0300-7560306</p>
          <h3 style="margin:10px 0 0 0;color:${accentColor};letter-spacing:1px;">${isPay ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}</h3>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding:0 4px;">
          <div>
            <p style="margin:4px 0;"><strong>Account:</strong> ${d.customer?.cus_name || '—'}</p>
            <p style="margin:4px 0;"><strong>Phone:</strong> ${d.customer?.cus_phone_no || '—'}</p>
            ${d.description ? `<p style="margin:4px 0;"><strong>Note:</strong> ${d.description}</p>` : ''}
          </div>
          <div style="text-align:right;">
            <p style="margin:4px 0;"><strong>Ref #:</strong> PAY-${d.paymentId}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> ${d.date || '—'}</p>
            <p style="margin:4px 0;"><strong>Time:</strong> ${d.time || '—'}</p>
            <p style="margin:4px 0;"><strong>Created By:</strong> ${getCreatedByName(d, currentUser)}</p>
          </div>
        </div>
        <div style="border:1px solid #000;border-radius:4px;overflow:hidden;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;padding:8px 14px;background:#f5f5f5;border-bottom:1px solid #ddd;">
            <span style="font-weight:700;">Description</span><span style="font-weight:700;">Amount (PKR)</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;">
          <div style="text-align:center;flex:1;"><div style="border-top:1px solid #000;padding-top:4px;margin:0 20px;"><small>Received By</small></div></div>
          <div style="text-align:center;flex:1;"><div style="border-top:1px solid #000;padding-top:4px;margin:0 20px;"><small>Authorized Signature</small></div></div>
        </div>`;
      document.body.appendChild(tempEl);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 80));
      const { captureElementToCanvas, shareCanvasViaWhatsAppDesktop, whatsAppSuccessMessage } =
        await import('@/lib/whatsapp-local');
      const canvas = await captureElementToCanvas(tempEl);
      const { opened } = await shareCanvasViaWhatsAppDesktop(canvas, d.customer.cus_phone_no);
      alert(whatsAppSuccessMessage(opened));
    } catch (err) {
      alert(err.message || 'WhatsApp error');
    } finally {
      if (tempEl && tempEl.parentNode) tempEl.parentNode.removeChild(tempEl);
      setIsSendingPaymentWhatsApp(false);
    }
  };

  const buildLedgerPdfDocument = async () => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 40;
    const marginTop = 36;
    const marginBottom = 32;
    const contentW = pageW - marginX * 2;

    const customer = selectedCustomer ? customers.find(c => Number(c.cus_id) === Number(selectedCustomer)) : null;
    const today = new Date().toLocaleDateString('en-GB');
    const custName = customer?.cus_name || 'All Accounts Ledger';
    const balance = parseFloat(customer?.cus_balance ?? ledgerViewSummary.lastClosing ?? 0);
    const showAccountCol = !selectedCustomer;

    const chronologicalEntries = [...finalLedgerEntries].sort(compareChronologically);
    const pdfOpeningBalance = chronologicalEntries.length > 0 ? parseFloat(chronologicalEntries[0].opening_balance || 0) : 0;

    const totalDebit = chronologicalEntries.reduce((s, e) => s + getLedgerEntryDisplayAmounts(e).debit, 0);
    const totalCredit = chronologicalEntries.reduce((s, e) => s + getLedgerEntryDisplayAmounts(e).credit, 0);

    const custType = customer?.customer_type?.cus_type_title || '';
    const custCat = customer?.customer_category?.cus_cat_title || '';
    const typeLabel = [custType, custCat].filter(Boolean).join(' · ');

    // Top brand accent (page 1)
    doc.setFillColor(...LEDGER_PDF.blue);
    doc.rect(0, 0, pageW, 4, 'F');

    const { imgData, imgH } = await captureLedgerPdfHeader({
      contentW,
      custName,
      typeLabel,
      today,
      entryCount: chronologicalEntries.length,
      compact: true,
    });
    const headerTop = 10;
    doc.addImage(imgData, 'PNG', marginX, headerTop, contentW, imgH);

    const statBottom = drawLedgerPdfStatBoxes(doc, {
      marginX,
      statY: headerTop + imgH + 10,
      contentW,
      opening: pdfOpeningBalance,
      totalDebit,
      totalCredit,
      closing: balance,
      fmtAmt,
      compact: true,
    });

    const tableHead = showAccountCol
      ? ['#', 'Date', 'Account', 'Particulars', 'Debit', 'Credit', 'Balance']
      : ['#', 'Date', 'Particulars', 'Debit', 'Credit', 'Balance', 'Type'];

    const rows = chronologicalEntries.map((entry) => {
      const date = entry.created_at
        ? new Date(entry.created_at).toLocaleDateString('en-GB')
        : '—';
      const account = entry.customer?.cus_name || 'Cash Account';
      let desc = formatLedgerParticulars(entry.details) || 'N/A';
      if (entry.bill_no) desc += ` (Bill #${entry.bill_no})`;
      const displayAmts = getLedgerEntryDisplayAmounts(entry);
      const debit = displayAmts.debit > 0 ? fmtAmt(displayAmts.debit) : '—';
      const credit = displayAmts.credit > 0 ? fmtAmt(displayAmts.credit) : '—';
      const bal = fmtAmt(entry.closing_balance);
      const ledgerType = entry.ledger_type || '—';

      if (showAccountCol) {
        return [String(entry.l_id), date, account, desc, debit, credit, bal];
      }
      return [String(entry.l_id), date, desc, debit, credit, bal, ledgerType];
    });

    const footLabelCol = showAccountCol ? 3 : 2;
    const footDebitCol = showAccountCol ? 4 : 3;
    const footCreditCol = showAccountCol ? 5 : 4;
    const footBalanceCol = showAccountCol ? 6 : 5;

    const footRow = new Array(tableHead.length).fill('');
    footRow[footLabelCol] = 'Period Total';
    footRow[footDebitCol] = fmtAmt(totalDebit);
    footRow[footCreditCol] = fmtAmt(totalCredit);
    footRow[footBalanceCol] = fmtAmt(balance);

    const columnStyles = showAccountCol
      ? {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 48 },
          2: { cellWidth: 62 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 52, halign: 'right' },
          5: { cellWidth: 52, halign: 'right' },
          6: { cellWidth: 58, halign: 'right' },
        }
      : {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 48 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 52, halign: 'right' },
          4: { cellWidth: 52, halign: 'right' },
          5: { cellWidth: 58, halign: 'right' },
          6: { cellWidth: 42, halign: 'center' },
        };

    autoTable(doc, {
      startY: statBottom + 12,
      tableWidth: contentW,
      margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'auto',
      head: [tableHead],
      body: rows,
      foot: [footRow],
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        lineColor: LEDGER_PDF.border,
        lineWidth: 0.35,
        textColor: LEDGER_PDF.dark,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: LEDGER_PDF.blue,
        textColor: LEDGER_PDF.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
      },
      footStyles: {
        fillColor: LEDGER_PDF.summaryRow,
        textColor: LEDGER_PDF.dark,
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles,
      didParseCell: (data) => {
        const col = data.column.index;
        const debitCol = showAccountCol ? 4 : 3;
        const creditCol = showAccountCol ? 5 : 4;
        const balanceCol = showAccountCol ? 6 : 5;
        const typeCol = showAccountCol ? -1 : 6;

        if (data.section === 'head') {
          data.cell.styles.fillColor = LEDGER_PDF.blue;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8.5;
          data.cell.styles.textColor = LEDGER_PDF.white;
          return;
        }

        if (data.section === 'body') {
          const entry = chronologicalEntries[data.row.index];
          if (!entry) return;
          const displayAmts = getLedgerEntryDisplayAmounts(entry);
          const isDebit = displayAmts.debit > 0;
          const isCredit = displayAmts.credit > 0;

          data.cell.styles.fillColor = LEDGER_PDF.white;

          const partyLedger = isSupplierOrCustomerLedgerEntry(entry);
          const pdfDebitColor = partyLedger ? LEDGER_PDF.creditText : LEDGER_PDF.debitText;
          const pdfCreditColor = partyLedger ? LEDGER_PDF.debitText : LEDGER_PDF.creditText;
          if (col === debitCol && isDebit) {
            data.cell.styles.textColor = pdfDebitColor;
            data.cell.styles.fontStyle = 'bold';
          } else if (col === creditCol && isCredit) {
            data.cell.styles.textColor = pdfCreditColor;
            data.cell.styles.fontStyle = 'bold';
          } else if (col === balanceCol) {
            data.cell.styles.textColor = LEDGER_PDF.blueDark;
            data.cell.styles.fontStyle = 'bold';
          }
          if (col === 0) {
            data.cell.styles.halign = 'center';
            data.cell.styles.textColor = LEDGER_PDF.slate;
            data.cell.styles.fontSize = 7;
          }
          if (col === typeCol) {
            const typeStyle = getLedgerTypeStyle(entry.ledger_type);
            data.cell.styles.fontSize = 7;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = typeStyle.text;
          }
          return;
        }

        if (data.section === 'foot') {
          const partyPdfView = customer && isSupplierOrCustomerLedgerEntry({ customer });
          const footDebitColor = partyPdfView ? LEDGER_PDF.creditText : LEDGER_PDF.debitText;
          const footCreditColor = partyPdfView ? LEDGER_PDF.debitText : LEDGER_PDF.creditText;
          if (col === footLabelCol) {
            data.cell.styles.halign = 'left';
            data.cell.styles.fontStyle = 'bold';
          }
          if (col === footDebitCol) {
            data.cell.styles.fillColor = LEDGER_PDF.summaryDebit;
            data.cell.styles.textColor = footDebitColor;
            data.cell.styles.halign = 'right';
          }
          if (col === footCreditCol) {
            data.cell.styles.fillColor = LEDGER_PDF.summaryCredit;
            data.cell.styles.textColor = footCreditColor;
            data.cell.styles.halign = 'right';
          }
          if (col === footBalanceCol) {
            data.cell.styles.fillColor = LEDGER_PDF.summaryBalance;
            data.cell.styles.textColor = LEDGER_PDF.blueDark;
            data.cell.styles.halign = 'right';
          }
        }
      },
      didDrawPage: () => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
        drawLedgerPdfPageFooter(doc, { marginX, pageW, pageH, pageNum, pageCount });
      },
    });

    return { doc, custName };
  };

  const handleDownloadLedgerPdf = async () => {
    if (finalLedgerEntries.length === 0) {
      alert('No ledger entries to download.');
      return;
    }
    try {
      setIsDownloadingLedgerPdf(true);
      const { doc, custName } = await buildLedgerPdfDocument();
      const fileDate = new Date().toISOString().slice(0, 10);
      const safeName = String(custName).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Ledger';
      doc.save(`Ledger-${safeName}-${fileDate}.pdf`);
    } catch (err) {
      alert(err.message || 'PDF download failed');
    } finally {
      setIsDownloadingLedgerPdf(false);
    }
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectCustomer = (customer) => {
    setFormData(prev => ({ ...prev, cus_id: customer.cus_id }));
    setCustomerSearchTerm(customer.cus_name);
    setShowCustomerDropdown(false);
  };

  const getSelectedCustomer = () => {
    return customers.find(customer => customer.cus_id === formData.cus_id);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const authOk = await requireAuth();
    if (!authOk) return;
    try {
      // Validation
      if (!formData.cus_id) {
        alert('Please select an account');
        return;
      }

      if (!formData.debit_amount && !formData.credit_amount) {
        alert('Please enter either debit or credit amount');
        return;
      }

      setIsSubmittingLedger(true);

      const url = editingLedger ? '/api/ledger' : '/api/ledger';
      const method = editingLedger ? 'PUT' : 'POST';

      const cashAmt = parseFloat(formData.cash_amount || 0);
      const bankAmt = parseFloat(formData.bank_amount || 0);
      const discountAmt = parseFloat(formData.discount_amount || 0);
      const totalPayments = cashAmt + bankAmt + discountAmt;
      let trnx_type = 'CASH';
      if (bankAmt > 0 && cashAmt <= 0) trnx_type = 'BANK_TRANSFER';
      else if (bankAmt > 0 && cashAmt > 0) trnx_type = 'BANK_TRANSFER';

      const discountNote = discountAmt > 0 ? ` | Discount: PKR ${fmtAmt(discountAmt)}` : '';
      const submitData = {
        cus_id: formData.cus_id,
        debit_amount: formData.debit_amount,
        credit_amount: formData.credit_amount,
        bill_no: formData.bill_no,
        trnx_type,
        details: (formData.details || '') + discountNote,
        payments: totalPayments,
        bank_title: selectedLedgerBankAccount?.cus_name || '',
      };

      const body = editingLedger
        ? { id: editingLedger.l_id, ...submitData }
        : { ...submitData };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Create discount expense if discount amount is entered
        if (discountAmt > 0) {
          const acct = customers.find(c => c.cus_id === formData.cus_id);
          const acctName = acct?.cus_name || `Account #${formData.cus_id}`;
          const billRef = formData.bill_no ? ` | Bill: ${formData.bill_no}` : '';
          const description = `${acctName}${billRef}${formData.details ? ' | ' + formData.details : ''}`;
          await createDiscountExpense(discountAmt, description);
        }

        await fetchData();
        setShowLedgerForm(false);
        setEditingLedger(null);
        setSelectedLedgerBankAccount(null);
        setFormData({
          cus_id: '',
          debit_amount: '',
          credit_amount: '',
          bill_no: '',
          trnx_type: 'CASH',
          details: '',
          cash_amount: '',
          bank_amount: '',
          discount_amount: '',
        });
      }
    } catch (error) {
      console.error('Error saving ledger entry:', error);
    } finally {
      setIsSubmittingLedger(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingLedger(entry);
    const cashAmt = entry.trnx_type === 'BANK_TRANSFER' ? '' : entry.payments?.toString() || '';
    const bankAmt = entry.trnx_type === 'BANK_TRANSFER' ? entry.payments?.toString() || '' : '';
    setFormData({
      cus_id: entry.cus_id,
      debit_amount: entry.debit_amount.toString(),
      credit_amount: entry.credit_amount.toString(),
      bill_no: entry.bill_no || '',
      trnx_type: entry.trnx_type,
      details: entry.details || '',
      cash_amount: cashAmt,
      bank_amount: bankAmt,
      discount_amount: '',
    });
    setSelectedLedgerBankAccount(null);
    setCustomerSearchTerm(entry.customer?.cus_name || '');
    setShowLedgerForm(true);
  };

  // Handle delete all ledger entries
  const handleDeleteAllLedger = async (type) => {
    const typeNames = {
      purchase: 'PURCHASE',
      order: 'ORDER/SUBSCRIPTION',
      sales: 'SALES',
      all: 'ALL'
    };

    if (window.confirm(`Are you sure you want to delete all ${typeNames[type]} ledger entries? This action cannot be undone.`)) {
      try {
        const response = await fetch('/api/ledger/delete-all', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        });

        if (response.ok) {
          const data = await response.json();
          alert(`✅ ${data.message}\n\nDetails:\n${Object.entries(data.details).map(([k, v]) => `${k}: ${v}`).join('\n')}`);
          await fetchData();
        } else {
          alert('❌ Failed to delete ledger entries');
        }
      } catch (error) {
        console.error('Error deleting ledger entries:', error);
        alert('❌ Error: ' + error.message);
      }
    }
  };

  const handleDelete = async (entryId) => {
    if (window.confirm('Are you sure you want to delete this ledger entry?')) {
      try {
        const response = await fetch(`/api/ledger?id=${entryId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchData();
        }
      } catch (error) {
        console.error('Error deleting ledger entry:', error);
      }
    }
  };

  const activateLedger = (cusId, cusName) => {
    const id = Number(cusId);
    if (!id) return;
    const name = cusName || customers.find((c) => Number(c.cus_id) === id)?.cus_name || `Account #${id}`;
    setActiveLedgerId(id);
    setSelectedCustomer(String(id));
    setAccountSearchTerm(name);
    setOpenLedgers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, minimized: false, name } : l))
    );
  };

  const openCustomerLedger = (cusId, cusName) => {
    const id = Number(cusId);
    if (!id) return;
    const name = cusName || customers.find((c) => Number(c.cus_id) === id)?.cus_name || `Account #${id}`;
    setOpenLedgers((prev) => {
      const exists = prev.find((l) => l.id === id);
      if (exists) {
        return prev.map((l) => (l.id === id ? { ...l, minimized: false, name } : l));
      }
      return [...prev, { id, name, minimized: false }];
    });
    setActiveLedgerId(id);
    setSelectedCustomer(String(id));
    setAccountSearchTerm(name);
  };

  const minimizeLedger = (cusId) => {
    const id = Number(cusId);
    setOpenLedgers((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, minimized: true } : l));
      if (Number(activeLedgerId) === id) {
        const next = updated.find((l) => !l.minimized);
        if (next) {
          setActiveLedgerId(next.id);
          setSelectedCustomer(String(next.id));
          setAccountSearchTerm(next.name);
        } else {
          setActiveLedgerId(null);
          setSelectedCustomer('');
          setAccountSearchTerm('');
        }
      }
      return updated;
    });
  };

  const toggleLedgerMinimize = (cusId) => {
    const id = Number(cusId);
    const tab = openLedgers.find((l) => l.id === id);
    if (!tab) return;
    if (tab.minimized) {
      restoreLedger(id);
    } else {
      minimizeLedger(id);
    }
  };

  const closeLedgerTab = (cusId) => {
    const id = Number(cusId);
    setOpenLedgers((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      if (Number(activeLedgerId) === id) {
        const next = updated.find((l) => !l.minimized);
        if (next) {
          setActiveLedgerId(next.id);
          setSelectedCustomer(String(next.id));
          setAccountSearchTerm(next.name);
        } else {
          setActiveLedgerId(null);
          setSelectedCustomer('');
          setAccountSearchTerm('');
        }
      }
      return updated;
    });
  };

  const restoreLedger = (cusId) => {
    activateLedger(cusId);
  };

  const showAllAccountsView = () => {
    setActiveLedgerId(null);
    setSelectedCustomer('');
    setAccountSearchTerm('');
    setAllAccountsFullLedger(false);
  };

  const activeLedgerTab = openLedgers.find((l) => l.id === Number(activeLedgerId));
  const openLedgerTabs = openLedgers.filter((l) => !l.minimized);
  const minimizedLedgerTabs = openLedgers.filter((l) => l.minimized);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAmount('');
    setSelectedCategory('');
    setSelectedSubCategory('');
    setSortBy('created_at');
    setSortOrder('desc');
    setStartDate('');
    setEndDate('');
    setSelectedLedgerType('');
    if (!activeLedgerId) {
      setAllAccountsFullLedger(true);
    }
    // Open ledger tabs stay until you click X — not cleared here
    if (!activeLedgerId) {
      setSelectedCustomer('');
      setAccountSearchTerm('');
    } else {
      const tab = openLedgers.find((l) => l.id === Number(activeLedgerId));
      if (tab && !tab.minimized) {
        setSelectedCustomer(String(activeLedgerId));
        setAccountSearchTerm(tab.name);
      }
    }
  };

  // Print Ledger between two dates (Always Ascending Chronological Order)
  const handlePrintLedger = () => {
    let fromStr = printFromDate;
    let toStr = printToDate;

    if (!fromStr || !toStr) {
      if (finalLedgerEntries.length > 0) {
        const sortedAsc = [...finalLedgerEntries].sort(compareChronologically);
        fromStr = fromStr || new Date(sortedAsc[0].created_at).toISOString().split('T')[0];
        toStr = toStr || new Date(sortedAsc[sortedAsc.length - 1].created_at).toISOString().split('T')[0];
      } else {
        alert('Please select both From and To dates');
        return;
      }
    }

    if (new Date(fromStr) > new Date(toStr)) {
      alert('From date cannot be after To date');
      return;
    }

    const from = new Date(fromStr);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);

    // Filter entries by date range (from the currently visible/filtered entries)
    const dateFilteredEntries = finalLedgerEntries.filter(entry => {
      const entryDate = new Date(entry.created_at);
      return entryDate >= from && entryDate <= to;
    });

    if (dateFilteredEntries.length === 0) {
      alert('No ledger entries found in the selected date range.');
      return;
    }

    // ALWAYS sort in ascending chronological order for printing
    const chronologicalPrintEntries = [...dateFilteredEntries].sort(compareChronologically);
    const printOpeningBalance = chronologicalPrintEntries.length > 0 ? parseFloat(chronologicalPrintEntries[0].opening_balance || 0) : 0;
    const balance = chronologicalPrintEntries.length > 0 ? parseFloat(chronologicalPrintEntries[chronologicalPrintEntries.length - 1].closing_balance || 0) : 0;

    const customer = selectedCustomer ? customers.find(c => Number(c.cus_id) === Number(selectedCustomer)) : null;
    const custName = customer?.cus_name || 'All Accounts';

    // Calculate totals for filtered entries
    const filteredNonMemo = chronologicalPrintEntries.filter(e => !isOrderCustomerMemoLedgerEntry(e));
    const printTotalDebit = filteredNonMemo.reduce((s, e) => {
      const { debit } = getLedgerEntryDisplayAmounts(e);
      return s + debit;
    }, 0);
    const printTotalCredit = filteredNonMemo.reduce((s, e) => {
      const { credit } = getLedgerEntryDisplayAmounts(e);
      return s + credit;
    }, 0);

    const fromFormatted = new Date(fromStr).toLocaleDateString('en-GB');
    const toFormatted = new Date(toStr).toLocaleDateString('en-GB');
    const printSummaryColors =
      customer && isSupplierOrCustomerLedgerEntry({ customer })
        ? LEDGER_VALUE_COLORS_PARTY
        : LEDGER_VALUE_COLORS;

    // Build table rows
    const tableRows = chronologicalPrintEntries.map((entry, i) => {
      const date = entry.created_at
        ? new Date(entry.created_at).toLocaleDateString('en-GB') + ' ' + new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';
      const account = entry.customer?.cus_name || '—';
      const desc = entry.details
        ? String(entry.details).replace(/\{.*?\}/g, '').replace(/\|/g, ' ').trim().slice(0, 80)
        : '—';
      const bill = entry.bill_no || '—';
      const displayAmts = getLedgerEntryDisplayAmounts(entry);
      const credit = displayAmts.credit;
      const debit = displayAmts.debit;
      const bal = parseFloat(entry.closing_balance || 0);
      const valueColors = getLedgerValueColors(entry);
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:center;font-weight:600">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:11px">${date}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-weight:600">${account}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${desc}${entry.bill_no ? '<br/><span style="color:#6b7280;font-size:10px">Bill: ' + bill + '</span>' : ''}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;color:${valueColors.debit};font-weight:600">${debit > 0 ? fmtAmt(debit) : '-'}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;color:${valueColors.credit};font-weight:600">${credit > 0 ? fmtAmt(credit) : '-'}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;font-weight:700;color:${valueColors.balance}">${fmtAmt(bal)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ledger - ${custName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:white;padding:20px;color:#111}
  @media print{body{padding:10px}@page{size:A4 portrait;margin:8mm 10mm}}
  table{width:100%;border-collapse:collapse}
  .header{text-align:center;padding-bottom:12px;border-bottom:3px solid #1f2937;margin-bottom:16px}
  .header h1{font-size:20px;font-weight:bold;direction:rtl;margin-bottom:4px}
  .header p{font-size:12px;color:#555;margin:2px 0}
  .header .ledger-title{font-size:16px;font-weight:800;letter-spacing:1px;margin-top:8px;color:#1f2937}
  .meta{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px}
  .meta .left h3{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:2px}
  .meta .left p{font-size:11px;color:#64748b}
  .meta .right{text-align:right}
  .meta .right p{font-size:11px;color:#64748b;margin:2px 0}
  .meta .right strong{color:#1e293b}
  thead th{background:#1f2937;color:white;padding:8px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #374151}
  .footer-row td{background:#1f2937;color:white;padding:10px 8px;font-weight:700;font-size:12px;border:1px solid #374151}
  .footer-row .credit-total{color:#86efac}
  .footer-row .debit-total{color:#fca5a5}
  .footer-row .balance-total{color:#93c5fd}
  .print-footer{margin-top:30px;display:flex;justify-content:space-between}
  .print-footer .sig{text-align:center;flex:1;margin:0 20px}
  .print-footer .sig-line{border-top:1px solid #000;padding-top:6px;font-size:11px;color:#555}
</style></head><body>
<div class="header">
  <h1>اتفاق آئرن اینڈ سیمنٹ سٹور</h1>
  <p style="direction:rtl">گجرات سرگودھا روڈ، پاہڑیانوالی</p>
  <p>Ph:- 0346-7560306, 0300-7560306</p>
  <div class="ledger-title">GENERAL LEDGER</div>
</div>
<div class="meta">
  <div class="left">
    <h3>${custName}${customer?.customer_type?.cus_type_title ? ` (${customer.customer_type.cus_type_title}${customer.customer_category?.cus_cat_title ? ` - ${customer.customer_category.cus_cat_title}` : ''})` : ''}</h3>
    <p>${dateFilteredEntries.length} entries</p>
  </div>
  <div class="right">
    <p><strong>From:</strong> ${fromFormatted}</p>
    <p><strong>To:</strong> ${toFormatted}</p>
    <p><strong>Opening Balance:</strong> PKR ${fmtAmt(printOpeningBalance)}</p>
    <p><strong>Closing Balance:</strong> PKR ${fmtAmt(balance)}</p>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:35px;text-align:center">S#</th>
      <th style="width:120px">Date & Time</th>
      <th style="width:140px">Account</th>
      <th>Description</th>
      <th style="width:90px;text-align:right">Debit (PKR)</th>
      <th style="width:90px;text-align:right">Credit (PKR)</th>
      <th style="width:100px;text-align:right">Balance (PKR)</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="footer-row">
      <td colspan="4" style="text-align:center;font-size:13px">TOTAL SUMMARY</td>
      <td style="text-align:right;color:${printSummaryColors.debit}">${fmtAmt(printTotalDebit)}</td>
      <td style="text-align:right;color:${printSummaryColors.credit}">${fmtAmt(printTotalCredit)}</td>
      <td class="balance-total" style="text-align:right;color:${printSummaryColors.balance}">${fmtAmt(balance)}</td>
    </tr>
  </tbody>
</table>
<div class="print-footer">
  <div class="sig"><div class="sig-line">Prepared By</div></div>
  <div class="sig"><div class="sig-line">Checked By</div></div>
  <div class="sig"><div class="sig-line">Authorized Signature</div></div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=1100,height=700');
    win.document.write(html);
    win.document.close();
    setShowPrintLedgerDialog(false);
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary">
            Loading ledger entries...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  if (!mounted) {
    return (
      <DashboardLayout>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary">
            Initializing...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SaveProgressBackdrop
        open={paymentStatus.loading}
        message={saveStatusMessage}
        subMessage="Do not close or refresh until the payment is saved and the receipt is ready"
      />
      <Container maxWidth={false} sx={{ display: 'flex', flexDirection: 'column', p: { xs: 2, md: 2.5 }, pb: 4, gap: 2.5, ...LEDGER_UI.page }}>

        {/* Summary KPIs */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: selectedCustomer ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          },
          gap: 2,
        }}>
          {(() => {
            const stats = [];
            if (selectedCustomer) {
              stats.push({
                title: 'Opening Balance',
                val: accountOpeningBalance,
                color: BRAND.supporting.periwinkle,
                icon: <DollarSign size={20} />
              });
            }
            stats.push(
              { title: 'Total Debit', val: totalDebit, color: BRAND.supporting.green, icon: <TrendingUp size={20} /> },
              { title: 'Total Credit', val: totalCredit, color: BRAND.primary.pink, icon: <TrendingDown size={20} /> },
              { title: 'Current Balance', val: currentBalance, color: BRAND.primary.blue, icon: <Receipt size={20} /> }
            );
            return stats.map((stat, i) => (
              <Box key={i} sx={LEDGER_UI.statCard(stat.color)}>
                <Avatar sx={{
                  bgcolor: `${stat.color}12`,
                  color: stat.color,
                  width: 44,
                  height: 44,
                }}>
                  {stat.icon}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{
                    display: 'block',
                    color: '#94a3b8',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    mb: 0.25,
                  }}>
                    {stat.title}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                    <Typography component="span" sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, mr: 0.5 }}>PKR</Typography>
                    {fmtAmt(stat.val)}
                  </Typography>
                </Box>
              </Box>
            ));
          })()}
        </Box>

        {/* Smart filter + account tabs toolbar */}
        <Card sx={LEDGER_UI.sectionCard}>
          {(openLedgers.length > 0 || minimizedLedgerTabs.length > 0) && (
            <Box sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid #eef1f6',
              bgcolor: '#fafbfd',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
            }}>
              <Box
                onClick={showAllAccountsView}
                sx={{
                  ...LEDGER_UI.accountTab(!activeLedgerId),
                  px: 1.5,
                  py: 0.6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  '&:hover': { opacity: 0.92 },
                }}
              >
                All Accounts
              </Box>
              {openLedgerTabs.map((tab) => {
                const isActive = Number(activeLedgerId) === tab.id;
                const balance = parseFloat(customers.find((c) => Number(c.cus_id) === tab.id)?.cus_balance || 0);
                return (
                  <Box key={tab.id} sx={LEDGER_UI.accountTab(isActive)}>
                    <Box
                      onClick={() => activateLedger(tab.id, tab.name)}
                      sx={{ px: 1.5, py: 0.5, cursor: 'pointer', minWidth: 0 }}
                    >
                      <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.8125rem', maxWidth: 160, lineHeight: 1.2 }}>
                        {tab.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 600 }}>
                        PKR {fmtAmt(balance)}
                      </Typography>
                    </Box>
                    <Tooltip title="Minimize">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleLedgerMinimize(tab.id); }}
                        sx={{ color: isActive ? 'rgba(255,255,255,0.9)' : '#64748b', borderRadius: 0, p: 0.5, '&:hover': { bgcolor: isActive ? 'rgba(255,255,255,0.15)' : '#f1f5f9' } }}>
                        <Minimize2 size={13} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Close">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); closeLedgerTab(tab.id); }}
                        sx={{ color: isActive ? 'rgba(255,255,255,0.9)' : '#64748b', borderRadius: 0, p: 0.5, mr: 0.25, '&:hover': { bgcolor: isActive ? 'rgba(255,255,255,0.15)' : '#fee2e2', color: '#dc2626' } }}>
                        <X size={13} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
              {minimizedLedgerTabs.map((tab) => (
                <Box key={`min-${tab.id}`} sx={LEDGER_UI.minimizedTab}>
                  <Box onClick={() => restoreLedger(tab.id)}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#92400e', '&:hover': { bgcolor: '#fef3c7' } }}>
                    <Minimize2 size={12} />
                    {tab.name}
                  </Box>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); closeLedgerTab(tab.id); }}
                    sx={{ borderRadius: 0, p: 0.5, color: '#b45309', '&:hover': { bgcolor: '#fee2e2', color: '#dc2626' } }}>
                    <X size={12} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.75, borderBottom: filtersExpanded ? '1px solid #eef1f6' : 'none' }}>
            <Box sx={LEDGER_FILTER_COMPACT_GRID}>
              <FormControl fullWidth size="small" sx={LEDGER_FILTER_FIELD_SX}>
                <InputLabel>Category</InputLabel>
                <Select value={selectedCategory} label="Category"
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubCategory(''); if (!activeLedgerId) setSelectedCustomer(''); }}>
                  <MenuItem value="">All Categories</MenuItem>
                  {customerCategories.map((cat) => (
                    <MenuItem key={cat.cus_cat_id} value={cat.cus_cat_id.toString()}>{cat.cus_cat_title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" sx={LEDGER_FILTER_FIELD_SX}>
                <InputLabel>Customer Type</InputLabel>
                <Select value={selectedSubCategory} label="Customer Type"
                  onChange={(e) => { setSelectedSubCategory(e.target.value); if (!activeLedgerId) setSelectedCustomer(''); }}>
                  <MenuItem value="">All Customer Types</MenuItem>
                  {availableSubCategories.map((type) => (
                    <MenuItem key={type.cus_type_id} value={type.cus_type_id.toString()}>{type.cus_type_title}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                fullWidth
                autoSelect
                autoHighlight
                openOnFocus
                selectOnFocus
                size="small"
                options={filteredAccounts}
                getOptionLabel={(option) => option.cus_name}
                getOptionKey={customerOptionKey}
                isOptionEqualToValue={isSameCustomerOption}
                value={selectedCustomer ? customers.find(c => Number(c.cus_id) === Number(selectedCustomer)) : null}
                onChange={(event, newValue) => {
                  if (newValue) openCustomerLedger(newValue.cus_id, newValue.cus_name);
                  else showAllAccountsView();
                }}
                inputValue={accountSearchTerm}
                onInputChange={(event, newInputValue) => setAccountSearchTerm(newInputValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Account" placeholder="Select account..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <Fragment>
                          <InputAdornment position="start"><Search size={16} color={BRAND.primary.blue} /></InputAdornment>
                          {params.InputProps.startAdornment}
                        </Fragment>
                      ),
                    }}
                    sx={LEDGER_FILTER_FIELD_SX}
                  />
                )}
                noOptionsText="No accounts found"
                clearOnEscape
              />
              <TextField fullWidth size="small" label="Search" placeholder="Name, phone, bill..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} color={BRAND.primary.blue} /></InputAdornment> }}
                sx={LEDGER_FILTER_FIELD_SX} />
              <Box sx={{ display: 'flex', gap: 0.75, justifyContent: { xs: 'flex-start', md: 'flex-end' }, gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                <Button size="small" variant="outlined" onClick={() => setFiltersExpanded(!filtersExpanded)}
                  endIcon={filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', borderColor: '#cbd5e1', color: '#475569', whiteSpace: 'nowrap' }}>
                  More
                </Button>
                <Button size="small" variant="text" onClick={clearFilters}
                  sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b', minWidth: 0, px: 1.25 }}>
                  Clear
                </Button>
              </Box>
            </Box>
          </Box>

          {filtersExpanded && (
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2, pt: 0.5 }}>
              <Box sx={{ ...LEDGER_FILTER_GRID, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
                <TextField fullWidth size="small" label="From Date" type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={LEDGER_FILTER_FIELD_SX} />
                <TextField fullWidth size="small" label="To Date" type="date" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={LEDGER_FILTER_FIELD_SX} />
                <FormControl fullWidth size="small" sx={LEDGER_FILTER_FIELD_SX}>
                  <InputLabel>Type</InputLabel>
                  <Select value={selectedLedgerType} onChange={(e) => setSelectedLedgerType(e.target.value)} label="Type">
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="Sale">Sale</MenuItem>
                    <MenuItem value="Purchase">Purchase</MenuItem>
                    <MenuItem value="Payment">Payment</MenuItem>
                    <MenuItem value="Receiving">Receiving</MenuItem>
                    <MenuItem value="Expense">Expense</MenuItem>
                    <MenuItem value="Order">Order</MenuItem>
                    <MenuItem value="Sale Return">Sale Return</MenuItem>
                    <MenuItem value="Purchase Return">Purchase Return</MenuItem>
                    <MenuItem value="Journal">Journal</MenuItem>
                    <MenuItem value="Adjustment">Adjustment</MenuItem>
                  </Select>
                </FormControl>
                <TextField fullWidth size="small" label="Search by Amount" placeholder="Debit, credit, balance..."
                  value={filterAmount} onChange={(e) => setFilterAmount(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><DollarSign size={16} color={BRAND.primary.blue} /></InputAdornment> }}
                  sx={LEDGER_FILTER_FIELD_SX} />
              </Box>
            </Box>
          )}
        </Card>

        {useAllAccountsRecentDefault && (
          <Alert severity="info" sx={{ borderRadius: '12px', py: 0.75, alignItems: 'center' }}>
            Showing <strong>today&apos;s entries</strong> plus the <strong>last entry before today</strong>. Click <strong>Clear</strong> for the full ledger.
          </Alert>
        )}

        {/* Ledger Table */}
        <Box sx={{ width: '100%' }}>
          <Card sx={LEDGER_UI.tableCard}>
            {loading && <LinearProgress color="primary" sx={{ width: '100%', height: 3, position: 'absolute', top: 0, zIndex: 10 }} />}
            <CardHeader
              title={
                <Box sx={LEDGER_UI.ledgerTitleBar}>
                  <Typography component="p" sx={LEDGER_UI.ledgerTitleEn}>
                    {COMPANY.name}
                  </Typography>
                  <Typography component="p" sx={LEDGER_UI.ledgerTitleUr}>
                    {COMPANY.nameUr}
                  </Typography>
                  <Typography component="h2" sx={LEDGER_UI.ledgerTitleMain}>
                    {selectedCustomer
                      ? customers.find(c => Number(c.cus_id) === Number(selectedCustomer))?.cus_name
                      : 'All Accounts Ledger'}
                  </Typography>
                </Box>
              }
              sx={{ p: 0, m: 0, pb: '0 !important', '& .MuiCardHeader-content': { width: '100%', m: 0 } }}
            />

            {selectedCustomer && (
              <Box sx={LEDGER_UI.ledgerActionBar}>
                <Button size="small" variant="contained" startIcon={<ArrowUp size={15} />} onClick={handlePayPayment}
                  sx={{ ...LEDGER_UI.toolbarBtn, bgcolor: BRAND.primary.pink, color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#e0074c' } }}>
                  Pay Amount
                </Button>
                <Button size="small" variant="contained" startIcon={<ArrowDown size={15} />} onClick={handleReceivePayment}
                  sx={{ ...LEDGER_UI.toolbarBtn, bgcolor: BRAND.supporting.green, color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#00b872' } }}>
                  Receive Amount
                </Button>
                <Button size="small" variant="outlined" startIcon={<Print size={15} />}
                  onClick={() => { setPrintFromDate(''); setPrintToDate(''); setShowPrintLedgerDialog(true); }}
                  sx={{ ...LEDGER_UI.toolbarBtn, color: '#475569', borderColor: '#cbd5e1', bgcolor: '#fff', '&:hover': { bgcolor: '#fff', borderColor: BRAND.primary.blue, color: BRAND.text.blue } }}>
                  Print
                </Button>
                <Button size="small" variant="outlined" disabled={isDownloadingLedgerPdf || finalLedgerEntries.length === 0}
                  startIcon={isDownloadingLedgerPdf ? <CircularProgress size={14} color="inherit" /> : <Download size={15} />}
                  onClick={handleDownloadLedgerPdf}
                  sx={{ ...LEDGER_UI.toolbarBtn, color: BRAND.text.blue, borderColor: BRAND.primary.blue, bgcolor: '#fff', '&:hover': { bgcolor: BRAND.tint.blue, borderColor: BRAND.text.blue } }}>
                  {isDownloadingLedgerPdf ? 'Downloading…' : 'Download PDF'}
                </Button>
              </Box>
            )}

            {!selectedCustomer && finalLedgerEntries.length > 0 && (
              <Box sx={LEDGER_UI.ledgerActionBar}>
                <Button size="small" variant="outlined" startIcon={<Print size={15} />}
                  onClick={() => { setPrintFromDate(''); setPrintToDate(''); setShowPrintLedgerDialog(true); }}
                  sx={{ ...LEDGER_UI.toolbarBtn, color: '#475569', borderColor: '#cbd5e1', bgcolor: '#fff', '&:hover': { bgcolor: '#fff', borderColor: BRAND.primary.blue, color: BRAND.text.blue } }}>
                  Print
                </Button>
                <Button size="small" variant="outlined" disabled={isDownloadingLedgerPdf}
                  startIcon={isDownloadingLedgerPdf ? <CircularProgress size={14} color="inherit" /> : <Download size={15} />}
                  onClick={handleDownloadLedgerPdf}
                  sx={{ ...LEDGER_UI.toolbarBtn, color: BRAND.text.blue, borderColor: BRAND.primary.blue, bgcolor: '#fff', '&:hover': { bgcolor: BRAND.tint.blue, borderColor: BRAND.text.blue } }}>
                  {isDownloadingLedgerPdf ? 'Downloading…' : 'Download PDF'}
                </Button>
              </Box>
            )}

            {activeLedgerId && activeLedgerTab?.minimized ? (
              <Box sx={{
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 1.5,
                py: 6,
                bgcolor: '#f8fafc',
              }}>
                <Minimize2 size={40} color="#94a3b8" />
                <Typography variant="h6" color="text.secondary">
                  {activeLedgerTab.name} is minimized
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click the tab below to restore this ledger, or select another open ledger.
                </Typography>
                <Button variant="contained" size="small" onClick={() => restoreLedger(activeLedgerTab.id)} sx={{ mt: 1, textTransform: 'none', bgcolor: '#1A55E3' }}>
                  Restore Ledger
                </Button>
              </Box>
            ) : finalLedgerEntries.length === 0 ? (
              <Box sx={{
                minHeight: 280,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
                py: 6,
              }}>
                <Receipt size={48} color="#9e9e9e" />
                <Typography variant="h6" color="text.secondary">
                  No ledger entries found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm || selectedCustomer
                    ? 'Try adjusting your filters to see more results.'
                    : 'Get started by adding your first ledger entry.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', m: 0, p: 0 }}>
                <Box sx={LEDGER_UI.ledgerHeaderWrap}>
                  <Table size="small" sx={LEDGER_UI.ledgerHeaderTable}>
                    <LedgerTableColGroup />
                    <TableHead>
                      <LedgerTableHeaderRow />
                    </TableHead>
                  </Table>
                </Box>
                <TableContainer sx={{
                  minHeight: 320,
                  maxHeight: { xs: '65vh', md: 'calc(100vh - 380px)' },
                  overflow: 'auto',
                  opacity: loading ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                  p: 0,
                  m: 0,
                  bgcolor: '#ffffff',
                }}>
                  <Table size="small" sx={{ ...LEDGER_UI.tableGrid, borderTop: 'none', mt: '-1px' }}>
                    <LedgerTableColGroup />
                    <TableBody>
                      {finalLedgerEntries.map((entry, index) => {
                        const displayAmts = getLedgerEntryDisplayAmounts(entry);
                        const isDebit = displayAmts.debit > 0;
                        const isCredit = displayAmts.credit > 0;
                        const entryAmount = isDebit ? displayAmts.debit : displayAmts.credit;
                        const valueColors = getLedgerValueColors(entry);

                        // Parse split payment info if present in details
                        let splitCashAmount = 0;
                        let splitBankAmount = 0;
                        let isSplitPayment = false;

                        if (entry.details) {
                          // Extract split amounts from details field
                          // Format: "...| {cash_amount: X, bank_amount: Y}"
                          const splitMatch = entry.details.match(/\{\s*cash_amount:\s*([\d.]+),\s*bank_amount:\s*([\d.]+)\s*\}/);
                          if (splitMatch) {
                            splitCashAmount = parseFloat(splitMatch[1]);
                            splitBankAmount = parseFloat(splitMatch[2]);
                            isSplitPayment = true;
                          }
                        }

                        // Determine Bank vs Cash amounts from ledger entry fields
                        let bankAmount = parseFloat(entry.bank_payment || 0);
                        let cashAmount = parseFloat(entry.cash_payment || 0);

                        // Do NOT apply the transaction-type fallback for Labour/Delivery accounts
                        // (prevents the initial labour/delivery DEBIT from showing in Cash/Bank column)
                        const isLabourOrDeliveryAccount = /(labour|delivery|transport)/i.test(entry.customer?.cus_name || '') || /incity \(own\)/i.test(entry.details || '');

                        // For non-payment entries, fall back to transaction type logic (skip for labour/delivery)
                        if (bankAmount === 0 && cashAmount === 0) {
                          if (isSplitPayment) {
                            // Use parsed split amounts
                            bankAmount = splitBankAmount;
                            cashAmount = splitCashAmount;
                          } else if (!isLabourOrDeliveryAccount) {
                            // Preserve existing fallback behavior for non-labour/delivery entries
                            if (entry.trnx_type === 'BANK_TRANSFER' || entry.trnx_type === 'CHEQUE') {
                              bankAmount = entryAmount;
                              cashAmount = 0;
                            } else if (entry.trnx_type === 'CASH') {
                              bankAmount = 0;
                              cashAmount = entryAmount;
                            }
                          }
                        }

                        const rowStyle = getLedgerRowStyle(isDebit, isCredit, entry);

                        return (
                          <TableRow
                            key={entry.l_id}
                            sx={{
                              bgcolor: rowStyle.bg,
                              '&:hover': {
                                bgcolor: `${rowStyle.hover} !important`,
                                cursor: 'pointer',
                                '& .edit-icon': { opacity: 1 },
                              },
                            }}
                            onDoubleClick={() => handleEdit(entry)}
                          >
                            <TableCell sx={{ textAlign: 'center', fontWeight: 600, color: '#595959', fontSize: '0.75rem', position: 'relative', bgcolor: rowStyle.bg }}>
                              {entry.l_id}
                              <IconButton
                                size="small"
                                className="edit-icon"
                                onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                                sx={{
                                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                                  opacity: 0, transition: 'opacity 0.2s',
                                  bgcolor: rowStyle.amount, color: '#fff',
                                  width: 22, height: 22,
                                  '&:hover': { bgcolor: rowStyle.amount },
                                }}
                              >
                                <Edit size={11} />
                              </IconButton>
                            </TableCell>

                            <TableCell sx={{ fontFamily: 'monospace', color: rowStyle.text, fontWeight: 500, fontSize: '0.8125rem', bgcolor: rowStyle.bg }}>
                              {getLocalDateString(entry.created_at)}
                            </TableCell>

                            <TableCell
                              sx={{ cursor: entry.customer?.cus_id ? 'pointer' : 'default', bgcolor: rowStyle.bg }}
                              onDoubleClick={() => {
                                if (entry.customer?.cus_id) openCustomerLedger(entry.customer.cus_id, entry.customer.cus_name);
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.35 }}>
                                {entry.customer?.cus_name || 'Cash Account'}
                              </Typography>
                              {entry.customer?.customer_type?.cus_type_title && (
                                <Typography variant="caption" sx={{ color: rowStyle.sub, display: 'block', mt: 0.25, fontWeight: 500 }}>
                                  {entry.customer.customer_type.cus_type_title}
                                  {entry.customer.customer_category?.cus_cat_title && ` · ${entry.customer.customer_category.cus_cat_title}`}
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell sx={{ maxWidth: 300, bgcolor: rowStyle.bg }}>
                              {formatLedgerParticulars(entry.details) ? (
                                <Typography variant="body2" component="div" sx={{ lineHeight: 1.5, fontWeight: 500, color: rowStyle.text }}>
                                  {renderLedgerParticulars(entry.details, entry)}
                                </Typography>
                              ) : (
                                <Typography variant="body2" sx={{ lineHeight: 1.5, fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>
                                  N/A
                                </Typography>
                              )}
                              {entry.bill_no && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
                                  <Typography variant="caption" onClick={(e) => { e.stopPropagation(); openDocumentFromLedgerEntry(entry); }}
                                    sx={{ fontWeight: 700, color: rowStyle.amount, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                    Bill #{entry.bill_no}
                                  </Typography>
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDocumentFromLedgerEntry(entry); }}
                                    sx={{ p: 0.25, color: rowStyle.amount }}>
                                    <Eye size={13} />
                                  </IconButton>
                                </Box>
                              )}
                            </TableCell>

                             <TableCell sx={{ textAlign: 'right', bgcolor: rowStyle.bg }}>
                               {displayAmts.debit > 0 ? (
                                 <Typography variant="body2" sx={{ fontWeight: 800, color: valueColors.debit, fontFamily: 'monospace', fontSize: '0.9375rem' }}>
                                   {fmtAmt(displayAmts.debit)}
                                 </Typography>
                               ) : (
                                 <Typography variant="body2" sx={{ color: '#e2e8f0' }}>—</Typography>
                               )}
                             </TableCell>

                             <TableCell sx={{ textAlign: 'right', bgcolor: rowStyle.bg }}>
                               {displayAmts.credit > 0 ? (
                                 <Typography variant="body2" sx={{ fontWeight: 800, color: valueColors.credit, fontFamily: 'monospace', fontSize: '0.9375rem' }}>
                                   {fmtAmt(displayAmts.credit)}
                                 </Typography>
                               ) : (
                                 <Typography variant="body2" sx={{ color: '#e2e8f0' }}>—</Typography>
                               )}
                             </TableCell>

                             <TableCell sx={{ textAlign: 'right', bgcolor: rowStyle.bg }}>
                               <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace', color: valueColors.balance, fontSize: '0.9375rem' }}>
                                 {fmtAmt(entry.closing_balance)}
                               </Typography>
                             </TableCell>

                            <TableCell sx={{ bgcolor: rowStyle.bg, textAlign: 'center' }}>
                              {(() => {
                                const typeStyle = getLedgerTypeStyle(entry.ledger_type);
                                return (
                                  <Chip
                                    label={entry.ledger_type || '—'}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: '0.6875rem',
                                      height: 24,
                                      bgcolor: typeStyle.bg,
                                      color: typeStyle.text,
                                      border: `1px solid ${typeStyle.border}`,
                                    }}
                                  />
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={LEDGER_UI.summaryRow}>
                        <TableCell colSpan={4} sx={{ textAlign: 'left' }}>
                          <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8125rem' }}>
                            Period Total
                          </Typography>
                        </TableCell>
                         <TableCell sx={{ textAlign: 'right' }}>
                           <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9375rem', color: ledgerSummaryValueColors.debit, fontFamily: 'monospace' }}>
                             {finalLedgerEntries.length > 0 ? fmtAmt(ledgerViewSummary.totalDebit) : '—'}
                           </Typography>
                         </TableCell>
                         <TableCell sx={{ textAlign: 'right' }}>
                           <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9375rem', color: ledgerSummaryValueColors.credit, fontFamily: 'monospace' }}>
                             {finalLedgerEntries.length > 0 ? fmtAmt(ledgerViewSummary.totalCredit) : '—'}
                           </Typography>
                         </TableCell>
                         <TableCell sx={{ textAlign: 'right' }}>
                           <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9375rem', fontFamily: 'monospace', color: ledgerSummaryValueColors.balance }}>
                             {finalLedgerEntries.length > 0 ? fmtAmt(ledgerViewSummary.lastClosing) : '—'}
                           </Typography>
                         </TableCell>
                         <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid #c5c5c5', bgcolor: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#595959', fontWeight: 500, textAlign: 'center' }}>
                    {COMPANY.name} · {COMPANY.address} · Double-click row to edit
                  </Typography>
                </Box>
              </Box>
            )}
          </Card>
        </Box>
      </Container>

      {/* Add/Edit Ledger Entry Dialog - REMOVED */}
      {false && <Dialog
        open={showLedgerForm}
        onClose={() => {
          setShowLedgerForm(false);
          setEditingLedger(null);
          setSelectedLedgerBankAccount(null);
          setFormData({
            cus_id: '',
            debit_amount: '',
            credit_amount: '',
            bill_no: '',
            trnx_type: 'CASH',
            details: '',
            cash_amount: '',
            bank_amount: '',
            discount_amount: '',
          });
          setCustomerSearchTerm('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }
        }}
      >
        {/* Header */}
        <DialogTitle component="div" sx={{ p: 0 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)',
            px: 3, py: 2.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Receipt size={22} color="white" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                  {editingLedger ? 'Edit Ledger Entry' : 'New Ledger Entry'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  {editingLedger ? `Editing entry #${editingLedger.l_id}` : `Serial #${ledgerEntries.length + 1}`}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => {
                setShowLedgerForm(false);
                setEditingLedger(null);
                setSelectedLedgerBankAccount(null);
                setFormData({
                  cus_id: '',
                  debit_amount: '',
                  credit_amount: '',
                  bill_no: '',
                  trnx_type: 'CASH',
                  details: '',
                  cash_amount: '',
                  bank_amount: '',
                });
                setCustomerSearchTerm('');
              }}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              }}
            >
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>

            {/* Account */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                Account *
              </Typography>
              <Autocomplete
                autoSelect={true}
                autoHighlight={true}
                openOnFocus={true}
                selectOnFocus={true}
                options={filteredCustomers}
                getOptionLabel={(option) => option.cus_name}
                getOptionKey={customerOptionKey}
                isOptionEqualToValue={isSameCustomerOption}
                value={formData.cus_id ? customers.find(c => c.cus_id === formData.cus_id) : null}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setFormData(prev => ({ ...prev, cus_id: newValue.cus_id }));
                    setCustomerSearchTerm(newValue.cus_name);
                  } else {
                    setFormData(prev => ({ ...prev, cus_id: '' }));
                    setCustomerSearchTerm('');
                  }
                }}
                inputValue={customerSearchTerm}
                onInputChange={(event, newInputValue) => setCustomerSearchTerm(newInputValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search and select account..."
                    required
                    sx={{ bgcolor: 'white', borderRadius: 2 }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={16} color="#94a3b8" />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  const balance = parseFloat(option.cus_balance || 0);
                  return (
                    <Box component="li" key={key} {...optionProps}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.5, width: '100%' }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                            {option.cus_name?.[0]?.toUpperCase()}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700}>{option.cus_name}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {option.cus_phone_no}
                            {option.customer_type?.cus_type_title && ` • ${option.customer_type.cus_type_title}`}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              px: 1,
                              py: 0.25,
                              mt: 0.5,
                              borderRadius: 1,
                              bgcolor: balance > 0 ? '#fef3c7' : balance < 0 ? '#dcfce7' : '#f1f5f9',
                              color: balance > 0 ? '#b45309' : balance < 0 ? '#15803d' : '#475569',
                              display: 'inline-block'
                            }}
                          >
                            Bal: PKR {fmtAmt(balance)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                }}
              />
              {/* Current balance badge */}
              {formData.cus_id && (() => {
                const acct = customers.find(c => c.cus_id === formData.cus_id);
                if (!acct) return null;
                const bal = parseFloat(acct.cus_balance || 0);
                const isPositive = bal >= 0;
                return (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Current Balance:</Typography>
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      px: 1.5, py: 0.4, borderRadius: 5,
                      bgcolor: isPositive ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${isPositive ? '#bbf7d0' : '#fecaca'}`,
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: isPositive ? '#16a34a' : '#dc2626' }}>
                        PKR {fmtAmt(Math.abs(bal))}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isPositive ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {isPositive ? 'DR' : 'CR'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}
            </Box>

            {/* Debit / Credit / Bill Number — Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                  Pay Amount
                </Typography>
                <TextField
                  fullWidth
                  name="debit_amount"
                  type="number"
                  value={formData.debit_amount}
                  onChange={handleInputChange}
                  inputProps={{ step: 0.01, min: 0 }}
                  placeholder="0.00"
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>PKR</Typography></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                  Receive Amount
                </Typography>
                <TextField
                  fullWidth
                  name="credit_amount"
                  type="number"
                  value={formData.credit_amount}
                  onChange={handleInputChange}
                  inputProps={{ step: 0.01, min: 0 }}
                  placeholder="0.00"
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>PKR</Typography></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                  Bill Number
                </Typography>
                <TextField
                  fullWidth
                  name="bill_no"
                  value={formData.bill_no}
                  onChange={handleInputChange}
                  placeholder="Optional"
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Hash size={15} color="#94a3b8" /></InputAdornment>
                  }}
                />
              </Grid>
            </Grid>

            {/* Payment Section */}
            <Box sx={{
              border: '1.5px solid #e2e8f0',
              borderRadius: 2,
              overflow: 'hidden',
              mb: 3,
            }}>
              <Box sx={{ bgcolor: '#f1f5f9', px: 2, py: 1.2, borderBottom: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Payment Breakdown
                </Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: 'white' }}>
                <Grid container spacing={2}>
                  {/* Cash Payment */}
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      border: '1.5px solid #dcfce7',
                      borderRadius: 2, p: 2,
                      bgcolor: '#f0fdf4',
                      height: '100%',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Banknote size={15} color="white" />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#15803d' }}>Cash Payment</Typography>
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        name="cash_amount"
                        type="number"
                        value={formData.cash_amount}
                        onChange={handleInputChange}
                        inputProps={{ step: 0.01, min: 0 }}
                        placeholder="0.00"
                        sx={{ bgcolor: 'white', borderRadius: 1.5 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>PKR</Typography></InputAdornment>
                        }}
                      />
                    </Box>
                  </Grid>
                  {/* Bank Payment */}
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      border: '1.5px solid #dbeafe',
                      borderRadius: 2, p: 2,
                      bgcolor: '#eff6ff',
                      height: '100%',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={15} color="white" />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1d4ed8' }}>Bank Payment</Typography>
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        name="bank_amount"
                        type="number"
                        value={formData.bank_amount}
                        onChange={handleInputChange}
                        inputProps={{ step: 0.01, min: 0 }}
                        placeholder="0.00"
                        sx={{ bgcolor: 'white', borderRadius: 1.5, mb: 1.5 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>PKR</Typography></InputAdornment>
                        }}
                      />
                      <Autocomplete
                        size="small"
                        options={bankAccounts.length > 0 ? bankAccounts : []}
                        getOptionLabel={(option) => option.cus_name || ''}
                        getOptionKey={customerOptionKey}
                        isOptionEqualToValue={isSameCustomerOption}
                        value={selectedLedgerBankAccount}
                        onChange={(event, newValue) => setSelectedLedgerBankAccount(newValue)}
                        disabled={parseFloat(formData.bank_amount || 0) <= 0}
                        filterOptions={(options, { inputValue }) =>
                          options.filter(o => o.cus_name?.toLowerCase().includes(inputValue.toLowerCase()))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={parseFloat(formData.bank_amount || 0) > 0 ? 'Select bank account' : 'Enter amount first'}
                            sx={{
                              bgcolor: parseFloat(formData.bank_amount || 0) > 0 ? 'white' : '#f1f5f9',
                              borderRadius: 1.5,
                              '& .MuiInputBase-input': { fontWeight: selectedLedgerBankAccount ? 700 : 400 },
                            }}
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...optionProps } = props;
                          return (
                            <Box component="li" key={key} {...optionProps}>
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{option.cus_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{option.cus_phone_no}</Typography>
                              </Box>
                            </Box>
                          );
                        }}
                      />
                    </Box>
                  </Grid>

                  {/* Discount */}
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      border: '1.5px solid #fde68a',
                      borderRadius: 2, p: 2,
                      bgcolor: '#fffbeb',
                      height: '100%',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={15} color="white" />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#b45309' }}>Discount</Typography>
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        name="discount_amount"
                        type="number"
                        value={formData.discount_amount}
                        onChange={handleInputChange}
                        inputProps={{ step: 0.01, min: 0 }}
                        placeholder="0.00"
                        sx={{ bgcolor: 'white', borderRadius: 1.5 }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>PKR</Typography></InputAdornment>
                        }}
                      />
                    </Box>
                  </Grid>
                </Grid>

                {/* Total summary */}
                {(parseFloat(formData.cash_amount || 0) > 0 || parseFloat(formData.bank_amount || 0) > 0 || parseFloat(formData.discount_amount || 0) > 0) && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #e2e8f0' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                      {parseFloat(formData.cash_amount || 0) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 600 }}>Cash:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d' }}>PKR {fmtAmt(formData.cash_amount)}</Typography>
                        </Box>
                      )}
                      {parseFloat(formData.bank_amount || 0) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 600 }}>Bank:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#1d4ed8' }}>PKR {fmtAmt(formData.bank_amount)}</Typography>
                        </Box>
                      )}
                      {parseFloat(formData.discount_amount || 0) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>Discount:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#b45309' }}>PKR {fmtAmt(formData.discount_amount)}</Typography>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Total:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#1e40af' }}>
                        PKR {fmtAmt(parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0) + parseFloat(formData.discount_amount || 0))}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Details */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                Transaction Details
              </Typography>
              <TextField
                fullWidth
                name="details"
                value={formData.details}
                onChange={handleInputChange}
                multiline
                rows={3}
                placeholder="Enter transaction details or notes..."
                sx={{ bgcolor: 'white', borderRadius: 2 }}
              />
            </Box>

          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: 'white', gap: 1.5 }}>
          <Button
            onClick={() => {
              setShowLedgerForm(false);
              setEditingLedger(null);
              setSelectedLedgerBankAccount(null);
              setFormData({ cus_id: '', debit_amount: '', credit_amount: '', bill_no: '', trnx_type: 'CASH', details: '', cash_amount: '', bank_amount: '', discount_amount: '' });
              setCustomerSearchTerm('');
            }}
            variant="outlined"
            sx={{ borderColor: '#e2e8f0', color: '#64748b', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }, px: 3, borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmittingLedger}
            sx={{
              background: isSubmittingLedger ? undefined : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' },
              px: 4, fontWeight: 700, borderRadius: 2,
              boxShadow: isSubmittingLedger ? 'none' : '0 4px 14px rgba(59,130,246,0.4)',
              minWidth: 140,
            }}
          >
            {isSubmittingLedger ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
                {editingLedger ? 'Updating...' : 'Creating...'}
              </Box>
            ) : (
              editingLedger ? 'Update Entry' : 'Create Entry'
            )}
          </Button>
        </DialogActions>
      </Dialog>}

      {/* Full General Journal Form Dialog */}
      <Dialog
        open={showJournalForm}
        onClose={() => setShowJournalForm(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle component="div" sx={{
          bgcolor: '#2563eb',
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>GENERAL JOURNAL ENTRY</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1 }}>
              Serial: #{ledgerEntries.length + 1}
            </Typography>
            <IconButton onClick={() => setShowJournalForm(false)} size="small" sx={{ color: 'white' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          <Box component="form" id="journal-form" onSubmit={handleJournalSubmit} sx={{ mt: 1 }}>

            {/* Top Fields - Single Line Layout */}
            <Grid container spacing={3} sx={{ mb: 4 }} alignItems="center">

              <Grid item xs={4} md={2}>
                <Typography sx={{ fontWeight: 600, color: '#475569' }}>Journal Date:</Typography>
              </Grid>
              <Grid item xs={8} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  value={journalData.journal_date}
                  onChange={(e) => setJournalData({ ...journalData, journal_date: e.target.value })}
                />
              </Grid>

              <Grid item xs={4} md={2}>
                <Typography sx={{ fontWeight: 600, color: '#475569' }}>Type:</Typography>
              </Grid>
              <Grid item xs={8} md={4}>
                <FormControl fullWidth size="small">
                  <Select
                    value={journalData.journal_type}
                    onChange={(e) => setJournalData({ ...journalData, journal_type: e.target.value })}
                    displayEmpty
                  >
                    <MenuItem value="PAYMENT">Payment</MenuItem>
                    <MenuItem value="RECEIPT">Receipt</MenuItem>
                    <MenuItem value="TRANSFER">Transfer</MenuItem>
                    <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4} md={2}>
                <Typography sx={{ fontWeight: 600, color: '#475569' }}>Reference / Bill #:</Typography>
              </Grid>
              <Grid item xs={8} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  value={journalData.reference}
                  onChange={(e) => setJournalData({ ...journalData, reference: e.target.value })}
                  placeholder="Optional"
                />
              </Grid>

              <Grid item xs={4} md={2}>
                <Typography sx={{ fontWeight: 600, color: '#475569' }}>Description:</Typography>
              </Grid>
              <Grid item xs={8} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  value={journalData.description}
                  onChange={(e) => setJournalData({ ...journalData, description: e.target.value })}
                  placeholder="Journal description..."
                />
              </Grid>
            </Grid>

            {/* Journal Lines */}
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center' }}>
              <Receipt size={18} style={{ marginRight: 8 }} /> Journal Details
            </Typography>

            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: '35%' }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '15%', textAlign: 'right' }}>Debit (PKR)</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: '15%', textAlign: 'right' }}>Credit (PKR)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Line Description</TableCell>
                    <TableCell sx={{ width: '50px' }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {journalLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Autocomplete
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          options={customers}
                          getOptionLabel={(option) => option.cus_name}
                          getOptionKey={customerOptionKey}
                          isOptionEqualToValue={isSameCustomerOption}
                          value={line.account_id ? customers.find(c => c.cus_id === line.account_id) : null}
                          onChange={(e, val) => {
                            handleJournalLineChange(index, 'account_id', val?.cus_id || '');
                            handleJournalLineChange(index, 'accountSearch', val?.cus_name || '');
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              variant="standard"
                              placeholder="Search account..."
                              onFocus={(e) => e.target.select()}
                              InputProps={{ ...params.InputProps, disableUnderline: true }}
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...optionProps } = props;
                            return (
                              <Box component="li" key={key} {...optionProps}>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>{option.cus_name}</Typography>
                                  <Typography variant="caption" color="textSecondary">{option.customer_type?.cus_type_title}</Typography>
                                </Box>
                              </Box>
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          variant="standard"
                          fullWidth
                          value={line.debit_amount}
                          onChange={(e) => handleJournalLineChange(index, 'debit_amount', e.target.value)}
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& input': { textAlign: 'right', fontWeight: 600, color: '#16a34a' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          variant="standard"
                          fullWidth
                          value={line.credit_amount}
                          onChange={(e) => handleJournalLineChange(index, 'credit_amount', e.target.value)}
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& input': { textAlign: 'right', fontWeight: 600, color: '#dc2626' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          variant="standard"
                          fullWidth
                          value={line.description}
                          onChange={(e) => handleJournalLineChange(index, 'description', e.target.value)}
                          placeholder="Optional"
                          InputProps={{ disableUnderline: true }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => removeJournalLine(index)}
                          disabled={journalLines.length <= 2}
                          color="error"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                startIcon={<Plus size={16} />}
                onClick={addJournalLine}
                variant="outlined"
                size="small"
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Add Row
              </Button>

              <Box sx={{ display: 'flex', gap: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="#64748b" display="block">Total Debit</Typography>
                  <Typography variant="subtitle1" fontWeight={800} color="#16a34a">
                    {fmtAmt(journalLines.reduce((sum, l) => sum + parseFloat(l.debit_amount || 0), 0))}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="#64748b" display="block">Total Credit</Typography>
                  <Typography variant="subtitle1" fontWeight={800} color="#dc2626">
                    {fmtAmt(journalLines.reduce((sum, l) => sum + parseFloat(l.credit_amount || 0), 0))}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                  <Typography variant="caption" color="#64748b" display="block">Difference</Typography>
                  <Typography
                    variant="subtitle1"
                    fontWeight={800}
                    color={Math.abs(journalLines.reduce((sum, l) => sum + parseFloat(l.debit_amount || 0), 0) - journalLines.reduce((sum, l) => sum + parseFloat(l.credit_amount || 0), 0)) < 0.01 ? '#16a34a' : '#dc2626'}
                  >
                    {fmtAmt(journalLines.reduce((sum, l) => sum + parseFloat(l.debit_amount || 0), 0) - journalLines.reduce((sum, l) => sum + parseFloat(l.credit_amount || 0), 0))}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 4, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setShowJournalForm(false)} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            form="journal-form"
            type="submit"
            variant="contained"
            disabled={journalStatus.loading}
            sx={{
              bgcolor: '#2563eb',
              textTransform: 'none',
              fontWeight: 700,
              px: 6,
              py: 1.5,
              borderRadius: 2,
              '&:hover': { bgcolor: '#1d4ed8' }
            }}
          >
            {journalStatus.loading ? <CircularProgress size={24} color="inherit" /> : 'Post General Journal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receive Payment Dialog */}
      <Dialog
        open={showReceivePaymentForm}
        onClose={() => setShowReceivePaymentForm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle component="div" sx={{
          bgcolor: '#10b981',
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Receive Amount Form</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1 }}>
            Serial: #{ledgerEntries.length + 1}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Account Info */}
            <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Selected Account
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#14532d' }}>
                    {customers.find(c => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || 'Individual Account'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Current Balance
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#16a34a' }}>
                    PKR {fmtAmt(currentBalance)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          {receiveTotalPreview > 0 && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              <strong>After Receive Amount:</strong> account balance → PKR{' '}
              {fmtAmt(receiveBalanceAfter)}{' '}
                <Typography component="span" variant="caption" display="block" color="text.secondary">
                  Receive Amount credits the selected account (balance decreases by the entered amount).
                </Typography>
              </Alert>
            )}

            <Divider sx={{ my: 1 }} />

            {/* Cash Amount Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Cash Amount
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={receivePaymentData.cash_amount}
                onChange={(e) => setReceivePaymentData((prev) => {
                  const updated = { ...prev, cash_amount: e.target.value };
                  const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                  updated.description = buildFinancePaymentDescription(
                    'RECEIVE',
                    accName,
                    updated.cash_amount,
                    updated.bank_amount,
                    updated.bank_account,
                    bankAccounts,
                    updated.discount
                  );
                  return updated;
                })}
                placeholder="0.00"
                InputProps={{
                  startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                }}
              />
            </Box>

            {/* Bank Account and Amount in Words Row */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Bank Account
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={receivePaymentData.bank_account}
                    onChange={(e) => setReceivePaymentData((prev) => {
                      const updated = { ...prev, bank_account: e.target.value };
                      const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                      updated.description = buildFinancePaymentDescription(
                        'RECEIVE',
                        accName,
                        updated.cash_amount,
                        updated.bank_amount,
                        updated.bank_account,
                        bankAccounts,
                        updated.discount
                      );
                      return updated;
                    })}
                    displayEmpty
                    sx={{ bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="">Select Bank Account</MenuItem>
                    {bankAccounts.map(account => (
                      <MenuItem key={account.cus_id} value={account.cus_id}>{account.cus_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minHeight: '56px', display: 'flex', alignItems: 'stretch' }}>
                {receiveTotalPreview > 0 ? (
                  <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem', textAlign: 'center' }}>
                      {numberToUrduWords(receiveTotalPreview)}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Enter amount to see words
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Bank Amount & Discount Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Bank Amount
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={receivePaymentData.bank_amount}
                  onChange={(e) => setReceivePaymentData((prev) => {
                    const updated = { ...prev, bank_amount: e.target.value };
                    const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                    updated.description = buildFinancePaymentDescription(
                      'RECEIVE',
                      accName,
                      updated.cash_amount,
                      updated.bank_amount,
                      updated.bank_account,
                      bankAccounts,
                      updated.discount
                    );
                    return updated;
                  })}
                  disabled={!receivePaymentData.bank_account}
                  placeholder="0.00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                  }}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Discount
                </Typography>
                <TextField
                  fullWidth
                  placeholder="0.00"
                  type="number"
                  value={receivePaymentData.discount}
                  onChange={(e) => setReceivePaymentData((prev) => {
                    const updated = { ...prev, discount: e.target.value };
                    const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                    updated.description = buildFinancePaymentDescription(
                      'RECEIVE',
                      accName,
                      updated.cash_amount,
                      updated.bank_amount,
                      updated.bank_account,
                      bankAccounts,
                      updated.discount
                    );
                    return updated;
                  })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                  }}
                />
              </Box>
            </Box>

            <Divider sx={{ borderStyle: 'dotted', my: 1 }} />

            {/* Description */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={receivePaymentData.description}
                onChange={(e) => setReceivePaymentData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Auto-filled from amounts; you can edit."
                sx={{ bgcolor: '#f8fafc' }}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Button onClick={() => setShowReceivePaymentForm(false)} sx={{ color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            onClick={handleReceivePaymentSubmit}
            variant="contained"
            disabled={paymentStatus.loading}
            startIcon={paymentStatus.loading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
              px: 4,
              fontWeight: 700
            }}
          >
            {paymentStatus.loading ? (saveStatusMessage || 'Processing...') : 'Confirm Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay Payment Dialog */}
      <Dialog
        open={showPayPaymentForm}
        onClose={() => setShowPayPaymentForm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle component="div" sx={{
          bgcolor: '#ef4444',
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Pay Amount Form</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1 }}>
            Serial: #{ledgerEntries.length + 1}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Account Info */}
            <Box sx={{ p: 2, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fecaca' }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Selected Account
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#7f1d1d' }}>
                    {customers.find(c => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || 'Individual Account'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Current Balance
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#dc2626' }}>
                    PKR {fmtAmt(currentBalance)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            {payTotalPreview > 0 && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                <strong>After Pay Amount:</strong> account balance → PKR{' '}
                {fmtAmt(payBalanceAfter)}{' '}
                <Typography component="span" variant="caption" display="block" color="text.secondary">
                  Pay Amount debits the selected account (balance increases by the entered amount).
                </Typography>
              </Alert>
            )}

            <Divider sx={{ my: 1 }} />

            {/* Cash Amount Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Cash Amount
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={payPaymentData.cash_amount}
                onChange={(e) => setPayPaymentData((prev) => {
                  const updated = { ...prev, cash_amount: e.target.value };
                  const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                  updated.description = buildFinancePaymentDescription(
                    'PAY',
                    accName,
                    updated.cash_amount,
                    updated.bank_amount,
                    updated.bank_account,
                    bankAccounts,
                    updated.discount
                  );
                  return updated;
                })}
                placeholder="0.00"
                InputProps={{
                  startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                }}
              />
            </Box>

            {/* Bank Account and Amount in Words Row */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Bank Account
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={payPaymentData.bank_account}
                    onChange={(e) => setPayPaymentData((prev) => {
                      const updated = { ...prev, bank_account: e.target.value };
                      const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                      updated.description = buildFinancePaymentDescription(
                        'PAY',
                        accName,
                        updated.cash_amount,
                        updated.bank_amount,
                        updated.bank_account,
                        bankAccounts,
                        updated.discount
                      );
                      return updated;
                    })}
                    displayEmpty
                    sx={{ bgcolor: '#f8fafc' }}
                  >
                    <MenuItem value="">Select Bank Account</MenuItem>
                    {bankAccounts.map(account => (
                      <MenuItem key={account.cus_id} value={account.cus_id}>{account.cus_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minHeight: '56px', display: 'flex', alignItems: 'stretch' }}>
                {payTotalPreview > 0 ? (
                  <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fecaca', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem', textAlign: 'center' }}>
                      {numberToUrduWords(payTotalPreview)}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Enter amount to see words
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Bank Amount & Discount Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Bank Amount
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={payPaymentData.bank_amount}
                  onChange={(e) => setPayPaymentData((prev) => {
                    const updated = { ...prev, bank_amount: e.target.value };
                    const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                    updated.description = buildFinancePaymentDescription(
                      'PAY',
                      accName,
                      updated.cash_amount,
                      updated.bank_amount,
                      updated.bank_account,
                      bankAccounts,
                      updated.discount
                    );
                    return updated;
                  })}
                  disabled={!payPaymentData.bank_account}
                  placeholder="0.00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                  }}
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                  Discount
                </Typography>
                <TextField
                  fullWidth
                  placeholder="0.00"
                  type="number"
                  value={payPaymentData.discount}
                  onChange={(e) => setPayPaymentData((prev) => {
                    const updated = { ...prev, discount: e.target.value };
                    const accName = customers.find((c) => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || '';
                    updated.description = buildFinancePaymentDescription(
                      'PAY',
                      accName,
                      updated.cash_amount,
                      updated.bank_amount,
                      updated.bank_account,
                      bankAccounts,
                      updated.discount
                    );
                    return updated;
                  })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                  }}
                />
              </Box>
            </Box>

            <Divider sx={{ borderStyle: 'dotted', my: 1 }} />

            {/* Description */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={payPaymentData.description}
                onChange={(e) => setPayPaymentData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Auto-filled from amounts; you can edit."
                sx={{ bgcolor: '#f8fafc' }}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <Button onClick={() => setShowPayPaymentForm(false)} sx={{ color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            onClick={handlePayPaymentSubmit}
            variant="contained"
            disabled={paymentStatus.loading}
            startIcon={paymentStatus.loading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{
              bgcolor: '#ef4444',
              '&:hover': { bgcolor: '#dc2626' },
              px: 4,
              fontWeight: 700
            }}
          >
            {paymentStatus.loading ? (saveStatusMessage || 'Processing...') : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Receipt Dialog */}
      <Dialog
        open={showPaymentReceipt}
        onClose={() => setShowPaymentReceipt(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle component="div" sx={{
          bgcolor: paymentReceiptData?.type === 'PAY' ? '#ef4444' : '#16a34a',
          color: 'white', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          {paymentReceiptData?.type === 'PAY' ? 'Payment Receipt' : 'Receipt - Payment Received'}
          <Typography variant="body2" sx={{ bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1, fontWeight: 600 }}>
            PAY-{paymentReceiptData?.paymentId}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {paymentReceiptData && (
            <Box id="payment-receipt-preview" sx={{ bgcolor: 'white', p: 3 }}>
              {/* Header */}
              <Box sx={{ textAlign: 'center', pb: 2, borderBottom: '2px solid #000', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', direction: 'rtl', fontFamily: 'Arial' }}>اتفاق آئرن اینڈ سیمنٹ سٹور</Typography>
                <Typography variant="body2" sx={{ direction: 'rtl' }}>گجرات سرگودھا روڈ، پاہڑیانوالی</Typography>
                <Typography variant="body2">Ph:- 0346-7560306, 0300-7560306</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1, letterSpacing: 1 }}>
                  {paymentReceiptData.type === 'PAY' ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}
                </Typography>
              </Box>

              {/* Meta info */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, px: 1 }}>
                <Box>
                  <Typography variant="body2"><strong>Account:</strong> {paymentReceiptData.customer?.cus_name}</Typography>
                  <Typography variant="body2"><strong>Phone:</strong> {paymentReceiptData.customer?.cus_phone_no || '—'}</Typography>
                  {paymentReceiptData.description && (
                    <Typography variant="body2"><strong>Note:</strong> {paymentReceiptData.description}</Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2"><strong>Ref #:</strong> PAY-{paymentReceiptData.paymentId}</Typography>
                  <Typography variant="body2"><strong>Date:</strong> {paymentReceiptData.date}</Typography>
                  <Typography variant="body2"><strong>Time:</strong> {paymentReceiptData.time}</Typography>
                  <Typography variant="body2"><strong>Created By:</strong> {getCreatedByName(paymentReceiptData, currentUser)}</Typography>
                </Box>
              </Box>

              {/* Payment breakdown table */}
              <Box sx={{ border: '1px solid #000', borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #ddd', bgcolor: '#f5f5f5' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Description</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Amount (PKR)</Typography>
                </Box>
                {/* Previous Balance */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #eee', bgcolor: '#fafafa' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Previous Balance (سابقہ بقایا)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{paymentReceiptData.previousBalance == null ? '—' : fmtAmt(paymentReceiptData.previousBalance)}</Typography>
                </Box>
                {paymentReceiptData.cashAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2">Cash {paymentReceiptData.cashAcc ? `(${paymentReceiptData.cashAcc.cus_name})` : ''}</Typography>
                    <Typography variant="body2">{fmtAmt(paymentReceiptData.cashAmount)}</Typography>
                  </Box>
                )}
                {paymentReceiptData.bankAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2">Bank {paymentReceiptData.bankAcc ? `(${paymentReceiptData.bankAcc.cus_name})` : ''}</Typography>
                    <Typography variant="body2">{fmtAmt(paymentReceiptData.bankAmount)}</Typography>
                  </Box>
                )}
                {paymentReceiptData.discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2">Discount</Typography>
                    <Typography variant="body2">{fmtAmt(paymentReceiptData.discountAmount)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #ddd', bgcolor: '#f1f5f9' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>Total Paid</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {fmtAmt(paymentReceiptData.totalAmount)}
                  </Typography>
                </Box>
                {/* Remaining Balance */}
                <Box
                  className="remaining-balance-bar"
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.5,
                    bgcolor: paymentReceiptData.type === 'PAY' ? '#ef4444' : '#16a34a',
                    color: '#ffffff !important',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff !important' }}>
                    Remaining Balance (کل بقایا)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff !important' }}>
                    {paymentReceiptData.remainingBalance == null ? '—' : `PKR ${fmtAmt(paymentReceiptData.remainingBalance)}`}
                  </Typography>
                </Box>
              </Box>

              {/* Signature line */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2 }}>
                <Box sx={{ textAlign: 'center', flex: 1 }}>
                  <Box sx={{ borderTop: '1px solid #000', pt: 0.5, mx: 3 }}>
                    <Typography variant="caption">Received By</Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1 }}>
                  <Box sx={{ borderTop: '1px solid #000', pt: 0.5, mx: 3 }}>
                    <Typography variant="caption">Authorized Signature</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setShowPaymentReceipt(false)}>Close</Button>
          <Button
            variant="outlined"
            color="success"
            disabled={isSendingPaymentWhatsApp || !paymentReceiptData?.customer?.cus_phone_no}
            onClick={handleSendPaymentWhatsApp}
            startIcon={isSendingPaymentWhatsApp ? <CircularProgress size={18} /> : null}
          >
            {isSendingPaymentWhatsApp ? 'Sending…' : 'Send WhatsApp'}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!paymentReceiptData) return;
              const d = paymentReceiptData;
              const fmt = (v) => (v == null || v === '' ? '—' : fmtAmt(v));
              const isRed = d.type === 'PAY';
              const accentColor = isRed ? '#ef4444' : '#16a34a';

              const rows = [];
              rows.push(`<tr style="background:#f9fafb"><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600">Previous Balance (سابقہ بقایا)</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmt(d.previousBalance)}</td></tr>`);
              if (d.cashAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Cash${d.cashAcc ? ` (${d.cashAcc.cus_name})` : ''}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.cashAmount)}</td></tr>`);
              if (d.bankAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Bank${d.bankAcc ? ` (${d.bankAcc.cus_name})` : ''}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.bankAmount)}</td></tr>`);
              if (d.discountAmount > 0) rows.push(`<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Discount</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(d.discountAmount)}</td></tr>`);
              rows.push(`<tr style="background:#f1f5f9"><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:700">Total Paid</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${fmt(d.totalAmount)}</td></tr>`);
              const remRowBg = isRed ? '#ef4444' : '#16a34a';
              rows.push(`<tr style="background:${remRowBg}"><td style="padding:12px 14px;color:white;font-weight:700">Remaining Balance (کل بقایا)</td><td style="padding:12px 14px;text-align:right;font-weight:700;color:#ffffff">${d.remainingBalance == null ? '—' : `PKR ${fmt(d.remainingBalance)}`}</td></tr>`);

              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:white;padding:30px;color:#111}
  .header-bar{background:${accentColor};color:white;display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-radius:8px 8px 0 0;margin-bottom:0}
  .header-bar h2{font-size:18px;font-weight:800}
  .header-bar span{background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:6px;font-size:13px;font-weight:700}
  .company-box{text-align:center;padding:18px 20px 14px;border-bottom:2px solid #000;margin-bottom:16px}
  .company-box .name-urdu{font-size:22px;font-weight:bold;direction:rtl}
  .company-box .address{font-size:13px;direction:rtl;color:#555;margin:4px 0}
  .company-box .phone{font-size:13px;color:#555;margin:4px 0}
  .company-box .voucher-type{font-size:15px;font-weight:800;letter-spacing:1px;margin-top:10px;text-transform:uppercase}
  .meta{display:flex;justify-content:space-between;padding:0 4px 14px;border-bottom:1px solid #e5e7eb;margin-bottom:16px}
  .meta p{font-size:13px;margin:3px 0;line-height:1.5}
  .meta strong{color:#111}
  table{width:100%;border-collapse:collapse;border:1px solid #000;border-radius:6px;overflow:hidden;margin-bottom:24px}
  thead th{background:#f3f4f6;padding:10px 14px;text-align:left;font-size:13px;font-weight:700;border-bottom:2px solid #000}
  thead th:last-child{text-align:right}
  td{font-size:13px}
  .sig{display:flex;justify-content:space-between;margin-top:36px;padding-top:8px}
  .sig-box{text-align:center;flex:1;margin:0 20px}
  .sig-line{border-top:1px solid #000;padding-top:6px;font-size:12px;color:#555}
  @media print{body{padding:10px}@page{margin:10mm}}
</style></head><body>
<div class="header-bar"><h2>${d.type === 'PAY' ? 'Payment Receipt' : 'Receipt - Payment Received'}</h2><span>PAY-${d.paymentId}</span></div>
<div style="border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:0 20px 20px">
  <div class="company-box">
    <div class="name-urdu">اتفاق آئرن اینڈ سیمنٹ سٹور</div>
    <div class="address">گجرات سرگودھا روڈ، پاہڑیانوالی</div>
    <div class="phone">Ph:- 0346-7560306, 0300-7560306</div>
    <div class="voucher-type">${d.type === 'PAY' ? 'Payment Voucher' : 'Receipt Voucher'}</div>
  </div>
  <div class="meta">
    <div>
      <p><strong>Account:</strong> ${d.customer?.cus_name || ''}</p>
      <p><strong>Phone:</strong> ${d.customer?.cus_phone_no || '—'}</p>
      ${d.description ? `<p><strong>Note:</strong> ${d.description}</p>` : ''}
    </div>
    <div style="text-align:right">
      <p><strong>Ref #:</strong> PAY-${d.paymentId}</p>
      <p><strong>Date:</strong> ${d.date}</p>
      <p><strong>Time:</strong> ${d.time}</p>
      <p><strong>Created By:</strong> ${getCreatedByName(d, currentUser)}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount (PKR)</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <div class="sig">
    <div class="sig-box"><div class="sig-line">Received By</div></div>
    <div class="sig-box"><div class="sig-line">Authorized Signature</div></div>
  </div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

              const win = window.open('', '_blank', 'width=800,height=700');
              win.document.write(html);
              win.document.close();
            }}
            sx={{ bgcolor: '#1e293b', '&:hover': { bgcolor: '#0f172a' } }}
          >
            Print A4
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purchase invoice viewer (opened by eye icon or Bill links) */}
      <Dialog
        open={viewPurchaseDialogOpen}
        onClose={() => { setViewPurchaseDialogOpen(false); setViewingPurchase(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}
      >
        <DialogTitle component="div" sx={{ bgcolor: viewingPurchase?._isReturnVariant ? '#9333ea' : '#0284c7', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              Bill Details - #{viewingPurchase?.sequentialId || viewingPurchase?.pur_id}
            </Typography>
          </Box>
          <IconButton
            onClick={() => { setViewPurchaseDialogOpen(false); setViewingPurchase(null); }}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'white', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingPurchase && (
            <Box id="purchase-invoice-ledger" sx={{ width: '100%', bgcolor: 'white' }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', py: 3, borderBottom: '2px solid #000' }}>
                <Typography variant="h4" sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  direction: 'rtl'
                }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography variant="body2" sx={{
                  mb: 1,
                  fontSize: { xs: '0.75rem', md: '0.9rem' },
                  direction: 'rtl'
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <span style={{ fontSize: '1rem', color: '#25D366', marginRight: '4px' }}>📞</span>
                  <Typography variant="body2">
                    Ph:- 0346-7560306, 0300-7560306
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mt: 2
                }}>
                  {viewingPurchase._isReturnVariant ? 'PURCHASE RETURN INVOICE' : (viewingPurchase.bill_type || 'PURCHASE INVOICE')}
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Supplier Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {viewingPurchase.customer ? `${viewingPurchase.customer.cus_name}${viewingPurchase.customer.name_urdu ? ' ' + viewingPurchase.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchase.customer?.cus_phone_no || 'N/A'}
                    </Typography>
                  </Box>
                  {viewingPurchase.customer?.cus_address && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {viewingPurchase.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      #{viewingPurchase?.sequentialId || viewingPurchase?.pur_id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchase.created_at ? new Date(viewingPurchase.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchase.created_at ? new Date(viewingPurchase.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getCreatedByName(viewingPurchase, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
              <Box sx={{ px: 3, py: 2 }}>
                {/* Product Details Table - Full Width */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingPurchase.purchase_details && viewingPurchase.purchase_details.length > 0 ? (
                        <>
                          {viewingPurchase.purchase_details.map((detail, index) => (
                            <TableRow key={detail.pur_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.qnty || 0)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.crate || detail.unit_rate || detail.rate || 0)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.total_amount || detail.amount || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Payment Summary - Below Product Details */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* Left Side - Balance Section */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>سابقہ بقایا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingPurchase.previous_customer_balance ?? viewingPurchase.customer?.cus_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>موجوده بقايا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(getInvoiceRemainingDue(viewingPurchase))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل بقایا</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(getSupplierBalanceAfterBill(viewingPurchase))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Outer Cargo Charges - conditional */}
                    {(parseFloat(viewingPurchase.out_labour_amount || 0) > 0 || parseFloat(viewingPurchase.out_delivery_amount || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#1976d2' }}>بیرونی کرایہ و مزدوری</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.out_labour_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_labour_amount)}</TableCell>
                              </TableRow>
                            )}
                            {parseFloat(viewingPurchase.out_delivery_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_delivery_amount)}</TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کل بیرونی خرچہ</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(parseFloat(viewingPurchase.out_labour_amount || 0) + parseFloat(viewingPurchase.out_delivery_amount || 0))}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Incity Charges - conditional */}
                    {(parseFloat(viewingPurchase.incity_own_labour || 0) > 0 || parseFloat(viewingPurchase.incity_own_delivery || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#e65100' }}>اندرونی کرایہ و مزدوری</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.incity_own_labour || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_labour)}</TableCell>
                              </TableRow>
                            )}
                            {parseFloat(viewingPurchase.incity_own_delivery || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_delivery)}</TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کل اندرونی خرچہ</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(parseFloat(viewingPurchase.incity_own_labour || 0) + parseFloat(viewingPurchase.incity_own_delivery || 0))}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Notes Section */}
                    {viewingPurchase.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {viewingPurchase.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right Side - Payment Summary */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingPurchase.total_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingPurchase.labour_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingPurchase.transport_amount || 0)}
                            </TableCell>
                          </TableRow>
                          {parseFloat(viewingPurchase.discount || 0) > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رعایت (Discount)</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                -{fmtAmt(viewingPurchase.discount || 0)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(getInvoiceNet(viewingPurchase))}
                            </TableCell>
                          </TableRow>

                          {/* Determine cash and bank amounts */}
                          {(() => {
                            let cashAmount = parseFloat(viewingPurchase.cash_payment || 0);
                            let bankAmount = parseFloat(viewingPurchase.bank_payment || 0);
                            let bankName = viewingPurchase.bank_title || 'بینک';

                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم وصول</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(viewingPurchase.payment || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#1e293b' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#ffffff' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#facc15' }}>
                              {fmtAmt(getInvoiceRemainingDue(viewingPurchase))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={() => { setViewPurchaseDialogOpen(false); setViewingPurchase(null); }} variant="outlined">Close</Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            onClick={() => handlePrintPurchaseReceipt('A4')}
          >
            Print Bill
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
            onClick={() => handlePrintPurchaseReceipt('THERMAL')}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purchase Return invoice viewer */}
      <Dialog
        open={viewPurchaseReturnDialogOpen}
        onClose={() => { setViewPurchaseReturnDialogOpen(false); setViewingPurchaseReturn(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}
      >
        <DialogTitle component="div" sx={{ bgcolor: '#f59e0b', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              Bill Details - INV-R-{viewingPurchaseReturn?.return_id}
            </Typography>
          </Box>
          <IconButton
            onClick={() => { setViewPurchaseReturnDialogOpen(false); setViewingPurchaseReturn(null); }}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'white', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingPurchaseReturn && (
            <Box id="purchase-return-invoice-ledger" sx={{ width: '100%', bgcolor: 'white' }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', py: 3, borderBottom: '2px solid #000' }}>
                <Typography variant="h4" sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  direction: 'rtl'
                }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography variant="body2" sx={{
                  mb: 1,
                  fontSize: { xs: '0.75rem', md: '0.9rem' },
                  direction: 'rtl'
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <span style={{ fontSize: '1rem', color: '#25D366', marginRight: '4px' }}>📞</span>
                  <Typography variant="body2">
                    Ph:- 0346-7560306, 0300-7560306
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mt: 2
                }}>
                  PURCHASE RETURN INVOICE
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {viewingPurchaseReturn.purchase?.customer ? `${viewingPurchaseReturn.purchase?.customer.cus_name}${viewingPurchaseReturn.purchase?.customer.name_urdu ? ' ' + viewingPurchaseReturn.purchase?.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchaseReturn.purchase?.customer?.cus_phone_no || 'N/A'}
                    </Typography>
                  </Box>
                  {viewingPurchaseReturn.purchase?.customer?.cus_address && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {viewingPurchaseReturn.purchase?.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      INV-R-{viewingPurchaseReturn.id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchaseReturn.created_at ? new Date(viewingPurchaseReturn.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingPurchaseReturn.created_at ? new Date(viewingPurchaseReturn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getCreatedByName(viewingPurchaseReturn, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
              <Box sx={{ px: 3, py: 2 }}>
                {/* Product Details Table - Full Width */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingPurchaseReturn.return_details && viewingPurchaseReturn.return_details.length > 0 ? (
                        viewingPurchaseReturn.return_details.map((detail, index) => (
                          <TableRow key={detail.return_detail_id || index}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.qnty || detail.return_quantity || detail.qty_returned || 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.unit_rate || detail.crate || 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.total_amount || detail.return_amount || 0)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Payment Summary - Below Product Details */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* Left Side - Balance Section */}
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(viewingPurchaseReturn.purchase?.customer?.cus_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(parseFloat(viewingPurchaseReturn.total_return_amount || 0) - parseFloat(0 || 0) - parseFloat(0 || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقایا</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(parseFloat(viewingPurchaseReturn.purchase?.customer?.cus_balance ?? 0) - (parseFloat(viewingPurchaseReturn.total_return_amount || 0) - parseFloat(0 || 0) - parseFloat(0 || 0)))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Notes Section */}
                    {viewingPurchaseReturn.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {viewingPurchaseReturn.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right Side - Payment Summary */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(viewingPurchaseReturn.total_return_amount || 0) - parseFloat(0 || 0) - parseFloat(0 || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(0 || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(0 || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingPurchaseReturn.total_return_amount)}
                            </TableCell>
                          </TableRow>

                          {/* Determine cash and bank amounts */}
                          {(() => {
                            let cashAmount = parseFloat(0 || 0);
                            let bankAmount = parseFloat(0 || 0);
                            let bankName = null || 'بینک';

                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم وصول</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt((parseFloat(0 || 0) + parseFloat(0 || 0)) || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#1e293b' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#ffffff' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#facc15' }}>
                              {fmtAmt(parseFloat(viewingPurchaseReturn.total_return_amount || 0) - (parseFloat(0 || 0) + parseFloat(0 || 0)))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={() => { setViewPurchaseReturnDialogOpen(false); setViewingPurchaseReturn(null); }} variant="outlined">Close</Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' },
              color: 'white'
            }}
            onClick={() => handleSendSaleWhatsApp(viewingPurchaseReturn, 'purchase-return-invoice-ledger')}
            disabled={isSendingSaleWhatsApp || !viewingPurchaseReturn?.customer?.cus_phone_no}
            startIcon={isSendingSaleWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
          >
            {isSendingSaleWhatsApp ? 'Sending...' : '📲 WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            onClick={() => handlePrintSaleReceipt('A4', 'purchase-return-invoice-ledger')}
          >
            Print Bill
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
            onClick={() => handlePrintSaleReceipt('THERMAL', 'purchase-return-invoice-ledger')}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sale Return invoice viewer */}
      <Dialog
        open={viewSaleReturnDialogOpen}
        onClose={() => { setViewSaleReturnDialogOpen(false); setViewingSaleReturn(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}
      >
        <DialogTitle component="div" sx={{ bgcolor: '#dc2626', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              Bill Details - INV-R-{viewingSaleReturn?.return_id}
            </Typography>
          </Box>
          <IconButton
            onClick={() => { setViewSaleReturnDialogOpen(false); setViewingSaleReturn(null); }}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'white', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingSaleReturn && (
            <Box id="sale-return-invoice-ledger" sx={{ width: '100%', bgcolor: 'white' }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', py: 3, borderBottom: '2px solid #000' }}>
                <Typography variant="h4" sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  direction: 'rtl'
                }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography variant="body2" sx={{
                  mb: 1,
                  fontSize: { xs: '0.75rem', md: '0.9rem' },
                  direction: 'rtl'
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <span style={{ fontSize: '1rem', color: '#25D366', marginRight: '4px' }}>📞</span>
                  <Typography variant="body2">
                    Ph:- 0346-7560306, 0300-7560306
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mt: 2
                }}>
                  SALE RETURN INVOICE
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {viewingSaleReturn.customer ? `${viewingSaleReturn.customer.cus_name}${viewingSaleReturn.customer.name_urdu ? ' ' + viewingSaleReturn.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSaleReturn.customer?.cus_phone_no || 'N/A'}
                    </Typography>
                  </Box>
                  {viewingSaleReturn.customer?.cus_address && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {viewingSaleReturn.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      INV-R-{viewingSaleReturn.return_id}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSaleReturn.created_at ? new Date(viewingSaleReturn.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSaleReturn.created_at ? new Date(viewingSaleReturn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getCreatedByName(viewingSaleReturn, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
              <Box sx={{ px: 3, py: 2 }}>
                {/* Product Details Table - Full Width */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingSaleReturn.return_details && viewingSaleReturn.return_details.length > 0 ? (
                        viewingSaleReturn.return_details.map((detail, index) => (
                          <TableRow key={detail.return_detail_id || index}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.qnty || detail.qty_returned || detail.return_quantity || detail.quantity || 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.unit_rate || detail.sale_price || detail.rate || 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.total_amount || detail.return_amount || detail.amount || 0)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Payment Summary - Below Product Details */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* Left Side - Balance Section */}
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                      {(() => {
                        const netReturnCredit = parseFloat(viewingSaleReturn.total_amount || 0)
                          - parseFloat(viewingSaleReturn.labour_charges || 0)
                          - parseFloat(viewingSaleReturn.shipping_amount || 0)
                          - parseFloat(viewingSaleReturn.discount || 0)
                          - parseFloat(viewingSaleReturn.payment || (parseFloat(viewingSaleReturn.cash_refund || 0) + parseFloat(viewingSaleReturn.bank_refund || 0)) || 0);

                        const prevBal = (viewingSaleReturn.previous_balance !== undefined && viewingSaleReturn.previous_balance !== null)
                          ? parseFloat(viewingSaleReturn.previous_balance)
                          : (viewingSaleReturn.previous_customer_balance !== undefined && viewingSaleReturn.previous_customer_balance !== null)
                            ? parseFloat(viewingSaleReturn.previous_customer_balance)
                            : (parseFloat(viewingSaleReturn.customer?.cus_balance || 0) + netReturnCredit);

                        const totalBal = prevBal - netReturnCredit;

                        return (
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(prevBal)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجودہ بقایا</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(netReturnCredit)}
                                </TableCell>
                              </TableRow>
                              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>کل بقایا</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(totalBal)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        );
                      })()}
                    </TableContainer>

                    {/* Notes Section */}
                    {(viewingSaleReturn.notes || viewingSaleReturn.reference) && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {viewingSaleReturn.notes || viewingSaleReturn.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right Side - Payment Summary */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(viewingSaleReturn.total_amount || 0) - parseFloat(viewingSaleReturn.labour_amount || 0) - parseFloat(viewingSaleReturn.shipping_amount || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSaleReturn.labour_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSaleReturn.shipping_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSaleReturn.total_amount)}
                            </TableCell>
                          </TableRow>

                          {/* Determine cash and bank amounts */}
                          {(() => {
                            let cashAmount = parseFloat(viewingSaleReturn.cash_refund || 0);
                            let bankAmount = parseFloat(viewingSaleReturn.bank_refund || 0);
                            let bankName = viewingSaleReturn.refund_account?.cus_name || 'بینک';

                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم وصول</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt((parseFloat(viewingSaleReturn.cash_refund || 0) + parseFloat(viewingSaleReturn.bank_refund || 0)) || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#1e293b' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#ffffff' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#facc15' }}>
                              {fmtAmt(parseFloat(viewingSaleReturn.total_amount || 0) - (parseFloat(viewingSaleReturn.cash_refund || 0) + parseFloat(viewingSaleReturn.bank_refund || 0)))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={() => { setViewSaleReturnDialogOpen(false); setViewingSaleReturn(null); }} variant="outlined">Close</Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' },
              color: 'white'
            }}
            onClick={() => handleSendSaleWhatsApp(viewingSaleReturn, 'sale-return-invoice-ledger')}
            disabled={isSendingSaleWhatsApp || !viewingSaleReturn?.customer?.cus_phone_no}
            startIcon={isSendingSaleWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
          >
            {isSendingSaleWhatsApp ? 'Sending...' : '📲 WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            onClick={() => handlePrintSaleReceipt('A4', 'sale-return-invoice-ledger')}
          >
            Print Bill
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
            onClick={() => handlePrintSaleReceipt('THERMAL', 'sale-return-invoice-ledger')}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sale / Order / Bill invoice viewer (ledger eye → /api/sales?id=) */}
      <Dialog
        open={viewSaleDialogOpen}
        onClose={() => { setViewSaleDialogOpen(false); setViewingSale(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}
      >
        <DialogTitle component="div" sx={{ bgcolor: 'secondary.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
              Bill Details - {viewingSale ? getBillDisplayNo(viewingSale) : ''}
            </Typography>
          </Box>
          <IconButton
            onClick={() => { setViewSaleDialogOpen(false); setViewingSale(null); }}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <X />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'white', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingSale && (
            <Box id="sale-invoice-ledger" sx={{ width: '100%', bgcolor: 'white' }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', py: 3, borderBottom: '2px solid #000' }}>
                <Typography variant="h4" sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  direction: 'rtl'
                }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography variant="body2" sx={{
                  mb: 1,
                  fontSize: { xs: '0.75rem', md: '0.9rem' },
                  direction: 'rtl'
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <span style={{ fontSize: '1rem', color: '#25D366', marginRight: '4px' }}>📞</span>
                  <Typography variant="body2">
                    Ph:- 0346-7560306, 0300-7560306
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mt: 2
                }}>
                  {viewingSale.bill_type === 'ORDER' || viewingSale.bill_type === 'ORDER_TRASH' ? 'ORDER' : 'SALE INVOICE'}
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {viewingSale.customer ? `${viewingSale.customer.cus_name}${viewingSale.customer.name_urdu ? ' ' + viewingSale.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSale.customer?.cus_phone_no || 'N/A'}
                    </Typography>
                  </Box>
                  {viewingSale.customer?.cus_address && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {viewingSale.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getBillDisplayNo(viewingSale)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSale.created_at ? new Date(viewingSale.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {viewingSale.created_at ? new Date(viewingSale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getCreatedByName(viewingSale, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
              <Box sx={{ px: 3, py: 2 }}>
                {/* Product Details Table - Full Width */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingSale.sale_details && viewingSale.sale_details.length > 0 ? (
                        viewingSale.sale_details.map((detail, index) => (
                          <TableRow key={detail.sale_detail_id || index}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.qnty || 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Payment Summary - Below Product Details */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* Left Side - Balance Section */}
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(viewingSale.previous_balance ?? viewingSale.customer?.cus_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(parseFloat(viewingSale.total_amount || 0) - parseFloat(viewingSale.payment || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقایا</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(parseFloat(viewingSale.previous_balance ?? viewingSale.customer?.cus_balance ?? 0) + parseFloat(viewingSale.total_amount || 0) - parseFloat(viewingSale.payment || 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Notes Section */}
                    {viewingSale.reference && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {viewingSale.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right Side - Payment Summary */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(viewingSale.total_amount || 0) - parseFloat(viewingSale.labour_charges || viewingSale.labour || 0) - parseFloat(viewingSale.shipping_amount || 0) + parseFloat(viewingSale.discount || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSale.labour_charges || viewingSale.labour || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSale.shipping_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSale.total_amount)}
                            </TableCell>
                          </TableRow>

                          {/* Determine cash and bank amounts */}
                          {(() => {
                            let cashAmount = parseFloat(viewingSale.cash_payment || 0);
                            let bankAmount = parseFloat(viewingSale.bank_payment || 0);
                            let bankName = viewingSale.bank_title || viewingSale.debit_account?.cus_name || 'بینک';

                            // Fallback if split properties are missing (e.g. for legacy sales)
                            if (!viewingSale.hasOwnProperty('cash_payment') && !viewingSale.hasOwnProperty('bank_payment')) {
                              if (viewingSale.payment_type === 'CASH' || !viewingSale.payment_type) {
                                cashAmount = parseFloat(viewingSale.payment || 0);
                                bankAmount = 0;
                              } else {
                                cashAmount = 0;
                                bankAmount = parseFloat(viewingSale.payment || 0);
                                bankName = viewingSale.debit_account?.cus_name || 'بینک';
                              }
                            }

                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم وصول</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(viewingSale.payment || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#1e293b' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#ffffff' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #475569', fontSize: '0.875rem', color: '#facc15' }}>
                              {fmtAmt(parseFloat(viewingSale.total_amount || 0) - parseFloat(viewingSale.payment || 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={() => { setViewSaleDialogOpen(false); setViewingSale(null); }} variant="outlined">Close</Button>
          <Button
            variant="contained"
            sx={{
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' },
              color: 'white'
            }}
            onClick={() => handleSendSaleWhatsApp(viewingSale)}
            disabled={isSendingSaleWhatsApp || !viewingSale?.customer?.cus_phone_no}
            startIcon={isSendingSaleWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
          >
            {isSendingSaleWhatsApp ? 'Sending...' : '📲 WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
            onClick={() => handlePrintSaleReceipt('A4')}
          >
            Print Bill
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            sx={{ bgcolor: '#fd7e14', '&:hover': { bgcolor: '#e8690b' } }}
            onClick={() => handlePrintSaleReceipt('THERMAL')}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Ledger Between Dates Dialog */}
      <Dialog
        open={showPrintLedgerDialog}
        onClose={() => setShowPrintLedgerDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } }}
      >
        <DialogTitle component="div" sx={{ p: 0 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)',
            px: 3, py: 2.5,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Print size={22} color="white" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                  Print Ledger
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                  Select date range to print ledger statement
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setShowPrintLedgerDialog(false)}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              }}
            >
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          <Box sx={{ p: 3 }}>
            {/* Selected Account Info */}
            {selectedCustomer && (
              <Box sx={{ p: 2, mb: 3, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selected Account
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                  {customers.find(c => Number(c.cus_id) === Number(selectedCustomer))?.cus_name || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 600 }}>
                  Balance: PKR {fmtAmt(currentBalance)}
                </Typography>
              </Box>
            )}

            {/* Date Range Pickers */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                  From Date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={printFromDate}
                  onChange={(e) => setPrintFromDate(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Calendar size={16} color="#6366f1" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'white',
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                    }
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, display: 'block' }}>
                  To Date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={printToDate}
                  onChange={(e) => setPrintToDate(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Calendar size={16} color="#6366f1" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'white',
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                    }
                  }}
                />
              </Box>
            </Box>

            {/* Quick Date Range Buttons */}
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" sx={{ width: '100%', color: '#94a3b8', fontWeight: 600, mb: 0.5 }}>Quick Select:</Typography>
              {[
                { label: 'Today', fn: () => { const t = new Date().toISOString().split('T')[0]; setPrintFromDate(t); setPrintToDate(t); } },
                { label: 'Last 7 Days', fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 7); setPrintFromDate(f.toISOString().split('T')[0]); setPrintToDate(t.toISOString().split('T')[0]); } },
                { label: 'Last 30 Days', fn: () => { const t = new Date(); const f = new Date(t); f.setDate(f.getDate() - 30); setPrintFromDate(f.toISOString().split('T')[0]); setPrintToDate(t.toISOString().split('T')[0]); } },
                { label: 'This Month', fn: () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1); setPrintFromDate(f.toISOString().split('T')[0]); setPrintToDate(t.toISOString().split('T')[0]); } },
                { label: 'Last Month', fn: () => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth() - 1, 1); const to = new Date(t.getFullYear(), t.getMonth(), 0); setPrintFromDate(f.toISOString().split('T')[0]); setPrintToDate(to.toISOString().split('T')[0]); } },
                { label: 'This Year', fn: () => { const t = new Date(); const f = new Date(t.getFullYear(), 0, 1); setPrintFromDate(f.toISOString().split('T')[0]); setPrintToDate(t.toISOString().split('T')[0]); } },
              ].map((btn) => (
                <Chip
                  key={btn.label}
                  label={btn.label}
                  onClick={btn.fn}
                  size="small"
                  sx={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    '&:hover': {
                      bgcolor: '#6366f1',
                      color: 'white',
                      borderColor: '#6366f1',
                    },
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </Box>

            {/* Preview info */}
            {printFromDate && printToDate && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                <Typography variant="body2" sx={{ color: '#15803d', fontWeight: 600 }}>
                  {(() => {
                    const from = new Date(printFromDate); from.setHours(0, 0, 0, 0);
                    const to = new Date(printToDate); to.setHours(23, 59, 59, 999);
                    const count = finalLedgerEntries.filter(e => { const d = new Date(e.created_at); return d >= from && d <= to; }).length;
                    return `${count} entries found between ${new Date(printFromDate).toLocaleDateString('en-GB')} and ${new Date(printToDate).toLocaleDateString('en-GB')}`;
                  })()}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: 'white', gap: 1.5 }}>
          <Button
            onClick={() => setShowPrintLedgerDialog(false)}
            variant="outlined"
            sx={{ borderColor: '#e2e8f0', color: '#64748b', '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }, px: 3, borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Print size={18} />}
            onClick={handlePrintLedger}
            disabled={!printFromDate || !printToDate}
            sx={{
              background: !printFromDate || !printToDate ? undefined : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' },
              px: 4, fontWeight: 700, borderRadius: 2,
              boxShadow: !printFromDate || !printToDate ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
              minWidth: 160,
            }}
          >
            Print Ledger
          </Button>
        </DialogActions>
      </Dialog>

      <Box id="printable-invoice-a4-finance" sx={{ width: '100%', bgcolor: 'white', display: 'none' }} />
      
      {/* Thermal Printable Container - Finance (80mm) */}
      {(() => {
        const activeSaleData = viewingSale;
        const activePurchaseData = viewingPurchase;
        const activeReturnData = viewingPurchaseReturn;

        const activeBillData = activeSaleData || activePurchaseData || activeReturnData;
        if (!activeBillData) return <div id="printable-invoice-thermal-finance" style={{ display: 'none' }}></div>;

        const isPurchase = !!activePurchaseData;
        const isPurchaseReturn = !!activeReturnData;
        const title = isPurchaseReturn ? 'PURCHASE RETURN' : isPurchase ? 'PURCHASE RECEIPT' : (activeBillData?.is_return ? 'SALE RETURN' : 'SALE RECEIPT');

        const items = activeBillData.sale_details || activeBillData.purchase_details || activeBillData.return_details || [];
        const totalAmount = parseFloat(activeBillData.total_amount || activeBillData.display_net_total || activeBillData.net_total || 0);
        const discountAmount = parseFloat(activeBillData.discount || 0);
        const shippingAmount = parseFloat(activeBillData.shipping_amount || activeBillData.cargo_amount || 0);
        const labourAmount = parseFloat(activeBillData.labour_charges || activeBillData.labour || 0);
        const subtotalAmount = totalAmount - labourAmount - shippingAmount + discountAmount;
        const paidAmount = parseFloat(activeBillData.payment || activeBillData.paid_amount || 0);
        const balanceAmount = totalAmount - paidAmount;
        const customerObj = activeBillData.customer || activeBillData.purchase?.customer;

        return (
          <Box
            id="printable-invoice-thermal-finance"
            sx={{
              width: '78mm',
              maxWidth: '78mm',
              bgcolor: '#ffffff',
              color: '#000000',
              mx: 'auto',
              p: '2mm',
              fontFamily: 'monospace, Arial, sans-serif',
              boxSizing: 'border-box',
              display: 'none',
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '2px solid #000' }}>
              <Typography sx={{ fontSize: '15px', fontWeight: '900', fontFamily: 'Arial, sans-serif', direction: 'rtl', color: '#000' }}>
                اتفاق آئرن اینڈ سیمنٹ سٹور
              </Typography>
              <Typography sx={{ fontSize: '11px', direction: 'rtl', mt: 0.25, color: '#000' }}>
                گجرات سرگودھا روڈ، پاہڑیانوالی
              </Typography>
              <Typography sx={{ fontSize: '11px', fontWeight: 'bold', mt: 0.25, color: '#000' }}>
                Ph: 0346-7560306, 0300-7560306
              </Typography>
              <Typography
                sx={{
                  mt: 0.75,
                  px: 1,
                  py: 0.25,
                  bgcolor: '#000',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  display: 'inline-block',
                }}
              >
                {title}
              </Typography>
            </Box>

            {/* Meta */}
            <Box sx={{ py: 0.75, fontSize: '11px', borderBottom: '1px dashed #000', color: '#000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Inv #: <strong>{getBillDisplayNo(activeBillData) || `#${activeBillData.id || activeBillData.sale_id || ''}`}</strong></span>
                <span>Date: <strong>{new Date(activeBillData.created_at || Date.now()).toLocaleDateString('en-GB')}</strong></span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                <span>Time: <strong>{new Date(activeBillData.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></span>
                <span>Type: <strong>{activeBillData.bill_type || (isPurchase ? 'PURCHASE' : 'FINANCE')}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Party: <strong>{customerObj?.cus_name || 'N/A'}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Created By: <strong>{getCreatedByName(activeBillData, currentUser)}</strong></span>
              </Box>
              {customerObj?.cus_phone_no && (
                <Box sx={{ mt: 0.25 }}>
                  <span>Phone: <strong>{customerObj.cus_phone_no}</strong></span>
                </Box>
              )}
            </Box>

            {/* Items Header */}
            <Box sx={{ borderBottom: '1px solid #000', py: 0.5, my: 0.5, fontWeight: 'bold', fontSize: '11px', color: '#000' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', flex: 1, color: '#000' }}>Item Description</Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', width: '35px', textAlign: 'center', color: '#000' }}>Qty</Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', width: '50px', textAlign: 'right', color: '#000' }}>Rate</Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', width: '55px', textAlign: 'right', color: '#000' }}>Total</Typography>
              </Box>
            </Box>

            {/* Items List */}
            <Box sx={{ borderBottom: '1px dashed #000', pb: 0.75, mb: 0.75 }}>
              {items && items.length > 0 ? (
                items.map((d, i) => (
                  <Box key={d.sale_detail_id || d.purchase_detail_id || i} sx={{ mb: 0.75 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#000', wordBreak: 'break-word' }}>
                      {d.product?.pro_title || 'Item'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#000' }}>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: '11px', width: '35px', textAlign: 'center', color: '#000' }}>
                        {fmtAmt(d.qnty)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', width: '50px', textAlign: 'right', color: '#000' }}>
                        {fmtAmt(d.unit_rate || d.rate)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', fontWeight: 'bold', width: '55px', textAlign: 'right', color: '#000' }}>
                        {fmtAmt(d.total_amount || (d.qnty * (d.unit_rate || d.rate)))}
                      </Typography>
                    </Box>
                  </Box>
                ))
              ) : (
                <Typography sx={{ fontSize: '11px', textAlign: 'center', py: 0.5, color: '#000' }}>No items</Typography>
              )}
            </Box>

            {/* Financial Summary */}
            <Box sx={{ fontSize: '11px', lineHeight: 1.4, color: '#000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '11px', color: '#000' }}>Subtotal</Typography>
                <Typography sx={{ fontSize: '11px', color: '#000' }}>{fmtAmt(subtotalAmount)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '11px', color: '#000' }}>Discount</Typography>
                <Typography sx={{ fontSize: '11px', color: '#000' }}>
                  {discountAmount > 0 ? `-${fmtAmt(discountAmount)}` : '0'}
                </Typography>
              </Box>
              {shippingAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Shipping / Delivery</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>+{fmtAmt(shippingAmount)}</Typography>
                </Box>
              )}
              {labourAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Labour Charges</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>+{fmtAmt(labourAmount)}</Typography>
                </Box>
              )}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: '900',
                  fontSize: '12px',
                  borderTop: '2px solid #000',
                  borderBottom: '2px solid #000',
                  py: 0.25,
                  my: 0.5,
                }}
              >
                <Typography sx={{ fontSize: '12px', fontWeight: '900', color: '#000' }}>GRAND TOTAL</Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: '900', color: '#000' }}>{fmtAmt(totalAmount)}</Typography>
              </Box>

              {/* Payments */}
              {parseFloat(activeBillData.cash_payment || 0) > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Cash Paid</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>{fmtAmt(activeBillData.cash_payment)}</Typography>
                </Box>
              )}
              {parseFloat(activeBillData.bank_payment || 0) > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Bank ({activeBillData.bank_title || 'Bank'})</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>{fmtAmt(activeBillData.bank_payment)}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', mt: 0.5, pt: 0.5, borderTop: '1px dashed #000' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#000' }}>Remaining Balance</Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#000' }}>
                  {fmtAmt(balanceAmount)}
                </Typography>
              </Box>
            </Box>

            {/* Footer */}
            <Box sx={{ textAlign: 'center', borderTop: '1px solid #000', mt: 1, pt: 0.75 }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 'bold', direction: 'rtl', color: '#000' }}>
                شکریہ! دوبارہ تشریف لائیےگا
              </Typography>
              <Typography sx={{ fontSize: '10px', color: '#333', mt: 0.25 }}>
                Thank you for your business!
              </Typography>
            </Box>
          </Box>
        );
      })()}

      <style>{`
        @media print {
          body.print-a4 *, body.print-thermal * { visibility: hidden !important; }
          
          /* Collapse layout container height to prevent blank page generation */
          body.print-a4 .dashboard-layout-root,
          body.print-thermal .dashboard-layout-root {
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          body.print-a4 #printable-invoice-a4-finance, body.print-a4 #printable-invoice-a4-finance * { visibility: visible !important; }
          body.print-thermal #printable-invoice-thermal-finance, body.print-thermal #printable-invoice-thermal-finance * { visibility: visible !important; }
          body.print-a4 #printable-invoice-a4-finance {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 999999 !important;
            background: white !important;
          }
          body.print-thermal #printable-invoice-thermal-finance {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 78mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
            z-index: 99999 !important;
            background: white !important;
          }
        }
      `}</style>

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />
    </DashboardLayout>
  );
}
