'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Trash2,
  FilePlus,
  Eye,
  Pencil,
  Package,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '../components/dashboard-layout';
import ReportPageHeader from '../components/report-page-header';
import { SO_THEME, EXCEL, soBtnPrimary, soBtnOutline } from '@/lib/super-order-theme';
import {
  formatSuperOrderQty,
  buildSuperOrderPdf,
  buildSuperOrderExportContext,
} from '@/lib/super-order-utils';

function formatListDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatListDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchOrderExportContext(id) {
  const [orderRes, reportRes, catRes, storeRes] = await Promise.all([
    fetch(`/api/super-orders?id=${id}`),
    fetch('/api/reports?type=stock-report'),
    fetch('/api/categories'),
    fetch('/api/stores'),
  ]);
  const [data, reportData, catData, storeData] = await Promise.all([
    orderRes.json(),
    reportRes.json(),
    catRes.json(),
    storeRes.json(),
  ]);
  if (!orderRes.ok) throw new Error(data.error || 'Failed to load order');
  const prods = reportRes.ok ? reportData.products || [] : [];
  const cats = catRes.ok && Array.isArray(catData) ? catData : [];
  const strs = storeRes.ok && storeData.success ? storeData.data || [] : [];
  return buildSuperOrderExportContext(data, prods, cats, strs);
}

/** @typedef {{ id: number, type: 'edit'|'view'|'print'|'pdf'|'delete' }} RowAction */

