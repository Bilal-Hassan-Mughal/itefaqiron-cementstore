'use client';

import { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
import { formatDatePK, formatDateTimePK, formatTimePK, getCreatedByName } from '@/lib/date-helper';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
import SaveProgressBackdrop from '../components/save-progress-backdrop';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH } from '@/lib/ledger-tabs';

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
  Popper,
  Fade,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  ListAlt as ListAltIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Sync as SyncIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';

import { getOfflineSalesQueue, saveOfflineSale, syncOfflineSalesQueue } from '@/lib/offline-sales-helper';
import { BRAND } from '@/lib/brand-theme';

// Helper to get product cost price safely, handling decimal-as-string from API and avoiding JS truthy string bugs
const getProductCostPrice = (product) => {
  if (!product) return 0;
  const crateVal = parseFloat(product.pro_crate || 0);
  const costPriceVal = parseFloat(product.pro_cost_price || 0);
  if (crateVal > 0) return crateVal;
  return costPriceVal;
};

const EMPTY_PAYMENT_DATA = {
  cash: '',
  bank: '',
  bankAccountId: '',
  totalCashReceived: 0,
  advancePayment: 0,
  discount: '',
  labour: '',
  deliveryCharges: '',
  notes: '',
  isLoadedOrder: false,
};

const normalizePaymentData = (data) => ({
  cash: data?.cash ?? EMPTY_PAYMENT_DATA.cash,
  bank: data?.bank ?? EMPTY_PAYMENT_DATA.bank,
  bankAccountId: data?.bankAccountId ?? EMPTY_PAYMENT_DATA.bankAccountId,
  totalCashReceived: data?.totalCashReceived ?? EMPTY_PAYMENT_DATA.totalCashReceived,
  advancePayment: data?.advancePayment ?? EMPTY_PAYMENT_DATA.advancePayment,
  discount: data?.discount ?? EMPTY_PAYMENT_DATA.discount,
  labour: data?.labour ?? EMPTY_PAYMENT_DATA.labour,
  deliveryCharges: data?.deliveryCharges ?? EMPTY_PAYMENT_DATA.deliveryCharges,
  notes: data?.notes ?? EMPTY_PAYMENT_DATA.notes,
  isLoadedOrder: data?.isLoadedOrder ?? EMPTY_PAYMENT_DATA.isLoadedOrder,
});

const EMPTY_PRODUCT_FORM_DATA = {
  quantity: '',
  rate: '',
  amount: '',
  stock: '',
  crate: '',
};

const normalizeProductFormData = (data) => ({
  quantity: data?.quantity ?? EMPTY_PRODUCT_FORM_DATA.quantity,
  rate: data?.rate ?? EMPTY_PRODUCT_FORM_DATA.rate,
  amount: data?.amount ?? EMPTY_PRODUCT_FORM_DATA.amount,
  stock: data?.stock ?? EMPTY_PRODUCT_FORM_DATA.stock,
  crate: data?.crate ?? EMPTY_PRODUCT_FORM_DATA.crate,
});

const EMPTY_CUSTOMER_FORM = {
  cus_name: '',
  cus_phone_no: '',
  cus_phone_no2: '',
  cus_address: '',
  cus_reference: '',
  cus_account_info: '',
  other: '',
  cus_category: '',
  cus_type: '',
  cus_balance: '',
  CNIC: '',
  NTN_NO: '',
  name_urdu: '',
  city_id: '',
};

const paymentInputValue = (value) => (value === 0 || value === '' || value == null ? '' : value);

const SALES_PAGE_CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const SALES_EXCEL_TABLE_SX = {
  minWidth: 1200,
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid #cbd5e1',
    py: 0.65,
    px: 1.1,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
  },
};

const SALES_EXCEL_HEAD_SX = {
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

const SALES_NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const SALES_STATS_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(2, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: 1.5,
  width: '100%',
};

const SALES_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: { xs: 1.5, md: 2 },
  width: '100%',
};

