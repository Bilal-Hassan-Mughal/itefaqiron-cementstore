'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  SwapHoriz as SwapIcon, 
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { notifyLedgerDataChanged } from '@/lib/ledger-tabs';
import { Autocomplete, TextField } from '@mui/material';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function InternalTransferPage() {
  // State variables
  const [accounts, setAccounts] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [editingBillNo, setEditingBillNo] = useState(null);

  // Notification states
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  const resetForm = () => {
    setEditingBillNo(null);
    setSourceId('');
    setDestinationId('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/internal-transfer');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setRecentTransfers(data.recentTransfers || []);
      } else {
        showNotification('error', 'Failed to load bank and cash accounts');
      }
    } catch (err) {
      console.error('Error fetching transfer data:', err);
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
    
    if (!sourceId || !destinationId || !amount) {
      showNotification('error', 'Please fill all required fields');
      return;
    }

    if (sourceId === destinationId) {
      showNotification('error', 'Source and destination accounts must be different');
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

      const isEditing = !!editingBillNo;
      const payload = {
        source_id: sourceId,
        destination_id: destinationId,
        amount: transferAmount,
        date,
        description,
        updated_by: 6,
      };
      if (isEditing) payload.bill_no = editingBillNo;

      const res = await fetch('/api/internal-transfer', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        const actionLabel = isEditing ? 'updated' : 'transferred';
        showNotification(
          'success',
          `Successfully ${actionLabel} PKR ${fmtAmt(transferAmount)} from ${data.source.name} to ${data.destination.name}`
        );
        resetForm();
        notifyLedgerDataChanged('internal-transfer');
        await fetchData();
      } else {
        showNotification('error', data.error || 'Failed to complete transfer');
      }
    } catch (err) {
      console.error('Error submitting transfer:', err);
      showNotification('error', 'An error occurred while executing transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTransfer = async (transfer) => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/internal-transfer?bill_no=${encodeURIComponent(transfer.bill_no)}`);
      if (!res.ok) {
        showNotification('error', 'Could not load transfer for editing');
        return;
      }
      const data = await res.json();
      setEditingBillNo(data.bill_no);
      setSourceId(String(data.source_id));
      setDestinationId(String(data.destination_id));
      setAmount(String(data.amount));
      setDate(data.date || new Date().toISOString().split('T')[0]);
      setDescription(data.description || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error loading transfer for edit:', err);
      showNotification('error', 'Failed to load transfer');
    } finally {
      setSubmitting(false);
    }
  };

  // Group ledger entries by transaction code (bill_no) for display
  const groupedTransfers = useMemo(() => {
    if (!recentTransfers || recentTransfers.length === 0) return [];
    
    const map = {};
    recentTransfers.forEach(entry => {
      const billNo = entry.bill_no || `TRF-${entry.l_id}`;
      if (!map[billNo]) {
        map[billNo] = {
          bill_no: billNo,
          date: entry.created_at,
          details: entry.details ? entry.details.replace(/\s*\(From\s+.*?\)\s*|\s*\(To\s+.*?\)\s*/gi, '') : 'Internal Transfer',
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
              <SwapIcon className="w-8 h-8 text-blue-600" />
              Internal Transfer
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Transfer funds between Bank and Cash Accounts with automatic ledger creation.
            </p>
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
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingBillNo ? 'Edit Transfer' : 'Create Transfer'}
                </h2>
                {editingBillNo && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                    Cancel edit
                  </button>
                )}
              </div>

              {editingBillNo && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                  Editing {editingBillNo} — ledger balances will be recalculated after save.
                </div>
              )}
              
              <form onSubmit={handleTransfer} className="space-y-4">
                {/* Source Account Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Source Account (Transfer From) *
                  </label>
                  <Autocomplete
                    options={accounts}
                    getOptionLabel={(option) => `${option.cus_name} (Bal: PKR ${fmtAmt(option.cus_balance)})`}
                    value={accounts.find(acc => acc.cus_id === parseInt(sourceId)) || null}
                    onChange={(event, newValue) => {
                      setSourceId(newValue ? newValue.cus_id.toString() : '');
                    }}
                    disabled={loading || submitting}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search source account..."
                        required
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            backgroundColor: 'white',
                          }
                        }}
                      />
                    )}
                  />
                </div>

                {/* Destination Account Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Destination Account (Transfer To) *
                  </label>
                  <Autocomplete
                    options={accounts}
                    getOptionLabel={(option) => `${option.cus_name} (Bal: PKR ${fmtAmt(option.cus_balance)})`}
                    value={accounts.find(acc => acc.cus_id === parseInt(destinationId)) || null}
                    onChange={(event, newValue) => {
                      setDestinationId(newValue ? newValue.cus_id.toString() : '');
                    }}
                    disabled={loading || submitting}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search destination account..."
                        required
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            backgroundColor: 'white',
                          }
                        }}
                      />
                    )}
                  />
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
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-semibold"
                    />
                  </div>
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transfer Date *
                  </label>
                  <input type="date" lang="en-GB"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    disabled={loading || submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
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
                    placeholder="Enter details about this transfer..."
                    rows={3}
                    disabled={loading || submitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || submitting}
                  className={`w-full py-3 px-4 text-white font-bold rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition duration-200 ${
                    editingBillNo
                      ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {editingBillNo ? <EditIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
                  {submitting ? 'Processing...' : editingBillNo ? 'Update Transfer' : 'Submit Transfer'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Recent Transfers */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 flex flex-col h-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Transfers
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
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-gray-50/50"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : groupedTransfers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-3 text-gray-400">
                    <SwapIcon className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">No transfers found</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Create your first internal transfer using the form on the left.
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
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                                {transfer.bill_no}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(transfer.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2 mt-1">
                              <span className="truncate max-w-[150px]">{transfer.source}</span>
                              <span className="text-blue-500 font-bold">→</span>
                              <span className="truncate max-w-[150px]">{transfer.destination}</span>
                            </div>

                            {transfer.details && (
                              <p className="text-xs text-gray-500 italic mt-1 truncate">
                                {transfer.details}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex flex-col items-end gap-2 shrink-0">
                            <span className="text-base font-extrabold text-blue-600 block">
                              PKR {fmtAmt(transfer.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditTransfer(transfer)}
                              disabled={submitting}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
                              title="Edit transfer"
                            >
                              <EditIcon sx={{ fontSize: 14 }} />
                              Edit
                            </button>
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
