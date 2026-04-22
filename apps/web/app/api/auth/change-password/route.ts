import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { changePasswordSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/change-password — verify current password + write a new
 *  bcrypt hash. We re-fetch the User row so we can `bcrypt.compare` against
 *  the stored hash (loadUser strips it from the returned shape). */
export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { userId: r.user.userId },
    select: { password: true },
  });
  if (!dbUser) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, dbUser.password);
  if (!ok) {
    return NextResponse.json(
      { error: "InvalidCurrentPassword", message: "Current password is incorrect." },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { userId: r.user.userId },
    data: { password: hash },
  });
  return NextResponse.json({ ok: true });
}
