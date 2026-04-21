import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["buyer", "seller", "admin"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

/** PATCH: change a user's role. Admins cannot demote themselves. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const userId = Number(params.id);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const role = body?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "ValidationError", message: "role must be buyer | seller | admin" }, { status: 400 });
  }
  if (userId === r.user.userId && role !== "admin") {
    return NextResponse.json({ error: "SelfDemoteForbidden", message: "You cannot remove your own admin role." }, { status: 400 });
  }

  await prisma.userStats.upsert({
    where: { userId },
    update: { role: role as Role },
    create: { userId, role: role as Role },
  });
  return NextResponse.json({ ok: true });
}

/** DELETE: hard-delete a user (cascades to stats, store, reviews, carts, etc.). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const userId = Number(params.id);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "BadId" }, { status: 400 });
  if (userId === r.user.userId) {
    return NextResponse.json({ error: "SelfDeleteForbidden", message: "You cannot delete your own account." }, { status: 400 });
  }

  await prisma.user.delete({ where: { userId } });
  return NextResponse.json({ ok: true });
}
