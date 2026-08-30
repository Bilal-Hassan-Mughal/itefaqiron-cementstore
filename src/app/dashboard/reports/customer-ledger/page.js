'use client';

import { useState, useEffect } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import {
  Download,
  Printer,
  ArrowLeft,
  FileText,
  Search,
  X,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CustomerLedgerReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default dates on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(2000, 0, 1).toISOString().split('T')[0]; // From year 2000
    setStartDate(yearAgo);
    setEndDate(today);
    fetchCustomers();
  }, []);

  // Auto-fetch report when customer and dates are set
  useEffect(() => {
    if (selectedCustomer && startDate && endDate) {
      fetchReport();
    }
  }, [selectedCustomer, startDate, endDate]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers?dropdown=true');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.cus_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_phone_no2?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_reference?.toLowerCase().includes(customerSearchTerm.toLowerCase());
    return matchesSearch;
  });

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer.cus_name);
    setShowCustomerDropdown(false);
  };

  const fetchReport = async () => {
    if (!selectedCustomer || !startDate || !endDate) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=customer-ledger&customerId=${selectedCustomer.cus_id}&startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();

      if (response.ok) {
        setReportData(data);
      } else {
        alert('Error fetching report');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error fetching report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!reportData) return;

    let csv = 'Ittefaq Iron and Cement Store\n';
    csv += 'Address: Parianwali\n';
    csv += 'Phone: +92 346 7560306\n\n';
    csv += 'Customer Ledger Report\n';
    csv += `Customer: ${reportData.customer?.cus_name}\n`;
    csv += `From: ${formatDatePK(startDate)} To: ${formatDatePK(endDate)}\n`;
    csv += `Generated on: ${new Date().toLocaleString()}\n\n`;
    csv += 'Date,Type,Bill No,Details,Debit,Credit,Balance,Payments\n';

    reportData.ledgerEntries.forEach(entry => {
      csv += `${formatDatePK(entry.created_at)},${entry.trnx_type},${entry.bill_no || ''},${entry.details || ''},${fmtAmt(entry.debit_amount)},${fmtAmt(entry.credit_amount)},${fmtAmt(entry.closing_balance)},${fmtAmt(entry.payments)}\n`;
    });

    csv += '\n';
    csv += `Opening Balance:,,,${fmtAmt(reportData.summary.openingBalance)}\n`;
    csv += `Total Debit:,,,${fmtAmt(reportData.summary.totalDebit)}\n`;
    csv += `Total Credit:,,,${fmtAmt(reportData.summary.totalCredit)}\n`;
    csv += `Closing Balance:,,,${fmtAmt(reportData.summary.closingBalance)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-ledger-${reportData.customer?.cus_name}-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div id="printable-report" className="h-full flex flex-col overflow-hidden print:overflow-visible">
        {/* Header */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/dashboard/reports')}
              className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Customer Ledger Report</h2>
              <p className="text-gray-600 mt-1">View detailed transaction ledger for a customer</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer *</label>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => `${option.cus_name} (${option.cus_phone_no || option.cus_phone_no2 || 'No Phone'})`}
                  value={selectedCustomer}
                  onChange={(event, newValue) => {
                    setSelectedCustomer(newValue);
                    if (newValue) {
                      setCustomerSearchTerm(newValue.cus_name);
                    } else {
                      setCustomerSearchTerm('');
                    }
                  }}
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search and select customer..."
                      onFocus={(e) => e.target.select()}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '0.5rem',
                          backgroundColor: 'white',
                          minHeight: '42px',
                        }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <Search size={18} className="text-gray-400" />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />

                {selectedCustomer && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-green-800">{selectedCustomer.cus_name}</div>
                        <div className="text-sm text-green-600">{selectedCustomer.cus_phone_no}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchReport}
                disabled={loading || !selectedCustomer}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-2 rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {reportData && (
          <>
            {/* Print Header */}
            <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Ittefaq Iron and Cement Store</h1>
                <p className="text-gray-700 text-lg">Address: Parianwali</p>
                <p className="text-gray-700 text-lg">Phone: +92 346 7560306</p>
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h2 className="text-2xl font-semibold text-gray-800">Customer Ledger Report</h2>
                  <p className="text-gray-600 mt-2">Customer: {reportData.customer?.cus_name}</p>
                  <p className="text-gray-600">
                    From {formatDatePK(startDate)} to {formatDatePK(endDate)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated on: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 mb-4 print:hidden">
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 print:min-h-0 print:block">
              <div className="bg-white rounded-lg shadow print:shadow-none print:border print:border-gray-300 h-full flex flex-col print:block">
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Ledger Entries</h3>
                </div>

                <div className="flex-1 overflow-auto print:overflow-visible print:block">
                  <table className="min-w-full divide-y divide-gray-200 print:block print:table">
                    <thead className="bg-white border-b-2 border-gray-300 sticky top-0 print:relative">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Bill No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Details</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Bill</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Debit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Credit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 font-bold uppercase tracking-wider">Payments</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.ledgerEntries.map((entry, index) => {
                        const isCredit = parseFloat(entry.credit_amount || 0) > 0;
                        const isDebit = parseFloat(entry.debit_amount || 0) > 0 && !isCredit;
                        const rowBg = isCredit
                          ? 'bg-green-50/80 ledger-row-hover-credit print:bg-green-50'
                          : isDebit
                            ? 'bg-red-50/80 ledger-row-hover-debit print:bg-red-50'
                            : 'ledger-row-hover print:hover:bg-white';
                        return (
                        <tr key={entry.l_id} className={`${rowBg} cursor-pointer`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDatePK(entry.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.trnx_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.bill_no?.slice(-8) || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {entry.details || 'N/A'}
                          </td>
                          {(() => {
                            const firstIndex = reportData.ledgerEntries.findIndex(e => e.bill_no === entry.bill_no && ((e.cus_id || e.customer?.cus_id) === (entry.cus_id || entry.customer?.cus_id)));
                            const isFirstBill = entry.bill_no && firstIndex === index;
                            return (
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {entry.bill_no ? (
                                  isFirstBill ? (
                                    <div>
                                      Bill: {entry.bill_no}{' '}
                                      {((entry.trnx_type === 'PURCHASE' && parseFloat(entry.debit_amount || 0) > 0) || (/incity \(own\) - (labour|delivery)/i).test(entry.details || '')) ? (
                                        <span className="text-xs text-blue-600 font-bold">— {fmtAmt(entry.debit_amount)}</span>
                                      ) : null}
                                    </div>
                                  ) : ''
                                ) : '-'}
                              </td>
                            );
                          })() }
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                            {fmtAmt(entry.debit_amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                            {fmtAmt(entry.credit_amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                            {fmtAmt(entry.closing_balance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                            {fmtAmt(entry.payments)}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-900">Opening Balance:</td>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-900">
                          {fmtAmt(reportData.summary.openingBalance)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-900">Total Debit:</td>
                        <td className="px-6 py-4 text-right text-sm text-red-600">
                          {fmtAmt(reportData.summary.totalDebit)}
                        </td>
                        <td colSpan="3"></td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm text-gray-900">Total Credit:</td>
                        <td colSpan="1"></td>
                        <td className="px-6 py-4 text-right text-sm text-green-600">
                          {fmtAmt(reportData.summary.totalCredit)}
                        </td>
                        <td colSpan="2"></td>
                      </tr>
                      <tr className="border-t-2 border-blue-300 bg-blue-50">
                        <td colSpan="4" className="px-6 py-4 text-right text-sm font-bold text-blue-800">Closing Balance:</td>
                        <td colSpan="4" className="px-6 py-4 text-right text-sm font-bold text-blue-800">
                          {fmtAmt(reportData.summary.closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-8 pt-4 border-t-2 border-gray-800">
              <div className="text-center">
                <p className="text-gray-700 font-semibold">Ittefaq Iron and Cement Store</p>
                <p className="text-gray-600 text-sm">Address: Parianwali | Phone: +92 346 7560306</p>
                <p className="text-gray-500 text-xs mt-2">
                  This is a computer-generated report. No signature required.
                </p>
              </div>
            </div>
          </>
        )}

        {!reportData && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Report Generated</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select a customer, date range and click &quot;Generate Report&quot;
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          .no-print { display: none !important; }
          body { font-size: 10px !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 9px !important; }
          th, td { padding: 4px 6px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          th { position: static !important; }
          tr { page-break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
