'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { BookOpen, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';
import CustomerLedgerToolbar from './CustomerLedgerToolbar';
import CustomerLedgerSummary from './CustomerLedgerSummary';
import CustomerLedgerPrintSummary from './CustomerLedgerPrintSummary';
import CustomerLedgerTable from './CustomerLedgerTable';
import {
  dedupeCustomersById,
  buildCustomerLedgerCsv,
  customerReportCaption,
  filterLedgerEntries,
} from './customer-ledger-utils';

export default function CustomerLedgerReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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
          setCustomers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      }
    })();
  }, []);

  const customerOptions = useMemo(() => dedupeCustomersById(customers), [customers]);

  const fetchReport = useCallback(async () => {
    if (!selectedCustomer || !startDate || !endDate) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports?type=customer-ledger&customerId=${selectedCustomer.cus_id}&startDate=${startDate}&endDate=${endDate}`
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
  }, [selectedCustomer, startDate, endDate]);

  useEffect(() => {
    if (!selectedCustomer || !startDate || !endDate) return undefined;
    const timer = window.setTimeout(() => {
      void fetchReport();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [selectedCustomer, startDate, endDate, fetchReport]);

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
    const csv = buildCustomerLedgerCsv(reportData, startDate, endDate);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-ledger-${reportData.customer?.cus_name}-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const periodLabel =
    startDate && endDate ? `${formatDatePK(startDate)} → ${formatDatePK(endDate)}` : '';

  const customerForCaption = reportData?.customer
    ? { ...selectedCustomer, ...reportData.customer }
    : selectedCustomer;
  const customerLabel = customerForCaption ? customerReportCaption(customerForCaption) : '';

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
        id="customer-ledger-root"
        className="flex flex-col min-h-0 h-[calc(100dvh-92px)] max-h-[calc(100dvh-92px)] print:h-auto print:max-h-none -mx-1 px-1"
        style={{ background: 'linear-gradient(165deg, #eceff4 0%, #f6f8fb 38%, #f8fafc 100%)' }}
      >
        <CustomerLedgerToolbar
          router={router}
          customerOptions={customerOptions}
          selectedCustomer={selectedCustomer}
          onCustomerChange={(c) => {
            setSelectedCustomer(c);
            setLedgerSearch('');
            if (!c) setReportData(null);
          }}
          ledgerSearch={ledgerSearch}
          onLedgerSearchChange={setLedgerSearch}
          showLedgerSearch={Boolean(selectedCustomer)}
          ledgerSearchDisabled={!reportData}
          startDate={startDate}
          endDate={endDate}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
          onExport={handleExport}
          onPrint={handlePrint}
          loading={loading}
          hasReport={Boolean(reportData)}
        />

        <div className="flex-1 min-h-0 flex flex-col gap-2.5 mt-2 pb-1 print:gap-0">
          {(reportData || (loading && selectedCustomer)) && (
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
                  reportTitle="Customer Ledger"
                  metaLines={[
                    customerLabel,
                    `Period: ${periodLabel}`,
                    `Generated: ${new Date().toLocaleString()}`,
                  ]}
                />
              </div>

              {reportData && (
                <>
                  <CustomerLedgerPrintSummary
                    summary={reportData.summary}
                    customerLabel={customerLabel}
                    periodLabel={periodLabel}
                    lineCount={totalLines}
                    filterNote={printFilterNote}
                  />

                  <CustomerLedgerSummary
                    summary={reportData.summary}
                    rowCount={totalLines}
                    filteredHint={filteredHint}
                    customerLabel={customerLabel}
                    periodLabel={periodLabel}
                  />

                  <CustomerLedgerTable
                    entries={tableEntries}
                    summary={reportData.summary}
                    filteredCount={printing ? totalLines : filteredLines}
                    totalCount={totalLines}
                  />
                </>
              )}
            </div>
          )}

          {!reportData && loading && selectedCustomer && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/70">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-600">Opening ledger…</p>
            </div>
          )}

          {!reportData && !loading && !selectedCustomer && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/50">
              <div className="text-center max-w-sm px-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <BookOpen className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Select a customer</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Search by name, phone, address, or reference. The ledger loads automatically when you pick an account. Change dates to refresh.
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
          #customer-ledger-root {
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