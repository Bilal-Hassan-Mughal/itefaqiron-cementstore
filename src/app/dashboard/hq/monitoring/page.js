'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, CircularProgress, Alert, Typography, Button, FormControl, InputLabel,
  Select, MenuItem, Tabs, Tab, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton,
} from '@mui/material';
import {
  BarChart3, RefreshCw, Printer, ShoppingCart, Package, ShoppingBag,
  Warehouse, Eye, X, Download, Building2, Calendar,
} from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import HqPageHeader from '../components/hq-page-header';
import HqStatCard from '../components/hq-stat-card';
import { useHqSession } from '../components/use-hq-session';

function fmtMoney(n) {
  const v = Number(n || 0);
  if (v % 1 === 0) return v.toLocaleString('en-US');
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

function downloadCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  rows.forEach((row) => lines.push(row.map(escape).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f1f5f9' }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ textAlign: 'right', maxWidth: '60%' }}>{value ?? '—'}</Typography>
    </Box>
  );
}

export default function HqMonitoringPage() {
  const router = useRouter();
  const { user, ready } = useHqSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Draft filters (user edits)
  const [draftBranch, setDraftBranch] = useState('ALL');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  // Applied filters (used in API)
  const [appliedBranch, setAppliedBranch] = useState('ALL');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const [detailRow, setDetailRow] = useState(null);
  const [detailType, setDetailType] = useState(null);

  const loadReports = useCallback(async (currentUser, branch, from, to) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (branch && branch !== 'ALL') params.set('branch_id', branch);
      if (from) params.set('fromDate', from);
      if (to) params.set('toDate', to);
      const res = await branchFetch(currentUser, `/api/branches/hq-reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && user) {
      loadReports(user, appliedBranch, appliedFrom, appliedTo);
    }
  }, [ready, user, appliedBranch, appliedFrom, appliedTo, loadReports]);

  const applyFilters = () => {
    setAppliedBranch(draftBranch);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
  };

  const clearFilters = () => {
    setDraftBranch('ALL');
    setDraftFrom('');
    setDraftTo('');
    setAppliedBranch('ALL');
    setAppliedFrom('');
    setAppliedTo('');
  };

  const openDetail = (type, row) => {
    setDetailType(type);
    setDetailRow(row);
  };

  const handleExportSales = () => {
    if (!report?.sales?.length) return;
    downloadCsv(
      'hq-sales-report.csv',
      ['ID', 'Branch', 'Date', 'Customer', 'Bill Type', 'Amount', 'Payment'],
      report.sales.map((r) => [
        r.id, r.branch_code, fmtDate(r.date), r.customer, r.bill_type, r.amount, r.payment,
      ])
    );
  };

  const handleExportPurchases = () => {
    if (!report?.purchases?.length) return;
    downloadCsv(
      'hq-purchase-report.csv',
      ['ID', 'Branch', 'Date', 'Supplier', 'Invoice', 'Net Total', 'Payment'],
      report.purchases.map((r) => [
        r.id, r.branch_code, fmtDate(r.date), r.supplier, r.invoice_number, r.net_total, r.payment,
      ])
    );
  };

  const handleExportStock = () => {
    if (!report?.stock?.length) return;
    downloadCsv(
      'hq-stock-report.csv',
      ['Branch', 'Store', 'Product', 'Qty', 'Min', 'Status'],
      report.stock.map((r) => [
        r.branch_code, r.store_name, r.product_name, r.quantity, r.min_stock, r.status,
      ])
    );
  };

  if (!ready) return null;

  const summary = report?.summary;
  const branches = report?.branch_options || [];
  const byBranch = report?.by_branch || [];

  const tableHeadSx = { fontWeight: 800, bgcolor: '#f8fafc', color: '#334155', fontSize: '0.75rem' };

  return (
    <>
      <HqPageHeader
        icon={BarChart3}
        title="Reports & Monitoring"
        subtitle="Sales, purchases, and stock across all shop branches — filter by branch and date range."
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshCw size={16} />}
              onClick={() => user && loadReports(user, appliedBranch, appliedFrom, appliedTo)}
              disabled={loading}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Printer size={16} />}
              onClick={() => window.print()}
              sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#334155' }}
            >
              Print
            </Button>
          </Box>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filter toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2.5, bgcolor: 'white' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Branch</InputLabel>
              <Select
                value={draftBranch}
                label="Branch"
                onChange={(e) => setDraftBranch(e.target.value)}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Branches</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.branch_id} value={String(b.branch_id)}>
                    {b.branch_code} — {b.branch_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              fullWidth
              size="small"
              label="From date"
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
              sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              fullWidth
              size="small"
              label="To date"
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
              sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={applyFilters} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Apply Filters
              </Button>
              <Button variant="text" onClick={clearFilters} sx={{ fontWeight: 600 }}>
                Clear
              </Button>
              {(appliedFrom || appliedTo || appliedBranch !== 'ALL') && (
                <Chip
                  size="small"
                  icon={<Calendar size={12} />}
                  label={`${appliedBranch === 'ALL' ? 'All branches' : 'Filtered'}${appliedFrom ? ` · ${appliedFrom}` : ''}${appliedTo ? ` → ${appliedTo}` : ''}`}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Report tabs */}
      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: 'white', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 48 },
            '& .Mui-selected': { color: '#4338ca' },
            '& .MuiTabs-indicator': { bgcolor: '#4338ca', height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab icon={<Building2 size={16} />} iconPosition="start" label="Overview" />
          <Tab icon={<ShoppingCart size={16} />} iconPosition="start" label="Sales Report" />
          <Tab icon={<ShoppingBag size={16} />} iconPosition="start" label="Purchase Report" />
          <Tab icon={<Warehouse size={16} />} iconPosition="start" label="Stock Report" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress sx={{ color: '#4338ca' }} /></Box>
      ) : (
        <>
          {/* Tab-specific summary KPIs */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {activeTab === 0 && (
              <>
                <Grid item xs={6} md={3}>
                  <HqStatCard icon={Building2} label="Branches" value={summary?.branches ?? 0} color="#4338ca" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <HqStatCard icon={ShoppingCart} label="Sales (filtered)" value={summary?.sales_total_records ?? 0} color="#059669" sub={`PKR ${fmtMoney(summary?.sales_amount)}`} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <HqStatCard icon={ShoppingBag} label="Purchases (filtered)" value={summary?.purchase_total_records ?? 0} color="#d97706" sub={`PKR ${fmtMoney(summary?.purchase_amount)}`} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <HqStatCard icon={Warehouse} label="Stock Items" value={summary?.stock_items ?? 0} color="#ea580c" sub={`${summary?.low_stock_items ?? 0} low/out`} />
                </Grid>
              </>
            )}
            {activeTab === 1 && (
              <>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={ShoppingCart} label="Total Sales" value={summary?.sales_total_records ?? 0} color="#059669" />
                </Grid>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={ShoppingCart} label="Sales Amount" value={`PKR ${fmtMoney(summary?.sales_amount)}`} color="#4338ca" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <HqStatCard icon={BarChart3} label="Rows Loaded" value={report?.sales?.length ?? 0} color="#64748b" sub="Max 500 recent records" />
                </Grid>
              </>
            )}
            {activeTab === 2 && (
              <>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={ShoppingBag} label="Total Purchases" value={summary?.purchase_total_records ?? 0} color="#d97706" />
                </Grid>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={ShoppingBag} label="Purchase Amount" value={`PKR ${fmtMoney(summary?.purchase_amount)}`} color="#4338ca" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <HqStatCard icon={BarChart3} label="Rows Loaded" value={report?.purchases?.length ?? 0} color="#64748b" sub="Max 500 recent records" />
                </Grid>
              </>
            )}
            {activeTab === 3 && (
              <>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={Warehouse} label="Stock Lines" value={summary?.stock_items ?? 0} color="#ea580c" />
                </Grid>
                <Grid item xs={6} md={4}>
                  <HqStatCard icon={Package} label="Total Quantity" value={fmtMoney(summary?.stock_qty)} color="#4338ca" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <HqStatCard icon={Warehouse} label="Low / Out of Stock" value={summary?.low_stock_items ?? 0} color="#dc2626" />
                </Grid>
              </>
            )}
          </Grid>

          {/* OVERVIEW TAB */}
          {activeTab === 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Typography fontWeight={800}>Branch Comparison Summary</Typography>
                <Typography variant="caption" color="text.secondary">
                  Sales & purchases respect date filter · Stock is current snapshot
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>Branch</TableCell>
                    <TableCell sx={tableHeadSx}>Status</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Sales</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Sales PKR</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Purchases</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Purchase PKR</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Stock Qty</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Low Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byBranch.map((b) => (
                    <TableRow key={b.branch_id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/hq/branches/${b.branch_id}`)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>{b.branch_name}</Typography>
                        <Chip size="small" label={b.branch_code} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={b.status} color={b.status === 'ACTIVE' ? 'success' : 'default'} sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell align="right"><strong>{b.sales_count}</strong></TableCell>
                      <TableCell align="right" sx={{ color: '#059669', fontWeight: 700 }}>{fmtMoney(b.sales_amount)}</TableCell>
                      <TableCell align="right"><strong>{b.purchase_count}</strong></TableCell>
                      <TableCell align="right" sx={{ color: '#d97706', fontWeight: 700 }}>{fmtMoney(b.purchase_amount)}</TableCell>
                      <TableCell align="right">{fmtMoney(b.stock_qty)}</TableCell>
                      <TableCell align="right">
                        {b.low_stock > 0 ? (
                          <Chip size="small" label={b.low_stock} color="warning" sx={{ fontWeight: 700, height: 22 }} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">0</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {byBranch.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>No branch data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* SALES REPORT TAB */}
          {activeTab === 1 && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={800}>Sales Report — Detail</Typography>
                <Button size="small" startIcon={<Download size={14} />} onClick={handleExportSales} sx={{ fontWeight: 700 }}>
                  Export CSV
                </Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>#</TableCell>
                    <TableCell sx={tableHeadSx}>Branch</TableCell>
                    <TableCell sx={tableHeadSx}>Date</TableCell>
                    <TableCell sx={tableHeadSx}>Customer</TableCell>
                    <TableCell sx={tableHeadSx}>Type</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Amount (PKR)</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report?.sales || []).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell><strong>{r.id}</strong></TableCell>
                      <TableCell>
                        <Chip size="small" label={r.branch_code} sx={{ fontWeight: 700, fontFamily: 'monospace', height: 22 }} />
                      </TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(r.date)}</Typography></TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell><Chip size="small" label={r.bill_type} variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} /></TableCell>
                      <TableCell align="right"><strong>{fmtMoney(r.amount)}</strong></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openDetail('sale', r)} sx={{ color: '#4338ca' }}>
                          <Eye size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report?.sales || report.sales.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No sales found for selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* PURCHASE REPORT TAB */}
          {activeTab === 2 && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={800}>Purchase Report — Detail</Typography>
                <Button size="small" startIcon={<Download size={14} />} onClick={handleExportPurchases} sx={{ fontWeight: 700 }}>
                  Export CSV
                </Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>#</TableCell>
                    <TableCell sx={tableHeadSx}>Branch</TableCell>
                    <TableCell sx={tableHeadSx}>Date</TableCell>
                    <TableCell sx={tableHeadSx}>Supplier</TableCell>
                    <TableCell sx={tableHeadSx}>Invoice</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Net (PKR)</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report?.purchases || []).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell><strong>{r.id}</strong></TableCell>
                      <TableCell>
                        <Chip size="small" label={r.branch_code} sx={{ fontWeight: 700, fontFamily: 'monospace', height: 22 }} />
                      </TableCell>
                      <TableCell><Typography variant="caption">{fmtDate(r.date)}</Typography></TableCell>
                      <TableCell>{r.supplier}</TableCell>
                      <TableCell>{r.invoice_number}</TableCell>
                      <TableCell align="right"><strong>{fmtMoney(r.net_total)}</strong></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openDetail('purchase', r)} sx={{ color: '#4338ca' }}>
                          <Eye size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report?.purchases || report.purchases.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No purchases found for selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* STOCK REPORT TAB */}
          {activeTab === 3 && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography fontWeight={800}>Stock Report — Detail</Typography>
                  <Typography variant="caption" color="text.secondary">Current warehouse stock snapshot (date filter does not apply)</Typography>
                </Box>
                <Button size="small" startIcon={<Download size={14} />} onClick={handleExportStock} sx={{ fontWeight: 700 }}>
                  Export CSV
                </Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>Branch</TableCell>
                    <TableCell sx={tableHeadSx}>Store</TableCell>
                    <TableCell sx={tableHeadSx}>Product</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Quantity</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Min</TableCell>
                    <TableCell sx={tableHeadSx}>Status</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report?.stock || []).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Chip size="small" label={r.branch_code} sx={{ fontWeight: 700, fontFamily: 'monospace', height: 22 }} />
                      </TableCell>
                      <TableCell>{r.store_name}</TableCell>
                      <TableCell><strong>{r.product_name}</strong></TableCell>
                      <TableCell align="right"><strong>{fmtMoney(r.quantity)}</strong> {r.unit}</TableCell>
                      <TableCell align="right">{fmtMoney(r.min_stock)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.status}
                          color={r.status === 'OK' ? 'success' : r.status === 'LOW' ? 'warning' : 'error'}
                          sx={{ fontWeight: 700, height: 22, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openDetail('stock', r)} sx={{ color: '#4338ca' }}>
                          <Eye size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report?.stock || report.stock.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No stock records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailRow} onClose={() => setDetailRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
          {detailType === 'sale' && `Sale #${detailRow?.id}`}
          {detailType === 'purchase' && `Purchase #${detailRow?.id}`}
          {detailType === 'stock' && 'Stock Detail'}
          <IconButton size="small" onClick={() => setDetailRow(null)}><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailType === 'sale' && detailRow && (
            <>
              <DetailRow label="Branch" value={`${detailRow.branch_code} — ${detailRow.branch_name}`} />
              <DetailRow label="Date" value={fmtDate(detailRow.date)} />
              <DetailRow label="Customer" value={detailRow.customer} />
              <DetailRow label="Bill Type" value={detailRow.bill_type} />
              <DetailRow label="Bill Number" value={detailRow.bill_number ?? '—'} />
              <DetailRow label="Total Amount" value={`PKR ${fmtMoney(detailRow.amount)}`} />
              <DetailRow label="Discount" value={`PKR ${fmtMoney(detailRow.discount)}`} />
              <DetailRow label="Payment" value={`PKR ${fmtMoney(detailRow.payment)}`} />
              <DetailRow label="Payment Type" value={detailRow.payment_type} />
            </>
          )}
          {detailType === 'purchase' && detailRow && (
            <>
              <DetailRow label="Branch" value={`${detailRow.branch_code} — ${detailRow.branch_name}`} />
              <DetailRow label="Date" value={fmtDate(detailRow.date)} />
              <DetailRow label="Supplier" value={detailRow.supplier} />
              <DetailRow label="Invoice" value={detailRow.invoice_number} />
              <DetailRow label="Vehicle" value={detailRow.vehicle_no} />
              <DetailRow label="Total Amount" value={`PKR ${fmtMoney(detailRow.amount)}`} />
              <DetailRow label="Discount" value={`PKR ${fmtMoney(detailRow.discount)}`} />
              <DetailRow label="Net Total" value={`PKR ${fmtMoney(detailRow.net_total)}`} />
              <DetailRow label="Payment" value={`PKR ${fmtMoney(detailRow.payment)}`} />
              <DetailRow label="Payment Type" value={detailRow.payment_type} />
            </>
          )}
          {detailType === 'stock' && detailRow && (
            <>
              <DetailRow label="Branch" value={`${detailRow.branch_code} — ${detailRow.branch_name}`} />
              <DetailRow label="Store" value={detailRow.store_name} />
              <DetailRow label="Product" value={detailRow.product_name} />
              <DetailRow label="Product ID" value={detailRow.product_id} />
              <DetailRow label="Quantity" value={`${fmtMoney(detailRow.quantity)} ${detailRow.unit}`} />
              <DetailRow label="Min Stock" value={fmtMoney(detailRow.min_stock)} />
              <DetailRow label="Max Stock" value={fmtMoney(detailRow.max_stock)} />
              <DetailRow label="Status" value={detailRow.status} />
              <DetailRow label="Last Updated" value={fmtDate(detailRow.updated_at)} />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailRow(null)} sx={{ fontWeight: 700 }}>Close</Button>
          {detailRow?.branch_id && (
            <Button
              variant="contained"
              onClick={() => { setDetailRow(null); router.push(`/dashboard/hq/branches/${detailRow.branch_id}`); }}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Open Branch
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
