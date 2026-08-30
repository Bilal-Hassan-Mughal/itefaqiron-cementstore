import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webSdkShim = path.resolve(__dirname, "src/lib/websdk-shim.js");
// Turbopack (Next 16 default) only supports project-relative aliasing, not
// absolute Windows paths — see "windows imports are not implemented yet".
const webSdkShimTurbopack = "./src/lib/websdk-shim.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  // Do not long-cache document responses: after a deploy, old HTML must not
  // reference removed /_next/static/chunks/*.js (→ 404, ChunkLoadError).
  // /_next/static/* is still emitted with immutable hashes (browser cache OK for those).
  async headers() {
    const noHtmlCache = {
      key: "Cache-Control",
      value: "no-store, no-cache, must-revalidate, max-age=0",
    };
    return [
      { source: "/", headers: [noHtmlCache] },
      { source: "/login", headers: [noHtmlCache] },
      { source: "/dashboard/:path*", headers: [noHtmlCache] },
    ];
  },
  // Next 16+ uses Turbopack by default for `next dev` / `next build`; webpack
  // aliases do not apply unless you pass `--webpack`.
  turbopack: {
    resolveAlias: {
      // @digitalpersona/devices does `require('WebSdk')`; real script is /public/websdk.client.js
      WebSdk: webSdkShimTurbopack,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      WebSdk: webSdkShim,
    };
    return config;
  },
};

export default nextConfig;
