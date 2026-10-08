'use client';

import { useState, useEffect, useMemo, Suspense, useRef, useCallback, forwardRef } from 'react';
import { formatDatePK, formatDateTimePK, formatTimePK, getCreatedByName, getPkDateString } from '@/lib/date-helper';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/app/dashboard/components/dashboard-layout';
import DateFilterInput from '@/app/dashboard/components/date-filter-input';
import { usePinAuth } from '@/app/hooks/usePinAuth';
import BiometricAuthDialog from '@/app/dashboard/components/BiometricAuthDialog';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH, notifyLedgerDataChanged } from '@/lib/ledger-tabs';
import {
  formatCustomerPhoneDisplay,
  formatWhatsAppPhone,
  resolveCustomerWhatsAppPhone,
} from '@/lib/whatsapp-local';
import { SalesProvider } from './SalesContext';
import { lazy } from 'react';

const SaleCreateView = lazy(() => import('./SaleCreateView'));
const SaleListView = lazy(() => import('./SaleListView'));
const SalePrintableBill = lazy(() => import('./SalePrintableBill'));
const SaleReceiptDialog = lazy(() => import('./SaleReceiptDialog'));
const SaleLoadOrderDialog = lazy(() => import('./SaleLoadOrderDialog'));
const SaleViewBillDialog = lazy(() => import('./SaleViewBillDialog'));
const SaleReturnDialog = lazy(() => import('./SaleReturnDialog'));
const SaleLedgerDialog = lazy(() => import('./SaleLedgerDialog'));
const SaleAddProductDialog = lazy(() => import('./SaleAddProductDialog'));

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
  LinearProgress,
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
  Divider,
  Pagination,
  Switch,
  FormControlLabel
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
  Label as TagIcon,
  CreditCard as CreditCardIcon,
  Translate as TranslateIcon,
  Description as NotesIcon,
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
import { COMPANY } from '@/lib/brand-theme';

import {
  getProductCostPrice,
  findCatalogProduct,
  getCartLineCostRate,
  buildSaleReceiptBill,
  resolveSaleReceiptBalances,
  SALE_INVOICE_PRINT,
  SALE_PRODUCT_LIST_LIMIT,
  SALE_CUSTOMER_LIST_LIMIT,
  filterSaleProducts,
  filterSaleCustomers,
  getFocusedAutocompleteOption,
  commitDropdownOnTab,
  SALE_PAGE_CUSTOMER_TYPE_RULES,
  filterSalePageCustomerTypes,
  isCustomerAccount,
  matchesCustomerType,
  EMPTY_PAYMENT_DATA,
  normalizePaymentData,
  EMPTY_PRODUCT_FORM_DATA,
  normalizeProductFormData,
  EMPTY_CUSTOMER_FORM,
  paymentInputValue,
  SALES_PAGE_CARD_SX,
  SALE_ENTRY_LABEL_SX,
  SALE_ENTRY_CONTROL_SX,
  SALE_ENTRY_CELL_SX,
  SALE_ENTRY_ROW1_SX,
  SALE_ENTRY_ROW1_RETURN_SX,
  SALE_ENTRY_ROW2_SX,
  SALE_DROPDOWN_LINE,
  SALE_CUSTOMER_DROPDOWN_GRID,
  saleDropdownRowStyle,
  saleDropdownCellStyle,
  saleDropdownHeaderCell,
  SALE_DROPDOWN_POPPER_SX,
  SALES_EXCEL_TABLE_SX,
  SALES_EXCEL_HEAD_SX,
  SALES_NUM_CELL_SX,
  SALES_FILTER_GRID,
  SALES_FILTER_FIELD_SX,
  getBillTypeChipSx,
  INVOICE_STORE_PHONE_LINE,
} from './sale-utils';
import SaleDropdownListbox, { SaleCustomerDropdownListbox } from './SaleDropdownListbox';

let salesPageBootId = 0;
if (typeof window !== 'undefined') {
  window.__salesPageBootId = (window.__salesPageBootId ?? 0) + 1;
  salesPageBootId = window.__salesPageBootId;
}

