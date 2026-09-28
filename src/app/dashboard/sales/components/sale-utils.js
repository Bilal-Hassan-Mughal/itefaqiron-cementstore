/**
 * Sale Page Utilities — pure functions, constants, and shared styles.
 * Extracted from the monolithic page.js for reuse across sale components.
 */

import { BRAND, COMPANY } from '@/lib/brand-theme';

/** Store phone line for sale invoice headers (print + WhatsApp capture). */
export const INVOICE_STORE_PHONE_LINE = `Ph:- ${(COMPANY.phones || ['0300-7560306']).filter(Boolean).join(', ')}`;

// ─── Cost Price Helpers ──────────────────────────────────────────────────────

/** Sale-page "below cost" check must use cost rate (pro_cost_price), never purchase/crate. */
export const getProductCostPrice = (product) => {
  if (!product) return 0;
  const costPriceVal = parseFloat(product.pro_cost_price ?? product.cost_price ?? 0);
  return Number.isFinite(costPriceVal) && costPriceVal > 0 ? costPriceVal : 0;
};

export const findCatalogProduct = (catalog, proId) => {
  const id = Number(proId);
  if (!Number.isFinite(id)) return null;
  return (catalog || []).find((p) => Number(p.pro_id) === id) || null;
};

export const getCartLineCostRate = (cartRow, catalog) => {
  const fromCatalog = getProductCostPrice(findCatalogProduct(catalog, cartRow?.pro_id));
  if (fromCatalog > 0) return fromCatalog;
  return getProductCostPrice(cartRow);
};

// ─── Bill Builder ────────────────────────────────────────────────────────────

export function buildSaleReceiptBill({
  saleId = null,
  billNumber = null,
  formSelectedCustomer,
  finalPaymentTotal,
  grandTotal,
  paymentData,
  cashAmount,
  bankAmount,
  advancePayment = 0,
  selectedBankAccount,
  totalShippingAmount,
  billType,
  cartItems,
  createdAt,
  labourChargesValue,
  previousBalance = null,
}) {
  const prevBalance = previousBalance !== null && previousBalance !== undefined
    ? parseFloat(previousBalance)
    : parseFloat(formSelectedCustomer?.cus_balance || 0);
  return {
    sale_id: saleId,
    bill_number: billNumber,
    cus_id: formSelectedCustomer?.cus_id,
    total_amount: grandTotal,
    discount: parseFloat(paymentData.discount) || 0,
    payment: finalPaymentTotal,
    payment_type: cashAmount > 0 && bankAmount > 0 ? 'SPLIT' : bankAmount > 0 ? 'BANK_TRANSFER' : 'CASH',
    cash_payment: cashAmount,
    bank_payment: bankAmount,
    advance_payment: advancePayment,
    previous_balance: prevBalance,
    previous_customer_balance: prevBalance,
    bank_title: selectedBankAccount?.cus_name || null,
    shipping_amount: totalShippingAmount,
    bill_type: billType || 'BILL',
    reference: paymentData.notes || null,
    created_at: createdAt || new Date().toISOString(),
    customer: formSelectedCustomer,
    sale_details: (cartItems || []).map((product, index) => ({
      sale_detail_id: index + 1,
      pro_id: product.pro_id,
      qnty: product.quantity,
      unit: 'PCS',
      unit_rate: product.rate,
      total_amount: product.amount,
      size: product.size || null,
      product: { pro_title: product.pro_title || 'N/A' },
    })),
    labour: parseFloat(paymentData.labour) || 0,
    labour_charges: labourChargesValue,
    notes: paymentData.notes || '',
  };
}

/** Accurately resolves previous balance, current bill due, and running total balance without double counting */
export function resolveSaleReceiptBalances(bill) {
  const currentDue = parseFloat(bill?.total_amount || 0) - parseFloat(bill?.payment || 0);
  if (bill?.previous_balance !== undefined && bill?.previous_balance !== null) {
    const prev = parseFloat(bill.previous_balance);
    return { prevBal: prev, currentDue, totalBal: prev + currentDue };
  }
  if (bill?.previous_customer_balance !== undefined && bill?.previous_customer_balance !== null) {
    const prev = parseFloat(bill.previous_customer_balance);
    return { prevBal: prev, currentDue, totalBal: prev + currentDue };
  }
  const postBal = parseFloat(bill?.customer?.cus_balance || 0);
  return { prevBal: postBal - currentDue, currentDue, totalBal: postBal };
}

