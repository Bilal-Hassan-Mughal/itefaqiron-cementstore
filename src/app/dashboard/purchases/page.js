'use client';

import { useState, useEffect, useCallback, Suspense, useRef, useLayoutEffect } from 'react';
import { getCreatedByName, formatTimePK, formatDatePK } from '@/lib/date-helper';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
import SaveProgressBackdrop from '../components/save-progress-backdrop';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH, notifyLedgerDataChanged } from '@/lib/ledger-tabs';

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
  Menu
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
  BarChart as BarChartIcon,
  LocalShipping as TruckIcon,
  Inventory as PackageIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  ArrowBack as ArrowLeftIcon,
  ArrowForward as ArrowRightIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  AttachMoney as AttachMoneyIcon,
  Business as BusinessIcon,
  LocationOn as MapPinIcon,
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
  const [loading, setLoading] = useState(true);
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
      date: new Date().toISOString().split('T')[0],
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
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const beginSaving = (message) => {
    setIsSubmitting(true);
    setSaveStatusMessage(message);
  };

  const updateSaveStatus = (message) => {
    setSaveStatusMessage(message);
  };

  const endSaving = () => {
    setIsSubmitting(false);
    setSaveStatusMessage('');
  };

  // Customer form states
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerTypeOpenPurchases, setCustomerTypeOpenPurchases] = useState(false);
  const customerTypeInputRefPurchases = useRef(null);
  const customerNameInputRefPurchases = useRef(null);
  // Track highlighted option for each dropdown so Tab selects the focused item
  const highlightedTypeRef = useRef(null);
  const highlightedCategoryRef = useRef(null);
  const highlightedCityRef = useRef(null);

  // Refs for keyboard accessibility
  const bankAccountInputRef = useRef(null);
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

  // Handle print receipt (A4 / Thermal) - copied from sales print logic and adapted for purchases
  const handlePrintReceipt = (mode = 'A4', fromDialog = false) => {
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

      // If printing from dialog for A4, copy receipt preview content (do NOT overwrite thermal template)
      if (fromDialog && !isThermal) {
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

      printableContainer.style.position = 'fixed';
      printableContainer.style.left = '0';
      printableContainer.style.top = '0';
      printableContainer.style.visibility = 'visible';
      printableContainer.style.display = 'block';
      printableContainer.style.zIndex = '9999';
      printableContainer.style.backgroundColor = 'white';

      let styleId = 'dynamic-print-style-purchase';
      let styleElement = document.getElementById(styleId);

      if (isThermal) {
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = styleId;
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = `@media print { @page { size: 80mm portrait; margin: 0; } }`;
      } else if (styleElement) {
        styleElement.textContent = `@media print { @page { size: A4; margin: 0.5cm 1cm; } }`;
      }

      document.body.classList.add(className);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          // restore styles
          printableContainer.style.position = originalStyles.position;
          printableContainer.style.left = originalStyles.left;
          printableContainer.style.top = originalStyles.top;
          printableContainer.style.visibility = originalStyles.visibility;
          printableContainer.style.display = originalStyles.display;
          printableContainer.style.zIndex = '';
          printableContainer.style.backgroundColor = '';

          document.body.classList.remove('print-thermal');
          document.body.classList.remove('print-a4');

          if (styleElement && isThermal) {
            styleElement.remove();
          }
        }, 100);
      }, 100);
    } catch (e) {
      console.error('Print error (purchases):', e);
      window.print();
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

  // Auto-save draft whenever form state changes
  useEffect(() => {
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

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

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
        cargo_account_id: '',
        include_incity: false,
        include_labour: false,
        discount: '',
        cash_payment: '',
        bank_payment: '',
        payment_type: 'CASH',
        vehicle_no: '',
        invoice_number: '',
        date: new Date().toISOString().split('T')[0],
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

  // Clear form state
  const clearFormState = () => {
    setFormData({
      cus_id: '',
      store_id: stores[0]?.storeid?.toString() || '',
      debit_account_id: '',
      credit_account_id: '',
      total_amount: '',
      unloading_amount: '',
      fare_amount: '',
      transport_amount: '',
      labour_amount: '',
      out_labour_amount: '',
      out_delivery_amount: '',
      incity_own_labour: '',
      incity_own_delivery: '',
      incity_charges_total: '',
      include_labour: false,
      include_cargo_in_costprice: false,
      discount: '',
      cash_payment: '',
      bank_payment: '',
      payment_type: 'CASH',
      vehicle_no: '',
      invoice_number: '',
      date: new Date().toISOString().split('T')[0],
      purchase_details: []
    });
    setSelectedBankAccount(null);
    setSelectedCargoAccounts([]);
    setFormSelectedCustomer(null);
    setPurchaseType('new');
    setSelectedPurchaseForReturn(null);
    setEditingPurchase(null);
    setProductFormData({ ...EMPTY_PRODUCT_FORM_DATA });
    setSelectedProduct(null);
    setCustomerSearchTerm('');
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setSnackbar({ open: true, message: '📋 Form cleared - ready for new entry', severity: 'info' });
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, customersRes, productsRes, categoriesRes, subcategoriesRes, storesRes, customerCategoriesRes, customerTypesRes, citiesRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/categories'),
        fetch('/api/subcategories'),
        fetch('/api/stores'),
        fetch('/api/customer-category'),
        fetch('/api/customer-types'),
        fetch('/api/cities')
      ]);

      if (purchasesRes.ok) {
        const purchasesData = await purchasesRes.json();
        setPurchases(purchasesData);
      }
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
      if (subcategoriesRes.ok) {
        const subcategoriesData = await subcategoriesRes.json();
        setSubcategories(subcategoriesData);
      }
      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        const storesData = storesResponse.success ? storesResponse.data : [];
        setStores(Array.isArray(storesData) ? storesData : []);
      } else {
        console.error('Stores API error:', storesRes.status, storesRes.statusText);
        setStores([]);
      }

      if (customerCategoriesRes.ok) {
        const customerCategoriesData = await customerCategoriesRes.json();
        setCustomerCategories(Array.isArray(customerCategoriesData) ? customerCategoriesData : []);
      } else {
        console.error('Customer Categories API error:', customerCategoriesRes.status, customerCategoriesRes.statusText);
        setCustomerCategories([]);
      }

      if (customerTypesRes.ok) {
        const customerTypesData = await customerTypesRes.json();
        setCustomerTypes(Array.isArray(customerTypesData) ? customerTypesData : []);
      } else {
        console.error('Customer Types API error:', customerTypesRes.status, customerTypesRes.statusText);
        setCustomerTypes([]);
      }

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(Array.isArray(citiesData) ? citiesData : []);
      } else {
        console.error('Cities API error:', citiesRes.status, citiesRes.statusText);
        setCities([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching data',
        severity: 'error'
      });
      // Ensure all dropdown data are always arrays even on error
      setStores([]);
      setCustomerCategories([]);
      setCustomerTypes([]);
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

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
    const matchesSearch = purchase.customer?.cus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.vehicle_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = !selectedCustomer || purchase.cus_id === selectedCustomer;

    const matchesStore = filterStore === '' ||
      (purchase.store_id?.toString() === filterStore) ||
      (purchase.purchase_details && purchase.purchase_details.some(detail =>
        detail.store_id?.toString() === filterStore
      ));

    const totalAmount = parseFloat(purchase.net_total || 0);
    const matchesMinAmount = filterMinAmount === '' ||
      totalAmount >= parseFloat(filterMinAmount);
    const matchesMaxAmount = filterMaxAmount === '' ||
      totalAmount <= parseFloat(filterMaxAmount);

    const matchesDateFrom = dateFrom === '' ||
      (dateFrom && purchase.created_at && new Date(purchase.created_at) >= new Date(dateFrom));

    const matchesDateTo = dateTo === '' ||
      (dateTo && purchase.created_at && new Date(purchase.created_at) <= new Date(dateTo));

    return matchesSearch && matchesCustomer && matchesStore && matchesMinAmount && matchesMaxAmount && matchesDateFrom && matchesDateTo;
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

  const finalPurchases = sortedPurchases.map((purchase, index) => ({
    ...purchase,
    sequentialId: index + 1
  }));

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
    const needsStepUpAuth = hasCash || hasBank || purchaseType === 'return';
    if (needsStepUpAuth) {
      const authOk = await requireAuth();
      if (!authOk) return;
    }
    beginSaving(
      editingPurchase
        ? 'Updating purchase...'
        : purchaseType === 'return'
          ? 'Processing purchase return...'
          : 'Saving purchase...'
    );
    try {

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

      updateSaveStatus(editingPurchase ? 'Updating purchase on server...' : 'Saving purchase to server...');
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        notifyLedgerDataChanged('purchase');

        updateSaveStatus('Updating stock & ledger...');
        // Fetch fresh purchase data to ensure accurate balance info
        const freshResponse = await fetch(`/api/purchases?id=${result.pur_id}`);
        const freshData = freshResponse.ok ? await freshResponse.json() : result;

        // Store bill data for printing receipt
        const freshProductTotal = (freshData.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || 0), 0)
          || parseFloat(freshData.total_amount || 0);
        const freshNetTotal = freshProductTotal
          + parseFloat(freshData.unloading_amount || 0)
          + parseFloat(freshData.transport_amount || 0)
          + parseFloat(freshData.labour_amount || 0)
          + parseFloat(freshData.fare_amount || 0)
          - parseFloat(freshData.discount || 0);

        // Calculate payment breakdown
        let freshCashPayment = parseFloat(freshData.cash_payment || 0);
        let freshBankPayment = parseFloat(freshData.bank_payment || 0);
        if (freshCashPayment === 0 && freshBankPayment === 0 && parseFloat(freshData.payment || 0) > 0) {
          const totalPay = parseFloat(freshData.payment || 0);
          if (freshData.payment_type === 'BANK_TRANSFER') freshBankPayment = totalPay;
          else freshCashPayment = totalPay;
        }

        const billDataForPrint = {
          ...freshData,
          display_net_total: freshNetTotal,
          cash_payment: freshCashPayment,
          bank_payment: freshBankPayment,
          bank_title: selectedBankAccount?.cus_name || null,
          customer: freshData.customer || customers.find(c => c.cus_id === freshData.cus_id),
          purchase_details: freshData.purchase_details || formData.purchase_details,
          previous_customer_balance: parseFloat(freshData.previous_customer_balance ?? 0),
          bill_type: purchaseType === 'return' ? 'PURCHASE_RETURN' : 'PURCHASE'
        };
        setCurrentBillData(billDataForPrint);

        // Persist any edited sale_rate (pro_sale_price) and cost_rate (pro_cost_price) values to product records
        updateSaveStatus('Updating product prices...');
        try {
          const updatePromises = formData.purchase_details.map(async (detail) => {
            const pid = parseInt(detail.pro_id, 10);
            const existingProduct = products.find(p => p.pro_id === pid);
            const newSaleRate = parseFloat(detail.unit_rate || detail.rate || 0);
            const newCostRate = parseFloat(detail.cost_rate ?? detail.original_cost_rate ?? existingProduct?.pro_cost_price ?? 0);

            const payload = { id: pid };
            if (!Number.isNaN(newSaleRate) && newSaleRate > 0) payload.pro_sale_price = newSaleRate;
            if (!Number.isNaN(newCostRate) && newCostRate > 0) payload.pro_cost_price = newCostRate;

            if (Object.keys(payload).length > 1) {
              try {
                const resp = await fetch('/api/products', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (resp.ok) {
                  const updated = await resp.json();
                  setProducts(prev => prev.map(p => p.pro_id === updated.pro_id ? updated : p));
                }
              } catch (err) {
                console.warn('Failed to persist product price update for', pid, err);
              }
            }
          });

          await Promise.all(updatePromises);
        } catch (err) {
          console.warn('Error persisting product price updates after purchase save', err);
        }

        // Open receipt dialog
        updateSaveStatus('Generating receipt...');
        setReceiptDialogOpen(true);

        // After successful purchase creation, restore previous screen state if available
        if (currentScreenIndex > 0) {
          const previousIndex = currentScreenIndex - 1;
          const previousState = screenStack[previousIndex];
          const trimmedStack = screenStack.slice(0, currentScreenIndex);

          setScreenStack(trimmedStack);
          setCurrentScreenIndex(previousIndex);
          restoreScreenState(previousState);
          setSnackbar({ open: true, message: `✅ Purchase saved! Restored Screen ${previousIndex + 1}`, severity: 'success' });
        } else {
          clearFormState();
          // Reset stack to single item
          const emptyState = {
            formData: {
              cus_id: '',
              store_id: stores[0]?.storeid?.toString() || '',
              debit_account_id: '',
              credit_account_id: '',
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
              discount: '',
              cash_payment: '',
              bank_payment: '',
              payment_type: 'CASH',
              vehicle_no: '',
              invoice_number: '',
              purchase_details: []
            },
            formSelectedCustomer: null,
            selectedBankAccount: null,
            purchaseType: 'new',
            selectedPurchaseForReturn: null,
            productFormData: { ...EMPTY_PRODUCT_FORM_DATA },
            selectedProduct: null,
            editingPurchase: null,
            timestamp: new Date().toLocaleTimeString(),
            customerName: 'New Purchase'
          };
          setScreenStack([emptyState]);
          setCurrentScreenIndex(0);
          setSnackbar({ open: true, message: '✅ Purchase saved! Form cleared', severity: 'success' });
        }
      }
    } catch (error) {
      console.error('Error saving purchase:', error);
    } finally {
      endSaving();
    }
  };

  const handleEdit = (purchase) => {
    setEditingPurchase(purchase);

    // Calculate actual cash and bank payment from the database fields, or fall back to payment_type / payment
    let cashPayment = parseFloat(purchase.cash_payment || 0);
    let bankPayment = parseFloat(purchase.bank_payment || 0);

    // Fallback logic for older records without cash_payment/bank_payment fields
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

    setFormData({
      cus_id: purchase.cus_id,
      store_id: purchase.store_id?.toString() || '',
      debit_account_id: purchase.debit_account_id || '',
      credit_account_id: purchase.credit_account_id || '',
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
      cash_payment: cashPayment > 0 ? cashPayment.toString() : '',
      bank_payment: bankPayment > 0 ? bankPayment.toString() : '',
      payment_type: (cashPayment > 0 && bankPayment > 0) ? 'SPLIT' : purchase.payment_type,
      vehicle_no: purchase.vehicle_no || '',
      invoice_number: purchase.invoice_number || '',
      purchase_details: (purchase.purchase_details || []).map(detail => ({
        ...detail,
        store_id: detail.store_id || purchase.store_id?.toString() || ''
      }))
    });

    // Set selected bank account if bank_account_id (resolved from ledger/API) or credit_account_id exists
    const bankAccountIdToFind = purchase.bank_account_id || (purchase.payment_type === 'BANK_TRANSFER' ? purchase.credit_account_id : null);
    if (bankAccountIdToFind) {
      const bankAccount = customers.find(customer => customer.cus_id === bankAccountIdToFind);
      setSelectedBankAccount(bankAccount || null);
    } else {
      setSelectedBankAccount(null);
    }

    // Set selected cargo accounts if provided (supports multiple IDs)
    if (purchase.cargo_account_ids) {
      try {
        const ids = Array.isArray(purchase.cargo_account_ids) ? purchase.cargo_account_ids : JSON.parse(purchase.cargo_account_ids || '[]');
        const selected = (ids || []).map(id => customers.find(c => c.cus_id === parseInt(id))).filter(Boolean);
        setSelectedCargoAccounts(selected);
      } catch (err) {
        // fallback to single cargo_account_id
        const cargoAcc = customers.find(customer => customer.cus_id === purchase.cargo_account_id);
        setSelectedCargoAccounts(cargoAcc ? [cargoAcc] : []);
      }
    } else if (purchase.cargo_account_id) {
      const cargoAcc = customers.find(customer => customer.cus_id === purchase.cargo_account_id);
      setSelectedCargoAccounts(cargoAcc ? [cargoAcc] : []);
    } else {
      setSelectedCargoAccounts([]);
    }

    // Set selected customer for the form
    const customer = customers.find(customer => customer.cus_id === purchase.cus_id);
    setFormSelectedCustomer(customer || null);

    setCurrentView('create');
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

  const handlePrintViewReceipt = (mode = 'A4') => {
    try {
      const isThermal = mode === 'THERMAL';
      const className = isThermal ? 'print-thermal-view' : 'print-a4-view';
      const containerId = isThermal ? 'printable-invoice-thermal-view' : 'printable-invoice-a4-view';
      const printableContainer = document.getElementById(containerId);
      if (!printableContainer) return;
      const preview = document.getElementById('purchase-invoice');
      if (preview) printableContainer.innerHTML = preview.innerHTML;
      printableContainer.style.position = 'fixed';
      printableContainer.style.left = '0'; printableContainer.style.top = '0';
      printableContainer.style.display = 'block'; printableContainer.style.zIndex = '9999';
      printableContainer.style.backgroundColor = 'white';
      const styleId = 'dynamic-print-style-view';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = isThermal ? `@media print { @page { size: 80mm portrait; margin: 0; } }` : `@media print { @page { size: A4; margin: 0.5cm 1cm; } }`;
      document.body.classList.add(className);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          printableContainer.style.position = ''; printableContainer.style.left = ''; printableContainer.style.top = '';
          printableContainer.style.display = 'none'; printableContainer.style.zIndex = ''; printableContainer.style.backgroundColor = '';
          document.body.classList.remove('print-thermal-view'); document.body.classList.remove('print-a4-view');
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
          await fetchData();
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
        // Refresh customers list
        await fetchData();
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

  // Render Purchase List View
  const renderPurchaseListView = () => (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Header - Add New Purchase Button on the left */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', py: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCurrentView('create')}
              size="large"
              sx={{
                background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
                boxShadow: '0 4px 20px rgba(25, 118, 210, 0.3)',
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                minWidth: '320px',
                height: '70px',
                borderRadius: 3,
                position: 'relative',
                '@keyframes float': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-8px)' }
                },
                '@keyframes glow': {
                  '0%, 100%': { boxShadow: '0 4px 20px rgba(25, 118, 210, 0.3)' },
                  '50%': { boxShadow: '0 4px 35px rgba(25, 118, 210, 0.7)' }
                },
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' }
                },
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.02)' }
                },
                '@keyframes plusGlow': {
                  '0%, 100%': {
                    textShadow: '0 0 5px rgba(255, 255, 255, 0.3)',
                    filter: 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.2))'
                  },
                  '50%': {
                    textShadow: '0 0 15px rgba(255, 255, 255, 0.8), 0 0 25px rgba(255, 255, 255, 0.4)',
                    filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))'
                  }
                },
                animation: 'float 3s ease-in-out infinite, glow 2s ease-in-out infinite alternate, pulse 4s ease-in-out infinite',
                backgroundSize: '200% 100%',
                '& .MuiButton-startIcon': {
                  animation: 'plusGlow 2s ease-in-out infinite alternate'
                },
                '&:hover': {
                  background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
                  transform: 'scale(1.08) translateY(-4px)',
                  boxShadow: '0 10px 40px rgba(25, 118, 210, 0.6)',
                  animation: 'shimmer 1.5s ease-in-out infinite, float 1s ease-in-out infinite',
                  '& .MuiButton-startIcon': {
                    animation: 'plusGlow 1s ease-in-out infinite alternate, float 0.5s ease-in-out infinite'
                  }
                },
                '&:active': {
                  transform: 'scale(0.95) translateY(0px)',
                  transition: 'all 0.1s ease-in-out'
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              <span style={{
                textShadow: '0 0 8px rgba(255, 255, 255, 0.5), 0 0 16px rgba(255, 255, 255, 0.3)',
                filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.4))',
                transition: 'all 0.3s ease-in-out'
              }}>
                ➕
              </span>
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

          {/* Filters & Sorting Section */}
          <Box sx={{ flexShrink: 0, mb: 3, width: '100%' }}>
            <Card sx={{
              borderRadius: 2,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              width: '100%',
              border: '1px solid #e2e8f0',
              bgcolor: '#f8fafc'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterListIcon sx={{ color: '#64748b' }} />
                    Filters & Sorting
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                      Showing <strong>{filteredPurchases.length}</strong> of <strong>{purchases.length}</strong> purchases
                    </Typography>
                    <Button
                      onClick={clearFilters}
                      size="small"
                      startIcon={<ClearIcon />}
                      sx={{
                        color: '#64748b',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { color: '#ef4444', bgcolor: '#fee2e2' }
                      }}
                    >
                      Clear All Filters
                    </Button>
                  </Box>
                </Box>

                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(4, 1fr)'
                  },
                  gap: 3,
                  width: '100%'
                }}>
                  {/* Search */}
                  <Box>
                    <TextField
                      fullWidth
                      label="Search Purchases"
                      placeholder="ID, Supplier, or Reference..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon size={18} sx={{ color: '#94a3b8' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                    />
                  </Box>

                  {/* Customer (Supplier) Filter */}
                  <Box>
                    <Autocomplete
                      fullWidth
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      options={customers.filter(customer =>
                        customer.customer_category?.cus_cat_title?.toLowerCase().includes('supplier')
                      )}
                      getOptionLabel={(option) => option.cus_name || ''}
                      value={customers.find(c => c.cus_id === selectedCustomer) || null}
                      onChange={(event, newValue) => setSelectedCustomer(newValue ? newValue.cus_id : '')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Supplier"
                          placeholder="All Suppliers"
                          onFocus={(e) => e.target.select()}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                        />
                      )}
                    />
                  </Box>

                  {/* Date From */}
                  <Box>
                    <TextField
                      fullWidth
                      label="From Date"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                    />
                  </Box>

                  {/* Date To */}
                  <Box>
                    <TextField
                      fullWidth
                      label="To Date"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                    />
                  </Box>

                  {/* Store Filter */}
                  <Box>
                    <Autocomplete
                      fullWidth
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      options={stores}
                      getOptionLabel={(option) => option.store_name || ''}
                      value={stores.find(s => s.storeid.toString() === filterStore) || null}
                      onChange={(event, newValue) => setFilterStore(newValue ? newValue.storeid.toString() : '')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Store"
                          placeholder="All Stores"
                          onFocus={(e) => e.target.select()}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                        />
                      )}
                    />
                  </Box>

                  {/* Min Amount */}
                  <Box>
                    <TextField
                      fullWidth
                      label="Min Amount"
                      type="number"
                      placeholder="e.g. 1000"
                      value={filterMinAmount}
                      onChange={(e) => setFilterMinAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                    />
                  </Box>

                  {/* Max Amount */}
                  <Box>
                    <TextField
                      fullWidth
                      label="Max Amount"
                      type="number"
                      placeholder="e.g. 50000"
                      value={filterMaxAmount}
                      onChange={(e) => setFilterMaxAmount(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                    />
                  </Box>

                  {/* Sort */}
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    options={[
                      { value: 'created_at-desc', label: 'Newest First' },
                      { value: 'created_at-asc', label: 'Oldest First' },
                      { value: 'customer-asc', label: 'Supplier A-Z' },
                      { value: 'customer-desc', label: 'Supplier Z-A' },
                      { value: 'net_total-desc', label: 'Amount High-Low' },
                      { value: 'net_total-asc', label: 'Amount Low-High' }
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
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Sort By"
                        onFocus={(e) => e.target.select()}
                        placeholder="Select..."
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white' } }}
                      />
                    )}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Purchases Table */}
          <Card>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 'semibold' }}>
                Purchases List
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Showing {finalPurchases.length} of {purchases.length} purchases
              </Typography>
            </Box>

            {finalPurchases.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    No purchases found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm || selectedCustomer
                      ? 'Try adjusting your filters to see more results.'
                      : 'Get started by adding your first purchase.'}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Fixed Column Headers */}
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-2">Purchase</div>
                    <div className="col-span-2">Customer</div>
                    <div className="col-span-2">Amounts</div>
                    <div className="col-span-1">Payment</div>
                    <div className="col-span-1">Vehicle</div>
                    <div className="col-span-1">Created</div>
                    <div className="col-span-2">Updated By</div>
                    <div className="col-span-1">Actions</div>
                  </div>
                </div>

                {/* Scrollable Table Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {finalPurchases.map((purchase) => {
                      return (
                        <div
                          key={purchase.pur_id}
                          onClick={() => handleOpenCustomerLedger(purchase)}
                          className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                        >
                          {/* Purchase */}
                          <div className="col-span-2 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">Purchase #{purchase.sequentialId}</div>
                              <div className="text-xs text-gray-500">ID: {purchase.pur_id.toString().slice(-8)}</div>
                            </div>
                          </div>

                          {/* Customer */}
                          <div className="col-span-2 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{purchase.customer?.cus_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{purchase.customer?.cus_phone_no || 'N/A'}</div>
                            </div>
                          </div>

                          {/* Amounts */}
                          <div className="col-span-2">
                            <div className="text-sm font-semibold text-green-600">{Number(purchase.net_total)}</div>
                            <div className="text-xs text-gray-500">
                              Total: {Number(purchase.total_amount)} |
                              Unload: {Number(purchase.unloading_amount)} |
                              Fare: {Number(purchase.fare_amount)}
                            </div>
                            {purchase.discount > 0 && (
                              <div className="text-xs text-red-500">Discount: -{Number(purchase.discount)}</div>
                            )}
                          </div>

                          {/* Payment */}
                          <div className="col-span-1 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{purchase.payment_type}</div>
                              <div className="text-xs text-gray-500">{Number(purchase.payment)}</div>
                            </div>
                          </div>

                          {/* Vehicle */}
                          <div className="col-span-1 flex items-center">
                            <div className="text-sm text-gray-900">{purchase.vehicle_no || 'N/A'}</div>
                          </div>

                          {/* Created */}
                          <div className="col-span-1 flex items-center">
                            <div className="text-sm text-gray-900">
                              {formatDatePK(purchase?.created_at) || 'N/A'}
                            </div>
                          </div>

                          {/* Updated By */}
                          <div className="col-span-2 flex items-center">
                            {purchase.updated_by_user?.full_name ? (
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-white text-xs font-bold">
                                    {purchase.updated_by_user.full_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {purchase.updated_by_user.full_name}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {purchase.updated_by_user.role || 'User'}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 italic">N/A</div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewPurchase(purchase)}
                                className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                title="View Purchase Details"
                              >
                                <EyeIcon />
                              </button>
                              <button
                                onClick={() => handleEdit(purchase)}
                                className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                title="Edit Purchase"
                              >
                                <EditIcon />
                              </button>
                              <button
                                onClick={() => handleDelete(purchase.pur_id)}
                                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                title="Delete Purchase"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  // Render Purchase Create View
  const renderPurchaseCreateView = () => (
    <DashboardLayout>
      <SaveProgressBackdrop
        open={isSubmitting}
        message={saveStatusMessage}
        subMessage="Do not close or refresh until the purchase is saved and the receipt is ready"
      />
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

          {/* Header Section */}
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {purchaseType === 'return' && selectedPurchaseForReturn ? `Return for Purchase #${selectedPurchaseForReturn.pur_id}` : 'Purchase #'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {purchaseType === 'new' && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => openCustomerForm('supplier')}
                      sx={{
                        bgcolor: 'primary.main',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                    >
                      + New Supplier
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PackageIcon />}
                      onClick={() => setShowAddProductPopup(true)}
                      sx={{ borderColor: 'info.main', color: 'info.main', '&:hover': { borderColor: 'info.dark', backgroundColor: 'info.light', color: 'info.dark' } }}
                    >
                      Add Product
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<FolderIcon />}
                      onClick={() => setShowAddProductCategoryPopup(true)}
                      sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { borderColor: 'success.dark', backgroundColor: 'success.light', color: 'success.dark' } }}
                    >
                      Add Product Category
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<FolderOpenIcon />}
                      onClick={() => setShowAddProductSubCategoryPopup(true)}
                      sx={{ borderColor: 'secondary.main', color: 'secondary.main', '&:hover': { borderColor: 'secondary.dark', backgroundColor: 'secondary.light', color: 'secondary.dark' } }}
                    >
                      Add Product Sub Category
                    </Button>
                  </Box>
                )}
                {purchaseType === 'new' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Invoice No"
                      sx={{ width: 200 }}
                    />
                    <Button
                      variant="contained"
                      sx={{
                        bgcolor: 'secondary.main',
                        '&:hover': { bgcolor: 'secondary.dark' },
                        minWidth: 80
                      }}
                    >
                      Q Find
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </Card>

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
                        ? 'linear-gradient(45deg, #2e7d32 30%, #4caf50 90%)'
                        : 'linear-gradient(45deg, #c62828 30%, #ef5350 90%)',
                      boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
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

              {/* Customer and Order Details Section */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Grid container spacing={3}>
                  {/* Supplier Selection - Now visible for both New and Return */}
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          SUPPLIER
                        </Typography>
                        {formSelectedCustomer && (
                          <Box sx={{
                            bgcolor: 'success.light',
                            color: 'success.contrastText',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            Balance: {Number(formSelectedCustomer.cus_balance || 0)}
                          </Box>
                        )}
                      </Box>
                      <Autocomplete
                        size="medium"
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        open={customerDropdownOpen}
                        onOpen={() => {
                          setCustomerDropdownOpen(true);
                        }}
                        onClose={() => setCustomerDropdownOpen(false)}
                        options={suppliers}
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
                          if (newValue) {
                            // Call the existing selection handler if exists, or do manual sets
                            if (typeof selectCustomer === 'function') {
                              selectCustomer(newValue);
                            } else {
                              setFormSelectedCustomer(newValue);
                              setFormData(prev => ({ ...prev, cus_id: newValue.cus_id }));
                            }

                            // Additional cleanup for returns
                            if (purchaseType === 'return') {
                              setPurchaseSearchResults([]);
                              setSelectedPurchaseForReturn(null);
                              setPurchaseSearchOpen(false);
                            }
                          } else {
                            setFormData(prev => ({ ...prev, cus_id: '' }));
                            if (typeof setCustomerSearchTerm === 'function') setCustomerSearchTerm('');
                            setFormSelectedCustomer(null);

                            // Cleanup for returns
                            if (purchaseType === 'return') {
                              setPurchaseSearchResults([]);
                              setSelectedPurchaseForReturn(null);
                            }
                          }
                          setCustomerDropdownOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && formSelectedCustomer) {
                            e.preventDefault();
                            // Move focus to Store field
                            const storeInputs = document.querySelectorAll('input[placeholder*="Select store"]');
                            if (storeInputs.length > 0) {
                              storeInputs[0]?.focus();
                            }
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Search by name, phone, address, city, reference"
                            onFocus={(e) => e.target.select()}
                            sx={{
                              width: '100%',
                              minWidth: 200,
                              minHeight: 56,
                              '& .MuiInputBase-input': {
                                fontWeight: formSelectedCustomer ? 'bold' : 'normal'
                              }
                            }}
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...optionProps } = props;
                          return (
                            <Box component="li" key={option.cus_id} {...optionProps}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: formSelectedCustomer?.cus_id === option.cus_id ? 'bold' : 'medium',
                                      color: formSelectedCustomer?.cus_id === option.cus_id ? 'primary.main' : 'text.primary'
                                    }}
                                  >
                                    {option.cus_name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {[option.cus_phone_no, option.cus_address, option.city?.city_name, option.cus_reference].filter(Boolean).join(' • ')} • Balance: {Number(option.cus_balance || 0)}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          );
                        }}
                        sx={{ width: '100%' }}
                        disablePortal={false}
                        clearOnBlur={false}
                        handleHomeEndKeys={true}
                      />
                    </Box>
                  </Grid>

                  {/* Select Purchase to Return (Only for Return) */}
                  {purchaseType === 'return' && (
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, position: 'relative' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          SELECT PURCHASE
                        </Typography>
                        <Autocomplete
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          open={purchaseSearchOpen}
                          onOpen={() => {
                            setPurchaseSearchOpen(true);
                            // Show all purchases when opening dropdown
                            if (formSelectedCustomer) {
                              const supplierPurchases = purchases.filter(p => p.cus_id === formSelectedCustomer.cus_id);
                              setPurchaseSearchResults(supplierPurchases);
                            }
                          }}
                          onClose={() => setPurchaseSearchOpen(false)}
                          options={purchaseSearchResults}
                          getOptionLabel={(option) => `#${option.pur_id} - ${option.invoice_number || 'N/A'} (${Number(option.total_amount)})`}
                          value={selectedPurchaseForReturn}
                          onChange={(event, newValue) => {
                            if (newValue) {
                              handleLoadPurchaseForReturn(newValue);
                            }
                          }}
                          onInputChange={(event, inputValue) => {
                            handlePurchaseSearch(inputValue);
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Search invoice..."
                              onFocus={(e) => e.target.select()}
                              size="medium"
                              sx={{
                                width: '100%',
                                minHeight: 56,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 1,
                                  '& fieldset': { borderColor: '#e5e7eb' },
                                  '&:hover fieldset': { borderColor: '#dc2626' },
                                  '&.Mui-focused fieldset': { borderColor: '#b91c1c' }
                                }
                              }}
                              InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'text.secondary' }} />
                                  </InputAdornment>
                                )
                              }}
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...optionProps } = props;
                            return (
                              <Box component="li" key={option.pur_id} {...optionProps}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                  <ReceiptIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {option.invoice_number || 'N/A'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {Number(option.total_amount)} • {formatDatePK(option?.created_at) || 'N/A'}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          }}
                          sx={{ width: '100%' }}
                          disablePortal={false}
                          clearOnBlur={true}
                          noOptionsText={purchaseSearchResults.length === 0 ? "No purchases found" : ""}
                        />
                      </Box>
                    </Grid>
                  )}

                  {/* Date Field */}
                  <Grid size={{ xs: 12, md: purchaseType === 'new' ? 2 : 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        DATE
                      </Typography>
                      <TextField
                        size="medium"
                        type="date"
                        value={formData.date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        sx={{ width: '100%', minHeight: 56 }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <CalendarIcon sx={{ color: 'warning.main' }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  </Grid>

                  {/* Invoice Number Field */}
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {purchaseType === 'new' ? 'INVOICE NUMBER' : 'NEW INVOICE NUMBER (RETURN)'}
                      </Typography>
                      <TextField
                        size="medium"
                        placeholder={purchaseType === 'new' ? 'Enter invoice number' : 'Enter return invoice number'}
                        value={formData.invoice_number || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        sx={{ width: '100%', minHeight: 56 }}
                      />
                    </Box>
                  </Grid>

                  {/* Row 2 - Vehicle (only for new purchases) */}
                  {purchaseType === 'new' && (
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            VEHICLE
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            *
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="medium"
                          placeholder="Enter vehicle number..."
                          value={formData.vehicle_no}
                          onChange={(e) => setFormData(prev => ({ ...prev, vehicle_no: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          sx={{ minWidth: 250, minHeight: 56 }}
                          required
                        />
                      </Box>
                    </Grid>
                  )}

                  {/* Vehicle Menu */}
                  <Menu
                    anchorEl={vehicleMenuAnchor}
                    open={Boolean(vehicleMenuAnchor)}
                    onClose={handleVehicleMenuClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
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




                </Grid>
              </Box>


              {/* Product Selection Section */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  SELECT PRODUCT
                </Typography>

                <Grid container spacing={1} sx={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
                  <Grid item sx={{ flex: '0 0 300px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        PRODUCT
                      </Typography>
                      <Autocomplete
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        options={products}
                        getOptionLabel={(option) => option.pro_title}
                        ListboxProps={{ sx: { maxHeight: 130 } }}
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
                            placeholder="Select product..."
                            onFocus={(e) => e.target.select()}
                            sx={{ width: '100%', minWidth: 0 }}
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...optionProps } = props;
                          const storeStockEntry = formData.store_id
                            ? option.store_stocks?.find(s => s.store_id === parseInt(formData.store_id))
                            : null;
                          const stockQty = storeStockEntry ? parseFloat(storeStockEntry.stock_quantity) : null;
                          return (
                            <Box component="li" key={option.pro_id} {...optionProps}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: selectedProduct?.pro_id === option.pro_id ? 'bold' : 'medium',
                                      color: selectedProduct?.pro_id === option.pro_id ? 'primary.main' : 'text.primary'
                                    }}
                                  >
                                    {option.pro_title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.category?.cat_name} • {option.sub_category?.sub_cat_name}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                  {stockQty !== null && (
                                    <Chip
                                      label={`Stock: ${stockQty.toLocaleString()}`}
                                      size="small"
                                      color={stockQty <= 0 ? 'error' : stockQty <= (option.low_stock_quantity || 10) ? 'warning' : 'success'}
                                      variant="outlined"
                                    />
                                  )}
                                  <Chip
                                    label={`PKR ${fmtAmt(option.pro_cost_price)}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                            </Box>
                          );
                        }}
                        disablePortal={false}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item sx={{ flex: '0 0 100px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        STORE
                      </Typography>
                      <Autocomplete
                        size="small"
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
                            placeholder={formData.store_id ? "Store Selected" : "Select store"}
                            onFocus={(e) => e.target.select()}
                            sx={{
                              width: '100%',
                              minWidth: 0,
                              '& .MuiInputBase-input': {
                                fontWeight: formData.store_id ? 'bold' : 'normal',
                                color: formData.store_id ? 'primary.main' : 'text.primary'
                              }
                            }}
                          />
                        )}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  {/* Available Stock Display */}
                  {selectedProduct && formData.store_id && (() => {
                    const storeStock = selectedProduct.store_stocks?.find(s => s.store_id === parseInt(formData.store_id));
                    const qty = storeStock ? parseFloat(storeStock.stock_quantity) : 0;
                    return (
                      <Grid item sx={{ flex: '0 0 100px', minWidth: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            STOCK
                          </Typography>
                          <Chip
                            label={`${qty.toLocaleString()} ${selectedProduct.pro_unit || ''}`}
                            color={qty <= 0 ? 'error' : qty <= (selectedProduct.low_stock_quantity || 10) ? 'warning' : 'success'}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 'bold', fontSize: 13, height: 38, borderRadius: 1 }}
                          />
                        </Box>
                      </Grid>
                    );
                  })()}

                  <Grid item sx={{ flex: '0 0 80px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        QTY
                      </Typography>
                      <TextField
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
                        inputProps={{ min: 0, step: "any" }}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item sx={{ flex: '1 1 90px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        PURCHASE RATE
                      </Typography>
                      <TextField
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
                        inputProps={{ min: 0, step: "any" }}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item sx={{ flex: '1 1 90px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        COST RATE
                      </Typography>
                      <TextField
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
                        inputProps={{ min: 0, step: "any" }}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item sx={{ flex: '1 1 90px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        SALE RATE
                      </Typography>
                      <TextField
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
                        inputProps={{ min: 0, step: "any" }}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>



                  <Grid item sx={{ flex: '1 1 90px', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        AMOUNT
                      </Typography>
                      <TextField
                        size="small"
                        value={parseFloat(productFormData.qnty || 0) * parseFloat(productFormData.crate || productFormData.unit_rate || 0)}
                        InputProps={{ readOnly: true }}
                        sx={{ width: '100%', minWidth: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item sx={{ flex: '0 0 auto' }}>
                    <Button
                      variant="contained"
                      id="add-product-btn"
                      onClick={addProductToPurchase}
                      disabled={!productFormData.qnty || !productFormData.unit_rate}
                      sx={{
                        bgcolor: 'secondary.main',
                        '&:hover': { bgcolor: 'secondary.dark' },
                        minWidth: 40,
                        height: 40
                      }}
                    >
                      +
                    </Button>
                  </Grid>
                </Grid>
              </Box>


              {/* Product List Table */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>S. No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Store</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>PURCHASE RATE</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>COST RATE</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Sale Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.purchase_details.length > 0 ? (
                        <>
                          {formData.purchase_details.map((detail, index) => {
                            const product = products.find(p => p.pro_id === detail.pro_id);
                            return (
                              <TableRow key={index} hover>
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
                                  <Typography variant="body2" sx={{ fontWeight: 'semibold', color: 'success.main' }}>
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
                            <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{calculateTotalAmount().toFixed(2)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No data found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Payment and Summary Section */}
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  {/* Left Section - Payment Fields */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Split Payment Section */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            CASH PAYMENT
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Bal: {fmtAmt(customers.find(c => c.cus_name === 'Cash Account')?.cus_balance ?? 0)}
                          </Typography>
                        </Box>
                        <TextField
                          size="small"
                          type="number"
                          value={formData.cash_payment}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, cash_payment: e.target.value }));
                          }}
                          inputProps={{ min: 0 }}
                          sx={{ width: '100%' }}
                          placeholder="Enter amount"
                        />
                      </Box>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          BANK PAYMENT
                        </Typography>
                        <TextField
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
                          sx={{ width: '100%' }}
                          placeholder="Enter amount"
                        />
                      </Box>
                      <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            BANK ACCOUNT
                          </Typography>
                          {selectedBankAccount && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Bal: {fmtAmt(selectedBankAccount.cus_balance ?? 0)}
                            </Typography>
                          )}
                        </Box>
                        <Autocomplete
                          size="small"
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          disabled={parseFloat(formData.bank_payment || 0) <= 0}
                          open={bankAccountDropdownOpen}
                          onOpen={() => {
                            // only open when bank payment is present
                            if (parseFloat(formData.bank_payment || 0) <= 0) return;
                            setBankAccountDropdownOpen(true);
                          }}
                          onClose={() => setBankAccountDropdownOpen(false)}
                          options={bankAccounts.length > 0 ? bankAccounts : customers}
                          getOptionLabel={(option) => option.cus_name}
                          value={selectedBankAccount}
                          onChange={(event, newValue) => {
                            setSelectedBankAccount(newValue);
                            setFormData(prev => ({
                              ...prev,
                              credit_account_id: newValue ? newValue.cus_id.toString() : ''
                            }));
                            setBankAccountDropdownOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              // Auto-select first bank account option on Tab
                              const accountsToUse = bankAccounts.length > 0 ? bankAccounts : customers;
                              if (accountsToUse.length > 0 && !selectedBankAccount) {
                                const firstAccount = accountsToUse[0];
                                setSelectedBankAccount(firstAccount);
                                setFormData(prev => ({
                                  ...prev,
                                  credit_account_id: firstAccount.cus_id.toString()
                                }));
                              }

                              // Close dropdown and blur the input (use ref)
                              setBankAccountDropdownOpen(false);
                              setTimeout(() => {
                                bankAccountInputRef.current?.blur();
                              }, 0);
                            }
                          }}
                          filterOptions={(options, { inputValue }) => {
                            return options.filter(option =>
                              option.cus_name.toLowerCase().includes(inputValue.toLowerCase()) ||
                              option.cus_phone_no?.toLowerCase().includes(inputValue.toLowerCase())
                            );
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              inputRef={bankAccountInputRef}
                              placeholder="Select Bank Account"
                              onFocus={(e) => e.target.select()}
                              sx={
                                {
                                  '& .MuiInputBase-input': {
                                    fontWeight: selectedBankAccount ? 'bold' : 'normal'
                                  }
                                }
                              }
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...optionProps } = props;
                            return (
                              <Box component="li" key={option.cus_id} {...optionProps}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                  <AttachMoneyIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: selectedBankAccount?.cus_id === option.cus_id ? 'bold' : 'medium',
                                        color: selectedBankAccount?.cus_id === option.cus_id ? 'primary.main' : 'text.primary'
                                      }}
                                    >
                                      {option.cus_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {option.cus_phone_no} • Balance: {Number(option.cus_balance || 0)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          }}
                          sx={{ width: '100%' }}
                          disablePortal={false}
                          clearOnBlur={false}
                          handleHomeEndKeys={true}
                        />
                      </Box>
                    </Box>

                    {/* Row 2: TOTAL PAYMENT (left) with Incity below, NOTES (right) */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          TOTAL PAYMENT
                        </Typography>
                        <TextField
                          size="small"
                          value={Number((parseFloat(formData.cash_payment || 0) + parseFloat(formData.bank_payment || 0)).toFixed(2))}
                          InputProps={{ readOnly: true }}
                          sx={{ width: '100%', backgroundColor: 'action.hover' }}
                        />

                        {/* Incity box placed below Total Payment */}
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mt: 1, backgroundColor: 'background.paper' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Incity</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                              />
                              <Typography variant="body2">Include Incity Charges</Typography>
                            </Box>

                            <TextField
                              label="Own Labour"
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
                            />

                            <TextField
                              label="Own Delivery"
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
                            />

                            <TextField
                              label="Charges Total"
                              size="small"
                              value={parseFloat(formData.incity_charges_total || 0).toFixed(2)}
                              InputProps={{ readOnly: true }}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          NOTES
                        </Typography>
                        <TextField
                          size="small"
                          multiline
                          rows={2}
                          placeholder="Additional notes"
                          sx={{ width: '100%' }}
                        />

                        {/* Cargo — placed directly below NOTES */}
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, backgroundColor: 'background.paper' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Cargo</Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Autocomplete
                                  size="small"
                                  multiple
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
                                  renderInput={(params) => <TextField {...params} inputRef={cargoInputRef} placeholder="Select Cargo Account" size="small" sx={{ width: 240 }} />}
                                  renderOption={(props, option) => (
                                    <Box component="li" {...props}>
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
                                  )}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => openCustomerForm('cargo')}
                                  sx={{
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'primary.dark' },
                                    borderRadius: 1,
                                    width: 38,
                                    height: 38
                                  }}
                                  title="Add New Cargo Account"
                                >
                                  <AddIcon />
                                </IconButton>
                              </Box>

                              {/* Selected cargo accounts displayed as red chips */}
                              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
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

                              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                                <TextField
                                  label="Out Labour"
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
                                  sx={{ width: 110 }}
                                />
                                <TextField
                                  label="Out Delivery"
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
                                  sx={{ width: 110 }}
                                />
                                <TextField
                                  label="Total Charges"
                                  size="small"
                                  value={(parseFloat(formData.out_labour_amount || 0) + parseFloat(formData.out_delivery_amount || 0)).toFixed(2)}
                                  InputProps={{ readOnly: true }}
                                  sx={{ width: 160 }}
                                />
                              </Box>

                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
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
                                />
                                <Typography variant="body2">Include in costprice</Typography>
                              </Box>

                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Right Section - Summary Fields */}
                  <Box sx={{ width: 350, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                  sx={{
                    px: 4,
                    py: 1.5,
                    bgcolor: 'secondary.main',
                    '&:hover': { bgcolor: 'secondary.dark' }
                  }}
                >
                  {isSubmitting
                    ? (saveStatusMessage || (editingPurchase ? 'Updating...' : 'Saving...'))
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


      {/* Add Customer Modal */}
      <Dialog
        open={showCustomerForm}
        onClose={handleCloseCustomerForm}
        disableAutoFocus
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'secondary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'white', color: 'secondary.main' }}>
              <AddIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add New Supplier
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new supplier account with complete details
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseCustomerForm}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ my: 2 }}>
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
                  startIcon={<LocationOnIcon />}
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
              {/* Row 1: Name, Primary Phone, Secondary Phone */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  inputRef={customerNameInputRefPurchases}
                  label="Account Name"
                  name="cus_name"
                  value={customerFormData.cus_name}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter account name"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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
                  value={customerFormData.cus_phone_no}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter primary phone number"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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
                  value={customerFormData.cus_phone_no2}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter secondary phone number"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Row 2: Address, Account Type, Category */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Address"
                  name="cus_address"
                  value={customerFormData.cus_address}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter complete address"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOnIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

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
                    options={customerTypes.map(type => ({ id: type.cus_type_id, title: type.cus_type_title }))}
                    value={customerTypes.map(t => ({ id: t.cus_type_id, title: t.cus_type_title })).find(o => o.id === customerFormData.cus_type) || null}
                    onChange={(event, newValue) => {
                      setCustomerFormData(prev => ({ ...prev, cus_type: newValue ? newValue.id : '' }));
                    }}
                    onHighlightChange={(event, option) => { highlightedTypeRef.current = option; }}
                    getOptionLabel={(option) => option.title}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    open={customerTypeOpenPurchases}
                    onOpen={() => setCustomerTypeOpenPurchases(true)}
                    onClose={() => setCustomerTypeOpenPurchases(false)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        inputRef={customerTypeInputRefPurchases}
                        label="Account Type"
                        onFocus={(e) => e.target.select()}
                        sx={{ minHeight: 56, minWidth: 220 }}
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
                    options={customerCategories.map(cat => ({ id: cat.cus_cat_id, title: cat.cus_cat_title }))}
                    value={customerCategories.map(c => ({ id: c.cus_cat_id, title: c.cus_cat_title })).find(o => o.id === customerFormData.cus_category) || null}
                    onChange={(event, newValue) => {
                      setCustomerFormData(prev => ({ ...prev, cus_category: newValue ? newValue.id : '' }));
                    }}
                    onHighlightChange={(event, option) => { highlightedCategoryRef.current = option; }}
                    getOptionLabel={(option) => option.title}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Supplier Category"
                        onFocus={(e) => e.target.select()}
                        sx={{ minHeight: 56, minWidth: 220 }}
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

              {/* Row 3: City, Reference, Account Info */}
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
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    size="medium"
                    sx={{ flex: 1 }}
                    options={cities.map(city => ({ id: city.city_id, title: city.city_name }))}
                    value={cities.map(c => ({ id: c.city_id, title: c.city_name })).find(o => o.id === customerFormData.city_id) || null}
                    onChange={(event, newValue) => {
                      setCustomerFormData(prev => ({ ...prev, city_id: newValue ? newValue.id : '' }));
                    }}
                    onHighlightChange={(event, option) => { highlightedCityRef.current = option; }}
                    getOptionLabel={(option) => option.title}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City"
                        onFocus={(e) => e.target.select()}
                        sx={{ minHeight: 56, minWidth: 220 }}
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

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Reference"
                  name="cus_reference"
                  value={customerFormData.cus_reference}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter reference"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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
                  label="Account Info"
                  name="cus_account_info"
                  value={customerFormData.cus_account_info}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter account information"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Row 4: CNIC, NTN Number, Name in Urdu */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="CNIC"
                  name="CNIC"
                  value={customerFormData.CNIC}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter CNIC number"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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
                  label="NTN Number"
                  name="NTN_NO"
                  value={customerFormData.NTN_NO}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter NTN number"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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
                  label="Name in Urdu"
                  name="name_urdu"
                  value={customerFormData.name_urdu}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter name in Urdu"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Row 5: Opening Balance, Other Information */}
              <Grid item xs={12} md={4}>
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
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
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

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Other Information"
                  name="other"
                  value={customerFormData.other}
                  onChange={handleCustomerFormChange}
                  placeholder="Enter other information"
                  size="medium"
                  sx={{ minHeight: 56, minWidth: 200 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomer(); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={handleCloseCustomerForm}
            variant="outlined"
            sx={{ px: 3, py: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddCustomer}
            variant="contained"
            disabled={isSubmittingCustomer}
            startIcon={isSubmittingCustomer ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{
              px: 4,
              py: 1.5,
              bgcolor: 'secondary.main',
              '&:hover': { bgcolor: 'secondary.dark' }
            }}
          >
            {isSubmittingCustomer ? 'Adding...' : 'Add Supplier'}
          </Button>
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
            <Box id="purchase-invoice" sx={{ width: '100%', bgcolor: 'white', p: 3, mt: 2 }}>
              {/* Company Header */}
              <Box sx={{ textAlign: 'center', py: 2, borderBottom: '2px solid #000' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>
                  اتفاق آئرن اینڈ سیمنٹ سٹور
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, direction: 'rtl' }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <PhoneIcon sx={{ color: '#25D366', fontSize: '1rem' }} />
                  <Typography variant="body2">Ph:- 0346-7560306, 0300-7560306</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, mt: 1 }}>
                  PURCHASE INVOICE
                </Typography>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Customer Name: <strong>{viewingPurchase.customer?.cus_name || 'N/A'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Phone No: <strong>{viewingPurchase.customer?.cus_phone_no || 'N/A'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Address: <strong>{viewingPurchase.customer?.cus_address || 'N/A'}</strong></Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Invoice No: <strong>#{viewingPurchase.pur_id}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Time: <strong>{formatTimePK(viewingPurchase?.created_at) || '—'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Date: <strong>{formatDatePK(viewingPurchase?.created_at) || '—'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Bill Type: <strong>{viewingPurchase.bill_type || 'PURCHASE'}</strong></Typography>
                  <Typography variant="body2">Created By: <strong>{getCreatedByName(viewingPurchase, currentUser)}</strong></Typography>
                </Box>
              </Box>

              {/* Product Table and Payment Summary */}
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
                      {viewingPurchase.purchase_details && viewingPurchase.purchase_details.length > 0 ? (
                        <>
                          {viewingPurchase.purchase_details.map((detail, index) => (
                            <TableRow key={detail.pur_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{detail.qnty || 0}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.crate || detail.unit_rate || detail.rate || 0)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.total_amount || detail.amount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} />
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }}>Total</TableCell>
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(viewingPurchase.purchase_details || []).reduce((s, d) => s + parseFloat(d.qnty || 0), 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right" />
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(viewingPurchase.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || d.amount || 0), 0)}</TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No items found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Previous Balance / Current Due / Total Due */}
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Previous Balance</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(viewingPurchase.previous_customer_balance ?? viewingPurchase.customer?.cus_balance ?? 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Current Due</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(getInvoiceRemainingDue(viewingPurchase))}</TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Total Due</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(getSupplierBalanceAfterBill(viewingPurchase))}</TableCell>
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
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#1976d2' }}>Outer Cargo Charges</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.out_labour_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Labour</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_labour_amount)}</TableCell>
                              </TableRow>
                            )}
                            {parseFloat(viewingPurchase.out_delivery_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Delivery</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_delivery_amount)}</TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                              <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Outer Charges</TableCell>
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
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#e65100' }}>Incity Charges</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.incity_own_labour || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Labour</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_labour)}</TableCell>
                              </TableRow>
                            )}
                            {parseFloat(viewingPurchase.incity_own_delivery || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Delivery</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_delivery)}</TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Incity Charges</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(parseFloat(viewingPurchase.incity_own_labour || 0) + parseFloat(viewingPurchase.incity_own_delivery || 0))}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>

                  <Box sx={{ flex: '0 0 48%' }}>
                    {/* Bill Amount / Charges / Payment */}
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Bill Amount</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.total_amount || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Labour</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.labour_amount || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Transport</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.transport_amount || 0)}</TableCell>
                          </TableRow>
                          {parseFloat(viewingPurchase.discount || 0) > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Discount</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>-{fmtAmt(viewingPurchase.discount || 0)}</TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Amount</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(getInvoiceNet(viewingPurchase))}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Cash</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.cash_payment || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{`Bank Payment${viewingPurchase?.bank_title ? ' (' + viewingPurchase.bank_title + ')' : ''}`}</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.bank_payment || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Received</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.payment || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Remaining Due</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(getInvoiceRemainingDue(viewingPurchase))}</TableCell>
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

            body.print-a4-view #printable-invoice-a4-view, body.print-a4-view #printable-invoice-a4-view * { visibility: visible !important; }
            body.print-thermal-view #printable-invoice-thermal-view, body.print-thermal-view #printable-invoice-thermal-view * { visibility: visible !important; }
            body.print-a4-view #printable-invoice-a4-view { display: block !important; width: 100% !important; }
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
          <Button startIcon={<PrintIcon />} onClick={() => handlePrintViewReceipt('A4')} sx={{ textTransform: 'none' }}>Print A4</Button>
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
      <Dialog open={showAddProductCategoryPopup} onClose={() => setShowAddProductCategoryPopup(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ background: 'linear-gradient(45deg, #16a34a 30%, #15803d 90%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            sx={{ background: 'linear-gradient(45deg, #16a34a 30%, #15803d 90%)', textTransform: 'none' }}>
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
            <Box id="receipt-preview" className="thermal-receipt" sx={{ width: '100%', bgcolor: 'white', p: 3, mt: 2, color: '#000', fontWeight: 'bold', '& *': { fontWeight: 'bold !important', color: '#000 !important' } }}>
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
                  mt: 1
                }}>
                  PURCHASE INVOICE
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
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Address: <strong>{currentBillData.customer?.cus_address || 'N/A'}</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Invoice No: <strong>#{currentBillData.pur_id}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Time: <strong>{formatTimePK(currentBillData?.created_at) || '—'}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Date: <strong>{formatDatePK(currentBillData?.created_at) || '—'}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Bill Type: <strong>{currentBillData.bill_type || 'PURCHASE'}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Created By: <strong>{getCreatedByName(currentBillData, currentUser)}</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
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
                      {currentBillData.purchase_details && currentBillData.purchase_details.length > 0 ? (
                        <>
                          {currentBillData.purchase_details.map((detail, index) => (
                            <TableRow key={detail.pur_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{detail.qnty || 0}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.crate || detail.unit_rate || detail.rate || 0)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.total_amount || detail.amount || 0)}</TableCell>
                            </TableRow>
                          ))}

                          {/* PRINTABLE: Totals row under product list */}
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} />
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }}>Total</TableCell>
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(currentBillData.purchase_details || []).reduce((s, d) => s + parseFloat(d.qnty || 0), 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right" />
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(currentBillData.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || d.amount || 0), 0)}</TableCell>
                          </TableRow>
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

                {/* Payment Summary */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Previous Balance Section */}
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>Previous Balance</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(currentBillData.previous_customer_balance ?? currentBillData.customer?.cus_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>Current Due</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(getInvoiceRemainingDue(currentBillData))}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>Total Due</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                              {fmtAmt(getSupplierBalanceAfterBill(currentBillData))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Outer Cargo Charges Section - Only show if there are outer charges */}
                    {(parseFloat(currentBillData.out_labour_amount || 0) > 0 || parseFloat(currentBillData.out_delivery_amount || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#1976d2' }}>
                                Outer Cargo Charges
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(currentBillData.out_labour_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Labour</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.out_labour_amount || 0)}
                                </TableCell>
                              </TableRow>
                            )}
                            {parseFloat(currentBillData.out_delivery_amount || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Delivery</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.out_delivery_amount || 0)}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Outer Charges</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(parseFloat(currentBillData.out_labour_amount || 0) + parseFloat(currentBillData.out_delivery_amount || 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Incity Charges Section - Only show if there are incity charges */}
                    {(parseFloat(currentBillData.incity_own_labour || 0) > 0 || parseFloat(currentBillData.incity_own_delivery || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#e65100' }}>
                                Incity Charges
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {parseFloat(currentBillData.incity_own_labour || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Labour</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.incity_own_labour || 0)}
                                </TableCell>
                              </TableRow>
                            )}
                            {parseFloat(currentBillData.incity_own_delivery || 0) > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Delivery</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.incity_own_delivery || 0)}
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Incity Charges</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                {fmtAmt(parseFloat(currentBillData.incity_own_labour || 0) + parseFloat(currentBillData.incity_own_delivery || 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Notes Section */}
                    {currentBillData.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>Notes:</strong> {currentBillData.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 48%' }}>
                    {/* Combined Charges and Payment Section */}
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Bill Amount</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.total_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Labour</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.labour_amount || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Transport</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.transport_amount || 0)}
                            </TableCell>
                          </TableRow>
                          {parseFloat(currentBillData.discount || 0) > 0 && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Discount</TableCell>
                              <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                                -{fmtAmt(currentBillData.discount || 0)}
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Amount</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(getInvoiceNet(currentBillData))}
                            </TableCell>
                          </TableRow>
                          {/* Always show cash payment */}
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Cash</TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.cash_payment || 0)}
                            </TableCell>
                          </TableRow>
                          {/* Always show bank payment row */}
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {`Bank Payment${currentBillData?.bank_title ? ' (' + currentBillData.bank_title + ')' : ''}`}
                            </TableCell>
                            <TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.bank_payment || 0)}
                            </TableCell>
                          </TableRow>
                          {/* Remove payment breakdown summary */}
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Received</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(currentBillData.payment || 0)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Remaining Due</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>
                              {fmtAmt(getInvoiceRemainingDue(currentBillData))}
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

            body.print-a4 #printable-invoice-a4-purchase, body.print-a4 #printable-invoice-a4-purchase * { visibility: visible !important; }
            body.print-thermal #printable-invoice-thermal-purchase, body.print-thermal #printable-invoice-thermal-purchase * { visibility: visible !important; }
            body.print-a4 #printable-invoice-a4-purchase { display: block !important; width: 100% !important; }
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
            startIcon={<PrintIcon />}
            onClick={() => handlePrintReceipt('A4', true)}
            sx={{ textTransform: 'none' }}
          >
            Print A4
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