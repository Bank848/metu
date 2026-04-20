import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const { password: _, ...safe } = r.user as any;
  return NextResponse.json({ user: safe, role: r.auth.role });
}
