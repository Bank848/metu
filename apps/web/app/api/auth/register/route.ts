import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { registerSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { setAuthCookie } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  const { username, email, password, firstName, lastName, countryId, gender, dateOfBirth } = parsed.data;

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
