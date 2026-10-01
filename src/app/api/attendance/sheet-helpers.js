import {
  detectBranchOffDays,
  getMonthDayMeta,
  toDateKey,
} from '@/lib/hr-payroll';

const SHEET_EMPLOYEE_SELECT = {
  emp_id: true,
  emp_name: true,
  designation: true,
  department: true,
  join_date: true,
};

const SHEET_ATTENDANCE_SELECT = {
  att_id: true,
  emp_id: true,
  att_date: true,
  status: true,
  in_time: true,
  out_time: true,
  notes: true,
};

function leanCell(record) {
  if (!record) return null;
  return {
    status: record.status,
    in_time: record.in_time,
    out_time: record.out_time,
    notes: record.notes,
  };
}

const SHEET_EMP_PAGE = 50;

/** Fast monthly sheet payload for HR Attendance tab (optional employee paging). */
export async function buildAttendanceSheetPayload(db, branchId, month, year, options = {}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const empWhere = { branch_id: branchId, status: 'ACTIVE' };
  const limitParam = options.limit != null ? parseInt(options.limit, 10) : null;
  const offset = Math.max(parseInt(options.offset || 0, 10) || 0, 0);
  const take = limitParam != null ? Math.min(Math.max(limitParam, 1), 100) : undefined;

  const [totalEmployees, employees] = await Promise.all([
    take != null ? db.employee.count({ where: empWhere }) : Promise.resolve(null),
    db.employee.findMany({
      where: empWhere,
      orderBy: { emp_name: 'asc' },
      select: SHEET_EMPLOYEE_SELECT,
      ...(take != null ? { take, skip: offset } : {}),
    }),
  ]);

  const empIds = employees.map((e) => e.emp_id);
  const attendance = empIds.length === 0
    ? []
    : await db.attendance.findMany({
      where: {
        att_date: { gte: monthStart, lt: monthEnd },
        emp_id: { in: empIds },
      },
      select: SHEET_ATTENDANCE_SELECT,
      orderBy: [{ att_date: 'asc' }, { emp_id: 'asc' }],
    });

  const { daysInMonth, days: dayMeta } = getMonthDayMeta(month, year);
  const grid = {};
  for (const emp of employees) {
    grid[emp.emp_id] = {};
  }
  for (const row of attendance) {
    const dateKey = toDateKey(row.att_date);
    if (!dateKey) continue;
    const day = parseInt(dateKey.slice(8, 10), 10);
    if (!Number.isFinite(day)) continue;
    if (!grid[row.emp_id]) grid[row.emp_id] = {};
    grid[row.emp_id][day] = leanCell(row);
  }

  const offDays = detectBranchOffDays(employees, attendance, month, year);

  const payload = {
    month,
    year,
    daysInMonth,
    dayMeta,
    employees,
    grid,
    offDays,
  };

  if (take != null) {
    payload.totalEmployees = totalEmployees ?? employees.length;
    payload.employeeLimit = take;
    payload.employeeOffset = offset;
    payload.hasMoreEmployees = offset + employees.length < (totalEmployees ?? 0);
  }

  return payload;
}

export { SHEET_EMP_PAGE };
