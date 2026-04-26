import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { registerSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { setAuthCookie } from "@/lib/server/auth";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { findFirstProfaneField } from "@/lib/server/profanity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // CAPTCHA — Cloudflare Turnstile. No-op when TURNSTILE_SECRET is unset
  // (local dev), enforced in prod. Verify before doing any DB work so
  // bot floods don't waste Neon round-trips.
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken : undefined;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "CaptchaFailed", message: "Please complete the CAPTCHA and try again." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { username, email, password, firstName, lastName, countryId, gender, dateOfBirth } = parsed.data;

  // Phase 11 run #2 / F3 (CEO Decision 1) — profanity guard. Username +
  // first/last name are surfaced on every review attribution, message
  // thread, and admin moderation table; let one slur through here and
  // it's tedious to scrub later (yesterday's user-53 cleanup proved
  // that). Reject 400 with a friendly message so the form can render
  // it inline.
  const profane = findFirstProfaneField({ username, firstName, lastName });
  if (profane) {
    return NextResponse.json(
      { error: "ProfanityRejected", field: profane.field, message: profane.message },
      { status: 400 },
    );
  }

  const [dupUsername, dupEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (dupUsername) return NextResponse.json({ error: "Conflict", field: "username" }, { status: 409 });
  if (dupEmail)    return NextResponse.json({ error: "Conflict", field: "email" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username, email, firstName, lastName, countryId, gender,
      // dateOfBirth comes in as YYYY-MM-DD; pin to UTC midnight so it
      // doesn't shift across timezones in the DB.
      dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00.000Z`) : undefined,
      password: hash,
      stats: { create: { role: "buyer" } },
      carts: { create: { status: "active" } },
    },
    include: { stats: true },
  });

  const { password: _, ...safe } = user;
  const res = NextResponse.json({ user: safe });
  setAuthCookie(res, { uid: user.userId, role: user.stats?.role ?? "buyer" });
  return res;
}
