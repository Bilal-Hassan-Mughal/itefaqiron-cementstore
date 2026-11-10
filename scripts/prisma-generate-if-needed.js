#!/usr/bin/env node
/**
 * Windows: prisma generate hits EPERM when next dev holds query_engine-windows.dll.node.
 * If the client already exists, warn and exit 0 so build can continue.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const enginePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '.prisma',
  'client',
  'query_engine-windows.dll.node'
);
const clientOk = fs.existsSync(enginePath);

function runGenerate() {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  });
}

try {
  runGenerate();
} catch (err) {
  if (clientOk) {
    console.warn(
      '\n⚠️  prisma generate skipped (DLL locked — dev/server is running). Using existing client.\n'
    );
    process.exit(0);
  }
  console.error(
    '\n❌ prisma generate failed (DLL locked). Stop npm run dev, then npx prisma generate\n'
  );
  process.exit(1);
}
