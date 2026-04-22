import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/export — GDPR-style "download your data" endpoint.
 *
 * Returns a single JSON blob with everything we know about the
 * authenticated user: profile, orders + line items, reviews, favourites,
 * coupon usages, messages they sent or received, and the audit-log
 * entries where they were the actor. Stripped of sensitive fields:
 *   - the password hash
 *   - other users' personal info on shared resources
 *
 * Set as a downloadable attachment so the browser saves a `.json` file
 * rather than rendering it.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuth(req);
  if (!r.ok) return r.response;
  const userId = r.user.userId;

  const [
    user,
    orders,
    reviews,
    favorites,
    couponUsages,
    sentMessages,
    receivedMessages,
    auditEntries,
    stockAlerts,
    questions,
    store,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { userId },
      include: { stats: true, country: true },
    }),
    prisma.order.findMany({
      where: { cart: { userId } },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            productItem: {
              select: {
                productItemId: true,
                deliveryMethod: true,
                product: { select: { productId: true, name: true } },
              },
            },
          },
        },
        transaction: true,
      },
    }),
    prisma.productReview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        reviewId: true,
        productId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
    prisma.productFavorite.findMany({
      where: { userId },
      select: { productId: true, createdAt: true },
    }),
    prisma.couponUsage.findMany({
      where: { userId },
      select: { couponId: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        messageId: true,
        recipientId: true,
        body: true,
        productId: true,
        orderId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        messageId: true,
        senderId: true,
        body: true,
        productId: true,
        orderId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.stockAlert.findMany({
      where: { userId },
      select: { productItemId: true, createdAt: true, notifiedAt: true },
    }),
    prisma.productQuestion.findMany({
      where: { askerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        questionId: true,
        productId: true,
        body: true,
        answer: true,
        answeredAt: true,
        createdAt: true,
      },
    }),
    prisma.store.findUnique({
      where: { ownerId: userId },
      include: { stats: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "NotFound" }, { status: 404 });
  }

  // Strip the password hash before serialising — even though it's bcrypted
  // there's no reason to ship it in the export.
  const { password: _password, ...userSafe } = user;

  const blob = {
    exportedAt: new Date().toISOString(),
    notice:
      "This is your personal data on METU. Generated under your right to data portability. Keep it private — it includes your order history and messages.",
    user: userSafe,
    store,
    orders,
    reviews,
    favorites,
    couponUsages,
    messagesSent: sentMessages,
    messagesReceived: receivedMessages,
    auditEntries,
    stockAlerts,
    questions,
  };

  return new NextResponse(JSON.stringify(blob, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="metu-data-${userId}-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
