'use client';

import { Card, CardContent, Box, Typography } from '@mui/material';

export default function HqStatCard({ icon: Icon, label, value, color, sub, trend }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        height: '100%',
        border: '1px solid #e2e8f0',
        background: 'white',
        boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: `0 12px 28px ${color}1a`,
          borderColor: `${color}40`,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 80,
          height: 80,
          background: `radial-gradient(circle at top right, ${color}12, transparent 70%)`,
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
            border: `1px solid ${color}20`,
          }}
        >
          <Icon size={24} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {value != null ? (typeof value === 'number' ? value.toLocaleString() : value) : 0}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mt: 0.5 }}>
            {label}
          </Typography>

          {sub && (
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500, display: 'block', mt: 0.25 }}>
              {sub}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
