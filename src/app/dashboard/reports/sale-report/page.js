'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, Printer, Search, ShoppingCart, TrendingUp } from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table as MuiTable, TableBody as MuiTableBody, TableCell as MuiTableCell, TableContainer as MuiTableContainer, TableHead as MuiTableHead, TableRow as MuiTableRow, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SaleReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('');
  const [selectedBillType, setSelectedBillType] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  // Sale details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showFullFields, setShowFullFields] = useState(false);

  // Column sorting for main table
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  // Set default dates on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(2000, 0, 1).toISOString().split('T')[0]; // From year 2000
    setStartDate(yearAgo);
    setEndDate(today);
  }, []);

  // Auto-fetch report when dates are set
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchCategories(); fetchStores(); }, []);

  useEffect(() => {
    if (selectedCategory) { fetchAccountsByCategory(selectedCategory); }
    else { setAccounts([]); setSelectedAccount(''); }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/customer-category');
      const data = await response.json();
      if (response.ok) setCategories(data);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchAccountsByCategory = async (categoryId) => {
    try {
      const response = await fetch(`/api/customers?category=${categoryId}&dropdown=true`);
      const data = await response.json();
      if (response.ok) setAccounts(data);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      const result = await response.json();
      if (response.ok && result.success && Array.isArray(result.data)) {
        setStores(result.data);
      } else {
        console.error('Stores API did not return valid data:', result);
        setStores([]);
      }
    } catch (error) { 
      console.error('Error fetching stores:', error); 
      setStores([]);
    }
  };

  const fetchReport = async () => {
    if (!startDate || !endDate) { return; }
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=sale-report&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      if (response.ok) {
        let filteredData = { ...data };
        if (selectedCategory) {
          filteredData.sales = data.sales.filter(s => s.customer?.customer_category?.cus_cat_id === parseInt(selectedCategory));
        }
        if (selectedAccount) {
          filteredData.sales = filteredData.sales.filter(s => s.customer?.cus_id === parseInt(selectedAccount));
        }
        if (selectedStore) {
          filteredData.sales = filteredData.sales.filter(s => s.store_id === parseInt(selectedStore));
        }
        if (selectedPaymentType) {
          if (selectedPaymentType === 'CASH') {
            filteredData.sales = filteredData.sales.filter(s => s.payment_type === 'CASH');
          } else if (selectedPaymentType === 'BANK_TRANSFER') {
            filteredData.sales = filteredData.sales.filter(s => s.payment_type === 'BANK_TRANSFER');
          } else if (selectedPaymentType === 'CHEQUE') {
            filteredData.sales = filteredData.sales.filter(s => s.payment_type === 'CHEQUE');
          } else if (selectedPaymentType === 'SPLIT') {
            filteredData.sales = filteredData.sales.filter(s => 
              (s.cash_payment > 0 && s.bank_payment > 0) || s.split_payments?.length > 0
            );
          }
        }
        if (selectedBillType) {
          filteredData.sales = filteredData.sales.filter(s => s.bill_type === selectedBillType);
        }
        if (minAmount || maxAmount) {
          const min = parseFloat(minAmount) || 0;
          const max = parseFloat(maxAmount) || Infinity;
          filteredData.sales = filteredData.sales.filter(s => {
            const amount = parseFloat(s.total_amount || 0);
            return amount >= min && amount <= max;
          });
        }
        if (itemSearch) {
          const q = itemSearch.toLowerCase();
          filteredData.sales = filteredData.sales.filter(s =>
            s.sale_details && s.sale_details.some(d =>
              (d.product?.pro_title || d.product_name || '').toLowerCase().includes(q)
            )
          );
        }
        filteredData.summary = {
          totalSales: filteredData.sales.length,
          totalAmount: filteredData.sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
          totalDiscount: filteredData.sales.reduce((sum, s) => sum + parseFloat(s.discount || 0), 0),
          totalShipping: filteredData.sales.reduce((sum, s) => sum + parseFloat(s.shipping_amount || 0), 0),
          netTotal: filteredData.sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0) - parseFloat(s.discount || 0) + parseFloat(s.shipping_amount || 0), 0),
          totalReceived: filteredData.sales.reduce((sum, s) => sum + parseFloat(s.payment || 0), 0)
        };
        setReportData(filteredData);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
  };

  // Derived, sorted sales (client-side sorting)
  const sortSales = (arr) => {
    const copy = Array.isArray(arr) ? [...arr] : [];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (!sortBy) return 0;
      switch (sortBy) {
        case 'date':
          return dir * (new Date(a.created_at) - new Date(b.created_at));
        case 'sale_id':
          return dir * String(a.sale_id).localeCompare(String(b.sale_id), undefined, { numeric: true });
        case 'customer':
          return dir * ((a.customer?.cus_name || '').localeCompare(b.customer?.cus_name || ''));
        case 'items':
          return dir * ((a.sale_details?.length || 0) - (b.sale_details?.length || 0));
        case 'amount':
          return dir * ((parseFloat(a.total_amount) || 0) - (parseFloat(b.total_amount) || 0));
        case 'discount':
          return dir * ((parseFloat(a.discount) || 0) - (parseFloat(b.discount) || 0));
        case 'net': {
          const an = (parseFloat(a.total_amount) || 0) - (parseFloat(a.discount) || 0) + (parseFloat(a.shipping_amount) || 0);
          const bn = (parseFloat(b.total_amount) || 0) - (parseFloat(b.discount) || 0) + (parseFloat(b.shipping_amount) || 0);
          return dir * (an - bn);
        }
        case 'received':
          return dir * ((parseFloat(a.payment) || 0) - (parseFloat(b.payment) || 0));
        case 'balance': {
          const ab = ((parseFloat(a.total_amount) || 0) - (parseFloat(a.discount) || 0) + (parseFloat(a.shipping_amount) || 0)) - (parseFloat(a.payment) || 0);
          const bb = ((parseFloat(b.total_amount) || 0) - (parseFloat(b.discount) || 0) + (parseFloat(b.shipping_amount) || 0)) - (parseFloat(b.payment) || 0);
          return dir * (ab - bb);
        }
        default:
          return 0;
      }
    });
    return copy;
  };

  const sortedSales = useMemo(() => {
    return reportData?.sales ? sortSales(reportData.sales) : [];
  }, [reportData, sortBy, sortDir]);

  const handleExport = () => {
    if (!reportData) return;
    let csv = 'SALES REGISTER\n';
    csv += `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n\n`;
    csv += 'S.No,Date,Invoice No,Party Name,Type,Gross Amount,Discount,Shipping,Net Amount,Received,Balance\n';
    reportData.sales.forEach((s, i) => {
      const netTotal = parseFloat(s.total_amount || 0) - parseFloat(s.discount || 0) + parseFloat(s.shipping_amount || 0);
      const balance = netTotal - parseFloat(s.payment || 0);
      csv += `${i+1},${formatDate(s.created_at)},INV-${s.sale_id},${s.customer?.cus_name || '-'},${s.bill_type},${formatCurrency(s.total_amount)},${formatCurrency(s.discount)},${formatCurrency(s.shipping_amount)},${formatCurrency(netTotal)},${formatCurrency(s.payment)},${formatCurrency(balance)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-register-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const printSaleBill = (sale) => {
    if (!sale) return;
    const details = sale.sale_details || [];
    const itemsHtml = details.map((d, i) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd">${i + 1}</td>
        <td style="padding:6px;border:1px solid #ddd">${d.product?.pro_title || d.product_name || 'Item'}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${d.qnty || 0}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${fmtAmt(parseFloat(d.unit_rate) || 0)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${fmtAmt(parseFloat(d.total_amount) || 0)}</td>
      </tr>`).join('');

    const subtotal = parseFloat(sale.total_amount || 0) || 0;
    const discount = parseFloat(sale.discount || 0) || 0;
    const labour = parseFloat(sale.labour_charges || sale.labour || 0) || 0;
    const shipping = parseFloat(sale.shipping_amount || 0) || 0;
    const paid = Number.isFinite(Number(sale.payment)) ? parseFloat(sale.payment) || 0 : ((parseFloat(sale.cash_payment || 0) || 0) + (parseFloat(sale.bank_payment || 0) || 0) + (parseFloat(sale.advance_payment || 0) || 0));
    const prevBal = parseFloat(sale.previous_balance ?? sale.prev_balance ?? sale.previous_customer_balance ?? sale.customer?.cus_balance ?? 0) || 0;
    const totalQty = details.reduce((s, d) => s + (parseFloat(d.qnty || 0) || 0), 0);
    const netTotal = subtotal - discount + labour + shipping;

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Sale Invoice - ${sale.sale_id}</title>
          <style>
            @page { size: A5; margin: 10mm; }
            body{font-family:Arial,Helvetica,sans-serif;color:#000;padding:16px;font-weight:bold;}
            *, body, table, td, th, div, span, p { font-weight: bold !important; color: #000 !important; }
            .company{ text-align:center; margin-bottom:8px }
            table{ width:100%; border-collapse:collapse; margin-top:12px }
            th,td{ border:1px solid #000; padding:8px; font-weight:bold; }
            th{ background:#f3f4f6; text-align:left }
            .right{ text-align:right }
            .totals{ margin-top:12px; width:360px; float:right }
          </style>
        </head>
        <body>
          <div style="width:148mm;margin:0 auto">
          <div class="company">
            <h2 style="margin:0;font-size:20px">Ittefaq Iron and Cement Store</h2>
            <div>Parianwali</div>
            <div>Ph: 0346-7560306</div>
            <div style="margin-top:6px;font-weight:bold;font-size:18px">SALE INVOICE</div>
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:8px">
            <div>
              <div><strong>Invoice:</strong> ${sale.sale_id}</div>
              <div><strong>Date:</strong> ${new Date(sale.created_at).toLocaleString()}</div>
            </div>
            <div style="text-align:right">
              <div><strong>Customer:</strong> ${sale.customer?.cus_name || 'N/A'}</div>
              <div><strong>Phone:</strong> ${sale.customer?.cus_phone_no || ''}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S#</th>
                <th>Product</th>
                <th class="right">Qty</th>
                <th class="right">Rate</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-top:8px;text-align:right;font-weight:bold">Total Qty: ${fmtAmt(totalQty)}</div>

          <div class="totals">
            <table style="width:100%">
              <tr><td style="border:1px solid #ddd;padding:6px">Subtotal</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(subtotal)}</td></tr>
              <tr><td style="border:1px solid #ddd;padding:6px">Labour</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(labour)}</td></tr>
              <tr><td style="border:1px solid #ddd;padding:6px">Shipping</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(shipping)}</td></tr>
              ${ discount > 0 ? `<tr><td style="border:1px solid #ddd;padding:6px">Discount</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(discount)}</td></tr>` : '' }
              <tr><td style="border:1px solid #ddd;padding:6px">Previous Balance</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(prevBal)}</td></tr>
              <tr style="background:#f5f5f5"><th style="padding:6px">Grand Total</th><th style="padding:6px" class="right">${fmtAmt(netTotal)}</th></tr>
              <tr><td style="border:1px solid #ddd;padding:6px">Cash</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.cash_payment || 0) || 0)}</td></tr>
              ${ (parseFloat(sale.bank_payment || 0) || 0) > 0 ? `<tr><td style="border:1px solid #ddd;padding:6px">${sale.bank_title || 'Bank'}</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.bank_payment || 0) || 0)}</td></tr>` : '' }
              ${ (parseFloat(sale.advance_payment || 0) || 0) > 0 ? `<tr><td style="border:1px solid #ddd;padding:6px">Advance</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.advance_payment || 0) || 0)}</td></tr>` : '' }
              <tr style="background:#f5f5f5"><th style="padding:6px">Total Paid</th><th style="padding:6px" class="right">${fmtAmt(paid)}</th></tr>
              <tr style="background:#d0d0d0"><th style="padding:6px">Balance</th><th style="padding:6px" class="right">${fmtAmt(netTotal - paid)}</th></tr>
            </table>
          </div>

          <div style="clear:both;margin-top:80px">
            <div style="float:left;width:50%">
              <div>____________________</div>
              <div>Customer Signature</div>
            </div>
            <div style="float:right;width:50%;text-align:right">
              <div>____________________</div>
              <div>Authorized Signature</div>
            </div>
          </div>

          <div style="margin-top:30px;font-size:12px;color:#666">Notes: ${sale.notes || sale.reference || ''}</div>
          </div>
        </body>
      </html>`;

    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) { alert('Please allow popups to print the bill.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  // Normalize possible item keys so panel shows items regardless of API shape
  const selectedSaleItems = (selectedSale && (selectedSale.sale_details || selectedSale.details || selectedSale.items || selectedSale.sale_items)) || [];

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
        {/* Screen Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Sales Register</h1>
                  <p className="text-blue-200 text-sm">Customer-wise sales transactions</p>
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

        {/* Filters Bar */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">FROM DATE</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">CATEGORY</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">All Categories</option>
                {categories.map((cat) => (<option key={cat.cus_cat_id} value={cat.cus_cat_id}>{cat.cus_cat_title}</option>))}
              </select>
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">CUSTOMER</label>
              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} disabled={!selectedCategory}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed">
                <option value="">All Customers</option>
                {accounts.map((acc) => (<option key={acc.cus_id} value={acc.cus_id}>{acc.cus_name}</option>))}
              </select>
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">STORE</label>
              <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">All Stores</option>
                {(stores || []).map((store) => (<option key={store.storeid} value={store.storeid}>{store.store_name}</option>))}
              </select>
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors">
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">PAYMENT TYPE</label>
              <select value={selectedPaymentType} onChange={(e) => setSelectedPaymentType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">All Types</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="SPLIT">Split Payment</option>
              </select>
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">BILL TYPE</label>
              <select value={selectedBillType} onChange={(e) => setSelectedBillType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">All Types</option>
                <option value="QUOTATION">Quotation</option>
                <option value="ORDER">Order</option>
                <option value="BILL">Bill</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px] max-w-[140px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">MIN AMOUNT</label>
              <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[120px] max-w-[140px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">MAX AMOUNT</label>
              <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[160px] max-w-[220px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">SEARCH BY ITEM</label>
              <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Product name..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1"></div>
          </div>
        </div>

        {/* Report Content */}
          {reportData ? (
            <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
              <div className="max-w-[1400px] mx-auto">
              <ReportPageHeader
                reportTitle="SALES REGISTER"
                metaLines={[
                  `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`,
                  `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
                ]}
              />
              {/* Selected Sale Summary (shows when a sale is selected) */}
              {selectedSale && (
                <div className="mb-4 bg-white border border-slate-300 rounded-lg p-3 print:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold">Selected Sale Summary</h3>
                      <div className="text-sm text-slate-600">Invoice: INV-{selectedSale.sale_id}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => { setShowFullFields(s => !s); }} className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200">
                        {showFullFields ? 'Hide All Fields' : 'View All Fields'}
                      </button>
                      <button onClick={() => { setSelectedSale(null); setShowFullFields(false); }} className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200">Clear</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="w-1/2"><strong>Date:</strong> {new Date(selectedSale.created_at).toLocaleString()}</div>
                        <div className="w-1/2"><strong>Customer:</strong> {selectedSale.customer?.cus_name || '-'}</div>
                        <div className="w-1/2"><strong>Phone:</strong> {selectedSale.customer?.cus_phone_no || '-'}</div>
                        <div className="w-1/2"><strong>Bill Type:</strong> {selectedSale.bill_type || '-'}</div>
                        <div className="w-1/2"><strong>Gross:</strong> Rs. {formatCurrency(selectedSale.total_amount)}</div>
                        <div className="w-1/2"><strong>Discount:</strong> Rs. {formatCurrency(selectedSale.discount)}</div>
                        <div className="w-1/2"><strong>Shipping:</strong> Rs. {formatCurrency(selectedSale.shipping_amount)}</div>
                        <div className="w-1/2"><strong>Paid:</strong> Rs. {formatCurrency(selectedSale.payment)}</div>
                        <div className="w-1/2"><strong>Balance:</strong> Rs. {formatCurrency(parseFloat(selectedSale.total_amount || 0) - parseFloat(selectedSale.payment || 0))}</div>
                      </div>
                      {showFullFields && (
                        <pre className="mt-3 p-3 bg-slate-50 text-xs overflow-auto" style={{maxHeight: 240}}>{JSON.stringify(selectedSale, null, 2)}</pre>
                      )}
                    </div>

                    <div className="col-span-1">
                      <h4 className="text-sm font-semibold mb-2">Products</h4>
                      <div className="overflow-auto" style={{maxHeight: 220}}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="px-2 py-1 text-left text-xs font-semibold">S#</th>
                              <th className="px-2 py-1 text-left text-xs font-semibold">Product</th>
                              <th className="px-2 py-1 text-right text-xs font-semibold">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {((selectedSale.sale_details || selectedSale.details || selectedSale.items || selectedSale.sale_items) || []).map((d, i) => (
                              <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className="px-2 py-1">{i + 1}</td>
                                <td className="px-2 py-1">{d.product?.pro_title || d.product_name || '-'}</td>
                                <td className="px-2 py-1 text-right">{fmtAmt(parseFloat(d.qnty || 0) || 0)}</td>
                              </tr>
                            ))}
                            {(((selectedSale.sale_details || selectedSale.details || selectedSale.items || selectedSale.sale_items) || []).length === 0) && (
                              <tr><td colSpan="3" className="px-2 py-3 text-center text-slate-500">No items for this sale</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              

              {/* Print Summary */}
              <div className="hidden print:block mb-4 border border-black">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2 font-semibold border-r border-black">Total Invoices:</td>
                      <td className="p-2 text-right border-r border-black">{reportData.summary.totalSales}</td>
                      <td className="p-2 font-semibold border-r border-black">Gross Sales:</td>
                      <td className="p-2 text-right">{formatCurrency(reportData.summary.totalAmount)}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2 font-semibold border-r border-black">Total Discount:</td>
                      <td className="p-2 text-right border-r border-black">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="p-2 font-semibold border-r border-black">Shipping/Freight:</td>
                      <td className="p-2 text-right">{formatCurrency(reportData.summary.totalShipping)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-black">Net Sales:</td>
                      <td className="p-2 text-right border-r border-black font-bold">{formatCurrency(reportData.summary.netTotal)}</td>
                      <td className="p-2 font-semibold border-r border-black">Amount Received:</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(reportData.summary.totalReceived)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Main Table */}
              {selectedSale && (
                <div className="mb-4 bg-white border border-slate-300 rounded-lg p-3 print:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold">Sales Transactions</h3>
                      <div className="text-sm text-slate-600">Invoice: INV-{selectedSale.sale_id}</div>
                    </div>
                    <div>
                      <button onClick={() => setSelectedSale(null)} className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200">Clear</button>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="px-3 py-2 text-left text-xs font-semibold">S#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Product</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(selectedSale.sale_details || []).map((d, i) => (
                          <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                            <td className="px-3 py-2">{i + 1}</td>
                            <td className="px-3 py-2">{d.product?.pro_title || d.product_name || '-'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtAmt(parseFloat(d.qnty || 0) || 0)}</td>
                          </tr>
                        ))}
                        {(selectedSale.sale_details || []).length === 0 && (
                          <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-500">No items for this sale</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-300 rounded-lg overflow-hidden print:border-black print:rounded-none">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white print:bg-gray-200 print:text-black">
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">S.No</th>

                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('date')} className="flex items-center gap-2 focus:outline-none" aria-label="Sort by Date">
                          <span>Date</span>
                          <span className="text-xs opacity-70">{sortBy === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('sale_id')} className="flex items-center gap-2 focus:outline-none" aria-label="Sort by Invoice No">
                          <span>Invoice No</span>
                          <span className="text-xs opacity-70">{sortBy === 'sale_id' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('customer')} className="flex items-center gap-2 focus:outline-none" aria-label="Sort by Customer">
                          <span>Customer Name</span>
                          <span className="text-xs opacity-70">{sortBy === 'customer' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Items &amp; Qty</th>

                      <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Type</th>

                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('amount')} className="flex items-center justify-end gap-2 w-full focus:outline-none" aria-label="Sort by Gross Amount">
                          <span>Gross Amt</span>
                          <span className="text-xs opacity-70">{sortBy === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black hidden sm:table-cell">
                        <button onClick={() => toggleSort('discount')} className="flex items-center justify-end gap-2 w-full focus:outline-none" aria-label="Sort by Discount">
                          <span>Disc</span>
                          <span className="text-xs opacity-70">{sortBy === 'discount' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('net')} className="flex items-center justify-end gap-2 w-full focus:outline-none" aria-label="Sort by Net Amount">
                          <span>Net Amt</span>
                          <span className="text-xs opacity-70">{sortBy === 'net' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">
                        <button onClick={() => toggleSort('received')} className="flex items-center justify-end gap-2 w-full focus:outline-none" aria-label="Sort by Received">
                          <span>Received</span>
                          <span className="text-xs opacity-70">{sortBy === 'received' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">
                        <button onClick={() => toggleSort('balance')} className="flex items-center justify-end gap-2 w-full focus:outline-none" aria-label="Sort by Balance">
                          <span>Balance</span>
                          <span className="text-xs opacity-70">{sortBy === 'balance' ? (sortDir === 'asc' ? '▲' : '▼') : '▴▾'}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-black">
                        {sortedSales.map((sale, index) => {
                      const netTotal = (parseFloat(sale.total_amount || 0) || 0) - (parseFloat(sale.discount || 0) || 0) + (parseFloat(sale.shipping_amount || 0) || 0);
                      const balance = netTotal - (parseFloat(sale.payment || 0) || 0);
                      return (
                        <tr key={sale.sale_id} onClick={() => setSelectedSale(sale)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 print:bg-white transition-colors cursor-pointer`}>
                          <td className="px-3 py-2.5 text-slate-900 border-r border-slate-200 print:border-black">{index + 1}</td>
                          <td className="px-3 py-2.5 text-slate-900 border-r border-slate-200 print:border-black whitespace-nowrap">{formatDate(sale.created_at)}</td>
                          <td className="px-3 py-2.5 text-slate-600 border-r border-slate-200 print:border-black font-mono text-xs">INV-{sale.sale_id}</td>
                          <td className="px-3 py-2.5 text-slate-900 font-medium border-r border-slate-200 print:border-black">{sale.customer?.cus_name || '-'}</td>
                          <td className="px-3 py-2.5 border-r border-slate-200 print:border-black">
                            {(sale.sale_details || []).length === 0 ? (
                              <span className="text-slate-400 text-xs">—</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {sale.sale_details.map((d, i) => (
                                  <div key={i} className="flex items-center gap-1 text-xs">
                                    <span className="text-slate-700 font-medium truncate max-w-[140px]">{d.product?.pro_title || d.product_name || `Item ${i+1}`}</span>
                                    <span className="text-slate-400">×</span>
                                    <span className="text-slate-600 font-semibold tabular-nums whitespace-nowrap">{parseFloat(d.qnty || 0)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center border-r border-slate-200 print:border-black">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); setShowDetailsModal(true); }} className={`px-2 py-0.5 rounded text-xs font-medium ${sale.bill_type === 'Cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} print:bg-transparent print:text-black`}>
                              {sale.bill_type}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(sale.total_amount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(sale.discount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right font-semibold border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(netTotal)}</td>
                          <td className="px-3 py-2.5 text-emerald-700 text-right border-r border-slate-200 print:border-black print:text-black tabular-nums">{formatCurrency(sale.payment)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${balance > 0 ? 'text-red-600 print:text-black' : 'text-slate-900'}`}>{formatCurrency(balance)}</td>
                        </tr>
                      );
                    })}
                    {reportData.sales.length === 0 && (
                      <tr><td colSpan="11" className="px-6 py-12 text-center text-slate-500">No sales transactions found for the selected period</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold print:bg-gray-200 print:text-black">
                      <td colSpan="6" className="px-3 py-3 text-right uppercase text-xs tracking-wider border-r border-slate-600 print:border-black">Grand Total</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalAmount)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.netTotal)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalReceived)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(reportData.summary.netTotal - reportData.summary.totalReceived)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Print Footer */}
              <div className="hidden print:flex justify-between items-center mt-6 pt-4 border-t-2 border-black text-xs">
                <span>Generated: {new Date().toLocaleString('en-GB')}</span>
                <span className="font-semibold">Ittefaq Management System</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center print:hidden">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No Report Generated</h3>
              <p className="text-slate-500 mt-1">Select date range and click Generate Report to view data</p>
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
