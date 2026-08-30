'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';

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
  ReceiptLong as ReceiptLongIcon,
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
  Business as BusinessIcon
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function QuotationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State management
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBillType, setFilterBillType] = useState('QUOTATION');
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
  const [currentView, setCurrentView] = useState('list');

  // Handle URL query parameter for view
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    if (viewParam === 'create') {
      setCurrentView('create');
    }
  }, [searchParams]);

  // Form state for sales creation
  const [formSelectedCustomer, setFormSelectedCustomer] = useState(null);
  const [selectedCustomerTypeFilter, setSelectedCustomerTypeFilter] = useState(null);
  const [formSelectedProduct, setFormSelectedProduct] = useState(null);
  const [formSelectedStore, setFormSelectedStore] = useState(null);

  // Product form state
  const [productFormData, setProductFormData] = useState({
    quantity: 1,
    rate: 0,
    amount: 0,
    stock: 0
  });

  // Product table state
  const [productTableData, setProductTableData] = useState([]);

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
  const [paymentData, setPaymentData] = useState({
    cash: 0,
    bank: 0,
    bankAccountId: '',
    totalCashReceived: 0,
    discount: 0,
    labour: 0,
    deliveryCharges: 0,
    notes: ''
  });

  // Bill type state - Fixed to QUOTATION
  const [billType, setBillType] = useState('QUOTATION');

  // Edit sale state
  const [editSaleId, setEditSaleId] = useState(null);

  // Customer creation popup state
  const [customerPopupOpen, setCustomerPopupOpen] = useState(false);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [newCustomer, setNewCustomer] = useState({
    cus_name: '',
    cus_phone_no: '',
    cus_phone_no2: '',
    cus_reference: '',
    cus_account_info: '',
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

  // Current bill data for printing (from create view)
  const [currentBillData, setCurrentBillData] = useState(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

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

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Filter sales based on search criteria
  const filteredSales = useMemo(() => {
    if (!Array.isArray(sales) || sales.length === 0) {
      return [];
    }

    return sales.filter(sale => {
      const matchesSearch = searchTerm === '' ||
        sale.sale_id?.toString().includes(searchTerm) ||
        sale.customer?.cus_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.reference?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = filterCustomer === '' ||
        sale.customer?.cus_id?.toString() === filterCustomer;

      // Always filter by QUOTATION type for this page
      const matchesBillType = sale.bill_type === 'QUOTATION';

      const matchesStore = filterStore === '' ||
        (sale.sale_details && sale.sale_details.some(detail =>
          detail.store?.storeid?.toString() === filterStore ||
          detail.store_id?.toString() === filterStore
        ));

      const matchesPaymentType = filterPaymentType === '' ||
        sale.payment_type === filterPaymentType;

      const totalAmount = parseFloat(sale.total_amount || 0);
      const matchesMinAmount = filterMinAmount === '' ||
        totalAmount >= parseFloat(filterMinAmount);
      const matchesMaxAmount = filterMaxAmount === '' ||
        totalAmount <= parseFloat(filterMaxAmount);

      const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
      const matchesBalanceStatus = filterBalanceStatus === '' ||
        (filterBalanceStatus === 'with_balance' && balance > 0) ||
        (filterBalanceStatus === 'without_balance' && balance <= 0) ||
        (filterBalanceStatus === 'overpaid' && balance < 0);

      const matchesDateFrom = dateFrom === '' ||
        (dateFrom && sale.created_at && new Date(sale.created_at) >= new Date(dateFrom));

      const matchesDateTo = dateTo === '' ||
        (dateTo && sale.created_at && new Date(sale.created_at) <= new Date(dateTo));

      return matchesSearch && matchesCustomer && matchesBillType && matchesStore &&
        matchesPaymentType && matchesMinAmount && matchesMaxAmount &&
        matchesBalanceStatus && matchesDateFrom && matchesDateTo;
    });
  }, [sales, searchTerm, filterCustomer, filterStore, filterPaymentType, filterMinAmount, filterMaxAmount, filterBalanceStatus, dateFrom, dateTo]);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);

      const salesRes = await fetch('/api/sales');
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSales(Array.isArray(salesData) ? salesData : []);
      } else {
        setSales([]);
      }

      const [customersRes, productsRes, customerTypesRes, storesRes, customerCategoriesRes, citiesRes] = await Promise.all([
        fetch('/api/customers?dropdown=true'),
        fetch('/api/products?dropdown=true'),
        fetch('/api/customer-types'),
        fetch('/api/stores'),
        fetch('/api/customer-category'),
        fetch('/api/cities')
      ]);

      await fetchTransportAccounts();
      await fetchBankAccounts();

      if (customersRes.ok) {
        const customersResponse = await customersRes.json();
        const customersData = customersResponse.value || customersResponse;
        setCustomers(customersData || []);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData || []);
      }

      if (customerTypesRes.ok) {
        const customerTypesResponse = await customerTypesRes.json();
        const customerTypesData = customerTypesResponse.value || customerTypesResponse;
        setCustomerTypes(customerTypesData || []);
      }

      if (storesRes.ok) {
        const storesResponse = await storesRes.json();
        const storesData = storesResponse.data || storesResponse;
        setStores(Array.isArray(storesData) ? storesData : []);
      }

      if (customerCategoriesRes.ok) {
        const customerCategoriesData = await customerCategoriesRes.json();
        setCustomerCategories(customerCategoriesData || []);
      }

      if (citiesRes.ok) {
        const citiesData = await citiesRes.json();
        setCities(citiesData || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Transport functions
  const fetchTransportAccounts = async () => {
    try {
      const response = await fetch('/api/customers?dropdown=true');
      if (response.ok) {
        const accountsData = await response.json();
        const transportAccountsData = accountsData.filter(account =>
          account.customer_type &&
          account.customer_type.cus_type_title &&
          account.customer_type.cus_type_title.toLowerCase().includes('transport')
        );
        setTransportAccounts(transportAccountsData);
      }
    } catch (error) {
      console.error('Error fetching transport accounts:', error);
    }
  };

  const handleAddTransport = () => {
    if (newTransport.amount <= 0) {
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }
    if (!newTransport.accountId) {
      showSnackbar('Please select a transport account', 'error');
      return;
    }

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
    return transportOptions.reduce((sum, transport) => {
      return sum + (parseFloat(transport.amount) || 0);
    }, 0);
  };

  // Bank accounts functions
  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/customers?dropdown=true');
      if (response.ok) {
        const accountsData = await response.json();
        const bankAccountsData = accountsData.filter(account => {
          return account.customer_type &&
            account.customer_type.cus_type_title &&
            account.customer_type.cus_type_title.toLowerCase().includes('bank account');
        });
        setBankAccounts(bankAccountsData);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  // Handle edit quotation
  const handleEdit = async (sale) => {
    try {
      setLoading(true);
      showSnackbar('Loading quotation details...', 'info');

      const response = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const fullSale = await response.json();
      const saleData = Array.isArray(fullSale) ? fullSale[0] : fullSale;

      setFormSelectedCustomer(saleData.customer);

      const storeId = saleData.store_id || (saleData.sale_details?.[0]?.store_id);
      const store = stores.find(s => s.storeid == storeId) || (stores.length > 0 ? stores[0] : null);
      if (store) setFormSelectedStore(store);

      const tableData = saleData.sale_details.map((d, index) => ({
        id: Date.now() + index,
        pro_id: d.pro_id,
        pro_title: d.product?.pro_title || d.product?.pro_name || 'Unknown Product',
        storeid: store?.storeid,
        store_name: store?.store_name,
        quantity: parseFloat(d.qnty),
        rate: parseFloat(d.unit_rate),
        amount: parseFloat(d.total_amount),
        stock: 0
      }));
      setProductTableData(tableData);

      setPaymentData({
        cash: parseFloat(saleData.cash_payment || 0),
        bank: parseFloat(saleData.bank_payment || 0),
        bankAccountId: saleData.debit_account_id || '',
        totalCashReceived: parseFloat(saleData.payment || 0),
        discount: parseFloat(saleData.discount || 0),
        labour: 0,
        deliveryCharges: parseFloat(saleData.shipping_amount || 0),
        notes: saleData.reference || ''
      });

      setTransportOptions([]);
      setBillType('QUOTATION');
      setEditSaleId(saleData.sale_id);
      setCurrentView('create');

    } catch (e) {
      console.error('Error editing quotation:', e);
      showSnackbar('Error loading quotation details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-select first store when stores load
  useEffect(() => {
    if (!formSelectedStore && Array.isArray(stores) && stores.length > 0) {
      setFormSelectedStore(stores[0]);
    }
  }, [stores]);

  // Handle product selection
  const handleProductSelect = (selectedProduct) => {
    setFormSelectedProduct(selectedProduct);

    if (selectedProduct) {
      setProductFormData(prev => ({
        ...prev,
        quantity: 1,
        rate: parseFloat(selectedProduct.pro_baser_price) || 0,
        stock: 0,
        amount: parseFloat(selectedProduct.pro_baser_price) || 0
      }));

      if (formSelectedStore?.storeid) {
        fetchStoreStock(formSelectedStore.storeid, selectedProduct.pro_id);
      }
    } else {
      setProductFormData({
        quantity: 1,
        rate: 0,
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

      const reservedQty = productTableData
        .filter(r => r.pro_id === productId && r.storeid === storeId)
        .reduce((sum, r) => sum + (parseFloat(r.qnty ?? r.quantity ?? 0) || 0), 0);

      const available = (isNaN(stockQty) ? 0 : stockQty) - reservedQty;

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
    const amount = quantity * rate;

    setProductFormData(prev => ({
      ...prev,
      quantity: quantity,
      amount: amount
    }));
  };

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

  const handleAddProductToTable = () => {
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

    const existingProductIndex = productTableData.findIndex(
      item => item.pro_id === formSelectedProduct.pro_id && item.storeid === formSelectedStore.storeid
    );

    if (existingProductIndex >= 0) {
      const updatedData = [...productTableData];
      updatedData[existingProductIndex].quantity += productFormData.quantity;
      updatedData[existingProductIndex].amount = updatedData[existingProductIndex].quantity * updatedData[existingProductIndex].rate;
      setProductTableData(updatedData);
      showSnackbar('Product quantity updated', 'success');
    } else {
      const newProduct = {
        id: Date.now(),
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
      showSnackbar('Product added to table', 'success');
    }

    setFormSelectedProduct(null);
    setProductFormData({
      quantity: 1,
      rate: 0,
      amount: 0,
      stock: 0
    });
  };

  const handleRemoveProductFromTable = (productId) => {
    setProductTableData(prev => prev.filter(item => item.id !== productId));
    showSnackbar('Product removed from table', 'success');
  };

  const calculateTotalAmount = () => {
    return productTableData.reduce((total, product) => total + product.amount, 0);
  };

  const calculateSubtotal = () => {
    const productTotal = calculateTotalAmount();
    const transportTotal = calculateTransportTotal();
    return productTotal + transportTotal;
  };

  const calculateGrandTotal = () => {
    const productTotal = calculateTotalAmount();
    const labour = parseFloat(paymentData.labour) || 0;
    const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
    const transportTotal = calculateTransportTotal();
    const totalDelivery = deliveryCharges + transportTotal;
    const discount = parseFloat(paymentData.discount) || 0;
    return productTotal + labour + totalDelivery - discount;
  };

  const calculateBalance = () => {
    const grandTotal = calculateGrandTotal();
    const totalCashReceived = parseFloat(paymentData.totalCashReceived) || 0;
    return grandTotal - totalCashReceived;
  };

  const handlePaymentDataChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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

  const handleSaveBill = async () => {
    try {
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

      if (totalAmount <= 0) {
        showSnackbar('Total amount must be greater than 0', 'error');
        return;
      }

      const transportTotal = calculateTransportTotal();
      const deliveryCharges = parseFloat(paymentData.deliveryCharges) || 0;
      const totalShippingAmount = transportTotal + deliveryCharges;

      const splitPayments = [];
      const cashAmount = parseFloat(paymentData.cash) || 0;
      const bankAmount = parseFloat(paymentData.bank) || 0;

      if (cashAmount > 0) {
        splitPayments.push({
          amount: cashAmount,
          payment_type: 'CASH',
          debit_account_id: null,
          credit_account_id: null,
          reference: 'Cash payment'
        });
      }

      if (bankAmount > 0 && paymentData.bankAccountId) {
        splitPayments.push({
          amount: bankAmount,
          payment_type: 'BANK_TRANSFER',
          debit_account_id: paymentData.bankAccountId,
          credit_account_id: null,
          reference: 'Bank payment'
        });
      }

      const selectedBankAccount = paymentData.bankAccountId
        ? bankAccounts.find(acc => acc.cus_id === paymentData.bankAccountId)
        : null;

      const saleData = {
        cus_id: formSelectedCustomer.cus_id,
        store_id: formSelectedStore.storeid,
        total_amount: grandTotal,
        discount: parseFloat(paymentData.discount) || 0,
        payment: totalCashReceived,
        payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH',
        cash_payment: cashAmount,
        bank_payment: bankAmount,
        bank_title: selectedBankAccount?.cus_name || null,
        debit_account_id: paymentData.bankAccountId || null,
        credit_account_id: null,
        loader_id: null,
        shipping_amount: totalShippingAmount,
        bill_type: 'QUOTATION',
        reference: paymentData.notes || null,
        sale_details: productTableData.map(product => ({
          pro_id: product.pro_id,
          vehicle_no: null,
          qnty: product.quantity,
          unit: 'PCS',
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
        split_payments: splitPayments,
        updated_by: 1
      };

      setLoading(true);

      const response = await fetch('/api/sales', {
        method: editSaleId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editSaleId ? { ...saleData, id: editSaleId } : saleData),
      });

      if (response.ok) {
        const result = await response.json();
        const successMessage = editSaleId ? 'Quotation updated successfully!' : 'Quotation saved successfully!';
        showSnackbar(successMessage, 'success');

        setEditSaleId(null);

        const billDataForPrint = {
          sale_id: result.sale_id,
          cus_id: formSelectedCustomer.cus_id,
          total_amount: grandTotal,
          discount: parseFloat(paymentData.discount) || 0,
          payment: totalCashReceived,
          payment_type: splitPayments.length > 0 ? splitPayments[0].payment_type : 'CASH',
          cash_payment: cashAmount,
          bank_payment: bankAmount,
          bank_title: selectedBankAccount?.cus_name || null,
          shipping_amount: totalShippingAmount,
          bill_type: 'QUOTATION',
          reference: paymentData.notes || null,
          created_at: new Date().toISOString(),
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
          notes: paymentData.notes || ''
        };
        setCurrentBillData(billDataForPrint);

        setReceiptDialogOpen(true);

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

        fetchData();
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || `Failed to save quotation (${response.status})`, 'error');
      }
    } catch (error) {
      console.error('Error saving quotation:', error);
      showSnackbar(`Failed to save quotation: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (saleId) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/sales?id=${saleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showSnackbar('Quotation deleted successfully', 'success');
        fetchData();
      } else {
        const data = await response.json();
        showSnackbar(data.error || 'Failed to delete quotation', 'error');
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
      showSnackbar('Error deleting quotation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBill = (mode = 'A4', fromDialog = false) => {
    try {
      const className = mode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const isThermal = mode === 'THERMAL';

      const printableContainer = mode === 'THERMAL'
        ? document.getElementById('printable-invoice-thermal')
        : document.getElementById('printable-invoice-a4');

      if (!printableContainer) {
        console.error('Printable container not found');
        return;
      }

      if (fromDialog && !isThermal) {
        const receiptPreview = document.getElementById('receipt-preview');
        if (receiptPreview && printableContainer) {
          printableContainer.innerHTML = receiptPreview.innerHTML;
        }
      }

      const originalParent = printableContainer.parentElement;
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

      let styleId = 'dynamic-print-style';
      let styleElement = document.getElementById(styleId);

      if (isThermal) {
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = styleId;
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = `
          @media print {
            @page {
              size: 80mm portrait;
              margin: 0;
            }
          }
        `;
      } else if (styleElement) {
        styleElement.textContent = `
          @media print {
            @page {
              size: A4;
              margin: 0.5cm 1cm;
            }
          }
        `;
      }

      document.body.classList.add(className);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
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
      console.error('Print error:', e);
      window.print();
    }
  };

  const handleViewReceipt = (sale) => {
    // For list view print logic
    setCurrentBillData(sale);
    setReceiptDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCustomer('');
    setFilterStore('');
    setFilterPaymentType('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterBalanceStatus('');
    setDateFrom('');
    setDateTo('');
  };

  // Customer creation functions
  const handleOpenCustomerPopup = () => {
    setCustomerPopupOpen(true);
  };

  const handleCloseCustomerPopup = () => {
    setCustomerPopupOpen(false);
    setNewCustomer({
      cus_name: '',
      cus_phone_no: '',
      cus_phone_no2: '',
      cus_reference: '',
      cus_account_info: '',
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
    if (!newCustomer.cus_name.trim()) {
      showSnackbar('Customer name is required', 'error');
      return;
    }
    if (!newCustomer.cus_phone_no.trim()) {
      showSnackbar('Phone number is required', 'error');
      return;
    }

    try {
      const customerData = {
        ...newCustomer,
        cus_balance: parseFloat(newCustomer.cus_balance) || 0,
        city_id: newCustomer.city_id || null
      };

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      if (response.ok) {
        showSnackbar('Customer created successfully', 'success');
        handleCloseCustomerPopup();
        fetchData();
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || 'Error creating customer', 'error');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      showSnackbar('Error creating customer', 'error');
    }
  };

  if (loading && sales.length === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  // Render Create View
  const renderCreateView = () => (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 1 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={() => setCurrentView('list')}
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
                  {editSaleId ? 'Edit Quotation' : 'Create New Quotation'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Select products and create quotation
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

          {/* Main Form */}
          <Card>
            <CardContent sx={{ p: 2 }}>
              {/* Top Filter Bar: Customer Type */}
              <Box sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary', whiteSpace: 'nowrap' }}>
                    Customer Type:
                  </Typography>
                  <Autocomplete
                    size="small"
                    sx={{ minWidth: 300 }}
                    options={customerTypes || []}
                    getOptionLabel={(option) => option.cus_type_title || ''}
                    value={selectedCustomerTypeFilter}
                    onChange={(event, newValue) => {
                      setSelectedCustomerTypeFilter(newValue);
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
                          minWidth: 300,
                          '& .MuiInputBase-input': {
                            fontWeight: 'bold',
                            color: 'black'
                          }
                        }}
                      />
                    )}
                  />
                </Box>
              </Box>

              {/* First Row - Customer, Date, Reference */}
              <Grid container spacing={2} sx={{ mb: 2, alignItems: 'flex-end' }}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ position: 'relative' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                        CUSTOMER
                      </Typography>
                      {formSelectedCustomer && (
                        <Typography variant="body2" sx={{
                          fontWeight: 'bold',
                          color: 'white',
                          fontSize: '0.875rem',
                          bgcolor: 'success.main',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1
                        }}>
                          Balance: {formSelectedCustomer.cus_balance ? fmtAmt(formSelectedCustomer.cus_balance) : '0.00'}
                        </Typography>
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
                          const productInput = document.getElementById('product-select-dropdown-input');
                          if (productInput) {
                            productInput.focus();
                          } else {
                            const fallbackInput = document.querySelector('input[placeholder*="Select product"]');
                            if (fallbackInput) fallbackInput.focus();
                          }
                        }
                      }}
                      options={customers.filter(customer => {
                        const category = customerCategories.find(c => c.cus_cat_id === customer.cus_category);
                        if (category && !category.cus_cat_title.toLowerCase().includes('customer')) {
                          return false;
                        }
                        
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
                      onChange={(event, newValue) => setFormSelectedCustomer(newValue)}
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
                          placeholder="Search by name, phone, address, city, reference..."
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
                <Grid item xs={12} md={3}>
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
                <Grid item xs={12} md={3}>
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
                      ListboxProps={{ sx: { maxHeight: 180 } }}
                      filterOptions={(options, { inputValue }) => {
                        const q = inputValue.toLowerCase().trim();
                        if (!q) return options;
                        return options.filter(o =>
                          (o.pro_title || '').toLowerCase().startsWith(q) ||
                          (o.pro_code || '').toLowerCase().startsWith(q)
                        );
                      }}
                      renderOption={(props, option) => (
                        <li {...props} key={option.pro_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 500 }}>{option.pro_title}</Typography>
                          </Box>
                        </li>
                      )}
                      value={formSelectedProduct}
                      onChange={(event, newValue) => handleProductSelect(newValue)}
                      isOptionEqualToValue={(option, value) => option.pro_id === value?.pro_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && formSelectedProduct) {
                          e.preventDefault();
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
                      onChange={(event, newValue) => setFormSelectedStore(newValue)}
                      isOptionEqualToValue={(option, value) => option.storeid === value?.storeid}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
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
                      value={productFormData.quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (productFormData.rate > 0) {
                            handleAddProductToTable();
                          }
                        }
                      }}
                      sx={{ bgcolor: 'white' }}
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
                      value={productFormData.rate}
                      onChange={(e) => handleRateChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProductToTable();
                        }
                      }}
                      sx={{ bgcolor: 'white' }}
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
                      value={productFormData.amount}
                      disabled
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { fontWeight: 'bold' } }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={1.3}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      STOCK
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={productFormData.stock}
                      disabled
                      sx={{ bgcolor: 'white', '& .MuiInputBase-input': { fontWeight: 'bold' } }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={0.8} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleAddProductToTable}
                    sx={{
                      bgcolor: '#673ab7',
                      color: 'white',
                      minWidth: '42px',
                      height: '40px',
                      borderRadius: 2,
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      '&:hover': { bgcolor: '#5e35b1' }
                    }}
                  >
                    +
                  </Button>
                </Grid>
              </Grid>

              {/* Product Table */}
              <TableContainer component={Paper} sx={{ mb: 2, border: '1px solid #e9ecef' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#2e7d32' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>S. No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Product</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>Sale Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'white' }}>Amount</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: 'white' }}>Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productTableData.map((row, index) => (
                      <TableRow key={row.id} sx={{ '&:hover': { bgcolor: '#f8f9fa' } }}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.store_name || '-'}</TableCell>
                        <TableCell>{row.pro_title}</TableCell>
                        <TableCell align="right">{row.quantity}</TableCell>
                        <TableCell align="right">{fmtAmt(row.rate)}</TableCell>
                        <TableCell align="right">{fmtAmt(row.amount)}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleRemoveProductFromTable(row.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {productTableData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No products added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals and Actions */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes / Reference"
                    value={paymentData.notes}
                    onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                    sx={{ bgcolor: 'white' }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">Total Amount:</Typography>
                        <Typography fontWeight="bold" variant="h6">{calculateTotalAmount().toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">Discount:</Typography>
                        <TextField
                          size="small"
                          sx={{ width: 150, bgcolor: 'white' }}
                          type="number"
                          value={paymentData.discount}
                          onChange={(e) => handlePaymentDataChange('discount', e.target.value)}
                        />
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">Grand Total:</Typography>
                        <Typography fontWeight="bold" variant="h5" color="primary">
                          {calculateGrandTotal().toFixed(2)}
                        </Typography>
                      </Box>
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleSaveBill}
                        sx={{
                          mt: 2,
                          py: 1.5,
                          bgcolor: 'primary.main',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          '&:hover': {
                            bgcolor: 'primary.dark'
                          }
                        }}
                      >
                        {editSaleId ? 'Update Quotation' : 'Save Quotation'}
                      </Button>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  // Render List View
  const renderListView = () => (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">Quotations</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCurrentView('create')}
          >
            Create Quotation
          </Button>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search quotations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="outlined" fullWidth onClick={clearFilters}>
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Quotation #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.sale_id} hover>
                  <TableCell>{new Date(sale.created_at).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>{sale.sale_id}</TableCell>
                  <TableCell>{sale.customer?.cus_name}</TableCell>
                  <TableCell align="right">{fmtAmt(sale.total_amount)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Create Bill">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => router.push(`/dashboard/sales?view=create&quotationId=${sale.sale_id}`)}
                        >
                          <ReceiptLongIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Receipt">
                        <IconButton size="small" onClick={() => handleViewReceipt(sale)}>
                          <ReceiptIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print A4">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => {
                            setCurrentBillData(sale);
                            setTimeout(() => handlePrintBill('A4'), 100);
                          }}
                        >
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(sale)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(sale.sale_id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    No quotations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </DashboardLayout>
  );

  return (
    <>
      <Suspense fallback={<CircularProgress />}>
        {currentView === 'create' ? renderCreateView() : renderListView()}
      </Suspense>

      {/* Customer Popup */}
      <Dialog open={customerPopupOpen} onClose={handleCloseCustomerPopup} maxWidth="md" fullWidth>
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={newCustomer.cus_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, cus_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newCustomer.cus_phone_no}
                onChange={(e) => setNewCustomer({ ...newCustomer, cus_phone_no: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCustomerPopup}>Cancel</Button>
          <Button onClick={handleCreateCustomer} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Quotation Receipt
          <IconButton
            aria-label="close"
            onClick={() => setReceiptDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers id="receipt-preview">
          {currentBillData && (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" align="center" gutterBottom>
                QUOTATION
              </Typography>
              <Typography variant="body1" align="center" gutterBottom>
                Quotation #{currentBillData.sale_id}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Date:</strong> {new Date(currentBillData.created_at).toLocaleDateString('en-GB')}</Typography>
                  <Typography variant="body2"><strong>Customer:</strong> {currentBillData.customer?.cus_name}</Typography>
                </Grid>
                <Grid item xs={6} sx={{ textAlign: 'right' }}>
                  <Typography variant="body2"><strong>Total Amount:</strong> {fmtAmt(currentBillData.total_amount)}</Typography>
                </Grid>
              </Grid>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentBillData.sale_details?.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell>{detail.product?.pro_title || 'Item'}</TableCell>
                        <TableCell align="right">{detail.qnty}</TableCell>
                        <TableCell align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                        <TableCell align="right">{fmtAmt(detail.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handlePrintBill('A4', true)} startIcon={<PrintIcon />}>
            Print A4
          </Button>
          <Button onClick={() => handlePrintBill('THERMAL', true)} startIcon={<PrintIcon />}>
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Hidden Print Containers */}
      <div id="printable-invoice-a4" style={{ display: 'none' }}></div>
      {(() => {
        const activeBillData = currentBillData || selectedBill;
        if (!activeBillData) return <div id="printable-invoice-thermal" style={{ display: 'none' }}></div>;

        const totalAmount = parseFloat(activeBillData.total_amount || 0);
        const discountAmount = parseFloat(activeBillData.discount || 0);
        const shippingAmount = parseFloat(activeBillData.shipping_amount || 0);
        const labourAmount = parseFloat(activeBillData.labour_charges || activeBillData.labour || 0);
        const subtotalAmount = totalAmount - labourAmount - shippingAmount + discountAmount;

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
                QUOTATION RECEIPT
              </Typography>
            </Box>

            {/* Meta */}
            <Box sx={{ py: 0.75, fontSize: '11px', borderBottom: '1px dashed #000', color: '#000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Quot #: <strong>{activeBillData.sale_id}</strong></span>
                <span>Date: <strong>{new Date(activeBillData.created_at).toLocaleDateString('en-GB')}</strong></span>
              </Box>
              <Box sx={{ mt: 0.25 }}>
                <span>Cust: <strong>{activeBillData.customer?.cus_name || 'N/A'}</strong></span>
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
                  <Box key={i} sx={{ mb: 0.75 }}>
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

      <style jsx global>{`
        @media print {
          body.print-thermal #printable-invoice-thermal,
          body.print-thermal #printable-invoice-thermal * {
            visibility: visible !important;
          }
          body.print-thermal #printable-invoice-thermal {
            display: block !important;
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
    </>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<CircularProgress />}>
      <QuotationsPageContent />
    </Suspense>
  );
}
