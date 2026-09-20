import { Prisma } from '@prisma/client';
import { sqlTableName } from '@/lib/prisma';

function likeValue(raw) {
  return `%${String(raw || '').replace(/[%_\\]/g, '')}%`;
}

function pkRange(fromDate, toDate) {
  const created_at = {};
  if (fromDate) created_at.gte = new Date(`${fromDate}T00:00:00.000+05:00`);
  if (toDate) created_at.lte = new Date(`${toDate}T23:59:59.999+05:00`);
  return created_at;
}

function paymentTypeFilter(paymentType) {
  const t = String(paymentType || '').toUpperCase();
  if (t === 'CASH') return ['CASH'];
  if (t === 'BANK' || t === 'BANK_TRANSFER' || t === 'CHEQUE') return ['BANK_TRANSFER', 'CHEQUE'];
  return null;
}

function andJoin(parts) {
  const filtered = parts.filter(Boolean);
  if (!filtered.length) return Prisma.sql`1=1`;
  return Prisma.join(filtered, ' AND ');
}

function tableIdent(base) {
  const name = String(sqlTableName(base) || base).replace(/[^a-zA-Z0-9_]/g, '');
  return Prisma.raw(`\`${name}\``);
}

function listTables() {
  return {
    sales: tableIdent('sales'),
    customers: tableIdent('customers'),
    sale_details: tableIdent('sale_details'),
    products: tableIdent('products'),
    sale_returns: tableIdent('sale_returns'),
    sale_return_details: tableIdent('sale_return_details'),
  };
}

