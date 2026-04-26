import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  // Phase 11 / F1, F12, F14, F20 (CEO Decision 2) — exclude soft-deleted
  // stores from this admin list so the headline count matches `/`,
  // `/health`, and `/admin` (all of which honour `deletedAt: null`). The
  // /admin/users moderation view stays unfiltered per the same decision
  // because admins need to see deleted users to audit / undelete them;
  // /admin/stores is a KPI surface and was the page surfacing the
  // mismatch ("8 stores on the marketplace" vs the live count of 4).
  const stores = await prisma.store.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
      businessType: true,
      stats: true,
      _count: {
        select: {
          // Mirror the public-side product count: only count products
          // that are themselves live. Without this an admin could see
          // "12 products" on a store while /browse shows 11.
          products: { where: { deletedAt: null } },
        },
      },
    },
  });
  return NextResponse.json(stores);
}
