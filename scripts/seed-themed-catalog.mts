/**
 * Seed a themed product catalogue across 4 stores that already exist
 * in the marketplace:
 *
 *   - KMUTT BOOK STORE     → textbooks + study resources (download .pdf)
 *   - Ado Official Music Shop → singles + albums (streaming → YouTube URLs,
 *                                 plus a few downloadable extras)
 *   - Shonen Jump           → manga volumes (download .pdf)
 *   - Macrohard             → Microsoft-parody software (license_key,
 *                                 stackable=true so a buyer can grab
 *                                 multiple keys per cart line)
 *
 * Idempotent — re-running skips products whose name already exists in
 * the target store. Safe to run repeatedly while iterating.
 *
 * Download URLs point at our own /api/dl/[filename] endpoint so each
 * purchased line resolves to a real, openable file (PDF for textbooks
 * / manga, MP3 for songs, ZIP fallback).
 *
 * Run locally (talks to Supabase prod via .supabase-credentials.local):
 *
 *   tsx scripts/seed-themed-catalog.mts
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

const SITE_URL = supabaseEnv.SITE_URL ?? "https://metu.online";

type Delivery = "download" | "streaming" | "license_key" | "email";
interface Variant {
  name?: string;
  delivery: Delivery;
  price: number;
  qty: number | null;
  discountPercent?: number;
  /** Pre-built deliveryUrl (used as-is when set). When omitted, the
   *  download/streaming line is given a /api/dl URL. */
  deliveryUrl?: string;
  /** license_key template — METU-prefixed by default. */
  keyTemplate?: string;
}
interface ProductDef {
  category: string;
  name: string;
  description: string;
  imageSeeds: string[];
  tagNames: string[];
  items: Variant[];
  isStackable?: boolean;
  details?: Array<{ detailName: string; detailValue: string }>;
}

interface StoreCatalog {
  storeName: string;
  products: ProductDef[];
}

// ────────────────────────────────────────────────────────────────
// Slug → /api/dl/<slug>.<ext> so the BFF's dummy-file endpoint can
// serve a real openable artefact at purchase time.
// ────────────────────────────────────────────────────────────────
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function downloadUrl(productName: string, ext: string): string {
  return `${SITE_URL}/api/dl/${slugify(productName)}.${ext}`;
}

