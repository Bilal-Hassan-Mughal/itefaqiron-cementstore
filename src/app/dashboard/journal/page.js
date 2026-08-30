'use client';

import { useState, useEffect } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Filter,
  DollarSign,
  Calendar,
  Eye,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  TrendingUp,
  TrendingDown,
  FileText,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Save,
  Send
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

export default function JournalPage() {
  // State management
  const [journals, setJournals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingJournal, setEditingJournal] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'create'
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Form data
  const [formData, setFormData] = useState({
    journal_date: new Date().toISOString().split('T')[0],
    journal_type: 'PAYMENT',
    reference: '',
    description: '',
    total_amount: '',
    journal_details: []
  });

  // Account search states
  const [debitAccountSearchTerm, setDebitAccountSearchTerm] = useState('');
  const [creditAccountSearchTerm, setCreditAccountSearchTerm] = useState('');
  const [showDebitAccountDropdown, setShowDebitAccountDropdown] = useState(false);
  const [showCreditAccountDropdown, setShowCreditAccountDropdown] = useState(false);
  const [selectedDebitAccount, setSelectedDebitAccount] = useState(null);
  const [selectedCreditAccount, setSelectedCreditAccount] = useState(null);
  const [newDetail, setNewDetail] = useState({
    debit_account_id: '',
    credit_account_id: '',
    amount: '',
    description: ''
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.account-dropdown')) {
        setShowDebitAccountDropdown(false);
        setShowCreditAccountDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [journalsRes, customersRes] = await Promise.all([
        fetch('/api/journals'),
        fetch('/api/customers?dropdown=true')
      ]);

      if (journalsRes.ok) {
        const journalsData = await journalsRes.json();
        setJournals(journalsData);
      }
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredJournals = journals.filter(journal => {
    const matchesSearch = journal.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         journal.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         journal.journal_id?.toString().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || journal.status === selectedStatus;
    const matchesType = !selectedType || journal.journal_type === selectedType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const sortedJournals = filteredJournals.sort((a, b) => {
    let aValue, bValue;
    
    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at);
      bValue = new Date(b.created_at);
    } else if (sortBy === 'total_amount') {
      aValue = parseFloat(a.total_amount);
      bValue = parseFloat(b.total_amount);
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

  const finalJournals = sortedJournals.map((journal, index) => ({
    ...journal,
    sequentialId: index + 1
  }));

  // Stats calculations
  const totalJournals = journals.length;
  const draftJournals = journals.filter(j => j.status === 'DRAFT').length;
  const postedJournals = journals.filter(j => j.status === 'POSTED').length;
  const totalAmount = journals.reduce((sum, j) => sum + parseFloat(j.total_amount), 0);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'POSTED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'CANCELLED':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800';
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'PAYMENT':
        return 'bg-red-100 text-red-800';
      case 'RECEIPT':
        return 'bg-green-100 text-green-800';
      case 'TRANSFER':
        return 'bg-blue-100 text-blue-800';
      case 'ADJUSTMENT':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewDetailChange = (e) => {
    const { name, value } = e.target;
    setNewDetail(prev => ({ ...prev, [name]: value }));
  };

  // Account selection
  const selectDebitAccount = (account) => {
    setSelectedDebitAccount(account);
    setNewDetail(prev => ({ ...prev, debit_account_id: account.cus_id }));
    setDebitAccountSearchTerm(account.cus_name);
    setShowDebitAccountDropdown(false);
  };

  const selectCreditAccount = (account) => {
    setSelectedCreditAccount(account);
    setNewDetail(prev => ({ ...prev, credit_account_id: account.cus_id }));
    setCreditAccountSearchTerm(account.cus_name);
    setShowCreditAccountDropdown(false);
  };

  const filteredDebitAccounts = customers.filter(account => 
    account.cus_name.toLowerCase().includes(debitAccountSearchTerm.toLowerCase()) ||
    account.cus_phone_no?.toLowerCase().includes(debitAccountSearchTerm.toLowerCase())
  );

  const filteredCreditAccounts = customers.filter(account => 
    account.cus_name.toLowerCase().includes(creditAccountSearchTerm.toLowerCase()) ||
    account.cus_phone_no?.toLowerCase().includes(creditAccountSearchTerm.toLowerCase())
  );

  // Add journal detail
  const addJournalDetail = () => {
    if (!newDetail.debit_account_id || !newDetail.credit_account_id || !newDetail.amount) {
      alert('Please select both debit and credit accounts and enter amount');
      return;
    }

    if (newDetail.debit_account_id === newDetail.credit_account_id) {
      alert('Debit and credit accounts cannot be the same');
      return;
    }

    const amount = parseFloat(newDetail.amount);
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    // Create debit entry
    const debitDetail = {
      account_id: newDetail.debit_account_id,
      debit_amount: amount.toString(),
      credit_amount: '0',
      description: newDetail.description || `Debit: ${selectedDebitAccount?.cus_name}`
    };

    // Create credit entry
    const creditDetail = {
      account_id: newDetail.credit_account_id,
      debit_amount: '0',
      credit_amount: amount.toString(),
      description: newDetail.description || `Credit: ${selectedCreditAccount?.cus_name}`
    };

    setFormData(prev => ({
      ...prev,
      journal_details: [...prev.journal_details, debitDetail, creditDetail]
    }));

    // Reset form
    setNewDetail({
      debit_account_id: '',
      credit_account_id: '',
      amount: '',
      description: ''
    });
    setSelectedDebitAccount(null);
    setSelectedCreditAccount(null);
    setDebitAccountSearchTerm('');
    setCreditAccountSearchTerm('');
  };

  const removeJournalDetail = (index) => {
    setFormData(prev => ({
      ...prev,
      journal_details: prev.journal_details.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const calculateTotalDebits = () => {
    return formData.journal_details.reduce((sum, detail) => sum + parseFloat(detail.debit_amount || 0), 0);
  };

  const calculateTotalCredits = () => {
    return formData.journal_details.reduce((sum, detail) => sum + parseFloat(detail.credit_amount || 0), 0);
  };

  const isBalanced = () => {
    const debits = calculateTotalDebits();
    const credits = calculateTotalCredits();
    return Math.abs(debits - credits) < 0.01;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validation
      if (formData.journal_details.length === 0) {
        alert('Please add at least one journal detail');
        return;
      }

      if (!isBalanced()) {
        alert('Total debits must equal total credits');
        return;
      }

      const totalAmount = Math.max(calculateTotalDebits(), calculateTotalCredits());
      
      const url = '/api/journals';
      const method = editingJournal ? 'PUT' : 'POST';
      
      const body = editingJournal 
        ? { 
            journal_id: editingJournal.journal_id, 
            ...formData, 
            total_amount: totalAmount.toString()
          } 
        : { 
            ...formData, 
            total_amount: totalAmount.toString(),
            created_by: 6 // System Administrator
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await fetchData();
        setCurrentView('list');
        setEditingJournal(null);
        setFormData({
          journal_date: new Date().toISOString().split('T')[0],
          journal_type: 'PAYMENT',
          reference: '',
          description: '',
          total_amount: '',
          journal_details: []
        });
        alert('Journal entry saved successfully!');
      }
    } catch (error) {
      console.error('Error saving journal:', error);
      alert('Failed to save journal entry');
    }
  };

  // Handle post journal
  const handlePostJournal = async (journalId) => {
    if (window.confirm('Are you sure you want to post this journal entry? This will update account balances and cannot be undone.')) {
      try {
        const response = await fetch('/api/journals/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ journal_id: journalId, posted_by: 6 }) // System Administrator
        });

        if (response.ok) {
          await fetchData();
          alert('Journal entry posted successfully!');
        } else {
          const error = await response.json();
          alert(`Error: ${error.error}`);
        }
      } catch (error) {
        console.error('Error posting journal:', error);
        alert('Failed to post journal entry');
      }
    }
  };

  // Handle edit
  const handleEdit = (journal) => {
    setEditingJournal(journal);
    setFormData({
      journal_date: journal.journal_date.split('T')[0],
      journal_type: journal.journal_type,
      reference: journal.reference || '',
      description: journal.description || '',
      total_amount: journal.total_amount.toString(),
      journal_details: journal.journal_details || []
    });
    setCurrentView('create');
  };

  // Handle delete
  const handleDelete = async (journalId) => {
    if (window.confirm('Are you sure you want to delete this journal entry?')) {
      try {
        const response = await fetch(`/api/journals?id=${journalId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchData();
        }
      } catch (error) {
        console.error('Error deleting journal:', error);
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSelectedType('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Render Journal List View
  const renderJournalListView = () => (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Journal Entries</h2>
              <p className="text-gray-600 mt-1">Manage payments, receipts, and account transfers</p>
            </div>
            <button
              onClick={() => setCurrentView('create')}
              className="group bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span className="flex items-center">
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                New Journal Entry
              </span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters & Sorting</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search journals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="POSTED">Posted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="">All Types</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="total_amount-desc">Amount High-Low</option>
                  <option value="total_amount-asc">Amount Low-High</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex-shrink-0 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Journals</p>
                  <p className="text-2xl font-bold text-gray-900">{totalJournals}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Draft</p>
                  <p className="text-2xl font-bold text-gray-900">{draftJournals}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Posted</p>
                  <p className="text-2xl font-bold text-gray-900">{postedJournals}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Journal Entries</h3>
            </div>
            
            {finalJournals.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No journal entries found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || selectedStatus || selectedType
                      ? 'Try adjusting your filters to see more results.'
                      : 'Get started by creating your first journal entry.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {finalJournals.map((journal) => (
                    <div key={journal.journal_id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              Journal #{journal.sequentialId}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {journal.journal_id} • {formatDatePK(journal.journal_date)}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(journal.journal_type)}`}>
                              {journal.journal_type}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(journal.status)}`}>
                              {journal.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {formatCurrency(journal.total_amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {journal.journal_details?.length || 0} entries
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {journal.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePostJournal(journal.journal_id)}
                              className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors duration-200"
                              title="Post Journal"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {journal.status === 'DRAFT' && (
                            <button
                              onClick={() => handleEdit(journal)}
                              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="Edit Journal"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {journal.status === 'DRAFT' && (
                            <button
                              onClick={() => handleDelete(journal.journal_id)}
                              className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Delete Journal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
    </DashboardLayout>
  );

  // Render Journal Create View
  const renderJournalCreateView = () => (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setCurrentView('list')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingJournal ? 'Edit Journal Entry' : 'Create New Journal Entry'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {editingJournal ? 'Update journal entry information' : 'Record payments, receipts, and account transfers'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          {/* Left Side - Journal Details */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
              <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Journal Information</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Journal Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Journal Date *
                      </label>
                      <input
                        type="date"
                        name="journal_date"
                        value={formData.journal_date}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      />
                    </div>

                    {/* Journal Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Journal Type *
                      </label>
                      <select
                        name="journal_type"
                        value={formData.journal_type}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      >
                        <option value="PAYMENT">Payment</option>
                        <option value="RECEIPT">Receipt</option>
                        <option value="TRANSFER">Transfer</option>
                        <option value="ADJUSTMENT">Adjustment</option>
                      </select>
                    </div>
                  </div>

                  {/* Reference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference
                    </label>
                    <input
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Enter reference number"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Enter journal description"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setCurrentView('list')}
                      className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      {editingJournal ? 'Update Journal' : 'Save Journal'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right Side - Journal Details */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
              <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Journal Details</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {/* Add New Detail Form */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Add Journal Detail</h4>
                  
                  <div className="space-y-4">
                    {/* Debit Account Selection */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Debit Account *
                      </label>
                      
                      {/* Selected Debit Account Balance */}
                      {selectedDebitAccount && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">
                              {selectedDebitAccount.cus_name}
                            </span>
                            <span className={`text-sm font-bold ${
                              parseFloat(selectedDebitAccount.cus_balance) >= 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              Balance: {formatCurrency(selectedDebitAccount.cus_balance)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="relative">
                        <input
                          type="text"
                          value={debitAccountSearchTerm}
                          onChange={(e) => {
                            setDebitAccountSearchTerm(e.target.value);
                            setShowDebitAccountDropdown(true);
                            if (!e.target.value) {
                              setSelectedDebitAccount(null);
                              setNewDetail(prev => ({ ...prev, debit_account_id: '' }));
                            }
                          }}
                          onFocus={() => setShowDebitAccountDropdown(true)}
                          placeholder="Search debit account..."
                          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute right-3 top-4" />
                        
                        {/* Dropdown */}
                        {showDebitAccountDropdown && (
                          <div className="account-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {filteredDebitAccounts.length > 0 ? (
                              filteredDebitAccounts.map((account) => (
                                <div
                                  key={account.cus_id}
                                  onClick={() => selectDebitAccount(account)}
                                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{account.cus_name}</div>
                                  <div className="text-sm text-gray-500">{account.cus_phone_no}</div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-gray-500 text-center">
                                No accounts found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Credit Account Selection */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Credit Account *
                      </label>
                      
                      {/* Selected Credit Account Balance */}
                      {selectedCreditAccount && (
                        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-900">
                              {selectedCreditAccount.cus_name}
                            </span>
                            <span className={`text-sm font-bold ${
                              parseFloat(selectedCreditAccount.cus_balance) >= 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              Balance: {formatCurrency(selectedCreditAccount.cus_balance)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="relative">
                        <input
                          type="text"
                          value={creditAccountSearchTerm}
                          onChange={(e) => {
                            setCreditAccountSearchTerm(e.target.value);
                            setShowCreditAccountDropdown(true);
                            if (!e.target.value) {
                              setSelectedCreditAccount(null);
                              setNewDetail(prev => ({ ...prev, credit_account_id: '' }));
                            }
                          }}
                          onFocus={() => setShowCreditAccountDropdown(true)}
                          placeholder="Search credit account..."
                          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute right-3 top-4" />
                        
                        {/* Dropdown */}
                        {showCreditAccountDropdown && (
                          <div className="account-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {filteredCreditAccounts.length > 0 ? (
                              filteredCreditAccounts.map((account) => (
                                <div
                                  key={account.cus_id}
                                  onClick={() => selectCreditAccount(account)}
                                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{account.cus_name}</div>
                                  <div className="text-sm text-gray-500">{account.cus_phone_no}</div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-gray-500 text-center">
                                No accounts found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount *
                      </label>
                      <input
                        type="number"
                        name="amount"
                        value={newDetail.amount}
                        onChange={handleNewDetailChange}
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Transaction Impact Summary */}
                    {selectedDebitAccount && selectedCreditAccount && newDetail.amount && parseFloat(newDetail.amount) > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-yellow-900 mb-3">Transaction Impact</h5>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-yellow-800">
                              <strong>{selectedDebitAccount.cus_name}</strong> (Debit)
                            </span>
                            <span className="text-red-600 font-medium">
                              {formatCurrency(selectedDebitAccount.cus_balance)} → {formatCurrency(parseFloat(selectedDebitAccount.cus_balance) + parseFloat(newDetail.amount))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-yellow-800">
                              <strong>{selectedCreditAccount.cus_name}</strong> (Credit)
                            </span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(selectedCreditAccount.cus_balance)} → {formatCurrency(parseFloat(selectedCreditAccount.cus_balance) - parseFloat(newDetail.amount))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        name="description"
                        value={newDetail.description}
                        onChange={handleNewDetailChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        placeholder="Enter description"
                      />
                    </div>

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={addJournalDetail}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Detail
                    </button>
                  </div>
                </div>

                {/* Journal Details List */}
                {formData.journal_details.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">
                      Journal Details ({formData.journal_details.length})
                    </h4>
                    
                    <div className="space-y-3">
                      {formData.journal_details.map((detail, index) => {
                        const account = customers.find(c => c.cus_id === detail.account_id);
                        return (
                          <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{account?.cus_name || 'Unknown Account'}</div>
                                <div className="text-sm text-gray-500">{detail.description}</div>
                                <div className="flex space-x-4 text-sm">
                                  {parseFloat(detail.debit_amount) > 0 && (
                                    <span className="text-red-600 font-medium">
                                      Debit: {formatCurrency(detail.debit_amount)}
                                    </span>
                                  )}
                                  {parseFloat(detail.credit_amount) > 0 && (
                                    <span className="text-green-600 font-medium">
                                      Credit: {formatCurrency(detail.credit_amount)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeJournalDetail(index)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totals */}
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total Debits:</span>
                        <span className="font-bold text-red-600">{formatCurrency(calculateTotalDebits())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total Credits:</span>
                        <span className="font-bold text-green-600">{formatCurrency(calculateTotalCredits())}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
                        <span className="font-semibold">Balance:</span>
                        <span className={`font-bold ${isBalanced() ? 'text-green-600' : 'text-red-600'}`}>
                          {isBalanced() ? 'Balanced' : 'Not Balanced'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );

  return currentView === 'list' ? renderJournalListView() : renderJournalCreateView();
}
