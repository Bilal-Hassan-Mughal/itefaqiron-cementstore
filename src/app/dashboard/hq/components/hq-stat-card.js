'use client';

import { Card, CardContent, Box, Typography } from '@mui/material';
import { HQ_BRAND } from '@/lib/brand-theme';

export default function HqStatCard({ icon: Icon, label, value, color = HQ_BRAND.primary, sub, trend }) {
  return (
    <Card
      sx={{
        borderRadius: '1.25rem',
        height: '100%',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        background: 'white',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px rgba(15,23,42,0.06)',
        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${HQ_BRAND.accent})`,
          opacity: 0.85,
        },
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 40px ${color}18`,
          borderColor: `${color}35`,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 100,
          height: 100,
          background: `radial-gradient(circle at top right, ${color}10, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            bgcolor: `${color}12`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid ${color}22`,
            boxShadow: `0 4px 10px ${color}12`,
          }}
        >
          <Icon size={24} strokeWidth={2.25} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {value != null ? (typeof value === 'number' ? value.toLocaleString() : value) : 0}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mt: 0.5 }}>
            {label}
          </Typography>
          {sub && (
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500, display: 'block', mt: 0.25 }}>
              {sub}
            </Typography>
          )}
          {trend && (
            <Typography variant="caption" sx={{ color: HQ_BRAND.teal, fontWeight: 700, display: 'block', mt: 0.25 }}>
              {trend}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