// ────────────────────────────────────────────────────────────────
// Catalogues. Categories must match seeded Category rows by name.
// ────────────────────────────────────────────────────────────────
const KMUTT_BOOKS: ProductDef[] = [
  {
    category: "E-books",
    name: "Database System Concepts (Korth, 7th Ed)",
    description: "The KMUTT CPE241 reference textbook — relational model, SQL, indexing, transactions, recovery. PDF + chapter summaries.",
    imageSeeds: ["kmutt-database-1", "kmutt-database-2"],
    tagNames: ["bestseller", "high-quality", "pro"],
    items: [{ delivery: "download", price: 650, qty: null, deliveryUrl: downloadUrl("Database-System-Concepts", "pdf") }],
    details: [
      { detailName: "Pages", detailValue: "1376" },
      { detailName: "Edition", detailValue: "7th" },
      { detailName: "Format", detailValue: "PDF (searchable)" },
    ],
  },
  {
    category: "E-books",
    name: "Operating System Concepts (Silberschatz, 10th Ed)",
    description: "Process management, scheduling, memory, file systems, security. Required reading for CPE231.",
    imageSeeds: ["kmutt-os-1", "kmutt-os-2"],
    tagNames: ["pro", "high-quality"],
    items: [{ delivery: "download", price: 700, qty: null, deliveryUrl: downloadUrl("Operating-System-Concepts", "pdf") }],
    details: [
      { detailName: "Pages", detailValue: "944" },
      { detailName: "Format", detailValue: "PDF + ePub" },
    ],
  },
  {
    category: "E-books",
    name: "Computer Networks (Tanenbaum, 6th Ed)",
    description: "Layered model from physical to application — Ethernet, TCP/IP, HTTP/3, BGP. Network labs included.",
    imageSeeds: ["kmutt-network-1", "kmutt-network-2"],
    tagNames: ["pro", "bestseller"],
    items: [{ delivery: "download", price: 620, qty: null, deliveryUrl: downloadUrl("Computer-Networks", "pdf") }],
  },
  {
    category: "E-books",
    name: "Calculus 1 — KMUTT Lecture Notes",
    description: "MATH101 lecture compilation by KMUTT Math Dept. Limits, derivatives, integration, applications.",
    imageSeeds: ["kmutt-calc-1", "kmutt-calc-2"],
    tagNames: ["beginner-friendly", "minimal"],
    items: [{ delivery: "download", price: 180, qty: null, discountPercent: 15, deliveryUrl: downloadUrl("Calculus-1-Lecture-Notes", "pdf") }],
  },
  {
    category: "E-books",
    name: "CPE241 Lab Workbook 2026",
    description: "Hands-on database labs — schema design, normalisation, joins, triggers, transactions. Solutions included.",
    imageSeeds: ["kmutt-cpe241-1", "kmutt-cpe241-2"],
    tagNames: ["new-release", "beginner-friendly"],
    items: [{ delivery: "download", price: 220, qty: null, deliveryUrl: downloadUrl("CPE241-Lab-Workbook", "pdf") }],
  },
  {
    category: "E-books",
    name: "Physics for Engineers (KMUTT Edition)",
    description: "Mechanics, thermodynamics, electromagnetism, optics. Worked examples + past final exams.",
    imageSeeds: ["kmutt-physics-1", "kmutt-physics-2"],
    tagNames: ["high-quality", "pro"],
    items: [{ delivery: "download", price: 580, qty: null, deliveryUrl: downloadUrl("Physics-for-Engineers", "pdf") }],
  },
  {
    category: "Templates",
    name: "KMUTT Student Planner 2026 (Printable)",
    description: "Weekly + monthly + semester planner, exam schedule template, GPA tracker. Print or fill digitally.",
    imageSeeds: ["kmutt-planner-1", "kmutt-planner-2"],
    tagNames: ["minimal", "new-release"],
    items: [{ delivery: "download", price: 120, qty: null, deliveryUrl: downloadUrl("KMUTT-Student-Planner-2026", "pdf") }],
  },
  {
    category: "Templates",
    name: "Engineering Drawing Templates (A3 + A4)",
    description: "Title blocks, dimensioning sheets, isometric grids. AutoCAD .dwg + .pdf bundled.",
    imageSeeds: ["kmutt-drawing-1", "kmutt-drawing-2"],
    tagNames: ["pro", "commercial-use"],
    items: [{ delivery: "download", price: 250, qty: null, deliveryUrl: downloadUrl("Engineering-Drawing-Templates", "zip") }],
  },
];

