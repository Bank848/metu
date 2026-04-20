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
  const user = await prisma.user.findUnique({ where: { email }, include: { stats: true } });
  if (!user) return NextResponse.json({ error: "InvalidCredentials" }, { status: 401 });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: "InvalidCredentials" }, { status: 401 });

  const activeCart = await prisma.cart.findFirst({ where: { userId: user.userId, status: "active" } });
  if (!activeCart) await prisma.cart.create({ data: { userId: user.userId, status: "active" } });

  const { password: _, ...safe } = user;
  const res = NextResponse.json({ user: safe });
  setAuthCookie(res, { uid: user.userId, role: user.stats?.role ?? "buyer" });
  return res;
}
