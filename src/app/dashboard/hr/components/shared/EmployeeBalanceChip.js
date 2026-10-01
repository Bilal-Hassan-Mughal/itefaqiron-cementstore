'use client';

import { Chip, Tooltip } from '@mui/material';
import { employeeBalanceMeta, hrFmtAmt } from './hrUiShared';

export default function EmployeeBalanceChip({ balance, size = 'small', showTooltip = true }) {
  const meta = employeeBalanceMeta(balance);
  const chip = (
    <Chip
      size={size}
      label={`${hrFmtAmt(balance)} · ${meta.label}`}
      sx={{
        fontWeight: 700,
        fontFamily: 'ui-monospace, monospace',
        fontSize: size === 'small' ? '0.72rem' : '0.8125rem',
        bgcolor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}33`,
        maxWidth: '100%',
      }}
    />
  );
  if (!showTooltip) return chip;
  return (
    <Tooltip title="Positive = employee owes company. Negative = company owes employee." arrow>
      {chip}
    </Tooltip>
  );
}
