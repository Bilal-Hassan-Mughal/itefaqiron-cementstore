'use client';

import { useState, useEffect } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Tag, 
  Search, 
  Filter,
  DollarSign,
  Hash,
  Calendar,
  AlertCircle,
  Eye,
  BarChart3,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  FileText,
  Receipt
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

export default function ExpenseTitlesPage() {
  // State management
  const [expenseTitles, setExpenseTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'create'
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Form data
  const [formData, setFormData] = useState({
    title: ''
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/expense-titles');
      
      if (response.ok) {
        const data = await response.json();
        setExpenseTitles(data);
      }
    } catch (error) {
      console.error('Error fetching expense titles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredTitles = expenseTitles.filter(title => {
    const matchesSearch = title.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedTitles = filteredTitles.sort((a, b) => {
    let aValue, bValue;
    
    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at);
      bValue = new Date(b.created_at);
    } else if (sortBy === 'title') {
      aValue = a.title.toLowerCase();
      bValue = b.title.toLowerCase();
    } else if (sortBy === 'expense_count') {
      aValue = a.expenses?.length || 0;
      bValue = b.expenses?.length || 0;
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

  const finalTitles = sortedTitles.map((title, index) => ({
    ...title,
    sequentialId: index + 1
  }));

  // Stats calculations
  const totalTitles = expenseTitles.length;
  const totalExpenses = expenseTitles.reduce((sum, title) => sum + (title.expenses?.length || 0), 0);
  const totalExpenseAmount = expenseTitles.reduce((sum, title) => {
    const titleExpenses = title.expenses || [];
    return sum + titleExpenses.reduce((titleSum, expense) => titleSum + parseFloat(expense.exp_amount), 0);
  }, 0);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validation
      if (!formData.title.trim()) {
        alert('Please enter a title');
        return;
      }
      
      const url = '/api/expense-titles';
      const method = editingTitle ? 'PUT' : 'POST';
      
      const body = editingTitle 
        ? { 
            id: editingTitle.id, 
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
        setEditingTitle(null);
        setFormData({ title: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save expense title');
      }
    } catch (error) {
      console.error('Error saving expense title:', error);
      alert('Failed to save expense title');
    }
  };

  const handleEdit = (title) => {
    setEditingTitle(title);
    setFormData({
      title: title.title
    });
    setCurrentView('create');
  };

  const handleDelete = async (titleId) => {
    if (window.confirm('Are you sure you want to delete this expense title?')) {
      try {
        const response = await fetch(`/api/expense-titles?id=${titleId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          await fetchData();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete expense title');
        }
      } catch (error) {
        console.error('Error deleting expense title:', error);
        alert('Failed to delete expense title');
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('created_at');
    setSortOrder('desc');
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

  // Render Expense Titles List View
  const renderExpenseTitlesListView = () => (
    <DashboardLayout>
      {/* Fixed Height Container with Overflow Hidden */}
      <div className="h-full flex flex-col overflow-hidden">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Expense Titles Management</h2>
              <p className="text-gray-600 mt-1">Manage expense categories and titles for tracking expenses</p>
            </div>
            <button
              onClick={() => setCurrentView('create')}
              className="group bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span className="flex items-center">
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                Add New Title
              </span>
            </button>
          </div>
        </div>

        {/* Fixed Filters Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters & Sorting</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Clear All Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search expense titles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="expense_count-desc">Most Expenses</option>
                  <option value="expense_count-asc">Least Expenses</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Stats Cards Section */}
        <div className="flex-shrink-0 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                  <Tag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Titles</p>
                  <p className="text-2xl font-bold text-gray-900">{totalTitles}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">{totalExpenses}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{totalExpenseAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flexible Table Section - Only This Scrolls */}
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
            {/* Fixed Table Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Expense Titles List</h3>
              <span className="text-sm text-gray-500">
                Showing {finalTitles.length} of {expenseTitles.length} titles
              </span>
            </div>
            
            {finalTitles.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Tag className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No expense titles found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm
                      ? 'Try adjusting your search to see more results.'
                      : 'Get started by adding your first expense title.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Fixed Column Headers */}
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-2">ID</div>
                    <div className="col-span-4">Title</div>
                    <div className="col-span-2">Expenses</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-2">Actions</div>
                  </div>
                </div>
                
                {/* Scrollable Table Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {finalTitles.map((title) => {
                      return (
                        <div key={title.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                          {/* ID */}
                          <div className="col-span-2 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">#{title.sequentialId}</div>
                              <div className="text-xs text-gray-500">ID: {title.id.toString().slice(-8)}</div>
                            </div>
                          </div>

                          {/* Title */}
                          <div className="col-span-4 flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{title.title}</div>
                              <div className="text-xs text-gray-500">
                                Created: {formatDatePK(title.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Expenses */}
                          <div className="col-span-2 flex items-center">
                            <div>
                              <div className="text-sm font-semibold text-blue-600">{title.expenses?.length || 0}</div>
                              <div className="text-xs text-gray-500">
                                Total: {title.expenses?.reduce((sum, expense) => sum + parseFloat(expense.exp_amount), 0).toFixed(2) || '0.00'}
                              </div>
                            </div>
                          </div>

                          {/* Created */}
                          <div className="col-span-2 flex items-center">
                            <div className="text-sm text-gray-900">
                              {formatDatePK(title.created_at)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(title)}
                                className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                title="Edit Title"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(title.id)}
                                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                title="Delete Title"
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
      </div>
    </DashboardLayout>
  );

  // Render Expense Title Create View
  const renderExpenseTitleCreateView = () => (
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
                  {editingTitle ? 'Edit Expense Title' : 'Create New Expense Title'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {editingTitle ? 'Update expense title information' : 'Add a new expense category title'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
            {/* Form Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Expense Title Details</h3>
            </div>
            
            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form Fields Section */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-gray-600" />
                    Title Information
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expense Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-black"
                        placeholder="Enter expense title (e.g., Office Supplies, Travel, Marketing)"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        This title will be used to categorize expenses
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCurrentView('list')}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    {editingTitle ? 'Update Title' : 'Create Title'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <>
      {currentView === 'list' ? renderExpenseTitlesListView() : renderExpenseTitleCreateView()}
    </>
  );
}
