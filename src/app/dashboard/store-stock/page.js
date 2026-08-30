'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/dashboard-layout';
import { usePinAuth } from '../../hooks/usePinAuth';
import BiometricAuthDialog from '../components/BiometricAuthDialog';

// Material-UI imports
import { 
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  InputAdornment
} from '@mui/material';

import {
  Store as StoreIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  TransferWithinAStation as TransferIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Print as PrintIcon,
  Send as SendIcon,
  Phone as PhoneIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function StoreStockPage() {
  const { requireAuth, authDialogOpen, handleAuthSuccess, handleAuthCancel } = usePinAuth();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [storeStock, setStoreStock] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [transferDialog, setTransferDialog] = useState(false);
  const [editStockDialog, setEditStockDialog] = useState(false);
  const [updatingStock, setUpdatingStock] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [editStockQuantity, setEditStockQuantity] = useState('');
  const [transferData, setTransferData] = useState({
    fromStore: '',
    toStore: '',
    product: '',
    quantity: 0
  });
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('');
  const [filterStore, setFilterStore] = useState('');

  // WhatsApp share modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState('');
  const [whatsAppSuccess, setWhatsAppSuccess] = useState('');

  // Load initial data
  useEffect(() => {
    loadStores();
    loadAllStock(); // Load all stock by default
  }, []);

  // Load store stock when store is selected (if a specific store is selected)
  useEffect(() => {
    if (selectedStore) {
      loadStoreStock(selectedStore);
      loadLowStockProducts(selectedStore);
    } else {
      // If no store selected, load all stock
      loadAllStock();
    }
  }, [selectedStore]);

  const loadStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (response.ok) {
        const data = await response.json();
        setStores(data.data || data);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      showSnackbar('Error loading stores', 'error');
    }
  };

  const loadAllStock = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/store-stock');
      if (response.ok) {
        const data = await response.json();
        // Transform the data from stores array to flat stock items array
        const allStock = [];
        if (Array.isArray(data)) {
          data.forEach(store => {
            if (store.store_stocks && Array.isArray(store.store_stocks)) {
              store.store_stocks.forEach(stock => {
                allStock.push({
                  ...stock,
                  store: {
                    storeid: store.storeid,
                    store_name: store.store_name
                  }
                });
              });
            }
          });
        }
        setStoreStock(allStock);
      } else {
        showSnackbar('Error loading stock', 'error');
      }
    } catch (error) {
      console.error('Error loading stock:', error);
      showSnackbar('Error loading stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStoreStock = async (storeId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/store-stock?store_id=${storeId}`);
      if (response.ok) {
        const data = await response.json();
        // Add store info to each stock item
        const store = stores.find(s => s.storeid === parseInt(storeId));
        const stockWithStore = Array.isArray(data) ? data.map(item => ({
          ...item,
          store: store ? {
            storeid: store.storeid,
            store_name: store.store_name
          } : null
        })) : [];
        setStoreStock(stockWithStore);
      } else {
        showSnackbar('Error loading store stock', 'error');
      }
    } catch (error) {
      console.error('Error loading store stock:', error);
      showSnackbar('Error loading store stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLowStockProducts = async (storeId) => {
    try {
      const response = await fetch(`/api/store-stock?store_id=${storeId}&low_stock=true`);
      if (response.ok) {
        const data = await response.json();
        setLowStockProducts(data);
      }
    } catch (error) {
      console.error('Error loading low stock products:', error);
    }
  };

  const handleTransferStock = async () => {
    if (!transferData.fromStore || !transferData.toStore || !transferData.product || !transferData.quantity) {
      showSnackbar('Please fill all fields', 'error');
      return;
    }

    try {
      const response = await fetch('/api/store-stock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_store_id: transferData.fromStore,
          to_store_id: transferData.toStore,
          product_id: transferData.product,
          quantity: transferData.quantity,
          updated_by: 6 // System Administrator
        }),
      });

      if (response.ok) {
        showSnackbar('Stock transferred successfully', 'success');
        setTransferDialog(false);
        setTransferData({ fromStore: '', toStore: '', product: '', quantity: 0 });
        // Refresh stock data
        if (selectedStore) {
          loadStoreStock(selectedStore);
        }
      } else {
        const error = await response.json();
        showSnackbar(error.error || 'Error transferring stock', 'error');
      }
    } catch (error) {
      console.error('Error transferring stock:', error);
      showSnackbar('Error transferring stock', 'error');
    }
  };

  const openEditStockDialog = (stockItem) => {
    setEditingStockItem(stockItem);
    setEditStockQuantity('0');
    setEditStockDialog(true);
  };

  const getCurrentUserId = () => {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return 1;
      const parsed = JSON.parse(rawUser);
      return parsed?.user_id || parsed?.id || 1;
    } catch {
      return 1;
    }
  };

  const handleUpdateStock = async () => {
    if (!editingStockItem) return;

    const adjQty = parseFloat(editStockQuantity);
    if (Number.isNaN(adjQty)) {
      showSnackbar('Please enter a valid stock adjustment quantity', 'error');
      return;
    }

    if (adjQty === 0) {
      showSnackbar('Adjustment quantity cannot be zero', 'error');
      return;
    }

    const currentQty = parseFloat(editingStockItem?.stock_quantity || 0);
    if (currentQty + adjQty < 0) {
      showSnackbar('Post-adjustment stock quantity cannot be negative', 'error');
      return;
    }

    const authOk = await requireAuth();
    if (!authOk) return;

    try {
      setUpdatingStock(true);
      const response = await fetch('/api/store-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: editingStockItem.store_id || editingStockItem.store?.storeid,
          product_id: editingStockItem.pro_id || editingStockItem.product?.pro_id,
          quantity: adjQty,
          operation: 'adjust',
          updated_by: getCurrentUserId()
        }),
      });

      if (response.ok) {
        showSnackbar('Stock adjusted successfully', 'success');
        setEditStockDialog(false);
        setEditingStockItem(null);
        setEditStockQuantity('');
        if (selectedStore) {
          await loadStoreStock(selectedStore);
          await loadLowStockProducts(selectedStore);
        } else {
          await loadAllStock();
        }
      } else {
        const error = await response.json();
        showSnackbar(error.error || 'Error adjusting stock', 'error');
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      showSnackbar('Error adjusting stock', 'error');
    } finally {
      setUpdatingStock(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStockStatus = (current, min) => {
    if (current <= 0) return { label: 'Out of Stock', color: 'error' };
    if (current <= min) return { label: 'Low Stock', color: 'warning' };
    return { label: 'In Stock', color: 'success' };
  };

  // Filter store stock based on search criteria
  const filteredStoreStock = useMemo(() => {
    if (!Array.isArray(storeStock) || storeStock.length === 0) {
      return [];
    }

    return storeStock.filter(item => {
      // Search filter - by product name
      const matchesSearch = searchTerm === '' || 
        (item.product?.pro_title && item.product.pro_title.toLowerCase().includes(searchTerm.toLowerCase()));

      // Product filter
      const matchesProduct = filterProduct === '' || 
        (item.product?.pro_id?.toString() === filterProduct);

      // Store filter
      const matchesStore = filterStore === '' || 
        (item.store?.storeid?.toString() === filterStore);

      // Stock status filter
      const stockQty = parseFloat(item.stock_quantity) || 0;
      const minStock = parseFloat(item.min_stock) || 0;
      const status = getStockStatus(stockQty, minStock);
      
      let matchesStockStatus = true;
      if (filterStockStatus !== '') {
        if (filterStockStatus === 'out_of_stock') {
          matchesStockStatus = stockQty <= 0;
        } else if (filterStockStatus === 'low_stock') {
          matchesStockStatus = stockQty > 0 && stockQty <= minStock;
        } else if (filterStockStatus === 'in_stock') {
          // In Stock: quantity is above minimum threshold (or > 0 if no min threshold set)
          matchesStockStatus = minStock > 0 ? stockQty > minStock : stockQty > 0;
        }
      }

      return matchesSearch && matchesProduct && matchesStore && matchesStockStatus;
    });
  }, [storeStock, searchTerm, filterProduct, filterStore, filterStockStatus]);

  // ─── PDF generation ──────────────────────────────────────────────────────
  const filterSummaryLines = () => {
    const lines = [];
    if (selectedStore) {
      const s = stores.find(x => x.storeid === parseInt(selectedStore));
      if (s) lines.push(`Store: ${s.store_name}`);
    } else if (filterStore) {
      const s = stores.find(x => x.storeid?.toString() === filterStore);
      if (s) lines.push(`Store: ${s.store_name}`);
    }
    if (filterProduct) {
      const p = storeStock.find(x => x.product?.pro_id?.toString() === filterProduct)?.product;
      if (p) lines.push(`Product: ${p.pro_title}`);
    }
    if (filterStockStatus) {
      const label = filterStockStatus === 'out_of_stock' ? 'Out of Stock'
        : filterStockStatus === 'low_stock' ? 'Low Stock'
        : filterStockStatus === 'in_stock' ? 'In Stock' : filterStockStatus;
      lines.push(`Stock Status: ${label}`);
    }
    if (searchTerm) lines.push(`Search: "${searchTerm}"`);
    return lines;
  };

  const buildStockPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ITTEFAQ IRON STORE', pageWidth / 2, 36, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Parianwali, Pakistan', pageWidth / 2, 52, { align: 'center' });

    doc.setFillColor(30, 41, 59);
    doc.rect(30, 62, pageWidth - 60, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const heading = selectedStore
      ? `STORE STOCK — ${stores.find(s => s.storeid === parseInt(selectedStore))?.store_name || ''}`
      : 'STORE STOCK — ALL STORES';
    doc.text(heading.toUpperCase(), pageWidth / 2, 77, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let y = 98;
    const lines = [
      `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
      `Total Items: ${filteredStoreStock.length}`,
      ...filterSummaryLines(),
    ];
    lines.forEach(l => { doc.text(l, 30, y); y += 12; });
    const startY = y + 4;

    const fmtNum = (v) => (parseFloat(v) || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });

    const body = filteredStoreStock.map((item, i) => {
      const qty = parseFloat(item.stock_quantity) || 0;
      const min = parseFloat(item.min_stock) || 0;
      const status = qty <= 0 ? 'Out of Stock' : qty <= min ? 'Low Stock' : 'In Stock';
      return [
        String(i + 1),
        item.store?.store_name || '-',
        item.product?.pro_title || '-',
        item.product?.pro_unit || '-',
        fmtNum(qty),
        fmtNum(min),
        status,
      ];
    });

    const totalQty = filteredStoreStock.reduce((s, it) => s + (parseFloat(it.stock_quantity) || 0), 0);

    autoTable(doc, {
      startY,
      head: [['S#', 'Store', 'Product', 'Unit', 'Current Stock', 'Min Stock', 'Status']],
      body: body.length ? body : [[{ content: 'No stock records match the filters.', colSpan: 7, styles: { halign: 'center' } }]],
      foot: body.length ? [[
        { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: fmtNum(totalQty), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
        '',
      ]] : undefined,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      styles: { cellPadding: 4, overflow: 'linebreak' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 28 },
        3: { halign: 'center', cellWidth: 45 },
        4: { halign: 'right', cellWidth: 75 },
        5: { halign: 'right', cellWidth: 70 },
        6: { halign: 'center', cellWidth: 70 },
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      const ph = doc.internal.pageSize.getHeight();
      const pw = doc.internal.pageSize.getWidth();
      doc.text(`Page ${i} of ${pageCount}`, pw - 40, ph - 14, { align: 'right' });
      doc.text('Ittefaq Iron Store — Store Stock', 30, ph - 14);
    }

    return doc;
  };

  const handleDownloadPdf = () => {
    const doc = buildStockPdf();
    const storeLabel = selectedStore
      ? (stores.find(s => s.storeid === parseInt(selectedStore))?.store_name || 'store')
      : 'all-stores';
    const safe = String(storeLabel).toLowerCase().replace(/\s+/g, '-');
    doc.save(`store-stock-${safe}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const openWhatsAppModal = () => {
    setWhatsAppError('');
    setWhatsAppSuccess('');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = async () => {
    const phone = (whatsAppPhone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      setWhatsAppError('Please enter a valid phone number (e.g. 03001234567).');
      return;
    }
    try {
      setWhatsAppSending(true);
      setWhatsAppError('');
      setWhatsAppSuccess('');

      const doc = buildStockPdf();
      const today = new Date().toLocaleDateString('en-GB');
      const storeLabel = selectedStore
        ? stores.find(s => s.storeid === parseInt(selectedStore))?.store_name || 'Store'
        : 'All Stores';

      const { sharePdfViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const { opened } = await sharePdfViaWhatsAppDesktop(doc, phone);
      setWhatsAppSuccess(whatsAppSuccessMessage(opened));
    } catch (err) {
      console.error(err);
      setWhatsAppError(err.message || 'Failed to send WhatsApp message');
    } finally {
      setWhatsAppSending(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          * {
            box-sizing: border-box;
          }
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          /* Show only print elements */
          .print-header, .print-header *,
          .print-content, .print-content *,
          .print-footer, .print-footer * {
            visibility: visible;
          }
          /* Remove all constraints from layout containers */
          body, html {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Force all containers to full width */
          body > *,
          .MuiBox-root,
          .MuiContainer-root,
          main,
          [class*="MuiBox"],
          [class*="MuiContainer"],
          [role="main"],
          [class*="MuiPaper-root"] {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .print-header {
            position: fixed;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 15px 20px;
            background: white;
            z-index: 1000;
          }
          .print-content {
            position: fixed !important;
            left: 0 !important;
            top: 150px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            page-break-inside: avoid;
            z-index: 9998;
            background: white;
          }
          .print-content .MuiCard-root {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-content .MuiCardContent-root {
            width: 100% !important;
            max-width: 100% !important;
            padding: 5px !important;
            margin: 0 !important;
          }
          .print-content .MuiTableContainer-root {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .print-content .MuiPaper-root {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          /* Table width and layout for print */
          .print-content .MuiTableContainer-root {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-content .MuiTable-root {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          .print-content .MuiTableCell-root {
            padding: 8px 4px !important;
            border: 1px solid #000 !important;
            box-sizing: border-box !important;
          }
          .print-content .MuiTableHead-root .MuiTableCell-root {
            font-weight: bold !important;
            background-color: #f5f5f5 !important;
          }
          .print-footer {
            position: fixed;
            left: 0;
            bottom: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 15px 20px;
            border-top: 2px solid #000;
            background: white;
            z-index: 1000;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0.5cm;
            size: A4;
          }
        }
      `}</style>
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
          px: { xs: 2, sm: 3, md: 4 }, // Responsive horizontal padding
          '@media print': { 
            maxWidth: '100% !important', 
            width: '100% !important', 
            padding: '0 !important', 
            margin: '0 !important',
            marginLeft: '0 !important',
            marginRight: '0 !important'
          } 
        }}>
        <Box sx={{ 
          mb: 4, 
          '@media print': { 
            margin: '0 !important', 
            padding: '0 !important', 
            width: '100% !important', 
            maxWidth: '100% !important' 
          } 
        }}>
          <Box className="no-print">
          <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InventoryIcon color="primary" />
            Store Stock Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage inventory across multiple stores
          </Typography>
        </Box>
                        </Box>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }} className="no-print">
            <Typography variant="h6" gutterBottom>
              <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Low Stock Alert
            </Typography>
            <Typography variant="body2">
              {lowStockProducts.length} product(s) are running low on stock in this store.
            </Typography>
          </Alert>
        )}

        {/* Filter Section */}
        <Card sx={{ mb: 3 }} className="no-print">
            <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'semibold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon />
              Filter Stock
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Product"
                  placeholder="Search by product name"
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
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Store</InputLabel>
                  <Select
                    value={filterStore}
                    onChange={(e) => setFilterStore(e.target.value)}
                    label="Store"
                  >
                    <MenuItem value="">All Stores</MenuItem>
                    {stores.map((store) => (
                      <MenuItem key={store.storeid} value={store.storeid.toString()}>
                        {store.store_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Stock Status</InputLabel>
                  <Select
                    value={filterStockStatus}
                    onChange={(e) => setFilterStockStatus(e.target.value)}
                    label="Stock Status"
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="in_stock">In Stock</MenuItem>
                    <MenuItem value="low_stock">Low Stock</MenuItem>
                    <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterProduct('');
                      setFilterStore('');
                      setFilterStockStatus('');
                    }}
                    startIcon={<ClearIcon />}
                  >
                    Clear Filters
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    Showing {filteredStoreStock.length} of {storeStock.length} products
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Print Header */}
        <Box className="print-header" sx={{ display: 'none', '@media print': { display: 'block' } }}>
          {/* Company Header - Same as Sales Receipt */}
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" sx={{ 
              fontWeight: 'bold', 
              mb: 1,
              fontFamily: 'Arial, sans-serif',
              direction: 'rtl'
            }}>
              اتفاق آئرن اینڈ سیمنٹ سٹور
            </Typography>
            <Typography variant="body2" sx={{ 
              fontSize: '12px',
              mb: 0.5
            }}>
              گجرات سرگودھا روڈ، پاہڑیانوالی
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Ph: 0346-7560306, 0300-7560306
                </Typography>
            <Typography variant="h6" sx={{ 
              mt: 1, 
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              STOCK REPORT
                </Typography>
          </Box>
          
          {/* Report Details */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              <strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              <strong>Time:</strong> {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Typography>
          </Box>
          {selectedStore && (
            <Typography variant="body1" sx={{ mt: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'medium' }}>
              <strong>Store:</strong> {stores.find(s => s.storeid === parseInt(selectedStore))?.store_name || 'N/A'}
            </Typography>
          )}
        </Box>

        {/* Store Stock Table */}
        <Card className="print-content" sx={{ '@media print': { width: '100%', maxWidth: '100%', margin: 0, padding: 0 } }}>
          <CardContent sx={{ '@media print': { width: '100%', maxWidth: '100%', padding: '5px !important', margin: 0 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} className="no-print">
                <Typography variant="h6">
                {selectedStore 
                  ? `Stock for ${stores.find(s => s.storeid === parseInt(selectedStore))?.store_name}`
                  : 'All Store Stock'}
                </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" className="no-print">
                  {filteredStoreStock.length} products
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PdfIcon />}
                  onClick={handleDownloadPdf}
                  disabled={filteredStoreStock.length === 0}
                  className="no-print"
                  sx={{
                    bgcolor: '#e11d48',
                    '&:hover': { bgcolor: '#be123c' }
                  }}
                >
                  PDF
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={openWhatsAppModal}
                  disabled={filteredStoreStock.length === 0}
                  className="no-print"
                  sx={{
                    bgcolor: '#16a34a',
                    '&:hover': { bgcolor: '#15803d' }
                  }}
                >
                  WhatsApp PDF
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                  className="no-print"
                  sx={{
                    bgcolor: '#1976d2',
                    '&:hover': { bgcolor: '#1565c0' }
                  }}
                >
                  Print Report
                </Button>
              </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer 
                  component={Paper} 
                  variant="outlined" 
                  sx={{ 
                    width: '100%', 
                    '@media print': { 
                      width: '100% !important', 
                      maxWidth: '100% !important',
                      minWidth: '100% !important',
                      margin: '0 !important',
                      padding: '0 !important'
                    } 
                  }}
                >
                  <Table sx={{ 
                    width: '100%',
                    tableLayout: 'fixed',
                    '@media print': { 
                      width: '100% !important', 
                      minWidth: '100% !important',
                      maxWidth: '100% !important',
                      tableLayout: 'fixed !important',
                      margin: '0 !important',
                      borderCollapse: 'collapse !important'
                    } 
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Store</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Current Stock</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Unit</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} className="no-print">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStoreStock.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            {storeStock.length === 0 ? 'No stock found' : 'No products match your filters'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStoreStock.map((item) => {
                        const status = getStockStatus(item.stock_quantity, item.min_stock);
                        return (
                            <TableRow key={`${item.store_stock_id}-${item.store?.storeid || 'all'}`} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                  {item.store?.store_name || 'N/A'}
                                </Typography>
                              </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {item.product?.pro_title || 'N/A'}
                              </Typography>
                              {item.product?.pro_description && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {item.product.pro_description}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {item.stock_quantity}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={status.label}
                                color={status.color}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                              <TableCell>{item.product?.pro_unit || 'N/A'}</TableCell>
                              <TableCell className="no-print">
                                <Tooltip title="Edit Stock">
                                  <IconButton
                                    size="small"
                                    onClick={() => openEditStockDialog(item)}
                                    color="primary"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                          </TableRow>
                        );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

        {/* Print Footer */}
        <Box className="print-footer" sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              <strong>Total Products:</strong> {filteredStoreStock.length}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              <strong>Generated on:</strong> {new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>

        {/* Transfer Stock Dialog */}
        <Dialog open={transferDialog} onClose={() => setTransferDialog(false)} maxWidth="sm" fullWidth className="no-print">
          <DialogTitle>Transfer Stock Between Stores</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>From Store</InputLabel>
                <Select
                  value={transferData.fromStore}
                  onChange={(e) => setTransferData({ ...transferData, fromStore: e.target.value })}
                  label="From Store"
                >
                  {stores.map((store) => (
                    <MenuItem key={store.storeid} value={store.storeid}>
                      {store.store_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>To Store</InputLabel>
                <Select
                  value={transferData.toStore}
                  onChange={(e) => setTransferData({ ...transferData, toStore: e.target.value })}
                  label="To Store"
                >
                  {stores.filter(store => store.storeid !== parseInt(transferData.fromStore)).map((store) => (
                    <MenuItem key={store.storeid} value={store.storeid}>
                      {store.store_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Product ID"
                value={transferData.product}
                onChange={(e) => setTransferData({ ...transferData, product: e.target.value })}
                type="number"
              />

              <TextField
                fullWidth
                label="Quantity"
                value={transferData.quantity}
                onChange={(e) => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                type="number"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleTransferStock} variant="contained">
              Transfer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Stock Dialog */}
        <Dialog open={editStockDialog} onClose={() => setEditStockDialog(false)} maxWidth="sm" fullWidth className="no-print">
          <DialogTitle>Edit Stock Quantity</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Store"
                value={editingStockItem?.store?.store_name || 'N/A'}
                fullWidth
                disabled
              />
              <TextField
                label="Product"
                value={editingStockItem?.product?.pro_title || 'N/A'}
                fullWidth
                disabled
              />
              <TextField
                label="Existing Stock"
                value={parseFloat(editingStockItem?.stock_quantity || 0)}
                fullWidth
                disabled
              />
              <TextField
                label="Stock to Add / Subtract (e.g. 5 or -5)"
                type="number"
                fullWidth
                value={editStockQuantity}
                onChange={(e) => setEditStockQuantity(e.target.value)}
                inputProps={{ step: '0.01' }}
              />
              <TextField
                label="Post Quantity to Update"
                value={parseFloat(editingStockItem?.stock_quantity || 0) + (parseFloat(editStockQuantity) || 0)}
                fullWidth
                disabled
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditStockDialog(false)} disabled={updatingStock}>Cancel</Button>
            <Button onClick={handleUpdateStock} variant="contained" disabled={updatingStock}>
              {updatingStock ? 'Updating...' : 'Update Stock'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* WhatsApp Share Modal */}
        <Dialog
          open={showWhatsAppModal}
          onClose={() => !whatsAppSending && setShowWhatsAppModal(false)}
          maxWidth="sm"
          fullWidth
          className="no-print"
          PaperProps={{ sx: { borderRadius: '12px' } }}
        >
          <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#ecfdf5', borderBottom: '2px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#16a34a' }} />
            Send Store Stock to WhatsApp
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
              A PDF of the current stock list will be generated using your
              selected filters and sent to the given WhatsApp number.
            </Alert>
            <TextField
              fullWidth
              size="small"
              label="WhatsApp Number"
              placeholder="03001234567 or +923001234567"
              value={whatsAppPhone}
              onChange={(e) => setWhatsAppPhone(e.target.value)}
              disabled={whatsAppSending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', p: 1.5, fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>Report contents</div>
              <div style={{ color: '#64748b' }}>
                <div>• Items: {filteredStoreStock.length}</div>
                {filterSummaryLines().length > 0
                  ? filterSummaryLines().map((l, i) => <div key={i}>• {l}</div>)
                  : <div>• No filters applied (sending full list)</div>}
              </div>
            </Box>
            {whatsAppError && <Alert severity="error" sx={{ mt: 2 }}>{whatsAppError}</Alert>}
            {whatsAppSuccess && <Alert severity="success" sx={{ mt: 2 }}>{whatsAppSuccess}</Alert>}
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
            <Button
              onClick={() => { setShowWhatsAppModal(false); setWhatsAppError(''); setWhatsAppSuccess(''); }}
              disabled={whatsAppSending}
              variant="outlined"
            >
              Close
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={whatsAppSending || !whatsAppPhone.trim() || filteredStoreStock.length === 0}
              variant="contained"
              startIcon={whatsAppSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
            >
              {whatsAppSending ? 'Sending...' : 'Send PDF'}
            </Button>
          </DialogActions>
        </Dialog>

        <BiometricAuthDialog
          open={authDialogOpen}
          onSuccess={handleAuthSuccess}
          onClose={handleAuthCancel}
        />

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          className="no-print"
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
    </>
  );
}



