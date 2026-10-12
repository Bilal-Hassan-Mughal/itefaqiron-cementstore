#!/usr/bin/env node
/** Removes Co-authored-by: Cursor lines from stdin (git filter-branch --msg-filter). */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  const out = data
    .split(/\r?\n/)
    .filter((line) => !/^Co-authored-by:\s*Cursor/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  process.stdout.write(out ? `${out}\n` : '');
});
