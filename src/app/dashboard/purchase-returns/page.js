'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';

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
  LinearProgress
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
  Warning as WarningIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as BankIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';

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
    background: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    color: 'white',
    p: { xs: 3, md: 5 },
    borderRadius: '0 0 40px 40px',
    mb: -6,
    boxShadow: '0 10px 30px rgba(220, 38, 38, 0.2)',
    position: 'relative',
    zIndex: 1,
  },
  primaryGradientBtn: {
    background: 'linear-gradient(45deg, #dc2626 30%, #f97316 90%)',
    borderRadius: '14px',
    px: 3,
    py: 1.2,
    fontSize: '0.9rem',
    fontWeight: '600',
    textTransform: 'none',
    color: 'white',
    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)',
    '&:hover': {
      background: 'linear-gradient(45deg, #b91c1c 30%, #ea580c 90%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(220, 38, 38, 0.4)',
    },
    transition: 'all 0.2s',
  },
  tableHeader: {
    backgroundColor: '#fef2f2',
    '& .MuiTableCell-head': {
      fontWeight: '700',
      color: '#991b1b',
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
      '&:hover fieldset': { borderColor: '#fca5a5' },
      '&.Mui-focused fieldset': { borderColor: '#dc2626' },
    }
  },
  infoBox: {
    p: 2,
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1.5
  }
};

