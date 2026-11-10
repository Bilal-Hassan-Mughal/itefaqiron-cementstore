/**
 * PM2 — local production test (XAMPP MySQL + optional Apache proxy).
 *   npx pm2 start ecosystem.config.local.js
 *   npx pm2 stop all
 */
module.exports = {
  apps: [
    {
      name: "ittefaq-pos-local",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        FINGERPRINT_MATCHER_URL: "http://127.0.0.1:5050",
      },
    },
    {
      name: "fingerprint-matcher-local",
      script: "dotnet",
      args: "FingerprintMatcher.dll",
      cwd: "./fingerprint-matcher/publish",
      env: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ASPNETCORE_URLS: "http://127.0.0.1:5050",
      },
    },
  ],
};
