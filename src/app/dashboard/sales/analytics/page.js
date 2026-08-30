'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  Search,
  TrendingUp,
  ShoppingBag,
  Package,
  FileText,
  Percent,
  DollarSign,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField, Chip } from '@mui/material';

const TABS = [
  { id: 'by-bill',    label: 'Profit By Bill',    icon: ShoppingBag },
  { id: 'by-product', label: 'Profit By Product', icon: Package },
];

export default function SalesAnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedBills, setSelectedBills] = useState([]);
  const [billTypeFilter, setBillTypeFilter] = useState('ALL');

  const [activeTab, setActiveTab] = useState('by-bill');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];
    setStartDate(monthStart);
    setEndDate(today);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (startDate && endDate) fetchReport();
  }, [startDate, endDate]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?dropdown=true');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.products || [];
      setProducts(list);
    } catch (e) {
      console.error('Failed to load products', e);
    }
  };

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/reports?type=profit-report&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();
      if (res.ok) setReportData(data);
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    (parseFloat(n) || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '-';

  const selectedProductIds = useMemo(
    () => new Set(selectedProducts.map((p) => p.pro_id)),
    [selectedProducts]
  );
  const selectedBillIds = useMemo(
    () => new Set(selectedBills.map((b) => b.sale_id)),
    [selectedBills]
  );

  const filteredSales = useMemo(() => {
    if (!reportData?.sales) return [];
    return reportData.sales.filter((s) => {
      if (billTypeFilter !== 'ALL' && (s.bill_type || 'BILL') !== billTypeFilter) return false;
      if (selectedBillIds.size > 0 && !selectedBillIds.has(s.sale_id)) return false;
      if (selectedProductIds.size > 0) {
        const hasAny = (s.sale_details || []).some((d) =>
          selectedProductIds.has(d.product?.pro_id || d.pro_id)
        );
        if (!hasAny) return false;
      }
      return true;
    });
  }, [reportData, billTypeFilter, selectedBillIds, selectedProductIds]);

  const billOptions = useMemo(() => {
    if (!reportData?.sales) return [];
    return reportData.sales
      .map((s) => ({
        sale_id: s.sale_id,
        cus_name: s.customer?.cus_name || 'Walk-in',
        created_at: s.created_at,
        bill_type: s.bill_type || 'BILL',
      }))
      .sort((a, b) => b.sale_id - a.sale_id);
  }, [reportData]);

  const byBill = useMemo(() => {
    return filteredSales.map((s) => {
      const details = s.sale_details || [];
      let lineSale = 0;
      let lineCost = 0;
      details.forEach((d) => {
        if (selectedProductIds.size > 0 && !selectedProductIds.has(d.product?.pro_id || d.pro_id))
          return;
        const qty = parseFloat(d.qnty || 0);
        const cost = parseFloat(d.product?.pro_cost_price || 0) * qty;
        const sale = parseFloat(d.net_total || 0);
        lineSale += sale;
        lineCost += cost;
      });

      const totalSale = selectedProductIds.size > 0 ? lineSale : s.totalSale || 0;
      const totalCost = selectedProductIds.size > 0 ? lineCost : s.totalCost || 0;
      const billDiscount = selectedProductIds.size > 0 ? 0 : parseFloat(s.discount || 0);
      const profit = totalSale - totalCost - billDiscount;
      const margin = totalSale > 0 ? (profit / totalSale) * 100 : 0;

      return {
        saleId: s.sale_id,
        date: s.created_at,
        customer: s.customer?.cus_name || 'Walk-in',
        billType: s.bill_type || 'BILL',
        items: details.length,
        totalSale,
        totalCost,
        discount: billDiscount,
        profit,
        margin,
      };
    });
  }, [filteredSales, selectedProductIds]);

  const byProduct = useMemo(() => {
    const map = {};
    filteredSales.forEach((s) => {
      (s.sale_details || []).forEach((d) => {
        const pid = d.product?.pro_id || d.pro_id || 0;
        if (selectedProductIds.size > 0 && !selectedProductIds.has(pid)) return;
        const name = d.product?.pro_title || d.product?.pro_name || 'Unknown';
        const cat = d.product?.category?.cat_name || '-';
        const unit = d.product?.pro_unit || d.unit || '';
        const qty = parseFloat(d.qnty || 0);
        const cost = parseFloat(d.product?.pro_cost_price || 0) * qty;
        const sale = parseFloat(d.net_total || 0);
        if (!map[pid]) {
          map[pid] = {
            pid,
            name,
            cat,
            unit,
            qty: 0,
            bills: new Set(),
            totalSale: 0,
            totalCost: 0,
            profit: 0,
          };
        }
        map[pid].qty += qty;
        map[pid].bills.add(s.sale_id);
        map[pid].totalSale += sale;
        map[pid].totalCost += cost;
        map[pid].profit += sale - cost;
      });
    });
    return Object.values(map)
      .map((r) => ({
        ...r,
        bills: r.bills.size,
        margin: r.totalSale > 0 ? (r.profit / r.totalSale) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales, selectedProductIds]);

  const summary = useMemo(() => {
    const totalSales = byBill.reduce((a, r) => a + (r.totalSale || 0), 0);
    const totalCost = byBill.reduce((a, r) => a + (r.totalCost || 0), 0);
    const totalDiscount = byBill.reduce((a, r) => a + (r.discount || 0), 0);
    const grossProfit = totalSales - totalCost - totalDiscount;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    const totalQty = byProduct.reduce((a, r) => a + (r.qty || 0), 0);
    return {
      bills: byBill.length,
      products: byProduct.length,
      totalQty,
      totalSales,
      totalCost,
      totalDiscount,
      grossProfit,
      profitMargin,
    };
  }, [byBill, byProduct]);

  const q = search.toLowerCase();
  const filteredByBill = byBill.filter(
    (r) =>
      r.customer.toLowerCase().includes(q) ||
      String(r.saleId).includes(q) ||
      r.billType.toLowerCase().includes(q)
  );
  const filteredByProduct = byProduct.filter(
    (r) => r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q)
  );

  const profitColor = (p) => (p >= 0 ? 'text-emerald-600' : 'text-red-600');

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (!reportData) return;
    let csv = `SALES ANALYTICS\nPeriod: ${fmtDate(startDate)} to ${fmtDate(endDate)}\n`;
    if (selectedProducts.length > 0)
      csv += `Products Filter: ${selectedProducts.map((p) => p.pro_title).join('; ')}\n`;
    if (selectedBills.length > 0)
      csv += `Bills Filter: ${selectedBills.map((b) => '#' + b.sale_id).join('; ')}\n`;
    if (billTypeFilter !== 'ALL') csv += `Bill Type: ${billTypeFilter}\n`;
    csv += '\n';

    csv += 'PROFIT BY BILL\n';
    csv += 'S.No,Bill #,Date,Customer,Type,Items,Sale Amt,Cost,Discount,Profit,Margin\n';
    byBill.forEach((r, i) => {
      csv += `${i + 1},#${r.saleId},${fmtDate(r.date)},"${r.customer}",${r.billType},${r.items},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.discount)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    csv += '\nPROFIT BY PRODUCT\n';
    csv += 'S.No,Product,Category,Unit,Bills,Qty Sold,Sale Amt,Cost,Profit,Margin\n';
    byProduct.forEach((r, i) => {
      csv += `${i + 1},"${r.name}",${r.cat},${r.unit},${r.bills},${r.qty},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    csv += '\nSUMMARY\n';
    csv += `Total Bills,${summary.bills}\n`;
    csv += `Total Products,${summary.products}\n`;
    csv += `Total Qty,${summary.totalQty}\n`;
    csv += `Sale Amount,${fmt(summary.totalSales)}\n`;
    csv += `Cost,${fmt(summary.totalCost)}\n`;
    csv += `Discount,${fmt(summary.totalDiscount)}\n`;
    csv += `Gross Profit,${fmt(summary.grossProfit)}\n`;
    csv += `Profit Margin,${summary.profitMargin.toFixed(1)}%\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-analytics-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const thCls =
    'px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 last:border-r-0';
  const thRCls =
    'px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 last:border-r-0';
  const tdCls = 'px-3 py-2.5 border-r border-slate-200 last:border-r-0';
  const tdRCls =
    'px-3 py-2.5 text-right tabular-nums border-r border-slate-200 last:border-r-0';
  const rowBg = (i) => (i % 2 === 0 ? 'bg-white' : 'bg-slate-50');

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/sales')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Sales Analytics</h1>
                  <p className="text-indigo-200 text-sm">
                    Profit analysis by bill & product · Filter by date, product & bill #
                  </p>
                </div>
              </div>
            </div>
            {reportData && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4 mr-2" /> Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">FROM DATE</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">BILL TYPE</label>
              <select
                value={billTypeFilter}
                onChange={(e) => setBillTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Types</option>
                <option value="BILL">BILL</option>
                <option value="QUOTATION">QUOTATION</option>
                <option value="ORDER">ORDER</option>
                <option value="ORDER_TRASH">ORDER (TRASH)</option>
              </select>
            </div>
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">PRODUCTS</label>
              <Autocomplete
                multiple
                size="small"
                options={products}
                value={selectedProducts}
                onChange={(_, v) => setSelectedProducts(v)}
                getOptionLabel={(o) => o.pro_title || ''}
                isOptionEqualToValue={(o, v) => o.pro_id === v.pro_id}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      size="small"
                      label={option.pro_title}
                      {...getTagProps({ index })}
                      key={option.pro_id}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={selectedProducts.length === 0 ? 'All Products' : ''}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        py: '2px',
                        borderRadius: '8px',
                        bgcolor: 'white',
                      },
                    }}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">BILL #</label>
              <Autocomplete
                multiple
                size="small"
                options={billOptions}
                value={selectedBills}
                onChange={(_, v) => setSelectedBills(v)}
                getOptionLabel={(o) => o.cus_name}
                isOptionEqualToValue={(o, v) => o.sale_id === v.sale_id}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      size="small"
                      label={`#${option.sale_id}`}
                      {...getTagProps({ index })}
                      key={option.sale_id}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={selectedBills.length === 0 ? 'All Bills' : ''}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        py: '2px',
                        borderRadius: '8px',
                        bgcolor: 'white',
                      },
                    }}
                  />
                )}
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors min-w-[140px]"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            {(selectedProducts.length > 0 ||
              selectedBills.length > 0 ||
              billTypeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSelectedProducts([]);
                  setSelectedBills([]);
                  setBillTypeFilter('ALL');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {reportData ? (
          <div className="flex-1 overflow-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 print:hidden">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Bills</p>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xl font-bold text-slate-800 mt-1">{summary.bills}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {summary.products} products · {fmt(summary.totalQty)} qty
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Sales Revenue</p>
                  <DollarSign className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xl font-bold text-blue-800 mt-1">Rs. {fmt(summary.totalSales)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-orange-600 uppercase">Cost of Goods</p>
                  <Package className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-xl font-bold text-orange-800 mt-1">Rs. {fmt(summary.totalCost)}</p>
                <p className="text-[11px] text-orange-600 mt-0.5">
                  Disc: Rs. {fmt(summary.totalDiscount)}
                </p>
              </div>
              <div
                className={`bg-gradient-to-br ${
                  summary.grossProfit >= 0
                    ? 'from-emerald-50 to-emerald-100 border-emerald-200'
                    : 'from-red-50 to-red-100 border-red-200'
                } border rounded-xl p-4`}
              >
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs font-semibold uppercase ${
                      summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    Gross Profit
                  </p>
                  <TrendingUp
                    className={`w-4 h-4 ${
                      summary.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  />
                </div>
                <p
                  className={`text-xl font-bold mt-1 ${
                    summary.grossProfit >= 0 ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  Rs. {fmt(summary.grossProfit)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-purple-600 uppercase">Profit Margin</p>
                  <Percent className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xl font-bold text-purple-800 mt-1">
                  {summary.profitMargin.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Tabs + Search */}
            <div className="px-4 print:hidden">
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex space-x-1">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setSearch('');
                        }}
                        className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-indigo-600 text-indigo-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative pb-2">
                  <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-48"
                  />
                </div>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block border-b-2 border-black pb-4 mb-4 px-4 pt-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold">ITTEFAQ IRON STORE</h1>
                <p className="text-sm text-gray-600">Parianwali, Pakistan</p>
                <div className="mt-2 py-2 bg-black text-white">
                  <h2 className="text-lg font-bold">SALES ANALYTICS</h2>
                </div>
                <p className="mt-2 text-sm">
                  Period: {fmtDate(startDate)} to {fmtDate(endDate)}
                </p>
                {selectedProducts.length > 0 && (
                  <p className="text-xs mt-1">
                    Products: {selectedProducts.map((p) => p.pro_title).join(', ')}
                  </p>
                )}
                {selectedBills.length > 0 && (
                  <p className="text-xs mt-1">
                    Bills: {selectedBills.map((b) => '#' + b.sale_id).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 print:p-0">
              {/* BY BILL */}
              {activeTab === 'by-bill' && (
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Profit by Bill</h3>
                    <span className="text-slate-300 text-xs">
                      {filteredByBill.length} invoices
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Bill #</th>
                          <th className={thCls}>Date</th>
                          <th className={thCls}>Customer</th>
                          <th className={thCls}>Type</th>
                          <th className={thRCls}>Items</th>
                          <th className={thRCls}>Sale Amt</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Discount</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByBill.map((r, i) => (
                          <tr
                            key={r.saleId}
                            className={`${rowBg(i)} hover:bg-indigo-50 transition-colors`}
                          >
                            <td className={tdCls}>{i + 1}</td>
                            <td
                              className={`${tdCls} font-mono font-semibold text-indigo-700`}
                            >
                              #{r.saleId}
                            </td>
                            <td className={`${tdCls} whitespace-nowrap`}>{fmtDate(r.date)}</td>
                            <td className={`${tdCls} font-medium`}>{r.customer}</td>
                            <td className={tdCls}>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                {r.billType}
                              </span>
                            </td>
                            <td className={tdRCls}>{r.items}</td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td className={`${tdRCls} text-red-500`}>{fmt(r.discount)}</td>
                            <td
                              className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}
                            >
                              {fmt(r.profit)}
                            </td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                          </tr>
                        ))}
                        {filteredByBill.length === 0 && (
                          <tr>
                            <td
                              colSpan="11"
                              className="px-6 py-12 text-center text-slate-400"
                            >
                              No bills found for the selected filters
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td
                            colSpan="6"
                            className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600"
                          >
                            Total
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(summary.totalSales)}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(summary.totalCost)}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(summary.totalDiscount)}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(summary.grossProfit)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {summary.profitMargin.toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* BY PRODUCT */}
              {activeTab === 'by-product' && (
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">
                      Profit by Product
                    </h3>
                    <span className="text-slate-300 text-xs">
                      {filteredByProduct.length} products
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Product</th>
                          <th className={thCls}>Category</th>
                          <th className={thCls}>Unit</th>
                          <th className={thRCls}>Bills</th>
                          <th className={thRCls}>Qty Sold</th>
                          <th className={thRCls}>Sale Amount</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByProduct.map((r, i) => (
                          <tr
                            key={r.pid}
                            className={`${rowBg(i)} hover:bg-indigo-50 transition-colors`}
                          >
                            <td className={tdCls}>{i + 1}</td>
                            <td className={`${tdCls} font-medium text-slate-900`}>
                              {r.name}
                            </td>
                            <td className={tdCls}>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                                {r.cat}
                              </span>
                            </td>
                            <td className={tdCls}>{r.unit}</td>
                            <td className={tdRCls}>{r.bills}</td>
                            <td className={`${tdRCls} font-semibold`}>
                              {r.qty.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                            </td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td
                              className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}
                            >
                              {fmt(r.profit)}
                            </td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                          </tr>
                        ))}
                        {filteredByProduct.length === 0 && (
                          <tr>
                            <td
                              colSpan="10"
                              className="px-6 py-12 text-center text-slate-400"
                            >
                              No products found for the selected filters
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td
                            colSpan="4"
                            className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600"
                          >
                            Total
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {byProduct.reduce((a, r) => a + r.bills, 0)}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {byProduct
                              .reduce((a, r) => a + r.qty, 0)
                              .toLocaleString('en-PK', { maximumFractionDigits: 2 })}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(byProduct.reduce((a, r) => a + r.totalSale, 0))}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(byProduct.reduce((a, r) => a + r.totalCost, 0))}
                          </td>
                          <td
                            className={tdRCls.replace(
                              'border-slate-200',
                              'border-slate-600'
                            )}
                          >
                            {fmt(byProduct.reduce((a, r) => a + r.profit, 0))}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {(() => {
                              const s = byProduct.reduce((a, r) => a + r.totalSale, 0);
                              const p = byProduct.reduce((a, r) => a + r.profit, 0);
                              return s > 0 ? ((p / s) * 100).toFixed(1) : '0.0';
                            })()}
                            %
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center print:hidden">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {loading ? (
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <TrendingUp className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                {loading ? 'Crunching numbers...' : 'No Analytics Data'}
              </h3>
              {!loading && (
                <p className="text-slate-500 mt-1">Select a date range to generate analytics</p>
              )}
            </div>
          </div>
        )}
      </div>

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
