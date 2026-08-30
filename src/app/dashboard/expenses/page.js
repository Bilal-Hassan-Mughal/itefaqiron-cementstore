'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatDatePK } from '@/lib/date-helper';
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
  BarChart3,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  FileText,
  Receipt,
  Tag,
  CreditCard,
  TrendingDown,
  Wallet,
  Banknote
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
  Grid,
  Paper
} from '@mui/material';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ExpensesPage() {
  // State management
  const [expenses, setExpenses] = useState([]);
  const [expenseTitles, setExpenseTitles] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'create' (modal)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpenseType, setSelectedExpenseType] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

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

  // Expense Type Dialog State
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSubmittingType, setIsSubmittingType] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-select default cash account when loading or when payment method changes
  useEffect(() => {
    if (paymentAccounts.length > 0 && !formData.paid_from_account_id && (formData.paymentMethod === 'CASH' || formData.paymentMethod === 'PARTIAL')) {
      const defaultCashAcc = paymentAccounts.find(acc => {
        const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
        const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
        return typeTitle.includes('cash') && catTitle.includes('cash');
      });
      if (defaultCashAcc) {
        setFormData(prev => ({
          ...prev,
          paid_from_account_id: defaultCashAcc.cus_id.toString()
        }));
      }
    }
  }, [paymentAccounts, formData.paymentMethod, formData.paid_from_account_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
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
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.exp_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.exp_detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.expense_title?.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedExpenseType || expense.exp_type == selectedExpenseType;

    return matchesSearch && matchesType;
  });

  const sortedExpenses = filteredExpenses.sort((a, b) => {
    let aValue, bValue;

    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at);
      bValue = new Date(b.created_at);
    } else if (sortBy === 'exp_amount') {
      aValue = parseFloat(a.exp_amount);
      bValue = parseFloat(b.exp_amount);
    } else if (sortBy === 'exp_title') {
      aValue = a.exp_title.toLowerCase();
      bValue = b.exp_title.toLowerCase();
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const finalExpenses = sortedExpenses.map((expense, index) => ({
    ...expense,
    sequentialId: index + 1
  }));

  // Stats calculations
  const totalExpenses = expenses.length;
  const totalExpenseAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.exp_amount), 0);

  const cashExpenseAmount = expenses.reduce((sum, expense) => {
    const hasNewCashField = parseFloat(expense.cash_amount || 0) > 0;
    const hasNewBankField = parseFloat(expense.bank_amount || 0) > 0;
    
    if (hasNewCashField || hasNewBankField) {
      return sum + parseFloat(expense.cash_amount || 0);
    } else {
      const name = expense.paid_from_account?.cus_name?.toLowerCase() || '';
      return sum + (!name.includes('bank') ? parseFloat(expense.exp_amount || 0) : 0);
    }
  }, 0);

  const bankExpenseAmount = expenses.reduce((sum, expense) => {
    const hasNewCashField = parseFloat(expense.cash_amount || 0) > 0;
    const hasNewBankField = parseFloat(expense.bank_amount || 0) > 0;

    if (hasNewCashField || hasNewBankField) {
      return sum + parseFloat(expense.bank_amount || 0);
    } else {
      const name = expense.paid_from_account?.cus_name?.toLowerCase() || '';
      return sum + (name.includes('bank') ? parseFloat(expense.exp_amount || 0) : 0);
    }
  }, 0);

  const cashExpenses = expenses.filter(expense => {
    const hasNewCashField = parseFloat(expense.cash_amount || 0) > 0;
    const hasNewBankField = parseFloat(expense.bank_amount || 0) > 0;
    if (hasNewCashField || hasNewBankField) {
      return hasNewCashField;
    } else {
      const name = expense.paid_from_account?.cus_name?.toLowerCase() || '';
      return !name.includes('bank');
    }
  });

  const bankExpenses = expenses.filter(expense => {
    const hasNewCashField = parseFloat(expense.cash_amount || 0) > 0;
    const hasNewBankField = parseFloat(expense.bank_amount || 0) > 0;
    if (hasNewCashField || hasNewBankField) {
      return hasNewBankField;
    } else {
      const name = expense.paid_from_account?.cus_name?.toLowerCase() || '';
      return name.includes('bank');
    }
  });

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.exp_title.trim()) {
      alert('Please enter an expense title');
      return;
    }

    if (!formData.exp_type) {
      alert('Please select an expense category / type');
      return;
    }

    if (!formData.exp_amount || parseFloat(formData.exp_amount) <= 0) {
      alert('Please enter a valid amount');
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
        alert('Both cash and bank amounts must be greater than zero for partial payments');
        return;
      }
      
      if (Math.abs(cash + bank - total) > 0.01) {
        alert(`Sum of cash (Rs. ${cash.toLocaleString()}) and bank (Rs. ${bank.toLocaleString()}) must equal total amount (Rs. ${total.toLocaleString()})`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const url = '/api/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const body = editingExpense
        ? {
          id: editingExpense.exp_id,
          ...formData
        }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await fetchData();
        setCurrentView('list');
        setEditingExpense(null);
        const defaultCashAcc = paymentAccounts.find(acc => {
          const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
          const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
          return typeTitle.includes('cash') && catTitle.includes('cash');
        });
        setFormData({
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
          paymentMethod: 'CASH'
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save expense');
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    } finally {
      setIsSubmitting(false);
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
      bank_account_id: expense.bank_account_id ? expense.bank_account_id.toString() : (method === 'BANK' ? expense.paid_from_account_id?.toString() || '' : ''),
      cash_amount: cashAmt > 0 ? cashAmt.toString() : '',
      bank_amount: bankAmt > 0 ? bankAmt.toString() : '',
      payment_reference: expense.payment_reference || '',
      paymentMethod: method
    });

    setCurrentView('create');
  };

  const handleDelete = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        const response = await fetch(`/api/expenses?id=${expenseId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
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
        body: JSON.stringify({ title: newTypeName })
      });
      if (response.ok) {
        const result = await response.json();
        setExpenseTitles(prev => [...prev, result]);
        setFormData(prev => ({ ...prev, exp_type: result.id }));
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
    setSortBy('created_at');
    setSortOrder('desc');
  };

  // Filter options for cash and bank accounts
  const cashAccountsList = useMemo(() => {
    return paymentAccounts.filter(account => {
      const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('cash') && catTitle.includes('cash');
    });
  }, [paymentAccounts]);

  const bankAccountsList = useMemo(() => {
    return paymentAccounts.filter(account => {
      const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('bank') && catTitle.includes('bank');
    });
  }, [paymentAccounts]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Main Expenses List Page */}
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
              <p className="text-gray-600 mt-1">Track and manage business expenses</p>
            </div>
            <button
              onClick={() => {
                setEditingExpense(null);
                const defaultCashAcc = paymentAccounts.find(acc => {
                  const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
                  const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
                  return typeTitle.includes('cash') && catTitle.includes('cash');
                });
                setFormData({
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
                  paymentMethod: 'CASH'
                });
                setCurrentView('create');
              }}
              className="group bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span className="flex items-center">
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                Add New Expense
              </span>
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Clear All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Expense Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expense Type</label>
                <select
                  value={selectedExpenseType}
                  onChange={(e) => setSelectedExpenseType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black appearance-none"
                >
                  <option value="">All Types</option>
                  {expenseTitles.map((title) => (
                    <option key={title.id} value={title.id}>
                      {title.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Total Expenses Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                <Receipt className="w-16 h-16 text-gray-900" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-500 mb-1">Total Expenses</p>
                <p className="text-3xl font-black text-gray-900">
                  <span className="text-sm mr-1">Rs.</span>
                  {totalExpenseAmount.toLocaleString()}
                </p>
                <div className="flex items-center mt-4 pt-4 border-t border-gray-50">
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold mr-2">
                    {totalExpenses} Items
                  </span>
                  <span className="text-xs text-gray-400">Total volume</span>
                </div>
              </div>
            </div>

            {/* Paid via Cash Card */}
            <div className="bg-white rounded-2xl shadow-lg border-l-4 border-l-green-500 border border-gray-100/50 p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                <Banknote className="w-16 h-16 text-green-600" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-green-600 mb-1 font-bold italic underline">Paid via Cash</p>
                <p className="text-3xl font-black text-green-700">
                  <span className="text-sm mr-1">Rs.</span>
                  {cashExpenseAmount.toLocaleString()}
                </p>
                <div className="flex items-center mt-4 pt-4 border-t border-gray-50">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold mr-2 uppercase tracking-wide">
                    {cashExpenses.length} Items
                  </span>
                  <span className="text-xs text-gray-400">Cash account payments</span>
                </div>
              </div>
            </div>

            {/* Paid via Bank Card */}
            <div className="bg-white rounded-2xl shadow-lg border-l-4 border-l-blue-500 border border-gray-100/50 p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                <CreditCard className="w-16 h-16 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-blue-600 mb-1 font-bold italic underline">Paid via Bank</p>
                <p className="text-3xl font-black text-blue-700">
                  <span className="text-sm mr-1">Rs.</span>
                  {bankExpenseAmount.toLocaleString()}
                </p>
                <div className="flex items-center mt-4 pt-4 border-t border-gray-50">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold mr-2 uppercase tracking-wide">
                    {bankExpenses.length} Items
                  </span>
                  <span className="text-xs text-gray-400">Bank account payments</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Expenses List</h3>
              <span className="text-sm text-gray-500">
                Showing {finalExpenses.length} of {expenses.length} expenses
              </span>
            </div>

            {finalExpenses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || selectedExpenseType
                      ? 'Try adjusting your filters to see more results.'
                      : 'Get started by adding your first expense.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1">ID</div>
                    <div className="col-span-3">Title</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-1">Amount</div>
                    <div className="col-span-3">Paid From</div>
                    <div className="col-span-1 text-center">Created</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {finalExpenses.map((expense) => {
                      return (
                        <div key={expense.exp_id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                          {/* ID */}
                          <div className="col-span-1 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">#{expense.sequentialId}</div>
                              <div className="text-xs text-gray-500">ID: {expense.exp_id.toString().slice(-8)}</div>
                            </div>
                          </div>

                          {/* Title */}
                          <div className="col-span-3 flex items-center min-w-0">
                            <div className="w-full">
                              <div className="text-sm font-medium text-gray-900 truncate" title={expense.exp_title}>{expense.exp_title}</div>
                              {expense.exp_detail && (
                                <div className="text-xs text-gray-500 truncate" title={expense.exp_detail}>{expense.exp_detail}</div>
                              )}
                            </div>
                          </div>

                          {/* Type */}
                          <div className="col-span-2 flex items-center min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{expense.expense_title?.title || 'N/A'}</div>
                          </div>

                          {/* Amount */}
                          <div className="col-span-1 flex items-center">
                            <div className="text-sm font-bold text-red-600">
                              <span className="text-[10px] mr-0.5 opacity-70">Rs.</span>
                              {parseFloat(expense.exp_amount).toLocaleString()}
                            </div>
                          </div>

                          {/* Paid From */}
                          <div className="col-span-3 flex items-center min-w-0">
                            {(() => {
                              const cashAmt = parseFloat(expense.cash_amount || 0);
                              const bankAmt = parseFloat(expense.bank_amount || 0);

                              if (expense.paid_from_account && (cashAmt > 0 && bankAmt === 0 || cashAmt === 0 && bankAmt === 0 && !expense.paid_from_account.cus_name?.toLowerCase().includes('bank'))) {
                                return (
                                  <div className="flex items-center w-full">
                                    <div className="flex-shrink-0 w-7 h-7 bg-green-50 rounded-full flex items-center justify-center mr-2 border border-green-100">
                                      <Banknote className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    <div className="truncate w-full">
                                      <div className="text-sm font-medium text-gray-900 truncate" title={expense.paid_from_account.cus_name}>
                                        {expense.paid_from_account.cus_name}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        {expense.payment_date ? formatDatePK(expense.payment_date) : ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              const bankAcc = expense.bank_account || (expense.paid_from_account && expense.paid_from_account.cus_name?.toLowerCase().includes('bank') ? expense.paid_from_account : null);
                              if (bankAcc && (bankAmt > 0 && cashAmt === 0 || cashAmt === 0 && bankAmt === 0)) {
                                return (
                                  <div className="flex items-center w-full">
                                    <div className="flex-shrink-0 w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center mr-2 border border-blue-100">
                                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                    </div>
                                    <div className="truncate w-full">
                                      <div className="text-sm font-medium text-gray-900 truncate" title={bankAcc.cus_name}>
                                        {bankAcc.cus_name}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        {expense.payment_date ? formatDatePK(expense.payment_date) : ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              if (expense.paid_from_account && expense.bank_account && cashAmt > 0 && bankAmt > 0) {
                                return (
                                  <div className="flex flex-col w-full text-xs space-y-1">
                                    <div className="flex items-center text-green-700 font-medium truncate" title={expense.paid_from_account.cus_name}>
                                      <Banknote className="w-3 h-3 mr-1 flex-shrink-0 text-green-500" />
                                      Cash: Rs. {cashAmt.toLocaleString()}
                                    </div>
                                    <div className="flex items-center text-blue-700 font-medium truncate" title={expense.bank_account.cus_name}>
                                      <CreditCard className="w-3 h-3 mr-1 flex-shrink-0 text-blue-500" />
                                      Bank: Rs. {bankAmt.toLocaleString()}
                                    </div>
                                  </div>
                                );
                              }

                              return <span className="text-sm text-gray-300 italic">—</span>;
                            })()}
                          </div>

                          {/* Created */}
                          <div className="col-span-1 flex items-center justify-center">
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {formatDatePK(expense.created_at)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 flex items-center justify-end">
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleEdit(expense)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(expense.exp_id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>      {/* Add / Edit Expense Popup Modal */}
      {currentView === 'create' && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white text-gray-900 rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full p-6 sm:p-8 relative max-h-[90vh] flex flex-col my-auto transition-all">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-red-500" />
                {editingExpense ? 'Edit Expense' : 'Create New Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto py-5 pr-1">
              <form onSubmit={handleSubmit} id="expense-modal-form" className="space-y-5">
                {/* 2-Column Grid for Title & Filterable Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Expense Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      placeholder="Enter expense title (e.g., Office Supplies, Rent)"
                    />
                  </div>

                  {/* Filterable Expense Category (Material-UI Autocomplete) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Category / Expense Type *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowTypeDialog(true)}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center bg-red-50 px-2.5 py-1 rounded-md border border-red-100 transition-colors"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add New Type
                      </button>
                    </div>
                    <Autocomplete
                      options={expenseTitles}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return option.title || '';
                      }}
                      value={expenseTitles.find(t => t.id == formData.exp_type) || null}
                      onChange={(event, newValue) => {
                        setFormData(prev => ({ ...prev, exp_type: newValue ? newValue.id : '' }));
                      }}
                      isOptionEqualToValue={(option, value) => option.id == value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Type to filter category..."
                          size="small"
                          required={!formData.exp_type}
                          fullWidth
                          variant="outlined"
                        />
                      )}
                    />
                  </div>
                </div>

                {/* 2-Column Grid for Amount & Payment Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Expense Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Amount *
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
                    />
                  </div>

                  {/* Payment Reference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Payment Reference (Optional)
                    </label>
                    <TextField
                      fullWidth
                      name="payment_reference"
                      value={formData.payment_reference || ''}
                      onChange={handleInputChange}
                      size="small"
                      variant="outlined"
                      placeholder="e.g., Check #1234, Transfer ID"
                    />
                  </div>
                </div>

                {/* Payment Method Choice */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'CASH', paid_from_account_id: '', bank_account_id: '', cash_amount: '', bank_amount: '' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                        formData.paymentMethod === 'CASH'
                          ? 'border-green-500 bg-green-50 text-green-700 font-bold shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-500 font-medium hover:border-gray-300'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'BANK', paid_from_account_id: '', bank_account_id: '', cash_amount: '', bank_amount: '' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                        formData.paymentMethod === 'BANK'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-500 font-medium hover:border-gray-300'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'PARTIAL', paid_from_account_id: '', bank_account_id: '', cash_amount: '', bank_amount: '' }))}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                        formData.paymentMethod === 'PARTIAL'
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-500 font-medium hover:border-gray-300'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Partial
                    </button>
                  </div>
                </div>

                {/* Account Selection (Filterable Material-UI Autocomplete) */}
                {formData.paymentMethod === 'CASH' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Cash Account *
                    </label>
                    <Autocomplete
                      options={cashAccountsList}
                      getOptionLabel={(account) => `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                      value={cashAccountsList.find(a => a.cus_id.toString() === formData.paid_from_account_id) || null}
                      onChange={(event, newValue) => {
                        setFormData(prev => ({ ...prev, paid_from_account_id: newValue ? newValue.cus_id.toString() : '' }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Type to filter cash account..."
                          size="small"
                          required={!formData.paid_from_account_id}
                          fullWidth
                          variant="outlined"
                        />
                      )}
                    />
                  </div>
                )}

                {formData.paymentMethod === 'BANK' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Bank Account *
                    </label>
                    <Autocomplete
                      options={bankAccountsList}
                      getOptionLabel={(account) => `${account.cus_name} (Balance: Rs. ${parseFloat(account.cus_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                      value={bankAccountsList.find(a => a.cus_id.toString() === formData.bank_account_id) || null}
                      onChange={(event, newValue) => {
                        setFormData(prev => ({ ...prev, bank_account_id: newValue ? newValue.cus_id.toString() : '' }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Type to filter bank account..."
                          size="small"
                          required={!formData.bank_account_id}
                          fullWidth
                          variant="outlined"
                        />
                      )}
                    />
                  </div>
                )}

                {formData.paymentMethod === 'PARTIAL' && (
                  <div className="space-y-3 bg-purple-50/60 p-4 sm:p-5 rounded-2xl border border-purple-100">
                    <h5 className="text-xs font-bold text-purple-900 flex items-center uppercase tracking-wide">
                      <DollarSign className="w-4 h-4 mr-1 text-purple-600" /> Split Payment Details
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Cash Part */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Cash Account *</label>
                        <Autocomplete
                          options={cashAccountsList}
                          getOptionLabel={(account) => account.cus_name}
                          value={cashAccountsList.find(a => a.cus_id.toString() === formData.paid_from_account_id) || null}
                          onChange={(event, newValue) => {
                            setFormData(prev => ({ ...prev, paid_from_account_id: newValue ? newValue.cus_id.toString() : '' }));
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Cash Acc..."
                              size="small"
                              required={!formData.paid_from_account_id}
                              fullWidth
                              variant="outlined"
                            />
                          )}
                        />
                        
                        <label className="block text-xs font-semibold text-gray-700 mt-2">Cash Amount *</label>
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
                        />
                      </div>

                      {/* Bank Part */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Bank Account *</label>
                        <Autocomplete
                          options={bankAccountsList}
                          getOptionLabel={(account) => account.cus_name}
                          value={bankAccountsList.find(a => a.cus_id.toString() === formData.bank_account_id) || null}
                          onChange={(event, newValue) => {
                            setFormData(prev => ({ ...prev, bank_account_id: newValue ? newValue.cus_id.toString() : '' }));
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value.cus_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Bank Acc..."
                              size="small"
                              required={!formData.bank_account_id}
                              fullWidth
                              variant="outlined"
                            />
                          )}
                        />
                        
                        <label className="block text-xs font-semibold text-gray-700 mt-2">Bank Amount *</label>
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
                        />
                      </div>
                    </div>

                    {/* Live calculation banner */}
                    {parseFloat(formData.exp_amount || 0) > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-200 flex justify-between items-center text-xs">
                        <span className="text-gray-600">
                          Total: <strong className="text-gray-900 font-bold">Rs. {parseFloat(formData.exp_amount || 0).toLocaleString()}</strong>
                        </span>
                        <span className="text-gray-600">
                          Allocated: <strong className="text-gray-900 font-bold">Rs. {(parseFloat(formData.cash_amount || 0) + parseFloat(formData.bank_amount || 0)).toLocaleString()}</strong>
                        </span>
                        {(() => {
                          const remaining = parseFloat(formData.exp_amount || 0) - parseFloat(formData.cash_amount || 0) - parseFloat(formData.bank_amount || 0);
                          if (Math.abs(remaining) < 0.01) {
                            return <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">Fully Allocated</span>;
                          } else if (remaining > 0) {
                            return <span className="text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full">Remaining: Rs. {remaining.toLocaleString()}</span>;
                          } else {
                            return <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded-full">Over allocated: Rs. {Math.abs(remaining).toLocaleString()}</span>;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Expense Detail */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Expense Detail
                  </label>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    name="exp_detail"
                    value={formData.exp_detail}
                    onChange={handleInputChange}
                    placeholder="Enter additional details about the expense"
                    size="small"
                    variant="outlined"
                  />
                </div>
              </form>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 mt-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-modal-form"
                disabled={isSubmitting}
                className={`px-7 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-medium rounded-xl hover:from-red-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg ${
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : 'transform hover:scale-105'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editingExpense ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (
                  editingExpense ? 'Update Expense' : 'Create Expense'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material-UI Add Expense Type Dialog */}
      <Dialog
        open={showTypeDialog}
        onClose={() => setShowTypeDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 0.5
          }
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tag style={{ color: '#ef4444', width: 20, height: 20 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827' }}>
              Add New Expense Type
            </Typography>
          </Box>
          <IconButton onClick={() => setShowTypeDialog(false)} size="small">
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 2.5, pt: 3 }}>
          <TextField
            fullWidth
            autoFocus
            label="Type Title *"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateType();
              }
            }}
            placeholder="e.g., Electricity, Rent, Salary"
            size="small"
            variant="outlined"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '12px' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #f3f4f6' }}>
          <Button
            onClick={() => {
              setShowTypeDialog(false);
              setNewTypeName('');
            }}
            sx={{ textTransform: 'none', color: '#4b5563', fontWeight: 600 }}
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
              px: 3,
              borderRadius: '10px',
              background: 'linear-gradient(to right, #ef4444, #ec4899)',
              '&:hover': {
                background: 'linear-gradient(to right, #dc2626, #db2777)'
              }
            }}
          >
            {isSubmittingType ? 'Saving...' : 'Add Type'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
