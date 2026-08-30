import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractTemplate } from "@/lib/fingerprint";

const schema = z.object({
  userId: z.number().int().positive(),
  finger: z.string().min(1).max(40).default("right-index"),
  format: z.enum(["Intermediate", "PngImage"]).default("PngImage"),
  templates: z.array(z.string().min(10)).min(2).max(8),
});

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, finger, templates, format } = parsed.data;

  if (format !== "PngImage") {
    return NextResponse.json(
      { error: "Only PngImage samples are supported by this matcher." },
      { status: 400 }
    );
  }

  const user = await prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is inactive" }, { status: 401 });
  }

  const prepared = [];

  for (let i = 0; i < templates.length; i++) {
    const pngBase64 = templates[i];
    try {
      const descriptor = await extractTemplate(pngBase64);
      prepared.push({ finger, format, template: pngBase64, descriptor });
    } catch (err) {
      console.error(
        `[fingerprint enroll] sample ${i} (len ${pngBase64.length}) failed extraction:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (prepared.length < 2) {
    return NextResponse.json(
      {
        error: `Only ${prepared.length} of ${templates.length} samples produced a valid fingerprint template. Is the matcher running on ${process.env.FINGERPRINT_MATCHER_URL ?? "http://127.0.0.1:5050"}?`,
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.fingerprint.deleteMany({ where: { user_id: userId } });
    await tx.fingerprint.createMany({
      data: prepared.map((p) => ({
        user_id: userId,
        finger: p.finger,
        format: p.format,
        template: p.template,
        descriptor: p.descriptor,
      })),
    });
    await tx.users.update({
      where: { user_id: userId },
      data: {
        fingerprint_enrolled: true,
        // keep a convenient single reference image for debugging / future use
        fingerprint_template: prepared[0]?.template ?? null,
      },
    });
  });

  return NextResponse.json({ ok: true, enrolled: prepared.length });
}

const deleteSchema = z.object({
  userId: z.number().int().positive(),
});

export async function DELETE(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.fingerprint.deleteMany({ where: { user_id: userId } });
    await tx.users.update({
      where: { user_id: userId },
      data: { fingerprint_enrolled: false, fingerprint_template: null },
    });
  });

  return NextResponse.json({ ok: true });
}
