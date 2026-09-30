'use client';

import { useState, useEffect, useCallback, useMemo, Suspense, useRef, useLayoutEffect, forwardRef } from 'react';
import { getCreatedByName, formatTimePK, formatDatePK } from '@/lib/date-helper';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';
import DateFilterInput from '../components/date-filter-input';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH, notifyLedgerDataChanged } from '@/lib/ledger-tabs';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import {
  PurchaseInvoiceA4Document,
  buildPurchaseA4PrintHtml,
  downloadPurchaseInvoicePdf,
  mountPurchasePrintHtml,
  removePurchasePrintMount,
  PURCHASE_INVOICE_PAGE_AT_PAGE,
  PURCHASE_SHEET_PRINT_HIDE_CSS,
} from './purchase-invoice-a4-print';

const PURCHASE_SHEET_PRINT_MODE = 'A5';
const PURCHASE_INVOICE_PREVIEW_MAX_WIDTH = '148mm';

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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Fab,
  Checkbox,
  FormControlLabel,
  Menu,
  LinearProgress,
  Pagination
} from '@mui/material';

// Material Icons
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Error as AlertCircleIcon,
  Visibility as EyeIcon,
  VisibilityOff as EyeOffIcon,
  BarChart as BarChartIcon,
  LocalShipping as TruckIcon,
  Inventory as PackageIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  ArrowBack as ArrowLeftIcon,
  ArrowForward as ArrowRightIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  AttachMoney as AttachMoneyIcon,
  Business as BusinessIcon,
  Label as TagIcon,
  CreditCard as CreditCardIcon,
  Translate as TranslateIcon,
  Description as NotesIcon,
  LocationOn as MapPinIcon,
  LocationOn as LocationOnIcon,
  TrendingDown as TrendingDownIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Money as MoneyIcon,
  MoreVert as MoreVertIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';

const EMPTY_PRODUCT_FORM_DATA = {
  qnty: '1',
  unit_rate: '',
  crate: '',
  cost_rate: '',
};

const normalizeProductFormData = (data) => ({
  qnty: data?.qnty ?? EMPTY_PRODUCT_FORM_DATA.qnty,
  unit_rate: data?.unit_rate ?? '',
  crate: data?.crate ?? '',
  cost_rate: data?.cost_rate ?? '',
});

const PURCHASE_PAGE_CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const PURCHASE_EXCEL_TABLE_SX = {
  minWidth: 1100,
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid #cbd5e1',
    py: 0.65,
    px: 1.1,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
  },
};

const getTodayDateStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const PURCHASE_EXCEL_HEAD_SX = {
  bgcolor: '#dce6f1',
  color: '#1e293b',
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  borderBottom: '2px solid #94a3b8 !important',
};

const PURCHASE_NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const PURCHASE_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: { xs: 1.5, md: 2 },
  width: '100%',
};

const PURCHASE_FILTER_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#fff',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.primary.blue,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500 },
};

const SUPPLIER_LIST_LIMIT = 120;

function filterPurchaseSuppliers(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  const out = [];
  for (let i = 0; i < options.length && out.length < SUPPLIER_LIST_LIMIT; i += 1) {
    const o = options[i];
    if (!q) {
      out.push(o);
      continue;
    }
    if (
      (o.cus_name || '').toLowerCase().includes(q) ||
      (o.cus_phone_no || '').toLowerCase().includes(q) ||
      (o.cus_phone_no2 || '').toLowerCase().includes(q) ||
      (o.cus_address || '').toLowerCase().includes(q) ||
      (o.cus_reference || '').toLowerCase().includes(q) ||
      (o.city?.city_name || '').toLowerCase().includes(q)
    ) {
      out.push(o);
    }
  }
  return out;
}

function filterPurchaseBankAccounts(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  if (!q) return options;
  return options.filter(
    (o) =>
      (o.cus_name || '').toLowerCase().includes(q) ||
      (o.cus_phone_no || '').toLowerCase().includes(q) ||
      (o.cus_phone_no2 || '').toLowerCase().includes(q)
  );
}

function slimPurchaseDetailsForApi(details) {
  return (details || []).map((d) => ({
    pro_id: d.pro_id,
    qnty: d.qnty ?? d.quantity,
    unit: d.unit,
    unit_rate: d.unit_rate ?? d.rate,
    prate: d.prate,
    crate: d.crate,
    total_amount: d.total_amount,
    store_id: d.store_id,
    cost_rate: d.cost_rate,
    original_cost_rate: d.original_cost_rate,
  }));
}

function commitPurchaseDropdownOnTab(e, highlighted, applyValue, focusNext) {
  if (e.shiftKey || (e.key !== 'Tab' && e.key !== 'Enter')) return false;
  e.preventDefault();
  e.stopPropagation();
  if (highlighted) applyValue(highlighted);
  window.setTimeout(() => {
    const el = typeof focusNext === 'function' ? focusNext() : document.querySelector(focusNext);
    if (!el) return;
    el.focus();
    if (typeof el.select === 'function') el.select();
  }, 0);
  return true;
}

const PURCHASE_DROPDOWN_LINE = '1px solid #c5c5c5';
const PURCHASE_SUPPLIER_DROPDOWN_GRID = '24px minmax(110px, 1.8fr) minmax(80px, 1fr) minmax(80px, 1.1fr)';
const PURCHASE_PRODUCT_DROPDOWN_GRID = '24px minmax(110px, 1.8fr) minmax(75px, 1fr) minmax(75px, 1.1fr)';
const PURCHASE_BANK_DROPDOWN_GRID = '24px minmax(80px, 1.5fr) minmax(80px, 1fr)';

const purchaseDropdownRowStyle = (columns) => ({
  display: 'grid',
  gridTemplateColumns: columns,
  alignItems: 'stretch',
  width: '100%',
  padding: 0,
  margin: 0,
  minHeight: 32,
  borderBottom: PURCHASE_DROPDOWN_LINE,
});

const purchaseDropdownCellStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRight: PURCHASE_DROPDOWN_LINE,
  minWidth: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 13,
};

function PurchaseDropdownListbox({ columns, headers, props, listRef, showCost = false, onToggleCost = null }) {
  const { children, ownerState, sx, className, style, slots, slotProps, ...other } = props;
  return (
    <ul
      ref={listRef}
      className={className}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        maxHeight: 320,
        overflow: 'auto',
        border: PURCHASE_DROPDOWN_LINE,
        background: '#fff',
        ...style,
      }}
      {...other}
    >
      {headers.length > 0 && (
        <li
          role="presentation"
          aria-hidden
          style={{
            ...purchaseDropdownRowStyle(columns),
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: '#d9e2f3',
          }}
        >
          {headers.map((label, i) => (
            <span
              key={label || `h-${i}`}
              style={{
                ...purchaseDropdownCellStyle,
                fontSize: 11,
                fontWeight: 800,
                color: '#1e3a5f',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderRight: i === headers.length - 1 ? 'none' : PURCHASE_DROPDOWN_LINE,
                justifyContent: label === '#' ? 'center' : label === 'Cost' || label === 'Balance' ? 'flex-end' : 'flex-start',
                paddingRight: label === 'Cost' || label === 'Balance' ? 10 : 8,
              }}
            >
              {label === 'Cost' ? (
                <Box
                  component="span"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onToggleCost) onToggleCost();
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    userSelect: 'none',
                    '&:hover': { color: '#0284c7' },
                  }}
                  title={showCost ? 'Hide Cost Rate' : 'Show Cost Rate'}
                >
                  <span>{label}</span>
                  {showCost ? (
                    <EyeIcon sx={{ fontSize: 13, color: '#1e3a5f' }} />
                  ) : (
                    <EyeOffIcon sx={{ fontSize: 13, color: '#64748b' }} />
                  )}
                </Box>
              ) : (
                label
              )}
            </span>
          ))}
        </li>
      )}
      {children}
    </ul>
  );
}

const PurchaseSupplierDropdownListbox = forwardRef(function PurchaseSupplierDropdownListbox(props, ref) {
  return (
    <PurchaseDropdownListbox
      listRef={ref}
      props={props}
      columns={PURCHASE_SUPPLIER_DROPDOWN_GRID}
      headers={['#', 'Name', 'Phone', 'Balance']}
    />
  );
});

const PurchaseProductDropdownListbox = forwardRef(function PurchaseProductDropdownListbox(props, ref) {
  const { showCost, onToggleCost, ...restProps } = props;
  return (
    <PurchaseDropdownListbox
      listRef={ref}
      props={restProps}
      columns={PURCHASE_PRODUCT_DROPDOWN_GRID}
      headers={['#', 'Product', 'Stock', 'Cost']}
      showCost={showCost}
      onToggleCost={onToggleCost}
    />
  );
});

const PurchaseBankDropdownListbox = forwardRef(function PurchaseBankDropdownListbox(props, ref) {
  return (
    <PurchaseDropdownListbox
      listRef={ref}
      props={props}
      columns={PURCHASE_BANK_DROPDOWN_GRID}
      headers={['#', 'Name', 'Balance']}
    />
  );
});

const PURCHASE_DROPDOWN_POPPER_SX = {
  zIndex: 1400,
  '& .MuiPaper-root': {
    borderRadius: 0,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
    overflow: 'hidden',
  },
  '& .MuiAutocomplete-option': {
    padding: '0 !important',
    minHeight: '32px !important',
    alignItems: 'stretch',
  },
  '& .MuiAutocomplete-option:nth-of-type(even)': {
    backgroundColor: '#f3f3f3',
  },
  '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option[aria-selected="true"]': {
    backgroundColor: '#cde6f7 !important',
  },
};

const PURCHASE_ENTRY_LABEL_SX = {
  mb: 0.75,
  fontWeight: 700,
  fontSize: '0.72rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 22,
  whiteSpace: 'nowrap',
};

const PURCHASE_ENTRY_CONTROL_SX = {
  width: '100%',
  minWidth: 0,
  bgcolor: '#fff',
  '& .MuiInputBase-root': {
    height: 40,
    bgcolor: '#fff',
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: '0.875rem',
    py: 0,
  },
};

const PURCHASE_ENTRY_CELL_SX = {
  minWidth: 0,
  width: '100%',
};

const PURCHASE_ENTRY_ROW1_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.2fr)',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

const PURCHASE_ENTRY_ROW1_RETURN_SX = {
  ...PURCHASE_ENTRY_ROW1_SX,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.15fr)',
  },
};

const PURCHASE_ENTRY_ROW2_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr 1fr',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 0.55fr) minmax(0, 0.65fr) minmax(0, 0.65fr) minmax(0, 0.65fr) minmax(0, 0.6fr) minmax(0, 0.55fr) 44px',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

const PURCHASE_PAYMENT_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.35fr)',
  },
  gap: { xs: 1.5, md: 2 },
  alignItems: 'end',
  width: '100%',
};

const PURCHASE_PAYMENT_ROW2_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 2fr)' },
  gap: { xs: 1.5, md: 2 },
  alignItems: 'stretch',
  width: '100%',
};

const PURCHASE_CHARGE_PANELS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: { xs: 1.5, md: 2 },
  alignItems: 'stretch',
  width: '100%',
};

const PURCHASE_CHARGE_BOX_SX = {
  border: '1px solid #c5d4e8',
  borderRadius: '10px',
  overflow: 'hidden',
  bgcolor: '#fff',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: { md: 220 },
};

const PURCHASE_CHARGE_BOX_TITLE_SX = {
  fontWeight: 700,
  fontSize: '0.8125rem',
  color: '#1e293b',
  px: 1.5,
  py: 1,
  bgcolor: '#eef4fc',
  borderBottom: '1px solid #dce3ed',
};

const PURCHASE_INCLUDE_BAR_SX = {
  display: 'flex',
  alignItems: 'center',
  px: 1.25,
  py: 0.75,
  bgcolor: BRAND.tint.blue,
  borderBottom: '1px solid #dce3ed',
  '& .MuiFormControlLabel-root': { m: 0, width: '100%' },
  '& .MuiFormControlLabel-label': {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: BRAND.text.blue,
  },
  '& .MuiCheckbox-root': { p: 0.5 },
};

const PURCHASE_CHARGE_BODY_SX = {
  p: { xs: 1.25, md: 1.5 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  flex: 1,
};

const PURCHASE_CHARGE_INNER_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.25,
  width: '100%',
};

const PURCHASE_CARGO_AMOUNTS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
  },
  gap: 1.25,
  width: '100%',
};

const PURCHASE_NOTES_CONTROL_SX = {
  width: '100%',
  minWidth: 0,
  bgcolor: '#fff',
  '& .MuiInputBase-root': {
    height: 'auto',
    minHeight: 72,
    alignItems: 'flex-start',
    py: 1,
    bgcolor: '#fff',
  },
  '& .MuiInputBase-input': {
    fontSize: '0.875rem',
  },
};

/** Read-only money display (not a TextField) — totals & summaries */
const PURCHASE_AMOUNT_TOTAL_BASE_SX = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  borderRadius: '8px',
  border: `1px solid #b8ccf7`,
  bgcolor: '#f8fbff',
  boxShadow: 'inset 0 1px 0 #fff',
  fontVariantNumeric: 'tabular-nums',
};

function PurchaseAmountTotal({ value, variant = 'default', label }) {
  const n = parseFloat(value);
  const display = Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  if (label) {
    return (
      <Box
        sx={{
          ...PURCHASE_AMOUNT_TOTAL_BASE_SX,
          justifyContent: 'space-between',
          gap: 1.5,
          minHeight: 40,
          px: 1.5,
          py: 0.75,
          mt: 0.25,
          bgcolor: BRAND.tint.blue,
          borderColor: '#9eb8f5',
        }}
      >
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', color: BRAND.text.blue }}>
          {display}
        </Typography>
      </Box>
    );
  }

  const isLarge = variant === 'large';
  return (
    <Box
      sx={{
        ...PURCHASE_AMOUNT_TOTAL_BASE_SX,
        justifyContent: 'flex-end',
        minHeight: isLarge ? 46 : 40,
        px: 1.5,
        py: isLarge ? 1 : 0.75,
        borderWidth: isLarge ? '1.5px' : '1px',
        borderColor: isLarge ? BRAND.primary.blue : '#b8ccf7',
        background: isLarge
          ? `linear-gradient(180deg, #ffffff 0%, ${BRAND.tint.blue} 100%)`
          : '#f8fbff',
        boxShadow: isLarge ? `inset 0 1px 0 #fff, 0 1px 3px ${BRAND.primary.blue}18` : 'inset 0 1px 0 #fff',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: isLarge ? '1.25rem' : '0.9375rem',
          color: BRAND.text.blue,
          lineHeight: 1.2,
        }}
      >
        {display}
      </Typography>
    </Box>
  );
}

const PURCHASE_FIELD_LABEL_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#64748b',
  mb: 0.5,
  display: 'block',
};

const PURCHASE_ENTRY_HEADER_GRADIENT = `linear-gradient(180deg, ${BRAND.primary.blue} 0%, #3b6ff0 55%, #7ba3f0 100%)`;
const PURCHASE_ENTRY_TABLE_HEAD_SX = {
  bgcolor: '#dce6f1',
  color: '#1e293b',
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '2px solid #94a3b8',
  py: 1,
};

const PURCHASE_TOOLBAR_BTN_PRIMARY_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '0.8125rem',
  bgcolor: BRAND.primary.blue,
  borderRadius: '8px',
  height: 36,
  px: 1.75,
  boxShadow: 'none',
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: '#1347c4', boxShadow: 'none' },
};

const PURCHASE_TOOLBAR_BTN_OUTLINED_SX = {
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: BRAND.text.blue,
  borderColor: '#b8ccf7',
  bgcolor: '#fff',
  borderRadius: '8px',
  height: 36,
  px: 1.5,
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: BRAND.primary.blue,
    bgcolor: BRAND.tint.blue,
  },
};

/** Quick-action accents — distinct from primary blue, still on-brand */
const purchaseToolbarAccentBtnSx = (main, text, tint, hoverTint) => ({
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: text,
  borderColor: main,
  borderWidth: '1.5px',
  bgcolor: tint,
  borderRadius: '8px',
  height: 36,
  px: 1.5,
  whiteSpace: 'nowrap',
  boxShadow: `0 1px 3px ${main}26`,
  '& .MuiButton-startIcon': { color: main },
  '&:hover': {
    borderColor: main,
    borderWidth: '1.5px',
    bgcolor: hoverTint,
    boxShadow: `0 2px 6px ${main}33`,
  },
});

const PURCHASE_TOOLBAR_BTN_ADD_PRODUCT_SX = purchaseToolbarAccentBtnSx(
  BRAND.supporting.periwinkle,
  BRAND.text.periwinkle,
  BRAND.tint.periwinkle,
  '#e0e4fc',
);
const PURCHASE_TOOLBAR_BTN_CATEGORY_SX = purchaseToolbarAccentBtnSx(
  BRAND.supporting.cyan,
  BRAND.text.cyan,
  BRAND.tint.cyan,
  '#ccf2fc',
);
const PURCHASE_TOOLBAR_BTN_SUBCATEGORY_SX = purchaseToolbarAccentBtnSx(
  BRAND.supporting.green,
  BRAND.text.green,
  BRAND.tint.green,
  '#ccf7e8',
);

