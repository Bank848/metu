import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type {
  ReviewEditInput,
  ReviewInput,
  ReviewWithAuthor,
} from "../models/reviews.model.js";

/**
 * Create a review on a product. Soft-deleted / orphan products
 * (store removed) reject with 404 — reviewing them would surface
 * orphan content nowhere visible to the user.
 */
export async function createReview(
  userId: number,
  productId: number,
  input: ReviewInput,
): Promise<ReviewWithAuthor> {
  const product = await prisma.product.findFirst({
    // Phase 16.1 — also reject suspended stores (parent hidden from public).
    where: { productId, deletedAt: null, store: { deletedAt: null, suspendedAt: null } },
    select: { productId: true },
  });
  if (!product) throw new AppError(404, "ProductNotFound");

  return prisma.productReview.create({
    data: {
      productId,
      userId,
      rating: input.rating,
      comment: input.comment,
    },
    include: {
      // userId on the response so the moderation UI can recognise
      // the just-posted row as owned by the viewer without a refetch.
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Update a review. Admin OR author can edit; sellers can NOT edit
 * reviews on their own products (would be obvious manipulation).
 *
 * `isAdmin` is passed in by the controller so the service stays
 * request-agnostic. When admin reaches into someone else's review
 * we write an `AuditLog` row with before/after snapshots.
 */
export async function updateReview(
  reviewId: number,
  actor: { userId: number; isAdmin: boolean },
  input: ReviewEditInput,
): Promise<ReviewWithAuthor> {
  if (input.rating === undefined && input.comment === undefined) {
    throw new AppError(400, "ValidationError", "no fields to update");
  }
  const review = await prisma.productReview.findUnique({
    where: { reviewId },
    select: {
      reviewId: true,
      userId: true,
      productId: true,
      rating: true,
      comment: true,
    },
  });
  if (!review) throw new AppError(404, "ReviewNotFound");

  const isAuthor = review.userId === actor.userId;
  if (!actor.isAdmin && !isAuthor) {
    throw new AppError(403, "Forbidden");
  }

  const updated = await prisma.productReview.update({
    where: { reviewId },
    data: {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          profileImage: true,
          username: true,
        },
      },
    },
  });

  if (actor.isAdmin && !isAuthor) {
    await audit({
      actorId: actor.userId,
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

  return updated as ReviewWithAuthor;
}

/**
 * Hard-delete a review. Same admin-OR-author gate as updateReview.
 * Reviews don't have a soft-delete column; the AuditLog snapshot in
 * `meta` is the only forensic record after deletion.
 */
export async function deleteReview(
  reviewId: number,
  actor: { userId: number; isAdmin: boolean },
): Promise<void> {
  const review = await prisma.productReview.findUnique({
    where: { reviewId },
    select: {
      reviewId: true,
      userId: true,
      productId: true,
      rating: true,
      comment: true,
    },
  });
  if (!review) throw new AppError(404, "ReviewNotFound");

  const isAuthor = review.userId === actor.userId;
  if (!actor.isAdmin && !isAuthor) {
    throw new AppError(403, "Forbidden");
  }

  await prisma.productReview.delete({ where: { reviewId } });

  if (actor.isAdmin && !isAuthor) {
    await audit({
      actorId: actor.userId,
      action: "review.delete",
      targetType: "review",
      targetId: reviewId,
      meta: {
        productId: review.productId,
        snapshot: {
          rating: review.rating,
          comment: review.comment,
          userId: review.userId,
        },
      },
    });
  }
}
