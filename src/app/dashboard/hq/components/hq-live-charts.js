'use client';

import { Box, Grid, LinearProgress, Typography, Chip } from '@mui/material';
import { Activity, Radio as RadioIcon } from 'lucide-react';

const cardSx = {
  p: 2.5,
  borderRadius: 2.5,
  border: '1px solid #e2e8f0',
  height: '100%',
  bgcolor: 'white',
};

function BarRow({ label, sublabel, value, max, color, active = true }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Box>
          <Typography variant="body2" fontWeight={700}>{label}</Typography>
          {sublabel && (
            <Typography variant="caption" color="text.secondary">{sublabel}</Typography>
          )}
        </Box>
        <Typography variant="body2" fontWeight={800} sx={{ color }}>{value}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 10,
          borderRadius: 5,
          bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': {
            borderRadius: 5,
            bgcolor: active ? color : '#94a3b8',
          },
        }}
      />
    </Box>
  );
}

export default function HqLiveCharts({ branches, summary }) {
  const maxSales = Math.max(1, ...branches.map((b) => b._count?.sales || 0));
  const maxCustomers = Math.max(1, ...branches.map((b) => b._count?.customers || 0));
  const maxUsers = Math.max(1, ...branches.map((b) => b._count?.users || 0));
  const activePct = summary?.total_branches
    ? Math.round(((summary.active_branches || 0) / summary.total_branches) * 100)
    : 0;

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} lg={4}>
        <Box sx={cardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <RadioIcon size={18} color="#16a34a" />
            <Typography fontWeight={700}>Network health</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                mx: 'auto',
                background: `conic-gradient(#16a34a 0% ${activePct}%, #fecaca ${activePct}% 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  bgcolor: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h5" fontWeight={800} color="#16a34a">{activePct}%</Typography>
                <Typography variant="caption" color="text.secondary">active</Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {summary?.active_branches ?? 0} active · {summary?.suspended_branches ?? 0} suspended
            </Typography>
          </Box>
          <Grid container spacing={1}>
            {[
              ['Total sales', summary?.total_sales ?? 0, '#059669'],
              ['Total customers', summary?.total_customers ?? 0, '#7c3aed'],
              ['Branch users', summary?.total_users ?? 0, '#0891b2'],
            ].map(([l, v, c]) => (
              <Grid item xs={4} key={l}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" display="block">{l}</Typography>
                  <Typography fontWeight={800} sx={{ color: c }}>{v}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Grid>

      <Grid item xs={12} lg={4}>
        <Box sx={cardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Activity size={18} color="#4338ca" />
            <Typography fontWeight={700}>Sales by branch</Typography>
          </Box>
          {branches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No branches yet</Typography>
          ) : (
            branches.map((b) => (
              <BarRow
                key={b.branch_id}
                label={b.branch_code}
                sublabel={b.branch_name}
                value={b._count?.sales || 0}
                max={maxSales}
                color="#4338ca"
                active={b.status === 'ACTIVE'}
              />
            ))
          )}
        </Box>
      </Grid>

      <Grid item xs={12} lg={4}>
        <Box sx={cardSx}>
          <Typography fontWeight={700} sx={{ mb: 2 }}>Customers &amp; users</Typography>
          {branches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No data</Typography>
          ) : (
            branches.map((b) => (
              <Box key={b.branch_id} sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="body2" fontWeight={700}>{b.branch_code}</Typography>
                  <Chip size="small" label={b.status} color={b.status === 'ACTIVE' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                </Box>
                <BarRow label="Customers" value={b._count?.customers || 0} max={maxCustomers} color="#7c3aed" active={b.status === 'ACTIVE'} />
                <BarRow label="Users" value={b._count?.users || 0} max={maxUsers} color="#0891b2" active={b.status === 'ACTIVE'} />
              </Box>
            ))
          )}
        </Box>
      </Grid>
    </Grid>
  );
}
