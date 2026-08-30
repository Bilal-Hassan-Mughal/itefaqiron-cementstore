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



