'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatDatePK, formatDateTimePK, parseAppDateTime } from '@/lib/date-helper';
import { notifyLedgerDataChanged } from '@/lib/ledger-tabs';
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  DollarSign,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Eye,
  TrendingDown,
  TrendingUp,
  Receipt,
  Tag,
  CreditCard,
  Wallet,
  Banknote,
  ArrowUpDown,
  RefreshCw,
  Printer,
  ChevronRight,
  Clock,
  ArrowRight,
  Layers,
  FileSpreadsheet,
  Download
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
  Pagination,
  Tooltip
} from '@mui/material';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ExpensesPage() {
  // Core data states
  const [expenses, setExpenses] = useState([]);
  const [expenseTitles, setExpenseTitles] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list' (main) or 'create' (form modal)

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpenseType, setSelectedExpenseType] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL'); // 'ALL' | 'CASH' | 'BANK' | 'PARTIAL'
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at'); // 'created_at' | 'exp_amount' | 'exp_title'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form data
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

  // Expense Type Modal
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSubmittingType, setIsSubmittingType] = useState(false);
  const saveInFlightRef = useRef(false);

  // Default form factory
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
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setPaymentAccounts(accountsData);
      }
    } catch (error) {
      console.error('Error refreshing payment accounts:', error);
    }
  }, []);

  // Fetch initial data
  const fetchData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setLoading(true);

      const [expensesRes, expenseTitlesRes, accountsRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/expense-titles'),
        fetch('/api/customers?dropdown=true')
      ]);

      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setExpenses(expensesData);
      }
      if (expenseTitlesRes.ok) {
        const expenseTitlesData = await expenseTitlesRes.json();
        setExpenseTitles(expenseTitlesData);
      }
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setPaymentAccounts(accountsData);
      }
    } catch (error) {
      console.error('Error fetching expenses data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Default cash account auto-select
  useEffect(() => {
    if (
      paymentAccounts.length > 0 &&
      !formData.paid_from_account_id &&
      (formData.paymentMethod === 'CASH' || formData.paymentMethod === 'PARTIAL')
    ) {
      const defaultCashAcc = paymentAccounts.find((acc) => {
        const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
        const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
        return typeTitle.includes('cash') && catTitle.includes('cash');
      });
      if (defaultCashAcc) {
        setFormData((prev) => ({
          ...prev,
          paid_from_account_id: defaultCashAcc.cus_id.toString()
        }));
      }
    }
  }, [paymentAccounts, formData.paymentMethod, formData.paid_from_account_id]);

  // Account categories filtering
  const cashAccountsList = useMemo(() => {
    return paymentAccounts.filter((account) => {
      const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('cash') && catTitle.includes('cash');
    });
  }, [paymentAccounts]);

  const bankAccountsList = useMemo(() => {
    return paymentAccounts.filter((account) => {
      const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('bank') && catTitle.includes('bank');
    });
  }, [paymentAccounts]);

  // Comprehensive Filter & Search logic
  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return expenses.filter((expense) => {
      // 1. Text Search: Title, Detail, Category Title, Account Names, Reference, ID
      if (query) {
        const title = expense.exp_title?.toLowerCase() || '';
        const detail = expense.exp_detail?.toLowerCase() || '';
        const catTitle = expense.expense_title?.title?.toLowerCase() || '';
        const cashAcc = expense.paid_from_account?.cus_name?.toLowerCase() || '';
        const bankAcc = expense.bank_account?.cus_name?.toLowerCase() || '';
        const ref = expense.payment_reference?.toLowerCase() || '';
        const idStr = String(expense.exp_id);

        const match =
          title.includes(query) ||
          detail.includes(query) ||
          catTitle.includes(query) ||
          cashAcc.includes(query) ||
          bankAcc.includes(query) ||
          ref.includes(query) ||
          idStr.includes(query);

        if (!match) return false;
      }

      // 2. Category Filter
      if (selectedExpenseType && String(expense.exp_type) !== String(selectedExpenseType)) {
        return false;
      }

      // 3. Payment Method Filter
      const cashAmt = parseFloat(expense.cash_amount || 0);
      const bankAmt = parseFloat(expense.bank_amount || 0);
      const isSplit = cashAmt > 0 && bankAmt > 0;
      const isBank = !isSplit && (bankAmt > 0 || expense.paid_from_account?.cus_name?.toLowerCase().includes('bank'));
      const isCash = !isSplit && !isBank;

      if (paymentMethodFilter === 'CASH' && !isCash) return false;
      if (paymentMethodFilter === 'BANK' && !isBank) return false;
      if (paymentMethodFilter === 'PARTIAL' && !isSplit) return false;

      // 4. Date Filter
      if (datePreset !== 'all') {
        const itemDate = parseAppDateTime(expense.payment_date || expense.created_at);
        if (!itemDate) return true;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (datePreset === 'today') {
          if (itemDate < startOfToday) return false;
        } else if (datePreset === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < sevenDaysAgo) return false;
        } else if (datePreset === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (itemDate < startOfMonth) return false;
        } else if (datePreset === 'custom') {
          if (dateFrom) {
            const fromD = new Date(dateFrom);
            if (itemDate < fromD) return false;
          }
          if (dateTo) {
            const toD = new Date(dateTo);
            toD.setHours(23, 59, 59, 999);
            if (itemDate > toD) return false;
          }
        }
      }

      return true;
    });
  }, [expenses, searchTerm, selectedExpenseType, paymentMethodFilter, datePreset, dateFrom, dateTo]);

  // Sorting
  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let aValue, bValue;

      if (sortBy === 'created_at') {
        aValue = new Date(a.payment_date || a.created_at).getTime();
        bValue = new Date(b.payment_date || b.created_at).getTime();
      } else if (sortBy === 'exp_amount') {
        aValue = parseFloat(a.exp_amount || 0);
        bValue = parseFloat(b.exp_amount || 0);
      } else if (sortBy === 'exp_title') {
        aValue = (a.exp_title || '').toLowerCase();
        bValue = (b.exp_title || '').toLowerCase();
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  }, [filteredExpenses, sortBy, sortOrder]);

  // Sequential numbering
  const finalExpenses = useMemo(() => {
    return sortedExpenses.map((expense, idx) => ({
      ...expense,
      sequentialId: idx + 1
    }));
  }, [sortedExpenses]);

  // Paginated Expenses
  const paginatedExpenses = useMemo(() => {
    if (pageSize === 0) return finalExpenses; // All
    const start = (page - 1) * pageSize;
    return finalExpenses.slice(start, start + pageSize);
  }, [finalExpenses, page, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(finalExpenses.length / pageSize) || 1;

  // KPI Calculations across entire dataset
  const totalStats = useMemo(() => {
    let totalAmt = 0;
    let cashAmt = 0;
    let bankAmt = 0;
    let splitCount = 0;
    let cashCount = 0;
    let bankCount = 0;

    expenses.forEach((expense) => {
      const amt = parseFloat(expense.exp_amount || 0);
      totalAmt += amt;

      const cAmt = parseFloat(expense.cash_amount || 0);
      const bAmt = parseFloat(expense.bank_amount || 0);

      if (cAmt > 0 || bAmt > 0) {
        cashAmt += cAmt;
        bankAmt += bAmt;
        if (cAmt > 0 && bAmt > 0) splitCount++;
        else if (cAmt > 0) cashCount++;
        else if (bAmt > 0) bankCount++;
      } else {
        const isBankAcc = expense.paid_from_account?.cus_name?.toLowerCase().includes('bank');
        if (isBankAcc) {
          bankAmt += amt;
          bankCount++;
        } else {
          cashAmt += amt;
          cashCount++;
        }
      }
    });

    // Filtered sum
    const filteredSum = filteredExpenses.reduce((acc, curr) => acc + parseFloat(curr.exp_amount || 0), 0);

    return {
      totalAmt,
      totalCount: expenses.length,
      cashAmt,
      cashCount,
      bankAmt,
      bankCount,
      splitCount,
      filteredSum,
      filteredCount: filteredExpenses.length
    };
  }, [expenses, filteredExpenses]);

  // Form input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getPaymentAmounts = () => {
    const expenseAmount = parseFloat(formData.exp_amount || 0);
    if (formData.paymentMethod === 'CASH') {
      return {
        cashAmt: expenseAmount,
        bankAmt: 0,
        cashAccountId: parseInt(formData.paid_from_account_id, 10),
        bankAccountId: null
      };
    }
    if (formData.paymentMethod === 'BANK') {
      return {
        cashAmt: 0,
        bankAmt: expenseAmount,
        cashAccountId: null,
        bankAccountId: parseInt(formData.bank_account_id, 10)
      };
    }
    return {
      cashAmt: parseFloat(formData.cash_amount || 0),
      bankAmt: parseFloat(formData.bank_amount || 0),
      cashAccountId: parseInt(formData.paid_from_account_id, 10),
      bankAccountId: parseInt(formData.bank_account_id, 10)
    };
  };

  const buildOptimisticExpense = (tempId) => {
    const expenseTitle = expenseTitles.find((t) => String(t.id) === String(formData.exp_type));
    const { cashAmt, bankAmt, cashAccountId, bankAccountId } = getPaymentAmounts();
    const cashAccount = paymentAccounts.find((a) => a.cus_id === cashAccountId);
    const bankAccount = paymentAccounts.find((a) => a.cus_id === bankAccountId);

    return {
      exp_id: tempId,
      exp_title: formData.exp_title.trim(),
      exp_type: parseInt(formData.exp_type, 10),
      exp_detail: formData.exp_detail?.trim() || null,
      exp_amount: parseFloat(formData.exp_amount || 0),
      is_paid: true,
      paid_from_account_id: cashAmt > 0 ? cashAccountId : null,
      cash_amount: cashAmt,
      bank_account_id: bankAmt > 0 ? bankAccountId : null,
      bank_amount: bankAmt,
      payment_reference: formData.payment_reference || null,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expense_title: expenseTitle || { id: parseInt(formData.exp_type, 10), title: 'Expense' },
      paid_from_account: cashAccount
        ? { cus_id: cashAccount.cus_id, cus_name: cashAccount.cus_name }
        : null,
      bank_account: bankAccount
        ? { cus_id: bankAccount.cus_id, cus_name: bankAccount.cus_name }
        : null,
      _optimistic: true
    };
  };

  const applyLocalAccountDeductions = ({ cashAmt, bankAmt, cashAccountId, bankAccountId }) => {
    if (cashAmt <= 0 && bankAmt <= 0) return;
    setPaymentAccounts((prev) =>
      prev.map((acc) => {
        if (cashAmt > 0 && acc.cus_id === cashAccountId) {
          return { ...acc, cus_balance: parseFloat(acc.cus_balance || 0) - cashAmt };
        }
        if (bankAmt > 0 && acc.cus_id === bankAccountId) {
          return { ...acc, cus_balance: parseFloat(acc.cus_balance || 0) - bankAmt };
        }
        return acc;
      })
    );
  };

  // Submit expense creation / update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveInFlightRef.current) return;

    if (!formData.exp_title.trim()) {
      alert('Please enter an expense title');
      return;
    }

    if (!formData.exp_type) {
      alert('Please select an expense category / type');
      return;
    }

    if (!formData.exp_amount || parseFloat(formData.exp_amount) <= 0) {
      alert('Please enter a valid expense amount');
      return;
    }

    if (formData.paymentMethod === 'CASH') {
      if (!formData.paid_from_account_id) {
        alert('Please select a cash account');
        return;
      }
    } else if (formData.paymentMethod === 'BANK') {
      if (!formData.bank_account_id) {
        alert('Please select a bank account');
        return;
      }
    } else if (formData.paymentMethod === 'PARTIAL') {
      if (!formData.paid_from_account_id || !formData.bank_account_id) {
        alert('Please select both cash and bank accounts');
        return;
      }
      const total = parseFloat(formData.exp_amount || 0);
      const cash = parseFloat(formData.cash_amount || 0);
      const bank = parseFloat(formData.bank_amount || 0);

      if (cash <= 0 || bank <= 0) {
        alert('Both cash and bank amounts must be greater than zero for split payments');
        return;
      }

      if (Math.abs(cash + bank - total) > 0.01) {
        alert(
          `Sum of cash (Rs. ${cash.toLocaleString()}) and bank (Rs. ${bank.toLocaleString()}) must equal total amount (Rs. ${total.toLocaleString()})`
        );
        return;
      }
    }

    const url = '/api/expenses';
    const isEditing = Boolean(editingExpense);
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? { id: editingExpense.exp_id, ...formData } : formData;
    const paymentAmounts = getPaymentAmounts();
    const optimisticId = `temp-${Date.now()}`;
    const snapshotForm = { ...formData };
    const snapshotEditing = editingExpense;

    saveInFlightRef.current = true;

    if (isEditing) {
      const optimisticExpense = {
        ...buildOptimisticExpense(snapshotEditing.exp_id),
        exp_id: snapshotEditing.exp_id,
        created_at: snapshotEditing.created_at
      };
      setExpenses((prev) =>
        prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? optimisticExpense : exp))
      );
    } else {
      const optimisticExpense = buildOptimisticExpense(optimisticId);
      setExpenses((prev) => [optimisticExpense, ...prev]);
      applyLocalAccountDeductions(paymentAmounts);
      notifyLedgerDataChanged('expense');
    }

    setCurrentView('list');
    setEditingExpense(null);
    setFormData(getDefaultFormData());

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const savedExpense = await response.json();
        setExpenses((prev) =>
          prev.map((exp) => {
            if (isEditing && exp.exp_id === snapshotEditing.exp_id) {
              return { ...savedExpense, _optimistic: false };
            }
            if (!isEditing && exp.exp_id === optimisticId) {
              return { ...savedExpense, _optimistic: false };
            }
            return exp;
          })
        );
        notifyLedgerDataChanged('expense');
        void refreshPaymentAccounts();
      } else {
        const error = await response.json();
        if (isEditing) {
          setExpenses((prev) =>
            prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? snapshotEditing : exp))
          );
        } else {
          setExpenses((prev) => prev.filter((exp) => exp.exp_id !== optimisticId));
        }
        setFormData(snapshotForm);
        setEditingExpense(isEditing ? snapshotEditing : null);
        setCurrentView('create');
        alert(error.error || 'Failed to save expense');
        void refreshPaymentAccounts();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      if (isEditing) {
        setExpenses((prev) =>
          prev.map((exp) => (exp.exp_id === snapshotEditing.exp_id ? snapshotEditing : exp))
        );
      } else {
        setExpenses((prev) => prev.filter((exp) => exp.exp_id !== optimisticId));
      }
      setFormData(snapshotForm);
      setEditingExpense(isEditing ? snapshotEditing : null);
      setCurrentView('create');
      alert('Failed to save expense');
      void refreshPaymentAccounts();
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);

    const cashAmt = parseFloat(expense.cash_amount || 0);
    const bankAmt = parseFloat(expense.bank_amount || 0);

    let method = 'CASH';
    if (cashAmt > 0 && bankAmt > 0) {
      method = 'PARTIAL';
    } else if (bankAmt > 0) {
      method = 'BANK';
    } else if (expense.paid_from_account?.cus_name?.toLowerCase().includes('bank')) {
      method = 'BANK';
    }

    setFormData({
      exp_title: expense.exp_title,
      exp_type: expense.exp_type,
      exp_detail: expense.exp_detail || '',
      exp_amount: expense.exp_amount.toString(),
      is_paid: 'true',
      paid_from_account_id: expense.paid_from_account_id ? expense.paid_from_account_id.toString() : '',
      bank_account_id: expense.bank_account_id
        ? expense.bank_account_id.toString()
        : method === 'BANK'
        ? expense.paid_from_account_id?.toString() || ''
        : '',
      cash_amount: cashAmt > 0 ? cashAmt.toString() : '',
      bank_amount: bankAmt > 0 ? bankAmt.toString() : '',
      payment_reference: expense.payment_reference || '',
      paymentMethod: method
    });

    setCurrentView('create');
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense record? This will revert account balances.')) {
      try {
        const response = await fetch(`/api/expenses?id=${expenseId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          notifyLedgerDataChanged('expense');
          await fetchData();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete expense');
        }
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense');
      }
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    try {
      setIsSubmittingType(true);
      const response = await fetch('/api/expense-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTypeName.trim() })
      });
      if (response.ok) {
        const result = await response.json();
        setExpenseTitles((prev) => [...prev, result]);
        setFormData((prev) => ({ ...prev, exp_type: result.id }));
        setShowTypeDialog(false);
        setNewTypeName('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create expense type');
      }
    } catch (error) {
      console.error('Error creating expense type:', error);
      alert('Failed to create expense type');
    } finally {
      setIsSubmittingType(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedExpenseType('');
    setPaymentMethodFilter('ALL');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  const isFiltered = Boolean(
    searchTerm ||
    selectedExpenseType ||
    paymentMethodFilter !== 'ALL' ||
    datePreset !== 'all' ||
    dateFrom ||
    dateTo
  );

  // Export to CSV / Excel
  const exportToCSV = () => {
    if (finalExpenses.length === 0) {
      alert('No expense records to export');
      return;
    }

    const headers = [
      'Row #',
      'Voucher ID',
      'Date',
      'Expense Title',
      'Details / Remarks',
      'Category',
      'Payment Method',
      'Cash Account',
      'Cash Amount',
      'Bank Account',
      'Bank Amount',
      'Total Amount (PKR)',
      'Payment Reference'
    ];

    const rows = finalExpenses.map((exp, idx) => {
      const cashAmt = parseFloat(exp.cash_amount || 0);
      const bankAmt = parseFloat(exp.bank_amount || 0);
      let method = 'Cash';
      if (cashAmt > 0 && bankAmt > 0) method = 'Split Payment';
      else if (bankAmt > 0 || exp.paid_from_account?.cus_name?.toLowerCase().includes('bank')) method = 'Bank';

      return [
        idx + 1,
        exp.exp_id,
        formatDatePK(exp.payment_date || exp.created_at),
        `"${(exp.exp_title || '').replace(/"/g, '""')}"`,
        `"${(exp.exp_detail || '').replace(/"/g, '""')}"`,
        `"${(exp.expense_title?.title || 'Uncategorized').replace(/"/g, '""')}"`,
        method,
        `"${(exp.paid_from_account?.cus_name || '').replace(/"/g, '""')}"`,
        cashAmt > 0 ? cashAmt : (method === 'Cash' ? parseFloat(exp.exp_amount || 0) : 0),
        `"${(exp.bank_account?.cus_name || (method === 'Bank' ? exp.paid_from_account?.cus_name : '') || '').replace(/"/g, '""')}"`,
        bankAmt > 0 ? bankAmt : (method === 'Bank' ? parseFloat(exp.exp_amount || 0) : 0),
        parseFloat(exp.exp_amount || 0),
        `"${(exp.payment_reference || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_Spreadsheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printVoucher = () => {
    window.print();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-500/20 animate-pulse flex items-center justify-center">
              <Receipt className="w-8 h-8 text-rose-500 animate-bounce" />
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-base font-semibold text-slate-800">Loading Expense Spreadsheet</h4>
            <p className="text-xs text-slate-400 mt-1">Retrieving business expenses, accounts, and ledger records...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full flex flex-col space-y-5 pb-12">
        {/* ======================= TOP EXECUTIVE HEADER ======================= */}
        <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
                <span>Finance & Accounts</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Expense Register
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Expense Management Register
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial operating ledger spreadsheet & disbursement transaction records
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={exportToCSV}
                className="inline-flex items-center px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-sm transition-all cursor-pointer"
                title="Download as Excel CSV spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
                Export to Excel
              </button>

              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                title="Refresh records"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-rose-500' : 'text-slate-500'}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>

              <button
                type="button"
                onClick={() => setShowTypeDialog(true)}
                className="inline-flex items-center px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                Categories ({expenseTitles.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingExpense(null);
                  setFormData(getDefaultFormData());
                  setCurrentView('create');
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add New Expense
              </button>
            </div>
          </div>
        </div>

        {/* ======================= EXCEL-STYLE KPI CARDS ======================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Total Outflow */}
          <div className="bg-white rounded-lg border border-slate-300 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              <span>Total Outflow</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
              <span className="text-xs font-medium text-slate-400 mr-1">Rs.</span>
              {fmtAmt(totalStats.totalAmt)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {totalStats.totalCount} total expense entries
            </div>
          </div>

          {/* 2. Paid via Cash */}
          <div className="bg-white rounded-lg border border-slate-300 border-l-4 border-l-emerald-500 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-bold uppercase tracking-wider mb-1">
              <span>Cash Disbursed</span>
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">
              <span className="text-xs font-medium text-emerald-500 mr-1">Rs.</span>
              {fmtAmt(totalStats.cashAmt)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {totalStats.cashCount} cash payments ({totalStats.totalAmt > 0 ? Math.round((totalStats.cashAmt / totalStats.totalAmt) * 100) : 0}%)
            </div>
          </div>

          {/* 3. Paid via Bank */}
          <div className="bg-white rounded-lg border border-slate-300 border-l-4 border-l-blue-500 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">
              <span>Bank Disbursed</span>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-700 tabular-nums">
              <span className="text-xs font-medium text-blue-500 mr-1">Rs.</span>
              {fmtAmt(totalStats.bankAmt)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {totalStats.bankCount} bank payments ({totalStats.totalAmt > 0 ? Math.round((totalStats.bankAmt / totalStats.totalAmt) * 100) : 0}%)
            </div>
          </div>

          {/* 4. Filtered Total */}
          <div className="bg-white rounded-lg border border-slate-300 border-l-4 border-l-purple-500 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-purple-900 font-bold uppercase tracking-wider mb-1">
              <span>Filtered Sum</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-800 tabular-nums">
              <span className="text-xs font-medium text-purple-400 mr-1">Rs.</span>
              {fmtAmt(totalStats.filteredSum)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {totalStats.filteredCount} rows matched ({totalStats.splitCount} split)
            </div>
          </div>
        </div>

        {/* ======================= EXCEL SPREADSHEET TOOLBAR ======================= */}
        <div className="bg-[#f8fafc] rounded-xl border border-slate-300 p-3.5 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, description, category, account, reference, ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Sort & Rows Selection */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-500">Sort:</span>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split('-');
                    setSortBy(f);
                    setSortOrder(o);
                  }}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="exp_amount-desc">Amount: High to Low</option>
                  <option value="exp_amount-asc">Amount: Low to High</option>
                  <option value="exp_title-asc">Title: A to Z</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value={15}>15 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={0}>All rows</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Pills row: Method, Category, Date Presets */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 text-xs">
            {/* Method Segment */}
            <div className="flex items-center flex-wrap gap-1">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mr-1">Method:</span>
              {[
                { id: 'ALL', label: 'All Methods' },
                { id: 'CASH', label: 'Cash Only' },
                { id: 'BANK', label: 'Bank Only' },
                { id: 'PARTIAL', label: 'Split / Partial' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethodFilter(pill.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer ${
                    paymentMethodFilter === pill.id
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Category & Date filters */}
            <div className="flex items-center flex-wrap gap-2">
              <select
                value={selectedExpenseType}
                onChange={(e) => {
                  setSelectedExpenseType(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-none cursor-pointer"
              >
                <option value="">All Categories ({expenseTitles.length})</option>
                {expenseTitles.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </select>

              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {isFiltered && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Custom Date Range picker if selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-200 bg-white p-2 rounded-lg text-xs">
              <span className="font-bold text-slate-600">From Date:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
              />
              <span className="font-bold text-slate-600">To Date:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
              />
            </div>
          )}
        </div>

        {/* ======================= EXCEL SPREADSHEET TABLE ======================= */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          {/* Excel Spreadsheet Top Status Bar */}
          <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-300 flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800">
                Sheet: Operating Expenses Ledger
              </span>
              <span className="text-slate-400">|</span>
              <span>
                Showing <strong className="text-slate-900">{paginatedExpenses.length}</strong> of{' '}
                <strong className="text-slate-900">{finalExpenses.length}</strong> rows
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span>
                Filtered Sum:{' '}
                <strong className="font-black text-rose-700 tabular-nums">
                  Rs. {fmtAmt(totalStats.filteredSum)}
                </strong>
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs table-auto">
              <thead>
                <tr className="bg-[#f1f5f9] text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b-2 border-slate-300">
                  <th className="border border-slate-300 py-2 px-2 text-center w-12 bg-[#e2e8f0]/80">#</th>
                  <th className="border border-slate-300 py-2 px-3 text-center min-w-[100px] whitespace-nowrap">Date</th>
                  <th className="border border-slate-300 py-2 px-3 text-left min-w-[220px]">Expense Title & Remarks</th>
                  <th className="border border-slate-300 py-2 px-3 text-left min-w-[130px] whitespace-nowrap">Category</th>
                  <th className="border border-slate-300 py-2 px-3 text-center min-w-[100px] whitespace-nowrap">Method</th>
                  <th className="border border-slate-300 py-2 px-3 text-left min-w-[180px]">Disbursement Account</th>
                  <th className="border border-slate-300 py-2 px-3 text-center min-w-[110px] whitespace-nowrap">Reference #</th>
                  <th className="border border-slate-300 py-2 px-3 text-right min-w-[130px] bg-rose-50/60 text-rose-900 whitespace-nowrap">
                    Amount (PKR)
                  </th>
                  <th className="border border-slate-300 py-2 px-2 text-center w-24 whitespace-nowrap no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border border-slate-300 py-12 text-center text-slate-400 bg-slate-50/50">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <div className="font-bold text-slate-600 text-sm">No Expense Records Found</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {isFiltered ? 'No entries match your search/filter parameters.' : 'No expense entries logged yet.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense, idx) => {
                    const cashAmt = parseFloat(expense.cash_amount || 0);
                    const bankAmt = parseFloat(expense.bank_amount || 0);
                    const isSplit = cashAmt > 0 && bankAmt > 0;
                    const isBank =
                      !isSplit &&
                      (bankAmt > 0 || expense.paid_from_account?.cus_name?.toLowerCase().includes('bank'));

                    return (
                      <tr
                        key={expense.exp_id}
                        className={`transition-colors duration-75 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        } hover:bg-blue-50/60`}
                      >
                        {/* 1. Row # */}
                        <td className="border border-slate-300 py-2 px-2 text-center font-mono text-slate-500 font-semibold bg-slate-50/40">
                          {expense.sequentialId}
                        </td>

                        {/* 2. Date */}
                        <td className="border border-slate-300 py-2 px-3 text-center whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {formatDatePK(expense.payment_date || expense.created_at)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {expense.exp_id}
                          </div>
                        </td>

                        {/* 3. Title & Details */}
                        <td className="border border-slate-300 py-2 px-3">
                          <div className="font-bold text-slate-900 hover:text-rose-600 transition-colors">
                            {expense.exp_title}
                          </div>
                          {expense.exp_detail && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title={expense.exp_detail}>
                              {expense.exp_detail}
                            </div>
                          )}
                        </td>

                        {/* 4. Category */}
                        <td className="border border-slate-300 py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {expense.expense_title?.title || 'Uncategorized'}
                          </span>
                        </td>

                        {/* 5. Method */}
                        <td className="border border-slate-300 py-2 px-3 text-center whitespace-nowrap">
                          {isSplit ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Split
                            </span>
                          ) : isBank ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Bank
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Cash
                            </span>
                          )}
                        </td>

                        {/* 6. Disbursement Account */}
                        <td className="border border-slate-300 py-2 px-3">
                          {isSplit ? (
                            <div className="space-y-0.5 text-[11px]">
                              <div className="flex items-center justify-between text-emerald-800 font-semibold">
                                <span className="truncate pr-1">Cash: {expense.paid_from_account?.cus_name || 'Cash'}</span>
                                <span className="tabular-nums font-mono">Rs.{fmtAmt(cashAmt)}</span>
                              </div>
                              <div className="flex items-center justify-between text-blue-800 font-semibold">
                                <span className="truncate pr-1">Bank: {expense.bank_account?.cus_name || 'Bank'}</span>
                                <span className="tabular-nums font-mono">Rs.{fmtAmt(bankAmt)}</span>
                              </div>
                            </div>
                          ) : isBank ? (
                            <div className="text-blue-900 font-semibold truncate text-[11px]">
                              {expense.bank_account?.cus_name || expense.paid_from_account?.cus_name || 'Bank Account'}
                            </div>
                          ) : (
                            <div className="text-emerald-900 font-semibold truncate text-[11px]">
                              {expense.paid_from_account?.cus_name || 'Cash in Hand'}
                            </div>
                          )}
                        </td>

                        {/* 7. Reference */}
                        <td className="border border-slate-300 py-2 px-3 text-center whitespace-nowrap font-mono text-xs text-slate-600">
                          {expense.payment_reference || <span className="text-slate-300 italic">—</span>}
                        </td>

                        {/* 8. Amount */}
                        <td className="border border-slate-300 py-2 px-3 text-right whitespace-nowrap bg-rose-50/20 font-black text-rose-700 text-sm tabular-nums">
                          <span className="text-xs text-rose-400 font-normal mr-1">Rs.</span>
                          {fmtAmt(expense.exp_amount)}
                        </td>

                        {/* 9. Actions */}
                        <td className="border border-slate-300 py-2 px-2 text-center whitespace-nowrap no-print">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setViewingVoucher(expense)}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded transition-colors cursor-pointer"
                              title="View Voucher"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(expense)}
                              className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                              title="Edit Row"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(expense.exp_id)}
                              className="p-1 text-rose-600 hover:text-rose-900 hover:bg-rose-100 rounded transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Excel Spreadsheet SUM / Total Footer */}
              <tfoot>
                <tr className="bg-[#f1f5f9] border-t-2 border-b-4 border-slate-400 font-black text-xs text-slate-800">
                  <td colSpan={3} className="border border-slate-300 py-2.5 px-3 text-left">
                    TOTAL SUM ({finalExpenses.length} Filtered Entries)
                  </td>
                  <td colSpan={4} className="border border-slate-300 py-2.5 px-3 text-right text-slate-500 font-bold">
                    Total All Entries: Rs. {fmtAmt(totalStats.totalAmt)}
                  </td>
                  <td className="border border-slate-300 py-2.5 px-3 text-right text-sm font-black text-rose-700 bg-rose-100/60 tabular-nums">
                    Rs. {fmtAmt(totalStats.filteredSum)}
                  </td>
                  <td className="border border-slate-300 py-2.5 px-2 bg-[#f1f5f9] no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ======================= EXCEL FOOTER PAGINATION ======================= */}
        {finalExpenses.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-300 p-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center space-x-2">
              <span>Showing:</span>
              <strong className="text-slate-900">
                {paginatedExpenses.length} of {finalExpenses.length}
              </strong>
              <span>rows</span>
              <span className="text-slate-300">|</span>
              <span>
                Page <strong className="text-slate-900">{page}</strong> of{' '}
                <strong className="text-slate-900">{totalPages}</strong>
              </span>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, val) => setPage(val)}
                color="primary"
                size="small"
                shape="rounded"
              />
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ===================== ADD / EDIT EXPENSE MODAL ========================== */}
      {/* ========================================================================= */}
      {currentView === 'create' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-200">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingExpense ? 'Edit Expense Entry' : 'Record New Expense'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingExpense ? `Voucher #${editingExpense.exp_id}` : 'Fill in operating expense details'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <form onSubmit={handleSubmit} id="expense-modal-form" className="space-y-4">
                {/* 1. Title & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Expense Title *
                    </label>
                    <TextField
                      fullWidth
                      name="exp_title"
                      value={formData.exp_title}
                      onChange={handleInputChange}
                      required
                      size="small"
                      variant="outlined"
                      placeholder="e.g., Office Rent, Electricity, Freight"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Category *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowTypeDialog(true)}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" />
                        New Category
                      </button>
                    </div>
                    <Autocomplete
                      options={expenseTitles}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return option.title || '';
                      }}
                      value={expenseTitles.find((t) => String(t.id) === String(formData.exp_type)) || null}
                      onChange={(event, newValue) => {
                        setFormData((prev) => ({ ...prev, exp_type: newValue ? newValue.id : '' }));
                      }}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select category..."
                          size="small"
                          required={!formData.exp_type}
                          fullWidth
                          variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 2. Amount & Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Amount (PKR) *
                    </label>
                    <TextField
                      fullWidth
                      type="number"
                      name="exp_amount"
                      value={formData.exp_amount}
                      onChange={handleInputChange}
                      required
                      inputProps={{ step: '0.01', min: '0.01' }}
                      size="small"
                      variant="outlined"
                      placeholder="0.00"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Payment Reference (Optional)
                    </label>
                    <TextField
                      fullWidth
                      name="payment_reference"
                      value={formData.payment_reference || ''}
                      onChange={handleInputChange}
                      size="small"
                      variant="outlined"
                      placeholder="e.g., Cheque #1234, TX ID, Slip #"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  </div>
                </div>

                {/* 3. Payment Method Choice */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Disbursement Channel *
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Cash button */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: 'CASH',
                          paid_from_account_id: getDefaultFormData().paid_from_account_id,
                          bank_account_id: '',
                          cash_amount: '',
                          bank_amount: ''
                        }))
                      }
                      className={`flex items-center justify-center p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                        formData.paymentMethod === 'CASH'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 font-bold'
                          : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mr-1.5 text-emerald-600" />
                      <span className="text-xs">Cash</span>
                    </button>

                    {/* Bank button */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: 'BANK',
                          paid_from_account_id: '',
                          bank_account_id: '',
                          cash_amount: '',
                          bank_amount: ''
                        }))
                      }
                      className={`flex items-center justify-center p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                        formData.paymentMethod === 'BANK'
                          ? 'border-blue-500 bg-blue-50/80 text-blue-800 font-bold'
                          : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mr-1.5 text-blue-600" />
                      <span className="text-xs">Bank</span>
                    </button>

                    {/* Partial Split button */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: 'PARTIAL',
                          paid_from_account_id: getDefaultFormData().paid_from_account_id,
                          bank_account_id: '',
                          cash_amount: '',
                          bank_amount: ''
                        }))
                      }
                      className={`flex items-center justify-center p-2.5 rounded-lg border-2 transition-all cursor-pointer ${
                        formData.paymentMethod === 'PARTIAL'
                          ? 'border-purple-500 bg-purple-50/80 text-purple-800 font-bold'
                          : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      <Layers className="w-4 h-4 mr-1.5 text-purple-600" />
                      <span className="text-xs">Split</span>
                    </button>
                  </div>
                </div>

                {/* 4. Single Account Selection (Cash or Bank) */}
                {formData.paymentMethod === 'CASH' && (
                  <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Cash Account *
                    </label>
                    <Autocomplete
                      options={cashAccountsList}
                      getOptionLabel={(account) =>
                        `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
                      }
                      value={cashAccountsList.find((a) => a.cus_id.toString() === formData.paid_from_account_id) || null}
                      onChange={(event, newValue) => {
                        setFormData((prev) => ({
                          ...prev,
                          paid_from_account_id: newValue ? newValue.cus_id.toString() : ''
                        }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select cash account..."
                          size="small"
                          required={!formData.paid_from_account_id}
                          fullWidth
                          variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', background: '#ffffff' } }}
                        />
                      )}
                    />
                  </div>
                )}

                {formData.paymentMethod === 'BANK' && (
                  <div className="bg-blue-50/50 p-3.5 rounded-lg border border-blue-200">
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      Bank Account *
                    </label>
                    <Autocomplete
                      options={bankAccountsList}
                      getOptionLabel={(account) =>
                        `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
                      }
                      value={bankAccountsList.find((a) => a.cus_id.toString() === formData.bank_account_id) || null}
                      onChange={(event, newValue) => {
                        setFormData((prev) => ({
                          ...prev,
                          bank_account_id: newValue ? newValue.cus_id.toString() : ''
                        }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select bank account..."
                          size="small"
                          required={!formData.bank_account_id}
                          fullWidth
                          variant="outlined"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', background: '#ffffff' } }}
                        />
                      )}
                    />
                  </div>
                )}

                {/* 5. Split / Partial Payment Block */}
                {formData.paymentMethod === 'PARTIAL' && (
                  <div className="space-y-3 bg-purple-50/60 p-3.5 rounded-lg border border-purple-200">
                    <h5 className="text-xs font-bold text-purple-900 flex items-center uppercase tracking-wider">
                      <Layers className="w-3.5 h-3.5 mr-1 text-purple-600" />
                      Split Breakdown
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Cash Portion */}
                      <div className="space-y-1.5 bg-white p-2.5 rounded border border-purple-200">
                        <label className="block text-xs font-bold text-emerald-800">Cash Account *</label>
                        <Autocomplete
                          options={cashAccountsList}
                          getOptionLabel={(account) => account.cus_name}
                          value={cashAccountsList.find((a) => a.cus_id.toString() === formData.paid_from_account_id) || null}
                          onChange={(event, newValue) => {
                            setFormData((prev) => ({
                              ...prev,
                              paid_from_account_id: newValue ? newValue.cus_id.toString() : ''
                            }));
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Cash account..."
                              size="small"
                              required={!formData.paid_from_account_id}
                              fullWidth
                              variant="outlined"
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                            />
                          )}
                        />

                        <label className="block text-xs font-bold text-emerald-800 pt-1">Cash Amount *</label>
                        <TextField
                          fullWidth
                          type="number"
                          name="cash_amount"
                          value={formData.cash_amount || ''}
                          onChange={handleInputChange}
                          required
                          inputProps={{ step: '0.01', min: '0.01' }}
                          size="small"
                          variant="outlined"
                          placeholder="0.00"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                        />
                      </div>

                      {/* Bank Portion */}
                      <div className="space-y-1.5 bg-white p-2.5 rounded border border-purple-200">
                        <label className="block text-xs font-bold text-blue-800">Bank Account *</label>
                        <Autocomplete
                          options={bankAccountsList}
                          getOptionLabel={(account) => account.cus_name}
                          value={bankAccountsList.find((a) => a.cus_id.toString() === formData.bank_account_id) || null}
                          onChange={(event, newValue) => {
                            setFormData((prev) => ({
                              ...prev,
                              bank_account_id: newValue ? newValue.cus_id.toString() : ''
                            }));
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Bank account..."
                              size="small"
                              required={!formData.bank_account_id}
                              fullWidth
                              variant="outlined"
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                            />
                          )}
                        />

                        <label className="block text-xs font-bold text-blue-800 pt-1">Bank Amount *</label>
                        <TextField
                          fullWidth
                          type="number"
                          name="bank_amount"
                          value={formData.bank_amount || ''}
                          onChange={handleInputChange}
                          required
                          inputProps={{ step: '0.01', min: '0.01' }}
                          size="small"
                          variant="outlined"
                          placeholder="0.00"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                        />
                      </div>
                    </div>

                    {/* Live Calculation Progress */}
                    {parseFloat(formData.exp_amount || 0) > 0 && (
                      <div className="mt-1 pt-1.5 border-t border-purple-200 text-xs flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-slate-600">
                          Total: <strong className="text-slate-900 font-bold">Rs. {fmtAmt(formData.exp_amount)}</strong>
                        </span>
                        <span className="text-slate-600">
                          Allocated: <strong className="text-slate-900 font-bold">Rs. {fmtAmt(parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0))}</strong>
                        </span>
                        {(() => {
                          const total = parseFloat(formData.exp_amount || 0);
                          const allocated =
                            parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0);
                          const remaining = total - allocated;

                          if (Math.abs(remaining) < 0.01) {
                            return (
                              <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                                ✓ Fully Balanced
                              </span>
                            );
                          } else if (remaining > 0) {
                            return (
                              <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded">
                                Remaining: Rs. {fmtAmt(remaining)}
                              </span>
                            );
                          } else {
                            return (
                              <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                                Over-allocated: Rs. {fmtAmt(Math.abs(remaining))}
                              </span>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Details / Remarks */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Details & Remarks
                  </label>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    name="exp_detail"
                    value={formData.exp_detail}
                    onChange={handleInputChange}
                    placeholder="Enter additional remarks or description..."
                    size="small"
                    variant="outlined"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                </div>
              </form>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 mt-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-modal-form"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {editingExpense ? 'Update Expense' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ================== VIEW EXPENSE VOUCHER MODAL =========================== */}
      {/* ========================================================================= */}
      {viewingVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 relative max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Voucher Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Expense Voucher</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voucher Body (Printable Style) */}
            <div className="py-4 space-y-3.5 overflow-y-auto" id="printable-expense-voucher">
              {/* Receipt Header Badge */}
              <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Payment Disbursement Voucher
                </span>
                <span className="text-2xl font-black text-rose-600 block mt-0.5">
                  Rs. {fmtAmt(viewingVoucher.exp_amount)}
                </span>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                  Voucher #{viewingVoucher.exp_id} • {formatDatePK(viewingVoucher.payment_date || viewingVoucher.created_at)}
                </span>
              </div>

              {/* Information Rows */}
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400 font-medium">Expense Title</span>
                  <span className="text-slate-900 font-bold text-right">{viewingVoucher.exp_title}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400 font-medium">Category</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {viewingVoucher.expense_title?.title || 'Uncategorized'}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400 font-medium">Payment Timestamp</span>
                  <span className="text-slate-700 font-medium font-mono">
                    {formatDateTimePK(viewingVoucher.payment_date || viewingVoucher.created_at)}
                  </span>
                </div>

                {viewingVoucher.payment_reference && (
                  <div className="pt-2 flex justify-between">
                    <span className="text-slate-400 font-medium">Payment Reference</span>
                    <span className="text-slate-800 font-mono font-bold">
                      {viewingVoucher.payment_reference}
                    </span>
                  </div>
                )}

                {/* Account Disbursement Breakdown */}
                <div className="pt-2">
                  <span className="text-slate-400 font-medium block mb-1">Disbursement Breakdown</span>
                  {(() => {
                    const cashAmt = parseFloat(viewingVoucher.cash_amount || 0);
                    const bankAmt = parseFloat(viewingVoucher.bank_amount || 0);

                    if (cashAmt > 0 && bankAmt > 0) {
                      return (
                        <div className="bg-purple-50/60 p-2.5 rounded border border-purple-200 space-y-1">
                          <div className="flex justify-between font-semibold text-emerald-800">
                            <span>Cash: {viewingVoucher.paid_from_account?.cus_name || 'Cash'}</span>
                            <strong>Rs. {fmtAmt(cashAmt)}</strong>
                          </div>
                          <div className="flex justify-between font-semibold text-blue-800">
                            <span>Bank: {viewingVoucher.bank_account?.cus_name || 'Bank'}</span>
                            <strong>Rs. {fmtAmt(bankAmt)}</strong>
                          </div>
                        </div>
                      );
                    }
                    if (bankAmt > 0 || viewingVoucher.paid_from_account?.cus_name?.toLowerCase().includes('bank')) {
                      return (
                        <div className="bg-blue-50/60 p-2.5 rounded border border-blue-200 flex justify-between font-semibold text-blue-900">
                          <span>Bank: {viewingVoucher.bank_account?.cus_name || viewingVoucher.paid_from_account?.cus_name}</span>
                          <strong>Rs. {fmtAmt(viewingVoucher.exp_amount)}</strong>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-emerald-50/60 p-2.5 rounded border border-emerald-200 flex justify-between font-semibold text-emerald-900">
                        <span>Cash: {viewingVoucher.paid_from_account?.cus_name || 'Cash in Hand'}</span>
                        <strong>Rs. {fmtAmt(viewingVoucher.exp_amount)}</strong>
                      </div>
                    );
                  })()}
                </div>

                {viewingVoucher.exp_detail && (
                  <div className="pt-2">
                    <span className="text-slate-400 font-medium block mb-1">Particulars / Remarks</span>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed font-sans">
                      {viewingVoucher.exp_detail}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Voucher Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={printVoucher}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Voucher
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingVoucher;
                    setViewingVoucher(null);
                    handleEdit(toEdit);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewingVoucher(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ===================== ADD NEW EXPENSE TYPE DIALOG ======================= */}
      {/* ========================================================================= */}
      <Dialog
        open={showTypeDialog}
        onClose={() => setShowTypeDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1
          }
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tag style={{ color: '#e11d48', width: 18, height: 18 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
              Add Expense Category
            </Typography>
          </Box>
          <IconButton onClick={() => setShowTypeDialog(false)} size="small">
            <X size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 2, pt: 2.5 }}>
          <TextField
            fullWidth
            autoFocus
            label="Category Title *"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateType();
              }
            }}
            placeholder="e.g., Office Rent, Electricity, Fuel, Staff Tea"
            size="small"
            variant="outlined"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '8px' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => {
              setShowTypeDialog(false);
              setNewTypeName('');
            }}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, fontSize: '0.8rem' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateType}
            disabled={isSubmittingType || !newTypeName.trim()}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              px: 2.5,
              borderRadius: '8px',
              backgroundColor: '#e11d48',
              '&:hover': {
                backgroundColor: '#be123c'
              }
            }}
          >
            {isSubmittingType ? 'Saving...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