const ADO_SHOP: ProductDef[] = [
  // Streaming = official YouTube links. Bought "ticket" gives the
  // buyer the URL on the order page after payment.
  {
    category: "Stock Music",
    name: "Ado — Usseewa (Single)",
    description: "The breakout single. 4-minute streaming access via official Ado YouTube channel.",
    imageSeeds: ["ado-usseewa-1", "ado-usseewa-2"],
    tagNames: ["bestseller", "high-quality"],
    items: [{ delivery: "streaming", price: 69, qty: null, deliveryUrl: "https://www.youtube.com/watch?v=ar7uIDpDjMI" }],
  },
  {
    category: "Stock Music",
    name: "Ado — Yoru no Pierrot (Single)",
    description: "Night Pierrot — moody piano-led single, streaming access via official Ado YouTube channel.",
    imageSeeds: ["ado-yoru-1", "ado-yoru-2"],
    tagNames: ["high-quality"],
    items: [{ delivery: "streaming", price: 69, qty: null, deliveryUrl: "https://www.youtube.com/watch?v=DOY_AVlH7XU" }],
  },
  {
    category: "Stock Music",
    name: "Ado — Show (Album, 14 tracks)",
    description: "Second album. 14 tracks including Show, Aishite Aishite Aishite, Backlight. YouTube full-album playlist.",
    imageSeeds: ["ado-show-1", "ado-show-2"],
    tagNames: ["premium", "new-release", "bestseller"],
    items: [{ delivery: "streaming", price: 299, qty: null, deliveryUrl: "https://www.youtube.com/playlist?list=PLqxsFv8VxVgKbVlhwlGcK6yPwfg2gP_yp" }],
    details: [
      { detailName: "Tracks", detailValue: "14" },
      { detailName: "Runtime", detailValue: "57:42" },
    ],
  },
  {
    category: "Stock Music",
    name: "Ado — Kura Kura (Spy x Family OP)",
    description: "Opening theme for Spy x Family Season 1. Official streaming via Ado YouTube.",
    imageSeeds: ["ado-kurakura-1", "ado-kurakura-2"],
    tagNames: ["bestseller", "thai-style"],
    items: [{ delivery: "streaming", price: 69, qty: null, deliveryUrl: "https://www.youtube.com/watch?v=mYjMcwjQGAQ" }],
  },
  {
    category: "Stock Music",
    name: "Ado — Wish (One Piece Film: Red)",
    description: "Theme song from One Piece Film: Red. Live performance + studio mix bundled streaming.",
    imageSeeds: ["ado-wish-1", "ado-wish-2"],
    tagNames: ["premium", "high-quality"],
    items: [{ delivery: "streaming", price: 89, qty: null, deliveryUrl: "https://www.youtube.com/watch?v=qVIfd1ZJB1k" }],
  },
  {
    category: "Photography",
    name: "Ado Tour 2024 — Backstage Photobook",
    description: "120-page digital photobook from the Wish Tour. Rehearsals, stage rigging, costume design.",
    imageSeeds: ["ado-photobook-1", "ado-photobook-2"],
    tagNames: ["premium", "high-quality"],
    items: [{ delivery: "download", price: 450, qty: null, deliveryUrl: downloadUrl("Ado-Tour-2024-Photobook", "pdf") }],
  },
  {
    category: "E-books",
    name: "Ado — Vocal Range Reference Notes",
    description: "Annotated vocal range chart + breath markers from Ado's published songs. For vocal coaches + cover artists.",
    imageSeeds: ["ado-vocal-1", "ado-vocal-2"],
    tagNames: ["pro", "minimal"],
    items: [{ delivery: "download", price: 320, qty: null, deliveryUrl: downloadUrl("Ado-Vocal-Range-Notes", "pdf") }],
  },
];

const SHONEN_JUMP: ProductDef[] = [
  {
    category: "E-books",
    name: "One Piece Vol. 100",
    description: "The 100-volume milestone of Oda's epic. Wano arc climax. 200+ pages, digital edition.",
    imageSeeds: ["onepiece-100-1", "onepiece-100-2"],
    tagNames: ["bestseller", "high-quality"],
    items: [{ delivery: "download", price: 180, qty: null, deliveryUrl: downloadUrl("One-Piece-Vol-100", "pdf") }],
  },
  {
    category: "E-books",
    name: "Jujutsu Kaisen Vol. 23",
    description: "Gege Akutami's modern shonen masterpiece. Shibuya aftermath, Culling Game. Digital edition.",
    imageSeeds: ["jjk-23-1", "jjk-23-2"],
    tagNames: ["bestseller", "new-release"],
    items: [{ delivery: "download", price: 180, qty: null, deliveryUrl: downloadUrl("Jujutsu-Kaisen-Vol-23", "pdf") }],
  },
  {
    category: "E-books",
    name: "Chainsaw Man Vol. 11",
    description: "Fujimoto's chaotic devil-hunter saga continues. Public Safety vs the new Chainsaw Devil.",
    imageSeeds: ["csm-11-1", "csm-11-2"],
    tagNames: ["bestseller", "premium"],
    items: [{ delivery: "download", price: 180, qty: null, deliveryUrl: downloadUrl("Chainsaw-Man-Vol-11", "pdf") }],
  },
  {
    category: "E-books",
    name: "My Hero Academia Vol. 38",
    description: "The final war arc accelerates. Deku vs Shigaraki rematch teased.",
    imageSeeds: ["mha-38-1", "mha-38-2"],
    tagNames: ["bestseller"],
    items: [{ delivery: "download", price: 180, qty: null, deliveryUrl: downloadUrl("My-Hero-Academia-Vol-38", "pdf") }],
  },
  {
    category: "E-books",
    name: "Demon Slayer Vol. 21",
    description: "The fight against Muzan reaches its conclusion. Final-arc volume with bonus epilogue chapters.",
    imageSeeds: ["ds-21-1", "ds-21-2"],
    tagNames: ["bestseller", "high-quality"],
    items: [{ delivery: "download", price: 180, qty: null, deliveryUrl: downloadUrl("Demon-Slayer-Vol-21", "pdf") }],
  },
  {
    category: "E-books",
    name: "Naruto Vol. 72 (Final Volume)",
    description: "The conclusion of Kishimoto's saga. Naruto and Sasuke's final showdown.",
    imageSeeds: ["naruto-72-1", "naruto-72-2"],
    tagNames: ["bestseller", "high-quality"],
    items: [{ delivery: "download", price: 220, qty: null, deliveryUrl: downloadUrl("Naruto-Vol-72-Final", "pdf") }],
  },
  {
    category: "E-books",
    name: "Bleach: Thousand-Year Blood War Vol. 74",
    description: "TYBW final arc volume — Ichigo's last confrontation with Yhwach. Includes deleted-scene panels.",
    imageSeeds: ["bleach-74-1", "bleach-74-2"],
    tagNames: ["bestseller", "premium"],
    items: [{ delivery: "download", price: 200, qty: null, deliveryUrl: downloadUrl("Bleach-TYBW-Vol-74", "pdf") }],
  },
];