function saleWhereSql(branchId, f, t) {
  const parts = [
    Prisma.sql`s.branch_id = ${branchId}`,
    f.saleBillType
      ? Prisma.sql`s.bill_type = ${f.saleBillType}`
      : Prisma.sql`s.bill_type = 'BILL'`,
  ];
  if (f.cusId) parts.push(Prisma.sql`s.cus_id = ${f.cusId}`);
  if (f.payTypes) {
    parts.push(Prisma.sql`s.payment_type IN (${Prisma.join(f.payTypes.map((type) => Prisma.sql`${type}`))})`);
  }
  if (f.fromDate) parts.push(Prisma.sql`s.created_at >= ${f.created_at.gte}`);
  if (f.toDate) parts.push(Prisma.sql`s.created_at <= ${f.created_at.lte}`);
  if (f.minAmount != null) parts.push(Prisma.sql`s.total_amount >= ${f.minAmount}`);
  if (f.maxAmount != null) parts.push(Prisma.sql`s.total_amount <= ${f.maxAmount}`);
  if (f.exactAmount != null) parts.push(Prisma.sql`ABS(s.total_amount - ${f.exactAmount}) < 0.01`);
  if (f.notes) parts.push(Prisma.sql`s.reference LIKE ${likeValue(f.notes)}`);
  if (f.storeId) {
    parts.push(Prisma.sql`(s.store_id = ${f.storeId} OR EXISTS (
      SELECT 1 FROM ${t.sale_details} sd0 WHERE sd0.sale_id = s.sale_id AND sd0.store_id = ${f.storeId}
    ))`);
  }
  if (f.balanceStatus === 'with_balance') parts.push(Prisma.sql`s.total_amount > s.payment`);
  if (f.balanceStatus === 'without_balance') parts.push(Prisma.sql`s.total_amount <= s.payment`);
  if (f.balanceStatus === 'overpaid') parts.push(Prisma.sql`s.total_amount < s.payment`);
  if (f.item) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM ${t.sale_details} sd
      LEFT JOIN ${t.products} p ON p.pro_id = sd.pro_id
      WHERE sd.sale_id = s.sale_id AND p.pro_title LIKE ${likeValue(f.item)}
    )`);
  }
  if (f.quantity != null) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM ${t.sale_details} sd
      WHERE sd.sale_id = s.sale_id AND ABS(sd.qnty - ${f.quantity}) < 0.001
    )`);
  }
  if (f.q) {
    const qLike = likeValue(f.q);
    const qNum = Number(f.q);
    const qBits = [
      Prisma.sql`CAST(s.sale_id AS CHAR) LIKE ${qLike}`,
      Prisma.sql`CAST(s.bill_number AS CHAR) LIKE ${qLike}`,
      Prisma.sql`s.reference LIKE ${qLike}`,
      Prisma.sql`c.cus_name LIKE ${qLike}`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM ${t.sale_details} sd2
        LEFT JOIN ${t.products} p2 ON p2.pro_id = sd2.pro_id
        WHERE sd2.sale_id = s.sale_id AND p2.pro_title LIKE ${qLike}
      )`,
    ];
    if (Number.isFinite(qNum)) qBits.push(Prisma.sql`s.total_amount = ${qNum}`);
    parts.push(Prisma.sql`(${Prisma.join(qBits, ' OR ')})`);
  }
  return andJoin(parts);
}

function returnWhereSql(branchId, f, t) {
  const parts = [Prisma.sql`r.branch_id = ${branchId}`];
  if (f.cusId) parts.push(Prisma.sql`r.cus_id = ${f.cusId}`);
  if (f.payTypes) {
    parts.push(Prisma.sql`r.payment_type IN (${Prisma.join(f.payTypes.map((type) => Prisma.sql`${type}`))})`);
  }
  if (f.fromDate) parts.push(Prisma.sql`r.created_at >= ${f.created_at.gte}`);
  if (f.toDate) parts.push(Prisma.sql`r.created_at <= ${f.created_at.lte}`);
  if (f.minAmount != null) parts.push(Prisma.sql`r.total_amount >= ${f.minAmount}`);
  if (f.maxAmount != null) parts.push(Prisma.sql`r.total_amount <= ${f.maxAmount}`);
  if (f.exactAmount != null) parts.push(Prisma.sql`ABS(r.total_amount - ${f.exactAmount}) < 0.01`);
  if (f.notes) parts.push(Prisma.sql`r.reference LIKE ${likeValue(f.notes)}`);
  if (f.storeId) {
    parts.push(Prisma.sql`(EXISTS (
      SELECT 1 FROM ${t.sale_return_details} rd0 WHERE rd0.return_id = r.return_id AND rd0.store_id = ${f.storeId}
    ) OR NOT EXISTS (
      SELECT 1 FROM ${t.sale_return_details} rd1 WHERE rd1.return_id = r.return_id AND rd1.store_id IS NOT NULL
    ))`);
  }
  if (f.balanceStatus === 'with_balance') parts.push(Prisma.sql`r.total_amount > r.payment`);
  if (f.balanceStatus === 'without_balance') parts.push(Prisma.sql`r.total_amount <= r.payment`);
  if (f.balanceStatus === 'overpaid') parts.push(Prisma.sql`r.total_amount < r.payment`);
  if (f.item) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM ${t.sale_return_details} rd
      LEFT JOIN ${t.products} p ON p.pro_id = rd.pro_id
      WHERE rd.return_id = r.return_id AND p.pro_title LIKE ${likeValue(f.item)}
    )`);
  }
  if (f.quantity != null) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM ${t.sale_return_details} rd
      WHERE rd.return_id = r.return_id AND ABS(rd.qnty - ${f.quantity}) < 0.001
    )`);
  }
  if (f.q) {
    const qLike = likeValue(f.q);
    const qNum = Number(f.q);
    const qBits = [
      Prisma.sql`CAST(r.return_id AS CHAR) LIKE ${qLike}`,
      Prisma.sql`CAST(r.sale_id AS CHAR) LIKE ${qLike}`,
      Prisma.sql`r.reference LIKE ${qLike}`,
      Prisma.sql`c.cus_name LIKE ${qLike}`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM ${t.sale_return_details} rd2
        LEFT JOIN ${t.products} p2 ON p2.pro_id = rd2.pro_id
        WHERE rd2.return_id = r.return_id AND p2.pro_title LIKE ${qLike}
      )`,
    ];
    if (Number.isFinite(qNum)) qBits.push(Prisma.sql`r.total_amount = ${qNum}`);
    parts.push(Prisma.sql`(${Prisma.join(qBits, ' OR ')})`);
  }
  return andJoin(parts);
}

