/** Parse saved hold payload for list display only (no API changes). */
export function getHoldBillSummary(draft) {
  const empty = {
    itemCount: 0,
    linePreview: '',
    estimatedTotal: 0,
    billType: '—',
    storeName: '',
  };

  if (!draft?.form_state_json) return empty;

  try {
    const state =
      typeof draft.form_state_json === 'string'
        ? JSON.parse(draft.form_state_json)
        : draft.form_state_json;

    const products = Array.isArray(state?.products) ? state.products : [];
    const withQty = products.filter(
      (p) => p && (Number(p.qnty) > 0 || Number(p.quantity) > 0 || Number(p.amount) > 0)
    );
    const itemCount = withQty.length;

    const estimatedTotal = withQty.reduce((sum, p) => {
      const amt = Number(p.amount ?? p.total_amount ?? 0);
      if (amt > 0) return sum + amt;
      const q = Number(p.qnty ?? p.quantity ?? 0);
      const r = Number(p.rate ?? p.pro_sale_price ?? p.price ?? 0);
      return sum + q * r;
    }, 0);

    const firstNames = withQty
      .slice(0, 2)
      .map((p) => p.pro_title || p.product?.pro_title || p.pro_name || 'Item')
      .join(', ');
    const linePreview =
      itemCount > 2 ? `${firstNames} +${itemCount - 2} more` : firstNames || 'No line items yet';

    const billType = state?.billType || state?.bill_type || 'BILL';
    const storeName =
      state?.store?.store_name || state?.store?.name || state?.store?.store_title || '';

    return { itemCount, linePreview, estimatedTotal, billType, storeName };
  } catch {
    return empty;
  }
}

export function formatHoldAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `Rs ${v.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}
