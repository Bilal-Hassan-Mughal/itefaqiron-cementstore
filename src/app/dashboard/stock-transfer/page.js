'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/dashboard-layout';
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
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  LocationOn as MapPinIcon
} from '@mui/icons-material';

export default function StockTransferPage() {
  // State management
  const [transfers, setTransfers] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTransferIndex, setCurrentTransferIndex] = useState(-1);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'form'

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFromStore, setFilterFromStore] = useState('');
  const [filterToStore, setFilterToStore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form state
  const [transferNo, setTransferNo] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromStore, setFromStore] = useState(null);
  const [toStore, setToStore] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [packing, setPacking] = useState('0');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState([]);
  const [currentStock, setCurrentStock] = useState(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

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

  // Fetch data on mount
  useEffect(() => {
    fetchStores();
    fetchProducts();
    fetchTransfers();
    fetchAccountRelatedData();
  }, []);

  const fetchAccountRelatedData = async () => {
    try {
      const [categoriesRes, typesRes, citiesRes] = await Promise.all([
        fetch('/api/customer-category'),
        fetch('/api/customer-types'),
        fetch('/api/cities')
      ]);
      if (categoriesRes.ok) setCustomerCategories(await categoriesRes.json());
      if (typesRes.ok) setCustomerTypes(await typesRes.json());
      if (citiesRes.ok) setCities(await citiesRes.json());
    } catch (error) {
      console.error('Error fetching account related data:', error);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const result = await response.json();
        // Handle wrapped response { success, data }
        const storesData = result.success ? result.data : (result.data || result);
        const storesArray = Array.isArray(storesData) ? storesData : [];
        setStores(storesArray);
        console.log(`✅ Loaded ${storesArray.length} stores in dropdown`);
        if (storesArray.length === 0) {
          console.warn('No stores found in API response');
        }
      } else {
        console.error('Failed to fetch stores:', response.status);
        setStores([]);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setStores([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?dropdown=true');
      if (response.ok) {
        const result = await response.json();
        // Handle both wrapped response and direct array
        const productsData = result.data || result;
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        console.error('Failed to fetch products:', response.status);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stock-transfers');
      if (response.ok) {
        const data = await response.json();
        setTransfers(data);
        if (data.length > 0 && currentTransferIndex === -1) {
          setCurrentTransferIndex(0);
          loadTransfer(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      showSnackbar('Error fetching transfers', 'error');
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
        showSnackbar('Account created successfully', 'success');
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
        showSnackbar('Failed to create account', 'error');
      }
    } catch (error) {
      console.error('Error saving account:', error);
      showSnackbar('Error saving account', 'error');
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const loadTransfer = (transfer) => {
    if (!transfer) return;

    setTransferNo(transfer.transfer_no || '');
    setTransferDate(transfer.transfer_date ? new Date(transfer.transfer_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const storesArray = Array.isArray(stores) ? stores : [];
    setFromStore(storesArray.find(s => s?.storeid === transfer.from_store_id) || null);
    setToStore(storesArray.find(s => s?.storeid === transfer.to_store_id) || null);
    setNotes(transfer.notes || '');
    setTransferItems(transfer.transfer_details || []);
  };

  const handleSearchTransfer = async () => {
    if (!transferNo.trim()) {
      showSnackbar('Please enter a transfer number', 'warning');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/stock-transfers?transfer_no=${transferNo}`);
      if (response.ok) {
        const transfer = await response.json();
        const index = transfers.findIndex(t => t.transfer_id === transfer.transfer_id);
        if (index !== -1) {
          setCurrentTransferIndex(index);
          loadTransfer(transfer);
          showSnackbar('Transfer found', 'success');
        } else {
          loadTransfer(transfer);
          showSnackbar('Transfer found', 'success');
        }
      } else {
        showSnackbar('Transfer not found', 'error');
      }
    } catch (error) {
      console.error('Error searching transfer:', error);
      showSnackbar('Error searching transfer', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stock quantity when product or from store changes
  useEffect(() => {
    const fetchStock = async () => {
      if (!selectedProduct || !fromStore) {
        setCurrentStock(null);
        return;
      }

      try {
        const response = await fetch(`/api/store-stock?store_id=${fromStore.storeid}&pro_id=${selectedProduct.pro_id}`);
        if (response.ok) {
          const result = await response.json();
          const stockData = result.data || result;
          if (Array.isArray(stockData) && stockData.length > 0) {
            setCurrentStock(stockData[0].stock_quantity || 0);
          } else if (stockData && stockData.stock_quantity !== undefined) {
            setCurrentStock(stockData.stock_quantity || 0);
          } else {
            setCurrentStock(0);
          }
        } else {
          setCurrentStock(0);
        }
      } catch (error) {
        console.error('Error fetching stock:', error);
        setCurrentStock(0);
      }
    };

    fetchStock();
  }, [selectedProduct, fromStore]);

  const handleAddProduct = () => {
    if (!selectedProduct) {
      showSnackbar('Please select a product', 'warning');
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      showSnackbar('Please enter a valid quantity', 'warning');
      return;
    }

    // Check if product already exists
    const existingIndex = transferItems.findIndex(item => item.pro_id === selectedProduct.pro_id);

    if (existingIndex !== -1) {
      // Update existing item
      const updatedItems = [...transferItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: parseFloat(quantity),
        packing: parseFloat(packing || 0)
      };
      setTransferItems(updatedItems);
    } else {
      // Add new item
      setTransferItems([
        ...transferItems,
        {
          transfer_detail_id: Date.now(), // Temporary ID
          pro_id: selectedProduct.pro_id,
          product: selectedProduct,
          quantity: parseFloat(quantity),
          packing: parseFloat(packing || 0)
        }
      ]);
    }

    // Reset form
    setSelectedProduct(null);
    setQuantity('');
    setPacking('0');
    setCurrentStock(null);
  };

  const handleRemoveProduct = (index) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!transferDate) {
      showSnackbar('Please select a date', 'warning');
      return;
    }

    if (!fromStore) {
      showSnackbar('Please select from store', 'warning');
      return;
    }

    if (!toStore) {
      showSnackbar('Please select to store', 'warning');
      return;
    }

    if (fromStore.storeid === toStore.storeid) {
      showSnackbar('From store and to store cannot be the same', 'error');
      return;
    }

    if (transferItems.length === 0) {
      showSnackbar('Please add at least one product', 'warning');
      return;
    }

    try {
      setLoading(true);
      const transferData = {
        transfer_date: transferDate,
        from_store_id: fromStore.storeid,
        to_store_id: toStore.storeid,
        notes: notes,
        transfer_details: transferItems.map(item => ({
          pro_id: item.pro_id,
          quantity: item.quantity,
          packing: item.packing || 0
        })),
        updated_by: 6 // System Administrator
      };

      // If we have a transfer_id, it's an update
      const currentTransfer = transfers[currentTransferIndex];
      const url = currentTransfer?.transfer_id
        ? `/api/stock-transfers`
        : '/api/stock-transfers';
      const method = currentTransfer?.transfer_id ? 'PUT' : 'POST';

      const body = currentTransfer?.transfer_id
        ? { ...transferData, transfer_id: currentTransfer.transfer_id }
        : transferData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        showSnackbar('Transfer saved successfully', 'success');
        await fetchTransfers();
        setCurrentView('list'); // Go back to list view after saving
        handleNew();
      } else {
        const error = await response.json();
        showSnackbar(error.error || 'Failed to save transfer', 'error');
      }
    } catch (error) {
      console.error('Error saving transfer:', error);
      showSnackbar('Error saving transfer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setTransferNo('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setFromStore(null);
    setToStore(null);
    setSelectedProduct(null);
    setQuantity('');
    setPacking('0');
    setNotes('');
    setTransferItems([]);
    setCurrentTransferIndex(-1);
    setCurrentView('form');
  };

  const handleEditTransfer = (transfer) => {
    const index = transfers.findIndex(t => t.transfer_id === transfer.transfer_id);
    if (index !== -1) {
      setCurrentTransferIndex(index);
      loadTransfer(transfer);
      setCurrentView('form');
    }
  };

  const handleViewList = () => {
    setCurrentView('list');
    fetchTransfers();
  };

  const handleCancel = () => {
    if (currentTransferIndex !== -1 && transfers[currentTransferIndex]) {
      loadTransfer(transfers[currentTransferIndex]);
    } else {
      handleNew();
    }
  };

  // Navigation handlers
  const handleFirst = () => {
    if (transfers.length > 0) {
      setCurrentTransferIndex(0);
      loadTransfer(transfers[0]);
    }
  };

  const handlePrevious = () => {
    if (currentTransferIndex > 0) {
      const newIndex = currentTransferIndex - 1;
      setCurrentTransferIndex(newIndex);
      loadTransfer(transfers[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentTransferIndex < transfers.length - 1) {
      const newIndex = currentTransferIndex + 1;
      setCurrentTransferIndex(newIndex);
      loadTransfer(transfers[newIndex]);
    }
  };

  const handleLast = () => {
    if (transfers.length > 0) {
      const lastIndex = transfers.length - 1;
      setCurrentTransferIndex(lastIndex);
      loadTransfer(transfers[lastIndex]);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Filter transfers based on search criteria
  const filteredTransfers = useMemo(() => {
    if (!Array.isArray(transfers) || transfers.length === 0) {
      return [];
    }

    return transfers.filter(transfer => {
      // Search filter - by transfer no or notes
      const matchesSearch = searchTerm === '' ||
        (transfer.transfer_no && transfer.transfer_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (transfer.notes && transfer.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (transfer.transfer_id && transfer.transfer_id.toString().includes(searchTerm));

      // From Store filter
      const matchesFromStore = filterFromStore === '' ||
        (transfer.from_store?.storeid?.toString() === filterFromStore) ||
        (transfer.from_store_id?.toString() === filterFromStore);

      // To Store filter
      const matchesToStore = filterToStore === '' ||
        (transfer.to_store?.storeid?.toString() === filterToStore) ||
        (transfer.to_store_id?.toString() === filterToStore);

      // Date range filters
      const matchesDateFrom = dateFrom === '' ||
        (transfer.transfer_date && new Date(transfer.transfer_date) >= new Date(dateFrom));

      const matchesDateTo = dateTo === '' ||
        (transfer.transfer_date && new Date(transfer.transfer_date) <= new Date(dateTo));

      return matchesSearch && matchesFromStore && matchesToStore &&
        matchesDateFrom && matchesDateTo;
    });
  }, [transfers, searchTerm, filterFromStore, filterToStore, dateFrom, dateTo]);

  // Render List View
  const renderListView = () => (
    <DashboardLayout>
      <Container
        maxWidth={false}
        sx={{
          py: 2,
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
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              Stock Transfers
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowAccountForm(true)}
                sx={{
                  borderColor: '#9c27b0',
                  color: '#9c27b0',
                  '&:hover': { borderColor: '#7b1fa2', bgcolor: 'rgba(156, 39, 176, 0.04)' }
                }}
              >
                New Account
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNew}
                sx={{
                  bgcolor: '#9c27b0',
                  '&:hover': { bgcolor: '#7b1fa2' }
                }}
              >
                New Transfer
              </Button>
            </Box>
          </Box>

          {/* Filter Section */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'semibold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                Filter Transfers
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={2.4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search"
                    placeholder="Search by Transfer No, Notes, or ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    size="small"
                    options={Array.isArray(stores) ? stores : []}
                    getOptionLabel={(option) => option?.store_name || ''}
                    value={stores.find(s => s?.storeid?.toString() === filterFromStore) || null}
                    onChange={(event, newValue) => {
                      setFilterFromStore(newValue ? newValue.storeid.toString() : '');
                    }}
                    isOptionEqualToValue={(option, value) => option?.storeid === value?.storeid}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="From Store"
                        placeholder="Select from store"
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 150 }}
                      />
                    )}
                    sx={{ minWidth: 150 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    size="small"
                    options={Array.isArray(stores) ? stores : []}
                    getOptionLabel={(option) => option?.store_name || ''}
                    value={stores.find(s => s?.storeid?.toString() === filterToStore) || null}
                    onChange={(event, newValue) => {
                      setFilterToStore(newValue ? newValue.storeid.toString() : '');
                    }}
                    isOptionEqualToValue={(option, value) => option?.storeid === value?.storeid}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="To Store"
                        placeholder="Select to store"
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 150 }}
                      />
                    )}
                    sx={{ minWidth: 150 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="From Date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="To Date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterFromStore('');
                    setFilterToStore('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  startIcon={<ClearIcon />}
                >
                  Clear Filters
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  Showing {filteredTransfers.length} of {transfers.length} transfers
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Transfer No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>From Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>To Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Items</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : filteredTransfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                          {transfers.length === 0 ? 'No stock transfers found' : 'No transfers match your filters'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransfers.map((transfer) => (
                        <TableRow key={transfer.transfer_id} hover>
                          <TableCell>{transfer.transfer_no || `#${transfer.transfer_id}`}</TableCell>
                          <TableCell>
                            {transfer.transfer_date
                              ? new Date(transfer.transfer_date).toLocaleDateString('en-GB')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{transfer.from_store?.store_name || 'N/A'}</TableCell>
                          <TableCell>{transfer.to_store?.store_name || 'N/A'}</TableCell>
                          <TableCell align="right">
                            {transfer.transfer_details?.length || 0}
                          </TableCell>
                          <TableCell>
                            {transfer.notes ? (
                              <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {transfer.notes}
                              </Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditTransfer(transfer)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  // Render Form View
  const renderFormView = () => (
    <DashboardLayout>
      <Container
        maxWidth={false}
        sx={{
          py: 2,
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
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              Stock Transfer
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleViewList}
                sx={{ mr: 1 }}
              >
                View List
              </Button>
              <TextField
                size="small"
                placeholder="Transfer No"
                value={transferNo}
                onChange={(e) => setTransferNo(e.target.value)}
                sx={{ width: 200, bgcolor: 'white' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={handleSearchTransfer}
                        sx={{ color: 'primary.main' }}
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearchTransfer}
                sx={{
                  bgcolor: '#9c27b0',
                  '&:hover': { bgcolor: '#7b1fa2' }
                }}
              >
                Find
              </Button>
            </Box>
          </Box>

          {/* Transfer Details Card */}
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                {/* Date */}
                <Grid item xs={12} md={3}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                    DATE:
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    sx={{ bgcolor: 'white' }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <CalendarIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>

                {/* From Store */}
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                    SELECT FROM STORE:
                  </Typography>
                  <Autocomplete
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={Array.isArray(stores) ? stores : []}
                    getOptionLabel={(option) => option?.store_name || ''}
                    value={fromStore}
                    onChange={(e, newValue) => setFromStore(newValue)}
                    isOptionEqualToValue={(option, value) => option?.storeid === value?.storeid}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select from store"
                        onFocus={(e) => e.target.select()}
                        sx={{ bgcolor: 'white', minWidth: 250 }}
                      />
                    )}
                    sx={{ minWidth: 250 }}
                  />
                </Grid>

                {/* To Store */}
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                    SELECT TO STORE:
                  </Typography>
                  <Autocomplete
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={Array.isArray(stores) ? stores : []}
                    getOptionLabel={(option) => option?.store_name || ''}
                    value={toStore}
                    onChange={(e, newValue) => setToStore(newValue)}
                    isOptionEqualToValue={(option, value) => option?.storeid === value?.storeid}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select to store"
                        onFocus={(e) => e.target.select()}
                        sx={{ bgcolor: 'white', minWidth: 250 }}
                      />
                    )}
                    sx={{ minWidth: 250 }}
                  />
                </Grid>
              </Grid>

              {/* Product Selection */}
              <Box sx={{ mt: 4 }}>
                {selectedProduct && fromStore && currentStock !== null && (
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.primary', fontWeight: 'medium' }}>
                    Available Stock: <strong style={{ color: '#1976d2' }}>{currentStock}</strong>
                  </Typography>
                )}
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      SELECT PRODUCT:
                    </Typography>
                    <Autocomplete
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      options={Array.isArray(products) ? products : []}
                      getOptionLabel={(option) => option?.pro_title || ''}
                      value={selectedProduct}
                      onChange={(e, newValue) => {
                        setSelectedProduct(newValue);
                        setCurrentStock(null);
                      }}
                      isOptionEqualToValue={(option, value) => option?.pro_id === value?.pro_id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select product"
                          onFocus={(e) => e.target.select()}
                          sx={{ bgcolor: 'white', minWidth: 350 }}
                        />
                      )}
                      sx={{ minWidth: 350 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      QTY:
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      sx={{ bgcolor: 'white' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      PACKING:
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={packing}
                      onChange={(e) => setPacking(e.target.value)}
                      placeholder="0"
                      sx={{ bgcolor: 'white' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddProduct}
                      sx={{
                        bgcolor: '#9c27b0',
                        '&:hover': { bgcolor: '#7b1fa2' },
                        height: '56px'
                      }}
                    >
                      + Add
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {/* Product Transfer Table */}
              <Box sx={{ mt: 4 }}>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Packing</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transferItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            No data found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transferItems.map((item, index) => (
                          <TableRow key={item.transfer_detail_id || index}>
                            <TableCell>
                              {item.product?.pro_title || `Product ${item.pro_id}`}
                            </TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">{item.packing || 0}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveProduct(index)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Notes */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  NOTES:
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes..."
                  sx={{ bgcolor: 'white' }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FirstPageIcon />}
                onClick={handleFirst}
                disabled={currentTransferIndex <= 0}
                sx={{ minWidth: 100 }}
              >
                First
              </Button>
              <Button
                variant="outlined"
                startIcon={<ChevronLeftIcon />}
                onClick={handlePrevious}
                disabled={currentTransferIndex <= 0}
                sx={{ minWidth: 100 }}
              >
                Previous
              </Button>
              <Button
                variant="outlined"
                endIcon={<ChevronRightIcon />}
                onClick={handleNext}
                disabled={currentTransferIndex >= transfers.length - 1}
                sx={{ minWidth: 100 }}
              >
                Next
              </Button>
              <Button
                variant="outlined"
                endIcon={<LastPageIcon />}
                onClick={handleLast}
                disabled={currentTransferIndex >= transfers.length - 1}
                sx={{ minWidth: 100 }}
              >
                Last
              </Button>
            </Box>

            {/* Main Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleNew}
                sx={{ borderColor: '#9c27b0', color: '#9c27b0' }}
              >
                New
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={loading}
                sx={{
                  bgcolor: '#9c27b0',
                  '&:hover': { bgcolor: '#7b1fa2' }
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Save'}
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                sx={{
                  bgcolor: '#9c27b0',
                  '&:hover': { bgcolor: '#7b1fa2' }
                }}
              >
                Print
              </Button>
              <Button
                variant="contained"
                startIcon={<ClearIcon />}
                onClick={handleCancel}
                sx={{
                  bgcolor: '#dc3545',
                  '&:hover': { bgcolor: '#c82333' }
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>

          {/* Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Stack>
      </Container>
      {/* Account Creation Dialog */}
      <Dialog
        open={showAccountForm}
        onClose={() => setShowAccountForm(false)}
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
          bgcolor: '#9c27b0',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'white', color: '#9c27b0' }}>
              <AddIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add New Account
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new customer/supplier account
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowAccountForm(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveAccount}>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Account Name"
                  name="cus_name"
                  value={accountFormData.cus_name}
                  onChange={handleAccountFormChange}
                  required
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
                  label="Phone Number"
                  name="cus_phone_no"
                  value={accountFormData.cus_phone_no}
                  onChange={handleAccountFormChange}
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
                  label="Email"
                  name="cus_email"
                  type="email"
                  value={accountFormData.cus_email}
                  onChange={handleAccountFormChange}
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
                      sx={{ minHeight: 56, minWidth: 250 }}
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
                      sx={{ minHeight: 56, minWidth: 250 }}
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
                      sx={{ minHeight: 56, minWidth: 250 }}
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
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="cus_address"
                  multiline
                  rows={2}
                  value={accountFormData.cus_address}
                  onChange={handleAccountFormChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setShowAccountForm(false)} sx={{ color: '#64748b' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmittingAccount}
              sx={{
                bgcolor: '#9c27b0',
                '&:hover': { bgcolor: '#7b1fa2' },
                px: 4
              }}
            >
              {isSubmittingAccount ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </DashboardLayout>
  );

  // Main render - switch between views
  return currentView === 'list' ? renderListView() : renderFormView();
}

