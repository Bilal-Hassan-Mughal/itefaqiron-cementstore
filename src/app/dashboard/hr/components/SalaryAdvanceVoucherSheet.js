'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  ADVANCE_VOUCHER_PREVIEW_ID,
  buildAdvanceVoucherBody,
  getAdvanceVoucherStylesheet,
} from '../lib/advance-voucher-a5';
import { enrichAdvanceForVoucher } from '../lib/advance-voucher-actions';

export default function SalaryAdvanceVoucherSheet({ advance, paymentAccounts, employeeOptions }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!advance?.advance_id) {
      setRow(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    enrichAdvanceForVoucher(advance, { paymentAccounts, employeeOptions }).then((data) => {
      if (!cancelled) {
        setRow(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [advance, paymentAccounts, employeeOptions]);

  if (!row && !loading) return null;

  return (
    <>
      <style>{getAdvanceVoucherStylesheet()}</style>
      <Box
        id={ADVANCE_VOUCHER_PREVIEW_ID}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 2,
          px: 1,
          bgcolor: '#e2e8f0',
          borderRadius: '8px',
          overflow: 'auto',
          minHeight: loading ? 280 : undefined,
          alignItems: loading ? 'center' : undefined,
        }}
      >
        {loading ? (
          <CircularProgress size={32} sx={{ color: '#b45309' }} />
        ) : (
          <Box
            dangerouslySetInnerHTML={{ __html: buildAdvanceVoucherBody(row) }}
            sx={{
              flexShrink: 0,
              display: 'inline-block',
              width: '148mm',
              maxWidth: '148mm',
            }}
          />
        )}
      </Box>
    </>
  );
}
