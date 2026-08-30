/**
 * Injects initBranchScope(request) into API route handlers for branch data isolation.
 * Run: node scripts/patch-branch-api-scope.js
 */
const fs = require('fs');
const path = require('path');

const API_ROOT = path.join(__dirname, '..', 'src', 'app', 'api');

const EXCLUDE_PATH_PARTS = [
  path.join('api', 'branches'),
  path.join('api', 'auth'),
  path.join('api', 'migrations'),
];

const IMPORT_LINE = "import { initBranchScope } from '@/lib/branch-server';";
const INIT_LINES = [
  '  const __branchScope = initBranchScope(request);',
  '  if (__branchScope.error) return __branchScope.error;',
];

const HANDLER_RE = /export async function (GET|POST|PUT|PATCH|DELETE)\s*\(\s*request\s*(?:,\s*\{[^}]*\})?\s*\)\s*\{/g;

function shouldExclude(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return EXCLUDE_PATH_PARTS.some((p) => norm.includes(p.replace(/\\/g, '/')));
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('initBranchScope')) {
    return { filePath, status: 'skipped', reason: 'already patched' };
  }

  if (!HANDLER_RE.test(content)) {
    return { filePath, status: 'skipped', reason: 'no handlers' };
  }
  HANDLER_RE.lastIndex = 0;

  let patched = 0;
  const newContent = content.replace(HANDLER_RE, (match) => {
    patched += 1;
    return `${match}\n${INIT_LINES.join('\n')}\n`;
  });

  if (patched === 0) {
    return { filePath, status: 'skipped', reason: 'no match' };
  }

  let finalContent = newContent;
  if (!finalContent.includes(IMPORT_LINE)) {
    const lastImport = finalContent.lastIndexOf('\nimport ');
    if (lastImport === -1) {
      finalContent = `${IMPORT_LINE}\n${finalContent}`;
    } else {
      const endOfLine = finalContent.indexOf('\n', lastImport + 1);
      finalContent =
        finalContent.slice(0, endOfLine + 1) +
        `${IMPORT_LINE}\n` +
        finalContent.slice(endOfLine + 1);
    }
  }

  fs.writeFileSync(filePath, finalContent, 'utf8');
  return { filePath, status: 'patched', handlers: patched };
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name === 'route.js') results.push(full);
  }
  return results;
}

const files = walk(API_ROOT).filter((f) => !shouldExclude(f));
const report = files.map(patchFile);

const patched = report.filter((r) => r.status === 'patched');
const skipped = report.filter((r) => r.status === 'skipped');

console.log(`Patched ${patched.length} files, skipped ${skipped.length}`);
patched.forEach((r) => console.log(`  ✅ ${path.relative(process.cwd(), r.filePath)} (${r.handlers} handlers)`));
