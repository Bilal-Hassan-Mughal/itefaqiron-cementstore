'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  EMP_RECEIVE_RECEIPT_PREVIEW_ID,
  EMP_RECEIVE_ACCENT,
  buildEmployeeReceiveReceiptBody,
  getEmployeeReceiveReceiptStylesheet,
} from '../lib/employee-receive-receipt-a5';
import { enrichEmployeeReceiveReceipt } from '../lib/employee-receive-receipt-actions';

export default function EmployeeReceiveReceiptSheet({ receipt, employeeOptions = [] }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!receipt?.receipt_id) {
      setRow(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    enrichEmployeeReceiveReceipt(receipt, { employeeOptions }).then((data) => {
      if (!cancelled) {
        setRow(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [receipt, employeeOptions]);

  if (!row && !loading) return null;

  return (
    <>
      <style>{getEmployeeReceiveReceiptStylesheet()}</style>
      <Box
        id={EMP_RECEIVE_RECEIPT_PREVIEW_ID}
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
          <CircularProgress size={32} sx={{ color: EMP_RECEIVE_ACCENT }} />
        ) : (
          <Box
            dangerouslySetInnerHTML={{ __html: buildEmployeeReceiveReceiptBody(row) }}
            sx={{
              flexShrink: 0,
              display: 'inline-block',
              width: '560px',
              maxWidth: '560px',
              minWidth: '560px',
            }}
          />
        )}
      </Box>
    </>
  );
}
