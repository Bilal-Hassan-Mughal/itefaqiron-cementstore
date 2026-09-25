'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatDatePK, formatDateTimePK, parseAppDateTime } from '@/lib/date-helper';
import { notifyLedgerDataChanged } from '@/lib/ledger-tabs';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Filter,
  Eye,
  TrendingDown,
  Receipt,
  Tag,
  CreditCard,
  Wallet,
  Banknote,
  ArrowUpDown,
  RefreshCw,
  Printer,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  Building2,
  FileText,
  CheckCircle2,
  ArrowRightLeft,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Pagination
} from '@mui/material';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [expenseTitles, setExpenseTitles] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [currentView, setCurrentView] = useState('list');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpenseType, setSelectedExpenseType] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formData, setFormData] = useState({
    exp_title: '',
    exp_type: '',
    exp_detail: '',
    exp_amount: '',
    is_paid: 'true',
    paid_from_account_id: '',
    bank_account_id: '',
    cash_amount: '',
    bank_amount: '',
    payment_reference: '',
    paymentMethod: 'CASH'
  });

  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSubmittingType, setIsSubmittingType] = useState(false);
  const saveInFlightRef = useRef(false);

  const getDefaultFormData = useCallback(() => {
    const defaultCashAcc = paymentAccounts.find((acc) => {
      const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('cash') && catTitle.includes('cash');
    });
    return {
      exp_title: '',
      exp_type: '',
      exp_detail: '',
      exp_amount: '',
      is_paid: 'true',
      paid_from_account_id: defaultCashAcc ? defaultCashAcc.cus_id.toString() : '',
      bank_account_id: '',
      cash_amount: '',
      bank_amount: '',
      payment_reference: '',
      paymentMethod: 'CASH',
    };
  }, [paymentAccounts]);

  const refreshPaymentAccounts = useCallback(async () => {
    try {
      const accountsRes = await fetch('/api/customers?dropdown=true');
      if (accountsRes.ok) setPaymentAccounts(await accountsRes.json());
    } catch (error) { console.error('Error refreshing payment accounts:', error); }
  }, []);

  const fetchData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setLoading(true);
      const [expensesRes, expenseTitlesRes, accountsRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/expense-titles'),
        fetch('/api/customers?dropdown=true')
      ]);
      if (expensesRes.ok) setExpenses(await expensesRes.json());
      if (expenseTitlesRes.ok) setExpenseTitles(await expenseTitlesRes.json());
      if (accountsRes.ok) setPaymentAccounts(await accountsRes.json());
    } catch (error) { console.error('Error fetching expenses data:', error); }
    finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (currentView === 'create') setCurrentView('list');
        else if (viewingVoucher) setViewingVoucher(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, viewingVoucher]);

  useEffect(() => {
    if (paymentAccounts.length > 0 && !formData.paid_from_account_id && (formData.paymentMethod === 'CASH' || formData.paymentMethod === 'PARTIAL')) {
      const defaultCashAcc = paymentAccounts.find((acc) => {
        const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
        const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
        return typeTitle.includes('cash') && catTitle.includes('cash');
      });
      if (defaultCashAcc) setFormData((prev) => ({ ...prev, paid_from_account_id: defaultCashAcc.cus_id.toString() }));
    }
  }, [paymentAccounts, formData.paymentMethod, formData.paid_from_account_id]);

  const cashAccountsList = useMemo(() =>
    paymentAccounts.filter((a) => {
      const t = a.customer_type?.cus_type_title?.toLowerCase() || '';
      const c = a.customer_category?.cus_cat_title?.toLowerCase() || '';
      return t.includes('cash') && c.includes('cash');
    }), [paymentAccounts]);

  const bankAccountsList = useMemo(() =>
    paymentAccounts.filter((a) => {
      const t = a.customer_type?.cus_type_title?.toLowerCase() || '';
      const c = a.customer_category?.cus_cat_title?.toLowerCase() || '';
      return t.includes('bank') && c.includes('bank');
    }), [paymentAccounts]);

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (query) {
        const fields = [
          expense.exp_title, expense.exp_detail,
          expense.expense_title?.title,
          expense.paid_from_account?.cus_name,
          expense.bank_account?.cus_name,
          expense.payment_reference,
          String(expense.exp_id)
        ];
        if (!fields.some(f => (f || '').toLowerCase().includes(query))) return false;
      }
      if (selectedExpenseType && String(expense.exp_type) !== String(selectedExpenseType)) return false;

      const cashAmt = parseFloat(expense.cash_amount || 0);
      const bankAmt = parseFloat(expense.bank_amount || 0);
      const isSplit = cashAmt > 0 && bankAmt > 0;
      const isBank = !isSplit && (bankAmt > 0 || expense.paid_from_account?.cus_name?.toLowerCase().includes('bank'));
      const isCash = !isSplit && !isBank;
      if (paymentMethodFilter === 'CASH' && !isCash) return false;
      if (paymentMethodFilter === 'BANK' && !isBank) return false;
      if (paymentMethodFilter === 'PARTIAL' && !isSplit) return false;

      if (datePreset !== 'all') {
        const itemDate = parseAppDateTime(expense.payment_date || expense.created_at);
        if (!itemDate) return true;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (datePreset === 'today' && itemDate < startOfToday) return false;
        if (datePreset === 'week' && itemDate < new Date(now.getTime() - 7 * 86400000)) return false;
        if (datePreset === 'month' && itemDate < new Date(now.getFullYear(), now.getMonth(), 1)) return false;
        if (datePreset === 'custom') {
          if (dateFrom && itemDate < new Date(dateFrom)) return false;
          if (dateTo) { const toD = new Date(dateTo); toD.setHours(23,59,59,999); if (itemDate > toD) return false; }
        }
      }
      return true;
    });
  }, [expenses, searchTerm, selectedExpenseType, paymentMethodFilter, datePreset, dateFrom, dateTo]);

  const finalExpenses = useMemo(() => {
    const sorted = [...filteredExpenses].sort((a, b) => {
      let av, bv;
      if (sortBy === 'created_at') { av = new Date(a.payment_date || a.created_at).getTime(); bv = new Date(b.payment_date || b.created_at).getTime(); }
      else if (sortBy === 'exp_amount') { av = parseFloat(a.exp_amount || 0); bv = parseFloat(b.exp_amount || 0); }
      else if (sortBy === 'exp_title') { av = (a.exp_title || '').toLowerCase(); bv = (b.exp_title || '').toLowerCase(); }
      else { av = a[sortBy]; bv = b[sortBy]; }
      return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return sorted.map((e, i) => ({ ...e, sequentialId: i + 1 }));
  }, [filteredExpenses, sortBy, sortOrder]);

  const paginatedExpenses = useMemo(() => {
    if (pageSize === 0) return finalExpenses;
    const start = (page - 1) * pageSize;
    return finalExpenses.slice(start, start + pageSize);
  }, [finalExpenses, page, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(finalExpenses.length / pageSize) || 1;

  const totalStats = useMemo(() => {
    let totalAmt = 0, cashAmt = 0, bankAmt = 0, splitCount = 0, cashCount = 0, bankCount = 0;
    expenses.forEach((expense) => {
      const amt = parseFloat(expense.exp_amount || 0);
      totalAmt += amt;
      const cAmt = parseFloat(expense.cash_amount || 0);
      const bAmt = parseFloat(expense.bank_amount || 0);
      if (cAmt > 0 || bAmt > 0) {
        cashAmt += cAmt; bankAmt += bAmt;
        if (cAmt > 0 && bAmt > 0) splitCount++;
        else if (cAmt > 0) cashCount++;
        else if (bAmt > 0) bankCount++;
      } else {
        const isBankAcc = expense.paid_from_account?.cus_name?.toLowerCase().includes('bank');
        if (isBankAcc) { bankAmt += amt; bankCount++; } else { cashAmt += amt; cashCount++; }
      }
    });
    const filteredSum = filteredExpenses.reduce((acc, curr) => acc + parseFloat(curr.exp_amount || 0), 0);
    return { totalAmt, totalCount: expenses.length, cashAmt, cashCount, bankAmt, bankCount, splitCount, filteredSum, filteredCount: filteredExpenses.length };
  }, [expenses, filteredExpenses]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getPaymentAmounts = () => {
    const expenseAmount = parseFloat(formData.exp_amount || 0);
    if (formData.paymentMethod === 'CASH') return { cashAmt: expenseAmount, bankAmt: 0, cashAccountId: parseInt(formData.paid_from_account_id, 10), bankAccountId: null };
    if (formData.paymentMethod === 'BANK') return { cashAmt: 0, bankAmt: expenseAmount, cashAccountId: null, bankAccountId: parseInt(formData.bank_account_id, 10) };
    return { cashAmt: parseFloat(formData.cash_amount || 0), bankAmt: parseFloat(formData.bank_amount || 0), cashAccountId: parseInt(formData.paid_from_account_id, 10), bankAccountId: parseInt(formData.bank_account_id, 10) };
  };

  const buildOptimisticExpense = (tempId) => {
    const expenseTitle = expenseTitles.find((t) => String(t.id) === String(formData.exp_type));
    const { cashAmt, bankAmt, cashAccountId, bankAccountId } = getPaymentAmounts();
    const cashAccount = paymentAccounts.find((a) => a.cus_id === cashAccountId);
    const bankAccount = paymentAccounts.find((a) => a.cus_id === bankAccountId);
    return {
      exp_id: tempId, exp_title: formData.exp_title.trim(), exp_type: parseInt(formData.exp_type, 10),
      exp_detail: formData.exp_detail?.trim() || null, exp_amount: parseFloat(formData.exp_amount || 0),
      is_paid: true, paid_from_account_id: cashAmt > 0 ? cashAccountId : null, cash_amount: cashAmt,
      bank_account_id: bankAmt > 0 ? bankAccountId : null, bank_amount: bankAmt,
      payment_reference: formData.payment_reference || null, payment_date: new Date().toISOString(), created_at: new Date().toISOString(),
      expense_title: expenseTitle || { id: parseInt(formData.exp_type, 10), title: 'Expense' },
      paid_from_account: cashAccount ? { cus_id: cashAccount.cus_id, cus_name: cashAccount.cus_name } : null,
      bank_account: bankAccount ? { cus_id: bankAccount.cus_id, cus_name: bankAccount.cus_name } : null,
      _optimistic: true
    };
  };

  const applyLocalAccountDeductions = ({ cashAmt, bankAmt, cashAccountId, bankAccountId }) => {
    if (cashAmt <= 0 && bankAmt <= 0) return;
    setPaymentAccounts((prev) => prev.map((acc) => {
      if (cashAmt > 0 && acc.cus_id === cashAccountId) return { ...acc, cus_balance: parseFloat(acc.cus_balance || 0) - cashAmt };
      if (bankAmt > 0 && acc.cus_id === bankAccountId) return { ...acc, cus_balance: parseFloat(acc.cus_balance || 0) - bankAmt };
      return acc;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveInFlightRef.current) return;
    if (!formData.exp_title.trim()) { alert('Please enter an expense title'); return; }
    if (!formData.exp_type) { alert('Please select an expense category / type'); return; }
    if (!formData.exp_amount || parseFloat(formData.exp_amount) <= 0) { alert('Please enter a valid expense amount'); return; }
    if (formData.paymentMethod === 'CASH' && !formData.paid_from_account_id) { alert('Please select a cash account'); return; }
    if (formData.paymentMethod === 'BANK' && !formData.bank_account_id) { alert('Please select a bank account'); return; }
    if (formData.paymentMethod === 'PARTIAL') {
      if (!formData.paid_from_account_id || !formData.bank_account_id) { alert('Please select both cash and bank accounts'); return; }
      const total = parseFloat(formData.exp_amount || 0);
      const cash = parseFloat(formData.cash_amount || 0);
      const bank = parseFloat(formData.bank_amount || 0);
      if (cash <= 0 || bank <= 0) { alert('Both cash and bank amounts must be greater than zero for split payments'); return; }
      if (Math.abs(cash + bank - total) > 0.01) { alert(`Sum of cash (Rs. ${cash.toLocaleString()}) and bank (Rs. ${bank.toLocaleString()}) must equal total amount (Rs. ${total.toLocaleString()})`); return; }
    }

    const isEditing = Boolean(editingExpense);
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? { id: editingExpense.exp_id, ...formData } : formData;
    const paymentAmounts = getPaymentAmounts();
    const optimisticId = `temp-${Date.now()}`;
    const snapshotForm = { ...formData };
    const snapshotEditing = editingExpense;
    saveInFlightRef.current = true;

    if (isEditing) {
      const opt = { ...buildOptimisticExpense(snapshotEditing.exp_id), exp_id: snapshotEditing.exp_id, created_at: snapshotEditing.created_at };
      setExpenses((prev) => prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? opt : exp)));
    } else {
      setExpenses((prev) => [buildOptimisticExpense(optimisticId), ...prev]);
      applyLocalAccountDeductions(paymentAmounts);
      notifyLedgerDataChanged('expense');
    }

    setCurrentView('list'); setEditingExpense(null); setFormData(getDefaultFormData());

    try {
      const response = await fetch('/api/expenses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) {
        const savedExpense = await response.json();
        setExpenses((prev) => prev.map((exp) => {
          if (isEditing && exp.exp_id === snapshotEditing.exp_id) return { ...savedExpense, _optimistic: false };
          if (!isEditing && exp.exp_id === optimisticId) return { ...savedExpense, _optimistic: false };
          return exp;
        }));
        notifyLedgerDataChanged('expense');
        void refreshPaymentAccounts();
      } else {
        const error = await response.json();
        if (isEditing) setExpenses((prev) => prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? snapshotEditing : exp)));
        else setExpenses((prev) => prev.filter((exp) => exp.exp_id !== optimisticId));
        setFormData(snapshotForm); setEditingExpense(isEditing ? snapshotEditing : null); setCurrentView('create');
        alert(error.error || 'Failed to save expense'); void refreshPaymentAccounts();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      if (isEditing) setExpenses((prev) => prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? snapshotEditing : exp)));
      else setExpenses((prev) => prev.filter((exp) => exp.exp_id !== optimisticId));
      setFormData(snapshotForm); setEditingExpense(isEditing ? snapshotEditing : null); setCurrentView('create');
      alert('Failed to save expense'); void refreshPaymentAccounts();
    } finally { saveInFlightRef.current = false; }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    const cashAmt = parseFloat(expense.cash_amount || 0);
    const bankAmt = parseFloat(expense.bank_amount || 0);
    let method = 'CASH';
    if (cashAmt > 0 && bankAmt > 0) method = 'PARTIAL';
    else if (bankAmt > 0 || expense.paid_from_account?.cus_name?.toLowerCase().includes('bank')) method = 'BANK';
    setFormData({
      exp_title: expense.exp_title, exp_type: expense.exp_type,
      exp_detail: expense.exp_detail || '', exp_amount: expense.exp_amount.toString(), is_paid: 'true',
      paid_from_account_id: expense.paid_from_account_id ? expense.paid_from_account_id.toString() : '',
      bank_account_id: expense.bank_account_id ? expense.bank_account_id.toString() : (method === 'BANK' ? expense.paid_from_account_id?.toString() || '' : ''),
      cash_amount: cashAmt > 0 ? cashAmt.toString() : '', bank_amount: bankAmt > 0 ? bankAmt.toString() : '',
      payment_reference: expense.payment_reference || '', paymentMethod: method
    });
    setCurrentView('create');
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense record? This will revert account balances.')) {
      try {
        const response = await fetch(`/api/expenses?id=${expenseId}`, { method: 'DELETE' });
        if (response.ok) { notifyLedgerDataChanged('expense'); await fetchData(); }
        else { const error = await response.json(); alert(error.error || 'Failed to delete expense'); }
      } catch (error) { console.error('Error deleting expense:', error); alert('Failed to delete expense'); }
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    try {
      setIsSubmittingType(true);
      const response = await fetch('/api/expense-titles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTypeName.trim() }) });
      if (response.ok) {
        const result = await response.json();
        setExpenseTitles((prev) => [...prev, result]);
        setFormData((prev) => ({ ...prev, exp_type: result.id }));
        setShowTypeDialog(false); setNewTypeName('');
      } else { const error = await response.json(); alert(error.error || 'Failed to create expense type'); }
    } catch (error) { console.error('Error creating expense type:', error); alert('Failed to create expense type'); }
    finally { setIsSubmittingType(false); }
  };

  const clearFilters = () => {
    setSearchTerm(''); setSelectedExpenseType(''); setPaymentMethodFilter('ALL');
    setDatePreset('all'); setDateFrom(''); setDateTo(''); setSortBy('created_at'); setSortOrder('desc'); setPage(1);
  };

  const isFiltered = Boolean(searchTerm || selectedExpenseType || paymentMethodFilter !== 'ALL' || datePreset !== 'all' || dateFrom || dateTo);

  const exportToCSV = () => {
    if (finalExpenses.length === 0) { alert('No expense records to export'); return; }
    const headers = ['Row #','Voucher ID','Date','Expense Title','Details / Remarks','Category','Payment Method','Cash Account','Cash Amount','Bank Account','Bank Amount','Total Amount (PKR)','Payment Reference'];
    const rows = finalExpenses.map((exp, idx) => {
      const cashAmt = parseFloat(exp.cash_amount || 0); const bankAmt = parseFloat(exp.bank_amount || 0);
      let method = 'Cash';
      if (cashAmt > 0 && bankAmt > 0) method = 'Split Payment';
      else if (bankAmt > 0 || exp.paid_from_account?.cus_name?.toLowerCase().includes('bank')) method = 'Bank';
      return [idx+1, exp.exp_id, formatDatePK(exp.payment_date || exp.created_at),
        `"${(exp.exp_title || '').replace(/"/g,'""')}"`, `"${(exp.exp_detail || '').replace(/"/g,'""')}"`,
        `"${(exp.expense_title?.title || 'Uncategorized').replace(/"/g,'""')}"`, method,
        `"${(exp.paid_from_account?.cus_name || '').replace(/"/g,'""')}"`,
        cashAmt > 0 ? cashAmt : (method === 'Cash' ? parseFloat(exp.exp_amount || 0) : 0),
        `"${(exp.bank_account?.cus_name || (method === 'Bank' ? exp.paid_from_account?.cus_name : '') || '').replace(/"/g,'""')}"`,
        bankAmt > 0 ? bankAmt : (method === 'Bank' ? parseFloat(exp.exp_amount || 0) : 0),
        parseFloat(exp.exp_amount || 0), `"${(exp.payment_reference || '').replace(/"/g,'""')}"`];
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #fff1f2, #fce7f3)', border: '2px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt style={{ width: 28, height: 28, color: '#f43f5e' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Loading Expense Register</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Retrieving business expenses, accounts &amp; ledger records...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 48, minHeight: '100%' }}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* LEFT: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* BIG Separate Add Expense Button */}
            <button type="button" onClick={() => { setEditingExpense(null); setFormData(getDefaultFormData()); setCurrentView('create'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(244,63,94,0.45)', letterSpacing: '0.01em', transition: 'all 0.2s ease' }}>
              <Plus style={{ width: 20, height: 20, strokeWidth: 2.5 }} /> Add New Expense
            </button>

            {/* Visual Separator Divider */}
            <div style={{ width: 1, height: 42, background: '#cbd5e1', margin: '0 6px' }} />

            {/* Utility Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={exportToCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1px solid #a7f3d0', background: '#f0fdf4', color: '#065f46', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <FileSpreadsheet style={{ width: 14, height: 14, color: '#059669' }} /> Export CSV
              </button>
              <button type="button" onClick={() => fetchData(true)} disabled={isRefreshing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: isRefreshing ? 0.6 : 1 }}>
                <RefreshCw style={{ width: 13, height: 13, color: isRefreshing ? '#f43f5e' : '#64748b' }} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button type="button" onClick={() => setShowTypeDialog(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Tag style={{ width: 13, height: 13 }} /> Categories ({expenseTitles.length})
              </button>
            </div>
          </div>

          {/* RIGHT: Page Title & Breadcrumbs */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Finance &amp; Accounts</span>
              <ChevronRight style={{ width: 13, height: 13, color: '#94a3b8' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e11d48', background: '#fff1f2', padding: '2px 10px', borderRadius: 20, border: '1px solid #fecdd3' }}>Expense Register</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              Expense Management Register
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 3px 8px rgba(244,63,94,0.3)' }}>
                <Receipt style={{ width: 18, height: 18, color: '#fff' }} />
              </span>
            </h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontWeight: 500 }}>Financial operating ledger spreadsheet &amp; disbursement records</p>
          </div>
        </div>

        {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Outflow', value: totalStats.totalAmt, sub: `${totalStats.totalCount} total entries`, icon: <TrendingDown style={{ width: 14, height: 14, color: '#f43f5e' }} />, accent: '#f43f5e', accentBg: '#fff1f2', accentBorder: '#fecdd3', iconBg: '#fff1f2', color: '#0f172a', prefix: '#94a3b8' },
            { label: 'Cash Disbursed', value: totalStats.cashAmt, sub: `${totalStats.cashCount} payments · ${totalStats.totalAmt > 0 ? Math.round((totalStats.cashAmt / totalStats.totalAmt) * 100) : 0}%`, icon: <Banknote style={{ width: 14, height: 14, color: '#22c55e' }} />, accent: '#22c55e', accentBg: '#f0fdf4', accentBorder: '#bbf7d0', iconBg: '#dcfce7', color: '#15803d', prefix: '#86efac' },
            { label: 'Bank Disbursed', value: totalStats.bankAmt, sub: `${totalStats.bankCount} payments · ${totalStats.totalAmt > 0 ? Math.round((totalStats.bankAmt / totalStats.totalAmt) * 100) : 0}%`, icon: <CreditCard style={{ width: 14, height: 14, color: '#3b82f6' }} />, accent: '#3b82f6', accentBg: '#eff6ff', accentBorder: '#bfdbfe', iconBg: '#dbeafe', color: '#1d4ed8', prefix: '#93c5fd' },
            { label: 'Filtered Sum', value: totalStats.filteredSum, sub: `${totalStats.filteredCount} rows · ${totalStats.splitCount} split`, icon: <SlidersHorizontal style={{ width: 14, height: 14, color: '#a855f7' }} />, accent: '#a855f7', accentBg: '#faf5ff', accentBorder: '#e9d5ff', iconBg: '#f3e8ff', color: '#7e22ce', prefix: '#d8b4fe' },
          ].map((card, i) => (
            <div key={i} style={{ background: `linear-gradient(135deg, ${card.accentBg} 0%, #fff 60%)`, border: `1px solid ${card.accentBorder}`, borderLeft: `4px solid ${card.accent}`, borderRadius: 12, padding: '14px 16px', boxShadow: `0 2px 8px ${card.accent}15` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: card.prefix, marginRight: 3 }}>Rs.</span>{fmtAmt(card.value)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontWeight: 500 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ── FILTER TOOLBAR ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: showFilters ? '1px solid #f1f5f9' : 'none' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search style={{ width: 14, height: 14, color: '#94a3b8', position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" placeholder="Search title, category, account, reference, ID..."
                value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ width: '100%', paddingLeft: 32, paddingRight: searchTerm ? 32 : 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>
            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12 }}>
              <ArrowUpDown style={{ width: 13, height: 13, color: '#94a3b8' }} />
              <span style={{ color: '#64748b', fontWeight: 600 }}>Sort:</span>
              <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [f, o] = e.target.value.split('-'); setSortBy(f); setSortOrder(o); }} style={{ background: 'none', border: 'none', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="exp_amount-desc">Amount: High–Low</option>
                <option value="exp_amount-asc">Amount: Low–High</option>
                <option value="exp_title-asc">Title: A–Z</option>
              </select>
            </div>
            {/* Rows */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Show:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ background: 'none', border: 'none', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                <option value={15}>15 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={0}>All rows</option>
              </select>
            </div>
            {/* Toggle filters */}
            <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${isFiltered ? '#fecdd3' : '#e2e8f0'}`, background: isFiltered ? '#fff1f2' : '#f8fafc', color: isFiltered ? '#e11d48' : '#475569', cursor: 'pointer' }}>
              <Filter style={{ width: 13, height: 13 }} />
              Filters{isFiltered ? ' (Active)' : ''}
              {showFilters ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
            </button>
            {isFiltered && (
              <button type="button" onClick={clearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', cursor: 'pointer' }}>
                <X style={{ width: 12, height: 12 }} /> Reset
              </button>
            )}
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div style={{ padding: '14px 16px', background: '#fafafa', display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              {/* Payment Method */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Payment Method</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[{ id: 'ALL', label: 'All', c: '#1e293b' }, { id: 'CASH', label: '💵 Cash', c: '#16a34a' }, { id: 'BANK', label: '🏦 Bank', c: '#1d4ed8' }, { id: 'PARTIAL', label: '⚡ Split', c: '#7e22ce' }].map(pill => (
                    <button key={pill.id} type="button" onClick={() => { setPaymentMethodFilter(pill.id); setPage(1); }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: paymentMethodFilter === pill.id ? `1.5px solid ${pill.c}` : '1px solid #e2e8f0', background: paymentMethodFilter === pill.id ? pill.c : '#fff', color: paymentMethodFilter === pill.id ? '#fff' : '#475569' }}>
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Category */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Category</div>
                <select value={selectedExpenseType} onChange={(e) => { setSelectedExpenseType(e.target.value); setPage(1); }} style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', color: '#1e293b', background: '#fff', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  <option value="">All Categories ({expenseTitles.length})</option>
                  {expenseTitles.map((cat) => (<option key={cat.id} value={cat.id}>{cat.title}</option>))}
                </select>
              </div>
              {/* Date Range */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Date Range</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[{ id: 'all', label: 'All Time' }, { id: 'today', label: 'Today' }, { id: 'week', label: 'Last 7 Days' }, { id: 'month', label: 'This Month' }, { id: 'custom', label: 'Custom' }].map(d => (
                    <button key={d.id} type="button" onClick={() => { setDatePreset(d.id); setPage(1); }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: datePreset === d.id ? '1.5px solid #1e293b' : '1px solid #e2e8f0', background: datePreset === d.id ? '#1e293b' : '#fff', color: datePreset === d.id ? '#fff' : '#475569' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>From:</span>
                    <input type="date" lang="en-GB" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: '#0f172a', outline: 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>To:</span>
                    <input type="date" lang="en-GB" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', fontSize: 12, color: '#0f172a', outline: 'none' }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SPREADSHEET TABLE ──────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {/* Status bar */}
          <div style={{ padding: '9px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#1e293b' }}>
                <FileSpreadsheet style={{ width: 13, height: 13, color: '#e11d48' }} /> Operating Expenses Ledger
              </span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#64748b' }}>Showing <strong style={{ color: '#0f172a' }}>{paginatedExpenses.length}</strong> of <strong style={{ color: '#0f172a' }}>{finalExpenses.length}</strong> rows</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Filtered Total: <strong style={{ color: '#e11d48', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>Rs. {fmtAmt(totalStats.filteredSum)}</strong>
            </div>
          </div>
          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #e8edf5 100%)' }}>
                  {[
                    { label: '#', align: 'center', bg: '#e2e8f0', w: 44 },
                    { label: 'Date', align: 'center', w: 100 },
                    { label: 'Expense Title & Remarks', align: 'left', w: 230 },
                    { label: 'Category', align: 'left', w: 130 },
                    { label: 'Method', align: 'center', w: 80 },
                    { label: 'Disbursement Account', align: 'left', w: 190 },
                    { label: 'Reference #', align: 'center', w: 110 },
                    { label: 'Amount (PKR)', align: 'right', w: 130, accent: true },
                    { label: 'Actions', align: 'center', w: 90 },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: '9px 10px', textAlign: col.align, fontSize: 10, fontWeight: 700, color: col.accent ? '#be123c' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #e2e8f0', background: col.bg || (col.accent ? 'rgba(254,205,211,0.3)' : 'transparent'), whiteSpace: 'nowrap', minWidth: col.w }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', background: '#fafafa' }}>
                      <Receipt style={{ width: 36, height: 36, margin: '0 auto 10px', color: '#e2e8f0', display: 'block' }} />
                      <div style={{ fontWeight: 700, color: '#64748b', fontSize: 14 }}>No Expense Records Found</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{isFiltered ? 'No entries match your current filters.' : 'No expense entries logged yet.'}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense, idx) => {
                    const cashAmt = parseFloat(expense.cash_amount || 0);
                    const bankAmt = parseFloat(expense.bank_amount || 0);
                    const isSplit = cashAmt > 0 && bankAmt > 0;
                    const isBank = !isSplit && (bankAmt > 0 || expense.paid_from_account?.cus_name?.toLowerCase().includes('bank'));
                    const rowBg = idx % 2 === 0 ? '#fff' : '#fafafa';
                    const cellStyle = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #e2e8f0' };
                    return (
                      <tr key={expense.exp_id} style={{ background: rowBg, transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                        <td style={{ ...cellStyle, textAlign: 'center', background: '#f8fafc', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{expense.sequentialId}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12 }}>{formatDatePK(expense.payment_date || expense.created_at)}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>#{expense.exp_id}</div>
                        </td>
                        <td style={{ ...cellStyle, maxWidth: 230 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{expense.exp_title}</div>
                          {expense.exp_detail && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={expense.exp_detail}>{expense.exp_detail}</div>}
                        </td>
                        <td style={cellStyle}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' }}>
                            {expense.expense_title?.title || 'Uncategorized'}
                          </span>
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>
                          {isSplit ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>Split</span>
                          : isBank ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Bank</span>
                          : <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>Cash</span>}
                        </td>
                        <td style={cellStyle}>
                          {isSplit ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#15803d' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 4 }}>Cash: {expense.paid_from_account?.cus_name || 'Cash'}</span>
                                <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>Rs.{fmtAmt(cashAmt)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 4 }}>Bank: {expense.bank_account?.cus_name || 'Bank'}</span>
                                <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>Rs.{fmtAmt(bankAmt)}</span>
                              </div>
                            </div>
                          ) : isBank ? (
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.bank_account?.cus_name || expense.paid_from_account?.cus_name || 'Bank Account'}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.paid_from_account?.cus_name || 'Cash in Hand'}
                            </div>
                          )}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>
                          {expense.payment_reference || <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'right', background: 'rgba(254,205,211,0.15)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, color: '#f43f5e', marginRight: 3 }}>Rs.</span>
                          <span style={{ fontSize: 13, fontWeight: 900, color: '#e11d48', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(expense.exp_amount)}</span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {[
                              { icon: <Eye style={{ width: 13, height: 13 }} />, onClick: () => setViewingVoucher(expense), title: 'View', hoverBg: '#f1f5f9', color: '#64748b' },
                              { icon: <Edit style={{ width: 13, height: 13 }} />, onClick: () => handleEdit(expense), title: 'Edit', hoverBg: '#dbeafe', color: '#3b82f6' },
                              { icon: <Trash2 style={{ width: 13, height: 13 }} />, onClick: () => handleDelete(expense.exp_id), title: 'Delete', hoverBg: '#fff1f2', color: '#f43f5e' },
                            ].map((btn, bi) => (
                              <button key={bi} type="button" onClick={btn.onClick} title={btn.title}
                                style={{ padding: 5, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: btn.color, display: 'flex', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.background = btn.hoverBg}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {btn.icon}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #e8edf5 100%)', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 800, fontSize: 12, color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                    TOTAL — {finalExpenses.length} filtered entries
                  </td>
                  <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                    All-time: <strong style={{ color: '#1e293b' }}>Rs. {fmtAmt(totalStats.totalAmt)}</strong>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#e11d48', background: 'rgba(254,205,211,0.3)', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                    Rs. {fmtAmt(totalStats.filteredSum)}
                  </td>
                  <td style={{ padding: '10px 12px' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── PAGINATION ─────────────────────────────────────────────────── */}
        {finalExpenses.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              Showing <strong style={{ color: '#0f172a' }}>{paginatedExpenses.length}</strong> of <strong style={{ color: '#0f172a' }}>{finalExpenses.length}</strong> rows &nbsp;·&nbsp; Page <strong style={{ color: '#0f172a' }}>{page}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong>
            </div>
            {pageSize > 0 && totalPages > 1 && (
              <Pagination count={totalPages} page={page} onChange={(e, val) => setPage(val)} color="primary" size="small" shape="rounded" />
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════ ADD / EDIT EXPENSE MODAL ══════════════════════ */}
      {currentView === 'create' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setCurrentView('list'); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 560, background: '#fff', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden', margin: 'auto', animation: 'fadeInUp 0.2s ease-out' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #f43f5e, #e11d48, #fb7185)' }} />

            {/* Modal Header */}
            <div style={{ padding: '16px 20px 14px', background: 'linear-gradient(135deg, rgba(255,241,242,0.5) 0%, #fff 100%)', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(244,63,94,0.3)' }}>
                  <Receipt style={{ width: 17, height: 17, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>{editingExpense ? 'Edit Expense Entry' : 'Record New Expense'}</h3>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', textTransform: 'uppercase' }}>
                      {editingExpense ? `Voucher #${editingExpense.exp_id}` : 'New Voucher'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Post expense to cash or bank ledger</p>
                </div>
              </div>
              <button type="button" onClick={() => setCurrentView('list')} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} id="expense-modal-form" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Section 1: Expense Details */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FileText style={{ width: 11, height: 11 }} /> Expense Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Expense Title <span style={{ color: '#f43f5e' }}>*</span></label>
                    <input type="text" name="exp_title" value={formData.exp_title} onChange={handleInputChange} required placeholder="e.g. Office Rent"
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#0f172a', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  {/* Category */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Category <span style={{ color: '#f43f5e' }}>*</span></label>
                      <button type="button" onClick={() => setShowTypeDialog(true)} style={{ fontSize: 10, fontWeight: 700, color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, padding: '2px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Plus style={{ width: 10, height: 10 }} /> New
                      </button>
                    </div>
                    <Autocomplete
                      options={expenseTitles}
                      getOptionLabel={(option) => typeof option === 'string' ? option : option.title || ''}
                      value={expenseTitles.find((t) => String(t.id) === String(formData.exp_type)) || null}
                      onChange={(event, newValue) => setFormData((prev) => ({ ...prev, exp_type: newValue ? newValue.id : '' }))}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField {...params} size="small" required={!formData.exp_type} fullWidth variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#fff', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', '& fieldset': { borderColor: '#e2e8f0', borderWidth: '1.5px' }, '&:hover fieldset': { borderColor: '#cbd5e1' }, '&.Mui-focused fieldset': { borderColor: '#f43f5e', borderWidth: '1.5px' } } }} />
                      )} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  {/* Amount */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Amount (PKR) <span style={{ color: '#f43f5e' }}>*</span></label>
                      {parseFloat(formData.exp_amount || 0) > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#e11d48', fontFamily: 'monospace', background: '#fff1f2', padding: '2px 7px', borderRadius: 5, border: '1px solid #fecdd3' }}>Rs. {fmtAmt(formData.exp_amount)}</span>
                      )}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 10, fontSize: 10, fontWeight: 800, color: '#e11d48', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 5, padding: '1px 5px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1 }}>Rs.</span>
                      <input type="number" step="0.01" min="0.01" name="exp_amount" value={formData.exp_amount} onChange={handleInputChange} required
                        style={{ width: '100%', paddingLeft: 46, paddingRight: 10, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 900, fontFamily: 'monospace', border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                  </div>
                  {/* Reference */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Reference <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
                    <input type="text" name="payment_reference" value={formData.payment_reference || ''} onChange={handleInputChange} placeholder="Cheque #, TXN ID..."
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#0f172a', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                </div>

                {/* Remarks */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5 }}>Particulars / Remarks <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>(Optional)</span></label>
                  <input type="text" name="exp_detail" value={formData.exp_detail} onChange={handleInputChange} placeholder="Additional details..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 500, border: '1.5px solid #e2e8f0', borderRadius: 8, outline: 'none', color: '#0f172a', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>

              {/* Section 2: Disbursement Channel */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Wallet style={{ width: 11, height: 11 }} /> Disbursement Channel
                </div>

                {/* Method Toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {[
                    { id: 'CASH', label: 'Cash Drawer', icon: <Banknote style={{ width: 14, height: 14 }} />, ac: '#22c55e', bg: '#f0fdf4', bd: '#bbf7d0', tc: '#15803d' },
                    { id: 'BANK', label: 'Bank Account', icon: <Building2 style={{ width: 14, height: 14 }} />, ac: '#3b82f6', bg: '#eff6ff', bd: '#bfdbfe', tc: '#1d4ed8' },
                    { id: 'PARTIAL', label: 'Split Pay', icon: <ArrowRightLeft style={{ width: 14, height: 14 }} />, ac: '#a855f7', bg: '#faf5ff', bd: '#e9d5ff', tc: '#7e22ce' }
                  ].map(m => {
                    const active = formData.paymentMethod === m.id;
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: m.id, paid_from_account_id: m.id === 'BANK' ? '' : getDefaultFormData().paid_from_account_id, bank_account_id: '', cash_amount: '', bank_amount: '' }))}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', borderRadius: 10, cursor: 'pointer', border: active ? `2px solid ${m.ac}` : '2px solid #e2e8f0', background: active ? m.bg : '#fff', gap: 4, transition: 'all 0.15s' }}>
                        <span style={{ color: active ? m.ac : '#94a3b8' }}>{m.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: active ? m.tc : '#64748b' }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Account */}
                {formData.paymentMethod === 'CASH' && (
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#14532d' }}>Cash Account <span style={{ color: '#f43f5e' }}>*</span></label>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 }}>Cash Drawer</span>
                    </div>
                    <Autocomplete
                      options={cashAccountsList}
                      getOptionLabel={(account) => `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                      value={cashAccountsList.find((a) => a.cus_id.toString() === formData.paid_from_account_id) || null}
                      onChange={(event, newValue) => setFormData((prev) => ({ ...prev, paid_from_account_id: newValue ? newValue.cus_id.toString() : '' }))}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField {...params} size="small" required={!formData.paid_from_account_id} fullWidth variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#fff', fontSize: '0.75rem', fontWeight: 600, '& fieldset': { borderColor: '#a7f3d0', borderWidth: '1.5px' }, '&:hover fieldset': { borderColor: '#6ee7b7' }, '&.Mui-focused fieldset': { borderColor: '#22c55e', borderWidth: '1.5px' } } }} />
                      )} />
                  </div>
                )}

                {/* Bank Account */}
                {formData.paymentMethod === 'BANK' && (
                  <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>Bank Account <span style={{ color: '#f43f5e' }}>*</span></label>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 10 }}>Bank Transfer</span>
                    </div>
                    <Autocomplete
                      options={bankAccountsList}
                      getOptionLabel={(account) => `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                      value={bankAccountsList.find((a) => a.cus_id.toString() === formData.bank_account_id) || null}
                      onChange={(event, newValue) => setFormData((prev) => ({ ...prev, bank_account_id: newValue ? newValue.cus_id.toString() : '' }))}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField {...params} size="small" required={!formData.bank_account_id} fullWidth variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#fff', fontSize: '0.75rem', fontWeight: 600, '& fieldset': { borderColor: '#bfdbfe', borderWidth: '1.5px' }, '&:hover fieldset': { borderColor: '#93c5fd' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6', borderWidth: '1.5px' } } }} />
                      )} />
                  </div>
                )}

                {/* Split Payment */}
                {formData.paymentMethod === 'PARTIAL' && (
                  <div style={{ background: '#faf5ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e9d5ff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* Cash portion */}
                      <div style={{ background: '#fff', borderRadius: 9, padding: '10px 12px', border: '1px solid #e9d5ff' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Cash Account *</label>
                        <Autocomplete options={cashAccountsList} getOptionLabel={(a) => a.cus_name}
                          value={cashAccountsList.find((a) => a.cus_id.toString() === formData.paid_from_account_id) || null}
                          onChange={(event, newValue) => setFormData((prev) => ({ ...prev, paid_from_account_id: newValue ? newValue.cus_id.toString() : '' }))}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => <TextField {...params} size="small" required={!formData.paid_from_account_id} fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '7px', fontSize: '0.72rem', '& fieldset': { borderColor: '#e2e8f0' } } }} />} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Cash Amount *</label>
                          {parseFloat(formData.exp_amount || 0) > 0 && (
                            <button type="button" onClick={() => { const t = parseFloat(formData.exp_amount || 0); const b = parseFloat(formData.bank_amount || 0); setFormData((prev) => ({ ...prev, cash_amount: Math.max(0, t - b).toString() })); }} style={{ fontSize: 10, fontWeight: 700, color: '#7e22ce', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Fill Balance</button>
                          )}
                        </div>
                        <input type="number" step="0.01" min="0.01" name="cash_amount" value={formData.cash_amount || ''} onChange={handleInputChange} required
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', border: '1.5px solid #e2e8f0', borderRadius: 7, outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = '#a855f7'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                      </div>
                      {/* Bank portion */}
                      <div style={{ background: '#fff', borderRadius: 9, padding: '10px 12px', border: '1px solid #e9d5ff' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Bank Account *</label>
                        <Autocomplete options={bankAccountsList} getOptionLabel={(a) => a.cus_name}
                          value={bankAccountsList.find((a) => a.cus_id.toString() === formData.bank_account_id) || null}
                          onChange={(event, newValue) => setFormData((prev) => ({ ...prev, bank_account_id: newValue ? newValue.cus_id.toString() : '' }))}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => <TextField {...params} size="small" required={!formData.bank_account_id} fullWidth variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '7px', fontSize: '0.72rem', '& fieldset': { borderColor: '#e2e8f0' } } }} />} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Bank Amount *</label>
                          {parseFloat(formData.exp_amount || 0) > 0 && (
                            <button type="button" onClick={() => { const t = parseFloat(formData.exp_amount || 0); const c = parseFloat(formData.cash_amount || 0); setFormData((prev) => ({ ...prev, bank_amount: Math.max(0, t - c).toString() })); }} style={{ fontSize: 10, fontWeight: 700, color: '#7e22ce', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Fill Balance</button>
                          )}
                        </div>
                        <input type="number" step="0.01" min="0.01" name="bank_amount" value={formData.bank_amount || ''} onChange={handleInputChange} required
                          style={{ width: '100%', padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', border: '1.5px solid #e2e8f0', borderRadius: 7, outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = '#a855f7'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                      </div>
                    </div>

                    {/* Split Balance Status */}
                    {parseFloat(formData.exp_amount || 0) > 0 && (() => {
                      const total = parseFloat(formData.exp_amount || 0);
                      const cash = parseFloat(formData.cash_amount || 0);
                      const bank = parseFloat(formData.bank_amount || 0);
                      const remaining = total - (cash + bank);
                      const isBalanced = Math.abs(remaining) < 0.01;
                      const isOver = remaining < -0.01;
                      return (
                        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: isBalanced ? '#f0fdf4' : isOver ? '#fff1f2' : '#fefce8', border: `1px solid ${isBalanced ? '#bbf7d0' : isOver ? '#fecdd3' : '#fde68a'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {isBalanced ? <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 style={{ width: 13, height: 13 }} /> Fully Balanced</span>
                          : isOver ? <span style={{ fontSize: 11, fontWeight: 700, color: '#e11d48' }}>Over-allocated: Rs. {fmtAmt(Math.abs(remaining))}</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Remaining: Rs. {fmtAmt(remaining)}</span>}
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>Rs. {fmtAmt(cash + bank)} / Rs. {fmtAmt(total)}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Form Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Total Outflow: <strong style={{ fontSize: 15, fontWeight: 900, color: '#e11d48', fontFamily: 'monospace' }}>Rs. {fmtAmt(formData.exp_amount || 0)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => setCurrentView('list')} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" form="expense-modal-form" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 9, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(244,63,94,0.35)' }}>
                    <Receipt style={{ width: 13, height: 13 }} />
                    {editingExpense ? 'Update Expense' : 'Save Expense'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════ VIEW VOUCHER MODAL ═══════════════════════════ */}
      {viewingVoucher && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewingVoucher(null); }}>
          <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden', margin: 'auto' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #f43f5e, #e11d48, #fb7185)' }} />
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(244,63,94,0.3)' }}>
                  <Receipt style={{ width: 18, height: 18, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Expense Voucher</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Official disbursement record</div>
                </div>
              </div>
              <button type="button" onClick={() => setViewingVoucher(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div style={{ padding: '20px 20px 0' }} id="printable-expense-voucher">
              {/* Amount Hero */}
              <div style={{ textAlign: 'center', padding: '20px 16px', background: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 50%, #fff 100%)', borderRadius: 14, border: '1px solid #fecdd3', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Disbursement Amount</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#e11d48', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.02em' }}>Rs. {fmtAmt(viewingVoucher.exp_amount)}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 6 }}>Voucher #{viewingVoucher.exp_id} · {formatDatePK(viewingVoucher.payment_date || viewingVoucher.created_at)}</div>
              </div>

              {/* Info Rows */}
              <div>
                {[
                  { label: 'Expense Title', value: <strong style={{ color: '#0f172a', fontSize: 13 }}>{viewingVoucher.exp_title}</strong> },
                  { label: 'Category', value: <span style={{ fontSize: 11, fontWeight: 700, background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '2px 10px', borderRadius: 20 }}>{viewingVoucher.expense_title?.title || 'Uncategorized'}</span> },
                  { label: 'Timestamp', value: <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDateTimePK(viewingVoucher.payment_date || viewingVoucher.created_at)}</span> },
                  ...(viewingVoucher.payment_reference ? [{ label: 'Reference', value: <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>{viewingVoucher.payment_reference}</span> }] : []),
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{row.label}</span>
                    {row.value}
                  </div>
                ))}
                {/* Disbursement Breakdown */}
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Disbursement Breakdown</div>
                  {(() => {
                    const cAmt = parseFloat(viewingVoucher.cash_amount || 0);
                    const bAmt = parseFloat(viewingVoucher.bank_amount || 0);
                    if (cAmt > 0 && bAmt > 0) return (
                      <div style={{ background: '#faf5ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #e9d5ff', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#15803d' }}><span>Cash: {viewingVoucher.paid_from_account?.cus_name || 'Cash'}</span><span style={{ fontFamily: 'monospace' }}>Rs. {fmtAmt(cAmt)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}><span>Bank: {viewingVoucher.bank_account?.cus_name || 'Bank'}</span><span style={{ fontFamily: 'monospace' }}>Rs. {fmtAmt(bAmt)}</span></div>
                      </div>
                    );
                    if (bAmt > 0 || viewingVoucher.paid_from_account?.cus_name?.toLowerCase().includes('bank')) return (
                      <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                        <span>Bank: {viewingVoucher.bank_account?.cus_name || viewingVoucher.paid_from_account?.cus_name}</span><span style={{ fontFamily: 'monospace' }}>Rs. {fmtAmt(viewingVoucher.exp_amount)}</span>
                      </div>
                    );
                    return (
                      <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                        <span>Cash: {viewingVoucher.paid_from_account?.cus_name || 'Cash in Hand'}</span><span style={{ fontFamily: 'monospace' }}>Rs. {fmtAmt(viewingVoucher.exp_amount)}</span>
                      </div>
                    );
                  })()}
                </div>
                {viewingVoucher.exp_detail && (
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Particulars / Remarks</div>
                    <p style={{ margin: 0, fontSize: 12, color: '#374151', background: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', lineHeight: 1.6 }}>{viewingVoucher.exp_detail}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Printer style={{ width: 13, height: 13 }} /> Print
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { const toEdit = viewingVoucher; setViewingVoucher(null); handleEdit(toEdit); }} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                <button type="button" onClick={() => setViewingVoucher(null)} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ ADD CATEGORY DIALOG ═══════════════════════ */}
      <Dialog open={showTypeDialog} onClose={() => setShowTypeDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px', p: 0.5, overflow: 'hidden' } }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #f43f5e, #e11d48, #fb7185)' }} />
        <DialogTitle sx={{ m: 0, p: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecdd3' }}>
              <Tag style={{ color: '#e11d48', width: 14, height: 14 }} />
            </div>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Add Expense Category</Typography>
          </Box>
          <IconButton onClick={() => setShowTypeDialog(false)} size="small"><X size={16} color="#94a3b8" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 2, pt: 2.5 }}>
          <TextField fullWidth autoFocus label="Category Title *" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateType(); } }}
            placeholder="e.g., Office Rent, Electricity, Fuel" size="small" variant="outlined"
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #f1f5f9', gap: 1 }}>
          <Button onClick={() => setShowTypeDialog(false)} size="small" variant="outlined" sx={{ borderRadius: '8px', fontSize: '0.75rem', textTransform: 'none', fontWeight: 700, borderColor: '#e2e8f0', color: '#64748b' }}>Cancel</Button>
          <Button onClick={handleCreateType} disabled={isSubmittingType || !newTypeName.trim()} size="small" variant="contained"
            sx={{ borderRadius: '8px', fontSize: '0.75rem', textTransform: 'none', fontWeight: 800, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', '&:hover': { background: 'linear-gradient(135deg, #e11d48, #be123c)' } }}>
            {isSubmittingType ? 'Saving...' : 'Save Category'}
          </Button>
        </DialogActions>
      </Dialog>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </DashboardLayout>
  );
}
