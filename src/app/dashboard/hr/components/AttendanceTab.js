'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  MenuItem, Alert, Snackbar, Select, FormControl,
  CircularProgress, IconButton, Stack, Popover, Divider, Chip,
} from '@mui/material';
import {
  Save, ChevronLeft, ChevronRight, Print, Today as TodayIcon, Check, KeyboardArrowDown,
} from '@mui/icons-material';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { getDaysInMonth } from '@/lib/hr-payroll';

const NAVY = '#0f172a';
const NAVY_MID = '#1e293b';
const PRIMARY = BRAND.primary.blue;
const TODAY_BG = 'rgba(26, 85, 227, 0.08)';
const TODAY_RING = 'rgba(26, 85, 227, 0.18)';
const OFF_HEADER = '#64748b';
const ACCENT_GREEN = '#00a868';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'P', full: 'Present', color: '#15803d', bg: '#dcfce7' },
  { value: 'ABSENT', label: 'A', full: 'Absent', color: '#dc2626', bg: '#fee2e2' },
  { value: 'LEAVE', label: 'L', full: 'Leave', color: '#ea580c', bg: '#ffedd5' },
  { value: 'HALF_DAY', label: 'H', full: 'Half Day', color: '#ca8a04', bg: '#fef9c3' },
  { value: 'HOLIDAY', label: 'Off', full: 'Off Day (Paid)', color: '#475569', bg: '#e2e8f0' },
];

const CLEAR_SENTINEL = '__CLEAR__';

const CELL_STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'P', full: 'Present', color: '#15803d', bg: '#dcfce7' },
  { value: 'ABSENT', label: 'A', full: 'Absent', color: '#dc2626', bg: '#fee2e2' },
  { value: 'LEAVE', label: 'L', full: 'Leave', color: '#ea580c', bg: '#ffedd5' },
  { value: 'HALF_DAY', label: 'H', full: 'Half Day', color: '#ca8a04', bg: '#fef9c3' },
  { value: 'HOLIDAY', label: 'Off', full: 'Off Day (Paid)', color: '#475569', bg: '#e2e8f0' },
  { value: CLEAR_SENTINEL, label: '-', full: 'Unmarked', color: '#94a3b8', bg: '#f8fafc' },
];

const DAY_COL_WIDTH = 50;
const NAME_COL_WIDTH = 220;

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function cellKey(empId, day) {
  return `${empId}_${day}`;
}

function isBeforeJoin(month, year, day, joinDate) {
  if (!joinDate) return false;
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  const join = new Date(joinDate);
  join.setHours(0, 0, 0, 0);
  return d < join;
}

function isFutureDay(month, year, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

function isToday(month, year, day) {
  const today = new Date();
  return today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
}

function isPastDay(month, year, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function canEditCell(month, year, day) {
  return !isFutureDay(month, year, day);
}

function isBeforeJoinForPayroll(month, year, day, joinDate) {
  return isBeforeJoin(month, year, day, joinDate);
}

function buildDayMeta(month, year, apiMeta) {
  if (apiMeta?.length) return apiMeta;
  const daysInMonth = getDaysInMonth(month, year);
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay();
    return { day, weekday, weekdayLabel: labels[weekday], isSunday: weekday === 0, isSaturday: weekday === 6 };
  });
}

function statusMeta(val, isFuture, isBeforeJoinDay, isPast) {
  if (isBeforeJoinDay && !val) {
    return { label: '-', full: 'Before join date (not counted in salary)', color: '#94a3b8', bg: '#fafafa', muted: false, beforeJoin: true };
  }
  if (isBeforeJoinDay) {
    return STATUS_OPTIONS.find((s) => s.value === val) || { label: '-', full: 'Before join', color: '#94a3b8', bg: '#fafafa', muted: false, beforeJoin: true };
  }
  if (!val) {
    if (isFuture) return { label: '-', full: 'Future date', color: '#cbd5e1', bg: '#f1f5f9', muted: true, locked: true };
    if (isPast) return { label: '-', full: 'Tap to mark attendance', color: '#64748b', bg: '#fff', muted: false };
    return { label: '-', full: 'Unmarked (Absent in payroll)', color: '#64748b', bg: '#fff', muted: false };
  }
  return STATUS_OPTIONS.find((s) => s.value === val) || { label: '-', full: 'Unknown', color: '#94a3b8', bg: '#f8fafc', muted: true };
}

