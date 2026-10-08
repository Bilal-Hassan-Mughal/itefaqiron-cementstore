'use client';

import { useMemo } from 'react';
import { FormControl, Select, MenuItem, ListSubheader } from '@mui/material';
import {
  rebateMonthOptionLabel,
  isRebateMonthSelectable,
  parseMonthKey,
  getCurrentMonthKey,
  formatMonthLabel,
} from '@/lib/rebate-utils';
import { REBATE_FIELD_SX } from '@/lib/rebate-theme';
import { BRAND } from '@/lib/brand-theme';

const selectSx = {
  ...REBATE_FIELD_SX,
  '& .MuiSelect-select': {
    display: 'flex',
    alignItems: 'center',
    minHeight: '40px',
    py: '8px',
  },
};

export default function RebateMonthSelect({
  value,
  onChange,
  monthOptions = [],
  loading = false,
  disabled = false,
}) {
  const groupedYears = useMemo(() => {
    const map = new Map();
    monthOptions.forEach((row) => {
      const year = parseMonthKey(row.month).year || 'Other';
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(row);
    });
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [monthOptions]);

  const selectedRow = monthOptions.find((row) => row.month === value);

  const handleChange = (event) => {
    const next = event.target.value;
    if (!next) return;
    onChange(next);
  };

  const isEmpty = !loading && monthOptions.length === 0;

  return (
    <FormControl fullWidth size="small" disabled={disabled || loading || isEmpty}>
      <Select
        value={value || ''}
        onChange={handleChange}
        displayEmpty
        sx={selectSx}
        renderValue={() => {
          const displayKey = value || getCurrentMonthKey();
          if (loading) return 'Loading months...';
          if (disabled) return formatMonthLabel(displayKey);
          if (isEmpty) return formatMonthLabel(displayKey);
          if (selectedRow) return rebateMonthOptionLabel(selectedRow);
          return formatMonthLabel(displayKey);
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: '12px',
              mt: 0.5,
              maxHeight: 320,
              boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
            },
          },
        }}
      >
        {!loading && monthOptions.length === 0 && (
          <MenuItem value="" disabled>
            No months with activity
          </MenuItem>
        )}
        {groupedYears.flatMap(([year, rows]) => [
          <ListSubheader
            key={`year-${year}`}
            sx={{
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#64748b',
              lineHeight: '32px',
              bgcolor: '#f8fafc',
            }}
          >
            {year}
          </ListSubheader>,
          ...rows.map((row) => (
              <MenuItem
                key={row.month}
                value={row.month}
                disabled={!isRebateMonthSelectable(row)}
                sx={{
                  fontWeight: 600,
                  fontSize: '13px',
                  py: 1.25,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <span>{row.monthLabel}</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide"
                  style={{
                    color:
                      row.status === 'paid'
                        ? BRAND.text.green
                        : row.status === 'unpaid'
                          ? BRAND.text.pink
                          : '#94a3b8',
                  }}
                >
                  {row.status === 'paid' ? 'Paid' : row.status === 'unpaid' ? 'Unpaid' : 'Empty'}
                </span>
              </MenuItem>
            )),
        ])}
      </Select>
    </FormControl>
  );
}
