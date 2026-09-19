'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, useRef, useLayoutEffect } from 'react';
import { getCreatedByName } from '@/lib/date-helper';
import { BRAND } from '@/lib/brand-theme';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
import SaveProgressBackdrop from '../components/save-progress-backdrop';
import { notifyLedgerDataChanged } from '@/lib/ledger-tabs';

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  Chip,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';

import {

  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingDown as TrendingDownIcon,
  CreditCard as CreditCardIcon,
  Inventory as PackageIcon,
  Clear as ClearIcon,
  Person as PersonIcon,
  FilterList as FilterIcon,
  MonetizationOn as MoneyIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  LocationOn as MapPinIcon,
  Business as BusinessIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Cancel as CancelIcon,
  LocalShipping as ShippingIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Use for MUI `type="number"` (editable) — no commas. Empty string for 0 keeps optional fields clear. */
const toNumberInputValue = (val) => {
  const n = parseFloat(val);
  if (Number.isNaN(n) || n === 0) return '';
  return n;
};

/** Use for disabled `type="number"` summary fields — always show a valid number (including 0). */
const toReadOnlyNumberInput = (val) => {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return 0;
  return n;
};

const ORDER_PRODUCT_LIST_LIMIT = 50;

function filterOrderProducts(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  const out = [];
  for (let i = 0; i < options.length && out.length < ORDER_PRODUCT_LIST_LIMIT; i += 1) {
    if (!q) {
      out.push(options[i]);
      continue;
    }
    const title = String(options[i].pro_title || '').toLowerCase();
    const code = String(options[i].pro_code || '').toLowerCase();
    if (title.includes(q) || code.includes(q)) out.push(options[i]);
  }
  return out;
}

function filterOrderCustomers(options, inputValue) {
  const q = String(inputValue || '').toLowerCase().trim();
  if (!q) return options;
  return options.filter((o) =>
    (o.cus_name || '').toLowerCase().includes(q) ||
    (o.cus_phone_no || '').toLowerCase().includes(q) ||
    (o.cus_phone_no2 || '').toLowerCase().includes(q)
  );
}

function filterOrderStores(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  if (!q) return options;
  return options.filter((o) => String(o.store_name || '').toLowerCase().includes(q));
}

function filterOrderCustomerTypes(options, inputValue) {
  const q = String(inputValue || '').toLowerCase().trim();
  if (!q) return options;
  return options.filter((o) => String(o.cus_type_title || '').toLowerCase().includes(q));
}

/** Same Customer Type list as the Sale page */
const ORDER_PAGE_CUSTOMER_TYPE_RULES = [
  { label: 'Walk in Customer', match: /walk\s*in?\s*cust/i },
  { label: 'Factories', match: /^factories?$/i },
  { label: 'Sarya Shop', match: /sarya\s*shops?/i },
  { label: 'Bloak', match: /^bloak$|^block$/i },
  { label: 'Solar', match: /^solar$/i },
  { label: 'Cement', match: /^cement$/i },
  { label: 'Welders', match: /^welders?$/i },
  { label: 'Homes', match: /^homes?$/i },
];

function filterOrderPageCustomerTypes(allTypes) {
  if (!Array.isArray(allTypes)) return [];
  const picked = [];
  for (let order = 0; order < ORDER_PAGE_CUSTOMER_TYPE_RULES.length; order += 1) {
    const rule = ORDER_PAGE_CUSTOMER_TYPE_RULES[order];
    const found = allTypes.find((t) => rule.match.test(String(t.cus_type_title || '').trim()));
    if (found && !picked.some((p) => p.cus_type_id === found.cus_type_id)) {
      picked.push(found);
    }
  }
  return picked;
}

function getFocusedAutocompleteOption() {
  const el = document.querySelector(
    '.MuiAutocomplete-popper .MuiAutocomplete-option.Mui-focused, .MuiAutocomplete-popper .MuiAutocomplete-option[aria-selected="true"]'
  );
  if (!el) return null;
  const idx = Number.parseInt(el.getAttribute('data-option-index'), 10);
  return Number.isFinite(idx) ? idx : null;
}

function findOrderInput(id, extraSelector) {
  const byId = document.getElementById(id);
  if (byId) {
    if (byId.matches?.('input, textarea, button, select, [tabindex]')) return byId;
    return byId.querySelector?.('input, textarea, button, select') || byId;
  }
  return extraSelector ? document.querySelector(extraSelector) : null;
}

function focusOrderInput(el) {
  if (!el) return false;
  const input = el.matches?.('input, textarea, button, select')
    ? el
    : (el.querySelector?.('input, textarea, button, select') || el);
  input.focus();
  if (typeof input.select === 'function') input.select();
  return document.activeElement === input;
}

function commitDropdownOnTab(e, highlighted, applyValue, focusNext) {
  if (e.shiftKey || (e.key !== 'Tab' && e.key !== 'Enter')) return false;
  e.preventDefault();
  e.stopPropagation();
  e.nativeEvent?.stopImmediatePropagation?.();
  e.currentTarget?.blur?.();
  if (highlighted) applyValue(highlighted);
  const tryFocus = () => {
    const el = typeof focusNext === 'function' ? focusNext() : document.querySelector(focusNext);
    return focusOrderInput(el);
  };
  window.setTimeout(() => {
    if (tryFocus()) return;
    window.setTimeout(tryFocus, 60);
  }, 40);
  return true;
}

const ORDER_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: { xs: 2, md: 2.5 },
  width: '100%',
};

const ORDER_FILTER_FIELD_SX = {
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

const ORDER_STATS_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(3, 1fr)',
    lg: 'repeat(6, 1fr)',
  },
  gap: 1.5,
  width: '100%',
};

const ORDER_VIEW_TOGGLE_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  p: '3px',
  gap: 0.5,
  bgcolor: '#f1f5f9',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
};

const ORDER_VIEW_TOGGLE_BTN_SX = (active) => ({
  px: 2.25,
  py: 0.85,
  minWidth: 92,
  borderRadius: '8px',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  boxShadow: 'none',
  transition: 'all 0.2s ease',
  ...(active
    ? {
        bgcolor: '#fff',
        color: BRAND.primary.blue,
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.1)',
        '&:hover': { bgcolor: '#fff', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)' },
      }
    : {
        bgcolor: 'transparent',
        color: '#64748b',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.6)', color: '#475569' },
      }),
});

const ORDER_PAGE_CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const ORDER_ENTRY_LABEL_SX = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#64748b',
  lineHeight: '20px',
  height: 20,
  mb: 0.75,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const ORDER_ENTRY_CONTROL_SX = {
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

const ORDER_ENTRY_CELL_SX = {
  minWidth: 0,
  width: '100%',
};

const ORDER_ENTRY_ROW1_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 1.05fr) minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1.05fr) minmax(0, 1.15fr)',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

const ORDER_ENTRY_ROW2_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr 1fr',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'minmax(0, 2.35fr) minmax(0, 1.15fr) minmax(0, 0.7fr) minmax(0, 0.85fr) minmax(0, 0.85fr) minmax(0, 0.7fr) 44px',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

const ORDER_EXCEL_TABLE_SX = {
  minWidth: 1200,
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid #cbd5e1',
    py: 0.75,
    px: 1.25,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
  },
};

