const fs = require('fs');
const content = fs.readFileSync('d:\\new_ittefaq_iron\\itefaq builders\\itefaq builders\\src\\app\\api\\sales\\route.js', 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('advance') || line.includes('convert') || line.includes('ORDER') || line.includes('order')) {
    if (line.includes('const') || line.includes('function') || line.includes('let') || line.includes('if') || line.includes('prisma')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  }
});
