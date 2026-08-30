'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Search,
  Filter,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  Eye,
  RefreshCw,
  Lock,
  Unlock,
  Building2,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import DashboardLayout from '../../components/dashboard-layout';

const formatCurrency = (val) => {
  const n = parseFloat(val || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
};

export default function DayEndHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ dayEnds: [], pagination: {}, summary: {} });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(status && { status })
      });

      const response = await fetch(`/api/day-end/history?${params}`);
      if (response.ok) {
        const resData = await response.json();
        setData(resData);
      }
    } catch (error) {
      console.error('Error fetching day end history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, startDate, endDate, status]);

  const filteredDayEnds = (data.dayEnds || []).filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const dateStr = formatDate(item.business_date).toLowerCase();
    const userStr = (item.closed_by_user?.full_name || '').toLowerCase();
    const notesStr = (item.notes || '').toLowerCase();
    return dateStr.includes(q) || userStr.includes(q) || notesStr.includes(q);
  });

  const handleExportCSV = () => {
    const headers = ['Business Date', 'Status', 'Opening Cash', 'Total Sales', 'Total Purchases', 'Total Expenses', 'Expected Cash', 'Closing Cash', 'Variance', 'Closed By', 'Notes'];
    const rows = filteredDayEnds.map(d => [
      formatDate(d.business_date),
      d.status,
      d.opening_cash || 0,
      d.total_sales || 0,
      d.total_purchases || 0,
      d.total_expenses || 0,
      d.cash_in_hand || 0,
      d.closing_cash !== null ? d.closing_cash : '-',
      d.variance || 0,
      d.closed_by_user?.full_name || 'System',
      `"${(d.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Day_End_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-100/70 p-4 md:p-6 space-y-6 text-slate-800 font-sans">
        {/* Header Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              Day End Closing History
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Dashboard &gt; Day End Closing &gt; Closing History
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/dashboard/day-end')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" /> Today's Closing
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Recorded Days</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{data.summary?.totalDays || 0} Days</h3>
              <p className="text-[11px] text-slate-400 font-medium">Recorded in history</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Sales (Period)</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">Rs. {formatCurrency(data.summary?.totalSales)}</h3>
              <p className="text-[11px] text-slate-400 font-medium">Avg: Rs. {formatCurrency(data.summary?.averageSales)}/day</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Purchases (Period)</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">Rs. {formatCurrency(data.summary?.totalPurchases)}</h3>
              <p className="text-[11px] text-slate-400 font-medium">Avg: Rs. {formatCurrency(data.summary?.averagePurchases)}/day</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Closing Cash</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">Rs. {formatCurrency(data.summary?.totalClosingCash)}</h3>
              <p className="text-[11px] text-slate-400 font-medium">Cumulative physical cash</p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search date, user, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-none cursor-pointer"
              />
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-none cursor-pointer"
              />
            </div>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="CLOSED">CLOSED</option>
              <option value="DRAFT">DRAFT / OPEN</option>
            </select>
          </div>

          <button
            onClick={() => { setStartDate(''); setEndDate(''); setStatus(''); setSearchQuery(''); setPage(1); }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* History Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 text-center">#</th>
                  <th className="py-3.5 px-4">Business Date</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Opening Cash</th>
                  <th className="py-3.5 px-4 text-right">Total Sales</th>
                  <th className="py-3.5 px-4 text-right">Total Purchases</th>
                  <th className="py-3.5 px-4 text-right">Total Expenses</th>
                  <th className="py-3.5 px-4 text-right">Closing Cash</th>
                  <th className="py-3.5 px-4 text-right">Variance</th>
                  <th className="py-3.5 px-4">Closed By</th>
                  <th className="py-3.5 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="font-semibold text-xs text-slate-600">Loading closing history...</p>
                    </td>
                  </tr>
                ) : filteredDayEnds.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-slate-700">No day end closing records found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your date range or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredDayEnds.map((d, index) => {
                    const dateFormatted = formatDate(d.business_date);
                    const rawDate = d.business_date ? d.business_date.split('T')[0] : '';
                    const isClosed = d.status === 'CLOSED';

                    return (
                      <tr key={d.day_end_id || index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-400 text-center">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {dateFormatted}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isClosed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isClosed ? 'CLOSED' : 'DRAFT'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-700">
                          Rs. {formatCurrency(d.opening_cash)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700">
                          Rs. {formatCurrency(d.total_sales)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700">
                          Rs. {formatCurrency(d.total_purchases)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-rose-700">
                          Rs. {formatCurrency(d.total_expenses)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          {d.closing_cash !== null && d.closing_cash !== undefined ? `Rs. ${formatCurrency(d.closing_cash)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {d.variance ? (
                            <span className={d.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              Rs. {formatCurrency(d.variance)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Rs. 0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          <div className="font-semibold text-slate-800">{d.closed_by_user?.full_name || 'System User'}</div>
                          <div className="text-[10px] text-slate-400">{d.closed_by_user?.role || 'Admin'}</div>
                        </td>
                        <td className="py-3 px-4 text-center print:hidden">
                          <button
                            onClick={() => router.push(`/dashboard/day-end?date=${rawDate}`)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition-all border border-blue-200/60 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalCount} total entries)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={!data.pagination.hasPrev}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  disabled={!data.pagination.hasNext}
                  onClick={() => setPage(prev => prev + 1)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
