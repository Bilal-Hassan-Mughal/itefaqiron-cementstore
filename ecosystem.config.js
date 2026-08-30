module.exports = {
  apps: [
    {
      name: "ittefaq-pos",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      env: {
        NODE_ENV: "production",
        FINGERPRINT_MATCHER_URL: "http://127.0.0.1:5050",
      },
    },
    {
      name: "fingerprint-matcher",
      script: "dotnet",
      args: "FingerprintMatcher.dll",
      cwd: "./fingerprint-matcher/publish",
      env: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ASPNETCORE_URLS: "http://127.0.0.1:5050",
        Version: "1.0.0",
        VERSION: "1.0.0",
      },
    },
  ],
};
