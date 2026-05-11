/**
 * Backfill orders + reviews for the freshly-seeded themed-store
 * catalogue (KMUTT BOOK STORE, Ado Official Music Shop, Shonen Jump,
 * Macrohard). Without traffic the products have a flat "0 sold · no
 * reviews" footer that makes the marketplace look dead — this script
 * gives each new product a realistic mix of buyers + ratings so the
 * defense demo has something on the store-detail and top-products
 * widgets.
 *
 * What it does, per matching product:
 *   1. Pick 3–8 random non-seller buyers from `users` (skips the
 *      4 store owners + any admin).
 *   2. Create one fulfilled Order per buyer, spread back over the
 *      last 21 days. Each Order has a single OrderItem for the
 *      target product, fully delivered (download URL or generated
 *      license_key copied into delivered_url / delivered_key).
 *   3. For ~60% of those buyers, also insert a ProductReview with
 *      a category-appropriate comment + rating in [4, 5].
 *   4. After all reviews land, recompute store.rating as
 *      round(AVG(rating) × 10) over the store's reviews so the
 *      live store badges + matview rebuild use the right number.
 *
 * Idempotent-ish: re-running adds MORE orders/reviews on top
 * (doesn't dedup by product). Run once unless you want to inflate
 * the numbers more.
 *
 * Run locally:
 *   tsx scripts/seed-traffic-themed-stores.mts             # dry-run
 *   tsx scripts/seed-traffic-themed-stores.mts --commit    # apply
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
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not in .supabase-credentials.local");
}

const COMMIT = process.argv.includes("--commit");

const TARGET_STORES = [
  "KMUTT BOOK STORE",
  "Ado Official Music Shop",
  "Shonen Jump",
  "Macrohard",
];

// Category → rotating comment pool. Each review picks one at random.
const COMMENTS_BY_CATEGORY: Record<string, string[]> = {
  "E-books": [
    "Great reference, exactly what I needed for the course.",
    "Clear writing and well-organized chapters. 5 stars.",
    "Used this for revision before finals — saved me hours.",
    "Heavy PDF but worth it. Diagrams are sharp.",
    "Solid foundational text. Recommended.",
    "อ่านสนุก เนื้อหาครบเครื่อง",
    "เนื้อหาดี ปูพื้นได้แน่น",
    "ตัวอักษรชัด ภาพประกอบดี ใช้ดีมาก",
  ],
  "Stock Music": [
    "Banger. On loop all week.",
    "Audio quality is pristine, no complaints.",
    "Streaming worked instantly after purchase.",
    "Live performance version is fire.",
    "เพลงดีมากกก ฟังจบจังหวะแรกติดเลย",
    "เสียงดีจริง คุ้มเงิน",
    "ของแท้ครับ คุณภาพดีมาก",
  ],
  Templates: [
    "Saved me a ton of layout work — the A4 + A3 split is exactly what I needed.",
    "Clean templates, easy to customize.",
    "Used the planner for the whole semester. Highly recommended.",
    "ใช้งานง่าย พิมพ์สวย",
    "แม่แบบครบ กดดาวน์โหลดได้เลย",
  ],
  Photography: [
    "Gorgeous shots, looks great printed.",
    "High resolution and well-organized.",
    "Backstage photos are stunning.",
    "รูปสวยมาก ราคาคุ้ม",
  ],
  "Plug-ins": [
    "Activated on first try. Works as advertised.",
    "Generated key delivered instantly — clean install.",
    "Smooth purchase + activation flow.",
    "Got my keys right away. Will buy more.",
    "เร็วมาก กดซื้อปุ๊บได้คีย์ปั๊บ",
    "ลงโปรแกรมทันที ใช้งานได้เลย",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[crypto.randomInt(0, arr.length)]!;
}
function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}
function generateLicenseKey(template: string | null): string {
  if (!template) return crypto.randomUUID();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return template.replace(/X{4}/g, () => {
    let block = "";
    for (let i = 0; i < 4; i++) {
      block += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return block;
  });
}

async function main() {
  const prisma = new PrismaClient();

  // ── 1. Resolve store + product targets ────────────────────────
  const stores = await prisma.store.findMany({
    where: { name: { in: TARGET_STORES } },
    select: {
      storeId: true,
      name: true,
      ownerId: true,
    },
  });
  if (stores.length === 0) {
    console.error("⚠ No target stores found.");
    process.exit(1);
  }
  const ownerIds = new Set(stores.map((s) => s.ownerId));

  const products = await prisma.product.findMany({
    where: { storeId: { in: stores.map((s) => s.storeId) }, isActive: true },
    include: {
      category: { select: { categoryName: true } },
      items: {
        select: {
          productItemId: true,
          deliveryMethod: true,
          price: true,
          discountPercent: true,
          deliveryUrl: true,
          licenseKeyTemplate: true,
        },
      },
    },
  });
  console.log(`Found ${products.length} products across ${stores.length} stores.`);

  // ── 2. Pick buyer pool ────────────────────────────────────────
  // Anyone who isn't a target-store owner and isn't an admin. Keep
  // the pool small (10–20) so the same buyers recur — looks more
  // like real traffic than every order from a unique user.
  const candidateUsers = await prisma.user.findMany({
    where: {
      userId: { notIn: [...ownerIds] },
      stats: { role: { in: ["buyer", "seller"] } },
    },
    select: { userId: true },
    take: 24,
  });
  if (candidateUsers.length < 3) {
    console.error("⚠ Need at least 3 non-owner users in DB to seed traffic.");
    process.exit(1);
  }
  console.log(`Buyer pool: ${candidateUsers.length} users.`);

  let ordersCreated = 0;
  let itemsCreated = 0;
  let reviewsCreated = 0;
  const touchedStores = new Set<number>();

  // ── 3. Per-product loop ───────────────────────────────────────
  for (const p of products) {
    if (p.items.length === 0) continue;
    const variant = p.items[0]!; // primary variant
    const unit = Number(variant.price) * (100 - variant.discountPercent) / 100;

    const orderCount = randomInt(3, 8);
    const buyersForThisProduct = new Set<number>();
    while (buyersForThisProduct.size < Math.min(orderCount, candidateUsers.length)) {
      buyersForThisProduct.add(pick(candidateUsers).userId);
    }

    for (const buyerUserId of buyersForThisProduct) {
      // Random qty: stackable license_key → 1–4, else 1.
      const isStackableKey = p.isStackable && variant.deliveryMethod === "license_key";
      const qty = isStackableKey ? randomInt(1, 4) : 1;
      const total = new Prisma.Decimal(unit * qty);

      // Random date in the last 21 days; back-stamp createdAt + delivered_at.
      const daysAgo = randomInt(0, 21);
      const hoursAgo = randomInt(0, 23);
      const orderDate = new Date(
        Date.now() - daysAgo * 24 * 60 * 60_000 - hoursAgo * 60 * 60_000,
      );

      // Prepare delivery payload up-front.
      let deliveredUrl: string | null = null;
      let deliveredKey: string | null = null;
      switch (variant.deliveryMethod) {
        case "license_key":
        case "email": {
          const keys: string[] = [];
          for (let i = 0; i < qty; i++) {
            keys.push(generateLicenseKey(variant.licenseKeyTemplate));
          }
          deliveredKey = keys.join("\n");
          break;
        }
        case "download":
        case "streaming":
          deliveredUrl = variant.deliveryUrl ?? null;
          break;
      }

      if (COMMIT) {
        await prisma.$transaction(async (tx) => {
          const txn = await tx.transaction.create({
            data: {
              transactionType: "purchase",
              userId: buyerUserId,
              totalAmount: total,
              date: orderDate,
            },
          });
          const order = await tx.order.create({
            data: {
              userId: buyerUserId,
              totalPrice: total,
              status: "fulfilled",
              createdAt: orderDate,
              transactionId: txn.transactionId,
              items: {
                create: [
                  {
                    productItemId: variant.productItemId,
                    quantity: qty,
                    pricePerUnit: new Prisma.Decimal(unit),
                    deliveredAt: orderDate,
                    deliveredUrl,
                    deliveredKey,
                  },
                ],
              },
            },
          });
          ordersCreated++;
          itemsCreated++;
          return order;
        });
      } else {
        ordersCreated++;
        itemsCreated++;
      }

      // 60% chance to leave a review.
      const willReview = Math.random() < 0.6;
      if (willReview) {
        const rating = pick([4, 5, 5, 5, 4, 5]); // skew positive
        const comments =
          COMMENTS_BY_CATEGORY[p.category.categoryName] ??
          COMMENTS_BY_CATEGORY["E-books"]!;
        const comment = pick(comments);
        const reviewDate = new Date(orderDate.getTime() + randomInt(1, 7) * 24 * 60 * 60_000);

        if (COMMIT) {
          try {
            await prisma.productReview.create({
              data: {
                productId: p.productId,
                userId: buyerUserId,
                rating,
                comment,
                createdAt: reviewDate,
              },
            });
            reviewsCreated++;
            touchedStores.add(p.storeId);
          } catch (err) {
            // Unique (productId, userId) — buyer already reviewed; skip.
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002"
            ) {
              continue;
            }
            throw err;
          }
        } else {
          reviewsCreated++;
          touchedStores.add(p.storeId);
        }
      }
    }
  }

  // ── 4. Recompute store.rating for touched stores ──────────────
  if (COMMIT && touchedStores.size > 0) {
    for (const storeId of touchedStores) {
      const rows = await prisma.$queryRaw<Array<{ avg: number | null }>>`
        SELECT AVG(r.rating)::float AS avg
        FROM product_review r
        JOIN product p ON p.product_id = r.product_id
        WHERE p.store_id = ${storeId}
      `;
      const avg = Number(rows[0]?.avg ?? 0);
      const rating10 = Math.round(avg * 10);
      await prisma.store.update({
        where: { storeId },
        data: { rating: rating10 },
      });
      console.log(`  store ${storeId}: rating set to ${rating10 / 10}★ (× 10 stored)`);
    }
  }

  console.log(
    `\n${COMMIT ? "✓" : "[dry-run]"} ${ordersCreated} order(s) · ${itemsCreated} item(s) · ${reviewsCreated} review(s) across ${products.length} products.`,
  );
  if (!COMMIT) console.log("Pass --commit to apply.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
