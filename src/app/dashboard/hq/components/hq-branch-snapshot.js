'use client';

import { useRouter } from 'next/navigation';
import {
  Box, Grid, Typography, LinearProgress, Chip, Button,
} from '@mui/material';
import { Store, ChevronRight, BarChart3 } from 'lucide-react';

const cardSx = {
  p: 2.5,
  borderRadius: 3,
  border: '1px solid #e2e8f0',
  bgcolor: 'white',
  boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
};

function SalesBar({ label, sublabel, value, max, active }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
        <Box>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
            {label}
          </Typography>
          {sublabel && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 180, display: 'block' }}>
              {sublabel}
            </Typography>
          )}
        </Box>
        <Typography variant="body2" fontWeight={800} sx={{ color: active ? '#4338ca' : '#94a3b8' }}>
          {value.toLocaleString()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: '#f1f5f9',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            background: active
              ? 'linear-gradient(90deg, #4f46e5, #6366f1)'
              : '#cbd5e1',
          },
        }}
      />
    </Box>
  );
}

export default function HqBranchSnapshot({ branches = [] }) {
  const router = useRouter();
  const maxSales = Math.max(1, ...branches.map((b) => b._count?.sales || 0));
  const activeBranches = branches.filter((b) => b.status === 'ACTIVE');
  const displayBranches = [...branches]
    .sort((a, b) => (b._count?.sales || 0) - (a._count?.sales || 0))
    .slice(0, 6);

  return (
    <Grid container spacing={2.5}>
      {/* Sales comparison — single focused chart */}
      <Grid item xs={12} lg={7}>
        <Box sx={cardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, pb: 2, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#eef2ff', color: '#4338ca', display: 'flex' }}>
                <BarChart3 size={18} />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a' }}>
                  Sales by Branch
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Compare transaction volume across shops
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              endIcon={<ChevronRight size={14} />}
              onClick={() => router.push('/dashboard/hq/monitoring')}
              sx={{ fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
            >
              Full reports
            </Button>
          </Box>

          {branches.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Store size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <Typography color="text.secondary" variant="body2" fontWeight={600}>
                No branches yet — create your first shop to see sales data.
              </Typography>
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
                onClick={() => router.push('/dashboard/hq/branches?create=1')}
              >
                Create Branch
              </Button>
            </Box>
          ) : (
            branches.map((b) => (
              <SalesBar
                key={b.branch_id}
                label={b.branch_code}
                sublabel={b.branch_name}
                value={b._count?.sales || 0}
                max={maxSales}
                active={b.status === 'ACTIVE'}
              />
            ))
          )}
        </Box>
      </Grid>

      {/* Active shops — compact cards only */}
      <Grid item xs={12} lg={5}>
        <Box sx={{ ...cardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 2, borderBottom: '1px solid #f1f5f9' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a' }}>
                Your Shops
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeBranches.length} active · {branches.length - activeBranches.length} suspended
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={() => router.push('/dashboard/hq/branches')}
              sx={{ fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
            >
              View all
            </Button>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {displayBranches.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No shop branches registered
              </Typography>
            ) : (
              displayBranches.map((b) => (
                <Box
                  key={b.branch_id}
                  onClick={() => router.push(`/dashboard/hq/branches/${b.branch_id}`)}
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#818cf8',
                      bgcolor: '#f5f3ff',
                      transform: 'translateX(4px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      background: b.status === 'ACTIVE'
                        ? 'linear-gradient(135deg, #4338ca, #6366f1)'
                        : 'linear-gradient(135deg, #64748b, #94a3b8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Store size={18} color="white" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800} noWrap sx={{ color: '#0f172a' }}>
                      {b.branch_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {b.branch_code} · {(b._count?.sales ?? 0).toLocaleString()} sales
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={b.status}
                    color={b.status === 'ACTIVE' ? 'success' : 'default'}
                    sx={{ fontWeight: 700, fontSize: '0.65rem', height: 22 }}
                  />
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
}