// ─── Print Styles ────────────────────────────────────────────────────────────

/** Ink-saving outline print styling optimized for B&W & thermal printers */
export const SALE_INVOICE_PRINT = {
  headerBg: '#ffffff',
  headerText: '#000000',
  border: '#000000',
  bodyText: '#000000',
  balanceTotalBg: '#e0e0e0',
  balanceTotalText: '#000000',
  grandTotalBg: '#e0e0e0',
};

// ─── List Limits ─────────────────────────────────────────────────────────────

export const SALE_PRODUCT_LIST_LIMIT = 50;
export const SALE_CUSTOMER_LIST_LIMIT = 50;

// ─── Filter Functions ────────────────────────────────────────────────────────

export function filterSaleProducts(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  const out = [];
  for (let i = 0; i < options.length && out.length < SALE_PRODUCT_LIST_LIMIT; i += 1) {
    if (!q) {
      out.push(options[i]);
      continue;
    }
    const title = String(options[i].pro_title || '').toLowerCase();
    const code = String(options[i].pro_code || '').toLowerCase();
    if (title.includes(q) || code.includes(q)) out.push(options[i]);
  }
  return out;
}

export function filterSaleCustomers(options, { inputValue }) {
  const q = String(inputValue || '').toLowerCase().trim();
  const out = [];
  for (let i = 0; i < options.length && out.length < SALE_CUSTOMER_LIST_LIMIT; i += 1) {
    const o = options[i];
    if (!q) {
      out.push(o);
      continue;
    }
    if (
      (o.cus_name || '').toLowerCase().includes(q) ||
      (o.cus_phone_no || '').toLowerCase().includes(q) ||
      (o.cus_phone_no2 || '').toLowerCase().includes(q) ||
      (o.cus_address || '').toLowerCase().includes(q) ||
      (o.cus_reference || '').toLowerCase().includes(q) ||
      (o.city?.city_name || '').toLowerCase().includes(q)
    ) {
      out.push(o);
    }
  }
  return out;
}

export function getFocusedAutocompleteOption() {
  const el = document.querySelector(
    '.MuiAutocomplete-popper .MuiAutocomplete-option.Mui-focused, .MuiAutocomplete-popper .MuiAutocomplete-option[aria-selected="true"]'
  );
  if (!el) return null;
  const idx = Number.parseInt(el.getAttribute('data-option-index'), 10);
  return Number.isFinite(idx) ? idx : null;
}

export function commitDropdownOnTab(e, highlighted, applyValue, focusNext) {
  if (e.shiftKey || (e.key !== 'Tab' && e.key !== 'Enter')) return false;
  e.preventDefault();
  e.stopPropagation();
  if (highlighted) applyValue(highlighted);
  window.setTimeout(() => {
    const el = typeof focusNext === 'function' ? focusNext() : document.querySelector(focusNext);
    if (!el) return;
    el.focus();
    if (typeof el.select === 'function') el.select();
  }, 0);
  return true;
}

// ─── Customer Type Filter ────────────────────────────────────────────────────

/** Sale entry screen only — limit Customer Type filter to these categories (display order) */
export const SALE_PAGE_CUSTOMER_TYPE_RULES = [
  { label: 'Walk in Customer', match: /walk\s*in?\s*cust/i },
  { label: 'Factories', match: /^factories?$/i },
  { label: 'Sarya Shop', match: /sarya\s*shops?/i },
  { label: 'Bloak', match: /^bloak$|^block$/i },
  { label: 'Solar', match: /^solar$/i },
  { label: 'Cement', match: /^cement$/i },
  { label: 'Welders', match: /^welders?$/i },
  { label: 'Homes', match: /^homes?$/i },
];

export function filterSalePageCustomerTypes(allTypes) {
  if (!Array.isArray(allTypes)) return [];
  const picked = [];
  for (let order = 0; order < SALE_PAGE_CUSTOMER_TYPE_RULES.length; order += 1) {
    const rule = SALE_PAGE_CUSTOMER_TYPE_RULES[order];
    const found = allTypes.find((t) => rule.match.test(String(t.cus_type_title || '').trim()));
    if (found && !picked.some((p) => p.cus_type_id === found.cus_type_id)) {
      picked.push(found);
    }
  }
  return picked;
}

