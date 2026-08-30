'use client';

import { useState, useEffect } from 'react';
import { 
  Download,
  Printer,
  ArrowLeft,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CustomersBalanceReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=customers-balance`);
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
    csv += 'Customers Balance Report\n';
    csv += `Generated on: ${new Date().toLocaleString()}\n\n`;
    csv += 'Customer Name,Phone,City,Category,Type,Current Balance,Status\n';
    
    reportData.customers.forEach(customer => {
      const balance = parseFloat(customer.cus_balance);
      const status = balance > 0 ? 'Receivable' : balance < 0 ? 'Payable' : 'Zero';
      csv += `${customer.cus_name},${customer.cus_phone_no || ''},${customer.city?.city_name || ''},${customer.customer_category?.cus_cat_title || ''},${customer.customer_type?.cus_type_title || ''},${fmtAmt(balance)},${status}\n`;
    });

    csv += '\n';
    csv += `TOTAL,,,,,${fmtAmt(reportData.summary.totalBalance)},\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-balance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div id="printable-report" className="h-full flex flex-col overflow-hidden print:overflow-visible">
        {/* Header */}
        <div className="flex-shrink-0 mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard/reports')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Customers Balance Report</h2>
                <p className="text-gray-600 mt-1">View all customers with their current balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {reportData && (
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
        )}

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
                  <h2 className="text-2xl font-semibold text-gray-800">Customers Balance Report</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated on: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 print:min-h-0 print:block">
              <div className="bg-white rounded-lg shadow print:shadow-none print:border print:border-gray-300 h-full flex flex-col print:block">
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Customer Balances</h3>
                </div>
                
                <div className="flex-1 overflow-auto print:overflow-visible print:block">
                  <table className="min-w-full divide-y divide-gray-200 print:block print:table">
                    <thead className="bg-gray-50 sticky top-0 print:relative">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.customers.map((customer) => {
                        const balance = parseFloat(customer.cus_balance);
                        const status = balance > 0 ? 'Receivable' : balance < 0 ? 'Payable' : 'Zero';
                        const statusColor = balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600';
                        
                        return (
                          <tr key={customer.cus_id} className="hover:bg-gray-50 print:hover:bg-white">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {customer.cus_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {customer.cus_phone_no || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {customer.city?.city_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {customer.customer_category?.cus_cat_title || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {customer.customer_type?.cus_type_title || 'N/A'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${statusColor}`}>
                              {fmtAmt(balance)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                balance > 0 ? 'bg-green-100 text-green-800' : 
                                balance < 0 ? 'bg-red-100 text-red-800' : 
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-right text-sm text-gray-900">TOTAL:</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {fmtAmt(reportData.summary.totalBalance)}
                        </td>
                        <td></td>
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
