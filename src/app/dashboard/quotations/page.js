'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDatePK } from '@/lib/date-helper';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH } from '@/lib/ledger-tabs';
import DashboardLayout from '../components/dashboard-layout';
import SaveProgressBackdrop from '../components/save-progress-backdrop';

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
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
  ReceiptLong as ReceiptLongIcon,
  Print as PrintIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingDown as TrendingDownIcon,
  Description as DescriptionIcon,
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

const QUOTE_PAGE_CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const QUOTE_EXCEL_TABLE_SX = {
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

const QUOTE_EXCEL_HEAD_SX = {
  bgcolor: '#e8effd',
  color: '#1347c4',
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

const QUOTE_NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const QUOTE_STATS_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, 1fr)',
    sm: 'repeat(2, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: 1.5,
  width: '100%',
};

const QUOTE_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: { xs: 1.5, md: 2 },
  width: '100%',
};

const QUOTE_FILTER_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#fff',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.supporting.periwinkle,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500 },
};

const getSortLabel = (value) => {
  const labels = {
    'created_at-desc': 'Newest First',
    'created_at-asc': 'Oldest First',
    'customer-asc': 'Customer A-Z',
    'customer-desc': 'Customer Z-A',
    'total_amount-desc': 'Amount High-Low',
    'total_amount-asc': 'Amount Low-High',
  };
  return labels[value] || 'Newest First';
};

const getQuotationPrintTotals = (billData) => {
  const totalAmount = parseFloat(billData?.total_amount || 0);
  const discountAmount = parseFloat(billData?.discount || 0);
  const shippingAmount = parseFloat(billData?.shipping_amount || 0);
  const labourAmount = parseFloat(billData?.labour_charges || billData?.labour || 0);
  const itemsSubtotal = (billData?.sale_details || []).reduce(
    (sum, d) => sum + parseFloat(d.total_amount || 0),
    0
  ) || totalAmount - labourAmount - shippingAmount + discountAmount;
  return { totalAmount, discountAmount, shippingAmount, labourAmount, itemsSubtotal };
};

