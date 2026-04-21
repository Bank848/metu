import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(255),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "BadRequest" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const product = await prisma.product.findUnique({ where: { productId } });
  if (!product) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const review = await prisma.productReview.create({
    data: {
      productId,
      userId: r.auth.uid,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    include: {
      user: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
    },
  });
  return NextResponse.json({ review });
}
