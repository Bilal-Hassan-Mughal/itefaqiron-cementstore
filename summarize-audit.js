const fs = require('fs');
const report = JSON.parse(fs.readFileSync('ledger-audit-report.json', 'utf8'));

const summary = {};

report.forEach(item => {
  if (!summary[item.cus_id]) {
    summary[item.cus_id] = {
      name: item.cus_name,
      issues: [],
      mismatchCount: 0,
      mathErrorCount: 0
    };
  }
  summary[item.cus_id].issues.push(item.l_id);
  if (item.error === 'Opening balance mismatch') {
    summary[item.cus_id].mismatchCount++;
  } else {
    summary[item.cus_id].mathErrorCount++;
  }
});

console.log('--- LEDGER AUDIT SUMMARY ---');
console.log(`Total Issues Found: ${report.length}`);
console.log(`Accounts Affected: ${Object.keys(summary).length}`);
console.log('');
console.log('Top affected accounts:');

const sorted = Object.entries(summary).sort((a, b) => b[1].issues.length - a[1].issues.length);

sorted.slice(0, 20).forEach(([id, data]) => {
  console.log(`- ${data.name} (ID: ${id}): ${data.issues.length} issues (L_IDs: ${data.issues.join(', ')})`);
});

if (sorted.length > 20) {
  console.log(`... and ${sorted.length - 20} more accounts.`);
}
