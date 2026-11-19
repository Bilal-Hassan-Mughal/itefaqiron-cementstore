'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { Building2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';
import CustomerLedgerToolbar from '../customer-ledger/CustomerLedgerToolbar';
import CustomerLedgerSummary from '../customer-ledger/CustomerLedgerSummary';
import CustomerLedgerPrintSummary from '../customer-ledger/CustomerLedgerPrintSummary';
import SupplierLedgerTable from './SupplierLedgerTable';
import {
  filterSupplierAccounts,
  buildSupplierLedgerCsv,
  customerReportCaption,
  filterLedgerEntries,
} from '../customer-ledger/customer-ledger-utils';

export default function SupplierLedgerReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(2000, 0, 1).toISOString().split('T')[0];
    setStartDate(yearAgo);
    setEndDate(today);
    void (async () => {
      try {
        const response = await fetch('/api/customers?dropdown=true');
        if (response.ok) {
          const data = await response.json();
          setAccounts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    })();
  }, []);

  const supplierOptions = useMemo(() => filterSupplierAccounts(accounts), [accounts]);

  const fetchReport = useCallback(async () => {
    if (!selectedSupplier || !startDate || !endDate) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports?type=supplier-ledger&supplierId=${selectedSupplier.cus_id}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (response.ok) {
        setReportData(data);
      } else {
        alert(data?.error || 'Error fetching report');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error fetching report');
    } finally {
      setLoading(false);
    }
  }, [selectedSupplier, startDate, endDate]);

  useEffect(() => {
    if (!selectedSupplier || !startDate || !endDate) return undefined;
    const timer = window.setTimeout(() => {
      void fetchReport();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [selectedSupplier, startDate, endDate, fetchReport]);

  useEffect(() => {
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const handlePrint = () => {
    if (!reportData) return;
    setPrinting(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  const handleExport = () => {
    if (!reportData) return;
    const csv = buildSupplierLedgerCsv(reportData, startDate, endDate);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-ledger-${reportData.supplier?.cus_name}-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const periodLabel =
    startDate && endDate ? `${formatDatePK(startDate)} → ${formatDatePK(endDate)}` : '';

  const accountForCaption = reportData?.supplier
    ? { ...selectedSupplier, ...reportData.supplier }
    : selectedSupplier;
  const supplierLabel = accountForCaption ? customerReportCaption(accountForCaption) : '';

  const allEntries = reportData?.ledgerEntries;
  const filteredEntries = useMemo(
    () => filterLedgerEntries(allEntries, ledgerSearch),
    [allEntries, ledgerSearch]
  );
  const tableEntries = printing ? (allEntries || []) : filteredEntries;
  const printFilterNote =
    printing && ledgerSearch.trim()
      ? `Screen filter "${ledgerSearch.trim()}" ignored — full ledger printed`
      : null;
  const totalLines = allEntries?.length ?? 0;
  const filteredLines = filteredEntries.length;
  const filteredHint =
    ledgerSearch.trim() && totalLines
      ? `${filteredLines} / ${totalLines} lines`
      : `${totalLines} lines`;

  return (
    <DashboardLayout>
      <div
        id="supplier-ledger-root"
        className="flex flex-col min-h-0 h-[calc(100dvh-92px)] max-h-[calc(100dvh-92px)] print:h-auto print:max-h-none -mx-1 px-1"
        style={{ background: 'linear-gradient(165deg, #eceff4 0%, #f6f8fb 38%, #f8fafc 100%)' }}
      >
        <CustomerLedgerToolbar
          title="Supplier Ledger"
          router={router}
          customerOptions={supplierOptions}
          selectedCustomer={selectedSupplier}
          onCustomerChange={(c) => {
            setSelectedSupplier(c);
            setLedgerSearch('');
            if (!c) setReportData(null);
          }}
          ledgerSearch={ledgerSearch}
          onLedgerSearchChange={setLedgerSearch}
          showLedgerSearch={Boolean(selectedSupplier)}
          ledgerSearchDisabled={!reportData}
          startDate={startDate}
          endDate={endDate}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
          onExport={handleExport}
          onPrint={handlePrint}
          loading={loading}
          hasReport={Boolean(reportData)}
          accountPlaceholder="Supplier — search name, phone, reference, ID…"
          accountNoOptionsText="No supplier — try phone, reference, or ID"
        />

        <div className="flex-1 min-h-0 flex flex-col gap-2.5 mt-2 pb-1 print:gap-0">
          {(reportData || (loading && selectedSupplier)) && (
            <div
              id="printable-report"
              className="flex flex-col min-h-0 flex-1 gap-2.5 relative print:overflow-visible print:h-auto print:min-h-0 print:max-h-none print:block"
            >
              {loading && reportData && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-start justify-center pt-16 pointer-events-none print:hidden">
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="hidden print:block">
                <ReportPageHeader
                  reportTitle="Supplier Ledger"
                  metaLines={[
                    supplierLabel,
                    `Period: ${periodLabel}`,
                    `Generated: ${new Date().toLocaleString()}`,
                  ]}
                />
              </div>

              {reportData && (
                <>
                  <CustomerLedgerPrintSummary
                    summary={reportData.summary}
                    customerLabel={supplierLabel}
                    periodLabel={periodLabel}
                    lineCount={totalLines}
                    filterNote={printFilterNote}
                  />

                  <CustomerLedgerSummary
                    summary={reportData.summary}
                    rowCount={totalLines}
                    filteredHint={filteredHint}
                    customerLabel={supplierLabel}
                    periodLabel={periodLabel}
                  />

                  <SupplierLedgerTable
                    entries={tableEntries}
                    summary={reportData.summary}
                    filteredCount={printing ? totalLines : filteredLines}
                    totalCount={totalLines}
                  />
                </>
              )}
            </div>
          )}

          {!reportData && loading && selectedSupplier && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/70">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-600">Opening ledger…</p>
            </div>
          )}

          {!reportData && !loading && !selectedSupplier && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/50">
              <div className="text-center max-w-sm px-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Select a supplier</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Search by name, phone, or reference. Ledger loads automatically. Use the line filter for bill, amount, or ID.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body {
            font-size: 9px !important;
          }
          .dashboard-layout-root {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .dashboard-main-scroll {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
          }
          .munshi-ji-dock {
            display: none !important;
          }
          #supplier-ledger-root {
            background: white !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          #printable-report {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          .customer-ledger-table-scroll {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .customer-ledger-print-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            page-break-after: auto;
          }
          .customer-ledger-print-table thead {
            display: table-header-group !important;
          }
          .customer-ledger-print-table tfoot {
            display: table-footer-group !important;
          }
          .customer-ledger-print-table th,
          .customer-ledger-print-table td {
            position: static !important;
            overflow: visible !important;
            word-wrap: break-word !important;
          }
          .customer-ledger-print-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .customer-ledger-print-foot {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}