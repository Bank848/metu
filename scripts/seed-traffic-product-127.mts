/**
 * Targeted traffic for product #127 (Femboy Friday, Aubdun Arts).
 * Creates fulfilled orders + reviews. ~60% of orders apply the
 * store-scoped WEL10 coupon (10% off, coupon_id=10) so the coupon
 * usage metrics on the admin dashboard light up too.
 *
 * Idempotent only via the unique (couponId, userId) constraint on
 * coupon_usage — duplicate buyer+coupon pairs throw P2002 and the
 * script skips those rows. Re-running adds more orders/reviews.
 *
 * Run:
 *   tsx scripts/seed-traffic-product-127.mts            # dry-run
 *   tsx scripts/seed-traffic-product-127.mts --commit   # apply
 */
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const supabaseEnv = loadEnv(".supabase-credentials.local");
process.env.DATABASE_URL =
  supabaseEnv.DATABASE_URL ?? supabaseEnv.DATABASE_URL_UNPOOLED ?? "";

const COMMIT = process.argv.includes("--commit");

const PRODUCT_ID = 127;
const STORE_ID = 6;
const COUPON_ID = 10; // WEL10 (store 6)
const COUPON_PERCENT = 10;

const COMMENTS = [
  "Loved the art style. Really creative work!",
  "Worth the price. Will buy again.",
  "Cute and well-drawn. 5 stars.",
  "Beautiful piece. Recommended.",
  "Great quality. Fast download.",
  "ภาพสวยมาก ราคาคุ้ม",
  "ผลงานดีมากเลย น่ารัก",
  "โหลดเร็ว ภาพคมชัด",
];

function pick<T>(arr: T[]): T {
  return arr[crypto.randomInt(0, arr.length)]!;
}
function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

async function main() {
  const prisma = new PrismaClient();

  const product = await prisma.product.findUnique({
    where: { productId: PRODUCT_ID },
    include: { items: true },
  });
  if (!product || product.items.length === 0) {
    console.error("⚠ Product or variant not found.");
    process.exit(1);
  }
  const variant = product.items[0]!;
  const unit = Number(variant.price) * (100 - variant.discountPercent) / 100;

  // Buyer pool — exclude store owner + admins.
  const owner = await prisma.store.findUnique({
    where: { storeId: STORE_ID },
    select: { ownerId: true },
  });
  const candidateUsers = await prisma.user.findMany({
    where: {
      userId: { not: owner?.ownerId ?? 0 },
      stats: { role: { in: ["buyer", "seller"] } },
    },
    select: { userId: true },
    take: 18,
  });
  if (candidateUsers.length < 5) {
    console.error("⚠ Need at least 5 candidate buyers.");
    process.exit(1);
  }

  const orderCount = randomInt(8, 14);
  const buyersChosen = new Set<number>();
  while (buyersChosen.size < Math.min(orderCount, candidateUsers.length)) {
    buyersChosen.add(pick(candidateUsers).userId);
  }

  let ordersCreated = 0;
  let couponApplied = 0;
  let reviewsCreated = 0;

  for (const buyerId of buyersChosen) {
    const useCoupon = Math.random() < 0.6;
    const daysAgo = randomInt(0, 14);
    const hoursAgo = randomInt(0, 23);
    const orderDate = new Date(
      Date.now() - daysAgo * 24 * 60 * 60_000 - hoursAgo * 60 * 60_000,
    );

    const lineSubtotal = unit; // qty=1 download
    const discount = useCoupon ? lineSubtotal * (COUPON_PERCENT / 100) : 0;
    const total = lineSubtotal - discount;

    console.log(
      `${COMMIT ? "+" : "[dry]"} buyer=${buyerId} qty=1 unit=฿${unit} ` +
        `${useCoupon ? `coupon=-${discount.toFixed(2)} ` : ""}total=฿${total.toFixed(2)}`,
    );

    if (COMMIT) {
      try {
        await prisma.$transaction(async (tx) => {
          const txn = await tx.transaction.create({
            data: {
              transactionType: "purchase",
              userId: buyerId,
              totalAmount: new Prisma.Decimal(total),
              date: orderDate,
            },
          });
          await tx.order.create({
            data: {
              userId: buyerId,
              totalPrice: new Prisma.Decimal(total),
              status: "fulfilled",
              createdAt: orderDate,
              transactionId: txn.transactionId,
              items: {
                create: [
                  {
                    productItemId: variant.productItemId,
                    quantity: 1,
                    pricePerUnit: new Prisma.Decimal(unit),
                    couponId: useCoupon ? COUPON_ID : null,
                    deliveredAt: orderDate,
                    deliveredUrl: variant.deliveryUrl,
                  },
                ],
              },
            },
          });
          if (useCoupon) {
            try {
              await tx.couponUsage.create({
                data: { couponId: COUPON_ID, userId: buyerId },
              });
              couponApplied++;
            } catch (err) {
              if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
              ) {
                // Buyer already used this coupon — keep the order, drop the usage row.
                return;
              }
              throw err;
            }
          }
        });
        ordersCreated++;
      } catch (err) {
        console.error(`  ✗ order failed for buyer ${buyerId}:`, (err as Error).message);
        continue;
      }
    } else {
      ordersCreated++;
      if (useCoupon) couponApplied++;
    }

    // 70% chance of a review.
    if (Math.random() < 0.7) {
      const rating = pick([4, 5, 5, 5, 5]);
      const comment = pick(COMMENTS);
      if (COMMIT) {
        try {
          await prisma.productReview.create({
            data: {
              productId: PRODUCT_ID,
              userId: buyerId,
              rating,
              comment,
              createdAt: new Date(orderDate.getTime() + randomInt(1, 5) * 24 * 60 * 60_000),
            },
          });
          reviewsCreated++;
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
            throw err;
          }
        }
      } else {
        reviewsCreated++;
      }
    }
  }

  // Recompute store rating + product avg.
  if (COMMIT) {
    const rows = await prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(r.rating)::float AS avg
      FROM product_review r
      JOIN product p ON p.product_id = r.product_id
      WHERE p.store_id = ${STORE_ID}
    `;
    const avg = Number(rows[0]?.avg ?? 0);
    const rating10 = Math.round(avg * 10);
    await prisma.store.update({
      where: { storeId: STORE_ID },
      data: { rating: rating10 },
    });
    console.log(`  store rating ${rating10 / 10}★ (×10 stored)`);
  }

  console.log(
    `\n${COMMIT ? "✓" : "[dry-run]"} ${ordersCreated} orders · ${couponApplied} WEL10 redemptions · ${reviewsCreated} reviews.`,
  );
  if (!COMMIT) console.log("Pass --commit to apply.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
