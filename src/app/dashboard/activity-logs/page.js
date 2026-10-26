'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../components/dashboard-layout';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Activity,
  Layers,
  Trash2,
  LogIn,
  LogOut,
  Edit,
  PlusCircle,
  FileText,
  AlertTriangle,
  Clock,
  Laptop,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';

const ACTION_CONFIG = {
  CREATE: {
    label: 'Created',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: PlusCircle,
  },
  UPDATE: {
    label: 'Updated',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    icon: Edit,
  },
  DELETE: {
    label: 'Deleted',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    icon: Trash2,
  },
  LOGIN: {
    label: 'Logged In',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    icon: LogIn,
  },
  LOGOUT: {
    label: 'Logged Out',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    icon: LogOut,
  },
  DAY_END_CLOSE: {
    label: 'Day Closed',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  RETURN: {
    label: 'Return',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    icon: Activity,
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    icon: SlidersHorizontal,
  },
};

const MODULE_OPTIONS = [
  'Authentication',
  'Sales & POS',
  'Purchases',
  'Accounts & Customers',
  'Suppliers',
  'Inventory & Products',
  'Expenses',
  'Day End Closing',
  'Payments',
  'Journal Entries',
  'User Management',
  'System Settings',
  'Reports & Analytics',
];

export default function ActivityLogsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLogs: 0, todayCount: 0, uniqueUsers: 0, deletionsCount: 0 });

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    let u = currentUser;
    if (!u && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('user');
        if (raw) u = JSON.parse(raw);
      } catch {}
    }
    if (!u) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (search.trim()) params.append('search', search.trim());
      if (actionFilter) params.append('action', actionFilter);
      if (moduleFilter) params.append('module', moduleFilter);
      if (userFilter) params.append('userId', userFilter);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const res = await branchFetch(u, `/api/activity-logs?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setLogs(json.data || []);
        if (json.users?.length) setUsersList(json.users);
        if (json.stats) setStats(json.stats);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, page, limit, search, actionFilter, moduleFilter, userFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setModuleFilter('');
    setUserFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const copyPayloadJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog.details, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const exportCsv = () => {
    if (!logs.length) return;
    const headers = ['Log ID', 'Timestamp', 'User', 'Role', 'Action', 'Module', 'Entity ID', 'Description', 'IP Address'];
    const rows = logs.map((l) => [
      l.log_id,
      new Date(l.created_at).toLocaleString(),
      `"${l.user_name || 'System'}"`,
      `"${l.role || ''}"`,
      l.action,
      `"${l.module}"`,
      l.entity_id || '',
      `"${(l.description || '').replace(/"/g, '""')}"`,
      l.ip_address || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const hasActiveFilters = Boolean(search || actionFilter || moduleFilter || userFilter || fromDate || toDate);

  return (
    <DashboardLayout>
      <div className="max-w-[1700px] mx-auto space-y-6">
        {/* Top Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl shadow-xl border border-slate-800/80 p-6 md:p-8 text-white">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                Security & Audit Trail
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                User Activity & System Logs
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Immutable audit trail tracking login events, order & invoice deletions, inventory movements, cashier day-ends, and record modifications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={exportCsv}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all backdrop-blur-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-slate-300" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={fetchLogs}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#1A55E3] hover:bg-[#1347c4] text-white shadow-lg shadow-blue-600/30 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-8 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                Total Activities
              </div>
              <div className="text-2xl font-black text-white mt-1.5 tabular-nums">
                {stats.totalLogs.toLocaleString()}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Today&apos;s Actions
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-1.5 tabular-nums">
                {stats.todayCount.toLocaleString()}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Deletions Tracked
              </div>
              <div className="text-2xl font-black text-rose-400 mt-1.5 tabular-nums">
                {stats.deletionsCount.toLocaleString()}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                Active Staff
              </div>
              <div className="text-2xl font-black text-purple-300 mt-1.5 tabular-nums">
                {usersList.length}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A55E3] flex items-center justify-center font-bold">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Filter Activities</h3>
                <p className="text-[11px] text-slate-500">Search by keywords, performer, module, or custom date window</p>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-all border border-rose-200/60"
              >
                <X className="w-3.5 h-3.5" />
                Clear All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3 items-center">
            {/* Search Box (Takes 4 cols on large screens) */}
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search description, entity #, performer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/20 focus:border-[#1A55E3] transition-all"
              />
            </div>

            {/* Action Select (2 cols) */}
            <div className="lg:col-span-2 relative">
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/20 focus:border-[#1A55E3] transition-all cursor-pointer"
              >
                <option value="">All Actions</option>
                {Object.keys(ACTION_CONFIG).map((act) => (
                  <option key={act} value={act}>
                    {ACTION_CONFIG[act]?.label || act} ({act})
                  </option>
                ))}
              </select>
            </div>

            {/* Module Select (2 cols) */}
            <div className="lg:col-span-2 relative">
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/20 focus:border-[#1A55E3] transition-all cursor-pointer"
              >
                <option value="">All Modules</option>
                {MODULE_OPTIONS.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            {/* User Select (2 cols) */}
            <div className="lg:col-span-2 relative">
              <select
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/20 focus:border-[#1A55E3] transition-all cursor-pointer"
              >
                <option value="">All Users</option>
                {usersList.map((u) => (
                  <option key={u.user_id} value={String(u.user_id)}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selector (2 cols) */}
            <div className="lg:col-span-2 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1A55E3]/20 focus-within:border-[#1A55E3] transition-all">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                title="From Date"
                className="w-full bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none min-w-0"
              />
              <span className="text-slate-400 text-[10px] font-bold uppercase shrink-0">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                title="To Date"
                className="w-full bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none min-w-0"
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4 w-[160px]">Date & Time</th>
                  <th className="py-3.5 px-4 w-[220px]">User / Performer</th>
                  <th className="py-3.5 px-4 text-center w-[130px]">Action</th>
                  <th className="py-3.5 px-4 w-[160px]">Module</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Activity Description</th>
                  <th className="py-3.5 px-4 text-center w-[120px]">Target Entity</th>
                  <th className="py-3.5 px-4 w-[160px]">Network & IP</th>
                  <th className="py-3.5 px-4 text-center w-[90px]">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#1A55E3] mb-3 opacity-80" />
                      <p className="font-semibold text-slate-600">Retrieving system audit logs...</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <Activity className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No activity logs recorded yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        User actions like sales, purchases, payments, expenses, returns, and login events will be tracked here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionInfo = ACTION_CONFIG[log.action] || {
                      label: log.action,
                      bg: 'bg-slate-100',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                      dot: 'bg-slate-400',
                      icon: Activity,
                    };
                    const { date, time } = formatTimestamp(log.created_at);

                    return (
                      <tr key={log.log_id || log.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100/80">
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <div className="font-semibold text-slate-900 leading-snug">{date}</div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {time}
                          </div>
                        </td>

                        {/* Performer */}
                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase shadow-xs shrink-0">
                              {(log.user_name || 'U').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{log.user_name || 'System Auto'}</div>
                              <div className="text-[10px] text-indigo-600 font-bold tracking-wide uppercase truncate">
                                {log.role || 'Service'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-4 whitespace-nowrap text-center align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${actionInfo.bg} ${actionInfo.text} ${actionInfo.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${actionInfo.dot}`} />
                            {actionInfo.label}
                          </span>
                        </td>

                        {/* Module */}
                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <span className="inline-block font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] border border-slate-200/80">
                            {log.module}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 align-middle">
                          <p className="text-slate-800 font-medium leading-relaxed">
                            {log.description || '—'}
                          </p>
                        </td>

                        {/* Target Entity */}
                        <td className="py-3 px-4 whitespace-nowrap text-center align-middle font-mono">
                          {log.entity_id ? (
                            <span className="inline-block font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md text-[11px] border border-slate-200">
                              #{log.entity_id}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        {/* Network & IP */}
                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <div className="font-mono text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                            <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{log.ip_address || '127.0.0.1'}</span>
                          </div>
                        </td>

                        {/* Details Modal Trigger */}
                        <td className="py-3 px-4 whitespace-nowrap text-center align-middle">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-[#1A55E3] hover:bg-[#1A55E3] hover:text-white transition-all shadow-xs border border-blue-200/60"
                            title="Inspect detailed activity payload"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{logs.length}</span> of{' '}
              <span className="font-bold text-slate-900">{totalCount}</span> logs recorded
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1A55E3]"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1.5 ml-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-2xs"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-bold text-slate-800">
                  {page} / {totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-2xs"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Inspection Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-wide">
                      Audit Log Payload #{selectedLog.log_id || selectedLog.id}
                    </h3>
                    <p className="text-[11px] text-slate-400">Detailed record transaction metadata</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
                {/* Meta details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Timestamp</span>
                    <span className="font-bold text-slate-800">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">User / Role</span>
                    <span className="font-bold text-slate-800">
                      {selectedLog.user_name || 'System'} ({selectedLog.role || 'Service'})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Action & Module</span>
                    <span className="font-bold text-indigo-700">
                      {selectedLog.action} · {selectedLog.module}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Entity ID</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedLog.entity_id ? `#${selectedLog.entity_id}` : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Client IP</span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedLog.ip_address || 'Localhost'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Branch Context</span>
                    <span className="font-bold text-slate-800">
                      {selectedLog.branch_id ? `Branch #${selectedLog.branch_id}` : 'HQ / Main'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Activity Summary
                  </label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium leading-relaxed">
                    {selectedLog.description || 'No descriptive message provided.'}
                  </div>
                </div>

                {/* Raw JSON Details */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Changes & State Payload (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={copyPayloadJson}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1A55E3] hover:text-[#1347c4]"
                    >
                      {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPayload ? 'Copied!' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-sky-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
                    {selectedLog.details
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : '// No custom state payload attached.'}
                  </pre>
                </div>

                {/* Client Device Details */}
                {selectedLog.user_agent && (
                  <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                    <span className="font-semibold text-slate-500">Browser / User Agent: </span>
                    {selectedLog.user_agent}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
