'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
import ReportPageHeader from '../../components/report-page-header';

export default function ItemSaleReport() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [details, setDetails] = useState([]);
  const [openingStock, setOpeningStock] = useState(0);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Bill viewer modal
  const [billModal, setBillModal] = useState(false);
  const [billData, setBillData] = useState(null);
  const [billLoading, setBillLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setStartDate(`${y}-${m}-01`);
    setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/reports?type=item-sale-report');
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch (e) { console.error(e); }
  };

  const fetchDetails = async (proId, sd, ed) => {
    if (!proId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?type=item-sale-report&proId=${proId}&startDate=${sd}&endDate=${ed}`);
      const data = await res.json();
      if (res.ok) {
        setDetails(data.details || []);
        setOpeningStock(data.openingStock ?? 0);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleProductSelect = (p) => {
    setSelectedProduct(p);
    fetchDetails(p.pro_id, startDate, endDate);
  };

  const handleApply = () => {
    if (selectedProduct) fetchDetails(selectedProduct.pro_id, startDate, endDate);
  };

  // Open bill modal
  const openBill = async (row) => {
    if (!row.refId) return;
    setBillModal(true);
    setBillData(null);
    setBillLoading(true);
    try {
      let url = '';
      if (row.type === 'SALE') url = `/api/sales?id=${row.refId}`;
      else if (row.type === 'SALE_RETURN') url = `/api/sale-returns?id=${row.refId}`;
      else if (row.type === 'PURCHASE') url = `/api/purchases?id=${row.refId}`;
      else if (row.type === 'PURCHASE_RETURN') {
        // Some purchase returns are stored in the purchases table (subType flag)
        if (row.subType === 'PURCHASE_RETURN_AS_PURCHASE') url = `/api/purchases?id=${row.refId}`;
        else url = `/api/purchase-returns?id=${row.refId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setBillData({ ...data, _type: row.type, _subType: row.subType || null });
    } catch (e) { console.error(e); }
    finally { setBillLoading(false); }
  };

  const fmtDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }).replace(/ /g, '-'); }
    catch { return '-'; }
  };

  const fmtQty = (n) => {
    const v = parseFloat(n);
    return isNaN(v) ? '-' : v.toFixed(2);
  };

  const fmtAmt = (n) => {
    const v = parseFloat(n);
    return isNaN(v) || v === 0 ? '-' : v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtAmtAlways = (n) => {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredProducts = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.pro_title?.toLowerCase().includes(q) || String(p.pro_id).includes(q)
    );
  }, [products, searchText]);

  const totals = useMemo(() => {
    let purchase = 0, purchaseReturn = 0, sale = 0, saleReturn = 0, adjustment = 0, amount = 0;
    details.forEach(r => {
      purchase += r.purchaseQty || 0;
      purchaseReturn += r.purchaseReturnQty || 0;
      sale += r.saleQty || 0;
      saleReturn += r.saleReturnQty || 0;
      adjustment += r.adjustmentQty || 0;
      amount += r.amount || 0;
    });
    return { purchase, purchaseReturn, sale, saleReturn, adjustment, amount };
  }, [details]);

  const typeColors = { PURCHASE: '#1a5276', PURCHASE_RETURN: '#922b21', SALE: '#1e8449', SALE_RETURN: '#784212', ADJUSTMENT: '#8e44ad' };
  const typeLabel = { PURCHASE: 'Purchase', PURCHASE_RETURN: 'Pur. Return', SALE: 'Sale', SALE_RETURN: 'Sale Return', ADJUSTMENT: 'Adjustment' };

  const thStyle = (align = 'center') => ({
    border: '1px solid #888', padding: '6px 8px', textAlign: align,
    fontWeight: 700, background: '#2c3e50', color: 'white', whiteSpace: 'nowrap', fontSize: 13,
  });
  const tdStyle = (align = 'center', extra = {}) => ({
    border: '1px solid #ccc', padding: '5px 8px', textAlign: align, fontSize: 13, ...extra,
  });

  const handlePrint = () => window.print();
  const handlePrintBill = () => {
    const el = document.getElementById('bill-modal-print-area');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Bill</title><style>
      body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:10mm}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #999;padding:5px 8px}
      th{background:#555;color:#fff;font-weight:700}
      .header{text-align:center;margin-bottom:12px}
      .header h2{margin:0 0 4px;font-size:16px}
      .header p{margin:2px 0;font-size:12px}
      .info-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px}
      .totals{margin-top:10px;display:flex;justify-content:flex-end}
      .totals table{width:280px}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          .no-print { display: none !important; }
          body { font-size: 11px !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #000 !important; padding: 4px 6px !important; font-size: 11px !important; }
          .print-header { display: block !important; }
        }
        .print-header { display: none; }
        .bill-badge:hover { background: #1a4fa0 !important; color: white !important; cursor: pointer; text-decoration: underline; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>

        {/* Top bar */}
        <div className="no-print" style={{ background: '#2c3e50', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '5px 12px', cursor: 'pointer', borderRadius: 3, fontSize: 14 }}>← Back</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Item Stock Ledger</span>
        </div>

        <div style={{ background: '#fff', borderBottom: '2px solid #c0392b', padding: '7px 16px' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b' }}>Item Stock Ledger</span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT: Product list */}
          <div className="no-print" style={{ width: 300, borderRight: '2px solid #bbb', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <fieldset style={{ margin: 8, border: '1px solid #aaa', padding: '6px 8px' }}>
              <legend style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>Products</legend>
              <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 4 }}>Select Product:</div>
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search..."
                style={{ width: '100%', border: '1px solid #bbb', padding: '5px 8px', fontSize: 14, boxSizing: 'border-box', marginBottom: 6 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', background: '#ddd', borderBottom: '1px solid #aaa', padding: '5px 6px', fontSize: 13, fontWeight: 700 }}>
                <span>#</span><span>Product Name</span>
              </div>
              <div style={{ height: 420, overflowY: 'auto', border: '1px solid #bbb' }}>
                {filteredProducts.map(p => (
                  <div key={p.pro_id} onClick={() => handleProductSelect(p)}
                    style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr',
                      padding: '6px 6px', fontSize: 13, cursor: 'pointer',
                      background: selectedProduct?.pro_id === p.pro_id ? '#316ac5' : 'transparent',
                      color: selectedProduct?.pro_id === p.pro_id ? 'white' : '#000',
                      borderBottom: '1px solid #eee',
                    }}>
                    <span>{p.pro_id}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.pro_title}>{p.pro_title}</span>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={{ padding: 10, color: '#999', fontSize: 13, textAlign: 'center' }}>No products found</div>
                )}
              </div>
            </fieldset>
          </div>

          {/* RIGHT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>

            {/* Date range */}
            <div className="no-print" style={{ padding: '8px 14px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: 12, background: '#f9f9f9' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#c0392b' }}>From:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ border: '1px solid #bbb', padding: '4px 8px', fontSize: 14, borderRadius: 2 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#c0392b' }}>To:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ border: '1px solid #bbb', padding: '4px 8px', fontSize: 14, borderRadius: 2 }} />
              <button onClick={handleApply} disabled={loading || !selectedProduct}
                style={{ background: '#316ac5', color: 'white', border: 'none', padding: '5px 18px', cursor: 'pointer', fontSize: 14, borderRadius: 2, opacity: !selectedProduct ? 0.5 : 1 }}>
                {loading ? 'Loading...' : 'Show'}
              </button>
            </div>

            {/* Letterhead: visible in print; hidden on screen via CSS */}
            <div className="print-header px-2">
              <ReportPageHeader
                reportTitle="ITEM STOCK LEDGER"
                metaLines={[
                  selectedProduct ? `Item: ${selectedProduct.pro_title}` : null,
                  `Period: ${startDate} to ${endDate}`,
                ]}
                className="!mb-2"
              />
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '4px 4px 0' }}>
              {!selectedProduct ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 15 }}>
                  ← Select a product from the list to view its stock ledger
                </div>
              ) : loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 15 }}>Loading...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle('center')}>#</th>
                      <th style={thStyle('left')}>Date</th>
                      <th style={thStyle('left')}>Account Title / Bill No.</th>
                      <th style={thStyle('right')}>Pre Stock</th>
                      <th style={thStyle('right')}>Purchase</th>
                      <th style={thStyle('right')}>Pur. Return</th>
                      <th style={thStyle('right')}>Sale</th>
                      <th style={thStyle('right')}>Sale Return</th>
                      <th style={thStyle('right')}>Adjustment</th>
                      <th style={thStyle('right')}>Updated Stock</th>
                      <th style={thStyle('right')}>Amount</th>
                      <th style={thStyle('center')}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening row */}
                    <tr style={{ background: '#d6eaf8' }}>
                      <td style={tdStyle('center')}></td>
                      <td style={tdStyle('left', { fontWeight: 700 })}>Opening</td>
                      <td style={tdStyle('left', { fontWeight: 700 })}>Opening Stock</td>
                      <td style={tdStyle('right', { fontWeight: 700 })}>{fmtQty(openingStock)}</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('right', { fontWeight: 700 })}>{fmtQty(openingStock)}</td>
                      <td style={tdStyle('right')}>-</td>
                      <td style={tdStyle('center')}>-</td>
                    </tr>

                    {details.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px solid #ddd', fontSize: 14 }}>
                          No transactions in selected date range
                        </td>
                      </tr>
                    ) : (
                      details.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={tdStyle('center', { color: '#888' })}>{i + 1}</td>
                          <td style={tdStyle('left')}>{fmtDate(row.date)}</td>
                          <td style={tdStyle('left')}>
                            <span style={{ fontWeight: 600 }}>{row.accountTitle || '-'}</span>
                            {row.billNo && (
                              <span
                                className="bill-badge no-print"
                                onClick={() => openBill(row)}
                                title="Click to view bill"
                                style={{
                                  marginLeft: 6, fontSize: 11, color: '#316ac5',
                                  background: '#eaf0fb', padding: '2px 7px',
                                  borderRadius: 3, border: '1px solid #b0c8f0',
                                  cursor: 'pointer', userSelect: 'none',
                                  display: 'inline-block',
                                }}
                              >
                                {row.billNo}
                              </span>
                            )}
                            {row.billNo && (
                              <span className="print-only" style={{ marginLeft: 6, fontSize: 11, color: '#555' }}>
                                {row.billNo}
                              </span>
                            )}
                          </td>
                          <td style={tdStyle('right')}>{fmtQty(row.preStock)}</td>
                          <td style={tdStyle('right', { color: row.purchaseQty > 0 ? '#1a5276' : '#aaa', fontWeight: row.purchaseQty > 0 ? 600 : 400 })}>
                            {row.purchaseQty > 0 ? fmtQty(row.purchaseQty) : '-'}
                          </td>
                          <td style={tdStyle('right', { color: row.purchaseReturnQty > 0 ? '#922b21' : '#aaa', fontWeight: row.purchaseReturnQty > 0 ? 600 : 400 })}>
                            {row.purchaseReturnQty > 0 ? fmtQty(row.purchaseReturnQty) : '-'}
                          </td>
                          <td style={tdStyle('right', { color: row.saleQty > 0 ? '#1e8449' : '#aaa', fontWeight: row.saleQty > 0 ? 600 : 400 })}>
                            {row.saleQty > 0 ? fmtQty(row.saleQty) : '-'}
                          </td>
                          <td style={tdStyle('right', { color: row.saleReturnQty > 0 ? '#784212' : '#aaa', fontWeight: row.saleReturnQty > 0 ? 600 : 400 })}>
                            {row.saleReturnQty > 0 ? fmtQty(row.saleReturnQty) : '-'}
                          </td>
                          <td style={tdStyle('right', {
                            color: row.adjustmentQty > 0 ? '#1e8449' : row.adjustmentQty < 0 ? '#d32f2f' : '#aaa',
                            fontWeight: row.adjustmentQty !== 0 ? 600 : 400
                          })}>
                            {row.adjustmentQty !== 0 ? (row.adjustmentQty > 0 ? `+${fmtQty(row.adjustmentQty)}` : fmtQty(row.adjustmentQty)) : '-'}
                          </td>
                          <td style={tdStyle('right', { fontWeight: 700 })}>{fmtQty(row.updatedStock)}</td>
                          <td style={tdStyle('right')}>{fmtAmt(row.amount)}</td>
                          <td style={tdStyle('center', { color: typeColors[row.type] || '#333', fontWeight: 600, fontSize: 11 })}>
                            {typeLabel[row.type] || row.type}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {details.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#2c3e50', color: 'white', fontWeight: 700 }}>
                        <td colSpan={4} style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'left' }}>Total</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{fmtQty(totals.purchase)}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{fmtQty(totals.purchaseReturn)}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{fmtQty(totals.sale)}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{fmtQty(totals.saleReturn)}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{totals.adjustment !== 0 ? (totals.adjustment > 0 ? `+${fmtQty(totals.adjustment)}` : fmtQty(totals.adjustment)) : '-'}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px' }}></td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px', textAlign: 'right' }}>{fmtAmt(totals.amount)}</td>
                        <td style={{ border: '1px solid #555', padding: '6px 8px' }}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* Bottom buttons */}
            <div className="no-print" style={{ padding: '8px 12px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f5f5f5' }}>
              <button onClick={handlePrint} disabled={!selectedProduct || details.length === 0}
                style={{ background: '#eee', border: '2px outset #bbb', padding: '6px 24px', cursor: 'pointer', fontSize: 14, minWidth: 90 }}>
                Print
              </button>
              <button onClick={() => router.back()}
                style={{ background: '#eee', border: '2px outset #bbb', padding: '6px 24px', cursor: 'pointer', fontSize: 14, minWidth: 90 }}>
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bill Viewer Modal ─────────────────────────────────────────── */}
      {billModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }}
          onClick={e => { if (e.target === e.currentTarget) setBillModal(false); }}
        >
          <div style={{
            background: 'white', borderRadius: 8, width: '100%', maxWidth: 760,
            maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}>
            {/* Title bar — blue like sales receipt */}
            <div style={{ background: '#1976d2', color: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {billData?._type === 'SALE_RETURN' ? 'Sale Return Invoice' : billData?._type === 'SALE' ? 'Receipt' : billData?._type === 'PURCHASE' ? 'Purchase Receipt' : 'Purchase Return'}
                {' - '}
                {billData?._type === 'SALE' ? `Bill #${billData.sale_id}` : billData?._type === 'SALE_RETURN' ? `#${billData.return_id}` : billData?._type === 'PURCHASE' ? `#${billData.pur_id}` : `#${billData?.id}`}
              </span>
              <button onClick={() => setBillModal(false)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1, background: 'white' }}>
              {billLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 15 }}>Loading bill...</div>
              ) : !billData ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>Could not load bill.</div>
              ) : (() => {
                const d = billData;
                const isSale = d._type === 'SALE';
                const isSaleReturn = d._type === 'SALE_RETURN';
                const isPurchase = d._type === 'PURCHASE';
                // Purchase returns stored in purchases table have _subType flag
                const isPurRetAsPur = d._subType === 'PURCHASE_RETURN_AS_PURCHASE';
                const isPurReturn = d._type === 'PURCHASE_RETURN' && !isPurRetAsPur;

                // Items list — purchase-returns-as-purchase use purchase_details
                const items = isSale ? (d.sale_details || [])
                  : isSaleReturn ? (d.return_details || [])
                  : (isPurchase || isPurRetAsPur) ? (d.purchase_details || [])
                  : (d.return_details || []);

                const getItemQty = it => (isSaleReturn || isPurReturn) ? (it.return_quantity ?? it.qnty) : it.qnty;
                const getItemRate = it => (isPurchase || isPurRetAsPur) ? (it.crate || it.unit_rate || 0) : it.unit_rate;
                const getItemAmt = it => isPurReturn ? it.return_amount : it.total_amount;

                const cus = d.customer || {};
                const billDate2 = d.created_at || d.return_date;
                const billNo = d.sale_id || d.return_id || d.pur_id || d.id;

                // Sale / Sale Return summary values
                const labour = parseFloat(d.labour_charges || d.labour_amount || 0);
                const shipping = parseFloat(d.shipping_amount || d.transport_amount || 0);
                const discount = parseFloat(d.discount || 0);
                const totalAmt = parseFloat(d.total_amount || d.total_return_amount || 0);
                const cash = parseFloat(d.cash_payment || 0);
                const bank = parseFloat(d.bank_payment || 0);
                const advance = parseFloat(d.advance_payment || 0);
                const totalPaid = parseFloat(d.payment || 0);
                const billAmt = totalAmt - labour - shipping + discount;
                const remaining = totalAmt - totalPaid;

                // Balance panel values (sale/purchase)
                const prevBal = parseFloat(d.previous_customer_balance ?? cus.cus_balance ?? 0);
                const currentDue = isSaleReturn
                  ? totalPaid  // refunded
                  : remaining;
                const totalDue = isSaleReturn
                  ? prevBal - totalPaid
                  : prevBal + remaining;

                return (
                  <div id="bill-modal-print-area" style={{ padding: 24 }}>

                    {/* Company Header */}
                    <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '2px solid #000' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, direction: 'rtl', fontFamily: 'serif', marginBottom: 4 }}>
                        اتفاق آئرن اینڈ سیمنٹ سٹور
                      </div>
                      <div style={{ fontSize: 13, direction: 'rtl', marginBottom: 4 }}>
                        گجرات سرگودھا روڈ، پاہڑیانوالی
                      </div>
                      <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: '#25D366' }}>📞</span>
                        Ph:- 0346-7560306, 0300-7560306
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, color: isSaleReturn ? '#d32f2f' : '#000' }}>
                        {isSale ? 'SALE INVOICE' : isSaleReturn ? 'SALE RETURN INVOICE' : isPurchase ? 'PURCHASE INVOICE' : 'PURCHASE RETURN'}
                      </div>
                    </div>

                    {/* Customer + Invoice Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #ddd', marginBottom: 14, fontSize: 13 }}>
                      <div style={{ flex: '0 0 50%' }}>
                        <div style={{ marginBottom: 4 }}>Customer Name: <strong>{cus.cus_name || 'N/A'}</strong></div>
                        <div style={{ marginBottom: 4 }}>Phone No: <strong>{cus.cus_phone_no || 'N/A'}</strong></div>
                        <div>Address: <strong>{cus.cus_address || 'N/A'}</strong></div>
                      </div>
                      <div style={{ flex: '0 0 50%', textAlign: 'right' }}>
                        <div style={{ marginBottom: 4 }}>Invoice No: <strong>#{billNo}</strong></div>
                        <div style={{ marginBottom: 4 }}>Time: <strong>{billDate2 ? new Date(billDate2).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</strong></div>
                        <div style={{ marginBottom: 4 }}>Date: <strong>{billDate2 ? new Date(billDate2).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</strong></div>
                        {d.invoice_number && <div style={{ marginBottom: 4 }}>Invoice#: <strong>{d.invoice_number}</strong></div>}
                        <div>Bill Type: <strong>{isSale ? 'BILL' : isSaleReturn ? 'SALE RETURN' : isPurchase ? 'PURCHASE' : 'PURCHASE RETURN'}</strong></div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 18 }}>
                      <thead>
                        <tr style={{ background: '#9e9e9e' }}>
                          <th style={{ border: '1px solid #bbb', padding: '6px 8px', color: 'white', textAlign: 'left' }}>S#</th>
                          <th style={{ border: '1px solid #bbb', padding: '6px 8px', color: 'white', textAlign: 'left' }}>Product Name</th>
                          <th style={{ border: '1px solid #bbb', padding: '6px 8px', color: 'white', textAlign: 'right' }}>Qty</th>
                          <th style={{ border: '1px solid #bbb', padding: '6px 8px', color: 'white', textAlign: 'right' }}>Rate</th>
                          <th style={{ border: '1px solid #bbb', padding: '6px 8px', color: 'white', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr><td colSpan={5} style={{ border: '1px solid #ddd', padding: 14, textAlign: 'center', color: '#999' }}>No items</td></tr>
                        ) : (
                          <>
                            {items.map((it, i) => (
                              <tr key={i}>
                                <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{i + 1}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{it.product?.pro_title || 'N/A'}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px 8px', textAlign: 'right' }}>{fmtAmtAlways(getItemQty(it))}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px 8px', textAlign: 'right' }}>{fmtAmtAlways(getItemRate(it))}</td>
                                <td style={{ border: '1px solid #ddd', padding: '4px 8px', textAlign: 'right' }}>{fmtAmtAlways(getItemAmt(it))}</td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>

                    {/* Bottom two-column summary */}
                    <div style={{ display: 'flex', gap: 16 }}>

                      {/* LEFT panel */}
                      <div style={{ flex: '0 0 48%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #000' }}>
                          <tbody>
                            {isSaleReturn ? (
                              <>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>منسوخ کردہ رقم</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(totalAmt)}</td>
                                </tr>
                                {discount > 0 && (
                                  <tr>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>رعایت</td>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>-{fmtAmtAlways(discount)}</td>
                                  </tr>
                                )}
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>مزدوری</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(labour)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کرایہ</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(shipping)}</td>
                                </tr>
                                <tr style={{ background: '#e8f5e9' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کل منسوخی</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>
                                    {fmtAmtAlways(totalAmt - discount + labour + shipping)}
                                  </td>
                                </tr>
                                <tr style={{ background: '#ffe0b2' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کل واپسی</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#e65100' }}>{fmtAmtAlways(totalPaid)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>سابقہ بقایا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(prevBal)}</td>
                                </tr>
                                <tr style={{ background: '#f5f5f5' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>موجودہ بقایا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(prevBal - totalPaid)}</td>
                                </tr>
                              </>
                            ) : (
                              <>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>سابقہ بقایا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(prevBal)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>موجوده بقايا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(remaining)}</td>
                                </tr>
                                <tr style={{ background: '#f5f5f5' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>كل بقايا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(prevBal + remaining)}</td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                        {/* Notes below left panel */}
                        {(d.notes || d.reference || d.reason || d.return_reason) && (
                          <div style={{ marginTop: 8, fontSize: 13 }}>
                            <strong>تبصرے:</strong> {d.notes || d.reference || d.reason || d.return_reason}
                          </div>
                        )}
                      </div>

                      {/* RIGHT panel */}
                      <div style={{ flex: '0 0 48%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #000' }}>
                          <tbody>
                            {isSaleReturn ? (
                              <>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>رقم بل</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(billAmt)}</td>
                                </tr>
                                {labour > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>مزدوری</td><td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(labour)}</td></tr>}
                                {shipping > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کرایہ</td><td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(shipping)}</td></tr>}
                                {discount > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>رعایت</td><td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>-{fmtAmtAlways(discount)}</td></tr>}
                                <tr style={{ background: '#f5f5f5' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کل واپسی رقم</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(totalAmt)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>نقد</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(cash)}</td>
                                </tr>
                                {bank > 0 && <tr><td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>{d.bank_title || 'بینک ادائیگی'}</td><td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(bank)}</td></tr>}
                                <tr style={{ background: '#e8f5e9' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>کل وصول شدہ</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>{fmtAmtAlways(totalPaid)}</td>
                                </tr>
                                <tr style={{ background: remaining > 0 ? '#ffe0b2' : '#e8f5e9' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>باقی واجب الادا</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#e65100' : '#2e7d32' }}>{fmtAmtAlways(remaining)}</td>
                                </tr>
                              </>
                            ) : (
                              <>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'رقم بل' : 'Bill Amount'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(isSale ? billAmt : totalAmt)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'مزدوری' : 'Labour'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(isSale ? labour : (d.labour_amount || 0))}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'کرایہ' : 'Transport'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(isSale ? shipping : (d.transport_amount || 0))}</td>
                                </tr>
                                {discount > 0 && (
                                  <tr>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'رعایت' : 'Discount'}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(discount)}</td>
                                  </tr>
                                )}
                                <tr style={{ background: '#f5f5f5' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'كل رقم' : 'Total Amount'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(totalAmt)}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'نقد كيش' : 'Cash'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(cash)}</td>
                                </tr>
                                {bank > 0 && (
                                  <tr>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{d.bank_title || (isSale ? 'بینک' : 'Bank Payment')}</td>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(bank)}</td>
                                  </tr>
                                )}
                                {advance > 0 && isSale && (
                                  <tr>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: 'rtl' }}>پیشگی ادائیگی</td>
                                    <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right' }}>{fmtAmtAlways(advance)}</td>
                                  </tr>
                                )}
                                <tr style={{ background: '#f5f5f5' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'كل رقم وصول' : 'Total Received'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(totalPaid)}</td>
                                </tr>
                                <tr style={{ background: '#d0d0d0' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: 700, direction: isSale ? 'rtl' : 'ltr' }}>{isSale ? 'بقايا رقم' : 'Remaining Due'}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtAmtAlways(remaining)}</td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer buttons */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setBillModal(false)}
                style={{ background: '#fff', border: '1px solid #bbb', padding: '6px 20px', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}>
                Close
              </button>
              <button onClick={handlePrintBill}
                style={{ background: '#1976d2', border: 'none', color: 'white', padding: '6px 20px', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}>
                🖨 Print A4
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
