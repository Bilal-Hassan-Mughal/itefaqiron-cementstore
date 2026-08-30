'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Landmark,
  Search,
  Download,
  Printer,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ArrowLeftRight,
  CreditCard,
  Building2,
  CheckCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

const formatCurrency = (val) => {
  const n = parseFloat(val || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'No activity';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi'
  });
};

export default function BankAccountsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ accounts: [], summary: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'positive', 'negative', 'zero'
  const [sortBy, setSortBy] = useState('balance-desc'); // 'name-asc', 'balance-desc', 'balance-asc'

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bank-accounts');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  // Filter and sort bank accounts
  const filteredAccounts = useMemo(() => {
    let list = [...(data.accounts || [])];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(acc =>
        acc.cus_name.toLowerCase().includes(q) ||
        acc.cus_id.toString().includes(q) ||
        (acc.cus_phone_no && acc.cus_phone_no.toLowerCase().includes(q)) ||
        (acc.city && acc.city.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'positive') {
      list = list.filter(acc => acc.cus_balance > 0);
    } else if (statusFilter === 'negative') {
      list = list.filter(acc => acc.cus_balance < 0);
    } else if (statusFilter === 'zero') {
      list = list.filter(acc => acc.cus_balance === 0);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.cus_name.localeCompare(b.cus_name);
      } else if (sortBy === 'balance-desc') {
        return b.cus_balance - a.cus_balance;
      } else if (sortBy === 'balance-asc') {
        return a.cus_balance - b.cus_balance;
      }
      return 0;
    });

    return list;
  }, [data.accounts, searchQuery, statusFilter, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredAccounts.length) return;
    let csv = 'BANK ACCOUNTS & CLOSING BALANCES REPORT\n';
    csv += `Generated On: ${new Date().toLocaleString()}\n\n`;
    csv += 'ID,Bank Account Title,Category,Type,Phone,City,Last Transaction Date,Closing Balance (PKR)\n';
    
    filteredAccounts.forEach((acc) => {
      csv += `${acc.cus_id},"${acc.cus_name}","${acc.category}","${acc.type}","${acc.cus_phone_no || ''}","${acc.city || ''}","${formatDate(acc.last_transaction_date)}",${acc.cus_balance}\n`;
    });

    csv += `\nTotal Accounts: ${filteredAccounts.length}\n`;
    csv += `Total Closing Balance: ${data.summary?.totalBalance || 0}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-accounts-closing-balances-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handlePrint = () => window.print();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-800 via-indigo-900 to-slate-900 text-white px-6 py-5 shadow-lg print:hidden">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-cyan-200 hover:text-white"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-cyan-400/20">
                    Finance Management
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
                  <Landmark className="w-7 h-7 text-cyan-400" />
                  Bank Accounts & Closing Balances
                </h1>
                <p className="text-cyan-200/80 text-xs mt-0.5">
                  Real-time list of all company bank accounts and current closing ledger balances
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/dashboard/internal-transfer')}
                className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 text-white"
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" /> Internal Transfer
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 text-white"
              >
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/20 text-white"
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </button>
              <button
                onClick={fetchBankAccounts}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-cyan-200 hover:text-white transition-colors"
                title="Refresh balances"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

          {/* Printable Header */}
          <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black tracking-wider text-slate-900">ITTEFAQ IRON STORE</h1>
            <p className="text-xs text-slate-600">Parianwali, Pakistan | Tel: +92 346 7560306</p>
            <div className="mt-2 py-1.5 bg-slate-900 text-white inline-block px-6 rounded-md">
              <h2 className="text-sm font-bold tracking-widest uppercase">BANK ACCOUNTS & CLOSING BALANCES REPORT</h2>
            </div>
            <p className="text-xs text-slate-500 mt-2">Printed on: {new Date().toLocaleString()}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
            
            {/* Total Closing Balance Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl p-5 text-white shadow-md border border-indigo-700/30 relative overflow-hidden">
              <div className="absolute right-3 bottom-3 opacity-10 text-white">
                <Landmark size={80} />
              </div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">Total Bank Balance</p>
              <h3 className="text-2xl font-black mt-1 text-white tracking-tight">
                Rs {formatCurrency(data.summary?.totalBalance)}
              </h3>
              <p className="text-[11px] text-indigo-200/80 mt-2 flex items-center gap-1">
                Combined balance across all bank accounts
              </p>
            </div>

            {/* Total Accounts Count */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Bank Accounts</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {data.summary?.totalAccounts || 0}
                </h3>
                <span className="text-xs text-slate-500">Active bank accounts</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            {/* Positive Balance Accounts */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Positive Balance</p>
                <h3 className="text-2xl font-black text-emerald-700 mt-1">
                  {data.summary?.positiveCount || 0}
                </h3>
                <span className="text-xs text-emerald-600 font-medium">Accounts with funds</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Negative / Overdrawn Accounts */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Overdrawn Accounts</p>
                <h3 className="text-2xl font-black text-rose-700 mt-1">
                  {data.summary?.negativeCount || 0}
                </h3>
                <span className="text-xs text-rose-600 font-medium">Accounts in negative balance</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search bank name, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: `All (${data.accounts?.length || 0})` },
                { id: 'positive', label: `Positive (${data.summary?.positiveCount || 0})` },
                { id: 'negative', label: `Overdrawn (${data.summary?.negativeCount || 0})` },
                { id: 'zero', label: `Zero (${data.summary?.zeroCount || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Options */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              >
                <option value="balance-desc">Highest Balance First</option>
                <option value="balance-asc">Lowest Balance First</option>
                <option value="name-asc">Bank Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Bank Accounts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center w-16">#ID</th>
                    <th className="py-3.5 px-4">Bank Account Title</th>
                    <th className="py-3.5 px-4">Category / Type</th>
                    <th className="py-3.5 px-4">Contact / City</th>
                    <th className="py-3.5 px-4">Last Activity</th>
                    <th className="py-3.5 px-4 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-600" />
                        <p className="font-semibold text-xs text-slate-600">Loading bank accounts...</p>
                      </td>
                    </tr>
                  ) : filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-slate-700">No bank accounts found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filters</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc, index) => (
                      <tr
                        key={acc.cus_id}
                        className="hover:bg-cyan-50/40 transition-colors group"
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-500 text-center">
                          #{acc.cus_id}
                        </td>

                        {/* Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs shrink-0 group-hover:scale-105 transition-transform">
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-xs uppercase tracking-wide block">
                                {acc.cus_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Asset Account
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category / Type */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            {acc.category}
                          </span>
                        </td>

                        {/* Contact / City */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {acc.cus_phone_no && <div className="font-mono text-slate-700">{acc.cus_phone_no}</div>}
                          {acc.city ? (
                            <div className="text-[11px] text-slate-400">{acc.city}</div>
                          ) : (
                            !acc.cus_phone_no && <span className="text-slate-400 font-italic">-</span>
                          )}
                        </td>

                        {/* Last Activity */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {formatDate(acc.last_transaction_date)}
                        </td>

                        {/* Closing Balance */}
                        <td className="py-3.5 px-4 text-right">
                          <div className={`font-black text-sm tracking-tight ${
                            acc.cus_balance > 0
                              ? 'text-emerald-700'
                              : acc.cus_balance < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}>
                            Rs {formatCurrency(acc.cus_balance)}
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            acc.cus_balance > 0
                              ? 'text-emerald-600'
                              : acc.cus_balance < 0
                              ? 'text-rose-600'
                              : 'text-slate-400'
                          }`}>
                            {acc.cus_balance > 0 ? 'Debit (Asset)' : acc.cus_balance < 0 ? 'Credit (Overdrawn)' : 'Zero'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table Footer */}
                {!loading && filteredAccounts.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs">
                      <td colSpan="5" className="py-4 px-4 text-right uppercase tracking-wider">
                        Total Combined Closing Balance ({filteredAccounts.length} Bank Accounts):
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-extrabold text-cyan-300">
                        Rs {formatCurrency(data.summary?.totalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
