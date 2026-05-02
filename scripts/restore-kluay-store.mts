/**
 * Phase 48 follow-up — restore Kluay Studio (the seed seller@metu.dev
 * demo store) after it got soft-deleted in earlier admin tests.
 *
 * Steps:
 *   1. Clear deletedAt + bannedAt on user 2 (kluay).
 *   2. Clear deletedAt on store 1, set stripe_charges_enabled = true
 *      so buyers can run the checkout demo end-to-end.
 *   3. Re-add the 9 original Kluay Studio products from seed.ts
 *      (idempotent — skips by name).
 *
 * Run locally: tsx scripts/restore-kluay-store.mts
 */
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

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

const USER_ID = 2;
const STORE_ID = 1;

type Delivery = "download" | "streaming" | "license_key" | "email";
interface Variant {
  delivery: Delivery;
  price: number;
  qty: number;
  discountPercent?: number;
}
interface ProductDef {
  category: string;
  name: string;
  description: string;
  imageSeeds: string[];
  tagNames: string[];
  items: Variant[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const samplePreviewExt = (cat: string): string => {
  switch (cat) {
    case "Stock Music": return "mp3";
    case "Photography": case "Illustrations": case "Fonts": case "Templates": return "jpg";
    case "3D Models": return "glb";
    case "Game Assets": return "zip";
    case "Online Courses": return "mp4";
    case "E-books": return "pdf";
    case "Plug-ins": return "zip";
    default: return "pdf";
  }
};

// Mirrors the original Kluay Studio catalogue from packages/db/seed.ts.
const CATALOG: ProductDef[] = [
  {
    name: "Figma Dashboard Kit — Glasswave",
    description: "120 components, 40 chart blocks, dark + light variants. Auto-layout everywhere.",
    category: "Templates",
    imageSeeds: ["figma-dashboard-1", "figma-dashboard-2", "figma-dashboard-3"],
    tagNames: ["premium", "pro", "dark-mode"],
    items: [
      { delivery: "download", price: 2750, qty: 999 },
      { delivery: "license_key", price: 6950, qty: 50, discountPercent: 10 },
    ],
  },
  {
    name: "Nebula — Bold Display Typeface",
    description: "A tall, confident display face with 7 weights and 420+ glyphs.",
    category: "Fonts",
    imageSeeds: ["nebula-font-1", "nebula-font-2"],
    tagNames: ["premium", "commercial-use", "minimal"],
    items: [
      { delivery: "download", price: 1700, qty: 999 },
      { delivery: "license_key", price: 5200, qty: 100 },
    ],
  },
  {
    name: "Thai Botanical Ink Illustration Pack",
    description: "60 hand-painted Thai botanical pieces (lotus, frangipani, banana leaf) as PNG + SVG + Procreate.",
    category: "Illustrations",
    imageSeeds: ["thai-botanical-1", "thai-botanical-2", "thai-botanical-3"],
    tagNames: ["bestseller", "no-attribution", "thai-style"],
    items: [{ delivery: "download", price: 1400, qty: 999, discountPercent: 20 }],
  },
  {
    name: "Notion Productivity OS 2026",
    description: "A complete life OS: goals, habits, journal, projects, and areas. Available in EN + TH.",
    category: "Templates",
    imageSeeds: ["notion-os-1", "notion-os-2"],
    tagNames: ["new-release"],
    items: [{ delivery: "email", price: 690, qty: 999 }],
  },
  {
    name: "Songkran Social Media Kit 2026",
    description: "Editable Figma + Canva templates for Songkran festival campaigns. 24 layouts, TH/EN.",
    category: "Templates",
    imageSeeds: ["songkran-kit-1", "songkran-kit-2"],
    tagNames: ["thai-style", "new-release"],
    items: [{ delivery: "download", price: 990, qty: 999 }],
  },
  {
    name: "Midnight Icon Pack — 500 Line Icons",
    description: "Stroke-consistent line icons in 5 styles. SVG, Figma, and Iconify ready.",
    category: "Illustrations",
    imageSeeds: ["midnight-icons-1", "midnight-icons-2"],
    tagNames: ["minimal", "dark-mode", "pro"],
    items: [{ delivery: "download", price: 1050, qty: 999 }],
  },
  {
    name: "Isometric Workspace Scenes Pack",
    description: "24 editable isometric scenes for pitch decks and marketing sites.",
    category: "Illustrations",
    imageSeeds: ["isometric-1", "isometric-2"],
    tagNames: ["pro", "high-quality"],
    items: [{ delivery: "download", price: 1390, qty: 999 }],
  },
  {
    name: "Glassmorphism UI Components 2.0",
    description: "60 production-ready glass components for SaaS dashboards. Figma + React.",
    category: "Templates",
    imageSeeds: ["glassmorph-1", "glassmorph-2"],
    tagNames: ["premium", "dark-mode"],
    items: [{ delivery: "download", price: 1850, qty: 999 }],
  },
  {
    name: "Bangkok Streets Photography Pack",
    description: "60 high-res street photos of Bangkok — markets, BTS, golden hour. Royalty-free.",
    category: "Photography",
    imageSeeds: ["bkk-streets-pack-1", "bkk-streets-pack-2"],
    tagNames: ["thai-style", "royalty-free", "commercial-use"],
    items: [{ delivery: "download", price: 1290, qty: 999 }],
  },
];

const prisma = new PrismaClient();

async function main() {
  // 1. Restore the user account.
  const user = await prisma.user.update({
    where: { userId: USER_ID },
    data: {
      deletedAt: null,
      bannedAt: null,
      bannedReason: null,
    },
    select: { username: true, email: true },
  });
  console.log(`✓ Restored user ${USER_ID} (@${user.username} · ${user.email})`);

  // 2. Restore the store + flip Stripe charges so buyers can checkout.
  const store = await prisma.store.update({
    where: { storeId: STORE_ID },
    data: {
      deletedAt: null,
      suspendedAt: null,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
    select: { name: true },
  });
  console.log(`✓ Restored store ${STORE_ID} ("${store.name}") with Stripe charges enabled`);

  // 3. Re-add catalogue (idempotent).
  const categories = await prisma.category.findMany();
  const catId = new Map(categories.map((c) => [c.categoryName, c.categoryId]));
  const tags = await prisma.productTag.findMany();
  const tagId = new Map(tags.map((t) => [t.tagName, t.tagId]));

  let created = 0;
  let skipped = 0;
  for (const def of CATALOG) {
    const cid = catId.get(def.category);
    if (!cid) {
      console.warn(`⚠ Unknown category "${def.category}", skipping.`);
      skipped++;
      continue;
    }
    const existing = await prisma.product.findFirst({
      where: { storeId: STORE_ID, name: def.name, deletedAt: null },
      select: { productId: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const slug = slugify(def.name);
    const ext = samplePreviewExt(def.category);
    const productDeliveryMethod = def.items[0]!.delivery;
    // Phase 48 default — license_key stackable, the rest single-copy.
    const isStackable = productDeliveryMethod === "license_key";

    const product = await prisma.product.create({
      data: {
        storeId: STORE_ID,
        categoryId: cid,
        name: def.name,
        description: def.description,
        deliveryMethod: productDeliveryMethod,
        isStackable,
        images: {
          create: def.imageSeeds.map((seed, i) => ({
            productImage: `https://picsum.photos/seed/${seed}/1200/800`,
            sortOrder: i,
          })),
        },
        items: {
          create: def.items.map((it, idx) => {
            const sampleUrl = `https://samples.metu.dev/${slug}-preview.${ext}`;
            const deliveryUrl =
              it.delivery === "download"
                ? `https://files.metu.dev/${slug}.zip`
                : it.delivery === "streaming"
                ? `https://stream.metu.dev/${slug}/index.m3u8`
                : null;
            const licenseKeyTemplate =
              it.delivery === "license_key"
                ? "METU-XXXX-XXXX-XXXX"
                : it.delivery === "email"
                ? "METU-EMAIL-XXXX"
                : null;
            const discountPercent = it.discountPercent ?? 0;
            return {
              name:
                def.items.length > 1
                  ? `${def.name} — Variant ${idx + 1}`.slice(0, 100)
                  : def.name.slice(0, 100),
              deliveryMethod: it.delivery,
              quantity: it.qty,
              price: new Prisma.Decimal(it.price),
              discountPercent,
              discountAmount: new Prisma.Decimal(
                Math.round(it.price * discountPercent) / 100,
              ),
              sampleUrl,
              deliveryUrl,
              licenseKeyTemplate,
            };
          }),
        },
        productNTags: {
          create: def.tagNames
            .map((t) => tagId.get(t))
            .filter((x): x is number => typeof x === "number")
            .map((tid) => ({ tagId: tid })),
        },
      },
    });
    created++;
    console.log(`  + ${def.category.padEnd(15)} ${product.name}`);
  }

  console.log(
    `\n✓ ${created} new product(s), ${skipped} skipped (already existed).`,
  );
  console.log(`Login: seller@metu.dev · password: Seller#123`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