function PurchasesPageContent() {
  const router = useRouter();
  // PIN auth
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();

  // State management
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [formLookupsLoading, setFormLookupsLoading] = useState(false);
  const [editPurchaseLoading, setEditPurchaseLoading] = useState(false);
  const formLookupsLoadedRef = useRef(false);
  const catalogLookupsLoadedRef = useRef(false);
  const purchaseDetailCacheRef = useRef(new Map());
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(u);
      } catch (e) {}
    }
  }, []);

  // Screen Stack State
  const [screenStack, setScreenStack] = useState([{
    formData: {
      cus_id: '',
      store_id: '',
      debit_account_id: '',
      credit_account_id: '',
      total_amount: '',
      unloading_amount: '',
      fare_amount: '',
      transport_amount: '',
      labour_amount: '',
      out_labour_amount: '',
      out_delivery_amount: '',
      include_cargo_in_costprice: false,
      include_labour: false,
      discount: '',
      cash_payment: '',
      bank_payment: '',
      payment_type: 'CASH',
      vehicle_no: '',
      invoice_number: '',
      date: getTodayDateStr(),
      purchase_details: []
    },
    formSelectedCustomer: null,
    selectedBankAccount: null,
    purchaseType: 'new',
    selectedPurchaseForReturn: null,
    productFormData: { ...EMPTY_PRODUCT_FORM_DATA, qnty: '' },
    selectedProduct: null,
    editingPurchase: null,
    timestamp: new Date().toLocaleTimeString(),
    customerName: 'New Purchase'
  }]);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);

  // Filtered customer lists
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cargoAccounts, setCargoAccounts] = useState([]); // accounts with category containing "transport"
  const [selectedCargoAccounts, setSelectedCargoAccounts] = useState([]); // multiple selection

  // Function to filter customers by type
  // Function to filter customers by category and type
  const filterCustomersByCategory = (customers, customerCategories, customerTypes) => {
    // Log all categories with their IDs to see what we're working with
    console.log('🔍 ALL CUSTOMER CATEGORIES:');
    customerCategories.forEach(cat => {
      console.log(`  ID: ${cat.cus_cat_id}, Title: "${cat.cus_cat_title}"`);
    });

    console.log('🔍 ALL CUSTOMER TYPES:');
    customerTypes.forEach(t => {
      console.log(`  ID: ${t.cus_type_id}, Title: "${t.cus_type_title}"`);
    });

    console.log('👥 All Customers with Category and Type:');
    customers.forEach(c => {
      const category = customerCategories.find(cat => cat.cus_cat_id === c.cus_category);
      const type = customerTypes.find(t => t.cus_type_id === c.cus_type);
      console.log(`  ID: ${c.cus_id}, Name: "${c.cus_name}", Category: "${category?.cus_cat_title || 'unknown'}", Type: "${type?.cus_type_title || 'unknown'}"`);
    });

    // Filter by category title text (case-insensitive)
    // Suppliers: category title contains "supplier"
    const filteredSuppliers = customers.filter(customer => {
      const categoryInfo = customerCategories.find(cat => cat.cus_cat_id === customer.cus_category);
      return categoryInfo && categoryInfo.cus_cat_title.toLowerCase().includes('supplier');
    });

    // Bank accounts: BOTH category AND type must contain "bank"
    const filteredBankAccounts = customers.filter(customer => {
      const categoryInfo = customerCategories.find(cat => cat.cus_cat_id === customer.cus_category);
      const typeInfo = customerTypes.find(t => t.cus_type_id === customer.cus_type);
      const hasBank = categoryInfo && categoryInfo.cus_cat_title.toLowerCase().includes('bank');
      const hasBank2 = typeInfo && typeInfo.cus_type_title.toLowerCase().includes('bank');
      return hasBank && hasBank2;
    });

    console.log(`✅ Filtered ${filteredSuppliers.length} suppliers (category contains 'supplier')`);
    console.log(`✅ Filtered ${filteredBankAccounts.length} bank accounts (BOTH category AND type contain 'bank')`);

    return { suppliers: filteredSuppliers, bankAccounts: filteredBankAccounts };
  };

  // Sample vehicle data - now dynamic
  const [vehicles, setVehicles] = useState([
    { id: 1, vehicle_no: 'ABC-123', driver_name: 'John Doe', driver_phone: '0300-1234567', vehicle_type: 'Truck' },
    { id: 2, vehicle_no: 'XYZ-456', driver_name: 'Jane Smith', driver_phone: '0300-7654321', vehicle_type: 'Van' },
    { id: 3, vehicle_no: 'DEF-789', driver_name: 'Mike Johnson', driver_phone: '0300-9876543', vehicle_type: 'Truck' },
    { id: 4, vehicle_no: 'GHI-012', driver_name: 'Sarah Wilson', driver_phone: '0300-1122334', vehicle_type: 'Van' },
    { id: 5, vehicle_no: 'JKL-345', driver_name: 'David Brown', driver_phone: '0300-5566778', vehicle_type: 'Truck' }
  ]);

  // Vehicle management state
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    vehicle_type: 'Truck'
  });
  const [vehicleMenuAnchor, setVehicleMenuAnchor] = useState(null);
  const [selectedVehicleForMenu, setSelectedVehicleForMenu] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const searchParams = useSearchParams();
  const urlWantsCreateView =
    searchParams?.get('view') === 'create' || searchParams?.get('type') === 'return';
  const [currentView, setCurrentView] = useState(urlWantsCreateView ? 'create' : 'list'); // 'list' or 'create'

  useLayoutEffect(() => {
    if (searchParams?.get('view') === 'create' || searchParams?.get('type') === 'return') {
      setCurrentView('create');
    }
  }, [searchParams]);

  // Open create form when header/sidebar links use ?view=create
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const typeParam = searchParams?.get('type');
    const forceCreate = viewParam === 'create' || typeParam === 'return';

    if (!forceCreate) return;

    setCurrentView('create');
    if (typeParam === 'return') {
      setPurchaseType('return');
    } else {
      setPurchaseType('new');
    }
  }, [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Customer form states
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerTypeOpenPurchases, setCustomerTypeOpenPurchases] = useState(false);
  const customerTypeInputRefPurchases = useRef(null);
  const customerNameInputRefPurchases = useRef(null);
  const supplierHighlightRef = useRef(null);
  const purchaseSubmitInFlightRef = useRef(false);
  const suppressDraftSaveRef = useRef(false);
  // Track highlighted option for each dropdown so Tab selects the focused item
  const highlightedTypeRef = useRef(null);
  const highlightedCategoryRef = useRef(null);
  const highlightedCityRef = useRef(null);

  // Refs for keyboard accessibility
  const bankAccountInputRef = useRef(null);
  const bankAccountHighlightRef = useRef(null);
  const cargoInputRef = useRef(null);
  const outLabourInputRef = useRef(null);
  const outDeliveryInputRef = useRef(null);

  const openCustomerForm = (preferredType = 'supplier') => {
    // Open the dialog and keep Account Type blank. Focus Account Name so user can type the name first.
    setCustomerFormData(prev => ({ ...prev, cus_type: '' }));
    setShowCustomerForm(true);
    // ensure the Account Type dropdown is closed and focus the Account Name input after the dialog mounts
    setTimeout(() => {
      setCustomerTypeOpenPurchases(false);
      setTimeout(() => customerNameInputRefPurchases.current?.focus(), 50);
    }, 80);
  };
  const [customerFormData, setCustomerFormData] = useState({
    cus_name: '',
    cus_phone_no: '',
    cus_phone_no2: '',
    cus_address: '',
    cus_reference: '',
    cus_account_info: '',
    other: '',
    cus_type: '',
    cus_category: '',
    cus_balance: 0,
    CNIC: '',
    NTN_NO: '',
    name_urdu: '',
    city_id: ''
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Customer form dropdown data
  const [customerTypes, setCustomerTypes] = useState([]);
  const [cities, setCities] = useState([]);

  // Popup states for quick actions
  const [showCustomerCategoryPopup, setShowCustomerCategoryPopup] = useState(false);
  const [showCustomerTypePopup, setShowCustomerTypePopup] = useState(false);
  const [showCityPopup, setShowCityPopup] = useState(false);

  // Popup form data
  const [customerCategoryFormData, setCustomerCategoryFormData] = useState({ cus_cat_title: '' });
  const [customerTypeFormData, setCustomerTypeFormData] = useState({ cus_type_title: '' });
  const [cityFormData, setCityFormData] = useState({ city_name: '' });
  const [showAddProductPopup, setShowAddProductPopup] = useState(false);
  const [showProductCostInDropdown, setShowProductCostInDropdown] = useState(false);
  const [revealedCostProductIds, setRevealedCostProductIds] = useState({});
  const [addProductFormData, setAddProductFormData] = useState({ pro_title: '', pro_description: '', cat_id: '', sub_cat_id: '', pro_crate: '', pro_sale_price: '', pro_baser_price: '', pro_cost_price: '', pro_stock_qnty: '', pro_unit: '', pro_packing: '', low_stock_quantity: '10' });
  const [productCatInput, setProductCatInput] = useState('');
  const [productSubCatInput, setProductSubCatInput] = useState('');
  const [showAddProductCategoryPopup, setShowAddProductCategoryPopup] = useState(false);
  const [addProductCategoryName, setAddProductCategoryName] = useState('');
  const [showAddProductSubCategoryPopup, setShowAddProductSubCategoryPopup] = useState(false);
  const [addProductSubCategoryFormData, setAddProductSubCategoryFormData] = useState({ sub_cat_name: '', cat_id: '' });

  // Popup loading states
  const [isAddingCustomerCategory, setIsAddingCustomerCategory] = useState(false);
  const [isAddingCustomerType, setIsAddingCustomerType] = useState(false);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingProductCategory, setIsAddingProductCategory] = useState(false);
  const [isAddingProductSubCategory, setIsAddingProductSubCategory] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Product grid filter states
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  // Date filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);

  // Selected product for preview
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({ ...EMPTY_PRODUCT_FORM_DATA });

  // Customer dropdown filter states
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [bankAccountDropdownOpen, setBankAccountDropdownOpen] = useState(false);
  const [formSelectedCustomer, setFormSelectedCustomer] = useState(null);

  // Receipt dialog states
  const [currentBillData, setCurrentBillData] = useState(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isDownloadingPurchasePdf, setIsDownloadingPurchasePdf] = useState(false);

  // Handle print receipt (A4 / Thermal) - copied from sales print logic and adapted for purchases
  const handlePrintReceipt = (mode = PURCHASE_SHEET_PRINT_MODE, fromDialog = false) => {
    try {
      const className = mode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const isThermal = mode === 'THERMAL';

      const printableContainer = mode === 'THERMAL'
        ? document.getElementById('printable-invoice-thermal-purchase')
        : document.getElementById('printable-invoice-a4-purchase');

      if (!printableContainer) {
        console.error('Printable container not found (purchases)');
        return;
      }

      if (fromDialog && mode === PURCHASE_SHEET_PRINT_MODE && currentBillData) {
        mountPurchasePrintHtml(buildPurchaseA4PrintHtml(currentBillData, purchasePrintCtx));
      } else if (fromDialog && mode === 'THERMAL') {
        const receiptPreview = document.getElementById('receipt-preview');
        if (receiptPreview && printableContainer) {
          printableContainer.innerHTML = receiptPreview.innerHTML;
        }
      }

      // Temporarily show container for print
      const originalStyles = {
        position: printableContainer.style.position,
        left: printableContainer.style.left,
        top: printableContainer.style.top,
        visibility: printableContainer.style.visibility,
        display: printableContainer.style.display
      };

      const isSheetPrint = mode === PURCHASE_SHEET_PRINT_MODE && fromDialog && currentBillData;

      if (!isSheetPrint) {
        printableContainer.style.position = 'fixed';
        printableContainer.style.left = '0';
        printableContainer.style.top = '0';
        printableContainer.style.visibility = 'visible';
        printableContainer.style.display = 'block';
        printableContainer.style.zIndex = '9999';
        printableContainer.style.backgroundColor = 'white';
      }

      let styleId = 'dynamic-print-style-purchase';
      let styleElement = document.getElementById(styleId);

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      if (isThermal) {
        styleElement.textContent = `@media print { @page { size: 80mm portrait; margin: 0; } }`;
      } else if (isSheetPrint) {
        styleElement.textContent = `@media print { @page { size: ${PURCHASE_INVOICE_PAGE_AT_PAGE}; margin: 0.5cm 1cm; } } ${PURCHASE_SHEET_PRINT_HIDE_CSS}`;
      } else {
        styleElement.textContent = `@media print { @page { size: ${PURCHASE_INVOICE_PAGE_AT_PAGE}; margin: 0.5cm 1cm; } }`;
      }

      if (isSheetPrint) {
        document.body.classList.add('purchase-sheet-print');
      } else {
        document.body.classList.add(className);
      }

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          if (!isSheetPrint) {
            printableContainer.style.position = originalStyles.position;
            printableContainer.style.left = originalStyles.left;
            printableContainer.style.top = originalStyles.top;
            printableContainer.style.visibility = originalStyles.visibility;
            printableContainer.style.display = originalStyles.display;
            printableContainer.style.zIndex = '';
            printableContainer.style.backgroundColor = '';
          } else {
            removePurchasePrintMount();
            document.body.classList.remove('purchase-sheet-print');
          }

          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');

          if (styleElement) {
            styleElement.remove();
          }
        }, 100);
      }, 100);
    } catch (e) {
      console.error('Print error (purchases):', e);
      window.print();
    }
  };

  const handleDownloadPurchasePdf = async (bill) => {
    if (!bill || isDownloadingPurchasePdf) return;
    setIsDownloadingPurchasePdf(true);
    try {
      await downloadPurchaseInvoicePdf(bill, purchasePrintCtx);
      showSnackbar('PDF downloaded', 'success');
    } catch (err) {
      console.error('Purchase PDF download failed:', err);
      showSnackbar(err?.message || 'Failed to download PDF', 'error');
    } finally {
      setIsDownloadingPurchasePdf(false);
    }
  };

  const handleSendWhatsApp = async (bill, elementId = 'receipt-preview') => {
    try {
      setIsSendingWhatsApp(true);
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const phone = bill?.supplier?.sup_phone_no || bill?.customer?.cus_phone_no;
      const { opened } = await shareViaWhatsAppDesktop({
        elementId,
        phone,
      });
      showSnackbar(`✅ ${whatsAppSuccessMessage(opened)}`, 'success');
    } catch (err) {
      showSnackbar(`❌ WhatsApp error: ${err.message}`, 'error');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Purchase Type and Return states
  const [purchaseType, setPurchaseType] = useState('new'); // 'new' or 'return'
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState(null);
  const [purchaseSearchResults, setPurchaseSearchResults] = useState([]);
  const [purchaseSearchOpen, setPurchaseSearchOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    cus_id: '',
    store_id: '',
    debit_account_id: '',
    credit_account_id: '',
    cargo_account_id: '',
    cargo_account_ids: [],
    total_amount: '',
    unloading_amount: '',
    fare_amount: '',
    transport_amount: '',
    labour_amount: '',
    incity_own_labour: '',
    incity_own_delivery: '',
    incity_charges_total: '',
    include_incity: false,
    include_labour: false,
    include_cargo_in_costprice: false,
    discount: '',
    cash_payment: '',
    bank_payment: '',
    payment_type: 'CASH',
    vehicle_no: '',
    invoice_number: '',
    purchase_details: []
  });

  // ── Local-storage draft persistence ──────────────────────────────────────
  const DRAFT_KEY = 'purchase_form_draft';
  const [hasDraft, setHasDraft] = useState(false);

  // Restore draft on first mount (skipped when URL opens create form)
  useEffect(() => {
    if (searchParams?.get('view') === 'create' || searchParams?.get('type') === 'return') {
      return;
    }

    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.formData) setFormData(prev => ({ ...prev, ...draft.formData }));
        if (draft.purchaseType) setPurchaseType(draft.purchaseType);
        if (draft.formSelectedCustomer) setFormSelectedCustomer(draft.formSelectedCustomer);
        if (draft.selectedBankAccount) setSelectedBankAccount(draft.selectedBankAccount);
        if (draft.selectedCargoAccounts) setSelectedCargoAccounts(draft.selectedCargoAccounts);
        if (draft.selectedPurchaseForReturn) setSelectedPurchaseForReturn(draft.selectedPurchaseForReturn);
        if (draft.currentView) setCurrentView(draft.currentView);
        setHasDraft(true);
      }
    } catch (e) {
      console.warn('Failed to restore purchase draft:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount unless URL already requests create
  }, []);

  // Auto-save draft whenever form state changes (skipped right after successful save / clear)
  useEffect(() => {
    if (suppressDraftSaveRef.current) return;
    const hasContent =
      !!formData.cus_id ||
      (formData.purchase_details?.length ?? 0) > 0 ||
      !!formSelectedCustomer ||
      !!formData.vehicle_no ||
      !!formData.invoice_number;
    if (!hasContent) {
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      return;
    }
    try {
      const draft = {
        formData,
        purchaseType,
        formSelectedCustomer,
        selectedBankAccount,
        selectedCargoAccounts,
        selectedPurchaseForReturn,
        currentView,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    } catch (e) {
      console.warn('Failed to save purchase draft:', e);
    }
  }, [formData, purchaseType, formSelectedCustomer, selectedBankAccount, selectedCargoAccounts, selectedPurchaseForReturn, currentView]);
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPurchaseList = useCallback(async () => {
    setListLoading(true);
    try {
      const purchasesRes = await fetch('/api/purchases?list=true');
      if (purchasesRes.ok) {
        const purchasesData = await purchasesRes.json();
        setPurchases(Array.isArray(purchasesData) ? purchasesData : []);
      }
    } catch (error) {
      console.error('Error fetching purchase list:', error);
      setSnackbar({
        open: true,
        message: 'Error loading purchase list',
        severity: 'error',
      });
    } finally {
      setListLoading(false);
    }
  }, []);

  const ensureFormLookups = useCallback(async () => {
    if (formLookupsLoadedRef.current) return;
    setFormLookupsLoading(true);
    try {
      const [customersRes, productsRes, storesRes, customerCategoriesRes, customerTypesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/stores'),
        fetch('/api/customer-category'),
        fetch('/api/customer-types'),
      ]);

      if (customersRes.ok) {
        setCustomers(await customersRes.json());
      }
      if (productsRes.ok) {
        setProducts(await productsRes.json());
      }
      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        const storesData = storesResponse.success ? storesResponse.data : [];
        setStores(Array.isArray(storesData) ? storesData : []);
      }
      if (customerCategoriesRes.ok) {
        const customerCategoriesData = await customerCategoriesRes.json();
        setCustomerCategories(Array.isArray(customerCategoriesData) ? customerCategoriesData : []);
      }
      if (customerTypesRes.ok) {
        const customerTypesData = await customerTypesRes.json();
        setCustomerTypes(Array.isArray(customerTypesData) ? customerTypesData : []);
      }
      formLookupsLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading purchase form lookups:', error);
    } finally {
      setFormLookupsLoading(false);
    }
  }, []);

  const ensureCatalogLookups = useCallback(async () => {
    if (catalogLookupsLoadedRef.current) return;
    try {
      const [categoriesRes, subcategoriesRes, citiesRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/subcategories'),
        fetch('/api/cities'),
      ]);
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (subcategoriesRes.ok) setSubcategories(await subcategoriesRes.json());
      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(Array.isArray(citiesData) ? citiesData : []);
      }
      catalogLookupsLoadedRef.current = true;
    } catch (error) {
      console.warn('Error loading catalog lookups:', error);
    }
  }, []);

  const refreshCustomersDropdown = useCallback(async () => {
    try {
      const customersRes = await fetch('/api/customers?dropdown=true');
      if (customersRes.ok) setCustomers(await customersRes.json());
    } catch (error) {
      console.warn('Error refreshing customers:', error);
    }
  }, []);

  const prefetchPurchaseForEdit = useCallback((purId) => {
    if (!purId || purchaseDetailCacheRef.current.has(purId)) return;
    void fetch(`/api/purchases?id=${purId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.pur_id) purchaseDetailCacheRef.current.set(data.pur_id, data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetchPurchaseList();
    void ensureFormLookups();
    void ensureCatalogLookups();
  }, [fetchPurchaseList, ensureFormLookups, ensureCatalogLookups]);

  // Filter customers by category when both customers and customerCategories are loaded
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0 && customerTypes.length > 0) {
      console.log('🔍 Filtering customers - customers:', customers.length, 'categories:', customerCategories.length, 'types:', customerTypes.length);
      const { suppliers, bankAccounts } = filterCustomersByCategory(customers, customerCategories, customerTypes);
      setSuppliers(suppliers);
      setBankAccounts(bankAccounts);

      // Compute cargo accounts — REQUIRE: customer type title equals "cargo"
      try {
        const typeMap = new Map(customerTypes.map(t => [t.cus_type_id, (t.cus_type_title || '').toLowerCase().trim()]));
        const cargo = customers.filter(cust => {
          const typeTitle = typeMap.get(cust.cus_type) || '';
          return typeTitle === 'cargo';
        });
        console.log(`🔍 Found ${cargo.length} cargo accounts (type === 'cargo')`);
        setCargoAccounts(cargo);
      } catch (err) {
        console.warn('Error computing cargo accounts', err);
        setCargoAccounts([]);
      }

    } else {
      console.log('🔍 Not filtering yet - customers:', customers.length, 'categories:', customerCategories.length, 'types:', customerTypes.length);
    }
  }, [customers, customerCategories, customerTypes]);

  // ========== SCREEN STACK MANAGEMENT FUNCTIONS ==========
  const captureScreenState = useCallback(() => {
    return {
      formData: JSON.parse(JSON.stringify(formData)),
      formSelectedCustomer: formSelectedCustomer ? { ...formSelectedCustomer } : null,
      selectedBankAccount: selectedBankAccount ? { ...selectedBankAccount } : null,
      selectedCargoAccounts: selectedCargoAccounts ? selectedCargoAccounts.map(c => ({ ...c })) : [],
      purchaseType: purchaseType,
      selectedPurchaseForReturn: selectedPurchaseForReturn ? { ...selectedPurchaseForReturn } : null,
      productFormData: JSON.parse(JSON.stringify(productFormData)),
      selectedProduct: selectedProduct ? { ...selectedProduct } : null,
      editingPurchase: editingPurchase ? { ...editingPurchase } : null,
      timestamp: new Date().getTime().toString(),
      customerName: formSelectedCustomer?.cus_name || (purchaseType === 'return' ? 'Purchase Return' : 'New Purchase')
    };
  }, [formData, formSelectedCustomer, selectedBankAccount, selectedCargoAccounts, purchaseType, selectedPurchaseForReturn, productFormData, selectedProduct, editingPurchase]);

  // Get fresh blank state
  const getFreshPurchaseState = useCallback(() => {
    return {
      formData: {
        cus_id: '',
        store_id: stores[0]?.storeid?.toString() || '',
        debit_account_id: '',
        credit_account_id: '',
        cargo_account_id: '',
        cargo_account_ids: [],
        total_amount: '',
        unloading_amount: '',
        fare_amount: '',
        transport_amount: '',
        labour_amount: '',
        incity_own_labour: '',
        incity_own_delivery: '',
        incity_charges_total: '',
        include_incity: false,
        include_labour: false,
        include_cargo_in_costprice: false,
        out_labour_amount: '',
        out_delivery_amount: '',
        discount: '',
        cash_payment: '',
        bank_payment: '',
        payment_type: 'CASH',
        vehicle_no: '',
        invoice_number: '',
        date: getTodayDateStr(),
        purchase_details: []
      },
      formSelectedCustomer: null,
      selectedBankAccount: null,
      purchaseType: 'new',
      selectedPurchaseForReturn: null,
      productFormData: { ...EMPTY_PRODUCT_FORM_DATA },
      selectedProduct: null,
      editingPurchase: null,
      timestamp: new Date().getTime().toString(),
      customerName: 'New Purchase'
    };
  }, [stores]);

  // Is navigating flag to prevent auto-save during transitions
  const [isNavigating, setIsNavigating] = useState(false);

  // Restore screen state
  const restoreScreenState = (state) => {
    if (!state) return;
    setFormData(JSON.parse(JSON.stringify(state.formData)));
    setFormSelectedCustomer(state.formSelectedCustomer);
    setSelectedBankAccount(state.selectedBankAccount);
    setSelectedCargoAccounts(state.selectedCargoAccounts || []);
    setPurchaseType(state.purchaseType);
    setSelectedPurchaseForReturn(state.selectedPurchaseForReturn);
    setProductFormData(normalizeProductFormData(state.productFormData));
    setSelectedProduct(state.selectedProduct);
    setEditingPurchase(state.editingPurchase);

    // Reset search terms if needed
    setCustomerSearchTerm(state.formSelectedCustomer?.cus_name || '');
  };

  const applyFreshPurchaseForm = useCallback((options = {}) => {
    const { silent = false } = options;
    suppressDraftSaveRef.current = true;
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);

    const fresh = getFreshPurchaseState();
    setFormData(fresh.formData);
    setFormSelectedCustomer(null);
    setSelectedBankAccount(null);
    setSelectedCargoAccounts([]);
    setPurchaseType('new');
    setSelectedPurchaseForReturn(null);
    setEditingPurchase(null);
    setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA });
    setSelectedProduct(null);
    setCustomerSearchTerm('');
    setScreenStack([fresh]);
    setCurrentScreenIndex(0);

    window.setTimeout(() => {
      suppressDraftSaveRef.current = false;
    }, 500);

    if (!silent) {
      setSnackbar({ open: true, message: '📋 Form cleared — ready for new entry', severity: 'info' });
    }
  }, [getFreshPurchaseState]);

  // Clear form state
  const clearFormState = (options = {}) => {
    applyFreshPurchaseForm(options);
  };

  // Open new screen (Ctrl+Right)
  // Open new screen (Ctrl+Right)
  const openNewScreen = useCallback(() => {
    setIsNavigating(true);
    const currentState = captureScreenState();
    const newStack = screenStack.slice(0, currentScreenIndex + 1);
    newStack[currentScreenIndex] = currentState;

    const freshState = getFreshPurchaseState();

    const updatedStack = [...newStack, freshState];
    setScreenStack(updatedStack);
    setCurrentScreenIndex(updatedStack.length - 1);
    restoreScreenState(freshState);

    setTimeout(() => {
      setIsNavigating(false);
      setSnackbar({ open: true, message: `📋 Screen ${updatedStack.length} | Starting fresh`, severity: 'info' });
    }, 150);
  }, [captureScreenState, currentScreenIndex, screenStack, stores]);

  // Go to previous screen (Ctrl+Left)
  const goToPreviousScreen = useCallback(() => {
    if (currentScreenIndex > 0) {
      setIsNavigating(true);
      // CAPTURE CURRENT STATE BEFORE MOVING
      const currentState = captureScreenState();
      const updatedStack = [...screenStack];
      updatedStack[currentScreenIndex] = currentState;
      setScreenStack(updatedStack);

      const previousIndex = currentScreenIndex - 1;
      const previousState = updatedStack[previousIndex];
      restoreScreenState(previousState);
      setCurrentScreenIndex(previousIndex);

      setTimeout(() => {
        setIsNavigating(false);
        setSnackbar({ open: true, message: `📋 Screen ${previousIndex + 1} | ${previousState.customerName}`, severity: 'info' });
      }, 150);
    }
  }, [currentScreenIndex, screenStack, captureScreenState]);

  // Go to next screen
  const goToNextScreen = useCallback(() => {
    if (currentScreenIndex < screenStack.length - 1) {
      setIsNavigating(true);
      // CAPTURE CURRENT STATE BEFORE MOVING
      const currentState = captureScreenState();
      const updatedStack = [...screenStack];
      updatedStack[currentScreenIndex] = currentState;
      setScreenStack(updatedStack);

      const nextIndex = currentScreenIndex + 1;
      const nextState = updatedStack[nextIndex];
      restoreScreenState(nextState);
      setCurrentScreenIndex(nextIndex);

      setTimeout(() => {
        setIsNavigating(false);
        setSnackbar({ open: true, message: `📋 Screen ${nextIndex + 1} | ${nextState.customerName}`, severity: 'info' });
      }, 150);
    }
  }, [currentScreenIndex, screenStack, captureScreenState]);

  // Smart forward navigation
  const handleForwardNavigation = useCallback(() => {
    if (currentScreenIndex < screenStack.length - 1) {
      goToNextScreen();
    } else {
      openNewScreen();
    }
  }, [currentScreenIndex, screenStack.length, goToNextScreen, openNewScreen]);

  // Cancel current screen
  const cancelCurrentScreen = useCallback(() => {
    if (screenStack.length <= 1) {
      const freshState = getFreshPurchaseState();
      setScreenStack([freshState]);
      setCurrentScreenIndex(0);
      restoreScreenState(freshState);
      setSnackbar({ open: true, message: '📋 Screen 1 reset', severity: 'info' });
      return;
    }

    const hasNextScreen = currentScreenIndex < screenStack.length - 1;
    const newStack = screenStack.filter((_, index) => index !== currentScreenIndex);
    const targetIndex = hasNextScreen ? currentScreenIndex : currentScreenIndex - 1;
    const targetState = newStack[targetIndex];

    setScreenStack(newStack);
    setCurrentScreenIndex(targetIndex);
    restoreScreenState(targetState);
    setSnackbar({ open: true, message: `📋 Screen removed. Now at Screen ${targetIndex + 1}`, severity: 'info' });
  }, [currentScreenIndex, screenStack, captureScreenState]);

  // Auto-save with debounce to prevent input focus loss
  useEffect(() => {
    if (!isNavigating && currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const debounceTimer = setTimeout(() => {
        const updatedState = captureScreenState();
        const newStack = [...screenStack];
        newStack[currentScreenIndex] = updatedState;
        setScreenStack(newStack);
        console.log(`💾 Auto-saved Purchase Screen ${currentScreenIndex + 1}`);
      }, 3000); // Wait 3 seconds after user stops typing

      return () => clearTimeout(debounceTimer);
    }
  }, [formData, formSelectedCustomer, selectedBankAccount, purchaseType, selectedPurchaseForReturn, productFormData, selectedProduct, editingPurchase, isNavigating, currentScreenIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Don't trigger if in an input/textarea and not a shortcut key
      const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        handleForwardNavigation();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousScreen();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        cancelCurrentScreen();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [handleForwardNavigation, goToPreviousScreen, cancelCurrentScreen]);

  // Auto-select first store when stores are loaded; also clear stale store_id (e.g. from localStorage draft)
  useEffect(() => {
    if (stores.length === 0) return;
    const validIds = stores.map(s => s.storeid.toString());
    if (!formData.store_id || !validIds.includes(formData.store_id)) {
      setFormData(prev => ({ ...prev, store_id: stores[0].storeid.toString() }));
    }
  }, [stores]);

  // Recompute product cost_rate from original_cost_rate + (labourPerUnit) + (incityPerUnit) + (cargoPerUnit)
  // All values must be passed explicitly — no formData closure reads to avoid stale state bugs
  const recomputeDistributedCosts = (purchaseDetails, {
    includeLabour = false,
    labourAmount = 0,
    includeIncity = false,
    incityAmount = 0,
    includeCargo = false,
    outLabour = 0,
    outDelivery = 0
  } = {}) => {
    if (!purchaseDetails || purchaseDetails.length === 0) return purchaseDetails;

    const totalQuantity = purchaseDetails.reduce((sum, d) => sum + parseFloat(d.qnty || 0), 0);

    const outLabourNum = parseFloat(outLabour || 0);
    const outDeliveryNum = parseFloat(outDelivery || 0);
    const cargoTotal = includeCargo ? (outLabourNum + outDeliveryNum) : 0;

    // Labour + Delivery distribution: labourAmount already includes transport_amount (delivery charges)
    const labourTotal = includeLabour ? parseFloat(labourAmount || 0) : 0;
    const incityTotal = includeIncity ? parseFloat(incityAmount || 0) : 0;

    const labourPerUnit = totalQuantity > 0 ? labourTotal / totalQuantity : 0;
    const incityPerUnit = totalQuantity > 0 ? incityTotal / totalQuantity : 0;
    const cargoPerUnit = totalQuantity > 0 ? cargoTotal / totalQuantity : 0;

    // If no distribution is active, restore original_cost_rate if present
    if (!includeLabour && !includeIncity && !includeCargo) {
      return purchaseDetails.map(detail => ({
        ...detail,
        cost_rate: detail.original_cost_rate ?? detail.cost_rate ?? detail.crate ?? detail.unit_rate ?? 0,
        total_amount: Number((parseFloat(detail.crate || detail.unit_rate || 0) * parseFloat(detail.qnty || 0)).toFixed(2))
      }));
    }

    return purchaseDetails.map(detail => {
      const base = parseFloat(detail.original_cost_rate ?? detail.cost_rate ?? detail.crate ?? detail.unit_rate ?? 0);
      const newCost = Number((base + labourPerUnit + incityPerUnit + cargoPerUnit).toFixed(2));
      return {
        ...detail,
        cost_rate: newCost,
        original_cost_rate: detail.original_cost_rate ?? detail.cost_rate ?? detail.crate ?? detail.unit_rate ?? 0,
        total_amount: Number((parseFloat(detail.crate || detail.unit_rate || 0) * parseFloat(detail.qnty || 0)).toFixed(2))
      };
    });
  };

  // Helper: build distribution params from a formData snapshot (prev or current)
  // labourAmount = labour_amount + transport_amount (delivery charges) combined
  const getDistributionParams = (fd, overrides = {}) => ({
    includeLabour: fd.include_labour,
    labourAmount: parseFloat(fd.labour_amount || 0) + parseFloat(fd.transport_amount || 0),
    includeIncity: fd.include_incity,
    incityAmount: parseFloat(fd.incity_own_labour || 0) + parseFloat(fd.incity_own_delivery || 0),
    includeCargo: fd.include_cargo_in_costprice,
    outLabour: fd.out_labour_amount,
    outDelivery: fd.out_delivery_amount,
    ...overrides
  });

  // Distribute labour + delivery charges to cost price. labourAmount comes from getDistributionParams (labour + transport combined).
  const handleLabourDistribution = (includeLabour, purchaseDetails, fd = formData) => {
    return recomputeDistributedCosts(purchaseDetails, getDistributionParams(fd, { includeLabour }));
  };

  // Function to handle Incity charges distribution (independent)
  const handleIncityDistribution = (includeIncity, incityAmount, purchaseDetails, fd = formData) => {
    return recomputeDistributedCosts(purchaseDetails, getDistributionParams(fd, { includeIncity, incityAmount }));
  };

  // Function to handle Cargo charges distribution (independent)
  const handleCargoDistribution = (includeCargo, outLabour, outDelivery, purchaseDetails, fd = formData) => {
    return recomputeDistributedCosts(purchaseDetails, getDistributionParams(fd, { includeCargo, outLabour, outDelivery }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerDropdown && !event.target.closest('.customer-dropdown')) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  // Close bank account dropdown if bank payment is cleared so Autocomplete won't try to open without an input
  useEffect(() => {
    if (parseFloat(formData.bank_payment || 0) <= 0) {
      setBankAccountDropdownOpen(false);
    }
  }, [formData.bank_payment]);

  // Helper function to get sort label
  const getSortLabel = (value) => {
    const labels = {
      'created_at-desc': 'Newest First',
      'created_at-asc': 'Oldest First',
      'customer-asc': 'Customer A-Z',
      'customer-desc': 'Customer Z-A',
      'net_total-desc': 'Amount High-Low',
      'net_total-asc': 'Amount Low-High'
    };
    return labels[value] || 'Newest First';
  };

  // Filter and sort logic
  const filteredPurchases = purchases.filter(purchase => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = term === '' ||
      purchase.customer?.cus_name?.toLowerCase().includes(term) ||
      purchase.vehicle_no?.toLowerCase().includes(term) ||
      String(purchase.pur_id).includes(term) ||
      purchase.reference?.toLowerCase().includes(term);
    const matchesCustomer = !selectedCustomer || purchase.cus_id === selectedCustomer;
    const matchesPaymentType = filterPaymentType === '' ||
      (purchase.payment_type || '').toUpperCase() === filterPaymentType;

    const matchesStore = filterStore === '' ||
      (purchase.store_id?.toString() === filterStore);

    const totalAmount = parseFloat(purchase.net_total || 0);
    const matchesMinAmount = filterMinAmount === '' ||
      totalAmount >= parseFloat(filterMinAmount);
    const matchesMaxAmount = filterMaxAmount === '' ||
      totalAmount <= parseFloat(filterMaxAmount);

    const matchesDateFrom = dateFrom === '' ||
      (dateFrom && purchase.created_at && new Date(purchase.created_at) >= new Date(dateFrom));

    const matchesDateTo = dateTo === '' ||
      (dateTo && purchase.created_at && new Date(purchase.created_at) <= new Date(dateTo));

    return matchesSearch && matchesCustomer && matchesStore && matchesMinAmount && matchesMaxAmount && matchesDateFrom && matchesDateTo && matchesPaymentType;
  });

  // Product filtering logic
  const getFilteredSubcategories = () => {
    if (!selectedCategory) return subcategories;
    return subcategories.filter(sub => sub.cat_id === selectedCategory);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.pro_title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      product.pro_description?.toLowerCase().includes(productSearchTerm.toLowerCase());

    return matchesSearch;
  });

  // Customer filtering logic
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.cus_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_email?.toLowerCase().includes(customerSearchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedPurchases = filteredPurchases.sort((a, b) => {
    let aValue, bValue;

    if (sortBy === 'created_at') {
      aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
      bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
    } else if (sortBy === 'net_total') {
      aValue = parseFloat(a.net_total);
      bValue = parseFloat(b.net_total);
    } else if (sortBy === 'customer') {
      aValue = a.customer?.cus_name.toLowerCase();
      bValue = b.customer?.cus_name.toLowerCase();
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const listTotal = sortedPurchases.length;
  const paginatedPurchases = sortedPurchases.slice(
    (listPage - 1) * listPageSize,
    listPage * listPageSize
  );

  useEffect(() => {
    setListPage(1);
  }, [
    searchTerm,
    selectedCustomer,
    sortBy,
    sortOrder,
    dateFrom,
    dateTo,
    filterStore,
    filterMinAmount,
    filterMaxAmount,
    filterPaymentType,
    listPageSize,
  ]);

  // Stats calculations
  const totalPurchases = purchases.length;
  const totalPurchaseValue = purchases.reduce((sum, p) => sum + parseFloat(p.net_total), 0);
  const totalUnloadingAmount = purchases.reduce((sum, p) => sum + parseFloat(p.unloading_amount), 0);
  const totalFareAmount = purchases.reduce((sum, p) => sum + parseFloat(p.fare_amount), 0);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle product selection (show in preview section)
  // NOTE: show sale rate in the SALE RATE field and cost rate in the PURCHASE RATE (crate) field
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductFormData({
      ...EMPTY_PRODUCT_FORM_DATA,
      unit_rate: (product.pro_sale_price || 0).toString(), // maintain sale rate here
      crate: (product.pro_crate || product.pro_cost_price || product.pro_sale_price || 0).toString(), // prioritized cost rate for purchase
      cost_rate: (product.pro_crate || product.pro_cost_price || product.pro_sale_price || 0).toString(),
    });
  };

  // Add product to purchase list
  const addProductToPurchase = () => {
    if (!selectedProduct) return;

    // Check if store is selected
    if (!formData.store_id) {
      alert('Please select a store before adding products');
      return;
    }

    // Always add as a new line item (don't check for duplicates)
    const totalAmount = parseFloat(productFormData.qnty) * parseFloat(productFormData.crate || productFormData.unit_rate);

    const newDetail = {
      id: Date.now(), // Unique ID for each addition
      pro_id: selectedProduct.pro_id,
      product_id: selectedProduct.pro_id, // Add product_id for console logging
      store_id: formData.store_id, // Add store_id to each product detail
      qnty: productFormData.qnty, // Changed from 'quantity' to 'qnty' to match table
      unit: selectedProduct.pro_unit,
      rate: productFormData.unit_rate,
      unit_rate: productFormData.unit_rate, // Keep for backward compatibility
      crate: productFormData.crate || productFormData.unit_rate, // Use crate value or fallback to unit_rate
      original_crate: (productFormData.crate || productFormData.unit_rate), // preserve baseline purchase rate
      // COST RATE fields — initialize from product's stored cost price
      original_cost_rate: productFormData.cost_rate || (selectedProduct?.pro_cost_price ? String(selectedProduct.pro_cost_price) : (productFormData.crate || productFormData.unit_rate || '0')),
      cost_rate: productFormData.cost_rate || (selectedProduct?.pro_cost_price ? String(selectedProduct.pro_cost_price) : (productFormData.crate || productFormData.unit_rate || '0')),
      total_amount: totalAmount.toString(),
      discount: '0'
    };

    setFormData(prev => {
      const updatedPurchaseDetails = [...prev.purchase_details, newDetail];

      // Apply labour + delivery distribution if checkbox is checked
      const finalPurchaseDetails = handleLabourDistribution(
        prev.include_labour,
        updatedPurchaseDetails,
        prev
      );

      return {
        ...prev,
        purchase_details: finalPurchaseDetails
      };
    });

    // If user edited unit_rate or crate for this product, update local product and persist to backend
    (async () => {
      try {
        const newUnit = parseFloat(productFormData.unit_rate || 0) || 0;
        const newCrateVal = productFormData.crate ? parseFloat(productFormData.crate) : null;

        // Do NOT treat the editable `unit_rate` (sale rate) as a change to product's cost price.
        // Only update/persist the product's crate (purchase rate) when it was explicitly changed here.
        const originalCrate = selectedProduct?.pro_crate != null ? parseFloat(selectedProduct.pro_crate) : null;
        const crateChanged = newCrateVal !== null && newCrateVal !== originalCrate;

        if (selectedProduct && crateChanged) {
          // Update local products state so next selects show updated defaults
          setProducts(prev => prev.map(p => p.pro_id === selectedProduct.pro_id ? {
            ...p,
            pro_crate: newCrateVal
          } : p));

          // Persist change to API (best-effort, non-blocking)
          const payload = { id: selectedProduct.pro_id, pro_crate: newCrateVal };

          const resp = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (resp.ok) {
            const updatedProduct = await resp.json();
            // ensure local products reflect authoritative server response
            setProducts(prev => prev.map(p => p.pro_id === updatedProduct.pro_id ? updatedProduct : p));
          } else {
            console.warn('Failed to persist product update', await resp.text());
          }
        }
      } catch (err) {
        console.error('Error persisting product price/crate change:', err);
      }
    })();

    // Reset selection
    setSelectedProduct(null);
    setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA });

    // Auto-focus on product selection field after adding product
    setTimeout(() => {
      const productInputs = document.querySelectorAll('input[placeholder*="Select product"]');
      // Focus on first product selection input
      if (productInputs.length > 0) {
        productInputs[0]?.focus();
      }
    }, 100);
  };

  // Keyboard shortcut 'a' to add product
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Trigger if 'a' is pressed (case-insensitive) and not in an input/textarea
      if (e.key.toLowerCase() === 'a' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable) {
        const addBtn = document.getElementById('add-product-btn');
        if (addBtn && !addBtn.disabled) {
          e.preventDefault();
          addBtn.click();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const selectCustomer = (customer) => {
    setFormData(prev => ({ ...prev, cus_id: customer.cus_id }));
    setCustomerSearchTerm(customer.cus_name);
    setFormSelectedCustomer(customer);
    setShowCustomerDropdown(false);
  };

  const getSelectedCustomer = () => {
    return customers.find(customer => customer.cus_id === formData.cus_id);
  };

  const removePurchaseDetail = (index) => {
    setFormData(prev => ({
      ...prev,
      purchase_details: prev.purchase_details.filter((_, i) => i !== index)
    }));
  };

  const calculateTotalAmount = () => {
    return Number(formData.purchase_details.reduce((sum, detail) => sum + parseFloat(detail.total_amount || 0), 0).toFixed(2));
  };

  // New: total quantity across purchase details
  const calculateTotalQuantity = () => {
    return Number(formData.purchase_details.reduce((sum, detail) => sum + parseFloat(detail.qnty || 0), 0).toFixed(2));
  };

  const calculateNetTotal = () => {
    const totalAmount = calculateTotalAmount();
    const discount = parseFloat(formData.discount || 0);

    const unloadingAmount = parseFloat(formData.unloading_amount || 0);
    // Transport and labour always added to supplier total
    const transportAmount = parseFloat(formData.transport_amount || 0);
    const labourAmount = parseFloat(formData.labour_amount || 0);

    return Number((totalAmount + unloadingAmount + transportAmount + labourAmount - discount).toFixed(2));
  };

  // Format amount: show decimals only when non-zero (e.g. 143575.00 → "143,575", 12.99 → "12.99")
  const fmtAmt = (val) => {
    const n = parseFloat(val || 0);
    if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Invoice helpers: compute display net and remaining due consistently (uses display_net_total when present)
  // NOTE: Out-labour / Out-delivery are external cargo charges and should NOT be part of the
  // supplier-facing invoice net. They are excluded from the fallback calculation below.
  const getInvoiceNet = (bill) => {
    if (!bill) return 0;
    const fallback = (parseFloat(bill.total_amount || 0) + parseFloat(bill.unloading_amount || 0) + parseFloat(bill.transport_amount || 0) + parseFloat(bill.labour_amount || 0) + parseFloat(bill.fare_amount || 0)) - parseFloat(bill.discount || 0);
    const net = parseFloat(bill.display_net_total ?? fallback);
    return Number.isFinite(net) ? Number(net.toFixed(2)) : 0;
  };

  const getInvoiceRemainingDue = (bill) => {
    const net = getInvoiceNet(bill);
    const payment = parseFloat(bill?.payment || 0);
    return Number((net - payment).toFixed(2));
  };

  /** Supplier payable: balance is negative when we owe. After this purchase: previous − unpaid portion of this bill. */
  const getSupplierBalanceAfterBill = (bill) => {
    const prev = parseFloat(bill?.previous_customer_balance ?? bill?.customer?.cus_balance ?? 0);
    return Number((prev - getInvoiceRemainingDue(bill)).toFixed(2));
  };

  const purchasePrintCtx = useMemo(() => ({
    fmtAmt,
    formatDatePK,
    formatTimePK,
    phoneLine: `Ph:- ${(COMPANY.phones || ['0300-7560306']).join(', ')}`,
    getInvoiceNet,
    getInvoiceRemainingDue,
    getSupplierBalanceAfterBill,
    createdByFor: (bill) => getCreatedByName(bill, currentUser),
  }), [currentUser]);

  // Calculate and sync Incity charges total (read-only) — only own labour + own delivery
  useEffect(() => {
    try {
      const incityLabour = parseFloat(formData.incity_own_labour || 0);
      const incityDelivery = parseFloat(formData.incity_own_delivery || 0);
      const computed = Number((incityLabour + incityDelivery).toFixed(2));
      const current = parseFloat(formData.incity_charges_total || 0);
      if (isNaN(current) || current !== computed) {
        setFormData(prev => ({ ...prev, incity_charges_total: computed.toString() }));
      }
    } catch (err) {
      console.warn('Error computing incity charges total', err);
    }
  }, [formData.incity_own_labour, formData.incity_own_delivery]);

  // Vehicle management functions
  const handleOpenVehicleDialog = () => {
    setEditingVehicle(null);
    setVehicleFormData({
      vehicle_no: '',
      driver_name: '',
      driver_phone: '',
      vehicle_type: 'Truck'
    });
    setVehicleDialogOpen(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      vehicle_no: vehicle.vehicle_no,
      driver_name: vehicle.driver_name,
      driver_phone: vehicle.driver_phone || '',
      vehicle_type: vehicle.vehicle_type || 'Truck'
    });
    setVehicleDialogOpen(true);
  };

  const handleCloseVehicleDialog = () => {
    setVehicleDialogOpen(false);
    setEditingVehicle(null);
  };

  const handleVehicleFormChange = (field, value) => {
    setVehicleFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveVehicle = async () => {
    try {
      // Validation
      if (!vehicleFormData.vehicle_no.trim()) {
        showSnackbar('Vehicle number is required', 'error');
        return;
      }
      if (!vehicleFormData.driver_name.trim()) {
        showSnackbar('Driver name is required', 'error');
        return;
      }

      if (editingVehicle) {
        // Update existing vehicle
        const updatedVehicles = vehicles.map(vehicle =>
          vehicle.id === editingVehicle.id
            ? { ...vehicle, ...vehicleFormData }
            : vehicle
        );
        setVehicles(updatedVehicles);
        showSnackbar('Vehicle updated successfully', 'success');
      } else {
        // Add new vehicle
        const newVehicle = {
          id: Date.now(),
          ...vehicleFormData
        };
        setVehicles(prev => [...prev, newVehicle]);
        showSnackbar('Vehicle added successfully', 'success');
      }

      handleCloseVehicleDialog();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      showSnackbar('Failed to save vehicle', 'error');
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    try {
      setVehicles(prev => prev.filter(vehicle => vehicle.id !== vehicleId));
      showSnackbar('Vehicle deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      showSnackbar('Failed to delete vehicle', 'error');
    }
  };

  const handleVehicleMenuOpen = (event, vehicle) => {
    setVehicleMenuAnchor(event.currentTarget);
    setSelectedVehicleForMenu(vehicle);
  };

  const handleVehicleMenuClose = () => {
    setVehicleMenuAnchor(null);
    setSelectedVehicleForMenu(null);
  };

  const handleEditSelectedVehicle = () => {
    if (selectedVehicleForMenu) {
      handleEditVehicle(selectedVehicleForMenu);
    }
    handleVehicleMenuClose();
  };

  const handleDeleteSelectedVehicle = () => {
    if (selectedVehicleForMenu) {
      handleDeleteVehicle(selectedVehicleForMenu.id);
    }
    handleVehicleMenuClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Pre-auth validation — all checks before biometric/PIN prompt
    if (!formData.cus_id) {
      alert('Please select a customer');
      return;
    }

    if (purchaseType === 'new' && !formData.vehicle_no) {
      alert('Please select a vehicle');
      return;
    }

    if (purchaseType === 'return' && !selectedPurchaseForReturn) {
      alert('Please select a purchase to return');
      return;
    }

    if (formData.purchase_details.length === 0) {
      alert('Please add at least one product to the purchase');
      return;
    }

    if (parseFloat(formData.bank_payment || 0) > 0 && !selectedBankAccount) {
      alert('Please select a bank account for the bank payment');
      return;
    }

    if (parseFloat(formData.out_delivery_amount || 0) > 0 && (!selectedCargoAccounts || selectedCargoAccounts.length === 0)) {
      alert('select the cargo account first');
      return;
    }

    const hasCash = parseFloat(formData.cash_payment || 0) > 0;
    const hasBank = parseFloat(formData.bank_payment || 0) > 0;
    // Match sales: confirm when cash/bank is used, and always for purchase returns
    // (returns may have no cash/bank line but are still a sensitive action).
    if (purchaseSubmitInFlightRef.current || isSubmitting) {
      return;
    }
    purchaseSubmitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const needsStepUpAuth = hasCash || hasBank || purchaseType === 'return';
      if (needsStepUpAuth) {
        const authOk = await requireAuth();
        if (!authOk) return;
      }
      const url = editingPurchase ? '/api/purchases' : '/api/purchases';
      const method = editingPurchase ? 'PUT' : 'POST';

      // Calculate total amount from purchase details (Subtotal only)
      // NOTE: Backend calculates Net Total by adding charges to this amount.
      // So we must send the Subtotal here, NOT the Net Total.
      const calculatedTotalAmount = calculateTotalAmount();

      // debit_account_id / credit_account_id: inventory vs pay-from account hints for API (GL posts in purchases route)
      let debitAccountId = '';
      let creditAccountId = '';

      // Find inventory/stock account (assuming it's an ASSET_ACCOUNT type)
      const inventoryAccount = customers.find(customer =>
        customer.cus_type === 'ASSET_ACCOUNT' &&
        customer.cus_name.toLowerCase().includes('inventory')
      );

      if (inventoryAccount) {
        debitAccountId = inventoryAccount.cus_id;
      }

      // Calculate total payment amount
      const cashPayment = parseFloat(formData.cash_payment || 0);
      const bankPayment = parseFloat(formData.bank_payment || 0);
      const totalPayment = cashPayment + bankPayment;

      // Set payment type based on which payments are made
      let paymentType = 'CASH';
      if (cashPayment > 0 && bankPayment > 0) {
        paymentType = 'SPLIT';
      } else if (bankPayment > 0) {
        paymentType = 'BANK_TRANSFER';
      }

      // Set credit account based on payment type
      if (cashPayment > 0) {
        // If cash payment, credit cash account
        const cashAccount = customers.find(customer =>
          customer.cus_name === 'Cash Account'
        );
        console.log('🔍 Looking for cash account:', {
          allCustomers: customers.map(c => ({ id: c.cus_id, name: c.cus_name, type: c.cus_type })),
          cashCustomers: customers.filter(c => c.cus_name.toLowerCase().includes('cash')),
          foundCashAccount: cashAccount
        });
        creditAccountId = cashAccount ? cashAccount.cus_id : formData.cus_id;
      } else if (bankPayment > 0) {
        // If bank payment, use selected bank account
        creditAccountId = selectedBankAccount ? selectedBankAccount.cus_id : formData.cus_id;
      } else {
        // If no payment, credit supplier account (accounts payable)
        creditAccountId = formData.cus_id;
      }

      const body = editingPurchase
        ? {
          id: editingPurchase.pur_id,
          date: formData.date,
          created_at: editingPurchase.created_at,
          cus_id: formData.cus_id,
          store_id: formData.store_id,
          debit_account_id: debitAccountId,
          credit_account_id: creditAccountId,
          bank_account_id: selectedBankAccount ? selectedBankAccount.cus_id : null,
          cargo_account_id: (selectedCargoAccounts && selectedCargoAccounts.length)
            ? selectedCargoAccounts[0].cus_id
            : (formData.cargo_account_id ? parseInt(formData.cargo_account_id, 10) : null),
          cargo_account_ids: (selectedCargoAccounts || []).map((a) => a.cus_id),
          total_amount: calculatedTotalAmount.toString(),
          unloading_amount: formData.unloading_amount,
          fare_amount: formData.fare_amount,
          transport_amount: formData.transport_amount,
          labour_amount: formData.labour_amount,
          out_labour_amount: formData.out_labour_amount,
          out_delivery_amount: formData.out_delivery_amount,
          incity_own_labour: formData.incity_own_labour,
          incity_own_delivery: formData.incity_own_delivery,
          incity_charges_total: formData.incity_charges_total,
          include_incity: formData.include_incity,
          include_labour: formData.include_labour,
          include_cargo_in_costprice: formData.include_cargo_in_costprice,
          discount: formData.discount,
          payment: totalPayment,
          payment_type: paymentType,
          cash_payment: cashPayment,
          bank_payment: bankPayment,
          vehicle_no: formData.vehicle_no,
          invoice_number: formData.invoice_number,
          updated_by: currentUser?.user_id,
          purchase_details: slimPurchaseDetailsForApi(formData.purchase_details),
        }
        : {
          ...formData,
          total_amount: calculatedTotalAmount.toString(),
          debit_account_id: debitAccountId,
          credit_account_id: creditAccountId,
          bank_account_id: selectedBankAccount ? selectedBankAccount.cus_id : null,
          cargo_account_id: (selectedCargoAccounts && selectedCargoAccounts.length) ? selectedCargoAccounts[0].cus_id : (formData.cargo_account_id ? parseInt(formData.cargo_account_id) : null),
          cargo_account_ids: (selectedCargoAccounts || []).map(a => a.cus_id),
          payment: totalPayment,
          payment_type: paymentType,
          cash_payment: cashPayment,
          bank_payment: bankPayment,
          purchase_type: purchaseType,
          return_for_purchase_id: purchaseType === 'return' ? selectedPurchaseForReturn?.pur_id : null
        };

      console.log('🔍 Purchase API Request Body:', {
        payment_type: paymentType,
        credit_account_id: creditAccountId,
        bank_account_id: selectedBankAccount ? selectedBankAccount.cus_id : null,
        selectedBankAccount: selectedBankAccount,
        total_payment: totalPayment,
        cash_payment: cashPayment,
        bank_payment: bankPayment,
        cashAccountFound: customers.find(c => c.cus_name === 'Cash Account'),
        allCashAccounts: customers.filter(c => c.cus_name.toLowerCase().includes('cash'))
      });

      const supplier = customers.find(c => Number(c.cus_id) === Number(formData.cus_id));
      const localNetTotal = calculateNetTotal();
      const localBill = {
        ...formData,
        pur_id: editingPurchase?.pur_id ?? null,
        total_amount: calculatedTotalAmount,
        display_net_total: localNetTotal,
        cash_payment: cashPayment,
        bank_payment: bankPayment,
        payment: totalPayment,
        payment_type: paymentType,
        bank_title: selectedBankAccount?.cus_name || null,
        customer: supplier,
        purchase_details: formData.purchase_details,
        previous_customer_balance: parseFloat(supplier?.cus_balance ?? 0),
        bill_type: purchaseType === 'return' ? 'PURCHASE_RETURN' : 'PURCHASE',
        created_at: editingPurchase?.created_at || new Date().toISOString(),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        const wasEditing = !!editingPurchase;
        purchaseSubmitInFlightRef.current = false;
        setIsSubmitting(false);

        const mergePurchaseBill = (freshData) => {
          const freshProductTotal = (freshData.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || 0), 0)
            || parseFloat(freshData.total_amount || 0);
          const freshNetTotal = freshProductTotal
            + parseFloat(freshData.unloading_amount || 0)
            + parseFloat(freshData.transport_amount || 0)
            + parseFloat(freshData.labour_amount || 0)
            + parseFloat(freshData.fare_amount || 0)
            - parseFloat(freshData.discount || 0);

          let freshCashPayment = parseFloat(freshData.cash_payment || 0);
          let freshBankPayment = parseFloat(freshData.bank_payment || 0);
          if (freshCashPayment === 0 && freshBankPayment === 0 && parseFloat(freshData.payment || 0) > 0) {
            const totalPay = parseFloat(freshData.payment || 0);
            if (freshData.payment_type === 'BANK_TRANSFER') freshBankPayment = totalPay;
            else freshCashPayment = totalPay;
          }

          const resolvedPrevBalance = freshData.previous_customer_balance !== undefined && freshData.previous_customer_balance !== null
            ? parseFloat(freshData.previous_customer_balance)
            : (wasEditing && editingPurchase?.previous_customer_balance !== undefined && editingPurchase?.previous_customer_balance !== null
                ? parseFloat(editingPurchase.previous_customer_balance)
                : parseFloat(supplier?.cus_balance ?? 0));

          return {
            ...freshData,
            display_net_total: freshNetTotal,
            cash_payment: freshCashPayment,
            bank_payment: freshBankPayment,
            bank_title: selectedBankAccount?.cus_name || null,
            customer: freshData.customer || customers.find(c => c.cus_id === freshData.cus_id) || supplier,
            purchase_details: freshData.purchase_details || formData.purchase_details,
            previous_customer_balance: resolvedPrevBalance,
            bill_type: purchaseType === 'return' ? 'PURCHASE_RETURN' : 'PURCHASE',
          };
        };

        const finalMerged = mergePurchaseBill({
          ...result,
          purchase_details: result.purchase_details?.length
            ? result.purchase_details
            : formData.purchase_details,
          customer: result.customer || supplier,
        });

        setCurrentBillData(finalMerged);
        setReceiptDialogOpen(true);

        notifyLedgerDataChanged('purchase');

        const refreshReceiptFromServer = (purId) => {
          void (async () => {
            try {
              const freshResponse = await fetch(`/api/purchases?id=${purId}`);
              if (freshResponse.ok) {
                const freshData = await freshResponse.json();
                setCurrentBillData((prev) => (
                  prev?.pur_id === freshData.pur_id ? mergePurchaseBill({ ...prev, ...freshData }) : prev
                ));
              }
            } catch {
              /* local receipt is enough */
            }
          })();
        };

        if (wasEditing && result?.pur_id) {
          const { purchase_details: _lines, ...listHeader } = finalMerged;
          purchaseDetailCacheRef.current.set(result.pur_id, finalMerged);
          setPurchases((prev) => prev.map((p) => (p.pur_id === finalMerged.pur_id ? { ...p, ...listHeader } : p)));
          void refreshCustomersDropdown();
          setEditingPurchase(null);
          applyFreshPurchaseForm({ silent: true });
          refreshReceiptFromServer(result.pur_id);
          setSnackbar({
            open: true,
            message: `✅ Purchase #${result.pur_id} updated — invoice preview open`,
            severity: 'success',
          });
        } else if (!wasEditing && result?.pur_id) {
          const { purchase_details: _lines, ...listHeader } = finalMerged;
          setPurchases((prev) => {
            const without = prev.filter((p) => p.pur_id !== finalMerged.pur_id);
            return [{ ...listHeader, customer: supplier || finalMerged.customer }, ...without];
          });
          void refreshCustomersDropdown();
          applyFreshPurchaseForm({ silent: true });
          refreshReceiptFromServer(result.pur_id);
          setSnackbar({
            open: true,
            message: `✅ Purchase #${result.pur_id} saved — form cleared for next entry`,
            severity: 'success',
          });
        }

      } else {
        setReceiptDialogOpen(false);
        setCurrentBillData(null);
        const errorData = await response.json().catch(() => ({}));
        setSnackbar({
          open: true,
          message: errorData.error || 'Failed to save purchase',
          severity: 'error',
        });
      }
    } catch (error) {
      setReceiptDialogOpen(false);
      setCurrentBillData(null);
      console.error('Error saving purchase:', error);
      setSnackbar({ open: true, message: 'Failed to save purchase', severity: 'error' });
    } finally {
      purchaseSubmitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const applyPurchaseToForm = useCallback((purchase, customerRows = customers) => {
    let cashPayment = parseFloat(purchase.cash_payment || 0);
    let bankPayment = parseFloat(purchase.bank_payment || 0);

    if (cashPayment === 0 && bankPayment === 0 && parseFloat(purchase.payment || 0) > 0) {
      const totalPayment = parseFloat(purchase.payment || 0);
      if (purchase.payment_type === 'CASH') {
        cashPayment = totalPayment;
        bankPayment = 0;
      } else if (purchase.payment_type === 'BANK_TRANSFER') {
        cashPayment = 0;
        bankPayment = totalPayment;
      } else {
        cashPayment = totalPayment;
        bankPayment = 0;
      }
    }

    let purchaseDateStr = '';
    if (purchase.created_at) {
      const d = new Date(purchase.created_at);
      if (!isNaN(d.getTime())) {
        purchaseDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      }
    }

    setFormData({
      date: purchaseDateStr || getTodayDateStr(),
      cus_id: purchase.cus_id,
      store_id: purchase.store_id?.toString() || '',
      debit_account_id: purchase.debit_account_id || '',
      credit_account_id: purchase.credit_account_id || '',
      total_amount: purchase.total_amount?.toString() ?? '',
      unloading_amount: purchase.unloading_amount?.toString() ?? '',
      fare_amount: purchase.fare_amount?.toString() ?? '',
      transport_amount: purchase.transport_amount?.toString() || '',
      labour_amount: purchase.labour_amount?.toString() || '',
      out_labour_amount: purchase.out_labour_amount?.toString() || '',
      out_delivery_amount: purchase.out_delivery_amount?.toString() || '',
      incity_own_labour: purchase.incity_own_labour?.toString() || '',
      incity_own_delivery: purchase.incity_own_delivery?.toString() || '',
      incity_charges_total: purchase.incity_charges_total?.toString() || '',
      include_incity: purchase.include_incity || false,
      include_labour: purchase.include_labour || false,
      include_cargo_in_costprice: purchase.include_cargo_in_costprice || false,
      discount: purchase.discount?.toString() ?? '',
      cash_payment: cashPayment > 0 ? cashPayment.toString() : '',
      bank_payment: bankPayment > 0 ? bankPayment.toString() : '',
      payment_type: (cashPayment > 0 && bankPayment > 0) ? 'SPLIT' : purchase.payment_type,
      vehicle_no: purchase.vehicle_no || '',
      invoice_number: purchase.invoice_number || '',
      purchase_details: (purchase.purchase_details || []).map((detail) => ({
        ...detail,
        store_id: detail.store_id || purchase.store_id?.toString() || '',
      })),
    });

    const bankAccountIdToFind = purchase.bank_account_id || (purchase.payment_type === 'BANK_TRANSFER' ? purchase.credit_account_id : null);
    if (bankAccountIdToFind) {
      const bankAccount = customerRows.find((customer) => customer.cus_id === bankAccountIdToFind);
      setSelectedBankAccount(bankAccount || null);
    } else {
      setSelectedBankAccount(null);
    }

    if (purchase.cargo_account_ids) {
      try {
        const ids = Array.isArray(purchase.cargo_account_ids)
          ? purchase.cargo_account_ids
          : JSON.parse(purchase.cargo_account_ids || '[]');
        const selected = (ids || [])
          .map((id) => customerRows.find((c) => c.cus_id === parseInt(id, 10)))
          .filter(Boolean);
        setSelectedCargoAccounts(selected);
      } catch {
        const cargoAcc = customerRows.find((customer) => customer.cus_id === purchase.cargo_account_id);
        setSelectedCargoAccounts(cargoAcc ? [cargoAcc] : []);
      }
    } else if (purchase.cargo_account_id) {
      const cargoAcc = customerRows.find((customer) => customer.cus_id === purchase.cargo_account_id);
      setSelectedCargoAccounts(cargoAcc ? [cargoAcc] : []);
    } else {
      setSelectedCargoAccounts([]);
    }

    const customer = customerRows.find((c) => c.cus_id === purchase.cus_id);
    setFormSelectedCustomer(customer || purchase.customer || null);
    setCustomerSearchTerm(customer?.cus_name || purchase.customer?.cus_name || '');
  }, [customers]);

  const handleEdit = async (purchase) => {
    setCurrentView('create');
    setEditPurchaseLoading(true);
    try {
      await ensureFormLookups();
      let full = purchaseDetailCacheRef.current.get(purchase.pur_id);
      if (!full) {
        const res = await fetch(`/api/purchases?id=${purchase.pur_id}`);
        if (res.ok) {
          full = await res.json();
          purchaseDetailCacheRef.current.set(full.pur_id, full);
        } else {
          full = purchase;
        }
      }
      setEditingPurchase(full);
      applyPurchaseToForm(full);
    } catch (error) {
      console.error('Error loading purchase for edit:', error);
      setSnackbar({
        open: true,
        message: 'Could not load purchase for edit',
        severity: 'error',
      });
      setCurrentView('list');
    } finally {
      setEditPurchaseLoading(false);
    }
  };

  const handleViewPurchase = async (purchase) => {
    // Fetch canonical purchase data from server (includes previous_customer_balance)
    let purchaseData = purchase;

    try {
      const res = await fetch(`/api/purchases?id=${purchase.pur_id}`);
      if (res.ok) {
        purchaseData = await res.json();
      } else {
        console.warn('Could not fetch fresh purchase data, falling back to list item', res.status);
      }
    } catch (err) {
      console.warn('Error fetching purchase details:', err.message);
    }

    console.log('📊 Viewing Purchase Data (source):', { pur_id: purchaseData.pur_id, source: purchaseData === purchase ? 'list' : 'api' });

    // Calculate actual net total including all charges for display
    const productTotal = (purchaseData.purchase_details || []).reduce((sum, detail) =>
      sum + parseFloat(detail.total_amount || 0), 0) || parseFloat(purchaseData.total_amount || 0);
    const calculatedNetTotal = productTotal +
      parseFloat(purchaseData.unloading_amount || 0) +
      parseFloat(purchaseData.transport_amount || 0) +
      parseFloat(purchaseData.labour_amount || 0) +
      parseFloat(purchaseData.fare_amount || 0) -
      parseFloat(purchaseData.discount || 0);

    // Use database values if available, otherwise calculate based on payment_type
    let cashPayment = parseFloat(purchaseData.cash_payment || 0);
    let bankPayment = parseFloat(purchaseData.bank_payment || 0);

    // Fallback logic for older records without cash_payment/bank_payment fields
    if (cashPayment === 0 && bankPayment === 0 && parseFloat(purchaseData.payment || 0) > 0) {
      const totalPayment = parseFloat(purchaseData.payment || 0);
      if (purchaseData.payment_type === 'CASH') {
        cashPayment = totalPayment;
        bankPayment = 0;
      } else if (purchaseData.payment_type === 'BANK_TRANSFER') {
        cashPayment = 0;
        bankPayment = totalPayment;
      } else {
        cashPayment = totalPayment;
        bankPayment = 0;
      }
    }

    const enhancedPurchase = {
      ...purchaseData,
      // Use calculated net total for accurate display
      display_net_total: calculatedNetTotal,
      // Use calculated or database payment values
      cash_payment: cashPayment,
      bank_payment: bankPayment
    };

    // Set viewingPurchase (the invoice UI will now use previous_customer_balance when available)
    setViewingPurchase(enhancedPurchase);
    setViewDialogOpen(true);
  };

  const handleOpenCustomerLedger = (purchase, e) => {
    if (e) e.stopPropagation();
    const cusId = purchase?.cus_id ?? purchase?.customer?.cus_id;
    const cusName = purchase?.customer?.cus_name;
    if (!cusId) {
      setSnackbar({ open: true, message: 'Customer not found for this purchase', severity: 'error' });
      return;
    }
    openAccountLedgerTab(cusId, cusName);
    router.push(FINANCE_LEDGER_PATH);
  };

  // Handle purchase search for returns - filter by selected supplier
  const handlePurchaseSearch = (searchValue) => {
    // If no supplier selected, don't search
    if (!formSelectedCustomer) {
      setPurchaseSearchResults([]);
      return;
    }

    if (!searchValue || searchValue.trim() === '') {
      // Show all purchases from the selected supplier if search is empty
      const supplierPurchases = purchases.filter(purchase => purchase.cus_id === formSelectedCustomer.cus_id);
      setPurchaseSearchResults(supplierPurchases);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    // Filter purchases by selected supplier AND search term
    const results = purchases.filter(purchase => {
      // Only show purchases from selected supplier
      if (purchase.cus_id !== formSelectedCustomer.cus_id) {
        return false;
      }
      // Then filter by search term
      return (
        purchase.invoice_number?.toLowerCase().includes(searchLower) ||
        purchase.pur_id?.toString().includes(searchLower)
      );
    });

    setPurchaseSearchResults(results);
  };

  // Handle loading purchase data for return
  const handleLoadPurchaseForReturn = (purchase) => {
    console.log('📦 Loading purchase for return:', purchase);

    // Set the selected purchase
    setSelectedPurchaseForReturn(purchase);

    // Load purchase data into form
    const customer = customers.find(c => c.cus_id === purchase.cus_id);
    setFormSelectedCustomer(customer || null);

    // Load all purchase details
    setFormData(prev => ({
      ...prev,
      cus_id: purchase.cus_id,
      store_id: purchase.store_id?.toString() || '',
      total_amount: purchase.total_amount.toString(),
      unloading_amount: purchase.unloading_amount.toString(),
      fare_amount: purchase.fare_amount.toString(),
      transport_amount: purchase.transport_amount?.toString() || '',
      labour_amount: purchase.labour_amount?.toString() || '',
      out_labour_amount: purchase.out_labour_amount?.toString() || '',
      out_delivery_amount: purchase.out_delivery_amount?.toString() || '',
      incity_own_labour: purchase.incity_own_labour?.toString() || '',
      incity_own_delivery: purchase.incity_own_delivery?.toString() || '',
      incity_charges_total: purchase.incity_charges_total?.toString() || '',
      include_incity: purchase.include_incity || false,
      include_labour: purchase.include_labour || false,
      include_cargo_in_costprice: purchase.include_cargo_in_costprice || false,
      discount: purchase.discount.toString(),
      vehicle_no: purchase.vehicle_no || '',
      purchase_details: purchase.purchase_details?.map(detail => ({
        ...detail,
        // For return, negate the quantity
        qnty: detail.qnty
      })) || []
    }));

    // Close search
    setPurchaseSearchOpen(false);
    setPurchaseSearchResults([]);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setViewingPurchase(null);
  };

  const handlePrintViewReceipt = (mode = PURCHASE_SHEET_PRINT_MODE) => {
    try {
      const isThermal = mode === 'THERMAL';
      const className = isThermal ? 'print-thermal-view' : 'print-a4-view';
      const containerId = isThermal ? 'printable-invoice-thermal-view' : 'printable-invoice-a4-view';
      const printableContainer = document.getElementById(containerId);
      if (!printableContainer) return;
      const styleId = 'dynamic-print-style-view';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }

      if (!isThermal && viewingPurchase) {
        mountPurchasePrintHtml(buildPurchaseA4PrintHtml(viewingPurchase, purchasePrintCtx));
        styleEl.textContent = `@media print { @page { size: ${PURCHASE_INVOICE_PAGE_AT_PAGE}; margin: 0.5cm 1cm; } } ${PURCHASE_SHEET_PRINT_HIDE_CSS}`;
        document.body.classList.add('purchase-sheet-print');
      } else {
        const preview = document.getElementById('purchase-invoice');
        if (preview) printableContainer.innerHTML = preview.innerHTML;
        printableContainer.style.position = 'fixed';
        printableContainer.style.left = '0'; printableContainer.style.top = '0';
        printableContainer.style.display = 'block'; printableContainer.style.zIndex = '9999';
        printableContainer.style.backgroundColor = 'white';
        styleEl.textContent = isThermal
          ? `@media print { @page { size: 80mm portrait; margin: 0; } }`
          : `@media print { @page { size: ${PURCHASE_INVOICE_PAGE_AT_PAGE}; margin: 0.5cm 1cm; } }`;
        document.body.classList.add(className);
      }

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          if (!isThermal && viewingPurchase) {
            removePurchasePrintMount();
            document.body.classList.remove('purchase-sheet-print');
          } else {
            printableContainer.style.position = ''; printableContainer.style.left = ''; printableContainer.style.top = '';
            printableContainer.style.display = 'none'; printableContainer.style.zIndex = ''; printableContainer.style.backgroundColor = '';
            document.body.classList.remove('print-thermal-view'); document.body.classList.remove('print-a4-view');
          }
          if (styleEl) styleEl.remove();
        }, 100);
      }, 100);
    } catch (e) { console.error(e); window.print(); }
  };

  // Handle adding customer category
  const handleAddCustomerCategory = async (e) => {
    e?.preventDefault();
    setIsAddingCustomerCategory(true);
    try {
      const response = await fetch('/api/customer-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerCategoryFormData)
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCustomerCategories(prev => [...prev, newCategory]);
        setShowCustomerCategoryPopup(false);
        setCustomerCategoryFormData({ cus_cat_title: '' });
        showSnackbar('Account category added successfully!', 'success');
      } else {
        showSnackbar('Failed to add account category', 'error');
      }
    } catch (error) {
      console.error('Error adding account category:', error);
      showSnackbar('Error adding account category', 'error');
    } finally {
      setIsAddingCustomerCategory(false);
    }
  };

  // Handle adding product quickly from purchase page
  const handleAddProductQuick = async (e) => {
    e?.preventDefault();
    if (!addProductFormData.pro_title.trim()) { showSnackbar('Product title is required', 'error'); return; }
    if (!addProductFormData.cat_id) { showSnackbar('Category is required', 'error'); return; }
    if (!addProductFormData.sub_cat_id) { showSnackbar('Subcategory is required', 'error'); return; }
    setIsAddingProduct(true);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addProductFormData)
      });
      if (response.ok) {
        const newProduct = await response.json();
        setProducts(prev => [newProduct, ...prev]);
        setShowAddProductPopup(false);
        setAddProductFormData({ pro_title: '', pro_description: '', cat_id: '', sub_cat_id: '', pro_crate: '', pro_sale_price: '', pro_baser_price: '', pro_cost_price: '', pro_stock_qnty: '', pro_unit: '', pro_packing: '', low_stock_quantity: '10' });
        setProductCatInput('');
        setProductSubCatInput('');
        showSnackbar('Product added successfully!', 'success');
      } else {
        const err = await response.json();
        showSnackbar(err.error || 'Failed to add product', 'error');
      }
    } catch (error) {
      showSnackbar('Error adding product', 'error');
    } finally {
      setIsAddingProduct(false);
    }
  };

  // Handle adding product category quickly
  const handleAddProductCategory = async (e) => {
    e?.preventDefault();
    if (!addProductCategoryName.trim()) { showSnackbar('Category name is required', 'error'); return; }
    setIsAddingProductCategory(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_name: addProductCategoryName.trim() })
      });
      if (response.ok) {
        const newCat = await response.json();
        setCategories(prev => [...prev, newCat]);
        setShowAddProductCategoryPopup(false);
        setAddProductCategoryName('');
        showSnackbar('Product category added!', 'success');
      } else {
        const err = await response.json();
        showSnackbar(err.error || 'Failed to add category', 'error');
      }
    } catch { showSnackbar('Error adding category', 'error'); }
    finally { setIsAddingProductCategory(false); }
  };

  // Handle adding product subcategory quickly
  const handleAddProductSubCategory = async (e) => {
    e?.preventDefault();
    if (!addProductSubCategoryFormData.sub_cat_name.trim()) { showSnackbar('Subcategory name is required', 'error'); return; }
    if (!addProductSubCategoryFormData.cat_id) { showSnackbar('Please select a category', 'error'); return; }
    setIsAddingProductSubCategory(true);
    try {
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addProductSubCategoryFormData)
      });
      if (response.ok) {
        const newSub = await response.json();
        setSubcategories(prev => [...prev, newSub]);
        setShowAddProductSubCategoryPopup(false);
        setAddProductSubCategoryFormData({ sub_cat_name: '', cat_id: '' });
        showSnackbar('Product subcategory added!', 'success');
      } else {
        const err = await response.json();
        showSnackbar(err.error || 'Failed to add subcategory', 'error');
      }
    } catch { showSnackbar('Error adding subcategory', 'error'); }
    finally { setIsAddingProductSubCategory(false); }
  };

  // Handle adding customer type
  const handleAddCustomerType = async (e) => {
    e?.preventDefault();
    setIsAddingCustomerType(true);
    try {
      const response = await fetch('/api/customer-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerTypeFormData)
      });

      if (response.ok) {
        const newCustomerType = await response.json();
        setCustomerTypes(prev => [...prev, newCustomerType]);
        setShowCustomerTypePopup(false);
        setCustomerTypeFormData({ cus_type_title: '' });
        showSnackbar('Account type added successfully!', 'success');
      } else {
        const error = await response.json();
        showSnackbar(error.error || 'Failed to create account type', 'error');
      }
    } catch (error) {
      console.error('Error creating account type:', error);
      showSnackbar('Error creating account type', 'error');
    } finally {
      setIsAddingCustomerType(false);
    }
  };

  // Handle adding city
  const handleAddCity = async (e) => {
    e?.preventDefault();
    setIsAddingCity(true);
    try {
      const response = await fetch('/api/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cityFormData)
      });

      if (response.ok) {
        const newCity = await response.json();
        setCities(prev => [...prev, newCity]);
        setShowCityPopup(false);
        setCityFormData({ city_name: '' });
        showSnackbar('City added successfully!', 'success');
      } else {
        const error = await response.json();
        showSnackbar(error.error || 'Failed to create city', 'error');
      }
    } catch (error) {
      console.error('Error creating city:', error);
      showSnackbar('Error creating city', 'error');
    } finally {
      setIsAddingCity(false);
    }
  };

  const handleDelete = async (purchaseId) => {
    if (window.confirm('Are you sure you want to delete this purchase?')) {
      try {
        const response = await fetch(`/api/purchases?id=${purchaseId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchPurchaseList();
        }
      } catch (error) {
        console.error('Error deleting purchase:', error);
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCustomer('');
    setSortBy('created_at');
    setSortOrder('desc');
    setDateFrom('');
    setDateTo('');
    setFilterStore('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterPaymentType('');
    setListPage(1);
  };

  const handlePrintPurchaseList = () => {
    if (!sortedPurchases.length) {
      showSnackbar('No purchases to print.', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      showSnackbar('Pop-up blocked. Allow pop-ups to print the list.', 'error');
      return;
    }
    const rows = sortedPurchases.map((p) => `
      <tr>
        <td>#${p.pur_id}</td>
        <td>${(p.customer?.cus_name || 'N/A').replace(/</g, '&lt;')}</td>
        <td align="right">${Number(p.net_total || 0).toLocaleString()}</td>
        <td>${p.payment_type || ''}</td>
        <td>${p.vehicle_no || ''}</td>
        <td>${formatDatePK(p.created_at) || ''}</td>
      </tr>`).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Purchases List</title>
      <style>body{font-family:Arial,sans-serif;padding:16px}table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px}th{background:#dce6f1}</style></head><body>
      <h2>Purchases List</h2><p>${sortedPurchases.length} record(s)</p>
      <table><thead><tr><th>ID</th><th>Supplier</th><th>Net Total</th><th>Payment</th><th>Vehicle</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Customer form handlers
  const handleCustomerFormChange = (e) => {
    const { name, value } = e.target;
    setCustomerFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddCustomer = async () => {
    // Validation
    if (!customerFormData.cus_name.trim()) {
      setSnackbar({
        open: true,
        message: 'Supplier name is required',
        severity: 'error'
      });
      return;
    }
    if (!customerFormData.cus_phone_no.trim()) {
      setSnackbar({
        open: true,
        message: 'Phone number is required',
        severity: 'error'
      });
      return;
    }
    if (!customerFormData.cus_address.trim()) {
      setSnackbar({
        open: true,
        message: 'Address is required',
        severity: 'error'
      });
      return;
    }
    if (!customerFormData.cus_category) {
      setSnackbar({
        open: true,
        message: 'Supplier category is required',
        severity: 'error'
      });
      return;
    }
    if (!customerFormData.cus_type) {
      setSnackbar({
        open: true,
        message: 'Supplier type is required',
        severity: 'error'
      });
      return;
    }
    if (!customerFormData.city_id) {
      setSnackbar({
        open: true,
        message: 'City is required',
        severity: 'error'
      });
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cus_name: customerFormData.cus_name,
          cus_phone_no: customerFormData.cus_phone_no,
          cus_phone_no2: customerFormData.cus_phone_no2 || '',
          cus_address: customerFormData.cus_address,
          cus_reference: customerFormData.cus_reference || '',
          cus_account_info: customerFormData.cus_account_info || '',
          other: customerFormData.other || '',
          cus_type: customerFormData.cus_type,
          cus_category: customerFormData.cus_category,
          cus_balance: parseFloat(customerFormData.cus_balance || 0),
          CNIC: customerFormData.CNIC || '',
          NTN_NO: customerFormData.NTN_NO || '',
          name_urdu: customerFormData.name_urdu || '',
          city_id: customerFormData.city_id
        })
      });

      if (response.ok) {
        const newCustomer = await response.json();
        setSnackbar({
          open: true,
          message: 'Supplier added successfully',
          severity: 'success'
        });
        setCustomerFormData({
          cus_name: '',
          cus_phone_no: '',
          cus_phone_no2: '',
          cus_address: '',
          cus_reference: '',
          cus_account_info: '',
          other: '',
          cus_type: '',
          cus_category: '',
          cus_balance: 0,
          CNIC: '',
          NTN_NO: '',
          name_urdu: '',
          city_id: ''
        });
        setShowCustomerForm(false);
        await refreshCustomersDropdown();
      } else {
        setSnackbar({
          open: true,
          message: 'Error adding supplier',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error adding supplier:', error);
      setSnackbar({
        open: true,
        message: 'Error adding supplier',
        severity: 'error'
      });
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleCloseCustomerForm = () => {
    setShowCustomerForm(false);
    setCustomerFormData({
      cus_name: '',
      cus_phone_no: '',
      cus_phone_no2: '',
      cus_address: '',
      cus_reference: '',
      cus_account_info: '',
      other: '',
      cus_type: '',
      cus_category: '',
      cus_balance: 0,
      CNIC: '',
      NTN_NO: '',
      name_urdu: '',
      city_id: ''
    });
  };


  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Helper function to show snackbar messages
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Render Purchase List View
  const renderPurchaseListView = () => (
    <DashboardLayout>
      {listLoading && <LinearProgress sx={{ position: 'sticky', top: 0, zIndex: 10 }} />}
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Stack spacing={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', py: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setCurrentView('create');
                void ensureFormLookups();
                void ensureCatalogLookups();
              }}
              size="large"
              sx={{
                background: `linear-gradient(180deg, ${BRAND.primary.blue} 0%, #1347c4 100%)`,
                boxShadow: '0 8px 24px rgba(26, 85, 227, 0.28)',
                px: 6,
                py: 2.5,
                fontSize: '1.3rem',
                fontWeight: 'bold',
                borderRadius: '16px',
                minWidth: '320px',
                minHeight: '70px',
                textTransform: 'none',
                transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease',
                '&:hover': {
                  background: 'linear-gradient(180deg, #2563eb 0%, #1347c4 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 28px rgba(26, 85, 227, 0.36)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 6px 16px rgba(26, 85, 227, 0.28)',
                },
              }}
            >
              Add New Purchase
            </Button>
          </Box>



          {/* Unified Professional Stats Bar */}
          <Box sx={{ flexShrink: 0, mb: 3, width: '100%' }}>
            <Card sx={{
              borderRadius: 2,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              bgcolor: 'white',
              border: '1px solid #e5e7eb'
            }}>
              <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: 'stretch',
                justifyContent: 'space-between',
                p: 0
              }}>
                {[
                  { title: 'Total Purchases', val: totalPurchases, color: '#2563eb', bg: '#eff6ff', icon: <ShoppingCartIcon /> },
                  { title: 'Total Value', val: totalPurchaseValue, color: '#16a34a', bg: '#f0fdf4', icon: <TrendingUpIcon /> },
                  { title: 'Unloading Amount', val: totalUnloadingAmount, color: '#dc2626', bg: '#fef2f2', icon: <TruckIcon /> },
                  { title: 'Fare Amount', val: totalFareAmount, color: '#d97706', bg: '#fffbeb', icon: <MoneyIcon /> }
                ].map((stat, i) => (
                  <Box key={i} sx={{
                    flex: 1,
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2.5,
                    width: '100%',
                    bgcolor: stat.bg,
                    position: 'relative',
                    borderBottom: i < 3 && { xs: '1px solid #e5e7eb', md: 'none' },
                    '&:hover': {
                      bgcolor: 'white',
                      transition: 'background-color 0.3s'
                    }
                  }}>
                    <Avatar sx={{
                      bgcolor: 'white',
                      color: stat.color,
                      width: 52,
                      height: 52,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      border: `1.5px solid ${stat.color}20`
                    }}>
                      {stat.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="overline" sx={{
                        display: 'block',
                        lineHeight: 1,
                        mb: 0.5,
                        color: '#6b7280',
                        fontWeight: 700,
                        letterSpacing: 1.2
                      }}>
                        {stat.title}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5, color: stat.color }}>
                        {i > 0 && <span style={{ fontSize: '0.8rem', marginRight: 4, opacity: 0.6 }}>PKR</span>}
                        {fmtAmt(stat.val)}
                      </Typography>
                    </Box>
                    {i < 3 && (
                      <Divider
                        orientation="vertical"
                        flexItem
                        sx={{
                          display: { xs: 'none', md: 'block' },
                          bgcolor: '#e5e7eb',
                          height: 60,
                          position: 'absolute',
                          right: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          zIndex: 1
                        }}
                      />
                    )}
                  </Box>
                ))}
              </Box>
            </Card>
          </Box>

          <Card sx={{ ...PURCHASE_PAGE_CARD_SX, mb: 3 }}>
            <Box sx={{
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              borderBottom: '1px solid #e2e8f0',
              bgcolor: '#fff',
            }}>
              <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterListIcon sx={{ color: BRAND.primary.blue, fontSize: 20 }} />
                Filters & Sorting
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                <Chip
                  size="small"
                  label={`${listTotal} of ${purchases.length}`}
                  sx={{
                    bgcolor: BRAND.tint.blue,
                    color: BRAND.primary.blue,
                    fontWeight: 700,
                    height: 32,
                    fontSize: '0.8125rem',
                    borderRadius: '8px',
                  }}
                />
                <Button
                  onClick={handlePrintPurchaseList}
                  size="small"
                  variant="contained"
                  startIcon={<PrintIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: BRAND.primary.blue,
                    borderRadius: '8px',
                    height: 32,
                    px: 1.5,
                    '&:hover': { bgcolor: '#1347c4' },
                  }}
                >
                  Print List
                </Button>
                <Button
                  onClick={clearFilters}
                  size="small"
                  variant="outlined"
                  startIcon={<ClearIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#64748b',
                    borderColor: '#cbd5e1',
                    borderRadius: '8px',
                    height: 32,
                    px: 1.5,
                    '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafbfc' }}>
              <Box sx={PURCHASE_FILTER_GRID}>
                <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Purchases"
                    placeholder="ID, Supplier, Reference, or Vehicle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={PURCHASE_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customers.filter((customer) =>
                      customer.customer_category?.cus_cat_title?.toLowerCase().includes('supplier')
                    )}
                    getOptionLabel={(option) => option.cus_name || ''}
                    value={customers.find((c) => c.cus_id === selectedCustomer) || null}
                    onChange={(event, newValue) => setSelectedCustomer(newValue ? newValue.cus_id : '')}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Supplier"
                        placeholder="All Suppliers"
                        onFocus={(e) => e.target.select()}
                        sx={PURCHASE_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={stores}
                    getOptionLabel={(option) => option.store_name || ''}
                    value={stores.find((s) => s.storeid.toString() === filterStore) || null}
                    onChange={(event, newValue) => setFilterStore(newValue ? newValue.storeid.toString() : '')}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Store"
                        placeholder="All Stores"
                        onFocus={(e) => e.target.select()}
                        sx={PURCHASE_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <DateFilterInput
                    fullWidth
                    size="small"
                    label="From Date"
                    value={dateFrom}
                    onChange={(val) => setDateFrom(val)}
                    sx={PURCHASE_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <DateFilterInput
                    fullWidth
                    size="small"
                    label="To Date"
                    value={dateTo}
                    onChange={(val) => setDateTo(val)}
                    sx={PURCHASE_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Amount"
                    type="number"
                    placeholder="e.g. 1000"
                    value={filterMinAmount}
                    onChange={(e) => setFilterMinAmount(e.target.value)}
                    sx={PURCHASE_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max Amount"
                    type="number"
                    placeholder="e.g. 50000"
                    value={filterMaxAmount}
                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                    sx={PURCHASE_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={PURCHASE_FILTER_FIELD_SX}>
                    <InputLabel>Payment Type</InputLabel>
                    <Select
                      value={filterPaymentType}
                      onChange={(e) => setFilterPaymentType(e.target.value)}
                      label="Payment Type"
                    >
                      <MenuItem value="">All Types</MenuItem>
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="BANK">Bank</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'created_at-desc', label: 'Newest First' },
                      { value: 'created_at-asc', label: 'Oldest First' },
                      { value: 'customer-asc', label: 'Supplier A-Z' },
                      { value: 'customer-desc', label: 'Supplier Z-A' },
                      { value: 'net_total-desc', label: 'Amount High-Low' },
                      { value: 'net_total-asc', label: 'Amount Low-High' },
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{ value: `${sortBy}-${sortOrder}`, label: getSortLabel(`${sortBy}-${sortOrder}`) }}
                    onChange={(event, newValue) => {
                      if (newValue) {
                        const [field, order] = newValue.value.split('-');
                        setSortBy(field);
                        setSortOrder(order);
                      }
                    }}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Sort By"
                        placeholder="Select..."
                        sx={PURCHASE_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{
              px: { xs: 1.5, md: 2 },
              py: 1.25,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #cbd5e1',
              bgcolor: '#f1f5f9',
            }}>
              <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                Purchases List
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                {listTotal === 0
                  ? '0 rows'
                  : `${((listPage - 1) * listPageSize) + 1}–${Math.min(listPage * listPageSize, listTotal)} of ${listTotal}`}
              </Typography>
            </Box>

            <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', bgcolor: '#fff', maxHeight: 'calc(100vh - 320px)' }}>
              <Table stickyHeader sx={PURCHASE_EXCEL_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'Purchase ID', align: 'left' },
                      { label: 'Supplier', align: 'left' },
                      { label: 'Net Total', align: 'right' },
                      { label: 'Total / Unload / Fare', align: 'left' },
                      { label: 'Payment', align: 'right' },
                      { label: 'Type', align: 'center' },
                      { label: 'Vehicle', align: 'left' },
                      { label: 'Date', align: 'center' },
                      { label: 'Updated By', align: 'left' },
                      { label: 'Actions', align: 'center' },
                    ].map((col) => (
                      <TableCell key={col.label} align={col.align} sx={PURCHASE_EXCEL_HEAD_SX}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading && paginatedPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6, border: '1px solid #cbd5e1' }}>
                        <CircularProgress size={36} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem', mt: 1.5 }}>
                          Loading purchases…
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : listTotal === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 6, border: '1px solid #cbd5e1' }}>
                        <ShoppingCartIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>
                          {purchases.length === 0 ? 'No purchases found' : 'No purchases match your filters'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                          {purchases.length === 0 ? 'Create your first purchase to get started.' : 'Try adjusting your filter criteria.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPurchases.map((purchase, rowIndex) => (
                        <TableRow
                          key={purchase.pur_id}
                          onClick={() => handleOpenCustomerLedger(purchase)}
                          sx={{
                            bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                            '&:hover': { bgcolor: '#eff6ff' },
                            cursor: 'pointer',
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, color: BRAND.primary.blue, whiteSpace: 'nowrap' }}>
                            #{purchase.pur_id}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box>{purchase.customer?.cus_name || 'N/A'}</Box>
                            <Typography component="span" sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {purchase.customer?.cus_phone_no || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ ...PURCHASE_NUM_CELL_SX, fontWeight: 700, color: '#1e293b' }}>
                            {fmtAmt(purchase.net_total)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: '#64748b', maxWidth: 200 }}>
                            T: {fmtAmt(purchase.total_amount)} · U: {fmtAmt(purchase.unloading_amount)} · F: {fmtAmt(purchase.fare_amount)}
                            {parseFloat(purchase.discount || 0) > 0 && (
                              <Box component="span" sx={{ display: 'block', color: BRAND.primary.pink, fontWeight: 600 }}>
                                Disc: -{fmtAmt(purchase.discount)}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ ...PURCHASE_NUM_CELL_SX, fontWeight: 600, color: BRAND.text.green }}>
                            {fmtAmt(purchase.payment)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={purchase.payment_type || '—'}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                bgcolor: '#f1f5f9',
                                color: '#475569',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {purchase.vehicle_no || '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDatePK(purchase?.created_at) || '—'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {purchase.updated_by_user?.full_name || '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ p: 0.4, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <Stack direction="row" spacing={0} justifyContent="center" flexWrap="nowrap">
                              <Tooltip title="View Details">
                                <IconButton size="small" color="primary" onClick={() => handleViewPurchase(purchase)} sx={{ p: 0.4 }}>
                                  <EyeIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Purchase">
                                <IconButton
                                  size="small"
                                  sx={{ color: '#f59e0b', p: 0.4 }}
                                  onMouseEnter={() => prefetchPurchaseForEdit(purchase.pur_id)}
                                  onClick={() => handleEdit(purchase)}
                                >
                                  <EditIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDelete(purchase.pur_id)} sx={{ p: 0.4 }}>
                                  <DeleteIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{
              borderTop: '1px solid #e2e8f0',
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
              bgcolor: '#f8fafc',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <FormControl variant="outlined" size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="purchase-rows-per-page-label">Rows per page</InputLabel>
                  <Select
                    labelId="purchase-rows-per-page-label"
                    value={listPageSize}
                    onChange={(e) => setListPageSize(parseInt(e.target.value, 10))}
                    label="Rows per page"
                  >
                    <MenuItem value={10}>10 per page</MenuItem>
                    <MenuItem value={25}>25 per page</MenuItem>
                    <MenuItem value={50}>50 per page</MenuItem>
                    <MenuItem value={100}>100 per page</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {paginatedPurchases.length} on this page · {listTotal} total
                </Typography>
              </Box>
              <Pagination
                count={Math.max(1, Math.ceil(listTotal / listPageSize))}
                page={listPage}
                onChange={(_, value) => setListPage(value)}
                color="primary"
                shape="rounded"
                size="medium"
                showFirstButton
                showLastButton
              />
            </Box>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  // Render Purchase Create View
  const renderPurchaseCreateView = () => (
    <DashboardLayout>
      {(editPurchaseLoading || (formLookupsLoading && customers.length === 0)) && (
        <LinearProgress sx={{ position: 'sticky', top: 0, zIndex: 20 }} />
      )}
      <Container maxWidth={false} disableGutters sx={{ py: 1, px: { xs: 0, sm: 1 } }}>
        <Stack spacing={2} sx={{ width: '100%', pb: 4 }}>
        {/* Header */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => {
                  setCurrentView('list');
                  setPurchaseType('new');
                  setSelectedPurchaseForReturn(null);
                }}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ArrowLeftIcon />
              </button>
              <div>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingPurchase
                      ? 'Edit Purchase'
                      : purchaseType === 'return'
                        ? 'Create Purchase Return'
                        : 'Create New Purchase'}
                  </h2>
                  {hasDraft && !editingPurchase && (
                    <Chip
                      label="Draft Saved"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                    />
                  )}
                </Box>
                <p className="text-gray-600 mt-1">
                  {editingPurchase
                    ? 'Update purchase information'
                    : purchaseType === 'return'
                      ? 'Return items from an existing purchase'
                      : 'Select products and create purchase order'}
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Quick actions toolbar */}
          <Box sx={{ ...PURCHASE_PAGE_CARD_SX, px: { xs: 1.5, md: 2 }, py: 1.25 }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              alignItems: { xs: 'stretch', lg: 'center' },
              gap: { xs: 1.5, lg: 2 },
            }}>
              <Typography sx={{
                fontWeight: 700,
                fontSize: '0.9375rem',
                color: '#1e293b',
                whiteSpace: 'nowrap',
                minWidth: { lg: 140 },
                flexShrink: 0,
              }}>
                {purchaseType === 'return' && selectedPurchaseForReturn
                  ? `Return #${selectedPurchaseForReturn.pur_id}`
                  : 'Purchase entry'}
              </Typography>

              {purchaseType === 'new' && (
                <>
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    useFlexGap
                    spacing={0}
                    sx={{
                      flex: 1,
                      gap: 1,
                      justifyContent: { xs: 'flex-start', lg: 'center' },
                      alignItems: 'center',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                      onClick={() => openCustomerForm('supplier')}
                      sx={PURCHASE_TOOLBAR_BTN_PRIMARY_SX}
                    >
                      New Supplier
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PackageIcon sx={{ fontSize: 18 }} />}
                      onClick={() => {
                        void ensureCatalogLookups();
                        setShowAddProductPopup(true);
                      }}
                      sx={PURCHASE_TOOLBAR_BTN_ADD_PRODUCT_SX}
                    >
                      Add Product
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FolderIcon sx={{ fontSize: 18 }} />}
                      onClick={() => setShowAddProductCategoryPopup(true)}
                      sx={PURCHASE_TOOLBAR_BTN_CATEGORY_SX}
                    >
                      Category
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FolderOpenIcon sx={{ fontSize: 18 }} />}
                      onClick={() => setShowAddProductSubCategoryPopup(true)}
                      sx={PURCHASE_TOOLBAR_BTN_SUBCATEGORY_SX}
                    >
                      Subcategory
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <TextField
                      size="small"
                      placeholder="Invoice No"
                      sx={{
                        width: { xs: '100%', sm: 168 },
                        ...PURCHASE_ENTRY_CONTROL_SX,
                        '& .MuiInputBase-root': { height: 36 },
                      }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SearchIcon sx={{ fontSize: 18 }} />}
                      sx={{ ...PURCHASE_TOOLBAR_BTN_OUTLINED_SX, minWidth: 88 }}
                    >
                      Find
                    </Button>
                  </Stack>
                </>
              )}
            </Box>
          </Box>

          {/* Screen Stack Indicator */}
          {(currentScreenIndex >= 0 || screenStack.length > 0) && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mt: -1, mb: 1, gap: 1 }}>
              <Box
                sx={{
                  background: 'rgba(51, 65, 85, 0.1)',
                  color: '#475569',
                  padding: '2px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  border: '1px solid rgba(51, 65, 85, 0.2)'
                }}
              >
                SCREEN {currentScreenIndex + 1}
                {screenStack.length > 1 && (
                  <span style={{ opacity: 0.7, fontSize: '10px', marginLeft: '4px' }}>
                    ({currentScreenIndex + 1}/{screenStack.length})
                  </span>
                )}
              </Box>
              {screenStack.length > 1 && (
                <IconButton
                  size="small"
                  onClick={cancelCurrentScreen}
                  title="Cancel this screen (Ctrl+X)"
                  sx={{
                    color: '#dc3545',
                    padding: 0,
                    '&:hover': { bgcolor: 'rgba(220, 53, 69, 0.1)' }
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
          )}

          {/* Main Form */}
          <Card key={currentScreenIndex} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column' }}>
              {/* Purchase Type Selection Section */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc' }}>
                <Grid container spacing={3} alignItems="flex-start">
                  {/* Purchase Type Dropdown */}
                  {/* Purchase Type Dropdown */}
                  <Grid size={{ xs: 12, md: 12 }}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      borderRadius: 2,
                      background: purchaseType === 'new'
                        ? PURCHASE_ENTRY_HEADER_GRADIENT
                        : 'linear-gradient(180deg, #c62828 0%, #ef5350 100%)',
                      boxShadow: '0 4px 14px rgba(26, 85, 227, 0.22)',
                      color: 'white',
                      transition: 'all 0.3s ease',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {purchaseType === 'new' ? 'New Purchase Entry' : 'Purchase Return Entry'}
                        </Typography>
                        <Box sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}>
                          {purchaseType === 'new' ? <ShoppingCartIcon sx={{ color: 'white' }} /> : <TrendingDownIcon sx={{ color: 'white' }} />}
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {purchaseType === 'new' ? 'Stock In' : 'Stock Out'}
                          </Typography>
                        </Box>
                      </Box>

                      <FormControl size="small" variant="standard" sx={{ minWidth: 200 }}>
                        <Autocomplete
                          size="small"
                          options={['new', 'return']}
                          getOptionLabel={(option) => option === 'new' ? 'New Purchase' : 'Return Purchase'}
                          value={purchaseType}
                          onChange={(e, newValue) => {
                            setPurchaseType(newValue || 'new');
                            if (newValue === 'new') {
                              setPurchaseSearchOpen(false);
                              setPurchaseSearchResults([]);
                              setSelectedPurchaseForReturn(null);
                            }
                          }}
                          autoSelect={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Transaction"
                              variant="standard"
                              // Preserve Autocomplete's inputProps/ref and only add tabIndex
                              inputProps={{ ...params.inputProps, tabIndex: -1 }}
                              sx={{
                                minWidth: 200,
                                '& .MuiInputBase-input': {
                                  color: 'white',
                                  fontWeight: 'bold',
                                  fontSize: '1.1rem',
                                  paddingRight: 2
                                },
                                '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.7)' },
                                '& .MuiInput-underline:after': { borderBottomColor: 'white' },
                                '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'white' }
                              }}
                            />
                          )}
                        />
                      </FormControl>
                    </Box>
                  </Grid>


                </Grid>
              </Box>

              {/* Supplier, date, invoice — sales-style row */}
              <Box sx={{ px: 3, pt: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={
                  purchaseType === 'return'
                    ? PURCHASE_ENTRY_ROW1_RETURN_SX
                    : {
                        ...PURCHASE_ENTRY_ROW1_SX,
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          md: 'minmax(0, 2.2fr) minmax(0, 0.85fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr)',
                        },
                      }
                }>
                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, gap: 1, minHeight: 22, flexWrap: 'wrap' }}>
                      <Typography sx={{ ...PURCHASE_ENTRY_LABEL_SX, mb: 0 }}>
                        SUPPLIER
                      </Typography>
                      {formSelectedCustomer && (
                        <Typography
                          component="span"
                          sx={{
                            bgcolor: BRAND.tint.blue,
                            color: BRAND.text.blue,
                            border: `1px solid ${BRAND.primary.blue}`,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1.5,
                            fontSize: '0.8rem',
                            fontWeight: 800,
                          }}
                        >
                          Balance: {Number(formSelectedCustomer.cus_balance || 0).toLocaleString('en-PK')}
                        </Typography>
                      )}
                    </Box>
                    <Autocomplete
                      fullWidth
                      size="small"
                      open={customerDropdownOpen}
                      onOpen={() => setCustomerDropdownOpen(true)}
                      onClose={() => setCustomerDropdownOpen(false)}
                      options={suppliers}
                      getOptionLabel={(option) => option.cus_name || ''}
                      filterOptions={filterPurchaseSuppliers}
                      value={formSelectedCustomer}
                      isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                      slots={{ listbox: PurchaseSupplierDropdownListbox }}
                      slotProps={{
                        popper: {
                          sx: PURCHASE_DROPDOWN_POPPER_SX,
                          modifiers: [{ name: 'flip', enabled: false }],
                        },
                        paper: { sx: { width: '100%', mt: 0.5 } },
                      }}
                      onHighlightChange={(_, option) => {
                        if (option) supplierHighlightRef.current = option;
                      }}
                      onChange={(event, newValue) => {
                        if (newValue) {
                          selectCustomer(newValue);
                          if (purchaseType === 'return') {
                            setPurchaseSearchResults([]);
                            setSelectedPurchaseForReturn(null);
                            setPurchaseSearchOpen(false);
                          }
                        } else {
                          setFormData(prev => ({ ...prev, cus_id: '' }));
                          setCustomerSearchTerm('');
                          setFormSelectedCustomer(null);
                          if (purchaseType === 'return') {
                            setPurchaseSearchResults([]);
                            setSelectedPurchaseForReturn(null);
                          }
                        }
                        setCustomerDropdownOpen(false);
                      }}
                      onKeyDown={(e) => {
                        commitPurchaseDropdownOnTab(
                          e,
                          supplierHighlightRef.current || formSelectedCustomer,
                          (val) => {
                            selectCustomer(val);
                            if (purchaseType === 'return') {
                              setPurchaseSearchResults([]);
                              setSelectedPurchaseForReturn(null);
                            }
                          },
                          () => {
                            if (purchaseType === 'return') {
                              return document.querySelector('input[placeholder*="Search invoice"]');
                            }
                            return document.querySelector('input[type="date"]')
                              || document.querySelector('input[placeholder*="Select product"]');
                          }
                        );
                      }}
                      autoSelect
                      autoHighlight
                      openOnFocus
                      selectOnFocus
                      clearOnBlur={false}
                      handleHomeEndKeys
                      renderOption={(props, option, { index }) => {
                        const { key, ownerState, ...optionProps } = props;
                        return (
                          <li key={option.cus_id ?? key} {...optionProps} style={{ ...purchaseDropdownRowStyle(PURCHASE_SUPPLIER_DROPDOWN_GRID), ...optionProps.style }}>
                            <span style={{ ...purchaseDropdownCellStyle, justifyContent: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                              {index + 1}
                            </span>
                            <span title={option.cus_name || ''} style={{ ...purchaseDropdownCellStyle, fontWeight: 700, color: '#111827' }}>
                              {option.cus_name || ''}
                            </span>
                            <span title={option.cus_phone_no || ''} style={{ ...purchaseDropdownCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                              {option.cus_phone_no || ''}
                            </span>
                            <span
                              title={`Balance: Rs. ${parseFloat(option.cus_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              style={{
                                ...purchaseDropdownCellStyle,
                                borderRight: 'none',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: parseFloat(option.cus_balance || 0) > 0 ? '#b91c1c' : parseFloat(option.cus_balance || 0) < 0 ? '#15803d' : '#475569',
                                justifyContent: 'flex-end',
                                paddingRight: 10,
                              }}
                            >
                              Rs. {parseFloat(option.cus_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          id="supplier-search-dropdown-input"
                          placeholder="Search by name, phone, or address"
                          onFocus={(e) => e.target.select()}
                          sx={{
                            bgcolor: BRAND.primary.blue,
                            width: '100%',
                            minWidth: 0,
                            borderRadius: 1,
                            '& .MuiOutlinedInput-root': {
                              height: 40,
                              fontSize: '0.95rem',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '& fieldset': { borderColor: '#1347c4', borderWidth: '2px' },
                              '&:hover fieldset': { borderColor: '#0f3aa8' },
                              '&.Mui-focused fieldset': { borderColor: '#0f3aa8' },
                            },
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '&::placeholder': {
                                color: 'rgba(255, 255, 255, 0.75) !important',
                                WebkitTextFillColor: 'rgba(255, 255, 255, 0.75) !important',
                                opacity: 1,
                              },
                            },
                            '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { color: 'white' },
                          }}
                        />
                      )}
                    />
                  </Box>

                  {purchaseType === 'return' && (
                    <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>SELECT PURCHASE</Typography>
                      <Autocomplete
                        size="small"
                        open={purchaseSearchOpen}
                        onOpen={() => {
                          setPurchaseSearchOpen(true);
                          if (formSelectedCustomer) {
                            setPurchaseSearchResults(purchases.filter(p => p.cus_id === formSelectedCustomer.cus_id));
                          }
                        }}
                        onClose={() => setPurchaseSearchOpen(false)}
                        options={purchaseSearchResults}
                        getOptionLabel={(option) => `#${option.pur_id} - ${option.invoice_number || 'N/A'} (${Number(option.total_amount)})`}
                        value={selectedPurchaseForReturn}
                        onChange={(event, newValue) => {
                          if (newValue) handleLoadPurchaseForReturn(newValue);
                        }}
                        onInputChange={(event, inputValue) => handlePurchaseSearch(inputValue)}
                        autoSelect
                        autoHighlight
                        openOnFocus
                        selectOnFocus
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Search invoice..."
                            onFocus={(e) => e.target.select()}
                            sx={PURCHASE_ENTRY_CONTROL_SX}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                        noOptionsText={purchaseSearchResults.length === 0 ? 'No purchases found' : ''}
                      />
                    </Box>
                  )}

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                    <Typography sx={PURCHASE_ENTRY_LABEL_SX}>DATE</Typography>
                    <DateFilterInput
                      fullWidth
                      size="small"
                      value={formData.date || getTodayDateStr()}
                      onChange={(val) => setFormData(prev => ({ ...prev, date: val }))}
                      sx={PURCHASE_ENTRY_CONTROL_SX}
                    />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                    <Typography sx={PURCHASE_ENTRY_LABEL_SX}>
                      {purchaseType === 'new' ? 'INVOICE NUMBER' : 'NEW INVOICE (RETURN)'}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={purchaseType === 'new' ? 'Enter invoice number' : 'Enter return invoice number'}
                      value={formData.invoice_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      sx={PURCHASE_ENTRY_CONTROL_SX}
                    />
                  </Box>

                  {purchaseType === 'new' && (
                    <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>
                        VEHICLE <Box component="span" sx={{ color: 'error.main' }}>*</Box>
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Enter vehicle number..."
                        value={formData.vehicle_no}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicle_no: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        required
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                    </Box>
                  )}
                </Box>

                <Menu
                  anchorEl={vehicleMenuAnchor}
                  open={Boolean(vehicleMenuAnchor)}
                  onClose={handleVehicleMenuClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem onClick={handleEditSelectedVehicle}>
                    <EditIcon sx={{ mr: 1, fontSize: 18 }} />
                    Edit Vehicle
                  </MenuItem>
                  <MenuItem onClick={handleDeleteSelectedVehicle} sx={{ color: 'error.main' }}>
                    <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
                    Delete Vehicle
                  </MenuItem>
                </Menu>
              </Box>


              {/* Product entry row — sales-style grid */}
              <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                {(() => {
                  const storeStockEntry = selectedProduct && formData.store_id
                    ? selectedProduct.store_stocks?.find(s => s.store_id === parseInt(formData.store_id, 10))
                    : null;
                  const stockDisplay = storeStockEntry
                    ? `${parseFloat(storeStockEntry.stock_quantity || 0).toLocaleString()} ${selectedProduct?.pro_unit || ''}`.trim()
                    : '';
                  return (
                <Box sx={PURCHASE_ENTRY_ROW2_SX}>
                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>SELECT PRODUCT</Typography>
                      <Autocomplete
                        size="small"
                        fullWidth
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        options={products}
                        getOptionLabel={(option) => option.pro_title}
                        slots={{ listbox: PurchaseProductDropdownListbox }}
                        slotProps={{
                          popper: {
                            sx: PURCHASE_DROPDOWN_POPPER_SX,
                            modifiers: [{ name: 'flip', enabled: false }],
                          },
                          paper: { sx: { width: '100%', mt: 0.5 } },
                          listbox: {
                            showCost: showProductCostInDropdown,
                            onToggleCost: () => setShowProductCostInDropdown((prev) => !prev),
                          },
                        }}
                        value={selectedProduct}
                        onChange={(event, newValue) => {
                          if (newValue) {
                            handleProductSelect(newValue);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && selectedProduct) {
                            e.preventDefault();
                            // Move focus to Quantity field
                            const qtyInputs = document.querySelectorAll('input[type="number"]');
                            if (qtyInputs.length > 0) {
                              qtyInputs[0]?.focus();
                            }
                          }
                        }}
                        filterOptions={(options, { inputValue }) => {
                          return options.filter(option =>
                            option.pro_title.toLowerCase().includes(inputValue.toLowerCase()) ||
                            option.category?.cat_name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                            option.sub_category?.sub_cat_name?.toLowerCase().includes(inputValue.toLowerCase())
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            id="product-select-dropdown-input"
                            placeholder="Select product..."
                            onFocus={(e) => e.target.select()}
                            sx={{ ...PURCHASE_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: selectedProduct ? 'bold' : 'normal' } }}
                          />
                        )}
                        renderOption={(props, option, { index }) => {
                          const { key, ownerState, ...optionProps } = props;
                          const rawUnit = option.pro_unit ? String(option.pro_unit).trim() : '';
                          const cleanUnit = (rawUnit && rawUnit.toLowerCase() !== 'null' && rawUnit.toLowerCase() !== 'undefined') ? rawUnit : '';

                          const storeId = formData.store_id ? parseInt(formData.store_id, 10) : null;
                          const storeStockEntry = storeId
                            ? option.store_stocks?.find((s) => s.store_id === storeId)
                            : null;
                          const stockQty = storeStockEntry != null
                            ? parseFloat(storeStockEntry.stock_quantity || 0)
                            : (option.store_stocks?.length
                              ? option.store_stocks.reduce((sum, s) => sum + parseFloat(s.stock_quantity || 0), 0)
                              : (option.pro_stock_qnty != null ? parseFloat(option.pro_stock_qnty || 0) : 0));
                          const formattedQty = Number.isFinite(stockQty)
                            ? (Math.abs(stockQty) < 0.001 ? 0 : (stockQty % 1 === 0 ? stockQty : parseFloat(stockQty.toFixed(2))))
                            : 0;
                          const stockLabel = `${formattedQty.toLocaleString()}${cleanUnit ? ` ${cleanUnit}` : ''}`;
                          const isCostVisible = showProductCostInDropdown || Boolean(revealedCostProductIds[option.pro_id]);
                          return (
                            <li key={option.pro_id ?? key} {...optionProps} style={{ ...purchaseDropdownRowStyle(PURCHASE_PRODUCT_DROPDOWN_GRID), ...optionProps.style }}>
                              <span style={{ ...purchaseDropdownCellStyle, justifyContent: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                                {index + 1}
                              </span>
                              <span title={option.pro_title || ''} style={{ ...purchaseDropdownCellStyle, fontWeight: 600, color: '#111827' }}>
                                {option.pro_title || ''}
                              </span>
                              <span title={stockLabel} style={{ ...purchaseDropdownCellStyle, fontVariantNumeric: 'tabular-nums', justifyContent: 'flex-end', fontWeight: 600, color: stockQty > 0 ? '#15803d' : '#64748b' }}>
                                {stockLabel}
                              </span>
                              <span style={{ ...purchaseDropdownCellStyle, borderRight: 'none', justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, gap: 4 }}>
                                <span>{isCostVisible ? fmtAmt(option.pro_cost_price) : '••••••'}</span>
                                <Box
                                  component="span"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRevealedCostProductIds((prev) => ({
                                      ...prev,
                                      [option.pro_id]: !prev[option.pro_id],
                                    }));
                                  }}
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    p: 0.25,
                                    borderRadius: 0.5,
                                    color: isCostVisible ? '#0284c7' : '#94a3b8',
                                    '&:hover': { color: '#0284c7', bgcolor: 'rgba(2, 132, 199, 0.12)' },
                                  }}
                                  title={isCostVisible ? 'Hide Cost' : 'Show Cost'}
                                >
                                  {isCostVisible ? (
                                    <EyeIcon sx={{ fontSize: 13 }} />
                                  ) : (
                                    <EyeOffIcon sx={{ fontSize: 13 }} />
                                  )}
                                </Box>
                              </span>
                            </li>
                          );
                        }}
                        disablePortal={false}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>STORE</Typography>
                      <Autocomplete
                        size="small"
                        fullWidth
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        options={stores}
                        getOptionLabel={(option) => option.store_name}
                        value={stores.find(store => store.storeid === parseInt(formData.store_id)) || null}
                        onChange={(event, newValue) => {
                          setFormData(prev => ({
                            ...prev,
                            store_id: newValue ? newValue.storeid.toString() : ''
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && formData.store_id) {
                            e.preventDefault();
                            // Move focus to Product field
                            const productInputs = document.querySelectorAll('input[placeholder*="Select product"]');
                            if (productInputs.length > 0) {
                              productInputs[0]?.focus();
                            }
                          }
                        }}
                        filterOptions={(options, { inputValue }) => {
                          return options.filter(option =>
                            option.store_name.toLowerCase().includes(inputValue.toLowerCase()) ||
                            (option.store_address && option.store_address.toLowerCase().includes(inputValue.toLowerCase()))
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={formData.store_id ? 'Store Selected' : 'Select store'}
                            onFocus={(e) => e.target.select()}
                            sx={{ ...PURCHASE_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formData.store_id ? 'bold' : 'normal' } }}
                          />
                        )}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>QTY</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={productFormData.qnty ?? ''}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, qnty: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // If rate is already filled, add product directly
                            if (productFormData.unit_rate > 0) {
                              addProductToPurchase();
                            } else {
                              // Focus on rate field if rate is not filled
                              setTimeout(() => {
                                const rateInputs = document.querySelectorAll('input[type="number"]');
                                // Find the rate input (it's the next number input after quantity)
                                if (rateInputs.length > 1) {
                                  rateInputs[1].focus();
                                }
                              }, 0);
                            }
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            // Tab should move to RATE field
                            const rateInputs = document.querySelectorAll('input[type="number"]');
                            if (rateInputs.length > 1) {
                              rateInputs[1].focus();
                            }
                          }
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>PURCHASE RATE</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={productFormData.crate || productFormData.unit_rate || ''}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, crate: e.target.value, cost_rate: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Press Enter to add product
                            addProductToPurchase();
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            // Move focus to the next numeric input (Cost Rate should be next)
                            const allInputs = document.querySelectorAll('input[type="number"]');
                            const currentInput = e.target;
                            let foundCurrent = false;
                            for (let i = 0; i < allInputs.length; i++) {
                              if (allInputs[i] === currentInput) { foundCurrent = true; continue; }
                              if (foundCurrent) { allInputs[i].focus(); return; }
                            }

                            // Fallback: focus + button
                            const addBtnFallback = document.getElementById('add-product-btn');
                            if (addBtnFallback) addBtnFallback.focus();
                          }
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>COST RATE</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={productFormData.cost_rate ?? ''}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, cost_rate: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        onBlur={async (e) => {
                          const newCost = parseFloat(e.target.value || 0);
                          // update local products state
                          if (selectedProduct) {
                            setProducts(prev => prev.map(p => p.pro_id === selectedProduct.pro_id ? { ...p, pro_cost_price: newCost } : p));

                            // persist to backend
                            try {
                              await fetch('/api/products', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: selectedProduct.pro_id, pro_cost_price: newCost })
                              });
                            } catch (err) {
                              console.error('Failed to persist cost_rate change from selection', err);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addProductToPurchase();
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            // move focus to Sale Rate field (next)
                            const allInputs = document.querySelectorAll('input[type="number"]');
                            const currentInput = e.target;
                            let foundCurrent = false;
                            for (let i = 0; i < allInputs.length; i++) {
                              const input = allInputs[i];
                              if (input === currentInput) { foundCurrent = true; continue; }
                              if (foundCurrent) { input.focus(); return; }
                            }
                          }
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>SALE RATE</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={productFormData.unit_rate ?? ''}
                        onChange={(e) => setProductFormData(prev => ({ ...prev, unit_rate: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Add product to table when Enter is pressed in rate field
                            addProductToPurchase();
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            // Tab from Sale Rate should focus the + button
                            const addBtn = document.getElementById('add-product-btn');
                            if (addBtn) {
                              addBtn.focus();
                            }
                          }
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>AMOUNT</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={parseFloat(productFormData.qnty || 0) * parseFloat(productFormData.crate || productFormData.unit_rate || 0)}
                        InputProps={{ readOnly: true }}
                        sx={PURCHASE_ENTRY_CONTROL_SX}
                      />
                  </Box>

                  <Box sx={PURCHASE_ENTRY_CELL_SX}>
                      <Typography sx={PURCHASE_ENTRY_LABEL_SX}>STOCK</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={stockDisplay}
                        disabled
                        sx={{ ...PURCHASE_ENTRY_CONTROL_SX, bgcolor: '#f8f9fa', '& .MuiInputBase-root': { ...PURCHASE_ENTRY_CONTROL_SX['& .MuiInputBase-root'], bgcolor: '#f8f9fa' } }}
                      />
                  </Box>

                  <Box sx={{ minWidth: 0, width: '100%', display: 'flex', alignItems: 'end' }}>
                    <Button
                      variant="contained"
                      id="add-product-btn"
                      onClick={addProductToPurchase}
                      disabled={!productFormData.qnty || !productFormData.unit_rate}
                      sx={{
                        bgcolor: BRAND.primary.blue,
                        color: 'white',
                        borderRadius: 1,
                        minWidth: 40,
                        width: 44,
                        height: 40,
                        p: 0,
                        '&:hover': { bgcolor: '#1347c4' },
                      }}
                    >
                      +
                    </Button>
                  </Box>
                </Box>
                  );
                })()}
              </Box>


              {/* Product List Table */}
              <Box sx={{ px: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <TableContainer component={Paper} sx={{ maxHeight: 300, border: '1px solid #e9ecef' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#dce6f1', '& th': { bgcolor: '#dce6f1 !important' } }}>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>S. No</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Product</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Store</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Qty</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>PURCHASE RATE</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>COST RATE</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Sale Rate</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Amount</TableCell>
                        <TableCell sx={PURCHASE_ENTRY_TABLE_HEAD_SX}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.purchase_details.length > 0 ? (
                        <>
                          {formData.purchase_details.map((detail, index) => {
                            const product = products.find(p => p.pro_id === detail.pro_id);
                            return (
                              <TableRow
                                key={index}
                                hover
                                sx={{
                                  bgcolor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                                  '&:hover': { bgcolor: '#eff6ff' },
                                }}
                              >
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {product?.pro_title || 'Unknown Product'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <StoreIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                      {stores.find(store => store.storeid === parseInt(detail.store_id))?.store_name || 'Unknown Store'}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={detail.qnty}
                                    onChange={(e) => {
                                      const newQuantity = e.target.value;
                                      setFormData(prev => {
                                        const baseUpdated = prev.purchase_details.map((d, i) =>
                                          i === index
                                            ? {
                                              ...d,
                                              qnty: newQuantity,
                                              total_amount: (parseFloat(newQuantity) * parseFloat(d.crate || d.unit_rate || 0)).toFixed(2)
                                            }
                                            : d
                                        );
                                        const updatedDetails = recomputeDistributedCosts(baseUpdated, getDistributionParams(prev));
                                        return { ...prev, purchase_details: updatedDetails };
                                      });
                                    }}
                                    inputProps={{ min: 0, step: "any" }}
                                    size="small"
                                    sx={{ width: 80 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={detail.crate || detail.unit_rate || '0'}
                                    onChange={(e) => {
                                      const newCrate = e.target.value;
                                      setFormData(prev => {
                                        const baseUpdated = prev.purchase_details.map((d, i) =>
                                          i === index
                                            ? {
                                              ...d,
                                              crate: newCrate,
                                              original_crate: newCrate,
                                              cost_rate: newCrate,
                                              original_cost_rate: newCrate,
                                              total_amount: (parseFloat(d.qnty) * parseFloat(newCrate)).toFixed(2)
                                            }
                                            : d
                                        );
                                        // Re-distribute charges on top of new base cost rate
                                        const updatedDetails = recomputeDistributedCosts(baseUpdated, getDistributionParams(prev));
                                        return { ...prev, purchase_details: updatedDetails };
                                      });
                                    }}
                                    inputProps={{ min: 0, step: "any" }}
                                    size="small"
                                    sx={{ width: 100 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={(detail.cost_rate ?? detail.original_cost_rate ?? product?.pro_cost_price ?? 0).toString()}
                                    onChange={(e) => {
                                      const newCost = e.target.value;
                                      const updatedDetails = formData.purchase_details.map((d, i) =>
                                        i === index ? { ...d, cost_rate: newCost } : d
                                      );
                                      setFormData(prev => ({ ...prev, purchase_details: updatedDetails }));
                                    }}
                                    onBlur={(e) => {
                                      const newCostVal = parseFloat(e.target.value || 0);
                                      // Update local products state so UI shows updated cost price immediately
                                      setProducts(prev => prev.map(p => p.pro_id === detail.pro_id ? { ...p, pro_cost_price: newCostVal } : p));

                                      // DO NOT persist to backend here — persistence will occur when the purchase is saved
                                      // keep original_cost_rate in sync for undo/restore
                                      const updatedDetails = formData.purchase_details.map((d, i) =>
                                        i === index ? { ...d, original_cost_rate: d.original_cost_rate ?? d.cost_rate } : d
                                      );
                                      setFormData(prev => ({ ...prev, purchase_details: updatedDetails }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    inputProps={{ min: 0, step: "any" }}
                                    sx={{ width: 100 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={detail.unit_rate}
                                    onChange={(e) => {
                                      const newUnitRate = e.target.value;
                                      const updatedDetails = formData.purchase_details.map((d, i) =>
                                        i === index ? { ...d, unit_rate: newUnitRate, total_amount: (parseFloat(d.qnty) * parseFloat(d.crate || newUnitRate)).toFixed(2) } : d
                                      );
                                      setFormData(prev => ({ ...prev, purchase_details: updatedDetails }));
                                    }}
                                    inputProps={{ min: 0, step: "any" }}
                                    size="small"
                                    sx={{ width: 100 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontWeight: 'semibold', color: BRAND.text.blue }}>
                                    {detail.total_amount}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    onClick={() => removePurchaseDetail(index)}
                                    color="error"
                                    size="small"
                                    title="Remove Product"
                                  >
                                    <CloseIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}

                          {/* Totals row */}
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Totals</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{calculateTotalQuantity()}</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell sx={{ fontWeight: 'bold', color: BRAND.primary.blue }}>{calculateTotalAmount().toFixed(2)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No products added yet
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Payment and Summary Section */}
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: BRAND.text.blue,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    mb: 2,
                  }}
                >
                  Payment & charges
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={PURCHASE_PAYMENT_ROW_SX}>
                      <Box sx={PURCHASE_ENTRY_CELL_SX}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, minHeight: 22, gap: 1 }}>
                          <Typography sx={{ ...PURCHASE_ENTRY_LABEL_SX, mb: 0 }}>CASH PAYMENT</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            Bal: {fmtAmt(customers.find(c => c.cus_name === 'Cash Account')?.cus_balance ?? 0)}
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={formData.cash_payment}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, cash_payment: e.target.value }));
                          }}
                          inputProps={{ min: 0 }}
                          placeholder="Enter amount"
                          sx={PURCHASE_ENTRY_CONTROL_SX}
                        />
                      </Box>
                      <Box sx={PURCHASE_ENTRY_CELL_SX}>
                        <Typography sx={PURCHASE_ENTRY_LABEL_SX}>BANK PAYMENT</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={formData.bank_payment}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, bank_payment: e.target.value }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              // Only intercept Tab and move focus to BANK ACCOUNT when a bank amount is present
                              if (parseFloat(formData.bank_payment || 0) > 0) {
                                e.preventDefault();
                                setTimeout(() => {
                                  bankAccountInputRef.current?.focus();
                                }, 0);
                              } // otherwise allow normal Tab behavior (skip bank account)
                            }
                          }}
                          inputProps={{ min: 0 }}
                          placeholder="Enter amount"
                          sx={PURCHASE_ENTRY_CONTROL_SX}
                        />
                      </Box>
                      <Box sx={PURCHASE_ENTRY_CELL_SX}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, minHeight: 22, gap: 1 }}>
                          <Typography sx={{ ...PURCHASE_ENTRY_LABEL_SX, mb: 0 }}>BANK ACCOUNT</Typography>
                          {selectedBankAccount && (
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              Bal: {fmtAmt(selectedBankAccount.cus_balance ?? 0)}
                            </Typography>
                          )}
                        </Box>
                        <Autocomplete
                          fullWidth
                          size="small"
                          autoSelect
                          autoHighlight
                          openOnFocus
                          selectOnFocus
                          disabled={parseFloat(formData.bank_payment || 0) <= 0}
                          open={bankAccountDropdownOpen}
                          onOpen={() => {
                            if (parseFloat(formData.bank_payment || 0) <= 0) return;
                            setBankAccountDropdownOpen(true);
                          }}
                          onClose={() => setBankAccountDropdownOpen(false)}
                          options={bankAccounts.length > 0 ? bankAccounts : customers}
                          getOptionLabel={(option) => option.cus_name || ''}
                          isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                          filterOptions={filterPurchaseBankAccounts}
                          value={selectedBankAccount}
                          slots={{ listbox: PurchaseBankDropdownListbox }}
                          slotProps={{
                            popper: {
                              sx: PURCHASE_DROPDOWN_POPPER_SX,
                              modifiers: [{ name: 'flip', enabled: false }],
                            },
                            paper: { sx: { width: '100%', mt: 0.5 } },
                          }}
                          onHighlightChange={(_, option) => {
                            if (option) bankAccountHighlightRef.current = option;
                          }}
                          onChange={(event, newValue) => {
                            setSelectedBankAccount(newValue);
                            setFormData(prev => ({
                              ...prev,
                              credit_account_id: newValue ? newValue.cus_id.toString() : ''
                            }));
                            setBankAccountDropdownOpen(false);
                          }}
                          onKeyDown={(e) => {
                            commitPurchaseDropdownOnTab(
                              e,
                              bankAccountHighlightRef.current || selectedBankAccount,
                              (val) => {
                                setSelectedBankAccount(val);
                                setFormData(prev => ({
                                  ...prev,
                                  credit_account_id: val.cus_id.toString()
                                }));
                                setBankAccountDropdownOpen(false);
                              },
                              () => {
                                setBankAccountDropdownOpen(false);
                                return document.querySelector('textarea[placeholder*="Additional notes"]')
                                  || document.querySelector('input[placeholder*="Select Cargo Account"]');
                              }
                            );
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              inputRef={bankAccountInputRef}
                              placeholder="Select Bank Account"
                              onFocus={(e) => e.target.select()}
                              sx={{
                                ...PURCHASE_ENTRY_CONTROL_SX,
                                '& .MuiInputBase-input': {
                                  fontWeight: selectedBankAccount ? 'bold' : 'normal',
                                },
                              }}
                            />
                          )}
                          renderOption={(props, option, { index }) => {
                            const { key, ...optionProps } = props;
                            const balance = parseFloat(option.cus_balance ?? 0);
                            const balanceColor = balance < 0 ? '#b91c1c' : balance > 0 ? BRAND.text.green : '#64748b';
                            return (
                              <li
                                key={option.cus_id ?? key}
                                {...optionProps}
                                style={{ ...purchaseDropdownRowStyle(PURCHASE_BANK_DROPDOWN_GRID), ...optionProps.style }}
                              >
                                <span style={{ ...purchaseDropdownCellStyle, justifyContent: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                                  {index + 1}
                                </span>
                                <span title={option.cus_name || ''} style={{ ...purchaseDropdownCellStyle, fontWeight: 700, color: '#111827' }}>
                                  {option.cus_name || ''}
                                </span>
                                <span
                                  title={String(balance)}
                                  style={{
                                    ...purchaseDropdownCellStyle,
                                    borderRight: 'none',
                                    justifyContent: 'flex-end',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: 700,
                                    color: balanceColor,
                                  }}
                                >
                                  {fmtAmt(balance)}
                                </span>
                              </li>
                            );
                          }}
                          disablePortal={false}
                          clearOnBlur={false}
                          handleHomeEndKeys
                        />
                      </Box>
                    </Box>

                    {/* Row 2: Total + Incity (left) | Notes + Cargo (right) */}
                    <Box sx={PURCHASE_PAYMENT_ROW2_SX}>
                      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                        <Typography sx={PURCHASE_ENTRY_LABEL_SX}>TOTAL PAYMENT</Typography>
                        <PurchaseAmountTotal
                          variant="large"
                          value={parseFloat(formData.cash_payment || 0) + parseFloat(formData.bank_payment || 0)}
                        />

                        <Box sx={{ ...PURCHASE_CHARGE_BOX_SX, mt: 0.5, flex: 1 }}>
                          <Typography sx={PURCHASE_CHARGE_BOX_TITLE_SX}>Incity</Typography>
                          <Box sx={PURCHASE_INCLUDE_BAR_SX}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={formData.include_incity || false}
                                  onChange={(e) => {
                                    const newInclude = e.target.checked;
                                    setFormData(prev => {
                                      const incityAmount = parseFloat(prev.incity_own_labour || 0) + parseFloat(prev.incity_own_delivery || 0);
                                      const updatedDetails = handleIncityDistribution(newInclude, incityAmount, prev.purchase_details, prev);
                                      return { ...prev, include_incity: newInclude, purchase_details: updatedDetails };
                                    });
                                  }}
                                  size="small"
                                  sx={{ color: BRAND.primary.blue }}
                                />
                              }
                              label="Include Incity Charges"
                            />
                          </Box>
                          <Box sx={PURCHASE_CHARGE_BODY_SX}>
                            <Box sx={PURCHASE_CHARGE_INNER_GRID_SX}>
                              <Box>
                                <Typography component="label" sx={PURCHASE_FIELD_LABEL_SX}>Own Labour</Typography>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  value={formData.incity_own_labour || ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setFormData(prev => {
                                      const incityAmount = parseFloat(newVal || 0) + parseFloat(prev.incity_own_delivery || 0);
                                      const updatedDetails = handleIncityDistribution(prev.include_incity, incityAmount, prev.purchase_details, prev);
                                      return { ...prev, incity_own_labour: newVal, purchase_details: updatedDetails };
                                    });
                                  }}
                                  inputProps={{ min: 0 }}
                                  sx={PURCHASE_ENTRY_CONTROL_SX}
                                />
                              </Box>
                              <Box>
                                <Typography component="label" sx={PURCHASE_FIELD_LABEL_SX}>Own Delivery</Typography>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  value={formData.incity_own_delivery || ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setFormData(prev => {
                                      const incityAmount = parseFloat(prev.incity_own_labour || 0) + parseFloat(newVal || 0);
                                      const updatedDetails = handleIncityDistribution(prev.include_incity, incityAmount, prev.purchase_details, prev);
                                      return { ...prev, incity_own_delivery: newVal, purchase_details: updatedDetails };
                                    });
                                  }}
                                  inputProps={{ min: 0 }}
                                  sx={PURCHASE_ENTRY_CONTROL_SX}
                                />
                              </Box>
                            </Box>
                            <PurchaseAmountTotal
                              label="Charges Total"
                              value={parseFloat(formData.incity_charges_total || 0)}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                        <Typography sx={PURCHASE_ENTRY_LABEL_SX}>NOTES</Typography>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={2}
                          placeholder="Additional notes"
                          sx={PURCHASE_NOTES_CONTROL_SX}
                        />

                        <Box sx={{ ...PURCHASE_CHARGE_BOX_SX, mt: 0.5, flex: 1 }}>
                          <Typography sx={PURCHASE_CHARGE_BOX_TITLE_SX}>Cargo</Typography>
                          <Box sx={PURCHASE_CHARGE_BODY_SX}>
                            <Box>
                              <Typography component="label" sx={PURCHASE_FIELD_LABEL_SX}>Cargo Account</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Autocomplete
                                  size="small"
                                  multiple
                                  sx={{ flex: 1, minWidth: 0 }}
                                  openOnFocus
                                  options={cargoAccounts.filter(a => !(selectedCargoAccounts || []).some(s => s.cus_id === a.cus_id))}
                                  getOptionLabel={(option) => option.cus_name}
                                  value={selectedCargoAccounts}
                                  onChange={(e, newValue) => {
                                    setSelectedCargoAccounts(newValue || []);
                                    setFormData(prev => ({ ...prev, cargo_account_ids: (newValue || []).map(a => a.cus_id) }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Tab') {
                                      setTimeout(() => { outLabourInputRef.current?.focus(); }, 0);
                                    }
                                  }}
                                  renderTags={() => null}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      inputRef={cargoInputRef}
                                      placeholder="Select Cargo Account"
                                      size="small"
                                      sx={PURCHASE_ENTRY_CONTROL_SX}
                                    />
                                  )}
                                  renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    return (
                                      <Box component="li" key={key} {...optionProps}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
                                          <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: (selectedCargoAccounts || []).some(s => s.cus_id === option.cus_id) ? 'bold' : 'medium' }}>
                                              {option.cus_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {option.cus_phone_no}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Box>
                                    );
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => openCustomerForm('cargo')}
                                  sx={{
                                    bgcolor: BRAND.primary.blue,
                                    color: 'white',
                                    '&:hover': { bgcolor: '#1347c4' },
                                    borderRadius: 1,
                                    width: 40,
                                    height: 40,
                                    flexShrink: 0,
                                  }}
                                  title="Add New Cargo Account"
                                >
                                  <AddIcon />
                                </IconButton>
                              </Box>
                            </Box>

                            {(selectedCargoAccounts || []).length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {(selectedCargoAccounts || []).map(acc => (
                                  <Chip
                                    key={acc.cus_id}
                                    label={acc.cus_name}
                                    size="small"
                                    onDelete={() => {
                                      setSelectedCargoAccounts(prev => {
                                        const next = prev.filter(p => p.cus_id !== acc.cus_id);
                                        setFormData(f => ({ ...f, cargo_account_ids: next.map(a => a.cus_id) }));
                                        return next;
                                      });
                                    }}
                                    sx={{ bgcolor: 'error.main', color: 'white', borderRadius: '16px' }}
                                  />
                                ))}
                              </Box>
                            )}

                            <Box sx={PURCHASE_CARGO_AMOUNTS_GRID_SX}>
                              <Box>
                                <Typography component="label" sx={PURCHASE_FIELD_LABEL_SX}>Out Labour</Typography>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  inputRef={outLabourInputRef}
                                  value={formData.out_labour_amount || ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setFormData(prev => {
                                      const updatedDetails = handleCargoDistribution(prev.include_cargo_in_costprice, newVal, prev.out_delivery_amount, prev.purchase_details, prev);
                                      return { ...prev, out_labour_amount: newVal, purchase_details: updatedDetails };
                                    });
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  inputProps={{ min: 0 }}
                                  sx={PURCHASE_ENTRY_CONTROL_SX}
                                />
                              </Box>
                              <Box>
                                <Typography component="label" sx={PURCHASE_FIELD_LABEL_SX}>Out Delivery</Typography>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  value={formData.out_delivery_amount || ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setFormData(prev => {
                                      const updatedDetails = handleCargoDistribution(prev.include_cargo_in_costprice, prev.out_labour_amount, newVal, prev.purchase_details, prev);
                                      return { ...prev, out_delivery_amount: newVal, purchase_details: updatedDetails };
                                    });
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  inputProps={{ min: 0 }}
                                  sx={PURCHASE_ENTRY_CONTROL_SX}
                                />
                              </Box>
                            </Box>
                            <PurchaseAmountTotal
                              label="Total Charges"
                              value={parseFloat(formData.out_labour_amount || 0) + parseFloat(formData.out_delivery_amount || 0)}
                            />
                          </Box>
                          <Box sx={{ ...PURCHASE_INCLUDE_BAR_SX, borderBottom: 'none', borderTop: '1px solid #dce3ed', mt: 'auto' }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={formData.include_cargo_in_costprice || false}
                                  onChange={(e) => {
                                    const newInclude = e.target.checked;
                                    setFormData(prev => {
                                      const updatedDetails = handleCargoDistribution(newInclude, prev.out_labour_amount, prev.out_delivery_amount, prev.purchase_details, prev);
                                      return { ...prev, include_cargo_in_costprice: newInclude, purchase_details: updatedDetails };
                                    });
                                  }}
                                  size="small"
                                  sx={{ color: BRAND.primary.blue }}
                                />
                              }
                              label="Include in cost price"
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Right Section - Summary Fields */}
                  <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* SUBTOTAL */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        SUBTOTAL
                      </Typography>
                      <TextField
                        size="small"
                        value={calculateTotalAmount().toFixed(2)}
                        InputProps={{ readOnly: true }}
                        sx={{ width: 150 }}
                      />
                    </Box>



                    {/* DELIVERY CHARGES */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        DELIVERY CHARGES
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={formData.transport_amount || ''}
                        onChange={(e) => {
                          const newTransport = e.target.value;
                          setFormData(prev => {
                            const updatedDetails = recomputeDistributedCosts(
                              prev.purchase_details,
                              getDistributionParams(prev, {
                                labourAmount: parseFloat(prev.labour_amount || 0) + parseFloat(newTransport || 0)
                              })
                            );
                            return { ...prev, transport_amount: newTransport, purchase_details: updatedDetails };
                          });
                        }}
                        onFocus={(e) => e.target.select()}
                        inputProps={{ min: 0 }}
                        sx={{ width: 150 }}
                      />
                    </Box>



                    {/* LABOUR */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        LABOUR
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={formData.labour_amount || ''}
                        onChange={(e) => {
                          const newLabourAmount = e.target.value;
                          setFormData(prev => {
                            const updatedDetails = recomputeDistributedCosts(
                              prev.purchase_details,
                              getDistributionParams(prev, {
                                labourAmount: parseFloat(newLabourAmount || 0) + parseFloat(prev.transport_amount || 0)
                              })
                            );
                            return {
                              ...prev,
                              labour_amount: newLabourAmount,
                              purchase_details: updatedDetails
                            };
                          });
                        }}
                        inputProps={{ min: 0 }}
                        sx={{ width: 150 }}
                      />
                    </Box>

                    {/* Include Labour Charges Checkbox */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end', py: 0.5 }}>
                      <Checkbox
                        checked={formData.include_labour || false}
                        onChange={(e) => {
                          const newIncludeLabour = e.target.checked;
                          console.log('🔧 Checkbox changed:', {
                            newIncludeLabour,
                            labourAmount: formData.labour_amount,
                            purchaseDetailsLength: formData.purchase_details.length
                          });
                          setFormData(prev => {
                            const updatedDetails = handleLabourDistribution(
                              newIncludeLabour,
                              prev.purchase_details,
                              prev
                            );
                            return {
                              ...prev,
                              include_labour: newIncludeLabour,
                              purchase_details: updatedDetails
                            };
                          });
                        }}
                        size="small"
                        sx={{ py: 0 }}
                      />
                      <Typography variant="body2">
                        Include Labour Charges
                      </Typography>
                    </Box>

                    {/* DISCOUNT */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        DISCOUNT
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={formData.discount || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        inputProps={{ min: 0 }}
                        sx={{ width: 150 }}
                      />
                    </Box>

                    {/* GRAND TOTAL */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        GRAND TOTAL
                      </Typography>
                      <TextField
                        size="small"
                        value={calculateNetTotal().toFixed(2)}
                        InputProps={{ readOnly: true }}
                        sx={{
                          width: 150,
                          '& .MuiInputBase-input': {
                            fontWeight: 'bold',
                            color: 'primary.main',
                            fontSize: '1.1rem'
                          }
                        }}
                      />
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* TOTAL PAYMENT */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        TOTAL PAYMENT
                      </Typography>
                      <TextField
                        size="small"
                        value={(parseFloat(formData.cash_payment || 0) + parseFloat(formData.bank_payment || 0)).toFixed(2)}
                        InputProps={{ readOnly: true }}
                        sx={{ width: 150, backgroundColor: 'action.hover' }}
                      />
                    </Box>

                    {/* BALANCE */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'right' }}>
                        BALANCE
                      </Typography>
                      <TextField
                        size="small"
                        value={(calculateNetTotal() - (parseFloat(formData.cash_payment || 0) + parseFloat(formData.bank_payment || 0))).toFixed(2)}
                        InputProps={{ readOnly: true }}
                        sx={{ width: 150 }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Form Actions */}
              <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  type="button"
                  variant="contained"
                  sx={{
                    bgcolor: '#dc3545',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#c82333' }
                  }}
                  tabIndex={-1}
                  onClick={cancelCurrentScreen}
                  title="Remove current screen from stack (Ctrl+X)"
                >
                  ✕ Cancel Current
                </Button>
                {!editingPurchase && (
                  <Button
                    type="button"
                    onClick={clearFormState}
                    variant="outlined"
                    tabIndex={-1}
                    color="warning"
                    sx={{ px: 3, py: 1.5 }}
                  >
                    Clear Form
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  variant="outlined"
                  tabIndex={-1}
                  sx={{ px: 3, py: 1.5 }}
                >
                  Back to List
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="contained"
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                  onClick={(ev) => {
                    if (purchaseSubmitInFlightRef.current || isSubmitting) {
                      ev.preventDefault();
                      ev.stopPropagation();
                    }
                  }}
                  sx={{
                    px: 4,
                    py: 1.5,
                    bgcolor: 'secondary.main',
                    pointerEvents: isSubmitting ? 'none' : 'auto',
                    '&:hover': { bgcolor: 'secondary.dark' }
                  }}
                >
                  {isSubmitting
                    ? (editingPurchase ? 'Updating...' : 'Saving...')
                    : (editingPurchase ? 'Update Purchase' : 'Save')}
                </Button>
              </Box>
            </Box>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  return (
    <>
      {currentView === 'list' ? renderPurchaseListView() : renderPurchaseCreateView()}


      {/* Add Supplier Modal */}
      <Dialog
        open={showCustomerForm}
        onClose={handleCloseCustomerForm}
        disableAutoFocus
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: 'white',
          px: 3, py: 2.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              width: 40, height: 40,
              backdropFilter: 'blur(4px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <PersonIcon sx={{ fontSize: 22, color: '#fff' }} />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, fontSize: '1.1rem' }}>
                Add New Supplier Account
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 500, fontSize: '0.78rem' }}>
                Create a new supplier profile and ledger account
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseCustomerForm}
            sx={{ color: 'white', opacity: 0.85, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>

            {/* Inline Quick Add Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', bgcolor: '#ffffff', p: 1.2, px: 2, borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                ✨ Quick Add:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button size="small" variant="outlined" startIcon={<BusinessIcon />} onClick={() => setShowCustomerCategoryPopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', '&:hover': { bgcolor: '#dcfce7', borderColor: '#86efac' } }}>
                  + Category
                </Button>
                <Button size="small" variant="outlined" startIcon={<PersonIcon />} onClick={() => setShowCustomerTypePopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6', '&:hover': { bgcolor: '#ede9fe', borderColor: '#c4b5fd' } }}>
                  + Type
                </Button>
                <Button size="small" variant="outlined" startIcon={<LocationOnIcon />} onClick={() => setShowCityPopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#fffbeb', borderColor: '#fde68a', color: '#92400e', '&:hover': { bgcolor: '#fef3c7', borderColor: '#fcd34d' } }}>
                  + City
                </Button>
              </Box>
            </Box>

            {/* Single Form Box */}
            <Box sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)' }}>
              {/* Strict 2-Column CSS Grid Layout */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2.2 }}>
                {/* Row 1 */}
                <TextField
                  fullWidth
                  required
                  inputRef={customerNameInputRefPurchases}
                  label="Account Name"
                  name="cus_name"
                  value={customerFormData.cus_name}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter account name"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#4f46e5' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  required
                  label="Primary Phone"
                  name="cus_phone_no"
                  type="tel"
                  value={customerFormData.cus_phone_no}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter primary phone number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 2 */}
                <TextField
                  fullWidth
                  label="Secondary Phone"
                  name="cus_phone_no2"
                  type="tel"
                  value={customerFormData.cus_phone_no2}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter secondary phone number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  required
                  label="Address"
                  name="cus_address"
                  value={customerFormData.cus_address}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter complete address"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LocationOnIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 3 - Account Category & Account Type */}
                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={customerCategories.map(cat => ({ id: cat.cus_cat_id, title: cat.cus_cat_title }))}
                  value={customerCategories.map(c => ({ id: c.cus_cat_id, title: c.cus_cat_title })).find(o => o.id === customerFormData.cus_category) || null}
                  onChange={(event, newValue) => {
                    setCustomerFormData(prev => ({ ...prev, cus_category: newValue ? newValue.id : '' }));
                  }}
                  onHighlightChange={(event, option) => { highlightedCategoryRef.current = option; }}
                  getOptionLabel={(option) => option.title || ''}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Supplier Category"
                      required
                      placeholder="Select category"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          const opt = highlightedCategoryRef.current;
                          if (opt) {
                            setCustomerFormData(prev => ({ ...prev, cus_category: opt.id }));
                          } else if (!customerFormData.cus_category && customerCategories.length) {
                            setCustomerFormData(prev => ({ ...prev, cus_category: customerCategories[0].cus_cat_id }));
                          }
                        }
                      }}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#059669', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(5, 150, 105, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#059669', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BusinessIcon sx={{ fontSize: 16, color: '#059669' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={customerTypes.map(type => ({ id: type.cus_type_id, title: type.cus_type_title }))}
                  value={customerTypes.map(t => ({ id: t.cus_type_id, title: t.cus_type_title })).find(o => o.id === customerFormData.cus_type) || null}
                  onChange={(event, newValue) => {
                    setCustomerFormData(prev => ({ ...prev, cus_type: newValue ? newValue.id : '' }));
                  }}
                  onHighlightChange={(event, option) => { highlightedTypeRef.current = option; }}
                  getOptionLabel={(option) => option.title || ''}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  open={customerTypeOpenPurchases}
                  onOpen={() => setCustomerTypeOpenPurchases(true)}
                  onClose={() => setCustomerTypeOpenPurchases(false)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={customerTypeInputRefPurchases}
                      label="Account Type"
                      required
                      placeholder="Select type"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          const opt = highlightedTypeRef.current;
                          if (opt) {
                            setCustomerFormData(prev => ({ ...prev, cus_type: opt.id }));
                            setCustomerTypeOpenPurchases(false);
                          } else if (!customerFormData.cus_type && customerTypes.length) {
                            setCustomerFormData(prev => ({ ...prev, cus_type: customerTypes[0].cus_type_id }));
                          }
                        }
                      }}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#7c3aed', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(124, 58, 237, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#7c3aed', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PersonIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                {/* Row 4 - City & Reference */}
                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={cities.map(city => ({ id: city.city_id, title: city.city_name }))}
                  value={cities.map(c => ({ id: c.city_id, title: c.city_name })).find(o => o.id === customerFormData.city_id) || null}
                  onChange={(event, newValue) => {
                    setCustomerFormData(prev => ({ ...prev, city_id: newValue ? newValue.id : '' }));
                  }}
                  onHighlightChange={(event, option) => { highlightedCityRef.current = option; }}
                  getOptionLabel={(option) => option.title || ''}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="City"
                      placeholder="Select city"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          const opt = highlightedCityRef.current;
                          if (opt) {
                            setCustomerFormData(prev => ({ ...prev, city_id: opt.id }));
                          } else if (!customerFormData.city_id && cities.length) {
                            setCustomerFormData(prev => ({ ...prev, city_id: cities[0].city_id }));
                          }
                        }
                      }}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(217, 119, 6, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#d97706', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LocationOnIcon sx={{ fontSize: 16, color: '#d97706' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <TextField
                  fullWidth
                  label="Reference"
                  name="cus_reference"
                  value={customerFormData.cus_reference}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter reference number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#0284c7', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(2, 132, 199, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#0284c7', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 5 - CNIC & NTN Number */}
                <TextField
                  fullWidth
                  label="CNIC"
                  name="CNIC"
                  value={customerFormData.CNIC}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter CNIC number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#e11d48', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(225, 29, 72, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#e11d48', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#e11d48' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="NTN Number"
                  name="NTN_NO"
                  value={customerFormData.NTN_NO}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter NTN number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#0d9488', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(13, 148, 136, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#0d9488', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#0d9488' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 6 - Opening Balance & Account Info */}
                <TextField
                  fullWidth
                  disabled
                  label="Opening Balance"
                  name="cus_balance"
                  type="number"
                  inputProps={{ readOnly: true }}
                  value={customerFormData.cus_balance}
                  onChange={handleCustomerFormChange}
                  placeholder="Balance is non-editable"
                  sx={{
                    bgcolor: '#f8fafc',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#e2e8f0', borderWidth: '1.5px' },
                    },
                    '& .MuiInputLabel-root': { color: '#94a3b8', fontWeight: 500 }
                  }}
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AttachMoneyIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Account Info"
                  name="cus_account_info"
                  value={customerFormData.cus_account_info}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter account information"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(37, 99, 235, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#2563eb', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 7 - Name in Urdu & Other Information */}
                <TextField
                  fullWidth
                  label="Name in Urdu"
                  name="name_urdu"
                  value={customerFormData.name_urdu}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter name in Urdu"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#9333ea', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(147, 51, 234, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#9333ea', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#9333ea' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Other Information"
                  name="other"
                  value={customerFormData.other}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter other information"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomer(); }}
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#475569', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(71, 85, 105, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#475569', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.82rem' }}>
            Fields marked with <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> are required
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button onClick={handleCloseCustomerForm} sx={{ color: '#64748b', fontWeight: 600, px: 3, py: 1, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomer}
              variant="contained"
              disabled={isSubmittingCustomer}
              startIcon={isSubmittingCustomer ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                textTransform: 'none',
                px: 3.5, py: 1.1,
                borderRadius: '10px',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.38)',
                '&:hover': { background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)', boxShadow: '0 6px 20px rgba(79, 70, 229, 0.5)' }
              }}
            >
              {isSubmittingCustomer ? 'Adding...' : 'Add Supplier'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* View Purchase Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={handleCloseViewDialog} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 2 }}>
          <ReceiptIcon />
          Purchase Receipt - #{viewingPurchase?.sequentialId || viewingPurchase?.pur_id}
        </DialogTitle>

        <DialogContent sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingPurchase && (
            <Box id="purchase-invoice" sx={{ width: '100%', maxWidth: PURCHASE_INVOICE_PREVIEW_MAX_WIDTH, mx: 'auto', bgcolor: 'white', p: 3, mt: 2 }}>
              <PurchaseInvoiceA4Document bill={viewingPurchase} ctx={purchasePrintCtx} />
            </Box>
          )}
        </DialogContent>

        <Box id="printable-invoice-a4-view" sx={{ width: '100%', bgcolor: 'white', display: 'none' }} />
        <Box id="printable-invoice-thermal-view" sx={{ width: '80mm', bgcolor: 'white', display: 'none', mx: 'auto', p: 1 }} />
        <style>{`
          @media print {
            body.print-a4-view *, body.print-thermal-view * { visibility: hidden !important; }
            
            /* Collapse layout container height to prevent blank page generation */
            body.print-a4-view .dashboard-layout-root,
            body.print-thermal-view .dashboard-layout-root {
              height: 0 !important;
              max-height: 0 !important;
              overflow: hidden !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            body.print-a4-view #printable-invoice-a4-view, body.print-a4-view #printable-invoice-a4-view * { visibility: visible !important; height: auto !important; }
            body.print-thermal-view #printable-invoice-thermal-view, body.print-thermal-view #printable-invoice-thermal-view * { visibility: visible !important; }
            body.print-a4-view #printable-invoice-a4-view {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              z-index: 999999 !important;
              background: #fff !important;
            }
            body.print-a4-view #printable-invoice-a4-view * { position: static !important; }
            body.print-thermal-view #printable-invoice-thermal-view {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={handleCloseViewDialog} sx={{ textTransform: 'none' }}>Close</Button>
          <Button
            startIcon={isDownloadingPurchasePdf ? <CircularProgress size={16} /> : <PdfIcon />}
            onClick={() => handleDownloadPurchasePdf(viewingPurchase)}
            disabled={!viewingPurchase || isDownloadingPurchasePdf}
            sx={{ textTransform: 'none' }}
          >
            {isDownloadingPurchasePdf ? 'PDF…' : 'Download PDF'}
          </Button>
          <Button startIcon={<PrintIcon />} onClick={() => handlePrintViewReceipt(PURCHASE_SHEET_PRINT_MODE)} sx={{ textTransform: 'none' }}>Print A5</Button>
          <Button startIcon={<PrintIcon />} onClick={() => handlePrintViewReceipt('THERMAL')} sx={{ textTransform: 'none' }}>Print Thermal</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Account Category Popup */}
      <Dialog
        open={showCustomerCategoryPopup}
        onClose={() => setShowCustomerCategoryPopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: PURCHASE_ENTRY_HEADER_GRADIENT,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add Account Category
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new account category
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCustomerCategoryPopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="Account Category Title"
              value={customerCategoryFormData.cus_cat_title}
              onChange={(e) => setCustomerCategoryFormData({ cus_cat_title: e.target.value })}
              disabled={isAddingCustomerCategory}
              placeholder="Enter account category title"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCustomerCategoryPopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCustomerCategory}
            disabled={isAddingCustomerCategory}
            sx={{
              background: PURCHASE_ENTRY_HEADER_GRADIENT,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #388e3c 30%, #1b5e20 90%)',
              }
            }}
          >
            {isAddingCustomerCategory ? 'Adding...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Popup */}
      <Dialog open={showAddProductPopup} onClose={() => setShowAddProductPopup(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)', backdropFilter: 'blur(20px)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } }}>
        <DialogTitle sx={{ background: 'linear-gradient(45deg, #2196F3 30%, #9C27B0 90%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
              <PackageIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add New Product</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product in your inventory</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductPopup(false)} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.1)' }, transition: 'all 0.2s ease-in-out' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          <Box sx={{ p: 3, pb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', bgcolor: 'white' }}>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setShowAddProductCategoryPopup(true)}
              sx={{ borderColor: '#2196F3', color: '#2196F3', '&:hover': { borderColor: '#1976D2', backgroundColor: 'rgba(33,150,243,0.04)' } }}>
              Add Category
            </Button>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setShowAddProductSubCategoryPopup(true)}
              sx={{ borderColor: '#9C27B0', color: '#9C27B0', '&:hover': { borderColor: '#7B1FA2', backgroundColor: 'rgba(156,39,176,0.04)' } }}>
              Add Subcategory
            </Button>
          </Box>
          <Box sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Basic Information */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #2196F3', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#2196F3' }} />
                Basic Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <TextField fullWidth required label="Product Title"
                    value={addProductFormData.pro_title}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_title: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter product title"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={3} label="Description"
                    value={addProductFormData.pro_description}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_description: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter product description"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
            {/* Category & Classification */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #9C27B0', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#9C27B0' }} />
                Category &amp; Classification
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 45%', minWidth: '280px' }}>
                  <Autocomplete
                    options={categories}
                    getOptionLabel={(opt) => opt.cat_name || ''}
                    value={categories.find(c => c.cat_id === addProductFormData.cat_id) || null}
                    onChange={(_, v) => setAddProductFormData(prev => ({ ...prev, cat_id: v?.cat_id || '', sub_cat_id: '' }))}
                    inputValue={productCatInput}
                    onInputChange={(_, v) => setProductCatInput(v)}
                    disabled={isAddingProduct}
                    renderInput={(params) => <TextField {...params} label="Category" required placeholder="Select category" />}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '60px', bgcolor: 'white', px: 2 }, '& .MuiInputLabel-root': { fontWeight: 500 } }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '280px' }}>
                  <Autocomplete
                    options={subcategories.filter(s => s.cat_id === addProductFormData.cat_id)}
                    getOptionLabel={(opt) => opt.sub_cat_name || ''}
                    value={subcategories.find(s => s.sub_cat_id === addProductFormData.sub_cat_id) || null}
                    onChange={(_, v) => setAddProductFormData(prev => ({ ...prev, sub_cat_id: v?.sub_cat_id || '' }))}
                    inputValue={productSubCatInput}
                    onInputChange={(_, v) => setProductSubCatInput(v)}
                    disabled={isAddingProduct || !addProductFormData.cat_id}
                    renderInput={(params) => <TextField {...params} label="Subcategory" required placeholder="Select subcategory" disabled={!addProductFormData.cat_id} />}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '60px', bgcolor: 'white', px: 2 }, '& .MuiInputLabel-root': { fontWeight: 500 } }}
                  />
                </Box>
              </Box>
            </Box>
            {/* Pricing Information */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: `2px solid ${BRAND.primary.blue}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: BRAND.primary.blue }} />
                Pricing Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Purchase Cost" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_crate}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_crate: e.target.value, pro_cost_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Sale Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_sale_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_sale_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Base Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_baser_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_baser_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Cost Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_cost_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_cost_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
            {/* Inventory Details */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #d97706', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#d97706' }} />
                Inventory Details
              </Typography>
              <Grid container spacing={2.5}>
                {[
                  { label: 'Stock Quantity', field: 'pro_stock_qnty', placeholder: '0', type: 'number' },
                  { label: 'Low Stock Alert Qty', field: 'low_stock_quantity', placeholder: '10', type: 'number' },
                  { label: 'Unit', field: 'pro_unit', placeholder: 'e.g., pieces, kg', type: 'text' },
                ].map(({ label, field, placeholder, type }) => (
                  <Grid item xs={12} sm={6} md={4} key={field}>
                    <TextField fullWidth label={label} type={type}
                      value={addProductFormData[field]}
                      onChange={(e) => setAddProductFormData(prev => ({ ...prev, [field]: e.target.value }))}
                      disabled={isAddingProduct} placeholder={placeholder}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <TextField fullWidth label="Packing"
                    value={addProductFormData.pro_packing}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_packing: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter packing information"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, minHeight: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, borderTop: '1px solid #e2e8f0', bgcolor: 'white', justifyContent: 'flex-end' }}>
          <Button onClick={() => setShowAddProductPopup(false)} variant="outlined"
            sx={{ borderColor: '#cbd5e1', color: '#64748b', padding: '8px 24px', borderRadius: 1.5, textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f1f5f9' } }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddProductQuick} disabled={isAddingProduct}
            startIcon={isAddingProduct ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{ background: 'linear-gradient(45deg, #2196f3, #9c27b0)', px: 4, py: 1, borderRadius: 1.5, textTransform: 'none', fontWeight: 600, boxShadow: 3, transition: 'all 0.2s ease-in-out', '&:hover': { background: 'linear-gradient(45deg, #1976d2, #7b1fa2)', boxShadow: 6, transform: 'translateY(-2px)' }, '&:disabled': { background: 'linear-gradient(45deg, #90caf9, #ce93d8)', color: 'rgba(255,255,255,0.7)' } }}>
            {isAddingProduct ? 'Saving...' : 'Create Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Category Popup */}
      <Dialog open={showAddProductCategoryPopup} onClose={() => setShowAddProductCategoryPopup(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ background: PURCHASE_ENTRY_HEADER_GRADIENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 36, height: 36 }}><FolderIcon /></Avatar>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Add Product Category</Typography>
          </Box>
          <IconButton onClick={() => setShowAddProductCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField
            fullWidth required autoFocus
            label="Category Name"
            value={addProductCategoryName}
            onChange={(e) => setAddProductCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddProductCategory(e)}
            disabled={isAddingProductCategory}
            placeholder="Enter category name"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductCategory} disabled={isAddingProductCategory}
            sx={{ background: PURCHASE_ENTRY_HEADER_GRADIENT, textTransform: 'none' }}>
            {isAddingProductCategory ? 'Adding...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Sub Category Popup */}
      <Dialog open={showAddProductSubCategoryPopup} onClose={() => setShowAddProductSubCategoryPopup(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ background: 'linear-gradient(45deg, #7c3aed 30%, #6d28d9 90%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 36, height: 36 }}><FolderOpenIcon /></Avatar>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Add Product Sub Category</Typography>
          </Box>
          <IconButton onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={addProductSubCategoryFormData.cat_id}
                label="Category"
                onChange={(e) => setAddProductSubCategoryFormData(prev => ({ ...prev, cat_id: e.target.value }))}
                disabled={isAddingProductSubCategory}
              >
                {categories.map(c => <MenuItem key={c.cat_id} value={c.cat_id}>{c.cat_name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              fullWidth required
              label="Sub Category Name"
              value={addProductSubCategoryFormData.sub_cat_name}
              onChange={(e) => setAddProductSubCategoryFormData(prev => ({ ...prev, sub_cat_name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProductSubCategory(e)}
              disabled={isAddingProductSubCategory}
              placeholder="Enter subcategory name"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductSubCategory} disabled={isAddingProductSubCategory}
            sx={{ background: 'linear-gradient(45deg, #7c3aed 30%, #6d28d9 90%)', textTransform: 'none' }}>
            {isAddingProductSubCategory ? 'Adding...' : 'Add Sub Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Type Popup */}
      <Dialog
        open={showCustomerTypePopup}
        onClose={() => setShowCustomerTypePopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add Account Type
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new account type
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCustomerTypePopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="Account Type Title"
              value={customerTypeFormData.cus_type_title}
              onChange={(e) => setCustomerTypeFormData({ cus_type_title: e.target.value })}
              disabled={isAddingCustomerType}
              placeholder="Enter account type title"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCustomerTypePopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCustomerType}
            disabled={isAddingCustomerType}
            sx={{
              background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976d2 30%, #7b1fa2 90%)',
              }
            }}
          >
            {isAddingCustomerType ? 'Adding...' : 'Add Type'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* City Popup */}
      <Dialog
        open={showCityPopup}
        onClose={() => setShowCityPopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <MapPinIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add City
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new city
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCityPopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="City Name"
              value={cityFormData.city_name}
              onChange={(e) => setCityFormData({ city_name: e.target.value })}
              disabled={isAddingCity}
              placeholder="Enter city name"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCityPopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCity}
            disabled={isAddingCity}
            sx={{
              background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #f57c00 30%, #ef6c00 90%)',
              }
            }}
          >
            {isAddingCity ? 'Adding...' : 'Add City'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'white',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <ReceiptIcon />
          Purchase Receipt Preview
        </DialogTitle>

        <DialogContent sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: '80vh', overflow: 'auto' }}>
          {currentBillData && (
            <Box id="receipt-preview" className="thermal-receipt" sx={{ width: '100%', maxWidth: PURCHASE_INVOICE_PREVIEW_MAX_WIDTH, mx: 'auto', bgcolor: 'white', p: 3, mt: 2 }}>
              <PurchaseInvoiceA4Document bill={currentBillData} ctx={purchasePrintCtx} />
            </Box>
          )}
        </DialogContent>

        {/* Hidden printable containers (copied into before print) */}
        <Box id="printable-invoice-a4-purchase" sx={{ width: '100%', bgcolor: 'white', display: 'none' }} />
        <Box id="printable-invoice-thermal-purchase" sx={{ width: '80mm', bgcolor: 'white', display: 'none', mx: 'auto', p: 1 }} />

        {/* Print CSS for purchases (show only printable container when printing) */}
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

            body.print-a4 #printable-invoice-a4-purchase, body.print-a4 #printable-invoice-a4-purchase * { visibility: visible !important; height: auto !important; }
            body.print-thermal #printable-invoice-thermal-purchase, body.print-thermal #printable-invoice-thermal-purchase * { visibility: visible !important; }
            body.print-a4 #printable-invoice-a4-purchase {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              z-index: 999999 !important;
              background: #fff !important;
            }
            body.print-a4 #printable-invoice-a4-purchase * { position: static !important; }
            body.print-thermal #printable-invoice-thermal-purchase {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }} className="no-print">
          <Button
            onClick={() => setReceiptDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Close
          </Button>
          <Button
            onClick={() => handleSendWhatsApp(currentBillData, 'receipt-preview')}
            disabled={isSendingWhatsApp || !currentBillData?.customer?.cus_phone_no}
            title={!currentBillData?.customer?.cus_phone_no ? 'No phone number on file' : 'Send receipt via WhatsApp'}
            sx={{ textTransform: 'none' }}
          >
            {isSendingWhatsApp ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {isSendingWhatsApp ? 'Sending...' : '📲 WhatsApp'}
          </Button>
          <Button
            startIcon={isDownloadingPurchasePdf ? <CircularProgress size={16} /> : <PdfIcon />}
            onClick={() => handleDownloadPurchasePdf(currentBillData)}
            disabled={!currentBillData || isDownloadingPurchasePdf}
            sx={{ textTransform: 'none' }}
          >
            {isDownloadingPurchasePdf ? 'PDF…' : 'Download PDF'}
          </Button>
          <Button
            startIcon={<PrintIcon />}
            onClick={() => handlePrintReceipt(PURCHASE_SHEET_PRINT_MODE, true)}
            sx={{ textTransform: 'none' }}
          >
            Print A5
          </Button>
          <Button
            startIcon={<PrintIcon />}
            onClick={() => handlePrintReceipt('THERMAL', true)}
            sx={{ textTransform: 'none' }}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vehicle Management Dialog */}
      <Dialog
        open={vehicleDialogOpen}
        onClose={handleCloseVehicleDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            overflow: 'visible'
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2.5,
          px: 3,
          fontSize: '1.3rem',
          fontWeight: 600,
          position: 'relative'
        }}>
          <TruckIcon sx={{ fontSize: '1.8rem' }} />
          {editingVehicle ? 'Edit Vehicle Details' : 'Add New Vehicle'}
        </DialogTitle>

        <DialogContent sx={{ pt: 4, px: 3 }}>
          <Grid container spacing={2.5}>
            {/* Vehicle Number */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#1976D2' }}>
                Vehicle Information
              </Typography>
              <TextField
                fullWidth
                label="Vehicle Number"
                value={vehicleFormData.vehicle_no}
                onChange={(e) => handleVehicleFormChange('vehicle_no', e.target.value)}
                required
                placeholder="e.g., ABC-123 or HST-2567"
                variant="outlined"
                error={vehicleFormData.vehicle_no === '' && vehicleDialogOpen}
                helperText={vehicleFormData.vehicle_no === '' && vehicleDialogOpen ? 'Vehicle number is required' : ''}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TruckIcon sx={{ color: '#1976D2', mr: 1 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    }
                  }
                }}
              />
            </Grid>

            {/* Vehicle Type */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#1976D2' }}>Vehicle Type</InputLabel>
                <Select
                  value={vehicleFormData.vehicle_type}
                  onChange={(e) => handleVehicleFormChange('vehicle_type', e.target.value)}
                  label="Vehicle Type"
                  sx={{
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2196F3'
                    }
                  }}
                >
                  <MenuItem value="Truck">🚚 Truck</MenuItem>
                  <MenuItem value="Van">📦 Van</MenuItem>
                  <MenuItem value="Pickup">🚛 Pickup</MenuItem>
                  <MenuItem value="Container">📮 Container</MenuItem>
                  <MenuItem value="Other">❓ Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Driver Information */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#1976D2' }}>
                Driver Information
              </Typography>
            </Grid>

            {/* Driver Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Driver Name"
                value={vehicleFormData.driver_name}
                onChange={(e) => handleVehicleFormChange('driver_name', e.target.value)}
                required
                placeholder="Full name of the driver"
                variant="outlined"
                error={vehicleFormData.driver_name === '' && vehicleDialogOpen}
                helperText={vehicleFormData.driver_name === '' && vehicleDialogOpen ? 'Driver name is required' : ''}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: '#1976D2', mr: 1 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    }
                  }
                }}
              />
            </Grid>

            {/* Driver Phone */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Driver Phone Number"
                value={vehicleFormData.driver_phone}
                onChange={(e) => handleVehicleFormChange('driver_phone', e.target.value)}
                placeholder="e.g., +92-300-1234567"
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon sx={{ color: '#1976D2', mr: 1 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#2196F3'
                    }
                  }
                }}
              />
            </Grid>

            {/* Info Alert */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Alert
                severity="info"
                sx={{
                  bgcolor: '#E3F2FD',
                  color: '#1565C0',
                  '& .MuiAlert-icon': { color: '#1976D2' }
                }}
              >
                ℹ️ Make sure all vehicle and driver information is accurate before saving.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>

        <Divider sx={{ my: 1 }} />

        <DialogActions sx={{ px: 3, py: 2.5, display: 'flex', gap: 1 }}>
          <Button
            onClick={handleCloseVehicleDialog}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              px: 2.5
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveVehicle}
            variant="contained"
            startIcon={editingVehicle ? <EditIcon /> : <AddIcon />}
            sx={{
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                boxShadow: '0 8px 16px rgba(25, 118, 210, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
          </Button>
        </DialogActions>
      </Dialog>

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />
    </>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <CircularProgress />
        </div>
      </DashboardLayout>
    }>
      <PurchasesPageContent />
    </Suspense>
  );
}