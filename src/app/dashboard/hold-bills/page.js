'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  DollarSign, 
  Package, 
  Eye, 
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  X,
  ShoppingCart
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function HoldBillsPage() {
  // State management
  const [holdBills, setHoldBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingHoldBill, setViewingHoldBill] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [draftsRes, holdBillsRes] = await Promise.all([
        fetch('/api/draft-sales'),
        fetch('/api/hold-bills')
      ]);

      const allBills = [];

      // Process draft-sales (POS Held Bills)
      if (draftsRes.ok) {
        const draftsData = await draftsRes.json();
        if (Array.isArray(draftsData)) {
          draftsData.forEach(d => {
            let parsed = {};
            try {
              parsed = typeof d.form_state_json === 'string' ? JSON.parse(d.form_state_json) : (d.form_state_json || {});
            } catch (e) {
              parsed = {};
            }

            const products = parsed.products || [];
            const subtotal = products.reduce((sum, p) => sum + (parseFloat(p.amount || p.total_amount || (p.rate * p.quantity) || 0)), 0);
            const discount = parseFloat(parsed.paymentData?.discount || 0);
            const shipping = parseFloat(parsed.paymentData?.deliveryCharges || 0);
            const labour = parseFloat(parsed.paymentData?.labour || 0);

            allBills.push({
              hold_bill_id: d.draft_id,
              draft_code: d.draft_code || `DRAFT-${d.draft_id}`,
              cus_id: d.cus_id,
              customer: d.customer || parsed.customer || { cus_name: 'No Customer', cus_phone_no: '' },
              subtotal: subtotal,
              discount: discount,
              shipping_amount: shipping,
              labour: labour,
              total_amount: subtotal + shipping + labour - discount,
              status: d.is_active ? 'DRAFT' : 'CONVERTED',
              created_at: d.created_at,
              updated_at: d.updated_at,
              is_draft_sale: true,
              raw_draft: d,
              hold_bill_details: products,
              parsed_state: parsed
            });
          });
        }
      }

      // Process legacy hold-bills table if any
      if (holdBillsRes.ok) {
        const legacyData = await holdBillsRes.json();
        if (Array.isArray(legacyData)) {
          legacyData.forEach(h => {
            allBills.push({
              ...h,
              draft_code: `HOLD-${h.hold_bill_id}`,
              is_draft_sale: false
            });
          });
        }
      }

      setHoldBills(allBills);
    } catch (error) {
      console.error('Error fetching hold bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredHoldBills = holdBills.filter(holdBill => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (holdBill.customer?.cus_name || '').toLowerCase().includes(searchLower) ||
                          (holdBill.customer?.cus_phone_no || '').toLowerCase().includes(searchLower) ||
                          (holdBill.draft_code || '').toLowerCase().includes(searchLower) ||
                          holdBill.hold_bill_id?.toString().includes(searchLower);
    const matchesStatus = !selectedStatus || holdBill.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const sortedHoldBills = [...filteredHoldBills].sort((a, b) => {
    let aValue, bValue;
    
    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at || a.updated_at);
      bValue = new Date(b.created_at || b.updated_at);
    } else if (sortBy === 'total_amount') {
      aValue = parseFloat(a.total_amount || 0);
      bValue = parseFloat(b.total_amount || 0);
    } else if (sortBy === 'customer') {
      aValue = (a.customer?.cus_name || '').toLowerCase();
      bValue = (b.customer?.cus_name || '').toLowerCase();
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

  const finalHoldBills = sortedHoldBills.map((holdBill, index) => ({
    ...holdBill,
    sequentialId: index + 1
  }));

  // Stats calculations
  const totalHoldBills = holdBills.length;
  const draftHoldBills = holdBills.filter(h => h.status === 'DRAFT').length;
  const convertedHoldBills = holdBills.filter(h => h.status === 'CONVERTED').length;
  const totalHoldBillValue = holdBills.reduce((sum, h) => sum + parseFloat(h.total_amount || 0), 0);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'DRAFT':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'CONVERTED':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-amber-100 text-amber-800';
      case 'CONVERTED':
        return 'bg-emerald-100 text-emerald-800';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleLoadInPOS = (holdBill) => {
    window.location.href = `/dashboard/sales?draftId=${holdBill.hold_bill_id}`;
  };

  const handleDelete = async (holdBill) => {
    if (window.confirm(`Are you sure you want to delete hold bill ${holdBill.draft_code}?`)) {
      try {
        const endpoint = holdBill.is_draft_sale 
          ? `/api/draft-sales?id=${holdBill.hold_bill_id}`
          : `/api/hold-bills?id=${holdBill.hold_bill_id}`;

        const response = await fetch(endpoint, {
          method: 'DELETE'
        });

        if (response.ok) {
          await fetchData();
        } else {
          alert('Failed to delete hold bill');
        }
      } catch (error) {
        console.error('Error deleting hold bill:', error);
        alert('Error deleting hold bill');
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Hold Bills Management</h2>
              <p className="text-gray-600 mt-1">Manage your held bills and load them directly into POS</p>
            </div>
            <button
              onClick={() => window.location.href = '/dashboard/sales'}
              className="group bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <span className="flex items-center">
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                New Sale / Hold Bill
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
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                Clear All Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by customer, code or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Held (Draft)</option>
                  <option value="CONVERTED">Converted</option>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="customer-asc">Customer A-Z</option>
                  <option value="customer-desc">Customer Z-A</option>
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
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Hold Bills</p>
                  <p className="text-2xl font-bold text-gray-900">{totalHoldBills}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Held (Active)</p>
                  <p className="text-2xl font-bold text-gray-900">{draftHoldBills}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Converted</p>
                  <p className="text-2xl font-bold text-gray-900">{convertedHoldBills}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">Rs. {fmtAmt(totalHoldBillValue)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 h-full flex flex-col">
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Hold Bills List</h3>
              <span className="text-sm text-gray-500">
                Showing {finalHoldBills.length} of {holdBills.length} hold bills
              </span>
            </div>
            
            {finalHoldBills.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hold bills found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || selectedStatus
                      ? 'Try adjusting your filters to see more results.'
                      : 'Save a sale as draft/held on POS to see it here.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Table View */}
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {finalHoldBills.map((holdBill) => (
                      <div key={holdBill.hold_bill_id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-orange-50/50 transition-colors duration-200 items-center">
                        {/* Code / ID */}
                        <div className="col-span-2">
                          <div className="text-sm font-bold text-orange-600">{holdBill.draft_code}</div>
                          <div className="text-xs text-gray-400">ID: {holdBill.hold_bill_id}</div>
                        </div>

                        {/* Customer */}
                        <div className="col-span-3">
                          <div className="text-sm font-medium text-gray-900">{holdBill.customer?.cus_name || 'No customer'}</div>
                          <div className="text-xs text-gray-500">{holdBill.customer?.cus_phone_no || ''}</div>
                        </div>

                        {/* Amount & Details */}
                        <div className="col-span-3">
                          <div className="text-sm font-bold text-gray-900">Rs. {fmtAmt(holdBill.total_amount)}</div>
                          <div className="text-xs text-gray-500">
                            Items: {holdBill.hold_bill_details?.length || 0} {holdBill.discount > 0 ? `| Disc: ${fmtAmt(holdBill.discount)}` : ''}
                          </div>
                        </div>

                        {/* Date */}
                        <div className="col-span-2">
                          <div className="text-sm text-gray-700">
                            {new Date(holdBill.created_at || holdBill.updated_at).toLocaleDateString('en-GB')}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(holdBill.created_at || holdBill.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setViewingHoldBill(holdBill)}
                            className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleLoadInPOS(holdBill)}
                            className="flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors duration-200"
                            title="Load & Open in POS"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                            Open POS
                          </button>
                          <button
                            onClick={() => handleDelete(holdBill)}
                            className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Delete Hold Bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {viewingHoldBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Hold Bill Details - {viewingHoldBill.draft_code}</h3>
                <p className="text-xs text-gray-500">
                  Created: {new Date(viewingHoldBill.created_at).toLocaleDateString('en-GB')} {new Date(viewingHoldBill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => setViewingHoldBill(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Information</p>
                <p className="text-base font-bold text-gray-900">{viewingHoldBill.customer?.cus_name || 'No customer selected'}</p>
                {viewingHoldBill.customer?.cus_phone_no && (
                  <p className="text-sm text-gray-600">Phone: {viewingHoldBill.customer.cus_phone_no}</p>
                )}
                {viewingHoldBill.customer?.cus_address && (
                  <p className="text-sm text-gray-600">Address: {viewingHoldBill.customer.cus_address}</p>
                )}
              </div>

              {/* Items Table */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items List ({viewingHoldBill.hold_bill_details?.length || 0})</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-semibold">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-black">
                      {(viewingHoldBill.hold_bill_details || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 px-3">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium">{item.pro_title || item.pro_name || item.title || 'Product'}</td>
                          <td className="py-2 px-3 text-right">{fmtAmt(item.quantity || item.qnty || 0)}</td>
                          <td className="py-2 px-3 text-right">{fmtAmt(item.rate || item.unit_rate || 0)}</td>
                          <td className="py-2 px-3 text-right font-medium">{fmtAmt(item.amount || item.total_amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="border-t pt-3 space-y-1 text-sm text-black">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">Rs. {fmtAmt(viewingHoldBill.subtotal)}</span>
                </div>
                {viewingHoldBill.labour > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Labour:</span>
                    <span>Rs. {fmtAmt(viewingHoldBill.labour)}</span>
                  </div>
                )}
                {viewingHoldBill.shipping_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Freight/Delivery:</span>
                    <span>Rs. {fmtAmt(viewingHoldBill.shipping_amount)}</span>
                  </div>
                )}
                {viewingHoldBill.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>- Rs. {fmtAmt(viewingHoldBill.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-orange-600 border-t pt-2 mt-2">
                  <span>Grand Total:</span>
                  <span>Rs. {fmtAmt(viewingHoldBill.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setViewingHoldBill(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Close
              </button>
              <button
                onClick={() => handleLoadInPOS(viewingHoldBill)}
                className="flex items-center px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-sm font-semibold shadow-md hover:from-orange-600 hover:to-red-600 transition-all duration-200"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Open & Process in POS
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