export function isCustomerAccount(customer, customerCategories = []) {
  if (!customer) return false;
  let catTitle = customer.customer_category?.cus_cat_title || '';
  if (!catTitle && Array.isArray(customerCategories) && customerCategories.length > 0 && customer.cus_category != null) {
    const cat = customerCategories.find((c) => Number(c.cus_cat_id) === Number(customer.cus_category));
    if (cat) catTitle = cat.cus_cat_title || '';
  }

  const normCat = (catTitle || '').trim().toLowerCase();
  if (normCat) {
    const isNonCustomerCat = (
      normCat.includes('bank') ||
      normCat.includes('transport') ||
      normCat.includes('transporter') ||
      normCat.includes('cargo') ||
      normCat.includes('vendor') ||
      normCat.includes('supplier')
    );
    if (isNonCustomerCat) return false;
  }

  return true;
}

export function matchesCustomerType(customer, selectedType) {
  if (!selectedType) return true;
  if (!customer) return false;

  const targetTypeId = selectedType.cus_type_id ?? selectedType.id;
  const targetTitle = (selectedType.cus_type_title || selectedType.title || selectedType.name || '').trim().toLowerCase();

  const custTypeId = customer.cus_type ?? customer.customer_type?.cus_type_id;
  const custTypeTitle = (customer.customer_type?.cus_type_title || customer.cus_type_title || '').trim().toLowerCase();

  if (targetTypeId != null && custTypeId != null && Number(custTypeId) === Number(targetTypeId)) {
    return true;
  }

  if (targetTitle && custTypeTitle && targetTitle === custTypeTitle) {
    return true;
  }

  return false;
}

// ─── Empty State Constants ───────────────────────────────────────────────────

export const EMPTY_PAYMENT_DATA = {
  cash: '',
  bank: '',
  bankAccountId: '',
  totalCashReceived: 0,
  advancePayment: 0,
  discount: '',
  labour: '',
  deliveryCharges: '',
  notes: '',
  isLoadedOrder: false,
};

export const normalizePaymentData = (data) => ({
  cash: data?.cash ?? EMPTY_PAYMENT_DATA.cash,
  bank: data?.bank ?? EMPTY_PAYMENT_DATA.bank,
  bankAccountId: data?.bankAccountId ?? EMPTY_PAYMENT_DATA.bankAccountId,
  totalCashReceived: data?.totalCashReceived ?? EMPTY_PAYMENT_DATA.totalCashReceived,
  advancePayment: data?.advancePayment ?? EMPTY_PAYMENT_DATA.advancePayment,
  discount: data?.discount ?? EMPTY_PAYMENT_DATA.discount,
  labour: data?.labour ?? EMPTY_PAYMENT_DATA.labour,
  deliveryCharges: data?.deliveryCharges ?? EMPTY_PAYMENT_DATA.deliveryCharges,
  notes: data?.notes ?? EMPTY_PAYMENT_DATA.notes,
  isLoadedOrder: data?.isLoadedOrder ?? EMPTY_PAYMENT_DATA.isLoadedOrder,
});

export const EMPTY_PRODUCT_FORM_DATA = {
  quantity: '',
  rate: '',
  amount: '',
  stock: '',
  crate: '',
  size: '',
};

export const normalizeProductFormData = (data) => ({
  quantity: data?.quantity ?? EMPTY_PRODUCT_FORM_DATA.quantity,
  rate: data?.rate ?? EMPTY_PRODUCT_FORM_DATA.rate,
  amount: data?.amount ?? EMPTY_PRODUCT_FORM_DATA.amount,
  stock: data?.stock ?? EMPTY_PRODUCT_FORM_DATA.stock,
  crate: data?.crate ?? EMPTY_PRODUCT_FORM_DATA.crate,
  size: data?.size ?? EMPTY_PRODUCT_FORM_DATA.size,
});

