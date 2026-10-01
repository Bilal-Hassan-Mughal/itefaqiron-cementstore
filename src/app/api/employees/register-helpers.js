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
  };
}

/** Fast register list: narrow SELECT + one ledger closings query. */
export async function fetchRegisterEmployeeList(db, branchId, { status } = {}) {
  await ensureEmployeeLedgerSchema(db);
  const employees = await db.employee.findMany({
    where: {
      branch_id: branchId,
      ...(status ? { status } : {}),
    },
    orderBy: { emp_name: 'asc' },
    select: REGISTER_EMPLOYEE_SELECT,
  });
  const ledgerMap = await getEmployeeLedgerClosingsMap(
    db,
    employees.map((e) => e.emp_id)
  );
  return employees.map((e) => mapRegisterEmployee(e, ledgerMap));
}

export async function enrichEmployeeRegisterRow(db, employee) {
  await ensureEmployeeLedgerSchema(db);
  const ledgerMap = await getEmployeeLedgerClosingsMap(db, [employee.emp_id]);
  return mapRegisterEmployee(employee, ledgerMap);
}
