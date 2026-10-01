function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

/** Line / product subtotal before discount (excludes shipping & labour). */
export function saleReportSubtotal(sale) {
  const total = n(sale?.total_amount);
  const discount = n(sale?.discount);
  const shipping = n(sale?.shipping_amount);
  const labour = n(sale?.labour_charges);
  return total - shipping - labour + discount;
}

/** Delivery + labour shown in the Shipping column. */
export function saleReportShippingDisplay(sale) {
  return n(sale?.shipping_amount) + n(sale?.labour_charges);
}

/** Invoice net — same as POS `total_amount` / grand total. */
export function saleReportNetTotal(sale) {
  return n(sale?.total_amount);
}

export function sumSaleReportSummary(sales) {
  const rows = sales || [];
  let subtotal = 0;
  let discount = 0;
  let shipping = 0;
  let netTotal = 0;
  let payment = 0;
  for (const s of rows) {
    subtotal += saleReportSubtotal(s);
    discount += n(s.discount);
    shipping += saleReportShippingDisplay(s);
    netTotal += saleReportNetTotal(s);
    payment += n(s.payment);
  }
  return {
    totalSales: rows.length,
    totalAmount: subtotal,
    totalDiscount: discount,
    totalShipping: shipping,
    netTotal,
    totalPayment: payment,
  };
}
