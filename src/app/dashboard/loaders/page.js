'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Truck, User, Phone, Calendar, Loader2, CreditCard, Hash } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { formatDatePK } from '@/lib/date-helper';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function LoadersPage() {
  const [loaders, setLoaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showLoaderForm, setShowLoaderForm] = useState(false);
  const [editingLoader, setEditingLoader] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    loader_name: '',
    loader_number: '',
    loader_phone: '',
    loader_balance: 0
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');

  // Load data from API
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/loaders');

      if (response.ok) {
        const loadersData = await response.json();
        setLoaders(loadersData);
      } else {
        console.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoader = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/loaders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newLoader = await response.json();
        setLoaders(prev => [...prev, newLoader]);
        setShowLoaderForm(false);
        setFormData({
          loader_name: '',
          loader_number: '',
          loader_phone: '',
          loader_balance: 0
        });
        alert('Loader added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create loader');
      }
    } catch (error) {
      console.error('Error creating loader:', error);
      alert('Failed to create loader');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLoader = (loader) => {
    setEditingLoader(loader);
    setFormData({
      loader_name: loader.loader_name || '',
      loader_number: loader.loader_number || '',
      loader_phone: loader.loader_phone || '',
      loader_balance: loader.loader_balance || 0
    });
    setShowLoaderForm(true);
  };

  const handleUpdateLoader = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/loaders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingLoader.loader_id,
          ...formData
        }),
      });

      if (response.ok) {
        const updatedLoader = await response.json();
        setLoaders(prev => prev.map(loader => 
          loader.loader_id === editingLoader.loader_id ? updatedLoader : loader
        ));
        setShowLoaderForm(false);
        setEditingLoader(null);
        setFormData({
          loader_name: '',
          loader_number: '',
          loader_phone: '',
          loader_balance: 0
        });
        alert('Loader updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update loader');
      }
    } catch (error) {
      console.error('Error updating loader:', error);
      alert('Failed to update loader');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLoader = async (loaderId) => {
    if (window.confirm('Are you sure you want to delete this loader?')) {
      try {
        const response = await fetch(`/api/loaders?id=${loaderId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setLoaders(prev => prev.filter(loader => loader.loader_id !== loaderId));
          alert('Loader deleted successfully!');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete loader');
        }
      } catch (error) {
        console.error('Error deleting loader:', error);
        alert('Failed to delete loader');
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.loader_name.trim()) {
      alert('Loader name is required');
      return;
    }
    
    if (!formData.loader_number.trim()) {
      alert('Loader number is required');
      return;
    }
    
    if (editingLoader) {
      await handleUpdateLoader(e);
    } else {
      await handleAddLoader(e);
    }
  };

  const getBalanceColor = (balance) => {
    const bal = parseFloat(balance);
    if (bal > 0) return 'text-green-600';
    if (bal < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Filter loaders based on search and balance
  const filteredLoaders = loaders
    .filter(loader => {
      const matchesSearch = loader.loader_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           loader.loader_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           loader.loader_phone?.includes(searchTerm);
      
      let matchesBalance = true;
      if (balanceFilter === 'positive') {
        matchesBalance = parseFloat(loader.loader_balance) > 0;
      } else if (balanceFilter === 'negative') {
        matchesBalance = parseFloat(loader.loader_balance) < 0;
      } else if (balanceFilter === 'zero') {
        matchesBalance = parseFloat(loader.loader_balance) === 0;
      }
      
      return matchesSearch && matchesBalance;
    })
    .map((loader, index) => ({
      ...loader,
      sequentialId: index + 1
    }));

  const clearFilters = () => {
    setSearchTerm('');
    setBalanceFilter('all');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Loader/Transport Management</h2>
            <p className="text-gray-600 mt-1">Manage loaders and transport services</p>
          </div>
          <button
            onClick={() => setShowLoaderForm(true)}
            className="group bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="flex items-center">
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              Add New Loader
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters & Search</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search loaders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              />
            </div>

            {/* Balance Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Balance</label>
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="all">All Balances</option>
                <option value="positive">Positive Balance</option>
                <option value="negative">Negative Balance</option>
                <option value="zero">Zero Balance</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Loaders</p>
                <p className="text-2xl font-bold text-gray-900">{loaders.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Positive Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loaders.filter(l => parseFloat(l.loader_balance) > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loaders.filter(l => {
                    const createdDate = new Date(l.created_at);
                    const thisMonth = new Date();
                    thisMonth.setDate(1);
                    return createdDate >= thisMonth;
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Loaders Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 flex flex-col h-[600px]">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Loaders List</h3>
            <span className="text-sm text-gray-500">
              Showing {filteredLoaders.length} of {loaders.length} loaders
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loader Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loader Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLoaders.map((loader) => (
                  <tr key={loader.loader_id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">#{loader.sequentialId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">{loader.loader_name.charAt(0)}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">{loader.loader_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Hash className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{loader.loader_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{loader.loader_phone || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getBalanceColor(loader.loader_balance)}`}>
                        {fmtAmt(loader.loader_balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDatePK(loader.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {loader.updated_by_user?.full_name ? (
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mr-2">
                            <span className="text-white text-xs font-bold">
                              {loader.updated_by_user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {loader.updated_by_user.full_name}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {loader.updated_by_user.role || 'User'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditLoader(loader)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors duration-200"
                          title="Edit Loader"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLoader(loader.loader_id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors duration-200"
                          title="Delete Loader"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Loader Modal */}
        {showLoaderForm && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background Overlay */}
              <div 
                className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-blue-900/60 to-purple-900/80 backdrop-blur-md transition-all duration-500 ease-out animate-fade-in" 
                onClick={() => setShowLoaderForm(false)}
              ></div>
              
              {/* Modal Container */}
              <div className="relative inline-block w-full max-w-2xl p-0 my-8 overflow-hidden text-left align-middle transition-all duration-500 ease-out transform bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 animate-slide-in-up">
                
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mr-4">
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">
                          {editingLoader ? 'Edit Loader' : 'Add New Loader'}
                        </h3>
                        <p className="text-blue-100 text-sm">
                          {editingLoader ? 'Update loader information' : 'Create a new loader/transport record'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowLoaderForm(false)}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* First Row - Loader Name and Number */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <User className="w-4 h-4 inline mr-2" />
                          Loader Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="loader_name"
                          value={formData.loader_name}
                          onChange={handleFormChange}
                          required
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter loader name"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <Hash className="w-4 h-4 inline mr-2" />
                          Loader Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="loader_number"
                          value={formData.loader_number}
                          onChange={handleFormChange}
                          required
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter loader number"
                        />
                      </div>
                    </div>

                    {/* Second Row - Phone and Balance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <Phone className="w-4 h-4 inline mr-2" />
                          Loader Phone
                        </label>
                        <input
                          type="tel"
                          name="loader_phone"
                          value={formData.loader_phone}
                          onChange={handleFormChange}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter phone number"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <CreditCard className="w-4 h-4 inline mr-2" />
                          Balance
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="loader_balance"
                          value={formData.loader_balance}
                          onChange={handleFormChange}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter balance"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowLoaderForm(false)}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group px-8 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center">
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {editingLoader ? 'Updating...' : 'Creating...'}
                            </>
                          ) : (
                            <>
                              {editingLoader ? 'Update Loader' : 'Create Loader'}
                              <Check className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


















