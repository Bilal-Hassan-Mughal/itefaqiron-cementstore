import { attendanceDayBounds } from '@/lib/hr-payroll';

async function findAttendanceOnDay(tx, empId, att_date) {
  const bounds = attendanceDayBounds(att_date);
  if (!bounds) return null;
  return tx.attendance.findFirst({
    where: {
      emp_id: empId,
      att_date: { gte: bounds.start, lt: bounds.end },
    },
  });
}

/** Last edit wins when the same employee/day appears more than once in a batch. */
function dedupeSheetRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const empId = parseInt(row.emp_id, 10);
    const bounds = attendanceDayBounds(row.att_date);
    if (!empId || !bounds) continue;
    const key = `${empId}|${row.att_date}`;
    map.set(key, row);
  }
  return [...map.values()];
}

async function saveOneRow(tx, empId, row) {
  const bounds = attendanceDayBounds(row.att_date);
  if (!bounds) throw new Error(`Invalid att_date: ${row.att_date}`);

  const existing = await findAttendanceOnDay(tx, empId, row.att_date);

  if (row.clear) {
    if (existing) {
      await tx.attendance.delete({ where: { att_id: existing.att_id } });
    }
    return;
  }

  const data = {
    in_time: row.in_time || null,
    out_time: row.out_time || null,
    status: row.status || 'PRESENT',
    notes: row.notes || null,
    att_date: existing?.att_date ?? bounds.storageDate,
  };

  if (existing) {
    await tx.attendance.update({
      where: { att_id: existing.att_id },
      data,
    });
    return;
  }

  await tx.attendance.create({
    data: { emp_id: empId, ...data },
  });
}

/**
 * Batch save sheet edits — branch validation once, day-range match (avoids date/upsert races).
 */
export async function batchSaveAttendanceSheet(tx, branchId, rows) {
  const deduped = dedupeSheetRows(rows);
  if (deduped.length === 0) return { saved: 0 };

  const empIds = [...new Set(deduped.map((r) => parseInt(r.emp_id, 10)).filter(Boolean))];
  const allowedRows = await tx.employee.findMany({
    where: { branch_id: branchId, emp_id: { in: empIds } },
    select: { emp_id: true },
  });
  const allowed = new Set(allowedRows.map((e) => e.emp_id));

  for (const row of deduped) {
    const empId = parseInt(row.emp_id, 10);
    if (!allowed.has(empId)) {
      throw new Error(`Employee ${empId} is not in this branch`);
    }
    await saveOneRow(tx, empId, row);
  }

  return { saved: deduped.length };
}
