'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Search, FileText, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import {
  Autocomplete, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress
} from '@mui/material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const getInvoiceNet = (bill) => {
  if (!bill) return 0;
  if (bill.display_net_total != null) return parseFloat(bill.display_net_total);
  return parseFloat(bill.total_amount || 0) + parseFloat(bill.unloading_amount || 0) + parseFloat(bill.transport_amount || 0) + parseFloat(bill.labour_amount || 0) + parseFloat(bill.fare_amount || 0) - parseFloat(bill.discount || 0);
};
const getInvoiceRemainingDue = (bill) => getInvoiceNet(bill) - parseFloat(bill?.payment || 0);
const getSupplierBalanceAfterBill = (bill) => {
  const prev = parseFloat(bill?.previous_customer_balance ?? bill?.customer?.cus_balance ?? 0);
  return Number((prev - getInvoiceRemainingDue(bill)).toFixed(2));
};

export default function PurchaseReport() {
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
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

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
      const response = await fetch(`/api/reports?type=purchase-report&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      if (response.ok) {
        let filteredData = { ...data };
        if (selectedCategory) {
          filteredData.purchases = data.purchases.filter(p => p.customer?.customer_category?.cus_cat_id === parseInt(selectedCategory));
        }
        if (selectedAccount) {
          filteredData.purchases = filteredData.purchases.filter(p => p.customer?.cus_id === parseInt(selectedAccount));
        }
        filteredData.summary = {
          totalPurchases: filteredData.purchases.length,
          totalAmount: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
          totalUnloading: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.unloading_amount || 0), 0),
          totalFare: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.fare_amount || 0), 0),
          totalDiscount: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.discount || 0), 0),
          netTotal: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.net_total || 0), 0),
          totalPaid: filteredData.purchases.reduce((sum, p) => sum + parseFloat(p.payment || 0), 0)
        };
        setReportData(filteredData);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const handleViewReceipt = async (purId) => {
    try {
      const res = await fetch(`/api/purchases?id=${purId}`);
      if (!res.ok) return;
      let data = await res.json();
      const productTotal = (data.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || 0), 0) || parseFloat(data.total_amount || 0);
      const calculatedNetTotal = productTotal + parseFloat(data.unloading_amount || 0) + parseFloat(data.transport_amount || 0) + parseFloat(data.labour_amount || 0) + parseFloat(data.fare_amount || 0) - parseFloat(data.discount || 0);
      let cashPayment = parseFloat(data.cash_payment || 0);
      let bankPayment = parseFloat(data.bank_payment || 0);
      if (cashPayment === 0 && bankPayment === 0 && parseFloat(data.payment || 0) > 0) {
        const totalPayment = parseFloat(data.payment || 0);
        if (data.payment_type === 'CASH') cashPayment = totalPayment;
        else if (data.payment_type === 'BANK_TRANSFER') bankPayment = totalPayment;
        else cashPayment = totalPayment;
      }
      setViewingPurchase({ ...data, display_net_total: calculatedNetTotal, cash_payment: cashPayment, bank_payment: bankPayment });
      setReceiptOpen(true);
    } catch (e) { console.error(e); }
  };

  const handlePrintPurchaseReceipt = (mode = 'A4') => {
    try {
      const isThermal = mode === 'THERMAL';
      const className = isThermal ? 'print-thermal' : 'print-a4';
      const containerId = isThermal ? 'printable-invoice-thermal-report' : 'printable-invoice-a4-report';
      const printableContainer = document.getElementById(containerId);
      if (!printableContainer) return;
      const preview = document.getElementById('purchase-invoice-report');
      if (preview) printableContainer.innerHTML = preview.innerHTML;
      printableContainer.style.position = 'fixed';
      printableContainer.style.left = '0'; printableContainer.style.top = '0';
      printableContainer.style.display = 'block'; printableContainer.style.zIndex = '9999';
      printableContainer.style.backgroundColor = 'white';
      const styleId = 'dynamic-print-style-report';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
      styleEl.textContent = isThermal ? `@media print { @page { size: 80mm portrait; margin: 0; } }` : `@media print { @page { size: A4; margin: 0.5cm 1cm; } }`;
      document.body.classList.add(className);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          printableContainer.style.position = ''; printableContainer.style.left = ''; printableContainer.style.top = '';
          printableContainer.style.display = 'none'; printableContainer.style.zIndex = ''; printableContainer.style.backgroundColor = '';
          document.body.classList.remove('print-thermal'); document.body.classList.remove('print-a4');
          if (styleEl) styleEl.remove();
        }, 100);
      }, 100);
    } catch (e) { console.error(e); window.print(); }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
  };

  const handleExport = () => {
    if (!reportData) return;
    let csv = 'PURCHASE REGISTER\n';
    csv += `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n\n`;
    csv += 'S.No,Date,Voucher No,Party Name,Gross Amount,Unloading,Fare,Discount,Net Amount,Paid,Balance\n';
    reportData.purchases.forEach((p, i) => {
      const balance = parseFloat(p.net_total || 0) - parseFloat(p.payment || 0);
      csv += `${i + 1},${formatDate(p.created_at)},PUR-${p.pur_id},${p.customer?.cus_name || '-'},${formatCurrency(p.total_amount)},${formatCurrency(p.unloading_amount)},${formatCurrency(p.fare_amount)},${formatCurrency(p.discount)},${formatCurrency(p.net_total)},${formatCurrency(p.payment)},${formatCurrency(balance)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-register-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
        {/* Screen Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Purchase Register</h1>
                  <p className="text-slate-300 text-sm">Supplier-wise purchase transactions</p>
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">FROM DATE</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 caps">CATEGORY</label>
              <Autocomplete
                size="small"
                options={categories}
                getOptionLabel={(option) => option.cus_cat_title || ''}
                value={categories.find(c => c.cus_cat_id === parseInt(selectedCategory)) || null}
                onChange={(e, val) => setSelectedCategory(val ? val.cus_cat_id.toString() : '')}
                autoSelect={true}
                autoHighlight={true}
                openOnFocus={true}
                selectOnFocus={true}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="All Categories"
                    onFocus={(e) => e.target.select()}
                    sx={{
                      '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' }
                    }}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 caps">PARTY</label>
              <Autocomplete
                size="small"
                disabled={!selectedCategory}
                options={accounts}
                getOptionLabel={(option) => option.cus_name || ''}
                value={accounts.find(a => a.cus_id === parseInt(selectedAccount)) || null}
                onChange={(e, val) => setSelectedAccount(val ? val.cus_id.toString() : '')}
                autoSelect={true}
                autoHighlight={true}
                openOnFocus={true}
                selectOnFocus={true}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="All Parties"
                    onFocus={(e) => e.target.select()}
                    sx={{
                      '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: selectedCategory ? 'white' : '#f1f5f9' }
                    }}
                  />
                )}
              />
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors min-w-[140px]">
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Report Content */}
        {reportData ? (
          <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
            <div className="max-w-[1400px] mx-auto">
              {/* Print Header */}
              <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
                <div className="text-center">
                  <h1 className="text-2xl font-bold tracking-wider">ITTEFAQ IRON STORE</h1>
                  <p className="text-sm text-gray-600">Parianwali, Pakistan | Tel: +92 346 7560306</p>
                  <div className="mt-3 py-2 bg-black text-white">
                    <h2 className="text-lg font-bold tracking-widest">PURCHASE REGISTER</h2>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Period:</span> {formatDate(startDate)} to {formatDate(endDate)}
                    {selectedCategory && categories.find(c => c.cus_cat_id === parseInt(selectedCategory)) &&
                      <span className="ml-4"><span className="font-semibold">Category:</span> {categories.find(c => c.cus_cat_id === parseInt(selectedCategory))?.cus_cat_title}</span>}
                  </p>
                </div>
              </div>

              {/* Summary Cards - Screen Only */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Purchases</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{reportData.summary.totalPurchases}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Gross Amount</p>
                  <p className="text-2xl font-bold text-blue-800 mt-1">Rs. {formatCurrency(reportData.summary.totalAmount)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Amount Paid</p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">Rs. {formatCurrency(reportData.summary.totalPaid)}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Balance Due</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">Rs. {formatCurrency(reportData.summary.netTotal - reportData.summary.totalPaid)}</p>
                </div>
              </div>

              {/* Print Summary */}
              <div className="hidden print:block mb-4 border border-black">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2 font-semibold border-r border-black">Total Purchases:</td>
                      <td className="p-2 text-right border-r border-black">{reportData.summary.totalPurchases}</td>
                      <td className="p-2 font-semibold border-r border-black">Gross Amount:</td>
                      <td className="p-2 text-right">{formatCurrency(reportData.summary.totalAmount)}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2 font-semibold border-r border-black">Unloading:</td>
                      <td className="p-2 text-right border-r border-black">{formatCurrency(reportData.summary.totalUnloading)}</td>
                      <td className="p-2 font-semibold border-r border-black">Fare/Freight:</td>
                      <td className="p-2 text-right">{formatCurrency(reportData.summary.totalFare)}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-2 font-semibold border-r border-black">Total Discount:</td>
                      <td className="p-2 text-right border-r border-black">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="p-2 font-semibold border-r border-black">Net Amount:</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(reportData.summary.netTotal)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-black">Amount Paid:</td>
                      <td className="p-2 text-right border-r border-black">{formatCurrency(reportData.summary.totalPaid)}</td>
                      <td className="p-2 font-semibold border-r border-black">Balance Due:</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(reportData.summary.netTotal - reportData.summary.totalPaid)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Main Table */}
              <div className="bg-white border border-slate-300 rounded-lg overflow-hidden print:border-black print:rounded-none">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white print:bg-gray-200 print:text-black">
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">S.No</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Vch No</th>
                      <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Party Name</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Gross Amt</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Unload</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Fare</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Disc</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Net Amt</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Paid</th>
                      <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-black">
                    {reportData.purchases.map((purchase, index) => {
                      const balance = parseFloat(purchase.net_total || 0) - parseFloat(purchase.payment || 0);
                      return (
                        <tr key={purchase.pur_id} onClick={() => handleViewReceipt(purchase.pur_id)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 print:bg-white transition-colors cursor-pointer`}>
                          <td className="px-3 py-2.5 text-slate-900 border-r border-slate-200 print:border-black">{index + 1}</td>
                          <td className="px-3 py-2.5 text-slate-900 border-r border-slate-200 print:border-black whitespace-nowrap">{formatDate(purchase.created_at)}</td>
                          <td className="px-3 py-2.5 text-slate-600 border-r border-slate-200 print:border-black font-mono text-xs">PUR-{purchase.pur_id}</td>
                          <td className="px-3 py-2.5 text-slate-900 font-medium border-r border-slate-200 print:border-black">{purchase.customer?.cus_name || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(purchase.total_amount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(purchase.unloading_amount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(purchase.fare_amount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(purchase.discount)}</td>
                          <td className="px-3 py-2.5 text-slate-900 text-right font-semibold border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(purchase.net_total)}</td>
                          <td className="px-3 py-2.5 text-emerald-700 text-right border-r border-slate-200 print:border-black print:text-black tabular-nums">{formatCurrency(purchase.payment)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${balance > 0 ? 'text-red-600 print:text-black' : 'text-slate-900'}`}>{formatCurrency(balance)}</td>
                        </tr>
                      );
                    })}
                    {reportData.purchases.length === 0 && (
                      <tr><td colSpan="11" className="px-6 py-12 text-center text-slate-500">No purchase transactions found for the selected period</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold print:bg-gray-200 print:text-black">
                      <td colSpan="4" className="px-3 py-3 text-right uppercase text-xs tracking-wider border-r border-slate-600 print:border-black">Grand Total</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalAmount)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalUnloading)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalFare)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.netTotal)}</td>
                      <td className="px-3 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalPaid)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(reportData.summary.netTotal - reportData.summary.totalPaid)}</td>
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
          body.print-a4 *, body.print-thermal * { visibility: hidden !important; }
          body.print-a4 #printable-invoice-a4-report, body.print-a4 #printable-invoice-a4-report * { visibility: visible !important; }
          body.print-thermal #printable-invoice-thermal-report, body.print-thermal #printable-invoice-thermal-report * { visibility: visible !important; }
          body.print-a4 #printable-invoice-a4-report { display: block !important; width: 100% !important; }
          body.print-thermal #printable-invoice-thermal-report {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Purchase Receipt Dialog */}
      <Dialog open={receiptOpen} onClose={() => { setReceiptOpen(false); setViewingPurchase(null); }} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2, boxShadow: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          Purchase Receipt - #{viewingPurchase?.pur_id}
        </DialogTitle>
        <DialogContent sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: '80vh', overflow: 'auto' }}>
          {viewingPurchase && (
            <Box id="purchase-invoice-report" sx={{ width: '100%', bgcolor: 'white', p: 3, mt: 2 }}>
              <Box sx={{ textAlign: 'center', py: 2, borderBottom: '2px solid #000' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>اتفاق آئرن اینڈ سیمنٹ سٹور</Typography>
                <Typography variant="body2" sx={{ mb: 1, direction: 'rtl' }}>گجرات سرگودھا روڈ، پاہڑیانوالی</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ color: '#25D366' }}>📞</Typography>
                  <Typography variant="body2">Ph:- 0346-7560306, 0300-7560306</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, mt: 1 }}>PURCHASE INVOICE</Typography>
              </Box>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Customer Name: <strong>{viewingPurchase.customer?.cus_name || 'N/A'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Phone No: <strong>{viewingPurchase.customer?.cus_phone_no || 'N/A'}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Address: <strong>{viewingPurchase.customer?.cus_address || 'N/A'}</strong></Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', flex: '0 0 50%' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Invoice No: <strong>#{viewingPurchase.pur_id}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Time: <strong>{new Date(viewingPurchase.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Date: <strong>{new Date(viewingPurchase.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong></Typography>
                  <Typography variant="body2">Bill Type: <strong>{viewingPurchase.bill_type || 'PURCHASE'}</strong></Typography>
                </Box>
              </Box>
              <Box sx={{ px: 3, py: 2 }}>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>S#</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }}>Product Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Qty</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Rate</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'white', py: 1, px: 1, border: '1px solid #bbb' }} align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(viewingPurchase.purchase_details || []).length > 0 ? (
                        <>
                          {viewingPurchase.purchase_details.map((detail, index) => (
                            <TableRow key={detail.pur_detail_id || index}>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{index + 1}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }}>{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{detail.qnty || 0}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.crate || detail.unit_rate || detail.rate || 0)}</TableCell>
                              <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right">{fmtAmt(detail.total_amount || detail.amount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} /><TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }}>Total</TableCell>
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(viewingPurchase.purchase_details || []).reduce((s, d) => s + parseFloat(d.qnty || 0), 0)}</TableCell>
                            <TableCell sx={{ px: 1, border: '1px solid #ddd' }} align="right" />
                            <TableCell sx={{ px: 1, fontWeight: 'bold', border: '1px solid #ddd' }} align="right">{(viewingPurchase.purchase_details || []).reduce((s, d) => s + parseFloat(d.total_amount || d.amount || 0), 0)}</TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No items found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Previous Balance</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(viewingPurchase.previous_customer_balance ?? viewingPurchase.customer?.cus_balance ?? 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Current Due</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(getInvoiceRemainingDue(viewingPurchase))}</TableCell></TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>Total Due</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>{fmtAmt(getSupplierBalanceAfterBill(viewingPurchase))}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {(parseFloat(viewingPurchase.out_labour_amount || 0) > 0 || parseFloat(viewingPurchase.out_delivery_amount || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000' }}>
                        <Table size="small">
                          <TableHead><TableRow sx={{ bgcolor: '#e3f2fd' }}><TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#1976d2' }}>Outer Cargo Charges</TableCell></TableRow></TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.out_labour_amount || 0) > 0 && <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Labour</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_labour_amount)}</TableCell></TableRow>}
                            {parseFloat(viewingPurchase.out_delivery_amount || 0) > 0 && <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Out Delivery</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.out_delivery_amount)}</TableCell></TableRow>}
                            <TableRow sx={{ bgcolor: '#e3f2fd' }}><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Outer Charges</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(parseFloat(viewingPurchase.out_labour_amount || 0) + parseFloat(viewingPurchase.out_delivery_amount || 0))}</TableCell></TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                    {(parseFloat(viewingPurchase.incity_own_labour || 0) > 0 || parseFloat(viewingPurchase.incity_own_delivery || 0) > 0) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000' }}>
                        <Table size="small">
                          <TableHead><TableRow sx={{ bgcolor: '#fff3e0' }}><TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'center', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem', color: '#e65100' }}>Incity Charges</TableCell></TableRow></TableHead>
                          <TableBody>
                            {parseFloat(viewingPurchase.incity_own_labour || 0) > 0 && <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Labour</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_labour)}</TableCell></TableRow>}
                            {parseFloat(viewingPurchase.incity_own_delivery || 0) > 0 && <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Incity Delivery</TableCell><TableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.incity_own_delivery)}</TableCell></TableRow>}
                            <TableRow sx={{ bgcolor: '#fff3e0' }}><TableCell sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Incity Charges</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(parseFloat(viewingPurchase.incity_own_labour || 0) + parseFloat(viewingPurchase.incity_own_delivery || 0))}</TableCell></TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 48%' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Bill Amount</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.total_amount || 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Labour</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.labour_amount || 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Transport</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.transport_amount || 0)}</TableCell></TableRow>
                          {parseFloat(viewingPurchase.discount || 0) > 0 && <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Discount</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>-{fmtAmt(viewingPurchase.discount || 0)}</TableCell></TableRow>}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Amount</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(getInvoiceNet(viewingPurchase))}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Cash</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.cash_payment || 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{`Bank Payment${viewingPurchase?.bank_title ? ' (' + viewingPurchase.bank_title + ')' : ''}`}</TableCell><TableCell align="right" sx={{ px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.bank_payment || 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Total Received</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(viewingPurchase.payment || 0)}</TableCell></TableRow>
                          <TableRow><TableCell sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>Remaining Due</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 1, border: '1px solid #ddd', fontSize: '0.875rem' }}>{fmtAmt(getInvoiceRemainingDue(viewingPurchase))}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <Box id="printable-invoice-a4-report" sx={{ width: '100%', bgcolor: 'white', display: 'none' }} />
        <Box id="printable-invoice-thermal-report" sx={{ width: '80mm', bgcolor: 'white', display: 'none', mx: 'auto', p: 1 }} />

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
          <Button onClick={() => { setReceiptOpen(false); setViewingPurchase(null); }} sx={{ textTransform: 'none' }}>Close</Button>
          <Button onClick={() => handlePrintPurchaseReceipt('A4')} sx={{ textTransform: 'none' }}>Print A4</Button>
          <Button onClick={() => handlePrintPurchaseReceipt('THERMAL')} sx={{ textTransform: 'none' }}>Print Thermal</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
