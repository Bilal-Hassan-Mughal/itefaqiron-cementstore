import { BRAND } from '@/lib/brand-theme';

export const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

export const FIELD_SX = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: '#fff',
    fontSize: '0.875rem',
    minHeight: 48,
    width: '100%',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.supporting.periwinkle,
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 600 },
  '& .MuiFormHelperText-root': { fontSize: '0.72rem', mt: 0.75, mx: 0 },
};

export const FILTER_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
  },
};

export const SECTION_SX = {
  p: 2.25,
  borderRadius: '14px',
  border: '1px solid #dce3ed',
  bgcolor: '#ffffff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

export const DIALOG_HEADER_SX = {
  px: 2.5,
  py: 2,
  bgcolor: '#1A55E3',
  color: '#fff',
};

export const EMPTY_FORM = {
  emp_name: '',
  emp_phone: '',
  emp_cnic: '',
  emp_address: '',
  designation: '',
  department: '',
  join_date: '',
  basic_salary: '',
  opening_balance: '',
  status: 'ACTIVE',
  allowed_leaves_per_month: '2',
  allowed_absents_per_month: '0',
};

export const fmtAmt = (v) => parseFloat(v || 0).toLocaleString('en-PK');

/** Two equal-width fields per row from `sm` up; one column on phones. */
export const FORM_FIELDS_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  columnGap: 2,
  rowGap: 2.5,
  width: '100%',
  alignItems: 'start',
  '& > *': {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  '& .MuiFormControl-root': {
    width: '100%',
  },
};

export function defaultJoinDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
}

export function normalizeEmployeeRow(emp) {
  if (!emp) return emp;
  const opening = parseFloat(emp.opening_balance ?? 0);
  const ledger = emp.ledger_balance != null ? parseFloat(emp.ledger_balance) : opening;
  return { ...emp, opening_balance: opening, ledger_balance: ledger, account_balance: ledger };
}

export function employeeToFormData(emp) {
  const normalized = normalizeEmployeeRow(emp);
  return {
    emp_id: normalized.emp_id,
    emp_name: normalized.emp_name,
    emp_phone: normalized.emp_phone || '',
    emp_cnic: normalized.emp_cnic || '',
    emp_address: normalized.emp_address || '',
    designation: normalized.designation || '',
    department: normalized.department || '',
    join_date: normalized.join_date ? String(normalized.join_date).split('T')[0] : '',
    basic_salary: String(normalized.basic_salary ?? ''),
    opening_balance: normalized.opening_balance != null ? String(normalized.opening_balance) : '',
    ledger_balance: normalized.ledger_balance,
    account_balance: normalized.account_balance,
    status: normalized.status || 'ACTIVE',
    allowed_leaves_per_month: String(normalized.allowed_leaves_per_month ?? 2),
    allowed_absents_per_month: String(normalized.allowed_absents_per_month ?? 0),
  };
}

/** Optimistic row for list before server enriches ledger fields. */
export function formDataToEmployeeRow(form, { previous } = {}) {
  const opening =
    form.opening_balance !== '' && form.opening_balance != null
      ? parseFloat(form.opening_balance) || 0
      : parseFloat(previous?.opening_balance ?? 0);
  const row = {
    emp_id: form.emp_id ?? previous?.emp_id ?? `temp-${Date.now()}`,
    emp_name: form.emp_name.trim(),
    emp_phone: form.emp_phone || null,
    emp_cnic: form.emp_cnic || null,
    emp_address: form.emp_address || null,
    designation: form.designation || null,
    department: form.department || null,
    join_date: form.join_date || previous?.join_date || null,
    basic_salary: parseFloat(form.basic_salary) || 0,
    opening_balance: opening,
    ledger_balance: previous?.ledger_balance ?? opening,
    status: form.status || 'ACTIVE',
    allowed_leaves_per_month: parseInt(form.allowed_leaves_per_month, 10) || 0,
    allowed_absents_per_month: parseInt(form.allowed_absents_per_month, 10) || 0,
  };
  return normalizeEmployeeRow(row);
}

export function filterEmployees(list, { search, statusFilter }) {
  let out = Array.isArray(list) ? list : [];
  if (statusFilter && statusFilter !== 'ALL') {
    out = out.filter((e) => e.status === statusFilter);
  }
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    out = out.filter(
      (e) =>
        e.emp_name?.toLowerCase().includes(q) ||
        (e.emp_cnic || '').includes(q) ||
        (e.designation || '').toLowerCase().includes(q)
    );
  }
  return out;
}
