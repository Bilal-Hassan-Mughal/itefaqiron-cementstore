/**
 * GitHub-installed nodeafis ships without dist/ — compile it after npm install (Vercel + local).
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

console.log("[build-nodeafis] Compiling embedded fingerprint matcher...");
execSync("npx tsc -p tsconfig.json", {
  cwd: dir,
  stdio: "inherit",
  env: process.env,
});

if (!existsSync(distEntry)) {
  console.error("[build-nodeafis] Build finished but dist/index.js is missing.");
  process.exit(1);
}
