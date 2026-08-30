/**
 * Client for the local SourceAFIS matcher sidecar (see `fingerprint-matcher/`).
 */

/** @typedef {{ id: number; userId: number; finger: string; format: string; template: string; descriptor: string | null }} StoredTemplate */

const MATCHER_URL = process.env.FINGERPRINT_MATCHER_URL ?? "http://127.0.0.1:5050";

export const DEFAULT_MIN_SCORE = 40;

export function getMinScoreThreshold() {
  const raw = process.env.FINGERPRINT_MIN_SCORE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_SCORE;
}

async function sidecar(path, body) {
  try {
    const res = await fetch(`${MATCHER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        `Fingerprint matcher service is offline (cannot reach ${MATCHER_URL}). Please run "npm run dev:matcher".`
      );
    }
    throw err;
  }
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

export async function extractTemplate(pngBase64) {
  const pngStd = toStandardBase64(pngBase64);
  const res = await sidecar("/extract", { pngBase64: pngStd });
  return res.template;
}

/**
 * @param {string} candidatePng
 * @param {StoredTemplate[]} enrolled
 */
export async function matchFingerprint(candidatePng, enrolled) {
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

export async function matcherHealth() {
  try {
    const res = await fetch(`${MATCHER_URL}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `status ${res.status}` };
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
