/**
 * Fingerprint template extraction + matching.
 *
 * Default: in-process SourceAFIS via `nodeafis` (works on Vercel — no sidecar).
 * Optional: set FINGERPRINT_MATCHER_URL to use the legacy .NET matcher instead.
 */

/** @typedef {{ id: number; userId: number; finger: string; format: string; template: string; descriptor: string | null }} StoredTemplate */

const MATCHER_URL = process.env.FINGERPRINT_MATCHER_URL?.trim() || "";
const MATCHER_API_KEY = process.env.FINGERPRINT_MATCHER_API_KEY ?? "";
const USE_SIDECAR = Boolean(MATCHER_URL);

export const DEFAULT_MIN_SCORE = 40;

export function getMinScoreThreshold() {
  const raw = process.env.FINGERPRINT_MIN_SCORE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_SCORE;
}

function matcherHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (MATCHER_API_KEY) headers["X-Matcher-Key"] = MATCHER_API_KEY;
  return headers;
}

function toStandardBase64(input) {
  let s = input;
  const comma = s.indexOf(",");
  if (s.startsWith("data:") && comma >= 0) s = s.slice(comma + 1);
  s = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return s;
}

function pngBase64ToBuffer(pngBase64) {
  return Buffer.from(toStandardBase64(pngBase64), "base64");
}

/** @type {Promise<typeof import('nodeafis')> | null} */
let nodeafisPromise = null;

async function loadNodeafis() {
  if (!nodeafisPromise) {
    nodeafisPromise = import("nodeafis");
  }
  return nodeafisPromise;
}

async function extractTemplateEmbedded(pngBase64) {
  const { FingerprintImage, FingerprintTemplate } = await loadNodeafis();
  const image = FingerprintImage.decode(pngBase64ToBuffer(pngBase64), { dpi: 500 });
  const template = FingerprintTemplate.fromImage(image);
  return Buffer.from(template.toByteArray()).toString("base64");
}

async function matchFingerprintEmbedded(candidatePng, enrolled) {
  const usable = enrolled.filter((t) => !!t.descriptor);
  if (usable.length === 0) return { best: null, matched: null };

  const { FingerprintImage, FingerprintTemplate, FingerprintMatcher } = await loadNodeafis();
  const probeImage = FingerprintImage.decode(pngBase64ToBuffer(candidatePng), { dpi: 500 });
  const probe = FingerprintTemplate.fromImage(probeImage);
  const matcher = new FingerprintMatcher(probe);

  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < usable.length; i++) {
    try {
      const candBytes = pngBase64ToBuffer(usable[i].descriptor);
      const candidate = new FingerprintTemplate(candBytes);
      const score = matcher.match(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    } catch (err) {
      console.warn(`[fingerprint] candidate ${i} match failed:`, err instanceof Error ? err.message : err);
    }
  }

  if (bestIndex < 0) return { best: null, matched: null };

  const best = { template: usable[bestIndex], score: bestScore };
  const threshold = getMinScoreThreshold();
  const matched = best.score >= threshold ? best : null;
  return { best, matched };
}

async function sidecar(path, body) {
  try {
    const res = await fetch(`${MATCHER_URL}${path}`, {
      method: "POST",
      headers: matcherHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Matcher ${path} failed (${res.status}): ${text || res.statusText}`);
    }
    return JSON.parse(text);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "fetch failed" || err.name === "TypeError" || err.message.includes("fetch"))
    ) {
      throw new Error(
        `Fingerprint matcher service is offline (cannot reach ${MATCHER_URL}). Remove FINGERPRINT_MATCHER_URL to use built-in matching on Vercel.`
      );
    }
    throw err;
  }
}

async function extractTemplateSidecar(pngBase64) {
  const res = await sidecar("/extract", { pngBase64: toStandardBase64(pngBase64) });
  return res.template;
}

async function matchFingerprintSidecar(candidatePng, enrolled) {
  const usable = enrolled.filter((t) => !!t.descriptor);
  if (usable.length === 0) return { best: null, matched: null };

  const res = await sidecar("/match", {
    probePng: toStandardBase64(candidatePng),
    candidates: usable.map((t) => t.descriptor),
  });

  if (res.bestIndex < 0) return { best: null, matched: null };

  const best = { template: usable[res.bestIndex], score: res.bestScore };
  const threshold = getMinScoreThreshold();
  const matched = best.score >= threshold ? best : null;
  return { best, matched };
}

export async function extractTemplate(pngBase64) {
  if (USE_SIDECAR) return extractTemplateSidecar(pngBase64);
  return extractTemplateEmbedded(pngBase64);
}

/**
 * @param {string} candidatePng
 * @param {StoredTemplate[]} enrolled
 */
export async function matchFingerprint(candidatePng, enrolled) {
  if (USE_SIDECAR) return matchFingerprintSidecar(candidatePng, enrolled);
  return matchFingerprintEmbedded(candidatePng, enrolled);
}

export async function matcherHealth() {
  if (USE_SIDECAR) {
    try {
      const res = await fetch(`${MATCHER_URL}/health`, { cache: "no-store" });
      if (!res.ok) return { ok: false, error: `status ${res.status}`, mode: "sidecar" };
      const data = await res.json();
      return { ...data, mode: "sidecar", url: MATCHER_URL };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
        mode: "sidecar",
        url: MATCHER_URL,
      };
    }
  }

  try {
    await loadNodeafis();
    return { ok: true, matcher: "nodeafis", mode: "embedded", version: "SourceAFIS 3.18.1" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "nodeafis failed to load",
      mode: "embedded",
    };
  }
}

export function getFingerprintMatcherMode() {
  return USE_SIDECAR ? "sidecar" : "embedded";
}
