'use client';

import { useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1A55E3',
      light: '#5E6EED',
      dark: '#1347c4',
    },
    secondary: {
      main: '#FF0854',
      light: '#ff4d8a',
      dark: '#cc0644',
    },
    success: {
      main: '#00D284',
      dark: '#00a868',
    },
    info: {
      main: '#0DCAF0',
    },
  },
  typography: {
    fontFamily: 'Poppins, Arial, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

export default function CustomThemeProvider({ children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const t = e.target;
      if (!t || typeof t.type !== 'string') return;
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && t.type === 'number') {
        e.preventDefault();
      }
    };

    const handleWheel = (e) => {
      const t = e.target;
      if (!t || typeof t.type !== 'string' || t.type !== 'number') return;
      if (typeof t.blur === 'function') t.blur();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

