/**
 * Make initBranchScope async across API routes.
 * Run: node scripts/patch-async-branch-scope.js
 */
const fs = require('fs');
const path = require('path');

const API_ROOT = path.join(__dirname, '..', 'src', 'app', 'api');
const EXCLUDE = ['api\\branches', 'api/branches', 'api\\auth', 'api/auth'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === 'route.js') out.push(full);
  }
  return out;
}

for (const file of walk(API_ROOT)) {
  const norm = file.replace(/\\/g, '/');
  if (EXCLUDE.some((x) => norm.includes(x.replace(/\\/g, '/')))) continue;

  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('initBranchScope')) continue;

  const updated = content.replace(
    /const __branchScope = initBranchScope\(request\);/g,
    'const __branchScope = await initBranchScope(request);'
  );

  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('patched', path.relative(process.cwd(), file));
  }
}