function QuotationPrintTemplates({ billData }) {
  if (!billData) return null;

  const { totalAmount, discountAmount, shippingAmount, labourAmount, itemsSubtotal } = getQuotationPrintTotals(billData);
  const details = billData.sale_details || [];
  const quoteDate = formatDatePK(billData.created_at) || new Date(billData.created_at || Date.now()).toLocaleDateString('en-GB');

  return (
    <>
      {/* A4 — off screen until print */}
      <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '21cm', overflow: 'hidden', pointerEvents: 'none' }}>
        <Box id="printable-invoice-a4" sx={{ width: '100%', bgcolor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
          <Box sx={{ textAlign: 'center', py: 2.5, borderBottom: '2px solid #000' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '1.35rem', direction: 'rtl' }}>{COMPANY.nameUr}</Typography>
            <Typography sx={{ fontSize: '0.9rem', mt: 0.5 }}>{COMPANY.name}</Typography>
            <Typography sx={{ fontSize: '0.85rem', direction: 'rtl', mt: 0.25 }}>{COMPANY.address}</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mt: 0.5 }}>Ph: {COMPANY.phones.join(', ')}</Typography>
            <Typography sx={{ mt: 1.5, fontWeight: 900, letterSpacing: 2, fontSize: '1rem' }}>QUOTATION</Typography>
          </Box>

          <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', fontSize: '0.875rem' }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{billData.customer?.cus_name || 'N/A'}</Typography>
              {billData.customer?.cus_phone_no && (
                <Typography sx={{ color: '#444' }}>{billData.customer.cus_phone_no}</Typography>
              )}
              {billData.customer?.cus_address && (
                <Typography sx={{ color: '#444' }}>{billData.customer.cus_address}</Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography><strong>Quote #:</strong> {billData.sale_id}</Typography>
              <Typography><strong>Date:</strong> {quoteDate}</Typography>
              {(billData.reference || billData.notes) && (
                <Typography><strong>Ref:</strong> {billData.reference || billData.notes}</Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Table size="small" sx={{ border: '1px solid #bbb' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#e8effd' }}>
                  {['#', 'Item', 'Qty', 'Rate', 'Amount'].map((h, i) => (
                    <TableCell key={h} align={i >= 2 ? 'right' : 'left'} sx={{ fontWeight: 800, border: '1px solid #bbb', py: 0.75, fontSize: '0.8125rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {details.length > 0 ? details.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ border: '1px solid #ddd', py: 0.5 }}>{i + 1}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', py: 0.5, fontWeight: 600 }}>{d.product?.pro_title || 'Item'}</TableCell>
                    <TableCell align="right" sx={{ border: '1px solid #ddd', py: 0.5 }}>{d.qnty}</TableCell>
                    <TableCell align="right" sx={{ border: '1px solid #ddd', py: 0.5 }}>{fmtAmt(d.unit_rate)}</TableCell>
                    <TableCell align="right" sx={{ border: '1px solid #ddd', py: 0.5, fontWeight: 700 }}>{fmtAmt(d.total_amount)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">No items</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 240, fontSize: '0.875rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                  <span>Items Subtotal</span><strong>{fmtAmt(itemsSubtotal)}</strong>
                </Box>
                {labourAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                    <span>Labour</span><strong>{fmtAmt(labourAmount)}</strong>
                  </Box>
                )}
                {shippingAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                    <span>Shipping</span><strong>{fmtAmt(shippingAmount)}</strong>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                  <span>Discount</span><strong>{fmtAmt(discountAmount)}</strong>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, mt: 0.5, borderTop: '2px solid #000', fontSize: '1rem' }}>
                  <strong>Quoted Total</strong><strong>{fmtAmt(totalAmount)}</strong>
                </Box>
              </Box>
            </Box>

            <Typography sx={{ mt: 2.5, fontSize: '0.75rem', color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
              This is a quotation only. Prices and availability may change until converted to a sale.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Thermal — off screen until print */}
      <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '80mm', overflow: 'hidden', pointerEvents: 'none' }}>
        <Box
          id="printable-invoice-thermal"
          sx={{
            width: '78mm',
            maxWidth: '78mm',
            bgcolor: '#fff',
            color: '#000',
            p: '2mm',
            fontFamily: 'monospace, Arial, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '2px solid #000' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 900, direction: 'rtl' }}>{COMPANY.nameUr}</Typography>
            <Typography sx={{ fontSize: '10px', direction: 'rtl', mt: 0.25 }}>{COMPANY.address}</Typography>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, mt: 0.25 }}>Ph: {COMPANY.phones.join(', ')}</Typography>
            <Box sx={{ mt: 0.75, px: 1, py: 0.25, bgcolor: '#000', color: '#fff', display: 'inline-block', fontSize: '10px', fontWeight: 800, letterSpacing: 1 }}>
              QUOTATION
            </Box>
          </Box>

          <Box sx={{ py: 0.75, fontSize: '10px', borderBottom: '1px dashed #000' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Quot #: <strong>{billData.sale_id}</strong></span>
              <span>Date: <strong>{quoteDate}</strong></span>
            </Box>
            <Box sx={{ mt: 0.25 }}>Cust: <strong>{billData.customer?.cus_name || 'N/A'}</strong></Box>
          </Box>

          <Box sx={{ borderBottom: '1px solid #000', py: 0.4, my: 0.4, fontSize: '10px', fontWeight: 700 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ flex: 1 }}>Item</Box>
              <Box sx={{ width: 28, textAlign: 'center' }}>Qty</Box>
              <Box sx={{ width: 42, textAlign: 'right' }}>Rate</Box>
              <Box sx={{ width: 46, textAlign: 'right' }}>Total</Box>
            </Box>
          </Box>

          <Box sx={{ borderBottom: '1px dashed #000', pb: 0.5, mb: 0.5 }}>
            {details.length > 0 ? details.map((d, i) => (
              <Box key={i} sx={{ mb: 0.5, fontSize: '10px' }}>
                <Typography sx={{ fontWeight: 700, wordBreak: 'break-word', fontSize: '10px' }}>{d.product?.pro_title || 'Item'}</Typography>
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ flex: 1 }} />
                  <Box sx={{ width: 28, textAlign: 'center' }}>{d.qnty}</Box>
                  <Box sx={{ width: 42, textAlign: 'right' }}>{fmtAmt(d.unit_rate)}</Box>
                  <Box sx={{ width: 46, textAlign: 'right', fontWeight: 700 }}>{fmtAmt(d.total_amount)}</Box>
                </Box>
              </Box>
            )) : (
              <Typography sx={{ fontSize: '10px', textAlign: 'center' }}>No items</Typography>
            )}
          </Box>

          <Box sx={{ fontSize: '10px', lineHeight: 1.45 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmtAmt(itemsSubtotal)}</span></Box>
            {discountAmount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{fmtAmt(discountAmount)}</span></Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '11px', borderTop: '2px solid #000', borderBottom: '2px solid #000', py: 0.3, my: 0.4 }}>
              <span>QUOTED TOTAL</span><span>{fmtAmt(totalAmount)}</span>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center', borderTop: '1px solid #000', mt: 0.75, pt: 0.5, fontSize: '10px' }}>
            <Typography sx={{ fontWeight: 700, direction: 'rtl', fontSize: '10px' }}>شکریہ! دوبارہ تشریف لائیےگا</Typography>
            <Typography sx={{ fontSize: '9px', mt: 0.2 }}>Quotation — not a tax invoice</Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
}

function QuotationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State management
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [savingQuotation, setSavingQuotation] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');

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

  const beginSaving = (message) => {
    setSavingQuotation(true);
    setSaveStatusMessage(message);
  };

  const updateSaveStatus = (message) => {
    setSaveStatusMessage(message);
  };

  const endSaving = () => {
    setSavingQuotation(false);
    setSaveStatusMessage('');
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

  const sortedQuotations = useMemo(() => {
    const list = [...filteredSales];
    list.sort((a, b) => {
      let aVal;
      let bVal;
      if (sortBy === 'customer') {
        aVal = (a.customer?.cus_name || '').toLowerCase();
        bVal = (b.customer?.cus_name || '').toLowerCase();
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (sortBy === 'total_amount') {
        aVal = parseFloat(a.total_amount || 0);
        bVal = parseFloat(b.total_amount || 0);
      } else {
        aVal = new Date(a.created_at || 0).getTime();
        bVal = new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return list;
  }, [filteredSales, sortBy, sortOrder]);

  const quotationStats = useMemo(() => {
    const list = sortedQuotations;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      totalCount: list.length,
      totalValue: list.reduce((s, q) => s + parseFloat(q.total_amount || 0), 0),
      totalDiscount: list.reduce((s, q) => s + parseFloat(q.discount || 0), 0),
      thisMonth: list.filter((q) => q.created_at && new Date(q.created_at) >= monthStart).length,
    };
  }, [sortedQuotations]);

  const renderQuotationLineItemsCell = (sale) => {
    const details = sale.sale_details || [];
    if (details.length === 0) return <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>—</Typography>;
    const preview = details.slice(0, 2).map((d) => {
      const title = d.product?.pro_title || 'Item';
      const qty = parseFloat(d.qnty || 0);
      return `${title} (${qty})`;
    }).join(', ');
    const more = details.length > 2 ? ` +${details.length - 2} more` : '';
    return (
      <Typography sx={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }} title={preview + more}>
        {preview}{more}
      </Typography>
    );
  };

  const handleOpenCustomerLedger = (sale, e) => {
    if (e) e.stopPropagation();
    const cusId = sale?.cus_id ?? sale?.customer?.cus_id;
    const cusName = sale?.customer?.cus_name;
    if (!cusId) {
      showSnackbar('Customer not found for this quotation', 'error');
      return;
    }
    openAccountLedgerTab(cusId, cusName);
    router.push(FINANCE_LEDGER_PATH);
  };

  const handleNewQuotation = () => {
    setEditSaleId(null);
    setFormSelectedCustomer(null);
    setSelectedCustomerTypeFilter(null);
    setFormSelectedProduct(null);
    setFormSelectedStore(stores.length > 0 ? stores[0] : null);
    setProductTableData([]);
    setTransportOptions([]);
    setPaymentData({
      cash: 0,
      bank: 0,
      bankAccountId: '',
      totalCashReceived: 0,
      discount: 0,
      labour: 0,
      deliveryCharges: 0,
      notes: '',
    });
    setBillType('QUOTATION');
    setCurrentView('create');
  };

  useEffect(() => {
    const viewParam = searchParams?.get('view');
    if (viewParam === 'create') {
      handleNewQuotation();
    }
  }, [searchParams]);

  // Fetch data
  const fetchData = async () => {
    try {
      setListLoading(true);

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
      setListLoading(false);
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
      setListLoading(true);
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
      setListLoading(false);
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

      beginSaving(editSaleId ? 'Updating quotation...' : 'Saving quotation...');

      updateSaveStatus(editSaleId ? 'Updating quotation on server...' : 'Saving quotation to server...');
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
        updateSaveStatus('Generating quotation preview...');
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
      endSaving();
    }
  };

  const handleDelete = async (saleId) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    try {
      setListLoading(true);
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
      setListLoading(false);
    }
  };

  const handlePrintBill = (mode = 'A4', targetBill = null) => {
    try {
      const actualMode = mode === 'THERMAL' ? 'THERMAL' : 'A4';
      const className = actualMode === 'THERMAL' ? 'print-thermal' : 'print-a4';
      const activeBill = targetBill || currentBillData;

      if (!activeBill) {
        showSnackbar('No quotation data to print', 'error');
        return;
      }

      if (targetBill || !currentBillData) {
        setCurrentBillData(activeBill);
      }

      const printableContainer = document.getElementById(
        actualMode === 'THERMAL' ? 'printable-invoice-thermal' : 'printable-invoice-a4'
      );

      if (!printableContainer) {
        showSnackbar('Print template not ready. Please try again.', 'error');
        return;
      }

      let styleElement = document.getElementById('dynamic-print-style');
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'dynamic-print-style';
        document.head.appendChild(styleElement);
      }

      styleElement.textContent = actualMode === 'THERMAL'
        ? `@media print { @page { size: 80mm portrait !important; margin: 0 !important; } body { margin: 0 !important; padding: 0 !important; } }`
        : `@media print { @page { size: A4 portrait !important; margin: 0.5cm 1cm !important; } }`;

      document.body.classList.add(className);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('print-thermal', 'print-a4');
          styleElement?.remove();
        }, 150);
      }, 200);
    } catch (e) {
      console.error('Print error:', e);
      showSnackbar('Failed to open print dialog', 'error');
    }
  };

  const loadQuotationDetails = async (sale) => {
    try {
      const res = await fetch(`/api/sales?id=${sale.sale_id}`);
      if (!res.ok) return sale;
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    } catch {
      return sale;
    }
  };

  const handleViewReceipt = async (sale) => {
    const full = await loadQuotationDetails(sale);
    setCurrentBillData(full);
    setReceiptDialogOpen(true);
  };

  const handlePrintFromList = async (sale, mode = 'A4') => {
    const full = await loadQuotationDetails(sale);
    setCurrentBillData(full);
    setTimeout(() => handlePrintBill(mode, full), 300);
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

  if (listLoading && sales.length === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
          <CircularProgress size={48} sx={{ color: BRAND.supporting.periwinkle }} />
          <Typography color="text.secondary">Loading quotations...</Typography>
        </Box>
      </DashboardLayout>
    );
  }

  // Render Create View
  const renderCreateView = () => (
    <DashboardLayout>
      <SaveProgressBackdrop
        open={savingQuotation}
        message={saveStatusMessage}
        subMessage="Do not close or refresh until the quotation is saved and the preview is ready"
      />
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 2.5 }, px: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={() => setCurrentView('list')}
                sx={{
                  bgcolor: BRAND.supporting.periwinkle,
                  color: '#fff',
                  borderRadius: 2,
                  '&:hover': { bgcolor: '#4a57d4', transform: 'scale(1.04)' },
                  transition: 'all 0.2s ease',
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
                  {editSaleId ? 'Edit Quotation' : 'Create Quotation'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Price estimate only — no stock or ledger impact until converted to sale
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCustomerPopup}
              sx={{
                borderColor: BRAND.supporting.periwinkle,
                color: BRAND.text.periwinkle,
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': { borderColor: '#4a57d4', bgcolor: BRAND.tint.periwinkle },
              }}
            >
              New Customer
            </Button>
          </Box>

          <Card sx={QUOTE_PAGE_CARD_SX}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              {/* Top Filter Bar: Customer Type */}
              <Box sx={{ mb: 2, p: 2, bgcolor: BRAND.tint.periwinkle, borderRadius: 2, border: '1px solid #c7d2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
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
                            bgcolor: BRAND.supporting.periwinkle,
                            minWidth: 450,
                            borderRadius: 1,
                            '& .MuiOutlinedInput-root': {
                              fontSize: '1.05rem',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '& fieldset': { borderColor: '#4a57d4', borderWidth: '2px' },
                              '&:hover fieldset': { borderColor: '#3b44b8' },
                              '&.Mui-focused fieldset': { borderColor: '#3b44b8' },
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

              {/* Product entry — single aligned row */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 2.5fr) minmax(110px, 1.1fr) 72px 96px 96px 72px 44px',
                  gap: 1.5,
                  alignItems: 'end',
                  mb: 2,
                  p: { xs: 1.5, md: 2 },
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#fafbfc',
                  overflowX: 'auto',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Box sx={{ minWidth: { sm: 160 } }}>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    SELECT PRODUCT
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
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
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props;
                      return (
                        <li key={key} {...optionProps}>
                          <Typography sx={{ fontWeight: 500, fontSize: '0.875rem' }}>{option.pro_title}</Typography>
                        </li>
                      );
                    }}
                    value={formSelectedProduct}
                    onChange={(event, newValue) => handleProductSelect(newValue)}
                    isOptionEqualToValue={(option, value) => option.pro_id === value?.pro_id}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formSelectedProduct) {
                        e.preventDefault();
                        document.getElementById('quote-store-input')?.focus();
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="product-select-dropdown-input"
                        placeholder={products.length === 0 ? 'No products' : 'Select product'}
                        onFocus={(e) => e.target.select()}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiOutlinedInput-root': { height: 40 },
                          '& .MuiInputBase-input': { fontWeight: formSelectedProduct ? 700 : 500, fontSize: '0.875rem' },
                        }}
                      />
                    )}
                    disabled={products.length === 0}
                  />
                </Box>

                <Box sx={{ minWidth: { sm: 100 } }}>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    SELECT STORE
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
                    options={stores || []}
                    getOptionLabel={(option) => option.store_name || ''}
                    value={formSelectedStore}
                    onChange={(event, newValue) => setFormSelectedStore(newValue)}
                    isOptionEqualToValue={(option, value) => option.storeid === value?.storeid}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="quote-store-input"
                        placeholder="Store"
                        onFocus={(e) => e.target.select()}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiOutlinedInput-root': { height: 40 },
                          '& .MuiInputBase-input': { fontWeight: formSelectedStore ? 700 : 500, fontSize: '0.875rem' },
                        }}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    QTY
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={productFormData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    inputProps={{ step: 'any' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('quote-rate-input')?.focus();
                      }
                    }}
                    sx={{
                      bgcolor: 'white',
                      '& .MuiOutlinedInput-root': { height: 40 },
                      '& .MuiInputBase-input': { fontWeight: 700, textAlign: 'center', px: 0.5 },
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    SALE RATE
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    id="quote-rate-input"
                    value={productFormData.rate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    inputProps={{ step: 'any' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProductToTable();
                      }
                    }}
                    sx={{
                      bgcolor: 'white',
                      '& .MuiOutlinedInput-root': { height: 40 },
                      '& .MuiInputBase-input': { fontWeight: 700, textAlign: 'right', px: 1 },
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    AMOUNT
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={productFormData.amount ?? ''}
                    disabled
                    sx={{
                      bgcolor: '#f1f5f9',
                      '& .MuiOutlinedInput-root': { height: 40 },
                      '& .MuiInputBase-input': { fontWeight: 700, textAlign: 'right', color: '#1e293b', WebkitTextFillColor: '#1e293b' },
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    STOCK
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={productFormData.stock ?? ''}
                    disabled
                    sx={{
                      bgcolor: '#f1f5f9',
                      '& .MuiOutlinedInput-root': { height: 40 },
                      '& .MuiInputBase-input': {
                        fontWeight: 700,
                        textAlign: 'center',
                        color: productFormData.stock < 0 ? BRAND.primary.pink : '#1e293b',
                        WebkitTextFillColor: productFormData.stock < 0 ? BRAND.primary.pink : '#1e293b',
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 0.75, display: 'block', fontWeight: 700, color: 'transparent', userSelect: 'none' }}>
                    .
                  </Typography>
                  <Button
                    id="add-product-btn"
                    variant="contained"
                    onClick={handleAddProductToTable}
                    sx={{
                      bgcolor: BRAND.supporting.periwinkle,
                      color: 'white',
                      minWidth: 44,
                      width: 44,
                      height: 40,
                      p: 0,
                      borderRadius: 1.5,
                      fontWeight: 800,
                      fontSize: '1.35rem',
                      lineHeight: 1,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#4a57d4', boxShadow: '0 2px 8px rgba(94,110,237,0.35)' },
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
                    <TableRow sx={{ bgcolor: BRAND.supporting.periwinkle }}>
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

              {/* Notes + quotation summary */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '1fr minmax(320px, 400px)' },
                  gap: 2,
                  alignItems: 'stretch',
                  mt: 0.5,
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 220,
                  }}
                >
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 1.25 }}>
                    Notes & Reference
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={5}
                    placeholder="Add terms, delivery notes, or customer reference for this quotation..."
                    value={paymentData.notes}
                    onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        height: '100%',
                        alignItems: 'flex-start',
                        borderRadius: 1.5,
                        bgcolor: '#f8fafc',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: '#e2e8f0' },
                        '&:hover fieldset': { borderColor: '#cbd5e1' },
                        '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
                      },
                    }}
                  />
                  <Typography sx={{ mt: 1.25, fontSize: '0.75rem', color: '#94a3b8' }}>
                    {productTableData.length} item{productTableData.length === 1 ? '' : 's'} in this quotation
                  </Typography>
                </Box>

                <Box
                  sx={{
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    border: '1px solid #c7d2fe',
                    boxShadow: '0 4px 14px rgba(94, 110, 237, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box sx={{ px: 2.5, py: 1.75, bgcolor: BRAND.supporting.periwinkle, color: '#fff' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '0.02em' }}>
                      Quotation Summary
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', opacity: 0.9, mt: 0.25 }}>
                      Price estimate — not posted to ledger
                    </Typography>
                  </Box>

                  <Box sx={{ p: 2.5, bgcolor: BRAND.tint.periwinkle, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>Items Subtotal</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b', fontFamily: 'ui-monospace, monospace' }}>
                        {fmtAmt(calculateTotalAmount())}
                      </Typography>
                    </Box>

                    {(parseFloat(paymentData.labour) || 0) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                        <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>Labour</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1e293b', fontFamily: 'ui-monospace, monospace' }}>
                          {fmtAmt(paymentData.labour)}
                        </Typography>
                      </Box>
                    )}

                    {(parseFloat(paymentData.deliveryCharges) || 0) + calculateTransportTotal() > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                        <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>Shipping / Transport</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1e293b', fontFamily: 'ui-monospace, monospace' }}>
                          {fmtAmt((parseFloat(paymentData.deliveryCharges) || 0) + calculateTransportTotal())}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 0.25 }}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>Discount</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={paymentData.discount || ''}
                        onChange={(e) => handlePaymentDataChange('discount', e.target.value)}
                        placeholder="0"
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>PKR</Typography></InputAdornment>,
                        }}
                        sx={{
                          width: 140,
                          '& .MuiOutlinedInput-root': {
                            height: 36,
                            bgcolor: '#fff',
                            borderRadius: 1.25,
                            '& fieldset': { borderColor: '#c7d2fe' },
                            '&:hover fieldset': { borderColor: BRAND.supporting.periwinkle },
                            '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
                          },
                          '& .MuiInputBase-input': {
                            fontWeight: 700,
                            textAlign: 'right',
                            fontSize: '0.875rem',
                            py: 0.75,
                          },
                        }}
                      />
                    </Box>

                    <Divider sx={{ borderColor: '#c7d2fe', my: 0.5 }} />

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        px: 1.75,
                        py: 1.25,
                        borderRadius: 1.5,
                        bgcolor: '#fff',
                        border: '1px solid #c7d2fe',
                      }}
                    >
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>Quoted Total</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: '1.375rem', color: BRAND.text.periwinkle, fontFamily: 'ui-monospace, monospace', lineHeight: 1 }}>
                        {fmtAmt(calculateGrandTotal())}
                      </Typography>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleSaveBill}
                      disabled={savingQuotation || productTableData.length === 0}
                      startIcon={savingQuotation ? <CircularProgress size={18} color="inherit" /> : <ReceiptLongIcon />}
                      sx={{
                        mt: 'auto',
                        py: 1.35,
                        bgcolor: BRAND.supporting.periwinkle,
                        fontSize: '1rem',
                        fontWeight: 800,
                        textTransform: 'none',
                        borderRadius: 1.75,
                        boxShadow: '0 4px 12px rgba(94, 110, 237, 0.35)',
                        '&:hover': { bgcolor: '#4a57d4', boxShadow: '0 6px 16px rgba(94, 110, 237, 0.4)' },
                        '&:disabled': { bgcolor: '#c7d2fe', color: '#fff' },
                      }}
                    >
                      {savingQuotation
                        ? (saveStatusMessage || (editSaleId ? 'Updating...' : 'Saving...'))
                        : (editSaleId ? 'Update Quotation' : 'Save Quotation')}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );

  // Render List View
  const renderListView = () => (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 2.5 }, px: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 26 }} />}
              onClick={handleNewQuotation}
              size="large"
              sx={{
                background: `linear-gradient(135deg, ${BRAND.supporting.periwinkle} 0%, #4a57d4 100%)`,
                boxShadow: '0 4px 16px rgba(94, 110, 237, 0.32)',
                px: 5,
                py: 1.75,
                fontSize: '1.125rem',
                fontWeight: 700,
                minWidth: 320,
                height: 70,
                borderRadius: 2.5,
                textTransform: 'none',
                letterSpacing: '0.02em',
                color: '#fff',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4a57d4 0%, #3b44b8 100%)',
                  boxShadow: '0 6px 22px rgba(94, 110, 237, 0.42)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              New Quotation
            </Button>
          </Box>

          <Card sx={QUOTE_PAGE_CARD_SX}>
            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Box sx={QUOTE_STATS_GRID}>
                {[
                  { title: 'Total Quotations', val: quotationStats.totalCount, color: BRAND.text.periwinkle, bg: BRAND.tint.periwinkle, icon: <DescriptionIcon fontSize="small" />, isCount: true },
                  { title: 'Quoted Value', val: quotationStats.totalValue, color: BRAND.text.blue, bg: BRAND.tint.blue, icon: <AttachMoneyIcon fontSize="small" /> },
                  { title: 'Total Discount', val: quotationStats.totalDiscount, color: BRAND.text.pink, bg: BRAND.tint.pink, icon: <TrendingDownIcon fontSize="small" /> },
                  { title: 'This Month', val: quotationStats.thisMonth, color: BRAND.text.green, bg: BRAND.tint.green, icon: <ReceiptLongIcon fontSize="small" />, isCount: true },
                ].map((stat, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5, borderRadius: 1.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 1.25, bgcolor: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {stat.icon}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {stat.title}
                      </Typography>
                      <Typography noWrap sx={{ fontWeight: 800, color: stat.color, fontSize: '0.9375rem', mt: 0.25 }}>
                        {!stat.isCount && <Box component="span" sx={{ fontSize: '0.625rem', mr: 0.35, opacity: 0.85, fontWeight: 700 }}>PKR</Box>}
                        {stat.isCount ? stat.val : fmtAmt(stat.val)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, borderBottom: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon sx={{ color: BRAND.supporting.periwinkle, fontSize: 20 }} />
                Filters & Sorting
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                <Chip
                  size="small"
                  label={`${sortedQuotations.length} / ${sales.filter((s) => s.bill_type === 'QUOTATION').length}`}
                  sx={{ bgcolor: BRAND.tint.periwinkle, color: BRAND.text.periwinkle, fontWeight: 700, height: 32, borderRadius: '8px' }}
                />
                <Button
                  onClick={clearFilters}
                  size="small"
                  variant="outlined"
                  startIcon={<ClearIcon sx={{ fontSize: 18 }} />}
                  sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b', borderColor: '#cbd5e1', borderRadius: '8px', height: 32 }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafbfc' }}>
              <Box sx={QUOTE_FILTER_GRID}>
                <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Quotations"
                    placeholder="ID, Customer, Reference, or Amount..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} /></InputAdornment> }}
                    sx={QUOTE_FILTER_FIELD_SX}
                  />
                </Box>
                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customers}
                    getOptionLabel={(option) => option.cus_name || ''}
                    value={customers.find((c) => c.cus_id?.toString() === filterCustomer) || null}
                    onChange={(event, newValue) => setFilterCustomer(newValue ? newValue.cus_id.toString() : '')}
                    renderInput={(params) => <TextField {...params} label="Customer" placeholder="All Customers" sx={QUOTE_FILTER_FIELD_SX} />}
                  />
                </Box>
                <Box>
                  <TextField fullWidth size="small" type="date" label="From Date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={QUOTE_FILTER_FIELD_SX} />
                </Box>
                <Box>
                  <TextField fullWidth size="small" type="date" label="To Date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={QUOTE_FILTER_FIELD_SX} />
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
                    renderInput={(params) => <TextField {...params} label="Sort By" sx={QUOTE_FILTER_FIELD_SX} />}
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', bgcolor: '#f1f5f9' }}>
              <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>Quotations List</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                Showing {sortedQuotations.length} quotation{sortedQuotations.length === 1 ? '' : 's'}
              </Typography>
            </Box>

            <TableContainer sx={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
              <Table stickyHeader sx={QUOTE_EXCEL_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'Quote #', align: 'left' },
                      { label: 'Customer', align: 'left' },
                      { label: 'Items', align: 'left' },
                      { label: 'Reference', align: 'left' },
                      { label: 'Total', align: 'right' },
                      { label: 'Discount', align: 'right' },
                      { label: 'Date', align: 'center' },
                      { label: 'Actions', align: 'center' },
                    ].map((col) => (
                      <TableCell key={col.label} align={col.align} sx={QUOTE_EXCEL_HEAD_SX}>{col.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b' }}>
                          {sales.filter((s) => s.bill_type === 'QUOTATION').length === 0 ? 'No quotations yet' : 'No quotations match your filters'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                          Create a quotation to share prices with customers before billing.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedQuotations.map((sale, rowIndex) => (
                      <TableRow
                        key={sale.sale_id}
                        onClick={() => handleOpenCustomerLedger(sale)}
                        sx={{
                          bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                          '&:hover': { bgcolor: BRAND.tint.periwinkle },
                          cursor: 'pointer',
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, color: BRAND.text.periwinkle, whiteSpace: 'nowrap' }}>
                          #{sale.sale_id}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sale.customer?.cus_name || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>{renderQuotationLineItemsCell(sale)}</TableCell>
                        <TableCell sx={{ color: '#64748b', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sale.reference || '—'}
                        </TableCell>
                        <TableCell sx={{ ...QUOTE_NUM_CELL_SX, fontWeight: 700, color: '#1e293b' }}>{fmtAmt(sale.total_amount)}</TableCell>
                        <TableCell sx={QUOTE_NUM_CELL_SX}>{fmtAmt(sale.discount)}</TableCell>
                        <TableCell align="center" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatDatePK(sale.created_at) || '—'}
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.4, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0} justifyContent="center">
                            <Tooltip title="Convert to Sale">
                              <IconButton size="small" sx={{ color: BRAND.text.green, p: 0.4 }} onClick={() => router.push(`/dashboard/sales?view=create&quotationId=${sale.sale_id}`)}>
                                <ReceiptLongIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View / Print">
                              <IconButton size="small" color="primary" sx={{ p: 0.4 }} onClick={() => handleViewReceipt(sale)}>
                                <ReceiptIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print A4">
                              <IconButton size="small" sx={{ color: '#64748b', p: 0.4 }} onClick={() => handlePrintFromList(sale, 'A4')}>
                                <PrintIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" sx={{ color: '#f59e0b', p: 0.4 }} onClick={() => handleEdit(sale)}>
                                <EditIcon sx={{ fontSize: 17 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" sx={{ color: BRAND.primary.pink, p: 0.4 }} onClick={() => handleDelete(sale.sale_id)}>
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
          </Card>
        </Stack>
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
        className="no-print"
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{
          bgcolor: BRAND.supporting.periwinkle,
          color: '#fff',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Quotation Preview</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {currentBillData ? `#${currentBillData.sale_id}` : ''} · Valid price estimate
            </Typography>
          </Box>
          <IconButton onClick={() => setReceiptDialogOpen(false)} size="small" sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f8fafc', p: { xs: 2, md: 3 } }}>
          {currentBillData && (
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
              <Box sx={{ textAlign: 'center', mb: 3, pb: 2, borderBottom: `3px solid ${BRAND.supporting.periwinkle}` }}>
                <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#1e293b' }}>{COMPANY.name}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b', direction: 'rtl' }}>{COMPANY.nameUr}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.5 }}>{COMPANY.address}</Typography>
                <Chip
                  label="QUOTATION"
                  sx={{
                    mt: 1.5,
                    bgcolor: BRAND.tint.periwinkle,
                    color: BRAND.text.periwinkle,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                  }}
                />
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700 }}>Customer</Typography>
                  <Typography sx={{ fontWeight: 700, color: '#1e293b' }}>{currentBillData.customer?.cus_name || 'N/A'}</Typography>
                  {currentBillData.customer?.cus_phone_no && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{currentBillData.customer.cus_phone_no}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700 }}>Quotation Details</Typography>
                  <Typography sx={{ fontSize: '0.875rem' }}><strong>Quote #:</strong> {currentBillData.sale_id}</Typography>
                  <Typography sx={{ fontSize: '0.875rem' }}><strong>Date:</strong> {formatDatePK(currentBillData.created_at)}</Typography>
                  {currentBillData.reference && (
                    <Typography sx={{ fontSize: '0.875rem' }}><strong>Ref:</strong> {currentBillData.reference}</Typography>
                  )}
                </Grid>
              </Grid>

              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: BRAND.tint.periwinkle }}>
                      <TableCell sx={{ fontWeight: 700, color: BRAND.text.periwinkle }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: BRAND.text.periwinkle }}>Item</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: BRAND.text.periwinkle }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: BRAND.text.periwinkle }}>Rate</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: BRAND.text.periwinkle }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentBillData.sale_details?.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{detail.product?.pro_title || 'Item'}</TableCell>
                        <TableCell align="right">{detail.qnty}</TableCell>
                        <TableCell align="right">{fmtAmt(detail.unit_rate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtAmt(detail.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ minWidth: 240 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography>{fmtAmt(parseFloat(currentBillData.total_amount || 0) + parseFloat(currentBillData.discount || 0))}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography color="text.secondary">Discount</Typography>
                    <Typography>{fmtAmt(currentBillData.discount)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, color: BRAND.text.periwinkle }}>Quoted Total</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.125rem', color: BRAND.text.periwinkle }}>{fmtAmt(currentBillData.total_amount)}</Typography>
                  </Box>
                </Box>
              </Box>

              <Typography sx={{ mt: 3, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
                This is a quotation only. Prices and availability may change until converted to a sale.
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setReceiptDialogOpen(false)} sx={{ color: '#64748b' }}>Close</Button>
          <Button onClick={() => handlePrintBill('A4')} startIcon={<PrintIcon />} variant="outlined" sx={{ borderColor: BRAND.supporting.periwinkle, color: BRAND.text.periwinkle }}>
            Print A4
          </Button>
          <Button onClick={() => handlePrintBill('THERMAL')} startIcon={<PrintIcon />} variant="contained" sx={{ bgcolor: BRAND.supporting.periwinkle, '&:hover': { bgcolor: '#4a57d4' } }}>
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

      {/* Off-screen print templates — never shown on screen, only in print dialog */}
      <QuotationPrintTemplates billData={currentBillData || selectedBill} />

      <style jsx global>{`
        @media print {
          body.print-thermal *,
          body.print-a4 * {
            visibility: hidden !important;
          }

          body.print-thermal .dashboard-layout-root,
          body.print-thermal .MuiContainer-root,
          body.print-thermal .MuiDialog-root,
          body.print-thermal .MuiDialog-container,
          body.print-thermal .no-print,
          body.print-a4 .dashboard-layout-root,
          body.print-a4 .MuiDialog-root,
          body.print-a4 .MuiDialog-container,
          body.print-a4 .no-print {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          body.print-thermal #printable-invoice-thermal,
          body.print-thermal #printable-invoice-thermal * {
            visibility: visible !important;
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

          body.print-a4 #printable-invoice-a4,
          body.print-a4 #printable-invoice-a4 * {
            visibility: visible !important;
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
            background: #ffffff !important;
            color: #000000 !important;
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
