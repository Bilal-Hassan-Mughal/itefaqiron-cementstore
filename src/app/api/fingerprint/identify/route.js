import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getMinScoreThreshold,
  matchFingerprint,
} from "@/lib/fingerprint";
import { setSessionCookie, signSession } from "@/lib/fingerprint-auth";

const schema = z.object({
  template: z.string().min(10),
  format: z.enum(["Intermediate", "PngImage"]).default("PngImage"),
});

// Identify a user from a live scan (uses all enrolled templates in the database).
// Optional: sets an httpOnly `fp_session` JWT cookie (separate from this app's localStorage user session).
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { template, format } = parsed.data;

  if (format !== "PngImage") {
    return NextResponse.json(
      { ok: false, error: "This matcher requires PngImage captures. Re-enroll first." },
      { status: 400 }
    );
  }

  const enrolled = await prisma.fingerprint.findMany({
    where: { format: "PngImage", NOT: { descriptor: null } },
    include: { user: true },
  });

  if (enrolled.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No enrolled fingerprints yet. Enroll in Settings first." },
      { status: 404 }
    );
  }

  const pool = enrolled.map((e) => ({
    id: e.id,
    userId: e.user_id,
    finger: e.finger,
    format: e.format,
    template: e.template,
    descriptor: e.descriptor,
  }));

  let best;
  let matched;
  try {
    ({ best, matched } = await matchFingerprint(template, pool));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Matcher call failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const threshold = getMinScoreThreshold();

  if (!matched) {
    return NextResponse.json(
      {
        ok: false,
        error: "Fingerprint not recognized.",
        bestScore: best ? Number(best.score.toFixed(2)) : null,
        threshold,
      },
      { status: 401 }
    );
  }

  const matchedRow = enrolled.find((e) => e.id === matched.template.id);
  if (!matchedRow) {
    return NextResponse.json({ ok: false, error: "Match resolution failed" }, { status: 500 });
  }

  if (matchedRow.user.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Matched account is inactive" }, { status: 401 });
  }

  if (String(process.env.FINGERPRINT_SET_IDENTIFY_COOKIE || "").toLowerCase() === "true") {
    const token = signSession({
      sub: String(matchedRow.user.user_id),
      name: matchedRow.user.full_name,
      email: matchedRow.user.email,
    });
    await setSessionCookie(token);
  }

  return NextResponse.json({
    ok: true,
    score: Number(matched.score.toFixed(2)),
    threshold,
    user: {
      user_id: matchedRow.user.user_id,
      full_name: matchedRow.user.full_name,
      email: matchedRow.user.email,
      role: matchedRow.user.role,
      status: matchedRow.user.status,
      is_verified: matchedRow.user.is_verified,
    },
  });
}