function AttendanceCellButton({ meta, edited, clickable, isTodayCol, isPastCol, onClick }) {
  const isEmptyCell = clickable && (meta.label === '-' || meta.label === '—');
  return (
    <Box
      component={clickable ? 'button' : 'span'}
      type={clickable ? 'button' : undefined}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick?.(e); } : undefined}
      sx={{
        width: 42,
        height: 34,
        mx: 'auto',
        borderRadius: '8px',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        bgcolor: isEmptyCell ? '#fff' : meta.bg,
        color: meta.color,
        border: edited
          ? `2px solid ${PRIMARY}`
          : isEmptyCell
            ? meta.beforeJoin
              ? '1px dashed #cbd5e1'
              : isPastCol
                ? '1px dashed #94a3b8'
                : '1px dashed #64748b'
            : '1px solid transparent',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: clickable ? 'pointer' : 'default',
        font: 'inherit',
        outline: 'none',
        pointerEvents: clickable ? 'auto' : 'none',
        position: 'relative',
        zIndex: 1,
        ...(clickable && {
          '&:hover': {
            borderColor: isTodayCol ? PRIMARY : '#94a3b8',
            transform: 'scale(1.06)',
            boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
          },
          '&:active': { transform: 'scale(0.98)' },
        }),
      }}
    >
      <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: 1 }}>
        {meta.label}
      </Typography>
      {clickable && (
        <KeyboardArrowDown sx={{ fontSize: 13, opacity: 0.35, mt: -0.1 }} />
      )}
    </Box>
  );
}

function colBg({ today, off, rowBg }) {
  if (today) return TODAY_BG;
  if (off) return 'rgba(100, 116, 139, 0.06)';
  return rowBg;
}