export default function SalesPageContent() {
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
  const [formRefLoading, setFormRefLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [savingBill, setSavingBill] = useState(false);
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
      } catch (e) { }
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
  const [dateFrom, setDateFrom] = useState(() => getPkDateString());
  const [dateTo, setDateTo] = useState(() => getPkDateString());
  const [saleEntryDate, setSaleEntryDate] = useState(() => getPkDateString());
  const [filterItem, setFilterItem] = useState('');
  const [filterQuantity, setFilterQuantity] = useState('');
  const [filterNotes, setFilterNotes] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const tableContainerRef = useRef(null);
  const [jumpToPage, setJumpToPage] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedItem, setDebouncedItem] = useState('');
  const [debouncedQuantity, setDebouncedQuantity] = useState('');
  const [debouncedNotes, setDebouncedNotes] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('');
  const [debouncedMaxAmount, setDebouncedMaxAmount] = useState('');
  const listAbortRef = useRef(null);
  const listFilterKeyRef = useRef('');

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
  const dataLoadedRef = useRef({ list: false, form: false, listFilters: false, dialogLookups: false, customersFull: false });
  const formFetchInFlightRef = useRef(null);
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
        console.log(`âœ… Offline bill ${offlineItem.offlineId} synced to server as Sale #${serverResult.sale_id}`);
      });
      refreshOfflineCount();
      if (result.syncedCount > 0) {
        showSnackbar(`âœ… ${result.syncedCount} offline bill(s) uploaded to server automatically!`, 'success');
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
      showSnackbar('ðŸŒ Internet connection restored! Syncing pending offline bills...', 'info');
      triggerAutoSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showSnackbar('âš¡ Offline mode active. New bills will be saved locally.', 'warning');
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

          console.log('ðŸ“¦ Loaded Order/Quotation from URL:', fullQuotation);

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
              cost_price: getProductCostPrice(item.product),
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
          showSnackbar(`âœ… Draft ${fullDraft.draft_code} loaded into POS`, 'success');
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
  const customerHighlightRef = useRef(null);
  const customerTypeHighlightRef = useRef(null);
  const cityHighlightRef = useRef(null);
  const areaHighlightRef = useRef(null);
  const storeHighlightRef = useRef(null);
  const vehicleHighlightRef = useRef(null);
  const subcategoryHighlightRef = useRef(null);
  const subsubcategoryHighlightRef = useRef(null);
  const productTypeHighlightRef = useRef(null);
  const brandHighlightRef = useRef(null);
  const productHighlightRef = useRef(null);
  const weightSizeHighlightRef = useRef(null);

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

    // Sidebar / header "New Sale" â†’ sales list
    setCurrentView('list');
  }, [searchParams]);

  // Flag to track when we're restoring screen state
  const [isRestoringScreen, setIsRestoringScreen] = useState(false);

  // Load Order state
  const [loadOrderDialogOpen, setLoadOrderDialogOpen] = useState(false);
  const [loadOrderList, setLoadOrderList] = useState([]);
  const [loadOrderListLoading, setLoadOrderListLoading] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [loadedOrderId, setLoadedOrderId] = useState(null); // Track the order being converted to bill
  const [selectedCustomerTypeFilter, setSelectedCustomerTypeFilter] = useState(null); // Filter customers by type
  const [customerTypeFilterOpen, setCustomerTypeFilterOpen] = useState(false);

  const salePageCustomerTypeOptions = useMemo(
    () => filterSalePageCustomerTypes(customerTypes),
    [customerTypes]
  );

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
  const beginSaving = () => {
    setSavingBill(true);
  };

  const endSaving = () => {
    setSavingBill(false);
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
      fetchBankAccounts(customers);
    }
  }, [customers, customerCategories, customerTypes]);

  // Ledger state
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }));

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
    console.log('âœ… Screen 1 initialized by default');
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

    console.log('ðŸ“¸ Screen state captured:', state);
    return state;
  };

  // Auto-save current form state to the current screen in stack
  // (Inline auto-save in useEffects to avoid circular dependencies)

  // Restore form state (ensure all updates happen)
  const restoreScreenState = (state) => {
    if (!state) {
      console.warn('âš ï¸ No state to restore');
      return;
    }

    // Set flag to prevent automatic fetching during restoration
    setIsRestoringScreen(true);

    // Restore all state at once to ensure consistency
    setFormSelectedCustomer(state.formSelectedCustomer ?? null);
    setFormSelectedStore(state.formSelectedStore ?? null);
    setProductTableData(state.productTableData);
    setPaymentData(normalizePaymentData(state.paymentData));
    setBillType(state.billType || 'BILL');
    setLoadedOrderId(state.loadedOrderId || null);
    setFormSelectedProduct(state.formSelectedProduct ?? null);
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
    console.log('ðŸ§¹ Clearing form state');
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
    showSnackbar('ðŸ“‹ Form cleared - ready for new entry', 'info');
  };

  // Open new screen (Ctrl+Right)
  const openNewScreen = useCallback(() => {
    console.log('âž¡ï¸ OPENING NEW SCREEN');
    console.log('ðŸ“· Current state before capture:', {
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

    console.log('ðŸ“š New stack created:', newStack.length, 'screens');

    setScreenStack(newStack);
    setCurrentScreenIndex(newStack.length - 1);

    // NOW clear form for the new blank screen (but keep transport accounts)
    clearFormState();
    showSnackbar(`ðŸ“‹ Screen ${newStack.length} | Starting fresh (previous state saved)`, 'info');
  }, [formSelectedCustomer, formSelectedStore, productTableData, paymentData, billType, formSelectedProduct, productFormData, newTransport, transportAccounts, transportOptions, currentScreenIndex, screenStack]);

  // Go back to previous screen (Ctrl+Left) - NO AUTO-CLEAR, only navigate if possible
  const goToPreviousScreen = useCallback(() => {
    console.log('â¬…ï¸ GOING TO PREVIOUS SCREEN');
    console.log('ðŸ“Š Current stack:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length,
      stateAtCurrentIndex: screenStack[currentScreenIndex]
    });

    if (currentScreenIndex > 0) {
      const previousIndex = currentScreenIndex - 1;
      const previousState = screenStack[previousIndex];

      console.log('ðŸ”„ Restoring from index:', previousIndex);
      console.log('ðŸ”„ State to restore:', previousState);

      restoreScreenState(previousState);
      setCurrentScreenIndex(previousIndex);
      showSnackbar(`ðŸ“‹ Screen ${previousIndex + 1} | ${previousState.customerName}`, 'info');
    } else if (currentScreenIndex === 0) {
      // At first screen - can't go back, just notify user
      console.log('â„¹ï¸ Already at first screen, cannot go back');
      showSnackbar('ðŸ“‹ You are at the first screen. Click "Cancel Current" to discard or "Cancel" to save later.', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Go forward to next screen (Ctrl+Right after going back) - NO AUTO-CLEAR
  const goToNextScreen = useCallback(() => {
    console.log('âž¡ï¸ GOING TO NEXT SCREEN');
    if (currentScreenIndex < screenStack.length - 1) {
      const nextIndex = currentScreenIndex + 1;
      const nextState = screenStack[nextIndex];
      restoreScreenState(nextState);
      setCurrentScreenIndex(nextIndex);
      showSnackbar(`ðŸ“‹ Screen ${nextIndex + 1} | ${nextState.customerName}`, 'info');
    } else {
      console.log('â„¹ï¸ Already at last screen');
      showSnackbar('ðŸ“‹ You are at the last screen. Press Ctrl+Right to create a new screen.', 'info');
    }
  }, [currentScreenIndex, screenStack]);

  // Smart forward navigation - Go to next screen OR create new if at the end
  const handleForwardNavigation = useCallback(() => {
    console.log('âž¡ï¸ SMART FORWARD NAVIGATION');
    console.log('ðŸ“Š Current status:', {
      currentIndex: currentScreenIndex,
      stackLength: screenStack.length,
      isAtEnd: currentScreenIndex === screenStack.length - 1
    });

    if (currentScreenIndex < screenStack.length - 1) {
      // Not at end - go to next existing screen
      console.log('â†ªï¸ Going to next existing screen');
      goToNextScreen();
    } else {
      // At end - create new screen
      console.log('âœ¨ Creating new screen');
      openNewScreen();
    }
  }, [currentScreenIndex, screenStack, goToNextScreen, openNewScreen]);

  // Cancel current screen - Remove it from the stack and go to previous or reset
  const cancelCurrentScreen = useCallback(() => {
    console.log('âŒ CANCELING CURRENT SCREEN');
    console.log('ðŸ“Š Stack before cancel:', {
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
        console.log('âŒ¨ï¸ Ctrl+Right pressed');
        handleForwardNavigation();
      }
      // Ctrl+Left Arrow = Go to previous screen
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        console.log('âŒ¨ï¸ Ctrl+Left pressed');
        goToPreviousScreen();
      }
      // Ctrl+X = Cancel current screen
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        console.log('âŒ¨ï¸ Ctrl+X pressed');
        cancelCurrentScreen();
      }
    };

    window.addEventListener('keydown', handleScreenNavigation);
    return () => window.removeEventListener('keydown', handleScreenNavigation);
  }, [handleForwardNavigation, goToPreviousScreen, cancelCurrentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle product selection
  const handleProductSelect = (selectedProduct) => {
    console.log('ðŸ” Product selected:', selectedProduct);
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
        cost_price: getProductCostPrice(selectedProduct)
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
      console.log('ðŸ“¦ Store stock raw response:', data);

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
      console.log('ðŸ“¦ Store stock normalized:', { stockQty, reservedQty, available });

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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pro_id: formSelectedProduct.pro_id,
      pro_title: formSelectedProduct.pro_title,
      storeid: formSelectedStore.storeid,
      store_name: formSelectedStore.store_name,
      quantity: productFormData.quantity,
      rate: productFormData.rate,
      amount: productFormData.amount,
      stock: productFormData.stock,
      size: productFormData.size || '',
      cost_price: getProductCostPrice(formSelectedProduct)
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
    return saleDetailNameMatchesItemFilter(name, t);
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
    const highlightTerm = (debouncedItem || '').trim();
    const highlightQty = (debouncedQuantity || '').trim();

    if (!details.length) {
      return (
        <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>â€”</Typography>
      );
    }

    return (
      <Box sx={{ minWidth: 160, maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        {details.map((d, i) => {
          const name = d.product?.pro_title || d.product_name || `Item ${i + 1}`;
          const qty = parseFloat(d.qnty || 0);
          const nameMatches = saleDetailNameMatchesItemFilter(name, highlightTerm);
          const qtyMatches = saleDetailQtyMatchesItemFilter(qty, highlightQty);

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
                bgcolor: qtyMatches && highlightQty ? '#fffbeb' : 'transparent',
                borderRadius: qtyMatches && highlightQty ? '4px' : 0,
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
                  bgcolor: qtyMatches && highlightQty ? '#fef08a' : '#dbeafe',
                  color: qtyMatches && highlightQty ? '#854d0e' : '#1d4ed8',
                  border: qtyMatches && highlightQty ? '2px solid #facc15' : '1px solid #93c5fd',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  boxShadow: qtyMatches && highlightQty ? '0 0 0 2px rgba(250, 204, 21, 0.35)' : 'none',
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

  const openLoadOrderDialog = async () => {
    setLoadOrderDialogOpen(true);
    setLoadOrderListLoading(true);
    try {
      const res = await fetch('/api/sales?list=true&bill_type=ORDER', { cache: 'no-store' });
      const data = res.ok ? await res.json() : [];
      setLoadOrderList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setLoadOrderList([]);
    } finally {
      setLoadOrderListLoading(false);
    }
  };

  // Handle loading an order into the form
  const handleLoadOrder = async (order) => {
    try {
      setLoading(true);

      // Fetch full order details to ensure we have everything
      const response = await fetch(`/api/sales?id=${order.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const fullOrder = await response.json();

      console.log('ðŸ“¦ Loaded Order:', fullOrder);
      console.log('ðŸ” ORDER DETAILS:');
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
        console.log('  ðŸ“¦ Product Items Count:', fullOrder.sale_details.length);
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
          cost_price: getProductCostPrice(item.product),
          stock: 0, // Stock will need to be fetched or updated
          size: item.size || '',
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

      console.log('ðŸ’¼ Loading Payment Data:');
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

      console.log('ðŸ“¦ Loaded Quotation:', fullQuotation);

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
            cost_price: getProductCostPrice(detail.product),
            size: detail.size || '',
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
    // Pre-auth validation â€” check these before triggering biometric/PIN
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
        const costPrice = getCartLineCostRate(item, products);
        const salePrice = parseFloat(item.rate || 0);
        console.log(`ðŸ’° Loss check: ${item.pro_title} â€” costPrice=${costPrice}, salePrice=${salePrice}`);
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

        const isEditingReturn = Boolean(editingSale && (editingSale.is_return || editingSale.bill_type === 'SALE_RETURN' || editingSale.return_id));
        const editReturnId = editingSale?.return_id || (typeof editingSale?.sale_id === 'string' ? parseInt(editingSale.sale_id.replace('SR-', '')) : editingSale?.sale_id);

        const returnBody = {
          id: isEditingReturn ? editReturnId : undefined,
          return_id: isEditingReturn ? editReturnId : undefined,
          sale_id: selectedSaleForReturnMain ? selectedSaleForReturnMain.sale_id : (editingSale?.actual_sale_id || (typeof editingSale?.sale_id === 'number' ? editingSale?.sale_id : null)),
          cus_id: returnCustomerId,
          total_amount: Number(totalAmount.toFixed(0)),
          discount: Number(discount.toFixed(0)),
          labour_charges: Number(labourCharges.toFixed(0)),
          shipping_amount: Number(deliveryCharges.toFixed(0)),
          loader_id: selectedSaleForReturnMain?.loader_id || editingSale?.loader_id || null,
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

        const totalRefund = cashReturn + bankReturn;
        const prevReturnBalance = parseFloat(
          formSelectedCustomer?.cus_balance ??
          selectedSaleForReturnMain?.customer?.cus_balance ?? 0
        );

        setCurrentBillData({
          ...(selectedSaleForReturnMain || {}),
          return_id: null,
          customer: formSelectedCustomer || selectedSaleForReturnMain?.customer || {},
          sale_details: getCartItemsInAddOrder().map((item, idx) => ({
            sale_detail_id: idx,
            product: { pro_title: item.pro_title || item.product_name || 'Unknown Product' },
            qnty: item.quantity,
            unit_rate: item.rate,
            total_amount: item.amount,
          })),
          total_amount: calculateTotalAmount(),
          labour_charges: paymentData.labour || 0,
          shipping_amount: paymentData.deliveryCharges || 0,
          discount: paymentData.discount || 0,
          payment: totalRefund,
          cash_refund: cashReturn,
          bank_refund: bankReturn,
          cash_payment: cashReturn,
          bank_payment: bankReturn,
          notes: paymentData.notes,
          bill_type: 'SALE_RETURN',
          is_return: true,
          created_at: new Date().toISOString(),
          previous_balance: prevReturnBalance,
          previous_customer_balance: prevReturnBalance,
        });
        setReceiptDialogOpen(true);

        const response = await fetch('/api/sale-returns', {
          method: isEditingReturn ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnBody),
        });

        if (response.ok) {
          const saleReturnData = await response.json();
          notifyLedgerDataChanged('sale-return');
          if (editingSale) setEditingSale(null);

          setCurrentBillData((prev) => ({
            ...prev,
            ...saleReturnData,
            return_id: saleReturnData.return_id,
            customer: formSelectedCustomer || saleReturnData.customer || selectedSaleForReturnMain?.customer || prev?.customer || {},
            payment: totalRefund,
            cash_refund: cashReturn,
            bank_refund: bankReturn,
            cash_payment: cashReturn,
            bank_payment: bankReturn,
            is_return: true,
            previous_balance: parseFloat(
              saleReturnData.previous_balance ??
              saleReturnData.previous_customer_balance ??
              prevReturnBalance
            ),
            previous_customer_balance: parseFloat(
              saleReturnData.previous_customer_balance ??
              saleReturnData.previous_balance ??
              prevReturnBalance
            ),
            created_at: saleReturnData.created_at || prev?.created_at,
          }));
          showSnackbar('Sale return processed successfully', 'success');

          void (async () => {
            try {
              const detailRes = await fetch(`/api/sale-returns?id=${saleReturnData.return_id}`);
              if (detailRes.ok) {
                const fullReturn = await detailRes.json();
                setCurrentBillData((prev) => (prev?.return_id === fullReturn.return_id ? { ...prev, ...fullReturn } : prev));
              }
            } catch {
              /* local receipt is enough */
            }
          })();

          setTimeout(() => {
            setFormSelectedCustomer(null);
            setFormSelectedProduct(null);
            setFormSelectedStore(null);
            setProductTableData([]);
            setPaymentData({ ...EMPTY_PAYMENT_DATA });
            setSelectedSaleForReturnMain(null);
            setBillType('BILL');
            fetchData({ mode: 'list', silent: true });
          }, 1000);
        } else {
          setReceiptDialogOpen(false);
          setCurrentBillData(null);
          const errorData = await response.json();
          showSnackbar('Error: ' + (errorData.error || 'Failed to process return'), 'error');
        }
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

      console.log('ðŸ” Frontend - Calculated values:', { totalAmount, grandTotal, totalCashReceived, advancePayment, finalPaymentTotal, billType });
      console.log('ðŸ“‹ Frontend - Payment Data before sending:', paymentData);
      console.log('ðŸ“Š Frontend - Grand Total Breakdown:', {
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
          size: product.size || null,
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
        updated_by: getCurrentUserId()
      };

      const isEditing = !!editingSale;
      const cartItems = getCartItemsInAddOrder();

      beginSaving();

      // Use PUT when editing an existing sale, POST for new
      const apiBody = isEditing
        ? {
          ...saleData,
          id: editingSale.sale_id,
          created_at: editingSale.created_at,
          date: editingSale.date || editingSale.created_at,
        }
        : saleData;
      let response;
      let isNetworkFailure = typeof navigator !== 'undefined' && !navigator.onLine;

      if (!isNetworkFailure) {
        try {
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
        const offlineId = saveOfflineSale(saleData);
        refreshOfflineCount();

        if (offlineId) {
          showSnackbar(`âš¡ Internet Disconnected! Bill saved locally (${offlineId}). Will auto-upload when online.`, 'warning');

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
        const result = await response.json();
        notifyLedgerDataChanged('sale');

        const savedSaleId = result.sale_id ?? result.id ?? editingSale?.sale_id;
        const resolvedPrevBalance = result.previous_balance !== undefined && result.previous_balance !== null
          ? parseFloat(result.previous_balance)
          : (result.previous_customer_balance !== undefined && result.previous_customer_balance !== null
            ? parseFloat(result.previous_customer_balance)
            : (isEditing && editingSale?.previous_balance !== undefined
              ? parseFloat(editingSale.previous_balance)
              : parseFloat(formSelectedCustomer?.cus_balance || 0)));

        const billDataForPrint = buildSaleReceiptBill({
          saleId: savedSaleId,
          billNumber: result.bill_number ?? null,
          formSelectedCustomer: result.customer || formSelectedCustomer,
          finalPaymentTotal,
          grandTotal,
          paymentData,
          cashAmount,
          bankAmount,
          advancePayment,
          selectedBankAccount,
          totalShippingAmount,
          billType,
          cartItems,
          createdAt: result.created_at,
          labourChargesValue,
          previousBalance: resolvedPrevBalance,
        });

        setCurrentBillData(billDataForPrint);
        setReceiptDialogOpen(true);
        endSaving();

        void (async () => {
          if (!savedSaleId) return;
          try {
            const detailRes = await fetch(`/api/sales?id=${savedSaleId}`);
            if (detailRes.ok) {
              const fullBill = await detailRes.json();
              setCurrentBillData((prev) => (
                prev?.sale_id === (fullBill.sale_id ?? savedSaleId)
                  ? { ...prev, ...fullBill, previous_balance: prev.previous_balance ?? fullBill.previous_balance }
                  : prev
              ));
            }
          } catch {
            /* local receipt is enough */
          }
        })();

        const draftIdToDelete = currentDraftId;
        const orderIdToFinalize = loadedOrderId;
        if (orderIdToFinalize) setLoadedOrderId(null);
        if (draftIdToDelete) setCurrentDraftId(null);

        void (async () => {
          if (draftIdToDelete) {
            try {
              await fetch(`/api/draft-sales?id=${draftIdToDelete}`, { method: 'DELETE' });
              if (typeof fetchDrafts === 'function') fetchDrafts();
            } catch (e) {
              console.error('Failed to delete hold bill after sale completion:', e);
            }
          }
        })();

        upsertSaleInList({
          ...billDataForPrint,
          cash_payment: cashAmount,
          bank_payment: bankAmount,
          advance_payment: advancePayment,
          labour_charges: labourChargesValue,
        });
        if (formSelectedCustomer?.cus_id) {
          const nextBal = Number((
            parseFloat(formSelectedCustomer.cus_balance || 0)
            + parseFloat(grandTotal || 0)
            - cashAmount
            - bankAmount
          ).toFixed(2));
          setCustomers((prev) => prev.map((c) => (
            c.cus_id === formSelectedCustomer.cus_id ? { ...c, cus_balance: nextBal } : c
          )));
        }

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
          console.log('âœ… Sale created! Restoring previous screen...');
          const previousIndex = currentScreenIndex - 1;
          const previousState = screenStack[previousIndex];

          // Trim stack to remove current and any forward screens
          const trimmedStack = screenStack.slice(0, currentScreenIndex);

          console.log('ðŸ“š Trimmed screen stack from', screenStack.length, 'to', trimmedStack.length);

          // Set new stack and restore previous state
          setScreenStack(trimmedStack);
          setCurrentScreenIndex(previousIndex);
          restoreScreenState(previousState);

          showSnackbar(`âœ… Sale created! Restored previous screen (${previousState.customerName})`, 'success');
        } else {
          // No previous screen - clear form to start fresh
          console.log('âœ… Sale created! No previous screen, clearing form...');
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
          showSnackbar('âœ… Sale created! Form cleared for next entry', 'success');
        }
      } else if (response) {
        if (!isEditing) {
          setReceiptDialogOpen(false);
          setCurrentBillData(null);
        }
        const errorData = await response.json();
        console.error('âŒ API Error Response:', errorData);
        console.error('âŒ Response Status:', response.status);
        showSnackbar(errorData.error || `Failed to save bill (${response.status})`, 'error');
      }
    } catch (error) {
      if (!editingSale) {
        setReceiptDialogOpen(false);
        setCurrentBillData(null);
      }
      console.error('âŒ Error saving bill:', error);
      console.error('âŒ Error details:', error.message);
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
      fetchFormReferenceData(true);
      setListLoading(false);
      return;
    }

    fetchListFilterData();
  }, []);

  // Load missing data when switching between list and create views (skip initial mount)
  const viewSwitchInitializedRef = useRef(false);
  useEffect(() => {
    if (!viewSwitchInitializedRef.current) {
      viewSwitchInitializedRef.current = true;
      return;
    }

    if (currentView === 'create' && !dataLoadedRef.current.form) {
      fetchFormReferenceData(true);
    } else if (currentView === 'list') {
      if (!dataLoadedRef.current.form && !dataLoadedRef.current.listFilters) {
        fetchListFilterData();
      }
    }
  }, [currentView]);

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

  // Auto-save screen stack (debounced so typing/cart changes don't freeze the form)
  useEffect(() => {
    if (currentScreenIndex < 0) return undefined;
    const timer = window.setTimeout(() => {
      setScreenStack((prev) => {
        if (!prev[currentScreenIndex]) return prev;
        const next = [...prev];
        next[currentScreenIndex] = captureScreenState();
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formSelectedCustomer, formSelectedStore, productTableData, paymentData, billType, currentScreenIndex]);

  // Transport functions
  /** @param {unknown} [categoriesForLookup] â€” pass fresh list from loadData to avoid empty state on first run */
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
      console.error('âŒ Error fetching transport accounts:', error);
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
    console.log('ðŸ” Filtering bank accounts for sales:');
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

    console.log(`âœ… Filtered ${filteredBankAccounts.length} bank accounts (BOTH category AND type contain 'bank', excluding generic)`);
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
            console.log(`âš ï¸ Duplicate bank account detected: ${account.cus_name} (ID: ${account.cus_id})`);
            return false;
          }
          seenIds.add(account.cus_id);
          return true;
        });

        console.log('ðŸ¦ Bank accounts found (after deduplication):', bankAccountsData.length);
        setBankAccounts(bankAccountsData);
      } else {
        console.warn('âš ï¸ Cannot filter bank accounts - missing data');
        setBankAccounts([]);
      }
    } catch (error) {
      console.error('âŒ Error fetching bank accounts:', error);
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

    // Allow duplicate phone numbers â€” do not block creation by phone number.

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

  const upsertSaleInList = (row) => {
    if (!row?.sale_id) return;
    setSales((prev) => {
      const without = (prev || []).filter((s) => s.sale_id !== row.sale_id);
      return [row, ...without];
    });
  };

  const fetchSalesList = async (silent = false) => {
    try {
      listAbortRef.current?.abort();
      const ac = new AbortController();
      listAbortRef.current = ac;
      if (!silent) setListLoading(true);

      const params = new URLSearchParams({
        list: 'true',
        page: String(listPage),
        pageSize: String(listPageSize),
      });
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (debouncedItem.trim()) params.set('item', debouncedItem.trim());
      if (debouncedQuantity.trim()) params.set('quantity', debouncedQuantity.trim());
      if (debouncedNotes.trim()) params.set('notes', debouncedNotes.trim());
      if (filterCustomer) params.set('cus_id', filterCustomer);
      if (filterBillType) params.set('bill_type', filterBillType);
      if (filterStore) params.set('store_id', filterStore);
      if (filterPaymentType) params.set('payment_type', filterPaymentType);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (debouncedMinAmount !== '') params.set('min_amount', debouncedMinAmount);
      if (debouncedMaxAmount !== '') params.set('max_amount', debouncedMaxAmount);
      if (debouncedAmount !== '') params.set('amount', debouncedAmount);
      if (filterBalanceStatus) params.set('balance', filterBalanceStatus);
      if (sortBy) params.set('sort_by', sortBy);
      if (sortOrder) params.set('sort_order', sortOrder);

      const res = await fetch(`/api/sales?${params.toString()}`, {
        cache: 'no-store',
        signal: ac.signal,
      });

      if (!res.ok) throw new Error('Failed to load sales');

      const payload = await res.json();
      if (ac.signal.aborted) return;

      const rows = Array.isArray(payload?.data)
        ? payload.data
        : (Array.isArray(payload) ? payload : []);
      const total = Number(payload?.total);
      setSales(rows);
      setListTotal(Number.isFinite(total) ? total : rows.length);
      dataLoadedRef.current.list = true;

      if (rows.length === 0 && Number.isFinite(total) && total > 0 && listPage > 1) {
        setListPage(1);
      }
    } catch (salesError) {
      if (salesError?.name === 'AbortError') return;
      console.error('Sales/Returns fetch error:', salesError);
      setSales([]);
      setListTotal(0);
    } finally {
      if (!silent) setListLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedItem(filterItem);
      setDebouncedQuantity(filterQuantity);
      setDebouncedNotes(filterNotes);
      setDebouncedAmount(filterAmount);
      setDebouncedMinAmount(filterMinAmount);
      setDebouncedMaxAmount(filterMaxAmount);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm, filterItem, filterQuantity, filterNotes, filterAmount, filterMinAmount, filterMaxAmount]);

  const listUrlView = searchParams?.get('view') || '';
  const listUrlType = searchParams?.get('type') || '';
  const salesListEffectKey = [
    currentView,
    listPage,
    listPageSize,
    debouncedSearch,
    debouncedItem,
    debouncedQuantity,
    debouncedNotes,
    filterCustomer,
    filterBillType,
    filterStore,
    filterPaymentType,
    debouncedAmount,
    debouncedMinAmount,
    debouncedMaxAmount,
    filterBalanceStatus,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    listUrlView,
    listUrlType,
  ].join('\u0001');

  useEffect(() => {
    if (currentView !== 'list') return;
    if (listUrlView === 'create' || listUrlType === 'return') return;
    const filterKey = [
      debouncedSearch,
      debouncedItem,
      debouncedQuantity,
      debouncedNotes,
      filterCustomer,
      filterBillType,
      filterStore,
      filterPaymentType,
      debouncedAmount,
      debouncedMinAmount,
      debouncedMaxAmount,
      filterBalanceStatus,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      listPageSize,
    ].join('|');

    if (listFilterKeyRef.current !== filterKey) {
      listFilterKeyRef.current = filterKey;
      if (listPage !== 1) {
        setListPage(1);
        return;
      }
    }

    fetchSalesList();
  }, [salesListEffectKey]);

  const handlePageChange = (newPage) => {
    const totalPages = Math.max(1, Math.ceil(listTotal / listPageSize));
    const target = Math.max(1, Math.min(newPage, totalPages));
    setListPage(target);
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchListFilterData = async () => {
    if (dataLoadedRef.current.form || dataLoadedRef.current.listFilters) return;

    try {
      const [customersRes, storesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true&lite=true'),
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
    if (formFetchInFlightRef.current) {
      await formFetchInFlightRef.current;
      return;
    }

    const runFetch = async () => {
      try {
        if (!silent) setFormRefLoading(true);

        const needCustomers = !dataLoadedRef.current.customersFull;
        const needProducts = products.length === 0;
        const needCustomerTypes = customerTypes.length === 0;
        const needStores = stores.length === 0;
        const needCustomerCategories = customerCategories.length === 0;

        const [customersRes, productsRes, customerTypesRes, storesRes, customerCategoriesRes] = await Promise.all([
          needCustomers ? fetch('/api/customers?dropdown=true') : Promise.resolve(null),
          needProducts ? fetch('/api/products?dropdown=true&noStoreStock=true') : Promise.resolve(null),
          needCustomerTypes ? fetch('/api/customer-types') : Promise.resolve(null),
          needStores ? fetch('/api/stores') : Promise.resolve(null),
          needCustomerCategories ? fetch('/api/customer-category') : Promise.resolve(null)
        ]);

        let customersArrayForRefetch = customers.length > 0 ? customers : null;
        let parsedCustomerCategories = customerCategories.length > 0 ? customerCategories : null;
        let parsedCustomerTypes = customerTypes.length > 0 ? customerTypes : null;

        if (customersRes) {
          if (customersRes.ok) {
            const customersResponse = await customersRes.json();
            const customersData = customersResponse.value || customersResponse;
            const customersArray = Array.isArray(customersData) ? customersData : [];
            customersArrayForRefetch = customersArray;
            setCustomers(customersArray);
            dataLoadedRef.current.customersFull = true;
          } else {
            setCustomers([]);
          }
        }

        if (productsRes) {
          if (productsRes.ok) {
            const productsData = await productsRes.json();
            setProducts(productsData || []);
          } else {
            setProducts([]);
          }
        }

        if (customerTypesRes) {
          if (customerTypesRes.ok) {
            const customerTypesResponse = await customerTypesRes.json();
            const customerTypesData = customerTypesResponse.value || customerTypesResponse;
            parsedCustomerTypes = Array.isArray(customerTypesData) ? customerTypesData : (customerTypesData || []);
            setCustomerTypes(parsedCustomerTypes);
          }
        }

        if (storesRes) {
          if (storesRes.ok) {
            const storesResponse = await storesRes.json();
            const storesData = storesResponse.data || storesResponse;
            setStores(Array.isArray(storesData) ? storesData : []);
          } else {
            setStores([]);
          }
        }

        if (customerCategoriesRes) {
          if (customerCategoriesRes.ok) {
            const customerCategoriesData = await customerCategoriesRes.json();
            parsedCustomerCategories = Array.isArray(customerCategoriesData) ? customerCategoriesData : (customerCategoriesData || []);
            setCustomerCategories(parsedCustomerCategories);
          } else {
            setCustomerCategories([]);
          }
        }

        if (customersArrayForRefetch && customersArrayForRefetch.length > 0) {
          fetchBankAccounts(customersArrayForRefetch);
          fetchTransportAccounts(customersArrayForRefetch, parsedCustomerCategories, parsedCustomerTypes);
        }

        dataLoadedRef.current.form = true;
        dataLoadedRef.current.listFilters = true;
      } catch (error) {
        console.error('Error fetching form reference data:', error);
        if (!silent) showSnackbar('Error fetching data', 'error');
      } finally {
        if (!silent) setFormRefLoading(false);
      }
    };

    formFetchInFlightRef.current = runFetch();
    try {
      await formFetchInFlightRef.current;
    } finally {
      formFetchInFlightRef.current = null;
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
      dataLoadedRef.current.customersFull = true;
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

    dataLoadedRef.current = { list: false, form: false, listFilters: false, dialogLookups: false, customersFull: false };
    setSales([]);
    setListTotal(0);
    setListPage(1);

    if (currentView === 'list') {
      fetchListFilterData();
    } else {
      fetchFormReferenceData(true);
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
        console.log('ðŸ“ Drafts loaded:', draftsList.length);
      } else {
        console.error('âŒ Failed to fetch drafts');
        setDrafts([]);
      }
    } catch (error) {
      console.error('âŒ Error fetching drafts:', error);
      setDrafts([]);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  // Save current form as draft
  const resolveBillWhatsAppPhone = useCallback((bill, customPhone) => {
    if (customPhone) {
      return formatWhatsAppPhone(customPhone) || resolveCustomerWhatsAppPhone({ cus_phone_no: customPhone });
    }
    let phone = resolveCustomerWhatsAppPhone(bill?.customer);
    if (phone) return phone;
    const cusId = bill?.cus_id ?? bill?.customer?.cus_id;
    if (cusId && customers?.length) {
      const row = customers.find((c) => Number(c.cus_id) === Number(cusId));
      phone = resolveCustomerWhatsAppPhone(row);
      if (phone) return phone;
    }
    return null;
  }, [customers]);

  const handleSendWhatsApp = async (bill, customPhone, elementId = 'receipt-preview') => {
    try {
      setIsSendingWhatsApp(true);
      const { shareViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      let phone = resolveBillWhatsAppPhone(bill, customPhone);
      if (!phone) {
        const manual = window.prompt(
          'Customer phone is missing or invalid.\nEnter WhatsApp number (e.g. 0300-7560306):',
          formatCustomerPhoneDisplay(bill?.customer) !== 'N/A' ? formatCustomerPhoneDisplay(bill?.customer) : ''
        );
        if (!manual?.trim()) {
          showSnackbar('WhatsApp cancelled — phone number required', 'info');
          return;
        }
        phone = formatWhatsAppPhone(manual) || resolveCustomerWhatsAppPhone({ cus_phone_no: manual });
        if (!phone) {
          showSnackbar('Invalid phone number. Use format 03XX-XXXXXXX', 'error');
          return;
        }
      }
      const { opened } = await shareViaWhatsAppDesktop({
        elementId,
        phone,
      });
      showSnackbar(whatsAppSuccessMessage(opened), 'success');
    } catch (err) {
      showSnackbar(`WhatsApp error: ${err.message}`, 'error');
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
    if (!details.length) return 'â€”';

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
    if (filterQuantity) parts.push(`Qty: ${filterQuantity}`);
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
            <td class="col-ref">${escapePrintHtml(sale.reference || 'â€”')}</td>
            <td class="num col-total">${fmtAmt(sale.total_amount)}</td>
            <td class="num">${fmtAmt(sale.discount)}</td>
            <td class="num">${fmtAmt(sale.shipping_amount)}</td>
            <td class="num col-payment">${fmtAmt(sale.payment)}</td>
            <td class="num col-balance ${balanceClass}">${fmtAmt(balance)}</td>
            <td class="c col-type ${isReturn ? 'type-return' : 'type-bill'}">${escapePrintHtml(billType)}</td>
            <td class="c col-date">${formatDatePK(sale?.created_at) || 'â€”'}</td>
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
      <div class="urdu-name" style="font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Urdu Typesetting',serif !important;">Ø§ØªÙØ§Ù‚ Ø¢Ø¦Ø±Ù† Ø§ÛŒÙ†Úˆ Ø³ÛŒÙ…Ù†Ù¹ Ø³Ù¹ÙˆØ±</div>
      <div class="urdu-address">Ú¯Ø¬Ø±Ø§Øª Ø³Ø±Ú¯ÙˆØ¯Ú¾Ø§ Ø±ÙˆÚˆØŒ Ù¾Ø§ÛÚ‘ÛŒØ§Ù†ÙˆØ§Ù„ÛŒ</div>
      <div class="phone">${INVOICE_STORE_PHONE_LINE.replace('Ph:- ', 'Ph: ')}</div>
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
      showSnackbar('No sales to print on this page.', 'warning');
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

        // Always use POST â€” PUT handler only toggles is_active and would deactivate the draft
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

      // Always use POST â€” the API's POST handler supports both create and update
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
        showSnackbar(`âœ… Draft saved as ${savedDraft.draft_code}`, 'success');

        // Refresh drafts list
        await fetchDrafts();
      } else {
        const error = await response.json();
        showSnackbar(`Failed to save draft: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('âŒ Error saving draft:', error);
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

      console.log('ðŸ“– Loading draft:', formState);

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

      showSnackbar(`âœ… Draft ${draft.draft_code} loaded successfully`, 'success');
    } catch (error) {
      console.error('âŒ Error loading draft:', error);
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
        showSnackbar(`âœ… Draft ${draftCode} deleted`, 'success');

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
      console.error('âŒ Error deleting draft:', error);
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
    console.log('ðŸ“‹ Viewing bill:', sale);

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

      console.log('ðŸ’° Fresh data with payments:', formattedData);

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
    console.log('ðŸ“‹ Viewing receipt:', sale);

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

      console.log('ðŸ’° Fresh data with payments:', formattedData);

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
        } catch (_) { }
        if (errMsg === 'Sale not found') {
          errMsg = 'Order does not exist. Please check the Order Number.';
        }
        showSnackbar(errMsg, 'error');
        return;
      }

      const orderData = await response.json();

      console.log('ðŸ“¦ ORDER LOADED FROM SEARCH:', orderData);
      console.log('ðŸ” ORDER DATA DETAILS:');
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
        console.log('  ðŸ“¦ Product Items Count:', orderData.sale_details.length);
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
          cost_price: getProductCostPrice(detail.product),
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

      console.log('ðŸ“¦ Loaded Sale for Return:', fullSale);
      console.log('ðŸ” SALE DETAILS FOR RETURN:');
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

      console.log('ðŸ’¾ PAYMENT DATA BEING SET:');
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
          cost_price: getProductCostPrice(detail.product),
          stock: detail.product?.pro_stock_qnty || 0
        }));
        setProductTableData(products);
        console.log('ðŸ“¦ Products loaded:', products);
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

      console.log('âœ… FINAL VALUES BEING DISPLAYED:');
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

  const resolveBillForActions = async (bill) => {
    if (!bill) return null;
    const isReturn = bill.is_return || bill.bill_type === 'SALE_RETURN';
    const returnId = bill.return_id
      || (typeof bill.sale_id === 'string' && bill.sale_id.startsWith('SR-')
        ? parseInt(bill.sale_id.replace('SR-', ''), 10)
        : bill.sale_id);
    const endpoint = isReturn ? `/api/sale-returns?id=${returnId}` : `/api/sales?id=${bill.sale_id}`;
    const response = await fetch(endpoint);
    if (!response.ok) return bill;
    const data = await response.json();
    if (isReturn) {
      return {
        ...data,
        is_return: true,
        bill_type: 'SALE_RETURN',
        sale_id: `SR-${data.return_id}`,
        actual_sale_id: data.sale_id,
        sale_details: (data.return_details || []).map((d) => ({
          ...d,
          product: d.product,
          product_name: d.product?.pro_title,
          qnty: Number(d.qnty || d.return_quantity || 0),
          unit_rate: Number(d.unit_rate || 0),
          total_amount: Number(d.total_amount || d.return_amount || 0),
        })),
      };
    }
    return { ...data, notes: data.notes || data.reference || null };
  };

  // Handle print bill with mode (A4 or Thermal or Existing)
  const handlePrintBill = async (mode = 'A4', fromDialog = false, targetBill = null) => {
    try {
      const actualMode = typeof mode === 'string' ? mode : 'A4';
      const className = actualMode === 'THERMAL'
        ? 'print-thermal'
        : (actualMode === 'EXISTING' ? 'print-existing' : 'print-a4');
      const isThermal = actualMode === 'THERMAL';

      let activeBill = targetBill || currentBillData || selectedBill;
      if (targetBill && !fromDialog) {
        activeBill = await resolveBillForActions(targetBill);
      }
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

  const filteredSales = sales;



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
      const isReturn = Boolean(
        sale.is_return ||
        sale.bill_type === 'SALE_RETURN' ||
        (typeof sale.sale_id === 'string' && sale.sale_id.startsWith('SR-'))
      );
      const returnId = isReturn
        ? (sale.return_id || (typeof sale.sale_id === 'string' ? parseInt(sale.sale_id.replace('SR-', '')) : sale.sale_id))
        : null;

      let fullSale;
      if (isReturn) {
        const res = await fetch(`/api/sale-returns?id=${returnId}`);
        fullSale = res.ok ? await res.json() : sale;
      } else {
        const res = await fetch(`/api/sales?id=${sale.sale_id}`);
        fullSale = res.ok ? await res.json() : sale;
      }

      if (isReturn) {
        const mappedReturn = {
          ...fullSale,
          return_id: returnId || fullSale.return_id,
          sale_id: `SR-${returnId || fullSale.return_id}`,
          actual_sale_id: fullSale.sale_id,
          bill_type: 'SALE_RETURN',
          is_return: true,
        };
        setEditingSale(mappedReturn);

        // Customer
        const customer = customers.find(c => c.cus_id === fullSale.cus_id);
        setFormSelectedCustomer(customer || fullSale.customer || null);

        // Store
        const returnDetails = fullSale.return_details || fullSale.sale_details || [];
        const finalStoreId = fullSale.store_id || (returnDetails.length > 0 ? returnDetails[0].store_id : null);
        const store = stores.find(s => s.storeid === finalStoreId);
        setFormSelectedStore(store || (stores.length > 0 ? stores[0] : null));

        // Bill type
        setBillType('SALE_RETURN');

        // Product rows from return_details
        setProductTableData(returnDetails.map((detail, index) => {
          const detailStoreId = detail.store_id || finalStoreId;
          const matchingStore = stores.find(s => s.storeid === detailStoreId);
          const qnty = parseFloat(detail.qnty || detail.return_quantity || 0);
          const rate = parseFloat(detail.unit_rate || 0);
          const amt = parseFloat(detail.total_amount || detail.return_amount || (qnty * rate) || 0);
          return {
            id: detail.return_detail_id || detail.sale_detail_id || (Date.now() + index),
            pro_id: detail.pro_id,
            pro_title: detail.product?.pro_title || detail.pro_title || `Product #${detail.pro_id}`,
            storeid: detailStoreId || '',
            store_name: matchingStore?.store_name || detail.store?.store_name || '',
            quantity: qnty,
            rate: rate,
            amount: amt,
            stock: 0,
            unit: detail.unit || 'PCS',
            crate: rate,
            size: detail.size || '',
            cost_price: getProductCostPrice(detail.product)
          };
        }));

        setTransportOptions([]);
        setNewTransport({ amount: 0, accountId: '' });

        // Payment data
        const cashAmt = parseFloat(fullSale.cash_return || fullSale.cash_payment || 0);
        const bankAmt = parseFloat(fullSale.bank_return || fullSale.bank_payment || 0);
        const totalRefund = parseFloat(fullSale.payment || 0);
        const fullShippingAmt = parseFloat(fullSale.shipping_amount || 0);
        const labourAmt = parseFloat(fullSale.labour_charges || 0);

        setPaymentData(normalizePaymentData({
          cash: cashAmt > 0 ? cashAmt.toString() : (fullSale.payment_type === 'CASH' && totalRefund > 0 ? totalRefund.toString() : ''),
          bank: bankAmt > 0 ? bankAmt.toString() : (fullSale.payment_type !== 'CASH' && totalRefund > 0 ? totalRefund.toString() : ''),
          bankAccountId: fullSale.bank_account_id || fullSale.debit_account_id || '',
          totalCashReceived: totalRefund,
          advancePayment: 0,
          discount: fullSale.discount?.toString() || '',
          labour: labourAmt > 0 ? labourAmt.toString() : '',
          deliveryCharges: fullShippingAmt > 0 ? fullShippingAmt.toString() : '',
          notes: fullSale.reference || fullSale.reason || fullSale.notes || ''
        }));

        setCurrentView('create');
        return;
      }

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
          crate: parseFloat(detail.unit_rate),
          size: detail.size || '',
          cost_price: getProductCostPrice(detail.product)
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
      setListTotal((n) => Math.max(0, n - 1));
      fetchSalesList(true);
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
    setFilterQuantity('');
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
    setDateFrom(getPkDateString());
    setDateTo(getPkDateString());
    setSortBy('created_at');
    setSortOrder('desc');
    setListPage(1);
  };

  const salesContextValue = {
    // Aliases for component compatibility
    customerCities: cities,
    setCustomerCities: setCities,
    customerAreas: [],
    setCustomerAreas: () => {},
    categories: productCategories,
    setCategories: setProductCategories,
    subcategories: productSubcategories,
    setSubcategories: setProductSubcategories,
    subsubcategories: [],
    setSubsubcategories: () => {},
    productTypes: [],
    setProductTypes: () => {},
    productBrands: [],
    setProductBrands: () => {},
    weightSizes: [],
    setWeightSizes: () => {},
    vehicles: [],
    setVehicles: () => {},
    visibleCrates,
    setVisibleCrates,
    toggleVisibleCrate,
    bookNoInput: "",
    setBookNoInput: () => {},
    selectedCity: null,
    setSelectedCity: () => {},
    selectedArea: null,
    setSelectedArea: () => {},
    selectedVehicle: null,
    setSelectedVehicle: () => {},
    selectedSubcategory: null,
    setSelectedSubcategory: () => {},
    selectedSubsubcategory: null,
    setSelectedSubsubcategory: () => {},
    selectedProductType: null,
    setSelectedProductType: () => {},
    selectedBrand: null,
    setSelectedBrand: () => {},
    selectedWeightSize: null,
    setSelectedWeightSize: () => {},
    weightSizeInput: "",
    setWeightSizeInput: () => {},
    productFtLengthInput: "",
    setProductFtLengthInput: () => {},
    productQtyInput: "",
    setProductQtyInput: () => {},
    productRateInput: "",
    setProductRateInput: () => {},
    productRemarksInput: "",
    setProductRemarksInput: () => {},
    editingTableIndex: null,
    setEditingTableIndex: () => {},
    productTableFocusedIndex: -1,
    setProductTableFocusedIndex: () => {},
    viewBillOpen: viewBillDialog,
    setViewBillOpen: setViewBillDialog,
    selectedSaleForView: selectedBill,
    setSelectedSaleForView: setSelectedBill,
    loadOrderOpen: loadOrderDialogOpen,
    setLoadOrderOpen: setLoadOrderDialogOpen,
    loadOrderSearch: orderSearchTerm,
    setLoadOrderSearch: setOrderSearchTerm,
    loadOrderCustomerFilter: "",
    setLoadOrderCustomerFilter: () => {},
    loadOrderCityFilter: "",
    setLoadOrderCityFilter: () => {},
    loadOrderAreaFilter: "",
    setLoadOrderAreaFilter: () => {},
    loadOrderDateFrom: "",
    setLoadOrderDateFrom: () => {},
    loadOrderDateTo: "",
    setLoadOrderDateTo: () => {},
    loadOrderVehicleFilter: "",
    setLoadOrderVehicleFilter: () => {},
    loadOrders: loadOrderList,
    setLoadOrders: setLoadOrderList,
    loadOrderLoading: loadOrderListLoading,
    setLoadOrderLoading: setLoadOrderListLoading,
    loadOrderProcessingId: null,
    setLoadOrderProcessingId: () => {},
    loadOrderPage: 1,
    setLoadOrderPage: () => {},
    loadOrderPageSize: 10,
    setLoadOrderPageSize: () => {},
    loadOrderTotal: 0,
    setLoadOrderTotal: () => {},
    newVehicleName: "",
    setNewVehicleName: () => {},
    openReturnDialog: returnDialogOpen,
    setOpenReturnDialog: setReturnDialogOpen,
    saleToReturn: selectedSaleForReturn,
    setSaleToReturn: setSelectedSaleForReturn,
    returnItems: [],
    setReturnItems: () => {},
    returnReason: "",
    setReturnReason: () => {},
    refundMethod: "",
    setRefundMethod: () => {},
    isProcessingReturn: false,
    setIsProcessingReturn: () => {},
    selectedCustomerForLedger: formSelectedCustomer,
    setSelectedCustomerForLedger: () => {},
    ledgerTransactions: ledgerData,
    setLedgerTransactions: setLedgerData,
    showCustomerPopup: customerPopupOpen,
    setShowCustomerPopup: setCustomerPopupOpen,
    customerFormData: newCustomer,
    setCustomerFormData: setNewCustomer,
    customerFormErrors: {},
    setCustomerFormErrors: () => {},
    submittingCustomer: isSavingCustomer,
    setSubmittingCustomer: setIsSavingCustomer,
    newProductData: addProductFormData,
    setNewProductData: setAddProductFormData,
    newProductErrors: {},
    setNewProductErrors: () => {},
    submittingProduct: isAddingProduct,
    setSubmittingProduct: setIsAddingProduct,
    newProductCategoryTitle: addProductCategoryName,
    setNewProductCategoryTitle: setAddProductCategoryName,
    submittingProductCategory: isAddingProductCategory,
    setSubmittingProductCategory: setIsAddingProductCategory,
    newProductSubCategoryData: addProductSubCategoryFormData,
    setNewProductSubCategoryData: setAddProductSubCategoryFormData,
    submittingProductSubCategory: isAddingProductSubCategory,
    setSubmittingProductSubCategory: setIsAddingProductSubCategory,
    showAddCustomerCityPopup: showCityPopup,
    setShowAddCustomerCityPopup: setShowCityPopup,
    newCustomerCityName: cityFormData,
    setNewCustomerCityName: setCityFormData,
    submittingCustomerCity: isAddingCity,
    setSubmittingCustomerCity: setIsAddingCity,
    lossWarningDialogOpen: lossConfirmOpen,
    setLossWarningDialogOpen: setLossConfirmOpen,
    lossWarningData: lossItems,
    setLossWarningData: setLossItems,
    pendingLossAction: null,
    setPendingLossAction: () => {},
    biometricAuthOpen: false,
    setBiometricAuthOpen: () => {},
    pendingAuthAction: null,
    setPendingAuthAction: () => {},
    authReason: "",
    setAuthReason: () => {},
    biometricSubmitting: false,
    setBiometricSubmitting: () => {},
    selectedCustomer: formSelectedCustomer,
    getHighlightedOptionIndex: () => -1,
    fetchLoadOrders: () => {},
    closeLoadOrderDialog: () => setLoadOrderDialogOpen(false),
    handleSelectLoadOrder: handleLoadOrder,
    filteredProductsForSale: [],
    handleQtyKeyDown: () => {},
    handleRemarksKeyDown: () => {},
    filteredSales: sales,
    productQtyRefs: { current: [] },
    productFeetRefs: { current: [] },
    productRateRefs: { current: [] },
    sellingBelowCostAuthRequired: false,
    handleAddVehicle: () => {},
    handleWeightSizeKeyPress: () => {},
    handleRateKeyDown: () => {},
    handleCostRateLockIconClick: () => {},
    handleUpdateTableItem: () => {},

    // Primary State Variables & Setters
    currentView, setCurrentView,
    sales, setSales,
    customers, setCustomers,
    customerCategories, setCustomerCategories,
    customerTypes, setCustomerTypes,
    products, setProducts,
    productCategories, setProductCategories,
    productSubcategories, setProductSubcategories,
    stores, setStores,
    saleEntryDate, setSaleEntryDate,
    billType, setBillType,
    selectedCustomerTypeFilter, setSelectedCustomerTypeFilter,
    customerTypeFilterOpen, setCustomerTypeFilterOpen,
    salePageCustomerTypeOptions,
    formSelectedStore, setFormSelectedStore,
    formSelectedProduct, setFormSelectedProduct,
    productFormData, setProductFormData,
    productTableData, setProductTableData,
    formSelectedCustomer, setFormSelectedCustomer,
    paymentData, setPaymentData,
    loading, setLoading,
    formRefLoading, setFormRefLoading,
    listLoading, setListLoading,
    savingBill, setSavingBill,
    editingSale, setEditingSale,
    receiptDialogOpen, setReceiptDialogOpen,
    currentBillData, setCurrentBillData,
    loadedOrderId, setLoadedOrderId,
    transportOptions, setTransportOptions,
    transportAccounts, setTransportAccounts,
    bankAccounts, setBankAccounts,
    newTransport, setNewTransport,
    handleAddTransport, handleRemoveTransport,
    formatTransportAccountLabel,
    loadQuotationDialogOpen, setLoadQuotationDialogOpen,
    quotationSearchTerm, setQuotationSearchTerm,
    draftModalOpen, setDraftModalOpen,
    drafts, setDrafts,
    draftSearchTerm, setDraftSearchTerm,
    isSavingDraft, setIsSavingDraft,
    currentDraftId, setCurrentDraftId,
    screenStack, setScreenStack,
    currentScreenIndex, setCurrentScreenIndex,
    isOnline, setIsOnline,
    offlineQueueCount, setOfflineQueueCount,
    isSyncingOffline, setIsSyncingOffline,
    selectedSaleForReturnMain, setSelectedSaleForReturnMain,
    saleSearchOpen, setSaleSearchOpen,
    saleSearchResults, setSaleSearchResults,
    ledgerDialogOpen, setLedgerDialogOpen,
    ledgerLoading, setLedgerLoading,
    showAddProductPopup, setShowAddProductPopup,
    showAddProductCategoryPopup, setShowAddProductCategoryPopup,
    showAddProductSubCategoryPopup, setShowAddProductSubCategoryPopup,
    orderSearchTerm, setOrderSearchTerm,
    isSearchingOrder, setIsSearchingOrder,
    searchTerm, setSearchTerm,
    filterItem, setFilterItem,
    filterQuantity, setFilterQuantity,
    filterNotes, setFilterNotes,
    filterCustomer, setFilterCustomer,
    filterBillType, setFilterBillType,
    filterStore, setFilterStore,
    filterPaymentType, setFilterPaymentType,
    filterAmount, setFilterAmount,
    filterMinAmount, setFilterMinAmount,
    filterMaxAmount, setFilterMaxAmount,
    filterBalanceStatus, setFilterBalanceStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    listPage, setListPage,
    listPageSize, setListPageSize,
    listTotal, setListTotal,
    jumpToPage, setJumpToPage,
    snackbar, setSnackbar,
    editingCustomer,

    // Dialog & Specific State
    showAddProductCategoryPopup, setShowAddProductCategoryPopup,
    showAddProductSubCategoryPopup, setShowAddProductSubCategoryPopup,
    showCustomerCategoryPopup, setShowCustomerCategoryPopup,
    showCustomerTypePopup, setShowCustomerTypePopup,
    showCityPopup, setShowCityPopup,
    addProductFormData, setAddProductFormData,
    isAddingProduct, setIsAddingProduct,
    productCatInput, setProductCatInput,
    productSubCatInput, setProductSubCatInput,
    addProductCategoryName, setAddProductCategoryName,
    isAddingProductCategory, setIsAddingProductCategory,
    addProductSubCategoryFormData, setAddProductSubCategoryFormData,
    isAddingProductSubCategory, setIsAddingProductSubCategory,
    customerCategoryFormData, setCustomerCategoryFormData,
    isAddingCustomerCategory, setIsAddingCustomerCategory,
    customerTypeFormData, setCustomerTypeFormData,
    isAddingCustomerType, setIsAddingCustomerType,
    cityFormData, setCityFormData,
    isAddingCity, setIsAddingCity,
    lossConfirmOpen, setLossConfirmOpen,
    lossItems, setLossItems,
    selectedBill, setSelectedBill,
    currentUser, setCurrentUser,
    isWalkinCustomer,
    getBillDisplayNo,
    getSaleDetailsInAddOrder,
    fmtAmt, fmtRateQty,
    isSendingWhatsApp, setIsSendingWhatsApp,
    ledgerStartDate, setLedgerStartDate,
    ledgerEndDate, setLedgerEndDate,
    ledgerData, setLedgerData,
    loadOrderDialogOpen, setLoadOrderDialogOpen,
    loadOrderListLoading, setLoadOrderListLoading,
    loadOrderList, setLoadOrderList,
    customerNameInputRef,
    newCustomer, setNewCustomer,
    customerTypeOpen, setCustomerTypeOpen,
    customerTypeInputRef,
    cities, setCities,
    customerCities: cities, setCustomerCities: setCities,
    isSavingCustomer, setIsSavingCustomer,
    returnDialogOpen, setReturnDialogOpen,
    selectedSaleForReturn, setSelectedSaleForReturn,
    returnFormData, setReturnFormData,
    viewBillDialog, setViewBillDialog,

    // Refs
    customerHighlightRef,
    customerTypeHighlightRef,
    cityHighlightRef,
    areaHighlightRef,
    storeHighlightRef,
    vehicleHighlightRef,
    subcategoryHighlightRef,
    subsubcategoryHighlightRef,
    productTypeHighlightRef,
    brandHighlightRef,
    productHighlightRef,
    weightSizeHighlightRef,
    tableContainerRef,
    dataLoadedRef,

    // Handlers
    showSnackbar,
    handleSnackbarClose,
    commitDropdownOnTab,
    fetchFormReferenceData,
    fetchSalesList,
    openLoadOrderDialog,
    filterSaleProducts,
    handleAddProductToTable,
    handleRemoveProductFromTable,
    moveProductRow,
    paymentInputValue,
    handlePaymentDataChange,
    calculateTotalAmount,
    calculateTransportTotal,
    calculateGrandTotal,
    calculateBalance,
    autoHoldIfActive,
    clearFormState,
    handleSaveBill,
    handleSaveDraft,
    fetchDrafts,
    handleLoadDraft,
    handleDeleteDraft,
    handleSearchOrder,
    handleLoadQuotation,
    triggerAutoSync,
    cancelCurrentScreen,
    handleOpenLedger,
    handleOpenEditCustomer,
    handleOpenCustomerPopup,
    handleOpenReturnDialog,
    handleOpenCustomerLedger,
    fetchLedgerData,
    handleViewBill,
    resolveBillForActions,
    handleEdit,
    handlePrintBill,
    handlePrintSalesList,
    clearFilters,
    handlePageChange,
    renderSaleLineItemsCell,
    handleAddProductQuick,
    handleAddProductCategory,
    handleAddProductSubCategory,
    setShowCustomerCategoryPopup,
    handleAddCustomerCategory,
    setShowCustomerTypePopup,
    handleAddCustomerType,
    setShowCityPopup,
    handleAddCity,
    handleCloseCustomerPopup,
    handleCreateCustomer,
    handleAuthSuccess,
    handleAuthCancel,
    handleSendWhatsApp,
    handleLoadOrder,
    handleCloseReturnDialog,
    updateReturnDetailQty,
    removeReturnDetail,
    handleReturnInputChange,
    calculateReturnTotal,
    calculateReturnNetTotal,
    handleSubmitReturn,
    handleCloseBillDialog,
    handleLoadSaleForReturnMain,
    handleSaleSearch,
    handleProductSelect,
    handleQuantityChange,
    handleRateChange,
    filterSaleCustomers,
    getCartLineCostRate,
    getFocusedAutocompleteOption,
    matchesCustomerType,
    isCustomerAccount,
    EMPTY_PAYMENT_DATA,
  };

  return (
    <SalesProvider value={salesContextValue}>
      {currentView === 'list' ? <SaleListView /> : <SaleCreateView />}

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

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />


      <SalePrintableBill />
      <SaleReceiptDialog />
      <SaleLoadOrderDialog />
      <SaleViewBillDialog />
      <SaleReturnDialog />
      <SaleLedgerDialog />
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
            Warning: Selling Below Cost Price
          </Typography>
          <IconButton onClick={() => setLossConfirmOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
          <Typography variant="body1" color="text.primary" sx={{ mb: 2, fontWeight: 'medium' }}>
            The following product(s) are being sold at a rate less than their cost price (selling at a loss):
          </Typography>
          <Box sx={{ bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
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
          <Button onClick={() => setLossConfirmOpen(false)} variant="outlined" color="inherit" sx={{ textTransform: 'none', borderRadius: 2 }}>
            No, Cancel
          </Button>
          <Button
            onClick={async () => { setLossConfirmOpen(false); await handleSaveBill(true); }}
            variant="contained" color="error"
            sx={{ background: 'linear-gradient(45deg, #d32f2f 30%, #f44336 90%)', textTransform: 'none', borderRadius: 2 }}
          >
            Yes, Save Anyway
          </Button>
        </DialogActions>
      </Dialog>
      <SaleAddProductDialog />
    </SalesProvider>
  );
}


