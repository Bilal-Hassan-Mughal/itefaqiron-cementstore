'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  Search,
  Banknote,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpDown,
  Filter,
  PlusCircle,
  MinusCircle,
  FileText,
  DollarSign,
  Star,
  Highlighter,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Map ledger amounts to correct debit/credit columns based on entry values
const getLedgerEntryDisplayAmounts = (entry) => {
  return {
    debit: parseFloat(entry.debit_amount || 0),
    credit: parseFloat(entry.credit_amount || 0)
  };
};

function excludeMemoFromBankCashSummary(entries) {
  return entries.filter((e) => {
    const det = e.details || '';
    if (!det.includes('no receivable change')) return true;
    const d = parseFloat(e.debit_amount || 0);
    const c = parseFloat(e.credit_amount || 0);
    if (d > 0 && c > 0 && Math.abs(d - c) < 0.02) return false;
    return true;
  });
}

export default function CashReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) or 'asc' (oldest first)
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'DEBIT', 'CREDIT'
  const [highlightedRowIds, setHighlightedRowIds] = useState(new Set());
  const [onlyHighlighted, setOnlyHighlighted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(u);
      } catch (e) {}
    }
  }, []);

  // Auto-fetch report when dates are set
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  const fetchReport = async () => {
    if (!startDate || !endDate) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=cash-report&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      if (response.ok) {
        let filteredData = { ...data };
        if (filteredData.ledgerEntries && Array.isArray(filteredData.ledgerEntries)) {
          filteredData.ledgerEntries = [...filteredData.ledgerEntries].sort((a, b) => {
            const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (timeDiff !== 0) return timeDiff;
            const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
            const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
            if (billA !== billB) return billA - billB;
            return a.l_id - b.l_id;
          });
        }
        setReportData(filteredData);
      }
    } catch (error) {
      console.error('Error fetching cash report:', error);
    } finally {
      setLoading(false);
    }
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

  const setDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'thisWeek') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];
      setStartDate(monday);
      setEndDate(today);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    }
  };

  const handleExport = () => {
    if (!reportData) return;
    let csv = 'CASH BOOK REPORT\n';
    csv += `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n\n`;
    csv += 'S.No,Date,Type,Account Title,Description,Bill No,Debit (Cash In),Credit (Cash Out),Running Balance\n';
    (reportData.ledgerEntries || []).forEach((entry, i) => {
      const displayAmts = getLedgerEntryDisplayAmounts(entry);
      const isDebit = displayAmts.debit > 0;
      csv += `${i + 1},${formatDate(entry.created_at)},${isDebit ? 'Cash In' : 'Cash Out'},"${entry.customer?.cus_name || '-'}","${entry.details || '-'}","${entry.bill_no || '-'}","${formatCurrency(displayAmts.debit)}","${formatCurrency(displayAmts.credit)}","${formatCurrency(entry.closing_balance)}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-book-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const openingBalance = reportData?.summary?.openingBalance !== undefined
    ? parseFloat(reportData.summary.openingBalance || 0)
    : (reportData?.ledgerEntries?.[0] ? parseFloat(reportData.ledgerEntries[0].opening_balance || 0) : 0);

  const closingBalance = reportData?.summary?.closingBalance !== undefined
    ? parseFloat(reportData.summary.closingBalance || 0)
    : (reportData?.ledgerEntries?.length > 0
        ? parseFloat(reportData.ledgerEntries[reportData.ledgerEntries.length - 1].closing_balance || 0)
        : openingBalance);

  const totalDebit = parseFloat(reportData?.summary?.totalLedgerDebit || 0);
  const totalCredit = parseFloat(reportData?.summary?.totalLedgerCredit || 0);
  const netCashFlow = totalDebit - totalCredit;

  const toggleHighlightRow = (l_id, e) => {
    if (e) e.stopPropagation();
    setHighlightedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(l_id)) {
        next.delete(l_id);
      } else {
        next.add(l_id);
      }
      return next;
    });
  };

  const clearHighlights = () => {
    setHighlightedRowIds(new Set());
    setOnlyHighlighted(false);
  };

  const renderHighlightedText = (text, query) => {
    if (text === null || text === undefined || text === '') return '-';
    const str = String(text);
    if (!query) return str;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = str.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded shadow-2xs">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Screen entries ordering & filtering
  const allEntries = reportData?.ledgerEntries || [];

  const filteredEntries = allEntries.filter((entry) => {
    const displayAmts = getLedgerEntryDisplayAmounts(entry);
    const matchesSearch =
      !searchQuery ||
      (entry.customer?.cus_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.bill_no || '').toString().toLowerCase().includes(searchQuery.toLowerCase());

    const isDebit = displayAmts.debit > 0;
    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'DEBIT' && isDebit) ||
      (typeFilter === 'CREDIT' && !isDebit);

    const matchesHighlight = !onlyHighlighted || highlightedRowIds.has(entry.l_id);

    return matchesSearch && matchesType && matchesHighlight;
  });

  const displayedEntries = sortOrder === 'desc' ? [...filteredEntries].reverse() : filteredEntries;

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-slate-100 print:bg-white overflow-hidden">
        {/* Screen Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-6 py-4 shadow-md print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/reports')}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 border border-white/10"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                  <Banknote className="w-6 h-6 text-emerald-200" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">Cash Book Report</h1>
                  <p className="text-emerald-100/80 text-xs font-medium mt-0.5">Comprehensive cash inflows, outflows and running ledger</p>
                </div>
              </div>
            </div>
            {reportData && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm border border-emerald-400/30"
                >
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm border border-white/20"
                >
                  <Printer className="w-4 h-4 mr-2" /> Print Cash Book
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters & Control Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3.5 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Date Selector & Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl p-1.5 shadow-inner">
                <div className="flex items-center px-2">
                  <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dates:</span>
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="text-slate-400 text-xs px-1.5 font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setDatePreset('today')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${startDate === today && endDate === today ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDatePreset('yesterday')}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setDatePreset('thisWeek')}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                >
                  This Week
                </button>
                <button
                  onClick={() => setDatePreset('thisMonth')}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                >
                  This Month
                </button>
              </div>

              <button
                onClick={fetchReport}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                {loading ? 'Fetching...' : 'Generate Report'}
              </button>
            </div>

            {/* Right: Search & View Options */}
            {reportData && (
              <div className="flex items-center gap-2.5">
                {/* Type & Highlight Filters */}
                <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs gap-0.5">
                  <button
                    onClick={() => { setTypeFilter('ALL'); setOnlyHighlighted(false); }}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all ${typeFilter === 'ALL' && !onlyHighlighted ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => { setTypeFilter('DEBIT'); setOnlyHighlighted(false); }}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all ${typeFilter === 'DEBIT' && !onlyHighlighted ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    Cash In
                  </button>
                  <button
                    onClick={() => { setTypeFilter('CREDIT'); setOnlyHighlighted(false); }}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all ${typeFilter === 'CREDIT' && !onlyHighlighted ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}`}
                  >
                    Cash Out
                  </button>
                  <button
                    onClick={() => setOnlyHighlighted(prev => !prev)}
                    className={`px-3 py-1 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      onlyHighlighted
                        ? 'bg-amber-500 text-white shadow-xs'
                        : highlightedRowIds.size > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${onlyHighlighted ? 'fill-white text-white' : highlightedRowIds.size > 0 ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                    <span>Starred ({highlightedRowIds.size})</span>
                  </button>
                </div>

                {highlightedRowIds.size > 0 && (
                  <button
                    onClick={clearHighlights}
                    title="Clear all highlighted rows"
                    className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg border border-amber-200 transition-all flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Highlights</span>
                  </button>
                )}

                {/* Sort Order Toggle */}
                <button
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  title={`Click to sort ${sortOrder === 'desc' ? 'Oldest First' : 'Newest First'}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-all"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Report Body (Full Width Container) */}
        {reportData ? (
          <div className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
            <div className="w-full space-y-4">

              {/* Print Only Header */}
              <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
                <div className="text-center">
                  <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">ITTEFAQ IRON STORE</h1>
                  <p className="text-xs text-slate-600 font-medium">Parianwali, Pakistan | Tel: +92 346 7560306</p>
                  <div className="mt-2 py-1.5 bg-slate-900 text-white">
                    <h2 className="text-sm font-bold tracking-widest uppercase">CASH BOOK REPORT</h2>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    <span>Period:</span> {formatDate(startDate)} to {formatDate(endDate)}
                  </p>
                </div>
              </div>

              {/* 5 Stats Summary Cards (Screen View) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
                {/* 1. Opening Balance */}
                <div className="bg-gradient-to-br from-blue-100 to-indigo-200 text-indigo-900 rounded-2xl p-4 shadow-sm border border-blue-200/60 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Opening Balance (b/f)</p>
                    <div className="p-1.5 bg-indigo-200/60 rounded-lg">
                      <Banknote className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight mt-2">Rs. {formatCurrency(openingBalance)}</p>
                  <p className="text-[11px] text-indigo-400 mt-1 font-medium">Starting Balance</p>
                </div>

                {/* 2. Total Cash Receipts */}
                <div className="bg-gradient-to-br from-emerald-100 to-teal-200 text-teal-900 rounded-2xl p-4 shadow-sm border border-emerald-200/60 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-teal-500">Total Cash In (Debit)</p>
                    <div className="p-1.5 bg-teal-200/60 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-teal-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight mt-2">Rs. {formatCurrency(totalDebit)}</p>
                  <p className="text-[11px] text-teal-400 mt-1 font-medium">Receipts & Inflows</p>
                </div>

                {/* 3. Total Cash Payments */}
                <div className="bg-gradient-to-br from-rose-100 to-red-200 text-red-900 rounded-2xl p-4 shadow-sm border border-rose-200/60 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Total Cash Out (Credit)</p>
                    <div className="p-1.5 bg-rose-200/60 rounded-lg">
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight mt-2">Rs. {formatCurrency(totalCredit)}</p>
                  <p className="text-[11px] text-rose-400 mt-1 font-medium">Payments & Outflows</p>
                </div>

                {/* 4. Net Cash Flow */}
                <div className="bg-gradient-to-br from-purple-100 to-violet-200 text-violet-900 rounded-2xl p-4 shadow-sm border border-purple-200/60 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">Net Cash Flow</p>
                    <div className="p-1.5 bg-violet-200/60 rounded-lg">
                      <DollarSign className="w-4 h-4 text-violet-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight mt-2">
                    {netCashFlow >= 0 ? '+' : ''}Rs. {formatCurrency(netCashFlow)}
                  </p>
                  <p className="text-[11px] text-violet-400 mt-1 font-medium">Receipts − Payments</p>
                </div>

                {/* 5. Closing Balance */}
                <div className={`bg-gradient-to-br ${closingBalance >= 0 ? 'from-slate-100 to-slate-200' : 'from-amber-100 to-red-200'} ${closingBalance >= 0 ? 'text-slate-800' : 'text-red-900'} rounded-2xl p-4 shadow-sm border border-slate-200/60 relative overflow-hidden`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${closingBalance >= 0 ? 'text-slate-500' : 'text-red-500'}`}>Closing Balance</p>
                    <div className={`p-1.5 ${closingBalance >= 0 ? 'bg-slate-300/60' : 'bg-red-200/60'} rounded-lg`}>
                      <Banknote className={`w-4 h-4 ${closingBalance >= 0 ? 'text-slate-600' : 'text-red-600'}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight mt-2">Rs. {formatCurrency(closingBalance)}</p>
                  <p className={`text-[11px] ${closingBalance >= 0 ? 'text-slate-400' : 'text-red-400'} mt-1 font-medium`}>Net Running Balance</p>
                </div>
              </div>

              {/* Print Summary Table */}
              <div className="hidden print:block mb-4 border border-slate-900">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-slate-900">
                      <td className="p-2 font-bold border-r border-slate-900 bg-slate-100 w-1/4">Opening Balance (b/f):</td>
                      <td className="p-2 text-right border-r border-slate-900 w-1/4 font-black">{formatCurrency(openingBalance)}</td>
                      <td className="p-2 font-bold border-r border-slate-900 bg-slate-100 w-1/4">Total Cash In (Debit):</td>
                      <td className="p-2 text-right w-1/4 font-black text-emerald-800">{formatCurrency(totalDebit)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold border-r border-slate-900 bg-slate-100">Closing Balance:</td>
                      <td className="p-2 text-right border-r border-slate-900 font-black">{formatCurrency(closingBalance)}</td>
                      <td className="p-2 font-bold border-r border-slate-900 bg-slate-100">Total Cash Out (Credit):</td>
                      <td className="p-2 text-right font-black text-rose-800">{formatCurrency(totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SCREEN CASH LEDGER LIST TABLE */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:hidden">
                {/* Table Header Bar with Search & Counter */}
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Cash Transactions List
                    </h2>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {displayedEntries.length} {displayedEntries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  {/* Table Search Input */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search title, details, bill #..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Table Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-100 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-3 py-3.5 w-10 text-center border-r border-slate-800" title="Click star to highlight entry">
                          <Highlighter className="w-3.5 h-3.5 mx-auto text-amber-400" />
                        </th>
                        <th className="px-4 py-3.5 w-14 text-center border-r border-slate-800">#</th>
                        <th className="px-4 py-3.5 w-28 border-r border-slate-800">Date</th>
                        <th className="px-4 py-3.5 w-28 border-r border-slate-800 text-center">Type</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Account Title</th>
                        <th className="px-4 py-3.5 border-r border-slate-800">Description</th>
                        <th className="px-4 py-3.5 w-28 border-r border-slate-800">Bill / Ref</th>
                        <th className="px-4 py-3.5 w-36 text-right border-r border-slate-800 text-emerald-400">Cash In (Dr)</th>
                        <th className="px-4 py-3.5 w-36 text-right border-r border-slate-800 text-rose-400">Cash Out (Cr)</th>
                        <th className="px-4 py-3.5 w-36 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">

                      {/* Opening Balance Row at Top for Ascending View */}
                      {sortOrder === 'asc' && reportData.ledgerEntries && (
                        <tr className="bg-blue-50/60 font-semibold border-b-2 border-blue-200">
                          <td className="px-3 py-3 text-center border-r border-blue-100">—</td>
                          <td className="px-4 py-3 text-center text-blue-400 font-bold border-r border-blue-100">—</td>
                          <td className="px-4 py-3 text-blue-700 whitespace-nowrap border-r border-blue-100 font-bold">{formatDate(startDate)}</td>
                          <td className="px-4 py-3 text-center border-r border-blue-100">
                            <span className="bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full text-[10px] uppercase">
                              Opening
                            </span>
                          </td>
                          <td className="px-4 py-3 text-blue-900 font-bold border-r border-blue-100" colSpan={3}>
                            Opening Balance Brought Forward (b/f)
                          </td>
                          <td className="px-4 py-3 text-right border-r border-blue-100 text-slate-400">—</td>
                          <td className="px-4 py-3 text-right border-r border-blue-100 text-slate-400">—</td>
                          <td className={`px-4 py-3 text-right font-black tabular-nums text-sm ${openingBalance >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                            Rs. {formatCurrency(openingBalance)}
                          </td>
                        </tr>
                      )}

                      {/* List Entries */}
                      {displayedEntries.map((entry, index) => {
                        const displayAmts = getLedgerEntryDisplayAmounts(entry);
                        const balance = parseFloat(entry.closing_balance || 0);
                        const isDebit = displayAmts.debit > 0;
                        const sno = sortOrder === 'desc' ? reportData.ledgerEntries.length - index : index + 1;
                        const isHighlighted = highlightedRowIds.has(entry.l_id);

                        return (
                          <tr
                            key={entry.l_id}
                            onClick={() => toggleHighlightRow(entry.l_id)}
                            className={`cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-amber-100/90 hover:bg-amber-200/90 border-l-4 border-l-amber-500 font-medium'
                                : index % 2 === 0
                                ? 'bg-white hover:bg-slate-100/80'
                                : 'bg-slate-50/50 hover:bg-slate-100/80'
                            }`}
                          >
                            <td className="px-3 py-3 text-center border-r border-slate-100/80">
                              <button
                                onClick={(e) => toggleHighlightRow(entry.l_id, e)}
                                title={isHighlighted ? 'Remove highlight' : 'Highlight row'}
                                className="p-1 rounded-md hover:bg-amber-200/60 text-slate-400 hover:text-amber-600 transition-colors"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    isHighlighted ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-500 border-r border-slate-100/80">{sno}</td>
                            <td className="px-4 py-3 text-slate-800 font-semibold whitespace-nowrap border-r border-slate-100/80">{formatDate(entry.created_at)}</td>
                            <td className="px-4 py-3 text-center border-r border-slate-100/80">
                              {isDebit ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">
                                  <PlusCircle className="w-3 h-3 text-emerald-600" /> Cash In
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">
                                  <MinusCircle className="w-3 h-3 text-rose-600" /> Cash Out
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-900 font-bold border-r border-slate-100/80">
                              {renderHighlightedText(entry.customer?.cus_name || 'General Cash', searchQuery)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 border-r border-slate-100/80 max-w-sm" title={entry.details || '-'}>
                              {renderHighlightedText(entry.details, searchQuery)}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100/80 font-medium">
                              {entry.bill_no ? (
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                                  #{renderHighlightedText(entry.bill_no, searchQuery)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold border-r border-slate-100/80 tabular-nums">
                              {displayAmts.debit > 0 ? (
                                <span className="text-emerald-700 font-black text-sm">Rs. {formatCurrency(displayAmts.debit)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold border-r border-slate-100/80 tabular-nums">
                              {displayAmts.credit > 0 ? (
                                <span className="text-rose-700 font-black text-sm">Rs. {formatCurrency(displayAmts.credit)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-right font-black tabular-nums text-xs ${balance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                              Rs. {formatCurrency(balance)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Opening Balance Row at Bottom for Descending View */}
                      {sortOrder === 'desc' && reportData.ledgerEntries && (
                        <tr className="bg-blue-50/60 font-semibold border-t-2 border-blue-200">
                          <td className="px-3 py-3 text-center border-r border-blue-100">—</td>
                          <td className="px-4 py-3 text-center text-blue-400 font-bold border-r border-blue-100">—</td>
                          <td className="px-4 py-3 text-blue-700 whitespace-nowrap border-r border-blue-100 font-bold">{formatDate(startDate)}</td>
                          <td className="px-4 py-3 text-center border-r border-blue-100">
                            <span className="bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full text-[10px] uppercase">
                              Opening
                            </span>
                          </td>
                          <td className="px-4 py-3 text-blue-900 font-bold border-r border-blue-100" colSpan={3}>
                            Opening Balance Brought Forward (b/f)
                          </td>
                          <td className="px-4 py-3 text-right border-r border-blue-100 text-slate-400">—</td>
                          <td className="px-4 py-3 text-right border-r border-blue-100 text-slate-400">—</td>
                          <td className={`px-4 py-3 text-right font-black tabular-nums text-sm ${openingBalance >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                            Rs. {formatCurrency(openingBalance)}
                          </td>
                        </tr>
                      )}

                      {/* Empty State */}
                      {displayedEntries.length === 0 && (
                        <tr>
                          <td colSpan="10" className="px-6 py-12 text-center">
                            <div className="max-w-sm mx-auto">
                              <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="text-slate-700 font-bold">No Cash Transactions Found</p>
                              <p className="text-slate-400 text-xs mt-1">Try searching for a different term or change the date/highlight filter</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Table Footer Totals */}
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-extrabold text-xs">
                        <td colSpan="7" className="px-4 py-3.5 text-right uppercase tracking-wider border-r border-slate-800 text-slate-300">
                          Total Period Summary ({displayedEntries.length} Visible / {reportData.ledgerEntries.length} Total)
                        </td>
                        <td className="px-4 py-3.5 text-right border-r border-slate-800 tabular-nums text-emerald-400 font-black text-sm">
                          Rs. {formatCurrency(displayedEntries.reduce((acc, e) => acc + getLedgerEntryDisplayAmounts(e).debit, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right border-r border-slate-800 tabular-nums text-rose-400 font-black text-sm">
                          Rs. {formatCurrency(displayedEntries.reduce((acc, e) => acc + getLedgerEntryDisplayAmounts(e).credit, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-amber-300 font-black text-sm">
                          Rs. {formatCurrency(closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* PRINT LEDGER TABLE */}
              <div className="hidden print:block bg-white border border-slate-900">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900">
                      <th className="px-2 py-2 text-center border-r border-slate-900 w-8">#</th>
                      <th className="px-2 py-2 text-left border-r border-slate-900 w-20">Date</th>
                      <th className="px-2 py-2 text-left border-r border-slate-900">Account Title</th>
                      <th className="px-2 py-2 text-left border-r border-slate-900">Description</th>
                      <th className="px-2 py-2 text-left border-r border-slate-900 w-16">Bill</th>
                      <th className="px-2 py-2 text-right border-r border-slate-900 w-24">Debit (Dr)</th>
                      <th className="px-2 py-2 text-right border-r border-slate-900 w-24">Credit (Cr)</th>
                      <th className="px-2 py-2 text-right w-28">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {/* Opening Balance Row at Top for Print */}
                    <tr className="bg-slate-100 font-bold">
                      <td className="px-2 py-1.5 text-center border-r border-slate-900">—</td>
                      <td className="px-2 py-1.5 border-r border-slate-900 whitespace-nowrap">{formatDate(startDate)}</td>
                      <td className="px-2 py-1.5 border-r border-slate-900" colSpan={3}>
                        <span className="font-extrabold uppercase text-[10px]">Opening Balance (b/f)</span>
                      </td>
                      <td className="px-2 py-1.5 text-right border-r border-slate-900 text-slate-400">—</td>
                      <td className="px-2 py-1.5 text-right border-r border-slate-900 text-slate-400">—</td>
                      <td className="px-2 py-1.5 text-right font-black tabular-nums">{formatCurrency(openingBalance)}</td>
                    </tr>

                    {/* Always Ascending Chronological List for Print */}
                    {(reportData.ledgerEntries || []).map((entry, index) => {
                      const displayAmts = getLedgerEntryDisplayAmounts(entry);
                      const balance = parseFloat(entry.closing_balance || 0);
                      return (
                        <tr key={entry.l_id} className="bg-white">
                          <td className="px-2 py-1.5 text-center border-r border-slate-900">{index + 1}</td>
                          <td className="px-2 py-1.5 border-r border-slate-900 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                          <td className="px-2 py-1.5 border-r border-slate-900 font-semibold">{entry.customer?.cus_name || 'General Cash'}</td>
                          <td className="px-2 py-1.5 border-r border-slate-900 truncate max-w-xs">{entry.details || '-'}</td>
                          <td className="px-2 py-1.5 border-r border-slate-900">{entry.bill_no ? `#${entry.bill_no}` : '-'}</td>
                          <td className="px-2 py-1.5 text-right border-r border-slate-900 tabular-nums">{displayAmts.debit > 0 ? formatCurrency(displayAmts.debit) : '-'}</td>
                          <td className="px-2 py-1.5 text-right border-r border-slate-900 tabular-nums">{displayAmts.credit > 0 ? formatCurrency(displayAmts.credit) : '-'}</td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatCurrency(balance)}</td>
                        </tr>
                      );
                    })}

                    {(!reportData.ledgerEntries || reportData.ledgerEntries.length === 0) && (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-slate-500 font-semibold">
                          No cash transactions found for the selected period
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-900">
                      <td colSpan="5" className="px-2 py-2 text-right uppercase tracking-wider border-r border-slate-900">Grand Total</td>
                      <td className="px-2 py-2 text-right border-r border-slate-900 tabular-nums">{formatCurrency(totalDebit)}</td>
                      <td className="px-2 py-2 text-right border-r border-slate-900 tabular-nums">{formatCurrency(totalCredit)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(closingBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Print Footer */}
              <div className="hidden print:flex justify-between items-center mt-6 pt-4 border-t border-slate-900 text-[10px] text-slate-600 font-medium">
                <span>Printed: {new Date().toLocaleString('en-GB')} | Generated By: {currentUser ? `${currentUser.full_name || currentUser.name || 'Admin'}${currentUser.user_id ? ` (ID: ${currentUser.user_id})` : ''}` : 'Admin'}</span>
                <span className="font-bold text-slate-900">Ittefaq Iron & Cement Store — Cash Book</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center print:hidden">
            <div className="text-center p-8 bg-white border border-slate-200 rounded-3xl shadow-sm max-w-md">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <Search className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No Cash Data Generated</h3>
              <p className="text-slate-500 text-xs mt-1">Select date range and click Generate Report to display cash book transactions</p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
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