const ORDER_EXCEL_HEAD_SX = {
  bgcolor: '#e2e8f0',
  color: '#334155',
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

const ORDER_NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(u);
      } catch {
        /* ignore parse errors */
      }
    }
  }, []);

  const initialType = searchParams ? (searchParams.get('type') || 'ORDER') : 'ORDER';
  const initialView = searchParams ? (searchParams.get('view') || 'list') : 'list';

  // ========== SCREEN MANAGEMENT STATE ==========
  const [screenStack, setScreenStack] = useState([]);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(-1);
  const [showScreenIndicator, setShowScreenIndicator] = useState(false);

  // Flag to track when we're restoring screen state
  const [isRestoringScreen, setIsRestoringScreen] = useState(false);

  // State management
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBill, setSavingBill] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');

  const beginSaving = (message) => {
    setSavingBill(true);
    setSaveStatusMessage(message);
  };

  const updateSaveStatus = (message) => {
    setSaveStatusMessage(message);
  };

  const endSaving = () => {
    setSavingBill(false);
    setSaveStatusMessage('');
  };

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBillType, setFilterBillType] = useState(initialType);
  const [showTrashOrders, setShowTrashOrders] = useState(initialType === 'ORDER_TRASH');
  const [filterStore, setFilterStore] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterBalanceStatus, setFilterBalanceStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bill view state
  const [viewBillDialog, setViewBillDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [currentView, setCurrentView] = useState(initialView);
  const lastCreateUrlRef = useRef('');

  useLayoutEffect(() => {
    if (searchParams?.get('view') === 'create') {
      setCurrentView('create');
    }
  }, [searchParams]);

  // Handle URL query parameter for view and type
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const typeParam = searchParams?.get('type');

    if (viewParam === 'create') {
      setCurrentView('create');
      setBillType(typeParam || 'ORDER');
      if (stores.length > 0) {
        setFormSelectedStore(stores[0]);
      }

      const createKey = searchParams.toString();
      if (lastCreateUrlRef.current !== createKey) {
        lastCreateUrlRef.current = createKey;
        setEditSaleId(null);
        setFormSelectedCustomer(null);
        setSelectedCustomerType(null);
        setProductTableData([]);
        setPaymentData({
          cash: '',
          bank: '',
          bankAccountId: '',
          totalCashReceived: 0,
          discount: '',
          labour: '',
          deliveryCharges: '',
          notes: ''
        });
        setProductFormData({
          quantity: '',
          rate: '',
          amount: 0,
          stock: 0
        });
        setFormSelectedProduct(null);
        setTransportOptions([]);
        setNewTransport({ amount: 0, accountId: '' });
        setScreenStack([{
          formSelectedCustomer: null,
          formSelectedStore: stores.length > 0 ? stores[0] : null,
          productTableData: [],
          paymentData: {
            cash: '',
            bank: '',
            bankAccountId: '',
            totalCashReceived: 0,
            discount: '',
            labour: '',
            deliveryCharges: '',
            notes: ''
          },
          billType: typeParam || 'ORDER',
          formSelectedProduct: null,
          productFormData: {
            quantity: '',
            rate: '',
            amount: 0,
            stock: 0
          },
          newTransport: { amount: 0, accountId: '' },
          transportAccounts: [],
          transportOptions: [],
          timestamp: new Date().toLocaleTimeString(),
          customerName: 'New Order'
        }]);
        setCurrentScreenIndex(0);
      }
    } else {
      lastCreateUrlRef.current = '';
    }

    if (typeParam) {
      setBillType(typeParam);
      setFilterBillType(typeParam);
      setShowTrashOrders(typeParam === 'ORDER_TRASH');
    } else if (viewParam !== 'create') {
      setBillType('ORDER');
      setFilterBillType('ORDER');
      setShowTrashOrders(false);
    }
  }, [searchParams, stores]);

  // WhatsApp state
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  useEffect(() => {
    // Primary list mode toggle: active orders vs trashed orders.
    setFilterBillType(showTrashOrders ? 'ORDER_TRASH' : 'ORDER');
  }, [showTrashOrders]);

  // Sale return state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [returnFormData, setReturnFormData] = useState({
    sale_id: '',
    cus_id: '',
    total_amount: '',
    discount: '',
    payment: '',
    payment_type: 'CASH',
    debit_account_id: '',
    credit_account_id: '',
    loader_id: '',
    shipping_amount: '',
    bill_type: 'BILL',
    reason: '',
    reference: '',
    return_details: []
  });
  const [debitAccountSearchTerm, setDebitAccountSearchTerm] = useState('');
  const [creditAccountSearchTerm, setCreditAccountSearchTerm] = useState('');

  // Form state for sales creation
  const [formSelectedCustomer, setFormSelectedCustomer] = useState(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState(null); // customer type filter in form
  const orderPageCustomerTypeOptions = useMemo(
    () => filterOrderPageCustomerTypes(customerTypes),
    [customerTypes]
  );
  const [formSelectedProduct, setFormSelectedProduct] = useState(null);
  const [formSelectedStore, setFormSelectedStore] = useState(null);
  const customerTypeHighlightRef = useRef(null);
  const customerHighlightRef = useRef(null);
  const productHighlightRef = useRef(null);
  const storeHighlightRef = useRef(null);

  // Product form state
  const [productFormData, setProductFormData] = useState({
    quantity: '',
    rate: '',
    amount: 0,
    stock: 0
  });

  // Product table state
  const [productTableData, setProductTableData] = useState([]);

  // Per-product dropdown 'eye' visibility state (which options show purchase rate)
  const [visibleCrates, setVisibleCrates] = useState([]);
  const toggleVisibleCrate = (proId) => {
    setVisibleCrates(prev => {
      const exists = prev.includes(proId);
      return exists ? prev.filter(id => id !== proId) : [...prev, proId];
    });
  };

  // Transport state
  const [transportOptions, setTransportOptions] = useState([]);
  const [transportAccounts, setTransportAccounts] = useState([]);
  const [newTransport, setNewTransport] = useState({
    amount: 0,
    accountId: ''
  });

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState([]);

  // Cash account state (system cash account, not customer)
  const [cashAccount, setCashAccount] = useState(null);

  // Payment and calculation state
  const [paymentData, setPaymentData] = useState({
    cash: '',
    bank: '',
    bankAccountId: '',
    totalCashReceived: 0,
    discount: '',
    labour: '',
    deliveryCharges: '',
    notes: ''
  });

  // Bill type state
  const [billType, setBillType] = useState(initialType);

  // Customer creation popup state
  const [customerPopupOpen, setCustomerPopupOpen] = useState(false);
  const [customerTypeOpen, setCustomerTypeOpen] = useState(false);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const customerNameInputRef = useRef(null);

  // Open customer popup and focus Account Name first (do NOT pre-select Account Type)
  const handleOpenCustomerPopup = (preferredType = 'customer') => {
    setNewCustomer(prev => ({ ...prev, cus_type: '' }));
    setCustomerPopupOpen(true);
    setTimeout(() => {
      setCustomerTypeOpen(false);
      setTimeout(() => customerNameInputRef.current?.focus(), 50);
    }, 80);
  };

  // Popup states for adding new category, type, and city
  const [showCustomerCategoryPopup, setShowCustomerCategoryPopup] = useState(false);
  const [showCustomerTypePopup, setShowCustomerTypePopup] = useState(false);
  const [showCityPopup, setShowCityPopup] = useState(false);
  const [customerCategoryFormData, setCustomerCategoryFormData] = useState({ cus_cat_title: '' });
  const [customerTypeFormData, setCustomerTypeFormData] = useState({ cus_type_title: '' });
  const [cityFormData, setCityFormData] = useState({ city_name: '' });
  const [isAddingCustomerCategory, setIsAddingCustomerCategory] = useState(false);
  const [isAddingCustomerType, setIsAddingCustomerType] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isAddingCity, setIsAddingCity] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    cus_name: '',
    cus_phone_no: '',
    cus_phone_no2: '',
    cus_reference: '',
    cus_account_info: '',
    cus_address: '',
    other: '',
    cus_category: '',
    cus_type: '',
    cus_balance: 0,
    CNIC: '',
    NTN_NO: '',
    name_urdu: '',
    city_id: ''
  });

  // Additional filter states
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Helper functions
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // ========== SCREEN MANAGEMENT FUNCTIONS ==========

  // Initialize first screen on component mount
  useEffect(() => {
    const initialState = {
      // Customer and store selection
      formSelectedCustomer: null,
      formSelectedStore: null,

      // Product table (empty for new order)
      productTableData: [],

      // Payment data
      paymentData: {
        cash: '',
        bank: '',
        bankAccountId: '',
        totalCashReceived: 0,
        discount: '',
        labour: '',
        deliveryCharges: '',
        notes: ''
      },

      // Bill type
      billType: 'ORDER',

      // Product form
      formSelectedProduct: null,
      productFormData: {
        quantity: '',
        rate: '',
        amount: 0,
        stock: 0
      },

      // Transport
      newTransport: { amount: 0, accountId: '' },
      transportAccounts: [],
      transportOptions: [],

      // Metadata
      timestamp: new Date().toLocaleTimeString(),
      customerName: 'New Order'
    };

    // Set the initial screen stack with screen 1
    setScreenStack([initialState]);
    setCurrentScreenIndex(0);
    console.log('✅ Screen 1 initialized for orders');
  }, []); // Run only once on component mount

  // Capture current form state (deep copy to avoid reference issues)
  const captureScreenState = () => {
    const state = {
      // Customer and store selection
      formSelectedCustomer: formSelectedCustomer ? { ...formSelectedCustomer } : null,
      selectedCustomerType: selectedCustomerType ? { ...selectedCustomerType } : null,
      formSelectedStore: formSelectedStore ? { ...formSelectedStore } : null,

      // Product table (deep copy array)
      productTableData: JSON.parse(JSON.stringify(productTableData)),

      // Payment data (deep copy)
      paymentData: JSON.parse(JSON.stringify(paymentData)),

      // Bill type
      billType: billType,

      // Product form
      formSelectedProduct: formSelectedProduct ? { ...formSelectedProduct } : null,
      productFormData: JSON.parse(JSON.stringify(productFormData)),

      // Transport
      newTransport: JSON.parse(JSON.stringify(newTransport)),
      transportAccounts: transportAccounts.map(t => ({ ...t })),
      transportOptions: transportOptions.map(t => ({ ...t })),

      // Metadata
      timestamp: new Date().toLocaleTimeString(),
      customerName: formSelectedCustomer?.cus_name || 'New Order'
    };

    console.log('📸 Order screen state captured:', state);
    return state;
  };

  // Restore form state (ensure all updates happen)
  const restoreScreenState = (state) => {
    if (!state) {
      console.warn('⚠️ No state to restore');
      return;
    }

    // Set flag to prevent automatic fetching during restoration
    setIsRestoringScreen(true);

    // Restore all state at once to ensure consistency
    setFormSelectedCustomer(state.formSelectedCustomer);
    setSelectedCustomerType(state.selectedCustomerType || null);
    setFormSelectedStore(state.formSelectedStore);
    setProductTableData(state.productTableData || []);
    setPaymentData(state.paymentData || {
      cash: '',
      bank: '',
      bankAccountId: '',
      totalCashReceived: 0,
      discount: '',
      labour: '',
      deliveryCharges: '',
      notes: ''
    });
    setBillType(state.billType || 'ORDER');
    setFormSelectedProduct(state.formSelectedProduct);
    setProductFormData(state.productFormData || {
      quantity: '',
      rate: '',
      amount: 0,
      stock: 0
    });
    setNewTransport(state.newTransport || { amount: 0, accountId: '' });
    setTransportAccounts(state.transportAccounts || []);
    setTransportOptions(state.transportOptions || []);

    // Clear the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      setIsRestoringScreen(false);
    }, 100);
  };

  // Clear form to new order state
  const clearFormState = () => {
    console.log('🧹 Clearing order form state');
    setFormSelectedCustomer(null);
    setSelectedCustomerType(null);
    setFormSelectedProduct(null);
    setFormSelectedStore(null);
    setProductTableData([]);
    setPaymentData({
      cash: '',
      bank: '',
      bankAccountId: '',
      totalCashReceived: 0,
      discount: '',
      labour: '',
      deliveryCharges: '',
      notes: ''
    });
    setBillType('ORDER');
    setProductFormData({
      quantity: '',
      rate: '',
      amount: 0,
      stock: 0
    });
    setNewTransport({ amount: 0, accountId: '' });
    // Note: transportAccounts are global and should not be cleared
    setTransportOptions([]);
    setShowScreenIndicator(true);
    setTimeout(() => setShowScreenIndicator(false), 1000);
    showSnackbar('📋 Order form cleared - ready for new entry', 'info');
  };

  // Open new screen (Ctrl+Right)
  const openNewScreen = useCallback(() => {
    console.log('➡️ OPENING NEW ORDER SCREEN');
    console.log('📷 Current state before capture:', {
      customer: formSelectedCustomer?.cus_name,
      products: productTableData.length,
      totalAmount: paymentData
    });

    const currentState = captureScreenState();
    const newStack = screenStack.slice(0, currentScreenIndex + 1);

    // Ensure new screen has current transport accounts
    const newScreenState = {
      ...currentState,
      transportAccounts: transportAccounts.map(t => ({ ...t })),
      transportOptions: transportOptions.map(t => ({ ...t }))
    };

    newStack.push(newScreenState);

    console.log('📚 New stack created:', newStack.length, 'screens');

    setScreenStack(newStack);
    setCurrentScreenIndex(newStack.length - 1);

    // NOW clear form for the new blank screen (but keep transport accounts)
    clearFormState();
    showSnackbar(`📋 Order Screen ${newStack.length} | Starting fresh (previous state saved)`, 'info');
  }, [formSelectedCustomer, selectedCustomerType, formSelectedStore, productTableData, paymentData, billType, formSelectedProduct, productFormData, newTransport, transportAccounts, transportOptions, currentScreenIndex, screenStack]);

  // Go back to previous screen (Ctrl+Left) - NO AUTO-CLEAR, only navigate if possible
  const goToPreviousScreen = useCallback(() => {
    console.log('⬅️ GOING TO PREVIOUS ORDER SCREEN');
    console.log('📊 Current stack:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length,
      stateAtCurrentIndex: screenStack[currentScreenIndex]
    });

    if (currentScreenIndex > 0) {
      const previousIndex = currentScreenIndex - 1;
      const previousState = screenStack[previousIndex];

      console.log('🔄 Restoring from index:', previousIndex);
      console.log('🔄 State to restore:', previousState);

      restoreScreenState(previousState);
      setCurrentScreenIndex(previousIndex);
      showSnackbar(`📋 Order Screen ${previousIndex + 1} | ${previousState.customerName}`, 'info');
    } else if (currentScreenIndex === 0) {
      // At first screen - can't go back, just notify user
      console.log('ℹ️ Already at first screen, cannot go back');
      showSnackbar('📋 You are at the first screen. Click "Cancel Current" to discard or "Cancel" to save later.', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Go forward to next screen (Ctrl+Right after going back) - NO AUTO-CLEAR
  const goToNextScreen = useCallback(() => {
    console.log('➡️ GOING TO NEXT ORDER SCREEN');
    if (currentScreenIndex < screenStack.length - 1) {
      const nextIndex = currentScreenIndex + 1;
      const nextState = screenStack[nextIndex];
      restoreScreenState(nextState);
      setCurrentScreenIndex(nextIndex);
      showSnackbar(`📋 Order Screen ${nextIndex + 1} | ${nextState.customerName}`, 'info');
    } else {
      console.log('ℹ️ Already at last screen');
      showSnackbar('📋 You are at the last screen. Press Ctrl+Right to create a new screen.', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Smart forward navigation - Go to next screen OR create new if at the end
  const handleForwardNavigation = useCallback(() => {
    console.log('➡️ SMART FORWARD NAVIGATION');
    console.log('📊 Current status:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length,
      atEnd: currentScreenIndex >= screenStack.length - 1
    });

    if (currentScreenIndex < screenStack.length - 1) {
      // Navigate to next existing screen
      goToNextScreen();
    } else {
      // At the end - create new screen
      openNewScreen();
    }
  }, [currentScreenIndex, screenStack, goToNextScreen, openNewScreen]);

  // Cancel current screen (Ctrl+X) - Remove current screen and go to previous
  const cancelCurrentScreen = useCallback(() => {
    console.log('❌ CANCELLING CURRENT ORDER SCREEN');
    console.log('📊 Current stack before cancel:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length
    });

    if (screenStack.length <= 1) {
      // Only one screen - just clear it
      console.log('ℹ️ Only one screen - clearing form');
      clearFormState();
      showSnackbar('📋 Order form cleared', 'info');
      return;
    }

    if (currentScreenIndex === 0) {
      // At first screen - remove it and shift everything
      console.log('🗑️ Removing first screen, shifting remaining screens');
      const newStack = screenStack.slice(1);
      const newIndex = 0;

      setScreenStack(newStack);
      setCurrentScreenIndex(newIndex);

      if (newStack.length > 0) {
        restoreScreenState(newStack[newIndex]);
        showSnackbar(`📋 Cancelled Screen 1, now on Screen ${newIndex + 1}`, 'info');
      } else {
        clearFormState();
        showSnackbar('📋 All screens cancelled', 'info');
      }
    } else {
      // Remove current screen and go to previous
      console.log('🗑️ Removing current screen, going to previous');
      const newStack = [
        ...screenStack.slice(0, currentScreenIndex),
        ...screenStack.slice(currentScreenIndex + 1)
      ];
      const newIndex = currentScreenIndex - 1;

      setScreenStack(newStack);
      setCurrentScreenIndex(newIndex);
      restoreScreenState(newStack[newIndex]);
      showSnackbar(`📋 Cancelled Screen ${currentScreenIndex + 1}, back to Screen ${newIndex + 1}`, 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Keyboard event handler for screen navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle shortcuts when in create view
      if (currentView !== 'create') return;

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault();
            handleForwardNavigation();
            break;
          case 'ArrowLeft':
            event.preventDefault();
            goToPreviousScreen();
            break;
          case 'x':
          case 'X':
            event.preventDefault();
            cancelCurrentScreen();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentView, handleForwardNavigation, goToPreviousScreen, cancelCurrentScreen]);

  // Auto-select first store when stores load
  useEffect(() => {
    if (!formSelectedStore && Array.isArray(stores) && stores.length > 0) {
      setFormSelectedStore(stores[0]);
    }
  }, [stores]);

  // Auto-filter bank accounts when customers, categories, or types change
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0 && customerTypes.length > 0) {
      console.log('🔍 Auto-filtering bank accounts for orders...');
      fetchBankAccounts(customers);
    }
  }, [customers, customerCategories, customerTypes]);

  // Extract cash account when customers + categories are ready
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0) {
      const cashCat = customerCategories.find(c => c.cus_cat_title?.toLowerCase().includes('cash'));
      if (cashCat) {
        const found = customers.find(c => c.cus_category === cashCat.cus_cat_id);
        setCashAccount(found || null);
      }
    }
  }, [customers, customerCategories]);

  // Auto-save when customer changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on customer change - Order Screen ${currentScreenIndex + 1}`);
    }
  }, [formSelectedCustomer]);

  // Auto-clear selected customer if their type does not match the chosen type filter
  useEffect(() => {
    if (formSelectedCustomer && selectedCustomerType) {
      if (formSelectedCustomer.cus_type !== selectedCustomerType.cus_type_id) {
        setFormSelectedCustomer(null);
      }
    }
  }, [selectedCustomerType]);

  // Auto-save when customer type changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on customer type change - Order Screen ${currentScreenIndex + 1}`);
    }
  }, [selectedCustomerType]);

  // Auto-save when store changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on store change - Order Screen ${currentScreenIndex + 1}`);
    }
  }, [formSelectedStore]);

  // Auto-save when product table changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on product table change - Order Screen ${currentScreenIndex + 1}`);
    }
  }, [productTableData]);

  // Auto-save when payment data changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on payment data change - Order Screen ${currentScreenIndex + 1}`);
    }
  }, [paymentData]);

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Handle product selection
  const handleProductSelect = (selectedProduct) => {
    console.log('🔍 Product selected:', selectedProduct);
    setFormSelectedProduct(selectedProduct);

    if (selectedProduct) {
      const saleRate = parseFloat(selectedProduct.pro_sale_price) || parseFloat(selectedProduct.pro_baser_price) || 0;
      // Update product form data with selected product details
      setProductFormData(prev => ({
        ...prev,
        quantity: 1, // Default quantity to 1
        rate: saleRate,
        stock: 0, // always derive from store-wise stock when available
        amount: saleRate // Calculate amount (rate * 1)
      }));

      // If a store is selected, fetch store-wise stock
      if (formSelectedStore?.storeid) {
        fetchStoreStock(formSelectedStore.storeid, selectedProduct.pro_id);
      }
    } else {
      // Reset form data when no product is selected
      setProductFormData({
        quantity: '',
        rate: '',
        amount: 0,
        stock: 0
      });
    }
  };

  // Fetch store-wise stock for a product
  const fetchStoreStock = async (storeId, productId) => {
    try {
      const res = await fetch(`/api/store-stock?store_id=${storeId}&pro_id=${productId}`);
      if (!res.ok) throw new Error('Failed to fetch store stock');
      const data = await res.json();
      console.log('📦 Store stock raw response:', data);

      // Normalize various possible response shapes
      let payload = data;
      if (payload && typeof payload === 'object') {
        payload = payload.data ?? payload.value ?? payload.stock ?? payload;
      }

      let stockQty = 0;
      if (typeof payload === 'number') {
        stockQty = payload;
      } else if (Array.isArray(payload)) {
        const first = payload[0] ?? {};
        stockQty = parseInt(first.stock_quantity ?? first.quantity ?? first.stock ?? 0);
      } else if (payload && typeof payload === 'object') {
        stockQty = parseInt(payload.stock_quantity ?? payload.quantity ?? payload.stock ?? 0);
      }

      // Subtract quantities already added in current table for the same product & store
      const reservedQty = productTableData
        .filter(r => r.pro_id === productId && r.storeid === storeId)
        .reduce((sum, r) => sum + (parseFloat(r.qnty ?? r.quantity ?? 0) || 0), 0);

      // Allow negative stock - removed Math.max constraint
      const available = (isNaN(stockQty) ? 0 : stockQty) - reservedQty;
      console.log('📦 Store stock normalized:', { stockQty, reservedQty, available });

      setProductFormData(prev => ({ ...prev, stock: available }));
    } catch (e) {
      console.error('Failed to load store stock', e);
      setProductFormData(prev => ({ ...prev, stock: 0 }));
    }
  };

  // When store or product changes, refresh store-wise stock
  useEffect(() => {
    if (formSelectedStore?.storeid && formSelectedProduct?.pro_id) {
      fetchStoreStock(formSelectedStore.storeid, formSelectedProduct.pro_id);
    }
  }, [formSelectedStore, formSelectedProduct]);

  // Handle quantity change
  const handleQuantityChange = (newQuantity) => {
    const quantity = parseFloat(newQuantity) || 0;
    const rate = productFormData.rate;
    const amount = quantity * rate;

    setProductFormData(prev => ({
      ...prev,
      quantity: quantity,
      amount: amount
    }));
  };

  // Handle rate change
  const handleRateChange = (newRate) => {
    const rate = parseFloat(newRate) || 0;
    const quantity = productFormData.quantity;
    const amount = quantity * rate;

    setProductFormData(prev => ({
      ...prev,
      rate: rate,
      amount: amount
    }));
  };

  // Handle adding product to table
  const handleAddProductToTable = () => {
    // Validate required fields
    if (!formSelectedProduct) {
      showSnackbar('Please select a product', 'error');
      return;
    }
    if (!formSelectedStore) {
      showSnackbar('Please select a store', 'error');
      return;
    }
    if (productFormData.quantity <= 0) {
      showSnackbar('Please enter a valid quantity', 'error');
      return;
    }
    if (productFormData.rate <= 0) {
      showSnackbar('Please enter a valid rate', 'error');
      return;
    }

    // Always add as a new line item (don't merge with existing products)
    const newProduct = {
      id: Date.now(), // Temporary ID for table row (unique for each addition)
      pro_id: formSelectedProduct.pro_id,
      pro_title: formSelectedProduct.pro_title,
      storeid: formSelectedStore.storeid,
      store_name: formSelectedStore.store_name,
      quantity: productFormData.quantity,
      rate: productFormData.rate,
      amount: productFormData.amount,
      stock: productFormData.stock
    };

    setProductTableData(prev => [...prev, newProduct]);
    showSnackbar('Product added to cart', 'success');

    // Reset form
    setFormSelectedProduct(null);
    // Don't reset store - it should remain selected
    setProductFormData({
      quantity: '',
      rate: '',
      amount: 0,
      stock: 0
    });

    // Auto-focus on Product field after adding product to allow adding more items
    setTimeout(() => {
      const productInput = document.querySelector('input[placeholder*="Select product"]');
      if (productInput) {
        productInput.focus();
      }
    }, 100);
  };

  // Handle removing product from table
  const handleRemoveProductFromTable = (productId) => {
    setProductTableData(prev => prev.filter(item => item.id !== productId));
    showSnackbar('Product removed from table', 'success');
  };

  const calculateTotalAmount = () => {
    const total = productTableData.reduce((total, product) => total + (parseFloat(product.amount) || 0), 0);
    return total;
  };

  // Calculate subtotal (products + transport)
  const calculateSubtotal = () => {
    const productTotal = calculateTotalAmount();
    const transportTotal = calculateTransportTotal();
    return productTotal + transportTotal;
  };

  // Calculate grand total (products + labour + delivery (including transport) - discount)
  const calculateGrandTotal = () => {
    const productTotal = calculateTotalAmount();
    const labour = parseFloat(paymentData.labour) || 0;
    const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
    const transportTotal = calculateTransportTotal();
    const totalDelivery = deliveryCharges + transportTotal; // Transport added to delivery
    const discount = parseFloat(paymentData.discount) || 0;
    return productTotal + labour + totalDelivery - discount;
  };

  // Get display bill number: B-1 for BILL, O-1 for ORDER/ORDER_TRASH, fallback to sale_id
  const getBillDisplayNo = (sale) => {
    const bn = sale?.bill_number;
    const bt = sale?.bill_type || 'ORDER';
    const prefix = bt === 'BILL' ? 'B' : ['ORDER', 'ORDER_TRASH'].includes(bt) ? 'O' : bt === 'QUOTATION' ? 'Q' : 'O';
    return bn ? `${prefix}-${bn}` : `#${sale?.sale_id || ''}`;
  };

  // Calculate balance (grand total - total cash received)
  const calculateBalance = () => {
    const grandTotal = calculateGrandTotal();
    const totalCashReceived = parseFloat(paymentData.totalCashReceived) || 0;
    return grandTotal - totalCashReceived;
  };

  // Handle payment data changes
  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save bill to database
  const handleSaveBill = async () => {
    const hasCash = parseFloat(paymentData.cash || 0) > 0;
    const hasBank = parseFloat(paymentData.bank || 0) > 0;
    if (hasCash || hasBank) {
      const authOk = await requireAuth();
      if (!authOk) return;
    }
    try {
      // If bill type is SALE_RETURN, guide user to proper return flow
      if (billType === 'SALE_RETURN') {
        showSnackbar('Use Return Sale from the list to process sale returns.', 'info');
        setCurrentView('list');
        return;
      }

      // Validation
      if (!formSelectedCustomer) {
        showSnackbar('Please select a customer', 'error');
        return;
      }

      if (productTableData.length === 0) {
        showSnackbar('Please add at least one product', 'error');
        return;
      }

      if (!formSelectedStore) {
        showSnackbar('Please select a store', 'error');
        return;
      }

      const totalAmount = calculateTotalAmount();
      const grandTotal = calculateGrandTotal();
      const totalCashReceived = parseFloat(paymentData.totalCashReceived) || 0;

      // Additional validation
      if (totalAmount <= 0) {
        showSnackbar('Total amount must be greater than 0', 'error');
        return;
      }

      console.log('🔍 Frontend - Calculated values:', { totalAmount, grandTotal, totalCashReceived });

      // Prepare sale data
      const transportTotal = calculateTransportTotal();
      const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
      const totalShippingAmount = transportTotal + deliveryCharges;

      // Build split payments array for cash and bank
      const splitPayments = [];
      const cashAmount = parseFloat(paymentData.cash) || 0;
      const bankAmount = parseFloat(paymentData.bank) || 0;

      // Add cash payment if there's any cash
      if (cashAmount > 0) {
        splitPayments.push({
          amount: cashAmount,
          payment_type: 'CASH',
          debit_account_id: null,
          credit_account_id: null,
          reference: 'Cash payment'
        });
      }

      // Add bank payment if there's any bank payment
      if (bankAmount > 0 && paymentData.bankAccountId) {
        splitPayments.push({
          amount: bankAmount,
          payment_type: 'BANK_TRANSFER',
          debit_account_id: paymentData.bankAccountId,
          credit_account_id: null,
          reference: 'Bank payment'
        });
      }

      // Get bank account name for bank_title
      const selectedBankAccount = paymentData.bankAccountId
        ? bankAccounts.find(acc => acc.cus_id === paymentData.bankAccountId)
        : null;

      const saleData = {
        cus_id: formSelectedCustomer.cus_id,
        store_id: formSelectedStore.storeid, // Added store_id for multi-store functionality
        total_amount: grandTotal, // Use grand total instead of just product total
        discount: parseFloat(paymentData.discount) || 0,
        payment: totalCashReceived,
        payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH', // Use first payment type or default to CASH
        cash_payment: cashAmount, // Store cash payment in sale record
        bank_payment: bankAmount, // Store bank payment in sale record
        bank_title: selectedBankAccount?.cus_name || null, // Store bank account name (optional)
        debit_account_id: paymentData.bankAccountId || null,
        credit_account_id: null,
        loader_id: null,
        labour_charges: parseFloat(paymentData.labour) || 0, // Include labour charges
        shipping_amount: totalShippingAmount, // Include both transport and delivery charges
        bill_type: billType || 'BILL',
        reference: paymentData.notes || null,
        is_loaded_order: paymentData.isLoadedOrder || false, // Flag for converted orders
        advance_payment: (billType === 'ORDER' || billType === 'ORDER_TRASH') ? totalCashReceived : 0, // Save advance payment for orders
        sale_details: productTableData.map(product => ({
          pro_id: product.pro_id,
          vehicle_no: null,
          qnty: product.quantity,
          unit: 'PCS', // Default unit
          unit_rate: product.rate,
          total_amount: product.amount,
          discount: 0,
          cus_id: formSelectedCustomer.cus_id
        })),
        transport_details: transportOptions.map(transport => ({
          account_id: transport.accountId,
          amount: transport.amount,
          description: transport.description || 'Transport charges'
        })),
        split_payments: splitPayments, // Keep split_payments for backward compatibility
        updated_by: 1 // Default user ID, should be from auth context
      };

      // Show saving indicator without unmounting the create view / receipt dialog
      beginSaving(editSaleId ? 'Updating order...' : 'Saving order...');

      console.log('🔍 Frontend - Sale data being sent:', saleData);
      console.log('🔍 Frontend - Sale data JSON:', JSON.stringify(saleData, null, 2));

      updateSaveStatus(editSaleId ? 'Updating order on server...' : 'Saving order to server...');
      // Call API
      const response = await fetch('/api/sales', {
        method: editSaleId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editSaleId ? { ...saleData, id: editSaleId } : saleData),
      });

      if (response.ok) {
        const result = await response.json();
        notifyLedgerDataChanged('order');
        updateSaveStatus('Updating ledger & stock...');
        const successMessage = editSaleId ? 'Order updated successfully!' : 'Order saved successfully!';
        showSnackbar(successMessage, 'success');

        const updatingSaleId = editSaleId;
        // Clear edit mode
        setEditSaleId(null);

        const savedSaleId = result.sale_id ?? result.id ?? updatingSaleId;
        let billForPrint = null;

        if (savedSaleId) {
          try {
            updateSaveStatus('Preparing order receipt...');
            const detailRes = await fetch(`/api/sales?id=${savedSaleId}`);
            if (detailRes.ok) {
              billForPrint = await detailRes.json();
            }
          } catch (fetchErr) {
            console.warn('Could not fetch saved order for invoice preview:', fetchErr);
          }
        }

        if (!billForPrint) {
          billForPrint = {
            sale_id: savedSaleId,
            bill_number: result.bill_number ?? null,
            cus_id: formSelectedCustomer.cus_id,
            total_amount: grandTotal,
            discount: parseFloat(paymentData.discount) || 0,
            payment: totalCashReceived,
            payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH',
            cash_payment: cashAmount,
            bank_payment: bankAmount,
            bank_title: selectedBankAccount?.cus_name || null,
            shipping_amount: totalShippingAmount,
            bill_type: billType || 'ORDER',
            reference: paymentData.notes || null,
            created_at: result.created_at || new Date().toISOString(),
            previous_balance: formSelectedCustomer?.cus_balance ?? null,
            customer: formSelectedCustomer,
            sale_details: productTableData.map((product, index) => ({
              sale_detail_id: index + 1,
              pro_id: product.pro_id,
              qnty: product.quantity,
              unit: 'PCS',
              unit_rate: product.rate,
              total_amount: product.amount,
              product: {
                pro_title: product.pro_title || 'N/A'
              }
            })),
            labour: parseFloat(paymentData.labour) || 0,
            labour_charges: parseFloat(paymentData.labour) || 0,
            notes: paymentData.notes || ''
          };
        }

        setCurrentBillData(billForPrint);
        updateSaveStatus('Generating receipt...');
        setReceiptDialogOpen(true);

        // Reset form
        setFormSelectedCustomer(null);
        setFormSelectedProduct(null);
        setFormSelectedStore(null);
        setProductTableData([]);
        setPaymentData({
          cash: 0,
          bank: 0,
          bankAccountId: '',
          totalCashReceived: 0,
          discount: 0,
          labour: 0,
          deliveryCharges: 0,
          notes: ''
        });

        // Refresh list in background without hiding the invoice dialog
        refreshSalesQuietly();
      } else {
        const errorData = await response.json();
        console.error('❌ API Error Response:', errorData);
        console.error('❌ Response Status:', response.status);
        showSnackbar(errorData.error || `Failed to save bill (${response.status})`, 'error');
      }
    } catch (error) {
      console.error('❌ Error saving bill:', error);
      console.error('❌ Error details:', error.message);
      showSnackbar(`Failed to save bill: ${error.message}`, 'error');
    } finally {
      endSaving();
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    console.log('🔍 Component mounted, calling fetchData...');
    fetchData();
  }, []);

  // Re-fetch customers silently when another tab/page saves a customer
  const refreshCustomers = async () => {
    try {
      const res = await fetch('/api/customers?dropdown=true');
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.value || []);
        setCustomers(arr);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const channel = new BroadcastChannel('customers-sync');
    channel.onmessage = () => refreshCustomers();
    return () => channel.close();
  }, []);

  // Open create view preconfigured for Sale Return when flagged (from /dashboard/sale-returns)
  useEffect(() => {
    try {
      const flag = typeof window !== 'undefined' ? localStorage.getItem('openSaleReturnCreate') : null;
      if (flag === '1') {
        setCurrentView('create');
        setBillType('SALE_RETURN');
        localStorage.removeItem('openSaleReturnCreate');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Auto-calculate total cash received when cash or bank changes
  useEffect(() => {
    const cash = parseFloat(paymentData.cash) || 0;
    const bank = parseFloat(paymentData.bank) || 0;
    const totalCashReceived = cash + bank;

    setPaymentData(prev => ({
      ...prev,
      totalCashReceived: totalCashReceived
    }));
  }, [paymentData.cash, paymentData.bank]);

  // Filter customers by category and type for bank accounts
  const filterBankAccountsByCategory = (customers, customerCategories, customerTypes) => {
    console.log('🔍 Filtering bank accounts for orders:');
    console.log('  - Available customers:', customers.length);
    console.log('  - Available categories:', customerCategories.length);
    console.log('  - Available types:', customerTypes.length);

    // Bank accounts: BOTH category AND type must contain "bank"
    const filteredBankAccounts = customers.filter(customer => {
      const categoryInfo = customerCategories.find(cat => cat.cus_cat_id === customer.cus_category);
      const typeInfo = customerTypes.find(t => t.cus_type_id === customer.cus_type);
      const hasBank = categoryInfo && categoryInfo.cus_cat_title.toLowerCase().includes('bank');
      const hasBank2 = typeInfo && typeInfo.cus_type_title.toLowerCase().includes('bank');
      return hasBank && hasBank2;
    });

    console.log(`✅ Filtered ${filteredBankAccounts.length} bank accounts (BOTH category AND type contain 'bank')`);
    return filteredBankAccounts;
  };

  // Bank accounts functions
  const fetchBankAccounts = async (providedCustomers = null) => {
    try {
      let accountsData = providedCustomers;

      if (!accountsData) {
        const response = await fetch('/api/customers?dropdown=true');
        if (response.ok) {
          const customersResponse = await response.json();
          accountsData = customersResponse.value || customersResponse;
        }
      }

      if (Array.isArray(accountsData) && customerCategories.length > 0 && customerTypes.length > 0) {
        // Filter bank accounts using category + type validation
        const bankAccountsData = filterBankAccountsByCategory(accountsData, customerCategories, customerTypes);
        console.log('🏦 Bank accounts found:', bankAccountsData.length);
        setBankAccounts(bankAccountsData);
      } else {
        console.warn('⚠️ Cannot filter bank accounts - missing data');
        setBankAccounts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching bank accounts:', error);
      setBankAccounts([]);
    }
  };

  // Transport functions
  const fetchTransportAccounts = async (providedCustomers = null) => {
    try {
      let accountsData = providedCustomers;

      if (!accountsData) {
        const response = await fetch('/api/customers?dropdown=true');
        if (response.ok) {
          const customersResponse = await response.json();
          accountsData = customersResponse.value || customersResponse;
        }
      }

      if (Array.isArray(accountsData)) {
        // Create a category lookup map for faster filtering
        const categoryMap = new Map();
        customerCategories.forEach(cat => {
          categoryMap.set(cat.cus_cat_id, cat.cus_cat_title.toLowerCase());
        });

        // Filter accounts where category is "Transporter" - optimized
        const transportAccountsData = accountsData.filter(account => {
          const catTitle = categoryMap.get(account.cus_category);
          if (catTitle) {
            return catTitle.includes('transporter') || catTitle.includes('transport');
          }

          // Fallback to type or name if category not found
          const typeTitle = (account.customer_type?.cus_type_title || '').toLowerCase();
          const name = (account.cus_name || '').toLowerCase();
          return typeTitle.includes('transport') || name.includes('transport');
        });

        // Batch state updates to avoid multiple re-renders
        setTransportAccounts(transportAccountsData);

        // Update the current screen with the new transport accounts (synchronous)
        if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
          const updatedState = {
            ...screenStack[currentScreenIndex],
            transportAccounts: transportAccountsData.map(t => ({ ...t })),
            transportOptions: transportOptions.map(t => ({ ...t })),
            timestamp: new Date().toLocaleTimeString()
          };
          const newStack = [...screenStack];
          newStack[currentScreenIndex] = updatedState;
          setScreenStack(newStack);
        }
      } else {
        setTransportAccounts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching transport accounts:', error);
      setTransportAccounts([]);
    }
  };

  // Update transport accounts when customers or categories change
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0 && !isRestoringScreen) {
      fetchTransportAccounts(customers);
    }
  }, [customers, customerCategories, isRestoringScreen]);

  const handleAddTransport = () => {
    if (newTransport.amount <= 0) {
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }
    if (!newTransport.accountId) {
      showSnackbar('Please select a transport account', 'error');
      return;
    }

    // Find the selected account details
    const selectedAccount = transportAccounts.find(account => account.cus_id === parseInt(newTransport.accountId));

    const transport = {
      id: Date.now(),
      name: selectedAccount ? selectedAccount.cus_name : 'Unknown Account',
      amount: parseFloat(newTransport.amount),
      accountId: newTransport.accountId,
      accountName: selectedAccount ? selectedAccount.cus_name : 'Unknown Account'
    };

    setTransportOptions(prev => [...prev, transport]);
    setNewTransport({ amount: 0, accountId: '' });
    showSnackbar('Transport option added', 'success');
  };

  const handleRemoveTransport = (transportId) => {
    setTransportOptions(prev => prev.filter(transport => transport.id !== transportId));
    showSnackbar('Transport option removed', 'success');
  };

  const calculateTransportTotal = () => {
    const total = transportOptions.reduce((sum, transport) => {
      const amount = parseFloat(transport.amount) || 0;
      return sum + amount;
    }, 0);
    return total;
  };

  // Customer creation functions
  // (opening the customer popup is handled by the single `handleOpenCustomerPopup(preferredType)` defined near the top)

  const handleCloseCustomerPopup = () => {
    setCustomerPopupOpen(false);
    setNewCustomer({
      cus_name: '',
      cus_phone_no: '',
      cus_phone_no2: '',
      cus_reference: '',
      cus_account_info: '',
      cus_address: '',
      other: '',
      cus_category: '',
      cus_type: '',
      cus_balance: 0,
      CNIC: '',
      NTN_NO: '',
      name_urdu: '',
      city_id: ''
    });
  };

  const handleCreateCustomer = async () => {
    // Validate required fields
    if (!newCustomer.cus_name.trim()) {
      showSnackbar('Customer name is required', 'error');
      return;
    }
    if (!newCustomer.cus_phone_no.trim()) {
      showSnackbar('Phone number is required', 'error');
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(newCustomer.cus_phone_no.trim())) {
      showSnackbar('Please enter a valid phone number', 'error');
      return;
    }
    if (!newCustomer.cus_category) {
      showSnackbar('Account category is required', 'error');
      return;
    }
    if (!newCustomer.cus_type) {
      showSnackbar('Customer type is required', 'error');
      return;
    }

    try {
      setIsSavingCustomer(true);
      const customerData = {
        cus_name: newCustomer.cus_name.trim(),
        cus_phone_no: newCustomer.cus_phone_no.trim(),
        cus_phone_no2: newCustomer.cus_phone_no2.trim(),
        cus_reference: newCustomer.cus_reference.trim(),
        cus_account_info: newCustomer.cus_account_info.trim(),
        cus_address: newCustomer.cus_address.trim(),
        other: newCustomer.other.trim(),
        cus_category: newCustomer.cus_category,
        cus_type: newCustomer.cus_type,
        cus_balance: parseFloat(newCustomer.cus_balance) || 0,
        CNIC: newCustomer.CNIC.trim(),
        NTN_NO: newCustomer.NTN_NO.trim(),
        name_urdu: newCustomer.name_urdu.trim(),
        city_id: newCustomer.city_id || null
      };

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        const createdCustomer = await response.json();
        showSnackbar('Customer created successfully', 'success');
        handleCloseCustomerPopup();
        // Refresh customers list
        await fetchData();
        // Auto-select the newly created customer in the form
        if (createdCustomer && createdCustomer.cus_id) {
          setFormSelectedCustomer(createdCustomer);
        }
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || errorData.message || 'Error creating customer', 'error');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      showSnackbar('Error creating customer', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting to fetch data...');

      // Fetch sales data first and separately to ensure it's not affected by other API failures
      try {
        const salesRes = await fetch('/api/sales');
        console.log('📡 Sales API response status:', salesRes.status, salesRes.statusText);

        if (salesRes.ok) {
          const salesData = await salesRes.json();
          console.log('🔍 Sales API response:', salesData);
          console.log('🔍 Sales count:', salesData.length);
          console.log('🔍 Sales data type:', typeof salesData);
          console.log('🔍 Sales is array:', Array.isArray(salesData));

          if (Array.isArray(salesData) && salesData.length > 0) {
            console.log('🔍 First sale structure:', {
              sale_id: salesData[0].sale_id,
              hasCustomer: !!salesData[0].customer,
              customerName: salesData[0].customer?.cus_name,
              total_amount: salesData[0].total_amount,
              keys: Object.keys(salesData[0])
            });
          }

          if (!Array.isArray(salesData)) {
            console.error('❌ Sales data is not an array!', salesData);
            setSales([]);
          } else {
            setSales(salesData);
          }
        } else {
          const errorText = await salesRes.text();
          console.error('❌ Sales API error:', salesRes.status, salesRes.statusText);
          console.error('❌ Error response:', errorText);
          setSales([]);
        }
      } catch (salesError) {
        console.error('❌ Sales fetch error:', salesError);
        console.error('❌ Error stack:', salesError.stack);
        setSales([]);
      }

      // Fetch other data in parallel
      const [customersRes, productsRes, customerTypesRes, storesRes, customerCategoriesRes, citiesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/customer-types'),
        fetch('/api/stores'),
        fetch('/api/customer-category'),
        fetch('/api/cities')
      ]);

      // Fetch transport accounts after main data
      await fetchTransportAccounts();

      // Note: fetchBankAccounts will be called via auto-filter effect once customers, categories, and types are loaded

      console.log('📡 All API calls completed');

      if (customersRes.ok) {
        const customersResponse = await customersRes.json();
        console.log('🔍 Customers API response:', customersResponse);
        console.log('🔍 Customers API response type:', typeof customersResponse);
        console.log('🔍 Customers API response is array:', Array.isArray(customersResponse));
        // Handle the API response format: {value: [...]} or direct array
        const customersData = customersResponse.value || customersResponse;
        console.log('🔍 Customers data after processing:', customersData);
        console.log('🔍 Customers data type:', typeof customersData);
        console.log('🔍 Customers data is array:', Array.isArray(customersData));
        console.log('🔍 Customers count:', customersData.length);
        if (customersData.length > 0) {
          console.log('🔍 First customer:', customersData[0]);
        }
        const customersArray = Array.isArray(customersData) ? customersData : [];
        setCustomers(customersArray);
        console.log('🔍 Customers state set successfully');
      } else {
        console.error('❌ Customers API error:', customersRes.status, customersRes.statusText);
        setCustomers([]);
      }
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        console.log('🔍 Products data:', productsData);
        console.log('🔍 Products count:', productsData.length);
        if (productsData.length > 0) {
          console.log('🔍 First product structure:', productsData[0]);
        }
        setProducts(productsData);
      } else {
        console.error('❌ Products API error:', productsRes.status);
      }
      if (customerTypesRes.ok) {
        const customerTypesResponse = await customerTypesRes.json();
        // Handle the API response format: {value: [...]}
        const customerTypesData = customerTypesResponse.value || customerTypesResponse;
        setCustomerTypes(customerTypesData || []);
      } else {
        console.error('❌ Customer types API error:', customerTypesRes.status);
      }
      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        console.log('🔍 Stores response:', storesResponse);
        // Handle the API response format: {success: true, data: [...]}
        const storesData = storesResponse.data || storesResponse;
        console.log('🔍 Stores data:', storesData);
        // Ensure storesData is an array
        if (Array.isArray(storesData)) {
          console.log('✅ Setting stores:', storesData);
          setStores(storesData);
        } else {
          console.error('❌ Stores data is not an array:', storesData);
          setStores([]);
        }
      } else {
        console.error('❌ Stores API error:', storesRes.status);
        setStores([]);
      }
      if (customerCategoriesRes.ok) {
        const customerCategoriesData = await customerCategoriesRes.json();
        setCustomerCategories(customerCategoriesData || []);
      } else {
        console.error('❌ Customer categories API error:', customerCategoriesRes.status);
        setCustomerCategories([]);
      }
      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        console.log('🔍 Cities data:', citiesData);
        setCities(citiesData || []);
      } else {
        console.error('❌ Cities API error:', citiesRes.status);
        setCities([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshSalesQuietly = async () => {
    try {
      const salesRes = await fetch('/api/sales');
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        if (Array.isArray(salesData)) {
          setSales(salesData);
        }
      }
    } catch (error) {
      console.error('Failed to refresh sales list:', error);
    }
  };

  // Handle viewing a bill
  const handleViewBill = async (sale) => {
    console.log('📋 Viewing bill:', sale);

    try {
      // Fetch fresh sale data with all payment details
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch sale details');
      const saleData = await response.json();

      console.log('💰 Sale data with payments:', {
        cash_payment: saleData.cash_payment,
        bank_payment: saleData.bank_payment,
        bank_title: saleData.bank_title,
        payment: saleData.payment,
        split_payments: saleData.split_payments
      });

      setSelectedBill(saleData);
      setViewBillDialog(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      // Fallback to using the data from the list if API call fails
      setSelectedBill(sale);
      setViewBillDialog(true);
    }
  };

  // Handle opening return dialog
  const handleOpenReturnDialog = async (sale) => {
    try {
      // Fetch full sale details with related data
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch sale details');
      const saleData = await response.json();
      const fullSale = Array.isArray(saleData) ? saleData[0] : saleData;

      setSelectedSaleForReturn(fullSale);

      // Populate return form with sale data
      setReturnFormData({
        sale_id: fullSale.sale_id,
        cus_id: fullSale.cus_id,
        total_amount: fullSale.total_amount?.toString() || '',
        discount: fullSale.discount?.toString() || '0',
        payment: fullSale.payment?.toString() || '0',
        payment_type: fullSale.payment_type || 'CASH',
        debit_account_id: fullSale.credit_account_id || '',
        credit_account_id: fullSale.debit_account_id || '',
        loader_id: fullSale.loader_id || '',
        shipping_amount: '0',
        bill_type: fullSale.bill_type || 'BILL',
        reason: '',
        reference: fullSale.reference || '',
        return_details: fullSale.sale_details ? fullSale.sale_details.map(detail => ({
          pro_id: detail.pro_id,
          qnty: detail.qnty,
          unit: detail.unit,
          unit_rate: detail.unit_rate?.toString() || '0',
          total_amount: detail.total_amount?.toString() || '0',
          discount: detail.discount?.toString() || '0'
        })) : []
      });

      // Set account search terms
      if (fullSale.credit_account) {
        setDebitAccountSearchTerm(fullSale.credit_account.cus_name);
      }
      if (fullSale.debit_account) {
        setCreditAccountSearchTerm(fullSale.debit_account.cus_name);
      }

      setReturnDialogOpen(true);
    } catch (error) {
      console.error('Error opening return dialog:', error);
      showSnackbar('Failed to load sale details', 'error');
    }
  };

  // Handle closing return dialog
  const handleCloseReturnDialog = () => {
    setReturnDialogOpen(false);
    setSelectedSaleForReturn(null);
    setReturnFormData({
      sale_id: '',
      cus_id: '',
      total_amount: '',
      discount: '',
      payment: '',
      payment_type: 'CASH',
      debit_account_id: '',
      credit_account_id: '',
      loader_id: '',
      shipping_amount: '',
      bill_type: 'BILL',
      reason: '',
      reference: '',
      return_details: []
    });
    setDebitAccountSearchTerm('');
    setCreditAccountSearchTerm('');
  };

  // Calculate return totals
  const calculateReturnTotal = () => {
    return returnFormData.return_details.reduce((sum, detail) =>
      sum + parseFloat(detail.total_amount || 0), 0
    );
  };

  const calculateReturnNetTotal = () => {
    const totalAmount = calculateReturnTotal();
    const discount = parseFloat(returnFormData.discount || 0);
    return totalAmount - discount;
  };

  // Handle return form input changes
  const handleReturnInputChange = (e) => {
    const { name, value } = e.target;
    setReturnFormData(prev => ({ ...prev, [name]: value }));
  };

  // Remove return detail
  const removeReturnDetail = (index) => {
    setReturnFormData(prev => ({
      ...prev,
      return_details: prev.return_details.filter((_, i) => i !== index)
    }));
  };

  // Update return detail quantity
  const updateReturnDetailQty = (index, newQty) => {
    setReturnFormData(prev => {
      const updated = [...prev.return_details];
      updated[index] = {
        ...updated[index],
        qnty: parseInt(newQty) || 0,
        total_amount: parseFloat(updated[index].unit_rate || 0) * parseInt(newQty || 0)
      };
      return { ...prev, return_details: updated };
    });
  };

  // Handle return submission
  const handleSubmitReturn = async () => {
    try {
      // Validation
      if (!returnFormData.sale_id) {
        showSnackbar('Please select a sale to return', 'error');
        return;
      }

      if (returnFormData.return_details.length === 0) {
        showSnackbar('Please add at least one product to return', 'error');
        return;
      }

      if (!returnFormData.reason || !returnFormData.reason.trim()) {
        showSnackbar('Please enter a reason for the return', 'error');
        return;
      }

      const calculatedTotalAmount = calculateReturnTotal();

      const body = {
        ...returnFormData,
        total_amount: calculatedTotalAmount.toString(),
        updated_by: (() => {
          const raw = currentUser?.user_id ?? currentUser?.id;
          if (raw == null || raw === '') return null;
          const parsed = parseInt(raw, 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })()
      };

      const response = await fetch('/api/sale-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        showSnackbar('Sale return processed successfully', 'success');
        handleCloseReturnDialog();
        // Refresh sales list
        const salesResponse = await fetch('/api/sales');
        if (salesResponse.ok) {
          const salesData = await salesResponse.json();
          setSales(Array.isArray(salesData) ? salesData : []);
        }
      } else {
        const errorData = await response.json();
        showSnackbar('Error: ' + (errorData.error || 'Failed to process return'), 'error');
      }
    } catch (error) {
      console.error('Error processing sale return:', error);
      showSnackbar('Error processing sale return', 'error');
    }
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

  // Handle closing bill view dialog
  const handleCloseBillDialog = () => {
    setViewBillDialog(false);
    setSelectedBill(null);
  };

  // Current bill data for printing (from create view)
  const [currentBillData, setCurrentBillData] = useState(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const handlePrintBill = (mode = 'EXISTING', fromDialog = false, targetBill = null) => {
    try {
      const actualMode = typeof mode === 'string' ? mode : 'EXISTING';
      const className = actualMode === 'THERMAL' 
        ? 'print-thermal' 
        : (actualMode === 'EXISTING' ? 'print-existing' : 'print-a4');
      const isThermal = actualMode === 'THERMAL';

      // Ensure active bill is set for printing
      const activeBill = targetBill || currentBillData || selectedBill;
      if (activeBill) {
        setCurrentBillData(activeBill);
        setSelectedBill(activeBill);
      }

      // Get the printable container
      let printableContainer = actualMode === 'EXISTING'
        ? document.getElementById('printable-invoice')
        : (actualMode === 'THERMAL'
          ? document.getElementById('printable-invoice-thermal')
          : document.getElementById('printable-invoice-a4'));

      // Fallback in case container is not found
      if (!printableContainer) {
        printableContainer = isThermal
          ? document.getElementById('printable-invoice-thermal')
          : (document.getElementById('printable-invoice') || document.getElementById('printable-invoice-a4'));
      }

      if (!printableContainer) {
        console.error('Printable container not found');
        return;
      }

      // If printing from dialog for A4, copy receipt preview content (do NOT overwrite thermal template)
      if (fromDialog && !isThermal) {
        const receiptPreview = document.getElementById('receipt-preview');
        if (receiptPreview && printableContainer) {
          printableContainer.innerHTML = receiptPreview.innerHTML;
        }
      }

      // Move container to visible position temporarily for print
      const originalStyles = {
        position: printableContainer.style.position,
        left: printableContainer.style.left,
        top: printableContainer.style.top,
        visibility: printableContainer.style.visibility,
        display: printableContainer.style.display
      };

      // Make container visible and position it for print
      printableContainer.style.position = 'fixed';
      printableContainer.style.left = '0';
      printableContainer.style.top = '0';
      printableContainer.style.visibility = 'visible';
      printableContainer.style.display = 'block';
      printableContainer.style.zIndex = '9999';
      printableContainer.style.backgroundColor = 'white';

      // Add dynamic style for thermal page size
      let styleId = 'dynamic-print-style';
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      if (isThermal) {
        styleElement.textContent = `
          @media print {
            @page {
              size: 80mm portrait !important;
              margin: 0 !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `;
      } else {
        styleElement.textContent = `
          @media print {
            @page {
              size: A5 portrait !important;
              margin: 0.3cm !important;
            }
          }
        `;
      }

      // Add body class for print styling
      document.body.classList.add(className);

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          // Restore original styles
          printableContainer.style.position = originalStyles.position;
          printableContainer.style.left = originalStyles.left;
          printableContainer.style.top = originalStyles.top;
          printableContainer.style.visibility = originalStyles.visibility;
          printableContainer.style.display = originalStyles.display;
          printableContainer.style.zIndex = '';
          printableContainer.style.backgroundColor = '';

          // Remove body class
          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');
          document.body.classList.remove('print-existing');

          // Remove dynamic style
          if (styleElement) {
            styleElement.remove();
          }
        }, 150);
      }, 150);
    } catch (e) {
      console.error('Print error:', e);
      window.print();
    }
  };

  // Send order receipt via WhatsApp
  const handleSendWhatsApp = async (bill, elementId = 'receipt-preview') => {
    try {
      setIsSendingWhatsApp(true);
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const { opened } = await shareViaWhatsAppDesktop({
        elementId,
        phone: bill?.customer?.cus_phone_no,
      });
      showSnackbar(`✅ ${whatsAppSuccessMessage(opened)}`, 'success');
    } catch (err) {
      showSnackbar(`❌ WhatsApp error: ${err.message}`, 'error');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Filter sales based on search criteria
  const filteredSales = useMemo(() => {
    console.log('🔍 Starting filter with sales count:', sales.length);
    console.log('🔍 Sales is array?', Array.isArray(sales));
    console.log('🔍 Filter criteria:', { searchTerm, filterCustomer, filterBillType, filterStore, filterPaymentType, filterMinAmount, filterMaxAmount, filterBalanceStatus, dateFrom, dateTo });

    // Check if sales array has data
    if (!Array.isArray(sales) || sales.length === 0) {
      console.log('🔍 No sales to filter - returning empty array');
      return [];
    }

    console.log('🔍 Filtering', sales.length, 'sales...');
    const filtered = sales.filter(sale => {
      // All filters are empty by default, so all sales should match
      const q = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        sale.sale_id?.toString().includes(searchTerm) ||
        sale.customer?.cus_name?.toLowerCase().includes(q) ||
        sale.reference?.toLowerCase().includes(q) ||
        sale.customer?.cus_phone_no?.includes(searchTerm) ||
        sale.customer?.cus_address?.toLowerCase().includes(q) ||
        sale.customer?.city?.city_name?.toLowerCase().includes(q);

      const matchesCustomer = filterCustomer === '' ||
        sale.customer?.cus_id?.toString() === filterCustomer;

      const matchesBillType = filterBillType === '' ||
        sale.bill_type === filterBillType;

      // Store filter - check if any sale detail has the store
      const matchesStore = filterStore === '' ||
        (sale.sale_details && sale.sale_details.some(detail =>
          detail.store?.storeid?.toString() === filterStore ||
          detail.store_id?.toString() === filterStore
        ));

      // Payment type filter
      const matchesPaymentType = filterPaymentType === '' ||
        sale.payment_type === filterPaymentType;

      // Amount range filters
      const totalAmount = parseFloat(sale.total_amount || 0);
      const matchesMinAmount = filterMinAmount === '' ||
        totalAmount >= parseFloat(filterMinAmount);
      const matchesMaxAmount = filterMaxAmount === '' ||
        totalAmount <= parseFloat(filterMaxAmount);

      // Balance status filter
      const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
      const matchesBalanceStatus = filterBalanceStatus === '' ||
        (filterBalanceStatus === 'with_balance' && balance > 0) ||
        (filterBalanceStatus === 'without_balance' && balance <= 0) ||
        (filterBalanceStatus === 'overpaid' && balance < 0);

      const matchesDateFrom = dateFrom === '' ||
        (dateFrom && sale.created_at && new Date(sale.created_at) >= new Date(dateFrom));

      const matchesDateTo = dateTo === '' ||
        (dateTo && sale.created_at && new Date(sale.created_at) <= new Date(dateTo));

      const result = matchesSearch && matchesCustomer && matchesBillType && matchesStore &&
        matchesPaymentType && matchesMinAmount && matchesMaxAmount &&
        matchesBalanceStatus && matchesDateFrom && matchesDateTo;

      if (!result) {
        console.log('🔍 Sale', sale.sale_id, 'filtered out:', {
          matchesSearch,
          matchesCustomer,
          matchesBillType,
          matchesStore,
          matchesPaymentType,
          matchesMinAmount,
          matchesMaxAmount,
          matchesBalanceStatus,
          matchesDateFrom,
          matchesDateTo,
          hasCustomer: !!sale.customer,
          saleData: { sale_id: sale.sale_id, total_amount: sale.total_amount }
        });
      }

      return result;
    });

    console.log('🔍 Filtered sales count:', filtered.length, 'out of', sales.length);
    if (filtered.length > 0) {
      console.log('🔍 First filtered sale:', filtered[0]);
    }
    return filtered;
  }, [sales, searchTerm, filterCustomer, filterBillType, filterStore, filterPaymentType, filterMinAmount, filterMaxAmount, filterBalanceStatus, dateFrom, dateTo]);

  console.log('🔍 Filtered sales count:', filteredSales.length);
  console.log('🔍 Sales state:', sales);
  console.log('🔍 Sales state length:', sales.length);

  // Debug sales state changes
  useEffect(() => {
    console.log('🔍 Sales state changed:', sales);
    console.log('🔍 Sales length:', sales.length);
    if (sales.length > 0) {
      console.log('🔍 First sale:', sales[0]);
    }
  }, [sales]);

  // Debug stores state changes
  useEffect(() => {
    console.log('🏪 Stores state changed:', stores);
    console.log('🏪 Stores length:', stores.length);
    console.log('🏪 Stores type:', typeof stores);
    console.log('🏪 Is stores array:', Array.isArray(stores));
  }, [stores]);

  // Debug customers state changes for sales list
  useEffect(() => {
    console.log('👥 Sales List - Customers state changed:', customers);
    console.log('👥 Sales List - Customers length:', customers.length);
    if (customers.length > 0) {
      console.log('👥 Sales List - First customer:', customers[0]);
      console.log('👥 Sales List - All customer types:', customers.map(c => ({
        name: c.cus_name,
        type: c.customer_type?.cus_type_title,
        cus_type: c.cus_type
      })));
    }
  }, [customers]);

  // Debug products state changes for new sale page
  useEffect(() => {
    console.log('📦 New Sale - Products state changed:', products);
    console.log('📦 New Sale - Products length:', products.length);
    if (products.length > 0) {
      console.log('📦 New Sale - First product:', products[0]);
    }
  }, [products]);

  // Debug customers state changes for new sale page
  useEffect(() => {
    console.log('👥 New Sale - Customers state changed:', customers);
    console.log('👥 New Sale - Customers length:', customers.length);
    if (customers.length > 0) {
      console.log('👥 New Sale - First customer:', customers[0]);
      console.log('👥 New Sale - Customer types:', customers.map(c => ({
        name: c.cus_name,
        type: c.customer_type?.cus_type_title
      })));
    }
  }, [customers]);

  // Calculate stats for current mode (active orders or trashed orders)
  const modeBillType = showTrashOrders ? 'ORDER_TRASH' : 'ORDER';
  const modeSales = sales.filter((sale) => sale.bill_type === modeBillType);

  // Stats calculated dynamically based on currently filtered sales
  const statsTotalOrders = filteredSales.length;
  const statsTotalAmount = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);
  const statsTotalDiscount = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0);
  const statsTotalShipping = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.shipping_amount || 0), 0);
  const statsTotalPayment = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.payment || 0), 0);
  const statsTotalBalance = filteredSales.reduce((sum, sale) => {
    const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
    return sum + balance;
  }, 0);

  // Filter and sort sales
  const filteredAndSortedSales = sales
    .filter(sale => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' ||
        sale.customer?.cus_name?.toLowerCase().includes(q) ||
        sale.sale_id?.toString().includes(searchTerm) ||
        sale.reference?.toLowerCase().includes(q) ||
        sale.customer?.cus_phone_no?.includes(searchTerm) ||
        sale.customer?.cus_address?.toLowerCase().includes(q) ||
        sale.customer?.city?.city_name?.toLowerCase().includes(q);
      const matchesCustomer = !selectedCustomer || sale.cus_id === selectedCustomer.cus_id;

      return matchesSearch && matchesCustomer;
    })
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'customer':
          aValue = a.customer?.cus_name || '';
          bValue = b.customer?.cus_name || '';
          break;
        case 'total_amount':
          aValue = parseFloat(a.total_amount || 0);
          bValue = parseFloat(b.total_amount || 0);
          break;
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }

      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return -1 * modifier;
      if (aValue > bValue) return 1 * modifier;
      return 0;
    });

  // Edit sale state
  const [editSaleId, setEditSaleId] = useState(null);

  const handleEdit = async (sale) => {
    try {
      setLoading(true);
      showSnackbar('Loading order details...', 'info');

      // Fetch full details
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch order details');

      const fullSale = await response.json();
      const saleData = Array.isArray(fullSale) ? fullSale[0] : fullSale;

      console.log('📝 Editing sale:', saleData);

      // 1. Set Customer
      setFormSelectedCustomer(saleData.customer);
      let matchingType = null;
      if (saleData.customer && customerTypes.length > 0) {
        matchingType = customerTypes.find(t => t.cus_type_id === saleData.customer.cus_type);
        setSelectedCustomerType(matchingType || null);
      }

      // 2. Set Store (find matching store object)
      const storeId = saleData.store_id || (saleData.sale_details?.[0]?.store_id);
      const store = stores.find(s => s.storeid == storeId) || (stores.length > 0 ? stores[0] : null);
      if (store) setFormSelectedStore(store);

      // 3. Populate Product Table
      const tableData = saleData.sale_details.map((d, index) => ({
        id: Date.now() + index, // Unique ID
        pro_id: d.pro_id,
        pro_title: d.product?.pro_title || d.product?.pro_name || 'Unknown Product',
        storeid: store?.storeid,
        store_name: store?.store_name,
        quantity: parseFloat(d.qnty),
        rate: parseFloat(d.unit_rate),
        amount: parseFloat(d.total_amount),
        stock: 0 // Will be updated by store stock fetch
      }));
      setProductTableData(tableData);

      // 4. Populate Payment Data
      setPaymentData({
        cash: parseFloat(saleData.cash_payment || 0),
        bank: parseFloat(saleData.bank_payment || 0),
        bankAccountId: saleData.debit_account_id || '',
        totalCashReceived: parseFloat(saleData.payment || 0), // This is total of cash + bank
        discount: parseFloat(saleData.discount || 0),
        labour: 0,
        deliveryCharges: parseFloat(saleData.shipping_amount || 0),
        notes: saleData.reference || ''
      });

      // 5. Populate Transport Options
      // Map transport details if they exist on the sale object (need backend support or mapping)
      // Current backend might not return transport_details in the main object easily unless included.
      // Assuming GET includes them or we fallback. 
      // Note: GET route includes split_payments but maybe not transport_details in the top level include?
      // GET route line 201 includes `sale_details`. 
      // The `GET` handler in `route.js` does NOT explicitly include `transport_details` in the Prisma include!
      // So transport options might be lost on edit. I will skip transport population for now or accept it's a limitation.
      setTransportOptions([]);

      // 6. Set Edit Mode
      // Preserve the original bill_type (e.g. ORDER) so we edit the order instead of converting it
      setBillType(saleData.bill_type || 'ORDER');
      setEditSaleId(saleData.sale_id);

      // Initialize screen stack with edit data
      const editInitialState = {
        formSelectedCustomer: saleData.customer,
        selectedCustomerType: matchingType,
        formSelectedStore: store,
        productTableData: tableData,
        paymentData: {
          cash: parseFloat(saleData.cash_payment || 0),
          bank: parseFloat(saleData.bank_payment || 0),
          bankAccountId: saleData.debit_account_id || '',
          totalCashReceived: parseFloat(saleData.payment || 0),
          discount: parseFloat(saleData.discount || 0),
          labour: 0,
          deliveryCharges: parseFloat(saleData.shipping_amount || 0),
          notes: saleData.reference || ''
        },
        billType: saleData.bill_type || 'ORDER',
        formSelectedProduct: null,
        productFormData: {
          quantity: '',
          rate: '',
          amount: 0,
          stock: 0
        },
        newTransport: { amount: 0, accountId: '' },
        transportAccounts: [],
        transportOptions: [],
        timestamp: new Date().toLocaleTimeString(),
        customerName: saleData.customer?.cus_name || 'Edit Order'
      };
      setScreenStack([editInitialState]);
      setCurrentScreenIndex(0);

      // 7. Switch View
      setCurrentView('create');

      showSnackbar('Order loaded for editing', 'success');

    } catch (e) {
      console.error('Error editing sale:', e);
      showSnackbar('Error loading sale details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewOrder = () => {
    // Reset all form states for a clean new order
    setEditSaleId(null);
    setFormSelectedCustomer(null);
    setSelectedCustomerType(null);
    setFormSelectedStore(stores.length > 0 ? stores[0] : null);
    setProductTableData([]);
    setPaymentData({
      cash: '',
      bank: '',
      bankAccountId: '',
      totalCashReceived: 0,
      discount: '',
      labour: '',
      deliveryCharges: '',
      notes: ''
    });
    setProductFormData({
      quantity: '',
      rate: '',
      amount: 0,
      stock: 0
    });
    setFormSelectedProduct(null);
    setTransportOptions([]);
    setNewTransport({ amount: 0, accountId: '' });
    setBillType('ORDER');
    
    // Re-initialize screen stack for new order
    const initialState = {
      formSelectedCustomer: null,
      formSelectedStore: stores.length > 0 ? stores[0] : null,
      productTableData: [],
      paymentData: {
        cash: '',
        bank: '',
        bankAccountId: '',
        totalCashReceived: 0,
        discount: '',
        labour: '',
        deliveryCharges: '',
        notes: ''
      },
      billType: 'ORDER',
      formSelectedProduct: null,
      productFormData: {
        quantity: '',
        rate: '',
        amount: 0,
        stock: 0
      },
      newTransport: { amount: 0, accountId: '' },
      transportAccounts: [],
      transportOptions: [],
      timestamp: new Date().toLocaleTimeString(),
      customerName: 'New Order'
    };
    setScreenStack([initialState]);
    setCurrentScreenIndex(0);
    
    setCurrentView('create');
  };

  const handleBackToList = () => {
    setEditSaleId(null);
    setCurrentView('list');
  };

  const handleDelete = async (sale) => {
    const isTrash = sale.bill_type === 'ORDER_TRASH';
    const targetType = isTrash ? 'ORDER' : 'ORDER_TRASH';
    const actionLabel = isTrash ? 'restore' : 'move to trash';
    if (!confirm(`Are you sure you want to ${actionLabel} order #${sale.sale_id}?`)) return;

    try {
      const response = await fetch('/api/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sale.sale_id, bill_type: targetType }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update order status');
      }

      setSales((prev) =>
        prev.map((s) =>
          s.sale_id === sale.sale_id ? { ...s, bill_type: targetType } : s
        )
      );
      showSnackbar(
        isTrash
          ? `Order #${sale.sale_id} restored to active orders`
          : `Order #${sale.sale_id} moved to trash`,
        'success'
      );
    } catch (error) {
      showSnackbar(error.message || 'Failed to update order status', 'error');
    }
  };

  const handleViewReceipt = async (sale) => {
    try {
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch sale details');
      const saleData = await response.json();
      setCurrentBillData(saleData);
      setReceiptDialogOpen(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      setCurrentBillData(sale);
      setReceiptDialogOpen(true);
    }
  };

  const handleQuickPrint = async (sale) => {
    await handleViewBill(sale);
  };

  // Helper function to get sort label
  const getSortLabel = (value) => {
    const labels = {
      'created_at-desc': 'Newest First',
      'created_at-asc': 'Oldest First',
      'customer-asc': 'Customer A-Z',
      'customer-desc': 'Customer Z-A',
      'total_amount-desc': 'Amount High-Low',
      'total_amount-asc': 'Amount Low-High'
    };
    return labels[value] || 'Newest First';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCustomer(null);
    setSortBy('created_at');
    setSortOrder('desc');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress size={80} />
        </Box>
      </DashboardLayout>
    );
  }

  // Render Sales Create View
  const renderSalesCreateView = () => (
    <DashboardLayout>
      <SaveProgressBackdrop
        open={savingBill}
        message={saveStatusMessage}
        subMessage="Do not close or refresh until the order is saved and the receipt is ready"
      />
      <Container
        maxWidth={false}
        sx={{
          py: 1,
          maxWidth: {
            xs: '100%',           // Mobile: full width
            sm: '100%',           // Small screens: full width  
            md: '100%',           // Medium screens: full width
            lg: '1200px',         // Large screens: reasonable max width
            xl: '1400px'          // Extra large screens: slightly larger max width
          },
          mx: 'auto',             // Center the content
          px: { xs: 2, sm: 3, md: 4 } // Responsive horizontal padding
        }}>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={handleBackToList}
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'primary.dark',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <SearchIcon />
              </IconButton>
              <Box>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                  {editSaleId ? `Edit Order #${editSaleId}` : 'Create New Order'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {editSaleId ? 'Modify products and order details' : 'Select products and create order'}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCustomerPopup}
              sx={{
                borderColor: '#6f42c1',
                color: '#6f42c1',
                '&:hover': {
                  borderColor: '#5a2d91',
                  backgroundColor: '#f8f5ff'
                }
              }}
            >
              Create Customer
            </Button>
          </Box>

          {/* Screen Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                Screen {currentScreenIndex + 1} of {screenStack.length}
              </Typography>
              {showScreenIndicator && (
                <Chip
                  label={`Screen ${currentScreenIndex + 1}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{
                    animation: 'pulse 1s ease-in-out',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                      '100%': { opacity: 1 }
                    }
                  }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Previous Screen (Ctrl+Left)">
                <IconButton
                  onClick={goToPreviousScreen}
                  disabled={currentScreenIndex <= 0}
                  size="small"
                  sx={{
                    color: currentScreenIndex <= 0 ? 'text.disabled' : 'primary.main',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      color: 'white'
                    }
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Next Screen / New Screen (Ctrl+Right)">
                <IconButton
                  onClick={handleForwardNavigation}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      color: 'white'
                    }
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel Current Screen (Ctrl+X)">
                <IconButton
                  onClick={cancelCurrentScreen}
                  size="small"
                  sx={{
                    color: 'error.main',
                    '&:hover': {
                      bgcolor: 'error.light',
                      color: 'white'
                    }
                  }}
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Main Form */}
          <Card>
            <CardContent sx={{ p: 2 }}>
              {/* First Row - Type, Customer, Bill, Date, Reference */}
              <Box sx={ORDER_ENTRY_ROW1_SX}>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      CUSTOMER TYPE
                    </Typography>
                    <Autocomplete
                      id="customer-type-select"
                      size="small"
                      fullWidth
                      sx={{ width: '100%', minWidth: 0 }}
                      options={
                        selectedCustomerType &&
                        !orderPageCustomerTypeOptions.some((t) => t.cus_type_id === selectedCustomerType.cus_type_id)
                          ? [selectedCustomerType, ...orderPageCustomerTypeOptions]
                          : orderPageCustomerTypeOptions
                      }
                      getOptionLabel={(option) => option.cus_type_title || ''}
                      getOptionKey={(option) => option.cus_type_id}
                      value={selectedCustomerType}
                      onChange={(event, newValue) => {
                        setSelectedCustomerType(newValue);
                        if (newValue) {
                          const typeTitle = (newValue.cus_type_title || '').toLowerCase();
                          if (typeTitle.includes('walk')) {
                            const matchingCustomer = customers.find((c) =>
                              c.cus_type === newValue.cus_type_id ||
                              (c.cus_name || '').toLowerCase().includes('walk')
                            );
                            if (matchingCustomer) {
                              setFormSelectedCustomer(matchingCustomer);
                            }
                          }
                        }
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_type_id === value?.cus_type_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onHighlightChange={(_, option) => {
                        if (option) customerTypeHighlightRef.current = option;
                      }}
                      renderInput={(params) => {
                        const prevKeyDown = params.inputProps?.onKeyDown;
                        return (
                        <TextField
                          {...params}
                          id="customer-type-select-input"
                          placeholder="All Types"
                          onFocus={(e) => e.target.select()}
                          inputProps={{
                            ...params.inputProps,
                            id: 'customer-type-select-input',
                            onKeyDown: (e) => {
                              if (!e.shiftKey && (e.key === 'Tab' || e.key === 'Enter')) {
                                const inputValue = e.currentTarget.value || '';
                                const filtered = filterOrderCustomerTypes(orderPageCustomerTypeOptions, inputValue);
                                const idx = getFocusedAutocompleteOption();
                                const pick = customerTypeHighlightRef.current
                                  || (idx != null ? filtered[idx] : null)
                                  || selectedCustomerType;
                                commitDropdownOnTab(
                                  e,
                                  pick,
                                  (val) => setSelectedCustomerType(val),
                                  () => findOrderInput('customer-autocomplete-input', '#customer-autocomplete input, input[placeholder*="Search by name"]')
                                );
                                return;
                              }
                              prevKeyDown?.(e);
                            },
                          }}
                          sx={{
                            ...ORDER_ENTRY_CONTROL_SX,
                            '& .MuiInputBase-input': {
                              fontWeight: selectedCustomerType ? 700 : 500,
                            }
                          }}
                        />
                        );
                      }}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      CUSTOMER
                      {formSelectedCustomer && (
                        <Box
                          component="span"
                          sx={{
                            ml: 'auto',
                            bgcolor: '#dbeafe',
                            color: '#1d4ed8',
                            px: 0.75,
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            lineHeight: '18px',
                            height: 18,
                          }}
                        >
                          {fmtAmt(formSelectedCustomer.cus_balance)}
                        </Box>
                      )}
                    </Typography>
                    <Autocomplete
                      id="customer-autocomplete"
                      size="small"
                      fullWidth
                      sx={{ width: '100%', minWidth: 0 }}
                      options={customers.filter(customer => {
                        const category = customerCategories.find(c => c.cus_cat_id === customer.cus_category);
                        const isCustomer = category && category.cus_cat_title.toLowerCase().includes('customer');
                        if (!isCustomer) return false;
                        if (!selectedCustomerType) return true;
                        return customer.cus_type === selectedCustomerType.cus_type_id;
                      })}
                      getOptionLabel={(option) => option.cus_name || ''}
                      ListboxProps={{ sx: { maxHeight: 180 } }}
                      getOptionKey={(option) => option.cus_id}
                      filterOptions={(options, { inputValue }) => filterOrderCustomers(options, inputValue)}
                      renderOption={(props, option) => {
                        const { key, ...optionProps } = props;
                        return (
                          <li key={key} {...optionProps}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{option.cus_name}</Typography>
                              {option.cus_phone_no && (
                                <Typography variant="caption" color="text.secondary">{option.cus_phone_no}{option.cus_phone_no2 ? ` / ${option.cus_phone_no2}` : ''}</Typography>
                              )}
                            </Box>
                          </li>
                        );
                      }}
                      value={formSelectedCustomer}
                      onChange={(event, newValue) => {
                        setFormSelectedCustomer(newValue);
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onHighlightChange={(_, option) => {
                        if (option) customerHighlightRef.current = option;
                      }}
                      renderInput={(params) => {
                        const prevKeyDown = params.inputProps?.onKeyDown;
                        return (
                        <TextField
                          {...params}
                          id="customer-autocomplete-input"
                          placeholder="Search by name or phone..."
                          onFocus={(e) => e.target.select()}
                          inputProps={{
                            ...params.inputProps,
                            id: 'customer-autocomplete-input',
                            onKeyDown: (e) => {
                              if (e.key === 'Tab' && e.shiftKey) {
                                e.preventDefault();
                                findOrderInput('customer-type-select-input', '#customer-type-select input')?.focus();
                                return;
                              }
                              if (!e.shiftKey && (e.key === 'Tab' || e.key === 'Enter')) {
                                const inputValue = e.currentTarget.value || '';
                                const customerOptions = (customers || []).filter((customer) => {
                                  const category = customerCategories.find((c) => c.cus_cat_id === customer.cus_category);
                                  const isCustomer = category && category.cus_cat_title.toLowerCase().includes('customer');
                                  if (!isCustomer) return false;
                                  if (!selectedCustomerType) return true;
                                  return customer.cus_type === selectedCustomerType.cus_type_id;
                                });
                                const filtered = filterOrderCustomers(customerOptions, inputValue);
                                const idx = getFocusedAutocompleteOption();
                                const pick = customerHighlightRef.current
                                  || (idx != null ? filtered[idx] : null)
                                  || filtered[0]
                                  || formSelectedCustomer;
                                if (pick) {
                                  commitDropdownOnTab(
                                    e,
                                    pick,
                                    (val) => setFormSelectedCustomer(val),
                                    () => findOrderInput('product-autocomplete-input', 'input[placeholder*="Select product"]')
                                  );
                                  return;
                                }
                              }
                              prevKeyDown?.(e);
                            },
                          }}
                          sx={{ ...ORDER_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formSelectedCustomer ? 700 : 500 } }}
                        />
                        );
                      }}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      BILL TYPE
                    </Typography>
                    <FormControl fullWidth size="small" sx={{ minWidth: 0, width: '100%' }}>
                      <Select
                        value={billType}
                        onChange={(e) => setBillType(e.target.value)}
                        sx={{
                          height: 40,
                          bgcolor: '#fff',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          '& .MuiSelect-select': {
                            py: 0,
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 700,
                          },
                        }}
                      >
                        <MenuItem value="ORDER">Order</MenuItem>
                        <MenuItem value="ORDER_TRASH">Order Trash</MenuItem>
                        <MenuItem value="BILL">Bill</MenuItem>
                        <MenuItem value="QUOTATION">Quotation</MenuItem>
                        <MenuItem value="SALE_RETURN">Sale Return</MenuItem>
                      </Select>
                    </FormControl>
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      DATE
                    </Typography>
                    <TextField
                      fullWidth
                      type="date"
                      size="small"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      sx={ORDER_ENTRY_CONTROL_SX}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      REFERENCE
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      sx={ORDER_ENTRY_CONTROL_SX}
                      value={paymentData.notes || ''}
                      onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                      onFocus={(e) => e.target.select()}
                    />
                </Box>
              </Box>

              {/* Product Selection Row */}
              <Box sx={ORDER_ENTRY_ROW2_SX}>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      PRODUCT
                    </Typography>
                    <Autocomplete
                      size="small"
                      fullWidth
                      sx={{ width: '100%', minWidth: 0 }}
                      options={products || []}
                      getOptionLabel={(option) => option.pro_title || ''}
                      getOptionKey={(option) => option.pro_id}
                      filterOptions={filterOrderProducts}
                      ListboxProps={{ sx: { maxHeight: 130 } }}
                      renderOption={(props, option) => {
                        const { key, ...optionProps } = props;
                        return (
                          <li
                            key={option.pro_id ?? key}
                            {...optionProps}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 500 }}>{option.pro_title}</Typography>
                              {option.pro_code && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>#{option.pro_code}</Typography>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {visibleCrates.includes(option.pro_id) && (
                                <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
                                  {option.pro_crate ? 'PKR ' + fmtAmt(option.pro_crate) : 'N/A'}
                                </Typography>
                              )}

                              <IconButton
                                size="small"
                                tabIndex={-1}
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleVisibleCrate(option.pro_id); }}
                                aria-label={visibleCrates.includes(option.pro_id) ? 'Hide purchase rate' : 'Show purchase rate'}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </li>
                        );
                      }}
                      value={formSelectedProduct}
                      onChange={(event, newValue) => {
                        console.log('🔍 Product selected:', newValue);
                        handleProductSelect(newValue);
                      }}
                      isOptionEqualToValue={(option, value) => option.pro_id === value?.pro_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onHighlightChange={(_, option) => {
                        if (option) productHighlightRef.current = option;
                      }}
                      renderInput={(params) => {
                        const prevKeyDown = params.inputProps?.onKeyDown;
                        return (
                        <TextField
                          {...params}
                          id="product-autocomplete-input"
                          placeholder={products.length === 0 ? "No products available" : "Select product"}
                          onFocus={(e) => e.target.select()}
                          inputProps={{
                            ...params.inputProps,
                            id: 'product-autocomplete-input',
                            onKeyDown: (e) => {
                              if (e.key === 'Tab' && e.shiftKey) {
                                e.preventDefault();
                                findOrderInput('customer-autocomplete-input', '#customer-autocomplete input')?.focus();
                                return;
                              }
                              if (!e.shiftKey && (e.key === 'Tab' || e.key === 'Enter')) {
                                const inputValue = e.currentTarget.value || '';
                                const filtered = filterOrderProducts(products || [], { inputValue });
                                const idx = getFocusedAutocompleteOption();
                                const pick = productHighlightRef.current
                                  || (idx != null ? filtered[idx] : null)
                                  || filtered[0]
                                  || formSelectedProduct;
                                if (pick) {
                                  commitDropdownOnTab(
                                    e,
                                    pick,
                                    (val) => handleProductSelect(val),
                                    () => findOrderInput('order-store-input', 'input[placeholder*="Select Store"]')
                                  );
                                  return;
                                }
                              }
                              prevKeyDown?.(e);
                            },
                          }}
                          sx={{ ...ORDER_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formSelectedProduct ? 700 : 500 } }}
                        />
                        );
                      }}
                      disabled={products.length === 0}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      STORE
                    </Typography>
                    <Autocomplete
                      size="small"
                      fullWidth
                      sx={{ width: '100%', minWidth: 0 }}
                      options={stores || []}
                      getOptionLabel={(option) => option.store_name || ''}
                      getOptionKey={(option) => option.storeid}
                      filterOptions={filterOrderStores}
                      value={formSelectedStore}
                      onChange={(event, newValue) => {
                        setFormSelectedStore(newValue || null);
                      }}
                      isOptionEqualToValue={(option, value) => option.storeid === value?.storeid}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onHighlightChange={(_, option) => {
                        if (option) storeHighlightRef.current = option;
                      }}
                      renderInput={(params) => {
                        const prevKeyDown = params.inputProps?.onKeyDown;
                        return (
                        <TextField
                          {...params}
                          id="order-store-input"
                          placeholder="Select Store"
                          onFocus={(e) => e.target.select()}
                          inputProps={{
                            ...params.inputProps,
                            id: 'order-store-input',
                            onKeyDown: (e) => {
                              if (e.key === 'Tab' && e.shiftKey) {
                                e.preventDefault();
                                findOrderInput('product-autocomplete-input', 'input[placeholder*="Select product"]')?.focus();
                                return;
                              }
                              if (!e.shiftKey && (e.key === 'Tab' || e.key === 'Enter')) {
                                const inputValue = e.currentTarget.value || '';
                                const filtered = filterOrderStores(stores || [], { inputValue });
                                const idx = getFocusedAutocompleteOption();
                                const pick = storeHighlightRef.current
                                  || (idx != null ? filtered[idx] : null)
                                  || filtered[0]
                                  || formSelectedStore;
                                if (pick) {
                                  commitDropdownOnTab(
                                    e,
                                    pick,
                                    (val) => setFormSelectedStore(val || null),
                                    () => findOrderInput('order-qty-input')
                                  );
                                  return;
                                }
                              }
                              prevKeyDown?.(e);
                            },
                          }}
                          sx={{ ...ORDER_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formSelectedStore ? 700 : 500 } }}
                        />
                        );
                      }}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      QTY
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      id="order-qty-input"
                      value={productFormData.quantity === 0 ? '' : productFormData.quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (productFormData.rate > 0) {
                            handleAddProductToTable();
                          } else {
                            document.getElementById('product-rate-input')?.focus();
                          }
                        } else if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          document.getElementById('order-store-input')?.focus();
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          document.getElementById('product-rate-input')?.focus();
                        }
                      }}
                      sx={{ ...ORDER_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: 700 } }}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      RATE
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={productFormData.rate === 0 ? '' : productFormData.rate}
                      onChange={(e) => handleRateChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      id="product-rate-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProductToTable();
                        } else if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          document.getElementById('order-qty-input')?.focus();
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          document.getElementById('add-product-btn')?.focus();
                        }
                      }}
                      sx={{ ...ORDER_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: 700 } }}
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      AMOUNT
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={productFormData.amount}
                      sx={ORDER_ENTRY_CONTROL_SX}
                      disabled
                    />
                </Box>
                <Box sx={ORDER_ENTRY_CELL_SX}>
                    <Typography sx={ORDER_ENTRY_LABEL_SX}>
                      STOCK
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={productFormData.stock}
                      disabled
                      sx={{ ...ORDER_ENTRY_CONTROL_SX, bgcolor: '#f8fafc' }}
                    />
                </Box>
                <Box sx={{ ...ORDER_ENTRY_CELL_SX, width: 44 }}>
                    <Button
                      variant="contained"
                      id="add-product-btn"
                      onClick={handleAddProductToTable}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProductToTable();
                          return;
                        }
                        if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          document.getElementById('product-rate-input')?.focus();
                          return;
                        }
                        if (e.key === 'Tab' && !e.shiftKey) {
                          if (formSelectedProduct && formSelectedStore && productFormData.quantity > 0 && productFormData.rate > 0) {
                            e.preventDefault();
                            handleAddProductToTable();
                            return;
                          }
                          if (productTableData.length === 0) {
                            e.preventDefault();
                            document.getElementById('payment-labour-input')?.focus();
                          }
                        }
                      }}
                      sx={{
                        bgcolor: '#6f42c1',
                        color: 'white',
                        borderRadius: '8px',
                        minWidth: 44,
                        width: 44,
                        height: 40,
                        minHeight: 40,
                        p: 0,
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        '&:hover': { bgcolor: '#5a2d91' }
                      }}
                    >
                      +
                    </Button>
                </Box>
              </Box>

              {/* Product Table */}
              <TableContainer component={Paper} sx={{ mb: 2, border: '1px solid #e9ecef' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>S. No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Price</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productTableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No products added yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productTableData.map((product, index) => (
                        <TableRow key={product.id} sx={{ '&:hover': { bgcolor: '#f8f9fa' } }}>
                          <TableCell sx={{ py: 1 }}>{index + 1}</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Select
                              size="small"
                              value={product.storeid || ''}
                              onChange={(e) => {
                                const s = stores.find(st => st.storeid === e.target.value);
                                setProductTableData(prev => prev.map(p =>
                                  p.id === product.id ? { ...p, storeid: s?.storeid, store_name: s?.store_name } : p
                                ));
                              }}
                              sx={{ minWidth: 110, fontSize: '0.85rem' }}
                            >
                              {stores.map(s => (
                                <MenuItem key={s.storeid} value={s.storeid}>{s.store_name}</MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>{product.pro_title}</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={product.quantity}
                              onChange={(e) => {
                                const newQuantity = parseFloat(e.target.value) || 0;
                                if (newQuantity > 0) {
                                  const updatedData = productTableData.map((p) =>
                                    p.id === product.id
                                      ? {
                                        ...p,
                                        quantity: newQuantity,
                                        amount: newQuantity * p.rate
                                      }
                                      : p
                                  );
                                  setProductTableData(updatedData);
                                }
                              }}
                              sx={{
                                width: 80,
                                '& .MuiInputBase-input': {
                                  padding: '4px 8px',
                                  textAlign: 'center'
                                }
                              }}
                              inputProps={{
                                min: 0.01,
                                step: 'any'
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={product.rate}
                              onChange={(e) => {
                                const newRate = parseFloat(e.target.value) || 0;
                                if (newRate >= 0) {
                                  const updatedData = productTableData.map((p) =>
                                    p.id === product.id
                                      ? {
                                        ...p,
                                        rate: newRate,
                                        amount: p.quantity * newRate
                                      }
                                      : p
                                  );
                                  setProductTableData(updatedData);
                                }
                              }}
                              sx={{
                                width: 100,
                                '& .MuiInputBase-input': {
                                  padding: '4px 8px',
                                  textAlign: 'center'
                                }
                              }}
                              inputProps={{
                                min: 0,
                                step: 'any'
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>{fmtAmt(product.amount)}</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <IconButton
                              size="small"
                              className="table-delete-btn"
                              onClick={() => handleRemoveProductFromTable(product.id)}
                              sx={{ color: 'error.main' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' && !e.shiftKey && index === productTableData.length - 1) {
                                  e.preventDefault();
                                  const labourInput = document.getElementById('payment-labour-input');
                                  if (labourInput) {
                                    labourInput.focus();
                                  }
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {productTableData.length > 0 && (
                      <TableRow sx={{ bgcolor: '#f8f9fa', borderTop: '2px solid #dee2e6' }}>
                        <TableCell colSpan={5} sx={{ py: 2, fontWeight: 'bold', textAlign: 'right' }}>
                          Total Amount:
                        </TableCell>
                        <TableCell sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem' }} key={`table-total-${calculateTotalAmount()}-${transportOptions.length}`}>
                          {fmtAmt(calculateTotalAmount())}
                        </TableCell>
                        <TableCell sx={{ py: 2 }}></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Payment Details */}
              <Box sx={{ mt: 2, p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Left Section - Payment Fields */}
                <Box sx={{
                  flex: '1 1 48%',
                  minWidth: '300px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* First Row - CASH, BANK, BANK ACCOUNT, TOTAL CASH RECEIVED */}
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            CASH
                          </Typography>
                          {cashAccount && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {fmtAmt(cashAccount.cus_balance || 0)}
                            </Typography>
                          )}
                        </Box>
                        <TextField
                          id="payment-cash-input"
                          fullWidth
                          size="small"
                          type="number"
                          value={paymentData.cash === 0 ? '' : paymentData.cash}
                          onChange={(e) => handlePaymentDataChange('cash', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab' && e.shiftKey) {
                              e.preventDefault();
                              const discountInput = document.getElementById('payment-discount-input');
                              if (discountInput) {
                                discountInput.focus();
                              }
                            }
                          }}
                          sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' } }}
                          placeholder=" "
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                          BANK
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={paymentData.bank === 0 ? '' : paymentData.bank}
                          onChange={(e) => handlePaymentDataChange('bank', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              // Only intercept Tab and move focus to BANK ACCOUNT when a bank amount is present
                              if (parseFloat(paymentData.bank || 0) > 0) {
                                e.preventDefault();
                                setTimeout(() => {
                                  const bankAccInputs = document.querySelectorAll('input[placeholder="Select Bank Account"]');
                                  if (bankAccInputs.length > 0) {
                                    bankAccInputs[0].focus();
                                  } else {
                                    // Fallback: search for input that might be the bank account select
                                    const allInputs = document.querySelectorAll('input[type="text"]');
                                    for (let i = 0; i < allInputs.length; i++) {
                                      const input = allInputs[i];
                                      if (input.placeholder && input.placeholder.toLowerCase().includes('bank')) {
                                        input.focus();
                                        return;
                                      }
                                    }
                                  }
                                }, 0);
                              }
                            }
                          }}
                          sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' } }}
                          placeholder=" "
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            BANK ACCOUNT
                          </Typography>
                          {paymentData.bankAccountId && bankAccounts.find(acc => acc.cus_id === paymentData.bankAccountId) && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {fmtAmt(bankAccounts.find(acc => acc.cus_id === paymentData.bankAccountId)?.cus_balance || 0)}
                            </Typography>
                          )}
                        </Box>
                        <Autocomplete
                          size="small"
                          options={bankAccounts}
                          getOptionLabel={(option) => option.cus_name || ''}
                          value={bankAccounts.find(acc => acc.cus_id === paymentData.bankAccountId) || null}
                          onChange={(event, newValue) => {
                            handlePaymentDataChange('bankAccountId', newValue ? newValue.cus_id : '');
                          }}

                          isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Bank Account"
                              onFocus={(e) => e.target.select()}
                              sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' } }}
                            />
                          )}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                          TOTAL CASH RECEIVED
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={toReadOnlyNumberInput(paymentData.totalCashReceived)}
                          placeholder="0"
                          sx={{
                            bgcolor: '#f5f5f5',
                            '& .MuiInputBase-input': { padding: '8px', color: '#000' },
                            '& .MuiInputBase-input.Mui-disabled': {
                              color: '#000',
                              WebkitTextFillColor: '#000',
                            },
                          }}
                          disabled
                        />
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Second Row - NOTES */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      NOTES
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      value={paymentData.notes}
                      onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' } }}
                      placeholder="Enter any notes..."
                    />
                  </Box>
                </Box>

                {/* Right Section - Input Fields */}
                <Box sx={{
                  flex: '1 1 48%',
                  minWidth: '300px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Items total (products only) — value must be plain number, not fmtAmt, for type="number" */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      ITEMS TOTAL
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={toReadOnlyNumberInput(calculateTotalAmount())}
                      placeholder="0"
                      sx={{
                        bgcolor: 'white',
                        flex: 1,
                        '& .MuiInputBase-input': { padding: '8px', color: '#000' },
                        '& .MuiInputBase-input.Mui-disabled': {
                          color: '#000',
                          WebkitTextFillColor: '#000',
                        },
                      }}
                      disabled
                      inputProps={{
                        readOnly: true,
                        step: 'any',
                      }}
                    />
                  </Box>

                  {/* LABOUR */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      LABOUR
                    </Typography>
                    <TextField
                      id="payment-labour-input"
                      size="small"
                      type="number"
                      value={paymentData.labour === 0 ? '' : paymentData.labour}
                      onChange={(e) => handlePaymentDataChange('labour', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          if (productTableData.length > 0) {
                            const deleteBtns = document.getElementsByClassName('table-delete-btn');
                            if (deleteBtns.length > 0) {
                              deleteBtns[deleteBtns.length - 1].focus();
                            }
                          } else {
                            const addBtn = document.getElementById('add-product-btn');
                            if (addBtn) addBtn.focus();
                          }
                        }
                      }}
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' }, flex: 1 }}
                      placeholder=" "
                    />
                  </Box>

                  {/* DELIVERY CHARGES */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DELIVERY CHARGES
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentData.deliveryCharges === 0 ? '' : paymentData.deliveryCharges}
                      onChange={(e) => handlePaymentDataChange('deliveryCharges', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px', fontWeight: 'bold' }, flex: 1 }}
                      placeholder=" "
                    />
                    {calculateTransportTotal() > 0 && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        (Transport: {calculateTransportTotal().toFixed(2)})
                      </Typography>
                    )}
                  </Box>

                  {/* DISCOUNT */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DISCOUNT
                    </Typography>
                    <TextField
                      id="payment-discount-input"
                      size="small"
                      type="number"
                      value={paymentData.discount === 0 ? '' : paymentData.discount}
                      onChange={(e) => handlePaymentDataChange('discount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          const cashInput = document.getElementById('payment-cash-input');
                          if (cashInput) {
                            cashInput.focus();
                          }
                        }
                      }}
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { padding: '8px' }, flex: 1 }}
                      placeholder=" "
                    />
                  </Box>

                  {/* Order total = items + labour + delivery/transport - discount (matches API total_amount) */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      ORDER TOTAL
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={toReadOnlyNumberInput(calculateGrandTotal())}
                      placeholder="0"
                      sx={{
                        bgcolor: '#fff8e1',
                        flex: 1,
                        fontWeight: 700,
                        '& .MuiInputBase-input': { padding: '8px', color: '#000', fontWeight: 700 },
                        '& .MuiInputBase-input.Mui-disabled': {
                          color: '#000',
                          WebkitTextFillColor: '#000',
                        },
                      }}
                      disabled
                      inputProps={{ readOnly: true, step: 'any' }}
                    />
                  </Box>

                  {/* REMAINING AMOUNT = ORDER TOTAL - TOTAL CASH RECEIVED */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#16a34a', minWidth: '140px' }}>
                      REMAINING
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={toReadOnlyNumberInput(Math.max(0, calculateGrandTotal() - parseFloat(paymentData.totalCashReceived || 0)))}
                      placeholder="0"
                      sx={{
                        bgcolor: '#f0fdf4',
                        flex: 1,
                        '& .MuiInputBase-input': { padding: '8px', color: '#16a34a', fontWeight: 700 },
                        '& .MuiInputBase-input.Mui-disabled': {
                          color: '#16a34a',
                          WebkitTextFillColor: '#16a34a',
                        },
                      }}
                      disabled
                      inputProps={{ readOnly: true, step: 'any' }}
                    />
                  </Box>

                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: '#6c757d',
                    color: '#6c757d',
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: '#5a6268',
                      color: '#5a6268'
                    }
                  }}
                  onClick={() => {
                    setCurrentBillData(null);
                    setFormSelectedCustomer(null);
                    setSelectedCustomerType(null);
                    setFormSelectedProduct(null);
                    setFormSelectedStore(null);
                    setProductTableData([]);
                    setPaymentData({
                      cash: 0,
                      bank: 0,
                      bankAccountId: '',
                      totalCashReceived: 0,
                      discount: 0,
                      labour: 0,
                      deliveryCharges: 0,
                      notes: ''
                    });
                    setTransportOptions([]);
                  }}
                >
                  New
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: '#fd7e14',
                    color: '#fd7e14',
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: '#e8690b',
                      color: '#e8690b'
                    }
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#e8690b' }
                  }}
                  onClick={() => handlePrintBill('A4')}
                  disabled={!currentBillData}
                >
                  Print A5
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#e8690b' }
                  }}
                  onClick={() => handlePrintBill('THERMAL')}
                  disabled={!currentBillData}
                >
                  Print Thermal
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#dc3545',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#c82333' }
                  }}
                  onClick={handleBackToList}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#6c757d',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#5a6268' }
                  }}
                  onClick={cancelCurrentScreen}
                  disabled={screenStack.length <= 1}
                >
                  Cancel Current Screen
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#28a745',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#218838' }
                  }}
                  onClick={handleSaveBill}
                  disabled={savingBill}
                >
                  {savingBill ? (
                    <>
                      <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                      {saveStatusMessage || 'Saving...'}
                    </>
                  ) : (
                    editSaleId ? 'Update Order' : 'Save Order'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Stack>

        {/* Printable Bill Content - Hidden but accessible for printing */}
        {currentBillData && (
          <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '14.8cm', overflow: 'hidden' }}>
            {/* A5 Printable Container */}
            <Box id="printable-invoice-a4" sx={{ width: '100%', bgcolor: 'white' }}>
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
                  <PhoneIcon sx={{ color: '#25D366', fontSize: '1rem' }} />
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
                  ORDER INVOICE
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Customer Name: <strong>{currentBillData.customer?.cus_name || 'N/A'}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Phone No: <strong>{currentBillData.customer?.cus_phone_no || 'N/A'}</strong>
                  </Typography>
                  {currentBillData.customer?.cus_address && (
                    <Typography variant="body2">
                      Address: <strong>{currentBillData.customer.cus_address}</strong>
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Invoice No: <strong>{getBillDisplayNo(currentBillData)}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Time: <strong>{new Date(currentBillData.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Date: <strong>{new Date(currentBillData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Bill Type: <strong>{currentBillData.bill_type || 'BILL'}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Created By: <strong>{getCreatedByName(currentBillData, currentUser)}</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Product Table */}
              <Box sx={{ px: 3, py: 2 }}>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1 }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1 }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1 }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1 }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1 }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentBillData.sale_details && currentBillData.sale_details.length > 0 ? (
                        currentBillData.sale_details.map((detail, index) => (
                          <TableRow key={detail.sale_detail_id || index}>
                            <TableCell sx={{ px: 1 }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1 }}>{detail.product?.pro_title || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1 }} align="right">{detail.qnty || 0}</TableCell>
                            <TableCell sx={{ px: 1 }} align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                            <TableCell sx={{ px: 1 }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
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

                {/* Payment Summary */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          {(() => {
                            const _rem = parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0);
                            const _isOrd = ['ORDER', 'ORDER_TRASH'].includes(currentBillData.bill_type);
                            const _bal = parseFloat(currentBillData.customer?.cus_balance || 0);
                            const _pay = parseFloat(currentBillData.payment || 0);
                            // Fresh receipt: previous_balance stored before API call (always correct)
                            // Historical view: for ORDER cus_balance = prev - advance, so prev = bal + pay
                            //                 for BILL  cus_balance = prev + total - pay, so prev = bal - rem
                            const _prev = currentBillData.previous_balance != null
                              ? parseFloat(currentBillData.previous_balance)
                              : _isOrd ? _bal + _pay : _bal - _rem;
                            const _total = _prev + _rem;
                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(_prev)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(_rem)}</TableCell>
                                </TableRow>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقايا</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(_total)}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {currentBillData.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {currentBillData.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt((currentBillData.sale_details || []).reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.labour)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.shipping_amount)}
                            </TableCell>
                          </TableRow>
                          {parseFloat(currentBillData.discount || 0) > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رعایت</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(currentBillData.discount)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.total_amount)}
                            </TableCell>
                          </TableRow>
                          {/* Always show cash payment */}
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>نقد كيش</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.cash_payment)}
                            </TableCell>
                          </TableRow>
                          {/* Show bank payment with account name if bank payment exists */}
                          {currentBillData.bank_payment > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {currentBillData.bank_title || 'بینک'}
                              </TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(currentBillData.bank_payment)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#d0d0d0' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>

            </Box>
        )}

        {/* Receipt Dialog */}
        <Dialog
          open={receiptDialogOpen}
          onClose={() => setReceiptDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'white',
              borderRadius: 2
            }
          }}
        >
          <DialogTitle component="div" sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              Receipt - {getBillDisplayNo(currentBillData)}
            </Typography>
            <IconButton
              onClick={() => setReceiptDialogOpen(false)}
              size="small"
              sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, bgcolor: 'white' }}>
            {currentBillData && (
              <Box id="receipt-preview" className="thermal-receipt" sx={{ width: '100%', bgcolor: 'white', p: 2, color: '#000', fontWeight: 'bold', '& *': { fontWeight: 'bold !important', color: '#000 !important' } }}>
                {/* Company Header */}
                <Box sx={{ textAlign: 'center', pb: 1, mb: 1, borderBottom: '2px solid #000' }}>
                  <Typography sx={{
                    fontWeight: 'bold',
                    mb: 0.25,
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '1.4rem',
                    direction: 'rtl',
                    color: '#000'
                  }}>
                    اتفاق آئرن اینڈ سیمنٹ سٹور
                  </Typography>
                  <Typography sx={{
                    mb: 0.25,
                    fontSize: '0.85rem',
                    direction: 'rtl',
                    color: '#000'
                  }}>
                    گجرات سرگودھا روڈ، پاہڑیانوالی
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                    <PhoneIcon sx={{ color: '#25D366', fontSize: '0.9rem' }} />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#000' }}>
                      Ph:- 0346-7560306, 0300-7560306
                    </Typography>
                  </Box>
                  <Typography sx={{
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    mt: 0.5,
                    fontSize: '1rem',
                    color: '#000'
                  }}>
                    ORDER INVOICE
                  </Typography>
                </Box>

                {/* Customer and Invoice Details */}
                <Box sx={{ px: 1, py: 1, mb: 1.5, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: '0 0 50%' }}>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Customer Name: &nbsp;<strong>{currentBillData.customer?.cus_name || 'Cash Customer'}</strong>
                    </Typography>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Phone No: &nbsp;<strong>{currentBillData.customer?.cus_phone_no || 'N/A'}</strong>
                    </Typography>
                    {currentBillData.customer?.cus_address && (
                      <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                        Address: &nbsp;<strong>{currentBillData.customer.cus_address}</strong>
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Invoice No: &nbsp;<strong>{getBillDisplayNo(currentBillData)}</strong>
                    </Typography>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Order ID: &nbsp;<strong>{currentBillData.sale_id || getBillDisplayNo(currentBillData)}</strong>
                    </Typography>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Date: &nbsp;<strong>{new Date(currentBillData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                    </Typography>
                    <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                      Time: &nbsp;<strong>{new Date(currentBillData.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                      Created By: &nbsp;<strong>{getCreatedByName(currentBillData, currentUser)}</strong>
                    </Typography>
                  </Box>
                </Box>

                {/* Product Table */}
                <Box sx={{ px: 1, py: 0.5 }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5, border: '1px solid #000', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#808080' }}>
                          <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>S#</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>Product Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="center">Qty</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Rate</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentBillData.sale_details && currentBillData.sale_details.length > 0 ? (
                          currentBillData.sale_details.map((detail, index) => (
                            <TableRow key={detail.sale_detail_id || index}>
                              <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }}>{detail.product?.pro_title || detail.product?.pro_name || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="center">{fmtAmt(detail.qnty || 0)}</TableCell>
                              <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                              <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 2, color: '#000', fontSize: '0.85rem' }}>
                              No items found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Payment Summary */}
                  <Box sx={{ mt: 1.5, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ flex: '0 0 48%' }}>
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                        <Table size="small">
                          <TableBody>
                            {(() => {
                              const _rem = parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0);
                              const _isOrd = ['ORDER', 'ORDER_TRASH'].includes(currentBillData.bill_type);
                              const _bal = parseFloat(currentBillData.customer?.cus_balance || 0);
                              const _pay = parseFloat(currentBillData.payment || 0);
                              const _prev = currentBillData.previous_balance != null
                                ? parseFloat(currentBillData.previous_balance)
                                : _isOrd ? _bal + _pay : _bal - _rem;
                              const _total = _prev + _rem;
                              return (
                                <>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>سابقہ بقایا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>{fmtAmt(_prev)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>موجوده بقايا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>{fmtAmt(_rem)}</TableCell>
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: '#808080' }}>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>كل بقايا</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>{fmtAmt(_total)}</TableCell>
                                  </TableRow>
                                </>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {currentBillData.notes && (
                        <Box sx={{ mt: 1 }}>
                          <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                            <strong>Notes:</strong> {currentBillData.notes}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رقم بل</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt((currentBillData.sale_details || []).reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0))}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>مزدوری</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt(currentBillData.labour_charges || currentBillData.labour)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>کرایہ</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt(currentBillData.shipping_amount)}
                              </TableCell>
                            </TableRow>
                            {parseFloat(currentBillData.discount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رعایت</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                  {fmtAmt(currentBillData.discount)}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>كل رقم</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt(currentBillData.total_amount)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>نقد كيش</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt(currentBillData.cash_payment || (currentBillData.payment_type === 'CASH' ? currentBillData.payment : 0))}
                              </TableCell>
                            </TableRow>
                            {parseFloat(currentBillData.bank_payment || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                  {currentBillData.bank_title || 'بینک'}
                                </TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                  {fmtAmt(currentBillData.bank_payment)}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#808080' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>بقایا رقم</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>
                                {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
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
          <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0' }} className="no-print">
            <Button
              onClick={() => setReceiptDialogOpen(false)}
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              sx={{
                minWidth: 150,
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
              onClick={() => handlePrintBill('A4', true)}
            >
              Print A5
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              sx={{
                minWidth: 150,
                bgcolor: '#fd7e14',
                '&:hover': { bgcolor: '#e8690b' }
              }}
              onClick={() => handlePrintBill('THERMAL', true)}
            >
              Print Thermal
            </Button>
            <Button
              variant="contained"
              sx={{
                minWidth: 150,
                bgcolor: '#25D366',
                '&:hover': { bgcolor: '#1ebe5d' }
              }}
              onClick={() => handleSendWhatsApp(currentBillData, 'receipt-preview')}
              disabled={isSendingWhatsApp || !currentBillData?.customer?.cus_phone_no}
              title={!currentBillData?.customer?.cus_phone_no ? 'No phone number on file' : 'Send receipt via WhatsApp'}
            >
              {isSendingWhatsApp ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : null}
              {isSendingWhatsApp ? 'Sending...' : '📲 WhatsApp'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Print Styles for Create View */}
        <style jsx global>{`
          @media print {
            /* Hide UI chrome when printing */
            .no-print, 
            .MuiDialog-root,
            .MuiDialog-container,
            .MuiDialog-paper,
            .MuiDialogTitle-root,
            .MuiDialogActions-root { 
              display: none !important; 
            }
            header, nav, footer { 
              display: none !important; 
            }
            
            /* Hide everything by default when printing */
            body.print-a4 *,
            body.print-thermal * {
              visibility: hidden !important;
            }

            /* Collapse layout container height to prevent blank page generation */
            body.print-a4 .dashboard-layout-root,
            body.print-thermal .dashboard-layout-root {
              height: 0 !important;
              max-height: 0 !important;
              overflow: hidden !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            
            /* Show printable content */
            body.print-a4 #printable-invoice-a4,
            body.print-a4 #printable-invoice-a4 *,
            body.print-thermal #printable-invoice-thermal,
            body.print-thermal #printable-invoice-thermal * {
              visibility: visible !important;
            }
            
            /* Position and style printable containers */
            body.print-a4 #printable-invoice-a4 {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              z-index: 9999 !important;
              background: white !important;
            }
            
            body.print-thermal #printable-invoice-thermal {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
              z-index: 9999 !important;
              background: white !important;
            }
          }
        `}</style>
      </Container>
    </DashboardLayout>
  );

  const renderSalesListView = () => (
    <DashboardLayout>
      <Container
        maxWidth={false}
        sx={{
          py: { xs: 2, md: 2.5 },
          maxWidth: {
            xs: '100%',
            sm: '100%',
            md: '100%',
            lg: '1200px',
            xl: '1400px'
          },
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 }
        }}>
        <Stack spacing={3}>
          {/* Header - New Order Button on the left */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', py: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 26 }} />}
              onClick={handleNewOrder}
              size="large"
              sx={{
                background: 'linear-gradient(135deg, #FFC107 0%, #FF8F00 100%)',
                boxShadow: '0 4px 16px rgba(255, 143, 0, 0.32)',
                px: 5,
                py: 1.75,
                fontSize: '1.125rem',
                fontWeight: 700,
                minWidth: '320px',
                height: '70px',
                borderRadius: 2.5,
                textTransform: 'none',
                letterSpacing: '0.02em',
                color: '#fff',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #FFB300 0%, #E65100 100%)',
                  boxShadow: '0 6px 22px rgba(255, 143, 0, 0.42)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              New Order
            </Button>
          </Box>

          {/* Main orders panel — stats, filters & excel grid */}
          <Card sx={ORDER_PAGE_CARD_SX}>
            {/* Stats strip */}
            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Box sx={ORDER_STATS_GRID}>
                {[
                  { title: 'Total Orders', val: statsTotalOrders, color: BRAND.primary.blue, bg: BRAND.tint.blue, icon: <ShoppingCartIcon fontSize="small" />, isCount: true },
                  { title: "Order's Amount", val: statsTotalAmount, color: BRAND.text.green, bg: BRAND.tint.green, icon: <AttachMoneyIcon fontSize="small" /> },
                  { title: 'Total Discount', val: statsTotalDiscount, color: BRAND.text.pink, bg: BRAND.tint.pink, icon: <TrendingDownIcon fontSize="small" /> },
                  { title: 'Total Shipping', val: statsTotalShipping, color: BRAND.text.cyan, bg: BRAND.tint.cyan, icon: <ShippingIcon fontSize="small" /> },
                  { title: 'Received Amount', val: statsTotalPayment, color: BRAND.text.periwinkle, bg: BRAND.tint.periwinkle, icon: <CreditCardIcon fontSize="small" /> },
                  { title: 'Total Remaining', val: statsTotalBalance, color: '#b45309', bg: '#fffbeb', icon: <WalletIcon fontSize="small" /> }
                ].map((stat, i) => (
                  <Box key={i} sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1.5,
                    width: '100%',
                    minHeight: 72,
                    borderRadius: 1.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#fff',
                  }}>
                    <Box sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 1.25,
                      bgcolor: stat.bg,
                      color: stat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {stat.icon}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                        {stat.title}
                      </Typography>
                      <Typography noWrap sx={{ fontWeight: 800, color: stat.color, fontSize: '0.9375rem', lineHeight: 1.3, mt: 0.25 }}>
                        {!stat.isCount && <Box component="span" sx={{ fontSize: '0.625rem', mr: 0.35, opacity: 0.85, fontWeight: 700 }}>PKR</Box>}
                        {stat.isCount ? stat.val : fmtAmt(stat.val)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Filters toolbar */}
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
                <FilterIcon sx={{ color: BRAND.primary.blue, fontSize: 20 }} />
                Filters & Sorting
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                <Box sx={ORDER_VIEW_TOGGLE_SX}>
                  <Button
                    size="small"
                    disableElevation
                    onClick={() => setShowTrashOrders(false)}
                    sx={ORDER_VIEW_TOGGLE_BTN_SX(!showTrashOrders)}
                  >
                    Active Orders
                  </Button>
                  <Button
                    size="small"
                    disableElevation
                    onClick={() => setShowTrashOrders(true)}
                    sx={ORDER_VIEW_TOGGLE_BTN_SX(showTrashOrders)}
                  >
                    Trash
                  </Button>
                </Box>
                <Chip
                  size="small"
                  label={`${filteredSales.length} / ${modeSales.length}`}
                  sx={{
                    bgcolor: BRAND.tint.blue,
                    color: BRAND.primary.blue,
                    fontWeight: 700,
                    height: 32,
                    px: 0.5,
                    fontSize: '0.8125rem',
                    borderRadius: '8px',
                  }}
                />
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
              <Box sx={{ ...ORDER_FILTER_GRID, gap: { xs: 1.5, md: 2 } }}>
                  <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Search Orders"
                      placeholder="ID, Customer, Phone, Address, City, Order Name..."
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
                      sx={ORDER_FILTER_FIELD_SX}
                    />
                  </Box>

                  <Box>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={customers.filter(customer => {
                        const isCustomer = customer.customer_category &&
                          customer.customer_category.cus_cat_title &&
                          customer.customer_category.cus_cat_title.toLowerCase().includes('customer');
                        return isCustomer;
                      })}
                      getOptionLabel={(option) => option.cus_name || ''}
                      value={customers.find(c => c.cus_id.toString() === filterCustomer) || null}
                      onChange={(event, newValue) => {
                        setFilterCustomer(newValue ? newValue.cus_id.toString() : '');
                      }}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Customer"
                          placeholder="All Customers"
                          onFocus={(e) => e.target.select()}
                          sx={ORDER_FILTER_FIELD_SX}
                        />
                      )}
                    />
                  </Box>

                  <Box>
                    <FormControl fullWidth size="small" sx={ORDER_FILTER_FIELD_SX}>
                      <InputLabel>Bill Type</InputLabel>
                      <Select
                        value={filterBillType}
                        onChange={(e) => setFilterBillType(e.target.value)}
                        label="Bill Type"
                      >
                        <MenuItem value="">All Types</MenuItem>
                        <MenuItem value="ORDER">Order</MenuItem>
                        <MenuItem value="ORDER_TRASH">Order Trash</MenuItem>
                        <MenuItem value="BILL">Bill</MenuItem>
                        <MenuItem value="QUOTATION">Quotation</MenuItem>
                        <MenuItem value="SALE_RETURN">Sale Return</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <Box>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={stores}
                      getOptionLabel={(option) => option.store_name || ''}
                      value={stores.find(s => s.storeid.toString() === filterStore) || null}
                      onChange={(event, newValue) => setFilterStore(newValue ? newValue.storeid.toString() : '')}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Store"
                          placeholder="All Stores"
                          onFocus={(e) => e.target.select()}
                          sx={ORDER_FILTER_FIELD_SX}
                        />
                      )}
                    />
                  </Box>

                  <Box>
                    <TextField
                      fullWidth
                      size="small"
                      label="From Date"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={ORDER_FILTER_FIELD_SX}
                    />
                  </Box>

                  <Box>
                    <TextField
                      fullWidth
                      size="small"
                      label="To Date"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={ORDER_FILTER_FIELD_SX}
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
                      sx={ORDER_FILTER_FIELD_SX}
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
                      sx={ORDER_FILTER_FIELD_SX}
                    />
                  </Box>

                  <Box>
                    <FormControl fullWidth size="small" sx={ORDER_FILTER_FIELD_SX}>
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
                    <FormControl fullWidth size="small" sx={ORDER_FILTER_FIELD_SX}>
                      <InputLabel>Balance Status</InputLabel>
                      <Select
                        value={filterBalanceStatus}
                        onChange={(e) => setFilterBalanceStatus(e.target.value)}
                        label="Balance Status"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="with_balance">With Balance</MenuItem>
                        <MenuItem value="without_balance">Without Balance</MenuItem>
                        <MenuItem value="overpaid">Overpaid</MenuItem>
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
                        { value: 'customer-asc', label: 'Customer A-Z' },
                        { value: 'customer-desc', label: 'Customer Z-A' },
                        { value: 'total_amount-desc', label: 'Amount High-Low' },
                        { value: 'total_amount-asc', label: 'Amount Low-High' }
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
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Sort By"
                          placeholder="Select..."
                          onFocus={(e) => e.target.select()}
                          sx={ORDER_FILTER_FIELD_SX}
                        />
                      )}
                    />
                  </Box>
              </Box>
            </Box>

            {/* Order list — excel-style grid */}
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
                {showTrashOrders ? 'Trash Order List' : 'Order List'}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                {filteredSales.length} of {modeSales.length} rows
              </Typography>
            </Box>

            <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', bgcolor: '#fff' }}>
              <Table sx={ORDER_EXCEL_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'Order ID', align: 'left' },
                      { label: 'Order No', align: 'left' },
                      { label: 'Order Name', align: 'left' },
                      { label: 'Customer', align: 'left' },
                      { label: 'Total Amount', align: 'right' },
                      { label: 'Discount', align: 'right' },
                      { label: 'Shipping', align: 'right' },
                      { label: 'Payment', align: 'right' },
                      { label: 'Balance', align: 'right' },
                      { label: 'Bill Type', align: 'center' },
                      { label: 'Date', align: 'center' },
                      { label: 'Actions', align: 'center' },
                    ].map((col) => (
                      <TableCell key={col.label} align={col.align} sx={ORDER_EXCEL_HEAD_SX}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6, border: '1px solid #cbd5e1' }}>
                        <ShoppingCartIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>
                          {modeSales.length === 0
                            ? (showTrashOrders ? 'No trashed orders found' : 'No active orders found')
                            : 'No orders match your filters'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale, rowIndex) => {
                      const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
                      return (
                        <TableRow
                          key={sale.sale_id}
                          sx={{
                            bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                            '&:hover': { bgcolor: '#eff6ff' },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600, color: '#475569' }}>#{sale.sale_id}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: BRAND.primary.blue }}>{getBillDisplayNo(sale)}</TableCell>
                          <TableCell sx={{ color: '#64748b' }}>{sale.reference || '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sale.customer?.cus_name || 'N/A'}</TableCell>
                          <TableCell sx={{ ...ORDER_NUM_CELL_SX, fontWeight: 700 }}>{fmtAmt(sale.total_amount)}</TableCell>
                          <TableCell sx={ORDER_NUM_CELL_SX}>{fmtAmt(sale.discount)}</TableCell>
                          <TableCell sx={ORDER_NUM_CELL_SX}>{fmtAmt(sale.shipping_amount)}</TableCell>
                          <TableCell sx={{ ...ORDER_NUM_CELL_SX, fontWeight: 600, color: BRAND.text.green }}>{fmtAmt(sale.payment)}</TableCell>
                          <TableCell sx={{
                            ...ORDER_NUM_CELL_SX,
                            fontWeight: 700,
                            color: balance > 0 ? BRAND.primary.pink : balance < 0 ? BRAND.text.green : '#64748b',
                          }}>
                            {fmtAmt(balance)}
                          </TableCell>
                          <TableCell align="center">{sale.bill_type || '—'}</TableCell>
                          <TableCell align="center" sx={{ color: '#64748b' }}>{new Date(sale.created_at).toLocaleDateString('en-GB')}</TableCell>
                          <TableCell align="center" sx={{ p: 0.5 }}>
                            <Stack direction="row" spacing={0} justifyContent="center" flexWrap="nowrap">
                              <Tooltip title="View Details">
                                <IconButton size="small" onClick={() => handleViewBill(sale)} sx={{ p: 0.5, color: BRAND.primary.blue }}>
                                  <VisibilityIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print Bill">
                                <IconButton size="small" onClick={() => handleQuickPrint(sale)} sx={{ p: 0.5, color: '#64748b' }}>
                                  <PrintIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit / Convert to Sale">
                                <IconButton size="small" onClick={() => handleEdit(sale)} disabled={sale.bill_type === 'ORDER_TRASH'} sx={{ p: 0.5, color: BRAND.text.cyan }}>
                                  <EditIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Return Sale">
                                <IconButton size="small" onClick={() => handleOpenReturnDialog(sale)} disabled={sale.bill_type === 'ORDER_TRASH'} sx={{ p: 0.5, color: BRAND.primary.pink }}>
                                  <TrendingDownIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={sale.bill_type === 'ORDER_TRASH' ? 'Restore Order' : 'Move to Trash'}>
                                <IconButton size="small" onClick={() => handleDelete(sale)} sx={{ p: 0.5, color: sale.bill_type === 'ORDER_TRASH' ? BRAND.text.green : '#d97706' }}>
                                  <DeleteIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  return (
    <>
      {currentView === 'list' ? renderSalesListView() : renderSalesCreateView()}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Customer Creation Popup */}
      <Dialog
        open={customerPopupOpen}
        disableAutoFocus
        onClose={handleCloseCustomerPopup}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            minHeight: '80vh'
          }
        }}
      >
        <DialogTitle component="div" sx={{
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
              width: 48,
              height: 48
            }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                Add New Customer
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new customer profile
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseCustomerPopup}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            {/* Quick Actions */}
            <Box sx={{
              bgcolor: 'grey.50',
              borderRadius: 2,
              p: 2,
              border: 1,
              borderColor: 'grey.200',
              mb: 3
            }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<BusinessIcon />}
                  onClick={() => setShowCustomerCategoryPopup(true)}
                  sx={{
                    borderColor: 'success.main',
                    color: 'success.main',
                    '&:hover': {
                      borderColor: 'success.dark',
                      backgroundColor: 'success.light',
                      color: 'success.dark'
                    }
                  }}
                >
                  Add Account Category
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PersonIcon />}
                  onClick={() => setShowCustomerTypePopup(true)}
                  sx={{
                    borderColor: 'secondary.main',
                    color: 'secondary.main',
                    '&:hover': {
                      borderColor: 'secondary.dark',
                      backgroundColor: 'secondary.light',
                      color: 'secondary.dark'
                    }
                  }}
                >
                  Add Type
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MapPinIcon />}
                  onClick={() => setShowCityPopup(true)}
                  sx={{
                    borderColor: 'warning.main',
                    color: 'warning.main',
                    '&:hover': {
                      borderColor: 'warning.dark',
                      backgroundColor: 'warning.light',
                      color: 'warning.dark'
                    }
                  }}
                >
                  Add City
                </Button>
              </Box>
            </Box>

            <Grid container spacing={3}>
              {/* First Row - Name, Primary Phone, Secondary Phone */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  inputRef={customerNameInputRef}
                  label="Account Name"
                  name="cus_name"
                  value={newCustomer.cus_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_name: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter account name"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Primary Phone"
                  name="cus_phone_no"
                  type="tel"
                  value={newCustomer.cus_phone_no}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter primary phone number"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Secondary Phone"
                  name="cus_phone_no2"
                  type="tel"
                  value={newCustomer.cus_phone_no2}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no2: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter secondary phone number"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Address Field */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="cus_address"
                  value={newCustomer.cus_address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_address: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter customer address"
                  multiline
                  rows={2}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapPinIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Second Row - Customer Type, Category */}

              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    aria-label="Add type"
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onClick={() => setShowCustomerTypePopup(true)}
                    sx={{ color: 'primary.main' }}
                  >
                    <AddIcon />
                  </IconButton>

                  <Autocomplete
                    fullWidth
                    required
                    openOnFocus
                    autoHighlight
                    selectOnFocus
                    autoSelect
                    sx={{ flex: 1 }}
                    options={[
                      { id: '', title: 'Select a type' },
                      ...customerTypes.map(type => ({
                        id: type.cus_type_id,
                        title: type.cus_type_title
                      }))
                    ]}
                    value={(() => {
                      const options = [
                        { id: '', title: 'Select a type' },
                        ...customerTypes.map(type => ({
                          id: type.cus_type_id,
                          title: type.cus_type_title
                        }))
                      ];
                      return options.find(option => option.id === newCustomer.cus_type) || { id: '', title: 'Select a type' };
                    })()}
                    onChange={(event, newValue) => {
                      setNewCustomer(prev => ({
                        ...prev,
                        cus_type: newValue ? newValue.id : ''
                      }));
                    }}
                    getOptionLabel={(option) => option.title}
                    open={customerTypeOpen}
                    onOpen={() => setCustomerTypeOpen(true)}
                    onClose={() => setCustomerTypeOpen(false)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account Type"
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          // If user tabs into this field and the dropdown is open, pick the first real type when none selected
                          if (e.key === 'Tab' && customerTypeOpen) {
                            const firstType = customerTypes && customerTypes.length ? customerTypes[0].cus_type_id : '';
                            if (!newCustomer.cus_type && firstType) {
                              setNewCustomer(prev => ({ ...prev, cus_type: firstType }));
                            }
                            setCustomerTypeOpen(false);
                            // allow normal tab navigation to continue
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    aria-label="Add category"
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onClick={() => setShowCustomerCategoryPopup(true)}
                    sx={{ color: 'primary.main' }}
                  >
                    <AddIcon />
                  </IconButton>

                  <Autocomplete
                    fullWidth
                    required
                    openOnFocus
                    autoHighlight
                    selectOnFocus
                    autoSelect
                    sx={{ flex: 1 }}
                    options={[
                      { id: '', title: 'Select a category' },
                      ...customerCategories.map(category => ({
                        id: category.cus_cat_id,
                        title: category.cus_cat_title
                      }))
                    ]}
                    value={(() => {
                      const options = [
                        { id: '', title: 'Select a category' },
                        ...customerCategories.map(category => ({
                          id: category.cus_cat_id,
                          title: category.cus_cat_title
                        }))
                      ];
                      return options.find(option => option.id === newCustomer.cus_category) || { id: '', title: 'Select a category' };
                    })()}
                    onChange={(event, newValue) => {
                      setNewCustomer(prev => ({
                        ...prev,
                        cus_category: newValue ? newValue.id : ''
                      }));
                    }}
                    getOptionLabel={(option) => option.title}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account Category"
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                            const firstCat = customerCategories && customerCategories.length ? customerCategories[0].cus_cat_id : '';
                            if (!newCustomer.cus_category && firstCat) setNewCustomer(prev => ({ ...prev, cus_category: firstCat }));
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <BusinessIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>
              </Grid>

              {/* Third Row - Reference, Account Info, City */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Reference"
                  name="cus_reference"
                  value={newCustomer.cus_reference}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_reference: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter reference number"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Account Info"
                  name="cus_account_info"
                  value={newCustomer.cus_account_info}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_account_info: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter account information"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    aria-label="Add city"
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onClick={() => setShowCityPopup(true)}
                    sx={{ color: 'primary.main' }}
                  >
                    <AddIcon />
                  </IconButton>

                  <Autocomplete
                    fullWidth
                    openOnFocus
                    autoHighlight
                    selectOnFocus
                    autoSelect
                    sx={{ flex: 1 }}
                    options={[
                      { id: '', title: 'Select a city' },
                      ...cities.map(city => ({
                        id: city.city_id,
                        title: city.city_name
                      }))
                    ]}
                    value={(() => {
                      const options = [
                        { id: '', title: 'Select a city' },
                        ...cities.map(city => ({
                          id: city.city_id,
                          title: city.city_name
                        }))
                      ];
                      return options.find(option => option.id === newCustomer.city_id) || { id: '', title: 'Select a city' };
                    })()}
                    onChange={(event, newValue) => {
                      setNewCustomer(prev => ({
                        ...prev,
                        city_id: newValue ? newValue.id : ''
                      }));
                    }}
                    getOptionLabel={(option) => option.title}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City"
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                            const firstCity = cities && cities.length ? cities[0].city_id : '';
                            if (!newCustomer.city_id && firstCity) setNewCustomer(prev => ({ ...prev, city_id: firstCity }));
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <MapPinIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>
              </Grid>

              {/* Fourth Row - CNIC, NTN, Balance */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="CNIC"
                  name="CNIC"
                  value={newCustomer.CNIC}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, CNIC: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter CNIC number"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="NTN Number"
                  name="NTN_NO"
                  value={newCustomer.NTN_NO}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, NTN_NO: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter NTN number"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  disabled
                  label="Initial Balance"
                  name="cus_balance"
                  type="number"
                  inputProps={{ readOnly: true }}
                  value={newCustomer.cus_balance}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_balance: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Balance is non-editable"
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <AttachMoneyIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Fifth Row - Other, Name in Urdu */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Other Information"
                  name="other"
                  value={newCustomer.other}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, other: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter other information"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name in Urdu"
                  name="name_urdu"
                  value={newCustomer.name_urdu}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name_urdu: e.target.value }))}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter name in Urdu"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={handleCloseCustomerPopup} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={isSavingCustomer}
            startIcon={isSavingCustomer ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: '#6f42c1', '&:hover': { bgcolor: '#5a2d91' }, minWidth: 140 }}
          >
            {isSavingCustomer ? 'Saving...' : 'Create Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bill View Dialog */}
      <Dialog
        open={viewBillDialog}
        onClose={handleCloseBillDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: '148mm', // A5 width
            maxWidth: '148mm',
            '@media print': {
              width: '148mm',
              maxWidth: '148mm',
              margin: '0 auto'
            }
          }
        }}
      >
        <DialogTitle component="div" sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'primary.main',
          color: 'white',
          py: 2,
          px: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              Bill Details - {getBillDisplayNo(selectedBill)}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseBillDialog}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'white' }}>
          {selectedBill && (
            <Box id="printable-invoice" sx={{ width: '100%', bgcolor: 'white', p: 2 }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', pb: 1, mb: 1, borderBottom: '2px solid #000' }}>
                <Typography sx={{
                  fontWeight: 'bold',
                  mb: 0.25,
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '1.4rem',
                  direction: 'rtl',
                  color: '#000'
                }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography sx={{
                  mb: 0.25,
                  fontSize: '0.85rem',
                  direction: 'rtl',
                  color: '#000'
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                  <PhoneIcon sx={{ color: '#25D366', fontSize: '0.9rem' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#000' }}>
                    Ph:- 0346-7560306, 0300-7560306
                  </Typography>
                </Box>
                <Typography sx={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  mt: 0.5,
                  fontSize: '1rem',
                  color: '#000'
                }}>
                  ORDER INVOICE
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 1, py: 1, mb: 1.5, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%' }}>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Customer Name: &nbsp;<strong>{selectedBill.customer?.cus_name || 'Cash Customer'}</strong>
                  </Typography>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Phone No: &nbsp;<strong>{selectedBill.customer?.cus_phone_no || 'N/A'}</strong>
                  </Typography>
                  {selectedBill.customer?.cus_address && (
                    <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                      Address: &nbsp;<strong>{selectedBill.customer.cus_address}</strong>
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Invoice No: &nbsp;<strong>{getBillDisplayNo(selectedBill)}</strong>
                  </Typography>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Order ID: &nbsp;<strong>{selectedBill.sale_id || getBillDisplayNo(selectedBill)}</strong>
                  </Typography>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Date: &nbsp;<strong>{new Date(selectedBill.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                  </Typography>
                  <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                    Time: &nbsp;<strong>{new Date(selectedBill.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                    Created By: &nbsp;<strong>{getCreatedByName(selectedBill, currentUser)}</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Product Table */}
              <Box sx={{ px: 1, py: 0.5 }}>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5, border: '1px solid #000', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#808080' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="center">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedBill.sale_details && selectedBill.sale_details.length > 0 ? (
                        selectedBill.sale_details.map((detail, index) => (
                          <TableRow key={detail.sale_detail_id || index}>
                            <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }}>{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="center">{fmtAmt(detail.qnty || 0)}</TableCell>
                            <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                            <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 2, color: '#000', fontSize: '0.85rem' }}>
                            No items found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Payment Summary */}
                <Box sx={{ mt: 1.5, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>سابقہ بقایا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(selectedBill.customer?.cus_balance)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>موجوده بقايا</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#808080' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>كل بقايا</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>
                              {fmtAmt(parseFloat(selectedBill.customer?.cus_balance || 0) + parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {selectedBill.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                          <strong>Notes:</strong> {selectedBill.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt((selectedBill.sale_details || []).reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(selectedBill.labour)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(selectedBill.shipping_amount)}
                            </TableCell>
                          </TableRow>
                          {parseFloat(selectedBill.discount || 0) > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رعایت</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                {fmtAmt(selectedBill.discount)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(selectedBill.total_amount)}
                            </TableCell>
                          </TableRow>
                          {(() => {
                            let cashAmount = 0;
                            let bankAmount = 0;
                            let bankName = '';

                            if (selectedBill.hasOwnProperty('cash_payment') && selectedBill.hasOwnProperty('bank_payment')) {
                              cashAmount = parseFloat(selectedBill.cash_payment || 0);
                              bankAmount = parseFloat(selectedBill.bank_payment || 0);
                              bankName = selectedBill.bank_title || selectedBill.debit_account?.cus_name || 'بینک';
                            } else {
                              if (selectedBill.payment_type === 'CASH' || !selectedBill.payment_type) {
                                cashAmount = parseFloat(selectedBill.payment || 0);
                                bankAmount = 0;
                              } else {
                                cashAmount = 0;
                                bankAmount = parseFloat(selectedBill.payment || 0);
                                bankName = selectedBill.debit_account?.cus_name || 'بینک';
                              }
                            }

                            return (
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>
                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#808080' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>بقایا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}
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
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0' }} className="no-print">
          <Button
            onClick={handleCloseBillDialog}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 150,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
            onClick={() => handlePrintBill('EXISTING')}
          >
            Print Bill
          </Button>
          <Button
            variant="contained"
            sx={{
              minWidth: 150,
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' }
            }}
            onClick={() => handleSendWhatsApp(selectedBill, 'printable-invoice')}
            disabled={isSendingWhatsApp || !selectedBill?.customer?.cus_phone_no}
            title={!selectedBill?.customer?.cus_phone_no ? 'No phone number on file' : 'Send receipt via WhatsApp'}
          >
            {isSendingWhatsApp ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : null}
            {isSendingWhatsApp ? 'Sending...' : '📲 WhatsApp'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body.print-thermal *,
          body.print-a4 *,
          body.print-existing * {
            visibility: hidden !important;
          }

          /* Collapse height of all layout wrappers and background components when printing */
          body.print-thermal .dashboard-layout-root,
          body.print-thermal .MuiContainer-root,
          body.print-thermal .MuiStack-root,
          body.print-thermal .MuiCard-root,
          body.print-thermal .MuiPaper-root,
          body.print-thermal .MuiTableContainer-root,
          body.print-thermal .MuiTable-root,
          body.print-thermal .MuiDialog-root,
          body.print-thermal .no-print,
          body.print-a4 .dashboard-layout-root,
          body.print-a4 .MuiContainer-root,
          body.print-a4 .MuiStack-root,
          body.print-a4 .MuiCard-root,
          body.print-a4 .MuiPaper-root,
          body.print-a4 .MuiTableContainer-root,
          body.print-a4 .MuiTable-root,
          body.print-a4 .MuiDialog-root,
          body.print-a4 .no-print,
          body.print-existing .dashboard-layout-root,
          body.print-existing .MuiContainer-root,
          body.print-existing .MuiStack-root,
          body.print-existing .MuiCard-root,
          body.print-existing .MuiPaper-root,
          body.print-existing .MuiTableContainer-root,
          body.print-existing .MuiTable-root,
          body.print-existing .MuiDialog-root,
          body.print-existing .no-print {
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          /* Thermal Print Styling */
          body.print-thermal #printable-invoice-thermal,
          body.print-thermal #printable-invoice-thermal * {
            visibility: visible !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          body.print-thermal #printable-invoice-thermal {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            max-width: 78mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
            z-index: 999999 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          /* A4 / Existing Order Print Styling */
          body.print-existing #printable-invoice,
          body.print-existing #printable-invoice *,
          body.print-a4 #printable-invoice,
          body.print-a4 #printable-invoice * {
            visibility: visible !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          body.print-existing #printable-invoice,
          body.print-a4 #printable-invoice {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 148mm !important;
            max-width: 148mm !important;
            margin: 0 auto !important;
            padding: 5mm !important;
            box-sizing: border-box !important;
            z-index: 999999 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Sale Return Dialog */}
      <Dialog
        open={returnDialogOpen}
        onClose={handleCloseReturnDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="div" sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'error.main',
          color: 'white',
          py: 2,
          px: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingDownIcon />
            <Typography variant="h6" component="span">Process Sale Return</Typography>
          </Box>
          <IconButton
            onClick={handleCloseReturnDialog}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedSaleForReturn && (
            <Box>
              {/* Sale Information */}
              <Card sx={{ mb: 3, bgcolor: 'info.light', p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Sale Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Sale ID:</strong> #{selectedSaleForReturn.sale_id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Customer:</strong> {selectedSaleForReturn.customer?.cus_name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Total Amount:</strong> {fmtAmt(selectedSaleForReturn.total_amount)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Date:</strong> {new Date(selectedSaleForReturn.created_at).toLocaleDateString('en-GB')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Bill Type:</strong> {selectedSaleForReturn.bill_type || 'BILL'}</Typography>
                  </Grid>
                </Grid>
              </Card>

              {/* Return Products */}
              <Typography variant="h6" sx={{ mb: 2 }}>Products to Return</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.200' }}>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnFormData.return_details.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">No products selected</TableCell>
                      </TableRow>
                    ) : (
                      returnFormData.return_details.map((detail, index) => {
                        const product = products.find(p => p.pro_id === detail.pro_id);
                        return (
                          <TableRow key={index}>
                            <TableCell>{product?.pro_title || 'N/A'}</TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                value={detail.qnty}
                                onChange={(e) => updateReturnDetailQty(index, e.target.value)}
                                sx={{ width: 80 }}
                                inputProps={{ min: 0 }}
                              />
                            </TableCell>
                            <TableCell align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                            <TableCell align="right">{fmtAmt(detail.total_amount)}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeReturnDetail(index)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Return Form */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Bill Type</InputLabel>
                    <Select
                      name="bill_type"
                      value={returnFormData.bill_type}
                      onChange={handleReturnInputChange}
                      label="Bill Type"
                      disabled
                    >
                      <MenuItem value="BILL">Bill</MenuItem>
                      <MenuItem value="QUOTATION">Quotation</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Reference"
                    name="reference"
                    value={returnFormData.reference}
                    onChange={handleReturnInputChange}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Return Reason *"
                    name="reason"
                    value={returnFormData.reason}
                    onChange={handleReturnInputChange}
                    multiline
                    rows={3}
                    required
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Total Amount"
                    value={calculateReturnTotal().toFixed(2)}
                    disabled
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Discount"
                    name="discount"
                    type="number"
                    value={returnFormData.discount}
                    onChange={handleReturnInputChange}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Net Total"
                    value={calculateReturnNetTotal().toFixed(2)}
                    disabled
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Refund Amount *"
                    name="payment"
                    type="number"
                    value={returnFormData.payment}
                    onChange={handleReturnInputChange}
                    required
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Payment Type</InputLabel>
                    <Select
                      name="payment_type"
                      value={returnFormData.payment_type}
                      onChange={handleReturnInputChange}
                      label="Payment Type"
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="CHEQUE">Cheque</MenuItem>
                      <MenuItem value="BANK">Bank Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={handleCloseReturnDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReturn}
            variant="contained"
            color="error"
            disabled={returnFormData.return_details.length === 0 || !returnFormData.reason}
          >
            Process Return
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Category Popup */}
      <Dialog
        open={showCustomerCategoryPopup}
        onClose={() => setShowCustomerCategoryPopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div" sx={{
          background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
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
              background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
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

      {/* Account Type Popup */}
      <Dialog
        open={showCustomerTypePopup}
        onClose={() => setShowCustomerTypePopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle component="div" sx={{
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
        <DialogTitle component="div" sx={{
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

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />

      {/* Thermal Printable Container - Redesigned 80mm Receipt */}
      {(() => {
        const activeBillData = currentBillData || selectedBill;
        if (!activeBillData) return <Box id="printable-invoice-thermal" sx={{ display: 'none' }}></Box>;

        const totalAmount = parseFloat(activeBillData.total_amount || 0);
        const discountAmount = parseFloat(activeBillData.discount || 0);
        const shippingAmount = parseFloat(activeBillData.shipping_amount || 0);
        const labourAmount = parseFloat(activeBillData.labour_charges || activeBillData.labour || 0);
        const subtotalAmount = totalAmount - labourAmount - shippingAmount + discountAmount;
        const paidAmount = parseFloat(activeBillData.payment || 0);
        const balanceAmount = totalAmount - paidAmount;

        return (
          <Box
            id="printable-invoice-thermal"
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
                ORDER RECEIPT
              </Typography>
            </Box>

            {/* Meta */}
            <Box sx={{ py: 0.75, fontSize: '11px', borderBottom: '1px dashed #000', color: '#000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Inv #: <strong>{getBillDisplayNo(activeBillData)}</strong></span>
                <span>Date: <strong>{new Date(activeBillData.created_at).toLocaleDateString('en-GB')}</strong></span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                <span>Time: <strong>{new Date(activeBillData.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></span>
                <span>Type: <strong>{activeBillData.bill_type || 'BILL'}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Cust: <strong>{activeBillData.customer?.cus_name || 'Cash Customer'}</strong></span>
              </Box>
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
              {activeBillData.sale_details && activeBillData.sale_details.length > 0 ? (
                activeBillData.sale_details.map((d, i) => (
                  <Box key={d.sale_detail_id || i} sx={{ mb: 0.75 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#000', wordBreak: 'break-word' }}>
                      {d.product?.pro_title || 'Item'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#000' }}>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: '11px', width: '35px', textAlign: 'center', color: '#000' }}>
                        {fmtAmt(d.qnty)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', width: '50px', textAlign: 'right', color: '#000' }}>
                        {fmtAmt(d.unit_rate)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', fontWeight: 'bold', width: '55px', textAlign: 'right', color: '#000' }}>
                        {fmtAmt(d.total_amount)}
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
              {activeBillData.cash_payment > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Cash Paid</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>{fmtAmt(activeBillData.cash_payment)}</Typography>
                </Box>
              )}
              {activeBillData.bank_payment > 0 && (
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

      {/* Root Level A4 Printable Container */}
      {(() => {
        const activeBillData = currentBillData || selectedBill;
        if (!activeBillData) return <Box id="printable-invoice" sx={{ display: 'none' }}></Box>;

        return (
          <Box
            id="printable-invoice"
            sx={{
              width: '148mm',
              maxWidth: '148mm',
              bgcolor: '#ffffff',
              color: '#000000',
              mx: 'auto',
              p: 2,
              display: 'none',
              boxSizing: 'border-box',
            }}
          >
            {/* Company Header */}
            <Box sx={{ textAlign: 'center', pb: 1, mb: 1, borderBottom: '2px solid #000' }}>
              <Typography sx={{
                fontWeight: 'bold',
                mb: 0.25,
                fontFamily: 'Arial, sans-serif',
                fontSize: '1.4rem',
                direction: 'rtl',
                color: '#000'
              }}>
                اتفاق آئرن اینڈ سیمنٹ سٹور
              </Typography>
              <Typography sx={{
                mb: 0.25,
                fontSize: '0.85rem',
                direction: 'rtl',
                color: '#000'
              }}>
                گجرات سرگودھا روڈ، پاہڑیانوالی
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <PhoneIcon sx={{ color: '#25D366', fontSize: '0.9rem' }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#000' }}>
                  Ph:- 0346-7560306, 0300-7560306
                </Typography>
              </Box>
              <Typography sx={{
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: 1,
                mt: 0.5,
                fontSize: '1rem',
                color: '#000'
              }}>
                ORDER INVOICE
              </Typography>
            </Box>

            {/* Customer and Invoice Details */}
            <Box sx={{ px: 1, py: 1, mb: 1.5, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
              <Box sx={{ flex: '0 0 50%' }}>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Customer Name: &nbsp;<strong>{activeBillData.customer?.cus_name || 'Cash Customer'}</strong>
                </Typography>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Phone No: &nbsp;<strong>{activeBillData.customer?.cus_phone_no || 'N/A'}</strong>
                </Typography>
                {activeBillData.customer?.cus_address && (
                  <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                    Address: &nbsp;<strong>{activeBillData.customer.cus_address}</strong>
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Invoice No: &nbsp;<strong>{getBillDisplayNo(activeBillData)}</strong>
                </Typography>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Order ID: &nbsp;<strong>{activeBillData.sale_id || getBillDisplayNo(activeBillData)}</strong>
                </Typography>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Date: &nbsp;<strong>{new Date(activeBillData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                </Typography>
                <Typography sx={{ mb: 0.25, fontSize: '0.85rem', color: '#000' }}>
                  Time: &nbsp;<strong>{new Date(activeBillData.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                  Created By: &nbsp;<strong>{getCreatedByName(activeBillData, currentUser)}</strong>
                </Typography>
              </Box>
            </Box>

            {/* Product Table */}
            <Box sx={{ px: 1, py: 0.5 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5, border: '1px solid #000', boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#808080' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>S#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="center">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Rate</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff', py: 0.75, px: 1, fontSize: '0.85rem', border: '1px solid #777' }} align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeBillData.sale_details && activeBillData.sale_details.length > 0 ? (
                      activeBillData.sale_details.map((detail, index) => (
                        <TableRow key={detail.sale_detail_id || index}>
                          <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }}>{index + 1}</TableCell>
                          <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }}>{detail.product?.pro_title || detail.product?.pro_name || 'N/A'}</TableCell>
                          <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="center">{fmtAmt(detail.qnty || 0)}</TableCell>
                          <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                          <TableCell sx={{ px: 1, py: 0.5, color: '#000', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #777' }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 2, color: '#000', fontSize: '0.85rem' }}>
                          No items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Payment Summary */}
              <Box sx={{ mt: 1.5, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                {/* Left Side - Customer Balance */}
                <Box sx={{ flex: '0 0 48%' }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>سابقہ بقایا</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(activeBillData.customer?.cus_balance)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>موجوده بقايا</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(parseFloat(activeBillData.total_amount || 0) - parseFloat(activeBillData.payment || 0))}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: '#808080' }}>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>كل بقايا</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>
                            {fmtAmt(parseFloat(activeBillData.customer?.cus_balance || 0) + parseFloat(activeBillData.total_amount || 0) - parseFloat(activeBillData.payment || 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {activeBillData.notes && (
                    <Box sx={{ mt: 1 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: '#000' }}>
                        <strong>Notes:</strong> {activeBillData.notes}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Right Side - Payment Summary */}
                <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رقم بل</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt((activeBillData.sale_details || []).reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0))}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>مزدوری</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(activeBillData.labour_charges || activeBillData.labour)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>کرایہ</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(activeBillData.shipping_amount)}
                          </TableCell>
                        </TableRow>
                        {parseFloat(activeBillData.discount || 0) > 0 && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>رعایت</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(activeBillData.discount)}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>كل رقم</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(activeBillData.total_amount)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>نقد كيش</TableCell>
                          <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                            {fmtAmt(activeBillData.cash_payment || (activeBillData.payment_type === 'CASH' ? activeBillData.payment : 0))}
                          </TableCell>
                        </TableRow>
                        {parseFloat(activeBillData.bank_payment || 0) > 0 && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {activeBillData.bank_title || 'بینک'}
                            </TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.4, border: '1px solid #777', color: '#000', fontSize: '0.85rem' }}>
                              {fmtAmt(activeBillData.bank_payment)}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow sx={{ bgcolor: '#808080' }}>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>بقایا رقم</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.4, border: '1px solid #777', color: '#ffffff', fontSize: '0.85rem' }}>
                            {fmtAmt(parseFloat(activeBillData.total_amount || 0) - parseFloat(activeBillData.payment || 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })()}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <Container
          maxWidth={false}
          sx={{
            py: 4,
            maxWidth: {
              xs: '100%',           // Mobile: full width
              sm: '100%',           // Small screens: full width  
              md: '100%',           // Medium screens: full width
              lg: '1200px',         // Large screens: reasonable max width
              xl: '1400px'          // Extra large screens: slightly larger max width
            },
            mx: 'auto',             // Center the content
            px: { xs: 2, sm: 3, md: 4 } // Responsive horizontal padding
          }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}