'use client';

import { useState, useEffect } from 'react';
import { formatDatePKWithMonthName, getCreatedByName } from '@/lib/date-helper';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';
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
  useTheme,
  useMediaQuery,
  Divider,
  Fade,
  Zoom,
  LinearProgress,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar
} from '@mui/material';

import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  LocalShipping as ShippingIcon,
  History as HistoryIcon,
  FilterList as FilterIcon,
  RestartAlt as ResetIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ArrowForward as ArrowForwardIcon,
  CloudUpload as UploadIcon,
  Warning as WarningIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  LocationOn as MapPinIcon
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Premium Theme Patterns
const STYLES = {
  glassCard: {
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '24px',
    border: '1px solid rgba(224, 224, 224, 0.5)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      boxShadow: '0 15px 50px rgba(0,0,0,0.08)',
    }
  },
  gradientHeader: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    color: 'white',
    p: { xs: 3, md: 5 },
    borderRadius: '0 0 40px 40px',
    mb: -6,
    boxShadow: '0 10px 30px rgba(30, 58, 138, 0.2)',
    position: 'relative',
    zIndex: 1,
  },
  primaryGradientBtn: {
    background: 'linear-gradient(45deg, #3b82f6 30%, #2ecc71 90%)',
    borderRadius: '14px',
    px: 3,
    py: 1.2,
    fontSize: '0.9rem',
    fontWeight: '600',
    textTransform: 'none',
    color: 'white',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
    '&:hover': {
      background: 'linear-gradient(45deg, #2563eb 30%, #27ae60 90%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
    },
    transition: 'all 0.2s',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    '& .MuiTableCell-head': {
      fontWeight: '700',
      color: '#64748b',
      textTransform: 'uppercase',
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
      py: 2,
    }
  },
  input: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: '#f8fafc',
      '& fieldset': { border: '1px solid #e2e8f0' },
      '&:hover fieldset': { borderColor: '#cbd5e1' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    }
  }
};

