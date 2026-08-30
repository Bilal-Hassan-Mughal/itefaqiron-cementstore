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
  Building
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SupplierLedgerReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default dates on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(2000, 0, 1).toISOString().split('T')[0]; // From year 2000
    setStartDate(yearAgo);
    setEndDate(today);
    fetchSuppliers();
  }, []);

  // Auto-fetch report when supplier and dates are set
  useEffect(() => {
    if (selectedSupplier && startDate && endDate) {
      fetchReport();
    }
  }, [selectedSupplier, startDate, endDate]);

  const fetchSuppliers = async () => {
    try {
      // Fetch all customers to get suppliers (suppliers are also stored as customers)
      const response = await fetch('/api/customers?dropdown=true');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.cus_name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
      supplier.cus_phone_no?.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
      supplier.cus_phone_no2?.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
      supplier.cus_reference?.toLowerCase().includes(supplierSearchTerm.toLowerCase());
    return matchesSearch;
  });

  const selectSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierSearchTerm(supplier.cus_name);
    setShowSupplierDropdown(false);
  };
  const fetchReport = async () => {
    if (!selectedSupplier || !startDate || !endDate) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=supplier-ledger&supplierId=${selectedSupplier.cus_id}&startDate=${startDate}&endDate=${endDate}`);
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
    csv += 'Supplier Ledger Report\n';
    csv += `Supplier: ${reportData.supplier?.cus_name}\n`;
    csv += `From: ${formatDatePK(startDate)} To: ${formatDatePK(endDate)}\n`;
    csv += `Generated on: ${new Date().toLocaleString()}\n\n`;
    csv += 'Date,Type,Bill No,Details,Debit,Credit,Balance,Payments,Cash,Bank\n';

    reportData.ledgerEntries.forEach(entry => {
      csv += `${formatDatePK(entry.created_at)},${entry.trnx_type},${entry.bill_no || ''},${entry.details || ''},${fmtAmt(entry.debit_amount)},${fmtAmt(entry.credit_amount)},${fmtAmt(entry.closing_balance)},${fmtAmt(entry.payments)},${fmtAmt(entry.cash_payment)},${fmtAmt(entry.bank_payment)}\n`;
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
    a.download = `supplier-ledger-${reportData.supplier?.cus_name}-${startDate}-to-${endDate}.csv`;
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
              <h2 className="text-2xl font-bold text-gray-900">Supplier Ledger Report</h2>
              <p className="text-gray-600 mt-1">View detailed transaction ledger for a supplier</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Supplier *</label>
                <Autocomplete
                  options={suppliers}
                  getOptionLabel={(option) => `${option.cus_name} (${option.cus_phone_no || option.cus_phone_no2 || 'No Phone'})`}
                  value={selectedSupplier}
                  onChange={(event, newValue) => selectSupplier(newValue)}
                  inputValue={supplierSearchTerm}
                  onInputChange={(event, newInputValue) => setSupplierSearchTerm(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search supplier by name, phone, etc."
                      size="small"
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Building className="w-5 h-5 text-gray-400" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                  slotProps={{
                    popper: {
                      placement: 'bottom-start',
                    },
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6 print:hidden">
              <button
                onClick={fetchReport}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200 flex items-center gap-2"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
              {reportData && (
                <>
                  <button
                    onClick={handlePrint}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Report Content */}
        {reportData && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 pt-2 print:px-0">
              <ReportPageHeader
                reportTitle="SUPPLIER LEDGER"
                metaLines={[
                  `Period: ${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                  `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
                ]}
              />
            </div>
            {/* Header Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 mb-6 print:shadow-none print:border-0 print:rounded-0">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">{reportData.supplier?.cus_name}</h3>
                <p className="text-gray-600 mt-1">
                  {reportData.supplier?.cus_phone_no && `Phone: ${reportData.supplier.cus_phone_no}`}
                  {reportData.supplier?.cus_reference && ` | Reference: ${reportData.supplier.cus_reference}`}
                </p>
                <p className="text-gray-600 mt-1">
                  Period: {formatDatePK(startDate)} to {formatDatePK(endDate)}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-medium text-blue-600 mb-1">Opening Balance</div>
                  <div className="text-2xl font-bold text-blue-900">{fmtAmt(reportData.summary.openingBalance)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="text-sm font-medium text-red-600 mb-1">Total Debit (Purchase)</div>
                  <div className="text-2xl font-bold text-red-900">{fmtAmt(reportData.summary.totalDebit)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-sm font-medium text-green-600 mb-1">Total Credit (Payment)</div>
                  <div className="text-2xl font-bold text-green-900">{fmtAmt(reportData.summary.totalCredit)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-sm font-medium text-blue-600 mb-1">Closing Balance</div>
                  <div className="text-2xl font-bold text-blue-900">{fmtAmt(reportData.summary.closingBalance)}</div>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            {reportData.ledgerEntries && reportData.ledgerEntries.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden print:shadow-none print:border-0 print:rounded-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Type</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Bill No</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Details</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Bill</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-700">Debit</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-700">Credit</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-700">Cash</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-700">Bank</th>
                        <th className="px-6 py-3 text-right font-semibold text-gray-700">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.ledgerEntries.map((entry, index) => {
                        const isCredit = parseFloat(entry.credit_amount || 0) > 0;
                        const isDebit = parseFloat(entry.debit_amount || 0) > 0 && !isCredit;
                        const rowBg = isCredit
                          ? 'border-b border-green-200 bg-green-50/80 ledger-row-hover-credit print:bg-green-50'
                          : isDebit
                            ? 'border-b border-red-200 bg-red-50/80 ledger-row-hover-debit print:bg-red-50'
                            : 'border-b border-gray-200 ledger-row-hover';
                        return (
                        <tr key={index} className={`${rowBg} cursor-pointer`}>
                          <td className="px-6 py-3 text-gray-700">{formatDatePK(entry.created_at)}</td>
                          <td className="px-6 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              entry.trnx_type === 'CASH' ? 'bg-blue-100 text-blue-800' :
                              entry.trnx_type === 'BANK_TRANSFER' ? 'bg-purple-100 text-purple-800' :
                              entry.trnx_type === 'PURCHASE' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {entry.trnx_type}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-gray-700 font-medium">{entry.bill_no || '-'}</td>
                          <td className="px-6 py-3 text-gray-600 max-w-xs truncate" title={entry.details}>{entry.details}</td>

                          {/* show Bill only on the first ledger row for this account+bill */}
                          {(() => {
                            const firstIndex = reportData.ledgerEntries.findIndex(e => e.bill_no === entry.bill_no && ((e.cus_id || e.customer?.cus_id) === (entry.cus_id || entry.customer?.cus_id)));
                            const isFirstBill = entry.bill_no && firstIndex === index;
                            return (
                              <td className="px-6 py-3 text-gray-700 font-medium">
                                {entry.bill_no ? (
                                  isFirstBill ? (
                                    <div>
                                      Bill: {entry.bill_no}{' '}
                                      {(
                                        (entry.trnx_type === 'PURCHASE' && parseFloat(entry.debit_amount || 0) > 0) ||
                                        (/incity \(own\) - (labour|delivery)/i).test(entry.details || '')
                                      ) ? (
                                        <span className="text-blue-600 font-bold">— {fmtAmt(entry.debit_amount)}</span>
                                      ) : null}
                                    </div>
                                  ) : ''
                                ) : '-'}
                              </td>
                            );
                          })()}

                          <td className="px-6 py-3 text-right font-medium text-red-600">{fmtAmt(entry.debit_amount)}</td>
                          <td className="px-6 py-3 text-right font-medium text-green-600">{fmtAmt(entry.credit_amount)}</td>
                          <td className="px-6 py-3 text-right text-blue-600 font-medium">
                            {entry.cash_payment > 0 ? fmtAmt(entry.cash_payment) : '-'}
                          </td>
                          <td className="px-6 py-3 text-right text-purple-600 font-medium">
                            {entry.bank_payment > 0 ? fmtAmt(entry.bank_payment) : '-'}
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-blue-600">{fmtAmt(entry.closing_balance)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-8 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No transactions found for this supplier in the selected date range</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!reportData && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-12 text-center max-w-md">
              <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generate Ledger Report</h3>
              <p className="text-gray-600">Select a supplier and date range to view their ledger transactions</p>
            </div>
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
