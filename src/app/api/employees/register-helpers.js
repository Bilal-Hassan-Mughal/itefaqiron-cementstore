import {
  ensureEmployeeLedgerSchema,
  getEmployeeLedgerClosingsMap,
} from '@/lib/employee-ledger';

/** Fields needed for HR Employee Register list (lean query). */
export const REGISTER_EMPLOYEE_SELECT = {
  emp_id: true,
  emp_name: true,
  emp_phone: true,
  emp_cnic: true,
  emp_address: true,
  designation: true,
  department: true,
  join_date: true,
  basic_salary: true,
  opening_balance: true,
  allowed_leaves_per_month: true,
  allowed_absents_per_month: true,
  status: true,
};

export function mapRegisterEmployee(emp, ledgerMap) {
  const opening = parseFloat(emp.opening_balance ?? 0);
  return {
    emp_id: emp.emp_id,
    emp_name: emp.emp_name,
    emp_phone: emp.emp_phone,
    emp_cnic: emp.emp_cnic,
    emp_address: emp.emp_address,
    designation: emp.designation,
    department: emp.department,
    join_date: emp.join_date,
    basic_salary: parseFloat(emp.basic_salary ?? 0),
    opening_balance: opening,
    allowed_leaves_per_month: emp.allowed_leaves_per_month,
    allowed_absents_per_month: emp.allowed_absents_per_month,
    status: emp.status,
    ledger_balance: ledgerMap.get(emp.emp_id) ?? opening,
    account_balance: ledgerMap.get(emp.emp_id) ?? opening,
  };
}

function registerWhere(branchId, { status, search } = {}) {
  const where = { branch_id: branchId };
  if (status) where.status = status;
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { emp_name: { contains: q } },
      { emp_cnic: { contains: q } },
      { designation: { contains: q } },
      { department: { contains: q } },
      { emp_phone: { contains: q } },
    ];
  }
  return where;
}

/** Aggregate stats for register header cards (no full list load). */
export async function fetchRegisterEmployeeStats(db, branchId, { status } = {}) {
  await ensureEmployeeLedgerSchema(db);
  const where = registerWhere(branchId, { status });
  const employees = await db.employee.findMany({
    where,
    select: { emp_id: true, status: true, basic_salary: true, opening_balance: true },
  });
  const ledgerMap = await getEmployeeLedgerClosingsMap(db, employees.map((e) => e.emp_id));
  let active = 0;
  let inactive = 0;
  let totalSalary = 0;
  let receivable = 0;
  for (const emp of employees) {
    if (emp.status === 'ACTIVE') {
      active += 1;
      totalSalary += parseFloat(emp.basic_salary ?? 0);
    } else {
      inactive += 1;
    }
    const b = ledgerMap.get(emp.emp_id) ?? parseFloat(emp.opening_balance ?? 0);
    if (b > 0.009) receivable += b;
  }
  return {
    total: employees.length,
    active,
    inactive,
    totalSalary: Math.round(totalSalary * 100) / 100,
    receivable: Math.round(receivable * 100) / 100,
  };
}

/** Dropdown / autocomplete — active employees, minimal fields + ledger. */
export async function fetchRegisterEmployeeDropdown(db, branchId) {
  await ensureEmployeeLedgerSchema(db);
  const employees = await db.employee.findMany({
    where: { branch_id: branchId, status: 'ACTIVE' },
    orderBy: { emp_name: 'asc' },
    select: {
      emp_id: true,
      emp_name: true,
      designation: true,
      opening_balance: true,
      basic_salary: true,
      status: true,
    },
  });
  const ledgerMap = await getEmployeeLedgerClosingsMap(db, employees.map((e) => e.emp_id));
  return employees.map((emp) => {
    const opening = parseFloat(emp.opening_balance ?? 0);
    return {
      emp_id: emp.emp_id,
      emp_name: emp.emp_name,
      designation: emp.designation,
      basic_salary: parseFloat(emp.basic_salary ?? 0),
      opening_balance: opening,
      status: emp.status,
      ledger_balance: ledgerMap.get(emp.emp_id) ?? opening,
      account_balance: ledgerMap.get(emp.emp_id) ?? opening,
    };
  });
}

/**
 * Fast register list: narrow SELECT + one ledger closings query.
 * Without limit → full array (legacy). With limit → { items, total, limit, offset, hasMore }.
 */
export async function fetchRegisterEmployeeList(db, branchId, { status, limit, offset = 0, search } = {}) {
  await ensureEmployeeLedgerSchema(db);
  const where = registerWhere(branchId, { status, search });
  const take = limit != null ? Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100) : undefined;
  const skip = take != null ? Math.max(parseInt(offset, 10) || 0, 0) : undefined;

  const [total, employees] = await Promise.all([
    take != null ? db.employee.count({ where }) : Promise.resolve(null),
    db.employee.findMany({
      where,
      orderBy: { emp_name: 'asc' },
      select: REGISTER_EMPLOYEE_SELECT,
      ...(take != null ? { take, skip } : {}),
    }),
  ]);

  const ledgerMap = await getEmployeeLedgerClosingsMap(
    db,
    employees.map((e) => e.emp_id)
  );
  const items = employees.map((e) => mapRegisterEmployee(e, ledgerMap));

  if (take != null) {
    const off = skip ?? 0;
    return {
      items,
      total: total ?? items.length,
      limit: take,
      offset: off,
      hasMore: off + items.length < (total ?? 0),
    };
  }
  return items;
}

export async function enrichEmployeeRegisterRow(db, employee) {
  await ensureEmployeeLedgerSchema(db);
  const ledgerMap = await getEmployeeLedgerClosingsMap(db, [employee.emp_id]);
  return mapRegisterEmployee(employee, ledgerMap);
}
