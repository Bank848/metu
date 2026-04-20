import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "./auth";
import { prisma } from "./prisma";

/** Guard for /api/seller/** — user must own a store. Returns NextResponse on failure. */
export async function withStore(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return { ok: false as const, response: r.response };
  const store = await prisma.store.findUnique({ where: { ownerId: r.auth.uid } });
  if (!store) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "NoStore", message: "Create a store first via /api/seller/become-seller" },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, auth: r.auth, user: r.user, store };
}
