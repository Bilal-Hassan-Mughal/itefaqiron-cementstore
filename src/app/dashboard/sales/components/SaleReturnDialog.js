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
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingDown as TrendingDownIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';


export default function SaleReturnDialog() {
  const {
    returnDialogOpen,
    handleCloseReturnDialog,
    selectedSaleForReturn,
    returnFormData,
    products,
    updateReturnDetailQty,
    removeReturnDetail,
    handleReturnInputChange,
    calculateReturnTotal,
    calculateReturnNetTotal,
    handleSubmitReturn,
  } = useSalesContext();

  return (
    <Dialog
      open={returnDialogOpen}
      onClose={handleCloseReturnDialog}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'error.main',
        color: 'white',
        py: 2,
        px: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDownIcon />
          <Typography variant="h6" component="span">Process Sale Return</Typography>
        </Box>
        <IconButton
          onClick={handleCloseReturnDialog}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {selectedSaleForReturn && (
          <Box>
            {/* Sale Information */}
            <Card sx={{ mb: 3, bgcolor: 'info.light', p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Sale Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Sale ID:</strong> #{selectedSaleForReturn.sale_id}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Customer:</strong> {selectedSaleForReturn.customer?.cus_name || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Total Amount:</strong> {parseFloat(selectedSaleForReturn.total_amount || 0).toFixed(0)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Date:</strong> {formatDatePK(selectedSaleForReturn?.created_at) || '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Bill Type:</strong> {selectedSaleForReturn.bill_type || 'BILL'}</Typography>
                </Grid>
              </Grid>
            </Card>

            {/* Return Products */}
            <Typography variant="h6" sx={{ mb: 2 }}>Products to Return</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.200' }}>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {returnFormData.return_details.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No products selected</TableCell>
                    </TableRow>
                  ) : (
                    returnFormData.return_details.map((detail, index) => {
                      const product = products.find(p => p.pro_id === detail.pro_id);
                      return (
                        <TableRow key={index}>
                          <TableCell>{product?.pro_title || 'N/A'}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              value={detail.qnty}
                              onChange={(e) => updateReturnDetailQty(index, e.target.value)}
                              sx={{ width: 80 }}
                              inputProps={{ min: 0 }}
                            />
                          </TableCell>
                          <TableCell align="right">{parseFloat(detail.unit_rate || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(detail.total_amount || 0).toFixed(0)}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeReturnDetail(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Return Form */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Bill Type</InputLabel>
                  <Select
                    name="bill_type"
                    value={returnFormData.bill_type}
                    onChange={handleReturnInputChange}
                    label="Bill Type"
                    disabled
                  >
                    <MenuItem value="BILL">Bill</MenuItem>
                    <MenuItem value="QUOTATION">Quotation</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Reference"
                  name="reference"
                  value={returnFormData.reference}
                  onChange={handleReturnInputChange}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Return Reason *"
                  name="reason"
                  value={returnFormData.reason}
                  onChange={handleReturnInputChange}
                  multiline
                  rows={3}
                  required
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Total Amount"
                  value={calculateReturnTotal().toFixed(0)}
                  disabled
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Discount"
                  name="discount"
                  type="number"
                  value={returnFormData.discount}
                  onChange={handleReturnInputChange}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Net Total"
                  value={calculateReturnNetTotal().toFixed(0)}
                  disabled
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Refund Amount *"
                  name="payment"
                  type="number"
                  value={returnFormData.payment}
                  onChange={handleReturnInputChange}
                  required
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Payment Type</InputLabel>
                  <Select
                    name="payment_type"
                    value={returnFormData.payment_type}
                    onChange={handleReturnInputChange}
                    label="Payment Type"
                  >
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="CHEQUE">Cheque</MenuItem>
                    <MenuItem value="BANK">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={handleCloseReturnDialog} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmitReturn}
          variant="contained"
          color="error"
          disabled={returnFormData.return_details.length === 0 || !returnFormData.reason}
        >
          Process Return
        </Button>
      </DialogActions>
    </Dialog>
  );
}
