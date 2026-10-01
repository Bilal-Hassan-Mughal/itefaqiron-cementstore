import { getDaysInMonth, detectBranchOffDays } from '@/lib/hr-payroll';
import { BRAND, COMPANY } from '@/lib/brand-theme';

export const NAVY = '#0f172a';
export const NAVY_MID = '#1e293b';
export const PRIMARY = BRAND.primary.blue;
export const TODAY_BG = 'rgba(26, 85, 227, 0.08)';
export const TODAY_RING = 'rgba(26, 85, 227, 0.18)';
export const OFF_HEADER = '#64748b';
export const ACCENT_GREEN = '#00a868';

export const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'P', full: 'Present', color: '#15803d', bg: '#dcfce7' },
  { value: 'ABSENT', label: 'A', full: 'Absent', color: '#dc2626', bg: '#fee2e2' },
  { value: 'LEAVE', label: 'L', full: 'Leave', color: '#ea580c', bg: '#ffedd5' },
  { value: 'HALF_DAY', label: 'H', full: 'Half Day', color: '#ca8a04', bg: '#fef9c3' },
  { value: 'HOLIDAY', label: 'Off', full: 'Off Day (Paid)', color: '#475569', bg: '#e2e8f0' },
];

export const CLEAR_SENTINEL = '__CLEAR__';

export const CELL_STATUS_OPTIONS = [
  ...STATUS_OPTIONS,
  { value: CLEAR_SENTINEL, label: '-', full: 'Unmarked', color: '#94a3b8', bg: '#f8fafc' },
];

export const DAY_COL_WIDTH = 50;
export const NAME_COL_WIDTH = 220;

export const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export { COMPANY };

export function cellKey(empId, day) {
  return `${empId}_${day}`;
}

export function isBeforeJoin(month, year, day, joinDate) {
  if (!joinDate) return false;
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  const join = new Date(joinDate);
  join.setHours(0, 0, 0, 0);
  return d < join;
}

export function isFutureDay(month, year, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

export function isToday(month, year, day) {
  const today = new Date();
  return today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
}

export function isPastDay(month, year, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function canEditCell(month, year, day) {
  return !isFutureDay(month, year, day);
}

export function buildDayMeta(month, year, apiMeta) {
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

export function statusMeta(val, isFuture, isBeforeJoinDay, isPast) {
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

export function colBg({ today, off, rowBg }) {
  if (today) return TODAY_BG;
  if (off) return 'rgba(100, 116, 139, 0.06)';
  return rowBg;
}

function attendanceRecordsFromGrid(grid, employees, month, year) {
  const records = [];
  for (const emp of employees || []) {
    const days = grid[emp.emp_id];
    if (!days) continue;
    for (const [dayStr, cell] of Object.entries(days)) {
      if (!cell?.status) continue;
      const day = parseInt(dayStr, 10);
      records.push({
        emp_id: emp.emp_id,
        att_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        status: cell.status,
      });
    }
  }
  return records;
}

/** Apply pending cell edits to sheet grid (after successful save). */
export function mergeEditsIntoSheet(sheetData, sheetEdits) {
  if (!sheetData?.grid) return sheetData;
  const grid = { ...sheetData.grid };
  for (const [key, status] of Object.entries(sheetEdits)) {
    const sep = key.lastIndexOf('_');
    const empId = parseInt(key.slice(0, sep), 10);
    const day = parseInt(key.slice(sep + 1), 10);
    if (!grid[empId]) grid[empId] = { ...(sheetData.grid[empId] || {}) };
    else grid[empId] = { ...grid[empId] };
    if (status === CLEAR_SENTINEL) {
      delete grid[empId][day];
    } else {
      const existing = grid[empId][day] || sheetData.grid[empId]?.[day] || {};
      grid[empId][day] = {
        status,
        in_time: existing.in_time ?? null,
        out_time: existing.out_time ?? null,
        notes: existing.notes ?? null,
      };
    }
  }
  const { month, year, employees } = sheetData;
  const offDays = detectBranchOffDays(
    employees,
    attendanceRecordsFromGrid(grid, employees, month, year),
    month,
    year,
  );
  return { ...sheetData, grid, offDays };
}

export function buildSavePayload(sheetEdits, sheetData, month, year) {
  return Object.entries(sheetEdits).map(([key, status]) => {
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
}
