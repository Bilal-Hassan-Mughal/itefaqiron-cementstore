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
import { Close as CloseIcon, Phone as PhoneIcon, Print as PrintIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { formatDatePK, formatTimePK, getCreatedByName } from '@/lib/date-helper';
import { COMPANY } from '@/lib/brand-theme';
import {
  SALE_INVOICE_PRINT,
  resolveSaleReceiptBalances,
  resolveSaleReturnReceiptAmounts,
  INVOICE_STORE_PHONE_LINE,
  getLinkedOriginalSaleId,
} from './sale-utils';
import { formatCustomerPhoneDisplay } from '@/lib/whatsapp-local';
import { useSalesContext } from './SalesContext';

export default function SaleReceiptDialog() {
  const {
    receiptDialogOpen,
    setReceiptDialogOpen,
    currentBillData,
    currentUser,
    getBillDisplayNo,
    getSaleDetailsInAddOrder,
    isWalkinCustomer,
    fmtAmt,
    fmtRateQty,
    isSendingWhatsApp,
    handleSendWhatsApp,
    handlePrintBill,
    handleViewOriginalSaleFromReturn,
  } = useSalesContext();

  const linkedOriginalSaleId = getLinkedOriginalSaleId(currentBillData);

  return (
    <Dialog
      open={receiptDialogOpen}
      onClose={() => setReceiptDialogOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'white',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
          {currentBillData?.is_return ? 'Sale Return Invoice' : 'Receipt'} - {getBillDisplayNo(currentBillData)}
        </Typography>
        <IconButton
          onClick={() => setReceiptDialogOpen(false)}
          size="small"
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: 'white' }}>
        {currentBillData && (
          <>
            {/* Off-screen: WhatsApp image = receipt-style summary (no product line list) */}
            <Box
              id="receipt-whatsapp-capture"
              aria-hidden
              sx={{
                position: 'fixed',
                left: '-10000px',
                top: 0,
                width: '80mm',
                minWidth: 302,
                maxWidth: 360,
                bgcolor: '#ffffff',
                p: 1.25,
                fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box',
                color: '#000',
                fontWeight: 'bold',
                '& *': { fontWeight: 'bold !important', color: '#000 !important' }
              }}
            >
              <Box sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid #000' }}>
                <Typography className="nastaliq-text" sx={{ fontSize: '18px', fontWeight: 'bold', fontFamily: '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif !important', lineHeight: 1.8, color: '#000', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" className="word-ittefaq" sx={{ display: 'inline-block' }}>اتفاق</Box>
                  <Box component="span" className="word-iron" sx={{ display: 'inline-block' }}>آئرن</Box>
                  <Box component="span" className="word-and" sx={{ display: 'inline-block' }}>اینڈ</Box>
                  <Box component="span" className="word-cement" sx={{ display: 'inline-block' }}>سیمنٹ</Box>
                  <Box component="span" className="word-store" sx={{ display: 'inline-block' }}>سٹور</Box>
                </Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a !important' }}>گجرات سرگودھا روڈ، پاہڑیانوالی</Typography>
                <Typography className="invoice-store-phone" sx={{ fontSize: '13px', fontWeight: 'bold' }}>{INVOICE_STORE_PHONE_LINE.replace('Ph:- ', 'Ph: ')}</Typography>
                <Typography
                  sx={{
                    mt: 0.5,
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: currentBillData?.is_return ? '#c62828' : '#000',
                  }}
                >
                  {currentBillData?.is_return ? 'SALE RETURN' : 'SALE RECEIPT'}
                </Typography>
              </Box>
              <Box sx={{ py: 1 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Inv#: {getBillDisplayNo(currentBillData)}</Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  {currentBillData?.is_return ? `Return ID: ${currentBillData.return_id}` : `Sale ID: ${currentBillData.sale_id}`}
                </Typography>
                {currentBillData?.is_return && currentBillData.sale_id && (
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Sale ID: {currentBillData.sale_id}</Typography>
                )}
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Type: {currentBillData.bill_type || 'BILL'}</Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  Date: {formatDatePK(currentBillData?.created_at) || '—'}
                </Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  Time:{' '}
                  {formatTimePK(currentBillData?.created_at) || '—'}
                </Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Cust: {currentBillData.customer?.cus_name || 'N/A'}</Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  Phone: {formatCustomerPhoneDisplay(currentBillData.customer)}
                </Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  Created By: {getCreatedByName(currentBillData, currentUser)}
                </Typography>
              </Box>
              <Box
                sx={{
                  borderTop: '1px dashed #000',
                  borderBottom: '1px dashed #000',
                  py: 0.75,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                  {currentBillData?.is_return ? 'Return lines' : 'Line items'}:{' '}
                  {Array.isArray(currentBillData.sale_details) ? currentBillData.sale_details.length : 0}
                </Typography>
              </Box>
              <Box sx={{ pt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Subtotal</Typography>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                    {fmtAmt(
                      parseFloat(currentBillData.total_amount || 0) -
                      parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) -
                      parseFloat(currentBillData.shipping_amount || 0) +
                      parseFloat(currentBillData.discount || 0)
                    )}
                  </Typography>
                </Box>
                {parseFloat(currentBillData.discount || 0) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Discount</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.discount)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Shipping</Typography>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.shipping_amount)}</Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    borderTop: '1px dashed #000',
                    mt: 0.5,
                    pt: 0.5,
                  }}
                >
                  <Typography sx={{ fontSize: '11px', fontWeight: 'bold' }}>Grand Total</Typography>
                  <Typography sx={{ fontSize: '11px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.total_amount)}</Typography>
                </Box>
                {parseFloat(currentBillData.cash_payment || 0) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Cash Payment</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.cash_payment)}</Typography>
                  </Box>
                )}
                {parseFloat(currentBillData.bank_payment || 0) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                      Bank ({currentBillData.bank_title || 'Bank'})
                    </Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.bank_payment)}</Typography>
                  </Box>
                )}
                {currentBillData.previous_balance !== undefined && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Prev Balance</Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>{fmtAmt(currentBillData.previous_balance)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>Balance</Typography>
                  <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                    {fmtAmt(
                      parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0)
                    )}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'center', borderTop: '1px solid #000', mt: 1, pt: 1 }}>
                <Typography sx={{ fontSize: '9px', fontWeight: 'bold' }}>Thank you for your business!</Typography>
              </Box>
            </Box>

            <Box id="receipt-preview" className="thermal-receipt" sx={{ width: '100%', bgcolor: 'white', p: 3, color: '#000' }}>
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
                    bgcolor: currentBillData?.is_return ? '#fef2f2' : '#f1f5f9',
                    color: currentBillData?.is_return ? '#991b1b !important' : '#0f172a !important',
                    border: currentBillData?.is_return ? '1.5px solid #fca5a5' : '1.5px solid #cbd5e1',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    letterSpacing: 2,
                    textTransform: 'uppercase'
                  }}>
                    {currentBillData?.is_return ? 'SALE RETURN INVOICE' : 'SALE INVOICE'}
                  </Typography>
                </Box>
              </Box>

              {/* Customer and Invoice Details */}
              <Box sx={{ px: 2, pt: 1.25, pb: 2, borderBottom: '1.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                {/* Left Side: Customer Details */}
                <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', pr: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Customer Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {currentBillData.customer ? `${currentBillData.customer.cus_name}${currentBillData.customer.name_urdu ? ' ' + currentBillData.customer.name_urdu : ''}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Phone No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatCustomerPhoneDisplay(currentBillData.customer)}
                    </Typography>
                  </Box>
                  {currentBillData.customer?.cus_address && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'nowrap' }}>
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Address:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {currentBillData.customer.cus_address}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Right Side: Invoice Meta Details */}
                <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', ml: 'auto', pl: 2, alignItems: 'flex-end', textAlign: 'right' }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Invoice No:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {getBillDisplayNo(currentBillData)}
                    </Typography>
                  </Box>
                  {linkedOriginalSaleId && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Original Sale:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        #{linkedOriginalSaleId}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon sx={{ fontSize: 16 }} />}
                        onClick={() => handleViewOriginalSaleFromReturn?.(currentBillData)}
                        sx={{ py: 0.25, px: 1, minWidth: 0, fontSize: '0.75rem', textTransform: 'none' }}
                        className="no-print"
                      >
                        View invoice
                      </Button>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatDatePK(currentBillData?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Time:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {formatTimePK(currentBillData?.created_at) || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, width: '100%', flexWrap: 'nowrap' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Created By:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {getCreatedByName(currentBillData, currentUser)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Product Table */}
              <Box sx={{ px: 2, py: 2 }}>
                {(() => {
                  const details = currentBillData?.sale_details ? getSaleDetailsInAddOrder(currentBillData.sale_details) : [];
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
                                  <TableCell sx={{ px: 0.75, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{index + 1}</TableCell>
                                  <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="left">{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                                  {hasAnySize && (
                                    <TableCell className="cell-normal" sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'normal !important', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="center">{detail.size || '—'}</TableCell>
                                  )}
                                  <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(detail.qnty)}</TableCell>
                                  <TableCell className="cell-normal" sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'normal !important', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(detail.unit_rate)}</TableCell>
                                  <TableCell sx={{ px: 1, py: 0.75, borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtAmt(detail.total_amount)}</TableCell>
                                </TableRow>
                              ))}
                              {/* Total Row */}
                              <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                                <TableCell sx={{ px: 0.75, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="left">Total</TableCell>
                                {hasAnySize && (
                                  <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                )}
                                <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(totalQty)}</TableCell>
                                <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                                <TableCell sx={{ px: 1, py: 0.75, fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtAmt(totalItemAmt)}</TableCell>
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

                {/* Payment Summary */}
                <Box sx={{ mt: 2, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ flex: '0 0 48%' }}>
                    {(currentBillData?.is_return || !isWalkinCustomer(currentBillData?.customer)) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #000', width: '100%' }}>
                        <Table size="small">
                          <TableBody>
                            {currentBillData?.is_return ? (
                              (() => {
                                const r = resolveSaleReturnReceiptAmounts(currentBillData);
                                return (
                                  <>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>منسوخ کردہ رقم</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>{fmtAmt(r.productTotal)}</TableCell>
                                    </TableRow>
                                    {r.discount > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>رعایت</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>-{fmtAmt(r.discount)}</TableCell>
                                      </TableRow>
                                    )}
                                    {r.labour > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>مزدوری</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>-{fmtAmt(r.labour)}</TableCell>
                                      </TableRow>
                                    )}
                                    {r.shipping > 0 && (
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>کرایہ</TableCell>
                                        <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>-{fmtAmt(r.shipping)}</TableCell>
                                      </TableRow>
                                    )}
                                    <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>کل منسوخی</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: '#2e7d32' }}>
                                        {fmtAmt(r.netReturn)}
                                      </TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: '#ffe0b2' }}>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>نقد/بینک واپسی</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: '#e65100', fontSize: '1rem' }}>{fmtAmt(r.totalRefund)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>سابقہ بقایا</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>{fmtAmt(r.prevBal)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: SALE_INVOICE_PRINT.balanceTotalBg }}>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: SALE_INVOICE_PRINT.balanceTotalText }}>موجودہ بقایا</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: SALE_INVOICE_PRINT.balanceTotalText }}>{fmtAmt(r.newBal)}</TableCell>
                                    </TableRow>
                                  </>
                                );
                              })()
                            ) : (() => {
                              const { prevBal, currentDue, totalBal } = resolveSaleReceiptBalances(currentBillData);
                              return (
                                <>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>سابقہ بقایا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>
                                      {fmtAmt(prevBal)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>موجوده بقايا</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}` }}>
                                      {fmtAmt(currentDue)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow sx={{ bgcolor: SALE_INVOICE_PRINT.balanceTotalBg }}>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: SALE_INVOICE_PRINT.balanceTotalText }}>كل بقايا</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, color: SALE_INVOICE_PRINT.balanceTotalText }}>
                                      {fmtAmt(totalBal)}
                                    </TableCell>
                                  </TableRow>
                                </>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                    {(currentBillData.notes || currentBillData.reference) && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          <strong>تبصرے:</strong> {currentBillData.notes || currentBillData.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #000', width: '100%', maxWidth: '100%' }}>
                      <Table size="small">
                        <TableBody>
                          {currentBillData?.is_return ? (
                            (() => {
                              const r = resolveSaleReturnReceiptAmounts(currentBillData);
                              const accountLabel =
                                r.accountAdjustment > 0.009
                                  ? r.cashBankRefund > 0
                                    ? 'باقی (کھاتے میں کٹوتی)'
                                    : 'کھاتے میں کٹوتی'
                                  : 'باقی واپسی';
                              return (
                                <>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>رقم بل</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>{fmtAmt(r.productTotal)}</TableCell>
                                  </TableRow>
                                  {r.labour > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>مزدوری</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>-{fmtAmt(r.labour)}</TableCell>
                                    </TableRow>
                                  )}
                                  {r.shipping > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>کرایہ</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>-{fmtAmt(r.shipping)}</TableCell>
                                    </TableRow>
                                  )}
                                  {r.discount > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>رعایت</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>-{fmtAmt(r.discount)}</TableCell>
                                    </TableRow>
                                  )}
                                  <TableRow sx={{ bgcolor: SALE_INVOICE_PRINT.grandTotalBg }}>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem', color: SALE_INVOICE_PRINT.bodyText }}>کل واپسی رقم</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem', color: SALE_INVOICE_PRINT.bodyText }}>{fmtAmt(r.netReturn)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>نقد</TableCell>
                                    <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>{fmtAmt(r.cash)}</TableCell>
                                  </TableRow>
                                  {r.bank > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>{currentBillData.bank_title || 'بینک ادائیگی'}</TableCell>
                                      <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>{fmtAmt(r.bank)}</TableCell>
                                    </TableRow>
                                  )}
                                  <TableRow sx={{ bgcolor: r.accountAdjustment > 0.009 ? '#ffe0b2' : '#e8f5e9' }}>
                                    <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>{accountLabel}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem', color: r.accountAdjustment > 0.009 ? '#e65100' : '#2e7d32' }}>{fmtAmt(r.accountAdjustment)}</TableCell>
                                  </TableRow>
                                </>
                              );
                            })()
                          ) : (
                            <>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>رقم بل</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                  {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) - parseFloat(currentBillData.shipping_amount || 0) + parseFloat(currentBillData.discount || 0))}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>مزدوری</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.labour_charges || currentBillData.labour)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>کرایہ</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.shipping_amount)}
                                </TableCell>
                              </TableRow>
                              {parseFloat(currentBillData.discount || 0) > 0 && (
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>رعایت</TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                    {fmtAmt(currentBillData.discount)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow sx={{ bgcolor: SALE_INVOICE_PRINT.grandTotalBg }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem', color: SALE_INVOICE_PRINT.bodyText }}>كل رقم</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem', color: SALE_INVOICE_PRINT.bodyText }}>
                                  {fmtAmt(currentBillData.total_amount)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>نقد كيش</TableCell>
                                <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                  {fmtAmt(currentBillData.cash_payment)}
                                </TableCell>
                              </TableRow>
                              {currentBillData.bank_payment > 0 && (
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                    {currentBillData.bank_title || 'بینک'}
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                    {fmtAmt(currentBillData.bank_payment)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow sx={{ bgcolor: '#d0d0d0' }}>
                                <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>بقايا رقم</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: 1, py: 0.5, border: `1px solid ${SALE_INVOICE_PRINT.border}`, fontSize: '0.875rem' }}>
                                  {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0' }} className="no-print">
        <Button
          onClick={() => setReceiptDialogOpen(false)}
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
            onClick={() => handleViewOriginalSaleFromReturn?.(currentBillData)}
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
            color: 'white'
          }}
          onClick={() => handleSendWhatsApp(currentBillData)}
          disabled={isSendingWhatsApp}
          title="Copy invoice to clipboard and open WhatsApp Desktop"
        >
          {isSendingWhatsApp ? 'Copying...' : '📲 WhatsApp'}
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          sx={{
            minWidth: 150,
            bgcolor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' }
          }}
          onClick={() => handlePrintBill('A4', true)}
        >
          Print A4
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          sx={{
            minWidth: 150,
            bgcolor: '#fd7e14',
            '&:hover': { bgcolor: '#e8690b' }
          }}
          onClick={() => handlePrintBill('THERMAL', true)}
        >
          Print Thermal
        </Button>
      </DialogActions>
    </Dialog>
  );
}