const SALES_FILTER_FIELD_SX = {
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

const getBillTypeChipSx = (billType) => {
  const type = (billType || '').toUpperCase();
  if (type === 'SALE_RETURN') {
    return { bgcolor: '#ffe8f0', color: '#cc0644', border: '1px solid #ffb3c9' };
  }
  if (type === 'QUOTATION') {
    return { bgcolor: '#e8effd', color: '#1347c4', border: '1px solid #b8ccf7' };
  }
  return { bgcolor: '#e6fff4', color: '#00a868', border: '1px solid #99ebc9' };
};

let salesPageBootId = 0;
if (typeof window !== 'undefined') {
  window.__salesPageBootId = (window.__salesPageBootId ?? 0) + 1;
  salesPageBootId = window.__salesPageBootId;
}

function SalesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();

  // Network & Offline Queue state
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // State management
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [productSubcategories, setProductSubcategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [savingBill, setSavingBill] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const getCurrentUserId = () => {
    const raw = currentUser?.user_id ?? currentUser?.id;
    if (raw == null || raw === '') return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(u);
      } catch (e) {}
    }
  }, []);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBillType, setFilterBillType] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterAmount, setFilterAmount] = useState('');
  const [filterBalanceStatus, setFilterBalanceStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterNotes, setFilterNotes] = useState('');

  // Bill view state
  const [viewBillDialog, setViewBillDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [currentView, setCurrentView] = useState('list');
  const [hoveredSale, setHoveredSale] = useState(null);
  const [hoverPos, setHoverPos] = useState({ top: 0, left: 0 });

  // Screen Stack State
  const [screenStack, setScreenStack] = useState([]);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(-1);
  const [showScreenIndicator, setShowScreenIndicator] = useState(false);

  // Track which data bundles have been loaded (avoid duplicate API calls)
  const dataLoadedRef = useRef({ list: false, form: false, listFilters: false, dialogLookups: false });
  const lastBootIdRef = useRef(salesPageBootId);

  // Offline Auto-Sync Helpers & Event Listeners
  const refreshOfflineCount = useCallback(() => {
    setOfflineQueueCount(getOfflineSalesQueue().length);
  }, []);

  const triggerAutoSync = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const queue = getOfflineSalesQueue();
    if (!queue || queue.length === 0) {
      refreshOfflineCount();
      return;
    }
    setIsSyncingOffline(true);
    try {
      const result = await syncOfflineSalesQueue((serverResult, offlineItem) => {
        console.log(`✅ Offline bill ${offlineItem.offlineId} synced to server as Sale #${serverResult.sale_id}`);
      });
      refreshOfflineCount();
      if (result.syncedCount > 0) {
        showSnackbar(`✅ ${result.syncedCount} offline bill(s) uploaded to server automatically!`, 'success');
        fetchData({ mode: 'list', silent: true });
      }
    } catch (e) {
      console.error('Error auto-syncing offline sales:', e);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [refreshOfflineCount]);

  useEffect(() => {
    refreshOfflineCount();
    const handleOnline = () => {
      setIsOnline(true);
      showSnackbar('🌐 Internet connection restored! Syncing pending offline bills...', 'info');
      triggerAutoSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showSnackbar('⚡ Offline mode active. New bills will be saved locally.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync check every 20 seconds
    const syncInterval = setInterval(() => {
      if (navigator.onLine && getOfflineSalesQueue().length > 0) {
        triggerAutoSync();
      }
    }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [triggerAutoSync, refreshOfflineCount]);

  // Handle loading quotation from URL
  const loadedQuotationIdRef = useRef(null);

  useEffect(() => {
    const quotationId = searchParams?.get('quotationId') || searchParams?.get('orderId');

    // Only proceed if we have a quotation/order ID, reference data is loaded, and we haven't loaded this ID yet
    if (quotationId &&
      quotationId !== loadedQuotationIdRef.current &&
      customers.length > 0 &&
      stores.length > 0 &&
      currentView === 'create') {

      const loadQuotationFromUrl = async () => {
        try {
          setLoading(true);
          loadedQuotationIdRef.current = quotationId; // Mark as loading/loaded

          const response = await fetch(`/api/sales?id=${quotationId}`);
          if (!response.ok) throw new Error('Failed to fetch quotation/order details');
          const fullQuotation = await response.json();

          console.log('📦 Loaded Order/Quotation from URL:', fullQuotation);

          // Set Customer
          if (fullQuotation.customer) {
            const matchingCustomer = customers.find(c => c.cus_id === fullQuotation.customer.cus_id);
            setFormSelectedCustomer(matchingCustomer || fullQuotation.customer);
          } else if (fullQuotation.cus_id) {
            const customer = customers.find(c => c.cus_id === fullQuotation.cus_id);
            if (customer) setFormSelectedCustomer(customer);
          }

          // Set Store
          let selectedStore = null;
          if (fullQuotation.store_id) {
            selectedStore = stores.find(s => s.storeid === fullQuotation.store_id);
          }

          if (selectedStore) {
            setFormSelectedStore(selectedStore);
          } else if (stores.length > 0) {
            setFormSelectedStore(stores[0]);
            selectedStore = stores[0];
          }

          // Map Products if available (reversed order)
          if (fullQuotation.sale_details && Array.isArray(fullQuotation.sale_details) && fullQuotation.sale_details.length > 0) {
            const mappedProducts = fullQuotation.sale_details.slice().reverse().map((item, index) => ({
              id: Date.now() + index,
              pro_id: item.pro_id,
              pro_title: item.product ? (item.product.pro_title || item.product.pro_name) : 'Unknown Product',
              quantity: parseFloat(item.qnty || 0),
              rate: parseFloat(item.unit_rate || 0),
              amount: parseFloat(item.total_amount || 0),
              crate: item.product ? (item.product.pro_crate || '') : '',
              stock: 0,
              storeid: fullQuotation.store_id || selectedStore?.storeid,
              store_name: selectedStore ? selectedStore.store_name : 'Unknown'
            }));
            setProductTableData(mappedProducts);
          }

          // Set payment data
          setPaymentData(prev => ({
            ...prev,
            advancePayment: '',
            discount: parseFloat(fullQuotation.discount || 0) || '',
            notes: fullQuotation.reference ? `${fullQuotation.reference} (Ref Order #${quotationId})` : `Ref Order #${quotationId}`,
            isLoadedOrder: true
          }));

          setLoadedOrderId(parseInt(quotationId));
          showSnackbar(`Order #${quotationId} details loaded. Save bill to complete conversion.`, 'info');
        } catch (error) {
          console.error('Error loading quotation from URL:', error);
          showSnackbar('Failed to load quotation from URL', 'error');
          loadedQuotationIdRef.current = null; // Reset on error so user can retry
        } finally {
          setLoading(false);
        }
      };

      loadQuotationFromUrl();
    }
  }, [searchParams, customers, stores, currentView]);

  // Handle loading draft from URL (draftId)
  const loadedDraftIdRef = useRef(null);

  useEffect(() => {
    const draftId = searchParams?.get('draftId');

    if (draftId &&
      draftId !== loadedDraftIdRef.current &&
      customers.length > 0 &&
      stores.length > 0 &&
      currentView === 'create') {

      const loadDraftFromUrl = async () => {
        try {
          setLoading(true);
          loadedDraftIdRef.current = draftId;

          const response = await fetch(`/api/draft-sales?id=${draftId}`);
          if (!response.ok) throw new Error('Failed to load draft');

          const fullDraft = await response.json();
          const formState = JSON.parse(fullDraft.form_state_json);

          if (formState.customer) setFormSelectedCustomer(formState.customer);
          if (formState.store) setFormSelectedStore(formState.store);
          if (formState.products) setProductTableData(formState.products);
          if (formState.paymentData) setPaymentData(normalizePaymentData(formState.paymentData));
          if (formState.billType) setBillType(formState.billType);
          if (formState.transportOptions) setTransportOptions(formState.transportOptions);

          setCurrentDraftId(parseInt(draftId));
          showSnackbar(`✅ Draft ${fullDraft.draft_code} loaded into POS`, 'success');
        } catch (error) {
          console.error('Error loading draft from URL:', error);
          showSnackbar('Failed to load draft from URL', 'error');
          loadedDraftIdRef.current = null;
        } finally {
          setLoading(false);
        }
      };

      loadDraftFromUrl();
    }
  }, [searchParams, customers, stores, currentView]);

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
    labour_charges: '',
    bill_type: 'BILL',
    reason: '',
    reference: '',
    return_details: []
  });
  const [debitAccountSearchTerm, setDebitAccountSearchTerm] = useState('');
  const [creditAccountSearchTerm, setCreditAccountSearchTerm] = useState('');

  // Form state for sales creation
  const [formSelectedCustomer, setFormSelectedCustomer] = useState(null);
  const [formSelectedProduct, setFormSelectedProduct] = useState(null);
  const [formSelectedStore, setFormSelectedStore] = useState(null);

  // Sale Return state for main form
  const [saleSearchOpen, setSaleSearchOpen] = useState(false);
  const [saleSearchResults, setSaleSearchResults] = useState([]);
  const [selectedSaleForReturnMain, setSelectedSaleForReturnMain] = useState(null); // Distinct from dialog state

  // Product form state
  const [productFormData, setProductFormData] = useState({ ...EMPTY_PRODUCT_FORM_DATA });

  // Per-product dropdown 'eye' visibility state (which options show purchase rate)
  const [visibleCrates, setVisibleCrates] = useState([]);
  const toggleVisibleCrate = (proId) => {
    setVisibleCrates(prev => {
      const exists = prev.includes(proId);
      return exists ? prev.filter(id => id !== proId) : [...prev, proId];
    });
  };

  // Product table state
  const [productTableData, setProductTableData] = useState([]);
  const [lossConfirmOpen, setLossConfirmOpen] = useState(false);
  const [lossItems, setLossItems] = useState([]);

  // Transport state
  const [transportOptions, setTransportOptions] = useState([]);
  const [transportAccounts, setTransportAccounts] = useState([]);
  const [newTransport, setNewTransport] = useState({
    amount: 0,
    accountId: ''
  });

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState([]);

  // Payment and calculation state
  const [paymentData, setPaymentData] = useState({ ...EMPTY_PAYMENT_DATA });

  // Bill type state
  const [billType, setBillType] = useState(() => {
    if (typeof window === 'undefined') return 'BILL';
    const params = new URLSearchParams(window.location.search);
    return params.get('type') === 'return' ? 'SALE_RETURN' : 'BILL';
  });

  // URL shortcuts: sale return or explicit ?view=create only (sidebar opens list)
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const typeParam = searchParams?.get('type');

    if (typeParam === 'return') {
      setBillType('SALE_RETURN');
      setCurrentView('create');
      return;
    }

    if (viewParam === 'create') {
      setBillType('BILL');
      setCurrentView('create');
      return;
    }

    // Sidebar / header "New Sale" → sales list
    setCurrentView('list');
  }, [searchParams]);

  // Flag to track when we're restoring screen state
  const [isRestoringScreen, setIsRestoringScreen] = useState(false);

  // Load Order state
  const [loadOrderDialogOpen, setLoadOrderDialogOpen] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [loadedOrderId, setLoadedOrderId] = useState(null); // Track the order being converted to bill
  const [selectedCustomerTypeFilter, setSelectedCustomerTypeFilter] = useState(null); // Filter customers by type

  const isWalkinCustomer = (customer) => {
    if (!customer) return true;
    const name = (customer.cus_name || '').toLowerCase();
    const typeTitle = (customer.customer_type?.cus_type_title || customer.cus_type_title || '').toLowerCase();
    return (
      name.includes('walk') ||
      name.includes('cash') ||
      typeTitle.includes('walk') ||
      typeTitle.includes('cash')
    );
  };

  // Load Quotation state
  const [loadQuotationDialogOpen, setLoadQuotationDialogOpen] = useState(false);
  const [quotationSearchTerm, setQuotationSearchTerm] = useState('');

  // Customer creation popup state
  const [customerPopupOpen, setCustomerPopupOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [cities, setCities] = useState([]);

  // Popup states for adding new category, type, and city
  const [showCustomerCategoryPopup, setShowCustomerCategoryPopup] = useState(false);
  const [showCustomerTypePopup, setShowCustomerTypePopup] = useState(false);
  const [showCityPopup, setShowCityPopup] = useState(false);
  const [customerCategoryFormData, setCustomerCategoryFormData] = useState({ cus_cat_title: '' });
  const [customerTypeFormData, setCustomerTypeFormData] = useState({ cus_type_title: '' });
  const [cityFormData, setCityFormData] = useState({ city_name: '' });
  const [showAddProductPopup, setShowAddProductPopup] = useState(false);
  const [addProductFormData, setAddProductFormData] = useState({ pro_title: '', pro_description: '', cat_id: '', sub_cat_id: '', pro_crate: '', pro_sale_price: '', pro_baser_price: '', pro_cost_price: '', pro_stock_qnty: '', pro_unit: '', pro_packing: '', low_stock_quantity: '10' });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productCatInput, setProductCatInput] = useState('');
  const [productSubCatInput, setProductSubCatInput] = useState('');
  const [isAddingCustomerCategory, setIsAddingCustomerCategory] = useState(false);
  const [isAddingCustomerType, setIsAddingCustomerType] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [showAddProductCategoryPopup, setShowAddProductCategoryPopup] = useState(false);
  const [addProductCategoryName, setAddProductCategoryName] = useState('');
  const [isAddingProductCategory, setIsAddingProductCategory] = useState(false);
  const [showAddProductSubCategoryPopup, setShowAddProductSubCategoryPopup] = useState(false);
  const [addProductSubCategoryFormData, setAddProductSubCategoryFormData] = useState({ sub_cat_name: '', cat_id: '' });
  const [isAddingProductSubCategory, setIsAddingProductSubCategory] = useState(false);

  const [newCustomer, setNewCustomer] = useState({ ...EMPTY_CUSTOMER_FORM });

  // Draft Sales state
  const [drafts, setDrafts] = useState([]);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

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

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Auto-select first store when stores load
  useEffect(() => {
    if (!formSelectedStore && Array.isArray(stores) && stores.length > 0) {
      setFormSelectedStore(stores[0]);
    }
  }, [stores]);

  // Auto-filter bank accounts when customers, categories, or types change
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0 && customerTypes.length > 0) {
      console.log('🔍 Auto-filtering bank accounts for sales...');
      fetchBankAccounts(customers);
    }
  }, [customers, customerCategories, customerTypes]);

  // Ledger state
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [ledgerEndDate, setLedgerEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchLedgerData = async (customerId) => {
    if (!customerId) return;
    try {
      setLedgerLoading(true);
      const response = await fetch(`/api/reports?type=customer-ledger&customerId=${customerId}&startDate=${ledgerStartDate}&endDate=${ledgerEndDate}`);
      if (response.ok) {
        const data = await response.json();
        setLedgerData(data);
      } else {
        showSnackbar('Error fetching ledger data', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showSnackbar('Error fetching ledger data', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenLedger = () => {
    if (formSelectedCustomer) {
      fetchLedgerData(formSelectedCustomer.cus_id);
      setLedgerDialogOpen(true);
    } else {
      showSnackbar('Please select a customer first', 'error');
    }
  };

  const handleOpenCustomerLedger = (sale, e) => {
    if (e) e.stopPropagation();
    const cusId = sale?.cus_id ?? sale?.customer?.cus_id;
    const cusName = sale?.customer?.cus_name;
    if (!cusId) {
      showSnackbar('Customer not found for this sale', 'error');
      return;
    }
    openAccountLedgerTab(cusId, cusName);
    router.push(FINANCE_LEDGER_PATH);
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Initialize first screen on component mount
  useEffect(() => {
    // Create initial state for screen 1
    const initialState = {
      formSelectedCustomer: null,
      formSelectedStore: null,
      productTableData: [],
      paymentData: {
        cash: '',
        bank: '',
        bankAccountId: '',
        totalCashReceived: 0,
        advancePayment: 0,
        discount: '',
        labour: '',
        deliveryCharges: '',
        notes: ''
      },
      billType: 'BILL',
      formSelectedProduct: null,
      productFormData: {
        quantity: '',
        rate: 0,
        amount: 0,
        stock: 0,
        crate: ''
      },
      newTransport: {
        amount: 0,
        accountId: ''
      },
      transportAccounts: [],
      transportOptions: [],
      timestamp: new Date().toLocaleTimeString(),
      customerName: 'New Sale'
    };

    // Set the initial screen stack with screen 1
    setScreenStack([initialState]);
    setCurrentScreenIndex(0);
    console.log('✅ Screen 1 initialized by default');
  }, []); // Run only once on component mount

  // ========== SCREEN STACK MANAGEMENT FUNCTIONS ==========
  // Capture current form state (deep copy to avoid reference issues)
  const captureScreenState = () => {
    const state = {
      // Customer and store selection
      formSelectedCustomer: formSelectedCustomer ? { ...formSelectedCustomer } : null,
      formSelectedStore: formSelectedStore ? { ...formSelectedStore } : null,

      // Product table (deep copy array)
      productTableData: JSON.parse(JSON.stringify(productTableData)),

      // Payment data (deep copy)
      paymentData: JSON.parse(JSON.stringify(paymentData)),

      // Bill type & Loaded Order ID
      billType: billType,
      loadedOrderId: loadedOrderId,

      // Product form
      formSelectedProduct: formSelectedProduct ? { ...formSelectedProduct } : null,
      productFormData: JSON.parse(JSON.stringify(productFormData)),

      // Transport
      newTransport: JSON.parse(JSON.stringify(newTransport)),
      transportAccounts: transportAccounts.map(t => ({ ...t })),
      transportOptions: transportOptions.map(t => ({ ...t })),

      // Metadata
      timestamp: new Date().toLocaleTimeString(),
      customerName: formSelectedCustomer?.cus_name || 'New Sale'
    };

    console.log('📸 Screen state captured:', state);
    return state;
  };

  // Auto-save current form state to the current screen in stack
  // (Inline auto-save in useEffects to avoid circular dependencies)

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
    setFormSelectedStore(state.formSelectedStore);
    setProductTableData(state.productTableData);
    setPaymentData(normalizePaymentData(state.paymentData));
    setBillType(state.billType);
    setLoadedOrderId(state.loadedOrderId || null);
    setFormSelectedProduct(state.formSelectedProduct);
    setProductFormData(normalizeProductFormData(state.productFormData));
    setNewTransport(state.newTransport);
    setTransportAccounts(state.transportAccounts || []);
    setTransportOptions(state.transportOptions || []);

    // Clear the flag after a short delay to allow state updates to complete
    setTimeout(() => {
      setIsRestoringScreen(false);
    }, 100);
  };

  // Clear form to new sale state
  const clearFormState = () => {
    console.log('🧹 Clearing form state');
    setEditingSale(null);
    setLoadedOrderId(null);
    setFormSelectedCustomer(null);
    setFormSelectedProduct(null);
    setFormSelectedStore(null);
    setProductTableData([]);
    setPaymentData({ ...EMPTY_PAYMENT_DATA });
    setBillType('BILL');
    setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA });
    setNewTransport({ amount: 0, accountId: '' });
    // Note: transportAccounts are global and should not be cleared
    setTransportOptions([]);
    setShowScreenIndicator(true);
    setTimeout(() => setShowScreenIndicator(false), 1000);
    showSnackbar('📋 Form cleared - ready for new entry', 'info');
  };

  // Open new screen (Ctrl+Right)
  const openNewScreen = useCallback(() => {
    console.log('➡️ OPENING NEW SCREEN');
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
    showSnackbar(`📋 Screen ${newStack.length} | Starting fresh (previous state saved)`, 'info');
  }, [formSelectedCustomer, formSelectedStore, productTableData, paymentData, billType, formSelectedProduct, productFormData, newTransport, transportAccounts, transportOptions, currentScreenIndex, screenStack]);

  // Go back to previous screen (Ctrl+Left) - NO AUTO-CLEAR, only navigate if possible
  const goToPreviousScreen = useCallback(() => {
    console.log('⬅️ GOING TO PREVIOUS SCREEN');
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
      showSnackbar(`📋 Screen ${previousIndex + 1} | ${previousState.customerName}`, 'info');
    } else if (currentScreenIndex === 0) {
      // At first screen - can't go back, just notify user
      console.log('ℹ️ Already at first screen, cannot go back');
      showSnackbar('📋 You are at the first screen. Click "Cancel Current" to discard or "Cancel" to save later.', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Go forward to next screen (Ctrl+Right after going back) - NO AUTO-CLEAR
  const goToNextScreen = useCallback(() => {
    console.log('➡️ GOING TO NEXT SCREEN');
    if (currentScreenIndex < screenStack.length - 1) {
      const nextIndex = currentScreenIndex + 1;
      const nextState = screenStack[nextIndex];
      restoreScreenState(nextState);
      setCurrentScreenIndex(nextIndex);
      showSnackbar(`📋 Screen ${nextIndex + 1} | ${nextState.customerName}`, 'info');
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
      isAtEnd: currentScreenIndex === screenStack.length - 1
    });

    if (currentScreenIndex < screenStack.length - 1) {
      // Not at end - go to next existing screen
      console.log('↪️ Going to next existing screen');
      goToNextScreen();
    } else {
      // At end - create new screen
      console.log('✨ Creating new screen');
      openNewScreen();
    }
  }, [currentScreenIndex, screenStack, goToNextScreen, openNewScreen]);

  // Cancel current screen - Remove it from the stack and go to previous or reset
  const cancelCurrentScreen = useCallback(() => {
    console.log('❌ CANCELING CURRENT SCREEN');
    console.log('📊 Stack before cancel:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length
    });

    if (screenStack.length === 1) {
      // Only default screen - reset the form
      clearFormState();
      showSnackbar('Screen 1 reset - ready for new entry', 'info');
    } else if (screenStack.length > 1 && currentScreenIndex > 0) {
      // Remove current screen and go back to previous
      const newStack = screenStack.filter((_, index) => index !== currentScreenIndex);
      setScreenStack(newStack);
      const previousIndex = currentScreenIndex - 1;
      const previousState = newStack[previousIndex];
      restoreScreenState(previousState);
      setCurrentScreenIndex(previousIndex);
      showSnackbar(`Screen ${previousIndex + 1} - previous restored`, 'info');
    } else if (screenStack.length > 1 && currentScreenIndex === 0) {
      // First of multiple screens - remove it and go to new first screen
      const newStack = screenStack.slice(1);
      setScreenStack(newStack);
      const newFirstState = newStack[0];
      restoreScreenState(newFirstState);
      setCurrentScreenIndex(0);
      showSnackbar('Screen canceled - next screen shown', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Screen navigation keyboard shortcuts - FIX: Use memoized callbacks
  // Ctrl+Right: Go to next screen if exists, or create new
  // Ctrl+Left: Go to previous screen
  // Ctrl+X: Cancel current screen
  useEffect(() => {
    const handleScreenNavigation = (e) => {
      // Ctrl+Right Arrow = Go to next existing screen OR create new
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        console.log('⌨️ Ctrl+Right pressed');
        handleForwardNavigation();
      }
      // Ctrl+Left Arrow = Go to previous screen
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        console.log('⌨️ Ctrl+Left pressed');
        goToPreviousScreen();
      }
      // Ctrl+X = Cancel current screen
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        console.log('⌨️ Ctrl+X pressed');
        cancelCurrentScreen();
      }
    };

    window.addEventListener('keydown', handleScreenNavigation);
    return () => window.removeEventListener('keydown', handleScreenNavigation);
  }, [handleForwardNavigation, goToPreviousScreen, cancelCurrentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle product selection
  const handleProductSelect = (selectedProduct) => {
    console.log('🔍 Product selected:', selectedProduct);
    setFormSelectedProduct(selectedProduct);

    if (selectedProduct) {
      // Update product form data with selected product details
      const defaultRate = parseFloat(selectedProduct.pro_sale_price) || 0;
      setProductFormData(prev => ({
        ...prev,
        quantity: 1, // Default quantity to 1
        rate: defaultRate,
        stock: 0, // always derive from store-wise stock when available
        amount: defaultRate, // rate * 1
        crate: selectedProduct.pro_crate || '',
        cost_price: getProductCostPrice(selectedProduct) // Store cost price hidden
      }));

      // If a store is selected, fetch store-wise stock
      if (formSelectedStore?.storeid) {
        fetchStoreStock(formSelectedStore.storeid, selectedProduct.pro_id);
      }
    } else {
      // Reset form data when no product is selected
      setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA, cost_price: 0 });
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

  const handleQuantityChange = (newQuantity) => {
    const quantity = parseFloat(newQuantity) || 0;
    const rate = productFormData.rate;
    const amount = Number((quantity * rate).toFixed(0));

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
    const amount = Number((quantity * rate).toFixed(0));

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
      stock: productFormData.stock,
      cost_price: getProductCostPrice(formSelectedProduct) // hidden cost price for loss check
    };

    setProductTableData(prev => [newProduct, ...prev]);
    showSnackbar('Product added to cart', 'success');

    // Reset form
    setFormSelectedProduct(null);
    // Don't reset store - it should remain selected
    setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA });

    // Auto-focus on Product field after adding product to allow adding more items
    setTimeout(() => {
      const productInput = document.querySelector('input[placeholder*="Select product"]');
      if (productInput) {
        productInput.focus();
      }
    }, 100);
  };

  // Keyboard shortcut 'a' to add product
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isTextInput = (activeEl?.tagName === 'INPUT' &&
        !['number', 'radio', 'checkbox', 'submit', 'button'].includes(activeEl?.type)) ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.isContentEditable;

      // Trigger if 'a' is pressed and not in a text input/textarea
      if (e.key.toLowerCase() === 'a' && !isTextInput) {
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

  // Handle removing product from table
  const handleRemoveProductFromTable = (productId) => {
    setProductTableData(prev => prev.filter(item => item.id !== productId));
    showSnackbar('Product removed from table', 'success');
  };

  const moveProductRow = (index, direction) => {
    setProductTableData(prev => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // Cart shows newest item on top; invoice/DB should list first-added item first (S# 1).
  const getCartItemsInAddOrder = (cart = productTableData) => [...cart].reverse();

  const getSaleDetailsInAddOrder = (details) => {
    if (!Array.isArray(details) || !details.length) return [];
    if (details.some((d) => d.sale_detail_id != null)) {
      return [...details].sort(
        (a, b) => Number(a.sale_detail_id || 0) - Number(b.sale_detail_id || 0)
      );
    }
    return [...details];
  };

  const getSaleDetailsForCart = (details) => [...getSaleDetailsInAddOrder(details)].reverse();

  // Smart rate and quantity formatter: hide .00 for whole numbers, keep decimals otherwise
  const fmtRateQty = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Smart amount formatter: rounds to whole numbers (no decimal points)
  const fmtAmt = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    return Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const saleDetailQtyMatchesItemFilter = (qty, term) => {
    const t = term.trim();
    if (!t) return false;
    const parsedQty = parseFloat(qty || 0);
    if (Number.isNaN(parsedQty)) return false;

    if (/^\d+(\.\d+)?$/.test(t)) {
      const num = parseFloat(t);
      return Math.abs(parsedQty - num) < 0.001;
    }

    return fmtRateQty(parsedQty).includes(t);
  };

  const saleDetailNameMatchesItemFilter = (name, term) => {
    const t = term.trim();
    if (!t) return false;
    return String(name || '').toLowerCase().includes(t.toLowerCase());
  };

  const saleDetailMatchesItemFilter = (detail, term) => {
    const t = term.trim();
    if (!t) return true;
    const name = detail.product?.pro_title || detail.product_name || '';
    return (
      saleDetailNameMatchesItemFilter(name, t) ||
      saleDetailQtyMatchesItemFilter(detail.qnty, t)
    );
  };

  const renderHighlightedText = (text, term, nameMatches) => {
    const t = term.trim();
    if (!t || !nameMatches) return text;

    const lowerText = text.toLowerCase();
    const lowerTerm = t.toLowerCase();
    const idx = lowerText.indexOf(lowerTerm);
    if (idx === -1) return text;

    return (
      <>
        {text.slice(0, idx)}
        <Box
          component="span"
          sx={{
            bgcolor: '#fef08a',
            color: '#854d0e',
            fontWeight: 800,
            px: 0.3,
            borderRadius: '3px',
            boxShadow: 'inset 0 0 0 1px #fde047',
          }}
        >
          {text.slice(idx, idx + t.length)}
        </Box>
        {text.slice(idx + t.length)}
      </>
    );
  };

  const renderSaleLineItemsCell = (sale) => {
    const details = getSaleDetailsInAddOrder(sale?.sale_details || []);
    const highlightTerm = filterItem.trim();

    if (!details.length) {
      return (
        <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>—</Typography>
      );
    }

    return (
      <Box sx={{ minWidth: 160, maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        {details.map((d, i) => {
          const name = d.product?.pro_title || d.product_name || `Item ${i + 1}`;
          const qty = parseFloat(d.qnty || 0);
          const nameMatches = saleDetailNameMatchesItemFilter(name, highlightTerm);
          const qtyMatches = saleDetailQtyMatchesItemFilter(qty, highlightTerm);

          return (
            <Box
              key={d.sale_detail_id || `${sale.sale_id}-${i}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                py: 0.35,
                px: 0.5,
                borderBottom: i < details.length - 1 ? '1px dashed #e2e8f0' : 'none',
                bgcolor: qtyMatches && highlightTerm ? '#fffbeb' : 'transparent',
                borderRadius: qtyMatches && highlightTerm ? '4px' : 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  lineHeight: 1.3,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={name}
              >
                {renderHighlightedText(name, highlightTerm, nameMatches)}
              </Typography>
              <Box
                sx={{
                  flexShrink: 0,
                  minWidth: 32,
                  px: 0.75,
                  py: 0.2,
                  bgcolor: qtyMatches && highlightTerm ? '#fef08a' : '#dbeafe',
                  color: qtyMatches && highlightTerm ? '#854d0e' : '#1d4ed8',
                  border: qtyMatches && highlightTerm ? '2px solid #facc15' : '1px solid #93c5fd',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  boxShadow: qtyMatches && highlightTerm ? '0 0 0 2px rgba(250, 204, 21, 0.35)' : 'none',
                }}
              >
                {fmtRateQty(qty)}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  /** Same display name can exist for different accounts (e.g. cus_name "1781"); show id + category/type in the transport picker. */
  const formatTransportAccountLabel = (account) => {
    if (!account) return '';
    return account.cus_name || '';
  };

  const calculateTotalAmount = () => {
    const total = productTableData.reduce((total, product) => total + (parseFloat(product.amount) || 0), 0);
    return Number(total.toFixed(0));
  };

  // Calculate subtotal (products + transport)
  const calculateSubtotal = () => {
    const productTotal = calculateTotalAmount();
    const transportTotal = calculateTransportTotal();
    const subtotal = productTotal + transportTotal;
    return Number(subtotal.toFixed(0));
  };

  // Get display bill number: B-1 for BILL, O-1 for ORDER, Q-1 for QUOTATION, fallback to sale_id
  const getBillDisplayNo = (sale) => {
    if (sale?.bill_type === 'SALE_RETURN' || sale?.is_return) {
      return sale?.sale_id ? `${sale.sale_id}` : (sale?.return_id ? `${sale.return_id}` : '');
    }
    const bt = sale?.bill_type || 'BILL';
    if (bt === 'BILL') {
      return sale?.sale_id ? `${sale.sale_id}` : '';
    }
    const bn = sale?.bill_number;
    const prefix = ['ORDER', 'ORDER_TRASH'].includes(bt) ? 'O' : bt === 'QUOTATION' ? 'Q' : 'B';
    return bn ? `${prefix}-${bn}` : `#${sale?.sale_id || ''}`;
  };

  // Calculate grand total
  // For regular sales: products + labour + delivery - discount
  // For SALE_RETURN: products - labour - delivery - discount (charges are deducted from return amount)
  const calculateGrandTotal = () => {
    const productTotal = calculateTotalAmount();
    const labour = parseFloat(paymentData.labour) || 0;
    const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
    const transportTotal = calculateTransportTotal();
    const totalDelivery = Math.max(deliveryCharges, transportTotal);
    const discount = parseFloat(paymentData.discount) || 0;
    if (billType === 'SALE_RETURN') {
      return Number((productTotal - labour - totalDelivery - discount).toFixed(0));
    }
    return Number((productTotal + labour + totalDelivery - discount).toFixed(0));
  };

  // Calculate balance (grand total - total cash received only; advance is shown for info only)
  const calculateBalance = () => {
    const grandTotal = calculateGrandTotal();
    const totalCashReceived = parseFloat(paymentData.totalCashReceived) || 0;
    return Number((grandTotal - totalCashReceived).toFixed(0));
  };

  // Handle payment data changes
  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      return updated;
    });
  };

  // Handle loading an order into the form
  const handleLoadOrder = async (order) => {
    try {
      setLoading(true);

      // Fetch full order details to ensure we have everything
      const response = await fetch(`/api/sales?id=${order.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const fullOrder = await response.json();

      console.log('📦 Loaded Order:', fullOrder);
      console.log('🔍 ORDER DETAILS:');
      console.log('  Sale ID:', fullOrder.sale_id);
      console.log('  Customer:', fullOrder.customer?.cus_name || 'N/A');
      console.log('  Total Amount:', fullOrder.total_amount);
      console.log('  Payment (Advance):', fullOrder.payment);
      console.log('  Discount:', fullOrder.discount);
      console.log('  Shipping/Delivery:', fullOrder.shipping_amount);
      console.log('  Labour Charges:', fullOrder.labour_charges || fullOrder.labour);
      console.log('  Store ID:', fullOrder.store_id);
      console.log('  Bill Type:', fullOrder.bill_type);
      console.log('  Payment Type:', fullOrder.payment_type);
      console.log('  Reference:', fullOrder.reference);
      console.log('  Order Details/Products:', fullOrder.sale_details);
      if (fullOrder.sale_details && Array.isArray(fullOrder.sale_details)) {
        console.log('  📦 Product Items Count:', fullOrder.sale_details.length);
        fullOrder.sale_details.forEach((item, idx) => {
          console.log(`    Item ${idx + 1}: ${item.product?.pro_title || 'Unknown'} - Qty: ${item.qnty}, Rate: ${item.unit_rate}, Amount: ${item.total_amount}`);
        });
      }

      // Set Customer
      if (fullOrder.customer) {
        setFormSelectedCustomer(fullOrder.customer);
      } else if (fullOrder.cus_id) {
        const customer = customers.find(c => c.cus_id === fullOrder.cus_id);
        if (customer) setFormSelectedCustomer(customer);
      }

      // Set Store
      let selectedStore = null;
      if (fullOrder.store_id) {
        selectedStore = stores.find(s => s.storeid === fullOrder.store_id);
      }

      if (selectedStore) {
        setFormSelectedStore(selectedStore);
      } else if (stores.length > 0) {
        setFormSelectedStore(stores[0]);
        selectedStore = stores[0];
      }

      // Map products (reversed order)
      if (fullOrder.sale_details && Array.isArray(fullOrder.sale_details)) {
        const mappedProducts = fullOrder.sale_details.slice().reverse().map((item, index) => ({
          id: Date.now() + index,
          pro_id: item.pro_id,
          pro_title: item.product ? item.product.pro_title : 'Unknown Product',
          quantity: parseFloat(item.qnty || 0),
          rate: parseFloat(item.unit_rate || 0),
          amount: parseFloat(item.total_amount || 0),
          crate: item.product ? (item.product.pro_crate || '') : '',
          stock: 0, // Stock will need to be fetched or updated
          storeid: fullOrder.store_id, // Map the store ID from the order
          store_name: selectedStore ? selectedStore.store_name : 'Unknown'
        }));
        setProductTableData(mappedProducts);
      } else {
        setProductTableData([]);
      }

      // Map Transport Options
      if (fullOrder.transport_details && Array.isArray(fullOrder.transport_details)) {
        const mappedTransport = fullOrder.transport_details.map((item, index) => {
          // Find account name if possible, or use description/placeholder
          // We might need to fetch transport accounts if not loaded, but for now map what we have
          const account = transportAccounts.find(t => t.cus_id === item.account_id);
          return {
            id: Date.now() + index + 100, // Offset ID to avoid collision
            name: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account'),
            amount: 0, // Amount is calculated from delivery charges
            accountId: item.account_id,
            accountName: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account')
          };
        });
        setTransportOptions(mappedTransport);
      } else {
        setTransportOptions([]);
      }

      // Set payment data
      const alreadyPaid = parseFloat(fullOrder.payment || 0);
      const labourCharges = parseFloat(fullOrder.labour_charges || fullOrder.labour || 0);

      console.log('💼 Loading Payment Data:');
      console.log('  Advance Payment:', alreadyPaid);
      console.log('  Discount:', fullOrder.discount);
      console.log('  Labour Charges (from labour_charges):', fullOrder.labour_charges);
      console.log('  Labour Charges (from labour):', fullOrder.labour);
      console.log('  Labour Charges (final):', labourCharges);
      console.log('  Delivery Charges:', fullOrder.shipping_amount);

      setPaymentData(prev => ({
        ...prev,
        advancePayment: '', // Clear advance payment for new bill
        discount: parseFloat(fullOrder.discount || 0) || '', // Empty string if 0, so user knows they can edit
        labour: labourCharges > 0 ? labourCharges : '', // Only set if > 0, otherwise empty string
        deliveryCharges: parseFloat(fullOrder.shipping_amount || 0) || '', // Empty string if 0
        notes: fullOrder.reference ? `${fullOrder.reference} (Ref Order #${fullOrder.sale_id})` : `Ref Order #${fullOrder.sale_id}`,
        isLoadedOrder: true // Flag to indicate if this is a loaded order
      }));

      setLoadedOrderId(fullOrder.sale_id); // Set loaded order ID so when bill is saved, the order is moved to ORDER_TRASH
      setLoadOrderDialogOpen(false);
      showSnackbar(`Order details loaded. Save bill to complete conversion.`, 'info');

    } catch (error) {
      console.error('Error loading order:', error);
      showSnackbar('Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle loading a quotation into the form
  const handleLoadQuotation = async (quotation) => {
    try {
      setLoading(true);

      // Fetch full quotation details to ensure we have everything
      const response = await fetch(`/api/sales?id=${quotation.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch quotation details');
      const fullQuotation = await response.json();

      console.log('📦 Loaded Quotation:', fullQuotation);

      // Set Customer
      if (fullQuotation.customer) {
        setFormSelectedCustomer(fullQuotation.customer);
      } else if (fullQuotation.cus_id) {
        const customer = customers.find(c => c.cus_id === fullQuotation.cus_id);
        if (customer) setFormSelectedCustomer(customer);
      }

      // Set Store
      let selectedStore = null;
      if (fullQuotation.store_id) {
        selectedStore = stores.find(s => s.storeid === fullQuotation.store_id);
      }

      if (selectedStore) {
        setFormSelectedStore(selectedStore);
      } else if (stores.length > 0) {
        setFormSelectedStore(stores[0]);
        selectedStore = stores[0];
      }

      // Map products (reversed order)
      if (fullQuotation.sale_details) {
        const mappedProducts = fullQuotation.sale_details.slice().reverse().map((detail, index) => {
          return {
            id: Date.now() + index + Math.random(),
            pro_id: detail.pro_id,
            pro_title: detail.product?.pro_title || detail.pro_title || 'Unknown Product',
            storeid: selectedStore?.storeid,
            store_name: selectedStore?.store_name || 'Store',
            quantity: parseFloat(detail.qnty) || 0,
            rate: parseFloat(detail.unit_rate) || 0,
            amount: parseFloat(detail.total_amount) || 0,
            stock: 0 // We don't have current stock here, could fetch it but for now 0 is safe
          };
        });
        setProductTableData(mappedProducts);
      }

      setLoadQuotationDialogOpen(false);
      showSnackbar('Quotation loaded successfully', 'success');

    } catch (error) {
      console.error('Error loading quotation:', error);
      showSnackbar('Failed to load quotation', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save bill to database
  const handleSaveBill = async (bypass = false) => {
    const bypassLossCheck = (bypass === true);
    // Pre-auth validation — check these before triggering biometric/PIN
    if ((parseFloat(paymentData.bank || 0)) > 0 && !paymentData.bankAccountId) {
      showSnackbar('Please select a bank account for the bank payment', 'error');
      return;
    }
    if ((parseFloat(paymentData.deliveryCharges) || 0) > 0 && transportOptions.length === 0) {
      showSnackbar('Please select a transport account for the delivery charges', 'error');
      return;
    }

    // Check for profit/loss on every product in the bill (skip on returns)
    if (billType !== 'SALE_RETURN' && !bypassLossCheck) {
      const itemsSellingAtLoss = [];
      productTableData.forEach(item => {
        // Always look up from products list first (freshest data), then fall back to stored cost_price
        const matchingProduct = products.find(p => p.pro_id === item.pro_id);
        const costPrice = matchingProduct
          ? getProductCostPrice(matchingProduct)
          : parseFloat(item.cost_price || 0);
        const salePrice = parseFloat(item.rate || 0);
        console.log(`💰 Loss check: ${item.pro_title} — costPrice=${costPrice}, salePrice=${salePrice}`);
        if (costPrice > 0 && salePrice < costPrice) {
          itemsSellingAtLoss.push({
            pro_title: item.pro_title || `Product #${item.pro_id}`,
            costPrice,
            salePrice
          });
        }
      });

      if (itemsSellingAtLoss.length > 0) {
        setLossItems(itemsSellingAtLoss);
        setLossConfirmOpen(true);
        return; // Stop execution to prompt user
      }
    }

    const hasCash = parseFloat(paymentData.cash || 0) > 0;
    const hasBank = parseFloat(paymentData.bank || 0) > 0;
    if (hasCash || hasBank) {
      const authOk = await requireAuth();
      if (!authOk) return;
    }
    try {
      // If bill type is SALE_RETURN, process it as a return
      if (billType === 'SALE_RETURN') {
        // Customer is required if no invoice is selected
        const returnCustomerId = formSelectedCustomer?.cus_id || selectedSaleForReturnMain?.cus_id;
        if (!returnCustomerId) {
          showSnackbar('Please select a customer to process a return', 'error');
          return;
        }
        if (productTableData.length === 0) {
          showSnackbar('Please add/keep items to return', 'error');
          return;
        }

        // Construct return payload matching /api/sale-returns expectation
        const totalAmount = calculateTotalAmount(); // Based on productTableData
        const discount = parseFloat(paymentData.discount) || 0;
        const labourCharges = parseFloat(paymentData.labour) || 0;
        const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
        const cashReturn = parseFloat(paymentData.cash) || 0;
        const bankReturn = parseFloat(paymentData.bank) || 0;
        const totalReturn = cashReturn + bankReturn; // Total refund amount

        const returnBody = {
          sale_id: selectedSaleForReturnMain ? selectedSaleForReturnMain.sale_id : null,
          cus_id: returnCustomerId,
          total_amount: Number(totalAmount.toFixed(0)),
          discount: Number(discount.toFixed(0)),
          labour_charges: Number(labourCharges.toFixed(0)),
          shipping_amount: Number(deliveryCharges.toFixed(0)),
          loader_id: selectedSaleForReturnMain?.loader_id || null,
          payment: Number(totalReturn.toFixed(0)), // The total amount being refunded to customer
          payment_type: bankReturn > 0 ? 'BANK_TRANSFER' : 'CASH', // Use BANK_TRANSFER if there's bank amount
          cash_return: Number(cashReturn.toFixed(0)), // Additional: cash portion
          bank_return: Number(bankReturn.toFixed(0)), // Additional: bank portion
          bank_account_id: paymentData.bankAccountId || null, // Bank account for transfer
          bill_type: 'SALE_RETURN',
          reason: paymentData.notes || 'Returned from Sale Entry',
          reference: paymentData.notes || '',

          // Return details from product table
          return_details: getCartItemsInAddOrder().map(item => ({
            pro_id: item.pro_id,
            store_id: item.storeid || formSelectedStore?.storeid || selectedSaleForReturnMain?.store_id || null,
            qnty: item.quantity, // Quantity to return
            unit_rate: item.rate.toString(),
            total_amount: item.amount.toString(),
            discount: '0'
          })),
          updated_by: getCurrentUserId()
        };

        // Call the return API
        beginSaving('Processing sale return...');
        const response = await fetch('/api/sale-returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnBody)
        });

        if (response.ok) {
          const saleReturnData = await response.json();

          let fullReturn = saleReturnData;
          try {
            const detailRes = await fetch(`/api/sale-returns?id=${saleReturnData.return_id}`);
            if (detailRes.ok) {
              fullReturn = await detailRes.json();
            }
          } catch {
            /* use create response */
          }

          // Calculate total refund (CASH + BANK)
          const totalRefund = cashReturn + bankReturn;

          // Prepare bill data for receipt with sale return details
          const returnReceipt = {
            ...(selectedSaleForReturnMain || {}),
            ...fullReturn,
            return_id: fullReturn.return_id ?? saleReturnData.return_id,
            customer: formSelectedCustomer || fullReturn.customer || selectedSaleForReturnMain?.customer || {},
            sale_details: getCartItemsInAddOrder().map((item, idx) => ({
              sale_detail_id: idx,
              product: { pro_title: item.pro_title || item.product_name || 'Unknown Product' },
              qnty: item.quantity,
              unit_rate: item.rate,
              total_amount: item.amount
            })),
            total_amount: calculateTotalAmount(),
            labour_charges: paymentData.labour || 0,
            shipping_amount: paymentData.deliveryCharges || 0,
            discount: paymentData.discount || 0,
            payment: totalRefund, // Total of CASH + BANK refund
            cash_refund: cashReturn, // Breakdown: cash portion
            bank_refund: bankReturn, // Breakdown: bank portion
            notes: paymentData.notes,
            bill_type: 'SALE_RETURN',
            is_return: true,
            created_at: fullReturn.created_at || new Date(),
            previous_balance: parseFloat(
              fullReturn.previous_balance ??
              fullReturn.previous_customer_balance ??
              formSelectedCustomer?.cus_balance ??
              selectedSaleForReturnMain?.customer?.cus_balance ?? 0
            ),
            previous_customer_balance: parseFloat(
              fullReturn.previous_customer_balance ??
              fullReturn.previous_balance ??
              formSelectedCustomer?.cus_balance ??
              selectedSaleForReturnMain?.customer?.cus_balance ?? 0
            )
          };

          updateSaveStatus('Generating return invoice...');

          // Set current bill data and open receipt dialog
          setCurrentBillData(returnReceipt);
          setReceiptDialogOpen(true);

          showSnackbar('Sale return processed successfully', 'success');

          // Reset form after a delay
          setTimeout(() => {
            setFormSelectedCustomer(null);
            setFormSelectedProduct(null);
            setFormSelectedStore(null);
            setProductTableData([]);
            setPaymentData({ ...EMPTY_PAYMENT_DATA });
            setSelectedSaleForReturnMain(null);
            setBillType('BILL'); // Reset to default
            fetchData({ mode: 'list', silent: true }); // Refresh lists
          }, 1000);
        } else {
          const errorData = await response.json();
          showSnackbar('Error: ' + (errorData.error || 'Failed to process return'), 'error');
        }
        endSaving();
        return; // Exit function
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
      const advancePayment = parseFloat(paymentData.advancePayment) || 0;
      const finalPaymentTotal = totalCashReceived; // Advance shown for info only; not added to payment total

      // Additional validation
      if (totalAmount <= 0) {
        showSnackbar('Total amount must be greater than 0', 'error');
        return;
      }

      if ((parseFloat(paymentData.deliveryCharges) || 0) > 0 && transportOptions.length === 0) {
        showSnackbar('Please select a transport account for the delivery charges', 'error');
        return;
      }

      if ((parseFloat(paymentData.bank) || 0) > 0 && !paymentData.bankAccountId) {
        showSnackbar('Please select a bank account for the bank payment', 'error');
        return;
      }

      console.log('🔍 Frontend - Calculated values:', { totalAmount, grandTotal, totalCashReceived, advancePayment, finalPaymentTotal, billType });
      console.log('📋 Frontend - Payment Data before sending:', paymentData);
      console.log('📊 Frontend - Grand Total Breakdown:', {
        productTotal: calculateTotalAmount(),
        labour: parseFloat(paymentData.labour) || 0,
        deliveryCharges: parseFloat(paymentData.deliveryCharges) || 0,
        discount: parseFloat(paymentData.discount) || 0,
        grandTotal: grandTotal,
        billType: billType,
        message: 'NOTE: Discount is already subtracted in grandTotal, sending discount: 0 to API'
      });

      // Prepare sale data
      const transportTotal = calculateTransportTotal();
      const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
      const totalShippingAmount = Math.max(deliveryCharges, transportTotal);

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

      const labourChargesValue = parseFloat(paymentData.labour) || 0;

      const saleData = {
        cus_id: formSelectedCustomer.cus_id,
        store_id: formSelectedStore.storeid, // Added store_id for multi-store functionality
        total_amount: grandTotal, // Use grand total (already includes discount subtraction)
        discount: parseFloat(paymentData.discount) || 0, // Send actual discount for recording in db and ledger details
        payment: finalPaymentTotal, // Include both cash received and advance payment
        payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH', // Use first payment type or default to CASH
        cash_payment: cashAmount, // Store cash payment in sale record
        bank_payment: bankAmount, // Store bank payment in sale record
        advance_payment: advancePayment, // Store advance payment separately
        previous_balance: parseFloat(formSelectedCustomer?.cus_balance || 0), // Customer balance before this sale
        bank_title: selectedBankAccount?.cus_name || null, // Store bank account name (optional)
        debit_account_id: paymentData.bankAccountId || null,
        credit_account_id: null,
        loader_id: null,
        labour_charges: labourChargesValue, // Include labour charges
        shipping_amount: totalShippingAmount, // Include both transport and delivery charges
        bill_type: billType || 'BILL',
        reference: paymentData.notes || null,
        is_loaded_order: paymentData.isLoadedOrder || !!loadedOrderId, // Flag to indicate if this is a loaded order
        order_id: loadedOrderId || null, // Pass order_id to backend for direct conversion
        loaded_order_id: loadedOrderId || null,
        sale_details: getCartItemsInAddOrder().map(product => ({
          pro_id: product.pro_id,
          vehicle_no: null,
          qnty: product.quantity,
          unit: 'PCS', // Default unit
          unit_rate: product.rate,
          total_amount: product.amount,
          discount: 0,
          cus_id: formSelectedCustomer.cus_id
        })),
        transport_details: transportOptions.map(transport => {
          const itemAmt = parseFloat(transport.amount || 0);
          const totalDel = Math.max(parseFloat(paymentData.deliveryCharges) || 0, calculateTransportTotal());
          let finalAmt = itemAmt;
          if (finalAmt <= 0 && transportOptions.length > 0 && totalDel > 0) {
            finalAmt = totalDel / transportOptions.length;
          }
          return {
            account_id: transport.accountId,
            amount: finalAmt,
            description: transport.description || 'Transport charges - Split from Delivery'
          };
        }),
        split_payments: splitPayments, // Keep split_payments for backward compatibility
        updated_by: 6 // System Administrator
      };

      const isEditing = !!editingSale;
      beginSaving(isEditing ? 'Updating sale...' : 'Saving sale...');

      // Use PUT when editing an existing sale, POST for new
      const apiBody = isEditing ? { ...saleData, id: editingSale.sale_id } : saleData;
      let response;
      let isNetworkFailure = typeof navigator !== 'undefined' && !navigator.onLine;

      if (!isNetworkFailure) {
        try {
          updateSaveStatus(isEditing ? 'Updating sale on server...' : 'Saving sale to server...');
          response = await fetch('/api/sales', {
            method: isEditing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiBody),
          });
        } catch (fetchErr) {
          console.warn('Network connection failed when saving sale:', fetchErr);
          isNetworkFailure = true;
        }
      }

      // Offline mode fallback when server cannot be reached
      if (isNetworkFailure || (response && response.status === 0)) {
        updateSaveStatus('Saving bill offline...');
        const offlineId = saveOfflineSale(saleData);
        refreshOfflineCount();

        if (offlineId) {
          showSnackbar(`⚡ Internet Disconnected! Bill saved locally (${offlineId}). Will auto-upload when online.`, 'warning');

          const offlineBillData = {
            sale_id: offlineId,
            bill_number: offlineId,
            cus_id: formSelectedCustomer.cus_id,
            total_amount: grandTotal,
            discount: parseFloat(paymentData.discount) || 0,
            payment: finalPaymentTotal,
            payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH',
            cash_payment: cashAmount,
            bank_payment: bankAmount,
            advance_payment: advancePayment,
            previous_balance: parseFloat(formSelectedCustomer?.cus_balance || 0),
            bank_title: selectedBankAccount?.cus_name || null,
            shipping_amount: totalShippingAmount,
            bill_type: billType || 'BILL',
            reference: (paymentData.notes ? paymentData.notes + ' ' : '') + `[OFFLINE - Local]`,
            created_at: new Date().toISOString(),
            customer: formSelectedCustomer,
            sale_details: getCartItemsInAddOrder().map((product, index) => ({
              sale_detail_id: index + 1,
              pro_id: product.pro_id,
              qnty: product.quantity,
              unit: 'PCS',
              unit_rate: product.rate,
              total_amount: product.amount,
              product: { pro_title: product.pro_title || 'N/A' }
            })),
            labour: parseFloat(paymentData.labour) || 0,
            notes: paymentData.notes || '',
            isOffline: true
          };

          setCurrentBillData(offlineBillData);
          setReceiptDialogOpen(true);

          // Clear form for next bill entry
          setFormSelectedCustomer(null);
          setFormSelectedProduct(null);
          setFormSelectedStore(null);
          setProductTableData([]);
          setPaymentData({ ...EMPTY_PAYMENT_DATA });
          setTransportOptions([]);
          setNewTransport({ amount: 0, accountId: '' });
          setScreenStack([]);
          setCurrentScreenIndex(-1);
          endSaving();
          return;
        }
      }

      if (response && response.ok) {
        updateSaveStatus('Updating ledger & stock...');
        const result = await response.json();
        showSnackbar('Bill saved successfully!', 'success');

        // If this bill was converted from an order, move the order to ORDER_TRASH
        if (loadedOrderId) {
          try {
            updateSaveStatus('Finalizing order conversion...');
            await fetch('/api/sales', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: loadedOrderId, bill_type: 'ORDER_TRASH' })
            });
            console.log(`✅ Order ${loadedOrderId} moved to ORDER_TRASH after conversion to bill`);
            setLoadedOrderId(null);
          } catch (e) {
            console.error('Failed to update order status to ORDER_TRASH:', e);
          }
        }

        // If this bill was loaded from a held bill / draft, delete the draft so it is removed from held bills
        if (currentDraftId) {
          try {
            updateSaveStatus('Removing held bill...');
            await fetch(`/api/draft-sales?id=${currentDraftId}`, { method: 'DELETE' });
            console.log(`✅ Held bill / draft ${currentDraftId} deleted after sale completion`);
            setCurrentDraftId(null);
            if (typeof fetchDrafts === 'function') fetchDrafts();
          } catch (e) {
            console.error('Failed to delete held bill after sale completion:', e);
          }
        }

        // Store bill data for printing
        const billDataForPrint = {
          sale_id: result.sale_id,
          bill_number: result.bill_number ?? null,
          cus_id: formSelectedCustomer.cus_id,
          total_amount: grandTotal,
          discount: parseFloat(paymentData.discount) || 0,
          payment: finalPaymentTotal, // Cash + bank received (advance shown separately)
          payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH',
          cash_payment: cashAmount, // Add cash payment details
          bank_payment: bankAmount, // Add bank payment details
          advance_payment: advancePayment, // Add advance payment details
          previous_balance: parseFloat(formSelectedCustomer?.cus_balance || 0), // Customer's balance before this sale
          bank_title: selectedBankAccount?.cus_name || null, // Add bank title
          shipping_amount: totalShippingAmount,
          bill_type: billType || 'BILL',
          reference: paymentData.notes || null,
          created_at: new Date().toISOString(),
          customer: formSelectedCustomer,
          sale_details: getCartItemsInAddOrder().map((product, index) => ({
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
          notes: paymentData.notes || ''
        };
        updateSaveStatus('Generating invoice...');
        setCurrentBillData(billDataForPrint);

        // Open receipt dialog
        setReceiptDialogOpen(true);

        // If we were editing, clear edit state and return to list
        if (editingSale) {
          setEditingSale(null);
          setFormSelectedCustomer(null);
          setFormSelectedProduct(null);
          setFormSelectedStore(null);
          setProductTableData([]);
          setPaymentData({ ...EMPTY_PAYMENT_DATA });
          setTransportOptions([]);
          setBillType('BILL');
          setCurrentView('list');
          fetchData({ mode: 'list', silent: true });
          showSnackbar('Sale updated successfully! Ledger adjusted.', 'success');
          return;
        }

        // After successful sale creation, restore previous screen state if available
        if (currentScreenIndex > 0) {
          // There's a previous screen - restore it
          console.log('✅ Sale created! Restoring previous screen...');
          const previousIndex = currentScreenIndex - 1;
          const previousState = screenStack[previousIndex];

          // Trim stack to remove current and any forward screens
          const trimmedStack = screenStack.slice(0, currentScreenIndex);

          console.log('📚 Trimmed screen stack from', screenStack.length, 'to', trimmedStack.length);

          // Set new stack and restore previous state
          setScreenStack(trimmedStack);
          setCurrentScreenIndex(previousIndex);
          restoreScreenState(previousState);

          showSnackbar(`✅ Sale created! Restored previous screen (${previousState.customerName})`, 'success');
        } else {
          // No previous screen - clear form to start fresh
          console.log('✅ Sale created! No previous screen, clearing form...');
          setFormSelectedCustomer(null);
          setFormSelectedProduct(null);
          setFormSelectedStore(null);
          setProductTableData([]);
          setPaymentData({ ...EMPTY_PAYMENT_DATA });
          setTransportOptions([]);
          setNewTransport({ amount: 0, accountId: '' });

          // Reset screen stack for next sale only if we're at index 0
          setScreenStack([]);
          setCurrentScreenIndex(-1);
          showSnackbar('✅ Sale created! Form cleared for next entry', 'success');
        }

        // Refresh sales data
        fetchData({ mode: 'list', silent: true });
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

  // Fetch only what the initial view needs (create form vs sales list)
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const typeParam = searchParams?.get('type');
    let saleReturnFlag = false;
    try {
      saleReturnFlag = typeof window !== 'undefined' && localStorage.getItem('openSaleReturnCreate') === '1';
    } catch (e) {
      // ignore
    }
    const isCreate = viewParam === 'create' || typeParam === 'return' || saleReturnFlag;

    if (isCreate) {
      setListLoading(false);
      fetchFormReferenceData();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await fetchSalesList(false);
        if (!cancelled) await fetchListFilterData();
      } catch (e) {
        console.error('Initial sales list load failed:', e);
        if (!cancelled) setListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load missing data when switching between list and create views (skip initial mount)
  const viewSwitchInitializedRef = useRef(false);
  useEffect(() => {
    if (!viewSwitchInitializedRef.current) {
      viewSwitchInitializedRef.current = true;
      return;
    }

    if (currentView === 'create' && !dataLoadedRef.current.form) {
      fetchFormReferenceData();
    } else if (currentView === 'list') {
      if (!dataLoadedRef.current.list || sales.length === 0) {
        fetchSalesList();
      }
      if (!dataLoadedRef.current.form && !dataLoadedRef.current.listFilters) {
        fetchListFilterData();
      }
    }
  }, [currentView, sales.length]);

  // Lazy-load cities/categories when opening customer or product dialogs
  useEffect(() => {
    if (customerPopupOpen || showAddProductPopup) {
      fetchDialogLookups();
    }
  }, [customerPopupOpen, showAddProductPopup]);

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

  // Auto-calculate total cash received when cash, bank, or advance payment changes
  useEffect(() => {
    const cash = parseFloat(paymentData.cash) || 0;
    const bank = parseFloat(paymentData.bank) || 0;
    const totalCashReceived = cash + bank;

    setPaymentData(prev => ({
      ...prev,
      totalCashReceived: totalCashReceived
    }));
  }, [paymentData.cash, paymentData.bank]);

  // Auto-save when customer changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on customer change - Screen ${currentScreenIndex + 1}`);
    }
  }, [formSelectedCustomer]);

  // Auto-save when store changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on store change - Screen ${currentScreenIndex + 1}`);
    }
  }, [formSelectedStore]);

  // Auto-save when product table changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on product table change - Screen ${currentScreenIndex + 1}`);
    }
  }, [productTableData]);

  // Auto-save when payment data changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on payment change - Screen ${currentScreenIndex + 1}`);
    }
  }, [paymentData]);

  // Auto-save when bill type changes
  useEffect(() => {
    if (currentScreenIndex >= 0 && screenStack[currentScreenIndex]) {
      const updatedState = captureScreenState();
      const newStack = [...screenStack];
      newStack[currentScreenIndex] = updatedState;
      setScreenStack(newStack);
      console.log(`💾 Auto-saved on bill type change - Screen ${currentScreenIndex + 1}`);
    }
  }, [billType]);

  // Transport functions
  /** @param {unknown} [categoriesForLookup] — pass fresh list from loadData to avoid empty state on first run */
  /** @param {unknown} [typesForLookup] */
  const fetchTransportAccounts = async (providedCustomers = null, categoriesForLookup, typesForLookup) => {
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
        const categorySource = Array.isArray(categoriesForLookup) ? categoriesForLookup : customerCategories;
        const typeSource = Array.isArray(typesForLookup) ? typesForLookup : customerTypes;

        const categoryMap = new Map();
        categorySource.forEach((cat) => {
          categoryMap.set(cat.cus_cat_id, (cat.cus_cat_title || '').trim().toLowerCase());
        });

        const norm = (s) => (s || '').trim().toLowerCase();
        const isTransportLabel = (n) => {
          if (!n) return false;
          return n === 'transport' || n === 'transporter' || n === 'transporters';
        };
        /** Any field labeled Cargo excludes the account (avoids Cargo category + Transport type still appearing). */
        const isCargoLabel = (n) => {
          if (!n) return false;
          if (n === 'cargo' || n === 'cargos') return true;
          return n.split(/[\s/&,-]+/)[0] === 'cargo';
        };

        const getCategoryTitle = (account) => {
          const emb = account.customer_category?.cus_cat_title;
          if (emb != null && String(emb).trim() !== '') return norm(emb);
          const fromMap = categoryMap.get(account.cus_category);
          if (fromMap) return fromMap;
          const c = categorySource.find((x) => x.cus_cat_id === account.cus_category);
          return c?.cus_cat_title ? norm(c.cus_cat_title) : '';
        };

        const getTypeTitle = (account) => {
          const emb = account.customer_type?.cus_type_title;
          if (emb != null && String(emb).trim() !== '') return norm(emb);
          const t = typeSource.find((ty) => ty.cus_type_id === account.cus_type);
          return t?.cus_type_title ? norm(t.cus_type_title) : '';
        };

        // Transport only: must have Transport/Transporter on category or type, and no Cargo on either field
        const transportAccountsData = accountsData.filter((account) => {
          const cat = getCategoryTitle(account);
          const typ = getTypeTitle(account);
          if (isCargoLabel(cat) || isCargoLabel(typ)) return false;
          return isTransportLabel(cat) || isTransportLabel(typ);
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

  // Update transport accounts when customers, categories, or types change (types required to resolve labels)
  useEffect(() => {
    if (customers.length > 0 && customerCategories.length > 0 && customerTypes.length > 0 && !isRestoringScreen) {
      fetchTransportAccounts(customers);
    }
  }, [customers, customerCategories, customerTypes, isRestoringScreen]);

  // Filter customers by category and type for bank accounts
  const filterBankAccountsByCategory = (customers, customerCategories, customerTypes) => {
    console.log('🔍 Filtering bank accounts for sales:');
    console.log('  - Available customers:', customers.length);
    console.log('  - Available categories:', customerCategories.length);
    console.log('  - Available types:', customerTypes.length);

    // Bank accounts: BOTH category AND type must contain "bank"
    // Exclude generic "Bank Account" master account (only show specific ones)
    const filteredBankAccounts = customers.filter(customer => {
      const categoryInfo = customerCategories.find(cat => cat.cus_cat_id === customer.cus_category);
      const typeInfo = customerTypes.find(t => t.cus_type_id === customer.cus_type);
      const hasBank = categoryInfo && categoryInfo.cus_cat_title.toLowerCase().includes('bank');
      const hasBank2 = typeInfo && typeInfo.cus_type_title.toLowerCase().includes('bank');
      // Exclude the generic "Bank Account" entry - only show specific bank names
      const isNotGeneric = customer.cus_name && !['Bank Account', 'Bank', 'Bank Accounts'].includes(customer.cus_name.trim());
      return hasBank && hasBank2 && isNotGeneric;
    });

    console.log(`✅ Filtered ${filteredBankAccounts.length} bank accounts (BOTH category AND type contain 'bank', excluding generic)`);
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
        let bankAccountsData = filterBankAccountsByCategory(accountsData, customerCategories, customerTypes);

        // Remove duplicates based on cus_id to ensure no bank appears twice
        const seenIds = new Set();
        bankAccountsData = bankAccountsData.filter(account => {
          if (seenIds.has(account.cus_id)) {
            console.log(`⚠️ Duplicate bank account detected: ${account.cus_name} (ID: ${account.cus_id})`);
            return false;
          }
          seenIds.add(account.cus_id);
          return true;
        });

        console.log('🏦 Bank accounts found (after deduplication):', bankAccountsData.length);
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

  const handleAddTransport = () => {
    // Amount validation removed as it is calculated from delivery charges
    if (!newTransport.accountId) {
      showSnackbar('Please select a transport account', 'error');
      return;
    }

    // Find the selected account details
    const selectedAccount = transportAccounts.find(account => account.cus_id === parseInt(newTransport.accountId));

    const transport = {
      id: Date.now(),
      name: selectedAccount ? formatTransportAccountLabel(selectedAccount) : 'Unknown Account',
      amount: 0, // Amount will be calculated from delivery charges
      accountId: newTransport.accountId,
      accountName: selectedAccount ? formatTransportAccountLabel(selectedAccount) : 'Unknown Account'
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
  const [customerTypeOpen, setCustomerTypeOpen] = useState(false);
  const customerTypeInputRef = useRef(null);
  const customerNameInputRef = useRef(null);

  // Open customer popup and focus Account Name first (do NOT pre-select Account Type)
  const handleOpenCustomerPopup = (preferredType = 'customer') => {
    setNewCustomer(prev => ({ ...prev, cus_type: '' }));
    setCustomerPopupOpen(true);
    // ensure Account Type dropdown is closed and focus the Account Name input after mount
    setTimeout(() => {
      setCustomerTypeOpen(false);
      setTimeout(() => customerNameInputRef.current?.focus(), 50);
    }, 80);
  };

  const handleCloseCustomerPopup = () => {
    setCustomerPopupOpen(false);
    setCustomerTypeOpen(false);
    setEditingCustomer(false);
    setNewCustomer({ ...EMPTY_CUSTOMER_FORM });
  };

  const handleOpenEditCustomer = () => {
    if (!formSelectedCustomer) return;
    setNewCustomer({
      ...EMPTY_CUSTOMER_FORM,
      cus_name: formSelectedCustomer.cus_name || '',
      cus_phone_no: formSelectedCustomer.cus_phone_no || '',
      cus_phone_no2: formSelectedCustomer.cus_phone_no2 || '',
      cus_address: formSelectedCustomer.cus_address || '',
      cus_reference: formSelectedCustomer.cus_reference || '',
      cus_account_info: formSelectedCustomer.cus_account_info || '',
      other: formSelectedCustomer.other || '',
      cus_category: formSelectedCustomer.cus_category || '',
      cus_type: formSelectedCustomer.cus_type || '',
      cus_balance: formSelectedCustomer.cus_balance ?? '',
      CNIC: formSelectedCustomer.CNIC || '',
      NTN_NO: formSelectedCustomer.NTN_NO || '',
      name_urdu: formSelectedCustomer.name_urdu || '',
      city_id: formSelectedCustomer.city_id || ''
    });
    setEditingCustomer(true);
    setCustomerPopupOpen(true);
  };

  // Handle adding product quickly from sale page
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
        setProductCategories(prev => [newCat, ...prev]);
        setShowAddProductCategoryPopup(false);
        setAddProductCategoryName('');
        showSnackbar('Product category added successfully!', 'success');
      } else {
        const err = await response.json();
        showSnackbar(err.error || 'Failed to add category', 'error');
      }
    } catch (error) {
      showSnackbar('Error adding category', 'error');
    } finally {
      setIsAddingProductCategory(false);
    }
  };

  const handleAddProductSubCategory = async (e) => {
    e?.preventDefault();
    if (!addProductSubCategoryFormData.sub_cat_name.trim()) { showSnackbar('Subcategory name is required', 'error'); return; }
    if (!addProductSubCategoryFormData.cat_id) { showSnackbar('Category is required', 'error'); return; }
    setIsAddingProductSubCategory(true);
    try {
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addProductSubCategoryFormData)
      });
      if (response.ok) {
        const newSubCat = await response.json();
        setProductSubcategories(prev => [newSubCat, ...prev]);
        setShowAddProductSubCategoryPopup(false);
        setAddProductSubCategoryFormData({ sub_cat_name: '', cat_id: '' });
        showSnackbar('Product subcategory added successfully!', 'success');
      } else {
        const err = await response.json();
        showSnackbar(err.error || 'Failed to add subcategory', 'error');
      }
    } catch (error) {
      showSnackbar('Error adding subcategory', 'error');
    } finally {
      setIsAddingProductSubCategory(false);
    }
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
      showSnackbar('Customer category is required', 'error');
      return;
    }
    if (!newCustomer.cus_type) {
      showSnackbar('Customer type is required', 'error');
      return;
    }

    // Allow duplicate phone numbers — do not block creation by phone number.

    try {
      setIsSavingCustomer(true);
      const customerData = {
        cus_name: newCustomer.cus_name.trim(),
        cus_phone_no: newCustomer.cus_phone_no.trim(),
        cus_phone_no2: (newCustomer.cus_phone_no2 || '').trim(),
        cus_address: (newCustomer.cus_address || '').trim(),
        cus_reference: (newCustomer.cus_reference || '').trim(),
        cus_account_info: (newCustomer.cus_account_info || '').trim(),
        other: (newCustomer.other || '').trim(),
        cus_category: newCustomer.cus_category,
        cus_type: newCustomer.cus_type,
        cus_balance: parseFloat(newCustomer.cus_balance) || 0,
        CNIC: (newCustomer.CNIC || '').trim(),
        NTN_NO: (newCustomer.NTN_NO || '').trim(),
        name_urdu: (newCustomer.name_urdu || '').trim(),
        city_id: newCustomer.city_id || null
      };

      if (editingCustomer) {
        customerData.id = formSelectedCustomer.cus_id;
      }

      const response = await fetch('/api/customers', {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        showSnackbar(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully', 'success');
        handleCloseCustomerPopup();
        await refreshCustomersDropdown();
        // Update selected customer with new data if editing
        if (editingCustomer) {
          const updatedCustomers = await fetch('/api/customers?dropdown=true').then(r => r.json());
          const updated = (updatedCustomers.data || updatedCustomers).find(c => c.cus_id === formSelectedCustomer.cus_id);
          if (updated) setFormSelectedCustomer(updated);
        }
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || errorData.message || (editingCustomer ? 'Error updating customer' : 'Error creating customer'), 'error');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      showSnackbar('Error creating customer', 'error');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const applySalesListData = (salesList, returnsList) => {
    const returnsMapped = (returnsList || []).map(ret => ({
      ...ret,
      sale_id: `SR-${ret.return_id}`,
      actual_sale_id: ret.sale_id,
      is_return: true,
      bill_type: 'SALE_RETURN',
      total_amount: Number(ret.total_amount) || 0,
      discount: Number(ret.discount) || 0,
      shipping_amount: Number(ret.shipping_amount) || 0,
      labour_charges: Number(ret.labour_charges) || 0,
      payment: Number(ret.payment) || 0,
      payment_type: ret.payment_type,
      created_at: ret.created_at,
      updated_at: ret.updated_at,
      customer: ret.customer,
      sale_details: (ret.return_details || []).map(d => ({
        ...d,
        product: d.product,
        product_name: d.product?.pro_title,
        qnty: Number(d.qnty || d.return_quantity || 0),
        unit_rate: Number(d.unit_rate || 0),
        total_amount: Number(d.total_amount || d.return_amount || 0)
      }))
    }));

    const combined = [...(salesList || []), ...returnsMapped];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setSales(combined);
  };

  const fetchSalesList = async (silent = false) => {
    try {
      if (!silent) setListLoading(true);

      const [salesRes, returnsRes] = await Promise.all([
        fetch('/api/sales', { cache: 'no-store' }),
        fetch('/api/sale-returns', { cache: 'no-store' })
      ]);

      let salesList = [];
      let returnsList = [];

      if (salesRes.ok) {
        salesList = await salesRes.json();
        if (!Array.isArray(salesList)) salesList = [];
      }

      if (returnsRes.ok) {
        const returnsData = await returnsRes.json();
        if (Array.isArray(returnsData)) returnsList = returnsData;
      }

      applySalesListData(salesList, returnsList);
      dataLoadedRef.current.list = true;
    } catch (salesError) {
      console.error('Sales/Returns fetch error:', salesError);
      setSales([]);
    } finally {
      if (!silent) setListLoading(false);
    }
  };

  const fetchListFilterData = async () => {
    if (dataLoadedRef.current.form || dataLoadedRef.current.listFilters) return;

    try {
      const [customersRes, storesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/stores')
      ]);

      if (customersRes.ok) {
        const customersResponse = await customersRes.json();
        const customersData = customersResponse.value || customersResponse;
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } else {
        setCustomers([]);
      }

      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        const storesData = storesResponse.data || storesResponse;
        setStores(Array.isArray(storesData) ? storesData : []);
      } else {
        setStores([]);
      }

      dataLoadedRef.current.listFilters = true;
    } catch (error) {
      console.error('Error fetching list filter data:', error);
    }
  };

  const fetchFormReferenceData = async (silent = false) => {
    if (dataLoadedRef.current.form) return;

    try {
      if (!silent) setLoading(true);

      const [customersRes, productsRes, customerTypesRes, storesRes, customerCategoriesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/customer-types'),
        fetch('/api/stores'),
        fetch('/api/customer-category')
      ]);

      let customersArrayForRefetch = null;
      let parsedCustomerCategories = null;
      let parsedCustomerTypes = null;

      if (customersRes.ok) {
        const customersResponse = await customersRes.json();
        const customersData = customersResponse.value || customersResponse;
        const customersArray = Array.isArray(customersData) ? customersData : [];
        customersArrayForRefetch = customersArray;
        setCustomers(customersArray);
        fetchBankAccounts(customersArray);
      } else {
        setCustomers([]);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData || []);
      } else {
        setProducts([]);
      }

      if (customerTypesRes.ok) {
        const customerTypesResponse = await customerTypesRes.json();
        const customerTypesData = customerTypesResponse.value || customerTypesResponse;
        parsedCustomerTypes = Array.isArray(customerTypesData) ? customerTypesData : (customerTypesData || []);
        setCustomerTypes(parsedCustomerTypes);
      }

      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        const storesData = storesResponse.data || storesResponse;
        setStores(Array.isArray(storesData) ? storesData : []);
      } else {
        setStores([]);
      }

      if (customerCategoriesRes.ok) {
        const customerCategoriesData = await customerCategoriesRes.json();
        parsedCustomerCategories = Array.isArray(customerCategoriesData) ? customerCategoriesData : (customerCategoriesData || []);
        setCustomerCategories(parsedCustomerCategories);
      } else {
        setCustomerCategories([]);
      }

      if (customersArrayForRefetch && customersArrayForRefetch.length > 0) {
        fetchTransportAccounts(customersArrayForRefetch, parsedCustomerCategories, parsedCustomerTypes);
      }

      dataLoadedRef.current.form = true;
      dataLoadedRef.current.listFilters = true;
    } catch (error) {
      console.error('Error fetching form reference data:', error);
      showSnackbar('Error fetching data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchDialogLookups = async () => {
    if (dataLoadedRef.current.dialogLookups) return;

    try {
      const [citiesRes, categoriesRes, subcategoriesRes] = await Promise.all([
        fetch('/api/cities'),
        fetch('/api/categories'),
        fetch('/api/subcategories')
      ]);

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(citiesData || []);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setProductCategories(categoriesData || []);
      }
      if (subcategoriesRes.ok) {
        const subcategoriesData = await subcategoriesRes.json();
        setProductSubcategories(subcategoriesData || []);
      }

      dataLoadedRef.current.dialogLookups = true;
    } catch (error) {
      console.error('Error fetching dialog lookups:', error);
    }
  };

  const refreshCustomersDropdown = async () => {
    try {
      const customersRes = await fetch('/api/customers?dropdown=true');
      if (!customersRes.ok) return;

      const customersResponse = await customersRes.json();
      const customersData = customersResponse.value || customersResponse;
      const customersArray = Array.isArray(customersData) ? customersData : [];
      setCustomers(customersArray);
      fetchBankAccounts(customersArray);
      fetchTransportAccounts(customersArray, customerCategories, customerTypes);
    } catch (error) {
      console.error('Error refreshing customers:', error);
    }
  };

  const fetchData = async (options = {}) => {
    const { mode = 'all', silent = false } = typeof options === 'object' ? options : { silent: !!options };

    if (mode === 'list') {
      await fetchSalesList(silent);
      await fetchListFilterData();
    } else if (mode === 'create') {
      await fetchFormReferenceData(silent);
    } else {
      await fetchSalesList(silent);
      await fetchFormReferenceData(silent);
      await fetchDialogLookups();
    }
  };

  // Re-fetch after dev hot reload when React state resets but module re-executes
  useEffect(() => {
    if (lastBootIdRef.current === salesPageBootId) return;
    lastBootIdRef.current = salesPageBootId;

    dataLoadedRef.current = { list: false, form: false, listFilters: false, dialogLookups: false };
    setSales([]);

    if (currentView === 'list') {
      fetchSalesList();
      fetchListFilterData();
    } else {
      fetchFormReferenceData();
    }
  }, [salesPageBootId, currentView]);

  // ======================== DRAFT SALES FUNCTIONS ========================
  // Fetch all drafts
  const fetchDrafts = async () => {
    try {
      const response = await fetch('/api/draft-sales');
      if (response.ok) {
        const draftsList = await response.json();
        setDrafts(Array.isArray(draftsList) ? draftsList : []);
        console.log('📝 Drafts loaded:', draftsList.length);
      } else {
        console.error('❌ Failed to fetch drafts');
        setDrafts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching drafts:', error);
      setDrafts([]);
    }
  };

  // Save current form as draft
  const handleSendWhatsApp = async (bill, customPhone, elementId = 'receipt-preview') => {
    try {
      setIsSendingWhatsApp(true);
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const phone = customPhone || bill?.customer?.cus_phone_no;
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

  const escapePrintHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formatSaleItemsForListPrint = (sale) => {
    const details = sale?.sale_details || [];
    if (!details.length) return '—';

    return details
      .map((d, i) => {
        const name = d.product?.pro_title || d.product_name || `Item ${i + 1}`;
        const qty = fmtRateQty(d.qnty);
        return `<div class="item-row">
          <span class="item-name">${escapePrintHtml(name)}</span>
          <span class="item-qty">${escapePrintHtml(qty)}</span>
        </div>`;
      })
      .join('');
  };

  const getSalesListFilterSummary = () => {
    const parts = [];
    if (searchTerm) parts.push(`Search: ${searchTerm}`);
    if (filterCustomer) {
      const customer = customers.find((c) => c.cus_id?.toString() === filterCustomer);
      parts.push(`Customer: ${customer?.cus_name || filterCustomer}`);
    }
    if (filterBillType) parts.push(`Bill type: ${filterBillType}`);
    if (filterStore) parts.push(`Store: ${filterStore}`);
    if (filterPaymentType) parts.push(`Payment: ${filterPaymentType}`);
    if (filterItem) parts.push(`Item: ${filterItem}`);
    if (filterNotes) parts.push(`Notes: ${filterNotes}`);
    if (filterAmount) parts.push(`Amount: ${filterAmount}`);
    if (filterMinAmount) parts.push(`Min: ${filterMinAmount}`);
    if (filterMaxAmount) parts.push(`Max: ${filterMaxAmount}`);
    if (filterBalanceStatus) parts.push(`Balance: ${filterBalanceStatus}`);
    if (dateFrom) parts.push(`From: ${dateFrom}`);
    if (dateTo) parts.push(`To: ${dateTo}`);
    return parts.length ? parts.join(' | ') : 'All sales (no filters applied)';
  };

  const buildSalesListPrintHTML = (rows) => {
    const filterLine = getSalesListFilterSummary();
    const printedAt = new Date().toLocaleString('en-GB');
    const totalAmount = rows.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);
    const totalDiscount = rows.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0);
    const totalShipping = rows.reduce((sum, sale) => sum + parseFloat(sale.shipping_amount || 0), 0);
    const totalPayment = rows.reduce((sum, sale) => sum + parseFloat(sale.payment || 0), 0);
    const totalBalance = rows.reduce(
      (sum, sale) => sum + (parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0)),
      0
    );

    const tableRows = rows
      .map((sale, index) => {
        const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
        const saleId = sale.is_return ? `#SR-${sale.return_id}` : `#${getBillDisplayNo(sale) || sale.sale_id}`;
        const billType = sale.bill_type || 'BILL';
        const isReturn = billType === 'SALE_RETURN' || sale.is_return;
        const balanceClass = balance > 0 ? 'balance-due' : balance < 0 ? 'balance-credit' : '';

        return `
          <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
            <td class="col-id">${escapePrintHtml(saleId)}</td>
            <td class="col-customer">${escapePrintHtml(sale.customer?.cus_name || 'N/A')}</td>
            <td class="col-items">${formatSaleItemsForListPrint(sale)}</td>
            <td class="col-ref">${escapePrintHtml(sale.reference || '—')}</td>
            <td class="num col-total">${fmtAmt(sale.total_amount)}</td>
            <td class="num">${fmtAmt(sale.discount)}</td>
            <td class="num">${fmtAmt(sale.shipping_amount)}</td>
            <td class="num col-payment">${fmtAmt(sale.payment)}</td>
            <td class="num col-balance ${balanceClass}">${fmtAmt(balance)}</td>
            <td class="c col-type ${isReturn ? 'type-return' : 'type-bill'}">${escapePrintHtml(billType)}</td>
            <td class="c col-date">${formatDatePK(sale?.created_at) || '—'}</td>
          </tr>`;
      })
      .join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Sales List Report</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1e293b;
    background: #fff;
    font-size: 9px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 100%; margin: 0 auto; }

  .company-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .company-header .urdu-name {
    font-size: 20px;
    font-weight: 700;
    direction: rtl;
    margin-bottom: 2px;
  }
  .company-header .urdu-address {
    font-size: 11px;
    direction: rtl;
    color: #333;
    margin-bottom: 3px;
  }
  .company-header .phone { font-size: 10px; color: #444; margin-bottom: 6px; }
  .company-header .doc-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    border-top: 1px solid #ccc;
    padding-top: 6px;
  }

  .report-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 9px;
  }
  .report-bar .filters {
    flex: 1;
    padding: 6px 8px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
  }
  .report-bar .filters strong { color: #475569; }
  .report-bar .stats {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .stat-box {
    border: 1px solid #94a3b8;
    padding: 5px 10px;
    text-align: center;
    min-width: 72px;
    background: #fff;
  }
  .stat-box .lbl {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 2px;
  }
  .stat-box .val { font-size: 11px; font-weight: 800; }
  .stat-box.balance .val { color: #15803d; font-size: 12px; }

  .list-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-bottom: none;
    font-size: 9px;
    font-weight: 700;
    color: #1e293b;
  }

  .sales-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.5px;
  }
  .sales-table thead th {
    background: #1e3a5f;
    color: #fff;
    font-weight: 700;
    padding: 6px 5px;
    border: 1px solid #1e3a5f;
    text-align: left;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .sales-table thead th.num { text-align: right; }
  .sales-table thead th.c { text-align: center; }
  .sales-table tbody td {
    padding: 5px 5px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
    word-wrap: break-word;
  }
  .sales-table tbody tr.row-even td { background: #fff; }
  .sales-table tbody tr.row-odd td { background: #f8fafc; }
  .sales-table .col-id { width: 5%; font-weight: 700; color: #1d4ed8; white-space: nowrap; }
  .sales-table .col-customer { width: 11%; font-weight: 600; }
  .sales-table .col-items { width: 20%; vertical-align: top; }
  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 8px;
  }
  .item-row:last-child { border-bottom: none; }
  .item-name { font-weight: 600; color: #1e293b; flex: 1; min-width: 0; }
  .item-qty {
    flex-shrink: 0;
    font-weight: 800;
    color: #1d4ed8;
    background: #dbeafe;
    border: 1px solid #93c5fd;
    border-radius: 2px;
    padding: 1px 5px;
    font-size: 7.5px;
  }
  .sales-table .col-ref { width: 9%; color: #64748b; font-size: 8px; }
  .sales-table .col-total { width: 7%; font-weight: 800; }
  .sales-table .num { text-align: right; white-space: nowrap; font-weight: 600; }
  .sales-table .col-payment { color: #15803d; font-weight: 700; }
  .sales-table .col-balance { font-weight: 800; font-size: 9px; }
  .sales-table .balance-due { color: #be185d; }
  .sales-table .balance-credit { color: #15803d; }
  .sales-table .c { text-align: center; }
  .sales-table .col-type { font-size: 7.5px; font-weight: 700; }
  .sales-table .type-bill { color: #15803d; }
  .sales-table .type-return { color: #dc2626; }
  .sales-table .col-date { width: 7%; white-space: nowrap; color: #64748b; font-size: 8px; }

  .sales-table tfoot td {
    padding: 7px 5px;
    border: 1px solid #1e3a5f;
    font-weight: 800;
    background: #e2e8f0;
    font-size: 9px;
  }
  .sales-table tfoot .num { text-align: right; }
  .sales-table tfoot .balance-total {
    background: #dcfce7;
    color: #15803d;
    font-size: 10px;
  }

  .print-footer {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #94a3b8;
  }

  @media print {
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
</style></head><body>
  <div class="page">
    <header class="company-header">
      <div class="urdu-name">اتفاق آئرن اینڈ سیمنٹ سٹور</div>
      <div class="urdu-address">گجرات سرگودھا روڈ، پاہڑیانوالی</div>
      <div class="phone">Ph: 0346-7560306 &nbsp;|&nbsp; 0300-7560306</div>
      <div class="doc-title">Sales List Report</div>
    </header>

    <div class="report-bar">
      <div class="filters">
        <strong>Printed:</strong> ${escapePrintHtml(printedAt)} &nbsp;|&nbsp;
        <strong>Filters:</strong> ${escapePrintHtml(filterLine)}
      </div>
      <div class="stats">
        <div class="stat-box"><div class="lbl">Records</div><div class="val">${rows.length}</div></div>
        <div class="stat-box"><div class="lbl">Total</div><div class="val">${fmtAmt(totalAmount)}</div></div>
        <div class="stat-box"><div class="lbl">Received</div><div class="val">${fmtAmt(totalPayment)}</div></div>
        <div class="stat-box balance"><div class="lbl">Balance</div><div class="val">${fmtAmt(totalBalance)}</div></div>
      </div>
    </div>

    <div class="list-label">
      <span>Sales List</span>
      <span>${rows.length} row${rows.length === 1 ? '' : 's'}</span>
    </div>

    <table class="sales-table">
      <thead>
        <tr>
          <th>Sale ID</th>
          <th>Customer</th>
          <th>Items &amp; Qty</th>
          <th>Reference</th>
          <th class="num">Total</th>
          <th class="num">Discount</th>
          <th class="num">Shipping</th>
          <th class="num">Payment</th>
          <th class="num">Balance</th>
          <th class="c">Bill Type</th>
          <th class="c">Date</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>TOTALS (${rows.length} sales)</strong></td>
          <td class="num">${fmtAmt(totalAmount)}</td>
          <td class="num">${fmtAmt(totalDiscount)}</td>
          <td class="num">${fmtAmt(totalShipping)}</td>
          <td class="num">${fmtAmt(totalPayment)}</td>
          <td class="num balance-total">${fmtAmt(totalBalance)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    <footer class="print-footer">
      <span>Itefaq Iron &amp; Cement Store</span>
      <span>Generated: ${escapePrintHtml(printedAt)}</span>
    </footer>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
  };

  const handlePrintSalesList = () => {
    const rows = filteredSales;
    if (!rows.length) {
      showSnackbar('No sales to print for the current filters.', 'warning');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      showSnackbar('Pop-up blocked. Allow pop-ups to print the sales list.', 'error');
      return;
    }
    printWindow.document.write(buildSalesListPrintHTML(rows));
    printWindow.document.close();
  };

  const latestStateRef = useRef();
  useEffect(() => {
    latestStateRef.current = {
      productTableData,
      formSelectedCustomer,
      formSelectedStore,
      paymentData,
      billType,
      transportOptions,
      currentDraftId
    };
  });

  useEffect(() => {
    return () => {
      const state = latestStateRef.current;
      if (state && state.productTableData && state.productTableData.length > 0 && state.formSelectedStore) {
        const formState = {
          customer: state.formSelectedCustomer,
          store: state.formSelectedStore,
          products: state.productTableData,
          paymentData: state.paymentData,
          billType: state.billType,
          transportOptions: state.transportOptions
        };

        // Always use POST — PUT handler only toggles is_active and would deactivate the draft
        const endpoint = '/api/draft-sales';

        const payload = {
          ...(state.currentDraftId ? { draft_id: state.currentDraftId } : {}),
          store_id: state.formSelectedStore.storeid,
          cus_id: state.formSelectedCustomer?.cus_id || null,
          form_state: formState,
          updated_by: 6
        };

        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(err => console.error('Error auto-saving draft on unmount:', err));
      }
    };
  }, []);

  const autoHoldIfActive = async () => {
    if (productTableData && productTableData.length > 0 && formSelectedStore) {
      await handleSaveDraft();
    }
  };

  const handleSaveDraft = async () => {
    try {
      if (!formSelectedStore) {
        showSnackbar('Please select a store before saving draft', 'error');
        return;
      }

      // Collect form data
      const formState = {
        customer: formSelectedCustomer,
        store: formSelectedStore,
        products: productTableData,
        paymentData: paymentData,
        billType: billType,
        transportOptions: transportOptions
      };

      setIsSavingDraft(true);

      // Always use POST — the API's POST handler supports both create and update
      // (when draft_id is provided). The PUT handler is only for toggling is_active.
      const endpoint = '/api/draft-sales';

      const payload = {
        ...(currentDraftId ? { draft_id: currentDraftId } : {}),
        store_id: formSelectedStore.storeid,
        cus_id: formSelectedCustomer?.cus_id || null,
        form_state: formState,
        updated_by: 6
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedDraft = await response.json();
        setCurrentDraftId(savedDraft.draft_id);
        showSnackbar(`✅ Draft saved as ${savedDraft.draft_code}`, 'success');

        // Refresh drafts list
        await fetchDrafts();
      } else {
        const error = await response.json();
        showSnackbar(`Failed to save draft: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error saving draft:', error);
      showSnackbar(`Error saving draft: ${error.message}`, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // F9 = Hold bill
  useEffect(() => {
    const handleF9 = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleSaveDraft().then(() => clearFormState());
      }
    };
    window.addEventListener('keydown', handleF9);
    return () => window.removeEventListener('keydown', handleF9);
  }, [handleSaveDraft, clearFormState]);

  // Load draft into form
  const handleLoadDraft = async (draft) => {
    try {
      setLoading(true);
      await autoHoldIfActive();

      // Get full draft details
      const response = await fetch(`/api/draft-sales?id=${draft.draft_id}`);
      if (!response.ok) throw new Error('Failed to load draft');

      const fullDraft = await response.json();
      const formState = JSON.parse(fullDraft.form_state_json);

      console.log('📖 Loading draft:', formState);

      // Restore form state
      if (formState.customer) {
        setFormSelectedCustomer(formState.customer);
      }
      if (formState.store) {
        setFormSelectedStore(formState.store);
      }
      if (formState.products) {
        setProductTableData(formState.products);
      }
      if (formState.paymentData) {
        setPaymentData(normalizePaymentData(formState.paymentData));
      }
      if (formState.billType) {
        setBillType(formState.billType);
      }
      if (formState.transportOptions) {
        setTransportOptions(formState.transportOptions);
      }

      setCurrentDraftId(draft.draft_id);
      setDraftModalOpen(false);

      showSnackbar(`✅ Draft ${draft.draft_code} loaded successfully`, 'success');
    } catch (error) {
      console.error('❌ Error loading draft:', error);
      showSnackbar(`Failed to load draft: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete draft
  const handleDeleteDraft = async (draftId, draftCode) => {
    try {
      const response = await fetch(`/api/draft-sales?id=${draftId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSnackbar(`✅ Draft ${draftCode} deleted`, 'success');

        // Clear current draft if it's the one being deleted
        if (currentDraftId === draftId) {
          setCurrentDraftId(null);
        }

        // Refresh drafts list
        await fetchDrafts();
      } else {
        showSnackbar('Failed to delete draft', 'error');
      }
    } catch (error) {
      console.error('❌ Error deleting draft:', error);
      showSnackbar(`Error deleting draft: ${error.message}`, 'error');
    }
  };

  // Open draft modal
  const handleOpenDraftModal = async () => {
    await fetchDrafts();
    setDraftModalOpen(true);
  };

  // ======================== END DRAFT SALES FUNCTIONS ========================

  // Handle viewing a bill
  const handleViewBill = async (sale) => {
    console.log('📋 Viewing bill:', sale);

    try {
      // Fetch fresh data with all payment details
      const isReturn = sale.is_return || sale.bill_type === 'SALE_RETURN';
      const returnId = sale.return_id || (typeof sale.sale_id === 'string' ? parseInt(sale.sale_id.replace('SR-', '')) : sale.sale_id);
      const endpoint = isReturn ? `/api/sale-returns?id=${returnId}` : `/api/sales?id=${sale.sale_id}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch bill details');
      const saleData = await response.json();
      
      // Ensure mapped return fields align on details view
      const notesVal = saleData.notes || saleData.reference || sale.notes || sale.reference || '';
      const formattedData = isReturn ? {
        ...saleData,
        notes: notesVal,
        is_return: true,
        bill_type: 'SALE_RETURN',
        sale_id: `SR-${saleData.return_id}`,
        actual_sale_id: saleData.sale_id,
        sale_details: (saleData.return_details || []).map(d => ({
          ...d,
          product: d.product,
          product_name: d.product?.pro_title,
          qnty: Number(d.qnty || d.return_quantity || 0),
          unit_rate: Number(d.unit_rate || 0),
          total_amount: Number(d.total_amount || d.return_amount || 0)
        }))
      } : {
        ...saleData,
        notes: notesVal
      };

      console.log('💰 Fresh data with payments:', formattedData);

      setSelectedBill(formattedData);
      setViewBillDialog(true);
    } catch (error) {
      console.error('Error fetching bill details:', error);
      // Fallback to using the data from the list if API call fails
      setSelectedBill({
        ...sale,
        notes: sale.notes || sale.reference || ''
      });
      setViewBillDialog(true);
    }
  };

  // Handle viewing receipt (same as viewing bill)
  const handleViewReceipt = async (sale) => {
    console.log('📋 Viewing receipt:', sale);

    try {
      // Fetch fresh data with all payment details
      const isReturn = sale.is_return || sale.bill_type === 'SALE_RETURN';
      const returnId = sale.return_id || (typeof sale.sale_id === 'string' ? parseInt(sale.sale_id.replace('SR-', '')) : sale.sale_id);
      const endpoint = isReturn ? `/api/sale-returns?id=${returnId}` : `/api/sales?id=${sale.sale_id}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch receipt details');
      const saleData = await response.json();
      
      // Ensure mapped return fields align on details view
      const notesVal = saleData.notes || saleData.reference || sale.notes || sale.reference || '';
      const formattedData = isReturn ? {
        ...saleData,
        notes: notesVal,
        is_return: true,
        bill_type: 'SALE_RETURN',
        sale_id: `SR-${saleData.return_id}`,
        actual_sale_id: saleData.sale_id,
        sale_details: (saleData.return_details || []).map(d => ({
          ...d,
          product: d.product,
          product_name: d.product?.pro_title,
          qnty: Number(d.qnty || d.return_quantity || 0),
          unit_rate: Number(d.unit_rate || 0),
          total_amount: Number(d.total_amount || d.return_amount || 0)
        }))
      } : {
        ...saleData,
        notes: notesVal
      };

      console.log('💰 Fresh data with payments:', formattedData);

      setSelectedBill(formattedData);
      setViewBillDialog(true);
    } catch (error) {
      console.error('Error fetching receipt details:', error);
      // Fallback to using the data from the list if API call fails
      setSelectedBill({
        ...sale,
        notes: sale.notes || sale.reference || ''
      });
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
        shipping_amount: parseFloat(fullSale.shipping_amount || 0).toString(),
        labour_charges: parseFloat(fullSale.labour_charges || fullSale.labour || 0).toString(),
        bill_type: fullSale.bill_type || 'BILL',
        reason: '',
        reference: fullSale.reference || '',
        return_details: fullSale.sale_details ? fullSale.sale_details.map(detail => ({
          pro_id: detail.pro_id,
          store_id: detail.store_id || fullSale.store_id || null,
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
      labour_charges: '',
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
    const shipping = parseFloat(returnFormData.shipping_amount || 0);
    const labour = parseFloat(returnFormData.labour_charges || 0);
    return totalAmount - shipping - labour - discount;
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
        total_amount: (parseFloat(updated[index].unit_rate || 0) * parseInt(newQty || 0)).toFixed(0)
      };
      return { ...prev, return_details: updated };
    });
  };

  // Handle searching for an order to load
  const handleSearchOrder = async () => {
    const cleanedSearchTerm = orderSearchTerm.replace(/\D/g, ''); // Extract only digits
    if (!cleanedSearchTerm) {
      showSnackbar('Please enter a valid numeric Order Number or code (e.g. O-12 or 12)', 'warning');
      return;
    }

    try {
      setIsSearchingOrder(true);
      const response = await fetch(`/api/sales?id=${cleanedSearchTerm}`);

      if (!response.ok) {
        let errMsg = 'Failed to load order. Please check the Order Number.';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        if (errMsg === 'Sale not found') {
          errMsg = 'Order does not exist. Please check the Order Number.';
        }
        showSnackbar(errMsg, 'error');
        return;
      }

      const orderData = await response.json();

      console.log('📦 ORDER LOADED FROM SEARCH:', orderData);
      console.log('🔍 ORDER DATA DETAILS:');
      console.log('  Sale ID:', orderData.sale_id);
      console.log('  Customer:', orderData.customer?.cus_name || 'N/A');
      console.log('  Total Amount:', orderData.total_amount);
      console.log('  Payment (Advance):', orderData.payment);
      console.log('  Discount:', orderData.discount);
      console.log('  Shipping Amount:', orderData.shipping_amount);
      console.log('  Labour Charges:', orderData.labour_charges || orderData.labour);
      console.log('  Store ID:', orderData.store_id);
      console.log('  Bill Type:', orderData.bill_type);
      console.log('  Payment Type:', orderData.payment_type);
      console.log('  Reference:', orderData.reference);
      console.log('  Order Details/Products:', orderData.sale_details);
      if (orderData.sale_details && Array.isArray(orderData.sale_details)) {
        console.log('  📦 Product Items Count:', orderData.sale_details.length);
        orderData.sale_details.forEach((item, idx) => {
          console.log(`    Item ${idx + 1}: ${item.product?.pro_title || 'Unknown'} - Qty: ${item.qnty}, Rate: ${item.unit_rate}, Amount: ${item.total_amount}`);
        });
      }

      if (orderData.bill_type !== 'ORDER') {
        showSnackbar('The found record is not an Order', 'warning');
        return;
      }

      // Populate form with order data

      // 1. Set Customer
      if (orderData.customer) {
        // Find full customer object from customers list if possible to ensure we have all data
        const fullCustomer = customers.find(c => c.cus_id === orderData.cus_id) || orderData.customer;
        setFormSelectedCustomer(fullCustomer);
      }

      // 2. Set Store (if applicable)
      if (orderData.store_id) {
        const store = stores.find(s => s.storeid === orderData.store_id);
        if (store) setFormSelectedStore(store);
      }

      // 3. Set Products (reversed order)
      if (orderData.sale_details && Array.isArray(orderData.sale_details)) {
        const products = orderData.sale_details.slice().reverse().map((detail, index) => ({
          id: Date.now() + index + Math.random(),
          pro_id: detail.pro_id,
          pro_title: detail.product?.pro_title || detail.product?.pro_name || 'Unknown Product',
          storeid: orderData.store_id,
          store_name: stores.find(s => s.storeid === orderData.store_id)?.store_name || 'Store',
          quantity: parseFloat(detail.qnty) || 0,
          rate: parseFloat(detail.unit_rate) || 0,
          amount: parseFloat(detail.total_amount) || 0,
          stock: detail.product?.pro_stock_qnty || 0 // Note: This might need a fresh fetch for latest stock
        }));
        setProductTableData(products);
      }

      // 4. Set Payment Data (Notes, Discount, etc.)
      setPaymentData(prev => ({
        ...prev,
        advancePayment: '', // Clear advance payment for new bill
        discount: parseFloat(orderData.discount) || 0,
        notes: orderData.reference ? `${orderData.reference} (Ref Order #${orderData.sale_id})` : `Ref Order #${orderData.sale_id}`,
        deliveryCharges: parseFloat(orderData.shipping_amount) || 0,
        labour: parseFloat(orderData.labour_charges || orderData.labour || 0), // Load labour charges from order
        isLoadedOrder: false, // Mark as loaded order
        sourceOrderId: null // Keep order untouched
      }));

      setLoadedOrderId(null);

      showSnackbar(`Order details loaded successfully!`, 'success');
      setOrderSearchTerm(''); // Clear search field

    } catch (error) {
      console.error('Error loading order:', error);
      showSnackbar('Failed to load order. Please check the Order Number.', 'error');
    } finally {
      setIsSearchingOrder(false);
    }
  };

  // Handle return submission
  const handleSubmitReturn = async () => {
    const authOk = await requireAuth();
    if (!authOk) return;
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
        updated_by: getCurrentUserId()
      };

      const response = await fetch('/api/sale-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        showSnackbar('Sale return processed successfully', 'success');
        handleCloseReturnDialog();
        await fetchData({ mode: 'list', silent: true });
      } else {
        const errorData = await response.json();
        showSnackbar('Error: ' + (errorData.error || 'Failed to process return'), 'error');
      }
    } catch (error) {
      console.error('Error processing sale return:', error);
      showSnackbar('Error processing sale return', 'error');
    }
  };

  // Handle loading a sale for return (from main form)
  const handleLoadSaleForReturnMain = async (sale) => {
    try {
      setLoading(true);

      // Fetch full sale details
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch sale details');
      const fullSale = await response.json();

      console.log('📦 Loaded Sale for Return:', fullSale);
      console.log('🔍 SALE DETAILS FOR RETURN:');
      console.log('  Sale ID:', fullSale.sale_id);
      console.log('  Customer:', fullSale.customer?.cus_name || 'N/A');
      console.log('  Total Amount:', fullSale.total_amount);
      console.log('  Discount:', fullSale.discount, typeof fullSale.discount);
      console.log('  Labour Charges (labour_charges):', fullSale.labour_charges, typeof fullSale.labour_charges);
      console.log('  Labour Charges (labour):', fullSale.labour, typeof fullSale.labour);
      console.log('  Shipping/Delivery:', fullSale.shipping_amount, typeof fullSale.shipping_amount);
      console.log('  Payment:', fullSale.payment);
      console.log('  Products:', fullSale.sale_details);

      // Populate the return form data with sale details
      const labourValue = parseFloat(fullSale.labour_charges || fullSale.labour || 0);
      const discountValue = parseFloat(fullSale.discount || 0);
      const deliveryValue = parseFloat(fullSale.shipping_amount || 0);
      const advanceValue = parseFloat(fullSale.payment || 0);

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
        shipping_amount: deliveryValue.toString(),
        labour_charges: labourValue.toString(),
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

      console.log('💾 PAYMENT DATA BEING SET:');
      console.log('  Labour:', labourValue);
      console.log('  Discount:', discountValue);
      console.log('  Delivery:', deliveryValue);
      console.log('  Advance:', advanceValue);

      if (fullSale.transport_details && Array.isArray(fullSale.transport_details)) {
        const mappedTransport = fullSale.transport_details.map((item, index) => {
          const account = transportAccounts.find((t) => t.cus_id === item.account_id);
          return {
            id: Date.now() + index + 100,
            name: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account'),
            amount: parseFloat(item.amount || 0),
            accountId: item.account_id,
            accountName: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account'),
          };
        });
        setTransportOptions(mappedTransport);
      } else {
        setTransportOptions([]);
      }

      setPaymentData((prev) => ({
        ...prev,
        advancePayment: advanceValue,
        discount: 0,
        labour: labourValue > 0 ? labourValue : '',
        deliveryCharges: deliveryValue > 0 ? deliveryValue : '',
        notes: `Return from Sale #${fullSale.sale_id}. Original Amount: ${fullSale.total_amount}`,
        isLoadedOrder: false,
      }));

      // Update product table with sale items
      if (fullSale.sale_details && Array.isArray(fullSale.sale_details)) {
        const products = getSaleDetailsForCart(fullSale.sale_details).map(detail => ({
          id: Date.now() + Math.random(),
          pro_id: detail.pro_id,
          pro_title: detail.product?.pro_title || detail.product?.pro_name || 'Unknown Product',
          storeid: fullSale.store_id,
          store_name: stores.find(s => s.storeid === fullSale.store_id)?.store_name || 'Store',
          quantity: parseFloat(detail.qnty) || 0,
          rate: parseFloat(detail.unit_rate) || 0,
          amount: parseFloat(detail.total_amount) || 0,
          stock: detail.product?.pro_stock_qnty || 0
        }));
        setProductTableData(products);
        console.log('📦 Products loaded:', products);
      }

      // Set Customer
      if (fullSale.customer) {
        setFormSelectedCustomer(fullSale.customer);
      } else if (fullSale.cus_id) {
        const customer = customers.find(c => c.cus_id === fullSale.cus_id);
        if (customer) setFormSelectedCustomer(customer);
      }

      // Set Store
      if (fullSale.store_id) {
        const store = stores.find(s => s.storeid === fullSale.store_id);
        if (store) setFormSelectedStore(store);
      }

      // Keep the selected sale in the select field
      setSelectedSaleForReturnMain(fullSale);

      console.log('✅ FINAL VALUES BEING DISPLAYED:');
      console.log('  Labour:', labourValue, '(from labour_charges or labour)');
      console.log('  Discount:', discountValue);
      console.log('  Delivery:', deliveryValue);

      showSnackbar(`Sale #${fullSale.sale_id} loaded! Discount: ${discountValue}, Labour: ${labourValue}, Delivery: ${deliveryValue}`, 'success');
    } catch (error) {
      console.error('Error loading sale for return:', error);
      showSnackbar('Failed to load sale for return', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle searching for sales in return form
  const handleSaleSearch = async (searchTerm) => {
    try {
      if (!searchTerm.trim()) {
        setSaleSearchResults(sales.slice(0, 50));
        return;
      }

      // Search by sale_id, reference, or within selected customer's sales
      const searchLower = searchTerm.toLowerCase();
      const results = sales.filter(sale => {
        // Filter by customer if one is selected
        if (formSelectedCustomer && sale.cus_id !== formSelectedCustomer.cus_id) {
          return false;
        }

        return (
          sale.sale_id?.toString().includes(searchLower) ||
          sale.bill_number?.toString().includes(searchLower) ||
          getBillDisplayNo(sale).toLowerCase().includes(searchLower) ||
          sale.invoice_number?.toLowerCase().includes(searchLower) ||
          sale.reference?.toLowerCase().includes(searchLower)
        );
      }).slice(0, 50);

      setSaleSearchResults(results);
    } catch (error) {
      console.error('Error searching sales:', error);
      showSnackbar('Error searching sales', 'error');
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

  // Handle print bill with mode (A4 or Thermal or Existing)
  const handlePrintBill = (mode = 'A4', fromDialog = false, targetBill = null) => {
    try {
      const actualMode = typeof mode === 'string' ? mode : 'A4';
      const className = actualMode === 'THERMAL' 
        ? 'print-thermal' 
        : (actualMode === 'EXISTING' ? 'print-existing' : 'print-a4');
      const isThermal = actualMode === 'THERMAL';

      // Ensure active bill is set for printing
      const activeBill = targetBill || currentBillData || selectedBill;
      if (activeBill) {
        setCurrentBillData(activeBill);
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
              size: A4 portrait !important;
              margin: 0.5cm 1cm !important;
            }
          }
        `;
      }

      // Add body class for print styling
      document.body.classList.add(className);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');
          document.body.classList.remove('print-existing');

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

  // Filter sales based on search criteria
  const filteredSales = useMemo(() => {
    console.log('🔍 Starting filter with sales count:', sales.length);
    console.log('🔍 Sales is array?', Array.isArray(sales));
    console.log('🔍 Filter criteria:', { searchTerm, filterCustomer, filterBillType, filterStore, filterPaymentType, filterAmount, filterMinAmount, filterMaxAmount, filterBalanceStatus, dateFrom, dateTo });

    // Check if sales array has data
    if (!Array.isArray(sales) || sales.length === 0) {
      console.log('🔍 No sales to filter - returning empty array');
      return [];
    }

    console.log('🔍 Filtering', sales.length, 'sales...');
    const filtered = sales.filter(sale => {
      // Filter to only show BILL and SALE_RETURN type (exclude QUOTATION and other types)
      const isBillType = sale.bill_type === 'BILL' || sale.bill_type === 'SALE_RETURN' || !sale.bill_type;
      if (!isBillType) {
        return false;
      }

      // All filters are empty by default, so all sales should match
      const matchesSearch = searchTerm === '' ||
        sale.sale_id?.toString().includes(searchTerm) ||
        (sale.is_return && sale.return_id?.toString().includes(searchTerm)) ||
        (sale.is_return && sale.actual_sale_id?.toString().includes(searchTerm)) ||
        sale.customer?.cus_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.bill_number?.toString().includes(searchTerm) ||
        getBillDisplayNo(sale).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.sale_details && sale.sale_details.some(d =>
          (d.product?.pro_title || d.product_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )) ||
        sale.total_amount?.toString().includes(searchTerm);

      const matchesItem = filterItem === '' ||
        (sale.sale_details && sale.sale_details.some((d) => saleDetailMatchesItemFilter(d, filterItem)));

      const matchesCustomer = filterCustomer === '' ||
        sale.customer?.cus_id?.toString() === filterCustomer;

      const matchesBillType = filterBillType === '' ||
        sale.bill_type === filterBillType;

      // Store filter - check if any sale detail has the store
      const matchesStore = filterStore === '' ||
        (sale.sale_details && sale.sale_details.some(detail =>
          detail.store?.storeid?.toString() === filterStore ||
          detail.store_id?.toString() === filterStore
        )) ||
        (sale.is_return && (!sale.sale_details || sale.sale_details.length === 0 || sale.sale_details.every(detail => !detail.store_id)));

      // Payment type filter
      const matchesPaymentType = filterPaymentType === '' ||
        sale.payment_type === filterPaymentType;

      // Amount range & exact amount filters
      const totalAmount = parseFloat(sale.total_amount || 0);
      const matchesAmount = filterAmount === '' ||
        (!isNaN(parseFloat(filterAmount)) && Math.abs(totalAmount - parseFloat(filterAmount)) < 0.01);
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

      const matchesNotes = filterNotes === '' ||
        (sale.reference && sale.reference.toLowerCase().includes(filterNotes.toLowerCase())) ||
        (sale.notes && sale.notes.toLowerCase().includes(filterNotes.toLowerCase()));

      const result = matchesSearch && matchesCustomer && matchesBillType && matchesStore &&
        matchesPaymentType && matchesAmount && matchesMinAmount && matchesMaxAmount &&
        matchesBalanceStatus && matchesDateFrom && matchesDateTo && matchesItem && matchesNotes;

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

    // Apply sorting
    filtered.sort((a, b) => {
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
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return -1 * modifier;
      if (aValue > bValue) return 1 * modifier;
      return 0;
    });

    console.log('🔍 Filtered and sorted sales count:', filtered.length, 'out of', sales.length);
    if (filtered.length > 0) {
      console.log('🔍 First filtered sale:', filtered[0]);
    }
    return filtered;
  }, [sales, searchTerm, filterItem, filterNotes, filterCustomer, filterBillType, filterStore, filterPaymentType, filterAmount, filterMinAmount, filterMaxAmount, filterBalanceStatus, dateFrom, dateTo, sortBy, sortOrder]);

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





  // Calculate stats from filtered sales
  const totalSales = filteredSales.length;
  const totalSalesValue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0);
  const totalDiscount = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0);
  const totalPayment = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.payment || 0), 0);

  // Filter and sort sales
  const filteredAndSortedSales = sales
    .filter(sale => {
      const matchesSearch = sale.customer?.cus_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.sale_id?.toString().includes(searchTerm.toLowerCase());
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
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return -1 * modifier;
      if (aValue > bValue) return 1 * modifier;
      return 0;
    });

  const [editingSale, setEditingSale] = useState(null);

  const handleEdit = async (sale) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales?id=${sale.sale_id}`);
      const fullSale = res.ok ? await res.json() : sale;

      setEditingSale(fullSale);

      // Customer
      const customer = customers.find(c => c.cus_id === fullSale.cus_id);
      setFormSelectedCustomer(customer || fullSale.customer || null);

      // Store
      const finalStoreId = fullSale.store_id || (fullSale.sale_details && fullSale.sale_details.length > 0 ? fullSale.sale_details[0].store_id : null);
      const store = stores.find(s => s.storeid === finalStoreId);
      setFormSelectedStore(store || (stores.length > 0 ? stores[0] : null));

      // Bill type
      setBillType(fullSale.bill_type === 'SALE_RETURN' ? 'BILL' : (fullSale.bill_type || 'BILL'));

      // Product rows
      setProductTableData(getSaleDetailsForCart(fullSale.sale_details || []).map((detail, index) => {
        const detailStoreId = detail.store_id || fullSale.store_id;
        const matchingStore = stores.find(s => s.storeid === detailStoreId);
        return {
          id: detail.sale_detail_id || (Date.now() + index),
          pro_id: detail.pro_id,
          pro_title: detail.product?.pro_title || detail.pro_title || `Product #${detail.pro_id}`,
          storeid: detailStoreId || '',
          store_name: matchingStore?.store_name || detail.store?.store_name || '',
          quantity: parseFloat(detail.qnty),
          rate: parseFloat(detail.unit_rate),
          amount: parseFloat(detail.total_amount),
          stock: 0,
          unit: detail.unit || 'PCS',
          crate: parseFloat(detail.unit_rate)
        };
      }));

      // Map Transport Options
      let totalTransportAmount = 0;
      if (fullSale.transport_details && Array.isArray(fullSale.transport_details)) {
        const mappedTransport = fullSale.transport_details.map((item, index) => {
          const account = transportAccounts.find(t => t.cus_id === item.account_id);
          const itemAmt = parseFloat(item.amount || 0);
          totalTransportAmount += itemAmt;
          return {
            id: Date.now() + index + 100, // Offset ID to avoid collision
            name: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account'),
            amount: itemAmt,
            accountId: item.account_id,
            accountName: account ? account.cus_name : (item.account?.cus_name || 'Unknown Account')
          };
        });
        setTransportOptions(mappedTransport);

        // Pre-fill the newTransport state if we have at least one transport option
        if (mappedTransport.length > 0) {
          setNewTransport({
            accountId: mappedTransport[0].accountId,
            amount: mappedTransport[0].amount
          });
        } else {
          setNewTransport({ amount: 0, accountId: '' });
        }
      } else {
        setTransportOptions([]);
        setNewTransport({ amount: 0, accountId: '' });
      }

      // Payment data
      const cashAmt = parseFloat(fullSale.cash_payment || 0);
      const bankAmt = parseFloat(fullSale.bank_payment || 0);
      const fullShippingAmt = parseFloat(fullSale.shipping_amount || 0);

      setPaymentData(normalizePaymentData({
        cash: cashAmt > 0 ? cashAmt.toString() : '',
        bank: bankAmt > 0 ? bankAmt.toString() : '',
        bankAccountId: fullSale.debit_account_id || '',
        totalCashReceived: parseFloat(fullSale.payment || 0),
        advancePayment: parseFloat(fullSale.advance_payment || 0),
        discount: fullSale.discount?.toString() || '',
        labour: fullSale.labour_charges?.toString() || '',
        deliveryCharges: fullShippingAmt > 0 ? fullShippingAmt.toString() : '',
        notes: fullSale.reference || ''
      }));

      setCurrentView('create');
    } catch (err) {
      showSnackbar('Failed to load sale for editing', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/sales?id=${saleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete sale');
      }

      // Remove from local state
      setSales(prevSales => prevSales.filter(sale => sale.sale_id !== saleId));
      showSnackbar('Sale deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting sale:', error);
      showSnackbar(error.message || 'Failed to delete sale', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterItem('');
    setFilterNotes('');
    setSelectedCustomer(null);
    setFilterCustomer('');
    setFilterBillType('');
    setFilterStore('');
    setFilterPaymentType('');
    setFilterAmount('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterBalanceStatus('');
    setDateFrom('');
    setDateTo('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const showPageLoader =
    (currentView === 'list' && listLoading) ||
    (currentView === 'create' && loading);

  if (showPageLoader) {
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
        subMessage="Do not close or refresh until the sale is saved and the invoice is ready"
      />
      <Container maxWidth={false} sx={{ py: 1 }}>
        <Stack spacing={2} className="no-print">
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={() => { setCurrentView('list'); setEditingSale(null); }}
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
                <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: billType === 'SALE_RETURN' ? '#d32f2f' : editingSale ? '#1565c0' : 'text.primary' }}>
                  {editingSale ? `Edit Sale #${editingSale.bill_number || editingSale.sale_id}` : billType === 'SALE_RETURN' ? 'Return Sale' : 'Create New Sale'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {editingSale ? 'Update sale details — ledger will be adjusted automatically' : billType === 'SALE_RETURN' ? 'Select an invoice to return items' : 'Select products and create sale order'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* Network Status Badge */}
              <Chip
                icon={isOnline ? <WifiIcon style={{ color: '#2e7d32' }} /> : <WifiOffIcon style={{ color: '#d32f2f' }} />}
                label={
                  isOnline
                    ? (offlineQueueCount > 0 ? `Online (${offlineQueueCount} Pending)` : 'Online')
                    : `Offline Mode (${offlineQueueCount} Pending)`
                }
                color={!isOnline || offlineQueueCount > 0 ? 'warning' : 'success'}
                variant={!isOnline || offlineQueueCount > 0 ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: 'bold', px: 0.5 }}
              />

              {/* Sync Offline Queue Button */}
              {offlineQueueCount > 0 && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={isSyncingOffline ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                  onClick={triggerAutoSync}
                  disabled={isSyncingOffline || !isOnline}
                  sx={{
                    bgcolor: '#ed6c02',
                    color: 'white',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#e65100' }
                  }}
                  title="Upload pending offline bills to online server"
                >
                  {isSyncingOffline ? 'Syncing...' : `Sync Offline (${offlineQueueCount})`}
                </Button>
              )}
            <Button
              variant="outlined"
              startIcon={<ReceiptIcon />}
              onClick={() => setLoadQuotationDialogOpen(true)}
              sx={{
                mr: 2,
                borderColor: '#ed6c02',
                color: '#ed6c02',
                '&:hover': {
                  borderColor: '#e65100',
                  backgroundColor: '#fff3e0'
                }
              }}
            >
              Load Quotation
            </Button>
            <Button
              variant="outlined"
              startIcon={<ListAltIcon />}
              onClick={() => setLoadOrderDialogOpen(true)}
              sx={{
                mr: 2,
                borderColor: '#1976d2',
                color: '#1976d2',
                '&:hover': {
                  borderColor: '#115293',
                  backgroundColor: '#e3f2fd'
                }
              }}
            >
              Load Order
            </Button>
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
            <Button
              variant="outlined"
              startIcon={<PackageIcon />}
              onClick={() => setShowAddProductPopup(true)}
              sx={{
                borderColor: 'info.main',
                color: 'info.main',
                '&:hover': { borderColor: 'info.dark', backgroundColor: 'info.light', color: 'info.dark' }
              }}
            >
              Add Product
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderIcon />}
              onClick={() => setShowAddProductCategoryPopup(true)}
              sx={{
                borderColor: 'success.main',
                color: 'success.main',
                '&:hover': { borderColor: 'success.dark', backgroundColor: 'success.light', color: 'success.dark' }
              }}
            >
              Add Product Category
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => setShowAddProductSubCategoryPopup(true)}
              sx={{
                borderColor: 'secondary.main',
                color: 'secondary.main',
                '&:hover': { borderColor: 'secondary.dark', backgroundColor: 'secondary.light', color: 'secondary.dark' }
              }}
            >
              Add Product Sub Category
            </Button>
          </Box>
        </Box>


          {/* Screen Stack Indicator */}
          {currentScreenIndex >= 0 && screenStack.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mt: 2, mb: 2, gap: 1 }}>
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
          <Card>
            <CardContent sx={{ p: 2 }}>
              {/* Transaction Type Banner */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  borderRadius: 2,
                  background: billType === 'SALE_RETURN'
                    ? 'linear-gradient(45deg, #c62828 30%, #ef5350 90%)' // Red for Return
                    : 'linear-gradient(45deg, #047857 30%, #10b981 90%)', // Green for Sale
                  boxShadow: '0 3px 5px 2px rgba(0,0,0,0.1)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {billType === 'SALE_RETURN' ? 'Sale Return Entry' : 'New Sale Entry'}
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
                      {billType === 'SALE_RETURN' ? <TrendingDownIcon sx={{ color: 'white' }} /> : <ReceiptIcon sx={{ color: 'white' }} />}
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {billType === 'SALE_RETURN' ? 'Return In' : 'Invoice Out'}
                      </Typography>
                    </Box>
                  </Box>

                  <Autocomplete
                    size="small"
                    options={['BILL', 'SALE_RETURN']}
                    value={billType}
                    onChange={(e, newValue) => {
                      setBillType(newValue || 'BILL');
                      if (newValue !== 'SALE_RETURN') {
                        setSelectedSaleForReturnMain(null);
                      }
                    }}
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select Transaction Type"
                        variant="standard"
                        onFocus={(e) => e.target.select()}
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
                </Box>

              </Box>

              {/* Filter and Order Search Row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                
                {/* Left Side: Customer Type Dropdown Filter */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'black', whiteSpace: 'nowrap' }}>
                    Customer Type:
                  </Typography>
                  <Autocomplete
                    size="small"
                    sx={{ minWidth: 450 }}
                    options={customerTypes || []}
                    getOptionLabel={(option) => option.cus_type_title || ''}
                    value={selectedCustomerTypeFilter}
                    onChange={(event, newValue) => {
                      setSelectedCustomerTypeFilter(newValue);
                      if (newValue) {
                        const typeTitle = (newValue.cus_type_title || '').toLowerCase();
                        if (typeTitle.includes('walk')) {
                          const matchingCustomer = customers.find(c =>
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
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                        e.preventDefault();
                        setTimeout(() => {
                          const customerInput = document.getElementById('customer-search-dropdown-input');
                          if (customerInput) {
                            customerInput.focus();
                          }
                        }, 50);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="All Customer Types"
                        variant="outlined"
                        sx={{
                          bgcolor: 'white',
                          minWidth: 450,
                          '& .MuiInputBase-input': {
                            fontWeight: 'bold',
                            color: 'black'
                          }
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Right Side: Load Order Components */}
                {billType !== 'SALE_RETURN' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary', whiteSpace: 'nowrap' }}>
                      Load Order:
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="Enter Order Number (e.g. 123)"
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      sx={{ width: 250, bgcolor: 'white' }}
                      InputProps={{
                        endAdornment: (
                          <SearchIcon color="action" fontSize="small" />
                        ),
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchOrder();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSearchOrder}
                      disabled={isSearchingOrder || !orderSearchTerm}
                      sx={{ bgcolor: '#1976d2', color: 'white', '&:hover': { bgcolor: '#1565c0' } }}
                    >
                      {isSearchingOrder ? <CircularProgress size={20} color="inherit" /> : 'Load'}
                    </Button>
                  </Box>
                ) : <Box />}
              </Box>

              {/* First Row - Date, Customer, Reference */}
              <Grid container spacing={2} sx={{ mb: 2, alignItems: 'flex-end' }}>
                <Grid item xs={12} md={billType === 'SALE_RETURN' ? 4 : 6}>
                  <Box sx={{ position: 'relative' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                        CUSTOMER
                      </Typography>
                      {formSelectedCustomer && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            component="span"
                            sx={{
                              bgcolor: '#bbf7d0',
                              color: '#14532d',
                              border: '1px solid #22c55e',
                              px: 2,
                              py: 0.75,
                              borderRadius: 1.5,
                              fontSize: '0.95rem',
                              fontWeight: 900,
                              lineHeight: 1.3,
                              letterSpacing: '0.02em',
                              display: 'inline-block',
                              boxShadow: '0 1px 2px rgba(22, 163, 74, 0.15)',
                            }}
                          >
                            Balance:{' '}
                            <Box component="span" sx={{ fontSize: '1.05rem', fontWeight: 900 }}>
                              {parseFloat(formSelectedCustomer.cus_balance || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                            </Box>
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ListAltIcon />}
                            onClick={handleOpenLedger}
                            sx={{
                              py: 0.5,
                              fontSize: '0.75rem',
                              color: 'secondary.main',
                              borderColor: 'secondary.main',
                              '&:hover': {
                                borderColor: 'secondary.dark',
                                bgcolor: 'secondary.light',
                                color: 'white'
                              }
                            }}
                          >
                            View Ledger
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleOpenEditCustomer}
                            sx={{
                              py: 0.5,
                              fontSize: '0.75rem',
                              color: 'warning.main',
                              borderColor: 'warning.main',
                              '&:hover': {
                                borderColor: 'warning.dark',
                                bgcolor: 'warning.light',
                                color: 'white'
                              }
                            }}
                          >
                            Edit
                          </Button>
                        </Stack>
                      )}
                    </Box>
                    <Autocomplete
                      fullWidth
                      size="small"
                      sx={{ 
                        minWidth: 450,
                        '& .MuiAutocomplete-popupIndicator': { color: 'white' },
                        '& .MuiAutocomplete-clearIndicator': { color: 'white' }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) {
                          e.preventDefault();
                          if (billType === 'SALE_RETURN') {
                            const invoiceInput = document.querySelector('input[placeholder*="Search Sale ID"]');
                            if (invoiceInput) invoiceInput.focus();
                          } else {
                            const productInput = document.getElementById('product-select-dropdown-input');
                            if (productInput) {
                              productInput.focus();
                            } else {
                              const fallbackInput = document.querySelector('input[placeholder*="Select product"]');
                              if (fallbackInput) fallbackInput.focus();
                            }
                          }
                        }
                      }}
                      options={customers.filter(customer => {
                        // Filter by Category: Customer
                        // User requested: "customer catagory customer type any"
                        const category = customerCategories.find(c => c.cus_cat_id === customer.cus_category);
                        const isCustomer = category && category.cus_cat_title.toLowerCase().includes('customer');
                        if (!isCustomer) return false;
                        
                        // Filter by Customer Type if selected
                        if (selectedCustomerTypeFilter) {
                          return customer.cus_type === selectedCustomerTypeFilter.cus_type_id;
                        }
                        return true;
                      })}
                      getOptionLabel={(option) => option.cus_name || ''}
                      ListboxProps={{ sx: { maxHeight: 180 } }}
                      filterOptions={(options, { inputValue }) => {
                        const q = inputValue.toLowerCase().trim();
                        if (!q) return options;
                        return options.filter(o =>
                          (o.cus_name || '').toLowerCase().includes(q) ||
                          (o.cus_phone_no || '').toLowerCase().includes(q) ||
                          (o.cus_phone_no2 || '').toLowerCase().includes(q) ||
                          (o.cus_address || '').toLowerCase().includes(q) ||
                          (o.cus_reference || '').toLowerCase().includes(q) ||
                          (o.city?.city_name || '').toLowerCase().includes(q)
                        );
                      }}
                      value={formSelectedCustomer}
                      onChange={(event, newValue) => {
                        setFormSelectedCustomer(newValue);
                        if (billType === 'SALE_RETURN') {
                          setSaleSearchResults([]);
                          setSelectedSaleForReturnMain(null);
                        }
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderOption={(props, option) => {
                        const { key, ...optionProps } = props;
                        return (
                          <Box component="li" key={option.cus_id} {...optionProps}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                              <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>{option.cus_name}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }} color="text.secondary">
                                {[option.cus_phone_no, option.cus_address, option.city?.city_name, option.cus_reference].filter(Boolean).join(' • ')}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          id="customer-search-dropdown-input"
                          fullWidth
                          placeholder="Search by name, phone, address, city, reference"
                          onFocus={(e) => e.target.select()}
                          sx={{
                            bgcolor: '#2e7d32',
                            minWidth: 450,
                            borderRadius: 1,
                            '& .MuiOutlinedInput-root': {
                              fontSize: '1.1rem',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '& fieldset': {
                                borderColor: '#1b5e20',
                                borderWidth: '2px'
                              },
                              '&:hover fieldset': {
                                borderColor: '#1b5e20'
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#1b5e20'
                              }
                            },
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '&::placeholder': {
                                color: 'rgba(255, 255, 255, 0.7) !important',
                                WebkitTextFillColor: 'rgba(255, 255, 255, 0.7) !important',
                                opacity: 1
                              }
                            }
                          }}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* Return Invoice Selection (Only for Sale Return) */}
                {billType === 'SALE_RETURN' && (
                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                        SELECT INVOICE
                      </Typography>
                      <Autocomplete
                        open={saleSearchOpen}
                        onOpen={() => {
                          setSaleSearchOpen(true);
                          // Always search when opening, either scoped to customer or all
                          if (formSelectedCustomer) {
                            const customerSales = sales.filter(s => s.cus_id === formSelectedCustomer.cus_id);
                            setSaleSearchResults(customerSales);
                          } else {
                            // Show latest sales if no customer selected
                            setSaleSearchResults(sales.slice(0, 50)); // Limit to prevent lag
                          }
                        }}
                        onClose={() => setSaleSearchOpen(false)}
                        options={saleSearchResults}
                        getOptionLabel={(option) => {
                          // Helper to find customer name
                          const cName = option.customer?.cus_name || (customers.find(c => c.cus_id === option.cus_id)?.cus_name) || 'Unknown';
                          return `#${option.sale_id} - ${cName} - ${option.reference || 'No Ref'} (${parseFloat(option.total_amount).toFixed(0)})`;
                        }}
                        value={selectedSaleForReturnMain}
                        onChange={(event, newValue) => {
                          if (newValue) handleLoadSaleForReturnMain(newValue);
                        }}
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        onInputChange={(event, inputValue) => {
                          if (!formSelectedCustomer) {
                            // Search across all sales if no customer selected
                            if (!inputValue) {
                              setSaleSearchResults(sales.slice(0, 50));
                              return;
                            }
                            const searchLower = inputValue.toLowerCase();
                            const results = sales.filter(sale =>
                              sale.sale_id?.toString().includes(searchLower) ||
                              sale.invoice_number?.toLowerCase().includes(searchLower) ||
                              sale.reference?.toLowerCase().includes(searchLower)
                            ).slice(0, 50);
                            setSaleSearchResults(results);
                          } else {
                            handleSaleSearch(inputValue);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            placeholder="Search Sale ID..."
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && selectedSaleForReturnMain) {
                                e.preventDefault();
                                const productInput = document.querySelector('input[placeholder*="Select product"]');
                                if (productInput) productInput.focus();
                              }
                            }}
                            sx={{ bgcolor: 'white', minWidth: 250 }}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                        noOptionsText="No sales found"
                      />
                    </Box>
                  </Grid>
                )}


                <Grid item xs={12} md={billType === 'SALE_RETURN' ? 2 : 3}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      DATE:
                    </Typography>
                    <TextField
                      fullWidth
                      type="date"
                      size="small"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      onFocus={(e) => e.target.select()}
                      sx={{ bgcolor: 'white' }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={billType === 'SALE_RETURN' ? 3 : 3}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      REFERENCE
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      sx={{ bgcolor: 'white' }}
                      value={paymentData.notes || ''}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                    />
                  </Box>
                </Grid>
              </Grid>


              {/* Product Selection Row */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      SELECT PRODUCT
                    </Typography>
                    <Autocomplete
                      size="small"
                      sx={{ minWidth: 450 }}
                      options={products || []}
                      getOptionLabel={(option) => option.pro_title || ''}
                      ListboxProps={{ sx: { maxHeight: 130 } }}
                      filterOptions={(options, { inputValue }) => {
                        const q = inputValue.toLowerCase().trim();
                        if (!q) return options;
                        return options.filter(o =>
                          (o.pro_title || '').toLowerCase().includes(q) ||
                          (o.pro_code || '').toLowerCase().includes(q)
                        );
                      }}
                      renderOption={(props, option) => {
                        const { key, ...optionProps } = props;
                        return (
                        <li key={option.pro_id} {...optionProps} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 500 }}>{option.pro_title}</Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {visibleCrates.includes(option.pro_id) && (
                              <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
                                {option.pro_cost_price ? 'PKR ' + fmtRateQty(option.pro_cost_price) : 'N/A'}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && formSelectedProduct) {
                          e.preventDefault();
                          // Move focus to Store selection
                          const storeInput = document.querySelector('input[placeholder*="Select Store"]');
                          if (storeInput) storeInput.focus();
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          id="product-select-dropdown-input"
                          placeholder={products.length === 0 ? "No products available" : "Select product"}
                          onFocus={(e) => e.target.select()}
                          sx={{ bgcolor: 'white', width: 450, minWidth: 450, '& .MuiInputBase-input': { fontWeight: formSelectedProduct ? 'bold' : 'normal' } }}
                        />
                      )}
                      disabled={products.length === 0}
                    />
                    {/* Debug info */}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Debug: {products.length} products available
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={1.5}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      SELECT STORE
                    </Typography>
                    <Autocomplete
                      size="small"
                      options={stores || []}
                      getOptionLabel={(option) => option.store_name || ''}
                      value={formSelectedStore}
                      onChange={(event, newValue) => {
                        setFormSelectedStore(newValue);
                      }}
                      isOptionEqualToValue={(option, value) => option.storeid === value?.storeid}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && formSelectedStore) {
                          e.preventDefault();
                          // Move focus to QTY field
                          const qtyInput = document.querySelector('input[type="number"][value=""], input[type="number"]:not([disabled])');
                          // Actually let's find it more accurately
                          const allNumInputs = document.querySelectorAll('input[type="number"]');
                          // QTY is typically the first or second numeric input in the product row
                          if (allNumInputs.length > 0) {
                            allNumInputs[0].focus();
                          }
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Store"
                          onFocus={(e) => e.target.select()}
                          sx={{ bgcolor: 'white', '& .MuiInputBase-input': { fontWeight: formSelectedStore ? 'bold' : 'normal' } }}
                        />
                      )}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={1.2}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      QTY
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={paymentInputValue(productFormData.quantity)}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // If rate is already filled, add product directly
                          if (productFormData.rate > 0) {
                            handleAddProductToTable();
                          } else {
                            // Focus on rate field if rate is not filled
                            const rateInput = document.getElementById('sale-rate-input');
                            if (rateInput) rateInput.focus();
                          }
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          // Move to RATE field
                          const rateInput = document.getElementById('sale-rate-input');
                          if (rateInput) rateInput.focus();
                        }
                      }}
                      sx={{
                        bgcolor: 'white',
                        width: 130,
                        minWidth: 130,
                        '& .MuiInputBase-input': {
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        }
                      }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={1.5}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      SALE RATE:
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={paymentInputValue(productFormData.rate)}
                      onChange={(e) => handleRateChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      id="sale-rate-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // Add product to table when Enter is pressed in rate field
                          handleAddProductToTable();
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          // Tab should focus the + button
                          const addBtn = document.getElementById('add-product-btn');
                          if (addBtn) {
                            addBtn.focus();
                          }
                        }
                      }}
                      sx={{
                        bgcolor: 'white',
                        width: 150,
                        minWidth: 150,
                        '& .MuiInputBase-input': {
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        }
                      }}
                    />
                  </Box>
                </Grid>


                <Grid item xs={12} md={1.5}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      AMOUNT:
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={productFormData.amount ?? ''}
                      sx={{ bgcolor: 'white', width: 150, minWidth: 150 }}
                      disabled
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={1.5}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      STOCK
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={productFormData.stock ?? ''}
                      disabled
                      sx={{ bgcolor: '#f8f9fa', width: 150, minWidth: 150 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={0.3}>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      id="add-product-btn"
                      onClick={handleAddProductToTable}
                      fullWidth
                      sx={{
                        bgcolor: '#6f42c1',
                        color: 'white',
                        borderRadius: 2,
                        minHeight: 40,
                        '&:hover': { bgcolor: '#5a2d91' }
                      }}
                    >
                      +
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              {/* Product Table */}
              <TableContainer component={Paper} sx={{ mb: 2, border: '1px solid #e9ecef' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#2e7d32', '& th': { bgcolor: '#2e7d32 !important' } }}>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>S. No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Sale Price</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Move</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productTableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No products added yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productTableData.map((product, index) => {
                        const rowColors = [
                          '#e8f4fd', // light blue
                          '#e8f8f0', // light green
                          '#f3e8fd', // light purple
                          '#fef9e7', // light yellow
                          '#fdecea', // light red
                          '#e8f6fd', // light cyan
                        ];
                        const rowBg = rowColors[index % rowColors.length];
                        return (
                        <TableRow
                          key={product.id}
                          sx={{
                            bgcolor: rowBg,
                            '&:hover': { filter: 'brightness(0.96)' },
                            transition: 'background-color 0.15s'
                          }}
                        >
                          <TableCell sx={{ py: 1, fontWeight: 'bold', color: 'text.secondary', fontSize: '0.8rem' }}>{index + 1}</TableCell>
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
                          <TableCell sx={{ py: 1, fontWeight: 700 }}>{product.pro_title}</TableCell>
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
                                        amount: Number((newQuantity * p.rate).toFixed(0))
                                      }
                                      : p
                                  );
                                  setProductTableData(updatedData);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              sx={{
                                width: 80,
                                '& .MuiInputBase-input': {
                                  padding: '4px 8px',
                                  textAlign: 'center',
                                  fontWeight: 'bold'
                                }
                              }}
                              inputProps={{ min: 0.01, step: 'any' }}
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
                                        amount: Number((p.quantity * newRate).toFixed(0))
                                      }
                                      : p
                                  );
                                  setProductTableData(updatedData);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              sx={{
                                width: 100,
                                '& .MuiInputBase-input': {
                                  padding: '4px 8px',
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  color: (() => {
                                    const mp = products.find(p => p.pro_id === product.pro_id);
                                    const cp = getProductCostPrice(mp);
                                    return (cp > 0 && parseFloat(product.rate) < cp) ? '#dc2626' : 'inherit';
                                  })()
                                },
                                '& .MuiOutlinedInput-root': {
                                  '& fieldset': {
                                    borderColor: (() => {
                                      const mp = products.find(p => p.pro_id === product.pro_id);
                                      const cp = getProductCostPrice(mp);
                                      return (cp > 0 && parseFloat(product.rate) < cp) ? '#dc2626' : undefined;
                                    })(),
                                    borderWidth: (() => {
                                      const mp = products.find(p => p.pro_id === product.pro_id);
                                      const cp = getProductCostPrice(mp);
                                      return (cp > 0 && parseFloat(product.rate) < cp) ? 2 : undefined;
                                    })()
                                  }
                                }
                              }}
                              inputProps={{ min: 0, step: 'any' }}
                            />
                            {(() => {
                              const mp = products.find(p => p.pro_id === product.pro_id);
                              const cp = getProductCostPrice(mp);
                              return (cp > 0 && parseFloat(product.rate) < cp) ? (
                                <Typography variant="caption" sx={{ color: '#dc2626', display: 'block', mt: 0.25, fontWeight: 600 }}>
                                  ⚠️ Below cost ({cp})
                                </Typography>
                              ) : null;
                            })()}
                          </TableCell>
                          <TableCell sx={{ py: 1, fontWeight: 'bold' }}>{parseFloat(product.amount || 0).toFixed(0)}</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                              <Tooltip title="Move up">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={index === 0}
                                    onClick={() => moveProductRow(index, -1)}
                                    sx={{ p: 0.25, color: 'primary.main', '&:disabled': { opacity: 0.3 } }}
                                  >
                                    <ArrowUpIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Move down">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={index === productTableData.length - 1}
                                    onClick={() => moveProductRow(index, 1)}
                                    sx={{ p: 0.25, color: 'primary.main', '&:disabled': { opacity: 0.3 } }}
                                  >
                                    <ArrowDownIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveProductFromTable(product.id)}
                              sx={{ color: 'error.main' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                    {productTableData.length > 0 && (
                      <TableRow sx={{ bgcolor: '#2e7d32', borderTop: '2px solid #dee2e6', '& td': { bgcolor: '#2e7d32 !important' } }}>
                        <TableCell colSpan={6} sx={{ py: 2, fontWeight: 'bold', textAlign: 'right', color: 'white' }}>
                          Total Amount:
                        </TableCell>
                        <TableCell colSpan={2} sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }} key={`table-total-${calculateTotalAmount()}-${transportOptions.length}`}>
                          {Number(calculateTotalAmount()).toFixed(0)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Transport Section */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.primary' }}>
                  Transport Options
                </Typography>

                {/* Transport Input Fields */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      size="small"
                      options={transportAccounts || []}
                      getOptionLabel={(option) => formatTransportAccountLabel(option)}
                      value={transportAccounts.find(account => account.cus_id === newTransport.accountId) || null}
                      onChange={(event, newValue) => {
                        setNewTransport((prev) => ({
                          ...prev,
                          accountId: newValue ? newValue.cus_id : '',
                          accountName: newValue ? formatTransportAccountLabel(newValue) : '',
                        }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Transport Account"
                          onFocus={(e) => e.target.select()}
                          sx={{ minWidth: 300, bgcolor: 'white' }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ mt: 1 }}>
                      <Button
                        variant="contained"
                        onClick={handleAddTransport}
                        sx={{
                          bgcolor: '#6f42c1',
                          color: 'white',
                          minWidth: 40,
                          '&:hover': { bgcolor: '#5a2d91' }
                        }}
                      >
                        +
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {/* Transport Options Display */}
                {transportOptions.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      Transport Options ({transportOptions.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {transportOptions.map((transport) => (
                        <Chip
                          key={transport.id}
                          label={`${transport.accountName}: ${transport.amount.toFixed(0)}`}
                          onDelete={() => handleRemoveTransport(transport.id)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                      Transport Total: {calculateTransportTotal().toFixed(0)}
                    </Typography>
                  </Box>
                )}
              </Box>

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
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            CASH
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Bal: {fmtAmt(customers.find(c => c.cus_name === 'Cash Account')?.cus_balance ?? 0)}
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.cash)}
                          onChange={(e) => handlePaymentDataChange('cash', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          sx={{
                            bgcolor: '#2e7d32',
                            borderRadius: 1,
                            '& .MuiOutlinedInput-root': {
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '& fieldset': {
                                borderColor: '#1b5e20',
                                borderWidth: '2px'
                              },
                              '&:hover fieldset': {
                                borderColor: '#1b5e20'
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#1b5e20'
                              }
                            },
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: 'rgba(255, 255, 255, 0.7) !important',
                              WebkitTextFillColor: 'rgba(255, 255, 255, 0.7) !important',
                              fontWeight: 'bold',
                              opacity: 1
                            }
                          }}
                          placeholder="0"
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
                          value={paymentInputValue(paymentData.bank)}
                          onChange={(e) => handlePaymentDataChange('bank', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              // Only intercept Tab and move focus to BANK ACCOUNT when a bank amount is present
                              if (parseFloat(paymentData.bank || 0) > 0) {
                                e.preventDefault();
                                setTimeout(() => {
                                  const bankAccountInput = document.querySelector('input[placeholder="Select Bank"]');
                                  if (bankAccountInput) {
                                    bankAccountInput.focus();
                                  }
                                }, 0);
                              }
                            }
                          }}
                          sx={{
                            bgcolor: 'white',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important',
                              fontWeight: 'bold',
                              opacity: 1
                            }
                          }}
                          placeholder="0"
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            BANK ACCOUNT
                          </Typography>
                          {paymentData.bankAccountId && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Bal: {fmtAmt(bankAccounts.find(a => a.cus_id === paymentData.bankAccountId)?.cus_balance ?? 0)}
                            </Typography>
                          )}
                        </Box>
                        <Autocomplete
                          size="small"
                          options={bankAccounts || []}
                          getOptionLabel={(option) => option.cus_name || ''}
                          value={bankAccounts.find(account => account.cus_id === paymentData.bankAccountId) || null}
                          onChange={(event, newValue) => {
                            handlePaymentDataChange('bankAccountId', newValue ? newValue.cus_id : '');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              // Auto-select first bank account on Tab
                              if (bankAccounts.length > 0 && !paymentData.bankAccountId) {
                                handlePaymentDataChange('bankAccountId', bankAccounts[0].cus_id);
                              }
                              // Close dropdown, blur field, and allow natural tab to next element
                              setTimeout(() => {
                                const inputField = document.querySelector('input[placeholder="Select Bank"]');
                                if (inputField) {
                                  inputField.blur();
                                }
                              }, 0);
                            }
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Bank"
                              onFocus={(e) => e.target.select()}
                              sx={{
                                bgcolor: 'white',
                                '& .MuiInputBase-input': {
                                  padding: '8px',
                                  fontWeight: 'bold',
                                  color: '#000000',
                                  WebkitTextFillColor: '#000000 !important'
                                }
                              }}
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
                          value={Number(paymentData.totalCashReceived).toFixed(0)}
                          sx={{
                            bgcolor: '#f5f5f5',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important'
                            }
                          }}
                          disabled
                        />
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Fourth Row - NOTES */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      NOTES
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      value={paymentData.notes ?? ''}
                      onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        }
                      }}
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
                  {/* PREVIOUS BALANCE & BILL ADVANCE - Show customer's balance and advance side-by-side */}
                  {formSelectedCustomer && (
                    <Box sx={{ mb: 1.5, display: 'flex', gap: 2, width: '100%' }}>
                      {/* PREV. BALANCE (readonly, warning orange color theme) */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'warning.main', minWidth: '105px' }}>
                          PREV. BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={parseFloat(formSelectedCustomer?.cus_balance || 0).toFixed(0)}
                          inputProps={{ readOnly: true }}
                          sx={{
                            bgcolor: '#fffbeb',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#c2410c !important',
                              WebkitTextFillColor: '#c2410c !important'
                            },
                            flex: 1
                          }}
                          placeholder="0"
                        />
                      </Box>

                      {/* BILL ADVANCE (editable, success green color theme) */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.main', minWidth: '95px' }}>
                          BILL ADVANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.advancePayment)}
                          onChange={(e) => handlePaymentDataChange('advancePayment', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          sx={{
                            bgcolor: '#e8f5e9',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#1b5e20 !important',
                              WebkitTextFillColor: '#1b5e20 !important'
                            },
                            flex: 1
                          }}
                          placeholder="0"
                        />
                      </Box>
                    </Box>
                  )}

                  {/* SUB TOTAL (Product Total Only) - Show for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        SUB TOTAL
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={(() => {
                          const productTotal = productTableData.reduce((sum, product) => sum + parseFloat(product.amount || 0), 0);
                          return productTotal.toFixed(0);
                        })()}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        disabled
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}

                  {/* TOTAL AMOUNT (After Advance Deduction) - Hidden for Sale Return */}
                  {billType !== 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        TOTAL AMOUNT
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={calculateTotalAmount().toFixed(0)}
                        onChange={() => {}}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}

                  {/* LABOUR */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      LABOUR
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.labour)}
                      onChange={(e) => handlePaymentDataChange('labour', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                  </Box>

                  {/* DELIVERY CHARGES (total including transport) */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DELIVERY CHARGES
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.deliveryCharges)}
                      onChange={(e) => handlePaymentDataChange('deliveryCharges', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                    {calculateTransportTotal() > 0 && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        (includes Transport: {calculateTransportTotal().toFixed(0)})
                      </Typography>
                    )}
                  </Box>

                  {/* DISCOUNT */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DISCOUNT
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.discount)}
                      onChange={(e) => handlePaymentDataChange('discount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                  </Box>

                  {/* GRAND TOTAL - Show for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        GRAND TOTAL
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={calculateGrandTotal().toFixed(0)}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        disabled
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}



                  {/* RETURN PAYMENT - CASH and BANK (Hidden) for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 2 }}>
                      {/* RETURN (CASH) - Hidden */}
                      <Box sx={{ display: 'none' }}>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.cash)}
                          onChange={(e) => handlePaymentDataChange('cash', e.target.value)}
                          placeholder="0"
                        />
                      </Box>

                      {/* RETURN (BANK) - Hidden */}
                      <Box sx={{ display: 'none' }}>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.bank)}
                          onChange={(e) => handlePaymentDataChange('bank', e.target.value)}
                          placeholder="0"
                        />
                      </Box>

                      {/* TOTAL RETURN (CASH + BANK) - Visible */}
                      <Box sx={{
                        p: 1.5,
                        bgcolor: 'error.light',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        border: '2px solid',
                        borderColor: 'error.main'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main', minWidth: '140px' }}>
                          TOTAL RETURN
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={(() => {
                            const cashReturn = parseFloat(paymentData.cash || 0);
                            const bankReturn = parseFloat(paymentData.bank || 0);
                            const totalReturn = cashReturn + bankReturn;
                            return totalReturn === 0 ? '' : totalReturn.toFixed(0);
                          })()}
                          sx={{
                            bgcolor: 'white',
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important',
                              fontWeight: 'bold',
                              opacity: 1
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* BALANCE - Hidden for Sale Return */}
                  {billType !== 'SALE_RETURN' && (
                    <Box sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: 'primary.main',
                      borderRadius: 1,
                      display: 'flex',
                      gap: 2,
                      width: '100%',
                      alignItems: 'center'
                    }}>
                      {/* BILL BALANCE */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', minWidth: '105px' }}>
                          BILL BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={calculateBalance().toFixed(0)}
                          sx={{
                            bgcolor: 'white',
                            borderRadius: 1,
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>

                      {/* TOTAL BALANCE */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', minWidth: '115px' }}>
                          TOTAL BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={(
                            parseFloat(formSelectedCustomer?.cus_balance || 0) + calculateBalance()
                          ).toFixed(0)}
                          sx={{
                            bgcolor: 'white',
                            borderRadius: 1,
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>


              {/* Action Buttons */}
              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  sx={{
                    color: '#ff9800',
                    borderColor: '#ff9800',
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: 'rgba(255, 152, 0, 0.04)',
                      borderColor: '#f57c00'
                    }
                  }}
                  onClick={async () => {
                    await autoHoldIfActive();
                    clearFormState();
                  }}
                  disabled={loading || savingBill}
                  title="Clear current form only (screen stays in stack)"
                >
                  🧹 Clear Form
                </Button>
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
                  onClick={async () => {
                    await autoHoldIfActive();
                    setCurrentBillData(null);
                    setFormSelectedCustomer(null);
                    setFormSelectedProduct(null);
                    setFormSelectedStore(null);
                    setProductTableData([]);
                    setPaymentData({ ...EMPTY_PAYMENT_DATA });
                    setTransportOptions([]);
                    setLoadedOrderId(null);
                    setCurrentDraftId(null);
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
                  Print A4
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
                    '&:hover': { bgcolor: '#c82333' },
                    opacity: screenStack.length === 1 ? 0.6 : 1
                  }}
                  tabIndex={-1}
                  onClick={cancelCurrentScreen}
                  disabled={screenStack.length === 1}
                  title={screenStack.length === 1 ? 'Reset current screen (cannot cancel - this is the only screen)' : 'Remove current screen from stack'}
                >
                  ✕ Cancel Current
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#6c757d',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#5a6268' }
                  }}
                  tabIndex={-1}
                  onClick={() => setCurrentView('list')}
                  title="Return to sales list (current screen saved)"
                >
                  ← Back to List
                </Button>
                <Button
                  variant="contained"
                  tabIndex={-1}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#e8690a' }
                  }}
                  onClick={async () => {
                    await handleSaveDraft();
                    clearFormState();
                  }}
                  disabled={isSavingDraft || productTableData.length === 0}
                  title="Hold bill (F9)"
                >
                  {isSavingDraft ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : '⏸'} Hold
                </Button>
                <Button
                  variant="outlined"
                  tabIndex={-1}
                  sx={{
                    borderColor: '#fd7e14',
                    color: '#fd7e14',
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#fff3e0', borderColor: '#e8690a' }
                  }}
                  onClick={() => { fetchDrafts(); setDraftModalOpen(true); }}
                  title="View held bills"
                >
                  📋 Held Bills {drafts.length > 0 && `(${drafts.length})`}
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<SaveIcon />}
                  sx={{
                    background: 'linear-gradient(135deg,#2ecc71 0%,#28a745 50%,#1e7e34 100%)',
                    color: 'white',
                    borderRadius: 3,
                    minWidth: 220,
                    boxShadow: '0 6px 18px rgba(40,167,69,0.18)',
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(40,167,69,0.22)' }
                  }}
                  onClick={() => handleSaveBill(false)}
                  disabled={savingBill}
                >
                  {savingBill ? (
                    <>
                      <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                      {saveStatusMessage || (editingSale ? 'Updating...' : 'Saving...')}
                    </>
                  ) : (
                    editingSale ? 'Update Sale' : 'Save Sale'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Stack>

        {/* Printable Bill Content - Hidden but accessible for printing */}
        {
          currentBillData && (
            <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '21cm', overflow: 'hidden' }}>
              {/* A4 Printable Container */}
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
                    {currentBillData?.is_return ? 'SALE RETURN INVOICE' : 'SALE INVOICE'}
                  </Typography>
                </Box>

                {/* Customer and Invoice Details */}
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                        {currentBillData.customer ? `${currentBillData.customer.cus_name}${currentBillData.customer.name_urdu ? ' ' + currentBillData.customer.name_urdu : ''}` : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {currentBillData.customer?.cus_phone_no || 'N/A'}
                      </Typography>
                    </Box>
                    {currentBillData.customer?.cus_address && (
                      <Box sx={{ display: 'flex' }}>
                        <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {currentBillData.customer.cus_address}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {getBillDisplayNo(currentBillData)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>
                        {currentBillData?.is_return ? 'Return ID:' : 'Sale ID:'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {currentBillData?.is_return ? currentBillData.return_id : currentBillData.sale_id}
                      </Typography>
                    </Box>
                    {currentBillData?.is_return && currentBillData.sale_id && (
                      <Box sx={{ display: 'flex', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Sale ID:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {currentBillData.sale_id}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatDatePK(currentBillData?.created_at) || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatTimePK(currentBillData?.created_at) || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {getCreatedByName(currentBillData, currentUser)}
                      </Typography>
                    </Box>
                    {currentBillData.reference && (
                      <Box sx={{ display: 'flex' }}>
                        <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Reference:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {currentBillData.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Product Table */}
                <Box sx={{ px: 3, py: 2 }}>
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
                        {currentBillData.sale_details && currentBillData.sale_details.length > 0 ? (
                          getSaleDetailsInAddOrder(currentBillData.sale_details).map((detail, index) => (
                            <TableRow key={detail.sale_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtRateQty(detail.qnty)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{fmtRateQty(detail.unit_rate)}</TableCell>
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

                  {/* Payment Summary */}
                  <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ flex: '0 0 48%' }}>
                      {!isWalkinCustomer(currentBillData.customer) && (
                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(currentBillData.customer?.cus_balance)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                                </TableCell>
                              </TableRow>
                              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقايا</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(parseFloat(currentBillData.customer?.cus_balance || 0) + parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                      {(currentBillData.notes || currentBillData.reference) && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            <strong>Notes:</strong> {currentBillData.notes || currentBillData.reference}
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
                                {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) - parseFloat(currentBillData.shipping_amount || 0) + parseFloat(currentBillData.discount || 0))}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(currentBillData.labour_charges || currentBillData.labour)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(currentBillData.shipping_amount)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رعایت</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(currentBillData.discount)}
                              </TableCell>
                            </TableRow>
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
          )
        }

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
          <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              {currentBillData?.is_return ? 'Sale Return Invoice' : 'Receipt'} - {getBillDisplayNo(currentBillData)}
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
              <>
                {/* Off-screen: WhatsApp image = receipt-style summary (no product line list) */}
                <Box
                  id="receipt-whatsapp-capture"
                  aria-hidden
                  sx={{
                    // Kept off-screen; capture uses clone to document.body in handleSendWhatsApp.
                    position: 'fixed',
                    left: '-10000px',
                    top: 0,
                    width: '80mm',
                    minWidth: 302,
                    maxWidth: 360,
                    bgcolor: '#ffffff',
                    p: 1.25,
                    fontFamily: 'Arial, sans-serif',
                    boxSizing: 'border-box',
                    color: '#000',
                    fontWeight: 'bold',
                    '& *': { fontWeight: 'bold !important', color: '#000 !important' }
                  }}
                >
                  <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid #000' }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>اتفاق آئرن اینڈ سیمنٹ سٹور</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>گجرات سرگودھا روڈ، پاہڑیانوالی</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Ph: 0346-7560306, 0300-7560306</Typography>
                    <Typography
                      sx={{
                        mt: 0.5,
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: currentBillData?.is_return ? '#c62828' : '#000',
                      }}
                    >
                      {currentBillData?.is_return ? 'SALE RETURN' : 'SALE RECEIPT'}
                    </Typography>
                  </Box>
                  <Box sx={{ py: 1 }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Inv#: {getBillDisplayNo(currentBillData)}</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      {currentBillData?.is_return ? `Return ID: ${currentBillData.return_id}` : `Sale ID: ${currentBillData.sale_id}`}
                    </Typography>
                    {currentBillData?.is_return && currentBillData.sale_id && (
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Sale ID: {currentBillData.sale_id}</Typography>
                    )}
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Type: {currentBillData.bill_type || 'BILL'}</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      Date: {formatDatePK(currentBillData?.created_at) || '—'}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      Time:{' '}
                      {formatTimePK(currentBillData?.created_at) || '—'}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Cust: {currentBillData.customer?.cus_name || 'N/A'}</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      Created By: {getCreatedByName(currentBillData, currentUser)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      borderTop: '1px dashed #000',
                      borderBottom: '1px dashed #000',
                      py: 0.75,
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      {currentBillData?.is_return ? 'Return lines' : 'Line items'}:{' '}
                      {Array.isArray(currentBillData.sale_details) ? currentBillData.sale_details.length : 0}
                    </Typography>
                  </Box>
                  <Box sx={{ pt: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Subtotal</Typography>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                        {fmtAmt(
                          parseFloat(currentBillData.total_amount || 0) -
                            parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) -
                            parseFloat(currentBillData.shipping_amount || 0) +
                            parseFloat(currentBillData.discount || 0)
                        )}
                      </Typography>
                    </Box>
                    {parseFloat(currentBillData.discount || 0) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Discount</Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.discount)}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Shipping</Typography>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.shipping_amount)}</Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 'bold',
                        borderTop: '1px dashed #000',
                        mt: 0.5,
                        pt: 0.5,
                      }}
                    >
                      <Typography sx={{ fontSize: '11px', fontWeight: 'bold' }}>Grand Total</Typography>
                      <Typography sx={{ fontSize: '11px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.total_amount)}</Typography>
                    </Box>
                    {parseFloat(currentBillData.cash_payment || 0) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Cash Payment</Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.cash_payment)}</Typography>
                      </Box>
                    )}
                    {parseFloat(currentBillData.bank_payment || 0) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                          Bank ({currentBillData.bank_title || 'Bank'})
                        </Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.bank_payment)}</Typography>
                      </Box>
                    )}
                    {currentBillData.previous_balance !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Prev Balance</Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.previous_balance)}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Balance</Typography>
                      <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                        {fmtAmt(
                          parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0)
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'center', borderTop: '1px solid #000', mt: 1, pt: 1 }}>
                    <Typography sx={{ fontSize: '9px', fontWeight: 'bold' }}>Thank you for your business!</Typography>
                  </Box>
                </Box>

              <Box id="receipt-preview" className="thermal-receipt" sx={{ width: '100%', bgcolor: 'white', p: 3, color: '#000', fontWeight: 'bold', '& *': { fontWeight: 'bold !important', color: '#000 !important' } }}>
                {/* Company Header */}
                <Box sx={{ textAlign: 'center', py: 2, borderBottom: '2px solid #000' }}>
                  <Typography variant="h5" sx={{
                    fontWeight: 'bold',
                    mb: 1,
                    fontFamily: 'Arial, sans-serif',
                    direction: 'rtl'
                  }}>
                    اتفاق آئرن اینڈ سیمنٹ سٹور
                  </Typography>
                  <Typography variant="body2" sx={{
                    mb: 1,
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
                    mt: 1,
                    color: currentBillData?.is_return ? '#d32f2f' : '#000'
                  }}>
                    {currentBillData?.is_return ? 'SALE RETURN INVOICE' : 'SALE INVOICE'}
                  </Typography>
                </Box>

                {/* Customer and Invoice Details */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                        {currentBillData.customer ? `${currentBillData.customer.cus_name}${currentBillData.customer.name_urdu ? ' ' + currentBillData.customer.name_urdu : ''}` : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {currentBillData.customer?.cus_phone_no || 'N/A'}
                      </Typography>
                    </Box>
                    {currentBillData.customer?.cus_address && (
                      <Box sx={{ display: 'flex' }}>
                        <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {currentBillData.customer.cus_address}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {getBillDisplayNo(currentBillData)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatDatePK(currentBillData?.created_at) || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatTimePK(currentBillData?.created_at) || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {getCreatedByName(currentBillData, currentUser)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Product Table */}
                <Box sx={{ px: 2, py: 2 }}>
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
                        {currentBillData.sale_details && currentBillData.sale_details.length > 0 ? (
                          getSaleDetailsInAddOrder(currentBillData.sale_details).map((detail, index) => (
                            <TableRow key={detail.sale_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{detail.product?.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtRateQty(detail.qnty)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtRateQty(detail.unit_rate)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.total_amount)}</TableCell>
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
                      {!isWalkinCustomer(currentBillData?.customer) && (
                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                          <Table size="small">
                            <TableBody>
                              {currentBillData?.is_return ? (
                                (() => {
                                  const totalRefund = parseFloat(currentBillData.payment || 0);
                                  const prevBal = parseFloat(currentBillData.customer?.cus_balance ?? currentBillData.previous_customer_balance ?? 0);
                                  const productTotal = (currentBillData.sale_details || []).reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                                  const discount = parseFloat(currentBillData.discount || 0);
                                  const labour = parseFloat(currentBillData.labour_charges || currentBillData.labour || 0);
                                  const shipping = parseFloat(currentBillData.shipping_amount || 0);
                                  const netReturn = productTotal - discount - labour - shipping;
                                  const newBal = prevBal - netReturn + totalRefund;
                                  return (
                                    <>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>منسوخ کردہ رقم</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(productTotal)}</TableCell>
                                      </TableRow>
                                      {discount > 0 && (
                                        <TableRow>
                                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>رعایت</TableCell>
                                          <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>-{fmtAmt(discount)}</TableCell>
                                        </TableRow>
                                      )}
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>مزدوری</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>-{fmtAmt(labour)}</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>کرایہ</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>-{fmtAmt(shipping)}</TableCell>
                                      </TableRow>
                                      <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>کل منسوخی</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', color: '#2e7d32' }}>
                                          {fmtAmt(netReturn)}
                                        </TableCell>
                                      </TableRow>
                                      <TableRow sx={{ bgcolor: '#ffe0b2' }}>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>کل واپسی</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', color: '#e65100', fontSize: '1rem' }}>{fmtAmt(totalRefund)}</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(prevBal)}</TableCell>
                                      </TableRow>
                                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجودہ بقایا</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(newBal)}</TableCell>
                                      </TableRow>
                                    </>
                                  );
                                })()
                              ) : (
                                <>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(currentBillData.customer?.cus_balance)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقايا</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(parseFloat(currentBillData.customer?.cus_balance || 0) + parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                                    </TableCell>
                                  </TableRow>
                                </>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                      {(currentBillData.notes || currentBillData.reference) && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            <strong>تبصرے:</strong> {currentBillData.notes || currentBillData.reference}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                        <Table size="small">
                          <TableBody>
                            {currentBillData?.is_return ? (
                              // ── SALE RETURN right panel (Urdu) ──
                              (() => {
                                const productTotal = parseFloat(currentBillData.total_amount || 0);
                                const labour = parseFloat(currentBillData.labour_charges || 0);
                                const delivery = parseFloat(currentBillData.shipping_amount || 0);
                                const discount = parseFloat(currentBillData.discount || 0);
                                // netReturn = items - labour - delivery - discount
                                const netReturn = productTotal - labour - delivery - discount;
                                const cash = parseFloat(currentBillData.cash_refund || currentBillData.cash_payment || 0);
                                const bank = parseFloat(currentBillData.bank_refund || currentBillData.bank_payment || 0);
                                // remaining = net return not yet refunded
                                const remaining = netReturn - (cash + bank);
                                return (
                                  <>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(productTotal)}</TableCell>
                                    </TableRow>
                                    {labour > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>-{fmtAmt(labour)}</TableCell>
                                      </TableRow>
                                    )}
                                    {delivery > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>-{fmtAmt(delivery)}</TableCell>
                                      </TableRow>
                                    )}
                                    {discount > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رعایت</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>-{fmtAmt(discount)}</TableCell>
                                      </TableRow>
                                    )}
                                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کل واپسی رقم</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(netReturn)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>نقد</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(cash)}</TableCell>
                                    </TableRow>
                                    {bank > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{currentBillData.bank_title || 'بینک ادائیگی'}</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(bank)}</TableCell>
                                      </TableRow>
                                    )}
                                    <TableRow sx={{ bgcolor: remaining > 0 ? '#ffe0b2' : '#e8f5e9' }}>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>باقی واجب الادا</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: remaining > 0 ? '#e65100' : '#2e7d32' }}>{fmtAmt(remaining)}</TableCell>
                                    </TableRow>
                                  </>
                                );
                              })()
                            ) : (
                              // ── REGULAR SALE right panel ──
                              <>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>رقم بل</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) - parseFloat(currentBillData.shipping_amount || 0) + parseFloat(currentBillData.discount || 0))}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(currentBillData.labour_charges || currentBillData.labour)}
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
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>نقد كيش</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(currentBillData.cash_payment)}
                                  </TableCell>
                                </TableRow>
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
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Box>
                </Box>
              </Box>
              </>
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
              startIcon={isSendingWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
              sx={{
                minWidth: 150,
                bgcolor: '#25D366',
                '&:hover': { bgcolor: '#1ebe5d' },
                color: 'white'
              }}
              onClick={() => handleSendWhatsApp(currentBillData)}
              disabled={isSendingWhatsApp}
              title="Copy invoice to clipboard and open WhatsApp Desktop"
            >
              {isSendingWhatsApp ? 'Copying...' : '📲 WhatsApp'}
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
              Print A4
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
          </DialogActions>
        </Dialog>

        {/* Load Quotation Dialog */}
        <Dialog
          open={loadQuotationDialogOpen}
          onClose={() => setLoadQuotationDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(45deg, #ed6c02 30%, #ff9800 90%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ReceiptIcon sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                  Load Quotation
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Select a quotation to load into the bill
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setLoadQuotationDialogOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by customer name or quotation ID..."
                value={quotationSearchTerm}
                onChange={(e) => setQuotationSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Quotation ID</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales
                    .filter(sale => {
                      const isQuotation = sale.bill_type === 'QUOTATION';
                      if (!isQuotation) return false;

                      if (!quotationSearchTerm) return true;

                      const searchLower = quotationSearchTerm.toLowerCase();
                      const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                      const matchesId = sale.sale_id?.toString().includes(searchLower);

                      return matchesName || matchesId;
                    })
                    .map((sale) => (
                      <TableRow key={sale.sale_id} hover>
                        <TableCell>{getBillDisplayNo(sale)}</TableCell>
                        <TableCell>{sale.customer?.cus_name || 'N/A'}</TableCell>
                        <TableCell>{formatDatePK(sale?.created_at) || '—'}</TableCell>
                        <TableCell align="right">{parseFloat(sale.total_amount || 0).toFixed(0)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            onClick={() => handleLoadQuotation(sale)}
                            startIcon={<ShoppingCartIcon />}
                          >
                            Load
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {sales.filter(sale => {
                    const isQuotation = sale.bill_type === 'QUOTATION';
                    if (!isQuotation) return false;

                    if (!quotationSearchTerm) return true;

                    const searchLower = quotationSearchTerm.toLowerCase();
                    const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                    const matchesId = sale.sale_id?.toString().includes(searchLower);

                    return matchesName || matchesId;
                  }).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          {quotationSearchTerm ? 'No matching quotations found' : 'No quotations found'}
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLoadQuotationDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Draft Sales Modal */}
        <Dialog
          open={draftModalOpen}
          onClose={() => setDraftModalOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SaveIcon sx={{ mr: 2, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                  Draft Sales
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Load a saved draft or create a new one
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setDraftModalOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search drafts..."
                value={draftSearchTerm}
                onChange={(e) => setDraftSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {drafts.length === 0 ? (
              <Box sx={{
                textAlign: 'center',
                py: 4,
                color: 'text.secondary'
              }}>
                <SaveIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography>
                  No drafts available. Save your current form as a draft to get started!
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Draft Code</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drafts
                      .filter(draft => {
                        if (!draftSearchTerm) return true;
                        const searchLower = draftSearchTerm.toLowerCase();
                        return (
                          draft.draft_code?.toLowerCase().includes(searchLower) ||
                          draft.customer?.cus_name?.toLowerCase().includes(searchLower)
                        );
                      })
                      .map((draft) => (
                        <TableRow key={draft.draft_id} hover>
                          <TableCell sx={{ fontWeight: 'bold', color: '#f57c00' }}>
                            {draft.draft_code}
                          </TableCell>
                          <TableCell>
                            {draft.customer?.cus_name || 'No customer'}
                          </TableCell>
                          <TableCell>
                            {formatDateTimePK(draft.updated_at)}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Load this draft">
                              <IconButton
                                size="small"
                                onClick={() => handleLoadDraft(draft)}
                                sx={{ color: '#2196f3' }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete this draft">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteDraft(draft.draft_id, draft.draft_code)}
                                sx={{ color: '#f44336' }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Button onClick={() => setDraftModalOpen(false)}>Close</Button>
            {drafts.length > 0 && (
              <Button
                variant="text"
                sx={{ color: '#f57c00' }}
                onClick={() => {
                  setDrafts([]);
                  fetchDrafts();
                }}
              >
                Refresh
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout >
  );

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

  const renderSalesListView = () => (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Header - Just the Add Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', py: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCurrentView('create')}
              size="large"
              sx={{
                background: 'linear-gradient(45deg, #2e7d32 30%, #4caf50 90%)',
                boxShadow: '0 8px 30px rgba(46, 125, 50, 0.4)',
                px: 6,
                py: 2.5,
                fontSize: '1.3rem',
                fontWeight: 'bold',
                borderRadius: '16px',
                minWidth: '320px',
                minHeight: '70px',
                position: 'relative',
                overflow: 'hidden',
                border: '2px solid transparent',
                backgroundClip: 'padding-box',
                animation: 'float 3s ease-in-out infinite, glow 2s ease-in-out infinite alternate, heartbeat 1.5s ease-in-out infinite',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  transition: 'left 0.8s ease-in-out',
                  animation: 'shimmer 3s infinite',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '-2px',
                  left: '-2px',
                  right: '-2px',
                  bottom: '-2px',
                  background: 'linear-gradient(45deg, #1b5e20, #2e7d32, #4caf50, #66bb6a)',
                  borderRadius: '18px',
                  zIndex: -1,
                  opacity: 0,
                  transition: 'opacity 0.3s ease-in-out',
                  animation: 'borderPulse 2s ease-in-out infinite',
                },
                '& .particle': {
                  position: 'absolute',
                  width: '4px',
                  height: '4px',
                  background: '#4caf50',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  animation: 'particleFloat 3s ease-in-out infinite',
                },
                '& .particle:nth-of-type(1)': {
                  top: '10%',
                  left: '10%',
                  animationDelay: '0s',
                },
                '& .particle:nth-of-type(2)': {
                  top: '20%',
                  right: '15%',
                  animationDelay: '0.5s',
                },
                '& .particle:nth-of-type(3)': {
                  bottom: '15%',
                  left: '20%',
                  animationDelay: '1s',
                },
                '& .particle:nth-of-type(4)': {
                  bottom: '10%',
                  right: '10%',
                  animationDelay: '1.5s',
                },
                '&:hover::before': {
                  left: '100%',
                },
                '&:hover': {
                  background: 'linear-gradient(45deg, #1b5e20 30%, #2e7d32 90%)',
                  transform: 'scale(1.15) translateY(-4px) rotate(1deg)',
                  boxShadow: '0 20px 60px rgba(46, 125, 50, 0.8), 0 0 30px rgba(46, 125, 50, 0.6), 0 0 0 4px rgba(76, 175, 80, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                  animation: 'bounce 0.6s ease-in-out, rainbowGlow 1.5s ease-in-out infinite, blink 1s ease-in-out infinite, magnetic 0.3s ease-out',
                  border: '2px solid rgba(255,255,255,0.3)',
                  '&::after': {
                    opacity: 1,
                    animation: 'borderPulse 0.8s ease-in-out infinite',
                  },
                  '& .MuiButton-startIcon': {
                    animation: 'iconBounce 0.5s ease-in-out infinite, spin 2s linear infinite',
                  }
                },
                '&:active': {
                  transform: 'scale(1.1) translateY(-2px) rotate(0deg)',
                  boxShadow: '0 10px 30px rgba(46, 125, 50, 0.6)',
                  animation: 'press 0.2s ease-in-out',
                },
                '@keyframes float': {
                  '0%, 100%': {
                    transform: 'translateY(0px)',
                  },
                  '50%': {
                    transform: 'translateY(-5px)',
                  },
                },
                '@keyframes glow': {
                  '0%': {
                    boxShadow: '0 8px 30px rgba(46, 125, 50, 0.4)',
                  },
                  '100%': {
                    boxShadow: '0 8px 30px rgba(46, 125, 50, 0.6), 0 0 20px rgba(46, 125, 50, 0.3)',
                  },
                },
                '@keyframes shimmer': {
                  '0%': {
                    transform: 'translateX(-100%)',
                  },
                  '100%': {
                    transform: 'translateX(100%)',
                  },
                },
                '@keyframes bounce': {
                  '0%': {
                    transform: 'scale(1.15) translateY(-4px) rotate(1deg)',
                  },
                  '50%': {
                    transform: 'scale(1.2) translateY(-8px) rotate(-1deg)',
                  },
                  '100%': {
                    transform: 'scale(1.15) translateY(-4px) rotate(1deg)',
                  },
                },
                '@keyframes rainbowGlow': {
                  '0%': {
                    boxShadow: '0 20px 60px rgba(46, 125, 50, 0.8), 0 0 30px rgba(46, 125, 50, 0.6)',
                  },
                  '25%': {
                    boxShadow: '0 20px 60px rgba(76, 175, 80, 0.8), 0 0 30px rgba(76, 175, 80, 0.6)',
                  },
                  '50%': {
                    boxShadow: '0 20px 60px rgba(129, 199, 132, 0.8), 0 0 30px rgba(129, 199, 132, 0.6)',
                  },
                  '75%': {
                    boxShadow: '0 20px 60px rgba(165, 214, 167, 0.8), 0 0 30px rgba(165, 214, 167, 0.6)',
                  },
                  '100%': {
                    boxShadow: '0 20px 60px rgba(46, 125, 50, 0.8), 0 0 30px rgba(46, 125, 50, 0.6)',
                  },
                },
                '@keyframes press': {
                  '0%': {
                    transform: 'scale(1.1) translateY(-2px)',
                  },
                  '100%': {
                    transform: 'scale(1.05) translateY(0px)',
                  },
                },
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '& .MuiButton-startIcon': {
                  fontSize: '1.8rem',
                  marginRight: '12px',
                  animation: 'iconBounce 2s ease-in-out infinite',
                },
                '@keyframes iconBounce': {
                  '0%, 100%': {
                    transform: 'scale(1)',
                  },
                  '50%': {
                    transform: 'scale(1.2)',
                  },
                },
                '@keyframes heartbeat': {
                  '0%, 100%': {
                    transform: 'scale(1)',
                  },
                  '25%': {
                    transform: 'scale(1.02)',
                  },
                  '50%': {
                    transform: 'scale(1.05)',
                  },
                  '75%': {
                    transform: 'scale(1.02)',
                  },
                },
                '@keyframes borderPulse': {
                  '0%, 100%': {
                    opacity: 0.3,
                    transform: 'scale(1)',
                  },
                  '50%': {
                    opacity: 0.8,
                    transform: 'scale(1.02)',
                  },
                },
                '@keyframes blink': {
                  '0%, 50%, 100%': {
                    opacity: 1,
                  },
                  '25%, 75%': {
                    opacity: 0.7,
                  },
                },
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                },
                '@keyframes particleFloat': {
                  '0%, 100%': {
                    transform: 'translateY(0px) scale(1)',
                    opacity: 0.7,
                  },
                  '50%': {
                    transform: 'translateY(-10px) scale(1.2)',
                    opacity: 1,
                  },
                },
                '@keyframes magnetic': {
                  '0%': {
                    transform: 'scale(1.15) translateY(-4px) rotate(1deg)',
                  },
                  '50%': {
                    transform: 'scale(1.18) translateY(-6px) rotate(0deg)',
                  },
                  '100%': {
                    transform: 'scale(1.15) translateY(-4px) rotate(1deg)',
                  },
                }
              }}
            >
              Add New Sale
            </Button>
          </Box>

          {/* Sales panel — stats, filters & excel grid */}
          <Card sx={{ ...SALES_PAGE_CARD_SX, mb: 3 }}>
            {/* Stats strip */}
            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Box sx={SALES_STATS_GRID}>
                {[
                  { title: 'Total Sales', val: totalSales, color: BRAND.primary.blue, bg: BRAND.tint.blue, icon: <ShoppingCartIcon fontSize="small" />, isCount: true },
                  { title: 'Total Revenue', val: totalSalesValue, color: BRAND.text.green, bg: BRAND.tint.green, icon: <AttachMoneyIcon fontSize="small" /> },
                  { title: 'Total Discount', val: totalDiscount, color: BRAND.text.pink, bg: BRAND.tint.pink, icon: <TrendingDownIcon fontSize="small" /> },
                  { title: 'Total Payment', val: totalPayment, color: '#b45309', bg: '#fffbeb', icon: <CreditCardIcon fontSize="small" /> },
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
                <Chip
                  size="small"
                  label={`${filteredSales.length} / ${sales.length}`}
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
                  onClick={handlePrintSalesList}
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
                    '&:hover': { bgcolor: '#1e40af' },
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

            {/* Filter fields */}
            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafbfc' }}>
              <Box sx={SALES_FILTER_GRID}>
                <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Sales"
                    placeholder="ID, Customer, Reference, or Amount..."
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
                    sx={SALES_FILTER_FIELD_SX}
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
                    filterOptions={(options, { inputValue }) => {
                      const q = inputValue.toLowerCase().trim();
                      if (!q) return options;
                      return options.filter(o =>
                        (o.cus_name || '').toLowerCase().includes(q) ||
                        (o.cus_phone_no || '').toLowerCase().includes(q) ||
                        (o.cus_phone_no2 || '').toLowerCase().includes(q) ||
                        (o.cus_address || '').toLowerCase().includes(q) ||
                        (o.cus_reference || '').toLowerCase().includes(q) ||
                        (o.city?.city_name || '').toLowerCase().includes(q)
                      );
                    }}
                    value={customers.find(c => c.cus_id.toString() === filterCustomer) || null}
                    onChange={(event, newValue) => {
                      setFilterCustomer(newValue ? newValue.cus_id.toString() : '');
                    }}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Customer"
                        placeholder="All Customers"
                        onFocus={(e) => e.target.select()}
                        sx={SALES_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
                    <InputLabel>Bill Type</InputLabel>
                    <Select
                      value={filterBillType}
                      onChange={(e) => setFilterBillType(e.target.value)}
                      label="Bill Type"
                    >
                      <MenuItem value="">All Types</MenuItem>
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
                        sx={SALES_FILTER_FIELD_SX}
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
                    sx={SALES_FILTER_FIELD_SX}
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
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Amount"
                    type="number"
                    placeholder="e.g. 5000"
                    value={filterAmount}
                    onChange={(e) => setFilterAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    sx={SALES_FILTER_FIELD_SX}
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
                    sx={SALES_FILTER_FIELD_SX}
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
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
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
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
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
                  <TextField
                    fullWidth
                    size="small"
                    label="Search by Item"
                    placeholder="Product name or qty (e.g. 5)..."
                    value={filterItem}
                    onChange={(e) => setFilterItem(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search by Notes"
                    placeholder="Reference or notes..."
                    value={filterNotes}
                    onChange={(e) => setFilterNotes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
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
                      { value: 'total_amount-asc', label: 'Amount Low-High' },
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
                        onFocus={(e) => e.target.select()}
                        sx={SALES_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>
              </Box>
            </Box>

            {/* Sales list header */}
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
                Sales List
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                {filteredSales.length} of {sales.length} rows
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', bgcolor: '#fff', maxHeight: 'calc(100vh - 320px)' }}>
              <Table stickyHeader sx={SALES_EXCEL_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'Sale ID', align: 'left' },
                      { label: 'Customer', align: 'left' },
                      { label: 'Items & Qty', align: 'left' },
                      { label: 'Reference', align: 'left' },
                      { label: 'Total', align: 'right' },
                      { label: 'Discount', align: 'right' },
                      { label: 'Shipping', align: 'right' },
                      { label: 'Payment', align: 'right' },
                      { label: 'Balance', align: 'right' },
                      { label: 'Bill Type', align: 'center' },
                      { label: 'Date', align: 'center' },
                      { label: 'Actions', align: 'center' },
                    ].map((col) => (
                      <TableCell key={col.label} align={col.align} sx={SALES_EXCEL_HEAD_SX}>
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
                          {sales.length === 0 ? 'No sales found' : 'No sales match your filters'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                          {sales.length === 0 ? 'Create your first sale to get started.' : 'Try adjusting your filter criteria.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale, rowIndex) => {
                      const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
                      return (
                        <TableRow
                          key={sale.sale_id}
                          onClick={() => handleOpenCustomerLedger(sale)}
                          sx={{
                            bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                            '&:hover': { bgcolor: '#eff6ff' },
                            cursor: 'pointer',
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, color: BRAND.primary.blue, whiteSpace: 'nowrap' }}>
                            {sale.is_return ? `#SR-${sale.return_id}` : `#${sale.sale_id}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.customer?.cus_name || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ minWidth: 180, maxWidth: 280, verticalAlign: 'top', py: 0.75 }}>
                            {renderSaleLineItemsCell(sale)}
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.reference || '—'}
                          </TableCell>
                          <TableCell sx={{ ...SALES_NUM_CELL_SX, fontWeight: 700, color: '#1e293b' }}>
                            {fmtAmt(sale.total_amount)}
                          </TableCell>
                          <TableCell sx={SALES_NUM_CELL_SX}>{fmtAmt(sale.discount)}</TableCell>
                          <TableCell sx={SALES_NUM_CELL_SX}>{fmtAmt(sale.shipping_amount)}</TableCell>
                          <TableCell sx={{ ...SALES_NUM_CELL_SX, fontWeight: 600, color: BRAND.text.green }}>
                            {fmtAmt(sale.payment)}
                          </TableCell>
                          <TableCell sx={{
                            ...SALES_NUM_CELL_SX,
                            fontWeight: 700,
                            color: balance > 0 ? BRAND.primary.pink : balance < 0 ? BRAND.text.green : '#64748b',
                          }}>
                            {fmtAmt(balance)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={sale.bill_type || 'BILL'}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                ...getBillTypeChipSx(sale.bill_type),
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDatePK(sale?.created_at) || '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ p: 0.4, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <Stack direction="row" spacing={0} justifyContent="center" flexWrap="nowrap">
                              <Tooltip title="View Details">
                                <IconButton size="small" color="primary" onClick={() => handleViewBill(sale)} sx={{ p: 0.4 }}>
                                  <VisibilityIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Sale">
                                <IconButton size="small" sx={{ color: '#f59e0b', p: 0.4 }} onClick={() => handleEdit(sale)}>
                                  <EditIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Customer Ledger">
                                <IconButton
                                  size="small"
                                  sx={{ color: BRAND.supporting.cyan, p: 0.4 }}
                                  onClick={(e) => handleOpenCustomerLedger(sale, e)}
                                >
                                  <ListAltIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print Thermal">
                                <IconButton size="small" sx={{ color: '#fd7e14', p: 0.4 }} onClick={() => handlePrintBill('THERMAL', false, sale)}>
                                  <PrintIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print A4 Invoice">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  sx={{ p: 0.4 }}
                                  onClick={() => {
                                    setCurrentBillData(sale);
                                    setReceiptDialogOpen(true);
                                  }}
                                >
                                  <PrintIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Return Sale">
                                <IconButton
                                  size="small"
                                  sx={{ color: BRAND.primary.pink, p: 0.4 }}
                                  onClick={() => {
                                    setCurrentView('create');
                                    setBillType('SALE_RETURN');
                                    handleLoadSaleForReturnMain(sale);
                                  }}
                                >
                                  <TrendingDownIcon sx={{ fontSize: 17 }} />
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

      {/* Load Order Dialog */}
      <Dialog
        open={loadOrderDialogOpen}
        onClose={() => setLoadOrderDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ListAltIcon sx={{ mr: 2 }} />
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Load Order
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Select an order to load into the bill
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setLoadOrderDialogOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by customer name or order ID..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales
                  .filter(sale => {
                    const isOrder = sale.bill_type === 'ORDER';
                    if (!isOrder) return false;

                    if (!orderSearchTerm) return true;

                    const searchLower = orderSearchTerm.toLowerCase();
                    const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                    const matchesId = sale.sale_id?.toString().includes(searchLower);

                    return matchesName || matchesId;
                  })
                  .map((sale) => (
                    <TableRow key={sale.sale_id} hover>
                      <TableCell>{sale.sale_id}</TableCell>
                      <TableCell>{sale.customer?.cus_name || 'N/A'}</TableCell>
                      <TableCell>{formatDatePK(sale?.created_at) || '—'}</TableCell>
                      <TableCell align="right">{parseFloat(sale.total_amount || 0).toFixed(0)}</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleLoadOrder(sale)}
                          startIcon={<ShoppingCartIcon />}
                        >
                          Load
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                {sales.filter(sale => {
                  const isOrder = sale.bill_type === 'ORDER';
                  if (!isOrder) return false;

                  if (!orderSearchTerm) return true;

                  const searchLower = orderSearchTerm.toLowerCase();
                  const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                  const matchesId = sale.sale_id?.toString().includes(searchLower);

                  return matchesName || matchesId;
                }).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        {orderSearchTerm ? 'No matching orders found' : 'No orders found'}
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadOrderDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
              width: 48,
              height: 48
            }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {editingCustomer ? `Editing: ${formSelectedCustomer?.cus_name}` : 'Create a new customer profile'}
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
                  value={newCustomer.cus_name ?? ''}
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
                  value={newCustomer.cus_phone_no ?? ''}
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
                  value={newCustomer.cus_phone_no2 ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no2: e.target.value }))}
                  onFocus={(e) => e.target.select()}
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

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Address"
                  name="cus_address"
                  value={newCustomer.cus_address ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_address: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter complete address"
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
                        inputRef={customerTypeInputRef}
                        label="Account Type"
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && customerTypeOpen) {
                            const firstType = customerTypes && customerTypes.length ? customerTypes[0].cus_type_id : '';
                            if (!newCustomer.cus_type && firstType) {
                              setNewCustomer(prev => ({ ...prev, cus_type: firstType }));
                            }
                            setCustomerTypeOpen(false);
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
                        onFocus={(e) => e.target.select()}
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
                  value={newCustomer.cus_reference ?? ''}
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
                  value={newCustomer.cus_account_info ?? ''}
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
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    sx={{ flex: 1 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City"
                        onFocus={(e) => e.target.select()}
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
                  value={newCustomer.CNIC ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, CNIC: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter CNIC number"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="NTN Number"
                  name="NTN_NO"
                  value={newCustomer.NTN_NO ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, NTN_NO: e.target.value }))}
                  onFocus={(e) => e.target.select()}
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
                  value={newCustomer.cus_balance ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_balance: e.target.value }))}
                  onFocus={(e) => e.target.select()}
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
                  value={newCustomer.other ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, other: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  sx={{ minWidth: 250 }}
                  placeholder="Enter other information"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name in Urdu"
                  name="name_urdu"
                  value={newCustomer.name_urdu ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name_urdu: e.target.value }))}
                  onFocus={(e) => e.target.select()}
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
            {isSavingCustomer ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer')}
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
            width: '210mm', // A4 width
            maxWidth: '210mm',
            '@media print': {
              width: '210mm',
              maxWidth: '210mm',
              margin: '0 auto'
            }
          }
        }}
      >
        <DialogTitle sx={{
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
            <Box id="printable-invoice" sx={{ width: '100%', bgcolor: 'white' }}>
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
                  {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? 'SALE RETURN INVOICE' : 'SALE INVOICE'}
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {selectedBill.customer ? `${selectedBill.customer.cus_name}${selectedBill.customer.name_urdu ? ' ' + selectedBill.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {selectedBill.customer?.cus_phone_no || 'N/A'}
                    </Typography>
                  </Box>
                  {selectedBill.customer?.cus_address && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {selectedBill.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getBillDisplayNo(selectedBill)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>
                      {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? 'Return ID:' : 'Sale ID:'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? selectedBill.return_id : selectedBill.sale_id}
                    </Typography>
                  </Box>
                  {(selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN') && selectedBill.sale_id && (
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Sale ID:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {selectedBill.sale_id}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatDatePK(selectedBill?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatTimePK(selectedBill?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {getCreatedByName(selectedBill, currentUser)}
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
                      {selectedBill.sale_details && selectedBill.sale_details.length > 0 ? (
                        getSaleDetailsInAddOrder(selectedBill.sale_details).map((detail, index) => (
                          <TableRow key={detail.sale_detail_id || index}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{index + 1}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }}>{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || 'N/A'}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{detail.qnty || 0}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{parseFloat(detail.unit_rate || 0).toFixed(2)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd', fontSize: '0.95rem', fontWeight: 600 }} align="right">{parseFloat(detail.total_amount || 0).toFixed(0)}</TableCell>
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
                    {!isWalkinCustomer(selectedBill?.customer) && (() => {
                      const prevBalance = parseFloat(selectedBill.previous_balance || 0);
                      const currentBillAmount = parseFloat(selectedBill.total_amount || 0);
                      const payment = parseFloat(selectedBill.payment || 0);
                      const totalBalance = prevBalance + currentBillAmount - payment;

                      return (
                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                          <Table size="small">
                            <TableBody>
                              {prevBalance > 0 && (
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                    {fmtAmt(prevBalance)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقايا</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                  {fmtAmt(totalBalance)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()}

                    {/* Notes Section */}
                    {(selectedBill.notes || selectedBill.reference) && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {selectedBill.notes || selectedBill.reference}
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
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.labour_charges || 0) - parseFloat(selectedBill.shipping_amount || 0) + parseFloat(selectedBill.discount || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(selectedBill.labour_charges)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(selectedBill.shipping_amount)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(selectedBill.total_amount)}
                            </TableCell>
                          </TableRow>
                          {/* Show payment details - use cash_payment and bank_payment fields */}
                          {(() => {
                            console.log('🧾 Receipt - Payment Details:', {
                              has_cash_payment: selectedBill.hasOwnProperty('cash_payment'),
                              has_bank_payment: selectedBill.hasOwnProperty('bank_payment'),
                              has_bank_title: selectedBill.hasOwnProperty('bank_title'),
                              cash_payment: selectedBill.cash_payment,
                              bank_payment: selectedBill.bank_payment,
                              bank_title: selectedBill.bank_title,
                              total_payment: selectedBill.payment,
                              payment_type: selectedBill.payment_type
                            });
                            return null;
                          })()}

                          {/* Determine cash and bank amounts - handle both new and old sales */}
                          {(() => {
                            // For new sales, use cash_payment and bank_payment fields
                            // For old sales, use payment and payment_type fields
                            let cashAmount = 0;
                            let bankAmount = 0;
                            let bankName = '';

                            if (selectedBill.hasOwnProperty('cash_payment') && selectedBill.hasOwnProperty('bank_payment')) {
                              // NEW SALE: Has payment split fields
                              cashAmount = parseFloat(selectedBill.cash_payment || 0);
                              bankAmount = parseFloat(selectedBill.bank_payment || 0);
                              bankName = selectedBill.bank_title || selectedBill.debit_account?.cus_name || 'بینک';
                            } else {
                              // OLD SALE: Use legacy payment field
                              if (selectedBill.payment_type === 'CASH' || !selectedBill.payment_type) {
                                cashAmount = parseFloat(selectedBill.payment || 0);
                                bankAmount = 0;
                              } else {
                                cashAmount = 0;
                                bankAmount = parseFloat(selectedBill.payment || 0);
                                bankName = selectedBill.debit_account?.cus_name || 'بینک';
                              }
                            }

                            // Get previous balance at time of sale
                            const prevBalAmount = parseFloat(selectedBill.previous_balance || 0);

                            return (
                              <>
                                {/* Always show cash payment row */}
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {/* Show bank payment row if bank payment exists */}
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
                          <TableRow sx={{ bgcolor: '#d0d0d0' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) + parseFloat(selectedBill.previous_balance || 0) - parseFloat(selectedBill.payment || 0))}
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
            startIcon={isSendingWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
            sx={{
              minWidth: 150,
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' },
              color: 'white',
            }}
            onClick={() => handleSendWhatsApp(selectedBill, selectedBill?.customer?.cus_phone_no, 'printable-invoice')}
            disabled={isSendingWhatsApp || !selectedBill?.customer?.cus_phone_no}
            title={selectedBill?.customer?.cus_phone_no ? 'Send invoice via WhatsApp Desktop' : 'Customer has no phone number'}
          >
            {isSendingWhatsApp ? 'Copying...' : 'WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 140,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
            onClick={() => handlePrintBill('EXISTING', true, selectedBill)}
          >
            Print A4
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 140,
              bgcolor: '#fd7e14',
              '&:hover': { bgcolor: '#e8690b' }
            }}
            onClick={() => {
              handlePrintBill('THERMAL', true, selectedBill);
            }}
          >
            Print Thermal
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
          body.print-a4 .no-print,
          body.print-existing .dashboard-layout-root,
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

          /* A4 Print Styling */
          body.print-a4 #printable-invoice-a4,
          body.print-a4 #printable-invoice-a4 * {
            visibility: visible !important;
            height: auto !important;
          }

          body.print-a4 #printable-invoice-a4 {
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

          body.print-existing {
            @page {
              size: A4;
              margin: 0.5cm 1cm;
            }
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          
          /* Hide everything by default */
          body.print-existing * {
            visibility: hidden;
          }

          /* Collapse layout container height to prevent blank page generation */
          body.print-existing .dashboard-layout-root {
            height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Show only the printable invoice */
          body.print-existing #printable-invoice,
          body.print-existing #printable-invoice * {
            visibility: visible !important;
          }
          
          /* Position invoice at top */
          body.print-existing #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 21cm;
            min-height: 29.7cm;
            max-width: 21cm;
            background: white;
            padding: 0;
            margin: 0;
          }
          
          /* Hide dialog backdrop and header/actions */
          body.print-existing .MuiDialogTitle-root,
          body.print-existing .no-print,
          body.print-existing .no-print * {
            visibility: hidden !important;
            display: none !important;
          }

          /* Reset dialog wrapper layout for printing */
          body.print-existing .MuiDialog-root,
          body.print-existing .MuiDialog-container,
          body.print-existing .MuiDialog-paper {
            background: transparent !important;
            box-shadow: none !important;
            overflow: visible !important;
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Show dialog content */
          body.print-existing .MuiDialogContent-root {
            visibility: visible !important;
            display: block !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 21cm !important;
            max-width: 21cm !important;
          }
          
          /* Table styles for print */
          body.print-existing table {
            page-break-inside: auto;
            border-collapse: collapse;
            width: 100%;
            font-size: 12px;
          }
          
          body.print-existing tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          body.print-existing thead {
            display: table-header-group;
          }
          
          body.print-existing tbody {
            display: table-row-group;
          }
          
          /* Ensure proper spacing */
          body.print-existing .MuiBox-root {
            page-break-inside: avoid;
          }
          
          /* Remove shadows and rounded corners */
          body.print-existing .MuiPaper-root {
            box-shadow: none !important;
          }
          
          /* Typography adjustments for A4 */
          body.print-existing .MuiTypography-root {
            font-size: 12px !important;
          }
          
          body.print-existing .MuiTypography-h4 {
            font-size: 24px !important;
          }
          
          body.print-existing .MuiTypography-h6 {
            font-size: 16px !important;
          }
          
          body.print-existing .MuiTypography-body2 {
            font-size: 12px !important;
          }
          
          /* Grid and spacing */
          body.print-existing .MuiGrid-container {
            margin: 0 !important;
          }
          
          body.print-existing .MuiGrid-item {
            padding: 8px !important;
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
        <DialogTitle sx={{
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
                    <Typography variant="body2"><strong>Total Amount:</strong> {parseFloat(selectedSaleForReturn.total_amount || 0).toFixed(0)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Date:</strong> {formatDatePK(selectedSaleForReturn?.created_at) || '—'}</Typography>
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
                            <TableCell align="right">{parseFloat(detail.unit_rate || 0).toFixed(2)}</TableCell>
                            <TableCell align="right">{parseFloat(detail.total_amount || 0).toFixed(0)}</TableCell>
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
                    value={calculateReturnTotal().toFixed(0)}
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
                    value={calculateReturnNetTotal().toFixed(0)}
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

      {/* Customer Ledger Dialog */}
      <Dialog
        open={ledgerDialogOpen}
        onClose={() => setLedgerDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'white', color: 'primary.main' }}>
              <ListAltIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Customer Ledger: {formSelectedCustomer?.cus_name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Detailed financial statement and transaction history
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setLedgerDialogOpen(false)} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
              FILTER BY DATE:
            </Typography>
            <TextField
              size="small"
              type="date"
              label="Start Date"
              value={ledgerStartDate}
              onChange={(e) => setLedgerStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ bgcolor: 'white' }}
            />
            <TextField
              size="small"
              type="date"
              label="End Date"
              value={ledgerEndDate}
              onChange={(e) => setLedgerEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ bgcolor: 'white' }}
            />
            <Button
              variant="contained"
              onClick={() => fetchLedgerData(formSelectedCustomer?.cus_id)}
              disabled={ledgerLoading}
              startIcon={ledgerLoading ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
            >
              Update Report
            </Button>
          </Box>

          {ledgerData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={3}>
                  <Card sx={{ bgcolor: 'grey.50', borderBottom: '4px solid', borderColor: 'grey.400' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Opening Balance</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{ledgerData.summary.openingBalance.toFixed(0)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card sx={{ bgcolor: 'success.50', borderBottom: '4px solid', borderColor: 'success.main' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Total Debit (Sales)</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'success.main' }}>{ledgerData.summary.totalDebit.toFixed(0)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card sx={{ bgcolor: 'error.50', borderBottom: '4px solid', borderColor: 'error.main' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Total Credit (Payments)</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'error.main' }}>{ledgerData.summary.totalCredit.toFixed(0)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card sx={{ bgcolor: 'primary.50', borderBottom: '4px solid', borderColor: 'primary.main' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Closing Balance</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'primary.main' }}>{ledgerData.summary.closingBalance.toFixed(0)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Ledger Entries Table */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="primary" /> Transaction History
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid', borderColor: 'divider' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Bill No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Debit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Credit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledgerData.ledgerEntries.map((entry, idx) => {
                      const isCredit = parseFloat(entry.credit_amount || 0) > 0;
                      const isDebit = parseFloat(entry.debit_amount || 0) > 0 && !isCredit;
                      const hoverBg = isCredit ? '#dcfce7 !important' : isDebit ? '#fee2e2 !important' : '#e0f2fe !important';
                      const accentColor = isCredit ? '#16a34a !important' : isDebit ? '#dc2626 !important' : '#0284c7 !important';
                      const baseBg = isCredit ? '#f0fdf4' : isDebit ? '#fef2f2' : 'inherit';
                      return (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          bgcolor: baseBg,
                          '&:last-child td, &:last-child th': { border: 0 },
                          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: hoverBg,
                            boxShadow: `inset 4px 0 0 ${accentColor}`
                          }
                        }}
                      >
                        <TableCell>{formatDatePK(entry?.created_at) || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.trnx_type}
                            size="small"
                            color={entry.trnx_type === 'SALE' ? 'primary' : entry.trnx_type === 'PAYMENT' ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 'bold', borderRadius: 1 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'medium' }}>{entry.bill_no || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={entry.details || entry.payments?.[0]?.payment_details || ''}>
                            <span>{entry.details || entry.payments?.[0]?.payment_details || '-'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ color: entry.debit_amount > 0 ? 'success.main' : 'inherit', fontWeight: entry.debit_amount > 0 ? 'bold' : 'normal' }}>
                          {entry.debit_amount > 0 ? entry.debit_amount.toFixed(0) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: entry.credit_amount > 0 ? 'error.main' : 'inherit', fontWeight: entry.credit_amount > 0 ? 'bold' : 'normal' }}>
                          {entry.credit_amount > 0 ? entry.credit_amount.toFixed(0) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{entry.closing_balance.toFixed(0)}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Box sx={{ py: 12, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
              {ledgerLoading ? (
                <Stack alignItems="center" spacing={2}>
                  <CircularProgress size={40} />
                  <Typography color="text.secondary">Fetching ledger data...</Typography>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1}>
                  <InfoIcon sx={{ fontSize: 48, color: 'grey.300' }} />
                  <Typography color="text.secondary">No ledger data available for the selected range.</Typography>
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setLedgerDialogOpen(false)}
            variant="contained"
            color="primary"
            sx={{ px: 4 }}
          >
            Close Statement
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
                    options={productCategories}
                    getOptionLabel={(opt) => opt.cat_name || ''}
                    value={productCategories.find(c => c.cat_id === addProductFormData.cat_id) || null}
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
                    options={productSubcategories.filter(s => s.cat_id === addProductFormData.cat_id)}
                    getOptionLabel={(opt) => opt.sub_cat_name || ''}
                    value={productSubcategories.find(s => s.sub_cat_id === addProductFormData.sub_cat_id) || null}
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
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #16a34a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#16a34a' }} />
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
      <Dialog open={showAddProductCategoryPopup} onClose={() => setShowAddProductCategoryPopup(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 40, height: 40 }}>
              <FolderIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add Product Category</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product category</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth required
              label="Category Name"
              value={addProductCategoryName}
              onChange={(e) => setAddProductCategoryName(e.target.value)}
              disabled={isAddingProductCategory}
              placeholder="Enter category name"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductCategory} disabled={isAddingProductCategory}
            sx={{ background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)', textTransform: 'none', '&:hover': { background: 'linear-gradient(45deg, #388e3c 30%, #1b5e20 90%)' } }}>
            {isAddingProductCategory ? 'Adding...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Sub Category Popup */}
      <Dialog open={showAddProductSubCategoryPopup} onClose={() => setShowAddProductSubCategoryPopup(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #9c27b0 30%, #6a1b9a 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 40, height: 40 }}>
              <FolderOpenIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add Product Sub Category</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product subcategory</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              options={productCategories}
              getOptionLabel={(opt) => opt.cat_name || ''}
              value={productCategories.find(c => c.cat_id === addProductSubCategoryFormData.cat_id) || null}
              onChange={(_, v) => setAddProductSubCategoryFormData(prev => ({ ...prev, cat_id: v?.cat_id || '' }))}
              disabled={isAddingProductSubCategory}
              renderInput={(params) => <TextField {...params} label="Category" required placeholder="Select category" />}
            />
            <TextField
              fullWidth required
              label="Subcategory Name"
              value={addProductSubCategoryFormData.sub_cat_name}
              onChange={(e) => setAddProductSubCategoryFormData(prev => ({ ...prev, sub_cat_name: e.target.value }))}
              disabled={isAddingProductSubCategory}
              placeholder="Enter subcategory name"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductSubCategory} disabled={isAddingProductSubCategory}
            sx={{ background: 'linear-gradient(45deg, #9c27b0 30%, #6a1b9a 90%)', textTransform: 'none', '&:hover': { background: 'linear-gradient(45deg, #7b1fa2 30%, #4a148c 90%)' } }}>
            {isAddingProductSubCategory ? 'Adding...' : 'Add Sub Category'}
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
        <DialogTitle sx={{
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

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />

      {/* Loss Warning Confirmation Dialog */}
      <Dialog
        open={lossConfirmOpen}
        onClose={() => setLossConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #d32f2f 30%, #f44336 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2.5
        }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            ⚠️ Warning: Selling Below Cost Price
          </Typography>
          <IconButton
            onClick={() => setLossConfirmOpen(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
          <Typography variant="body1" color="text.primary" sx={{ mb: 2, fontWeight: 'medium' }}>
            The following product(s) in this bill are being sold at a rate less than their cost price (selling at a loss):
          </Typography>
          <Box sx={{
            bgcolor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            overflow: 'hidden',
            mb: 2
          }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#ffebee' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c62828' }}>Product</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>Cost Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>Sale Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>Loss/Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lossItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.pro_title}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>Rs. {item.costPrice.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>Rs. {item.salePrice.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.dark', fontWeight: 'bold' }}>
                      Rs. {(item.costPrice - item.salePrice).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to proceed and save this record anyway?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
          <Button
            onClick={() => setLossConfirmOpen(false)}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            No, Cancel
          </Button>
          <Button
            onClick={async () => {
              setLossConfirmOpen(false);
              await handleSaveBill(true);
            }}
            variant="contained"
            color="error"
            sx={{
              background: 'linear-gradient(45deg, #d32f2f 30%, #f44336 90%)',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': {
                background: 'linear-gradient(45deg, #b71c1c 30%, #d32f2f 90%)',
              }
            }}
          >
            Yes, Save Anyway
          </Button>
        </DialogActions>
      </Dialog>

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
                {activeBillData?.is_return ? 'SALE RETURN RECEIPT' : 'SALE RECEIPT'}
              </Typography>
            </Box>

            {/* Meta */}
            <Box sx={{ py: 0.75, fontSize: '11px', borderBottom: '1px dashed #000', color: '#000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Inv #: <strong>{getBillDisplayNo(activeBillData)}</strong></span>
                <span>Date: <strong>{formatDatePK(activeBillData?.created_at) || '—'}</strong></span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                <span>Time: <strong>{formatTimePK(activeBillData?.created_at) || '—'}</strong></span>
                <span>Type: <strong>{activeBillData.bill_type || 'BILL'}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Cust: <strong>{activeBillData.customer?.cus_name || 'Cash Customer'}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Created By: <strong>{getCreatedByName(activeBillData, currentUser)}</strong></span>
              </Box>
              {activeBillData.customer?.cus_phone_no && (
                <Box sx={{ mt: 0.25 }}>
                  <span>Phone: <strong>{activeBillData.customer.cus_phone_no}</strong></span>
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
              {activeBillData.sale_details && activeBillData.sale_details.length > 0 ? (
                getSaleDetailsInAddOrder(activeBillData.sale_details).map((d, i) => (
                  <Box key={d.sale_detail_id || i} sx={{ mb: 0.75 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#000', wordBreak: 'break-word' }}>
                      {d.product?.pro_title || 'Item'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#000' }}>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: '11px', width: '35px', textAlign: 'center', color: '#000' }}>
                        {fmtRateQty(d.qnty)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', width: '50px', textAlign: 'right', color: '#000' }}>
                        {fmtRateQty(d.unit_rate)}
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
              {!isWalkinCustomer(activeBillData?.customer) && activeBillData.previous_balance !== undefined && parseFloat(activeBillData.previous_balance || 0) !== 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>Prev Balance</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#000' }}>{fmtAmt(activeBillData.previous_balance)}</Typography>
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
    </>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <Container maxWidth={false} sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        </Container>
      </DashboardLayout>
    }>
      <SalesPageContent />
    </Suspense>
  );
}