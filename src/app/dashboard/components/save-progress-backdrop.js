'use client';

import { Backdrop, CircularProgress, Typography } from '@mui/material';

export default function SaveProgressBackdrop({ open, message, subMessage }) {
  return (
    <Backdrop
      open={open}
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.modal + 2,
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'rgba(15, 23, 42, 0.72)',
      }}
    >
      <CircularProgress color="inherit" size={56} thickness={4} />
      <Typography variant="h6" sx={{ fontWeight: 800, textAlign: 'center', px: 3, maxWidth: 420 }}>
        {message || 'Please wait...'}
      </Typography>
      {subMessage ? (
        <Typography variant="body2" sx={{ opacity: 0.9, textAlign: 'center', px: 3, maxWidth: 420 }}>
          {subMessage}
        </Typography>
      ) : null}
    </Backdrop>
  );
}
