/**
 * Replace standalone PrismaClient() in API routes with shared scoped prisma client.
 */
const fs = require('fs');
const path = require('path');

const API_ROOT = path.join(__dirname, '..', 'src', 'app', 'api');

const REPLACEMENT = "import { prisma } from '@/lib/prisma';";

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.name === 'route.js') results.push(full);
  }
  return results;
}

for (const file of walk(API_ROOT)) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('new PrismaClient()')) continue;

  content = content.replace(/import \{ PrismaClient \} from '@prisma\/client';\r?\n/g, '');
  content = content.replace(/const prisma = new PrismaClient\(\);\r?\n/g, '');
  if (!content.includes("@/lib/prisma")) {
    const idx = content.indexOf("import ");
    if (idx >= 0) {
      const end = content.indexOf('\n', idx);
      content = content.slice(0, end + 1) + `${REPLACEMENT}\n` + content.slice(end + 1);
    } else {
      content = `${REPLACEMENT}\n${content}`;
    }
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('fixed', path.relative(process.cwd(), file));
}
