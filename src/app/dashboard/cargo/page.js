'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Truck, Search, Calendar, DollarSign, Receipt } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CargoPage() {
  const [cargo, setCargo] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCargoForm, setShowCargoForm] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [formData, setFormData] = useState({
    vehicle_no: '',
    total_cargo_fare: 0,
    exp1: 0,
    exp2: 0,
    exp3: 0,
    exp4: 0,
    exp5: 0,
    exp6: 0,
    others: 0
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Load data from API
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cargo');

      if (response.ok) {
        const data = await response.json();
        const cargoData = data.cargo || data;
        setCargo(Array.isArray(cargoData) ? cargoData : []);
      } else {
        console.error('Failed to fetch cargo data');
      }
    } catch (error) {
      console.error('Error fetching cargo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCargo = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/cargo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newCargo = await response.json();
        setCargo(prev => [...prev, newCargo]);
        setShowCargoForm(false);
        resetForm();
        alert('Cargo added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create cargo');
      }
    } catch (error) {
      console.error('Error creating cargo:', error);
      alert('Failed to create cargo');
    }
  };

  const handleEditCargo = (cargoItem) => {
    setEditingCargo(cargoItem);
    setFormData({
      vehicle_no: cargoItem.vehicle_no || '',
      total_cargo_fare: cargoItem.total_cargo_fare || 0,
      exp1: cargoItem.exp1 || 0,
      exp2: cargoItem.exp2 || 0,
      exp3: cargoItem.exp3 || 0,
      exp4: cargoItem.exp4 || 0,
      exp5: cargoItem.exp5 || 0,
      exp6: cargoItem.exp6 || 0,
      others: cargoItem.others || 0
    });
    setShowCargoForm(true);
  };

  const handleUpdateCargo = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/cargo', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingCargo.cargo_id,
          ...formData
        }),
      });

      if (response.ok) {
        const updatedCargo = await response.json();
        setCargo(prev => prev.map(item =>
          item.cargo_id === editingCargo.cargo_id ? updatedCargo : item
        ));
        setShowCargoForm(false);
        setEditingCargo(null);
        resetForm();
        alert('Cargo updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update cargo');
      }
    } catch (error) {
      console.error('Error updating cargo:', error);
      alert('Failed to update cargo');
    }
  };

  const handleDeleteCargo = async (cargoId) => {
    if (window.confirm('Are you sure you want to delete this cargo record?')) {
      try {
        const response = await fetch(`/api/cargo?id=${cargoId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setCargo(prev => prev.filter(item => item.cargo_id !== cargoId));
          alert('Cargo deleted successfully!');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete cargo');
        }
      } catch (error) {
        console.error('Error deleting cargo:', error);
        alert('Failed to delete cargo');
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.vehicle_no.trim()) {
      alert('Vehicle number is required');
      return;
    }

    if (editingCargo) {
      await handleUpdateCargo(e);
    } else {
      await handleAddCargo(e);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicle_no: '',
      total_cargo_fare: 0,
      exp1: 0,
      exp2: 0,
      exp3: 0,
      exp4: 0,
      exp5: 0,
      exp6: 0,
      others: 0
    });
  };

  // Filter and sort cargo
  const filteredAndSortedCargo = cargo
    .filter(item => {
      const matchesSearch = (item.vehicle_no || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    })
    .map((item, index) => ({
      ...item,
      sequentialId: index + 1
    }));

  // Calculate total expenses
  const calculateTotalExpenses = (item) => {
    return (parseFloat(item.exp1) || 0) + (parseFloat(item.exp2) || 0) + (parseFloat(item.exp3) || 0) +
      (parseFloat(item.exp4) || 0) + (parseFloat(item.exp5) || 0) + (parseFloat(item.exp6) || 0) + (parseFloat(item.others) || 0);
  };

  // Calculate net amount
  const calculateNetAmount = (item) => {
    return (parseFloat(item.total_cargo_fare) || 0) - calculateTotalExpenses(item);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('created_at');
    setSortOrder('desc');
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
            <h2 className="text-2xl font-bold text-gray-900">Cargo Management</h2>
            <p className="text-gray-600 mt-1">Manage cargo records and expenses</p>
          </div>
          <button
            onClick={() => setShowCargoForm(true)}
            className="group bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="flex items-center">
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              Add New Cargo
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by vehicle number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="created_at">Date Created</option>
                <option value="vehicle_no">Vehicle Number</option>
                <option value="total_cargo_fare">Total Fare</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{cargo.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Fare</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cargo.reduce((sum, item) => sum + (parseFloat(item.total_cargo_fare) || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cargo.reduce((sum, item) => sum + calculateTotalExpenses(item), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Net Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cargo.reduce((sum, item) => sum + calculateNetAmount(item), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cargo Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 flex flex-col h-[600px]">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Cargo Records</h3>
            <span className="text-sm text-gray-500">
              Showing {filteredAndSortedCargo.length} of {cargo.length} records
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedCargo.map((item) => (
                    <tr key={item.cargo_id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.vehicle_no}</div>
                            <div className="text-sm text-gray-500">ID: #{item.sequentialId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {fmtAmt(item.total_cargo_fare)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-red-600">
                          {fmtAmt(calculateTotalExpenses(item))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${calculateNetAmount(item) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtAmt(calculateNetAmount(item))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditCargo(item)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors duration-200"
                            title="Edit Cargo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCargo(item.cargo_id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors duration-200"
                            title="Delete Cargo"
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

        {/* Cargo Modal */}
        {showCargoForm && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background Overlay */}
              <div
                className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-blue-900/60 to-purple-900/80 backdrop-blur-md transition-all duration-500 ease-out animate-fade-in"
                onClick={() => setShowCargoForm(false)}
              ></div>

              {/* Modal Container */}
              <div className="relative inline-block w-full max-w-4xl p-0 my-8 overflow-hidden text-left align-middle transition-all duration-500 ease-out transform bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 animate-slide-in-up">

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
                          {editingCargo ? 'Edit Cargo Record' : 'Add New Cargo Record'}
                        </h3>
                        <p className="text-blue-100 text-sm">
                          {editingCargo ? 'Update cargo information' : 'Create a new cargo record'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCargoForm(false)}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Vehicle Number */}
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Truck className="w-4 h-4 inline mr-2" />
                        Vehicle Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="vehicle_no"
                        value={formData.vehicle_no}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicle_no: e.target.value }))}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                        placeholder="Enter vehicle number"
                      />
                    </div>

                    {/* Total Cargo Fare */}
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        Total Cargo Fare
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="total_cargo_fare"
                        value={formData.total_cargo_fare}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                        placeholder="Enter total cargo fare"
                      />
                    </div>

                    {/* Expenses Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 1
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp1"
                          value={formData.exp1}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 2
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp2"
                          value={formData.exp2}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 3
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp3"
                          value={formData.exp3}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 4
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp4"
                          value={formData.exp4}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 5
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp5"
                          value={formData.exp5}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="group">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expense 6
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="exp6"
                          value={formData.exp6}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Others */}
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Other Expenses
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="others"
                        value={formData.others}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black"
                        placeholder="Enter other expenses"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowCargoForm(false)}
                        className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="group px-8 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <span className="flex items-center">
                          {editingCargo ? 'Update Cargo' : 'Create Cargo'}
                          <Check className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
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
