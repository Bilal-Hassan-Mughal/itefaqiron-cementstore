'use client';

import { Box, Typography } from '@mui/material';
import { HQ_BRAND, HQ_UI } from '@/lib/brand-theme';

export default function HqPageHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <Box className={`${HQ_UI.card} overflow-hidden mb-3`}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
          px: { xs: 2.5, md: 3 },
          py: 2.5,
          background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 60%, #fffbeb 100%)',
          borderBottom: '1px solid #eef1f6',
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', minWidth: 0 }}>
          {Icon && (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                bgcolor: HQ_BRAND.tint,
                color: HQ_BRAND.primary,
                border: `1px solid ${HQ_BRAND.tintSoft}`,
                boxShadow: '0 4px 12px rgba(67,56,202,0.1)',
              }}
            >
              <Icon size={24} strokeWidth={2.25} />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{ color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em', mb: subtitle ? 0.5 : 0 }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ color: '#64748b', maxWidth: 640, lineHeight: 1.55, fontSize: '0.875rem' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
    </Box>
  );
}
