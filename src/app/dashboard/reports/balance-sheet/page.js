'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Search, RefreshCw, Scale, TrendingUp, TrendingDown, Package, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';

export default function BalanceSheet() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customerTypes, setCustomerTypes] = useState([]);
  const [selectedCustomerType, setSelectedCustomerType] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');
  const [balanceType, setBalanceType] = useState('');

  useEffect(() => { fetchCategories(); fetchCustomerTypes(); fetchReport(); }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/customer-category');
      const data = await response.json();
      if (response.ok) setCategories(data);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchCustomerTypes = async () => {
    try {
      const response = await fetch('/api/customer-types');
      const data = await response.json();
      if (response.ok) setCustomerTypes(data);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=balance-sheet`);
      const data = await response.json();
      if (response.ok) setReportData(data);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExport = () => {
    if (!reportData) return;
    const data = getFilteredData();
    let csv = 'BALANCE SHEET\n';
    csv += `As of: ${new Date().toLocaleDateString('en-GB')}\n\n`;
    csv += 'ASSETS\n';
    csv += 'Receivables (Debit Balances)\n';
    csv += 'S.No,Account Name,Category,Balance\n';
    data.receivables.forEach((r, i) => {
      csv += `${i + 1},${r.cus_name},${r.customer_category?.cus_cat_title || '-'},${formatCurrency(r.cus_balance)}\n`;
    });
    csv += `\nTotal Receivables,${formatCurrency(data.summary.totalReceivables)}\n`;
    csv += `Stock Value,${formatCurrency(data.summary.stockValue)}\n`;
    csv += `TOTAL ASSETS,${formatCurrency(data.summary.totalAssets)}\n\n`;
    csv += 'LIABILITIES\n';
    csv += 'Payables (Credit Balances)\n';
    csv += 'S.No,Account Name,Category,Balance\n';
    data.payables.forEach((p, i) => {
      csv += `${i + 1},${p.cus_name},${p.customer_category?.cus_cat_title || '-'},${formatCurrency(Math.abs(p.cus_balance))}\n`;
    });
    csv += `\nTOTAL LIABILITIES,${formatCurrency(data.summary.totalLiabilities)}\n`;
    csv += `\nNET WORTH,${formatCurrency(data.summary.netWorth)}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getFilteredData = () => {
    if (!reportData) return null;

    let filteredReceivables = reportData.receivables;
    let filteredPayables = reportData.payables;

    // Filter by customer category
    if (selectedCategory) {
      filteredReceivables = filteredReceivables.filter(r => r.customer_category?.cus_cat_id === parseInt(selectedCategory));
      filteredPayables = filteredPayables.filter(p => p.customer_category?.cus_cat_id === parseInt(selectedCategory));
    }

    // Filter by customer type
    if (selectedCustomerType) {
      filteredReceivables = filteredReceivables.filter(r => r.customer_type?.cus_type_id === parseInt(selectedCustomerType));
      filteredPayables = filteredPayables.filter(p => p.customer_type?.cus_type_id === parseInt(selectedCustomerType));
    }

    // Filter by balance range
    if (minBalance || maxBalance) {
      const min = parseFloat(minBalance) || 0;
      const max = parseFloat(maxBalance) || Infinity;
      filteredReceivables = filteredReceivables.filter(r => {
        const balance = Math.abs(parseFloat(r.cus_balance || 0));
        return balance >= min && balance <= max;
      });
      filteredPayables = filteredPayables.filter(p => {
        const balance = Math.abs(parseFloat(p.cus_balance || 0));
        return balance >= min && balance <= max;
      });
    }

    // Filter by balance type
    if (balanceType === 'HIGH_VALUE') {
      filteredReceivables = filteredReceivables.filter(r => Math.abs(parseFloat(r.cus_balance || 0)) >= 100000);
      filteredPayables = filteredPayables.filter(p => Math.abs(parseFloat(p.cus_balance || 0)) >= 100000);
    } else if (balanceType === 'ZERO') {
      filteredReceivables = filteredReceivables.filter(r => parseFloat(r.cus_balance || 0) === 0);
      filteredPayables = filteredPayables.filter(p => parseFloat(p.cus_balance || 0) === 0);
    }

    const totalReceivables = filteredReceivables.reduce((sum, r) => sum + parseFloat(r.cus_balance || 0), 0);
    const totalPayables = Math.abs(filteredPayables.reduce((sum, p) => sum + parseFloat(p.cus_balance || 0), 0));

    return {
      ...reportData,
      receivables: filteredReceivables,
      payables: filteredPayables,
      summary: {
        ...reportData.summary,
        totalReceivables,
        receivablesCount: filteredReceivables.length,
        totalPayables,
        payablesCount: filteredPayables.length,
        totalAssets: totalReceivables + (reportData.summary.stockValue || 0),
        totalLiabilities: totalPayables,
        netWorth: (totalReceivables + (reportData.summary.stockValue || 0)) - totalPayables
      }
    };
  };

  const filteredData = getFilteredData();

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
        {/* Screen Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-6 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Balance Sheet</h1>
                  <p className="text-indigo-200 text-sm">Statement of financial position</p>
                </div>
              </div>
            </div>
            {filteredData && (
              <div className="flex items-center space-x-2">
                <button onClick={handleExport} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </button>
                <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                  <Printer className="w-4 h-4 mr-2" /> Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 caps">CATEGORY</label>
              <Autocomplete
                size="small"
                options={categories}
                getOptionLabel={(option) => option.cus_cat_title || ''}
                value={categories.find(c => c.cus_cat_id === parseInt(selectedCategory)) || null}
                onChange={(e, val) => setSelectedCategory(val ? val.cus_cat_id.toString() : '')}
                autoSelect={true}
                autoHighlight={true}
                openOnFocus={true}
                selectOnFocus={true}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="All Categories"
                    onFocus={(e) => e.target.select()}
                    sx={{
                      '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' }
                    }}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1 caps">CUSTOMER TYPE</label>
              <Autocomplete
                size="small"
                options={customerTypes}
                getOptionLabel={(option) => option.cus_type_title || ''}
                value={customerTypes.find(t => t.cus_type_id === parseInt(selectedCustomerType)) || null}
                onChange={(e, val) => setSelectedCustomerType(val ? val.cus_type_id.toString() : '')}
                autoSelect={true}
                autoHighlight={true}
                openOnFocus={true}
                selectOnFocus={true}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="All Types"
                    onFocus={(e) => e.target.select()}
                    sx={{
                      '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' }
                    }}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">BALANCE TYPE</label>
              <select value={balanceType} onChange={(e) => setBalanceType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">All Balances</option>
                <option value="HIGH_VALUE">High Value (≥100K)</option>
                <option value="ZERO">Zero Balance</option>
              </select>
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Apply'}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">MIN BALANCE</label>
              <input type="number" value={minBalance} onChange={(e) => setMinBalance(e.target.value)} placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="flex-1 min-w-[130px] max-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">MAX BALANCE</label>
              <input type="number" value={maxBalance} onChange={(e) => setMaxBalance(e.target.value)} placeholder="∞"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="flex-1"></div>
          </div>
        </div>

        {/* Report Content */}
        {filteredData ? (
          <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
            <div className="max-w-[1400px] mx-auto">
              {/* Print Header */}
              <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
                <div className="text-center">
                  <h1 className="text-2xl font-bold tracking-wider">ITTEFAQ IRON STORE</h1>
                  <p className="text-sm text-gray-600">Parianwali, Pakistan | Tel: +92 346 7560306</p>
                  <div className="mt-3 py-2 bg-black text-white">
                    <h2 className="text-lg font-bold tracking-widest">BALANCE SHEET</h2>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">As of:</span> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Summary Cards - Screen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Receivables</p>
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-blue-800 mt-1">Rs. {formatCurrency(filteredData.summary.totalReceivables)}</p>
                  <p className="text-xs text-blue-600 mt-1">{filteredData.summary.receivablesCount} accounts</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Stock Value</p>
                    <Package className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-purple-800 mt-1">Rs. {formatCurrency(filteredData.summary.stockValue)}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Payables</p>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-800 mt-1">Rs. {formatCurrency(filteredData.summary.totalLiabilities)}</p>
                  <p className="text-xs text-red-600 mt-1">{filteredData.summary.payablesCount} accounts</p>
                </div>
                <div className={`bg-gradient-to-br ${filteredData.summary.netWorth >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-orange-50 to-orange-100 border-orange-200'} border rounded-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${filteredData.summary.netWorth >= 0 ? 'text-emerald-600' : 'text-orange-600'} uppercase tracking-wide`}>Net Worth</p>
                    <Wallet className={`w-4 h-4 ${filteredData.summary.netWorth >= 0 ? 'text-emerald-500' : 'text-orange-500'}`} />
                  </div>
                  <p className={`text-2xl font-bold ${filteredData.summary.netWorth >= 0 ? 'text-emerald-800' : 'text-orange-800'} mt-1`}>Rs. {formatCurrency(filteredData.summary.netWorth)}</p>
                </div>
              </div>

              {/* Assets & Liabilities Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Assets Section */}
                <div className="bg-white border-2 border-slate-300 rounded-lg overflow-hidden print:border-black">
                  <div className="bg-slate-800 text-white px-4 py-2 print:bg-gray-200 print:text-black">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Assets</h3>
                  </div>

                  {/* Receivables Table */}
                  <div className="p-3">
                    <div className="bg-slate-100 px-3 py-1 rounded mb-2 print:bg-white">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Accounts Receivable (Debit Balances)</h4>
                    </div>
                    <div className="max-h-60 overflow-auto print:max-h-none">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-300 print:border-black">
                            <th className="px-2 py-2 text-left text-xs font-bold text-slate-700 uppercase">S.No</th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-slate-700 uppercase">Account Name</th>
                            <th className="px-2 py-2 text-right text-xs font-bold text-slate-700 uppercase">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredData.receivables.map((account, index) => (
                            <tr key={account.cus_id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5 text-slate-700">{index + 1}</td>
                              <td className="px-2 py-1.5 text-slate-900 font-medium">{account.cus_name}</td>
                              <td className="px-2 py-1.5 text-right text-slate-900 tabular-nums">{formatCurrency(account.cus_balance)}</td>
                            </tr>
                          ))}
                          {filteredData.receivables.length === 0 && (
                            <tr><td colSpan="3" className="px-2 py-4 text-center text-slate-500">No receivable accounts</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 pt-2 border-t-2 border-slate-300 flex justify-between text-sm print:border-black">
                      <span className="font-semibold text-slate-700">Total Receivables</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(filteredData.summary.totalReceivables)}</span>
                    </div>
                  </div>

                  {/* Stock Value */}
                  <div className="px-3 pb-3">
                    <div className="flex justify-between py-2 px-3 bg-slate-50 rounded print:bg-white">
                      <span className="text-sm font-semibold text-slate-700">Inventory / Stock Value</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(filteredData.summary.stockValue)}</span>
                    </div>
                  </div>

                  {/* Total Assets */}
                  <div className="bg-slate-800 text-white px-4 py-3 print:bg-gray-200 print:text-black">
                    <div className="flex justify-between">
                      <span className="font-bold uppercase tracking-wide">Total Assets</span>
                      <span className="font-bold tabular-nums">{formatCurrency(filteredData.summary.totalAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities Section */}
                <div className="bg-white border-2 border-slate-300 rounded-lg overflow-hidden print:border-black">
                  <div className="bg-slate-800 text-white px-4 py-2 print:bg-gray-200 print:text-black">
                    <h3 className="text-sm font-bold uppercase tracking-wide">Liabilities</h3>
                  </div>

                  {/* Payables Table */}
                  <div className="p-3">
                    <div className="bg-slate-100 px-3 py-1 rounded mb-2 print:bg-white">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Accounts Payable (Credit Balances)</h4>
                    </div>
                    <div className="max-h-60 overflow-auto print:max-h-none">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-300 print:border-black">
                            <th className="px-2 py-2 text-left text-xs font-bold text-slate-700 uppercase">S.No</th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-slate-700 uppercase">Account Name</th>
                            <th className="px-2 py-2 text-right text-xs font-bold text-slate-700 uppercase">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredData.payables.map((account, index) => (
                            <tr key={account.cus_id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5 text-slate-700">{index + 1}</td>
                              <td className="px-2 py-1.5 text-slate-900 font-medium">{account.cus_name}</td>
                              <td className="px-2 py-1.5 text-right text-slate-900 tabular-nums">{formatCurrency(Math.abs(account.cus_balance))}</td>
                            </tr>
                          ))}
                          {filteredData.payables.length === 0 && (
                            <tr><td colSpan="3" className="px-2 py-4 text-center text-slate-500">No payable accounts</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 pt-2 border-t-2 border-slate-300 flex justify-between text-sm print:border-black">
                      <span className="font-semibold text-slate-700">Total Payables</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(filteredData.summary.totalPayables)}</span>
                    </div>
                  </div>

                  {/* Placeholder for symmetry */}
                  <div className="px-3 pb-3 invisible">
                    <div className="py-2 px-3 bg-slate-50 rounded">
                      <span className="text-sm">&nbsp;</span>
                    </div>
                  </div>

                  {/* Total Liabilities */}
                  <div className="bg-slate-800 text-white px-4 py-3 print:bg-gray-200 print:text-black">
                    <div className="flex justify-between">
                      <span className="font-bold uppercase tracking-wide">Total Liabilities</span>
                      <span className="font-bold tabular-nums">{formatCurrency(filteredData.summary.totalLiabilities)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Worth Summary Box */}
              <div className="bg-white border-2 border-indigo-400 rounded-lg overflow-hidden print:border-black">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-700">Total Assets</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(filteredData.summary.totalAssets)}</td>
                    </tr>
                    <tr className="border-b-2 border-slate-300">
                      <td className="px-4 py-3 font-semibold text-slate-700">Less: Total Liabilities</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 print:text-black tabular-nums">({formatCurrency(filteredData.summary.totalLiabilities)})</td>
                    </tr>
                    <tr className="bg-indigo-800 text-white print:bg-gray-200 print:text-black">
                      <td className="px-4 py-4 font-bold text-lg uppercase tracking-wide">Net Worth / Equity</td>
                      <td className="px-4 py-4 text-right font-bold text-xl tabular-nums">{formatCurrency(filteredData.summary.netWorth)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Quick Stats - Screen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 print:hidden">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total Sales</p>
                  <p className="text-lg font-bold text-slate-800">Rs. {formatCurrency(filteredData.summary.totalSalesAmount)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total Purchases</p>
                  <p className="text-lg font-bold text-slate-800">Rs. {formatCurrency(filteredData.summary.totalPurchaseAmount)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Total Expenses</p>
                  <p className="text-lg font-bold text-slate-800">Rs. {formatCurrency(filteredData.summary.totalExpensesAmount)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Gross Margin</p>
                  <p className="text-lg font-bold text-slate-800">Rs. {formatCurrency((filteredData.summary.totalSalesAmount || 0) - (filteredData.summary.totalPurchaseAmount || 0))}</p>
                </div>
              </div>

              {/* Print Footer */}
              <div className="hidden print:flex justify-between items-center mt-6 pt-4 border-t-2 border-black text-xs">
                <span>Generated: {new Date().toLocaleString('en-GB')}</span>
                <span className="font-semibold">Ittefaq Management System</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center print:hidden">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Loading Balance Sheet...</h3>
              <p className="text-slate-500 mt-1">Please wait while data is being fetched</p>
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
