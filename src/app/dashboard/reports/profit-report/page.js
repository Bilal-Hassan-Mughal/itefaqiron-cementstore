'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, Printer, Search, TrendingUp, TrendingDown, DollarSign, Percent, Users, ShoppingBag, Tag, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField } from '@mui/material';

const TABS = [
  { id: 'by-party',    label: 'By Party',    icon: Users },
  { id: 'by-bill',     label: 'By Bill',     icon: ShoppingBag },
  { id: 'by-product',  label: 'By Product',  icon: Package },
  { id: 'by-category', label: 'By Category', icon: Tag },
];

export default function ProfitReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [activeTab, setActiveTab] = useState('by-party');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    setStartDate(yearStart);
    setEndDate(today);
  }, []);

  useEffect(() => {
    if (startDate && endDate) fetchReport();
  }, [startDate, endDate]);

  useEffect(() => { fetchCategories(); fetchAllCustomers(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/customer-category');
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch {}
  };

  const fetchAllCustomers = async () => {
    try {
      const res = await fetch('/api/customers?dropdown=true');
      const data = await res.json();
      if (res.ok) setCustomers(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?type=profit-report&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (res.ok) setReportData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '-';
  const pct = (p, s) => s > 0 ? ((p / s) * 100).toFixed(1) + '%' : '0.0%';

  // ── filtered sales ────────────────────────────────────────────────────────
  const filteredSales = useMemo(() => {
    if (!reportData?.sales) return [];
    return reportData.sales.filter(s => {
      if (selectedCategory && s.customer?.customer_category?.cus_cat_id !== parseInt(selectedCategory)) return false;
      if (selectedCustomer && s.customer?.cus_id !== parseInt(selectedCustomer)) return false;
      return true;
    });
  }, [reportData, selectedCategory, selectedCustomer]);

  // ── summary totals from filtered sales ───────────────────────────────────
  const summary = useMemo(() => {
    const totalSales    = filteredSales.reduce((a, s) => a + (s.totalSale || 0), 0);
    const totalCost     = filteredSales.reduce((a, s) => a + (s.totalCost || 0), 0);
    const totalDiscount = filteredSales.reduce((a, s) => a + parseFloat(s.discount || 0), 0);
    const grossProfit   = totalSales - totalCost - totalDiscount;
    const totalExpenses = (reportData?.expenses || []).reduce((a, e) => a + parseFloat(e.exp_amount || 0), 0);
    const netProfit     = grossProfit - totalExpenses;
    return { totalSales, totalCost, totalDiscount, grossProfit, totalExpenses, netProfit,
      profitMargin: totalSales > 0 ? (grossProfit / totalSales * 100) : 0 };
  }, [filteredSales, reportData]);

  // ── by-party ──────────────────────────────────────────────────────────────
  const byParty = useMemo(() => {
    const map = {};
    filteredSales.forEach(s => {
      const id   = s.customer?.cus_id || 0;
      const name = s.customer?.cus_name || 'Walk-in Customer';
      const cat  = s.customer?.customer_category?.cus_cat_title || '-';
      if (!map[id]) map[id] = { id, name, cat, bills: 0, totalSale: 0, totalCost: 0, totalDiscount: 0, profit: 0 };
      map[id].bills++;
      map[id].totalSale     += s.totalSale || 0;
      map[id].totalCost     += s.totalCost || 0;
      map[id].totalDiscount += parseFloat(s.discount || 0);
      map[id].profit        += s.profit || 0;
    });
    return Object.values(map)
      .map(r => ({ ...r, margin: r.totalSale > 0 ? (r.profit / r.totalSale * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  // ── by-bill ───────────────────────────────────────────────────────────────
  const byBill = useMemo(() => {
    return filteredSales.map(s => ({
      saleId:       s.sale_id,
      date:         s.created_at,
      customer:     s.customer?.cus_name || 'Walk-in',
      billType:     s.bill_type || 'BILL',
      totalSale:    s.totalSale || 0,
      totalCost:    s.totalCost || 0,
      discount:     parseFloat(s.discount || 0),
      profit:       s.profit || 0,
      margin:       s.profitMargin || 0,
    }));
  }, [filteredSales]);

  // ── by-product ────────────────────────────────────────────────────────────
  const byProduct = useMemo(() => {
    const map = {};
    filteredSales.forEach(s => {
      const billDiscount = parseFloat(s.discount || 0);
      const billNetTotal = (s.sale_details || []).reduce((sum, d) => sum + parseFloat(d.net_total || d.total_amount || 0), 0);

      (s.sale_details || []).forEach(d => {
        const pid = d.product?.pro_id || d.pro_id || 0;
        const name = d.product?.pro_title || d.product?.pro_name || (pid ? `Product #${pid}` : 'Unlisted Item');
        const cat = d.product?.category?.cat_name || d.product?.sub_category?.sub_cat_name || '-';
        if (!map[pid]) map[pid] = { pid, name, cat, qty: 0, totalSale: 0, totalCost: 0, totalDiscount: 0, profit: 0 };

        const qnty = parseFloat(d.qnty || 0);
        const costPrice = parseFloat(d.product?.pro_cost_price || d.product?.pro_crate || d.product?.pro_baser_price || 0);
        const cost = costPrice * qnty;
        const sale = parseFloat(d.net_total || d.total_amount || 0);
        const allocatedBillDiscount = billNetTotal > 0 ? (sale / billNetTotal) * billDiscount : 0;
        const itemProfit = (sale - allocatedBillDiscount) - cost;

        map[pid].qty += qnty;
        map[pid].totalSale += sale;
        map[pid].totalCost += cost;
        map[pid].totalDiscount += allocatedBillDiscount;
        map[pid].profit += itemProfit;
      });
    });
    return Object.values(map)
      .map(r => ({ ...r, margin: r.totalSale > 0 ? (r.profit / r.totalSale * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  // ── by-category ───────────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = {};
    filteredSales.forEach(s => {
      const billDiscount = parseFloat(s.discount || 0);
      const billNetTotal = (s.sale_details || []).reduce((sum, d) => sum + parseFloat(d.net_total || d.total_amount || 0), 0);

      (s.sale_details || []).forEach(d => {
        const cid = d.product?.category?.cat_id || d.product?.cat_id || 0;
        const name = d.product?.category?.cat_name || d.product?.sub_category?.sub_cat_name || 'Uncategorized';
        if (!map[cid]) map[cid] = { cid, name, qty: 0, products: new Set(), totalSale: 0, totalCost: 0, totalDiscount: 0, profit: 0 };

        const qnty = parseFloat(d.qnty || 0);
        const costPrice = parseFloat(d.product?.pro_cost_price || d.product?.pro_crate || d.product?.pro_baser_price || 0);
        const cost = costPrice * qnty;
        const sale = parseFloat(d.net_total || d.total_amount || 0);
        const allocatedBillDiscount = billNetTotal > 0 ? (sale / billNetTotal) * billDiscount : 0;
        const itemProfit = (sale - allocatedBillDiscount) - cost;

        map[cid].qty += qnty;
        if (d.product?.pro_id || d.pro_id) map[cid].products.add(d.product?.pro_id || d.pro_id);
        map[cid].totalSale += sale;
        map[cid].totalCost += cost;
        map[cid].totalDiscount += allocatedBillDiscount;
        map[cid].profit += itemProfit;
      });
    });
    return Object.values(map)
      .map(r => ({ ...r, products: r.products.size, margin: r.totalSale > 0 ? (r.profit / r.totalSale * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSales]);

  // ── search filter for each tab ────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredByParty    = byParty.filter(r => r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q));
  const filteredByBill     = byBill.filter(r => r.customer.toLowerCase().includes(q) || String(r.saleId).includes(q));
  const filteredByProduct  = byProduct.filter(r => r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q));
  const filteredByCategory = byCategory.filter(r => r.name.toLowerCase().includes(q));

  const profitColor = (p) => p >= 0 ? 'text-emerald-600' : 'text-red-600';

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (!reportData) return;
    let csv = `PROFIT REPORT\nPeriod: ${fmtDate(startDate)} to ${fmtDate(endDate)}\n\n`;

    csv += 'PROFIT BY PARTY\n';
    csv += 'Customer,Category,Bills,Sale Amt,Cost,Discount,Profit,Margin\n';
    byParty.forEach(r => {
      csv += `${r.name},${r.cat},${r.bills},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.totalDiscount)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    csv += '\nPROFIT BY BILL\n';
    csv += 'S.No,Date,Customer,Type,Sale Amt,Cost,Discount,Profit,Margin\n';
    byBill.forEach((r, i) => {
      csv += `${i+1},${fmtDate(r.date)},${r.customer},${r.billType},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.discount)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    csv += '\nPROFIT BY PRODUCT\n';
    csv += 'Product,Category,Qty,Sale Amt,Cost,Profit,Margin\n';
    byProduct.forEach(r => {
      csv += `${r.name},${r.cat},${r.qty},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    csv += '\nPROFIT BY CATEGORY\n';
    csv += 'Category,Products,Qty,Sale Amt,Cost,Profit,Margin\n';
    byCategory.forEach(r => {
      csv += `${r.name},${r.products},${r.qty},${fmt(r.totalSale)},${fmt(r.totalCost)},${fmt(r.profit)},${r.margin.toFixed(1)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `profit-report-${startDate}-to-${endDate}.csv`; a.click();
  };

  const thCls = 'px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 last:border-r-0';
  const thRCls = 'px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 last:border-r-0';
  const tdCls  = 'px-3 py-2.5 border-r border-slate-200 last:border-r-0';
  const tdRCls = 'px-3 py-2.5 text-right tabular-nums border-r border-slate-200 last:border-r-0';

  const rowBg = (i) => i % 2 === 0 ? 'bg-white' : 'bg-slate-50';

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-teal-700 to-teal-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Profit Report</h1>
                  <p className="text-teal-200 text-sm">By Party · By Bill · By Product · By Category</p>
                </div>
              </div>
            </div>
            {reportData && (
              <div className="flex items-center space-x-2">
                <button onClick={handleExport} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
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
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">CUSTOMER CATEGORY</label>
              <Autocomplete size="small" options={categories}
                getOptionLabel={o => o.cus_cat_title || ''}
                value={categories.find(c => c.cus_cat_id === parseInt(selectedCategory)) || null}
                onChange={(_, v) => { setSelectedCategory(v ? String(v.cus_cat_id) : ''); setSelectedCustomer(''); }}
                renderInput={params => (
                  <TextField {...params} placeholder="All Categories"
                    sx={{ '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' } }} />
                )} />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">CUSTOMER</label>
              <Autocomplete size="small"
                options={selectedCategory ? customers.filter(c => c.cus_category === parseInt(selectedCategory)) : customers}
                getOptionLabel={o => o.cus_name || ''}
                value={customers.find(c => c.cus_id === parseInt(selectedCustomer)) || null}
                onChange={(_, v) => setSelectedCustomer(v ? String(v.cus_id) : '')}
                renderInput={params => (
                  <TextField {...params} placeholder="All Customers"
                    sx={{ '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' } }} />
                )} />
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-sm font-semibold transition-colors min-w-[140px]">
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {reportData ? (
          <div className="flex-1 overflow-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 print:hidden">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase">Sales Revenue</p>
                <p className="text-xl font-bold text-blue-800 mt-1">Rs. {fmt(summary.totalSales)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-600 uppercase">Cost of Goods</p>
                <p className="text-xl font-bold text-orange-800 mt-1">Rs. {fmt(summary.totalCost)}</p>
              </div>
              <div className={`bg-gradient-to-br ${summary.grossProfit >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-red-50 to-red-100 border-red-200'} border rounded-xl p-4`}>
                <p className={`text-xs font-semibold ${summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} uppercase`}>Gross Profit</p>
                <p className={`text-xl font-bold mt-1 ${summary.grossProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Rs. {fmt(summary.grossProfit)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-purple-600 uppercase">Profit Margin</p>
                <p className="text-xl font-bold text-purple-800 mt-1">{summary.profitMargin.toFixed(1)}%</p>
              </div>
            </div>

            {/* Tabs + Search */}
            <div className="px-4 print:hidden">
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex space-x-1">
                  {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                        className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors
                          ${activeTab === tab.id
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative pb-2">
                  <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..." className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-48" />
                </div>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block border-b-2 border-black pb-4 mb-4 px-4 pt-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold">ITTEFAQ IRON STORE</h1>
                <p className="text-sm text-gray-600">Parianwali, Pakistan</p>
                <div className="mt-2 py-2 bg-black text-white"><h2 className="text-lg font-bold">PROFIT REPORT</h2></div>
                <p className="mt-2 text-sm">Period: {fmtDate(startDate)} to {fmtDate(endDate)}</p>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 print:p-0">

              {/* BY PARTY */}
              {activeTab === 'by-party' && (
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Profit by Party (Customer)</h3>
                    <span className="text-slate-300 text-xs">{filteredByParty.length} customers</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Customer</th>
                          <th className={thCls}>Category</th>
                          <th className={thRCls}>Bills</th>
                          <th className={thRCls}>Sale Amount</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Discount</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByParty.map((r, i) => (
                          <tr key={r.id} className={`${rowBg(i)} hover:bg-teal-50 transition-colors`}>
                            <td className={tdCls}>{i + 1}</td>
                            <td className={`${tdCls} font-medium text-slate-900`}>{r.name}</td>
                            <td className={tdCls}><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{r.cat}</span></td>
                            <td className={tdRCls}>{r.bills}</td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td className={`${tdRCls} text-red-500`}>{fmt(r.totalDiscount)}</td>
                            <td className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}>{fmt(r.profit)}</td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                          </tr>
                        ))}
                        {filteredByParty.length === 0 && (
                          <tr><td colSpan="9" className="px-6 py-12 text-center text-slate-400">No data found</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td colSpan="4" className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600">Total</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalSales)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalCost)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalDiscount)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.grossProfit)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{summary.profitMargin.toFixed(1)}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* BY BILL */}
              {activeTab === 'by-bill' && (
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Profit by Bill / Invoice</h3>
                    <span className="text-slate-300 text-xs">{filteredByBill.length} invoices</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Date</th>
                          <th className={thCls}>Invoice</th>
                          <th className={thCls}>Customer</th>
                          <th className={thCls}>Type</th>
                          <th className={thRCls}>Sale Amt</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Discount</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByBill.map((r, i) => (
                          <tr key={r.saleId} className={`${rowBg(i)} hover:bg-teal-50 transition-colors`}>
                            <td className={tdCls}>{i + 1}</td>
                            <td className={`${tdCls} whitespace-nowrap`}>{fmtDate(r.date)}</td>
                            <td className={`${tdCls} font-mono font-semibold text-teal-700`}>#{r.saleId}</td>
                            <td className={`${tdCls} font-medium`}>{r.customer}</td>
                            <td className={tdCls}><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{r.billType}</span></td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td className={`${tdRCls} text-red-500`}>{fmt(r.discount)}</td>
                            <td className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}>{fmt(r.profit)}</td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                          </tr>
                        ))}
                        {filteredByBill.length === 0 && (
                          <tr><td colSpan="10" className="px-6 py-12 text-center text-slate-400">No data found</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td colSpan="5" className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600">Total</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalSales)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalCost)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.totalDiscount)}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(summary.grossProfit)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{summary.profitMargin.toFixed(1)}%</td>
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
                    <h3 className="text-sm font-bold uppercase tracking-wide">Profit by Product</h3>
                    <span className="text-slate-300 text-xs">{filteredByProduct.length} products</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Product</th>
                          <th className={thCls}>Category</th>
                          <th className={thRCls}>Qty Sold</th>
                          <th className={thRCls}>Sale Amount</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByProduct.map((r, i) => (
                          <tr key={r.pid} className={`${rowBg(i)} hover:bg-teal-50 transition-colors`}>
                            <td className={tdCls}>{i + 1}</td>
                            <td className={`${tdCls} font-medium text-slate-900`}>{r.name}</td>
                            <td className={tdCls}><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{r.cat}</span></td>
                            <td className={`${tdRCls} font-semibold`}>{r.qty.toLocaleString()}</td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}>{fmt(r.profit)}</td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                          </tr>
                        ))}
                        {filteredByProduct.length === 0 && (
                          <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-400">No data found</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td colSpan="3" className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600">Total</td>
                          <td className={`${tdRCls.replace('border-slate-200','border-slate-600')}`}>{filteredByProduct.reduce((a,r)=>a+r.qty,0).toLocaleString()}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByProduct.reduce((a,r)=>a+r.totalSale,0))}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByProduct.reduce((a,r)=>a+r.totalCost,0))}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByProduct.reduce((a,r)=>a+r.profit,0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {filteredByProduct.reduce((a,r)=>a+r.totalSale,0) > 0
                              ? ((filteredByProduct.reduce((a,r)=>a+r.profit,0) / filteredByProduct.reduce((a,r)=>a+r.totalSale,0)) * 100).toFixed(1)
                              : '0.0'}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* BY CATEGORY */}
              {activeTab === 'by-category' && (
                <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Profit by Product Category</h3>
                    <span className="text-slate-300 text-xs">{filteredByCategory.length} categories</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className={thCls}>#</th>
                          <th className={thCls}>Category</th>
                          <th className={thRCls}>Products</th>
                          <th className={thRCls}>Qty Sold</th>
                          <th className={thRCls}>Sale Amount</th>
                          <th className={thRCls}>Cost</th>
                          <th className={thRCls}>Profit</th>
                          <th className={thRCls}>Margin</th>
                          <th className={thRCls}>% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredByCategory.map((r, i) => (
                          <tr key={r.cid} className={`${rowBg(i)} hover:bg-teal-50 transition-colors`}>
                            <td className={tdCls}>{i + 1}</td>
                            <td className={`${tdCls} font-semibold text-slate-900`}>{r.name}</td>
                            <td className={tdRCls}>{r.products}</td>
                            <td className={tdRCls}>{r.qty.toLocaleString()}</td>
                            <td className={tdRCls}>{fmt(r.totalSale)}</td>
                            <td className={tdRCls}>{fmt(r.totalCost)}</td>
                            <td className={`${tdRCls} font-semibold ${profitColor(r.profit)}`}>{fmt(r.profit)}</td>
                            <td className={tdRCls}>{r.margin.toFixed(1)}%</td>
                            <td className={tdRCls}>{summary.grossProfit > 0 ? ((r.profit / summary.grossProfit) * 100).toFixed(1) : '0.0'}%</td>
                          </tr>
                        ))}
                        {filteredByCategory.length === 0 && (
                          <tr><td colSpan="9" className="px-6 py-12 text-center text-slate-400">No data found</td></tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800 text-white font-bold">
                          <td colSpan="3" className="px-3 py-3 text-right text-xs uppercase tracking-wider border-r border-slate-600">Total</td>
                          <td className={`${tdRCls.replace('border-slate-200','border-slate-600')}`}>{filteredByCategory.reduce((a,r)=>a+r.qty,0).toLocaleString()}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByCategory.reduce((a,r)=>a+r.totalSale,0))}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByCategory.reduce((a,r)=>a+r.totalCost,0))}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>{fmt(filteredByCategory.reduce((a,r)=>a+r.profit,0))}</td>
                          <td className={tdRCls.replace('border-slate-200','border-slate-600')}>
                            {filteredByCategory.reduce((a,r)=>a+r.totalSale,0) > 0
                              ? ((filteredByCategory.reduce((a,r)=>a+r.profit,0) / filteredByCategory.reduce((a,r)=>a+r.totalSale,0)) * 100).toFixed(1)
                              : '0.0'}%
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">100%</td>
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
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <TrendingUp className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-800">{loading ? 'Generating Report...' : 'No Report Generated'}</h3>
              {!loading && <p className="text-slate-500 mt-1">Select date range and click Generate Report</p>}
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