export default function SaleReturnsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true, defaultMatches: false });

  // PIN auth
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();

  // State management
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'edit'
  const [saleReturns, setSaleReturns] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loaders, setLoaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);

  // Type-specific Customer States
  const [selectedFilterType, setSelectedFilterType] = useState(null);
  const [filterCustomers, setFilterCustomers] = useState([]);
  const [filterCustomersLoading, setFilterCustomersLoading] = useState(false);

  const [selectedFormType, setSelectedFormType] = useState(null);
  const [formCustomers, setFormCustomers] = useState([]);
  const [formCustomersLoading, setFormCustomersLoading] = useState(false);

  // Sale Search State
  const [saleSearchTerm, setSaleSearchTerm] = useState('');
  const [isSearchingSale, setIsSearchingSale] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Form states
  const [selectedSale, setSelectedSale] = useState(null);
  const [formData, setFormData] = useState({
    sale_id: '',
    cus_id: '',
    return_date: new Date().toISOString().split('T')[0],
    return_reason: '',
    return_details: [],
    total_return_amount: 0,
    payment: 0,
    payment_type: 'CASH',
    loader_id: '',
    shipping_amount: 0,
    labour_charges: 0,
    notes: '',
    manual_sale_inv: ''
  });

  // Manual Product Addition State
  const [manualProduct, setManualProduct] = useState(null);
  const [manualStore, setManualStore] = useState(null);
  const [manualQty, setManualQty] = useState(1);
  const [manualRate, setManualRate] = useState(0);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Account creation states
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [accountFormData, setAccountFormData] = useState({
    cus_name: '',
    cus_phone_no: '',
    cus_address: '',
    cus_type: '',
    cus_category: '',
    city_id: '',
    cus_email: '',
    cus_reference: '',
    cus_account_info: '',
    cus_opening_balance: '0',
    cus_balance: '0'
  });

  // Fetch filter customers when filter type changes
  useEffect(() => {
    if (selectedFilterType) {
      setFilterCustomersLoading(true);
      fetch(`/api/customers?dropdown=true&type=${selectedFilterType.cus_type_id}`)
        .then(res => res.json())
        .then(data => {
          setFilterCustomers(data || []);
          setFilterCustomersLoading(false);
        })
        .catch(err => {
          console.error(err);
          setFilterCustomersLoading(false);
        });
    } else {
      setFilterCustomers([]);
    }
  }, [selectedFilterType]);

  // Fetch form customers when form type changes
  useEffect(() => {
    if (selectedFormType) {
      setFormCustomersLoading(true);
      fetch(`/api/customers?dropdown=true&type=${selectedFormType.cus_type_id}`)
        .then(res => res.json())
        .then(data => {
          setFormCustomers(data || []);
          setFormCustomersLoading(false);
        })
        .catch(err => {
          console.error(err);
          setFormCustomersLoading(false);
        });
    } else {
      setFormCustomers([]);
    }
  }, [selectedFormType]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch('/api/sale-returns'),
        fetch('/api/sales'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/stores'),
        fetch('/api/loaders?limit=500'),
        fetch('/api/customer-types'),
        fetch('/api/customer-category'),
        fetch('/api/cities')
      ]);

      const data = await Promise.all(responses.map(res => res.json()));

      setSaleReturns(data[0] || []);
      setSales(data[1] || []);
      setProducts(data[2] || []);
      setStores(data[3]?.data || data[3] || []);
      setLoaders(Array.isArray(data[4]) ? data[4] : (data[4]?.loaders || []));
      setCustomerTypes(data[5] || []);
      setCustomerCategories(data[6] || []);
      setCities(data[7] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({ open: true, message: 'Error fetching data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };


  const handleAccountFormChange = (e) => {
    const { name, value } = e.target;
    setAccountFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (isSubmittingAccount) return;
    setIsSubmittingAccount(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountFormData)
      });
      if (response.ok) {
        const newCustomer = await response.json();
        setCustomers(prev => [...prev, newCustomer]);
        if (selectedFormType && newCustomer.cus_type === selectedFormType.cus_type_id) {
          setFormCustomers(prev => [...prev, newCustomer]);
        }
        if (selectedFilterType && newCustomer.cus_type === selectedFilterType.cus_type_id) {
          setFilterCustomers(prev => [...prev, newCustomer]);
        }
        setSnackbar({
          open: true,
          message: 'Account created successfully',
          severity: 'success'
        });
        setShowAccountForm(false);
        setAccountFormData({
          cus_name: '',
          cus_phone_no: '',
          cus_address: '',
          cus_type: '',
          cus_category: '',
          city_id: '',
          cus_email: '',
          cus_reference: '',
          cus_account_info: '',
          cus_opening_balance: '0',
          cus_balance: '0'
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Failed to create account',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving account:', error);
      setSnackbar({
        open: true,
        message: 'Error saving account',
        severity: 'error'
      });
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper functions
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFilterType(null);
    setSelectedCustomer(null);
    setSelectedStore(null);
    setDateFrom('');
    setDateTo('');
  };

  // Handle sale selection
  const handleSaleSelect = async (sale) => {
    setSelectedSale(sale);

    let fullSale = sale;
    try {
      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (response.ok) {
        fullSale = await response.json();
      }
    } catch (err) {
      console.error('Failed to fetch full sale for return:', err);
    }

    let customerType = null;
    let loadedFormCustomers = [];
    
    if (sale.customer) {
      const typeId = sale.customer.cus_type;
      const matchingType = customerTypes.find(t => t.cus_type_id === typeId);
      if (matchingType) {
        customerType = matchingType;
        try {
          const res = await fetch(`/api/customers?dropdown=true&type=${typeId}`);
          if (res.ok) {
            loadedFormCustomers = await res.json();
          }
        } catch (err) {
          console.error(err);
        }
      }
    } else if (sale.cus_id) {
      try {
        const resCus = await fetch(`/api/customers?id=${sale.cus_id}`);
        if (resCus.ok) {
          const customer = await resCus.json();
          const typeId = customer.cus_type;
          const matchingType = customerTypes.find(t => t.cus_type_id === typeId);
          if (matchingType) {
            customerType = matchingType;
            const res = await fetch(`/api/customers?dropdown=true&type=${typeId}`);
            if (res.ok) {
              loadedFormCustomers = await res.json();
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    setSelectedFormType(customerType);
    setFormCustomers(loadedFormCustomers);

    setFormData(prev => ({
      ...prev,
      sale_id: fullSale.sale_id,
      cus_id: fullSale.cus_id,
      loader_id: fullSale.loader_id || '',
      shipping_amount: parseFloat(fullSale.shipping_amount || 0),
      labour_charges: parseFloat(fullSale.labour_charges || fullSale.labour || 0),
      payment: 0,
      manual_sale_inv: fullSale.sale_id.toString(),
      return_details: fullSale.sale_details?.map(detail => ({
        pro_id: detail.pro_id,
        store_id: detail.store_id || fullSale.store_id,
        max_quantity: detail.qnty || 0,
        unit_rate: detail.unit_rate || 0,
        unit: detail.unit || 'PCS',
        return_quantity: 0,
        return_amount: 0,
        is_manual: false
      })) || []
    }));

    if (fullSale.store_id && stores.length > 0) {
      const matchingStore = stores.find(s =>
        (s.store_id && s.store_id === fullSale.store_id) ||
        (s.storeid && s.storeid === fullSale.store_id)
      );
      if (matchingStore) {
        setManualStore(matchingStore);
      }
    }
    showSnackbar(`Sale #${fullSale.sale_id} loaded successfully`, 'success');
  };

  // Handle sale search
  const handleSaleSearch = async (e) => {
    e?.preventDefault();
    if (!saleSearchTerm.trim()) return;

    setIsSearchingSale(true);
    try {
      if (!isNaN(saleSearchTerm)) {
        const idRes = await fetch(`/api/sales?id=${saleSearchTerm}`);
        if (idRes.ok) {
          const sale = await idRes.json();
          handleSaleSelect(sale);
          setIsSearchingSale(false);
          return;
        }
      }
      showSnackbar('Sale not found with that ID', 'warning');
    } catch (error) {
      console.error('Error searching sale:', error);
      showSnackbar('Error searching sale', 'error');
    } finally {
      setIsSearchingSale(false);
    }
  };

  // Handle Manual Product Selection
  const handleManualProductSelect = (product) => {
    setManualProduct(product);
    if (product) {
      setManualRate(product.pro_sale_price || 0);
    } else {
      setManualRate(0);
    }
  };

  // Add Manual Product to List
  const handleAddManualProduct = () => {
    if (!manualProduct) {
      showSnackbar('Please select a product', 'error');
      return;
    }
    if (!manualStore) {
      showSnackbar('Please select a store', 'error');
      return;
    }
    if (manualQty <= 0) {
      showSnackbar('Quantity must be greater than 0', 'error');
      return;
    }

    const newItem = {
      pro_id: manualProduct.pro_id,
      store_id: manualStore.storeid || manualStore.store_id,
      max_quantity: null,
      unit_rate: parseFloat(manualRate),
      unit: manualProduct.pro_unit || 'PCS',
      return_quantity: parseFloat(manualQty),
      return_amount: parseFloat(manualQty) * parseFloat(manualRate),
      is_manual: true
    };

    setFormData(prev => {
      const updatedDetails = [...prev.return_details, newItem];
      const totalReturnAmount = updatedDetails.reduce((sum, detail) => sum + (detail.return_amount || 0), 0);

      return {
        ...prev,
        return_details: updatedDetails,
        total_return_amount: totalReturnAmount
      };
    });

    setManualProduct(null);
    setManualQty(1);
    setManualRate(0);
    showSnackbar('Item added to return list', 'success');
  };

  // Keyboard shortcut 'a' to add product
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isTextInput = (activeEl?.tagName === 'INPUT' &&
        !['number', 'radio', 'checkbox', 'submit', 'button'].includes(activeEl?.type)) ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.isContentEditable;

      // Trigger if 'a' is pressed (case-insensitive) and not in a text input/textarea
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

  // Handle return quantity change
  const handleReturnQuantityChange = (index, quantity) => {
    const item = formData.return_details[index];
    let newQuantity = quantity;
    if (item.max_quantity !== null && item.max_quantity !== undefined) {
      newQuantity = Math.max(0, Math.min(quantity, item.max_quantity));
    } else {
      newQuantity = Math.max(0, quantity);
    }

    setFormData(prev => {
      const updatedDetails = prev.return_details.map((detail, i) => {
        if (i === index) {
          const returnAmount = newQuantity * parseFloat(detail.unit_rate || 0);
          return {
            ...detail,
            return_quantity: newQuantity,
            return_amount: returnAmount
          };
        }
        return detail;
      });

      const totalReturnAmount = updatedDetails.reduce((sum, detail) => sum + (detail.return_amount || 0), 0);

      return {
        ...prev,
        return_details: updatedDetails,
        total_return_amount: totalReturnAmount
      };
    });
  };

  // Remove return detail
  const removeReturnDetail = (index) => {
    setFormData(prev => {
      const updatedDetails = prev.return_details.filter((_, i) => i !== index);
      const totalReturnAmount = updatedDetails.reduce((sum, detail) => sum + (detail.return_amount || 0), 0);

      return {
        ...prev,
        return_details: updatedDetails,
        total_return_amount: totalReturnAmount
      };
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const hasPayment = parseFloat(formData.cash_payment || 0) > 0 || parseFloat(formData.bank_payment || 0) > 0;
    if (hasPayment) {
      const authOk = await requireAuth();
      if (!authOk) return;
    }

    if (!formData.cus_id) {
      showSnackbar('Please select a customer', 'error');
      return;
    }

    const returningItems = formData.return_details
      .filter(detail => detail.return_quantity > 0)
      .map(detail => ({
        ...detail,
        qnty: detail.return_quantity,
        total_amount: detail.return_amount
      }));

    if (returningItems.length === 0) {
      showSnackbar('Please select at least one item to return', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/sale-returns';
      const method = editingReturn ? 'PUT' : 'POST';

      const body = {
        ...formData,
        sale_id: formData.sale_id || null,
        total_amount: formData.total_return_amount,
        reason: formData.return_reason,
        reference: formData.notes,
        return_details: returningItems,
        manual_sale_inv: formData.manual_sale_inv,
        updated_by: 1 // Default user
      };

      if (editingReturn) body.id = editingReturn.return_id;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        notifyLedgerDataChanged('sale-return');
        await fetchData();
        setCurrentView('list');
        setEditingReturn(null);
        setSelectedSale(null);
        setFormData({
          sale_id: '',
          cus_id: '',
          return_date: new Date().toISOString().split('T')[0],
          return_reason: '',
          return_details: [],
          total_return_amount: 0,
          payment: 0,
          payment_type: 'CASH',
          loader_id: '',
          shipping_amount: 0,
          labour_charges: 0,
          notes: '',
          manual_sale_inv: ''
        });

        showSnackbar(
          editingReturn ? 'Sale return updated successfully' : 'Sale return created successfully',
          'success'
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        showSnackbar(
          errorData.message || errorData.error || `Error ${editingReturn ? 'updating' : 'creating'} sale return`,
          'error'
        );
      }
    } catch (error) {
      console.error('Error saving sale return:', error);
      showSnackbar('Error saving sale return', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = async (saleReturn) => {
    setEditingReturn(saleReturn);

    let customerType = null;
    let loadedFormCustomers = [];
    
    if (saleReturn.customer) {
      const typeId = saleReturn.customer.cus_type;
      const matchingType = customerTypes.find(t => t.cus_type_id === typeId);
      if (matchingType) {
        customerType = matchingType;
        try {
          const res = await fetch(`/api/customers?dropdown=true&type=${typeId}`);
          if (res.ok) {
            loadedFormCustomers = await res.json();
          }
        } catch (err) {
          console.error(err);
        }
      }
    } else if (saleReturn.cus_id) {
      try {
        const resCus = await fetch(`/api/customers?id=${saleReturn.cus_id}`);
        if (resCus.ok) {
          const customer = await resCus.json();
          const typeId = customer.cus_type;
          const matchingType = customerTypes.find(t => t.cus_type_id === typeId);
          if (matchingType) {
            customerType = matchingType;
            const res = await fetch(`/api/customers?dropdown=true&type=${typeId}`);
            if (res.ok) {
              loadedFormCustomers = await res.json();
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    setSelectedFormType(customerType);
    setFormCustomers(loadedFormCustomers);

    setFormData({
      sale_id: saleReturn.sale_id || '',
      cus_id: saleReturn.cus_id,
      return_date: saleReturn.return_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      return_reason: saleReturn.reason || '',
      return_details: saleReturn.return_details?.map(d => ({
        ...d,
        pro_id: d.pro_id,
        unit_rate: d.unit_rate,
        return_quantity: d.qnty,
        return_amount: d.total_amount,
        max_quantity: null,
        is_manual: true
      })) || [],
      total_return_amount: parseFloat(saleReturn.total_amount) || 0,
      payment: parseFloat(saleReturn.payment) || 0,
      payment_type: saleReturn.payment_type || 'CASH',
      loader_id: saleReturn.loader_id || '',
      shipping_amount: parseFloat(saleReturn.shipping_amount) || 0,
      labour_charges: parseFloat(saleReturn.labour_charges) || 0,
      notes: saleReturn.reference || '',
      manual_sale_inv: saleReturn.manual_sale_inv || ''
    });
    setCurrentView('create');
  };

  // Handle delete
  const handleDelete = async (returnId) => {
    if (window.confirm('Are you sure you want to delete this sale return? This will reverse all stock and balance adjustments.')) {
      try {
        const response = await fetch(`/api/sale-returns?id=${returnId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchData();
          showSnackbar('Sale return deleted successfully', 'success');
        } else {
          showSnackbar('Error deleting sale return', 'error');
        }
      } catch (error) {
        console.error('Error deleting sale return:', error);
        showSnackbar('Error deleting sale return', 'error');
      }
    }
  };

  const handleSendWhatsApp = async (returnItem) => {
    const customer = returnItem.customer || customers.find(c => c.cus_id === returnItem.cus_id);
    const phone = customer?.cus_phone_no;
    if (!phone) {
      showSnackbar('No phone number found for this customer', 'error');
      return;
    }

    const fmtN = (v) => fmtAmt(v);

    const details = returnItem.return_details || [];
    const totalAmount = parseFloat(returnItem.total_amount || 0);
    const labour = parseFloat(returnItem.labour_charges || 0);
    const delivery = parseFloat(returnItem.shipping_amount || 0);
    const discount = parseFloat(returnItem.discount || 0);
    const netReturn = totalAmount - labour - delivery - discount;
    const payment = parseFloat(returnItem.payment || 0);
    const remaining = netReturn - payment;
    const newBal = parseFloat(customer?.cus_balance ?? 0);
    const prevBal = parseFloat(returnItem.previous_customer_balance ?? (newBal + netReturn - payment));
    const returnDate = new Date(returnItem.return_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const returnTime = new Date(returnItem.return_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const itemRows = details.map((d, i) => `
      <tr>
        <td style="border:1px solid #ddd;padding:4px 6px;">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:4px 6px;">${d.product?.pro_title || d.pro_title || 'Item'}</td>
        <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;">${fmtN(d.qnty || d.return_quantity)}</td>
        <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;">${fmtN(d.unit_rate)}</td>
        <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;">${fmtN(d.total_amount || d.return_amount)}</td>
      </tr>`).join('');

    let tempEl = null;
    try {
      setIsSendingWhatsApp(true);
      tempEl = document.createElement('div');
      Object.assign(tempEl.style, {
        position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
        width: '800px', background: '#fff', padding: '24px',
        fontFamily: 'Arial, sans-serif', boxSizing: 'border-box',
      });
      tempEl.innerHTML = `
        <div style="text-align:center;padding-bottom:12px;border-bottom:2px solid #000;margin-bottom:12px;">
          <h2 style="margin:0;font-size:22px;direction:rtl;">اتفاق آئرن اینڈ سیمنٹ سٹور</h2>
          <p style="margin:4px 0;direction:rtl;">گجرات سرگودھا روڈ، پاہڑیانوالی</p>
          <p style="margin:4px 0;">Ph:- 0346-7560306, 0300-7560306</p>
          <h3 style="margin:8px 0 0 0;color:#c62828;letter-spacing:1px;">SALE RETURN INVOICE</h3>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd;margin-bottom:12px;">
          <div>
            <p style="margin:3px 0;">Customer Name: <strong>${customer?.cus_name || 'N/A'}</strong></p>
            <p style="margin:3px 0;">Phone No: <strong>${customer?.cus_phone_no || 'N/A'}</strong></p>
            ${customer?.cus_address ? `<p style="margin:3px 0;">Address: <strong>${customer.cus_address}</strong></p>` : ''}
          </div>
          <div style="text-align:right;">
            <p style="margin:3px 0;">Invoice No: <strong>${returnItem.return_id}</strong></p>
            <p style="margin:3px 0;">Return ID: <strong>${returnItem.return_id}</strong></p>
            ${returnItem.sale_id ? `<p style="margin:3px 0;">Sale ID: <strong>${returnItem.sale_id}</strong></p>` : ''}
            <p style="margin:3px 0;">Time: <strong>${returnTime}</strong></p>
            <p style="margin:3px 0;">Date: <strong>${returnDate}</strong></p>
            <p style="margin:3px 0;">Bill Type: <strong>SALE_RETURN</strong></p>
            <p style="margin:3px 0;">Created By: <strong>${getCreatedByName(returnItem, currentUser)}</strong></p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="background:#9e9e9e;color:white;">
              <th style="border:1px solid #bbb;padding:6px 8px;text-align:left;">S#</th>
              <th style="border:1px solid #bbb;padding:6px 8px;text-align:left;">Product Name</th>
              <th style="border:1px solid #bbb;padding:6px 8px;text-align:right;">Qty</th>
              <th style="border:1px solid #bbb;padding:6px 8px;text-align:right;">Rate</th>
              <th style="border:1px solid #bbb;padding:6px 8px;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;padding:12px;">No items</td></tr>'}</tbody>
        </table>
        <div style="display:flex;gap:16px;">
          <table style="flex:1;border-collapse:collapse;border:1px solid #000;">
            <tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">منسوخ کردہ رقم</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(totalAmount)}</td></tr>
            ${discount > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">رعایت</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(discount)}</td></tr>` : ''}
            ${labour > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">مزدوری</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(labour)}</td></tr>` : ''}
            ${delivery > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">کرایہ</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(delivery)}</td></tr>` : ''}
            <tr style="background:#e8f5e9;"><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">کل منسوخی</td><td style="font-weight:bold;text-align:right;padding:5px 8px;border:1px solid #ddd;color:#2e7d32;">${fmtN(netReturn)}</td></tr>
            <tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">سابقہ بقایا</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(prevBal)}</td></tr>
            <tr style="background:#f5f5f5;"><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">موجودہ بقایا</td><td style="font-weight:bold;text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(newBal)}</td></tr>
          </table>
          <table style="flex:1;border-collapse:collapse;border:1px solid #000;">
            <tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">رقم بل</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(totalAmount)}</td></tr>
            ${labour > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">مزدوری</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(labour)}</td></tr>` : ''}
            ${delivery > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">کرایہ</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(delivery)}</td></tr>` : ''}
            ${discount > 0 ? `<tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">رعایت</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">-${fmtN(discount)}</td></tr>` : ''}
            <tr style="background:#f5f5f5;"><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">کل واپسی رقم</td><td style="font-weight:bold;text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(netReturn)}</td></tr>
            <tr><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">نقد کیش</td><td style="text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(returnItem.cash_payment || 0)}</td></tr>
            <tr style="background:#f5f5f5;"><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">کل رقم وصول</td><td style="font-weight:bold;text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(payment)}</td></tr>
            <tr style="background:#d0d0d0;"><td style="font-weight:bold;direction:rtl;padding:5px 8px;border:1px solid #ddd;">بقایا رقم</td><td style="font-weight:bold;text-align:right;padding:5px 8px;border:1px solid #ddd;">${fmtN(remaining)}</td></tr>
          </table>
        </div>`;
      document.body.appendChild(tempEl);

      const { captureElementToCanvas, shareCanvasViaWhatsAppDesktop, whatsAppSuccessMessage } =
        await import('@/lib/whatsapp-local');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 80));
      const canvas = await captureElementToCanvas(tempEl);
      const { opened } = await shareCanvasViaWhatsAppDesktop(canvas, phone);
      showSnackbar(`✅ ${whatsAppSuccessMessage(opened)}`, 'success');
    } catch (err) {
      showSnackbar(`❌ WhatsApp error: ${err.message}`, 'error');
    } finally {
      if (tempEl && tempEl.parentNode) tempEl.parentNode.removeChild(tempEl);
      setIsSendingWhatsApp(false);
    }
  };

  // Filter and sort data
  const filteredAndSortedReturns = saleReturns
    .filter(returnItem => {
      const customer = returnItem.customer || customers.find(c => c.cus_id === returnItem.cus_id);

      const matchesSearch = (returnItem.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnItem.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnItem.manual_sale_inv?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.cus_name?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCustomer = !selectedCustomer || returnItem.cus_id === selectedCustomer.cus_id;
      const matchesDateFrom = !dateFrom || new Date(returnItem.return_date) >= new Date(dateFrom);
      const matchesDateTo = !dateTo || new Date(returnItem.return_date) <= new Date(dateTo);

      return matchesSearch && matchesCustomer && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (aValue < bValue) return -1 * modifier;
      if (aValue > bValue) return 1 * modifier;
      return 0;
    });

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
          <Typography variant="h6" color="text.secondary" className="animate-pulse">
            Loading Returns...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  // Render Sale Returns List View
  const renderSaleReturnsListView = () => (
    <DashboardLayout>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9', pb: 10 }}>
        {/* Modern Header */}
        <Box sx={STYLES.gradientHeader}>
          <Container maxWidth="xl">
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                    <HistoryIcon sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: '800', letterSpacing: '-0.02em', mb: 0.5 }}>
                      Sale Returns
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.8, fontWeight: '500' }}>
                      Manage customer returns, stock adjustments and refunds
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
                <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setShowAccountForm(true)}
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      borderRadius: '14px',
                      textTransform: 'none',
                      fontWeight: '600',
                      '&:hover': {
                        borderColor: 'white',
                        background: 'rgba(255, 255, 255, 0.1)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    New Account
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCurrentView('create')}
                    sx={STYLES.primaryGradientBtn}
                  >
                    Process New Return
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>

        <Container maxWidth="xl" sx={{ mt: 1 }}>
          <Stack spacing={4}>
            {/* Search & Filters Card */}
            <Fade in={true} timeout={800}>
              <Card sx={STYLES.glassCard}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                    <FilterIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: '700', color: 'text.primary' }}>
                      Filter Records
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      size="small"
                      startIcon={<ResetIcon />}
                      onClick={clearFilters}
                      sx={{ borderRadius: '10px', textTransform: 'none' }}
                    >
                      Reset Filters
                    </Button>
                  </Stack>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        placeholder="Search by ID, Customer or Reason..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        sx={STYLES.input}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon sx={{ color: 'primary.main' }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Autocomplete
                        options={customerTypes}
                        getOptionLabel={(option) => option.cus_type_title || ''}
                        value={selectedFilterType}
                        onChange={(event, newValue) => {
                          setSelectedFilterType(newValue);
                          setSelectedCustomer(null);
                        }}
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        renderInput={(params) => (
                          <TextField {...params} placeholder="Select Customer Type" onFocus={(e) => e.target.select()} sx={STYLES.input} />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Autocomplete
                        options={filterCustomers}
                        getOptionLabel={(option) => option.cus_name || ''}
                        value={selectedCustomer}
                        onChange={(event, newValue) => setSelectedCustomer(newValue)}
                        disabled={!selectedFilterType || filterCustomersLoading}
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        loading={filterCustomersLoading}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={filterCustomersLoading ? "Loading..." : selectedFilterType ? "Select Customer" : "Select Type First"}
                            onFocus={(e) => e.target.select()}
                            sx={STYLES.input}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {filterCustomersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label="From Date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        InputLabelProps={{ shrink: true }}
                        sx={STYLES.input}
                      />
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        type="date"
                        label="To Date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        InputLabelProps={{ shrink: true }}
                        sx={STYLES.input}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Fade>

            {/* Main Data Table */}
            <Fade in={true} timeout={1200}>
              <Card sx={STYLES.glassCard}>
                <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: '800' }}>
                      Recent Return Invoices
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Showing {filteredAndSortedReturns.length} of {saleReturns.length} records
                    </Typography>
                  </Box>
                  <Tooltip title="Reload Data">
                    <IconButton size="small" onClick={fetchData} sx={{ bgcolor: 'primary.50', color: 'primary.main' }}>
                      <ResetIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <TableContainer>
                  <Table sx={{ minWidth: 800 }}>
                    <TableHead sx={STYLES.tableHeader}>
                      <TableRow>
                        <TableCell>Return Details</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Original Sale</TableCell>
                        <TableCell>Return Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredAndSortedReturns.length > 0 ? (
                        filteredAndSortedReturns.map((returnItem) => {
                          const customer = customers.find(c => c.cus_id === returnItem.cus_id);
                          return (
                            <TableRow
                              key={returnItem.return_id}
                              hover
                              sx={{
                                transition: 'all 0.2s',
                                '&:hover': { bgcolor: '#f8fafc' }
                              }}
                            >
                              <TableCell>
                                <Stack direction="row" spacing={2} alignItems="center">
                                  <Box sx={{
                                    p: 1,
                                    bgcolor: 'error.50',
                                    color: 'error.main',
                                    borderRadius: '10px'
                                  }}>
                                    <ReceiptIcon fontSize="small" />
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: '700', color: 'primary.main' }}>
                                      INV-R-{returnItem.return_id}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 180 }} noWrap>
                                      {returnItem.reason || 'No reason provided'}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: '600' }}>
                                  {customer?.cus_name || 'Walk-in Customer'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {customer?.cus_phone_no || 'No contact'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={returnItem.sale_id ? `#${returnItem.sale_id}` : (returnItem.manual_sale_inv || 'No Invoice')}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    bgcolor: returnItem.sale_id ? 'primary.50' : '#f8fafc'
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="body2">
                                     {formatDatePKWithMonthName(returnItem.return_date)}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: '800', color: 'error.main' }}>
                                  PKR {fmtAmt(returnItem.total_amount)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                                  label="Completed"
                                  size="small"
                                  sx={{
                                    bgcolor: '#ecfdf5',
                                    color: '#059669',
                                    fontWeight: '700',
                                    borderRadius: '8px',
                                    px: 1,
                                    '& .MuiChip-icon': { color: '#059669' }
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEdit(returnItem)}
                                      sx={{ color: 'primary.main', bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(returnItem.return_id)}
                                      sx={{ color: 'error.main', bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' } }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Send WhatsApp Receipt">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleSendWhatsApp(returnItem)}
                                      disabled={isSendingWhatsApp}
                                      sx={{ color: 'success.main', bgcolor: 'success.50', '&:hover': { bgcolor: 'success.100' } }}
                                    >
                                      {isSendingWhatsApp ? <CircularProgress size={16} /> : <PhoneIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                            <Box sx={{ opacity: 0.5 }}>
                              <InventoryIcon sx={{ fontSize: 60, mb: 2 }} />
                              <Typography variant="h6">No return records found</Typography>
                              <Typography variant="body2">Try adjusting your filters or search terms</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Fade>
          </Stack>
        </Container>
      </Box>
    </DashboardLayout>
  );

  // Render Sale Return Create View
  const renderSaleReturnCreateView = () => {
    const affectedLoader = loaders.find(l => l.loader_id === formData.loader_id);

    return (
      <DashboardLayout>
        <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 10 }}>
          {/* Creation Header */}
          <Box sx={{
            background: editingReturn
              ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            py: 4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <Container maxWidth="xl">
              <Stack direction="row" spacing={3} alignItems="center">
                <IconButton
                  onClick={() => setCurrentView('list')}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: '800' }}>
                    {editingReturn ? 'Update Sale Return' : 'New Sale Return'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {editingReturn ? `Editing invoice INV-R-${editingReturn.return_id}` : 'No bill needed — select a customer and add any items to process a general return'}
                  </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {!editingReturn && (
                    <Paper sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 0.5,
                      borderRadius: '14px',
                      bgcolor: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}>
                      <TextField
                        placeholder="Enter Sale ID..."
                        size="small"
                        value={saleSearchTerm}
                        onChange={(e) => setSaleSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaleSearch()}
                        sx={{
                          width: 150,
                          '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': { border: 'none' },
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={handleSaleSearch}
                        disabled={isSearchingSale}
                        sx={{
                          bgcolor: 'white',
                          color: 'primary.main',
                          borderRadius: '10px',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          fontWeight: 'bold',
                          minWidth: 80
                        }}
                      >
                        {isSearchingSale ? <CircularProgress size={20} /> : 'Load Sale'}
                      </Button>
                    </Paper>
                  )}
                  <Button
                    variant="contained"
                    onClick={() => setCurrentView('list')}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      borderRadius: '10px',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                      fontWeight: 'bold',
                      tabIndex: -1
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Stack>
            </Container>
          </Box>

          <Container maxWidth="xl" sx={{ mt: -4 }}>
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                {/* Return Master Data */}
                <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                  <Card sx={STYLES.glassCard}>
                    <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: '700' }}>General Information</Typography>
                    </Box>
                    <CardContent sx={{ p: 4 }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={2}>
                          <TextField
                            fullWidth
                            label="Return Date"
                            type="date"
                            value={formData.return_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            sx={STYLES.input}
                            required
                          />
                        </Grid>
                        <Grid item xs={12} md={2}>
                          <TextField
                            fullWidth
                            label="Sale Invoice #"
                            placeholder="Manual Inv #"
                            value={formData.manual_sale_inv}
                            onChange={(e) => setFormData(prev => ({ ...prev, manual_sale_inv: e.target.value }))}
                            sx={STYLES.input}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            label="Return Reason / Remarks"
                            value={formData.return_reason}
                            onChange={(e) => setFormData(prev => ({ ...prev, return_reason: e.target.value }))}
                            placeholder="Why is it being returned?"
                            sx={STYLES.input}
                            required
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          {selectedSale ? (
                            <Box sx={{
                              p: 2,
                              bgcolor: 'primary.50',
                              borderRadius: '12px',
                              border: '1px dashed',
                              borderColor: 'primary.200',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <Box>
                                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Selected Sale</Typography>
                                <Typography variant="body1" sx={{ fontWeight: '700' }}>#{selectedSale.sale_id} - {selectedSale.customer?.cus_name || formCustomers.find(c => c.cus_id === selectedSale.cus_id)?.cus_name || 'Walk-in'}</Typography>
                              </Box>
                              <IconButton size="small" color="error" onClick={() => {
                                setSelectedSale(null);
                                setSelectedFormType(null);
                                setFormCustomers([]);
                                setFormData(prev => ({ ...prev, sale_id: '', manual_sale_inv: '', return_details: [] }));
                              }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={6}>
                                <Autocomplete
                                  options={customerTypes}
                                  getOptionLabel={(option) => option.cus_type_title || ''}
                                  value={selectedFormType}
                                  onChange={(event, newValue) => {
                                    setSelectedFormType(newValue);
                                    setFormData(prev => ({ ...prev, cus_id: '' }));
                                  }}
                                  autoSelect={true}
                                  autoHighlight={true}
                                  openOnFocus={true}
                                  selectOnFocus={true}
                                  ListboxProps={{ sx: { maxHeight: 180 } }}
                                  renderInput={(params) => <TextField {...params} label="Customer Type" onFocus={(e) => e.target.select()} sx={STYLES.input} />}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Autocomplete
                                  options={formCustomers}
                                  getOptionLabel={(option) => option.cus_name || ''}
                                  value={formCustomers.find(c => c.cus_id === formData.cus_id) || null}
                                  onChange={(event, newValue) => {
                                    setFormData(prev => ({ ...prev, cus_id: newValue ? newValue.cus_id : '' }));
                                  }}
                                  disabled={!selectedFormType || formCustomersLoading}
                                  autoSelect={true}
                                  autoHighlight={true}
                                  openOnFocus={true}
                                  selectOnFocus={true}
                                  loading={formCustomersLoading}
                                  ListboxProps={{ sx: { maxHeight: 180 } }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={formCustomersLoading ? "Loading..." : selectedFormType ? "Select Customer" : "Select Type First"}
                                      onFocus={(e) => e.target.select()}
                                      sx={STYLES.input}
                                      InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                          <>
                                            {formCustomersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                          </>
                                        ),
                                      }}
                                    />
                                  )}
                                />
                              </Grid>
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Zoom>

                {/* Loader & Shipping Logic Section */}
                <Zoom in={true} style={{ transitionDelay: '150ms' }}>
                  <Card sx={{ ...STYLES.glassCard, transition: 'all 0.5s ease' }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ShippingIcon color="secondary" />
                      <Typography variant="h6" sx={{ fontWeight: '700' }}>Loader & Logistics Impact</Typography>
                    </Box>
                    <CardContent sx={{ p: 4 }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                          <Autocomplete
                            options={loaders}
                            getOptionLabel={(o) => o.loader_name}
                            value={loaders.find(l => l.loader_id === formData.loader_id) || null}
                            onChange={(e, v) => setFormData(p => ({ ...p, loader_id: v ? v.loader_id : '' }))}
                            autoSelect={true}
                            autoHighlight={true}
                            openOnFocus={true}
                            selectOnFocus={true}
                            renderInput={(params) => <TextField {...params} label="Affected Loader (optional)" onFocus={(e) => e.target.select()} sx={STYLES.input} />}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Delivery Charges (Deducted)"
                            value={formData.shipping_amount}
                            onChange={(e) => setFormData(p => ({ ...p, shipping_amount: parseFloat(e.target.value) || 0 }))}
                            onFocus={(e) => e.target.select()}
                            sx={STYLES.input}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">PKR</InputAdornment>
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Labour Charges (Deducted)"
                            value={formData.labour_charges}
                            onChange={(e) => setFormData(p => ({ ...p, labour_charges: parseFloat(e.target.value) || 0 }))}
                            onFocus={(e) => e.target.select()}
                            sx={STYLES.input}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">PKR</InputAdornment>
                            }}
                          />
                        </Grid>

                        {affectedLoader && (
                          <Grid item xs={12}>
                            <Fade in={true}>
                              <Alert
                                severity="warning"
                                icon={<WarningIcon />}
                                sx={{
                                  borderRadius: '16px',
                                  '& .MuiAlert-message': { width: '100%' },
                                  bgcolor: '#fffbeb',
                                  border: '1px solid #fdec9a'
                                }}
                              >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Loader Balance Adjustment</Typography>
                                    <Typography variant="body2">
                                      Processing this return will <strong>deduct PKR {fmtAmt(formData.shipping_amount)}</strong> from <strong>{affectedLoader.loader_name}</strong>'s current balance (PKR {fmtAmt(affectedLoader.loader_balance)}).
                                    </Typography>
                                  </Box>
                                  <Chip label="Automatic Deduction" size="small" color="warning" sx={{ fontWeight: 'bold' }} />
                                </Box>
                              </Alert>
                            </Fade>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Zoom>

                {/* Manual Product Add Section */}
                <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                  <Card sx={{ ...STYLES.glassCard, bgcolor: '#fcfcfc' }}>
                    <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AddIcon color="secondary" />
                        <Typography variant="body1" sx={{ fontWeight: '700' }}>Quick Add Product</Typography>
                      </Stack>
                    </Box>
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                          <Autocomplete
                            options={products}
                            getOptionLabel={(option) => option.pro_title || ''}
                            value={manualProduct}
                            onChange={(event, newValue) => handleManualProductSelect(newValue)}
                            autoSelect={true}
                            autoHighlight={true}
                            openOnFocus={true}
                            selectOnFocus={true}
                            ListboxProps={{ sx: { maxHeight: 130 } }}
                            renderInput={(params) => <TextField {...params} label="Select Product" onFocus={(e) => e.target.select()} sx={STYLES.input} />}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Autocomplete
                            options={stores}
                            getOptionLabel={(option) => option.store_name || ''}
                            value={manualStore}
                            onChange={(event, newValue) => setManualStore(newValue)}
                            autoSelect={true}
                            autoHighlight={true}
                            openOnFocus={true}
                            selectOnFocus={true}
                            renderInput={(params) => <TextField {...params} label="Target Store" onFocus={(e) => e.target.select()} sx={STYLES.input} />}
                          />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <TextField
                            type="number"
                            label="Qty"
                            value={manualQty}
                            onChange={(e) => setManualQty(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            fullWidth
                            sx={STYLES.input}
                          />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <TextField
                            type="number"
                            label="R-Rate"
                            value={manualRate}
                            onChange={(e) => setManualRate(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            fullWidth
                            sx={STYLES.input}
                          />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <Button
                            fullWidth
                            variant="contained"
                            id="add-product-btn"
                            onClick={handleAddManualProduct}
                            sx={{
                              height: 54,
                              borderRadius: '12px',
                              bgcolor: 'secondary.main',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                              '&:hover': { bgcolor: 'secondary.dark' }
                            }}
                          >
                            <AddIcon />
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Zoom>

                {/* Items Table */}
                <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                  <Card sx={STYLES.glassCard}>
                    <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <InventoryIcon color="primary" />
                        <Typography variant="h6" sx={{ fontWeight: '700' }}>Return Bag</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {formData.return_details.length} Items Listed
                      </Typography>
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead sx={STYLES.tableHeader}>
                          <TableRow>
                            <TableCell width="50">#</TableCell>
                            <TableCell>Product Information</TableCell>
                            <TableCell>Storage</TableCell>
                            <TableCell align="center">Max Qty</TableCell>
                            <TableCell align="right">Unit Rate</TableCell>
                            <TableCell align="center" width="120">Return Qty</TableCell>
                            <TableCell align="right">Line Total</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {formData.return_details.length > 0 ? (
                            formData.return_details.map((detail, index) => {
                              const product = products.find(p => p.pro_id === detail.pro_id);
                              const store = stores.find(s => (s.storeid === detail.store_id || s.store_id === detail.store_id));
                              return (
                                <TableRow key={index} hover>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: '700' }}>{product?.pro_title || 'Unknown Product'}</Typography>
                                    <Stack direction="row" spacing={0.5}>
                                      {detail.is_manual && <Chip label="Manual" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fef3c7', color: '#92400e', fontWeight: 'bold' }} />}
                                      {!detail.is_manual && <Chip label="From Sale" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#dcfce7', color: '#166534', fontWeight: 'bold' }} />}
                                    </Stack>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      size="small"
                                      value={detail.store_id || ''}
                                      onChange={(e) => {
                                        const s = stores.find(st => (st.storeid === e.target.value || st.store_id === e.target.value));
                                        const newId = s?.storeid || s?.store_id;
                                        setFormData(prev => ({
                                          ...prev,
                                          return_details: prev.return_details.map((d, i) =>
                                            i === index ? { ...d, store_id: newId } : d
                                          )
                                        }));
                                      }}
                                      sx={{ minWidth: 110, fontSize: '0.85rem' }}
                                    >
                                      {stores.map(s => {
                                        const id = s.storeid || s.store_id;
                                        return <MenuItem key={id} value={id}>{s.store_name}</MenuItem>;
                                      })}
                                    </Select>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      {detail.max_quantity !== null ? detail.max_quantity : '∞'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" sx={{ fontWeight: '600' }}>{fmtAmt(detail.unit_rate)}</Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={detail.return_quantity || 0}
                                      onChange={(e) => handleReturnQuantityChange(index, parseFloat(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                      inputProps={{
                                        min: 0,
                                        max: detail.max_quantity !== null ? detail.max_quantity : undefined,
                                        style: { textAlign: 'center', fontWeight: '800' }
                                      }}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" sx={{ fontWeight: '800', color: 'primary.main' }}>{fmtAmt(detail.return_amount)}</Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <IconButton size="small" color="error" onClick={() => removeReturnDetail(index)} sx={{ bgcolor: 'error.50' }}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                                <Box sx={{ opacity: 0.3 }}>
                                  <UploadIcon sx={{ fontSize: 48, mb: 1 }} />
                                  <Typography variant="body1">No products to return yet.</Typography>
                                  <Typography variant="body2">Search for a sale or add manually above.</Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Summary & Footer */}
                    <Box sx={{ p: 4, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                      <Grid container spacing={4} alignItems="flex-end">
                        <Grid item xs={12} md={7}>
                          <Stack spacing={3}>
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              label="Internal Notes / Reference"
                              placeholder="Add any internal reference..."
                              value={formData.notes}
                              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                              sx={STYLES.input}
                            />
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Refund Amount (Cash/Paid)"
                                  value={formData.payment}
                                  onChange={(e) => setFormData(prev => ({ ...prev, payment: parseFloat(e.target.value) || 0 }))}
                                  onFocus={(e) => e.target.select()}
                                  sx={STYLES.input}
                                  InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Autocomplete
                                  options={['CASH', 'BANK_TRANSFER', 'CHEQUE']}
                                  value={formData.payment_type}
                                  onChange={(e, v) => setFormData(prev => ({ ...prev, payment_type: v || 'CASH' }))}
                                  autoSelect={true}
                                  autoHighlight={true}
                                  openOnFocus={true}
                                  selectOnFocus={true}
                                  renderInput={(params) => <TextField {...params} label="Refund Via" onFocus={(e) => e.target.select()} sx={STYLES.input} />}
                                />
                              </Grid>
                            </Grid>
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={5}>
                          <Paper sx={{ p: 3, borderRadius: '16px', bgcolor: 'white', border: '1px solid #e2e8f0' }}>
                            <Stack spacing={2}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography color="text.secondary">Return Subtotal</Typography>
                                <Typography sx={{ fontWeight: '700' }}>PKR {fmtAmt(formData.total_return_amount)}</Typography>
                              </Box>
                              {formData.shipping_amount > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography color="text.secondary">Delivery Charges</Typography>
                                  <Typography sx={{ fontWeight: '700', color: 'error.main' }}>- PKR {fmtAmt(formData.shipping_amount)}</Typography>
                                </Box>
                              )}
                              {formData.labour_charges > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography color="text.secondary">Labour Charges</Typography>
                                  <Typography sx={{ fontWeight: '700', color: 'error.main' }}>- PKR {fmtAmt(formData.labour_charges)}</Typography>
                                </Box>
                              )}
                              <Divider />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="h6" sx={{ fontWeight: '800' }}>Net Return</Typography>
                                  <Typography variant="caption" color="text.secondary">Adjusted customer balance</Typography>
                                </Box>
                                <Typography variant="h5" sx={{ fontWeight: '900', color: 'success.main' }}>
                                  PKR {fmtAmt(formData.total_return_amount - formData.shipping_amount - formData.labour_charges)}
                                </Typography>
                              </Box>
                              <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                type="submit"
                                onKeyDown={(e) => {
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault();
                                    // Trigger form submission
                                    const form = e.target.closest('form');
                                    if (form) form.requestSubmit();
                                  }
                                }}
                                disabled={isSubmitting || formData.total_return_amount <= 0}
                                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                sx={{ ...STYLES.primaryGradientBtn, py: 2, fontSize: '1.1rem' }}
                              >
                                {isSubmitting ? 'Processing Invoice...' : (editingReturn ? 'Update Return' : 'Confirm & Process Return')}
                              </Button>
                            </Stack>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Box>
                  </Card>
                </Zoom>
              </Stack>
            </form>
          </Container>
        </Box>
      </DashboardLayout>
    );
  };

  return (
    <>
      <Fade in={true}>
        <Box>
          {currentView === 'list' ? renderSaleReturnsListView() : renderSaleReturnCreateView()}
        </Box>
      </Fade>

      {/* Modern Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            fontWeight: '600'
          }}
          iconMapping={{
            success: <CheckCircleIcon fontSize="inherit" />,
            error: <ErrorIcon fontSize="inherit" />,
            warning: <InfoIcon fontSize="inherit" />
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      {/* Account Creation Dialog */}
      <Dialog
        open={showAccountForm}
        onClose={() => setShowAccountForm(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <AddIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: '800' }}>
                Create New Account
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Essential for recording returns against new customers
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAccountForm(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveAccount}>
          <DialogContent sx={{ p: 4 }}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Account Name"
                  name="cus_name"
                  value={accountFormData.cus_name}
                  onChange={handleAccountFormChange}
                  required
                  sx={STYLES.input}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PersonIcon color="primary" /></InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  name="cus_phone_no"
                  value={accountFormData.cus_phone_no}
                  onChange={handleAccountFormChange}
                  sx={STYLES.input}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PersonIcon color="primary" /></InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Email Address"
                  name="cus_email"
                  type="email"
                  value={accountFormData.cus_email}
                  onChange={handleAccountFormChange}
                  sx={STYLES.input}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PersonIcon color="primary" /></InputAdornment>,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  fullWidth
                  options={customerTypes}
                  getOptionLabel={(option) => option.cus_type_title || ''}
                  value={customerTypes.find(t => t.cus_type_id === accountFormData.cus_type) || null}
                  onChange={(e, val) => handleAccountFormChange({ target: { name: 'cus_type', value: val?.cus_type_id || '' } })}
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Account Type"
                      onFocus={(e) => e.target.select()}
                      sx={STYLES.input}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><PersonIcon color="primary" /></InputAdornment>,
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  fullWidth
                  options={customerCategories}
                  getOptionLabel={(option) => option.cus_cat_title || ''}
                  value={customerCategories.find(c => c.cus_cat_id === accountFormData.cus_category) || null}
                  onChange={(e, val) => handleAccountFormChange({ target: { name: 'cus_category', value: val?.cus_cat_id || '' } })}
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Account Category"
                      onFocus={(e) => e.target.select()}
                      sx={STYLES.input}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><BusinessIcon color="primary" /></InputAdornment>,
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  fullWidth
                  options={cities}
                  getOptionLabel={(option) => option.city_name || ''}
                  value={cities.find(c => c.city_id === accountFormData.city_id) || null}
                  onChange={(e, val) => handleAccountFormChange({ target: { name: 'city_id', value: val?.city_id || '' } })}
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="City"
                      onFocus={(e) => e.target.select()}
                      sx={STYLES.input}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><MapPinIcon color="primary" /></InputAdornment>,
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Primary Address"
                  name="cus_address"
                  multiline
                  rows={2}
                  value={accountFormData.cus_address}
                  onChange={handleAccountFormChange}
                  sx={STYLES.input}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 4, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setShowAccountForm(false)} sx={{ fontWeight: '600', color: '#64748b' }}>
              Discard
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmittingAccount}
              sx={{
                ...STYLES.primaryGradientBtn,
                px: 6
              }}
            >
              {isSubmittingAccount ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />
    </>
  );
}
