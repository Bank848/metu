import { prisma } from "../db/prisma.js";
import type {
  InboxResponse,
  InboxThread,
  MessageRow,
  SendMessageInput,
  ThreadResponse,
  UserSummary,
} from "../models/messages.model.js";

/**
 * Phase 13.8 — messages service. Postgres-only path (the relational
 * Message table). The MongoDB sidecar pilot recommended by Lecture 11
 * would swap this file out without touching controllers/routes.
 *
 * Threads are derived from the (senderId, recipientId) pair at query
 * time — there is no Conversation table. Suits a buyer↔seller demo
 * fine; if we ever needed N-way group chat, the schema would change
 * here first.
 */

const userSelect = {
  userId: true,
  username: true,
  firstName: true,
  lastName: true,
  profileImage: true,
} as const;

/**
 * Inbox view — most-recent message per partner, with unread count.
 * Pulls a recent slice (max 200) and groups in JS — fine for the
 * demo dataset; production-grade would push the GROUP BY into raw
 * SQL with a window function.
 */
export async function getInbox(userId: number): Promise<InboxResponse> {
  const recent = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { recipientId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender:    { select: userSelect },
      recipient: { select: userSelect },
    },
  });

  const partnerMap = new Map<number, InboxThread>();
  for (const m of recent) {
    const partner: UserSummary =
      m.senderId === userId ? m.recipient : m.sender;
    const prev = partnerMap.get(partner.userId);
    if (!prev) {
      partnerMap.set(partner.userId, {
        partner,
        lastMessage: m.body,
        lastAt: m.createdAt,
        unread: m.recipientId === userId && !m.readAt ? 1 : 0,
      });
    } else if (m.recipientId === userId && !m.readAt) {
      prev.unread += 1;
    }
  }

  return {
    threads: [...partnerMap.values()].sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    ),
  };
}

/**
 * Full thread between `userId` and `otherId`. Marks every message
 * received from `otherId` as read in the same call — opening the
 * thread implicitly clears the unread indicator.
 *
 * Returns `other: null` when the partner doesn't exist (deleted
 * account etc); the UI handles this by showing an empty thread.
 */
export async function getThread(
  userId: number,
  otherId: number,
): Promise<ThreadResponse> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId,  recipientId: otherId },
        { senderId: otherId, recipientId: userId  },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: userSelect } },
  });

  await prisma.message.updateMany({
    where: { senderId: otherId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });

  const other = await prisma.user.findUnique({
    where: { userId: otherId },
    select: userSelect,
  });

  return { messages: messages as unknown as MessageRow[], other };
}

/**
 * Send a message. Self-send rejected at the controller layer (we
 * only check that the recipient exists isn't soft-deleted here).
 */
export async function sendMessage(
  senderId: number,
  input: SendMessageInput,
): Promise<MessageRow> {
  const created = await prisma.message.create({
    data: {
      senderId,
      recipientId: input.recipientId,
      body: input.body,
      orderId: input.orderId ?? null,
      productId: input.productId ?? null,
    },
  });
  return created as unknown as MessageRow;
}

/** Cheap unread count for the TopNav dot — single COUNT query. */
export async function getUnreadCount(userId: number): Promise<number> {
  return prisma.message.count({
    where: { recipientId: userId, readAt: null },
  });
}
