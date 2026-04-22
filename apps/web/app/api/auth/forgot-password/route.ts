import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { sendEmail } from "@/lib/server/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MIN = 30;

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/auth/forgot-password — issue a password reset token.
 *
 * Always returns 200 with the same body whether the email is registered
 * or not, so an attacker can't enumerate accounts. The actual link is
 * sent via the email facade (console-logged in dev, Resend in prod when
 * RESEND_API_KEY is set).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: "If that email is registered, a reset link is on the way." });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Treat soft-deleted users as if they don't exist — same generic
  // response so an attacker can't probe whether an account was deleted
  // vs. never registered.
  if (!user || user.deletedAt) {
    return NextResponse.json({ ok: true, message: "If that email is registered, a reset link is on the way." });
  }

  // Generate a 32-byte URL-safe token; store the SHA-256 hash so a leaked
  // DB row alone can't reset anyone's password.
  const raw = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);

  await prisma.passwordResetToken.create({
    data: { userId: user.userId, tokenHash, expiresAt },
  });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.fly.dev";
  const link = `${base}/reset-password?token=${raw}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your METU password",
    html: `
      <p>Hi ${user.firstName ?? ""},</p>
      <p>Use the link below to set a new password. It expires in ${TOKEN_TTL_MIN} minutes.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you didn't request this, ignore this email — your password stays the same.</p>
      <p>— The METU team</p>
    `,
  });

  return NextResponse.json({ ok: true, message: "If that email is registered, a reset link is on the way." });
}
