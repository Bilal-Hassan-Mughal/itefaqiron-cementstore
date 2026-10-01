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

/** Fast monthly sheet payload for HR Attendance tab. */
export async function buildAttendanceSheetPayload(db, branchId, month, year) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [employees, attendance] = await Promise.all([
    db.employee.findMany({
      where: { branch_id: branchId, status: 'ACTIVE' },
      orderBy: { emp_name: 'asc' },
      select: SHEET_EMPLOYEE_SELECT,
    }),
    db.attendance.findMany({
      where: {
        att_date: { gte: monthStart, lt: monthEnd },
        employee: { branch_id: branchId, status: 'ACTIVE' },
      },
      select: SHEET_ATTENDANCE_SELECT,
      orderBy: [{ att_date: 'asc' }, { emp_id: 'asc' }],
    }),
  ]);

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

  return {
    month,
    year,
    daysInMonth,
    dayMeta,
    employees,
    grid,
    offDays,
  };
}
