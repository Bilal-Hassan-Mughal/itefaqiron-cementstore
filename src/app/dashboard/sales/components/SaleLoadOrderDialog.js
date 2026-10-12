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
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ListAlt as ListAltIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';

export default function SaleLoadOrderDialog() {
  const {
    loadOrderDialogOpen,
    setLoadOrderDialogOpen,
    orderSearchTerm,
    setOrderSearchTerm,
    loadOrderListLoading,
    loadOrderList,
    getBillDisplayNo,
    handleLoadOrder,
  } = useSalesContext();

  return (
    <Dialog
      open={loadOrderDialogOpen}
      onClose={() => setLoadOrderDialogOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ListAltIcon sx={{ mr: 2 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Load Order
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Select an order to load into the bill
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setLoadOrderDialogOpen(false)} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by customer name, order ID, or order number..."
            value={orderSearchTerm}
            onChange={(e) => setOrderSearchTerm(e.target.value)}
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
                <TableCell>Bill #</TableCell>
                <TableCell>Order #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadOrderListLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Loading orders...
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {loadOrderList
                    .filter(sale => {
                      if (!orderSearchTerm) return true;

                      const searchLower = orderSearchTerm.toLowerCase();
                      const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                      const matchesId = sale.sale_id?.toString().includes(searchLower);
                      const orderNo = String(sale.order_number || sale.order_no || '');
                      const matchesOrderNo =
                        String(sale.bill_number || '').includes(searchLower) ||
                        orderNo.toLowerCase().includes(searchLower);

                      return matchesName || matchesId || matchesOrderNo;
                    })
                    .map((sale) => (
                      <TableRow key={sale.sale_id} hover>
                        <TableCell>{getBillDisplayNo(sale)}</TableCell>
                        <TableCell>{sale.order_number || sale.order_no || '—'}</TableCell>
                        <TableCell>{sale.customer?.cus_name || 'N/A'}</TableCell>
                        <TableCell>{formatDatePK(sale?.created_at) || '—'}</TableCell>
                        <TableCell align="right">{parseFloat(sale.total_amount || 0).toFixed(0)}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => handleLoadOrder(sale)}
                            startIcon={<ShoppingCartIcon />}
                          >
                            Load
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {loadOrderList.filter(sale => {
                    if (!orderSearchTerm) return true;

                    const searchLower = orderSearchTerm.toLowerCase();
                    const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                    const matchesId = sale.sale_id?.toString().includes(searchLower);
                    const orderNo = String(sale.order_number || sale.order_no || '');
                    const matchesOrderNo =
                      String(sale.bill_number || '').includes(searchLower) ||
                      orderNo.toLowerCase().includes(searchLower);

                    return matchesName || matchesId || matchesOrderNo;
                  }).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        {orderSearchTerm ? 'No matching orders found' : 'No orders found'}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setLoadOrderDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
