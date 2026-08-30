'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Search, ShoppingBag, Package, Truck, CreditCard, Clock, Eye, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';

export default function OrderReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [viewBillDialog, setViewBillDialog] = useState(false);

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

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => {
    if (selectedCategory) { fetchAccountsByCategory(selectedCategory); }
    else { setAccounts([]); setSelectedAccount(''); }
  }, [selectedCategory]);

  const handleViewBill = async (order) => {
    try {
      const response = await fetch(`/api/sales?id=${order.sale_id}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setSelectedBill(data);
      setViewBillDialog(true);
    } catch (error) {
      console.error('Error fetching order details:', error);
      setSelectedBill(order);
      setViewBillDialog(true);
    }
  };

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

  const fetchReport = async () => {
    if (!startDate || !endDate) { return; }
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=order-report&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      if (response.ok) {
        let filteredData = { ...data };
        if (selectedCategory) {
          filteredData.orders = data.orders.filter(o => o.customer?.customer_category?.cus_cat_id === parseInt(selectedCategory));
        }
        if (selectedAccount) {
          filteredData.orders = filteredData.orders.filter(o => o.customer?.cus_id === parseInt(selectedAccount));
        }
        filteredData.summary = {
          totalOrders: filteredData.orders.length,
          totalAmount: filteredData.orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
          totalDiscount: filteredData.orders.reduce((sum, o) => sum + parseFloat(o.discount || 0), 0),
          totalShipping: filteredData.orders.reduce((sum, o) => sum + parseFloat(o.shipping_amount || 0), 0),
          netTotal: filteredData.orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0) - parseFloat(o.discount || 0) + parseFloat(o.shipping_amount || 0), 0),
          pendingPayment: filteredData.orders.reduce((sum, o) => {
            const net = parseFloat(o.total_amount || 0) - parseFloat(o.discount || 0) + parseFloat(o.shipping_amount || 0);
            return sum + (net - parseFloat(o.payment || 0));
          }, 0)
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

  const handleExport = () => {
    if (!reportData) return;
    let csv = 'ORDER REGISTER\n';
    csv += `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n\n`;
    csv += 'S.No,Date,Order ID,Customer,Items,Gross Amount,Discount,Shipping,Net Total,Paid,Pending\n';
    reportData.orders.forEach((o, i) => {
      const net = parseFloat(o.total_amount || 0) - parseFloat(o.discount || 0) + parseFloat(o.shipping_amount || 0);
      const pending = net - parseFloat(o.payment || 0);
      csv += `${i + 1},${formatDate(o.created_at)},ORD-${o.sale_id},${o.customer?.cus_name || '-'},${o.sale_details?.length || 0},${formatCurrency(o.total_amount)},${formatCurrency(o.discount)},${formatCurrency(o.shipping_amount)},${formatCurrency(net)},${formatCurrency(o.payment)},${formatCurrency(pending)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-register-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
        {/* Screen Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-rose-700 to-rose-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Order Register</h1>
                  <p className="text-rose-200 text-sm">Order tracking and payments</p>
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500" />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500" />
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
              <label className="block text-xs font-semibold text-slate-600 mb-1 caps">CUSTOMER</label>
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
                    placeholder="All Customers"
                    onFocus={(e) => e.target.select()}
                    sx={{
                      '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: selectedCategory ? 'white' : '#f1f5f9' }
                    }}
                  />
                )}
              />
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-sm font-semibold transition-colors min-w-[140px]">
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
                    <h2 className="text-lg font-bold tracking-widest">ORDER REGISTER</h2>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Period:</span> {formatDate(startDate)} to {formatDate(endDate)}
                  </p>
                </div>
              </div>

              {/* Summary Cards - Screen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
                <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Total Orders</p>
                    <Package className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="text-2xl font-bold text-rose-800 mt-1">{reportData.summary.totalOrders}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Net Total</p>
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-blue-800 mt-1">Rs. {formatCurrency(reportData.summary.netTotal)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Amount Paid</p>
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">Rs. {formatCurrency(reportData.summary.netTotal - reportData.summary.pendingPayment)}</p>
                </div>
                <div className={`bg-gradient-to-br ${reportData.summary.pendingPayment > 0 ? 'from-amber-50 to-amber-100 border-amber-200' : 'from-emerald-50 to-emerald-100 border-emerald-200'} border rounded-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${reportData.summary.pendingPayment > 0 ? 'text-amber-600' : 'text-emerald-600'} uppercase tracking-wide`}>Pending</p>
                    <Clock className={`w-4 h-4 ${reportData.summary.pendingPayment > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                  </div>
                  <p className={`text-2xl font-bold ${reportData.summary.pendingPayment > 0 ? 'text-amber-800' : 'text-emerald-800'} mt-1`}>Rs. {formatCurrency(reportData.summary.pendingPayment)}</p>
                </div>
              </div>

              {/* Summary Box - Print */}
              <div className="hidden print:block bg-white border-2 border-black mb-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-400">
                      <td className="px-4 py-2 font-medium border-r border-gray-400">Total Orders:</td>
                      <td className="px-4 py-2 text-right font-bold border-r border-gray-400">{reportData.summary.totalOrders}</td>
                      <td className="px-4 py-2 font-medium border-r border-gray-400">Total Amount:</td>
                      <td className="px-4 py-2 text-right font-bold">{formatCurrency(reportData.summary.totalAmount)}</td>
                    </tr>
                    <tr className="border-b border-gray-400">
                      <td className="px-4 py-2 font-medium border-r border-gray-400">Total Discount:</td>
                      <td className="px-4 py-2 text-right font-bold border-r border-gray-400">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="px-4 py-2 font-medium border-r border-gray-400">Total Shipping:</td>
                      <td className="px-4 py-2 text-right font-bold">{formatCurrency(reportData.summary.totalShipping)}</td>
                    </tr>
                    <tr className="bg-gray-100">
                      <td className="px-4 py-2 font-bold border-r border-gray-400">Net Total:</td>
                      <td className="px-4 py-2 text-right font-bold border-r border-gray-400">{formatCurrency(reportData.summary.netTotal)}</td>
                      <td className="px-4 py-2 font-bold border-r border-gray-400">Pending Payment:</td>
                      <td className="px-4 py-2 text-right font-bold">{formatCurrency(reportData.summary.pendingPayment)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Orders Table */}
              <div className="bg-white border border-slate-300 rounded-lg overflow-hidden print:border-black print:rounded-none">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 print:bg-white print:border-black">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Order Details</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white print:bg-gray-200 print:text-black">
                      <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">S.No</th>
                      <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Date</th>
                      <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Order #</th>
                      <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Customer</th>
                      <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Items</th>
                      <th className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Amount</th>
                      <th className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Disc</th>
                      <th className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Net</th>
                      <th className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Paid</th>
                      <th className="px-2 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 print:border-black">Pending</th>
                      <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-black">
                    {reportData.orders.map((order, index) => {
                      const netTotal = parseFloat(order.total_amount || 0) - parseFloat(order.discount || 0) + parseFloat(order.shipping_amount || 0);
                      const pending = netTotal - parseFloat(order.payment || 0);
                      return (
                        <tr key={order.sale_id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-rose-50 print:bg-white transition-colors`}>
                          <td className="px-2 py-2.5 text-slate-900 border-r border-slate-200 print:border-black">{index + 1}</td>
                          <td className="px-2 py-2.5 text-slate-900 border-r border-slate-200 print:border-black whitespace-nowrap">{formatDate(order.created_at)}</td>
                          <td className="px-2 py-2.5 text-slate-900 font-mono text-xs border-r border-slate-200 print:border-black">ORD-{order.sale_id}</td>
                          <td className="px-2 py-2.5 text-slate-900 font-medium border-r border-slate-200 print:border-black">{order.customer?.cus_name || '-'}</td>
                          <td className="px-2 py-2.5 text-center border-r border-slate-200 print:border-black">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800 print:bg-white print:border print:border-black">
                              {order.sale_details?.length || 0}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(order.total_amount)}</td>
                          <td className="px-2 py-2.5 text-slate-900 text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(order.discount)}</td>
                          <td className="px-2 py-2.5 text-slate-900 text-right font-semibold border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(netTotal)}</td>
                          <td className="px-2 py-2.5 text-emerald-600 print:text-black text-right border-r border-slate-200 print:border-black tabular-nums">{formatCurrency(order.payment)}</td>
                          <td className={`px-2 py-2.5 text-right font-semibold tabular-nums border-r border-slate-200 print:border-black ${pending > 0 ? 'text-amber-600 print:text-black' : 'text-emerald-600 print:text-black'}`}>
                            {formatCurrency(pending)}
                          </td>
                          <td className="px-2 py-2.5 text-center print:hidden">
                            <button
                              onClick={() => handleViewBill(order)}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {reportData.orders.length === 0 && (
                      <tr><td colSpan="10" className="px-6 py-12 text-center text-slate-500">No orders found for the selected period</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold print:bg-gray-200 print:text-black">
                      <td colSpan="5" className="px-2 py-3 text-right uppercase text-xs tracking-wider border-r border-slate-600 print:border-black">Grand Total</td>
                      <td className="px-2 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalAmount)}</td>
                      <td className="px-2 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.totalDiscount)}</td>
                      <td className="px-2 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.netTotal)}</td>
                      <td className="px-2 py-3 text-right border-r border-slate-600 print:border-black tabular-nums">{formatCurrency(reportData.summary.netTotal - reportData.summary.pendingPayment)}</td>
                      <td className="px-2 py-3 text-right tabular-nums border-r border-slate-600 print:border-black">{formatCurrency(reportData.summary.pendingPayment)}</td>
                      <td className="print:hidden"></td>
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

      {/* Order Detail Modal */}
      {viewBillDialog && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden" onClick={() => setViewBillDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between bg-blue-700 text-white px-4 py-3 rounded-t-xl">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="font-bold text-sm">
                  Order Details — {selectedBill.bill_number ? `O-${selectedBill.bill_number}` : `ORD-${selectedBill.sale_id}`}
                </span>
              </div>
              <button onClick={() => setViewBillDialog(false)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Company Header */}
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <div className="text-xl font-bold" style={{ direction: 'rtl' }}>اتفاق آئرن اینڈ سیمنٹ سٹور</div>
                <div className="text-sm text-gray-600" style={{ direction: 'rtl' }}>گجرات سرگودھا روڈ، پاہڑیانوالی</div>
                <div className="text-sm mt-0.5">Ph:- 0346-7560306, 0300-7560306</div>
                <div className="font-bold uppercase tracking-wider mt-1 text-sm">ORDER INVOICE</div>
              </div>

              {/* Customer & Invoice Info */}
              <div className="flex justify-between border-b border-gray-200 pb-3 mb-3 text-sm">
                <div className="space-y-1">
                  <p><strong>Customer:</strong> {selectedBill.customer?.cus_name || 'N/A'}</p>
                  <p><strong>Phone:</strong> {selectedBill.customer?.cus_phone_no || 'N/A'}</p>
                  {selectedBill.customer?.cus_address && <p><strong>Address:</strong> {selectedBill.customer.cus_address}</p>}
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Invoice No:</strong> {selectedBill.bill_number ? `O-${selectedBill.bill_number}` : `#${selectedBill.sale_id}`}</p>
                  <p><strong>Date:</strong> {new Date(selectedBill.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  <p><strong>Time:</strong> {new Date(selectedBill.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                  <p><strong>Bill Type:</strong> {selectedBill.bill_type || 'ORDER'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-sm border border-gray-300 mb-3">
                <thead>
                  <tr className="bg-gray-500 text-white">
                    <th className="px-2 py-1.5 text-left font-semibold">S#</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Product</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Rate</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedBill.sale_details?.length > 0 ? selectedBill.sale_details.map((d, i) => (
                    <tr key={d.sale_detail_id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{d.product?.pro_title || d.product?.pro_name || 'N/A'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(d.qnty || 0)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(d.unit_rate)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(d.total_amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="px-4 py-4 text-center text-gray-500">No items</td></tr>
                  )}
                </tbody>
              </table>

              {/* Payment Summary */}
              <div className="flex gap-4 text-sm">
                {/* Left: Balance */}
                <div className="flex-1">
                  <table className="w-full border border-gray-300">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>سابقہ بقایا</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(selectedBill.customer?.cus_balance)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>موجوده بقايا</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}</td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>كل بقايا</td>
                        <td className="px-2 py-1 text-right tabular-nums font-bold">{formatCurrency(parseFloat(selectedBill.customer?.cus_balance || 0) + parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                  {selectedBill.notes && <p className="text-xs mt-2 text-gray-600"><strong>Notes:</strong> {selectedBill.notes}</p>}
                </div>

                {/* Right: Amounts */}
                <div className="flex-1">
                  <table className="w-full border border-gray-300">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>رقم بل</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency((selectedBill.sale_details || []).reduce((s, d) => s + parseFloat(d.total_amount || 0), 0))}</td>
                      </tr>
                      {parseFloat(selectedBill.labour || 0) > 0 && (
                        <tr className="border-b border-gray-200">
                          <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>مزدوری</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(selectedBill.labour)}</td>
                        </tr>
                      )}
                      {parseFloat(selectedBill.shipping_amount || 0) > 0 && (
                        <tr className="border-b border-gray-200">
                          <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>کرایہ</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(selectedBill.shipping_amount)}</td>
                        </tr>
                      )}
                      {parseFloat(selectedBill.discount || 0) > 0 && (
                        <tr className="border-b border-gray-200">
                          <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>رعایت</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(selectedBill.discount)}</td>
                        </tr>
                      )}
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>كل رقم</td>
                        <td className="px-2 py-1 text-right tabular-nums font-bold">{formatCurrency(selectedBill.total_amount)}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>نقد كيش</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(
                          selectedBill.hasOwnProperty('cash_payment') ? selectedBill.cash_payment :
                          (selectedBill.payment_type === 'CASH' || !selectedBill.payment_type ? selectedBill.payment : 0)
                        )}</td>
                      </tr>
                      {(() => {
                        const bankAmt = selectedBill.hasOwnProperty('bank_payment') ?
                          parseFloat(selectedBill.bank_payment || 0) :
                          (selectedBill.payment_type !== 'CASH' && selectedBill.payment_type ? parseFloat(selectedBill.payment || 0) : 0);
                        const bankName = selectedBill.bank_title || selectedBill.debit_account?.cus_name || 'بینک';
                        return bankAmt > 0 ? (
                          <tr className="border-b border-gray-200">
                            <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>{bankName}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(bankAmt)}</td>
                          </tr>
                        ) : null;
                      })()}
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>كل رقم وصول</td>
                        <td className="px-2 py-1 text-right tabular-nums font-bold">{formatCurrency(selectedBill.payment)}</td>
                      </tr>
                      <tr className="bg-gray-300">
                        <td className="px-2 py-1 font-bold" style={{ direction: 'rtl' }}>بقايا رقم</td>
                        <td className="px-2 py-1 text-right tabular-nums font-bold">{formatCurrency(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.payment || 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <button onClick={() => setViewBillDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
