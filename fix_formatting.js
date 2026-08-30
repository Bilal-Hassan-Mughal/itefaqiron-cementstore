const fs = require('fs');
const path = require('path');

// Files to process (UI pages only, not API routes or lib files)
const files = [
  'src/app/dashboard/orders/page.js',
  'src/app/dashboard/reports/purchases-by-date/page.js',
  'src/app/dashboard/reports/supplier-ledger/page.js',
  'src/app/dashboard/reports/sales-by-date/page.js',
  'src/app/dashboard/reports/rebate/page.js',
  'src/app/dashboard/reports/customers-balance/page.js',
  'src/app/dashboard/reports/sales-by-customer/page.js',
  'src/app/dashboard/reports/purchases-by-supplier/page.js',
  'src/app/dashboard/reports/expenses-by-date/page.js',
  'src/app/dashboard/reports/cash-report/page.js',
  'src/app/dashboard/reports/customer-ledger/page.js',
  'src/app/dashboard/reports/bank-report/page.js',
  'src/app/dashboard/reports/sale-report/page.js',
  'src/app/dashboard/finance/page.js',
  'src/app/dashboard/components/dashboard-content.js',
  'src/app/dashboard/customers/page.js',
  'src/app/dashboard/products/page.js',
  'src/app/dashboard/expenses/page.js',
  'src/app/dashboard/sale-returns/page.js',
  'src/app/dashboard/quotations/page.js',
  'src/app/dashboard/cargo/page.js',
  'src/app/dashboard/sales/SplitPaymentModal.js',
  'src/app/dashboard/loaders/page.js',
  'src/app/dashboard/hold-bills/page.js',
];

const fmtAmtDef = `\nconst fmtAmt = (val) => {\n  const n = parseFloat(val || 0);\n  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });\n  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n};\n`;

const baseDir = 'd:/new_ittefaq_iron/itefaq builders/itefaq builders';

let totalChanges = 0;

for (const relPath of files) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Add fmtAmt definition if not already present
  if (!content.includes('const fmtAmt')) {
    // Insert after the last import statement
    const lastImportIdx = content.lastIndexOf('\nimport ');
    const insertAfter = lastImportIdx !== -1
      ? content.indexOf('\n', lastImportIdx + 1)
      : content.indexOf('\n');
    if (insertAfter !== -1) {
      content = content.slice(0, insertAfter + 1) + fmtAmtDef + content.slice(insertAfter + 1);
    } else {
      content = fmtAmtDef + content;
    }
  }

  // Replace patterns (order matters - most specific first)

  // 1. toLocaleString with minimumFractionDigits: 2 (full pattern)
  // (expr).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  content = content.replace(/\.toLocaleString\('en-US',\s*\{\s*minimumFractionDigits:\s*2,\s*maximumFractionDigits:\s*2\s*\}\)/g, '_LOCALE_');

  // Now wrap the preceding expression with fmtAmt
  // Handle patterns like: parseFloat(X || 0)_LOCALE_ or parseFloat(X)_LOCALE_ or (X)_LOCALE_ or X_LOCALE_
  content = content.replace(/parseFloat\(([^()]+(?:\([^()]*\)[^()]*)*)\s*\|\|\s*0\)_LOCALE_/g, (m, x) => `fmtAmt(${x.trim()})`);
  content = content.replace(/parseFloat\(([^()]+(?:\([^()]*\)[^()]*)*)\)_LOCALE_/g, (m, x) => `fmtAmt(${x.trim()})`);
  content = content.replace(/Number\(([^()]+(?:\([^()]*\)[^()]*)*)\)_LOCALE_/g, (m, x) => `fmtAmt(${x.trim()})`);
  // Complex expressions in parens: (expr)_LOCALE_
  content = content.replace(/\(([^()]+(?:\([^()]*\)[^()]*)*)\)_LOCALE_/g, (m, x) => `fmtAmt(${x.trim()})`);
  // Simple var: x_LOCALE_
  content = content.replace(/([a-zA-Z_$][a-zA-Z0-9_$.?]*)\s*_LOCALE_/g, (m, x) => `fmtAmt(${x.trim()})`);
  // Catch any remaining _LOCALE_ (shouldn't happen)
  content = content.replace(/_LOCALE_/g, `.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`);

  // 2. .toFixed(2) patterns
  // parseFloat(X || 0).toFixed(2)
  content = content.replace(/parseFloat\(([^()]+(?:\([^()]*\)[^()]*)*)\s*\|\|\s*0\)\.toFixed\(2\)/g, (m, x) => `fmtAmt(${x.trim()})`);
  // parseFloat(X).toFixed(2)
  content = content.replace(/parseFloat\(([^()]+(?:\([^()]*\)[^()]*)*)\)\.toFixed\(2\)/g, (m, x) => `fmtAmt(${x.trim()})`);
  // Number(X).toFixed(2)
  content = content.replace(/Number\(([^()]+(?:\([^()]*\)[^()]*)*)\)\.toFixed\(2\)/g, (m, x) => `fmtAmt(${x.trim()})`);
  // (complex expression).toFixed(2) - handle nested parens
  content = content.replace(/\(([^()]+(?:\([^()]*\)[^()]*)*)\)\.toFixed\(2\)/g, (m, x) => `fmtAmt(${x.trim()})`);
  // simple var.toFixed(2)
  content = content.replace(/([a-zA-Z_$][a-zA-Z0-9_$.?]*)\.toFixed\(2\)/g, (m, x) => `fmtAmt(${x.trim()})`);

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    const changes = (original.match(/toFixed\(2\)|toLocaleString\('en-US'/g) || []).length;
    console.log(`UPDATED: ${relPath} (replaced ~${changes} patterns)`);
    totalChanges += changes;
  } else {
    console.log(`NO CHANGE: ${relPath}`);
  }
}

console.log(`\nTotal patterns replaced: ~${totalChanges}`);
