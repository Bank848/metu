import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const askSchema = z.object({ body: z.string().min(3).max(500) });

/** GET /api/products/[id]/questions — public list, newest first. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });
  const questions = await prisma.productQuestion.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: {
      asker:    { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
      answerer: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
    },
  });
  return NextResponse.json({ questions });
}

/** POST /api/products/[id]/questions — auth-gated. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: "BadId" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  // Confirm product exists.
  const product = await prisma.product.findUnique({ where: { productId }, select: { productId: true } });
  if (!product) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const created = await prisma.productQuestion.create({
    data: { productId, askerId: r.auth.uid, body: parsed.data.body },
    include: {
      asker: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
    },
  });
  return NextResponse.json({ ok: true, question: created });
}