const MACROHARD: ProductDef[] = [
  {
    category: "Plug-ins",
    name: "Microsoft Office 2025 Pro Plus (Lifetime Key)",
    description: "Word, Excel, PowerPoint, Outlook, OneNote — lifetime activation key. Bind to one Microsoft account.",
    imageSeeds: ["macrohard-office-1", "macrohard-office-2"],
    tagNames: ["bestseller", "premium", "commercial-use"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 2990, qty: null, keyTemplate: "OFFICE-XXXX-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Windows 11 Pro Activation Key",
    description: "Genuine retail-grade activation. Pro edition — BitLocker, Remote Desktop, Hyper-V included.",
    imageSeeds: ["macrohard-win11-1", "macrohard-win11-2"],
    tagNames: ["bestseller", "high-quality"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 890, qty: null, keyTemplate: "WIN11-XXXX-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Visual Studio 2025 Professional",
    description: "Full IDE with IntelliCode, Live Share, integrated profiler, Azure tooling. Single-user license.",
    imageSeeds: ["macrohard-vs2025-1", "macrohard-vs2025-2"],
    tagNames: ["pro", "premium"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 3990, qty: null, keyTemplate: "VS2025-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Microsoft Teams Premium (Lifetime)",
    description: "Unlimited meeting length, AI meeting recap, advanced webinar tools. One-time payment.",
    imageSeeds: ["macrohard-teams-1", "macrohard-teams-2"],
    tagNames: ["new-release", "premium"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 1490, qty: null, keyTemplate: "TEAMS-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Outlook 365 Premium Add-On",
    description: "Custom domain email + 100GB OneDrive + advanced spam filtering. 12-month subscription key.",
    imageSeeds: ["macrohard-outlook-1", "macrohard-outlook-2"],
    tagNames: ["minimal", "pro"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 790, qty: null, keyTemplate: "OUTLOOK-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Microsoft Project Pro 2025",
    description: "Gantt, resource levelling, baseline tracking, Power BI export. Single-machine license.",
    imageSeeds: ["macrohard-project-1", "macrohard-project-2"],
    tagNames: ["pro", "premium"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 2490, qty: null, keyTemplate: "PROJECT-XXXX-XXXX-XXXX" }],
  },
  {
    category: "Plug-ins",
    name: "Visio 2025 Standard",
    description: "Diagrams, flowcharts, network maps, BPMN. AutoCAD import + Visio web app.",
    imageSeeds: ["macrohard-visio-1", "macrohard-visio-2"],
    tagNames: ["minimal", "commercial-use"],
    isStackable: true,
    items: [{ delivery: "license_key", price: 1290, qty: null, keyTemplate: "VISIO-XXXX-XXXX-XXXX" }],
  },
];

const CATALOGUES: StoreCatalog[] = [
  { storeName: "KMUTT BOOK STORE", products: KMUTT_BOOKS },
  { storeName: "Ado Official Music Shop", products: ADO_SHOP },
  { storeName: "Shonen Jump", products: SHONEN_JUMP },
  { storeName: "Macrohard", products: MACROHARD },
];

// ────────────────────────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();

  // Resolve store IDs by name (case-insensitive). Bail if any of the
  // 4 stores isn't there — the script is targeted, not a creator.
  const allStores = await prisma.store.findMany({
    select: { storeId: true, name: true },
  });
  const storeByName = new Map(
    allStores.map((s) => [s.name.toLowerCase(), s.storeId] as const),
  );

  // Build category + tag lookups in one round-trip each.
  const allCats = await prisma.category.findMany({
    select: { categoryId: true, categoryName: true },
  });
  const catId = new Map(allCats.map((c) => [c.categoryName, c.categoryId] as const));

  const allTags = await prisma.productTag.findMany({
    select: { tagId: true, tagName: true },
  });
  const tagId = new Map(allTags.map((t) => [t.tagName.toLowerCase(), t.tagId] as const));

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalUnknownStore = 0;
  let totalUnknownCategory = 0;

  for (const cat of CATALOGUES) {
    const sid = storeByName.get(cat.storeName.toLowerCase());
    if (!sid) {
      console.warn(`⚠ Store "${cat.storeName}" not found, skipping ${cat.products.length} products.`);
      totalUnknownStore += cat.products.length;
      continue;
    }
    console.log(`\n── ${cat.storeName} (storeId=${sid}) ──`);

    for (const def of cat.products) {
      const cid = catId.get(def.category);
      if (!cid) {
        console.warn(`  ⚠ Unknown category "${def.category}" for "${def.name}", skipping.`);
        totalUnknownCategory++;
        continue;
      }
      const existing = await prisma.product.findFirst({
        where: { storeId: sid, name: def.name },
        select: { productId: true },
      });
      if (existing) {
        totalSkipped++;
        continue;
      }

      const productDelivery = def.items[0]!.delivery;
      const isStackable =
        def.isStackable ??
        (productDelivery === "license_key" ? false : true);

      // Resolve tagIds; missing tag names get auto-created on the
      // fly so the script doesn't fail on a typo.
      const resolvedTagIds: number[] = [];
      for (const t of def.tagNames) {
        const key = t.toLowerCase();
        const existingId = tagId.get(key);
        if (existingId) {
          resolvedTagIds.push(existingId);
          continue;
        }
        const created = await prisma.productTag.create({
          data: { tagName: key, tagDescription: `Tag: ${key}` },
          select: { tagId: true, tagName: true },
        });
        tagId.set(created.tagName.toLowerCase(), created.tagId);
        resolvedTagIds.push(created.tagId);
      }

      const product = await prisma.product.create({
        data: {
          storeId: sid,
          categoryId: cid,
          name: def.name,
          description: def.description,
          deliveryMethod: productDelivery,
          isStackable,
          images: {
            create: def.imageSeeds.map((seed, i) => ({
              productImage: `https://picsum.photos/seed/${seed}/1200/800`,
              sortOrder: i,
            })),
          },
          items: {
            create: def.items.map((it, idx) => {
              const variantName =
                def.items.length > 1
                  ? `${def.name} — ${it.name ?? `Variant ${idx + 1}`}`.slice(0, 100)
                  : def.name.slice(0, 100);
              const discountPercent = it.discountPercent ?? 0;
              return {
                name: variantName,
                deliveryMethod: it.delivery,
                quantity: it.qty,
                price: new Prisma.Decimal(it.price),
                discountPercent,
                discountAmount: new Prisma.Decimal(
                  Math.round(it.price * discountPercent) / 100,
                ),
                deliveryUrl:
                  it.deliveryUrl ??
                  (it.delivery === "download" || it.delivery === "streaming"
                    ? downloadUrl(def.name, "zip")
                    : null),
                licenseKeyTemplate:
                  it.delivery === "license_key"
                    ? it.keyTemplate ?? "METU-XXXX-XXXX-XXXX"
                    : null,
              };
            }),
          },
          productNTags: {
            create: resolvedTagIds.map((tid) => ({ tagId: tid })),
          },
          details: {
            create: (def.details ?? []).map((d) => ({
              detailName: d.detailName,
              detailValue: d.detailValue,
            })),
          },
        },
      });
      totalCreated++;
      console.log(`  + ${def.category.padEnd(15)} ${product.name}`);
    }
  }

  console.log(
    `\n✓ ${totalCreated} new product(s) across ${CATALOGUES.length} stores · ${totalSkipped} already existed.`,
  );
  if (totalUnknownStore > 0) {
    console.log(`⚠ ${totalUnknownStore} skipped because their store wasn't found.`);
  }
  if (totalUnknownCategory > 0) {
    console.log(`⚠ ${totalUnknownCategory} skipped because their category wasn't found.`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
