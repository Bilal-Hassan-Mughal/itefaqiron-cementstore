'use client';

import { Box, Grid, Typography } from '@mui/material';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HQ_NAV } from './hq-nav';

const SHORTCUT_COLORS = {
  branches: { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe', hoverBg: '#e0e7ff' },
  users: { bg: '#ecfeff', color: '#0891b2', border: '#a5f3fc', hoverBg: '#cffafe' },
  monitoring: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', hoverBg: '#dcfce7' },
  settings: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', hoverBg: '#f1f5f9' },
};

export default function HqShortcutSection() {
  const router = useRouter();
  const shortcuts = HQ_NAV.filter((item) => item.id !== 'dashboard');

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        mb: 3,
        bgcolor: 'white',
        boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Sparkles size={18} color="#4338ca" />
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a' }}>
          HQ Operational Quick Navigation
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Direct shortcuts to manage store branches, staff user accounts, real-time analytics monitoring, and security settings.
      </Typography>

      <Grid container spacing={2}>
        {shortcuts.map((item) => {
          const Icon = item.icon;
          const theme = SHORTCUT_COLORS[item.id] || SHORTCUT_COLORS.settings;
          return (
            <Grid item xs={12} sm={6} md={3} key={item.id}>
              <Box
                onClick={() => router.push(item.href)}
                sx={{
                  p: 2.2,
                  borderRadius: 2.5,
                  border: `1px solid ${theme.border}`,
                  bgcolor: theme.bg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.75,
                  transition: 'all 0.22s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: `0 10px 24px ${theme.color}1a`,
                    borderColor: theme.color,
                    bgcolor: theme.hoverBg,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: 'white',
                    color: theme.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <Icon size={22} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }} noWrap>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25 }}>
                    {item.description}
                  </Typography>
                </Box>
                <ChevronRight size={18} color={theme.color} style={{ flexShrink: 0 }} />
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
