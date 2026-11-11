import { Prisma } from '@prisma/client';
import prisma, { sqlTableName, sqlBranchWhere } from '@/lib/prisma';
import { PROMISE_STATUS } from '@/lib/account-payment-promise';

function tableIdent() {
  const name = String(sqlTableName('customer_payment_promises') || 'customer_payment_promises').replace(
    /[^a-zA-Z0-9_]/g,
    '',
  );
  return Prisma.raw(`\`${name}\``);
}

function delegate() {
  const d = prisma.customerPaymentPromise;
  return d?.findMany ? d : null;
}

function customersTableIdent() {
  const name = String(sqlTableName('customers') || 'customers').replace(/[^a-zA-Z0-9_]/g, '');
  return Prisma.raw(`\`${name}\``);
}

export function normalizePromiseRow(row) {
  if (!row) return null;
  return {
    promise_id: Number(row.promise_id),
    branch_id: Number(row.branch_id),
    cus_id: Number(row.cus_id),
    promised_pay_date: row.promised_pay_date,
    promised_amount: row.promised_amount != null ? Number(row.promised_amount) : null,
    note: row.note ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by != null ? Number(row.created_by) : null,
    fulfilled_at: row.fulfilled_at ?? null,
    whatsapp_reminder_sent_at: row.whatsapp_reminder_sent_at ?? null,
    whatsapp_reminder_sent_by:
      row.whatsapp_reminder_sent_by != null ? Number(row.whatsapp_reminder_sent_by) : null,
    cus_name: row.cus_name ?? undefined,
    cus_phone_no: row.cus_phone_no ?? undefined,
    cus_phone_no2: row.cus_phone_no2 ?? undefined,
    cus_balance: row.cus_balance != null ? Number(row.cus_balance) : undefined,
  };
}

function parseFilterDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapQueueItem(row) {
  const base = normalizePromiseRow(row);
  if (!base) return null;
  const phone = base.cus_phone_no || base.cus_phone_no2 || '';
  return {
    ...base,
    customer: {
      cus_id: base.cus_id,
      cus_name: base.cus_name,
      cus_phone_no: base.cus_phone_no,
      cus_phone_no2: base.cus_phone_no2,
      cus_balance: base.cus_balance,
    },
    has_phone: Boolean(String(phone).trim()),
    reminder_sent: Boolean(base.whatsapp_reminder_sent_at),
  };
}

export function summarizePaymentPromiseQueue(items, viewDate = null) {
  const anchor = viewDate ? String(viewDate).slice(0, 10) : null;
  let sent = 0;
  let pending = 0;
  let noPhone = 0;
  let carryOver = 0;
  let dueToday = 0;

  (items || []).forEach((row) => {
    if (row.reminder_sent) sent += 1;
    else pending += 1;
    if (!row.has_phone) noPhone += 1;
    if (row.carried_over) carryOver += 1;
    if (anchor) {
      const payDay = row.promised_pay_date ? String(row.promised_pay_date).slice(0, 10) : '';
      if (payDay === anchor) dueToday += 1;
    }
  });

  return {
    total: (items || []).length,
    sent,
    pending,
    noPhone,
    readyToSend: (items || []).filter((r) => !r.reminder_sent && r.has_phone).length,
    carryOver,
    dueToday,
  };
}

