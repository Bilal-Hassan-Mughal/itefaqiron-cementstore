'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Package,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertTriangle,
  Printer,
  ArrowLeft,
  ArrowRight,
  Search,
  BarChart3,
  PieChart,
  RefreshCw,
  Calculator,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Wallet,
  Building2,
  Check,
  Info,
  Scale,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ShieldCheck,
  Layers
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

const formatCurrency = (val) => {
  const n = parseFloat(val || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DayEndPage() {
  // Main states
  const [dayEndData, setDayEndData] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [accountBalances, setAccountBalances] = useState(null);
  const [summary, setSummary] = useState(null);
  const [last7DaysTrend, setLast7DaysTrend] = useState([]);
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [stockSummary, setStockSummary] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDenominations, setShowDenominations] = useState(false);

  // Form states
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState([
    { id: 1, title: 'All Sales Invoices are entered', status: 'Completed' },
    { id: 2, title: 'All Sales Returns are entered', status: 'Completed' },
    { id: 3, title: 'All Purchase Bills are entered', status: 'Completed' },
    { id: 4, title: 'All Purchase Returns are entered', status: 'Completed' },
    { id: 5, title: 'All Receipts are entered in Cash/Bank', status: 'Completed' },
    { id: 6, title: 'All Payments are entered in Cash/Bank', status: 'Completed' },
    { id: 7, title: 'Cash Count is Completed', status: 'Pending' },
    { id: 8, title: 'Bank Reconciliation is Completed', status: 'Pending' },
    { id: 9, title: 'All Adjustments are Completed', status: 'Completed' }
  ]);

  // Cash Denomination Calculator
  const [denominations, setDenominations] = useState({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0
  });

  const totalDenominationAmount = useMemo(() => {
    return (
      (denominations[5000] || 0) * 5000 +
      (denominations[1000] || 0) * 1000 +
      (denominations[500] || 0) * 500 +
      (denominations[100] || 0) * 100 +
      (denominations[50] || 0) * 50 +
      (denominations[20] || 0) * 20 +
      (denominations[10] || 0) * 10 +
      parseFloat(denominations.coins || 0)
    );
  }, [denominations]);

  const applyDenominations = () => {
    setClosingCash(totalDenominationAmount.toString());
    // Also mark Cash Count checklist task as completed
    setChecklist(prev => prev.map(item => item.id === 7 ? { ...item, status: 'Completed' } : item));
    setShowDenominations(false);
  };

  const toggleChecklist = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, status: item.status === 'Completed' ? 'Pending' : 'Completed' } : item
    ));
  };

  const markAllChecklistCompleted = () => {
    setChecklist(prev => prev.map(item => ({ ...item, status: 'Completed' })));
  };

  // Fetch day end data
  const fetchDayEndData = async (date = selectedDate) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/day-end?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setDayEndData(data.dayEnd);
        setTransactions(data.transactions);
        setAccountBalances(data.accountBalances);
        setSummary(data.summary);
        setLast7DaysTrend(data.last7DaysTrend || []);
        setTopSellingItems(data.topSellingItems || []);
        setStockSummary(data.stockSummary || null);

        if (data.checklistStatus) setChecklist(data.checklistStatus);

        setOpeningCash(data.summary?.openingCash?.toString() || '0');
        setClosingCash(data.dayEnd?.closing_cash !== null && data.dayEnd?.closing_cash !== undefined ? data.dayEnd.closing_cash?.toString() : '');
        setNotes(data.dayEnd?.notes || '');
      }
    } catch (error) {
      console.error('Error fetching day end data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayEndData(selectedDate);
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Close Day / Save Action
  const handleCloseDay = async () => {
    if (closingCash === '' || closingCash === null) {
      alert('Please enter physical closing cash amount before closing the day.');
      return;
    }

    if (!window.confirm('Are you sure you want to CLOSE the day? This will record physical closing balances.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/day-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_date: selectedDate,
          opening_cash: openingCash,
          closing_cash: closingCash,
          notes: notes,
          action: 'CLOSE_DAY'
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.warning ? `Day Closed Successfully!\n\n${data.warning}` : 'Day Closed Successfully!');
        fetchDayEndData(selectedDate);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to close day');
      }
    } catch (error) {
      console.error('Error closing day:', error);
      alert('Failed to close day');
    } finally {
      setSaving(false);
    }
  };

  // Re-open Day
  const handleReopenDay = async () => {
    if (window.confirm('Are you sure you want to RE-OPEN this business day? This will allow edits to day-end figures.')) {
      try {
        setSaving(true);
        const response = await fetch('/api/day-end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_date: selectedDate,
            notes: notes,
            action: 'REOPEN_DAY'
          })
        });

        if (response.ok) {
          alert('Day re-opened successfully!');
          fetchDayEndData(selectedDate);
        } else {
          const err = await response.json();
          alert(err.error || 'Failed to re-open day');
        }
      } catch (error) {
        console.error('Error re-opening day:', error);
        alert('Failed to re-open day');
      } finally {
        setSaving(false);
      }
    }
  };

  const isClosed = dayEndData?.status === 'CLOSED';

  // SVG Chart Maximum calculation for Sales vs Purchases line chart
  const maxTrendVal = useMemo(() => {
    if (!last7DaysTrend.length) return 100;
    const maxVal = Math.max(...last7DaysTrend.map(t => Math.max(t.sales, t.purchases)));
    return maxVal > 0 ? maxVal * 1.15 : 100;
  }, [last7DaysTrend]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-100/70 p-4 md:p-6 space-y-6 text-slate-800 font-sans">

        {/* ---------------------------------------------------- */}
        {/* TOP HEADER & CONTROLS */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Day End Closing
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Dashboard &gt; Day End Closing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1 space-x-1">
              <button
                onClick={handlePrevDay}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-600"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-1 px-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-none cursor-pointer py-1"
                />
              </div>
              <button
                onClick={handleNextDay}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-600"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleToday}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              Today
            </button>

            {/* Status Badge */}
            <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1.5 border ${
              isClosed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Status: {isClosed ? 'Closed' : 'Not Closed'}</span>
            </div>

            {/* Main Action Button */}
            {isClosed ? (
              <button
                onClick={handleReopenDay}
                disabled={saving}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center space-x-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Re-Open Day End</span>
              </button>
            ) : (
              <button
                onClick={handleCloseDay}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>{saving ? 'Closing...' : 'Start Day End Closing'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 1: 5 METRIC CARDS */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total Sales */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Sales</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Rs. {formatCurrency(summary?.totalSales)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Invoices: {summary?.invoicesCount || transactions?.sales?.length || 0}</p>
            </div>
          </div>

          {/* Card 2: Total Receipts */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Receipts</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Rs. {formatCurrency(summary?.totalReceipts)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Entries: {summary?.receiptsCount || 0}</p>
            </div>
          </div>

          {/* Card 3: Total Purchases */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Purchases</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Rs. {formatCurrency(summary?.totalPurchases)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Bills: {summary?.billsCount || transactions?.purchases?.length || 0}</p>
            </div>
          </div>

          {/* Card 4: Total Payments */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Payments</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Rs. {formatCurrency(summary?.totalPayments)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Entries: {summary?.paymentsCount || 0}</p>
            </div>
          </div>

          {/* Card 5: Closing Balance */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Closing Balance</p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                Rs. {formatCurrency(summary?.closingBalance || summary?.expectedCashInHand)}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">As on {formatDate(selectedDate)}</p>
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 2: PROFIT SUMMARY & CASH SUMMARY CARDS */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Profit Summary Card (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Profit Summary</h2>
            </div>

            <div className="space-y-6">
              {/* Row 1: Sales - Purchases = Gross Profit */}
              <div className="grid grid-cols-5 items-center text-center gap-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/50">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Total Sales</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(summary?.totalSales)}</p>
                </div>
                <div className="text-slate-400 font-bold text-lg">-</div>
                <div>
                  <p className="text-xs font-semibold text-amber-600">Total Purchases</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(summary?.totalPurchases)}</p>
                </div>
                <div className="text-slate-400 font-bold text-lg">=</div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600">Gross Profit</p>
                  <p className="text-base font-black text-emerald-700 mt-1">Rs. {formatCurrency(summary?.grossProfit)}</p>
                </div>
              </div>

              {/* Row 2: Other Income - Other Expenses = Net Profit */}
              <div className="grid grid-cols-5 items-center text-center gap-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/50">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Other Income</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. 0.00</p>
                </div>
                <div className="text-slate-400 font-bold text-lg">-</div>
                <div>
                  <p className="text-xs font-semibold text-rose-600">Other Expenses</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(summary?.totalExpenses)}</p>
                </div>
                <div className="text-slate-400 font-bold text-lg">=</div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600">Net Profit</p>
                  <p className="text-base font-black text-emerald-700 mt-1">Rs. {formatCurrency(summary?.netProfit)}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">Profit Margin: {summary?.profitMargin || 0}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Summary Card (1 Col) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">Cash Summary</h2>
            </div>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Opening Cash</span>
                <span className="font-bold text-slate-900">Rs. {formatCurrency(summary?.openingCash)}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Total Cash Inflow (Sales + Receipts)</span>
                <span className="font-bold text-emerald-600">Rs. {formatCurrency(summary?.totalCashInflow)}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Total Cash Outflow (Purchases + Payments + Expenses)</span>
                <span className="font-bold text-rose-600">Rs. {formatCurrency(summary?.totalCashOutflow)}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-2 bg-blue-50/80 px-3 rounded-xl border border-blue-200/60 mt-2">
                <span className="font-extrabold text-blue-900">Expected Cash In Hand</span>
                <span className="font-black text-sm text-blue-700">Rs. {formatCurrency(summary?.expectedCashInHand)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 3: CHECKLIST & STOCK SUMMARY vs BANK SUMMARY & ACTION */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Cols: Checklist & Stock Summary */}
          <div className="lg:col-span-2 space-y-6">

            {/* Day End Closing Checklist Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Day End Closing Checklist
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={markAllChecklistCompleted}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark All Completed
                  </button>
                  <button
                    onClick={() => fetchDayEndData(selectedDate)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Task Description</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checklist.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => toggleChecklist(item.id)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-400">{item.id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.title}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            item.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Summary Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                  Stock Summary <span className="text-xs font-semibold text-slate-400">(Main Warehouse)</span>
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">Opening Stock Value</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(stockSummary?.openingStockValue)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">Inward Value (Purchases)</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(stockSummary?.inwardValue)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">Outward Value (Sales)</p>
                  <p className="text-sm font-black text-slate-900 mt-1">Rs. {formatCurrency(stockSummary?.outwardValue)}</p>
                </div>
                <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200/60">
                  <p className="text-xs font-semibold text-indigo-900">Closing Stock Value</p>
                  <p className="text-sm font-black text-indigo-700 mt-1">Rs. {formatCurrency(stockSummary?.closingStockValue)}</p>
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3 text-xs text-blue-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Note: Stock is calculated on FIFO Costing Method.</span>
              </div>
            </div>

          </div>

          {/* Right 1 Col: Bank Summary & Day End Action */}
          <div className="space-y-6">

            {/* Bank Summary & Multi-Bank Accounts Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" />
                  Bank Summary
                </h2>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  Total: Rs. {formatCurrency(summary?.totalBankAccountsBalance)}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-600">Opening Bank</span>
                  <span className="font-bold text-slate-900">Rs. {formatCurrency(summary?.totalBankAccountsBalance)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-600">Total Bank Receipts</span>
                  <span className="font-bold text-slate-900">Rs. {formatCurrency(summary?.bankReceipts)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-600">Total Bank Payments</span>
                  <span className="font-bold text-slate-900">Rs. {formatCurrency(summary?.bankPayments + summary?.bankPurchases)}</span>
                </div>
                <div className="flex justify-between py-2 bg-indigo-50/80 px-3 rounded-xl border border-indigo-200/60 mt-2">
                  <span className="font-extrabold text-indigo-900">Closing Bank</span>
                  <span className="font-black text-sm text-indigo-700">Rs. {formatCurrency(summary?.totalBankAccountsBalance)}</span>
                </div>
              </div>

              {/* Itemized Bank Accounts List */}
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">Individual Bank Accounts</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {accountBalances?.bankAccounts?.map(acc => (
                    <div key={acc.cus_id} className="flex justify-between items-center text-xs py-1.5 px-3 bg-slate-50 rounded-lg hover:bg-indigo-50/50 transition-colors border border-slate-100">
                      <span className="font-medium text-slate-800">{acc.cus_name}</span>
                      <span className="font-bold text-indigo-700">Rs. {formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  {(!accountBalances?.bankAccounts || accountBalances.bankAccounts.length === 0) && (
                    <p className="text-xs text-slate-400 text-center py-2">No bank accounts found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Day End Closing Action Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-slate-700" />
                  Day End Closing Action
                </h2>
              </div>

              <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Please ensure all the above tasks are completed before closing the day.</span>
              </div>

              {/* Physical Cash Input & Calculator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Actual Physical Closing Cash:</label>
                  <button
                    onClick={() => setShowDenominations(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Calculator className="w-3.5 h-3.5" /> Physical Cash Counter
                  </button>
                </div>
                <input
                  type="number"
                  placeholder="Enter physical cash amount"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  disabled={isClosed}
                  className="w-full p-2.5 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 disabled:bg-slate-100"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Remarks (Optional):</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isClosed}
                  rows={2}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 disabled:bg-slate-100"
                  placeholder="Enter any remarks..."
                />
              </div>

              {/* Close Day Button */}
              {isClosed ? (
                <button
                  onClick={handleReopenDay}
                  disabled={saving}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center space-x-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Re-Open Day</span>
                </button>
              ) : (
                <button
                  onClick={handleCloseDay}
                  disabled={saving}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{saving ? 'Closing Day...' : 'Close Day'}</span>
                </button>
              )}

            </div>

          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* ROW 4: OVERVIEW, CHART & TOP SELLING ITEMS */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Day End Closing Overview
            </h2>
          </div>

          {/* Mini KPI Chips */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-blue-50 text-blue-900 px-3.5 py-2 rounded-xl border border-blue-200/60">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold">Total Sales:</span>
              <span className="text-xs font-black">Rs. {formatCurrency(summary?.totalSales)}</span>
            </div>
            <div className="flex items-center space-x-2 bg-amber-50 text-amber-900 px-3.5 py-2 rounded-xl border border-amber-200/60">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold">Total Purchases:</span>
              <span className="text-xs font-black">Rs. {formatCurrency(summary?.totalPurchases)}</span>
            </div>
            <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-900 px-3.5 py-2 rounded-xl border border-emerald-200/60">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold">Gross Profit:</span>
              <span className="text-xs font-black">Rs. {formatCurrency(summary?.grossProfit)}</span>
            </div>
            <div className="flex items-center space-x-2 bg-teal-50 text-teal-900 px-3.5 py-2 rounded-xl border border-teal-200/60">
              <DollarSign className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold">Net Profit:</span>
              <span className="text-xs font-black">Rs. {formatCurrency(summary?.netProfit)}</span>
            </div>
            <div className="flex items-center space-x-2 bg-purple-50 text-purple-900 px-3.5 py-2 rounded-xl border border-purple-200/60">
              <PieChart className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold">Profit Margin:</span>
              <span className="text-xs font-black">{summary?.profitMargin || 0}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales vs Purchases (Last 7 Days) SVG Line Chart */}
            <div className="lg:col-span-2 bg-slate-50/80 p-4 rounded-xl border border-slate-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Sales vs Purchases (Last 7 Days)
                </h3>
                <div className="flex items-center space-x-4 text-xs font-bold">
                  <span className="flex items-center text-blue-600">
                    <span className="w-3 h-3 bg-blue-600 rounded-full mr-1.5 inline-block" /> Sales
                  </span>
                  <span className="flex items-center text-amber-500">
                    <span className="w-3 h-3 bg-amber-500 rounded-full mr-1.5 inline-block" /> Purchases
                  </span>
                </div>
              </div>

              {/* Chart SVG */}
              <div className="h-56 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <line x1="0" y1="160" x2="500" y2="160" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Chart Points & Lines */}
                  {last7DaysTrend.length > 0 && (() => {
                    const pointsSales = last7DaysTrend.map((t, idx) => {
                      const x = (idx / (last7DaysTrend.length - 1)) * 500;
                      const y = 160 - (t.sales / maxTrendVal) * 140;
                      return `${x},${y}`;
                    }).join(' ');

                    const pointsPurchases = last7DaysTrend.map((t, idx) => {
                      const x = (idx / (last7DaysTrend.length - 1)) * 500;
                      const y = 160 - (t.purchases / maxTrendVal) * 140;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        {/* Sales Line */}
                        <polyline
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="3"
                          strokeLinecap="round"
                          points={pointsSales}
                        />

                        {/* Purchases Line */}
                        <polyline
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3"
                          strokeLinecap="round"
                          points={pointsPurchases}
                        />

                        {/* Data Dots */}
                        {last7DaysTrend.map((t, idx) => {
                          const x = (idx / (last7DaysTrend.length - 1)) * 500;
                          const ySales = 160 - (t.sales / maxTrendVal) * 140;
                          const yPur = 160 - (t.purchases / maxTrendVal) * 140;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={ySales} r="4" fill="#2563eb" className="hover:r-6 transition-all" />
                              <circle cx={x} cy={yPur} r="4" fill="#f59e0b" className="hover:r-6 transition-all" />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[11px] font-bold text-slate-500 px-1 pt-1">
                {last7DaysTrend.map((t, idx) => (
                  <span key={idx}>{t.label}</span>
                ))}
              </div>
            </div>

            {/* Top Selling Items */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/60 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200/80 pb-2">
                Top Selling Items
              </h3>

              <div className="space-y-2">
                {topSellingItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-1.5 px-3 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="font-semibold text-slate-800">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="font-black text-slate-900">
                      Rs. {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
                {topSellingItems.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No sales recorded for this date</p>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* PHYSICAL CASH DENOMINATION MODAL */}
        {/* ---------------------------------------------------- */}
        {showDenominations && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Physical Cash Denomination Counter
                </h3>
                <button
                  onClick={() => setShowDenominations(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[5000, 1000, 500, 100, 50, 20, 10].map((denom) => (
                  <div key={denom} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700 w-16">Rs. {denom}:</span>
                    <input
                      type="number"
                      min="0"
                      value={denominations[denom] || ''}
                      onChange={(e) => setDenominations({ ...denominations, [denom]: parseInt(e.target.value) || 0 })}
                      className="w-20 p-1.5 text-right font-bold border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 w-16">Coins:</span>
                  <input
                    type="number"
                    min="0"
                    value={denominations.coins || ''}
                    onChange={(e) => setDenominations({ ...denominations, coins: parseFloat(e.target.value) || 0 })}
                    className="w-20 p-1.5 text-right font-bold border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
                <p className="text-xs font-semibold text-blue-900">Total Calculated Physical Cash</p>
                <h4 className="text-xl font-black text-blue-700 mt-1">
                  Rs. {formatCurrency(totalDenominationAmount)}
                </h4>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setShowDenominations(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={applyDenominations}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Apply Total to Closing Cash
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
