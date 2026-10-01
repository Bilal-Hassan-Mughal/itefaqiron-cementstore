import { attendanceDayBounds, toDateKey } from '@/lib/hr-payroll';

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

function rowLookupKey(empId, attDateStr) {
  return `${empId}|${attDateStr}`;
}

/**
 * Batch save sheet edits — one branch check, one prefetch, bulk delete/create, batched updates.
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

  let minStart = null;
  let maxEnd = null;
  for (const row of deduped) {
    const bounds = attendanceDayBounds(row.att_date);
    if (!bounds) continue;
    if (!minStart || bounds.start < minStart) minStart = bounds.start;
    if (!maxEnd || bounds.end > maxEnd) maxEnd = bounds.end;
  }

  const existingMap = new Map();
  if (minStart && maxEnd && allowed.size > 0) {
    const existing = await tx.attendance.findMany({
      where: {
        emp_id: { in: [...allowed] },
        att_date: { gte: minStart, lt: maxEnd },
      },
      select: { att_id: true, emp_id: true, att_date: true },
    });
    for (const ex of existing) {
      const dateKey = toDateKey(ex.att_date);
      if (!dateKey) continue;
      existingMap.set(rowLookupKey(ex.emp_id, dateKey), ex);
    }
  }

  const deleteIds = [];
  const creates = [];
  const updates = [];

  for (const row of deduped) {
    const empId = parseInt(row.emp_id, 10);
    if (!allowed.has(empId)) {
      throw new Error(`Employee ${empId} is not in this branch`);
    }
    const bounds = attendanceDayBounds(row.att_date);
    if (!bounds) throw new Error(`Invalid att_date: ${row.att_date}`);

    const lookupKey = rowLookupKey(empId, row.att_date);
    const existing = existingMap.get(lookupKey);

    if (row.clear) {
      if (existing) deleteIds.push(existing.att_id);
      continue;
    }

    const data = {
      in_time: row.in_time || null,
      out_time: row.out_time || null,
      status: row.status || 'PRESENT',
      notes: row.notes || null,
      att_date: existing?.att_date ?? bounds.storageDate,
    };

    if (existing) {
      updates.push({ att_id: existing.att_id, data });
    } else {
      creates.push({
        emp_id: empId,
        in_time: data.in_time,
        out_time: data.out_time,
        status: data.status,
        notes: data.notes,
        att_date: bounds.storageDate,
      });
    }
  }

  if (deleteIds.length > 0) {
    await tx.attendance.deleteMany({ where: { att_id: { in: deleteIds } } });
  }

  const UPDATE_CHUNK = 25;
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map(({ att_id, data }) => tx.attendance.update({ where: { att_id }, data }))
    );
  }

  if (creates.length > 0) {
    await tx.attendance.createMany({ data: creates });
  }

  return { saved: deduped.length };
}
