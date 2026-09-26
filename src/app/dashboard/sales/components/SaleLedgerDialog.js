'use client';

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Chip,
  Tooltip,
  CircularProgress,
  Avatar,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  ListAlt as ListAltIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';

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
  } = useSalesContext();

  return (
    <Dialog
      open={ledgerDialogOpen}
      onClose={() => setLedgerDialogOpen(false)}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
        }
      }}
    >
      <DialogTitle sx={{
        bgcolor: 'primary.main',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: 'white', color: 'primary.main' }}>
            <ListAltIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Customer Ledger: {formSelectedCustomer?.cus_name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Detailed financial statement and transaction history
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setLedgerDialogOpen(false)} size="small" sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
            FILTER BY DATE:
          </Typography>
          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={ledgerStartDate}
            onChange={(e) => setLedgerStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
            sx={{ bgcolor: 'white' }}
          />
          <TextField
            size="small"
            type="date"
            label="End Date"
            value={ledgerEndDate}
            onChange={(e) => setLedgerEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
            sx={{ bgcolor: 'white' }}
          />
          <Button
            variant="contained"
            onClick={() => fetchLedgerData(formSelectedCustomer?.cus_id)}
            disabled={ledgerLoading}
            startIcon={ledgerLoading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}
          >
            Update Report
          </Button>
        </Box>

        {ledgerData ? (
          <>
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={3}>
                <Card sx={{ bgcolor: 'grey.50', borderBottom: '4px solid', borderColor: 'grey.400' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Opening Balance</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{ledgerData.summary.openingBalance.toFixed(0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card sx={{ bgcolor: 'success.50', borderBottom: '4px solid', borderColor: 'success.main' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Total Debit (Sales)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'success.main' }}>{ledgerData.summary.totalDebit.toFixed(0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card sx={{ bgcolor: 'error.50', borderBottom: '4px solid', borderColor: 'error.main' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Total Credit (Payments)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'error.main' }}>{ledgerData.summary.totalCredit.toFixed(0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card sx={{ bgcolor: 'primary.50', borderBottom: '4px solid', borderColor: 'primary.main' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Closing Balance</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1, color: 'primary.main' }}>{ledgerData.summary.closingBalance.toFixed(0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Ledger Entries Table */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptIcon color="primary" /> Transaction History
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid', borderColor: 'divider' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Bill No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Debit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Credit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerData.ledgerEntries.map((entry, idx) => {
                    const isCredit = parseFloat(entry.credit_amount || 0) > 0;
                    const isDebit = parseFloat(entry.debit_amount || 0) > 0 && !isCredit;
                    const hoverBg = isCredit ? '#dcfce7 !important' : isDebit ? '#fee2e2 !important' : '#e0f2fe !important';
                    const accentColor = isCredit ? '#16a34a !important' : isDebit ? '#dc2626 !important' : '#0284c7 !important';
                    const baseBg = isCredit ? '#f0fdf4' : isDebit ? '#fef2f2' : 'inherit';
                    return (
                      <TableRow
                        key={idx}
                        hover
                        sx={{
                          bgcolor: baseBg,
                          '&:last-child td, &:last-child th': { border: 0 },
                          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: hoverBg,
                            boxShadow: `inset 4px 0 0 ${accentColor}`
                          }
                        }}
                      >
                        <TableCell>{formatDatePK(entry?.created_at) || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.trnx_type}
                            size="small"
                            color={entry.trnx_type === 'SALE' ? 'primary' : entry.trnx_type === 'PAYMENT' ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 'bold', borderRadius: 1 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'medium' }}>{entry.bill_no || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={entry.details || entry.payments?.[0]?.payment_details || ''}>
                            <span>{entry.details || entry.payments?.[0]?.payment_details || '-'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ color: entry.debit_amount > 0 ? 'success.main' : 'inherit', fontWeight: entry.debit_amount > 0 ? 'bold' : 'normal' }}>
                          {entry.debit_amount > 0 ? entry.debit_amount.toFixed(0) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: entry.credit_amount > 0 ? 'error.main' : 'inherit', fontWeight: entry.credit_amount > 0 ? 'bold' : 'normal' }}>
                          {entry.credit_amount > 0 ? entry.credit_amount.toFixed(0) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{entry.closing_balance.toFixed(0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <Box sx={{ py: 12, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
            {ledgerLoading ? (
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={40} />
                <Typography color="text.secondary">Fetching ledger data...</Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={1}>
                <InfoIcon sx={{ fontSize: 48, color: 'grey.300' }} />
                <Typography color="text.secondary">No ledger data available for the selected range.</Typography>
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2.5, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={() => setLedgerDialogOpen(false)}
          variant="contained"
          color="primary"
          sx={{ px: 4 }}
        >
          Close Statement
        </Button>
      </DialogActions>
    </Dialog>
  );
}