export default function AttendanceTab() {
  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date();
    return { month: n.getMonth() + 1, year: n.getFullYear() };
  });
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [sheetData, setSheetData] = useState(null);
  const [sheetEdits, setSheetEdits] = useState({});
  const [offDayEdits, setOffDayEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [statusPicker, setStatusPicker] = useState(null);
  const [fadeIn, setFadeIn] = useState(true);
  const scrollContainerRef = useRef(null);

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  const fetchSheet = useCallback(async () => {
    setLoadingSheet(true);
    try {
      const { month, year } = monthYear;
      const res = await fetch(`/api/attendance?sheet=true&month=${month}&year=${year}`);
      const data = await res.json();
      setSheetData(data);
      setSheetEdits({});
      setOffDayEdits({});
    } catch {
      showSnack('Failed to load attendance sheet', 'error');
    } finally {
      setLoadingSheet(false);
    }
  }, [monthYear]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  const { month, year } = monthYear;
  const dayMeta = useMemo(
    () => buildDayMeta(month, year, sheetData?.dayMeta),
    [month, year, sheetData?.dayMeta]
  );

  const scrollToDay = useCallback((day, smooth = true) => {
    setTimeout(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-att-day="${day}"]`);
      el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
    }, 200);
  }, []);

  useEffect(() => {
    if (loadingSheet) return;
    const now = new Date();
    if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return;
    scrollToDay(now.getDate());
  }, [loadingSheet, month, year, scrollToDay]);

  const allEmployees = sheetData?.employees || [];

  const designations = useMemo(() => {
    const set = new Set(allEmployees.map((e) => e.designation || 'Unassigned').filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [allEmployees]);

  const filteredEmployees = useMemo(() => {
    if (designationFilter === 'ALL') return allEmployees;
    if (designationFilter === 'Unassigned') return allEmployees.filter((e) => !e.designation);
    return allEmployees.filter((e) => (e.designation || 'Unassigned') === designationFilter);
  }, [allEmployees, designationFilter]);

  const dayColSx = {
    minWidth: DAY_COL_WIDTH,
    width: DAY_COL_WIDTH,
    maxWidth: DAY_COL_WIDTH,
    px: 0.25,
    boxSizing: 'border-box',
  };

  const isOffDay = useCallback((day) => {
    if (offDayEdits[day] !== undefined) return offDayEdits[day];
    return (sheetData?.offDays || []).includes(day);
  }, [offDayEdits, sheetData?.offDays]);

  const getRawCellStatus = useCallback((empId, day) => {
    const key = cellKey(empId, day);
    if (sheetEdits[key] === CLEAR_SENTINEL) return null;
    if (sheetEdits[key] !== undefined) return sheetEdits[key];
    const record = sheetData?.grid?.[empId]?.[day];
    return record?.status || null;
  }, [sheetEdits, sheetData]);

  const getEffectiveStatus = useCallback((empId, day, empJoinDate) => {
    const raw = getRawCellStatus(empId, day);
    if (raw) return raw;
    if (isBeforeJoin(month, year, day, empJoinDate)) return null;
    if (isOffDay(day)) return 'HOLIDAY';
    return null;
  }, [month, year, getRawCellStatus, isOffDay]);

  const handleCellClick = (event, emp, day) => {
    if (!canEditCell(month, year, day)) return;
    setStatusPicker({
      anchorEl: event.currentTarget,
      empId: emp.emp_id,
      empName: emp.emp_name,
      day,
    });
  };

  const closeStatusPicker = () => setStatusPicker(null);

  const applyCellStatusChoice = (statusValue) => {
    if (!statusPicker) return;
    const { empId, day } = statusPicker;
    setSheetEdits((prev) => ({ ...prev, [cellKey(empId, day)]: statusValue }));
    closeStatusPicker();
  };

  const pickerSelectedValue = useMemo(() => {
    if (!statusPicker) return CLEAR_SENTINEL;
    const raw = getRawCellStatus(statusPicker.empId, statusPicker.day);
    if (raw) return raw;
    if (isOffDay(statusPicker.day)) return 'HOLIDAY';
    return CLEAR_SENTINEL;
  }, [statusPicker, getRawCellStatus, isOffDay]);

  const toggleOffDay = (day) => {
    if (isFutureDay(month, year, day)) {
      showSnack('Cannot set off day on a future date', 'info');
      return;
    }
    const willBeOff = !isOffDay(day);
    setOffDayEdits((prev) => ({ ...prev, [day]: willBeOff }));

    setSheetEdits((prev) => {
      const next = { ...prev };
      allEmployees.forEach((emp) => {
        if (isBeforeJoin(month, year, day, emp.join_date)) return;
        const key = cellKey(emp.emp_id, day);
        const raw = prev[key] === CLEAR_SENTINEL
          ? null
          : (prev[key] ?? sheetData?.grid?.[emp.emp_id]?.[day]?.status ?? null);

        if (willBeOff) {
          if (!raw || raw === 'HOLIDAY') next[key] = 'HOLIDAY';
        } else if (raw === 'HOLIDAY' || prev[key] === 'HOLIDAY') {
          next[key] = CLEAR_SENTINEL;
        }
      });
      return next;
    });

    showSnack(willBeOff ? `Day ${day} marked as off for all staff` : `Day ${day} off removed`, 'info');
  };

  const shiftMonth = (delta) => {
    setFadeIn(false);
    setTimeout(() => {
      setMonthYear((m) => {
        let newMonth = m.month + delta;
        let newYear = m.year;
        if (newMonth < 1) { newMonth = 12; newYear -= 1; }
        if (newMonth > 12) { newMonth = 1; newYear += 1; }
        return { month: newMonth, year: newYear };
      });
      setFadeIn(true);
    }, 120);
  };

  const goToToday = () => {
    const now = new Date();
    setMonthYear({ month: now.getMonth() + 1, year: now.getFullYear() });
    scrollToDay(now.getDate());
  };

  const markAllPresentToday = () => {
    const today = new Date().getDate();
    if (!isToday(month, year, today)) {
      showSnack('Switch to current month first', 'info');
      return;
    }
    const updates = {};
    filteredEmployees.forEach((emp) => {
      if (isBeforeJoin(month, year, today, emp.join_date)) return;
      updates[cellKey(emp.emp_id, today)] = 'PRESENT';
    });
    if (Object.keys(updates).length === 0) return;
    setSheetEdits((prev) => ({ ...prev, ...updates }));
    showSnack(`Marked ${Object.keys(updates).length} employee(s) present for today`, 'success');
  };

  async function saveSheet() {
    setSaving(true);
    try {
      const payload = Object.entries(sheetEdits).map(([key, status]) => {
        const sep = key.lastIndexOf('_');
        const empId = parseInt(key.slice(0, sep), 10);
        const day = parseInt(key.slice(sep + 1), 10);
        const att_date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = sheetData?.grid?.[empId]?.[day];
        if (status === CLEAR_SENTINEL) {
          return { emp_id: empId, att_date, clear: true };
        }
        return {
          emp_id: empId,
          att_date,
          status,
          in_time: existing?.in_time || null,
          out_time: existing?.out_time || null,
          notes: existing?.notes || null,
        };
      });

      if (payload.length === 0) {
        showSnack('No changes to save', 'info');
        return;
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      showSnack(`Saved ${payload.length} attendance record(s)`);
      fetchSheet();
    } catch {
      showSnack('Failed to save sheet', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handlePrintSheet() {
    const emps = filteredEmployees;
    const period = `${MONTHS_FULL[month - 1]} ${year}`;
    const headDays = dayMeta.map((d) => {
      const todayCol = isToday(month, year, d.day);
      const off = isOffDay(d.day);
      const cls = [todayCol ? 'today' : '', off ? 'off' : ''].filter(Boolean).join(' ');
      const label = off ? '<small>OFF</small>' : todayCol ? '<small>TODAY</small>' : '';
      return `<th class="${cls}"><small>${d.weekdayLabel}</small>${label}${d.day}</th>`;
    }).join('');

    const bodyRows = emps.map((emp) => {
      const cells = dayMeta.map(({ day }) => {
        const beforeJoin = isBeforeJoin(month, year, day, emp.join_date);
        const future = isFutureDay(month, year, day);
        const status = getEffectiveStatus(emp.emp_id, day, emp.join_date);
        const meta = statusMeta(status, future, beforeJoin, isPastDay(month, year, day));
        return `<td><span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.label}</span></td>`;
      }).join('');
      return `<tr>
        <td class="worker"><strong>${emp.emp_name}</strong><small>${(emp.designation || '—').toUpperCase()}</small></td>
        ${cells}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Attendance — ${period}</title>
<style>
  @page { size: landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  .sub { color: #64748b; margin-bottom: 10px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${NAVY}; color: #fff; padding: 6px 3px; font-size: 10px; }
  th small { display: block; font-size: 7px; opacity: 0.8; }
  th.today { background: ${PRIMARY}; }
  th.off { background: ${OFF_HEADER}; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px 2px; text-align: center; }
  td.worker { text-align: left; min-width: 130px; padding-left: 8px; }
  td.worker small { display: block; color: #64748b; font-size: 8px; margin-top: 2px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; min-width: 20px; padding: 2px 4px; border-radius: 4px; font-weight: 800; font-size: 9px; }
</style></head><body>
  <h1>${COMPANY.nameShort} — Monthly Attendance Sheet</h1>
  <div class="sub">${period} · ${emps.length} worker(s)</div>
  <table><thead><tr><th>Employee</th>${headDays}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const editCount = Object.keys(sheetEdits).length;
  const isCurrentMonth = (() => {
    const n = new Date();
    return n.getFullYear() === year && n.getMonth() + 1 === month;
  })();

  return (
    <Box>
      <Card elevation={0} sx={{ borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: 'transparent', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: '1px solid #eef2f6', bgcolor: '#fafbfd' }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
            {/* Month nav */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton
                onClick={() => shiftMonth(-1)}
                size="small"
                sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36, '&:hover': { bgcolor: '#f1f5f9' } }}
              >
                <ChevronLeft fontSize="small" />
              </IconButton>
              <Box sx={{ minWidth: 150, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: NAVY, lineHeight: 1.2 }}>
                  {MONTHS_FULL[month - 1]} {year}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25 }}>
                  {dayMeta.length} days · {filteredEmployees.length} worker(s)
                </Typography>
              </Box>
              <IconButton
                onClick={() => shiftMonth(1)}
                size="small"
                sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36, '&:hover': { bgcolor: '#f1f5f9' } }}
              >
                <ChevronRight fontSize="small" />
              </IconButton>
              <Button
                size="small"
                variant="outlined"
                startIcon={<TodayIcon sx={{ fontSize: 16 }} />}
                onClick={goToToday}
                sx={{
                  ml: 0.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: PRIMARY,
                  color: PRIMARY,
                  height: 36,
                  '&:hover': { bgcolor: '#eef4ff' },
                }}
              >
                Today
              </Button>
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={designationFilter}
                  onChange={(e) => setDesignationFilter(e.target.value)}
                  displayEmpty
                  sx={{
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    bgcolor: '#fff',
                    height: 38,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                  }}
                >
                  <MenuItem value="ALL">All designations ({allEmployees.length})</MenuItem>
                  {designations.filter((d) => d !== 'ALL').map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} ({allEmployees.filter((e) => (e.designation || 'Unassigned') === d).length})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {isCurrentMonth && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={markAllPresentToday}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '10px',
                    borderColor: ACCENT_GREEN,
                    color: ACCENT_GREEN,
                    height: 38,
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#ecfdf5', borderColor: ACCENT_GREEN },
                  }}
                >
                  All Present Today
                </Button>
              )}

              <Button
                size="small"
                variant="outlined"
                startIcon={<Print sx={{ fontSize: 17 }} />}
                onClick={handlePrintSheet}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', borderColor: '#e2e8f0', color: '#475569', height: 38 }}
              >
                Print
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Save sx={{ fontSize: 17 }} />}
                onClick={saveSheet}
                disabled={saving || editCount === 0}
                sx={{
                  bgcolor: PRIMARY,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: '10px',
                  height: 38,
                  boxShadow: editCount > 0 ? '0 4px 12px rgba(26,85,227,0.3)' : 'none',
                  '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
                }}
              >
                {saving ? 'Saving...' : editCount > 0 ? `Save (${editCount})` : 'Save'}
              </Button>
            </Stack>
          </Stack>

          {/* Hint row */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.75, pt: 1.5, borderTop: '1px dashed #e8edf4' }}>
            <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mr: 1 }}>
              Click any past day or today to edit · Click date header for branch <strong>Off day</strong> (paid, no deduction) · Save after changes
            </Typography>
            {[...STATUS_OPTIONS.slice(0, 4), { label: '-', full: 'Unmarked', color: '#94a3b8', bg: '#f8fafc' }].map((s) => (
              <Chip
                key={s.label + s.full}
                label={`${s.label} ${s.full}`}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  bgcolor: s.bg,
                  color: s.color,
                  border: s.label === '-' ? '1px solid #e2e8f0' : 'none',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Grid */}
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, position: 'relative' }}>
          {loadingSheet ? (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: PRIMARY }} />
            </Box>
          ) : allEmployees.length === 0 ? (
            <Alert severity="warning" sx={{ m: 2, borderRadius: '12px' }}>
              No active employees found. Add staff in Employee Register first.
            </Alert>
          ) : (
            <Box
              sx={{
                opacity: fadeIn ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              <TableContainer
                ref={scrollContainerRef}
                sx={{
                  maxHeight: 580,
                  overflowX: 'auto',
                  overflowY: 'auto',
                  scrollBehavior: 'smooth',
                  width: '100%',
                  '&::-webkit-scrollbar': { height: 10, width: 8 },
                  '&::-webkit-scrollbar-track': { bgcolor: '#f1f5f9' },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 5, '&:hover': { bgcolor: '#94a3b8' } },
                }}
              >
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: NAME_COL_WIDTH + dayMeta.length * DAY_COL_WIDTH }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          width: NAME_COL_WIDTH,
                          minWidth: NAME_COL_WIDTH,
                          bgcolor: NAVY,
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.65rem',
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          borderBottom: 'none',
                          py: 1.75,
                          boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
                        }}
                      >
                        Employee
                      </TableCell>
                      {dayMeta.map((d) => {
                        const today = isToday(month, year, d.day);
                        const off = isOffDay(d.day);
                        let headerBg = NAVY_MID;
                        if (today) headerBg = PRIMARY;
                        else if (off) headerBg = OFF_HEADER;

                        return (
                          <TableCell
                            key={d.day}
                            data-att-day={d.day}
                            align="center"
                            onClick={() => { if (!isFutureDay(month, year, d.day)) toggleOffDay(d.day); }}
                            sx={{
                              ...dayColSx,
                              bgcolor: headerBg,
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              py: today || off ? 0.9 : 1.4,
                              borderBottom: 'none',
                              lineHeight: 1.1,
                              cursor: isFutureDay(month, year, d.day) ? 'default' : 'pointer',
                              userSelect: 'none',
                              opacity: isFutureDay(month, year, d.day) ? 0.55 : 1,
                              transition: 'background-color 0.15s ease',
                              boxShadow: today ? `inset 0 -3px 0 ${TODAY_RING}` : 'none',
                              '&:hover': { filter: 'brightness(1.12)' },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>
                              {d.weekdayLabel}
                            </Typography>
                            {off && (
                              <Typography component="div" sx={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                                OFF
                              </Typography>
                            )}
                            {today && !off && (
                              <Typography component="div" sx={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                                NOW
                              </Typography>
                            )}
                            {d.day}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEmployees.map((emp, rowIdx) => {
                      const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      return (
                        <TableRow key={emp.emp_id} sx={{ '&:hover': { bgcolor: '#f1f5f9' } }}>
                          <TableCell
                            sx={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              width: NAME_COL_WIDTH,
                              minWidth: NAME_COL_WIDTH,
                              bgcolor: rowBg,
                              borderBottom: '1px solid #eef2f6',
                              borderRight: '1px solid #e8edf4',
                              py: 1.25,
                              boxShadow: '3px 0 6px rgba(0,0,0,0.04)',
                            }}
                          >
                            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: NAVY, lineHeight: 1.2, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {emp.emp_name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', mt: 0.25, textTransform: 'uppercase' }}>
                              {emp.designation || '—'}
                            </Typography>
                          </TableCell>
                          {dayMeta.map((d) => {
                            const { day } = d;
                            const beforeJoin = isBeforeJoinForPayroll(month, year, day, emp.join_date);
                            const future = isFutureDay(month, year, day);
                            const editable = canEditCell(month, year, day);
                            const status = getEffectiveStatus(emp.emp_id, day, emp.join_date);
                            const meta = statusMeta(status, future, beforeJoin, isPastDay(month, year, day));
                            const edited = sheetEdits[cellKey(emp.emp_id, day)] !== undefined;
                            const todayCol = isToday(month, year, day);
                            const offCol = isOffDay(day);
                            const pastCol = isPastDay(month, year, day);

                            return (
                              <TableCell
                                key={day}
                                data-att-day={day}
                                align="center"
                                sx={{
                                  ...dayColSx,
                                  py: 0.75,
                                  borderBottom: '1px solid #eef2f6',
                                  bgcolor: colBg({ today: todayCol, off: offCol, rowBg }),
                                  ...(todayCol && { boxShadow: `inset 0 0 0 1px ${TODAY_RING}` }),
                                  ...(pastCol && !todayCol && editable && { bgcolor: 'rgba(100, 116, 139, 0.04)' }),
                                }}
                              >
                                {editable ? (
                                  <AttendanceCellButton
                                    meta={meta}
                                    edited={edited}
                                    clickable
                                    isTodayCol={todayCol}
                                    isPastCol={pastCol}
                                    onClick={(e) => handleCellClick(e, emp, day)}
                                  />
                                ) : (
                                  <AttendanceCellButton meta={meta} edited={false} clickable={false} isTodayCol={false} isPastCol={false} />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Popover
        open={Boolean(statusPicker?.anchorEl)}
        anchorEl={statusPicker?.anchorEl}
        onClose={closeStatusPicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '14px',
              border: '1px solid #e8edf4',
              boxShadow: '0 16px 48px rgba(15,23,42,0.14)',
              minWidth: 210,
              overflow: 'hidden',
              zIndex: 1400,
            },
          },
        }}
        sx={{ zIndex: 1400 }}
      >
        {statusPicker && (
          <Box>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #eef2f6' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.8125rem', color: NAVY }}>
                {statusPicker.empName}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                {MONTHS_FULL[month - 1]} {statusPicker.day}, {year}
                {isOffDay(statusPicker.day) ? ' · Off day' : ''}
                {isBeforeJoinForPayroll(month, year, statusPicker.day, allEmployees.find((e) => e.emp_id === statusPicker.empId)?.join_date)
                  ? ' · Before join (salary ignores)' : ''}
              </Typography>
            </Box>
            {CELL_STATUS_OPTIONS.map((opt) => {
              const selected = opt.value === pickerSelectedValue;
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => applyCellStatusChoice(opt.value)}
                  sx={{
                    py: 1.1,
                    px: 2,
                    gap: 1.25,
                    fontWeight: selected ? 800 : 500,
                    fontSize: '0.8125rem',
                    bgcolor: selected ? '#eef4ff' : 'transparent',
                    transition: 'background-color 0.12s ease',
                    '&:hover': { bgcolor: selected ? '#eef4ff' : '#f8fafc' },
                  }}
                >
                  <Box sx={{
                    width: 30, height: 26, borderRadius: '7px', bgcolor: opt.bg, color: opt.color,
                    fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: opt.value === CLEAR_SENTINEL ? '1px solid #e2e8f0' : 'none',
                  }}>
                    {opt.label}
                  </Box>
                  <Typography sx={{ flex: 1, fontSize: '0.8125rem' }}>{opt.full}</Typography>
                  {selected && <Check sx={{ fontSize: 18, color: PRIMARY }} />}
                </MenuItem>
              );
            })}
            {isOffDay(statusPicker.day) && (
              <>
                <Divider />
                <Box sx={{ px: 2, py: 1, bgcolor: '#fffbeb' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#92400e' }}>
                    Off day — select <strong>Present</strong> if employee worked
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </Popover>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