export async function listPaymentPromiseQueue(branchId, filters = {}) {
  const {
    date,
    from,
    to,
    send = 'all',
    overdue,
    search,
  } = filters;

  const pTable = tableIdent();
  const cTable = customersTableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId, 'p'));

  const day = date ? String(date).slice(0, 10) : null;
  const rangeFrom = from ? String(from).slice(0, 10) : null;
  const rangeTo = to ? String(to).slice(0, 10) : null;

  let dateFilter = Prisma.empty;
  if (overdue === '1' || overdue === true) {
    dateFilter = Prisma.raw('AND DATE(p.promised_pay_date) < CURDATE()');
  } else if (day) {
    // Due on selected day, plus any still-unsent reminder from earlier days (rolls forward daily).
    if (send === 'sent') {
      dateFilter = Prisma.sql`AND DATE(p.promised_pay_date) = ${day}`;
    } else {
      dateFilter = Prisma.sql`AND (
        DATE(p.promised_pay_date) = ${day}
        OR (
          p.whatsapp_reminder_sent_at IS NULL
          AND DATE(p.promised_pay_date) < ${day}
        )
      )`;
    }
  } else if (rangeFrom && rangeTo) {
    if (send === 'sent') {
      dateFilter = Prisma.sql`AND DATE(p.promised_pay_date) BETWEEN ${rangeFrom} AND ${rangeTo}`;
    } else {
      dateFilter = Prisma.sql`AND (
        DATE(p.promised_pay_date) BETWEEN ${rangeFrom} AND ${rangeTo}
        OR (
          p.whatsapp_reminder_sent_at IS NULL
          AND DATE(p.promised_pay_date) < ${rangeFrom}
        )
      )`;
    }
  }

  let sendFilter = Prisma.empty;
  if (send === 'pending') sendFilter = Prisma.raw('AND p.whatsapp_reminder_sent_at IS NULL');
  if (send === 'sent') sendFilter = Prisma.raw('AND p.whatsapp_reminder_sent_at IS NOT NULL');

  const searchTrim = search?.trim();
  let searchFilter = Prisma.empty;
  if (searchTrim) {
    const like = `%${searchTrim.replace(/[%_]/g, '')}%`;
    searchFilter = Prisma.sql`AND (c.cus_name LIKE ${like} OR c.cus_phone_no LIKE ${like} OR c.cus_phone_no2 LIKE ${like})`;
  }

  const rows = await prisma.$queryRaw`
    SELECT
      p.*,
      c.cus_name,
      c.cus_phone_no,
      c.cus_phone_no2,
      c.cus_balance
    FROM ${pTable} p
    INNER JOIN ${cTable} c ON c.cus_id = p.cus_id AND c.branch_id = p.branch_id
    WHERE ${branchFilter}
      AND p.status = ${PROMISE_STATUS.ACTIVE}
      ${dateFilter}
      ${sendFilter}
      ${searchFilter}
    ORDER BY p.promised_pay_date ASC, p.cus_id ASC
  `;

  const viewAnchor = day || rangeFrom || null;

  return rows.map((row) => {
    const item = mapQueueItem(row);
    if (!item) return item;
    const payDay = row.promised_pay_date ? String(row.promised_pay_date).slice(0, 10) : '';
    item.carried_over = Boolean(
      viewAnchor && !item.reminder_sent && payDay && payDay < viewAnchor,
    );
    return item;
  });
}

export async function markWhatsappReminderSent(branchId, promiseIds, sentBy) {
  const ids = (promiseIds || []).map((id) => parseInt(id, 10)).filter(Boolean);
  if (!ids.length) return { count: 0 };

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const idList = Prisma.join(ids);
  const result = await prisma.$executeRaw`
    UPDATE ${table}
    SET whatsapp_reminder_sent_at = NOW(3),
        whatsapp_reminder_sent_by = ${sentBy ?? null},
        updated_at = NOW(3)
    WHERE ${branchFilter} AND promise_id IN (${idList})
  `;
  return { count: Number(result) || ids.length };
}

export async function clearWhatsappReminderSent(branchId, promiseIds) {
  const ids = (promiseIds || []).map((id) => parseInt(id, 10)).filter(Boolean);
  if (!ids.length) return { count: 0 };

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const idList = Prisma.join(ids);
  const result = await prisma.$executeRaw`
    UPDATE ${table}
    SET whatsapp_reminder_sent_at = NULL,
        whatsapp_reminder_sent_by = NULL,
        updated_at = NOW(3)
    WHERE ${branchFilter} AND promise_id IN (${idList})
  `;
  return { count: Number(result) || ids.length };
}

