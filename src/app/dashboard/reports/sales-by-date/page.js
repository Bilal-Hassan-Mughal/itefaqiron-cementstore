'use client';

import { useState, useEffect, useRef } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { 
  Calendar,
  Download,
  Printer,
  ArrowLeft,
  Search,
  DollarSign,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck
} from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table as MuiTable, TableBody as MuiTableBody, TableCell as MuiTableCell, TableContainer as MuiTableContainer, TableHead as MuiTableHead, TableRow as MuiTableRow, Paper } from '@mui/material';
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
  const selectedSummaryRef = useRef(null);
  const pageContainerRef = useRef(null);
  const salesHeaderRef = useRef(null);
  const actionsRef = useRef(null);
  const [summaryFixedStyle, setSummaryFixedStyle] = useState(null);

  const ensureVisibleInContainer = (el, align = 'auto') => {
    const container = listContainerRef.current;
    if (!container || !el) return;
    const summaryOffset = (selectedSummaryRef.current && selectedSummaryRef.current.offsetHeight) || (summaryFixedStyle && summaryFixedStyle.estimatedHeight) || 0;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = container.scrollTop + 0;
    const viewBottom = container.scrollTop + container.clientHeight;

    const scrollTo = (top, smooth = false) => {
      try {
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight)), behavior: smooth ? 'smooth' : 'auto' });
        } else {
          container.scrollTop = Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));
        }
      } catch (err) {
        container.scrollTop = Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));
      }
    };

    if (align === 'start') {
      scrollTo(elTop - summaryOffset - 8);
    } else if (align === 'end') {
      scrollTo(elBottom - container.clientHeight + summaryOffset + 8);
    } else if (align === 'center') {
      scrollTo(elTop - Math.floor((container.clientHeight - el.offsetHeight) / 2) - summaryOffset, true);
    } else if (align === 'below') {
      // place the element just below the sticky summary
      scrollTo(elTop - summaryOffset - 8, true);
      // ensure we don't scroll past the bottom
      if (container.scrollTop + container.clientHeight > container.scrollHeight) {
        scrollTo(container.scrollHeight - container.clientHeight);
      }
    } else {
      // auto behavior
      if (elTop < viewTop + summaryOffset) {
        scrollTo(elTop - summaryOffset - 8, false);
      } else if (elBottom > viewBottom) {
        scrollTo(elBottom - container.clientHeight + 8, false);
      }
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
    const subtotal = parseFloat(sale.total_amount || 0) || 0;
    const discount = parseFloat(sale.discount || 0) || 0;
    const labour = parseFloat(sale.labour_charges || 0) || 0;
    const shipping = parseFloat(sale.shipping_amount || 0) || 0;
    const netTotal = subtotal - discount + labour + shipping;
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
  const formatNumber = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Estimate summary height from number of product rows (used as fallback before measured height)
  const getEstimatedHeight = (sale) => {
    const rows = (sale?.sale_details || sale?.details || sale?.items || []).length || 0;
    return Math.min(320, rows * 34 + 84);
  };

  // Fallback style used while measured summary style isn't available yet
  const fallbackSummaryStyle = selectedSale ? {
    top: `96px`,
    left: `16px`,
    width: `960px`,
    height: `${getEstimatedHeight(selectedSale)}px`,
    estimatedHeight: getEstimatedHeight(selectedSale),
    placedAbove: false
  } : null;

  useEffect(() => {
    const updateFixedStyle = () => {
      const container = pageContainerRef.current;
      if (!container) {
        setSummaryFixedStyle(null);
        return;
      }
      const header = salesHeaderRef.current; // header may be hidden when a sale is selected
      const headerRect = header ? header.getBoundingClientRect() : container.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Estimate summary height (rows * approx height + header). This avoids measuring a hidden element.
      const rows = (selectedSale?.sale_details || selectedSale?.details || selectedSale?.items || []).length || 0;
      const estimatedHeight = Math.min(320, rows * 34 + 84); // clamp to reasonable max

      // Position the fixed summary under the action buttons (Export/Print) but span main content width for readability
      const actionsEl = actionsRef.current;
      let top = 8;
      let left = containerRect.left + 16; // small left gutter inside page container
      let width = Math.min(containerRect.width - 32, 960); // cap width for readability
      if (actionsEl) {
        const aRect = actionsEl.getBoundingClientRect();
        top = Math.max(8, aRect.bottom + 8);
        // position the summary under the actions but keep it wide enough for product details
        left = containerRect.left + 16;
        width = Math.min(containerRect.width - 32, 960);
      } else {
        // fallback: place below header and full content width
        top = Math.max(8, headerRect.bottom + 8);
        left = containerRect.left + 16;
        width = Math.min(containerRect.width - 32, 960);
      }
      // ensure list container has padding so the fixed summary doesn't cover the top rows
      const listCont = listContainerRef.current;
      if (listCont) listCont.style.paddingTop = `${estimatedHeight + 16}px`;
      const placedAbove = false;
      setSummaryFixedStyle({ top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${estimatedHeight}px`, estimatedHeight, placedAbove });
    };

    updateFixedStyle();
    window.addEventListener('resize', updateFixedStyle);
    window.addEventListener('scroll', updateFixedStyle, true);
    return () => {
      window.removeEventListener('resize', updateFixedStyle);
      window.removeEventListener('scroll', updateFixedStyle, true);
    };
  }, [selectedSale]);

  // Measure actual summary height after render and update style so padding follows real content height
  useEffect(() => {
    if (!selectedSale) return;
    const el = selectedSummaryRef.current;
    if (!el) return;

    // animate the summary content for smooth transitions when user navigates between sales
    try {
      el.style.transition = 'opacity 180ms ease, transform 180ms ease, max-height 260ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    } catch (err) {
      /* ignore DOM styling errors */
    }

    const setMeasuredHeight = () => {
      const h = el.offsetHeight;
      setSummaryFixedStyle((s) => (s ? { ...s, height: `${h}px`, estimatedHeight: h } : s));
    };

    // reset inner product list scroll to top for a smoother flow
    const innerScroll = el.querySelector('.overflow-auto');
    if (innerScroll && typeof innerScroll.scrollTo === 'function') {
      try { innerScroll.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { innerScroll.scrollTop = 0; }
    }

    setMeasuredHeight();
    const ro = new ResizeObserver(setMeasuredHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      try { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; } catch (e) {}
    };
  }, [selectedSale]);

  // Apply padding to the scrollable list so the fixed summary never covers the header/rows
  useEffect(() => {
    const applyPadding = () => {
      const container = listContainerRef.current;
      const pageContainer = pageContainerRef.current;
      if (!container) return;
      if (selectedSale) {
        const measured = selectedSummaryRef.current ? selectedSummaryRef.current.offsetHeight : (summaryFixedStyle ? summaryFixedStyle.estimatedHeight : getEstimatedHeight(selectedSale));
        const pad = (measured || 0) + 16;
        // animate padding change for a smooth flow
        container.style.transition = 'padding-top 220ms ease';
        container.style.paddingTop = `${pad}px`;
      } else {
        container.style.transition = 'padding-top 220ms ease';
        container.style.paddingTop = '';
        if (pageContainer) pageContainer.style.paddingTop = '';
      }
    };

    applyPadding();
    window.addEventListener('resize', applyPadding);
    return () => window.removeEventListener('resize', applyPadding);
  }, [selectedSale, summaryFixedStyle]);

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
    if (el && el.focus) {
      // focus without browser auto-scroll, then ensure visibility inside the inner scrollable list
      el.focus({ preventScroll: true });
      ensureVisibleInContainer(el, 'below');
    }
  };

  const computeHeaderTop = () => {
    const measured = selectedSummaryRef.current
      ? selectedSummaryRef.current.offsetHeight
      : (summaryFixedStyle ? summaryFixedStyle.estimatedHeight : (selectedSale ? getEstimatedHeight(selectedSale) : 0));
    return measured ? measured + 16 : 0;
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
      const netTotal = parseFloat(sale.total_amount) - parseFloat(sale.discount) + parseFloat(sale.shipping_amount || 0);
      csv += `${sale.sale_id},${formatDatePK(sale.created_at)},${sale.customer?.cus_name || 'N/A'},${sale.sale_details?.length || 0},${fmtAmt(sale.total_amount)},${fmtAmt(sale.discount)},${fmtAmt(sale.shipping_amount)},${fmtAmt(netTotal)},${fmtAmt(sale.payment)},${sale.bill_type}\n`;
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

  return (
    <DashboardLayout>
      <div id="printable-report" className="h-full flex flex-col overflow-hidden print:overflow-visible">
        {/* Header - Hide on print */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard/reports')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Sales Report (By Date)</h2>
                <p className="text-gray-600 mt-1">View sales transactions within a date range</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters - Hide on print */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchReport}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-2 rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Generate Report'}
                </button>
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

            {/* Action Buttons - Hide on print */}
            <div ref={actionsRef} className="flex-shrink-0 mb-4 print:hidden">
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
              </div>
            </div>

            {/* Selected Sale Summary (products only) - moved into scrollable area to stay fixed */}

            {/* Sale details modal (match Sales page invoice format) */}
            <Dialog open={showDetailsModal} onClose={() => setShowDetailsModal(false)} maxWidth="lg" fullWidth>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'primary.main', color: 'white', py: 2, px: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Bill Details - #{selectedSale?.sale_id}</Typography>
                <Button size="small" onClick={() => setShowDetailsModal(false)} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}>Close</Button>
              </DialogTitle>
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
            {/* Sales Table */}
            <div className="flex-1 min-h-0 print:min-h-0 print:block">
              <div ref={pageContainerRef} className="bg-white rounded-lg shadow print:shadow-none print:border print:border-gray-300 h-full flex flex-col print:block">
                {!selectedSale && (
                  <div ref={salesHeaderRef} className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Sales Transactions</h3>
                  </div>
                )}
                
                <div ref={listContainerRef} tabIndex={0} onKeyDown={handleListKeyDown} className="flex-1 overflow-auto print:overflow-visible print:block">
                  {/* Selected Sale Summary (fixed under action buttons) */}
                  {selectedSale && (
                    <div
                      ref={selectedSummaryRef}
                      role="region"
                      aria-labelledby={`sale-summary-${selectedSale.sale_id}`}
                      style={{ position: 'fixed', zIndex: 90, boxSizing: 'border-box', paddingRight: 96, boxShadow: '0 10px 30px rgba(220,38,38,0.12)', ...(summaryFixedStyle || fallbackSummaryStyle), height: 'auto', maxHeight: '60vh' }}
                      className="mb-4 bg-white rounded-2xl border-4 border-red-700 p-5 print:hidden overflow-visible">
                      <div aria-hidden="true" className="absolute left-0 top-0 h-full w-1 bg-red-700 rounded-l-2xl" />

                      <button
                        onClick={() => { setSelectedSale(null); setSelectedIndex(null); }}
                        aria-label="Close sale summary"
                        className="absolute right-4 top-4 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        ✕
                      </button>

                      <div className="pl-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div id={`sale-summary-${selectedSale.sale_id}`} className="text-2xl md:text-3xl font-extrabold text-gray-900">Bill: #{selectedSale.sale_id}</div>
                            <div className="text-sm text-gray-500 mt-1">{selectedSale.customer?.cus_name || '-'}</div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-2">
                            <div className="flex items-center gap-3">
                              <div className="bg-red-50 border border-red-100 text-red-800 px-3 py-2 rounded-lg shadow-sm text-center min-w-[76px]">
                                <div className="text-xs text-gray-500">Total Qty</div>
                                <div className="text-base md:text-lg font-extrabold">{fmtAmt(selectedTotals?.totalQty || 0)}</div>
                              </div>
                              <div className="bg-red-100 border border-red-200 text-red-900 px-3 py-2 rounded-lg shadow-sm text-center min-w-[120px]">
                                <div className="text-xs text-gray-500">Total Amount</div>
                                <div className="text-lg md:text-2xl font-extrabold">Rs. {((selectedTotals && selectedTotals.netTotal) || parseFloat(selectedSale.total_amount || 0)).toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-auto rounded-md border border-gray-100" style={{ maxHeight: '60vh' }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-3 py-2 text-left text-sm font-semibold">S#</th>
                                <th className="px-3 py-2 text-left text-sm font-semibold">Product</th>
                                <th className="px-3 py-2 text-right text-sm font-semibold">Qty</th>
                                <th className="px-3 py-2 text-right text-sm font-semibold">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(selectedSale.sale_details || selectedSale.details || selectedSale.items || []).map((d, i) => (
                                <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                  <td className="px-3 py-2 text-sm text-gray-700">{i + 1}</td>
                                  <td className="px-3 py-2 text-sm text-gray-800" style={{maxWidth:360, whiteSpace:'normal', wordBreak:'break-word', overflowWrap: 'anywhere'}}>{d.product?.pro_title || d.product_name || '-'}</td>
                                  <td className="px-3 py-2 text-sm text-right font-semibold">{fmtAmt(parseFloat(d.qnty || 0) || 0)}</td>
                                  <td className="px-3 py-2 text-sm text-right">{fmtAmt(parseFloat(d.total_amount || d.amount || 0) || 0)}</td>
                                </tr>
                              ))}

                              {/* Totals row aligned under Qty and Amount columns */}
                              {((selectedSale.sale_details || selectedSale.details || selectedSale.items || []).length > 0) && (
                                <tr className="bg-red-50 border-t border-red-100">
                                  <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-red-800">TOTAL</td>
                                  <td className="px-3 py-3 text-sm text-right font-extrabold text-red-800 text-lg">{fmtAmt(selectedTotals?.totalQty || 0)}</td>
                                  <td className="px-3 py-3 text-sm text-right font-extrabold text-red-800 text-lg">Rs. {fmtAmt(selectedTotals?.lineItemsTotal || 0)}</td>
                                </tr>
                              )}

                              {((selectedSale.sale_details || selectedSale.details || selectedSale.items || []).length === 0) && (
                                <tr><td colSpan="4" className="px-3 py-6 text-center text-gray-500">No items for this sale</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  <table aria-label="Sales by date report" className="min-w-full divide-y divide-gray-200 print:block print:table">
                    {!selectedSale && (
                      <thead className="bg-white sticky print:relative shadow-sm" style={{ top: `${computeHeaderTop()}px`, zIndex: 40 }}>
                      <tr>
                        <th scope="col" className="px-6 py-4 w-36 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-6 py-4 w-28 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sale ID</th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                        <th scope="col" className="px-6 py-4 w-20 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                        <th scope="col" className="px-6 py-4 w-32 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                        <th scope="col" className="px-6 py-4 w-28 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Discount</th>
                        <th scope="col" className="px-6 py-4 w-28 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Shipping</th>
                        <th scope="col" className="px-6 py-4 w-32 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Net Total</th>
                        <th scope="col" className="px-6 py-4 w-24 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                      </tr>
                    </thead>
                    )}
                    <tbody className="bg-white divide-y divide-gray-200">
                          {salesData.sales.map((sale, i) => {
                        const netTotal = (parseFloat(sale.total_amount) || 0) - (parseFloat(sale.discount) || 0) + (parseFloat(sale.shipping_amount || 0) || 0);
                        return (
                          <tr
                            key={sale.sale_id}
                            ref={(el) => (rowRefs.current[i] = el)}
                            tabIndex={0}
                            onClick={() => { setSelectedSale(sale); setSelectedIndex(i); const el = rowRefs.current[i]; if (el && el.focus) { el.focus({ preventScroll: true }); ensureVisibleInContainer(rowRefs.current[i], 'below'); } }}
                            className={`hover:bg-gray-50 print:hover:bg-white cursor-pointer transition-colors duration-150 ${selectedIndex === i || (selectedSale && selectedSale.sale_id === sale.sale_id) ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}
                          >
                            <td className="px-6 py-5 align-middle text-sm text-gray-900">
                              {formatDatePK(sale.created_at)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-gray-900">
                              {sale.sale_id.toString().slice(-8)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-gray-900">
                              {sale.customer?.cus_name || 'N/A'}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-center text-gray-900">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                {sale.sale_details?.length || 0}
                              </span>
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-right text-gray-900 font-medium">
                              {formatCurrency(sale.total_amount)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-right text-red-600 hidden sm:table-cell">
                              {formatCurrency(sale.discount)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-right text-blue-600 hidden sm:table-cell">
                              {formatCurrency(sale.shipping_amount || 0)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-right font-semibold text-green-600">
                              {formatCurrency(netTotal)}
                            </td>
                            <td className="px-6 py-5 align-middle text-sm text-center text-gray-900">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); setShowDetailsModal(true); }}
                                className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 hover:opacity-90"
                                title={`View bill ${sale.sale_id}`}>
                                {sale.bill_type}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-700">TOTAL:</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(salesData.summary.totalAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 hidden sm:table-cell">{formatCurrency(salesData.summary.totalDiscount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 hidden sm:table-cell">{formatCurrency(salesData.summary.totalShipping)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">{formatCurrency(salesData.summary.netTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
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

        {!salesData && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Report Generated</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select a date range and click &quot;Generate Report&quot; to view data
              </p>
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

