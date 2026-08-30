'use client';

import { Box, Grid, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Building2, Users, BarChart3, Settings, Plus } from 'lucide-react';

const ACTIONS = [
  { label: 'Manage Branches', desc: 'Shops & access', href: '/dashboard/hq/branches', icon: Building2, color: '#4338ca', bg: '#eef2ff' },
  { label: 'Branch Users', desc: 'Staff accounts', href: '/dashboard/hq/users', icon: Users, color: '#0891b2', bg: '#ecfeff' },
  { label: 'Reports', desc: 'Analytics', href: '/dashboard/hq/monitoring', icon: BarChart3, color: '#16a34a', bg: '#f0fdf4' },
  { label: 'Settings', desc: 'HQ security', href: '/dashboard/hq/settings', icon: Settings, color: '#475569', bg: '#f8fafc' },
];

export default function HqQuickActions() {
  const router = useRouter();

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={1.5}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Grid item xs={6} sm={3} key={action.label}>
              <Box
                onClick={() => router.push(action.href)}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: 'white',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  transition: 'all 0.22s ease',
                  '&:hover': {
                    borderColor: action.color,
                    boxShadow: `0 8px 20px ${action.color}18`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: action.bg,
                    color: action.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800} sx={{ color: '#0f172a' }} noWrap>
                    {action.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {action.desc}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Box
        onClick={() => router.push('/dashboard/hq/branches?create=1')}
        sx={{
          mt: 1.5,
          p: 1.75,
          borderRadius: 2.5,
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          fontWeight: 700,
          fontSize: '0.875rem',
          boxShadow: '0 4px 16px rgba(79, 70, 229, 0.3)',
          transition: 'all 0.22s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
          },
        }}
      >
        <Plus size={18} />
        Create New Shop Branch
      </Box>
    </Box>
  );
}
