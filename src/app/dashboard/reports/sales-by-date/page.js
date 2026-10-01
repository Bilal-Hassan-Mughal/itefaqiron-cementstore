'use client';

import { TailwindDateInput } from '../../components/date-filter-input';
import { useState, useEffect, useRef } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import {
  saleReportNetTotal,
  saleReportShippingDisplay,
  saleReportSubtotal,
} from '@/lib/sale-report-amounts';
import { 
  Calendar,
  Download,
  Printer,
  ArrowLeft,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  DollarSign,
} from 'lucide-react';
import { Dialog, DialogContent, DialogActions, Button, Box, Typography, Table as MuiTable, TableBody as MuiTableBody, TableCell as MuiTableCell, TableContainer as MuiTableContainer, TableHead as MuiTableHead, TableRow as MuiTableRow, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SalesByDateReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sale details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const rowRefs = useRef([]);
  const listContainerRef = useRef(null);

  const scrollRowIntoView = (el) => {
    const container = listContainerRef.current;
    if (!container || !el) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = container.scrollTop + container.clientHeight;
    if (elTop < viewTop + 36) {
      container.scrollTop = Math.max(0, elTop - 36);
    } else if (elBottom > viewBottom) {
      container.scrollTop = elBottom - container.clientHeight + 8;
    }
  };

  // Set default dates and auto-fetch on mount (default to today)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  // Auto-fetch report when dates are set
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=sales-by-date&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      
      if (response.ok) {
        setSalesData(data);
      } else {
        alert('Error fetching report');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error fetching report');
    } finally {
      setLoading(false);
    }
  };

  // Compute readable totals for the selected sale to avoid complex inline JSX expressions
  const getSaleTotals = (sale) => {
    if (!sale) return null;
    const subtotal = saleReportSubtotal(sale);
    const discount = parseFloat(sale.discount || 0) || 0;
    const labour = parseFloat(sale.labour_charges || 0) || 0;
    const shipping = parseFloat(sale.shipping_amount || 0) || 0;
    const netTotal = saleReportNetTotal(sale);
    const prevBalance = parseFloat(sale.previous_balance ?? sale.prev_balance ?? sale.previous_customer_balance ?? sale.customer?.cus_balance ?? 0) || 0;
    const cash = parseFloat(sale.cash_payment || 0) || 0;
    const bank = parseFloat(sale.bank_payment || 0) || 0;
    const advance = parseFloat(sale.advance_payment || 0) || 0;
    const paid = Number.isFinite(Number(sale.payment)) ? parseFloat(sale.payment) || 0 : (cash + bank + advance);
    const due = prevBalance + netTotal - paid;
    const totalQty = (sale.sale_details || []).reduce((s, d) => s + (parseFloat(d.qnty || 0) || 0), 0);
    const lineItemsTotal = (sale.sale_details || []).reduce((s, d) => s + (parseFloat(d.total_amount || d.amount || 0) || 0), 0);
    return { subtotal, discount, labour, shipping, netTotal, prevBalance, cash, bank, advance, paid, due, totalQty, lineItemsTotal };
  };

  const selectedTotals = selectedSale ? getSaleTotals(selectedSale) : null;

  // Formatting helpers used across the table for consistent, professional display
  const formatCurrency = (v) => {
    const n = Number(v) || 0;
    return fmtAmt(n);
  };
  const handleListKeyDown = (e) => {
    if (!salesData || !salesData.sales || salesData.sales.length === 0) return;
    const key = e.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter' && key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();

    const current = selectedIndex !== null ? selectedIndex : 0;
    let ni = current;
    if (key === 'ArrowDown') ni = Math.min(current + 1, salesData.sales.length - 1);
    else if (key === 'ArrowUp') ni = Math.max(current - 1, 0);
    else if (key === 'Enter' || key === ' ') {
      if (selectedIndex !== null) {
        setSelectedSale(salesData.sales[selectedIndex]);
        setShowDetailsModal(true);
      }
      return;
    }

    setSelectedIndex(ni);
    setSelectedSale(salesData.sales[ni]);
    const el = rowRefs.current[ni];
    if (el?.focus) {
      el.focus({ preventScroll: true });
      scrollRowIntoView(el);
    }
  };

  const handlePrint = () => {
    // If a sale details modal is open, print the single sale invoice
    if (showDetailsModal && selectedSale) {
      printSaleBill(selectedSale);
      return;
    }

    window.print();
  };

  

  const handleExport = () => {
    if (!salesData) return;

    // Create CSV content with header
    let csv = ''; 
    csv += 'Ittefaq Iron and Cement Store\n';
    csv += 'Address: Parianwali\n';
    csv += 'Phone: +92 346 7560306\n';
    csv += '\n';
    csv += 'Sales Report (By Date)\n';
    csv += `From: ${formatDatePK(startDate)} To: ${formatDatePK(endDate)}\n`;
    csv += `Generated on: ${new Date().toLocaleString()}\n`;
    csv += '\n';
    csv += 'Sale ID,Date,Customer,Items,Total Amount,Discount,Shipping,Net Total,Payment,Bill Type\n';
    
    salesData.sales.forEach(sale => {
      const netTotal = saleReportNetTotal(sale);
      const subtotal = saleReportSubtotal(sale);
      const shippingDisplay = saleReportShippingDisplay(sale);
      csv += `${sale.sale_id},${formatDatePK(sale.created_at)},${sale.customer?.cus_name || 'N/A'},${sale.sale_details?.length || 0},${fmtAmt(subtotal)},${fmtAmt(sale.discount)},${fmtAmt(shippingDisplay)},${fmtAmt(netTotal)},${fmtAmt(sale.payment)},${sale.bill_type}\n`;
    });

    // Add totals
    csv += '\n';
    csv += `TOTAL,,,${salesData.summary.totalSales},${fmtAmt(salesData.summary.totalAmount)},${fmtAmt(salesData.summary.totalDiscount)},${fmtAmt(salesData.summary.totalShipping)},${fmtAmt(salesData.summary.netTotal)},${fmtAmt(salesData.summary.totalPayment)},\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print a single sale bill using a full invoice layout (matches Sales page fields)
  const printSaleBill = (sale) => {
    if (!sale) return;

    // Build an HTML string that matches the Sales page printable A4 invoice
    const details = sale.sale_details || [];
    const itemsHtml = details.map((d, i) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:600">${i + 1}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:14px;font-weight:600">${d.product?.pro_title || d.product_name || 'Item'}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-size:14px;font-weight:600">${d.qnty || 0}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-size:14px;font-weight:600">${fmtAmt(parseFloat(d.unit_rate) || 0)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-size:14px;font-weight:600">${fmtAmt(parseFloat(d.total_amount) || 0)}</td>
      </tr>`).join('');

    const subtotal = parseFloat(sale.total_amount || 0) || 0;
    const discount = parseFloat(sale.discount || 0) || 0;
    const labour = parseFloat(sale.labour_charges || sale.labour || 0) || 0;
    const shipping = parseFloat(sale.shipping_amount || 0) || 0;
    const paid = Number.isFinite(Number(sale.payment)) ? (parseFloat(sale.payment) || 0) : ((parseFloat(sale.cash_payment || 0) || 0) + (parseFloat(sale.bank_payment || 0) || 0) + (parseFloat(sale.advance_payment || 0) || 0));
    const prevBal = parseFloat(sale.previous_balance ?? sale.prev_balance ?? sale.previous_customer_balance ?? sale.customer?.cus_balance ?? 0) || 0;

    const totalQty = details.reduce((s, d) => s + (parseFloat(d.qnty || 0) || 0), 0);

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
            .meta{ margin-top:8px; display:flex; justify-content:space-between }
            table{ width:100%; border-collapse:collapse; margin-top:12px }
            th,td{ border:1px solid #000; padding:8px; font-weight:bold; }
            th{ background:#f3f4f6; text-align:left }
            .right{ text-align:right }
            .totals{ margin-top:12px; width:360px; float:right }
            .urdu{ font-family: 'Noto Nastaliq Urdu', serif; }
          </style>
        </head>
        <body>
          <div style="width:148mm;margin:0 auto">
          <div class="company">
            <h2 style="margin:0;font-size:20px">اتفاق آئرن اینڈ سیمنٹ سٹور</h2>
            <div>گجرات سرگودھا روڈ، پاہڑیانوالی</div>
            <div>Ph: 0346-7560306, 0300-7560306</div>
            <div style="margin-top:6px;font-weight:bold;font-size:18px">SALE INVOICE</div>
          </div>

          <div class="meta" style="display:flex;justify-content:space-between">
            <div style="width:50%;display:flex;flex-direction:column">
              <div style="display:flex;margin-bottom:4px">
                <span style="width:130px;display:inline-block">Customer Name:</span>
                <strong style="font-size:16px">${sale.customer?.cus_name || 'N/A'}${sale.customer?.name_urdu ? ' ' + sale.customer.name_urdu : ''}</strong>
              </div>
              <div style="display:flex;margin-bottom:4px">
                <span style="width:130px;display:inline-block">Phone No:</span>
                <strong>${sale.customer?.cus_phone_no || 'N/A'}</strong>
              </div>
              ${sale.customer?.cus_address ? `
              <div style="display:flex;margin-bottom:4px">
                <span style="width:130px;display:inline-block">Address:</span>
                <strong>${sale.customer.cus_address}</strong>
              </div>
              ` : ''}
            </div>
            <div style="width:50%;display:flex;flex-direction:column;padding-left:20px">
              <div style="display:flex;margin-bottom:4px">
                <span style="width:100px;display:inline-block">Invoice No:</span>
                <strong>#${sale.sale_id}</strong>
              </div>
              <div style="display:flex;margin-bottom:4px">
                <span style="width:100px;display:inline-block">Date:</span>
                <strong>${new Date(sale.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
              </div>
              <div style="display:flex;margin-bottom:4px">
                <span style="width:100px;display:inline-block">Time:</span>
                <strong>${new Date(sale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
              </div>
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
              <tr style="background:#f5f5f5"><th style="padding:6px">Grand Total</th><th style="padding:6px" class="right">${fmtAmt(subtotal)}</th></tr>
              <tr><td style="border:1px solid #ddd;padding:6px">Cash</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.cash_payment || 0) || 0)}</td></tr>
              ${ (parseFloat(sale.bank_payment || 0) || 0) > 0 ? `<tr><td style="border:1px solid #ddd;padding:6px">${sale.bank_title || 'Bank'}</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.bank_payment || 0) || 0)}</td></tr>` : '' }
              ${ (parseFloat(sale.advance_payment || 0) || 0) > 0 ? `<tr><td style="border:1px solid #ddd;padding:6px">Advance</td><td style="border:1px solid #ddd;padding:6px" class="right">${fmtAmt(parseFloat(sale.advance_payment || 0) || 0)}</td></tr>` : '' }
              <tr style="background:#f5f5f5"><th style="padding:6px">Total Paid</th><th style="padding:6px" class="right">${fmtAmt(paid)}</th></tr>
              <tr style="background:#d0d0d0"><th style="padding:6px">Balance</th><th style="padding:6px" class="right">${fmtAmt(subtotal - paid)}</th></tr>
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

  const LEDGER_VISIBLE_ROWS = 10;
  const LEDGER_ROW_PX = 34;
  const LEDGER_HEAD_PX = 36;
  const ledgerScrollHeightPx = LEDGER_HEAD_PX + LEDGER_ROW_PX * LEDGER_VISIBLE_ROWS;

  const gridBorder = 'border border-slate-300';
  const thBase =
    `${gridBorder} px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap sticky top-0 z-20`;
  const thInfo = `${thBase} bg-slate-700 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]`;
  const thMoney = `${thBase} text-white`;
  const thAmount = `${thMoney} bg-indigo-800/95`;
  const thDiscount = `${thMoney} bg-rose-800/95`;
  const thShipping = `${thMoney} bg-sky-800/95`;
  const thNet = `${thMoney} bg-emerald-800/95`;
  const tdBase = `${gridBorder} px-2.5 text-[12px] align-middle h-[34px] max-h-[34px] py-0 leading-[34px]`;
  const tdNum = `${tdBase} tabular-nums text-right font-medium`;
  const tdTextCell = `${tdBase} text-slate-700`;
  const colAmt = 'bg-indigo-50/80 text-slate-900';
  const colDisc = 'bg-rose-50/80 text-rose-900';
  const colShip = 'bg-sky-50/80 text-sky-950';
  const colNet = 'bg-emerald-50/90 text-emerald-950 font-semibold';
  const rowEven = 'bg-white';
  const rowOdd = 'bg-slate-50';
  const rowSelected = '!bg-blue-100/90';
  const ledgerTableClass = 'w-full table-fixed border-collapse min-w-[980px] border border-slate-400 print:table';

  const LedgerColgroup = () => (
    <colgroup>
      <col className="w-[4%]" />
      <col className="w-[11%]" />
      <col className="w-[8%]" />
      <col className="w-[26%]" />
      <col className="w-[6%]" />
      <col className="w-[12%]" />
      <col className="w-[10%]" />
      <col className="w-[10%]" />
      <col className="w-[12%]" />
      <col className="w-[7%]" />
    </colgroup>
  );

  const summaryCard =
    'rounded-xl border bg-white p-3 shadow-sm min-w-0 flex flex-col justify-center';

  return (
    <DashboardLayout>
      <div id="printable-report" className="h-full flex flex-col min-h-0 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 print:bg-white print:overflow-visible">
        {/* Toolbar */}
        <div className="flex-shrink-0 print:hidden px-4 pt-4 pb-2">
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm shadow-sm">
            <div className="px-4 py-3.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard/reports')}
                className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors duration-200"
                title="Back to reports"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">Sales Report (By Date)</h2>
                  <p className="text-xs text-slate-500">Posted BILL invoices · ledger view</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2.5 ml-auto">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">From</label>
                  <TailwindDateInput
                    value={startDate}
                    onChange={setStartDate}
                    inputClassName="text-xs py-1 min-w-[128px] bg-transparent border-0 focus:ring-0 px-0"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">To</label>
                  <TailwindDateInput
                    value={endDate}
                    onChange={setEndDate}
                    inputClassName="text-xs py-1 min-w-[128px] bg-transparent border-0 focus:ring-0 px-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchReport}
                  disabled={loading}
                  className="h-[42px] px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 disabled:opacity-55 transition-all duration-200 active:scale-[0.98]"
                >
                  {loading ? 'Loading…' : 'Generate'}
                </button>
                {salesData && (
                  <>
                    <button
                      type="button"
                      onClick={handleExport}
                      className="h-[42px] px-4 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100/90 flex items-center gap-1.5 transition-colors duration-200"
                    >
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="h-[42px] px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 transition-colors duration-200"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {salesData && (
          <>
            {/* Print Header - Only show on print */}
            <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Ittefaq Iron and Cement Store</h1>
                <p className="text-gray-700 text-lg">Address: Parianwali</p>
                <p className="text-gray-700 text-lg">Phone: +92 346 7560306</p>
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h2 className="text-2xl font-semibold text-gray-800">Sales Report (By Date)</h2>
                  <p className="text-gray-600 mt-2">
                    From {formatDatePK(startDate)} to {formatDatePK(endDate)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated on: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sale details modal (match Sales page invoice format) */}
            <Dialog
              open={showDetailsModal}
              onClose={() => setShowDetailsModal(false)}
              maxWidth="lg"
              fullWidth
              aria-labelledby="sales-by-date-bill-dialog-title"
              PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
            >
              <Box
                id="sales-by-date-bill-dialog-title"
                component="div"
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                  color: 'white',
                  py: 2,
                  px: 3,
                  fontWeight: 700,
                  fontSize: '1.1rem',
                }}
              >
                <span>Bill Details — #{selectedSale?.sale_id}</span>
                <Button
                  size="small"
                  onClick={() => setShowDetailsModal(false)}
                  sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
                >
                  Close
                </Button>
              </Box>
              <DialogContent dividers>
                {selectedSale ? (
                  <Box sx={{ width: '100%', bgcolor: 'white' }}>
                    <Box sx={{ textAlign: 'center', py: 2, borderBottom: '2px solid #000' }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>Ittefaq Iron and Cement Store</Typography>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>Address: Parianwali</Typography>
                      <Typography variant="body2">Phone: +92 346 7560306</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>SALE INVOICE</Typography>
                    </Box>

                    <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                      <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Customer Name:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                            {selectedSale.customer ? `${selectedSale.customer.cus_name}${selectedSale.customer.name_urdu ? ' ' + selectedSale.customer.name_urdu : ''}` : 'N/A'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Phone No:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {selectedSale.customer?.cus_phone_no || 'N/A'}
                          </Typography>
                        </Box>
                        {selectedSale.customer?.cus_address && (
                          <Box sx={{ display: 'flex' }}>
                            <Typography variant="body2" sx={{ width: '130px', flexShrink: 0 }}>Address:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {selectedSale.customer.cus_address}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', pl: 4 }}>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Invoice No:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            #{selectedSale.sale_id}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Date:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {new Date(selectedSale.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ width: '100px', flexShrink: 0 }}>Time:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {new Date(selectedSale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <MuiTableContainer component={Paper} variant="outlined" sx={{ my: 2 }}>
                      <MuiTable size="small">
                        <MuiTableHead>
                          <MuiTableRow sx={{ bgcolor: '#9e9e9e' }}>
                            <MuiTableCell sx={{ fontWeight: 'bold', color: 'white' }}>S#</MuiTableCell>
                            <MuiTableCell sx={{ fontWeight: 'bold', color: 'white' }}>Product</MuiTableCell>
                            <MuiTableCell sx={{ fontWeight: 'bold', color: 'white' }} align="right">Qty</MuiTableCell>
                            <MuiTableCell sx={{ fontWeight: 'bold', color: 'white' }} align="right">Rate</MuiTableCell>
                            <MuiTableCell sx={{ fontWeight: 'bold', color: 'white' }} align="right">Amount</MuiTableCell>
                          </MuiTableRow>
                        </MuiTableHead>
                        <MuiTableBody>
                          {(selectedSale.sale_details || []).length > 0 ? (
                            <>
                              {(selectedSale.sale_details || []).map((d, i) => (
                                <MuiTableRow key={d.sale_detail_id || i}>
                                  <MuiTableCell sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{i + 1}</MuiTableCell>
                                  <MuiTableCell sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{d.product?.pro_title || d.product_name || 'N/A'}</MuiTableCell>
                                  <MuiTableCell align="right" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{d.qnty || 0}</MuiTableCell>
                                  <MuiTableCell align="right" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{fmtAmt(d.unit_rate)}</MuiTableCell>
                                  <MuiTableCell align="right" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{fmtAmt(d.total_amount)}</MuiTableCell>
                                </MuiTableRow>
                              ))}
                              <MuiTableRow sx={{ bgcolor: '#fafafa' }}>
                                <MuiTableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total Qty</MuiTableCell>
                                <MuiTableCell align="right" sx={{ fontWeight: 'bold' }}>{((selectedTotals ? selectedTotals.totalQty : (selectedSale.sale_details || []).reduce((s,d)=> s + (parseFloat(d.qnty||0)||0),0))).toFixed(2)}</MuiTableCell>
                                <MuiTableCell />
                                <MuiTableCell />
                              </MuiTableRow>
                            </>
                          ) : (
                            <MuiTableRow>
                              <MuiTableCell colSpan={5} align="center">No items found</MuiTableCell>
                            </MuiTableRow>
                          )}
                        </MuiTableBody>
                      </MuiTable>
                    </MuiTableContainer>

                    <Box sx={{ mt: 2 }}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2"><strong>Notes:</strong> {selectedSale.notes || selectedSale.reference || ''}</Typography>
                          </Box>

                          <Box sx={{ width: 360 }}>
                            <MuiTableContainer component={Paper} variant="outlined">
                              <MuiTable size="small">
                                <MuiTableBody>
                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>سابقہ بقایا</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.prevBalance || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>موجوده بقايا</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt((parseFloat(selectedSale.total_amount || 0) || 0) - (parseFloat(selectedSale.payment || 0) || 0))}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل بقايا</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt((selectedTotals?.prevBalance || 0) + (parseFloat(selectedSale.total_amount || 0) || 0) - (parseFloat(selectedSale.payment || 0) || 0))}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>رقم بل</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.subtotal || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>مزدوری</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.labour || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>کرایہ</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.shipping || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                   {parseFloat(selectedTotals?.discount || 0) > 0 && (
                                     <MuiTableRow>
                                       <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>رعایت</MuiTableCell>
                                       <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                         {fmtAmt(selectedTotals?.discount || 0)}
                                       </MuiTableCell>
                                     </MuiTableRow>
                                   )}

                                  <MuiTableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل رقم</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.netTotal || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>نقد كيش</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.cash || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  { (selectedTotals?.bank || 0) > 0 && (
                                    <MuiTableRow>
                                      <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>{selectedSale.bank_title || 'بینک'}</MuiTableCell>
                                      <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                        {fmtAmt(selectedTotals?.bank || 0)}
                                      </MuiTableCell>
                                    </MuiTableRow>
                                  )}

                                  { (selectedTotals?.advance || 0) > 0 && (
                                    <MuiTableRow>
                                      <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>پیشگی ادائیگی</MuiTableCell>
                                      <MuiTableCell align="right" sx={{ px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                        {fmtAmt(selectedTotals?.advance || 0)}
                                      </MuiTableCell>
                                    </MuiTableRow>
                                  )}

                                  <MuiTableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>كل رقم وصول</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.paid || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                  <MuiTableRow sx={{ bgcolor: '#d0d0d0' }}>
                                    <MuiTableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: '1px solid #ddd' }}>بقايا رقم</MuiTableCell>
                                    <MuiTableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: '1px solid #ddd' }}>
                                      {fmtAmt(selectedTotals?.due || 0)}
                                    </MuiTableCell>
                                  </MuiTableRow>

                                </MuiTableBody>
                              </MuiTable>
                            </MuiTableContainer>
                          </Box>
                        </Box>
                      </Paper>
                    </Box>
                  </Box>
                ) : (
                  <Typography sx={{ p: 2 }}>No sale selected</Typography>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => printSaleBill(selectedSale)} variant="contained">Print</Button>
                <Button onClick={() => setShowDetailsModal(false)} variant="outlined">Close</Button>
              </DialogActions>
            </Dialog>
            {/* Summary + grid */}
            <div className={`flex-1 min-h-0 flex flex-col px-4 pb-4 print:p-0 gap-3 transition-opacity duration-300 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
              {selectedSale && (
                <div className="print:hidden flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50/90 border border-blue-200/80 text-xs shadow-sm">
                  <span className="font-bold text-blue-900">#{selectedSale.sale_id}</span>
                  <span className="text-slate-600 truncate max-w-[220px]">{selectedSale.customer?.cus_name || '—'}</span>
                  <span className="tabular-nums font-semibold text-slate-800 ml-auto">
                    Net {formatCurrency(selectedTotals?.netTotal ?? saleReportNetTotal(selectedSale))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDetailsModal(true)}
                    className="px-3 py-1.5 font-semibold text-blue-800 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Open invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedSale(null); setSelectedIndex(null); }}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className={`${summaryCard} border-slate-200/90`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Period
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate" title={`${formatDatePK(startDate)} — ${formatDatePK(endDate)}`}>
                    {formatDatePK(startDate)} — {formatDatePK(endDate)}
                  </p>
                </div>
                <div className={`${summaryCard} border-slate-200/90`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Invoices
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">{salesData.summary.totalSales}</p>
                </div>
                <div className={`${summaryCard} border-indigo-200/90 bg-indigo-50/40`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800/90 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Amount
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-indigo-950 tabular-nums truncate">{formatCurrency(salesData.summary.totalAmount)}</p>
                </div>
                <div className={`${summaryCard} border-rose-200/90 bg-rose-50/50`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800/90 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" /> Discount
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-rose-900 tabular-nums truncate">{formatCurrency(salesData.summary.totalDiscount)}</p>
                </div>
                <div className={`${summaryCard} border-sky-200/90 bg-sky-50/50`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900/90 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Shipping
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-sky-950 tabular-nums truncate">{formatCurrency(salesData.summary.totalShipping)}</p>
                </div>
                <div className={`${summaryCard} border-emerald-300/80 bg-emerald-50/60 sm:col-span-3 xl:col-span-1`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/90 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Net sales
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-emerald-950 tabular-nums truncate">{formatCurrency(salesData.summary.netTotal)}</p>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/40 overflow-hidden print:border print:shadow-none mt-1">
                <div className="overflow-x-auto px-2 py-2 print:px-0 print:py-0">
                  <div className="min-w-[980px]">
                    <div
                      ref={listContainerRef}
                      tabIndex={0}
                      onKeyDown={handleListKeyDown}
                      style={{ height: ledgerScrollHeightPx }}
                      className="sales-report-scroll overflow-y-auto overflow-x-hidden scroll-smooth print:h-auto print:max-h-none print:overflow-visible"
                    >
                      <table aria-label="Sales by date report" className={ledgerTableClass}>
                        <LedgerColgroup />
                        <thead>
                      <tr className="h-[36px]">
                        <th scope="col" className={`${thInfo} text-center`}>#</th>
                        <th scope="col" className={`${thInfo} text-left`}>Date</th>
                        <th scope="col" className={`${thInfo} text-left`}>Sale ID</th>
                        <th scope="col" className={`${thInfo} text-left`}>Customer</th>
                        <th scope="col" className={`${thInfo} text-center`}>Items</th>
                        <th scope="col" className={`${thAmount} text-right`}>Amount</th>
                        <th scope="col" className={`${thDiscount} text-right hidden sm:table-cell`}>Discount</th>
                        <th scope="col" className={`${thShipping} text-right hidden sm:table-cell`}>Shipping</th>
                        <th scope="col" className={`${thNet} text-right`}>Net Total</th>
                        <th scope="col" className={`${thInfo} text-center`}>Type</th>
                      </tr>
                    </thead>
                    <tbody className="sales-report-tbody print:table-row-group">
                      {salesData.sales.map((sale, i) => {
                        const netTotal = saleReportNetTotal(sale);
                        const rowSubtotal = saleReportSubtotal(sale);
                        const rowShipping = saleReportShippingDisplay(sale);
                        const isSelected = selectedIndex === i || (selectedSale && selectedSale.sale_id === sale.sale_id);
                        const rowDelay = Math.min(i, 20) * 18;
                        return (
                          <tr
                            key={sale.sale_id}
                            ref={(el) => { rowRefs.current[i] = el; }}
                            tabIndex={0}
                            style={{ animationDelay: `${rowDelay}ms` }}
                            onClick={() => {
                              setSelectedSale(sale);
                              setSelectedIndex(i);
                              const el = rowRefs.current[i];
                              if (el?.focus) el.focus({ preventScroll: true });
                            }}
                            onDoubleClick={() => { setSelectedSale(sale); setShowDetailsModal(true); }}
                            className={`sales-report-row group cursor-pointer outline-none transition-colors duration-150 ${
                              isSelected ? 'ring-2 ring-inset ring-blue-500/70' : ''
                            }`}
                          >
                            <td className={`${tdTextCell} text-center text-[11px] font-semibold text-slate-500 ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>{i + 1}</td>
                            <td className={`${tdTextCell} ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>{formatDatePK(sale.created_at)}</td>
                            <td className={`${tdNum} text-left font-bold text-slate-900 ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>{sale.sale_id}</td>
                            <td className={`${tdTextCell} !leading-snug ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>
                              <span className="block truncate font-medium text-slate-800 leading-tight py-1" title={sale.customer?.cus_name || ''}>
                                {sale.customer?.cus_name || 'N/A'}
                              </span>
                            </td>
                            <td className={`${tdNum} text-center ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>
                              <span className="inline-flex min-w-[1.5rem] justify-center rounded-sm border border-slate-300 bg-white px-1 text-[11px] font-bold text-slate-700 leading-none py-0.5">
                                {sale.sale_details?.length || 0}
                              </span>
                            </td>
                            <td className={`${tdNum} ${colAmt} ${isSelected ? rowSelected : ''}`}>{formatCurrency(rowSubtotal)}</td>
                            <td className={`${tdNum} ${colDisc} hidden sm:table-cell ${isSelected ? rowSelected : ''}`}>{formatCurrency(sale.discount)}</td>
                            <td className={`${tdNum} ${colShip} hidden sm:table-cell ${isSelected ? rowSelected : ''}`}>{formatCurrency(rowShipping)}</td>
                            <td className={`${tdNum} ${colNet} ${isSelected ? rowSelected : ''}`}>{formatCurrency(netTotal)}</td>
                            <td className={`${tdTextCell} text-center ${isSelected ? rowSelected : i % 2 === 0 ? rowEven : rowOdd}`}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); setShowDetailsModal(true); }}
                                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800 bg-white border border-indigo-300 rounded hover:bg-indigo-700 hover:text-white transition-colors"
                              >
                                {sale.bill_type}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                        </tbody>
                      </table>
                    </div>

                    <table aria-label="Sales by date totals" className={`${ledgerTableClass} border-t-2 border-slate-500 mt-2`}>
                      <LedgerColgroup />
                      <tfoot>
                        <tr className="font-bold h-[38px]">
                          <td colSpan={5} className={`${tdTextCell} !h-[38px] !leading-[38px] text-right uppercase text-[11px] tracking-wider bg-slate-300/90 text-slate-900`}>
                            Total
                          </td>
                          <td className={`${tdNum} !h-[38px] !leading-[38px] bg-indigo-100 text-indigo-950`}>{formatCurrency(salesData.summary.totalAmount)}</td>
                          <td className={`${tdNum} !h-[38px] !leading-[38px] bg-rose-100 text-rose-900 hidden sm:table-cell`}>{formatCurrency(salesData.summary.totalDiscount)}</td>
                          <td className={`${tdNum} !h-[38px] !leading-[38px] bg-sky-100 text-sky-950 hidden sm:table-cell`}>{formatCurrency(salesData.summary.totalShipping)}</td>
                          <td className={`${tdNum} !h-[38px] !leading-[38px] bg-emerald-200/90 text-emerald-950`}>{formatCurrency(salesData.summary.netTotal)}</td>
                          <td className={`${tdTextCell} !h-[38px] bg-slate-300/90`} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
              <p className="print:hidden text-[11px] text-slate-500 px-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 opacity-60" />
                {LEDGER_VISIBLE_ROWS} rows visible · scroll for more · Click row · Double-click or Enter for invoice · ↑↓ to navigate
              </p>
            </div>

            {/* Print Footer - Only show on print */}
            <div className="hidden print:block mt-8 pt-4 border-t-2 border-gray-800">
              <div className="text-center">
                <p className="text-gray-700 font-semibold">Ittefaq Iron and Cement Store</p>
                <p className="text-gray-600 text-sm">Address: Parianwali | Phone: +92 346 7560306</p>
                <p className="text-gray-500 text-xs mt-2">
                  This is a computer-generated report. No signature required.
                </p>
              </div>
            </div>
          </>
        )}

        {!salesData && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm rounded-2xl border border-slate-200/90 bg-white/90 px-8 py-10 shadow-sm">
              {loading ? (
                <div className="mx-auto h-10 w-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
              ) : (
                <Calendar className="mx-auto h-12 w-12 text-blue-400/80" />
              )}
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {loading ? 'Generating report…' : 'No report yet'}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                {loading
                  ? 'Fetching sales for your date range.'
                  : 'Choose dates above and click Generate to load the ledger.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .sales-report-scroll {
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 transparent;
        }
        .sales-report-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .sales-report-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sales-report-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #cbd5e1, #94a3b8);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .sales-report-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8, #64748b);
          background-clip: padding-box;
        }
        @keyframes salesReportRowIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .sales-report-row {
          animation: salesReportRowIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .sales-report-row {
            animation: none;
          }
          .sales-report-scroll {
            scroll-behavior: auto;
          }
        }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-size: 9px !important; background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sales-report-row { animation: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #64748b !important; padding: 3px 5px !important; }
          thead th { background: #e2e8f0 !important; position: static !important; }
          tfoot td { background: #cbd5e1 !important; font-weight: bold !important; }
          tr { page-break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}

