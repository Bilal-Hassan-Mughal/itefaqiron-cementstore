'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Tooltip,
  CircularProgress,
  Avatar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Fade,
  FormControl,
  Select,
  MenuItem,
  Pagination,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  ListAlt as ListAltIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CalendarToday as CalendarIcon,
  ArrowForward as ArrowIcon,
  AccountBalance as BankIcon,
  AccountBalanceWallet as CashIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Phone as PhoneIcon,
  LocationOn as MapPinIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';
import { BRAND } from '@/lib/brand-theme';

const LEDGER_UI = {
  headerBtn: {
    textTransform: 'none',
    fontWeight: 700,
    borderRadius: '10px',
    fontSize: '0.8125rem',
    px: 2,
    py: 0.75,
    boxShadow: 'none',
    '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
  },
  infoCard: {
    bgcolor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #eef1f6',
    p: 2.5,
    mb: 3,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  statLabel: {
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '0.7rem',
    letterSpacing: '0.05em',
    mb: 0.25
  },
  statValue: (color) => ({
    color: color || '#1e293b',
    fontWeight: 800,
    fontSize: '1rem',
    fontFamily: 'monospace'
  }),
  tableHeadRow: {
    '& .MuiTableCell-head': {
      bgcolor: BRAND.primary.blue,
      color: '#ffffff',
      fontWeight: 800,
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      py: 1.75,
      px: 2,
      borderRight: '1px solid rgba(255,255,255,0.1)',
      '&:last-child': { borderRight: 'none' },
    },
  },
  tableGrid: {
    '& .MuiTableCell-root': {
      py: 1.5,
      px: 2,
      fontSize: '0.8125rem',
      borderBottom: '1px solid #f1f5f9',
      color: '#334155',
      lineHeight: 1.4
    },
  },
};

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SaleLedgerDialog() {
  const {
    ledgerDialogOpen,
    setLedgerDialogOpen,
    formSelectedCustomer,
    ledgerStartDate,
    setLedgerStartDate,
    ledgerEndDate,
    setLedgerEndDate,
    fetchLedgerData,
    ledgerLoading,
    ledgerData,
    handleViewBill,
  } = useSalesContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  const filteredEntries = useMemo(() => {
    return (ledgerData?.ledgerEntries || []).filter(entry => {
      if (!searchTerm.trim()) return true;
      const s = searchTerm.toLowerCase();
      return (
        entry.trnx_type?.toLowerCase().includes(s) ||
        String(entry.bill_no || '').toLowerCase().includes(s) ||
        entry.details?.toLowerCase().includes(s) ||
        (entry.payments?.[0]?.payment_details || '').toLowerCase().includes(s) ||
        String(entry.debit_amount || '').includes(s) ||
        String(entry.credit_amount || '').includes(s)
      );
    });
  }, [ledgerData, searchTerm]);

  const displayedEntries = useMemo(() => {
    if (rowsPerPage === -1) return filteredEntries;
    const start = (page - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, page, rowsPerPage]);

  const handleViewDocument = (entry) => {
    if (!entry || !entry.bill_no) return;
    const ref = String(entry.bill_no).trim();
    if (!ref) return;

    const isReturn = (entry.details || '').toLowerCase().includes('sale return') || 
                     (entry.ledger_type || '').toLowerCase().includes('sale return') ||
                     ref.startsWith('SR-');

    const cleanId = ref.replace(/^[A-Za-z]+-/, '');
    
    handleViewBill({
      sale_id: cleanId,
      bill_number: cleanId,
      is_return: isReturn,
      bill_type: isReturn ? 'SALE_RETURN' : 'BILL'
    });
  };

  return (
    <Dialog
      open={ledgerDialogOpen}
      onClose={() => setLedgerDialogOpen(false)}
      maxWidth="lg"
      fullWidth
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 400 }}
      PaperProps={{
        sx: {
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }
      }}
    >
      <DialogTitle sx={{
        bgcolor: '#ffffff',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: BRAND.primary.blue, width: 40, height: 40 }}>
            <ListAltIcon />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Customer Ledger
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{ ...LEDGER_UI.headerBtn, borderColor: '#cbd5e1', color: '#475569' }}
          >
            Print
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{ ...LEDGER_UI.headerBtn, bgcolor: BRAND.primary.blue }}
          >
            Export
          </Button>
          <IconButton 
            onClick={() => setLedgerDialogOpen(false)} 
            sx={{ color: '#ef4444', ml: 1 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3.5, bgcolor: '#f8fafc' }}>
        {/* Customer Info Card */}
        <Box sx={LEDGER_UI.infoCard}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 250px' }}>
            <Avatar sx={{ bgcolor: BRAND.tint.blue, color: BRAND.primary.blue }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>CUSTOMER NAME</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                {formSelectedCustomer?.cus_name || 'N/A'}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ flex: '1 1 180px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>CONTACT</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
              {formSelectedCustomer?.cus_phone_no || '—'}
            </Typography>
          </Box>

          <Box sx={{ flex: '1 1 200px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <MapPinIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>ADDRESS</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', maxWidth: 250 }}>
              {formSelectedCustomer?.cus_address || '—'}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ mx: 1, display: { xs: 'none', md: 'block' } }} />

          <Box sx={{ textAlign: { xs: 'left', md: 'right' }, flex: '1 1 150px' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>CURRENT BALANCE</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: (formSelectedCustomer?.cus_balance || 0) < 0 ? '#ef4444' : BRAND.primary.blue }}>
              {fmtAmt(formSelectedCustomer?.cus_balance)}
            </Typography>
          </Box>
        </Box>

        {/* Filters and Summary Bar */}
        <Box sx={{ 
          mb: 3, 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: 3
        }}>
          {/* Filters */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="date"
              label="From"
              value={ledgerStartDate}
              onChange={(e) => setLedgerStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: '8px' } }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={ledgerEndDate}
              onChange={(e) => setLedgerEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: '8px' } }}
            />
            <Button
              variant="contained"
              onClick={() => fetchLedgerData(formSelectedCustomer?.cus_id)}
              disabled={ledgerLoading}
              sx={{ 
                bgcolor: '#1e293b', 
                '&:hover': { bgcolor: '#0f172a' }, 
                height: 40, 
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700
              }}
            >
              Update Report
            </Button>
            <TextField
              size="small"
              placeholder="Search description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: '#94a3b8' }} />,
                sx: { bgcolor: '#fff', borderRadius: '8px', minWidth: 220 }
              }}
            />
          </Box>

          {/* Summary Text Labels */}
          {ledgerData && (
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={LEDGER_UI.statLabel}>Opening</Typography>
                <Typography sx={LEDGER_UI.statValue()}>{fmtAmt(ledgerData.summary.openingBalance)}</Typography>
              </Box>
              <Box>
                <Typography sx={LEDGER_UI.statLabel}>Total Debit</Typography>
                <Typography sx={LEDGER_UI.statValue('#ef4444')}>{fmtAmt(ledgerData.summary.totalDebit)}</Typography>
              </Box>
              <Box>
                <Typography sx={LEDGER_UI.statLabel}>Total Credit</Typography>
                <Typography sx={LEDGER_UI.statValue('#10b981')}>{fmtAmt(ledgerData.summary.totalCredit)}</Typography>
              </Box>
              <Box>
                <Typography sx={LEDGER_UI.statLabel}>Closing</Typography>
                <Typography sx={LEDGER_UI.statValue(BRAND.primary.blue)}>{fmtAmt(ledgerData.summary.closingBalance)}</Typography>
              </Box>
            </Box>
          )}
        </Box>

        {ledgerData ? (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: 500, boxShadow: 'none' }}>
              <Table stickyHeader size="small" sx={LEDGER_UI.tableGrid}>
                <TableHead>
                  <TableRow sx={LEDGER_UI.tableHeadRow}>
                    <TableCell width="50" align="center">#</TableCell>
                    <TableCell width="120">Date</TableCell>
                    <TableCell width="120">Type</TableCell>
                    <TableCell>Particulars</TableCell>
                    <TableCell width="100">Bill No</TableCell>
                    <TableCell width="120" align="right">Debit (PKR)</TableCell>
                    <TableCell width="120" align="right">Credit (PKR)</TableCell>
                    <TableCell width="130" align="right">Balance (PKR)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedEntries.map((entry, idx) => {
                    const isCredit = parseFloat(entry.credit_amount || 0) > 0;
                    const isDebit = parseFloat(entry.debit_amount || 0) > 0 && !isCredit;
                    const serialNo = (page - 1) * rowsPerPage + idx + 1;
                    
                    return (
                      <TableRow key={idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell align="center" sx={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.75rem' }}>
                          {serialNo}
                        </TableCell>
                        <TableCell sx={{ color: '#64748b', fontWeight: 500 }}>
                          {formatDatePK(entry?.created_at)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={entry.trnx_type}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.65rem',
                              height: 20,
                              textTransform: 'uppercase',
                              bgcolor: entry.trnx_type === 'SALE' ? '#eff6ff' : 
                                       entry.trnx_type === 'SALE_RETURN' ? '#fff7ed' :
                                       entry.trnx_type === 'PAYMENT' ? '#ecfdf5' : '#f1f5f9',
                              color: entry.trnx_type === 'SALE' ? '#1d4ed8' : 
                                     entry.trnx_type === 'SALE_RETURN' ? '#c2410c' :
                                     entry.trnx_type === 'PAYMENT' ? '#047857' : '#64748b',
                              borderRadius: '6px'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                            {entry.details || entry.payments?.[0]?.payment_details || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {entry.bill_no ? (
                            <Box 
                              onClick={() => handleViewDocument(entry)}
                              sx={{ 
                                cursor: 'pointer', 
                                color: BRAND.primary.blue,
                                fontWeight: 700,
                                '&:hover': { textDecoration: 'underline' },
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              {entry.bill_no}
                              <VisibilityIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                            </Box>
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: entry.debit_amount > 0 ? '#ef4444' : '#e2e8f0', fontFamily: 'monospace' }}>
                          {entry.debit_amount > 0 ? fmtAmt(entry.debit_amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: entry.credit_amount > 0 ? '#10b981' : '#e2e8f0', fontFamily: 'monospace' }}>
                          {entry.credit_amount > 0 ? fmtAmt(entry.credit_amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: BRAND.primary.blue, bgcolor: '#f8fafc', fontFamily: 'monospace' }}>
                          {fmtAmt(entry.closing_balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                        No matching transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination Controls */}
            <Box sx={{ 
              mt: 2.5, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" variant="outlined" sx={{ minWidth: 140 }}>
                  <Select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    size="small"
                    sx={{ height: 32, fontSize: '0.8125rem', bgcolor: '#ffffff', borderRadius: '8px' }}
                  >
                    <MenuItem value={50}>50 per page</MenuItem>
                    <MenuItem value={100}>100 per page</MenuItem>
                    <MenuItem value={200}>200 per page</MenuItem>
                    <MenuItem value={500}>500 per page</MenuItem>
                    <MenuItem value={-1}>All entries</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.8125rem' }}>
                  Showing {Math.min((page - 1) * rowsPerPage + 1, filteredEntries.length)}–{Math.min(page * rowsPerPage, filteredEntries.length)} of {filteredEntries.length} entries
                </Typography>
              </Box>

              {rowsPerPage !== -1 && Math.ceil(filteredEntries.length / rowsPerPage) > 1 && (
                <Pagination
                  count={Math.ceil(filteredEntries.length / rowsPerPage)}
                  page={page}
                  onChange={(e, v) => setPage(v)}
                  color="primary"
                  size="small"
                  sx={{ 
                    '& .MuiPaginationItem-root': { fontWeight: 700, borderRadius: '8px' },
                    '& .Mui-selected': { bgcolor: BRAND.primary.blue, color: '#fff', '&:hover': { bgcolor: '#1347c4' } }
                  }}
                />
              )}
            </Box>
          </>
        ) : (
          <Box sx={{ 
            py: 12, 
            textAlign: 'center', 
            bgcolor: '#fff', 
            borderRadius: '20px', 
            border: '2px dashed #e2e8f0',
          }}>
            {ledgerLoading ? (
              <Stack alignItems="center" spacing={3}>
                <CircularProgress size={48} thickness={4} sx={{ color: BRAND.primary.blue }} />
                <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Generating financial statement...
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: '#f8fafc', color: '#cbd5e1', width: 80, height: 80, mb: 1 }}>
                  <InfoIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h6" sx={{ color: '#475569', fontWeight: 700 }}>
                  No statement data available
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 320 }}>
                  Select a date range and click "Update Report".
                </Typography>
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
