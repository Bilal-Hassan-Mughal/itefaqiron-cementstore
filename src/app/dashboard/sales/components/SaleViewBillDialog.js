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
  Receipt as ReceiptIcon,
  Phone as PhoneIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { formatDatePK, formatTimePK, getCreatedByName } from '@/lib/date-helper';
import { COMPANY } from '@/lib/brand-theme';
import { SALE_INVOICE_PRINT, INVOICE_STORE_PHONE_LINE, getLinkedOriginalSaleId } from './sale-utils';
import { useSalesContext } from './SalesContext';
import { formatCustomerPhoneDisplay } from '@/lib/whatsapp-local';


export default function SaleViewBillDialog() {
  const {
    viewBillDialog,
    handleCloseBillDialog,
    selectedBill,
    getBillDisplayNo,
    getSaleDetailsInAddOrder,
    isWalkinCustomer,
    fmtAmt,
    currentUser,
    isSendingWhatsApp,
    handleSendWhatsApp,
    handlePrintBill,
    handleViewOriginalSaleFromReturn,
  } = useSalesContext();

  const linkedOriginalSaleId = getLinkedOriginalSaleId(selectedBill);

  return (
    <>
      <Dialog
        open={viewBillDialog}
        onClose={handleCloseBillDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: '210mm',
            maxWidth: '210mm',
            '@media print': {
              width: '210mm',
              maxWidth: '210mm',
              margin: '0 auto'
            }
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: '#16a34a',
          color: 'white',
          py: 2,
          px: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              Bill Details - {getBillDisplayNo(selectedBill)}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseBillDialog}
            size="small"
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'white' }}>
          {selectedBill && (
            <Box id="printable-invoice" sx={{ width: '100%', bgcolor: '#ffffff', color: SALE_INVOICE_PRINT.bodyText, p: 2, '& .MuiTypography-root': { color: SALE_INVOICE_PRINT.bodyText }, '& .MuiTableCell-root': { color: SALE_INVOICE_PRINT.bodyText } }}>
              {/* Company Header */}
              <Box sx={{
                textAlign: 'center',
                pt: 2.5,
                pb: 2,
                px: 2,
                borderTop: '4px solid #0f172a',
                borderBottom: '3px double #0f172a',
                bgcolor: '#ffffff',
                mb: 1
              }}>
                <Typography className="nastaliq-text" variant="h4" sx={{
                  fontWeight: 'bold',
                  mb: 1.25,
                  fontFamily: '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif !important',
                  fontSize: { xs: '1.8rem', md: '2.4rem' },
                  direction: 'rtl',
                  color: '#0f172a',
                  lineHeight: 1.8,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 1.25
                }}>
                  <Box component="span" className="word-ittefaq" sx={{ display: 'inline-block' }}>اتفاق</Box>
                  <Box component="span" className="word-iron" sx={{ display: 'inline-block' }}>آئرن</Box>
                  <Box component="span" className="word-and" sx={{ display: 'inline-block' }}>اینڈ</Box>
                  <Box component="span" className="word-cement" sx={{ display: 'inline-block' }}>سیمنٹ</Box>
                  <Box component="span" className="word-store" sx={{ display: 'inline-block' }}>سٹور</Box>
                </Typography>
                <Typography variant="body2" sx={{
                  mt: 0.75,
                  mb: 1.5,
                  fontSize: '0.95rem',
                  direction: 'rtl',
                  color: '#16a34a !important',
                  fontWeight: 700
                }}>
                  گجرات سرگودھا روڈ، پاہڑیانوالی
                </Typography>
                <Typography
                  className="invoice-store-phone"
                  variant="body2"
                  component="div"
                  sx={{
                    mb: 1.75,
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    letterSpacing: 0.5,
                    color: '#1e293b !important',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                >
                  {INVOICE_STORE_PHONE_LINE}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="body2" sx={{
                    display: 'inline-block',
                    px: 3,
                    py: 0.5,
                    borderRadius: '6px',
                    bgcolor: (selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN') ? '#fef2f2' : '#f1f5f9',
                    color: (selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN') ? '#991b1b !important' : '#0f172a !important',
                    border: (selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN') ? '1.5px solid #fca5a5' : '1.5px solid #cbd5e1',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    letterSpacing: 2,
                    textTransform: 'uppercase'
                  }}>
                    {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? 'SALE RETURN INVOICE' : 'SALE INVOICE'}
                  </Typography>
                </Box>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 3, pt: 1.25, pb: 2, borderBottom: '1.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                {/* Left Side: Customer Details */}
                <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', pr: 3, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {selectedBill.customer ? `${selectedBill.customer.cus_name}${selectedBill.customer.name_urdu ? ' ' + selectedBill.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatCustomerPhoneDisplay(selectedBill.customer)}
                    </Typography>
                  </Box>
                  {selectedBill.customer?.cus_address && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'nowrap' }}>
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {selectedBill.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Right Side: Invoice Meta Details */}
                <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', ml: 'auto', pl: 3, alignItems: 'flex-end', textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {getBillDisplayNo(selectedBill)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? 'Return ID:' : 'Sale ID:'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN' ? selectedBill.return_id : selectedBill.sale_id}
                    </Typography>
                  </Box>
                  {(selectedBill?.is_return || selectedBill?.bill_type === 'SALE_RETURN') && selectedBill.sale_id && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Sale ID:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {selectedBill.sale_id}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatDatePK(selectedBill?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatTimePK(selectedBill?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {getCreatedByName(selectedBill, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table and Payment Summary - Full Width */}
              <Box sx={{ px: 3, py: 2 }}>
                {/* Product Details Table - Full Width */}
                {(() => {
                  const details = selectedBill?.sale_details ? getSaleDetailsInAddOrder(selectedBill.sale_details) : [];
                  const hasAnySize = details.some(d => d.size && String(d.size).trim() !== '');
                  const totalQty = details.reduce((sum, d) => sum + (parseFloat(d.qnty) || 0), 0);
                  const totalItemAmt = details.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
                  return (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2.5, border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: 'none' }}>
                      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#9e9e9e' }}>
                            <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: '6%', borderRight: '1px solid #ffffff', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="center">S#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: hasAnySize ? '36%' : '50%', borderRight: '1px solid #ffffff', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="left">Product Name</TableCell>
                            {hasAnySize && (
                              <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: '20%', borderRight: '1px solid #ffffff', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="center">Description</TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: '12%', borderRight: '1px solid #ffffff', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="center">Qty</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: '13%', borderRight: '1px solid #ffffff', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="center">Rate</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#000000 !important', py: 0.85, px: 1, fontSize: '0.875rem', width: '13%', borderBottom: '1px solid #cbd5e1', verticalAlign: 'middle' }} align="center">Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {details.length > 0 ? (
                            <>
                              {details.map((detail, index) => (
                                <TableRow key={detail.sale_detail_id || index}>
                                  <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{index + 1}</TableCell>
                                  <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="left">{detail.product?.pro_title || detail.product?.pro_name || detail.product?.prod_name || detail.pro_title || 'N/A'}</TableCell>
                                  {hasAnySize && (
                                    <TableCell className="cell-normal" sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'normal !important', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="center">{detail.size || '—'}</TableCell>
                                  )}
                                  <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{detail.qnty || 0}</TableCell>
                                  <TableCell className="cell-normal" sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'normal !important', color: '#000000', verticalAlign: 'middle' }} align="center">{parseFloat(detail.unit_rate || 0).toFixed(2)}</TableCell>
                                  <TableCell sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{parseFloat(detail.total_amount || 0).toFixed(0)}</TableCell>
                                </TableRow>
                              ))}
                              {/* Total Row */}
                              <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                                <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="left">Total</TableCell>
                                {hasAnySize && (
                                  <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                )}
                                <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{totalQty}</TableCell>
                                <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                <TableCell sx={{ px: 1.25, py: 0.75, fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{parseFloat(totalItemAmt || 0).toFixed(0)}</TableCell>
                              </TableRow>
                            </>
                          ) : (
                            <TableRow>
                              <TableCell colSpan={hasAnySize ? 6 : 5} align="center" sx={{ py: 4, color: '#64748b' }}>
                                No items found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  );
                })()}

                {/* Payment Summary - Below Product Details */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  {/* Left Side - Balance Section */}
                  <Box sx={{ flex: '0 0 48%' }}>
                    {!isWalkinCustomer(selectedBill?.customer) && (() => {
                      const prevBalance = parseFloat(selectedBill.previous_balance || 0);
                      const currentBillAmount = parseFloat(selectedBill.total_amount || 0);
                      const payment = parseFloat(selectedBill.payment || 0);
                      const totalBalance = prevBalance + currentBillAmount - payment;

                      return (
                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', width: '100%', boxShadow: 'none' }}>
                          <Table size="small">
                            <TableBody>
                              {prevBalance > 0 && (
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>سابقہ بقایا</TableCell>
                                  <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                                    {fmtAmt(prevBalance)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.65, borderRight: '1px solid #ffffff', color: '#000000 !important', fontSize: '0.875rem' }}>كل بقايا</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.65, color: '#000000 !important', fontSize: '0.9rem' }}>
                                  {fmtAmt(totalBalance)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()}

                    {/* Notes Section */}
                    {(selectedBill.notes || selectedBill.reference) && (
                      <Box sx={{ mt: 1, p: 1.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#000000', fontWeight: 'bold' }}>
                          <strong style={{ color: '#000000' }}>Notes:</strong> {selectedBill.notes || selectedBill.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Right Side - Payment Summary */}
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>رقم بل</TableCell>
                            <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) - parseFloat(selectedBill.labour_charges || 0) - parseFloat(selectedBill.shipping_amount || 0) + parseFloat(selectedBill.discount || 0))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>مزدوری</TableCell>
                            <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                              {fmtAmt(selectedBill.labour_charges)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>کرایہ</TableCell>
                            <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                              {fmtAmt(selectedBill.shipping_amount)}
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #ffffff', borderBottom: '1px solid #e0e0e0', fontSize: '0.875rem', color: '#000000 !important' }}>كل رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontSize: '0.875rem', color: '#000000 !important' }}>
                              {fmtAmt(selectedBill.total_amount)}
                            </TableCell>
                          </TableRow>

                          {/* Determine cash and bank amounts */}
                          {(() => {
                            let cashAmount = 0;
                            let bankAmount = 0;
                            let bankName = '';

                            if (selectedBill.hasOwnProperty('cash_payment') && selectedBill.hasOwnProperty('bank_payment')) {
                              cashAmount = parseFloat(selectedBill.cash_payment || 0);
                              bankAmount = parseFloat(selectedBill.bank_payment || 0);
                              bankName = selectedBill.bank_title || selectedBill.debit_account?.cus_name || 'بینک';
                            } else {
                              if (selectedBill.payment_type === 'CASH' || !selectedBill.payment_type) {
                                cashAmount = parseFloat(selectedBill.payment || 0);
                                bankAmount = 0;
                              } else {
                                cashAmount = 0;
                                bankAmount = parseFloat(selectedBill.payment || 0);
                                bankName = selectedBill.debit_account?.cus_name || 'بینک';
                              }
                            }

                            return (
                              <>
                                {/* Always show cash payment row */}
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>
                                    نقد كيش
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                                    {fmtAmt(cashAmount)}
                                  </TableCell>
                                </TableRow>

                                {/* Show bank payment row if bank payment exists */}
                                {bankAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>
                                      {bankName}
                                    </TableCell>
                                    <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                                      {fmtAmt(bankAmount)}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })()}
                          <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                            <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.65, borderRight: '1px solid #ffffff', fontSize: '0.875rem', color: '#000000 !important' }}>بقايا رقم</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.65, fontSize: '0.9rem', color: '#000000 !important' }}>
                              {fmtAmt(parseFloat(selectedBill.total_amount || 0) + parseFloat(selectedBill.previous_balance || 0) - parseFloat(selectedBill.payment || 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0' }} className="no-print">
          <Button
            onClick={handleCloseBillDialog}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
          {linkedOriginalSaleId && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<VisibilityIcon />}
              onClick={() => handleViewOriginalSaleFromReturn?.(selectedBill)}
              sx={{ minWidth: 140, textTransform: 'none', fontWeight: 600 }}
            >
              Original invoice
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={isSendingWhatsApp ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
            sx={{
              minWidth: 150,
              bgcolor: '#25D366',
              '&:hover': { bgcolor: '#1ebe5d' },
              color: 'white',
            }}
            onClick={() => handleSendWhatsApp(selectedBill, null, 'printable-invoice')}
            disabled={isSendingWhatsApp}
            title="Send invoice via WhatsApp Desktop"
          >
            {isSendingWhatsApp ? 'Copying...' : 'WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 140,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
            onClick={() => handlePrintBill('EXISTING', true, selectedBill)}
          >
            Print A4
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              minWidth: 140,
              bgcolor: '#fd7e14',
              '&:hover': { bgcolor: '#e8690b' }
            }}
            onClick={() => {
              handlePrintBill('THERMAL', true, selectedBill);
            }}
          >
            Print Thermal
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
