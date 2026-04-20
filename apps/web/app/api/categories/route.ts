import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await prisma.category.findMany({ orderBy: { categoryName: "asc" } });
  return NextResponse.json(data);
}
