const fs = require('fs');
const mysql = require('mysql2/promise');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const key = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[key]) process.env[key] = v;
}

async function main() {
  const u = new URL(process.env.DATABASE_URL);
  const c = await mysql.createConnection({
    host: u.hostname,
    port: u.port || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  });
  const [tables] = await c.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ledger', 'main_ledger')`
  );
  for (const t of tables) {
    const name = t.TABLE_NAME;
    const [idx] = await c.query(`SHOW INDEX FROM \`${name}\` WHERE Key_name = 'ledger_cus_id_created_at_l_id_idx'`);
    if (idx.length) {
      console.log(`${name}: index exists`);
      continue;
    }
    await c.query(`ALTER TABLE \`${name}\` ADD INDEX ledger_cus_id_created_at_l_id_idx (cus_id, created_at, l_id)`);
    console.log(`${name}: index created`);
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
