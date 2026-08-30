'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Search, Package, AlertTriangle, XCircle, RefreshCw, Store, BarChart2, Send, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';
import {
  Autocomplete, TextField, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Box, Alert, Tab, Tabs, Chip, CircularProgress
} from '@mui/material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TABS = [
  { id: 'all', label: 'All Stock', icon: Package },
  { id: 'store-wise', label: 'Store Wise', icon: Store },
  { id: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
  { id: 'low-stock-category', label: 'Low Stock by Category', icon: BarChart2 },
  { id: 'low-stock-store', label: 'Low Stock (Store Wise)', icon: Store },
];

export default function StockReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('store-wise');

  // Price adjustment modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [purchasePercentage, setPurchasePercentage] = useState('');
  const [salePercentage, setSalePercentage] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);

  // WhatsApp share modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState('');
  const [whatsAppSuccess, setWhatsAppSuccess] = useState('');

  useEffect(() => {
    fetchCategories();
    fetchStores();
    fetchReport();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (e) { console.error(e); }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      const result = await res.json();
      if (res.ok && result.success) setStores(result.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports?type=stock-report');
      const data = await res.json();
      if (res.ok) setReportData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const formatCurrency = (v) => (parseFloat(v) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** Integer / count formatting */
  const formatNumber = (v) => {
    const n = parseInt(String(v ?? '0'), 10);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  };
  /**
   * Stock quantities (Prisma Decimal / floats): no leading zeros, max 4 decimals, trim float noise.
   */
  const formatQty = (v) => {
    const n = parseFloat(String(v ?? '0').replace(/,/g, ''));
    if (Number.isNaN(n)) return '0';
    const r = Math.round(n * 10000) / 10000;
    if (Math.abs(r) < 1e-10) return '0';
    if (Math.abs(r - Math.round(r)) < 1e-6) {
      return Math.round(r).toLocaleString('en-PK', { maximumFractionDigits: 0 });
    }
    const t = Math.round(r * 10000) / 10000;
    return t.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  // ─── Filtering helpers ─────────────────────────────────────────────────────

  const getStoreQty = (product, storeId) => {
    const ss = product.store_stocks?.find(s => s.store_id === parseInt(storeId, 10));
    return parseFloat(String(ss?.stock_quantity ?? 0)) || 0;
  };

  const getTotalQty = (product) =>
    (product.store_stocks?.reduce((s, ss) => s + (parseFloat(String(ss.stock_quantity ?? 0)) || 0), 0)) || 0;

  const isLowStock = (product, storeId = null) => {
    const threshold = product.low_stock_quantity ?? 10;
    const qty = storeId ? getStoreQty(product, storeId) : getTotalQty(product);
    return qty > 0 && qty <= threshold;
  };

  const isOutOfStock = (product, storeId = null) => {
    const qty = storeId ? getStoreQty(product, storeId) : getTotalQty(product);
    return qty === 0;
  };

  const applyBaseFilters = (products) => {
    let list = [...products];
    if (selectedCategory) list = list.filter(p => p.cat_id === parseInt(selectedCategory));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.pro_title?.toLowerCase().includes(q));
    }
    return list;
  };

  // ─── Derived data for each tab ─────────────────────────────────────────────

  const getAllStockData = () => {
    if (!reportData) return [];
    return applyBaseFilters(reportData.products);
  };

  const getStoreWiseData = () => {
    if (!reportData) return [];
    const products = applyBaseFilters(reportData.products);
    const storeList = selectedStore
      ? stores.filter(s => s.storeid === parseInt(selectedStore))
      : stores;

    return storeList.map(store => {
      const storeProducts = products
        .map(p => ({ ...p, _storeQty: getStoreQty(p, store.storeid) }))
        .filter(p => p._storeQty > 0);
      const totalQty = storeProducts.reduce((s, p) => s + p._storeQty, 0);
      const totalValue = storeProducts.reduce((s, p) => s + p._storeQty * parseFloat(p.pro_cost_price || 0), 0);
      return { store, products: storeProducts, totalQty, totalValue };
    }).filter(g => g.products.length > 0);
  };

  const getLowStockData = () => {
    if (!reportData) return [];
    return applyBaseFilters(reportData.products).filter(p => {
      const qty = selectedStore ? getStoreQty(p, selectedStore) : getTotalQty(p);
      const threshold = p.low_stock_quantity ?? 10;
      return qty > 0 && qty <= threshold;
    });
  };

  const getLowStockStoreWiseData = () => {
    if (!reportData) return [];
    const products = applyBaseFilters(reportData.products);
    const storeList = selectedStore
      ? stores.filter(s => s.storeid === parseInt(selectedStore))
      : stores;

    return storeList.map(store => {
      const threshold = (p) => p.low_stock_quantity ?? 10;
      const lowProducts = products
        .map(p => ({ ...p, _storeQty: getStoreQty(p, store.storeid) }))
        .filter(p => p._storeQty > 0 && p._storeQty <= threshold(p));
      return { store, products: lowProducts };
    }).filter(g => g.products.length > 0);
  };

  const getLowStockByCategoryData = () => {
    if (!reportData) return [];
    const products = applyBaseFilters(reportData.products);
    const grouped = {};
    products.forEach(p => {
      const qty = selectedStore ? getStoreQty(p, selectedStore) : getTotalQty(p);
      const threshold = p.low_stock_quantity ?? 10;
      if (qty > 0 && qty <= threshold) {
        const catId = p.cat_id;
        const catName = p.category?.cat_name || 'Uncategorized';
        if (!grouped[catId]) grouped[catId] = { catId, catName, products: [] };
        grouped[catId].products.push({ ...p, _qty: qty });
      }
    });
    return Object.values(grouped).sort((a, b) => a.catName.localeCompare(b.catName));
  };

  // ─── Summary stats ─────────────────────────────────────────────────────────

  const getSummary = () => {
    if (!reportData) return null;
    const products = applyBaseFilters(reportData.products);
    const getQty = (p) => selectedStore ? getStoreQty(p, selectedStore) : getTotalQty(p);
    return {
      total: products.length,
      totalQty: products.reduce((s, p) => s + getQty(p), 0),
      totalValue: products.reduce((s, p) => s + getQty(p) * parseFloat(p.pro_cost_price || 0), 0),
      lowStock: products.filter(p => isLowStock(p, selectedStore || null)).length,
      outOfStock: products.filter(p => isOutOfStock(p, selectedStore || null)).length,
    };
  };

  const summary = getSummary();

  /**
   * One combined list: one row per (item × store) with a Store column (no per-store table columns / separate store blocks).
   */
  const getCombinedAllStockRows = (products) => {
    if (!products?.length) return [];
    const sorted = [...stores].sort((a, b) => (a.store_name || '').localeCompare(b.store_name || ''));

    if (selectedStore) {
      const st = stores.find(s => s.storeid === parseInt(String(selectedStore), 10));
      const name = st?.store_name || '—';
      return products.map(p => ({
        key: `r-${p.pro_id}-s${selectedStore}`,
        product: p,
        storeName: name,
        storeId: parseInt(String(selectedStore), 10),
        qty: getStoreQty(p, selectedStore),
      }));
    }

    if (sorted.length > 0) {
      const rows = [];
      for (const p of products) {
        const totalQ = getTotalQty(p);
        if (totalQ === 0) {
          rows.push({ key: `r-${p.pro_id}-zero`, product: p, storeName: '—', storeId: null, qty: 0 });
          continue;
        }
        for (const st of sorted) {
          const q = getStoreQty(p, st.storeid);
          if (q > 0) {
            rows.push({
              key: `r-${p.pro_id}-s${st.storeid}`,
              product: p,
              storeName: st.store_name,
              storeId: st.storeid,
              qty: q,
            });
          }
        }
      }
      return rows;
    }

    const rows = [];
    for (const p of products) {
      const list = p.store_stocks || [];
      const totalQ = getTotalQty(p);
      if (list.length) {
        if (totalQ === 0) {
          rows.push({ key: `r-${p.pro_id}-zero`, product: p, storeName: '—', storeId: null, qty: 0 });
          continue;
        }
        for (const s of list) {
          const q = parseFloat(String(s.stock_quantity ?? 0)) || 0;
          if (q > 0) {
            rows.push({
              key: `r-${p.pro_id}-ss${s.store_id}`,
              product: p,
              storeName: s.store?.store_name || `Store ${s.store_id}`,
              storeId: s.store_id,
              qty: q,
            });
          }
        }
      } else {
        rows.push({ key: `r-${p.pro_id}-nos`, product: p, storeName: '—', storeId: null, qty: getTotalQty(p) });
      }
    }
    return rows;
  };

  const sortCombinedAllStockRows = (rows) => {
    const cat = (p) => p?.category?.cat_name || '';
    const byStore = (a, b) => {
      if (a.storeName === '—' && b.storeName !== '—') return 1;
      if (b.storeName === '—' && a.storeName !== '—') return -1;
      return (a.storeName || '').localeCompare(b.storeName || '', undefined, { sensitivity: 'base' });
    };
    return [...rows].sort((a, b) => {
      const s1 = byStore(a, b);
      if (s1 !== 0) return s1;
      const c1 = cat(a.product).localeCompare(cat(b.product), undefined, { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      return (a.product.pro_title || '').localeCompare(b.product.pro_title || '', undefined, { sensitivity: 'base' });
    });
  };

  const getStoreWiseCombinedRows = () => {
    const groups = getStoreWiseData();
    return groups.flatMap(({ store, products }) =>
      products.map(p => ({
        key: `sw-${p.pro_id}-s${store.storeid}`,
        product: p,
        storeName: store.store_name,
        storeId: store.storeid,
        qty: p._storeQty,
      }))
    );
  };

  const sortStoreWiseRows = (rows) => {
    const cat = (p) => p?.category?.cat_name || '';
    return [...rows].sort((a, b) => {
      const n = (a.storeName || '').localeCompare(b.storeName || '', undefined, { sensitivity: 'base' });
      if (n !== 0) return n;
      const c1 = cat(a.product).localeCompare(cat(b.product), undefined, { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      return (a.product.pro_title || '').localeCompare(b.product.pro_title || '', undefined, { sensitivity: 'base' });
    });
  };

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (!reportData) return;
    const products = getAllStockData();
    const rawRows = sortCombinedAllStockRows(getCombinedAllStockRows(products));
    let csv = 'STOCK REPORT (combined by store)\n';
    csv += `Generated: ${new Date().toLocaleDateString('en-GB')}\n\n`;
    csv += 'S.No,Store,Category,Item Name,Unit,Qty,Base Rate,Sale Rate,Cost Rate,Line Value,Low Stock Threshold,Status\n';
    rawRows.forEach((row, i) => {
      const p = row.product;
      const qty = row.qty;
      const val = qty * parseFloat(p.pro_cost_price || 0);
      const threshold = p.low_stock_quantity ?? 10;
      const status = qty === 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock';
      const storeEsc = (row.storeName || '').replace(/"/g, '""');
      const titleEsc = (p.pro_title || '').replace(/"/g, '""');
      csv += `${i + 1},"${storeEsc}",${p.category?.cat_name || ''},"${titleEsc}",${p.pro_unit || ''},${formatQty(qty)},${formatCurrency(p.pro_baser_price)},${formatCurrency(p.pro_sale_price)},${formatCurrency(p.pro_cost_price)},${formatCurrency(val)},${threshold},${status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ─── PDF generation ────────────────────────────────────────────────────────

  const activeTabLabel = () => TABS.find(t => t.id === activeTab)?.label || 'Stock Report';

  const filterSummaryLines = () => {
    const lines = [];
    if (selectedCategory) {
      const c = categories.find(x => x.cat_id === parseInt(selectedCategory));
      if (c) lines.push(`Category: ${c.cat_name}`);
    }
    if (selectedStore) {
      const s = stores.find(x => x.storeid === parseInt(selectedStore));
      if (s) lines.push(`Store: ${s.store_name}`);
    }
    if (searchQuery) lines.push(`Search: "${searchQuery}"`);
    return lines;
  };

  const startPdf = () => {
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
    doc.text(`STOCK REPORT — ${activeTabLabel().toUpperCase()}`, pageWidth / 2, 77, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = [
      `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
      ...filterSummaryLines(),
    ];
    let y = 98;
    lines.forEach(l => { doc.text(l, 30, y); y += 12; });
    return { doc, startY: y + 4 };
  };

  const addSummaryFooter = (doc, startY) => {
    if (!summary) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Summary', 30, startY);
    autoTable(doc, {
      startY: startY + 4,
      head: [['Total Items', 'Total Qty', 'Stock Value (Rs.)', 'Low Stock', 'Out of Stock']],
      body: [[
        formatNumber(summary.total),
        formatQty(summary.totalQty),
        formatCurrency(summary.totalValue),
        String(summary.lowStock),
        String(summary.outOfStock),
      ]],
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'right' },
      styles: { cellPadding: 4 },
    });
  };

  const buildPdfForActiveTab = () => {
    const { doc, startY } = startPdf();

    if (activeTab === 'all') {
      const rawRows = sortCombinedAllStockRows(getCombinedAllStockRows(getAllStockData()));
      const body = rawRows.map((row, i) => {
        const p = row.product;
        const qty = row.qty;
        const threshold = p.low_stock_quantity ?? 10;
        const status = qty < 0 ? 'Negative' : qty === 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock';
        const value = qty * parseFloat(p.pro_cost_price || 0);
        return [
          String(i + 1),
          p.category?.cat_name || '-',
          p.pro_title || '-',
          p.pro_unit || '-',
          row.storeName || '—',
          formatQty(qty),
          formatCurrency(p.pro_baser_price),
          formatCurrency(p.pro_sale_price),
          formatCurrency(p.pro_cost_price),
          formatCurrency(value),
          status,
        ];
      });
      const totalQty = rawRows.reduce((s, r) => s + r.qty, 0);
      const totalValue = rawRows.reduce((s, r) => s + r.qty * parseFloat(r.product.pro_cost_price || 0), 0);
      autoTable(doc, {
        startY,
        head: [['S#', 'Category', 'Item Name', 'Unit', 'Store', 'Qty', 'Base Rate', 'Sale Rate', 'Cost Rate', 'Value', 'Status']],
        body: body.length ? body : [[{ content: 'No products match the current filters.', colSpan: 11, styles: { halign: 'center' } }]],
        foot: body.length ? [[
          { content: 'Grand Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatQty(totalQty), styles: { halign: 'right', fontStyle: 'bold' } },
          '',
          '',
          '',
          { content: formatCurrency(totalValue), styles: { halign: 'right', fontStyle: 'bold' } },
          '',
        ]] : undefined,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        footStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 22 },
          3: { halign: 'center', cellWidth: 30 },
          4: { halign: 'left', cellWidth: 70 },
          5: { halign: 'right', cellWidth: 35 },
          6: { halign: 'right', cellWidth: 45 },
          7: { halign: 'right', cellWidth: 45 },
          8: { halign: 'right', cellWidth: 45 },
          9: { halign: 'right', cellWidth: 50 },
          10: { halign: 'center', cellWidth: 45 },
        },
      });
    } else if (activeTab === 'store-wise') {
      const rawRows = sortStoreWiseRows(getStoreWiseCombinedRows());
      if (rawRows.length === 0) {
        doc.text('No store stock data found.', 30, startY);
      } else {
        const body = rawRows.map((row, i) => {
          const p = row.product;
          const qty = row.qty;
          const threshold = p.low_stock_quantity ?? 10;
          const status = qty < 0 ? 'Negative' : qty === 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock';
          const value = qty * parseFloat(p.pro_cost_price || 0);
          return [
            String(i + 1),
            p.category?.cat_name || '-',
            p.pro_title || '-',
            p.pro_unit || '-',
            row.storeName || '—',
            formatQty(qty),
            formatCurrency(p.pro_baser_price),
            formatCurrency(p.pro_sale_price),
            formatCurrency(p.pro_cost_price),
            formatCurrency(value),
            status,
          ];
        });
        const totalQty = rawRows.reduce((s, r) => s + r.qty, 0);
        const totalValue = rawRows.reduce((s, r) => s + r.qty * parseFloat(r.product.pro_cost_price || 0), 0);
        autoTable(doc, {
          startY,
          head: [['S#', 'Category', 'Item Name', 'Unit', 'Store', 'Qty', 'Base Rate', 'Sale Rate', 'Cost Rate', 'Value', 'Status']],
          body,
          foot: [[
            { content: 'Grand Total', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatQty(totalQty), styles: { halign: 'right', fontStyle: 'bold' } },
            '',
            '',
            '',
            { content: formatCurrency(totalValue), styles: { halign: 'right', fontStyle: 'bold' } },
            '',
          ]],
          theme: 'grid',
          headStyles: { fillColor: [67, 56, 202], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          footStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          styles: { cellPadding: 3, overflow: 'linebreak' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 22 },
            3: { halign: 'center', cellWidth: 30 },
            4: { halign: 'left', cellWidth: 70 },
            5: { halign: 'right', cellWidth: 35 },
            6: { halign: 'right', cellWidth: 45 },
            7: { halign: 'right', cellWidth: 45 },
            8: { halign: 'right', cellWidth: 45 },
            9: { halign: 'right', cellWidth: 50 },
            10: { halign: 'center', cellWidth: 45 },
          },
        });
      }
    } else if (activeTab === 'low-stock') {
      const products = getLowStockData();
      const body = products.map((p, i) => {
        const qty = selectedStore ? getStoreQty(p, selectedStore) : getTotalQty(p);
        const threshold = p.low_stock_quantity ?? 10;
        const breakdown = p.store_stocks?.map(ss => `${ss.store?.store_name || `S${ss.store_id}`}: ${formatQty(ss.stock_quantity)}`).join(' | ') || '—';
        return [
          String(i + 1),
          p.category?.cat_name || '-',
          p.pro_title || '-',
          p.pro_unit || '-',
          formatQty(qty),
          formatQty(threshold),
          breakdown,
          formatCurrency(p.pro_baser_price),
          formatCurrency(p.pro_sale_price),
          formatCurrency(p.pro_cost_price),
          formatCurrency(qty * parseFloat(p.pro_cost_price || 0)),
        ];
      });
      autoTable(doc, {
        startY,
        head: [['S#', 'Category', 'Item Name', 'Unit', 'Qty', 'Threshold', 'Store Breakdown', 'Base Rate', 'Sale Rate', 'Cost Rate', 'Value']],
        body: body.length ? body : [[{ content: 'No low stock items — all products are well stocked.', colSpan: 11, styles: { halign: 'center' } }]],
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 3 },
      });
    } else if (activeTab === 'low-stock-category') {
      const groups = getLowStockByCategoryData();
      if (groups.length === 0) {
        doc.text('No low stock items in any category.', 30, startY);
      } else {
        let y = startY;
        groups.forEach((g) => {
          const catTotalQty = g.products.reduce((s, p) => s + p._qty, 0);
          const catTotalValue = g.products.reduce((s, p) => s + p._qty * parseFloat(p.pro_cost_price || 0), 0);
          const body = g.products.map((p, i) => {
            const threshold = p.low_stock_quantity ?? 10;
            const shortage = threshold - p._qty;
            return [
              String(i + 1),
              p.pro_title || '-',
              p.pro_unit || '-',
              formatQty(p._qty),
              formatQty(threshold),
              formatQty(shortage),
              formatCurrency(p.pro_baser_price),
              formatCurrency(p.pro_sale_price),
              formatCurrency(p.pro_cost_price),
              formatCurrency(p._qty * parseFloat(p.pro_cost_price || 0)),
            ];
          });
          autoTable(doc, {
            startY: y,
            head: [[
              { content: `${g.catName} — ${g.products.length} low-stock items · Qty: ${formatQty(catTotalQty)} · Value: Rs. ${formatCurrency(catTotalValue)}`, colSpan: 10, styles: { halign: 'left', fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' } },
            ], ['S#', 'Item Name', 'Unit', 'Qty', 'Threshold', 'Shortage', 'Base Rate', 'Sale Rate', 'Cost Rate', 'Value']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [254, 243, 199], textColor: 92, fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            styles: { cellPadding: 3 },
          });
          y = (doc.lastAutoTable?.finalY || y) + 18;
        });
      }
    } else if (activeTab === 'low-stock-store') {
      const groups = getLowStockStoreWiseData();
      if (groups.length === 0) {
        doc.text('No low stock items in any store.', 30, startY);
      } else {
        let y = startY;
        groups.forEach((g) => {
          const body = g.products.map((p, i) => [
            String(i + 1),
            p.category?.cat_name || '-',
            p.pro_title || '-',
            p.pro_unit || '-',
            formatQty(p._storeQty),
            formatQty(p.low_stock_quantity ?? 10),
            formatCurrency(p.pro_baser_price),
            formatCurrency(p.pro_sale_price),
            formatCurrency(p.pro_cost_price),
          ]);
          autoTable(doc, {
            startY: y,
            head: [[
              { content: `${g.store.store_name} — ${g.products.length} items need restocking`, colSpan: 9, styles: { halign: 'left', fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' } },
            ], ['S#', 'Category', 'Item Name', 'Unit', 'Store Qty', 'Min Threshold', 'Base Rate', 'Sale Rate', 'Cost Rate']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [254, 243, 199], textColor: 92, fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            styles: { cellPadding: 3 },
          });
          y = (doc.lastAutoTable?.finalY || y) + 18;
        });
      }
    }

    const finalY = (doc.lastAutoTable?.finalY || startY) + 20;
    addSummaryFooter(doc, Math.min(finalY, doc.internal.pageSize.getHeight() - 120));

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      const ph = doc.internal.pageSize.getHeight();
      const pw = doc.internal.pageSize.getWidth();
      doc.text(`Page ${i} of ${pageCount}`, pw - 40, ph - 14, { align: 'right' });
      doc.text('Ittefaq Iron Store — Stock Report', 30, ph - 14);
    }

    return doc;
  };

  const handleDownloadPdf = () => {
    if (!reportData) return;
    const doc = buildPdfForActiveTab();
    const filename = `stock-report-${activeTab}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // ─── WhatsApp share ────────────────────────────────────────────────────────

  const openWhatsAppModal = () => {
    setWhatsAppError('');
    setWhatsAppSuccess('');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = async () => {
    if (!reportData) return;
    const phone = (whatsAppPhone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      setWhatsAppError('Please enter a valid phone number (e.g. 03001234567).');
      return;
    }
    try {
      setWhatsAppSending(true);
      setWhatsAppError('');
      setWhatsAppSuccess('');

      const doc = buildPdfForActiveTab();
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

  // ─── Price adjustment ──────────────────────────────────────────────────────

  const applyPriceAdjustment = async () => {
    if (!selectedCategory) { alert('Please select a category'); return; }
    const purchaseVal = purchasePercentage !== '' ? parseFloat(purchasePercentage) : null;
    const saleVal = salePercentage !== '' ? parseFloat(salePercentage) : null;
    if ((purchaseVal == null || isNaN(purchaseVal)) && (saleVal == null || isNaN(saleVal))) {
      alert('Please enter at least one valid percentage.'); return;
    }
    if (!window.confirm(`Apply ${[purchaseVal != null ? `purchase ${purchaseVal}%` : '', saleVal != null ? `sale ${saleVal}%` : ''].filter(Boolean).join(' and ')} to category?`)) return;
    try {
      setAdjustmentLoading(true);
      const payload = { categoryId: parseInt(selectedCategory) };
      if (purchaseVal != null && !isNaN(purchaseVal)) payload.purchasePercentage = purchaseVal;
      if (saleVal != null && !isNaN(saleVal)) payload.salePercentage = saleVal;
      const res = await fetch('/api/products/adjust-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { alert(`✅ Updated ${data.updatedCount} products!`); setShowAdjustmentModal(false); setPurchasePercentage(''); setSalePercentage(''); await fetchReport(); }
      else alert(`Error: ${data.error || 'Failed'}`);
    } catch (e) { alert('Error updating prices'); }
    finally { setAdjustmentLoading(false); }
  };

  // ─── Row background helper ─────────────────────────────────────────────────

  const rowBg = (product, storeId = null, idx = 0) => {
    const qty = storeId ? getStoreQty(product, storeId) : getTotalQty(product);
    const threshold = product.low_stock_quantity ?? 10;
    if (qty < 0) return 'bg-red-100';
    if (qty === 0) return 'bg-red-50';
    if (qty <= threshold) return 'bg-amber-50';
    return idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
  };

  const statusBadge = (product, storeId = null) => {
    const qty = storeId ? getStoreQty(product, storeId) : getTotalQty(product);
    const threshold = product.low_stock_quantity ?? 10;
    if (qty < 0) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-200 text-red-800">Negative</span>;
    if (qty === 0) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">Out of Stock</span>;
    if (qty <= threshold) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">Low Stock</span>;
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">In Stock</span>;
  };

  // ─── Table: All Stock ──────────────────────────────────────────────────────

  const renderAllStock = () => {
    const products = getAllStockData();
    const rawRows = sortCombinedAllStockRows(getCombinedAllStockRows(products));
    const grandTotalQty = rawRows.reduce((s, r) => s + r.qty, 0);
    const grandTotalValue = rawRows.reduce((s, r) => s + r.qty * parseFloat(r.product.pro_cost_price || 0), 0);
    const filterLabel = selectedStore
      ? stores.find(s => s.storeid === parseInt(String(selectedStore), 10))?.store_name
      : null;

    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 print:hidden">
          <strong>Combined by store</strong> — one row per item and location. <strong>Qty</strong> is for that store only
          {filterLabel ? <span> (filter: <strong>{filterLabel}</strong>)</span> : null}.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-2 py-2.5 text-left text-xs font-bold uppercase border-r border-slate-600 w-9">S#</th>
                <th className="px-2 py-2.5 text-left text-xs font-bold uppercase border-r border-slate-600 min-w-[88px]">Category</th>
                <th className="px-2 py-2.5 text-left text-xs font-bold uppercase border-r border-slate-600 min-w-[120px]">Item</th>
                <th className="px-2 py-2.5 text-center text-xs font-bold uppercase border-r border-slate-600 w-12">Unit</th>
                <th className="px-2 py-2.5 text-left text-xs font-bold uppercase border-r border-slate-600 min-w-[100px]">Store</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold uppercase border-r border-slate-600 w-24">Qty</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold uppercase border-r border-slate-600 w-24">Base Rate</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold uppercase border-r border-slate-600 w-24">Sale Rate</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold uppercase border-r border-slate-600 w-24">Cost</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold uppercase border-r border-slate-600 w-24">Value</th>
                <th className="px-2 py-2.5 text-center text-xs font-bold uppercase w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rawRows.length === 0 ? (
                <tr><td colSpan={11} className="py-10 text-center text-slate-400">No products found</td></tr>
              ) : rawRows.map((row, i) => {
                const p = row.product;
                const q = row.qty;
                return (
                  <tr key={row.key} className={`${rowBg(p, row.storeId, i)} hover:brightness-95 transition-all`}>
                    <td className="px-2 py-2 text-slate-500 border-r border-slate-100 text-xs">{i + 1}</td>
                    <td className="px-2 py-2 text-slate-600 border-r border-slate-100 text-xs max-w-[100px] truncate">{p.category?.cat_name}</td>
                    <td className="px-2 py-2 font-semibold text-slate-900 border-r border-slate-100 text-xs max-w-[220px]">{p.pro_title}</td>
                    <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-100 text-xs">{p.pro_unit || '—'}</td>
                    <td className="px-2 py-2 text-slate-700 border-r border-slate-100 text-xs font-medium max-w-[140px] truncate" title={row.storeName || ''}>
                      {row.storeName}
                    </td>
                    <td className={`px-2 py-2 text-right font-bold border-r border-slate-100 tabular-nums text-xs ${q <= 0 ? 'text-red-600' : q <= (p.low_stock_quantity ?? 10) ? 'text-amber-600' : 'text-slate-900'}`}>
                      {formatQty(q)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums text-xs">{formatCurrency(p.pro_baser_price)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums text-xs">{formatCurrency(p.pro_sale_price)}</td>
                    <td className="px-2 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums text-xs">{formatCurrency(p.pro_cost_price)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900 border-r border-slate-100 tabular-nums text-xs">{formatCurrency(q * parseFloat(p.pro_cost_price || 0))}</td>
                    <td className="px-2 py-2 text-center text-xs">{statusBadge(p, row.storeId)}</td>
                  </tr>
                );
              })}
            </tbody>
            {rawRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold text-xs">
                  <td colSpan={5} className="px-2 py-2.5 text-right uppercase border-r border-slate-600">Grand total (lines above)</td>
                  <td className="px-2 py-2.5 text-right tabular-nums border-r border-slate-600">{formatQty(grandTotalQty)}</td>
                  <td className="px-2 py-2.5 border-r border-slate-600" />
                  <td className="px-2 py-2.5 border-r border-slate-600" />
                  <td className="px-2 py-2.5 border-r border-slate-600" />
                  <td className="px-2 py-2.5 text-right tabular-nums border-r border-slate-600">{formatCurrency(grandTotalValue)}</td>
                  <td className="px-2 py-2.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  // ─── Table: Store Wise ─────────────────────────────────────────────────────

  const renderStoreWise = () => {
    const rawRows = sortStoreWiseRows(getStoreWiseCombinedRows());
    if (rawRows.length === 0) return <div className="py-16 text-center text-slate-400">No store stock data found</div>;
    const lineQty = rawRows.reduce((s, r) => s + r.qty, 0);
    const lineValue = rawRows.reduce((s, r) => s + r.qty * parseFloat(r.product.pro_cost_price || 0), 0);

    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-indigo-700 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 font-bold text-base">
            <Store className="w-4 h-4" />
            Store-wise stock (single table)
          </div>
          <div className="flex gap-4 text-indigo-100">
            <span><strong className="text-white">{rawRows.length}</strong> line{rawRows.length !== 1 ? 's' : ''}</span>
            <span>Total Qty: <strong className="text-white">{formatQty(lineQty)}</strong></span>
            <span>Value: <strong className="text-white">Rs. {formatCurrency(lineValue)}</strong></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-slate-200 w-10">S#</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-slate-200">Category</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-slate-200 min-w-[120px]">Item Name</th>
                <th className="px-3 py-2 text-center text-xs font-bold uppercase border-r border-slate-200 w-14">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-slate-200 min-w-[100px]">Store</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-slate-200 w-24">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-slate-200 w-28">Base Rate</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-slate-200 w-28">Sale Rate</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-slate-200 w-28">Cost Rate</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-slate-200 w-28">Value</th>
                <th className="px-3 py-2 text-center text-xs font-bold uppercase w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rawRows.map((row, i) => {
                const p = row.product;
                return (
                  <tr key={row.key} className={`${rowBg(p, row.storeId, i)} hover:brightness-95`}>
                    <td className="px-3 py-2 text-slate-400 border-r border-slate-100 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-100 text-xs">{p.category?.cat_name}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900 border-r border-slate-100">{p.pro_title}</td>
                    <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100 text-xs">{p.pro_unit || '—'}</td>
                    <td className="px-3 py-2 text-indigo-900 border-r border-slate-100 text-xs font-medium max-w-[160px] truncate" title={row.storeName || ''}>
                      {row.storeName}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold border-r border-slate-100 tabular-nums ${p._storeQty <= (p.low_stock_quantity ?? 10) ? 'text-amber-600' : 'text-slate-900'}`}>{formatQty(p._storeQty)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums">{formatCurrency(p.pro_baser_price)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums">{formatCurrency(p.pro_sale_price)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100 tabular-nums">{formatCurrency(p.pro_cost_price)}</td>
                    <td className="px-3 py-2 text-right font-semibold border-r border-slate-100 tabular-nums">{formatCurrency(p._storeQty * parseFloat(p.pro_cost_price || 0))}</td>
                    <td className="px-3 py-2 text-center">{statusBadge(p, row.storeId)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 font-semibold text-indigo-900">
                <td colSpan={5} className="px-3 py-2 text-right text-xs uppercase border-r border-slate-200">Grand total</td>
                <td className="px-3 py-2 text-right tabular-nums border-r border-slate-200">{formatQty(lineQty)}</td>
                <td className="px-3 py-2 border-r border-slate-200" />
                <td className="px-3 py-2 border-r border-slate-200" />
                <td className="px-3 py-2 border-r border-slate-200" />
                <td className="px-3 py-2 text-right tabular-nums border-r border-slate-200">{formatCurrency(lineValue)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ─── Table: Low Stock ──────────────────────────────────────────────────────

  const renderLowStock = () => {
    const products = getLowStockData();
    return (
      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4" />
          Low Stock Items — {products.length} product{products.length !== 1 ? 's' : ''} need restocking
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-50 text-amber-900">
              <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200 w-10">S#</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Category</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Item Name</th>
              <th className="px-3 py-2 text-center text-xs font-bold uppercase border-r border-amber-200 w-14">Unit</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-24">Current Qty</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-24">Threshold</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Store Breakdown</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Base Rate</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Sale Rate</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Cost Rate</th>
              <th className="px-3 py-2 text-right text-xs font-bold uppercase w-28">Stock Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {products.length === 0 ? (
              <tr><td colSpan={11} className="py-10 text-center text-green-600 font-semibold">✅ No low stock items — all products are well stocked!</td></tr>
            ) : products.map((p, i) => {
              const qty = selectedStore ? getStoreQty(p, selectedStore) : getTotalQty(p);
              const threshold = p.low_stock_quantity ?? 10;
              const storeBreakdown = p.store_stocks?.map(ss => `${ss.store?.store_name || `S${ss.store_id}`}: ${formatQty(ss.stock_quantity)}`).join(' | ') || '—';
              return (
                <tr key={p.pro_id} className={`bg-amber-50 hover:bg-amber-100 transition-colors`}>
                  <td className="px-3 py-2 text-amber-500 border-r border-amber-100 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-600 border-r border-amber-100 text-xs">{p.category?.cat_name}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 border-r border-amber-100">{p.pro_title}</td>
                  <td className="px-3 py-2 text-center text-slate-500 border-r border-amber-100 text-xs">{p.pro_unit || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700 border-r border-amber-100 tabular-nums">{formatQty(qty)}</td>
                  <td className="px-3 py-2 text-right text-slate-500 border-r border-amber-100 tabular-nums">{formatQty(threshold)}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs border-r border-amber-100">{storeBreakdown}</td>
                  <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_baser_price)}</td>
                  <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_sale_price)}</td>
                  <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_cost_price)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(qty * parseFloat(p.pro_cost_price || 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── Table: Low Stock Store Wise ───────────────────────────────────────────

  const renderLowStockStoreWise = () => {
    const groups = getLowStockStoreWiseData();
    if (groups.length === 0) return (
      <div className="py-16 text-center">
        <div className="text-green-600 font-semibold text-lg">✅ No low stock items in any store</div>
        <p className="text-slate-400 mt-1">All stores are well stocked</p>
      </div>
    );
    return (
      <div className="space-y-6">
        {groups.map(({ store, products }) => (
          <div key={store.storeid} className="bg-white border border-amber-300 rounded-lg overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-base">
                <AlertTriangle className="w-4 h-4" />
                {store.store_name} — Low Stock Alert
              </div>
              <span className="text-amber-100 text-sm">{products.length} item{products.length !== 1 ? 's' : ''} need restocking</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50 text-amber-900">
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200 w-10">S#</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Item Name</th>
                  <th className="px-3 py-2 text-center text-xs font-bold uppercase border-r border-amber-200 w-14">Unit</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Store Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-24">Min Threshold</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Base Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Sale Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase w-28">Cost Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {products.map((p, i) => (
                  <tr key={p.pro_id} className="bg-amber-50 hover:bg-amber-100">
                    <td className="px-3 py-2 text-amber-400 border-r border-amber-100 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-500 border-r border-amber-100 text-xs">{p.category?.cat_name}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900 border-r border-amber-100">{p.pro_title}</td>
                    <td className="px-3 py-2 text-center text-slate-500 border-r border-amber-100 text-xs">{p.pro_unit || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-amber-700 border-r border-amber-100 tabular-nums">{formatQty(p._storeQty)}</td>
                    <td className="px-3 py-2 text-right text-slate-500 border-r border-amber-100 tabular-nums">{formatQty(p.low_stock_quantity ?? 10)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_baser_price)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_sale_price)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{formatCurrency(p.pro_cost_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  // ─── Table: Low Stock by Category ─────────────────────────────────────────

  const renderLowStockByCategory = () => {
    const groups = getLowStockByCategoryData();
    if (groups.length === 0) return (
      <div className="py-16 text-center">
        <div className="text-green-600 font-semibold text-lg">✅ No low stock items in any category</div>
        <p className="text-slate-400 mt-1">All categories are well stocked</p>
      </div>
    );
    const totalLow = groups.reduce((s, g) => s + g.products.length, 0);
    return (
      <div className="space-y-5">
        {/* Overview banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-amber-800 font-semibold">
            {totalLow} product{totalLow !== 1 ? 's' : ''} across {groups.length} categor{groups.length !== 1 ? 'ies' : 'y'} need restocking
          </span>
        </div>

        {groups.map(({ catId, catName, products }) => {
          const catTotalQty = products.reduce((s, p) => s + p._qty, 0);
          const catTotalValue = products.reduce((s, p) => s + p._qty * parseFloat(p.pro_cost_price || 0), 0);
          return (
            <div key={catId} className="bg-white border border-amber-200 rounded-lg overflow-hidden">
              {/* Category header */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-base">
                  <BarChart2 className="w-4 h-4" />
                  {catName}
                </div>
                <div className="flex gap-4 text-sm text-amber-100">
                  <span>{products.length} low-stock item{products.length !== 1 ? 's' : ''}</span>
                  <span>Qty: <strong className="text-white">{formatQty(catTotalQty)}</strong></span>
                  <span>Value: <strong className="text-white">Rs. {formatCurrency(catTotalValue)}</strong></span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 text-amber-900">
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200 w-10">S#</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Item Name</th>
                    <th className="px-3 py-2 text-center text-xs font-bold uppercase border-r border-amber-200 w-14">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Current Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Min Threshold</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-20">Shortage</th>
                    <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-amber-200">Store Breakdown</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Base Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Sale Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase border-r border-amber-200 w-28">Cost Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold uppercase w-28">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {products.map((p, i) => {
                    const threshold = p.low_stock_quantity ?? 10;
                    const shortage = threshold - p._qty;
                    const storeBreakdown = p.store_stocks?.map(ss =>
                      `${ss.store?.store_name || `S${ss.store_id}`}: ${formatQty(ss.stock_quantity)}`
                    ).join(' | ') || '—';
                    return (
                      <tr key={p.pro_id} className="bg-amber-50 hover:bg-amber-100 transition-colors">
                        <td className="px-3 py-2 text-amber-400 border-r border-amber-100 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 border-r border-amber-100">{p.pro_title}</td>
                        <td className="px-3 py-2 text-center text-slate-500 border-r border-amber-100 text-xs">{p.pro_unit || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold text-amber-700 border-r border-amber-100 tabular-nums">{formatQty(p._qty)}</td>
                        <td className="px-3 py-2 text-right text-slate-500 border-r border-amber-100 tabular-nums">{formatQty(threshold)}</td>
                        <td className="px-3 py-2 text-right font-bold text-red-600 border-r border-amber-100 tabular-nums">{formatQty(shortage)}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs border-r border-amber-100">{storeBreakdown}</td>
                        <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_baser_price)}</td>
                        <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_sale_price)}</td>
                        <td className="px-3 py-2 text-right text-slate-700 border-r border-amber-100 tabular-nums">{formatCurrency(p.pro_cost_price)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(p._qty * parseFloat(p.pro_cost_price || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-100 font-semibold text-amber-900">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase border-r border-amber-200">Category Total</td>
                    <td className="px-3 py-2 text-right tabular-nums border-r border-amber-200">{formatQty(catTotalQty)}</td>
                    <td colSpan={3} className="px-3 py-2 border-r border-amber-200"></td>
                    <td className="px-3 py-2 border-r border-amber-200"></td>
                    <td className="px-3 py-2 border-r border-amber-200"></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(catTotalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white overflow-hidden print:overflow-visible">

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-700 to-purple-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg"><Package className="w-6 h-6" /></div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Stock Report</h1>
                  <p className="text-purple-200 text-sm">All stock · Store wise · Low stock alerts</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={handleExport} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4 mr-2" /> CSV
              </button>
              <button onClick={handleDownloadPdf} disabled={!reportData} className="flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4 mr-2" /> PDF
              </button>
              <button onClick={openWhatsAppModal} disabled={!reportData} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                <Send className="w-4 h-4 mr-2" /> WhatsApp PDF
              </button>
              <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                <Printer className="w-4 h-4 mr-2" /> Print
              </button>
              {selectedCategory && (
                <button onClick={() => setShowAdjustmentModal(true)} className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors">
                  Adjust Prices
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden">
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Items</p>
              <p className="text-2xl font-bold text-slate-800">{formatNumber(summary.total)}</p>
            </div>
            <div className="bg-white border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-blue-600 uppercase">Total Qty</p>
              <p className="text-2xl font-bold text-blue-800">{formatQty(summary.totalQty)}</p>
            </div>
            <div className="bg-white border border-emerald-200 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-emerald-600 uppercase">Stock Value</p>
              <p className="text-lg font-bold text-emerald-800">Rs. {formatCurrency(summary.totalValue)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-amber-600 uppercase flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock</p>
              <p className="text-2xl font-bold text-amber-700">{summary.lowStock}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-xs font-semibold text-red-600 uppercase flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> Out of Stock</p>
              <p className="text-2xl font-bold text-red-700">{summary.outOfStock}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px] max-w-[220px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Category</label>
              <Autocomplete size="small" options={categories} getOptionLabel={(o) => o.cat_name || ''}
                value={categories.find(c => c.cat_id === parseInt(selectedCategory)) || null}
                onChange={(_, v) => setSelectedCategory(v ? v.cat_id.toString() : '')}
                autoHighlight openOnFocus
                renderInput={(params) => <TextField {...params} placeholder="All Categories" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: 'white' } }} />}
              />
            </div>
            <div className="flex-1 min-w-[180px] max-w-[220px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Store</label>
              <Autocomplete size="small" options={stores} getOptionLabel={(o) => o.store_name || ''}
                value={stores.find(s => s.storeid === parseInt(selectedStore)) || null}
                onChange={(_, v) => setSelectedStore(v ? v.storeid.toString() : '')}
                autoHighlight openOnFocus
                renderInput={(params) => <TextField {...params} placeholder="All Stores" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: 'white' } }} />}
              />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[280px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Search Item</label>
              <TextField fullWidth size="small" placeholder="Search by item name..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search className="w-4 h-4 text-slate-400" /></InputAdornment>, sx: { borderRadius: '8px', bgcolor: 'white' } }}
              />
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="flex items-center px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white print:hidden">
          <div className="flex">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                    ${isActive
                      ? 'border-purple-600 text-purple-700 bg-purple-50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {(tab.id === 'low-stock' || tab.id === 'low-stock-category') && summary?.lowStock > 0 && (
                    <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{summary.lowStock}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {reportData ? (
          <div className="flex-1 overflow-auto p-4 print:p-2 print:overflow-visible">
            <div className="max-w-[1500px] mx-auto">
              {loading && (
                <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading stock data...
                </div>
              )}
              {!loading && (
                <>
                  <ReportPageHeader
                    reportTitle={`STOCK REPORT — ${activeTabLabel().toUpperCase()}`}
                    metaLines={[
                      ...filterSummaryLines(),
                      `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
                    ]}
                  />
                  {activeTab === 'all' && renderAllStock()}
                  {activeTab === 'store-wise' && renderStoreWise()}
                  {activeTab === 'low-stock' && renderLowStock()}
                  {activeTab === 'low-stock-category' && renderLowStockByCategory()}
                  {activeTab === 'low-stock-store' && renderLowStockStoreWise()}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">Loading stock data...</p>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Share Modal */}
      <Dialog
        open={showWhatsAppModal}
        onClose={() => !whatsAppSending && setShowWhatsAppModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#ecfdf5', borderBottom: '2px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Send className="w-5 h-5" style={{ color: '#16a34a' }} />
          Send Stock Report to WhatsApp
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            This will generate a PDF of the current view
            (<strong>{activeTabLabel()}</strong>) using your selected filters and
            send it to the given WhatsApp number.
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
                  <Phone className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', p: 1.5, fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>Filters included</div>
            <div style={{ color: '#64748b' }}>
              {filterSummaryLines().length > 0
                ? filterSummaryLines().map((l, i) => <div key={i}>• {l}</div>)
                : <div>• No filters applied (sending all items)</div>}
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
            disabled={whatsAppSending || !whatsAppPhone.trim()}
            variant="contained"
            startIcon={whatsAppSending ? <CircularProgress size={16} color="inherit" /> : <Send className="w-4 h-4" />}
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
          >
            {whatsAppSending ? 'Sending...' : 'Send PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Price Adjustment Modal */}
      <Dialog open={showAdjustmentModal} onClose={() => !adjustmentLoading && setShowAdjustmentModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f5f3ff', borderBottom: '2px solid #e9d5ff' }}>
          Adjust Prices — {categories.find(c => c.cat_id === parseInt(selectedCategory))?.cat_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {adjustmentLoading ? (
            <Alert severity="info">Processing adjustment...</Alert>
          ) : (
            <>
              <TextField fullWidth label="Purchase % (e.g. 10 or -5)" type="number" inputProps={{ step: 0.1 }}
                value={purchasePercentage} onChange={(e) => setPurchasePercentage(e.target.value)} size="small" sx={{ mb: 2 }} />
              <TextField fullWidth label="Sale % (e.g. 15 or -8)" type="number" inputProps={{ step: 0.1 }}
                value={salePercentage} onChange={(e) => setSalePercentage(e.target.value)} size="small" sx={{ mb: 2 }} />
              <Alert severity="info" sx={{ fontSize: '0.78rem' }}>
                New Purchase Rate = Base × (1 + purchase%/100) &nbsp;|&nbsp; New Sale Price = Base × (1 + sale%/100)
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
          <Button onClick={() => { setShowAdjustmentModal(false); setPurchasePercentage(''); setSalePercentage(''); }} disabled={adjustmentLoading} variant="outlined">Cancel</Button>
          <Button onClick={applyPriceAdjustment} disabled={adjustmentLoading || (purchasePercentage === '' && salePercentage === '')} variant="contained" sx={{ bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}>
            {adjustmentLoading ? 'Updating...' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          .no-print { display: none !important; }
          body { font-size: 10px !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 9px !important; }
          th, td { padding: 4px 6px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          th { position: static !important; }
          tr { page-break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
