/**
 * Phase 45 follow-up — populate [redacted-user]'s store ("Aurora Creative Lab",
 * store_id=6) with a wide product catalogue covering all 10 categories
 * and all 4 delivery methods, plus rename the store from "Test store"
 * and add profile + cover images.
 *
 * Idempotent — re-running skips products whose name already exists in
 * the store, so it's safe to run multiple times.
 *
 * Run locally: `tsx scripts/seed-aurora-store.mts`
 *  (reads DATABASE_URL from .supabase-credentials.local, same pattern
 *   as seed-stripe-accounts.mts and check-stripe-status.mts)
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

const STORE_ID = 6; // [redacted-user]'s store

type Delivery = "download" | "streaming" | "license_key" | "email";
interface Variant {
  name: string;
  delivery: Delivery;
  price: number;
  qty: number;
  discountPercent?: number;
}
interface ProductDef {
  category: string; // category_name
  name: string;
  description: string;
  imageSeeds: string[];
  tagNames: string[]; // 1-4 tags
  items: Variant[]; // 1-2 variants
}

// Helper to build a URL-safe slug for sample/delivery URLs.
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const samplePreviewExt = (cat: string): string => {
  switch (cat) {
    case "Stock Music":
      return "mp3";
    case "Photography":
    case "Illustrations":
    case "Fonts":
    case "Templates":
      return "jpg";
    case "3D Models":
      return "glb";
    case "Game Assets":
      return "zip";
    case "Online Courses":
      return "mp4";
    case "E-books":
      return "pdf";
    case "Plug-ins":
      return "zip";
    default:
      return "pdf";
  }
};

// ───────────────────────────────────────────────────────────
// 30 products = 3 per category. Mix of delivery methods so all
// 4 (download / streaming / license_key / email) show up.
// ───────────────────────────────────────────────────────────
const CATALOG: ProductDef[] = [
  // ── 3D Models (3) ─────────────────────────
  {
    category: "3D Models",
    name: "Lo-fi Bedroom Diorama",
    description:
      "Cozy isometric room scene with 40+ props — desk, neon signs, plants. Blender + GLB export, ready for renders or game backgrounds.",
    imageSeeds: ["lofi-bedroom-1", "lofi-bedroom-2"],
    tagNames: ["minimal", "high-quality", "bestseller"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999, discountPercent: 15 },
    ],
  },
  {
    category: "3D Models",
    name: "Cyberpunk Street Lamp Set",
    description:
      "Six neon-lit street lamp variations for sci-fi scenes. PBR textures, LOD meshes, tested in Unity + Unreal.",
    imageSeeds: ["cyberpunk-lamp-1", "cyberpunk-lamp-2"],
    tagNames: ["pro", "dark-mode", "commercial-use"],
    items: [
      { name: "Standard", delivery: "download", price: 390, qty: 999 },
    ],
  },
  {
    category: "3D Models",
    name: "Thai Temple Roof Modular Pack",
    description:
      "Modular Thai temple architecture — gables, garudas, naga finials. Snaps together for fast scene composition.",
    imageSeeds: ["thai-temple-1", "thai-temple-2"],
    tagNames: ["thai-style", "premium", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 590, qty: 999 },
    ],
  },

  // ── Online Courses (3) ────────────────────
  {
    category: "Online Courses",
    name: "After Effects Motion Mastery",
    description:
      "12 hours of project-based motion graphics. From shape layers to expressions to character rigging. English + Thai subtitles.",
    imageSeeds: ["ae-mastery-1", "ae-mastery-2"],
    tagNames: ["bestseller", "premium", "pro"],
    items: [
      { name: "Standard", delivery: "streaming", price: 1290, qty: 999 },
    ],
  },
  {
    category: "Online Courses",
    name: "Blender Beginner Path",
    description:
      "Zero-to-confident in 30 days. Modeling, shading, lighting, animation. No prior 3D experience needed.",
    imageSeeds: ["blender-beginner-1", "blender-beginner-2"],
    tagNames: ["beginner", "beginner-friendly", "new-release"],
    items: [
      { name: "Standard", delivery: "streaming", price: 690, qty: 999, discountPercent: 25 },
    ],
  },
  {
    category: "Online Courses",
    name: "Unreal Engine Combat AI",
    description:
      "Build a melee combat AI from scratch. Behavior trees, blackboards, perception, animation blending. UE5.4-ready.",
    imageSeeds: ["unreal-ai-1", "unreal-ai-2"],
    tagNames: ["pro", "premium", "high-quality"],
    items: [
      { name: "Standard", delivery: "streaming", price: 1590, qty: 999 },
    ],
  },

  // ── E-books (3) ───────────────────────────
  {
    category: "E-books",
    name: "The Bangkok Designer's Handbook",
    description:
      "180-page guide to running a freelance design practice in Thailand. Pricing, contracts, taxes, working with foreign clients.",
    imageSeeds: ["bkk-designer-1", "bkk-designer-2"],
    tagNames: ["thai-style", "new-release", "premium"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999 },
    ],
  },
  {
    category: "E-books",
    name: "UI Patterns for SaaS Apps",
    description:
      "120 battle-tested UI patterns annotated with WHY they work. Covers onboarding, billing, empty states, error recovery.",
    imageSeeds: ["ui-patterns-1", "ui-patterns-2"],
    tagNames: ["premium", "bestseller", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 390, qty: 999, discountPercent: 20 },
    ],
  },
  {
    category: "E-books",
    name: "Color Theory for Game Devs",
    description:
      "Practical color guide for indie game artists. Hue/value/saturation, palette generation, accessibility, mood mapping.",
    imageSeeds: ["color-theory-1", "color-theory-2"],
    tagNames: ["beginner", "high-quality"],
    items: [
      { name: "Standard", delivery: "email", price: 190, qty: 999 },
    ],
  },

  // ── Stock Music (3) ───────────────────────
  {
    category: "Stock Music",
    name: "Lo-fi Chill Pack Vol. 1",
    description:
      "20 royalty-free lo-fi tracks for streams, vlogs, study videos. Each track in WAV + MP3, looped + stem versions included.",
    imageSeeds: ["lofi-chill-1", "lofi-chill-2"],
    tagNames: ["royalty-free", "no-attribution", "bestseller"],
    items: [
      { name: "Standard", delivery: "download", price: 490, qty: 999 },
    ],
  },
  {
    category: "Stock Music",
    name: "Cinematic Trailer Tools",
    description:
      "Booms, risers, reverses, hits, drones. Mixed-and-mastered for trailer use. 64 stems, 96kHz/24-bit.",
    imageSeeds: ["cinematic-trailer-1", "cinematic-trailer-2"],
    tagNames: ["premium", "commercial-use", "pro"],
    items: [
      { name: "Standard", delivery: "download", price: 890, qty: 999 },
    ],
  },
  {
    category: "Stock Music",
    name: "Thai Folk Sample Pack",
    description:
      "Live-recorded khim, ranat, klong yao, plus FX layers. 200 samples. Perfect for Thai-flavoured film and game scores.",
    imageSeeds: ["thai-folk-1", "thai-folk-2"],
    tagNames: ["thai-style", "royalty-free", "premium"],
    items: [
      { name: "Standard", delivery: "download", price: 690, qty: 999 },
    ],
  },

  // ── Fonts (3) ─────────────────────────────
  {
    category: "Fonts",
    name: "Anuwat Sans Pro",
    description:
      "Modern Thai/Latin display sans designed for headlines and editorial layouts. 6 weights, OpenType features, Thai punctuation pairs.",
    imageSeeds: ["anuwat-sans-1", "anuwat-sans-2"],
    tagNames: ["thai-style", "premium", "high-quality"],
    items: [
      { name: "Standard", delivery: "license_key", price: 590, qty: 999 },
    ],
  },
  {
    category: "Fonts",
    name: "Krung Display Bold",
    description:
      "All-caps display face with extreme x-height. Latin only. Comes with 4 alternates and a stylistic ligature set.",
    imageSeeds: ["krung-display-1", "krung-display-2"],
    tagNames: ["premium", "bestseller"],
    items: [
      { name: "Standard", delivery: "license_key", price: 390, qty: 999, discountPercent: 30 },
    ],
  },
  {
    category: "Fonts",
    name: "Pixel Perfect Mono",
    description:
      "Pixel-grid monospaced font — ideal for code editors, retro UIs, and game dialogue boxes. Latin + cyrillic.",
    imageSeeds: ["pixel-mono-1", "pixel-mono-2"],
    tagNames: ["retro", "royalty-free", "minimal"],
    items: [
      { name: "Standard", delivery: "download", price: 190, qty: 999 },
    ],
  },

  // ── Templates (3) ─────────────────────────
  {
    category: "Templates",
    name: "Notion Productivity Suite",
    description:
      "12 interlinked Notion templates — daily journal, weekly review, project tracker, content calendar. Teams of any size.",
    imageSeeds: ["notion-suite-1", "notion-suite-2"],
    tagNames: ["bestseller", "minimal", "light-mode"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999, discountPercent: 10 },
    ],
  },
  {
    category: "Templates",
    name: "Figma Mobile App Kit",
    description:
      "120 mobile screens across 10 industries. Auto-layout components, design tokens, dark + light theme. Figma 2025 file.",
    imageSeeds: ["figma-mobile-1", "figma-mobile-2"],
    tagNames: ["minimal", "premium", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 690, qty: 999 },
    ],
  },
  {
    category: "Templates",
    name: "Google Slides Brand Pack",
    description:
      "60 fully editable slide templates for pitches, reports, and client decks. Brand-on-the-fly with master colour swap.",
    imageSeeds: ["slides-brand-1", "slides-brand-2"],
    tagNames: ["light-mode", "commercial-use"],
    items: [
      { name: "Standard", delivery: "download", price: 390, qty: 999 },
    ],
  },

  // ── Game Assets (3) ───────────────────────
  {
    category: "Game Assets",
    name: "2D Pixel Hero Pack",
    description:
      "8 pixel-art hero characters with 12-frame run, attack, idle, jump animations. PNG sequence + Aseprite + sprite sheet.",
    imageSeeds: ["pixel-hero-1", "pixel-hero-2"],
    tagNames: ["retro", "beginner-friendly", "royalty-free"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999 },
    ],
  },
  {
    category: "Game Assets",
    name: "RPG UI Bundle",
    description:
      "120 UI elements for fantasy RPGs — health bars, inventory tiles, dialogue frames, skill trees. Vector + raster exports.",
    imageSeeds: ["rpg-ui-1", "rpg-ui-2"],
    tagNames: ["pro", "dark-mode", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 490, qty: 999 },
    ],
  },
  {
    category: "Game Assets",
    name: "Sci-Fi Combat SFX",
    description:
      "240 sci-fi combat sound effects — laser, plasma, shield hit, explosion. Categorised + tagged for fast searching.",
    imageSeeds: ["scifi-sfx-1", "scifi-sfx-2"],
    tagNames: ["royalty-free", "commercial-use"],
    items: [
      { name: "Standard", delivery: "download", price: 590, qty: 999 },
    ],
  },

  // ── Photography (3) ───────────────────────
  {
    category: "Photography",
    name: "Bangkok Streets Collection",
    description:
      "120 high-res street photographs of Bangkok — Yaowarat, Chinatown, Thonburi soi, BTS golden hour. Royalty-free.",
    imageSeeds: ["bkk-streets-1", "bkk-streets-2"],
    tagNames: ["thai-style", "royalty-free", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 390, qty: 999 },
    ],
  },
  {
    category: "Photography",
    name: "Minimal Aesthetic Set",
    description:
      "60 negative-space lifestyle photos — coffee, ceramics, linen, dried flowers. Perfect for brand decks and blogs.",
    imageSeeds: ["minimal-set-1", "minimal-set-2"],
    tagNames: ["minimal", "light-mode", "commercial-use"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999, discountPercent: 20 },
    ],
  },
  {
    category: "Photography",
    name: "Dark Moody Portraits",
    description:
      "40 cinematic portrait shots — chiaroscuro lighting, raw tones, model-released. Includes RAW + edited JPEGs.",
    imageSeeds: ["dark-portraits-1", "dark-portraits-2"],
    tagNames: ["premium", "dark-mode", "pro"],
    items: [
      { name: "Standard", delivery: "email", price: 690, qty: 999 },
    ],
  },

  // ── Plug-ins (3) ──────────────────────────
  {
    category: "Plug-ins",
    name: "FigPlugin: Auto-Layout Helper",
    description:
      "Figma plugin that fixes nested auto-layout in one click. Repairs constraints, normalises spacing, exports to design tokens.",
    imageSeeds: ["figplugin-1", "figplugin-2"],
    tagNames: ["premium", "pro", "new-release"],
    items: [
      { name: "Standard", delivery: "license_key", price: 290, qty: 999 },
    ],
  },
  {
    category: "Plug-ins",
    name: "VS Code Theme Switcher",
    description:
      "Time-aware theme switcher for VS Code — light by day, dark by night. Customisable schedule, OS-aware fallback.",
    imageSeeds: ["vscode-switch-1", "vscode-switch-2"],
    tagNames: ["dark-mode", "minimal"],
    items: [
      { name: "Standard", delivery: "license_key", price: 90, qty: 999 },
    ],
  },
  {
    category: "Plug-ins",
    name: "Photoshop Action Pack",
    description:
      "60 production-grade Photoshop actions — colour grading, retouching, batch export. Tested on PS 2024 and 2025.",
    imageSeeds: ["ps-actions-1", "ps-actions-2"],
    tagNames: ["commercial-use", "high-quality"],
    items: [
      { name: "Standard", delivery: "license_key", price: 390, qty: 999, discountPercent: 15 },
    ],
  },

  // ── Illustrations (3) ─────────────────────
  {
    category: "Illustrations",
    name: "Hand-drawn Café Set",
    description:
      "80 hand-drawn café-themed illustrations — coffee, pastries, mugs, latte art. Vector SVG + transparent PNG.",
    imageSeeds: ["cafe-set-1", "cafe-set-2"],
    tagNames: ["minimal", "light-mode", "royalty-free"],
    items: [
      { name: "Standard", delivery: "download", price: 290, qty: 999 },
    ],
  },
  {
    category: "Illustrations",
    name: "Cyberpunk Character Lineup",
    description:
      "30 fully rendered cyberpunk characters in 3/4 view. Hooded ronin, netrunner, fixer, samurai. PSD + PNG.",
    imageSeeds: ["cyber-chars-1", "cyber-chars-2"],
    tagNames: ["dark-mode", "premium", "high-quality"],
    items: [
      { name: "Standard", delivery: "download", price: 590, qty: 999 },
    ],
  },
  {
    category: "Illustrations",
    name: "Thai Street Vendor Sketches",
    description:
      "50 watercolour-style sketches of Bangkok street vendors — pad thai, somtam, mango sticky rice. Print-ready.",
    imageSeeds: ["vendor-sketches-1", "vendor-sketches-2"],
    tagNames: ["thai-style", "minimal", "new-release"],
    items: [
      { name: "Standard", delivery: "download", price: 390, qty: 999 },
    ],
  },
];

// ───────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  // 1. Rename + image the store.
  const store = await prisma.store.update({
    where: { storeId: STORE_ID },
    data: {
      name: "Aurora Creative Lab",
      description:
        "Premium digital assets handcrafted by Bangkok-based creators — fonts, templates, illustrations, audio, 3D, and more. Quality you can ship today.",
      profileImage:
        "https://api.dicebear.com/8.x/shapes/svg?seed=AuroraLab&backgroundColor=ffd24a",
      coverImage:
        "https://picsum.photos/seed/aurora-cover-lab/1600/500",
    },
  });
  console.log(`✓ Renamed store ${STORE_ID} → "${store.name}"`);

  // 2. Resolve category + tag id maps.
  const categories = await prisma.category.findMany();
  const catId = new Map(categories.map((c) => [c.categoryName, c.categoryId]));
  const tags = await prisma.productTag.findMany();
  const tagId = new Map(tags.map((t) => [t.tagName, t.tagId]));

  // 3. Add each product, skipping any whose name already lives in the store.
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
    const productDelivery = def.items[0].delivery;

    const product = await prisma.product.create({
      data: {
        storeId: STORE_ID,
        categoryId: cid,
        name: def.name,
        description: def.description,
        deliveryMethod: productDelivery,
        isStackable:
          productDelivery === "license_key" || productDelivery === "email"
            ? false
            : true,
        images: {
          create: def.imageSeeds.map((seed, i) => ({
            productImage: `https://picsum.photos/seed/${seed}/1200/800`,
            sortOrder: i,
          })),
        },
        items: {
          create: def.items.map((it, i) => {
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
                  ? `${def.name} — ${it.name}`.slice(0, 100)
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
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
