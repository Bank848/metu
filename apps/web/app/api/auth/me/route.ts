import { NextResponse, type NextRequest } from "next/server";
import { updateProfileSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const { password: _, ...safe } = r.user as any;
  return NextResponse.json({ user: safe, role: r.auth.role });
}

/**
 * PATCH /api/auth/me — update the authed user's own profile fields.
 * Reuses the shared `updateProfileSchema` so every field is optional —
 * the client can send just the diff. Returns the safe user shape.
 */
export async function PATCH(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Email/username uniqueness — only run the duplicate check if the
  // client actually sent a new email (saves a query on every save).
  if (parsed.data.email && parsed.data.email !== r.user.email) {
    const dupe = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { userId: true },
    });
    if (dupe && dupe.userId !== r.user.userId) {
      return NextResponse.json({ error: "Conflict", field: "email" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.profileImage !== undefined) data.profileImage = parsed.data.profileImage;
  if (parsed.data.countryId !== undefined) data.countryId = parsed.data.countryId;
  if (parsed.data.gender !== undefined) data.gender = parsed.data.gender;
  if (parsed.data.dateOfBirth !== undefined) {
    data.dateOfBirth = new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const updated = await prisma.user.update({
    where: { userId: r.user.userId },
    data,
  });
  const { password: _, ...safe } = updated as any;
  return NextResponse.json({ ok: true, user: safe });
}