function orderSql(sortBy, sortOrder) {
  const dir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  if (sortBy === 'customer') return Prisma.raw(`sort_name ${dir}, created_at DESC`);
  if (sortBy === 'total_amount') return Prisma.raw(`sort_amount ${dir}, created_at DESC`);
  return Prisma.raw(`created_at ${dir}`);
}

const SALE_LIST_SELECT = {
  sale_id: true,
  bill_number: true,
  total_amount: true,
  discount: true,
  payment: true,
  payment_type: true,
  shipping_amount: true,
  labour_charges: true,
  bill_type: true,
  reference: true,
  created_at: true,
  updated_at: true,
  cus_id: true,
  cash_payment: true,
  bank_payment: true,
  advance_payment: true,
  customer: {
    select: {
      cus_id: true,
      cus_name: true,
      cus_phone_no: true,
      cus_address: true,
      cus_balance: true,
      name_urdu: true,
    },
  },
  sale_details: {
    select: {
      sale_detail_id: true,
      qnty: true,
      unit_rate: true,
      total_amount: true,
      store_id: true,
      product: { select: { pro_id: true, pro_title: true } },
    },
  },
};

const RETURN_LIST_SELECT = {
  return_id: true,
  sale_id: true,
  total_amount: true,
  discount: true,
  payment: true,
  payment_type: true,
  shipping_amount: true,
  labour_charges: true,
  reference: true,
  created_at: true,
  updated_at: true,
  cus_id: true,
  customer: {
    select: {
      cus_id: true,
      cus_name: true,
      cus_phone_no: true,
      cus_address: true,
      cus_balance: true,
      name_urdu: true,
    },
  },
  return_details: {
    select: {
      return_detail_id: true,
      qnty: true,
      unit_rate: true,
      total_amount: true,
      store_id: true,
      product: { select: { pro_id: true, pro_title: true } },
    },
  },
};

function mapReturnRow(ret) {
  return {
    ...ret,
    sale_id: `SR-${ret.return_id}`,
    actual_sale_id: ret.sale_id,
    is_return: true,
    bill_type: 'SALE_RETURN',
    notes: ret.reference || null,
    total_amount: Number(ret.total_amount) || 0,
    discount: Number(ret.discount) || 0,
    shipping_amount: Number(ret.shipping_amount) || 0,
    labour_charges: Number(ret.labour_charges) || 0,
    payment: Number(ret.payment) || 0,
    sale_details: (ret.return_details || []).map((d) => ({
      ...d,
      product: d.product,
      product_name: d.product?.pro_title,
      qnty: Number(d.qnty || d.return_quantity || 0),
      unit_rate: Number(d.unit_rate || 0),
      total_amount: Number(d.total_amount || d.return_amount || 0),
    })),
  };
}

function mapSaleRow(s) {
  return {
    ...s,
    notes: s.reference || null,
    bill_number: s.bill_number ?? null,
  };
}

