import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isHqUser } from "@/lib/branch-roles";
import {
  getMinScoreThreshold,
  matchFingerprint,
} from "@/lib/fingerprint";
import { setSessionCookie, signSession } from "@/lib/fingerprint-auth";

const schema = z.object({
  template: z.string().min(10),
  format: z.enum(["Intermediate", "PngImage"]).default("PngImage"),
  login_mode: z.enum(["hq", "branch"]).optional(),
  branch_code: z.string().optional(),
});

function userMatchesLoginContext(user, loginMode, branchCode) {
  if (!loginMode) return true;

  if (loginMode === "hq") {
    return isHqUser(user);
  }

  if (loginMode === "branch") {
    if (isHqUser(user)) return false;
    if (!user.branch_id) return false;
    const code = (branchCode || "").trim().toUpperCase();
    if (!code) return true;
    return user.branch?.branch_code?.toUpperCase() === code;
  }

  return true;
}

function sanitizeLoginUser(user) {
  const { password, pin_code, fingerprint_template, ...safe } = user;
  return safe;
}

// Identify a user from a live scan (uses enrolled templates in the database).
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

  const { template, format, login_mode: loginMode, branch_code: branchCode } = parsed.data;

  if (format !== "PngImage") {
    return NextResponse.json(
      { ok: false, error: "This matcher requires PngImage captures. Re-enroll first." },
      { status: 400 }
    );
  }

  if (loginMode === "branch" && !(branchCode || "").trim()) {
    return NextResponse.json(
      { ok: false, error: "Branch code is required for branch fingerprint login." },
      { status: 400 }
    );
  }

  const enrolled = await prisma.fingerprint.findMany({
    where: { format: "PngImage", NOT: { descriptor: null } },
    include: {
      user: {
        include: {
          branch: {
            select: {
              branch_id: true,
              branch_code: true,
              branch_name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const scoped = enrolled.filter((row) =>
    userMatchesLoginContext(row.user, loginMode, branchCode)
  );

  if (scoped.length === 0) {
    const msg =
      loginMode === "hq"
        ? "No HQ fingerprints enrolled yet. Enroll in HQ Settings first."
        : "No enrolled fingerprints yet. Enroll in Settings first.";
    return NextResponse.json({ ok: false, error: msg }, { status: 404 });
  }

  const pool = scoped.map((e) => ({
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

  const matchedRow = scoped.find((e) => e.id === matched.template.id);
  if (!matchedRow) {
    return NextResponse.json({ ok: false, error: "Match resolution failed" }, { status: 500 });
  }

  if (matchedRow.user.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Matched account is inactive" }, { status: 401 });
  }

  if (loginMode === "branch" && matchedRow.user.branch?.status === "SUSPENDED") {
    return NextResponse.json({ ok: false, error: "This branch is suspended. Contact Head Office." }, { status: 403 });
  }

  await prisma.users.update({
    where: { user_id: matchedRow.user.user_id },
    data: { last_logged_in: new Date() },
  });

  if (String(process.env.FINGERPRINT_SET_IDENTIFY_COOKIE || "").toLowerCase() === "true") {
    const token = signSession({
      sub: String(matchedRow.user.user_id),
      name: matchedRow.user.full_name,
      email: matchedRow.user.email,
    });
    await setSessionCookie(token);
  }

  const userPayload = sanitizeLoginUser(matchedRow.user);

  return NextResponse.json({
    ok: true,
    score: Number(matched.score.toFixed(2)),
    threshold,
    user: userPayload,
    is_hq: isHqUser(matchedRow.user),
    login_mode: loginMode || null,
  });
}
