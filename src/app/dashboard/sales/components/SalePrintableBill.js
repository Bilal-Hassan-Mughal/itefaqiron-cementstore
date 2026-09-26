'use client';

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Phone as PhoneIcon } from '@mui/icons-material';
import { formatDatePK, formatTimePK, getCreatedByName } from '@/lib/date-helper';
import { COMPANY } from '@/lib/brand-theme';
import { SALE_INVOICE_PRINT, resolveSaleReceiptBalances } from './sale-utils';
import { useSalesContext } from './SalesContext';

export default function SalePrintableBill() {
  const {
    currentBillData,
    currentUser,
    isWalkinCustomer,
    getBillDisplayNo,
    getSaleDetailsInAddOrder,
    fmtAmt,
    fmtRateQty,
  } = useSalesContext();

  if (!currentBillData) return null;

  return (
    <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '21cm', overflow: 'hidden' }}>
      {/* A4 Printable Container */}
      <Box id="printable-invoice-a4" sx={{ width: '100%', bgcolor: '#ffffff', color: SALE_INVOICE_PRINT.bodyText, '& .MuiTypography-root': { color: SALE_INVOICE_PRINT.bodyText }, '& .MuiTableCell-root': { color: SALE_INVOICE_PRINT.bodyText } }}>
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
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, px: 2, py: 0.5, borderRadius: '20px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mb: 1.75 }}>
            <PhoneIcon sx={{ color: '#10b981', fontSize: '1.25rem' }} />
            <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 700, fontSize: '1.25rem', letterSpacing: 0.5 }}>
              Ph:- 0300-7560306
            </Typography>
          </Box>
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
        <Box sx={{ px: 3, pt: 1.25, pb: 2, borderBottom: '1.5px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          {/* Left Side: Customer Details */}
          <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', pr: 3, alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Customer Name:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
                {currentBillData.customer ? `${currentBillData.customer.cus_name}${currentBillData.customer.name_urdu ? ' ' + currentBillData.customer.name_urdu : ''}` : 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Phone No:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {currentBillData.customer?.cus_phone_no || 'N/A'}
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
          <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', ml: 'auto', pl: 3, alignItems: 'flex-end', textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Invoice No:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {getBillDisplayNo(currentBillData)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {currentBillData?.is_return ? 'Return ID:' : 'Sale ID:'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {currentBillData?.is_return ? currentBillData.return_id : currentBillData.sale_id}
              </Typography>
            </Box>
            {currentBillData?.is_return && currentBillData.sale_id && (
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: 0.75, width: '100%', flexWrap: 'nowrap' }}>
                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Sale ID:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {currentBillData.sale_id}
                </Typography>
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
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, mb: currentBillData.reference ? 0.75 : 0, width: '100%', flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Created By:</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {getCreatedByName(currentBillData, currentUser)}
              </Typography>
            </Box>
            {currentBillData.reference && (
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1, width: '100%', flexWrap: 'nowrap' }}>
                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Reference:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {currentBillData.reference}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Product Table */}
        <Box sx={{ px: 3, py: 2 }}>
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
                            <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{index + 1}</TableCell>
                            <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="left">{detail.product?.pro_title || detail.pro_title || 'N/A'}</TableCell>
                            {hasAnySize && (
                              <TableCell className="cell-normal" sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', fontWeight: 'normal !important', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap', verticalAlign: 'middle' }} align="center">{detail.size || '—'}</TableCell>
                            )}
                            <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(detail.qnty)}</TableCell>
                            <TableCell className="cell-normal" sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'normal !important', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(detail.unit_rate)}</TableCell>
                            <TableCell sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #e0e0e0', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtAmt(detail.total_amount)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                          <TableCell sx={{ px: 1, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                          <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="left">Total</TableCell>
                          {hasAnySize && (
                            <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                          )}
                          <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtRateQty(totalQty)}</TableCell>
                          <TableCell sx={{ px: 1.25, py: 0.75, borderRight: '1px solid #ffffff', fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center"></TableCell>
                          <TableCell sx={{ px: 1.25, py: 0.75, fontSize: '0.95rem', fontWeight: 'bold', color: '#000000', verticalAlign: 'middle' }} align="center">{fmtAmt(totalItemAmt)}</TableCell>
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
              {!isWalkinCustomer(currentBillData.customer) && (() => {
                const { prevBal, currentDue, totalBal } = resolveSaleReceiptBalances(currentBillData);
                return (
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', width: '100%', boxShadow: 'none' }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>سابقہ بقایا</TableCell>
                          <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                            {fmtAmt(prevBal)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>موجوده بقايا</TableCell>
                          <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                            {fmtAmt(currentDue)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                          <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.65, borderRight: '1px solid #ffffff', color: '#000000 !important', fontSize: '0.875rem' }}>كل بقايا</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.65, color: '#000000 !important', fontSize: '0.9rem' }}>
                            {fmtAmt(totalBal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
              {(currentBillData.notes || currentBillData.reference) && (
                <Box sx={{ mt: 1, p: 1.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#000000', fontWeight: 'bold' }}>
                    <strong style={{ color: '#000000' }}>Notes:</strong> {currentBillData.notes || currentBillData.reference}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ flex: '0 0 48%', display: 'flex', justifyContent: 'flex-end' }}>
              <TableContainer component={Paper} variant="outlined" sx={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxShadow: 'none' }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>رقم بل</TableCell>
                      <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                        {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.labour_charges || currentBillData.labour || 0) - parseFloat(currentBillData.shipping_amount || 0) + parseFloat(currentBillData.discount || 0))}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>مزدوری</TableCell>
                      <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                        {fmtAmt(currentBillData.labour_charges || currentBillData.labour)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>کرایہ</TableCell>
                      <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                        {fmtAmt(currentBillData.shipping_amount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>رعایت</TableCell>
                      <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                        {fmtAmt(currentBillData.discount)}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #ffffff', borderBottom: '1px solid #e0e0e0', fontSize: '0.875rem', color: '#000000 !important' }}>كل رقم</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontSize: '0.875rem', color: '#000000 !important' }}>
                        {fmtAmt(currentBillData.total_amount)}
                      </TableCell>
                    </TableRow>
                    {/* Always show cash payment */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>نقد كيش</TableCell>
                      <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                        {fmtAmt(currentBillData.cash_payment)}
                      </TableCell>
                    </TableRow>
                    {/* Show bank payment with account name if bank payment exists */}
                    {currentBillData.bank_payment > 0 && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.6, borderRight: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', color: '#000000', fontSize: '0.875rem' }}>
                          {currentBillData.bank_title || 'بینک'}
                        </TableCell>
                        <TableCell align="right" sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#000000', fontSize: '0.875rem' }}>
                          {fmtAmt(currentBillData.bank_payment)}
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                      <TableCell sx={{ fontWeight: 'bold', direction: 'rtl', px: 1.25, py: 0.65, borderRight: '1px solid #ffffff', fontSize: '0.875rem', color: '#000000 !important' }}>بقايا رقم</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', px: 1.25, py: 0.65, fontSize: '0.9rem', color: '#000000 !important' }}>
                        {fmtAmt(parseFloat(currentBillData.total_amount || 0) - parseFloat(currentBillData.payment || 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