export async function fetchPaginatedSalesList(prisma, branchId, params) {
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize, 10) || 25));
  const billType = String(params.billType || '').trim();
  const includeSales = !billType || billType === 'BILL' || billType === 'QUOTATION';
  const includeReturns = !billType || billType === 'SALE_RETURN';
  const created_at = pkRange(params.fromDate, params.toDate);
  const t = listTables();
  const f = {
    q: String(params.q || '').trim(),
    item: String(params.item || '').trim(),
    quantity: params.quantity !== '' && params.quantity != null ? Number(params.quantity) : null,
    notes: String(params.notes || '').trim(),
    cusId: params.cusId ? parseInt(params.cusId, 10) : null,
    storeId: params.storeId ? parseInt(params.storeId, 10) : null,
    payTypes: paymentTypeFilter(params.paymentType),
    fromDate: params.fromDate || '',
    toDate: params.toDate || '',
    created_at,
    minAmount: params.minAmount !== '' && params.minAmount != null ? Number(params.minAmount) : null,
    maxAmount: params.maxAmount !== '' && params.maxAmount != null ? Number(params.maxAmount) : null,
    exactAmount: params.amount !== '' && params.amount != null ? Number(params.amount) : null,
    balanceStatus: params.balanceStatus || '',
    saleBillType: billType === 'QUOTATION' ? 'QUOTATION' : billType === 'BILL' ? 'BILL' : '',
  };
  if (f.cusId && !Number.isFinite(f.cusId)) f.cusId = null;
  if (f.storeId && !Number.isFinite(f.storeId)) f.storeId = null;
  if (f.minAmount != null && !Number.isFinite(f.minAmount)) f.minAmount = null;
  if (f.maxAmount != null && !Number.isFinite(f.maxAmount)) f.maxAmount = null;
  if (f.exactAmount != null && !Number.isFinite(f.exactAmount)) f.exactAmount = null;
  if (f.quantity != null && !Number.isFinite(f.quantity)) f.quantity = null;

  const saleSql = Prisma.sql`
    SELECT 'SALE' AS kind, s.sale_id AS id, s.created_at AS created_at,
           s.total_amount AS sort_amount, c.cus_name AS sort_name
    FROM ${t.sales} s
    LEFT JOIN ${t.customers} c ON c.cus_id = s.cus_id
    WHERE ${saleWhereSql(branchId, f, t)}
  `;
  const returnSql = Prisma.sql`
    SELECT 'RETURN' AS kind, r.return_id AS id, r.created_at AS created_at,
           r.total_amount AS sort_amount, c.cus_name AS sort_name
    FROM ${t.sale_returns} r
    LEFT JOIN ${t.customers} c ON c.cus_id = r.cus_id
    WHERE ${returnWhereSql(branchId, f, t)}
  `;

  let unionSql;
  if (includeSales && includeReturns) {
    unionSql = Prisma.sql`${saleSql} UNION ALL ${returnSql}`;
  } else if (includeReturns) {
    unionSql = returnSql;
  } else {
    unionSql = saleSql;
  }

  const offset = (page - 1) * pageSize;
  const order = orderSql(params.sortBy, params.sortOrder);

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*) AS cnt FROM (${unionSql}) listed`,
    prisma.$queryRaw`
      SELECT kind, id FROM (${unionSql}) listed
      ORDER BY ${order}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const total = Number(countRows?.[0]?.cnt || 0);
  const saleIds = idRows.filter((r) => r.kind === 'SALE').map((r) => Number(r.id));
  const returnIds = idRows.filter((r) => r.kind === 'RETURN').map((r) => Number(r.id));

  const [sales, returns] = await Promise.all([
    saleIds.length
      ? prisma.sale.findMany({ where: { sale_id: { in: saleIds } }, select: SALE_LIST_SELECT })
      : [],
    returnIds.length
      ? prisma.saleReturn.findMany({ where: { return_id: { in: returnIds } }, select: RETURN_LIST_SELECT })
      : [],
  ]);

  const saleMap = new Map(sales.map((s) => [s.sale_id, mapSaleRow(s)]));
  const returnMap = new Map(returns.map((r) => [r.return_id, mapReturnRow(r)]));
  const data = idRows.map((row) => {
    if (row.kind === 'RETURN') return returnMap.get(Number(row.id));
    return saleMap.get(Number(row.id));
  }).filter(Boolean);

  return { data, total, page, pageSize };
}
