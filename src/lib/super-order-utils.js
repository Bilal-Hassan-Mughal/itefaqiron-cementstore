import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY, BRAND } from './brand-theme';

export function formatSuperOrderQty(v) {
  const n = parseFloat(String(v ?? '0').replace(/,/g, ''));
  if (Number.isNaN(n)) return '0';
  const r = Math.round(n * 10000) / 10000;
  if (Math.abs(r) < 1e-10) return '0';
  if (Math.abs(r - Math.round(r)) < 1e-6) {
    return Math.round(r).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }
  return r.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export function getTotalStock(product) {
  return (
    product.store_stocks?.reduce(
      (sum, ss) => sum + (parseFloat(String(ss.stock_quantity ?? 0)) || 0),
      0
    ) || parseFloat(String(product.pro_stock_qnty ?? 0)) || 0
  );
}

export function getStoreStock(product, storeId) {
  if (!storeId) return getTotalStock(product);
  const ss = product.store_stocks?.find((s) => s.store_id === parseInt(String(storeId), 10));
  return parseFloat(String(ss?.stock_quantity ?? 0)) || 0;
}

export function buildSuperOrderGridRows(filteredProducts) {
  const list = Array.isArray(filteredProducts) ? filteredProducts : [];
  const map = new Map();

  list.forEach((p) => {
    const cat = p.category?.cat_name || 'Uncategorized';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(p);
  });

  const rows = [];
  let rowNum = 0;
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [categoryName, categoryProducts] of sorted) {
    rows.push({
      kind: 'category',
      key: `cat-${categoryName}`,
      categoryName,
      count: categoryProducts.length,
    });
    for (const product of categoryProducts) {
      rowNum += 1;
      rows.push({
        kind: 'product',
        key: String(product.pro_id),
        categoryName,
        product,
        rowNum,
      });
    }
  }

  return rows;
}

export function buildOrderLinesFromQtys(products, orderQtys, storeId = '') {
  return (Array.isArray(products) ? products : [])
    .filter((p) => (parseFloat(orderQtys[p.pro_id]) || 0) > 0)
    .map((p) => ({
      product: p,
      stock: getStoreStock(p, storeId),
      orderQty: parseFloat(orderQtys[p.pro_id]) || 0,
    }))
    .sort((a, b) => {
      const c = (a.product.category?.cat_name || '').localeCompare(b.product.category?.cat_name || '');
      if (c !== 0) return c;
      return (a.product.pro_title || '').localeCompare(b.product.pro_title || '');
    });
}

export function buildSuperOrderPayload({
  orderDate,
  supplierName,
  orderNotes,
  selectedStore,
  selectedCategory,
  stockFilter,
  orderQtys,
  orderLines,
}) {
  return {
    orderDate,
    supplierName,
    orderNotes,
    selectedStore,
    selectedCategory,
    stockFilter,
    orderQtys,
    lines: orderLines.map((row) => ({
      pro_id: row.product.pro_id,
      pro_title: row.product.pro_title,
      category_name: row.product.category?.cat_name || '',
      stock_snapshot: row.stock,
      order_qty: row.orderQty,
    })),
  };
}

export function orderLinesFromPayload(payload, products) {
  const productMap = new Map((products || []).map((p) => [p.pro_id, p]));
  const lines = payload?.lines || [];
  return lines
    .map((line) => {
      const product = productMap.get(line.pro_id) || {
        pro_id: line.pro_id,
        pro_title: line.pro_title,
        category: { cat_name: line.category_name || '' },
        store_stocks: [],
      };
      return {
        product,
        stock: line.stock_snapshot ?? 0,
        orderQty: parseFloat(line.order_qty) || 0,
      };
    })
    .filter((row) => row.orderQty > 0);
}

