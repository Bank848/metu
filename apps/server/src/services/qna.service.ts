import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../utils/audit.js";
import type {
  QuestionAnswerInput,
  QuestionAskInput,
  QuestionEditInput,
  QuestionWithUsers,
} from "../models/qna.model.js";

/**
 * Public list — every question on a product, newest first. Includes
 * `answerer.stats.role` so the UI can render "Admin answered" vs
 * "Seller answered" without a follow-up call (Phase 10 / F23 fix).
 */
export async function listForProduct(productId: number) {
  return prisma.productQuestion.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: {
      asker: {
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
      answerer: {
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          stats: { select: { role: true } },
        },
      },
    },
  });
}

/**
 * Ask a question. Soft-deleted / orphan products reject 404 (same
 * surface as POST /products/:id/reviews).
 */
export async function askQuestion(
  askerId: number,
  productId: number,
  input: QuestionAskInput,
): Promise<QuestionWithUsers> {
  const product = await prisma.product.findFirst({
    // Phase 16.1 — also reject suspended stores (hidden from public).
    where: { productId, deletedAt: null, store: { deletedAt: null, suspendedAt: null } },
    select: { productId: true },
  });
  if (!product) throw new AppError(404, "ProductNotFound");

  return prisma.productQuestion.create({
    data: { productId, askerId, body: input.body },
    include: {
      asker: {
        select: {
          userId: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      },
    },
  }) as unknown as Promise<QuestionWithUsers>;
}

/**
 * Edit a question. Field-level permission gates:
 *   • body   — admin OR asker
 *   • answer — admin only via this route (sellers go through
 *              `answerQuestion` so the answerer/answeredAt fields
 *              get stamped correctly)
 *
 * `actor.isAdmin` + `actor.userId` come from the controller (kept
 * out of the service so it stays request-agnostic). When admin
 * touches someone else's question, an AuditLog row is written with
 * before/after snapshots.
 */
export async function editQuestion(
  questionId: number,
  actor: { userId: number; isAdmin: boolean },
  input: QuestionEditInput,
) {
  if (input.body === undefined && input.answer === undefined) {
    throw new AppError(400, "ValidationError", "no fields to update");
  }
  const q = await prisma.productQuestion.findUnique({
    where: { questionId },
    select: {
      questionId: true,
      productId: true,
      askerId: true,
      body: true,
      answer: true,
      answererId: true,
      answeredAt: true,
    },
  });
  if (!q) throw new AppError(404, "QuestionNotFound");

  const isAsker = q.askerId === actor.userId;
  if (input.body !== undefined && !(actor.isAdmin || isAsker)) {
    throw new AppError(403, "Forbidden");
  }
  if (input.answer !== undefined && !actor.isAdmin) {
    // Sellers MUST use the answer endpoint so we know who answered
    // (and stamp answeredAt). This prevents sellers from sneaking
    // an answer in via the edit route without claiming ownership.
    throw new AppError(403, "Forbidden");
  }

  const updated = await prisma.productQuestion.update({
    where: { questionId },
    data: {
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.answer !== undefined ? { answer: input.answer } : {}),
    },
  });

  if (actor.isAdmin && (!isAsker || input.answer !== undefined)) {
    await audit({
      actorId: actor.userId,
      action: "question.edit",
      targetType: "question",
      targetId: questionId,
      meta: {
        productId: q.productId,
        before: { body: q.body, answer: q.answer },
        after: { body: updated.body, answer: updated.answer },
      },
    });
  }
  return updated;
}

/**
 * Hard-delete a question. Admin OR asker. Admin moderation writes an
 * AuditLog with the full snapshot.
 */
export async function deleteQuestion(
  questionId: number,
  actor: { userId: number; isAdmin: boolean },
): Promise<void> {
  const q = await prisma.productQuestion.findUnique({
    where: { questionId },
    select: {
      questionId: true,
      productId: true,
      askerId: true,
      body: true,
      answer: true,
      answererId: true,
    },
  });
  if (!q) throw new AppError(404, "QuestionNotFound");

  const isAsker = q.askerId === actor.userId;
  if (!actor.isAdmin && !isAsker) throw new AppError(403, "Forbidden");

  await prisma.productQuestion.delete({ where: { questionId } });

  if (actor.isAdmin && !isAsker) {
    await audit({
      actorId: actor.userId,
      action: "question.delete",
      targetType: "question",
      targetId: questionId,
      meta: {
        productId: q.productId,
        snapshot: {
          askerId: q.askerId,
          body: q.body,
          answer: q.answer,
          answererId: q.answererId,
        },
      },
    });
  }
}

/**
 * Answer a question. Only the product's seller (or admin) may answer.
 * Stamps `answer`, `answeredAt`, `answererId` together so the UI can
 * show "Admin/Seller answered N hours ago".
 *
 * `actor` carries the user's role + their store row (when present)
 * so the service can verify ownership without reading the request.
 */
export async function answerQuestion(
  questionId: number,
  actor: { userId: number; isAdmin: boolean; storeId?: number | null },
  input: QuestionAnswerInput,
) {
  const q = await prisma.productQuestion.findUnique({
    where: { questionId },
    include: { product: { select: { storeId: true } } },
  });
  if (!q) throw new AppError(404, "QuestionNotFound");

  if (!actor.isAdmin) {
    if (!actor.storeId || actor.storeId !== q.product.storeId) {
      throw new AppError(403, "Forbidden");
    }
  }

  return prisma.productQuestion.update({
    where: { questionId },
    data: {
      answer: input.answer,
      answeredAt: new Date(),
      answererId: actor.userId,
    },
  });
}
