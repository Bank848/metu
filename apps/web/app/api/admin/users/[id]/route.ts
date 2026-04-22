import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

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

  // Capture the previous role so the audit trail is reversible — without
  // it we'd only know the new role, not what changed.
  const prev = await prisma.userStats.findUnique({ where: { userId }, select: { role: true } });
  await prisma.userStats.upsert({
    where: { userId },
    update: { role: role as Role },
    create: { userId, role: role as Role },
  });
  await audit({
    actorId: r.user.userId,
    action: "user.role_change",
    targetType: "user",
    targetId: userId,
    meta: { from: prev?.role ?? null, to: role },
  });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE: soft-delete a user. We set `deletedAt` instead of removing the
 * row so we keep order/review history intact — buyers reviewing a deleted
 * user's products still see "Deleted user" rather than a broken FK.
 * Public queries filter by `deletedAt: null` so the user disappears from
 * the marketplace immediately.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const userId = Number(params.id);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "BadId" }, { status: 400 });
  if (userId === r.user.userId) {
    return NextResponse.json({ error: "SelfDeleteForbidden", message: "You cannot delete your own account." }, { status: 400 });
  }

  await prisma.user.update({
    where: { userId },
    data: { deletedAt: new Date() },
  });
  await audit({
    actorId: r.user.userId,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
  });
  return NextResponse.json({ ok: true });
}
