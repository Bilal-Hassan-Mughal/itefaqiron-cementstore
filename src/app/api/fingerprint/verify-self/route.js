import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMinScoreThreshold, matchFingerprint } from "@/lib/fingerprint";

const schema = z.object({
  userId: z.number().int().positive(),
  template: z.string().min(10),
  format: z.enum(["Intermediate", "PngImage"]).default("PngImage"),
});

// Step-up auth: verify a live scan against a specific user's enrolled templates.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Invalid input" }, { status: 400 });
  }

  const { userId, template, format } = parsed.data;

  if (format !== "PngImage") {
    return NextResponse.json(
      { valid: false, error: "Re-enroll using PngImage captures." },
      { status: 400 }
    );
  }

  const user = await prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true, status: true, fingerprint_enrolled: true },
  });

  if (!user) {
    return NextResponse.json({ valid: false, error: "User not found" }, { status: 404 });
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ valid: false, error: "Account is inactive" }, { status: 401 });
  }
  if (!user.fingerprint_enrolled) {
    return NextResponse.json({ valid: false, error: "No fingerprint enrolled for this user." });
  }

  const rows = await prisma.fingerprint.findMany({
    where: { user_id: userId, format: "PngImage", NOT: { descriptor: null } },
  });

  if (rows.length === 0) {
    return NextResponse.json({ valid: false, error: "No enrolled templates found. Re-enroll in Settings." });
  }

  const pool = rows.map((e) => ({
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
    return NextResponse.json({ valid: false, error: msg }, { status: 502 });
  }

  const threshold = getMinScoreThreshold();

  if (!matched) {
    return NextResponse.json({
      valid: false,
      error: "Fingerprint not recognized.",
      bestScore: best ? Number(best.score.toFixed(2)) : null,
      threshold,
    });
  }

  return NextResponse.json({
    valid: true,
    score: Number(matched.score.toFixed(2)),
    threshold,
  });
}
