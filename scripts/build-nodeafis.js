/**
 * GitHub-installed nodeafis ships without dist/ — build it after npm install (Vercel + local).
 */
const { existsSync } = require("node:fs");
const { execSync } = require("node:child_process");
const path = require("node:path");

const dir = path.join(__dirname, "..", "node_modules", "nodeafis");
const distEntry = path.join(dir, "dist", "index.js");

if (!existsSync(dir)) {
  process.exit(0);
}

if (existsSync(distEntry)) {
  process.exit(0);
}

console.log("[postinstall] Building nodeafis (embedded fingerprint matcher)...");
execSync("npm install && npm run build", {
  cwd: dir,
  stdio: "inherit",
  env: process.env,
});
