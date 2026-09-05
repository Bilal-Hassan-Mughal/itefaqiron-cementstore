const DESCRIPTION_ACTION_TERMS = /^(payment received|payment paid|bill|sale bill|sale_return|receiving|paying|debit|credit|transfer|deposit|withdrawal)$/i;

export function cleanAccountLabel(value) {
  return String(value || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function collectBoldAccountTerms(entry, { includeBankNames = false } = {}) {
  const terms = new Set();
  const add = (value) => {
    const cleaned = cleanAccountLabel(value);
    if (cleaned.length >= 2 && !DESCRIPTION_ACTION_TERMS.test(cleaned)) {
      terms.add(cleaned);
    }
  };

  if (entry.customer?.cus_name) add(entry.customer.cus_name);

  const details = String(entry.details || '');
  const receivingMatch = details.match(/Receiving\s+(.+?)\s-\s/i);
  if (receivingMatch) add(receivingMatch[1]);

  details.split(' - ').forEach((segment) => {
    const cleaned = cleanAccountLabel(segment);
    if (!cleaned || DESCRIPTION_ACTION_TERMS.test(cleaned)) return;
    if (/^cash pkr|^bank pkr/i.test(cleaned)) return;
    const namePattern = includeBankNames
      ? /account|customer|co\.|construction|store|iron|cement|bank|hbl|meezan|ubl|alfalah/i
      : /account|customer|co\.|construction|store|iron|cement/i;
    if (namePattern.test(cleaned) || (cleaned.includes(' ') && cleaned.length > 5)) {
      add(cleaned);
    }
  });

  return [...terms].sort((a, b) => b.length - a.length);
}

export function resolveCustomerForAccountTerm(term, customers, entry = null) {
  const cleaned = cleanAccountLabel(term);
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  const entryName = cleanAccountLabel(entry?.customer?.cus_name || '').toLowerCase();
  if (entry?.customer?.cus_id && entryName && entryName === lower) {
    return entry.customer;
  }

  const exact = (customers || []).find(
    (c) => cleanAccountLabel(c.cus_name).toLowerCase() === lower
  );
  if (exact) return exact;

  const candidates = (customers || []).filter((c) => {
    const name = cleanAccountLabel(c.cus_name).toLowerCase();
    return name.includes(lower) || lower.includes(name);
  });

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    const bestExact = candidates.find((c) => cleanAccountLabel(c.cus_name).toLowerCase() === lower);
    if (bestExact) return bestExact;
    return [...candidates].sort((a, b) => cleanAccountLabel(b.cus_name).length - cleanAccountLabel(a.cus_name).length)[0];
  }

  return null;
}

export function buildAccountTermCustomerMap(entry, customers, options) {
  const map = new Map();
  collectBoldAccountTerms(entry, options).forEach((term) => {
    const customer = resolveCustomerForAccountTerm(term, customers, entry);
    if (customer?.cus_id) {
      map.set(term.toLowerCase(), customer);
    }
  });
  return map;
}
