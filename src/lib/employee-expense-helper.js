/**
 * Helper to determine if an expense is an employee / salary expense.
 * 
 * Rules:
 * 1. exp_title or exp_detail contains 'salary', 'advance', or 'payroll'.
 * 2. expense_title (category) contains 'salary', 'employee', or 'staff'.
 * 3. expense_title matches an employee name in the database (or known staff members).
 */
export function isEmployeeExpense(exp, employeeNamesSet = null) {
  if (!exp) return false;

  const expTitle = String(exp.exp_title || '').toLowerCase();
  const expDetail = String(exp.exp_detail || '').toLowerCase();
  const catTitle = String(exp.expense_title?.title || '').toLowerCase().trim();

  // Keyword check
  if (/salary|advance|payroll/i.test(expTitle) || /salary|advance|payroll/i.test(expDetail)) {
    return true;
  }
  if (/salary|employee|staff/i.test(catTitle)) {
    return true;
  }

  // Known staff / employee category titles in the store
  const DEFAULT_STAFF_NAMES = [
    'abdul', 'doctor.', 'doctor', 'mithu', 'farooq', 'shahid',
    'majan', 'usman', 'haneef', 'rafeee', 'ateeb', 'khan sb',
    'sheikh', 'azmat shah', 'abdullah', 'shahid iqbal', 'zain shah'
  ];

  if (catTitle) {
    if (DEFAULT_STAFF_NAMES.some(name => catTitle === name || catTitle.includes(name))) {
      return true;
    }
    if (employeeNamesSet && employeeNamesSet.has(catTitle)) {
      return true;
    }
  }

  return false;
}
