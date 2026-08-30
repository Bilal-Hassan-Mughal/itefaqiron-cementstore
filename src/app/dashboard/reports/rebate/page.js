'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Download,
    Printer,
    ArrowLeft,
    ShoppingBag,
    Search,
    Filter,
    Plus,
    X,
    Save,
    Percent,
    Tag,
    Layers,
    DollarSign,
    Gift,
    TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField } from '@mui/material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function RebateReport() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');

    // Rebate Dialog State
    const [isRebateOpen, setIsRebateOpen] = useState(false);
    const [rebateRate, setRebateRate] = useState('');
    const [savingRebate, setSavingRebate] = useState(false);

    // Set default dates and fetch suppliers
    useEffect(() => {
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);

        setStartDate(oneMonthAgo.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
        fetchSuppliers();
    }, []);

    // Auto-fetch report when filters change
    useEffect(() => {
        if (selectedSupplierId && startDate && endDate) {
            fetchReport();
        } else {
            setReportData(null);
        }
    }, [selectedSupplierId, startDate, endDate]);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/customers?dropdown=true');
            const data = await response.json();
            if (response.ok) {
                setSuppliers(data);
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchReport = async () => {
        if (!selectedSupplierId || !startDate || !endDate) {
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/reports?type=rebate-report&supplierId=${selectedSupplierId}&startDate=${startDate}&endDate=${endDate}`);
            const data = await response.json();

            if (response.ok) {
                setReportData(data);
            } else {
                alert(data.error || 'Error fetching report');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error fetching report');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRebate = async () => {
        if (!reportData || !rebateRate) return;

        const totalQty = reportData.summary.totalQuantity;
        const rate = parseFloat(rebateRate) || 0;
        const totalAmount = parseFloat((totalQty * rate).toFixed(2));

        if (totalAmount <= 0) {
            alert('Please enter a valid rate');
            return;
        }

        try {
            setSavingRebate(true);
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;

            const billNo = `REB-${Date.now()}`;
            const ledgerEntry = {
                cus_id: parseInt(selectedSupplierId),
                debit_amount: totalAmount,
                credit_amount: 0,
                bill_no: billNo,
                trnx_type: 'REBATE',
                ledger_type: 'Rebate',
                details: `Rebate | ${reportData.summary.supplierName} | From: ${startDate} To: ${endDate} | Qty: ${fmtAmt(totalQty)} | Rate: ${fmtAmt(rate)} | Amt: ${fmtAmt(totalAmount)}`,
                updated_by: user?.user_id ? parseInt(user.user_id) : (user?.id ? parseInt(user.id) : null)
            };

            const response = await fetch('/api/ledger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ledgerEntry)
            });

            if (response.ok) {
                const saved = await response.json();
                const newBal = parseFloat(saved.closing_balance || 0);
                alert(`Rebate of PKR ${fmtAmt(totalAmount)} saved!\nSupplier balance updated to PKR ${fmtAmt(newBal)}`);
                setIsRebateOpen(false);
                setRebateRate('');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error saving rebate:', error);
            alert('Failed to save rebate');
        } finally {
            setSavingRebate(false);
        }
    };

    const handlePrint = () => window.print();

    const handleExport = () => {
        if (!reportData) return;

        let csv = 'Ittefaq Iron and Cement Store\n';
        csv += 'Rebate Report\n';
        csv += `Supplier: ${reportData.summary.supplierName}\n`;
        csv += `From: ${startDate} To: ${endDate}\n\n`;
        csv += 'Product,Purchases,Unit,Total Quantity,Total Amount,Avg Rate\n';

        reportData.products.forEach(p => {
            csv += `"${p.pro_title}",${p.purchase_count},${p.unit},${fmtAmt(p.total_quantity)},${fmtAmt(p.total_amount)},${fmtAmt(p.avg_rate)}\n`;
        });

        csv += '\n';
        csv += `TOTAL,,${reportData.summary.productCount} Products,${fmtAmt(reportData.summary.totalQuantity)},${fmtAmt(reportData.summary.totalAmount)},\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rebate-report-${reportData.summary.supplierName}-${startDate}-to-${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const rebateTotalAmount = reportData ? Number((reportData.summary.totalQuantity * (parseFloat(rebateRate) || 0)).toFixed(2)) : 0;

    const supplierOptions = useMemo(() => {
        const list = suppliers.filter(s => s.customer_category?.cus_cat_title?.toLowerCase().includes('supplier'));
        return list.length > 0 ? list : suppliers;
    }, [suppliers]);

    const formatCurrency = (amount) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
    };

    return (
        <DashboardLayout>
            <div id="printable-report" className="h-full flex flex-col bg-white print:bg-white overflow-hidden">
                {/* Header Banner */}
                <div className="flex-shrink-0 bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white px-6 py-4 print:hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                                    <Gift className="w-6 h-6 text-indigo-300" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-wide">Rebate Report</h1>
                                    <p className="text-indigo-200 text-sm">Supplier product purchases & rebate calculation</p>
                                </div>
                            </div>
                        </div>
                        {reportData && (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setIsRebateOpen(true)}
                                    className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all transform active:scale-95"
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Add Rebate
                                </button>
                                <button onClick={handleExport} className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
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
                <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-3.5 print:hidden">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[260px] max-w-[340px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">SELECT SUPPLIER</label>
                            <Autocomplete
                                size="small"
                                options={supplierOptions}
                                getOptionLabel={(option) => option.cus_name ? `${option.cus_name}${option.customer_category?.cus_cat_title ? ` (${option.customer_category.cus_cat_title})` : ''}` : ''}
                                value={suppliers.find(s => s.cus_id.toString() === selectedSupplierId) || null}
                                onChange={(event, newValue) => {
                                    setSelectedSupplierId(newValue ? newValue.cus_id.toString() : '');
                                }}
                                isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                                autoSelect={true}
                                autoHighlight={true}
                                openOnFocus={true}
                                selectOnFocus={true}
                                filterOptions={(options, { inputValue }) => {
                                    const q = inputValue.toLowerCase().trim();
                                    if (!q) return options;
                                    return options.filter(o =>
                                        (o.cus_name || '').toLowerCase().includes(q) ||
                                        (o.customer_category?.cus_cat_title || '').toLowerCase().includes(q) ||
                                        (o.cus_phone_no || '').toLowerCase().includes(q) ||
                                        (o.cus_address || '').toLowerCase().includes(q)
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Type to search supplier..."
                                        variant="outlined"
                                        onFocus={(e) => e.target.select()}
                                        sx={{
                                            bgcolor: 'white',
                                            borderRadius: '8px',
                                            '& .MuiOutlinedInput-root': { py: '2px', borderRadius: '8px', bgcolor: 'white' },
                                            '& .MuiInputBase-input': { fontWeight: 'bold', color: 'black' }
                                        }}
                                    />
                                )}
                            />
                        </div>
                        <div className="flex-1 min-w-[150px] max-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">FROM DATE</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px] max-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">TO DATE</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <button
                            onClick={fetchReport}
                            disabled={loading || !selectedSupplierId}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-semibold transition-colors min-w-[140px]"
                        >
                            {loading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                {reportData ? (
                    <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
                        <div className="max-w-[1200px] mx-auto">
                            {/* Print Header */}
                            <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold tracking-wider">ITTEFAQ IRON STORE</h1>
                                    <p className="text-sm text-gray-600">Parianwali, Pakistan | Tel: +92 346 7560306</p>
                                    <div className="mt-3 py-2 bg-black text-white">
                                        <h2 className="text-lg font-bold tracking-widest">REBATE REPORT</h2>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 text-sm border-t border-b border-black py-1">
                                        <span>Supplier: <strong>{reportData.summary.supplierName}</strong></span>
                                        <span>Period: {formatDate(startDate)} to {formatDate(endDate)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary KPI Cards (4 Cards Grid - Screen) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
                                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Supplier</p>
                                        <Tag className="w-4 h-4 text-indigo-500" />
                                    </div>
                                    <p className="text-xl font-bold text-indigo-900 mt-1 truncate">{reportData.summary.supplierName}</p>
                                    <p className="text-xs text-indigo-600/70 mt-0.5">Selected Account</p>
                                </div>
                                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Products</p>
                                        <Layers className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800 mt-1">{reportData.summary.productCount}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Purchased items</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Quantity</p>
                                        <ShoppingBag className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <p className="text-2xl font-bold text-blue-900 mt-1">{fmtAmt(reportData.summary.totalQuantity)}</p>
                                    <p className="text-xs text-blue-600/70 mt-0.5">Aggregated units</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Amount</p>
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <p className="text-2xl font-bold text-emerald-900 mt-1">Rs. {formatCurrency(reportData.summary.totalAmount)}</p>
                                    <p className="text-xs text-emerald-600/70 mt-0.5">Total purchase value</p>
                                </div>
                            </div>

                            {/* Print Summary */}
                            <div className="hidden print:block mb-4 border border-black">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="p-2 font-semibold border-r border-black w-1/4">Supplier Name:</td>
                                            <td className="p-2 border-r border-black w-1/4 font-bold">{reportData.summary.supplierName}</td>
                                            <td className="p-2 font-semibold border-r border-black w-1/4">Total Products:</td>
                                            <td className="p-2 text-right w-1/4 font-bold">{reportData.summary.productCount}</td>
                                        </tr>
                                        <tr className="border-t border-black">
                                            <td className="p-2 font-semibold border-r border-black">Total Quantity:</td>
                                            <td className="p-2 border-r border-black font-bold">{fmtAmt(reportData.summary.totalQuantity)}</td>
                                            <td className="p-2 font-semibold border-r border-black">Total Amount:</td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(reportData.summary.totalAmount)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Container (Screen View) */}
                            <div className="bg-white border border-slate-300 rounded-xl overflow-hidden print:hidden shadow-sm">
                                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Purchased Products Summary</h3>
                                    <span className="text-xs text-slate-500 font-medium">Aggregated per product for selected period</span>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-800 text-white">
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600 w-12">S.No</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-slate-600">Product Title</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-600 w-24">Unit</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-slate-600 w-28">Purchases</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 w-36">Total Quantity</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-slate-600 w-40">Total Amount (PKR)</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider w-36">Avg Rate (PKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {reportData.products.map((p, index) => (
                                            <tr key={p.pro_id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40 transition-colors`}>
                                                <td className="px-4 py-3 text-slate-700 border-r border-slate-200 text-center font-medium">{index + 1}</td>
                                                <td className="px-4 py-3 text-slate-900 border-r border-slate-200 font-semibold">{p.pro_title}</td>
                                                <td className="px-4 py-3 text-center text-slate-600 border-r border-slate-200 font-medium">{p.unit || '-'}</td>
                                                <td className="px-4 py-3 text-center text-slate-600 border-r border-slate-200 font-medium">{p.purchase_count}</td>
                                                <td className="px-4 py-3 text-right font-bold text-blue-700 border-r border-slate-200 tabular-nums">{fmtAmt(p.total_quantity)}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-slate-900 border-r border-slate-200 tabular-nums">{formatCurrency(p.total_amount)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 tabular-nums font-medium">{fmtAmt(p.avg_rate)}</td>
                                            </tr>
                                        ))}

                                        {reportData.products.length === 0 && (
                                            <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">No purchase transactions found for this supplier in the selected date range.</td></tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-800 text-white font-bold">
                                            <td colSpan="4" className="px-4 py-3 text-right uppercase text-xs tracking-wider border-r border-slate-600">Grand Total</td>
                                            <td className="px-4 py-3 text-right border-r border-slate-600 tabular-nums text-blue-300 text-base">{fmtAmt(reportData.summary.totalQuantity)}</td>
                                            <td className="px-4 py-3 text-right border-r border-slate-600 tabular-nums text-emerald-300 text-base">Rs. {formatCurrency(reportData.summary.totalAmount)}</td>
                                            <td className="px-4 py-3 text-right text-slate-400">—</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* PRINT TABLE */}
                            <div className="hidden print:block bg-white border border-black">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-200 text-black">
                                            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider border-r border-black w-12">S.No</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider border-r border-black">Product</th>
                                            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-r border-black w-20">Unit</th>
                                            <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-r border-black w-24">Purchases</th>
                                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider border-r border-black w-32">Total Qty</th>
                                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider border-r border-black w-36">Total Amount</th>
                                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider w-28">Avg Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black">
                                        {reportData.products.map((p, index) => (
                                            <tr key={p.pro_id} className="bg-white">
                                                <td className="px-3 py-2 text-black border-r border-black">{index + 1}</td>
                                                <td className="px-3 py-2 text-black font-semibold border-r border-black">{p.pro_title}</td>
                                                <td className="px-3 py-2 text-center text-black border-r border-black">{p.unit || '-'}</td>
                                                <td className="px-3 py-2 text-center text-black border-r border-black">{p.purchase_count}</td>
                                                <td className="px-3 py-2 text-right font-bold text-black border-r border-black tabular-nums">{fmtAmt(p.total_quantity)}</td>
                                                <td className="px-3 py-2 text-right text-black border-r border-black tabular-nums">{formatCurrency(p.total_amount)}</td>
                                                <td className="px-3 py-2 text-right text-black tabular-nums">{fmtAmt(p.avg_rate)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-200 text-black font-bold">
                                            <td colSpan="4" className="px-3 py-2 text-right uppercase text-xs tracking-wider border-r border-black">Grand Total</td>
                                            <td className="px-3 py-2 text-right border-r border-black tabular-nums text-base">{fmtAmt(reportData.summary.totalQuantity)}</td>
                                            <td className="px-3 py-2 text-right border-r border-black tabular-nums text-base">{formatCurrency(reportData.summary.totalAmount)}</td>
                                            <td className="px-3 py-2 text-right">—</td>
                                        </tr>
                                    </tfoot>
                                </table>
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
                    <div className="flex-1 flex items-center justify-center p-6 print:hidden">
                        <div className="text-center bg-white border border-slate-200 rounded-2xl p-10 max-w-md shadow-sm">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                                <Gift className="w-10 h-10 text-indigo-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">No Supplier Selected</h3>
                            <p className="text-slate-500 text-sm mt-1">Select a supplier from the top dropdown and click <strong>Generate Report</strong> to calculate rebate metrics.</p>
                        </div>
                    </div>
                )}

                {/* Rebate Dialog / Modal */}
                {isRebateOpen && reportData && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-slate-200">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-indigo-700 to-violet-800 px-6 py-4 flex items-center justify-between text-white">
                                <div className="flex items-center space-x-2.5">
                                    <Gift className="w-5 h-5 text-indigo-200" />
                                    <h3 className="text-lg font-bold">Add Rebate to Ledger</h3>
                                </div>
                                <button onClick={() => setIsRebateOpen(false)} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Supplier Account</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold text-base shadow-inner">
                                        {reportData.summary.supplierName}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Total Quantity (Aggregated)</label>
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-900 font-bold text-xl shadow-inner">
                                        {fmtAmt(reportData.summary.totalQuantity)} <span className="text-sm font-semibold text-blue-600">units</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rate (Per Unit)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={rebateRate}
                                            onChange={(e) => setRebateRate(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && rebateRate && parseFloat(rebateRate) > 0) {
                                                    handleSaveRebate();
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold text-lg text-slate-900"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Total Rebate (PKR)</label>
                                        <div className="w-full px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-lg shadow-inner">
                                            {formatCurrency(rebateTotalAmount)}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleSaveRebate}
                                        disabled={savingRebate || !rebateRate || parseFloat(rebateRate) <= 0}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white px-6 py-3.5 rounded-xl font-bold text-base shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
                                    >
                                        {savingRebate ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                <span>Save to Supplier Ledger</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
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
