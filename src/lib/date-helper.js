/**
 * Parse app datetime values consistently.
 * MySQL DATE_FORMAT / raw SQL often returns naive "YYYY-MM-DD HH:mm:ss" stored in PK local time.
 * Without an offset, JS may treat that as UTC or browser-local and shift the calendar day (21 → 20).
 */
export function parseAppDateTime(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const raw = String(dateInput).trim();
  if (!raw) return null;

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  const mysqlMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/);
  if (mysqlMatch) {
    const time = mysqlMatch[2] || '00:00:00';
    const d = new Date(`${mysqlMatch[1]}T${time}${PK_OFFSET}`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats dates into Pakistani standard date format (DD/MM/YYYY).
 * E.g., 24/07/2026
 */
export const formatDatePK = (dateInput, options = {}) => {
  if (!dateInput) return '';
  const d = parseAppDateTime(dateInput);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
    ...options
  });
};

export const formatDateTimePK = (dateInput) => {
  if (!dateInput) return '';
  const d = parseAppDateTime(dateInput);
  if (!d) return '';
  const dateStr = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Karachi'
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
  return `${dateStr} ${timeStr}`;
};

export const formatTimePK = (dateInput) => {
  if (!dateInput) return '';
  const d = parseAppDateTime(dateInput);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

export const formatDatePKWithMonthName = (dateInput) => {
  if (!dateInput) return '';
  const d = parseAppDateTime(dateInput);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi'
  });
};

export const PK_TIME_ZONE = 'Asia/Karachi';
export const PK_OFFSET = '+05:00';

/** YYYY-MM-DD for the current Pakistan business day. */
export function getPkDateString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: PK_TIME_ZONE });
}

/** DATE-column value (UTC midnight) for a Pakistan YYYY-MM-DD. */
export function pkBusinessDate(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Inclusive created_at range for a Pakistan calendar day. */
export function pkDayRange(dateStr) {
  if (!dateStr) return null;
  return {
    gte: new Date(`${dateStr}T00:00:00.000${PK_OFFSET}`),
    lte: new Date(`${dateStr}T23:59:59.999${PK_OFFSET}`),
  };
}

export function shiftPkDate(dateStr, days) {
  const base = new Date(`${dateStr}T12:00:00${PK_OFFSET}`);
  if (isNaN(base.getTime())) return dateStr;
  base.setTime(base.getTime() + Number(days || 0) * 86400000);
  return getPkDateString(base);
}

/** Inclusive Pakistan range: today plus the previous (days - 1) days. 30 => today + 29 before. */
export function lastNPkDaysInclusive(days = 30) {
  const toDate = getPkDateString();
  const count = Math.max(1, Number(days) || 30);
  return { fromDate: shiftPkDate(toDate, -(count - 1)), toDate };
}

/** From the 1st of (current month − N + 1) through today (Pakistan). */
export function lastNCalendarMonthsFilter(monthCount = 6) {
  const toDate = getPkDateString();
  const [y, m] = toDate.split('-').map(Number);
  const span = Math.max(1, Number(monthCount) || 6);
  let startM = m - (span - 1);
  let startY = y;
  while (startM < 1) {
    startM += 12;
    startY -= 1;
  }
  const fromDate = `${startY}-${String(startM).padStart(2, '0')}-01`;
  return { fromDate, toDate };
}

/** Current calendar year (1 Jan → today, PK). */
export function pkCalendarYearFilter() {
  const toDate = getPkDateString();
  return { fromDate: `${toDate.slice(0, 4)}-01-01`, toDate };
}

/** YYYY-MM → inclusive PK date range for month-end charts. */
export function pkMonthKeysToDateRange(fromMonthKey, toMonthKey) {
  if (!fromMonthKey || !toMonthKey) return null;
  if (fromMonthKey > toMonthKey) return null;
  const today = getPkDateString();
  const fromDate = `${fromMonthKey}-01`;
  const toDate = pkMonthLastDate(toMonthKey, today);
  if (toDate > today) return { fromDate, toDate: today };
  return { fromDate, toDate };
}

export function eachPkDate(fromDate, toDate) {
  const dates = [];
  if (!fromDate || !toDate || fromDate > toDate) return dates;
  for (let cursor = fromDate; cursor <= toDate; cursor = shiftPkDate(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 400) break;
  }
  return dates;
}

/** 0 = Sunday … 6 = Saturday for a Pakistan YYYY-MM-DD. */
export function pkWeekday(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  if (!year || !month || !day) return 0;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday start of the Pakistan week that contains dateStr. */
export function pkWeekStart(dateStr) {
  const dow = pkWeekday(dateStr);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return shiftPkDate(dateStr, mondayOffset);
}

function formatPkDayMonth(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${names[(month || 1) - 1] || ''}`;
}

export function formatPkWeekLabel(fromDate, toDate) {
  if (!fromDate) return '';
  if (!toDate || fromDate === toDate) return formatPkDayMonth(fromDate);
  const [, fromMonth] = fromDate.split('-');
  const [, toMonth] = toDate.split('-');
  if (fromMonth === toMonth) {
    return `${parseInt(fromDate.slice(8), 10)}–${formatPkDayMonth(toDate)}`;
  }
  return `${formatPkDayMonth(fromDate)}–${formatPkDayMonth(toDate)}`;
}

/** Monday–Sunday weeks that overlap the range, clipped to from/to. */
export function eachPkWeekInRange(fromDate, toDate) {
  const weeks = [];
  if (!fromDate || !toDate || fromDate > toDate) return weeks;
  const lastStart = pkWeekStart(toDate);
  for (let start = pkWeekStart(fromDate); start <= lastStart; start = shiftPkDate(start, 7)) {
    const end = shiftPkDate(start, 6);
    const from = start < fromDate ? fromDate : start;
    const to = end > toDate ? toDate : end;
    weeks.push({
      key: start,
      from,
      to,
      label: formatPkWeekLabel(from, to),
    });
    if (weeks.length > 80) break;
  }
  return weeks;
}

const PK_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short label for YYYY-MM, e.g. Sep 2026 */
export function formatPkMonthKeyLabel(monthKey) {
  const [yearStr, monthStr] = String(monthKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return monthKey || '';
  return `${PK_MONTH_SHORT[month - 1] || monthStr} ${year}`;
}

/** Last calendar day of YYYY-MM (YYYY-MM-DD), capped by maxDate if earlier. */
export function pkMonthLastDate(monthKey, maxDate) {
  const [yearStr, monthStr] = String(monthKey || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return maxDate || '';
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  if (maxDate && end > maxDate) end = maxDate;
  return end;
}

/** Calendar months (YYYY-MM) overlapping a Pakistan date range, inclusive. */
export function eachPkMonthInRange(fromDate, toDate) {
  const months = [];
  if (!fromDate || !toDate || fromDate > toDate) return months;
  const [startY, startM] = fromDate.split('-').map(Number);
  const [endY, endM] = toDate.split('-').map(Number);
  if (!startY || !startM || !endY || !endM) return months;

  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    months.push({ key, label: formatPkMonthKeyLabel(key) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (months.length > 120) break;
  }
  return months;
}

export const getCreatedByName = (item, currentUser = null) => {
  if (!item) return currentUser?.full_name || currentUser?.name || 'Admin';
  return (
    item.updated_by_user?.full_name ||
    item.created_by_user?.full_name ||
    item.user?.full_name ||
    item.updated_by_user?.name ||
    currentUser?.full_name ||
    currentUser?.name ||
    'Admin'
  );
};



