import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(6).max(100),
});

/**
 * POST /api/auth/reset-password — consume a password-reset token and
 * write a new bcrypt hash. The token is sent in the URL as the raw
 * value; we hash it to look it up against the DB row.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { userId: true, email: true } } },
  });

  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "InvalidToken", message: "This reset link has expired or already been used." },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { userId: row.userId }, data: { password: hash } }),
    prisma.passwordResetToken.update({
      where: { tokenId: row.tokenId },
      data: { consumedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for the same user.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, consumedAt: null, NOT: { tokenId: row.tokenId } },
      data: { consumedAt: new Date() },
    }),
  ]);

  await audit({
    actorId: row.userId,
    action: "auth.password_reset",
    targetType: "user",
    targetId: row.userId,
  });

  return NextResponse.json({ ok: true });
}