export const EMPTY_CUSTOMER_FORM = {
  cus_name: '',
  cus_phone_no: '',
  cus_phone_no2: '',
  cus_address: '',
  cus_reference: '',
  cus_account_info: '',
  other: '',
  cus_category: '',
  cus_type: '',
  cus_balance: '',
  CNIC: '',
  NTN_NO: '',
  name_urdu: '',
  city_id: '',
};

export const paymentInputValue = (value) => (value === 0 || value === '' || value == null ? '' : value);

// ─── Shared MUI Styles ───────────────────────────────────────────────────────

export const SALES_PAGE_CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

export const SALE_ENTRY_LABEL_SX = {
  mb: 0.75,
  fontWeight: 700,
  fontSize: '0.72rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 22,
  whiteSpace: 'nowrap',
};

export const SALE_ENTRY_CONTROL_SX = {
  width: '100%',
  minWidth: 0,
  bgcolor: '#fff',
  '& .MuiInputBase-root': {
    height: 40,
    bgcolor: '#fff',
  },
  '& .MuiInputBase-input, & .MuiSelect-select': {
    fontSize: '0.875rem',
    py: 0,
  },
};

export const SALE_ENTRY_CELL_SX = {
  minWidth: 0,
  width: '100%',
};

export const SALE_ENTRY_ROW1_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1.2fr)',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

export const SALE_ENTRY_ROW1_RETURN_SX = {
  ...SALE_ENTRY_ROW1_SX,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.15fr)',
  },
};

export const SALE_ENTRY_ROW2_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr 1fr',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'minmax(0, 2.35fr) minmax(0, 1.15fr) minmax(0, 0.7fr) minmax(0, 0.85fr) minmax(0, 0.85fr) minmax(0, 0.7fr) 44px',
  },
  gap: { xs: 1.5, md: 1.75 },
  alignItems: 'end',
  width: '100%',
  mb: 2,
};

export const SALE_DROPDOWN_LINE = '1px solid #c5c5c5';
export const SALE_CUSTOMER_DROPDOWN_GRID = '32px minmax(270px, 2.7fr) 110px minmax(100px, 1fr) 130px';

export const saleDropdownRowStyle = (columns) => ({
  display: 'grid',
  gridTemplateColumns: columns,
  alignItems: 'stretch',
  width: '100%',
  padding: 0,
  margin: 0,
  minHeight: 32,
  borderBottom: SALE_DROPDOWN_LINE,
});

export const saleDropdownCellStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRight: SALE_DROPDOWN_LINE,
  minWidth: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 13,
};

export const saleDropdownHeaderCell = {
  ...saleDropdownCellStyle,
  fontSize: 11,
  fontWeight: 800,
  color: '#1e3a5f',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const SALE_DROPDOWN_POPPER_SX = {
  zIndex: 1400,
  '& .MuiPaper-root': {
    borderRadius: 0,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
    overflow: 'hidden',
  },
  '& .MuiAutocomplete-option': {
    padding: '0 !important',
    minHeight: '32px !important',
    alignItems: 'stretch',
  },
  '& .MuiAutocomplete-option:nth-of-type(even)': {
    backgroundColor: '#f3f3f3',
  },
  '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option[aria-selected="true"]': {
    backgroundColor: '#cde6f7 !important',
  },
};

export const SALES_EXCEL_TABLE_SX = {
  minWidth: 1200,
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid #cbd5e1',
    py: 0.65,
    px: 1.1,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
  },
};

export const SALES_EXCEL_HEAD_SX = {
  bgcolor: '#dce6f1',
  color: '#1e293b',
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  borderBottom: '2px solid #94a3b8 !important',
};

export const SALES_NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

export const SALES_FILTER_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(4, 1fr)',
  },
  gap: { xs: 1.5, md: 2 },
  width: '100%',
};

export const SALES_FILTER_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#fff',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.primary.blue,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500 },
};

export const getBillTypeChipSx = (billType) => {
  const type = (billType || '').toUpperCase();
  if (type === 'SALE_RETURN') {
    return { bgcolor: '#ffe8f0', color: '#cc0644', border: '1px solid #ffb3c9' };
  }
  if (type === 'QUOTATION') {
    return { bgcolor: '#e8effd', color: '#1347c4', border: '1px solid #b8ccf7' };
  }
  return { bgcolor: '#e6fff4', color: '#00a868', border: '1px solid #99ebc9' };
};
