'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import {
    Download,
    Printer,
    ArrowLeft,
    Plus,
    X,
    Save,
    Tag,
    Layers,
    Gift,
    Calendar,
    ChevronDown,
    ChevronRight,
    Receipt,
    History,
    Wallet,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import { Autocomplete, TextField } from '@mui/material';
import {
  fmtAmt,
  formatCurrency,
  formatDate,
  getCurrentMonthKey,
  getUnpaidRebateMonths,
  buildFullMonthOptions,
  customerOptionKey,
  isSameCustomerOption,
  rebateEntryKey,
  RebateStatusBadge,
} from '@/lib/rebate-utils';
import RebateMonthSelect from './components/rebate-month-select';
import {
  REBATE_THEME,
  REBATE_GRID,
  REBATE_FIELD_SX,
  rebateKpiCard,
  rebateBtnPrimary,
} from '@/lib/rebate-theme';
import { BRAND } from '@/lib/brand-theme';

const StatusBadge = RebateStatusBadge;

function RebateReportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [monthlyData, setMonthlyData] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [activeTab, setActiveTab] = useState('products');
    const [expandedPurchaseId, setExpandedPurchaseId] = useState(null);

    const [isRebateOpen, setIsRebateOpen] = useState(false);
    const [rebateRate, setRebateRate] = useState('');
    const [rebateManualQty, setRebateManualQty] = useState('');
    const [savingRebate, setSavingRebate] = useState(false);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    useEffect(() => {
        const supplierParam = searchParams.get('supplierId');
        const monthParam = searchParams.get('month');
        if (supplierParam) setSelectedSupplierId(supplierParam);
        if (monthParam) setSelectedMonth(monthParam);
    }, [searchParams]);

    useEffect(() => {
        if (!selectedSupplierId) {
            setMonthlyData(null);
            setReportData(null);
            return;
        }
        fetchMonthlyOverview();
    }, [selectedSupplierId]);

    const monthOptions = useMemo(
        () => buildFullMonthOptions(monthlyData?.monthlyBreakdown || []),
        [monthlyData]
    );

    const unpaidMonthOptions = useMemo(
        () => getUnpaidRebateMonths(monthOptions),
        [monthOptions]
    );

    useEffect(() => {
        if (!selectedSupplierId || !selectedMonth) {
            setReportData(null);
            return;
        }
        fetchMonthDetail();
    }, [selectedSupplierId, selectedMonth]);

    useEffect(() => {
        setRebateRate('');
        setRebateManualQty('');
        setIsRebateOpen(false);
    }, [selectedSupplierId, selectedMonth]);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch('/api/customers?dropdown=true');
            const data = await response.json();
            if (response.ok) setSuppliers(data);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchMonthlyOverview = async () => {
        if (!selectedSupplierId) return;
        try {
            setLoadingMonthly(true);
            const response = await fetch(
                `/api/reports?type=rebate-report&supplierId=${selectedSupplierId}&view=monthly`
            );
            const data = await response.json();
            if (response.ok) {
                setMonthlyData(data);
            } else {
                alert(data.error || 'Error fetching monthly overview');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error fetching monthly overview');
        } finally {
            setLoadingMonthly(false);
        }
    };

    const fetchMonthDetail = async () => {
        if (!selectedSupplierId || !selectedMonth) return;
        try {
            setLoadingDetail(true);
            const response = await fetch(
                `/api/reports?type=rebate-report&supplierId=${selectedSupplierId}&month=${selectedMonth}`
            );
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
            setLoadingDetail(false);
        }
    };

    const handleSaveRebate = async () => {
        if (!reportData || !rebateRate) return;

        const totalQty = effectiveRebateQty;
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
            const monthLabel = reportData.summary.monthLabel || selectedMonth;

            const billNo = `REB-${Date.now()}`;
            const ledgerEntry = {
                cus_id: parseInt(selectedSupplierId),
                debit_amount: totalAmount,
                credit_amount: 0,
                bill_no: billNo,
                trnx_type: 'REBATE',
                ledger_type: 'Rebate',
                details: `Rebate | ${reportData.summary.supplierName} | MonthKey: ${selectedMonth} | Month: ${monthLabel} | Qty: ${fmtAmt(totalQty)} | Rate: ${fmtAmt(rate)} | Amt: ${fmtAmt(totalAmount)}`,
                updated_by: user?.user_id ? parseInt(user.user_id) : (user?.id ? parseInt(user.id) : null),
            };

            const response = await fetch('/api/ledger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ledgerEntry),
            });

            if (response.ok) {
                const saved = await response.json();
                const newBal = parseFloat(saved.closing_balance || 0);
                alert(`Rebate of PKR ${fmtAmt(totalAmount)} saved!\nSupplier balance updated to PKR ${fmtAmt(newBal)}`);
                setIsRebateOpen(false);
                setRebateRate('');
                setRebateManualQty('');
                fetchMonthlyOverview();
                fetchMonthDetail();
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

        const monthLabel = reportData.summary.monthLabel || selectedMonth;
        let csv = 'Ittefaq Iron and Cement Store\n';
        csv += 'Rebate Report\n';
        csv += `Supplier: ${reportData.summary.supplierName}\n`;
        csv += `Month: ${monthLabel}\n\n`;
        csv += 'Product,Purchases,Total Quantity,Total Amount,Avg Rate\n';

        reportData.products.forEach((p) => {
            csv += `"${p.pro_title}",${p.purchase_count},${fmtAmt(p.total_quantity)},${fmtAmt(p.total_amount)},${fmtAmt(p.avg_rate)}\n`;
        });

        csv += '\nPurchase Bills\n';
        csv += 'Date,Invoice,Items,Total Qty,Net Total\n';
        reportData.purchases.forEach((p) => {
            csv += `${formatDate(p.created_at)},"${p.invoice_number}",${p.item_count},${fmtAmt(p.total_qty)},${fmtAmt(p.net_total)}\n`;
        });

        csv += '\n';
        csv += `TOTAL,,${reportData.summary.productCount} Products,${fmtAmt(reportData.summary.totalQuantity)},${fmtAmt(reportData.summary.totalAmount)},\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rebate-report-${reportData.summary.supplierName}-${selectedMonth}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const effectiveRebateQty = useMemo(() => {
        if (!reportData) return 0;
        const fromPurchases = parseFloat(reportData.summary.totalQuantity) || 0;
        if (fromPurchases > 0) return fromPurchases;
        return parseFloat(rebateManualQty) || 0;
    }, [reportData, rebateManualQty]);

    const rebateTotalAmount = Number((effectiveRebateQty * (parseFloat(rebateRate) || 0)).toFixed(2));

    const supplierOptions = useMemo(() => {
        const list = suppliers.filter((s) => s.customer_category?.cus_cat_title?.toLowerCase().includes('supplier'));
        return list.length > 0 ? list : suppliers;
    }, [suppliers]);

    const selectedSupplier = suppliers.find((s) => s.cus_id.toString() === selectedSupplierId) || null;
    const selectedMonthRow = monthOptions.find((row) => row.month === selectedMonth);
    const isLoading = loadingMonthly || loadingDetail;

    const canAddRebate = Boolean(
        selectedSupplierId && selectedMonth && reportData && !isLoading
    );

    const historySummary = useMemo(() => {
        const rows = monthlyData?.monthlyBreakdown || [];
        return {
            unpaid: rows.filter((row) => row.status === 'unpaid').length,
        };
    }, [monthlyData]);

    const goToRebateHistory = () => {
        if (!selectedSupplierId) return;
        router.push(`/dashboard/reports/rebate/history?supplierId=${selectedSupplierId}`);
    };

    const tabs = [
        { id: 'products', label: 'Product Summary', icon: Layers },
        { id: 'purchases', label: 'Purchase Bills', icon: Receipt },
        { id: 'rebates', label: 'Rebate History', icon: History },
    ];

    return (
        <DashboardLayout>
            <div id="printable-report" className="h-full flex flex-col print:bg-white overflow-hidden" style={{ backgroundColor: REBATE_THEME.pageBg }}>
                {/* Header */}
                <div className="flex-shrink-0 text-white px-6 py-4 print:hidden" style={{ background: REBATE_THEME.headerGradient }}>
                    <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center space-x-4">
                            <button onClick={() => router.push('/dashboard/reports')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center space-x-3">
                                <div className="p-2 rounded-xl border border-white/25" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                                    <Gift className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-wide">Rebate Report</h1>
                                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>Monthly supplier purchases & rebate calculation</p>
                                </div>
                            </div>
                        </div>
                        {(canAddRebate || (reportData && reportData.summary.purchaseCount > 0)) && (
                            <div className="flex items-center flex-wrap gap-2">
                                {canAddRebate && (
                                    <button
                                        type="button"
                                        onClick={() => setIsRebateOpen(true)}
                                        className={rebateBtnPrimary()}
                                        style={{ background: `linear-gradient(135deg, ${BRAND.supporting.green}, ${BRAND.text.green})` }}
                                    >
                                        <Plus className="w-4 h-4" /> Add Rebate
                                    </button>
                                )}
                                {reportData && reportData.summary.purchaseCount > 0 && (
                                    <>
                                        <button type="button" onClick={handleExport} className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
                                            <Download className="w-4 h-4 mr-2" /> Export CSV
                                        </button>
                                        <button type="button" onClick={handlePrint} className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
                                            <Printer className="w-4 h-4 mr-2" /> Print
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className={`flex-shrink-0 ${REBATE_THEME.card} border-x-0 border-t-0 rounded-none px-6 py-4 print:hidden`}>
                    <div className={REBATE_GRID.filterBar}>
                        <div className={REBATE_GRID.filterMonth}>
                            <label className={REBATE_THEME.label}>Select Month</label>
                            <RebateMonthSelect
                                value={selectedMonth}
                                onChange={(monthKey) => {
                                    setSelectedMonth(monthKey);
                                    setExpandedPurchaseId(null);
                                }}
                                monthOptions={monthOptions}
                                loading={loadingMonthly}
                                disabled={!selectedSupplierId}
                            />
                        </div>
                        <div className={REBATE_GRID.filterSupplier}>
                            <label className={REBATE_THEME.label}>Select Account / Supplier</label>
                            <Autocomplete
                                size="small"
                                options={supplierOptions}
                                getOptionLabel={(option) =>
                                    option.cus_name
                                        ? `${option.cus_name}${option.customer_category?.cus_cat_title ? ` (${option.customer_category.cus_cat_title})` : ''}`
                                        : ''
                                }
                                getOptionKey={customerOptionKey}
                                isOptionEqualToValue={isSameCustomerOption}
                                value={selectedSupplier}
                                onChange={(event, newValue) => {
                                    setSelectedSupplierId(newValue ? newValue.cus_id.toString() : '');
                                    setSelectedMonth(getCurrentMonthKey());
                                    setExpandedPurchaseId(null);
                                }}
                                autoSelect
                                autoHighlight
                                openOnFocus
                                selectOnFocus
                                filterOptions={(options, { inputValue }) => {
                                    const q = inputValue.toLowerCase().trim();
                                    if (!q) return options;
                                    return options.filter((o) =>
                                        (o.cus_name || '').toLowerCase().includes(q) ||
                                        (o.customer_category?.cus_cat_title || '').toLowerCase().includes(q) ||
                                        (o.cus_phone_no || '').toLowerCase().includes(q)
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Search supplier account..."
                                        sx={REBATE_FIELD_SX}
                                    />
                                )}
                            />
                        </div>
                        {selectedSupplier && (
                            <>
                                <div className={REBATE_GRID.filterBalance}>
                                    <p className={REBATE_THEME.label} style={{ marginBottom: '0.25rem' }}>Account Balance</p>
                                    <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: BRAND.text.green }}>
                                        PKR {formatCurrency(Math.abs(selectedSupplier.cus_balance || 0))}
                                    </p>
                                </div>
                                <div className={REBATE_GRID.filterAction}>
                                    <button
                                        type="button"
                                        onClick={goToRebateHistory}
                                        className={`${rebateBtnPrimary('w-full md:w-auto')} whitespace-nowrap`}
                                        style={{ background: `linear-gradient(135deg, ${BRAND.supporting.periwinkle}, ${BRAND.primary.blue})` }}
                                    >
                                        <History className="w-4 h-4 shrink-0" />
                                        Rebate History
                                        {historySummary.unpaid > 0 && (
                                            <span
                                                className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                                                style={{ backgroundColor: BRAND.tint.pink, color: BRAND.text.pink }}
                                            >
                                                {historySummary.unpaid} unpaid
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {!selectedSupplierId ? (
                    <div className="flex-1 flex items-center justify-center p-6 print:hidden">
                        <div className="text-center bg-white border border-slate-200 rounded-2xl p-10 max-w-md shadow-sm">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border" style={{ backgroundColor: BRAND.tint.blue, borderColor: `${BRAND.primary.blue}25` }}>
                                <Gift className="w-10 h-10" style={{ color: BRAND.primary.blue }} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Select a Supplier Account</h3>
                            <p className="text-slate-500 text-sm mt-2">Choose a supplier to view monthly purchase totals and rebate details.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-4 md:p-5 print:p-0 print:overflow-visible">
                        <div className={REBATE_GRID.content}>
                            {/* Print Header */}
                            {reportData && (
                                <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
                                    <div className="text-center">
                                        <h1 className="text-2xl font-bold tracking-wider">ITTEFAQ IRON STORE</h1>
                                        <p className="text-sm text-gray-600">Parianwali, Pakistan</p>
                                        <div className="mt-3 py-2 bg-black text-white">
                                            <h2 className="text-lg font-bold tracking-widest">REBATE REPORT — {reportData.summary.monthLabel}</h2>
                                        </div>
                                        <p className="mt-2 text-sm">Supplier: <strong>{reportData.summary.supplierName}</strong></p>
                                    </div>
                                </div>
                            )}

                            {/* Current Month Header */}
                            {selectedSupplierId && (
                                <div className={`print:hidden ${REBATE_THEME.card} px-5 py-4 flex flex-wrap items-center justify-between gap-3`}>
                                    <div>
                                        <p className={REBATE_THEME.label}>Viewing Month</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <h2 className="text-lg font-bold text-slate-900">
                                                {reportData?.summary?.monthLabel || selectedMonthRow?.monthLabel || selectedMonth}
                                            </h2>
                                            {(reportData?.summary?.rebateStatus || selectedMonthRow?.status) && (
                                                <StatusBadge status={reportData?.summary?.rebateStatus || selectedMonthRow?.status} />
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Purchase & rebate detail for the selected month. Use Add Rebate for any month (paid, unpaid, or no purchases).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                        {monthlyData?.summary?.paidMonthCount != null && (
                                            <>
                                                <span className="px-2.5 py-1 rounded-lg font-semibold border" style={{ backgroundColor: BRAND.tint.green, color: BRAND.text.green, borderColor: `${BRAND.supporting.green}40` }}>
                                                    {monthlyData.summary.paidMonthCount} paid months
                                                </span>
                                                <span className="px-2.5 py-1 rounded-lg font-semibold border" style={{ backgroundColor: BRAND.tint.pink, color: BRAND.text.pink, borderColor: `${BRAND.primary.pink}35` }}>
                                                    {monthlyData.summary.unpaidMonthCount} unpaid months
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {reportData && reportData.summary.purchaseCount > 0 && (
                                <>
                                    <div className={`${REBATE_GRID.kpi} print:hidden`}>
                                        <div className={REBATE_GRID.kpiSupplier + ' ' + rebateKpiCard('supplier')}>
                                            <div className="flex items-center justify-between">
                                                <p className={REBATE_THEME.label} style={{ color: BRAND.text.blue }}>Supplier</p>
                                                <Tag className="w-4 h-4" style={{ color: BRAND.primary.blue }} />
                                            </div>
                                            <p className="text-base font-bold mt-1 truncate" style={{ color: BRAND.text.blue }}>{reportData.summary.supplierName}</p>
                                            <p className="text-xs mt-0.5" style={{ color: BRAND.primary.blue }}>{reportData.summary.monthLabel}</p>
                                        </div>
                                        <div className={REBATE_GRID.kpiStat + ' ' + rebateKpiCard('default')}>
                                            <p className={REBATE_THEME.label}>Products</p>
                                            <p className="text-2xl font-bold text-slate-800 mt-1">{reportData.summary.productCount}</p>
                                        </div>
                                        <div className={REBATE_GRID.kpiStat + ' ' + rebateKpiCard('default')}>
                                            <p className={REBATE_THEME.label}>Bills</p>
                                            <p className="text-2xl font-bold text-slate-800 mt-1">{reportData.summary.purchaseCount}</p>
                                        </div>
                                        <div className={REBATE_GRID.kpiStat + ' ' + rebateKpiCard('qty')}>
                                            <p className={REBATE_THEME.label} style={{ color: BRAND.text.blue }}>Total Qty</p>
                                            <p className="text-2xl font-bold mt-1" style={{ color: BRAND.primary.blue }}>{fmtAmt(reportData.summary.totalQuantity)}</p>
                                        </div>
                                        <div className={REBATE_GRID.kpiStat + ' ' + rebateKpiCard('amount')}>
                                            <p className={REBATE_THEME.label} style={{ color: BRAND.text.green }}>Purchase Value</p>
                                            <p className="text-lg font-bold mt-1" style={{ color: BRAND.text.green }}>PKR {formatCurrency(reportData.summary.totalAmount)}</p>
                                        </div>
                                        <div className={REBATE_GRID.kpiWide + ' ' + rebateKpiCard('rebate')}>
                                            <div className="flex items-center justify-between">
                                                <p className={REBATE_THEME.label} style={{ color: BRAND.text.periwinkle }}>Rebate Status</p>
                                                <Wallet className="w-4 h-4" style={{ color: BRAND.supporting.periwinkle }} />
                                            </div>
                                            <div className="mt-2">
                                                <StatusBadge status={reportData.summary.rebateStatus} />
                                            </div>
                                            <p className="text-sm font-bold mt-2" style={{ color: BRAND.text.periwinkle }}>PKR {formatCurrency(reportData.summary.rebatePaid)}</p>
                                            {reportData.summary.lastPaidAt && (
                                                <p className="text-[11px] mt-0.5" style={{ color: BRAND.supporting.periwinkle }}>Paid: {formatDate(reportData.summary.lastPaidAt)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Detail Tabs */}
                                    <div className={`${REBATE_THEME.card} overflow-hidden print:hidden p-0`}>
                                        <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2" style={{ background: `linear-gradient(90deg, ${BRAND.tint.blue}, #ffffff)` }}>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                                    Monthly Detail
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {reportData.summary.monthLabel} — products, bills & rebate entries
                                                </p>
                                            </div>
                                            <StatusBadge status={reportData.summary.rebateStatus} size="lg" />
                                        </div>

                                        <div className="flex border-b border-[#e2e8f0] px-2 pt-2 overflow-x-auto gap-1" style={{ backgroundColor: BRAND.tint.blue }}>
                                            {tabs.map((tab) => {
                                                const Icon = tab.icon;
                                                const isActive = activeTab === tab.id;
                                                const count =
                                                    tab.id === 'products'
                                                        ? reportData.products.length
                                                        : tab.id === 'purchases'
                                                          ? reportData.purchases.length
                                                          : reportData.rebateHistory.length;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-xl transition-all border ${
                                                            isActive
                                                                ? 'bg-white border-[#e2e8f0] border-b-white -mb-px shadow-sm'
                                                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'
                                                        }`}
                                                        style={isActive ? { color: BRAND.primary.blue } : undefined}
                                                    >
                                                        <Icon className="w-4 h-4" style={isActive ? { color: BRAND.primary.blue } : undefined} />
                                                        {tab.label}
                                                        <span
                                                            className="min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-center"
                                                            style={
                                                                isActive
                                                                    ? { backgroundColor: BRAND.tint.blue, color: BRAND.text.blue }
                                                                    : { backgroundColor: '#e2e8f0', color: '#64748b' }
                                                            }
                                                        >
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="p-0">
                                            {activeTab === 'products' && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className={REBATE_THEME.tableHead}>
                                                                <th className={`${REBATE_THEME.tableHeadCell} w-14 text-center`}>S.No</th>
                                                                <th className={REBATE_THEME.tableHeadCell}>Product Title</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} text-center w-28`}>Purchases</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} text-right w-36`}>Total Qty</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} text-right w-44`}>Amount (PKR)</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} text-right w-36`}>Avg Rate (PKR)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#eef1f6]">
                                                            {reportData.products.map((p, index) => (
                                                                <tr
                                                                    key={p.pro_id}
                                                                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfd]'} hover:bg-[#e8effd]/40 transition-colors`}
                                                                >
                                                                    <td className="px-5 py-4 text-center text-slate-500 font-semibold">{index + 1}</td>
                                                                    <td className="px-5 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <span
                                                                                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                                                                                style={{ background: `linear-gradient(135deg, ${BRAND.primary.blue}, ${BRAND.supporting.periwinkle})` }}
                                                                            >
                                                                                {p.pro_title?.[0]?.toUpperCase() || '?'}
                                                                            </span>
                                                                            <span className="font-bold text-slate-900">{p.pro_title}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-center">
                                                                        <span className="inline-flex min-w-[2rem] px-2 py-0.5 rounded-md font-semibold text-xs" style={{ backgroundColor: BRAND.tint.blue, color: BRAND.text.blue }}>
                                                                            {p.purchase_count}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-right font-bold tabular-nums text-base" style={{ color: BRAND.primary.blue }}>{fmtAmt(p.total_quantity)}</td>
                                                                    <td className="px-5 py-4 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(p.total_amount)}</td>
                                                                    <td className="px-5 py-4 text-right text-slate-600 tabular-nums font-medium">{fmtAmt(p.avg_rate)}</td>
                                                                </tr>
                                                            ))}
                                                            {reportData.products.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                                        No purchases in {reportData.summary.monthLabel}.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                        {reportData.products.length > 0 && (
                                                            <tfoot>
                                                                <tr className={REBATE_THEME.tableFoot}>
                                                                    <td colSpan={3} className="px-5 py-3.5 text-right uppercase text-[11px] tracking-wider">Grand Total</td>
                                                                    <td className="px-5 py-3.5 text-right tabular-nums text-base" style={{ color: BRAND.supporting.cyan }}>{fmtAmt(reportData.summary.totalQuantity)}</td>
                                                                    <td className="px-5 py-3.5 text-right tabular-nums text-base" style={{ color: BRAND.supporting.green }}>PKR {formatCurrency(reportData.summary.totalAmount)}</td>
                                                                    <td className="px-5 py-3.5 text-right text-slate-400">—</td>
                                                                </tr>
                                                            </tfoot>
                                                        )}
                                                    </table>
                                                </div>
                                            )}

                                            {activeTab === 'purchases' && (
                                                <div className="p-3 space-y-2">
                                                    {reportData.purchases.length === 0 ? (
                                                        <div className="px-6 py-12 text-center text-slate-500 text-sm">
                                                            No purchase bills in {reportData.summary.monthLabel}.
                                                        </div>
                                                    ) : (
                                                        reportData.purchases.map((purchase) => {
                                                            const isExpanded = expandedPurchaseId === purchase.pur_id;
                                                            return (
                                                                <div
                                                                    key={purchase.pur_id}
                                                                    className="border border-[#e2e8f0] rounded-xl overflow-hidden bg-white shadow-sm"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.pur_id)}
                                                                        className="w-full px-4 py-3.5 flex items-center gap-3 transition-colors text-left"
                                                                        style={{ backgroundColor: isExpanded ? BRAND.tint.blue : 'white' }}
                                                                    >
                                                                        <span
                                                                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                                                            style={
                                                                                isExpanded
                                                                                    ? { backgroundColor: BRAND.primary.blue, color: 'white' }
                                                                                    : { backgroundColor: '#f1f5f9', color: '#64748b' }
                                                                            }
                                                                        >
                                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </span>
                                                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 items-center">
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Date</p>
                                                                                <p className="font-semibold text-slate-800">{formatDate(purchase.created_at)}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Invoice</p>
                                                                                <p className="font-bold" style={{ color: BRAND.primary.blue }}>{purchase.invoice_number}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Items / Qty</p>
                                                                                <p className="font-semibold text-slate-800">{purchase.item_count} items · {fmtAmt(purchase.total_qty)}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Payment</p>
                                                                                <p className="font-semibold text-slate-800">{purchase.payment_type}</p>
                                                                            </div>
                                                                            <div className="md:text-right">
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Net Total</p>
                                                                                <p className="font-bold text-base" style={{ color: BRAND.text.green }}>PKR {formatCurrency(purchase.net_total)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                    {isExpanded && (
                                                                        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                                                                            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                                                                                <table className="w-full text-xs">
                                                                                    <thead>
                                                                                        <tr className={REBATE_THEME.tableHead}>
                                                                                            <th className={`${REBATE_THEME.tableHeadCell}`}>Product</th>
                                                                                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-24`}>Qty</th>
                                                                                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-28`}>Rate (PKR)</th>
                                                                                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-28`}>Discount</th>
                                                                                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-32`}>Net Total</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100">
                                                                                        {purchase.items.map((item, idx) => (
                                                                                            <tr key={`${purchase.pur_id}-${item.pro_id}-${idx}`}>
                                                                                                <td className="px-4 py-2.5 font-semibold text-slate-800">{item.pro_title}</td>
                                                                                                <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: BRAND.primary.blue }}>{fmtAmt(item.qnty)}</td>
                                                                                                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmtAmt(item.unit_rate)}</td>
                                                                                                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtAmt(item.discount)}</td>
                                                                                                <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: BRAND.text.green }}>{formatCurrency(item.net_total)}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}

                                            {activeTab === 'rebates' && (
                                                <div className="overflow-x-auto">
                                                    {reportData.rebateHistory.length > 0 && (
                                                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ backgroundColor: BRAND.tint.periwinkle, borderColor: `${BRAND.supporting.periwinkle}30` }}>
                                                            <p className="text-sm font-semibold" style={{ color: BRAND.text.periwinkle }}>
                                                                {reportData.rebateHistory.length} rebate {reportData.rebateHistory.length === 1 ? 'entry' : 'entries'} this month
                                                            </p>
                                                            <p className="text-sm font-bold" style={{ color: BRAND.text.green }}>
                                                                Total: PKR {formatCurrency(reportData.summary.rebatePaid)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className={REBATE_THEME.tableHead}>
                                                                <th className={`${REBATE_THEME.tableHeadCell} w-14 text-center`}>S.No</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} w-32`}>Date</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} w-36`}>Bill No</th>
                                                                <th className={REBATE_THEME.tableHeadCell}>Details</th>
                                                                <th className={`${REBATE_THEME.tableHeadCell} text-right w-40`}>Amount (PKR)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#eef1f6]">
                                                            {reportData.rebateHistory.map((entry, index) => (
                                                                <tr key={rebateEntryKey(entry, index)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfd]'} transition-colors`} style={{ ['--hover']: BRAND.tint.periwinkle }}>
                                                                    <td className="px-5 py-4 text-center text-slate-500 font-semibold">{index + 1}</td>
                                                                    <td className="px-5 py-4 text-slate-800 font-medium">{formatDate(entry.created_at)}</td>
                                                                    <td className="px-5 py-4">
                                                                        <span className="inline-flex px-2 py-0.5 rounded-md font-bold text-xs" style={{ backgroundColor: BRAND.tint.periwinkle, color: BRAND.text.periwinkle }}>
                                                                            {entry.bill_no}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-slate-600 text-xs leading-relaxed">{entry.details}</td>
                                                                    <td className="px-5 py-4 text-right font-bold tabular-nums text-base" style={{ color: BRAND.text.green }}>{formatCurrency(entry.debit_amount)}</td>
                                                                </tr>
                                                            ))}
                                                            {reportData.rebateHistory.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={5} className="px-6 py-12 text-center">
                                                                        <div className="max-w-xs mx-auto">
                                                                            <StatusBadge status={reportData.summary.rebateStatus} size="lg" />
                                                                            <p className="text-slate-500 text-sm mt-3">
                                                                                No rebate payment recorded for {reportData.summary.monthLabel}.
                                                                            </p>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Print tables */}
                                    <div className="hidden print:block bg-white border border-black mt-4">
                                        <h3 className="text-sm font-bold px-3 py-2 border-b border-black">Product Summary</h3>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-200">
                                                    <th className="px-2 py-1 border border-black text-left">Product</th>
                                                    <th className="px-2 py-1 border border-black text-right">Qty</th>
                                                    <th className="px-2 py-1 border border-black text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.products.map((p) => (
                                                    <tr key={p.pro_id}>
                                                        <td className="px-2 py-1 border border-black">{p.pro_title}</td>
                                                        <td className="px-2 py-1 border border-black text-right">{fmtAmt(p.total_quantity)}</td>
                                                        <td className="px-2 py-1 border border-black text-right">{formatCurrency(p.total_amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {selectedSupplierId && !selectedMonth && !loadingMonthly && monthlyData && unpaidMonthOptions.length === 0 && (
                                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center print:hidden">
                                    <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                    <h3 className="text-base font-bold text-slate-800">All months are paid</h3>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Every month with activity is marked paid above. Open Rebate History to view paid month details.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={goToRebateHistory}
                                        className={`mt-4 ${rebateBtnPrimary()}`}
                                        style={{ background: `linear-gradient(135deg, ${BRAND.supporting.periwinkle}, ${BRAND.primary.blue})` }}
                                    >
                                        <History className="w-4 h-4" /> View Rebate History
                                    </button>
                                </div>
                            )}

                            {selectedSupplierId && selectedMonth && !reportData && isLoading && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center print:hidden">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 mb-3" style={{ borderColor: BRAND.primary.blue }} />
                                    <p className="text-sm font-medium text-slate-600">Loading {selectedMonth} details...</p>
                                </div>
                            )}

                            {selectedSupplierId && reportData && reportData.summary.purchaseCount === 0 && !isLoading && (
                                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center print:hidden">
                                    <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                    <h3 className="text-base font-bold text-slate-800">No purchases in {reportData.summary.monthLabel}</h3>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Use <strong>Add Rebate</strong> above to post a rebate for this month (enter quantity in the form), or pick another month / Rebate History.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={goToRebateHistory}
                                        className={`mt-4 ${rebateBtnPrimary()}`}
                                        style={{ background: `linear-gradient(135deg, ${BRAND.supporting.periwinkle}, ${BRAND.primary.blue})` }}
                                    >
                                        <History className="w-4 h-4" /> View Rebate History
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Rebate Modal */}
                {isRebateOpen && reportData && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                            <div className="px-6 py-4 flex items-center justify-between text-white" style={{ background: REBATE_THEME.headerGradient }}>
                                <div className="flex items-center space-x-2.5">
                                    <Gift className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.85)' }} />
                                    <h3 className="text-lg font-bold">Add Rebate to Ledger</h3>
                                </div>
                                <button onClick={() => setIsRebateOpen(false)} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Supplier Account</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold">
                                        {reportData.summary.supplierName}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Month</label>
                                    <div className="rounded-xl px-4 py-3 font-bold border" style={{ backgroundColor: BRAND.tint.blue, borderColor: `${BRAND.primary.blue}30`, color: BRAND.text.blue }}>
                                        {reportData.summary.monthLabel}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        {reportData.summary.purchaseCount > 0
                                            ? 'Total Quantity (This Month)'
                                            : 'Rebate Quantity'}
                                    </label>
                                    {reportData.summary.purchaseCount > 0 ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-900 font-bold text-xl">
                                            {fmtAmt(reportData.summary.totalQuantity)}{' '}
                                            <span className="text-sm font-semibold text-blue-600">units</span>
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rebateManualQty}
                                            onChange={(e) => setRebateManualQty(e.target.value)}
                                            placeholder="Enter quantity for this month"
                                            className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8f0] rounded-xl outline-none font-bold text-lg focus:ring-2 focus:ring-[#1A55E3]/25 focus:border-[#1A55E3]"
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rate (Per Unit)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={rebateRate}
                                            onChange={(e) => setRebateRate(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8f0] rounded-xl outline-none font-bold text-lg focus:ring-2 focus:ring-[#1A55E3]/25 focus:border-[#1A55E3]"
                                            autoFocus={reportData.summary.purchaseCount > 0}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Total Rebate (PKR)</label>
                                        <div className="w-full px-3.5 py-2.5 rounded-xl font-bold text-lg border" style={{ backgroundColor: BRAND.tint.green, borderColor: `${BRAND.supporting.green}40`, color: BRAND.text.green }}>
                                            {formatCurrency(rebateTotalAmount)}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveRebate}
                                    disabled={
                                        savingRebate ||
                                        !rebateRate ||
                                        parseFloat(rebateRate) <= 0 ||
                                        effectiveRebateQty <= 0
                                    }
                                    className={`w-full ${rebateBtnPrimary('py-3.5')} disabled:opacity-50`}
                                    style={{ background: `linear-gradient(135deg, ${BRAND.primary.blue}, ${BRAND.supporting.periwinkle})` }}
                                >
                                    {savingRebate ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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
                )}
            </div>

            <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-size: 10px !important; background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
        </DashboardLayout>
    );
}

export default function RebateReport() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: BRAND.primary.blue }} />
          </div>
        </DashboardLayout>
      }
    >
      <RebateReportContent />
    </Suspense>
  );
}
