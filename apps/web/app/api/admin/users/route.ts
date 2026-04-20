import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req, ["admin"]);
  if (!r.ok) return r.response;
  const p = req.nextUrl.searchParams;
  const q = p.get("q") || "";
  const role = p.get("role") || undefined;
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const pageSize = Math.min(60, Number(p.get("pageSize") ?? 20));

  const where = {
    ...(q ? {
      OR: [
        { username: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(role ? { stats: { role: role as any } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdDate: "desc" },
      include: {
        country: true,
        stats: true,
        store: { select: { storeId: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map(({ password, ...u }) => u),
    page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
