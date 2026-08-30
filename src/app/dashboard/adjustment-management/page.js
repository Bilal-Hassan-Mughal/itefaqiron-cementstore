'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  SwapHoriz as SwapIcon, 
  Send as SendIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AdjustmentManagementPage() {
  const router = useRouter();
  
  // State variables
  const [cashAccount, setCashAccount] = useState(null);
  const [adjustmentAccount, setAdjustmentAccount] = useState(null);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [direction, setDirection] = useState('cash_to_adjustment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Notification states
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/adjustment-transfer');
      if (res.ok) {
        const data = await res.json();
        setCashAccount(data.cashAccount || null);
        setAdjustmentAccount(data.adjustmentAccount || null);
        setRecentTransfers(data.recentTransfers || []);
      } else {
        showNotification('error', 'Failed to load adjustment and cash accounts');
      }
    } catch (err) {
      console.error('Error fetching adjustment data:', err);
      showNotification('error', 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    
    if (!direction || !amount) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      showNotification('error', 'Amount must be greater than zero');
      return;
    }

    try {
      setSubmitting(true);
      setAlert(null);

      // Retrieve user ID from localStorage if available
      let userId = 6; // default fallback admin
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed.user_id) userId = parsed.user_id;
        } catch (_) {}
      }

      const res = await fetch('/api/adjustment-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          amount: transferAmount,
          date,
          description,
          updated_by: userId
        })
      });

      const data = await res.json();

      if (res.ok) {
        const sourceName = direction === 'cash_to_adjustment' ? 'Cash Account' : 'Adjustment Account';
        const destName = direction === 'cash_to_adjustment' ? 'Adjustment Account' : 'Cash Account';
        showNotification('success', `Successfully transferred PKR ${fmtAmt(transferAmount)} from ${sourceName} to ${destName}`);
        
        // Reset form
        setAmount('');
        setDescription('');
        
        // Refresh balances and transfers list
        await fetchData();
      } else {
        showNotification('error', data.error || 'Failed to complete adjustment transfer');
      }
    } catch (err) {
      console.error('Error submitting adjustment transfer:', err);
      showNotification('error', 'An error occurred while executing transfer');
    } finally {
      setSubmitting(false);
    }
  };

  // Group ledger entries by transaction code (bill_no) for display
  const groupedTransfers = useMemo(() => {
    if (!recentTransfers || recentTransfers.length === 0) return [];
    
    const map = {};
    recentTransfers.forEach(entry => {
      const billNo = entry.bill_no || `ADJ-TRF-${entry.l_id}`;
      if (!map[billNo]) {
        map[billNo] = {
          bill_no: billNo,
          date: entry.created_at,
          details: entry.details ? entry.details.replace(/\s*\(From\s+.*?\)\s*|\s*\(To\s+.*?\)\s*/gi, '') : 'Adjustment Transfer',
          amount: entry.payments || entry.debit_amount || entry.credit_amount,
          source: '—',
          destination: '—',
          l_id: entry.l_id
        };
      }
      if (entry.credit_amount > 0) {
        map[billNo].source = entry.customer?.cus_name || '—';
      } else if (entry.debit_amount > 0) {
        map[billNo].destination = entry.customer?.cus_name || '—';
      }
    });

    const list = Object.values(map).sort((a, b) => b.l_id - a.l_id);
    
    if (!searchTerm.trim()) return list;
    
    const q = searchTerm.toLowerCase();
    return list.filter(t => 
      t.bill_no.toLowerCase().includes(q) ||
      t.source.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q) ||
      t.details.toLowerCase().includes(q)
    );
  }, [recentTransfers, searchTerm]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between pb-5 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SwapIcon className="w-8 h-8 text-indigo-600" />
              Adjustment Account Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Deduct from/transfer to Cash Account and Adjustment Account with double-entry ledger integration.
            </p>
          </div>
        </div>

        {/* Account Balances Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cash Account Card */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-4 bottom-4 opacity-15">
              <WalletIcon sx={{ fontSize: 100 }} />
            </div>
            <p className="text-sm font-semibold opacity-90 uppercase tracking-wider">Cash Account Balance</p>
            <h3 className="text-3xl font-black mt-2">
              {loading ? (
                <span className="inline-block animate-pulse w-32 h-8 bg-white/20 rounded"></span>
              ) : (
                `PKR ${fmtAmt(cashAccount?.cus_balance)}`
              )}
            </h3>
            <p className="text-xs opacity-75 mt-3">ID: 2551 • Main Office Cash</p>
          </div>

          {/* Adjustment Account Card */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-4 bottom-4 opacity-15">
              <SwapIcon sx={{ fontSize: 100 }} />
            </div>
            <p className="text-sm font-semibold opacity-90 uppercase tracking-wider">Adjustment Account Balance</p>
            <h3 className="text-3xl font-black mt-2">
              {loading ? (
                <span className="inline-block animate-pulse w-32 h-8 bg-white/20 rounded"></span>
              ) : (
                `PKR ${fmtAmt(adjustmentAccount?.cus_balance)}`
              )}
            </h3>
            <p className="text-xs opacity-75 mt-3">ID: 2777 • Adjustment Category</p>
          </div>
        </div>

        {/* Alert Messages */}
        {alert && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm transition-all duration-200 ${
            alert.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {alert.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <ErrorIcon className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="font-semibold text-sm flex-1">{alert.message}</div>
            <button onClick={() => setAlert(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold font-mono">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Transfer Form */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
                Execute Adjustment Transfer
              </h2>
              
              <form onSubmit={handleTransfer} className="space-y-4">
                {/* Transfer Direction Option */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transfer Direction *
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    required
                    disabled={loading || submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black font-semibold"
                  >
                    <option value="cash_to_adjustment">Cash Account → Adjustment Account (Deduct Cash)</option>
                    <option value="adjustment_to_cash">Adjustment Account → Cash Account (Add to Cash)</option>
                  </select>
                </div>

                {/* Transfer Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount (PKR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">PKR</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      min="1"
                      step="any"
                      disabled={loading || submitting}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black font-semibold"
                    />
                  </div>
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    disabled={loading || submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black font-semibold"
                  />
                </div>

                {/* Custom Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description / Remarks
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter details about this adjustment..."
                    rows={3}
                    disabled={loading || submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || submitting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition duration-200"
                >
                  <SendIcon className="w-5 h-5" />
                  {submitting ? 'Processing...' : 'Submit Transfer'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Recent Adjustments */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 flex flex-col h-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Adjustment Ledger Entries
                </h2>
                
                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search recent transfers..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black bg-gray-50/50"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
              ) : groupedTransfers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-3 text-gray-400">
                    <SwapIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">No adjustment entries found</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Perform your first transfer using the form on the left to see entries here.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1">
                  <div className="divide-y divide-gray-100">
                    {groupedTransfers.map((transfer) => (
                      <div key={transfer.bill_no} className="py-4 hover:bg-gray-50/50 rounded-xl px-2 transition duration-150">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-mono">
                                {transfer.bill_no}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(transfer.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2 mt-1">
                              <span className="truncate max-w-[150px]">{transfer.source}</span>
                              <span className="text-indigo-500 font-bold">→</span>
                              <span className="truncate max-w-[150px]">{transfer.destination}</span>
                            </div>

                            {transfer.details && (
                              <p className="text-xs text-gray-500 italic mt-1 truncate">
                                {transfer.details}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-base font-extrabold text-indigo-600 block">
                              PKR {fmtAmt(transfer.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