export function orderQtysFromPayload(payload) {
  const qtys = {};
  if (payload?.orderQtys && typeof payload.orderQtys === 'object') {
    Object.entries(payload.orderQtys).forEach(([id, qty]) => {
      if (parseFloat(qty) > 0) qtys[id] = String(qty);
    });
    return qtys;
  }
  (payload?.lines || []).forEach((line) => {
    if (line.pro_id && parseFloat(line.order_qty) > 0) {
      qtys[line.pro_id] = String(line.order_qty);
    }
  });
  return qtys;
}

export function buildSuperOrderMetaLines({
  orderDate,
  orderNo,
  supplierName,
  selectedCategory,
  categories = [],
  selectedStore,
  stores = [],
  orderNotes,
  includeGenerated = true,
}) {
  const lines = [`Date: ${orderDate || '—'}`];
  if (orderNo) lines.push(`Order No: ${orderNo}`);
  if (supplierName?.trim()) lines.push(`Supplier: ${supplierName.trim()}`);
  if (selectedCategory) {
    const cat = categories.find((c) => String(c.cat_id) === String(selectedCategory));
    if (cat) lines.push(`Category: ${cat.cat_name}`);
  }
  if (selectedStore) {
    const st = stores.find((s) => String(s.storeid) === String(selectedStore));
    if (st) lines.push(`Store: ${st.store_name}`);
  }
  if (orderNotes?.trim()) lines.push(`Notes: ${orderNotes.trim()}`);
  if (includeGenerated) {
    lines.push(
      `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
    );
  }
  return lines;
}

export function buildSuperOrderExportContext(data, products, categories, stores) {
  const payload = data?.payload || {};
  const orderDate = data?.order_date
    ? new Date(data.order_date).toISOString().slice(0, 10)
    : payload.orderDate || '';
  const selectedStore = String(payload.selectedStore || data?.store_id || '');
  const orderLines = orderLinesFromPayload(payload, products);
  const orderSummary = {
    lines: orderLines.length,
    totalQty: orderLines.reduce((sum, row) => sum + row.orderQty, 0),
  };
  const metaLines = buildSuperOrderMetaLines({
    orderDate,
    orderNo: data?.order_no,
    supplierName: data?.supplier_name || payload.supplierName,
    selectedCategory: payload.selectedCategory,
    categories,
    selectedStore,
    stores,
    orderNotes: data?.notes || payload.orderNotes,
  });
  return { orderLines, orderSummary, metaLines, orderNo: data?.order_no, orderDate };
}

export function buildSuperOrderPdf({ orderLines, orderSummary, metaLines, orderNo }) {
  if (!orderLines?.length) return null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(COMPANY.nameShort?.toUpperCase() || 'ITTEFAQ IRON STORE', pageWidth / 2, 36, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.address || 'Parianwali, Pakistan', pageWidth / 2, 52, { align: 'center' });

  const blue = BRAND.primary.blue.replace('#', '');
  doc.setFillColor(
    parseInt(blue.slice(0, 2), 16),
    parseInt(blue.slice(2, 4), 16),
    parseInt(blue.slice(4, 6), 16)
  );
  doc.rect(40, 62, pageWidth - 80, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const title = orderNo ? `SUPER ORDER — ${orderNo}` : 'SUPER ORDER SHEET';
  doc.text(title, pageWidth / 2, 77, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 98;
  (metaLines || []).forEach((line) => {
    doc.text(line, 40, y);
    y += 12;
  });

  autoTable(doc, {
    startY: y + 8,
    head: [['#', 'Category', 'Product', 'Order Qty']],
    body: orderLines.map((row, i) => [
      String(i + 1),
      row.product.category?.cat_name || row.product.category_name || '—',
      row.product.pro_title || '—',
      formatSuperOrderQty(row.orderQty),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [26, 85, 227],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: [21, 71, 196],
      lineWidth: 0.5,
    },
    bodyStyles: { fontSize: 9, lineColor: [226, 232, 240], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    styles: { cellPadding: 5, overflow: 'linebreak' },
  });

  const finalY = doc.lastAutoTable.finalY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Total items: ${orderSummary.lines}   |   Total order qty: ${formatSuperOrderQty(orderSummary.totalQty)}`,
    40,
    finalY
  );

  return doc;
}
