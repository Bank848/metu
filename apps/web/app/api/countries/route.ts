import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await prisma.country.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(data);
}
