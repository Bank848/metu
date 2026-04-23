import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Q&A moderation surface.
 *
 *  - PATCH  → admin can edit the question body OR the answer text.
 *             The asker can edit their own QUESTION body (not the
 *             answer). The seller (or admin) can edit the answer via
 *             the existing /api/questions/[id]/answer route — kept
 *             separate so that route's permission story stays clean.
 *  - DELETE → admin OR the asker can delete the whole question (and
 *             with it any answer that was attached).
 *
 * Every admin moderation action writes to the audit log
 * ("question.edit" / "question.delete").
 */

const editSchema = z.object({
  body: z.string().min(3).max(500).optional(),
  answer: z.string().min(3).max(500).nullable().optional(),
});

async function loadQuestion(questionId: number) {
  return prisma.productQuestion.findUnique({
    where: { questionId },
    select: {
      questionId: true, productId: true, askerId: true,
      body: true, answer: true, answererId: true, answeredAt: true,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const questionId = Number(params.id);
  if (!Number.isFinite(questionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const q = await loadQuestion(questionId);
  if (!q) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const isAdmin = r.auth.role === "admin";
  const isAsker = q.askerId === r.user.userId;

  const body = await req.json().catch(() => ({}));
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }

  // Permission gate — different fields require different roles:
  //   - Question body: admin OR original asker
  //   - Answer text:   admin only via this route (seller uses
  //                    /api/questions/[id]/answer instead)
  if (parsed.data.body !== undefined && !(isAdmin || isAsker)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.answer !== undefined && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.body === undefined && parsed.data.answer === undefined) {
    return NextResponse.json({ error: "ValidationError", message: "no fields to update" }, { status: 400 });
  }

  const updated = await prisma.productQuestion.update({
    where: { questionId },
    data: {
      ...(parsed.data.body   !== undefined ? { body:   parsed.data.body }   : {}),
      ...(parsed.data.answer !== undefined ? { answer: parsed.data.answer } : {}),
    },
  });

  if (isAdmin && (!isAsker || parsed.data.answer !== undefined)) {
    await audit({
      actorId: r.user.userId,
      action: "question.edit",
      targetType: "question",
      targetId: questionId,
      meta: {
        productId: q.productId,
        before: { body: q.body, answer: q.answer },
        after:  { body: updated.body, answer: updated.answer },
      },
    });
  }

  return NextResponse.json({ question: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const questionId = Number(params.id);
  if (!Number.isFinite(questionId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

  const q = await loadQuestion(questionId);
  if (!q) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const isAdmin = r.auth.role === "admin";
  const isAsker = q.askerId === r.user.userId;
  if (!isAdmin && !isAsker) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.productQuestion.delete({ where: { questionId } });

  if (isAdmin && !isAsker) {
    await audit({
      actorId: r.user.userId,
      action: "question.delete",
      targetType: "question",
      targetId: questionId,
      meta: {
        productId: q.productId,
        snapshot: {
          askerId: q.askerId, body: q.body,
          answer: q.answer, answererId: q.answererId,
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
