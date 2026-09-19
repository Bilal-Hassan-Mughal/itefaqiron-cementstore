/**
 * Formats dates into Pakistani standard date format (DD/MM/YYYY).
 * E.g., 24/07/2026
 */
export const formatDatePK = (dateInput, options = {}) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
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
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
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
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });
};

export const formatDatePKWithMonthName = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
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