export async function findActivePromisesForBranch(branchId) {
  const model = delegate();
  if (model) {
    return model.findMany({
      where: { branch_id: branchId, status: PROMISE_STATUS.ACTIVE },
      orderBy: { promised_pay_date: 'asc' },
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const rows = await prisma.$queryRaw`
    SELECT * FROM ${table}
    WHERE ${branchFilter} AND status = ${PROMISE_STATUS.ACTIVE}
    ORDER BY promised_pay_date ASC
  `;
  return rows.map(normalizePromiseRow);
}

export async function findActiveForCustomer(branchId, cusId) {
  const model = delegate();
  if (model) {
    return model.findFirst({
      where: { branch_id: branchId, cus_id: cusId, status: PROMISE_STATUS.ACTIVE },
      orderBy: { created_at: 'desc' },
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const rows = await prisma.$queryRaw`
    SELECT * FROM ${table}
    WHERE ${branchFilter} AND cus_id = ${cusId} AND status = ${PROMISE_STATUS.ACTIVE}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return normalizePromiseRow(rows[0]);
}

export async function findHistoryForCustomer(branchId, cusId, take = 8) {
  const model = delegate();
  if (model) {
    return model.findMany({
      where: { branch_id: branchId, cus_id: cusId },
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const rows = await prisma.$queryRaw`
    SELECT * FROM ${table}
    WHERE ${branchFilter} AND cus_id = ${cusId}
    ORDER BY created_at DESC
    LIMIT ${take}
  `;
  return rows.map(normalizePromiseRow);
}

export async function cancelActiveForCustomer(branchId, cusId) {
  const model = delegate();
  if (model) {
    return model.updateMany({
      where: { branch_id: branchId, cus_id: cusId, status: PROMISE_STATUS.ACTIVE },
      data: { status: PROMISE_STATUS.CANCELLED },
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  await prisma.$executeRaw`
    UPDATE ${table}
    SET status = ${PROMISE_STATUS.CANCELLED}, updated_at = NOW(3)
    WHERE ${branchFilter} AND cus_id = ${cusId} AND status = ${PROMISE_STATUS.ACTIVE}
  `;
}

export async function createActivePromise({
  branchId,
  cusId,
  promisedPayDate,
  promisedAmount,
  note,
  createdBy,
}) {
  const model = delegate();
  if (model) {
    return model.create({
      data: {
        branch_id: branchId,
        cus_id: cusId,
        promised_pay_date: promisedPayDate,
        promised_amount: promisedAmount,
        note,
        status: PROMISE_STATUS.ACTIVE,
        created_by: createdBy,
      },
    });
  }

  const table = tableIdent();
  const payDate = promisedPayDate instanceof Date ? promisedPayDate.toISOString().slice(0, 10) : String(promisedPayDate).slice(0, 10);
  await prisma.$executeRaw`
    INSERT INTO ${table}
      (branch_id, cus_id, promised_pay_date, promised_amount, note, status, created_by, updated_at)
    VALUES
      (${branchId}, ${cusId}, ${payDate}, ${promisedAmount}, ${note}, ${PROMISE_STATUS.ACTIVE}, ${createdBy}, NOW(3))
  `;
  const rows = await prisma.$queryRaw`
    SELECT * FROM ${table}
    WHERE promise_id = LAST_INSERT_ID()
  `;
  return normalizePromiseRow(rows[0]);
}

export async function findPromiseById(branchId, promiseId) {
  const model = delegate();
  if (model) {
    return model.findFirst({
      where: { branch_id: branchId, promise_id: promiseId },
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  const rows = await prisma.$queryRaw`
    SELECT * FROM ${table}
    WHERE ${branchFilter} AND promise_id = ${promiseId}
    LIMIT 1
  `;
  return normalizePromiseRow(rows[0]);
}

export async function patchPromiseStatus(branchId, promiseId, action) {
  const status = action === 'fulfill' ? PROMISE_STATUS.FULFILLED : PROMISE_STATUS.CANCELLED;
  const fulfilledAt = action === 'fulfill' ? new Date() : null;

  const model = delegate();
  if (model) {
    return model.update({
      where: { promise_id: promiseId },
      data: {
        status,
        fulfilled_at: fulfilledAt,
      },
    });
  }

  const table = tableIdent();
  const branchFilter = Prisma.raw(sqlBranchWhere(branchId));
  if (action === 'fulfill') {
    await prisma.$executeRaw`
      UPDATE ${table}
      SET status = ${status}, fulfilled_at = NOW(3), updated_at = NOW(3)
      WHERE ${branchFilter} AND promise_id = ${promiseId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE ${table}
      SET status = ${status}, fulfilled_at = NULL, updated_at = NOW(3)
      WHERE ${branchFilter} AND promise_id = ${promiseId}
    `;
  }
  return findPromiseById(branchId, promiseId);
}
