'use client';

import React, { useRef } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

// Convert stored YYYY-MM-DD to display format DD/MM/YYYY
export function formatToDDMMYYYY(val) {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
}

// MUI Version for MUI Pages
export default function DateFilterInput({
  label,
  value = '',
  onChange,
  fullWidth = true,
  size = 'small',
  sx,
  className,
  style,
}) {
  const hiddenDateRef = useRef(null);
  const displayValue = formatToDDMMYYYY(value);

  const handleOpenPicker = (e) => {
    if (hiddenDateRef.current) {
      try {
        if (typeof hiddenDateRef.current.showPicker === 'function') {
          hiddenDateRef.current.showPicker();
        } else {
          hiddenDateRef.current.focus();
          hiddenDateRef.current.click();
        }
      } catch (err) {
        try {
          hiddenDateRef.current.click();
        } catch (e2) {}
      }
    }
  };

  const handleTextChange = (e) => {
    const rawStr = e.target.value;
    if (!rawStr) {
      onChange('');
      return;
    }
    const parts = rawStr.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4 && Number(d) >= 1 && Number(d) <= 31 && Number(m) >= 1 && Number(m) <= 12) {
        onChange(`${y}-${m}-${d}`);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: fullWidth ? '100%' : 'auto', display: 'inline-block', ...style }} className={className}>
      <TextField
        fullWidth={fullWidth}
        size={size}
        label={label}
        placeholder="dd/mm/yyyy"
        value={displayValue}
        onChange={handleTextChange}
        onClick={handleOpenPicker}
        InputLabelProps={{ shrink: true }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPicker(e);
                }}
                edge="end"
                tabIndex={-1}
              >
                <CalendarTodayIcon fontSize="small" sx={{ fontSize: '1.1rem', color: '#64748b' }} />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={sx}
      />
      <input
        ref={hiddenDateRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </div>
  );
}

// Tailwind Version for Report Pages
export function TailwindDateInput({
  label,
  value = '',
  onChange,
  className,
  inputClassName,
}) {
  const hiddenDateRef = useRef(null);
  const displayValue = formatToDDMMYYYY(value);

  const handleOpenPicker = () => {
    if (hiddenDateRef.current) {
      try {
        if (typeof hiddenDateRef.current.showPicker === 'function') {
          hiddenDateRef.current.showPicker();
        } else {
          hiddenDateRef.current.click();
        }
      } catch (err) {
        try {
          hiddenDateRef.current.click();
        } catch (e2) {}
      }
    }
  };

  return (
    <div className={`relative w-full ${className || ''}`}>
      {label && <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>}
      <div
        onClick={handleOpenPicker}
        className={`relative flex items-center justify-between cursor-pointer ${
          inputClassName || 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }`}
      >
        <span className={displayValue ? 'text-slate-900 font-medium' : 'text-slate-400'}>
          {displayValue || 'dd/mm/yyyy'}
        </span>
        <svg className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <input
        ref={hiddenDateRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </div>
  );
}
