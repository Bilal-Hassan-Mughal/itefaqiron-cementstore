'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Truck, User, Phone, Calendar, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { formatDatePK } from '@/lib/date-helper';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    v_vehicle_no: '',
    v_driver_no: '',
    v_driver_name: ''
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');

  // Load data from API
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vehicles');

      if (response.ok) {
        const vehiclesData = await response.json();
        setVehicles(vehiclesData);
      } else {
        console.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newVehicle = await response.json();
        setVehicles(prev => [...prev, newVehicle]);
        setShowVehicleForm(false);
        setFormData({
          v_vehicle_no: '',
          v_driver_no: '',
          v_driver_name: ''
        });
        alert('Vehicle added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create vehicle');
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      alert('Failed to create vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      v_vehicle_no: vehicle.v_vehicle_no || '',
      v_driver_no: vehicle.v_driver_no || '',
      v_driver_name: vehicle.v_driver_name || ''
    });
    setShowVehicleForm(true);
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/vehicles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingVehicle.v_id,
          ...formData
        }),
      });

      if (response.ok) {
        const updatedVehicle = await response.json();
        setVehicles(prev => prev.map(vehicle => 
          vehicle.v_id === editingVehicle.v_id ? updatedVehicle : vehicle
        ));
        setShowVehicleForm(false);
        setEditingVehicle(null);
        setFormData({
          v_vehicle_no: '',
          v_driver_no: '',
          v_driver_name: ''
        });
        alert('Vehicle updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update vehicle');
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        const response = await fetch(`/api/vehicles?id=${vehicleId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setVehicles(prev => prev.filter(vehicle => vehicle.v_id !== vehicleId));
          alert('Vehicle deleted successfully!');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete vehicle');
        }
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('Failed to delete vehicle');
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
    if (!formData.v_vehicle_no.trim()) {
      alert('Vehicle number is required');
      return;
    }
    
    if (editingVehicle) {
      await handleUpdateVehicle(e);
    } else {
      await handleAddVehicle(e);
    }
  };

  // Filter vehicles based on search
  const filteredVehicles = vehicles
    .filter(vehicle => {
      const matchesSearch = vehicle.v_vehicle_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vehicle.v_driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vehicle.v_driver_no?.includes(searchTerm);
      
      return matchesSearch;
    })
    .map((vehicle, index) => ({
      ...vehicle,
      sequentialId: index + 1
    }));

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
            <h2 className="text-2xl font-bold text-gray-900">Vehicle Management</h2>
            <p className="text-gray-600 mt-1">Manage your vehicles and drivers</p>
          </div>
          <button
            onClick={() => setShowVehicleForm(true)}
            className="group bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="flex items-center">
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              Add New Vehicle
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Search Vehicles</h3>
          </div>
          
          <div>
            <input
              type="text"
              placeholder="Search by vehicle number, driver name, or driver phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            />
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
                <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">With Drivers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vehicles.filter(v => v.v_driver_name).length}
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
                  {vehicles.filter(v => {
                    const createdDate = new Date(v.created_at);
                    const thisMonth = new Date();
                    thisMonth.setDate(1);
                    return createdDate >= thisMonth;
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicles Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 flex flex-col h-[600px]">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Vehicles List</h3>
            <span className="text-sm text-gray-500">
              Showing {filteredVehicles.length} of {vehicles.length} vehicles
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.v_id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">#{vehicle.sequentialId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                          <Truck className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{vehicle.v_vehicle_no}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.v_driver_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.v_driver_no || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDatePK(vehicle.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle.updated_by_user?.full_name ? (
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mr-2">
                            <span className="text-white text-xs font-bold">
                              {vehicle.updated_by_user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {vehicle.updated_by_user.full_name}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {vehicle.updated_by_user.role || 'User'}
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
                          onClick={() => handleEditVehicle(vehicle)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors duration-200"
                          title="Edit Vehicle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.v_id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors duration-200"
                          title="Delete Vehicle"
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

        {/* Vehicle Modal */}
        {showVehicleForm && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background Overlay */}
              <div 
                className="fixed inset-0 bg-gradient-to-br from-gray-900/80 via-blue-900/60 to-purple-900/80 backdrop-blur-md transition-all duration-500 ease-out animate-fade-in" 
                onClick={() => setShowVehicleForm(false)}
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
                          {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                        </h3>
                        <p className="text-blue-100 text-sm">
                          {editingVehicle ? 'Update vehicle information' : 'Create a new vehicle record'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowVehicleForm(false)}
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
                        name="v_vehicle_no"
                        value={formData.v_vehicle_no}
                        onChange={handleFormChange}
                        required
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter vehicle number (e.g., ABC-123)"
                      />
                    </div>

                    {/* Driver Name */}
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4 inline mr-2" />
                        Driver Name
                      </label>
                      <input
                        type="text"
                        name="v_driver_name"
                        value={formData.v_driver_name}
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter driver name"
                      />
                    </div>

                    {/* Driver Phone */}
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-2" />
                        Driver Phone
                      </label>
                      <input
                        type="tel"
                        name="v_driver_no"
                        value={formData.v_driver_no}
                        onChange={handleFormChange}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-gray-50 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter driver phone number"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowVehicleForm(false)}
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
                              {editingVehicle ? 'Updating...' : 'Creating...'}
                            </>
                          ) : (
                            <>
                              {editingVehicle ? 'Update Vehicle' : 'Create Vehicle'}
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


















