import { NextResponse, type NextRequest } from "next/server";
import { sendMessageSchema } from "@metu/shared";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/messages
 *   ?with=<userId>  → full thread with that user (sent + received)
 *                      Marks messages from them as read.
 *   (no query)      → "inbox" — last message per conversation partner
 */
export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const me = r.auth.uid;

  const withParam = req.nextUrl.searchParams.get("with");
  if (withParam) {
    const otherId = Number(withParam);
    if (!Number.isFinite(otherId)) return NextResponse.json({ error: "BadId" }, { status: 400 });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: me, recipientId: otherId },
          { senderId: otherId, recipientId: me },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
      },
    });

    // Mark all messages received from this user as read.
    await prisma.message.updateMany({
      where: { senderId: otherId, recipientId: me, readAt: null },
      data: { readAt: new Date() },
    });

    // Surface the other user's display info too.
    const other = await prisma.user.findUnique({
      where: { userId: otherId },
      select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true },
    });

    return NextResponse.json({ messages, other });
  }

  // Inbox: most-recent message per partner, plus an unread count.
  // Pulls a recent slice (max 200) and groups in JS — fine for the
  // demo; if it ever grows past that we'd push into raw SQL.
  const recent = await prisma.message.findMany({
    where: { OR: [{ senderId: me }, { recipientId: me }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender:    { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
      recipient: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
    },
  });

  const partnerMap = new Map<
    number,
    {
      partner: { userId: number; username: string; firstName: string; lastName: string; profileImage: string | null };
      lastMessage: string;
      lastAt: Date;
      unread: number;
    }
  >();
  for (const m of recent) {
    const partner = m.senderId === me ? m.recipient : m.sender;
    const prev = partnerMap.get(partner.userId);
    if (!prev) {
      partnerMap.set(partner.userId, {
        partner,
        lastMessage: m.body,
        lastAt: m.createdAt,
        unread: m.recipientId === me && !m.readAt ? 1 : 0,
      });
    } else if (m.recipientId === me && !m.readAt) {
      prev.unread += 1;
    }
  }

  return NextResponse.json({
    threads: [...partnerMap.values()].sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    ),
  });
}

/** POST /api/messages — send a message. Self-send is rejected. */
export async function POST(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.recipientId === r.auth.uid) {
    return NextResponse.json({ error: "SelfSend" }, { status: 400 });
  }
  const created = await prisma.message.create({
    data: {
      senderId: r.auth.uid,
      recipientId: parsed.data.recipientId,
      body: parsed.data.body,
      orderId: parsed.data.orderId,
      productId: parsed.data.productId,
    },
  });
  return NextResponse.json({ ok: true, message: created });
}
