'use client';

import { Box, Typography, Stack, Divider } from '@mui/material';
import { buildEmployeeMonthBreakdown } from '../../lib/hr-payroll-month-breakdown';
import { plainAccountHeadline } from '../../lib/hr-clearance-plain-summary';

function AttBadge({ label, value, color }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 56 }}>
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 900, color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', mt: 0.35, textTransform: 'uppercase' }}>
        {label}
      </Typography>
    </Box>
  );
}

function Line({ label, amount, fmtAmt, kind, note }) {
  const isSubtotal = kind === 'subtotal';
  const isInfo = kind === 'info';
  const color = kind === 'sub' ? '#b91c1c' : kind === 'add' ? '#15803d' : isSubtotal ? '#0d9488' : '#334155';
  const prefix = kind === 'sub' ? '− ' : kind === 'add' ? '+ ' : '';
  const showAmt = !isInfo;

  return (
    <Box sx={{ py: isSubtotal ? 1 : 0.65 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: isSubtotal ? '0.9375rem' : '0.8125rem',
              fontWeight: isSubtotal ? 800 : 500,
              color: isSubtotal ? '#0f172a' : '#64748b',
            }}
          >
            {label}
          </Typography>
          {note && (
            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25, lineHeight: 1.35 }}>{note}</Typography>
          )}
        </Box>
        {showAmt && (
          <Typography
            sx={{
              fontWeight: isSubtotal ? 900 : 700,
              fontSize: isSubtotal ? '1rem' : '0.8125rem',
              color,
              fontFamily: 'ui-monospace, monospace',
              flexShrink: 0,
            }}
          >
            {prefix}{fmtAmt(Math.abs(parseFloat(amount || 0)))}
          </Typography>
        )}
        {isInfo && (
          <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#334155', fontFamily: 'ui-monospace, monospace' }}>
            {fmtAmt(amount)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 800,
          color: '#94a3b8',
          letterSpacing: '0.08em',
          mb: 1,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function EmployeeSalaryMonthBreakdown({
  payroll,
  preview,
  clearForm,
  month,
  year,
  fmtAmt,
  periodLabel,
  compact = false,
}) {
  const data = buildEmployeeMonthBreakdown(payroll, preview, clearForm, month, year);
  if (!data) {
    return (
      <Typography sx={{ fontSize: '0.875rem', color: '#64748b', py: 4, textAlign: 'center' }}>
        Select an employee to see this month&apos;s salary.
      </Typography>
    );
  }

  const name = payroll.employee?.emp_name || 'Employee';
  const role = payroll.employee?.designation;
  const { attendance, moneyLines, accountLines, total } = data;
  const afterAcct = plainAccountHeadline(data.afterPayment, fmtAmt);

  return (
    <Stack spacing={compact ? 1.5 : 2}>
      {!compact && (
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1.125rem', color: '#0f172a' }}>{name}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
            {periodLabel && (
              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{periodLabel}</Typography>
            )}
            {role && (
              <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>· {role}</Typography>
            )}
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          p: 1.75,
          borderRadius: '14px',
          bgcolor: '#f8fafc',
          border: '1px solid #e8edf4',
        }}
      >
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', mb: 1.25 }}>
          ATTENDANCE · {attendance.monthDays} days in month
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="space-around" flexWrap="wrap" useFlexGap>
          <AttBadge label="Present" value={attendance.present} color="#15803d" />
          <AttBadge label="Leave" value={attendance.leave} color="#ea580c" />
          <AttBadge label="Absent" value={attendance.absent} color="#dc2626" />
          <AttBadge label="Half" value={attendance.half} color="#ca8a04" />
          <AttBadge label="Not marked" value={attendance.unmarked} color="#64748b" />
        </Stack>
        {attendance.hint && (
          <Typography sx={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, mt: 1.25, lineHeight: 1.45 }}>
            {attendance.hint}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 0.5 }}>
        <Section title="SALARY THIS MONTH">
          <Stack divider={<Divider flexItem sx={{ borderColor: '#f1f5f9' }} />}>
            {moneyLines.map((line) => (
              <Line key={line.id} {...line} fmtAmt={fmtAmt} />
            ))}
          </Stack>
        </Section>

        {accountLines.length > 0 && (
          <Section title="ACCOUNT & OTHER">
            <Stack spacing={0.25}>
              {accountLines.map((line) => (
                <Line
                  key={line.id}
                  label={line.label}
                  amount={line.amount}
                  fmtAmt={fmtAmt}
                  kind={line.kind}
                />
              ))}
            </Stack>
          </Section>
        )}

        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: '16px',
            bgcolor: '#ecfdf5',
            border: '1px solid #6ee7b7',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#065f46' }}>Pay now</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.75rem', color: '#047857', fontFamily: 'ui-monospace, monospace' }}>
              {fmtAmt(total)}
            </Typography>
          </Stack>
          {Math.abs(parseFloat(data.afterPayment ?? 0)) >= 0.01 && (
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 1 }}>
              After pay: {afterAcct.title}
              {afterAcct.tone !== 'clear' ? ` · ${afterAcct.amount}` : ''}
            </Typography>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
