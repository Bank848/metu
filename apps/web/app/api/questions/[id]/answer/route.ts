import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const answerSchema = z.object({ answer: z.string().min(3).max(500) });

/** PATCH /api/questions/[id]/answer — only the product's seller (or
 *  admin) may answer. Sets the answer text + answeredAt + answererId. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const questionId = Number(params.id);
  if (!Number.isFinite(questionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }

  const q = await prisma.productQuestion.findUnique({
    where: { questionId },
    include: { product: { select: { storeId: true } } },
  });
  if (!q) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  // Ownership check — admins bypass.
  if (r.auth.role !== "admin") {
    const myStore = r.user.store;
    if (!myStore || myStore.storeId !== q.product.storeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await prisma.productQuestion.update({
    where: { questionId },
    data: {
      answer: parsed.data.answer,
      answeredAt: new Date(),
      answererId: r.auth.uid,
    },
  });
  return NextResponse.json({ ok: true, question: updated });
}
