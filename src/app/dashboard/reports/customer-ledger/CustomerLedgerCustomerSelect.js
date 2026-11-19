'use client';

import { Search } from 'lucide-react';
import { Autocomplete, TextField, InputAdornment } from '@mui/material';
import { customerOptionKey, isSameCustomerOption } from '@/lib/rebate-utils';
import {
  customerPrimaryLabel,
  customerDisplayTitle,
  customerSecondaryLine,
  filterCustomerLedgerOptions,
  fmtLedgerAmt,
  parseLedgerBalance,
  balanceToneClass,
  balanceBadgeClass,
  isLikelyAccountCode,
} from './customer-ledger-utils';

export default function CustomerLedgerCustomerSelect({
  options,
  value,
  onChange,
  compact = false,
  placeholder = 'Customer — search name, phone, address, reference, ID…',
  noOptionsText = 'No customer — try phone, reference, or ID',
}) {
  const inputMinH = compact ? 36 : 44;
  const radius = compact ? '8px' : '10px';

  return (
    <Autocomplete
      fullWidth
      size="small"
      clearOnEscape
      options={options}
      filterOptions={filterCustomerLedgerOptions}
      getOptionLabel={customerPrimaryLabel}
      getOptionKey={customerOptionKey}
      isOptionEqualToValue={isSameCustomerOption}
      value={value}
      onChange={(event, newValue) => onChange(newValue)}
      autoHighlight
      openOnFocus
      selectOnFocus
      disablePortal={false}
      slotProps={{
        popper: {
          placement: 'bottom-start',
          modifiers: [{ name: 'offset', options: { offset: [0, 4] } }],
          sx: { width: { xs: '100%', sm: 'min(560px, 96vw)' }, zIndex: 1300 },
        },
        paper: {
          elevation: 8,
          sx: {
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          },
        },
        listbox: {
          sx: {
            p: 0,
            maxHeight: 340,
            '& .MuiAutocomplete-option': { px: 0, py: 0 },
          },
        },
      }}
      ListboxComponent="ul"
      noOptionsText={noOptionsText}
      renderOption={(props, option) => {
        const { key: _ignored, ...optionProps } = props;
        const bal = parseLedgerBalance(option.cus_balance);
        const title = customerDisplayTitle(option);
        const code = String(option.cus_name || '').trim();
        const showCode = code && isLikelyAccountCode(code) && title !== code;

        return (
          <li
            key={customerOptionKey(option)}
            {...optionProps}
            className="border-b border-slate-100 last:border-0 hover:bg-slate-50 aria-selected:bg-indigo-50/60"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_100px] w-full">
              <div className="px-3 py-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-900 truncate text-[13px] leading-snug">{title}</span>
                  <span className="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">#{option.cus_id}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {showCode && <span className="text-slate-600">Code {code} · </span>}
                  {customerSecondaryLine(option)}
                </div>
              </div>
              <div
                className={`px-2.5 py-2 border-l border-slate-100 flex flex-col justify-center text-right ${balanceBadgeClass(bal)}`}
              >
                <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Balance</span>
                <span className={`text-xs font-bold tabular-nums ${balanceToneClass(bal)}`}>{fmtLedgerAmt(bal)}</span>
              </div>
            </div>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          onFocus={(e) => e.target.select()}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: radius,
              bgcolor: '#fafafa',
              minHeight: inputMinH,
              fontSize: '0.8125rem',
              transition: 'background-color 0.15s ease',
              '& fieldset': { borderColor: '#e2e8f0' },
              '&:hover fieldset': { borderColor: '#cbd5e1' },
              '&:hover': { bgcolor: '#fff' },
              '&.Mui-focused': { bgcolor: '#fff' },
              '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: 1.5 },
            },
            '& .MuiInputBase-input': {
              fontWeight: 600,
              color: '#0f172a',
            },
          }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start">
                  <Search size={compact ? 15 : 17} className="text-slate-400" />
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {value ? (
                  <InputAdornment position="end" sx={{ maxHeight: 'none', mr: 0.25 }}>
                    <span
                      className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${balanceBadgeClass(value.cus_balance)}`}
                    >
                      {fmtLedgerAmt(value.cus_balance)}
                    </span>
                  </InputAdornment>
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}