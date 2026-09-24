'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Trash2,
  Package,
  Save,
  FilePlus,
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '../../components/dashboard-layout';
import DateFilterInput from '../../components/date-filter-input';
import ReportPageHeader from '../../components/report-page-header';
import {
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import { SO_THEME, SO_FIELD_SX, EXCEL, soBtn, soBtnPrimary, soBtnOutline } from '@/lib/super-order-theme';
import {
  formatSuperOrderQty,
  getStoreStock,
  buildSuperOrderGridRows,
  buildOrderLinesFromQtys,
  buildSuperOrderPayload,
  orderLinesFromPayload,
  orderQtysFromPayload,
  buildSuperOrderPdf,
  buildSuperOrderMetaLines,
} from '@/lib/super-order-utils';

export default function SuperOrderEditor({ orderId = null, viewOnly = false, autoPrint = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showOrderOnly, setShowOrderOnly] = useState(false);

  const [orderQtys, setOrderQtys] = useState({});
  const [supplierName, setSupplierName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderDate, setOrderDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
  );

  const [savedOrderId, setSavedOrderId] = useState(null);
  const [savedOrderNo, setSavedOrderNo] = useState('');
  const [loadedPayload, setLoadedPayload] = useState(null);
  const mountedRef = useRef(false);
  const loadedOrderKeyRef = useRef('');

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      const [reportRes, catRes, storeRes] = await Promise.all([
        fetch('/api/reports?type=stock-report'),
        fetch('/api/categories'),
        fetch('/api/stores'),
      ]);
      if (!mountedRef.current) return;
      const [reportData, catData, storeData] = await Promise.all([
        reportRes.json(),
        catRes.json(),
        storeRes.json(),
      ]);
      if (!mountedRef.current) return;
      if (reportRes.ok) setProducts(reportData.products || []);
      if (catRes.ok) setCategories(Array.isArray(catData) ? catData : []);
      if (storeRes.ok && storeData.success) setStores(storeData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    loadedOrderKeyRef.current = '';
  }, [orderId]);

  const applyLoadedOrder = useCallback((data, viewOnlyMode = false) => {
    const payload = data.payload || {};
    setSavedOrderId(data.super_order_id);
    setSavedOrderNo(data.order_no);
    setLoadedPayload(payload);
    setOrderDate(
      data.order_date
        ? new Date(data.order_date).toISOString().slice(0, 10)
        : payload.orderDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
    );
    setSupplierName(data.supplier_name || payload.supplierName || '');
    setOrderNotes(data.notes || payload.orderNotes || '');
    setSelectedStore(String(payload.selectedStore || data.store_id || ''));
    setSelectedCategory(String(payload.selectedCategory || ''));
    setStockFilter(payload.stockFilter || 'all');
    setOrderQtys(orderQtysFromPayload(payload));
    setShowOrderOnly(viewOnlyMode);
    return payload;
  }, []);

  useEffect(() => {
    if (!orderId || loading || products.length === 0) return;

    const loadKey = `${orderId}:${viewOnly}:${autoPrint}`;
    if (loadedOrderKeyRef.current === loadKey) return;

    let cancelled = false;
    let printTimer;

    (async () => {
      try {
        const res = await fetch(`/api/super-orders?id=${orderId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load order');
        if (cancelled || !mountedRef.current) return;
        applyLoadedOrder(data, viewOnly);
        loadedOrderKeyRef.current = loadKey;
        if (autoPrint) {
          printTimer = window.setTimeout(() => window.print(), 400);
        }
      } catch (e) {
        if (!cancelled && mountedRef.current) alert(e.message || 'Load failed');
      }
    })();

    return () => {
      cancelled = true;
      if (printTimer) window.clearTimeout(printTimer);
    };
  }, [orderId, loading, products.length, applyLoadedOrder, viewOnly, autoPrint]);

  const filteredProducts = useMemo(() => {
    let list = [...(Array.isArray(products) ? products : [])];
    if (selectedCategory) {
      list = list.filter((p) => p.cat_id === parseInt(String(selectedCategory), 10));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.pro_title?.toLowerCase().includes(q) ||
          p.category?.cat_name?.toLowerCase().includes(q) ||
          p.sub_category?.sub_cat_name?.toLowerCase().includes(q)
      );
    }
    if (stockFilter === 'low') {
      list = list.filter((p) => {
        const qty = getStoreStock(p, selectedStore);
        const threshold = p.low_stock_quantity ?? 10;
        return qty > 0 && qty <= threshold;
      });
    } else if (stockFilter === 'out') {
      list = list.filter((p) => getStoreStock(p, selectedStore) === 0);
    } else if (stockFilter === 'in') {
      list = list.filter((p) => {
        const qty = getStoreStock(p, selectedStore);
        const threshold = p.low_stock_quantity ?? 10;
        return qty > threshold;
      });
    }
    if (showOrderOnly) {
      list = list.filter((p) => (parseFloat(orderQtys[p.pro_id]) || 0) > 0);
    }
    return list.sort((a, b) => {
      const c = (a.category?.cat_name || '').localeCompare(b.category?.cat_name || '');
      if (c !== 0) return c;
      return (a.pro_title || '').localeCompare(b.pro_title || '');
    });
  }, [products, selectedCategory, searchQuery, stockFilter, selectedStore, showOrderOnly, orderQtys]);

  const superOrderGridRows = useMemo(
    () => buildSuperOrderGridRows(filteredProducts),
    [filteredProducts]
  );

  const orderLines = useMemo(() => {
    const live = buildOrderLinesFromQtys(products, orderQtys, selectedStore);
    if (live.length > 0) return live;
    if (loadedPayload) return orderLinesFromPayload(loadedPayload, products);
    return [];
  }, [products, orderQtys, selectedStore, loadedPayload]);

  const orderSummary = useMemo(
    () => ({
      lines: orderLines.length,
      totalQty: orderLines.reduce((s, r) => s + r.orderQty, 0),
    }),
    [orderLines]
  );

  const setOrderQty = (proId, value) => {
    setOrderQtys((prev) => {
      const next = { ...prev };
      const n = parseFloat(value);
      if (!value || Number.isNaN(n) || n <= 0) {
        delete next[proId];
      } else {
        next[proId] = value;
      }
      return next;
    });
  };

  const filterMetaLines = () =>
    buildSuperOrderMetaLines({
      orderDate,
      orderNo: savedOrderNo,
      supplierName,
      selectedCategory,
      categories,
      selectedStore,
      stores,
      orderNotes,
    });

  const handleDownloadPdf = () => {
    const doc = buildSuperOrderPdf({
      orderLines,
      orderSummary,
      metaLines: filterMetaLines(),
      orderNo: savedOrderNo,
    });
    if (!doc) {
      alert('Enter order quantities before downloading PDF.');
      return;
    }
    const slug = savedOrderNo || (supplierName.trim() ? supplierName.trim().replace(/\s+/g, '-') : 'super-order');
    doc.save(`${slug}-${orderDate}.pdf`);
  };

  const handlePrint = () => {
    if (orderLines.length === 0) {
      alert('Enter order quantities before printing.');
      return;
    }
    window.print();
  };

  const handleSave = async () => {
    if (orderLines.length === 0) {
      alert('Enter at least one order quantity before saving.');
      return;
    }

    let navigatedAway = false;
    try {
      setSaving(true);
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const payload = buildSuperOrderPayload({
        orderDate,
        supplierName,
        orderNotes,
        selectedStore,
        selectedCategory,
        stockFilter,
        orderQtys,
        orderLines,
      });

      const res = await fetch('/api/super-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          super_order_id: savedOrderId,
          order_date: orderDate,
          supplier_name: supplierName,
          notes: orderNotes,
          store_id: selectedStore || null,
          payload,
          total_lines: orderSummary.lines,
          total_qty: orderSummary.totalQty,
          updated_by: user?.user_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save order');

      if (!savedOrderId) {
        navigatedAway = true;
        alert(`Order saved as ${data.order_no}.`);
        window.location.assign(`/dashboard/super-order/${data.super_order_id}`);
        return;
      }

      if (!mountedRef.current) return;
      setSavedOrderId(data.super_order_id);
      setSavedOrderNo(data.order_no);
      setLoadedPayload(data.payload || payload);
      alert(`Order ${data.order_no} updated.`);
    } catch (e) {
      if (mountedRef.current) alert(e.message || 'Save failed');
    } finally {
      if (!navigatedAway && mountedRef.current) setSaving(false);
    }
  };

  const storeLabel = selectedStore
    ? stores.find((s) => String(s.storeid) === String(selectedStore))?.store_name || 'Selected store'
    : 'All stores (total stock)';

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden print:hidden" style={{ background: EXCEL.pageBg }}>
        {/* App header */}
        <div className="flex-shrink-0 px-3 md:px-4 pt-3 pb-2">
          <div
            className="rounded-xl overflow-hidden shadow-[0_2px_16px_rgba(26,85,227,0.15)]"
            style={{ background: SO_THEME.headerGradient }}
          >
            <div className="px-4 md:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  href="/dashboard/super-order"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors inline-flex"
                  title="Back to saved orders"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/15 text-white backdrop-blur-sm">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-white truncate">
                      {savedOrderNo ? savedOrderNo : 'New Super Order'}
                    </h1>
                    <p className="text-xs text-white/75 truncate">
                      {viewOnly ? 'View only' : savedOrderNo ? 'Edit order quantities — save, print & PDF' : 'Enter quantities and save'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard/super-order/new"
                  className={soBtn('bg-white/10 border-white/20 text-white hover:bg-white/20')}
                >
                  <FilePlus className="w-3.5 h-3.5" /> New Order
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || viewOnly}
                  className={soBtnPrimary('bg-[#00D284] hover:bg-[#00b872] disabled:opacity-60')}
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : savedOrderId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => setOrderQtys({})} className={soBtn('bg-white/10 border-white/20 text-white hover:bg-white/20')}>
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
                <button type="button" onClick={handlePrint} className={soBtn('bg-white text-slate-800 border-white hover:bg-slate-50')}>
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className={soBtnOutline('font-bold')}
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Excel workbook — toolbar + sheet */}
        <div className="flex-1 flex flex-col min-h-0 px-3 md:px-4 pb-3">
          <div className="excel-workbook flex flex-col flex-1 min-h-0 mx-auto max-w-[1600px] w-full">
            {/* Formula-bar style filters */}
            <div className="excel-toolbar flex-shrink-0">
              <div className="excel-toolbar-grid">
                <div className="excel-field excel-field-wide">
                  <label className="excel-field-label">Search</label>
                  <TextField fullWidth size="small" placeholder="Product or category..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={SO_FIELD_SX} />
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Category</label>
                  <FormControl fullWidth size="small" sx={SO_FIELD_SX}>
                    <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} displayEmpty>
                      <MenuItem value="">All</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.cat_id} value={String(c.cat_id)}>{c.cat_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Store</label>
                  <FormControl fullWidth size="small" sx={SO_FIELD_SX}>
                    <Select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} displayEmpty>
                      <MenuItem value="">All stores</MenuItem>
                      {stores.map((s) => (
                        <MenuItem key={s.storeid} value={String(s.storeid)}>{s.store_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Stock</label>
                  <FormControl fullWidth size="small" sx={SO_FIELD_SX}>
                    <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="out">Out</MenuItem>
                      <MenuItem value="in">In stock</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Date</label>
                  <DateFilterInput fullWidth size="small" value={orderDate} onChange={(val) => setOrderDate(val)} sx={SO_FIELD_SX} />
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Supplier</label>
                  <TextField fullWidth size="small" placeholder="Optional" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} sx={SO_FIELD_SX} />
                </div>
                <div className="excel-field">
                  <label className="excel-field-label">Notes</label>
                  <TextField fullWidth size="small" placeholder="Optional" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} sx={SO_FIELD_SX} />
                </div>
              </div>

              <div className="excel-status-bar">
                <div className="flex flex-wrap items-center gap-3">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={showOrderOnly}
                        onChange={(e) => setShowOrderOnly(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: EXCEL.qtyFocus },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: EXCEL.qtyFocus },
                        }}
                      />
                    }
                    label={<span className="text-[11px] font-semibold text-slate-700">Order lines only</span>}
                  />
                  <button type="button" onClick={fetchData} className="excel-link-btn">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh stock
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="excel-stat">{filteredProducts.length} rows</span>
                  <span className="excel-stat excel-stat-order">{orderSummary.lines} ordered · {formatSuperOrderQty(orderSummary.totalQty)} qty</span>
                  <span className="excel-stat excel-stat-muted">{storeLabel}</span>
                </div>
              </div>
            </div>

            {/* Spreadsheet grid */}
            <div className="excel-sheet flex-1 min-h-0 overflow-hidden">
              {loading ? (
                <div className="p-20 text-center">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-600">Loading spreadsheet...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-20 text-center">
                  <Package className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No rows match filters</p>
                </div>
              ) : (
                <div className="excel-scroll h-full overflow-auto">
                  <table className="excel-grid w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="excel-th excel-th-row text-center w-11">#</th>
                        <th className="excel-th w-[130px]">Category</th>
                        <th className="excel-th min-w-[260px]">Product Name</th>
                        <th className="excel-th w-[100px] text-right">In Stock</th>
                        <th className="excel-th excel-th-qty w-[110px] text-right">Order Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superOrderGridRows.map((row) => {
                        if (row.kind === 'category') {
                          return (
                            <tr key={row.key}>
                              <td colSpan={5} className="excel-category-row">{row.categoryName} ({row.count})</td>
                            </tr>
                          );
                        }
                        const p = row.product;
                        const stock = getStoreStock(p, selectedStore);
                        const threshold = p.low_stock_quantity ?? 10;
                        const isLow = stock > 0 && stock <= threshold;
                        const isOut = stock === 0;
                        const hasOrder = (parseFloat(orderQtys[p.pro_id]) || 0) > 0;
                        return (
                          <tr key={row.key} className={`excel-tr ${row.rowNum % 2 === 0 ? 'excel-tr-alt' : ''} ${hasOrder ? 'excel-tr-ordered' : ''}`}>
                            <td className="excel-td excel-td-num tabular-nums">{row.rowNum}</td>
                            <td className="excel-td text-slate-600">{row.categoryName}</td>
                            <td className="excel-td font-medium text-slate-900">{p.pro_title}</td>
                            <td className="excel-td text-right tabular-nums font-semibold excel-stock" data-out={isOut} data-low={isLow}>
                              {formatSuperOrderQty(stock)}
                            </td>
                            <td className="excel-td excel-td-qty p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={orderQtys[p.pro_id] ?? ''}
                                onChange={(e) => setOrderQty(p.pro_id, e.target.value)}
                                className="excel-cell-input"
                                placeholder=""
                                readOnly={viewOnly}
                                disabled={viewOnly}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-20">
                      <tr>
                        <td colSpan={3} className="excel-tf text-right font-bold">Total order quantity</td>
                        <td className="excel-tf" />
                        <td className="excel-tf excel-tf-total tabular-nums">{formatSuperOrderQty(orderSummary.totalQty)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print layout — order lines only, no In Stock */}
      <div id="printable-super-order" className="hidden print:block print:p-8">
        <ReportPageHeader
          reportTitle={savedOrderNo ? `SUPER ORDER — ${savedOrderNo}` : 'SUPER ORDER SHEET'}
          metaLines={filterMetaLines()}
        />
        {orderLines.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No order quantities entered.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1A55E3] text-white">
                <th className="border border-[#1347c4] px-2 py-1.5 text-left w-10">#</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-left">Category</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-left">Product</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-right w-28">Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((row, i) => (
                <tr key={row.product.pro_id}>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5">{row.product.category?.cat_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 font-semibold">{row.product.pro_title}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right font-bold tabular-nums">{formatSuperOrderQty(row.orderQty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100">
                <td colSpan={3} className="border border-slate-300 px-2 py-2 text-right font-bold">Total</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-bold tabular-nums">{formatSuperOrderQty(orderSummary.totalQty)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <style jsx global>{`
        .excel-field-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          margin-bottom: 3px;
          line-height: 1;
        }
        .excel-workbook {
          background: ${EXCEL.workbookBg};
          border: 1px solid ${EXCEL.borderDark};
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .excel-toolbar {
          background: linear-gradient(180deg, #fafafa 0%, #f3f3f3 100%);
          border-bottom: 1px solid ${EXCEL.borderDark};
        }
        .excel-toolbar-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 10px;
          padding: 10px 12px 8px;
        }
        @media (min-width: 768px) {
          .excel-toolbar-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (min-width: 1280px) {
          .excel-toolbar-grid { grid-template-columns: 2fr repeat(6, minmax(0, 1fr)); }
        }
        .excel-field-wide { grid-column: span 2; }
        @media (min-width: 1280px) {
          .excel-field-wide { grid-column: span 1; }
        }
        .excel-status-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 12px 8px;
          border-top: 1px solid ${EXCEL.border};
          background: #fff;
        }
        .excel-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #1A55E3;
        }
        .excel-link-btn:hover { color: #1347c4; text-decoration: underline; }
        .excel-stat {
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid ${EXCEL.border};
          border-radius: 2px;
          background: #fff;
          color: #333;
        }
        .excel-stat-order {
          background: ${EXCEL.categoryBg};
          border-color: ${EXCEL.categoryBorder};
          color: ${EXCEL.categoryText};
        }
        .excel-stat-muted { background: #f9f9f9; color: #666; }
        .excel-sheet { background: #fff; }
        .excel-scroll { max-height: calc(100vh - 300px); }
        .excel-grid { font-family: 'Segoe UI', Calibri, system-ui, sans-serif; }
        .excel-grid .excel-th {
          padding: 6px 8px;
          text-align: left;
          font-weight: 700;
          font-size: 11px;
          color: #fff;
          background: linear-gradient(180deg, #2b6cb0 0%, #1A55E3 100%);
          border: 1px solid #1347c4;
          border-top: none;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .excel-grid .excel-th-row { background: linear-gradient(180deg, #5a5a5a 0%, #404040 100%); border-color: #333; }
        .excel-grid .excel-th-qty { background: linear-gradient(180deg, #e6c200 0%, #d4a017 100%); border-color: #b8860b; color: #1a1a1a; }
        .excel-grid .excel-td {
          padding: 0 8px;
          height: 26px;
          border: 1px solid ${EXCEL.border};
          vertical-align: middle;
          background: #fff;
          line-height: 26px;
        }
        .excel-grid .excel-td-num {
          text-align: center;
          color: #666;
          font-size: 12px;
          background: ${EXCEL.rowHeaderBg};
          border-color: ${EXCEL.borderDark};
          font-weight: 600;
        }
        .excel-grid .excel-tr-alt .excel-td:not(.excel-td-num):not(.excel-td-qty) { background: ${EXCEL.rowAlt}; }
        .excel-grid .excel-tr:hover .excel-td:not(.excel-td-num) { background: ${EXCEL.rowHover}; }
        .excel-grid .excel-tr-ordered .excel-td:not(.excel-td-num) { background: #fff8e6; }
        .excel-grid .excel-tr-ordered .excel-td-qty { background: #fff3cd; }
        .excel-grid .excel-stock { color: #1a1a1a; }
        .excel-grid .excel-stock[data-out="true"] { color: #c00000; }
        .excel-grid .excel-stock[data-low="true"] { color: #bf360c; }
        .excel-category-row {
          padding: 4px 8px;
          height: 24px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: ${EXCEL.categoryText};
          background: ${EXCEL.categoryBg};
          border: 1px solid ${EXCEL.categoryBorder};
          border-top: none;
        }
        .excel-td-qty { background: ${EXCEL.qtyColBg} !important; }
        .excel-cell-input {
          width: 100%;
          height: 100%;
          min-height: 24px;
          padding: 0 8px;
          border: none;
          background: transparent;
          text-align: right;
          font-size: 13px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: ${EXCEL.gridText};
          outline: none;
          font-family: inherit;
        }
        .excel-cell-input:focus {
          box-shadow: inset 0 0 0 2px ${EXCEL.qtyFocus};
          background: #fff;
        }
        .excel-tf {
          padding: 6px 8px;
          border: 1px solid ${EXCEL.headerBorder};
          background: ${EXCEL.headerBg};
          font-size: 12px;
          font-weight: 700;
        }
        .excel-tf-total {
          text-align: right;
          color: ${EXCEL.qtyFocus};
          font-size: 13px;
        }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden; }
          #printable-super-order, #printable-super-order * { visibility: visible; }
          #printable-super-order { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
