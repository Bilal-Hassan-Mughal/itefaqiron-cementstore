'use client';

import { useState, useEffect, useMemo, Suspense, Fragment } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  History,
  Tag,
  Wallet,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '../../../components/dashboard-layout';
import ReportPageHeader from '../../../components/report-page-header';
import { Autocomplete, TextField } from '@mui/material';
import {
  fmtAmt,
  formatCurrency,
  formatDate,
  customerOptionKey,
  isSameCustomerOption,
  rebateEntryKey,
  RebateStatusBadge,
} from '@/lib/rebate-utils';
import {
  REBATE_THEME,
  REBATE_GRID,
  REBATE_FIELD_SX,
  REBATE_INPUT_CLASS,
  rebateKpiCard,
  rebateBtnPrimary,
} from '@/lib/rebate-theme';
import { BRAND } from '@/lib/brand-theme';

function RebateHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams.get('supplierId') || '';

  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (initialSupplierId && !selectedSupplierId) {
      setSelectedSupplierId(initialSupplierId);
    }
  }, [initialSupplierId, selectedSupplierId]);

  useEffect(() => {
    if (selectedSupplierId) fetchHistory();
  }, [selectedSupplierId]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/customers?dropdown=true');
      const data = await response.json();
      if (response.ok) setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchHistory = async () => {
    if (!selectedSupplierId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports?type=rebate-report&supplierId=${selectedSupplierId}&view=monthly`
      );
      const data = await response.json();
      if (response.ok) {
        setMonthlyData(data);
      } else {
        alert(data.error || 'Error fetching rebate history');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error fetching rebate history');
    } finally {
      setLoading(false);
    }
  };

  const supplierOptions = useMemo(() => {
    const list = suppliers.filter((s) =>
      s.customer_category?.cus_cat_title?.toLowerCase().includes('supplier')
    );
    return list.length > 0 ? list : suppliers;
  }, [suppliers]);

  const selectedSupplier = suppliers.find((s) => s.cus_id.toString() === selectedSupplierId) || null;

  const filteredRows = useMemo(() => {
    let rows = monthlyData?.monthlyBreakdown || [];
    rows = rows.filter((row) => row.status !== 'empty');

    if (statusFilter === 'paid') rows = rows.filter((row) => row.status === 'paid');
    if (statusFilter === 'unpaid') rows = rows.filter((row) => row.status === 'unpaid');

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.monthLabel.toLowerCase().includes(q) ||
          row.month.includes(q)
      );
    }

    return rows;
  }, [monthlyData, statusFilter, searchTerm]);

  const totals = useMemo(() => {
    const rows = filteredRows;
    return {
      months: rows.length,
      purchaseCount: rows.reduce((s, r) => s + r.purchaseCount, 0),
      totalQuantity: rows.reduce((s, r) => s + r.totalQuantity, 0),
      totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
      rebatePaid: rows.reduce((s, r) => s + r.rebatePaid, 0),
      paid: rows.filter((r) => r.status === 'paid').length,
      unpaid: rows.filter((r) => r.status === 'unpaid').length,
    };
  }, [filteredRows]);

  const openMonthReport = (monthKey, status) => {
    const params = new URLSearchParams({
      supplierId: selectedSupplierId,
      month: monthKey,
    });
    if (status === 'paid') params.set('viewPaid', '1');
    router.push(`/dashboard/reports/rebate?${params.toString()}`);
  };

  const handleExport = () => {
    if (!selectedSupplier || !monthlyData) return;
    let csv = 'Ittefaq Iron and Cement Store\nRebate History\n';
    csv += `Supplier: ${selectedSupplier.cus_name}\n\n`;
    csv += 'Month,Bills,Products,Total Qty,Purchase Amount,Rebate Paid,Status,Paid Date\n';
    filteredRows.forEach((row) => {
      csv += `"${row.monthLabel}",${row.purchaseCount},${row.productCount},${fmtAmt(row.totalQuantity)},${fmtAmt(row.totalAmount)},${fmtAmt(row.rebatePaid)},${row.status},${row.lastPaidAt ? formatDate(row.lastPaidAt) : ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebate-history-${selectedSupplier.cus_name.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <DashboardLayout>
      <div id="rebate-history-page" className="h-full flex flex-col print:bg-white overflow-hidden" style={{ backgroundColor: REBATE_THEME.pageBg }}>
        {/* Screen Header */}
        <div className="flex-shrink-0 text-white px-6 py-4 print:hidden" style={{ background: REBATE_THEME.historyHeaderGradient }}>
          <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  router.push(
                    selectedSupplierId
                      ? `/dashboard/reports/rebate?supplierId=${selectedSupplierId}`
                      : '/dashboard/reports/rebate'
                  )
                }
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border border-white/25" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">Rebate History</h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>Month-wise paid & unpaid rebate records</p>
                </div>
              </div>
            </div>
            {monthlyData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
                >
                  <Printer className="w-4 h-4 mr-2" /> Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className={`flex-shrink-0 ${REBATE_THEME.card} border-x-0 border-t-0 rounded-none px-6 py-4 print:hidden`}>
          <div className={`${REBATE_GRID.filter} mx-auto`}>
            <div className="md:col-span-5">
              <label className={REBATE_THEME.label}>
                Select Account / Supplier
              </label>
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
                  const id = newValue ? newValue.cus_id.toString() : '';
                  setSelectedSupplierId(id);
                  setExpandedMonth(null);
                  if (id) router.replace(`/dashboard/reports/rebate/history?supplierId=${id}`);
                }}
                autoSelect
                autoHighlight
                openOnFocus
                selectOnFocus
                renderInput={(params) => (
                  <TextField {...params} placeholder="Search supplier account..." sx={REBATE_FIELD_SX} />
                )}
              />
            </div>
            <div className="md:col-span-4">
              <label className={REBATE_THEME.label}>Search Month</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. Aug 2026"
                  disabled={!selectedSupplierId}
                  className={`${REBATE_INPUT_CLASS} pl-10`}
                />
              </div>
            </div>
            {selectedSupplier && (
              <div className="md:col-span-3">
                <p className={REBATE_THEME.label}>Account Balance</p>
                <p className="text-lg font-bold" style={{ color: BRAND.text.green }}>
                  PKR {formatCurrency(Math.abs(selectedSupplier.cus_balance || 0))}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-5 print:p-0">
          <div className={REBATE_GRID.content}>
            {/* Print Header */}
            {selectedSupplier && monthlyData && (
              <div className="hidden print:block mb-4">
                <ReportPageHeader
                  reportTitle="Rebate History"
                  metaLines={[
                    `Supplier: ${selectedSupplier.cus_name}`,
                    `Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })}`,
                  ]}
                />
              </div>
            )}

            {!selectedSupplierId ? (
              <div className="flex items-center justify-center min-h-[400px] print:hidden">
                <div className="text-center bg-white border border-slate-200 rounded-2xl p-10 max-w-md shadow-sm">
                  <History className="w-12 h-12 mx-auto mb-4" style={{ color: BRAND.primary.blue }} />
                  <h3 className="text-lg font-bold text-slate-800">Select a Supplier Account</h3>
                  <p className="text-slate-500 text-sm mt-2">Choose an account to view complete month-wise rebate history.</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center min-h-[400px] print:hidden">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 mb-3" style={{ borderColor: BRAND.primary.blue }} />
                  <p className="text-sm font-medium text-slate-600">Loading rebate history...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className={`${REBATE_GRID.historyKpi} mb-4 print:hidden`}>
                  <div className={`col-span-2 lg:col-span-2 ${rebateKpiCard('supplier')}`}>
                    <div className="flex items-center justify-between">
                      <p className={REBATE_THEME.label} style={{ color: BRAND.text.blue }}>Supplier</p>
                      <Tag className="w-4 h-4" style={{ color: BRAND.primary.blue }} />
                    </div>
                    <p className="text-base font-bold mt-1 truncate" style={{ color: BRAND.text.blue }}>{selectedSupplier?.cus_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND.primary.blue }}>{totals.months} months with activity</p>
                  </div>
                  <div className={rebateKpiCard('paid')}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" style={{ color: BRAND.supporting.green }} />
                      <p className={REBATE_THEME.label} style={{ color: BRAND.text.green, marginBottom: 0 }}>Paid</p>
                    </div>
                    <p className="text-2xl font-bold mt-1" style={{ color: BRAND.text.green }}>{totals.paid}</p>
                  </div>
                  <div className={rebateKpiCard('unpaid')}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" style={{ color: BRAND.primary.pink }} />
                      <p className={REBATE_THEME.label} style={{ color: BRAND.text.pink, marginBottom: 0 }}>Unpaid</p>
                    </div>
                    <p className="text-2xl font-bold mt-1" style={{ color: BRAND.text.pink }}>{totals.unpaid}</p>
                  </div>
                  <div className={rebateKpiCard('qty')}>
                    <p className={REBATE_THEME.label} style={{ color: BRAND.text.blue }}>Total Qty</p>
                    <p className="text-xl font-bold mt-1" style={{ color: BRAND.primary.blue }}>{fmtAmt(totals.totalQuantity)}</p>
                  </div>
                  <div className={rebateKpiCard('amount')}>
                    <p className={REBATE_THEME.label} style={{ color: BRAND.text.green }}>Purchase Value</p>
                    <p className="text-lg font-bold mt-1" style={{ color: BRAND.text.green }}>PKR {formatCurrency(totals.totalAmount)}</p>
                  </div>
                  <div className={rebateKpiCard('rebate')}>
                    <div className="flex items-center justify-between">
                      <p className={REBATE_THEME.label} style={{ color: BRAND.text.periwinkle }}>Rebate Paid</p>
                      <Wallet className="w-4 h-4" style={{ color: BRAND.supporting.periwinkle }} />
                    </div>
                    <p className="text-lg font-bold mt-1" style={{ color: BRAND.text.periwinkle }}>PKR {formatCurrency(totals.rebatePaid)}</p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                  {[
                    { id: 'all', label: 'All Months', count: monthlyData?.monthlyBreakdown?.filter((r) => r.status !== 'empty').length || 0 },
                    { id: 'paid', label: 'Paid', count: monthlyData?.summary?.paidMonthCount || 0 },
                    { id: 'unpaid', label: 'Unpaid', count: monthlyData?.summary?.unpaidMonthCount || 0 },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStatusFilter(filter.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                        statusFilter === filter.id ? 'text-white shadow-md border-transparent' : 'bg-white border-[#e2e8f0] text-slate-600'
                      }`}
                      style={statusFilter === filter.id ? { background: `linear-gradient(135deg, ${BRAND.primary.blue}, ${BRAND.supporting.periwinkle})` } : undefined}
                    >
                      {filter.label}
                      <span className="px-2 py-0.5 rounded-full text-xs" style={statusFilter === filter.id ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: '#f1f5f9' }}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* History Table */}
                <div className={`${REBATE_THEME.card} overflow-hidden p-0`}>
                  <div className="px-5 py-3 border-b border-[#e2e8f0] flex items-center justify-between print:hidden" style={{ background: `linear-gradient(90deg, ${BRAND.tint.periwinkle}, #fff)` }}>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Monthly Rebate Ledger</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Complete purchase & rebate status per month</p>
                    </div>
                    <Calendar className="w-5 h-5" style={{ color: BRAND.supporting.periwinkle }} />
                  </div>

                  {filteredRows.length === 0 ? (
                    <div className="px-6 py-16 text-center text-slate-500">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                      <p className="font-medium">No records match your filters.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={REBATE_THEME.tableHead}>
                            <th className={`${REBATE_THEME.tableHeadCell} w-12 text-center`}>S.No</th>
                            <th className={`${REBATE_THEME.tableHeadCell} min-w-[140px]`}>Month</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-center w-20`}>Bills</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-center w-24`}>Products</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-32`}>Total Qty</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-36`}>Purchase (PKR)</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-right w-36`}>Rebate Paid</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-center w-28`}>Status</th>
                            <th className={`${REBATE_THEME.tableHeadCell} w-32`}>Paid Date</th>
                            <th className={`${REBATE_THEME.tableHeadCell} text-center w-28 print:hidden`}>Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredRows.map((row, index) => {
                            const isExpanded = expandedMonth === row.month;
                            const hasEntries = row.rebateEntries?.length > 0;
                            return (
                              <Fragment key={row.month}>
                                <tr
                                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfd]'} ${hasEntries ? 'cursor-pointer hover:bg-[#e8effd]/60' : ''}`}
                                  onClick={() => hasEntries && setExpandedMonth(isExpanded ? null : row.month)}
                                >
                                  <td className="px-4 py-3.5 text-center text-slate-600 font-medium">{index + 1}</td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      {hasEntries ? (
                                        isExpanded ? (
                                          <ChevronDown className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        )
                                      ) : (
                                        <span className="w-4" />
                                      )}
                                      <div>
                                        <p className="font-bold text-slate-900">{row.monthLabel}</p>
                                        <p className="text-[11px] text-slate-500">{row.month}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{row.purchaseCount}</td>
                                  <td className="px-4 py-3.5 text-center text-slate-600">{row.productCount}</td>
                                  <td className="px-4 py-3.5 text-right font-bold tabular-nums" style={{ color: BRAND.primary.blue }}>{fmtAmt(row.totalQuantity)}</td>
                                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(row.totalAmount)}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold tabular-nums" style={{ color: BRAND.text.periwinkle }}>
                                    {row.rebatePaid > 0 ? formatCurrency(row.rebatePaid) : '—'}
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <RebateStatusBadge status={row.status} />
                                  </td>
                                  <td className="px-4 py-3.5 text-slate-600 text-xs font-medium">
                                    {row.lastPaidAt ? formatDate(row.lastPaidAt) : '—'}
                                  </td>
                                  <td className="px-4 py-3.5 text-center print:hidden">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openMonthReport(row.month, row.status);
                                      }}
                                      className={`${rebateBtnPrimary('px-3 py-1.5 text-xs')}`}
                                      style={{ background: `linear-gradient(135deg, ${BRAND.primary.blue}, ${BRAND.supporting.periwinkle})` }}
                                    >
                                      <Eye className="w-3.5 h-3.5" /> View Report
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && hasEntries && (
                                  <tr className="bg-violet-50/60">
                                    <td colSpan={10} className="px-4 py-3">
                                      <div className="ml-8 border border-violet-200 rounded-xl overflow-hidden bg-white">
                                        <div className="px-4 py-2 bg-violet-100 border-b border-violet-200">
                                          <p className="text-xs font-bold text-violet-800 uppercase tracking-wide">
                                            Rebate Payment Entries — {row.monthLabel}
                                          </p>
                                        </div>
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-slate-100 text-slate-700">
                                              <th className="px-3 py-2 text-left font-bold">Date</th>
                                              <th className="px-3 py-2 text-left font-bold">Bill No</th>
                                              <th className="px-3 py-2 text-left font-bold">Details</th>
                                              <th className="px-3 py-2 text-right font-bold">Amount (PKR)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {row.rebateEntries.map((entry, entryIndex) => (
                                              <tr key={rebateEntryKey(entry, entryIndex)}>
                                                <td className="px-3 py-2 text-slate-700">{formatDate(entry.created_at)}</td>
                                                <td className="px-3 py-2 font-semibold text-violet-800">{entry.bill_no}</td>
                                                <td className="px-3 py-2 text-slate-600">{entry.details}</td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">
                                                  {formatCurrency(entry.debit_amount)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className={REBATE_THEME.tableFoot}>
                            <td colSpan={4} className="px-4 py-3 text-right uppercase text-[11px] tracking-wider">
                              Grand Total ({totals.months} months)
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: BRAND.supporting.cyan }}>{fmtAmt(totals.totalQuantity)}</td>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: BRAND.supporting.green }}>
                              PKR {formatCurrency(totals.totalAmount)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: BRAND.supporting.periwinkle }}>
                              PKR {formatCurrency(totals.rebatePaid)}
                            </td>
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-400 print:hidden">
                              {totals.paid} paid · {totals.unpaid} unpaid
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-size: 10px !important; background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}

export default function RebateHistoryPage() {
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
      <RebateHistoryContent />
    </Suspense>
  );
}
