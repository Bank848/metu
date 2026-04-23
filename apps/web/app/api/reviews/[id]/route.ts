import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reviews moderation surface.
 *
 *  - PATCH  → admin OR the review's author can edit
 *  - DELETE → admin OR the review's author can delete
 *
 * Admin actions are written to the audit log so we have a paper trail
 * of moderation activity (per the standing audit-log convention from
 * Batch D — "review.edit" / "review.delete" actions).
 */

const editSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(255).optional(),
});

async function loadReview(reviewId: number) {
  return prisma.productReview.findUnique({
    where: { reviewId },
    select: { reviewId: true, userId: true, productId: true, rating: true, comment: true },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const reviewId = Number(params.id);
  if (!Number.isFinite(reviewId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const review = await loadReview(reviewId);
  if (!review) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  // Admin override OR self-edit. Sellers can NOT edit reviews on
  // their own products — that would be obvious manipulation.
  const isAdmin = r.auth.role === "admin";
  const isAuthor = review.userId === r.user.userId;
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = editSchema.safeParse(body);
  if (!parsed.success || (parsed.data.rating === undefined && parsed.data.comment === undefined)) {
    return NextResponse.json(
      { error: "ValidationError", details: parsed.success ? "no fields to update" : parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.productReview.update({
    where: { reviewId },
    data: {
      ...(parsed.data.rating !== undefined ? { rating: parsed.data.rating } : {}),
      ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
    },
    include: {
      user: { select: { firstName: true, lastName: true, profileImage: true, username: true } },
    },
  });

  // Only audit when admin reaches into someone else's review — author
  // self-edits aren't moderation events.
  if (isAdmin && !isAuthor) {
    await audit({
      actorId: r.user.userId,
      action: "review.edit",
      targetType: "review",
      targetId: reviewId,
      meta: {
        productId: review.productId,
        before: { rating: review.rating, comment: review.comment },
        after: { rating: updated.rating, comment: updated.comment },
      },
    });
  }

  return NextResponse.json({ review: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const reviewId = Number(params.id);
  if (!Number.isFinite(reviewId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const review = await loadReview(reviewId);
  if (!review) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const isAdmin = r.auth.role === "admin";
  const isAuthor = review.userId === r.user.userId;
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Hard delete — reviews don't have a soft-delete column; the row's
  // gone, the audit log keeps a snapshot in `meta`.
  await prisma.productReview.delete({ where: { reviewId } });

  if (isAdmin && !isAuthor) {
    await audit({
      actorId: r.user.userId,
      action: "review.delete",
      targetType: "review",
      targetId: reviewId,
      meta: {
        productId: review.productId,
        snapshot: { rating: review.rating, comment: review.comment, userId: review.userId },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