export default function PurchaseReturnsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true, defaultMatches: false });

  // PIN auth
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();

  // State management
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'edit'
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);

  // Purchase Search State
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [isSearchingPurchase, setIsSearchingPurchase] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form states
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedCustomerAccount, setSelectedCustomerAccount] = useState(null);
  const [formData, setFormData] = useState({
    purchase_id: '',
    cus_id: '',
    return_date: new Date().toISOString().split('T')[0],
    return_reason: '',
    return_details: [],
    total_return_amount: 0,
    notes: ''
  });

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch('/api/purchase-returns'),
        fetch('/api/purchases'),
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/stores')
      ]);

      const data = await Promise.all(responses.map(res => res.json()));

      setPurchaseReturns(data[0] || []);
      setPurchases(data[1] || []);
      setCustomers(data[2] || []);
      setProducts(data[3] || []);
      setStores(data[4] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error fetching data', 'error');
    } finally {
      setLoading(false);
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
    setSelectedSupplier(null);
    setSelectedStore(null);
    setDateFrom('');
    setDateTo('');
  };

  // Filter purchases by customer account
  const getFilteredPurchases = () => {
    if (!selectedCustomerAccount) return [];
    if (!Array.isArray(purchases)) return [];
    return purchases.filter(p => p.cus_id === selectedCustomerAccount.cus_id);
  };

  // Handle customer account selection
  const handleCustomerAccountSelect = (customer) => {
    setSelectedCustomerAccount(customer);
    setSelectedPurchase(null);
    setFormData(prev => ({
      ...prev,
      cus_id: customer?.cus_id || '',
      purchase_id: '',
      return_details: []
    }));
  };

  // Handle purchase selection
  const handlePurchaseSelect = (purchase) => {
    if (!purchase) {
      setSelectedPurchase(null);
      setFormData(prev => ({
        ...prev,
        purchase_id: '',
        return_details: []
      }));
      return;
    }

    setSelectedPurchase(purchase);

    // Parse numeric values safely
    const parseNumeric = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      return 0;
    };

    setFormData(prev => ({
      ...prev,
      purchase_id: purchase.pur_id,
      cus_id: purchase.cus_id,
      return_details: purchase.purchase_details?.map(detail => ({
        pro_id: detail.pro_id,
        product_name: detail.product?.pro_title || 'Unknown Product',
        max_quantity: parseInt(detail.qnty) || 0,
        return_quantity: 0,
        unit: detail.unit || 'pcs',
        unit_rate: parseNumeric(detail.unit_rate),
        return_amount: 0
      })) || []
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalReturnAmount = formData.return_details.reduce((sum, item) => {
      return sum + (parseFloat(item.return_amount) || 0);
    }, 0);

    return { totalReturnAmount };
  };

  // Handle return quantity change
  const handleReturnQuantityChange = (index, quantity) => {
    const detail = formData.return_details[index];
    const qty = Math.min(Math.max(0, parseInt(quantity) || 0), detail.max_quantity);
    const returnAmount = qty * (parseFloat(detail.unit_rate) || 0);

    const updatedDetails = [...formData.return_details];
    updatedDetails[index] = {
      ...detail,
      return_quantity: qty,
      return_amount: returnAmount
    };

    const totalReturnAmount = updatedDetails.reduce((sum, item) => sum + (item.return_amount || 0), 0);

    setFormData(prev => ({
      ...prev,
      return_details: updatedDetails,
      total_return_amount: totalReturnAmount
    }));
  };

  // Format currency
  const formatCurrency = (amount) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    const formatted = num % 1 === 0
      ? num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Rs. ${formatted}`;
  };

  // Reset form
  const resetForm = () => {
    setSelectedPurchase(null);
    setSelectedCustomerAccount(null);
    setEditingReturn(null);
    setFormData({
      purchase_id: '',
      cus_id: '',
      return_date: new Date().toISOString().split('T')[0],
      return_reason: '',
      return_details: [],
      total_return_amount: 0,
      notes: ''
    });
  };

  // Handle edit
  const handleEdit = async (returnItem) => {
    setEditingReturn(returnItem);

    // Find the purchase
    const purchase = Array.isArray(purchases) ? purchases.find(p => p.pur_id === returnItem.purchase_id) : null;
    if (purchase) {
      // Find the customer account
      const customer = Array.isArray(customers) ? customers.find(c => c.cus_id === purchase.cus_id) : null;
      setSelectedCustomerAccount(customer);
      setSelectedPurchase(purchase);
    }

    // Parse return details
    const parseNumeric = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      return 0;
    };

    setFormData({
      purchase_id: returnItem.purchase_id,
      cus_id: returnItem.purchase?.cus_id || '',
      return_date: returnItem.return_date ? new Date(returnItem.return_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      return_reason: returnItem.return_reason || '',
      return_details: returnItem.return_details?.map(detail => ({
        pro_id: detail.pro_id,
        product_name: detail.product?.pro_title || 'Unknown Product',
        max_quantity: purchase?.purchase_details?.find(pd => pd.pro_id === detail.pro_id)?.qnty || 0,
        return_quantity: parseInt(detail.return_quantity) || 0,
        unit: detail.unit || 'pcs',
        unit_rate: parseNumeric(detail.unit_rate),
        return_amount: parseNumeric(detail.return_amount)
      })) || [],
      total_return_amount: parseNumeric(returnItem.total_return_amount),
      notes: returnItem.notes || ''
    });

    setCurrentView('edit');
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase return? This will reverse all stock and ledger changes.')) {
      return;
    }

    try {
      const response = await fetch(`/api/purchase-returns?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }

      showSnackbar('Purchase return deleted successfully', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      showSnackbar(error.message || 'Error deleting purchase return', 'error');
    }
  };

  const handleSendWhatsApp = async (returnItem) => {
    const customerId = returnItem?.purchase?.cus_id ?? returnItem?.cus_id;
    const customer = customers.find(c => c.cus_id === customerId);
    const phone = returnItem?.purchase?.customer?.cus_phone_no || customer?.cus_phone_no;
    if (!phone) {
      showSnackbar('No phone number found for this supplier', 'error');
      return;
    }

    let tempEl = null;
    try {
      setIsSendingWhatsApp(true);
      tempEl = document.createElement('div');
      tempEl.style.position = 'fixed';
      tempEl.style.left = '-9999px';
      tempEl.style.top = '0';
      tempEl.style.width = '700px';
      tempEl.style.background = '#fff';
      tempEl.style.padding = '24px';
      tempEl.style.fontFamily = 'Arial, sans-serif';
      tempEl.innerHTML = `
        <div style="border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:12px;">
          <h2 style="margin:0;color:#dc2626;">Purchase Return Receipt</h2>
          <p style="margin:6px 0 0 0;color:#555;">Return #${returnItem.id}</p>
        </div>
        <p><strong>Supplier:</strong> ${customer?.cus_name || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date(returnItem.return_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        <p><strong>Reason:</strong> ${returnItem.return_reason || 'N/A'}</p>
        <p><strong>Total Return:</strong> ${formatCurrency(returnItem.total_return_amount)}</p>
      `;
      document.body.appendChild(tempEl);

      const { captureElementToCanvas, shareCanvasViaWhatsAppDesktop, whatsAppSuccessMessage } =
        await import('@/lib/whatsapp-local');
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

  // Handle submit
  const handleSubmit = async () => {
    const authOk = await requireAuth();
    if (!authOk) return;
    // Validation
    if (!formData.purchase_id) {
      showSnackbar('Please select a purchase', 'error');
      return;
    }

    if (!formData.return_reason.trim()) {
      showSnackbar('Please enter a return reason', 'error');
      return;
    }

    const itemsToReturn = formData.return_details.filter(d => d.return_quantity > 0);
    if (itemsToReturn.length === 0) {
      showSnackbar('Please add at least one item to return', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        purchase_id: formData.purchase_id,
        return_date: formData.return_date,
        return_reason: formData.return_reason,
        return_details: itemsToReturn.map(item => ({
          pro_id: item.pro_id,
          return_quantity: item.return_quantity,
          unit_rate: item.unit_rate,
          return_amount: item.return_amount
        })),
        total_return_amount: formData.total_return_amount,
        notes: formData.notes
      };

      const url = editingReturn
        ? '/api/purchase-returns'
        : '/api/purchase-returns';

      const method = editingReturn ? 'PUT' : 'POST';

      if (editingReturn) {
        payload.id = editingReturn.id;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      showSnackbar(
        editingReturn ? 'Purchase return updated successfully' : 'Purchase return created successfully',
        'success'
      );
      resetForm();
      setCurrentView('list');
      fetchData();
    } catch (error) {
      console.error('Error submitting:', error);
      showSnackbar(error.message || 'Error saving purchase return', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter returns for list view
  const getFilteredReturns = () => {
    if (!Array.isArray(purchaseReturns)) return [];
    let filtered = [...purchaseReturns];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.return_reason?.toLowerCase().includes(term) ||
        r.id?.toString().includes(term) ||
        r.purchase?.invoice_number?.toLowerCase().includes(term)
      );
    }

    if (selectedSupplier) {
      filtered = filtered.filter(r => r.purchase?.cus_id === selectedSupplier.cus_id);
    }

    if (dateFrom) {
      filtered = filtered.filter(r => new Date(r.return_date) >= new Date(dateFrom));
    }

    if (dateTo) {
      filtered = filtered.filter(r => new Date(r.return_date) <= new Date(dateTo));
    }

    return filtered;
  };

  // Get supplier name
  const getSupplierName = (cusId) => {
    if (!Array.isArray(customers)) return 'Unknown Supplier';
    const customer = customers.find(c => c.cus_id === cusId);
    return customer?.cus_name || 'Unknown Supplier';
  };

  // Get store name
  const getStoreName = (storeId) => {
    if (!Array.isArray(stores)) return 'Unknown Store';
    const store = stores.find(s => s.storeid === storeId);
    return store?.store_name || 'Unknown Store';
  };

  // Render List View
  const renderListView = () => {
    const filteredReturns = getFilteredReturns();

    return (
      <Box>
        {/* Header */}
        <Box sx={STYLES.gradientHeader}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 36 }} />
                Purchase Returns
              </Typography>
              <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                Manage returns to suppliers and track refunds
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm();
                setCurrentView('create');
              }}
              sx={{
                ...STYLES.primaryGradientBtn,
                background: 'rgba(255,255,255,0.2)',
                '&:hover': { background: 'rgba(255,255,255,0.3)' }
              }}
            >
              New Purchase Return
            </Button>
          </Box>
        </Box>

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ mt: 8, pb: 4 }}>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...STYLES.glassCard, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fef2f2' }}>
                    <HistoryIcon sx={{ color: '#dc2626', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight="700" color="#dc2626">
                      {purchaseReturns.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Returns
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...STYLES.glassCard, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff7ed' }}>
                    <MoneyIcon sx={{ color: '#ea580c', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight="700" color="#ea580c">
                      {formatCurrency(purchaseReturns.reduce((sum, r) => sum + (parseFloat(r.total_return_amount) || 0), 0))}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Return Value
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...STYLES.glassCard, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f0fdf4' }}>
                    <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight="700" color="#16a34a">
                      {Array.isArray(purchaseReturns) ? purchaseReturns.filter(r => r.status === 'COMPLETED').length : 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ ...STYLES.glassCard, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fefce8' }}>
                    <WarningIcon sx={{ color: '#ca8a04', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight="700" color="#ca8a04">
                      {Array.isArray(purchaseReturns) ? purchaseReturns.filter(r => r.status === 'PENDING').length : 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Card sx={{ ...STYLES.glassCard, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    placeholder="Search returns..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      )
                    }}
                    sx={STYLES.input}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    options={customers}
                    getOptionLabel={(option) => option.cus_name}
                    value={selectedSupplier}
                    onChange={(e, val) => setSelectedSupplier(val)}
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Filter by Supplier" onFocus={(e) => e.target.select()} sx={STYLES.input} />
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
                    InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
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
                    InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
                    sx={STYLES.input}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={clearFilters}
                    startIcon={<ResetIcon />}
                    sx={{ borderRadius: 3, height: 56 }}
                  >
                    Clear
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Table */}
          <Card sx={STYLES.glassCard}>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress color="error" />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead sx={STYLES.tableHeader}>
                    <TableRow>
                      <TableCell>Return ID</TableCell>
                      <TableCell>Purchase #</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Return Date</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                          <HistoryIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                          <Typography color="text.secondary">
                            No purchase returns found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReturns.map((returnItem) => (
                        <TableRow
                          key={returnItem.id}
                          sx={{ '&:hover': { bgcolor: '#fef2f2' } }}
                        >
                          <TableCell>
                            <Chip
                              label={`#${returnItem.id}`}
                              size="small"
                              sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="600">
                              {returnItem.purchase?.invoice_number || `PUR-${returnItem.purchase_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {getSupplierName(returnItem.purchase?.cus_id)}
                          </TableCell>
                          <TableCell>
                            {new Date(returnItem.return_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </TableCell>
                          <TableCell>
                            <Typography
                              sx={{
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {returnItem.return_reason}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="700" color="#dc2626">
                              {formatCurrency(returnItem.total_return_amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={returnItem.status}
                              size="small"
                              sx={{
                                bgcolor: returnItem.status === 'COMPLETED' ? '#dcfce7' : '#fef9c3',
                                color: returnItem.status === 'COMPLETED' ? '#166534' : '#854d0e',
                                fontWeight: 600
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(returnItem)}
                                  sx={{ color: '#3b82f6' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(returnItem.id)}
                                  sx={{ color: '#ef4444' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Send WhatsApp Receipt">
                                <IconButton
                                  size="small"
                                  onClick={() => handleSendWhatsApp(returnItem)}
                                  disabled={isSendingWhatsApp}
                                  sx={{ color: '#16a34a' }}
                                >
                                  {isSendingWhatsApp ? <CircularProgress size={16} /> : <PhoneIcon fontSize="small" />}
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
            )}
          </Card>
        </Container>
      </Box>
    );
  };

  // Render Create/Edit Form View
  const renderFormView = () => {
    const { totalReturnAmount } = calculateTotals();
    const filteredPurchases = getFilteredPurchases();

    return (
      <Box>
        {/* Header */}
        <Box sx={STYLES.gradientHeader}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={() => {
                  resetForm();
                  setCurrentView('list');
                }}
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight="700">
                  {editingReturn ? 'Edit Purchase Return' : 'New Purchase Return'}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, opacity: 0.9 }}>
                  {editingReturn ? 'Update return details' : 'Create a new return to supplier'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Container maxWidth="xl" sx={{ mt: 8, pb: 4 }}>
          <Grid container spacing={3}>
            {/* Left Panel - Form */}
            <Grid item xs={12} lg={8}>
              {/* General Information */}
              <Card sx={{ ...STYLES.glassCard, mb: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight="700" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#dc2626' }} />
                    General Information
                  </Typography>

                  <Grid container spacing={3}>
                    {/* Step 1: Select Supplier Account */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1, color: '#64748b' }}>
                        Step 1: Select Supplier Account
                      </Typography>
                      <Autocomplete
                        options={customers}
                        getOptionLabel={(option) => option.cus_name}
                        value={selectedCustomerAccount}
                        onChange={(e, val) => handleCustomerAccountSelect(val)}
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="👥 Select Supplier Account"
                            onFocus={(e) => e.target.select()}
                            sx={STYLES.input}
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...otherProps } = props;
                          return (
                            <li key={key} {...otherProps}>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography fontWeight="600">{option.cus_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {option.cus_id} | Phone: {option.cus_phone_no || 'N/A'}
                                </Typography>
                              </Box>
                            </li>
                          );
                        }}
                        ListboxProps={{ style: { maxHeight: 300 } }}
                      />
                    </Grid>

                    {/* Step 2: Select Purchase */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1, color: '#64748b' }}>
                        Step 2: Select Purchase
                      </Typography>
                      <Autocomplete
                        options={filteredPurchases}
                        getOptionLabel={(option) => `${option.invoice_number || 'N/A'} - ${formatCurrency(option.net_total || option.total_amount)}`}
                        value={selectedPurchase}
                        onChange={(e, val) => handlePurchaseSelect(val)}
                        disabled={!selectedCustomerAccount}
                        autoSelect={true}
                        autoHighlight={true}
                        openOnFocus={true}
                        selectOnFocus={true}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={selectedCustomerAccount ? "📦 Select Purchase" : "Select supplier first"}
                            onFocus={(e) => e.target.select()}
                            sx={STYLES.input}
                          />
                        )}
                        renderOption={(props, option) => {
                          const { key, ...otherProps } = props;
                          return (
                            <li key={key} {...otherProps}>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography fontWeight="600">
                                  {option.invoice_number || `PUR-${option.pur_id}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Amount: {formatCurrency(option.net_total || option.total_amount)} |
                                  Date: {new Date(option.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </Typography>
                              </Box>
                            </li>
                          );
                        }}
                        ListboxProps={{ style: { maxHeight: 300 } }}
                      />
                    </Grid>

                    {/* Return Date */}
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Return Date"
                        value={formData.return_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
                        sx={STYLES.input}
                      />
                    </Grid>

                    {/* Reason */}
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Reason for Return"
                        placeholder="Enter reason for returning items..."
                        value={formData.return_reason}
                        onChange={(e) => setFormData(prev => ({ ...prev, return_reason: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        sx={STYLES.input}
                      />
                    </Grid>

                    {/* Supplier Info - Show when purchase selected */}
                    {selectedPurchase && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 2, color: '#64748b' }}>
                          Purchase Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ ...STYLES.infoBox, bgcolor: '#f0fdf4' }}>
                              <BusinessIcon sx={{ color: '#16a34a' }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Supplier</Typography>
                                <Typography fontWeight="600">
                                  {getSupplierName(selectedPurchase.cus_id)}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ ...STYLES.infoBox, bgcolor: '#eff6ff' }}>
                              <StoreIcon sx={{ color: '#2563eb' }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Store</Typography>
                                <Typography fontWeight="600">
                                  {getStoreName(selectedPurchase.store_id)}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ ...STYLES.infoBox, bgcolor: '#faf5ff' }}>
                              <ReceiptIcon sx={{ color: '#7c3aed' }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Invoice</Typography>
                                <Typography fontWeight="600">
                                  {selectedPurchase.invoice_number || `PUR-${selectedPurchase.pur_id}`}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ ...STYLES.infoBox, bgcolor: '#fff7ed' }}>
                              <MoneyIcon sx={{ color: '#ea580c' }} />
                              <Box>
                                <Typography variant="caption" color="text.secondary">Purchase Amount</Typography>
                                <Typography fontWeight="600">
                                  {formatCurrency(selectedPurchase.net_total || selectedPurchase.total_amount)}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {/* Return Items */}
              <Card sx={STYLES.glassCard}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight="700" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InventoryIcon sx={{ color: '#dc2626' }} />
                    Items to Return
                  </Typography>

                  {!selectedPurchase ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Please select a supplier and purchase to see available items for return.
                    </Alert>
                  ) : formData.return_details.length === 0 ? (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      No items found in this purchase.
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Table>
                        <TableHead sx={STYLES.tableHeader}>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell align="center">Max Qty</TableCell>
                            <TableCell align="center">Return Qty</TableCell>
                            <TableCell align="right">Unit Rate</TableCell>
                            <TableCell align="right">Return Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {formData.return_details.map((item, index) => (
                            <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fef2f2' } }}>
                              <TableCell>
                                <Typography fontWeight="600">{item.product_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Unit: {item.unit}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={item.max_quantity}
                                  size="small"
                                  sx={{ bgcolor: '#f1f5f9', fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <TextField
                                  type="number"
                                  value={item.return_quantity}
                                  onChange={(e) => handleReturnQuantityChange(index, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  inputProps={{
                                    min: 0,
                                    max: item.max_quantity,
                                    style: { textAlign: 'center' }
                                  }}
                                  sx={{
                                    width: 100,
                                    '& .MuiOutlinedInput-root': {
                                      borderRadius: 2,
                                      bgcolor: item.return_quantity > 0 ? '#fef2f2' : '#f8fafc'
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography fontWeight="500">
                                  {formatCurrency(item.unit_rate)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography
                                  fontWeight="700"
                                  color={item.return_amount > 0 ? '#dc2626' : 'text.secondary'}
                                >
                                  {formatCurrency(item.return_amount)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Notes */}
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Additional Notes"
                    placeholder="Any additional notes about this return..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    sx={{ ...STYLES.input, mt: 3 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Right Panel - Summary */}
            <Grid item xs={12} lg={4}>
              <Box sx={{ position: 'sticky', top: 100 }}>
                <Card sx={{ ...STYLES.glassCard, background: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)', color: 'white' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" fontWeight="700" sx={{ mb: 3 }}>
                      Return Summary
                    </Typography>

                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ opacity: 0.9 }}>Items to Return</Typography>
                        <Typography fontWeight="700">
                          {formData.return_details.filter(d => d.return_quantity > 0).length}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ opacity: 0.9 }}>Total Quantity</Typography>
                        <Typography fontWeight="700">
                          {formData.return_details.reduce((sum, d) => sum + (d.return_quantity || 0), 0)}
                        </Typography>
                      </Box>

                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" fontWeight="700">Total Return</Typography>
                        <Typography variant="h5" fontWeight="800">
                          {formatCurrency(formData.total_return_amount)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleSubmit}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      disabled={isSubmitting || !selectedPurchase}
                      startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      sx={{
                        mt: 4,
                        py: 1.5,
                        bgcolor: 'white',
                        color: '#dc2626',
                        fontWeight: 700,
                        borderRadius: 3,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.9)'
                        },
                        '&:disabled': {
                          bgcolor: 'rgba(255,255,255,0.5)',
                          color: 'rgba(220,38,38,0.5)'
                        }
                      }}
                    >
                      {isSubmitting ? 'Processing...' : (editingReturn ? 'Update Return' : 'Create Return')}
                    </Button>

                    {/* Info Box */}
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                        <strong>📋 Return Effects:</strong>
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                        • Supplier balance will be reduced (credit)
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                        • Stock will be decremented from store
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                        • Ledger entry will be created
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  };

  return (
    <DashboardLayout>
      {currentView === 'list' ? renderListView() : renderFormView()}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <BiometricAuthDialog
        open={authDialogOpen}
        onSuccess={handleAuthSuccess}
        onClose={handleAuthCancel}
      />
    </DashboardLayout>
  );
}