export default function SuperOrderListPage() {
  const [loading, setLoading] = useState(true);
  const [savedOrders, setSavedOrders] = useState([]);
  const [printData, setPrintData] = useState(null);
  /** @type {[RowAction | null, Function]} */
  const [rowAction, setRowAction] = useState(null);
  const mountedRef = useRef(false);
  const printTimerRef = useRef(null);

  const isRowBusy = (id) => rowAction?.id === id;
  const isActionLoading = (id, type) => rowAction?.id === id && rowAction?.type === type;

  const startRowAction = (id, type) => {
    if (rowAction) return false;
    setRowAction({ id, type });
    return true;
  };

  const clearRowAction = () => setRowAction(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSavedOrders = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      const res = await fetch('/api/super-orders');
      const data = await res.json();
      if (!mountedRef.current) return;
      if (res.ok) setSavedOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedOrders();
  }, [fetchSavedOrders]);

  useEffect(() => {
    const onAfterPrint = () => {
      setPrintData(null);
      clearRowAction();
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      if (printTimerRef.current) window.clearTimeout(printTimerRef.current);
    };
  }, []);

  const summary = useMemo(() => {
    const orders = savedOrders.length;
    const products = savedOrders.reduce((s, o) => s + (parseInt(o.total_lines, 10) || 0), 0);
    const totalQty = savedOrders.reduce((s, o) => s + (parseFloat(o.total_qty) || 0), 0);
    return { orders, products, totalQty };
  }, [savedOrders]);

  const handlePdf = async (id) => {
    if (!startRowAction(id, 'pdf')) return;
    try {
      const ctx = await fetchOrderExportContext(id);
      const doc = buildSuperOrderPdf(ctx);
      if (!doc) {
        alert('This order has no line items.');
        return;
      }
      doc.save(`${ctx.orderNo}-${ctx.orderDate || 'order'}.pdf`);
    } catch (e) {
      alert(e.message || 'PDF download failed');
    } finally {
      clearRowAction();
    }
  };

  const handlePrint = async (id) => {
    if (!startRowAction(id, 'print')) return;
    try {
      const ctx = await fetchOrderExportContext(id);
      if (!ctx.orderLines?.length) {
        alert('This order has no line items.');
        clearRowAction();
        return;
      }
      setPrintData(ctx);
      printTimerRef.current = window.setTimeout(() => {
        window.print();
      }, 350);
    } catch (e) {
      clearRowAction();
      alert(e.message || 'Print failed');
    }
  };

  const handleDelete = async (id, orderNo) => {
    if (!confirm(`Delete saved order ${orderNo}?`)) return;
    if (!startRowAction(id, 'delete')) return;
    try {
      const res = await fetch(`/api/super-orders?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await fetchSavedOrders();
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      clearRowAction();
    }
  };

  const handleNavigateAction = (e, id, type) => {
    e.stopPropagation();
    if (rowAction) {
      e.preventDefault();
      return;
    }
    startRowAction(id, type);
  };

  return (
    <DashboardLayout>
      <div className="min-h-full flex flex-col" style={{ background: EXCEL.pageBg }}>
        {/* Header */}
        <div className="flex-shrink-0 px-3 md:px-4 pt-3 pb-2">
          <div
            className="rounded-xl overflow-hidden shadow-[0_2px_16px_rgba(26,85,227,0.15)]"
            style={{ background: SO_THEME.headerGradient }}
          >
            <div className="px-4 md:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  href="/dashboard"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors inline-flex"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/15 text-white backdrop-blur-sm">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-white truncate">Super Orders</h1>
                    <p className="text-xs text-white/75 truncate">Saved purchase orders — open, print or create new</p>
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard/super-order/new"
                className={soBtnPrimary('bg-[#00D284] hover:bg-[#00b872]')}
              >
                <FilePlus className="w-4 h-4" /> New Order
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 md:px-4 pb-4 space-y-3">
          {/* Summary cards */}
          {!loading && savedOrders.length > 0 && (
            <div className="grid grid-cols-3 gap-2 max-w-[1400px] mx-auto">
              <div className="so-kpi border border-[#1A55E3]/25 bg-gradient-to-br from-[#e8effd] to-white rounded-lg px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Saved Orders</p>
                <p className="text-2xl font-bold text-[#1A55E3] tabular-nums">{summary.orders}</p>
              </div>
              <div className="so-kpi border border-[#5E6EED]/25 bg-gradient-to-br from-[#eef0fe] to-white rounded-lg px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Products Ordered</p>
                <p className="text-2xl font-bold text-[#5E6EED] tabular-nums">{summary.products.toLocaleString('en-PK')}</p>
              </div>
              <div className="so-kpi border border-[#00D284]/30 bg-gradient-to-br from-[#e6fff4] to-white rounded-lg px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Quantity</p>
                <p className="text-2xl font-bold text-[#00a868] tabular-nums">{formatSuperOrderQty(summary.totalQty)}</p>
              </div>
            </div>
          )}

          {/* Excel grid */}
          <div className="excel-workbook mx-auto max-w-[1400px] overflow-hidden">
            <div
              className="px-4 py-2.5 flex items-center justify-between border-b"
              style={{ borderColor: EXCEL.borderDark, background: EXCEL.headerBg }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#1A55E3]">Saved Orders List</p>
              <button
                type="button"
                onClick={fetchSavedOrders}
                className="text-[11px] font-semibold text-slate-600 hover:text-[#1A55E3] inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-16 text-center">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-600">Loading saved orders...</p>
              </div>
            ) : savedOrders.length === 0 ? (
              <div className="p-16 text-center">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">No saved orders yet</p>
                <p className="text-xs text-slate-500 mb-4">Create a new super order to plan your purchase quantities.</p>
                <Link
                  href="/dashboard/super-order/new"
                  className={soBtnPrimary('bg-[#1A55E3] hover:bg-[#1347c4]')}
                >
                  <FilePlus className="w-4 h-4" /> Create New Order
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="so-list-grid w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="so-list-th so-list-th-num w-11 text-center">#</th>
                      <th className="so-list-th min-w-[150px]">Order No</th>
                      <th className="so-list-th w-[110px]">Order Date</th>
                      <th className="so-list-th min-w-[140px]">Supplier</th>
                      <th className="so-list-th w-[100px] text-right">Products</th>
                      <th className="so-list-th so-list-th-qty w-[110px] text-right">Total Qty</th>
                      <th className="so-list-th min-w-[150px]">Last Updated</th>
                      <th className="so-list-th w-[220px] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedOrders.map((row, index) => (
                      <tr
                        key={row.super_order_id}
                        className={`so-list-tr ${index % 2 === 1 ? 'so-list-tr-alt' : ''}`}
                      >
                        <td className="so-list-td so-list-td-num tabular-nums text-center">{index + 1}</td>
                        <td className="so-list-td">
                          <Link
                            href={`/dashboard/super-order/${row.super_order_id}`}
                            className="font-bold text-[#1A55E3] hover:underline"
                          >
                            {row.order_no}
                          </Link>
                        </td>
                        <td className="so-list-td text-slate-700 whitespace-nowrap">
                          {formatListDate(row.order_date)}
                        </td>
                        <td className="so-list-td">
                          {row.supplier_name?.trim() ? (
                            <span className="font-medium text-slate-800">{row.supplier_name}</span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Not set</span>
                          )}
                        </td>
                        <td className="so-list-td text-right">
                          <span className="inline-flex items-center justify-end gap-1 tabular-nums font-semibold text-[#5E6EED]">
                            <Layers className="w-3.5 h-3.5 opacity-70" />
                            {row.total_lines ?? 0}
                          </span>
                        </td>
                        <td className="so-list-td so-list-td-qty text-right">
                          <span className="tabular-nums font-bold text-[#00a868]">
                            {formatSuperOrderQty(row.total_qty)}
                          </span>
                        </td>
                        <td className="so-list-td text-slate-600 text-xs whitespace-nowrap">
                          {formatListDateTime(row.updated_at)}
                        </td>
                        <td className="so-list-td">
                          <div
                            className={`flex items-center justify-center gap-1 flex-wrap relative ${isRowBusy(row.super_order_id) ? 'so-list-actions-busy' : ''}`}
                          >
                            <Link
                              href={`/dashboard/super-order/${row.super_order_id}`}
                              title="Edit order"
                              aria-busy={isActionLoading(row.super_order_id, 'edit')}
                              className={`so-list-action so-list-action-edit ${rowAction && !isRowBusy(row.super_order_id) ? 'so-list-action-disabled' : ''}`}
                              onClick={(e) => handleNavigateAction(e, row.super_order_id, 'edit')}
                            >
                              {isActionLoading(row.super_order_id, 'edit') ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Pencil className="w-3.5 h-3.5" />
                              )}
                            </Link>
                            <Link
                              href={`/dashboard/super-order/${row.super_order_id}?view=1`}
                              title="View order"
                              aria-busy={isActionLoading(row.super_order_id, 'view')}
                              className={`so-list-action ${rowAction && !isRowBusy(row.super_order_id) ? 'so-list-action-disabled' : ''}`}
                              onClick={(e) => handleNavigateAction(e, row.super_order_id, 'view')}
                            >
                              {isActionLoading(row.super_order_id, 'view') ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </Link>
                            <button
                              type="button"
                              title="Print order"
                              disabled={!!rowAction}
                              aria-busy={isActionLoading(row.super_order_id, 'print')}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePrint(row.super_order_id);
                              }}
                              className="so-list-action"
                            >
                              {isActionLoading(row.super_order_id, 'print') ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              title="Download PDF"
                              disabled={!!rowAction}
                              aria-busy={isActionLoading(row.super_order_id, 'pdf')}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePdf(row.super_order_id);
                              }}
                              className="so-list-pdf-btn"
                            >
                              {isActionLoading(row.super_order_id, 'pdf') ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>{isActionLoading(row.super_order_id, 'pdf') ? '...' : 'PDF'}</span>
                            </button>
                            <button
                              type="button"
                              title="Delete order"
                              disabled={!!rowAction}
                              aria-busy={isActionLoading(row.super_order_id, 'delete')}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(row.super_order_id, row.order_no);
                              }}
                              className="so-list-action so-list-action-delete"
                            >
                              {isActionLoading(row.super_order_id, 'delete') ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="so-list-tf text-right font-bold">
                        Totals ({summary.orders} orders)
                      </td>
                      <td className="so-list-tf text-right font-bold tabular-nums text-[#5E6EED]">
                        {summary.products.toLocaleString('en-PK')}
                      </td>
                      <td className="so-list-tf text-right font-bold tabular-nums text-[#00a868]">
                        {formatSuperOrderQty(summary.totalQty)}
                      </td>
                      <td colSpan={2} className="so-list-tf" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print preview — stays on list page, no navigation to edit */}
      {printData && (
        <div id="printable-super-order-list" className="hidden print:block print:p-8">
          <ReportPageHeader
            reportTitle={printData.orderNo ? `SUPER ORDER — ${printData.orderNo}` : 'SUPER ORDER SHEET'}
            metaLines={printData.metaLines}
          />
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1A55E3] text-white">
                <th className="border border-[#1347c4] px-2 py-1.5 text-left w-10">#</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-left">Category</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-left">Product</th>
                <th className="border border-[#1347c4] px-2 py-1.5 text-right w-28">Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {printData.orderLines.map((row, i) => (
                <tr key={row.product.pro_id ?? i}>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5">{row.product.category?.cat_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 font-semibold">{row.product.pro_title || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right font-bold tabular-nums">
                    {formatSuperOrderQty(row.orderQty)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100">
                <td colSpan={3} className="border border-slate-300 px-2 py-2 text-right font-bold">Total</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-bold tabular-nums">
                  {formatSuperOrderQty(printData.orderSummary.totalQty)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <style jsx global>{`
        .excel-workbook {
          background: #fff;
          border: 1px solid ${EXCEL.borderDark};
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .so-list-grid { font-family: 'Segoe UI', Calibri, system-ui, sans-serif; }
        .so-list-grid .so-list-th {
          padding: 8px 10px;
          text-align: left;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #fff;
          background: linear-gradient(180deg, #2b6cb0 0%, #1A55E3 100%);
          border: 1px solid #1347c4;
          white-space: nowrap;
        }
        .so-list-grid .so-list-th-num {
          background: linear-gradient(180deg, #5a5a5a 0%, #404040 100%);
          border-color: #333;
          text-align: center;
        }
        .so-list-grid .so-list-th-qty {
          background: linear-gradient(180deg, #e6c200 0%, #d4a017 100%);
          border-color: #b8860b;
          color: #1a1a1a;
        }
        .so-list-grid .so-list-td {
          padding: 8px 10px;
          border: 1px solid ${EXCEL.border};
          vertical-align: middle;
          background: #fff;
          height: 40px;
        }
        .so-list-grid .so-list-td-num {
          text-align: center;
          color: #666;
          font-weight: 600;
          font-size: 12px;
          background: ${EXCEL.rowHeaderBg};
          border-color: ${EXCEL.borderDark};
        }
        .so-list-grid .so-list-td-qty { background: ${EXCEL.qtyColBg}; }
        .so-list-grid .so-list-tr-alt .so-list-td:not(.so-list-td-num) { background: ${EXCEL.rowAlt}; }
        .so-list-grid .so-list-tr:hover .so-list-td:not(.so-list-td-num) { background: ${EXCEL.rowHover}; }
        .so-list-grid .so-list-tf {
          padding: 8px 10px;
          border: 1px solid ${EXCEL.headerBorder};
          background: ${EXCEL.headerBg};
          font-size: 12px;
        }
        .so-list-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          color: #64748b;
          transition: background 0.15s, color 0.15s;
        }
        .so-list-action:hover:not(:disabled):not(.so-list-action-disabled) { background: #f1f5f9; color: #334155; }
        .so-list-action-edit:hover:not(.so-list-action-disabled) { background: #e8effd; color: #1A55E3; }
        .so-list-action-delete:hover:not(:disabled) { background: #ffe8f0; color: #FF0854; }
        .so-list-action:disabled,
        .so-list-action-disabled {
          opacity: 0.45;
          pointer-events: none;
          cursor: not-allowed;
        }
        .so-list-pdf-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .so-list-actions-busy .so-list-action:not([aria-busy="true"]),
        .so-list-actions-busy .so-list-pdf-btn:not([aria-busy="true"]) {
          opacity: 0.45;
          pointer-events: none;
        }
        .so-list-pdf-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          min-width: 62px;
          font-size: 11px;
          font-weight: 700;
          color: #1A55E3;
          background: #fff;
          border: 1px solid #1A55E3;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .so-list-pdf-btn:hover { background: #e8effd; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden; }
          #printable-super-order-list, #printable-super-order-list * { visibility: visible; }
          #printable-super-order-list {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
