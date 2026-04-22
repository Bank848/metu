import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { loginSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { setAuthCookie } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Single DB roundtrip — fetch user + stats + active cart together.
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      stats: true,
      carts: { where: { status: "active" }, take: 1, select: { cartId: true } },
    },
  });
  // Same generic 401 whether the email isn't registered or the account
  // was soft-deleted — don't leak account state to attackers.
  if (!user || user.deletedAt) {
    return NextResponse.json({ error: "InvalidCredentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: "InvalidCredentials" }, { status: 401 });

  // Background-create active cart if missing — doesn't block the response.
  if (user.carts.length === 0) {
    void prisma.cart.create({ data: { userId: user.userId, status: "active" } }).catch(() => {});
  }

  const { password: _, carts: __, ...safe } = user;
  const res = NextResponse.json({ user: safe });
  setAuthCookie(res, { uid: user.userId, role: user.stats?.role ?? "buyer" });
  return res;
}
