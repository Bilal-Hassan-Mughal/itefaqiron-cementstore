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
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';

export default function SaleQuotationDialog() {
  const {
    loadQuotationDialogOpen,
    setLoadQuotationDialogOpen,
    quotationSearchTerm,
    setQuotationSearchTerm,
    sales,
    getBillDisplayNo,
    handleLoadQuotation,
  } = useSalesContext();

  return (
    <Dialog
      open={loadQuotationDialogOpen}
      onClose={() => setLoadQuotationDialogOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(45deg, #ed6c02 30%, #ff9800 90%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReceiptIcon sx={{ mr: 2 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Load Quotation
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Select a quotation to load into the bill
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setLoadQuotationDialogOpen(false)} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by customer name or quotation ID..."
            value={quotationSearchTerm}
            onChange={(e) => setQuotationSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Quotation ID</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales
                .filter(sale => {
                  const isQuotation = sale.bill_type === 'QUOTATION';
                  if (!isQuotation) return false;

                  if (!quotationSearchTerm) return true;

                  const searchLower = quotationSearchTerm.toLowerCase();
                  const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                  const matchesId = sale.sale_id?.toString().includes(searchLower);

                  return matchesName || matchesId;
                })
                .map((sale) => (
                  <TableRow key={sale.sale_id} hover>
                    <TableCell>{getBillDisplayNo(sale)}</TableCell>
                    <TableCell>{sale.customer?.cus_name || 'N/A'}</TableCell>
                    <TableCell>{formatDatePK(sale?.created_at) || '—'}</TableCell>
                    <TableCell align="right">{parseFloat(sale.total_amount || 0).toFixed(0)}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => handleLoadQuotation(sale)}
                        startIcon={<ShoppingCartIcon />}
                      >
                        Load
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {sales.filter(sale => {
                const isQuotation = sale.bill_type === 'QUOTATION';
                if (!isQuotation) return false;

                if (!quotationSearchTerm) return true;

                const searchLower = quotationSearchTerm.toLowerCase();
                const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                const matchesId = sale.sale_id?.toString().includes(searchLower);

                return matchesName || matchesId;
              }).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    {quotationSearchTerm ? 'No matching quotations found' : 'No quotations found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setLoadQuotationDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
