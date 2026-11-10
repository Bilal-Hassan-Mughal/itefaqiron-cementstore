#!/usr/bin/env node
/**
 * Quick checks before a local production run with XAMPP MySQL.
 * Usage: node scripts/xampp-check-env.js
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function loadDatabaseUrl() {
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env in project root. Copy .env.example and set DATABASE_URL for XAMPP MySQL.');
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const m = raw.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
  return m ? m[1].trim() : process.env.DATABASE_URL || '';
}

function parseMysqlHost(url) {
  try {
    const u = new URL(url.replace(/^mysql:\/\//, 'http://'));
    return { host: u.hostname, port: u.port ? Number(u.port) : 3306 };
  } catch {
    return null;
  }
}

function probePort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const url = loadDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL is empty in .env');
    process.exit(1);
  }

  const hostInfo = parseMysqlHost(url);
  if (!hostInfo) {
    console.error('DATABASE_URL could not be parsed (expected mysql://user:pass@host:port/db)');
    process.exit(1);
  }

  const { host, port } = hostInfo;
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!localHosts.has(host)) {
    console.warn(
      `Warning: DATABASE_URL host is "${host}" — not localhost. ` +
        'For XAMPP testing, use 127.0.0.1 and a local database name.'
    );
  }

  const up = await probePort(host, port);
  if (!up) {
    console.error(`Cannot reach MySQL at ${host}:${port}. Start MySQL in the XAMPP Control Panel.`);
    process.exit(1);
  }

  console.log(`OK — MySQL reachable at ${host}:${port}`);
  console.log('Next: npm run build && npm run start:local  (app at http://127.0.0.1:3000)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
