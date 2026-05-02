/**
 * Phase 47 follow-up — populate Bank's store ("Pixel Forge Bangkok",
 * formerly "Test store", store_id=5, owner [redacted])
 * with a wide game-dev/indie-flavoured catalogue covering all 10
 * categories and all 4 delivery methods, plus rename the store from
 * "Test store" and set profile + cover images.
 *
 * Distinct product names from seed-aurora-store.mts so the two
 * shops feel like different studios, not clones of each other.
 *
 * Idempotent — re-running skips products whose name already exists
 * in store 5.
 *
 * Run locally: tsx scripts/seed-pixelforge-store.mts
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

const STORE_ID = 5; // Bank's store

type Delivery = "download" | "streaming" | "license_key" | "email";
interface Variant {
  name: string;
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
// 30 game-dev / indie-flavoured products. Distinct names from
// the Aurora Creative Lab catalogue so the two stores don't
// look like duplicates.
// ───────────────────────────────────────────────────────────
const CATALOG: ProductDef[] = [
  // ── 3D Models ─────────────────────────────
  {
    category: "3D Models",
    name: "Sci-Fi Crate Megapack",
    description:
      "60 modular sci-fi crates, barrels, and storage props. PBR textures, optimised for Unity URP + Unreal Lumen.",
    imageSeeds: ["scifi-crate-1", "scifi-crate-2"],
    tagNames: ["pro", "high-quality", "commercial-use"],
    items: [{ name: "Standard", delivery: "download", price: 390, qty: 999 }],
  },
  {
    category: "3D Models",
    name: "Low-Poly Forest Set",
    description:
      "Stylised low-poly trees, rocks, mushrooms, and grass tufts. Ideal for cosy or fantasy game worlds.",
    imageSeeds: ["lowpoly-forest-1", "lowpoly-forest-2"],
    tagNames: ["minimal", "beginner-friendly", "royalty-free"],
    items: [{ name: "Standard", delivery: "download", price: 290, qty: 999, discountPercent: 20 }],
  },
  {
    category: "3D Models",
    name: "Asian Restaurant Interior",
    description:
      "Fully dressed izakaya interior — tables, lanterns, kitchen pass, props. Render-ready for stills or game scenes.",
    imageSeeds: ["asian-restaurant-1", "asian-restaurant-2"],
    tagNames: ["thai-style", "premium", "high-quality"],
    items: [{ name: "Standard", delivery: "download", price: 690, qty: 999 }],
  },

  // ── Online Courses ────────────────────────
  {
    category: "Online Courses",
    name: "Unity 2D Beginner Roadmap",
    description:
      "9-hour video roadmap to ship your first 2D Unity game. Tilemaps, physics, dialogue, save/load, build pipeline.",
    imageSeeds: ["unity2d-roadmap-1", "unity2d-roadmap-2"],
    tagNames: ["beginner", "beginner-friendly", "bestseller"],
    items: [{ name: "Standard", delivery: "streaming", price: 890, qty: 999 }],
  },
  {
    category: "Online Courses",
    name: "Godot 4 RPG Crash Course",
    description:
      "Build an action RPG in Godot 4 from scratch — combat, inventory, dialogue trees, save game, polish pass.",
    imageSeeds: ["godot4-rpg-1", "godot4-rpg-2"],
    tagNames: ["pro", "new-release", "high-quality"],
    items: [{ name: "Standard", delivery: "streaming", price: 1190, qty: 999, discountPercent: 15 }],
  },
  {
    category: "Online Courses",
    name: "Game Design Document Bootcamp",
    description:
      "Learn to write a GDD that publishers + investors actually read. Templates, examples, and review checklists.",
    imageSeeds: ["gdd-bootcamp-1", "gdd-bootcamp-2"],
    tagNames: ["beginner-friendly", "premium"],
    items: [{ name: "Standard", delivery: "streaming", price: 590, qty: 999 }],
  },

  // ── E-books ───────────────────────────────
  {
    category: "E-books",
    name: "Indie Game Marketing Playbook",
    description:
      "200-page playbook of pre-launch + post-launch tactics — wishlists, demos, press, content creators, pricing.",
    imageSeeds: ["indie-marketing-1", "indie-marketing-2"],
    tagNames: ["bestseller", "premium", "pro"],
    items: [{ name: "Standard", delivery: "download", price: 390, qty: 999 }],
  },
  {
    category: "E-books",
    name: "ECS Architecture Deep Dive",
    description:
      "Entity-component-system patterns explained with running code in Unity DOTS, Bevy, and a custom C++ engine.",
    imageSeeds: ["ecs-deepdive-1", "ecs-deepdive-2"],
    tagNames: ["pro", "high-quality"],
    items: [{ name: "Standard", delivery: "download", price: 290, qty: 999 }],
  },
  {
    category: "E-books",
    name: "Pixel Art Color Palettes Catalog",
    description:
      "120 hand-curated colour palettes for pixel artists — retro, neon, cottagecore, sci-fi. PNG + .pal exports.",
    imageSeeds: ["palette-catalog-1", "palette-catalog-2"],
    tagNames: ["retro", "minimal"],
    items: [{ name: "Standard", delivery: "email", price: 190, qty: 999 }],
  },

  // ── Stock Music ───────────────────────────
  {
    category: "Stock Music",
    name: "Chiptune Boss Battles Vol. 2",
    description:
      "16 boss-battle chiptune tracks across NES, SNES, Genesis-flavoured palettes. Loops + stems + WAV/MP3.",
    imageSeeds: ["chiptune-boss-1", "chiptune-boss-2"],
    tagNames: ["retro", "royalty-free", "bestseller"],
    items: [{ name: "Standard", delivery: "download", price: 490, qty: 999 }],
  },
  {
    category: "Stock Music",
    name: "Ambient Sci-Fi Soundscapes",
    description:
      "120 ambient sci-fi loops — labs, derelict ships, neon alleys, deep space. Suitable for film + game scenes.",
    imageSeeds: ["scifi-ambient-1", "scifi-ambient-2"],
    tagNames: ["dark-mode", "royalty-free", "pro"],
    items: [{ name: "Standard", delivery: "download", price: 690, qty: 999 }],
  },
  {
    category: "Stock Music",
    name: "Anime Combat Cinematic",
    description:
      "Orchestral + electric anime-style combat tracks. Built for trailers and high-energy boss sequences.",
    imageSeeds: ["anime-combat-1", "anime-combat-2"],
    tagNames: ["premium", "commercial-use"],
    items: [{ name: "Standard", delivery: "download", price: 590, qty: 999 }],
  },

  // ── Fonts ─────────────────────────────────
  {
    category: "Fonts",
    name: "Arcade Pixel Display",
    description:
      "All-caps pixel display face for arcade-feel UI and titles. 4 weights, Latin only, instant readability at small sizes.",
    imageSeeds: ["arcade-pixel-1", "arcade-pixel-2"],
    tagNames: ["retro", "premium"],
    items: [{ name: "Standard", delivery: "license_key", price: 290, qty: 999 }],
  },
  {
    category: "Fonts",
    name: "Manga Speech Headline",
    description:
      "Punchy display font modelled on shonen manga sound effects. Latin + katakana + bracket alternates.",
    imageSeeds: ["manga-speech-1", "manga-speech-2"],
    tagNames: ["premium", "high-quality"],
    items: [{ name: "Standard", delivery: "license_key", price: 390, qty: 999, discountPercent: 25 }],
  },
  {
    category: "Fonts",
    name: "Code Coder Mono",
    description:
      "Monospaced code-editor font with ligatures, programming symbols, true italics, and 3 stylistic alternates.",
    imageSeeds: ["code-mono-1", "code-mono-2"],
    tagNames: ["minimal", "royalty-free"],
    items: [{ name: "Standard", delivery: "download", price: 190, qty: 999 }],
  },

  // ── Templates ─────────────────────────────
  {
    category: "Templates",
    name: "Itch.io Game Page Template",
    description:
      "Pre-styled itch.io page template with HTML + CSS variants. Drop-in trailer + screenshots layout.",
    imageSeeds: ["itch-page-1", "itch-page-2"],
    tagNames: ["beginner-friendly", "minimal"],
    items: [{ name: "Standard", delivery: "download", price: 190, qty: 999 }],
  },
  {
    category: "Templates",
    name: "Steam Capsule Art Bundle",
    description:
      "Photoshop + Figma templates for every Steam capsule size — header, library, hero, broadcast. Layered.",
    imageSeeds: ["steam-capsule-1", "steam-capsule-2"],
    tagNames: ["premium", "commercial-use", "pro"],
    items: [{ name: "Standard", delivery: "download", price: 490, qty: 999 }],
  },
  {
    category: "Templates",
    name: "Discord Server Welcome Kit",
    description:
      "Banner + role icons + emote pack + bot welcome flow for indie game communities. Editable Figma + PNG.",
    imageSeeds: ["discord-welcome-1", "discord-welcome-2"],
    tagNames: ["new-release", "minimal"],
    items: [{ name: "Standard", delivery: "download", price: 290, qty: 999 }],
  },

  // ── Game Assets ───────────────────────────
  {
    category: "Game Assets",
    name: "Top-Down Dungeon Tileset",
    description:
      "32x32 pixel-art dungeon tileset — walls, floors, traps, doors, props. 800+ tiles + autotile rules.",
    imageSeeds: ["dungeon-tileset-1", "dungeon-tileset-2"],
    tagNames: ["retro", "bestseller", "royalty-free"],
    items: [{ name: "Standard", delivery: "download", price: 390, qty: 999 }],
  },
  {
    category: "Game Assets",
    name: "FPS Hands & Weapons Pack",
    description:
      "9 first-person weapon meshes + animated hands — pistol, rifle, shotgun, grenade. Modular attachments.",
    imageSeeds: ["fps-weapons-1", "fps-weapons-2"],
    tagNames: ["pro", "premium", "commercial-use"],
    items: [{ name: "Standard", delivery: "download", price: 690, qty: 999 }],
  },
  {
    category: "Game Assets",
    name: "Magic VFX Library Vol. 1",
    description:
      "120 stylised magic VFX prefabs — fire, ice, lightning, dark, holy. Drag-and-drop into Unity / Unreal.",
    imageSeeds: ["magic-vfx-1", "magic-vfx-2"],
    tagNames: ["high-quality", "dark-mode"],
    items: [{ name: "Standard", delivery: "download", price: 590, qty: 999 }],
  },

  // ── Photography ───────────────────────────
  {
    category: "Photography",
    name: "Cyberpunk Cityscape Refs",
    description:
      "180 high-res reference photos of neon-soaked Asian cityscapes — Tokyo, Bangkok, Hong Kong, Seoul.",
    imageSeeds: ["cyberpunk-refs-1", "cyberpunk-refs-2"],
    tagNames: ["dark-mode", "thai-style", "high-quality"],
    items: [{ name: "Standard", delivery: "download", price: 390, qty: 999 }],
  },
  {
    category: "Photography",
    name: "Anime Convention Snapshots",
    description:
      "60 candid anime-convention shots — booths, cosplay, crowd shots. Model-released, royalty-free.",
    imageSeeds: ["anime-conv-1", "anime-conv-2"],
    tagNames: ["royalty-free", "commercial-use"],
    items: [{ name: "Standard", delivery: "download", price: 290, qty: 999 }],
  },
  {
    category: "Photography",
    name: "Workshop Tools Macro Set",
    description:
      "40 close-up macro shots of workshop tools — soldering iron, pliers, oscilloscope, breadboards.",
    imageSeeds: ["workshop-macro-1", "workshop-macro-2"],
    tagNames: ["premium", "pro"],
    items: [{ name: "Standard", delivery: "email", price: 490, qty: 999 }],
  },

  // ── Plug-ins ──────────────────────────────
  {
    category: "Plug-ins",
    name: "Unity Save Slot Manager",
    description:
      "Drop-in save-slot system for Unity — three slots, async, versioned, encrypted. Includes UI prefab.",
    imageSeeds: ["unity-save-1", "unity-save-2"],
    tagNames: ["pro", "high-quality", "commercial-use"],
    items: [{ name: "Standard", delivery: "license_key", price: 390, qty: 999 }],
  },
  {
    category: "Plug-ins",
    name: "Aseprite Auto-Tile Helper",
    description:
      "Aseprite extension that previews 47-tile autotile rules in real time. Saves hours per dungeon tileset.",
    imageSeeds: ["aseprite-autotile-1", "aseprite-autotile-2"],
    tagNames: ["new-release", "pro"],
    items: [{ name: "Standard", delivery: "license_key", price: 190, qty: 999 }],
  },
  {
    category: "Plug-ins",
    name: "Krita Game Dev Brush Pack",
    description:
      "60 Krita brushes optimised for indie game art — pixel, painterly, gradient, splatter, stamp shapes.",
    imageSeeds: ["krita-brushes-1", "krita-brushes-2"],
    tagNames: ["bestseller", "minimal"],
    items: [{ name: "Standard", delivery: "license_key", price: 290, qty: 999, discountPercent: 10 }],
  },

  // ── Illustrations ─────────────────────────
  {
    category: "Illustrations",
    name: "Chibi Heroes Mega-Set",
    description:
      "60 chibi-style hero illustrations — fantasy, sci-fi, modern. Vector SVG + transparent PNG, customisable.",
    imageSeeds: ["chibi-heroes-1", "chibi-heroes-2"],
    tagNames: ["minimal", "high-quality", "bestseller"],
    items: [{ name: "Standard", delivery: "download", price: 390, qty: 999 }],
  },
  {
    category: "Illustrations",
    name: "Gritty Sci-Fi Splash Pack",
    description:
      "30 painted splash artworks — mech battles, ruined cities, cyber operatives. Print-ready 300 dpi.",
    imageSeeds: ["scifi-splash-1", "scifi-splash-2"],
    tagNames: ["dark-mode", "premium", "pro"],
    items: [{ name: "Standard", delivery: "download", price: 590, qty: 999 }],
  },
  {
    category: "Illustrations",
    name: "Thai Mythical Creature Series",
    description:
      "20 hand-drawn Thai mythological creatures — naga, garuda, kinnari. Lined art + flat color + fully shaded.",
    imageSeeds: ["thai-myth-1", "thai-myth-2"],
    tagNames: ["thai-style", "high-quality", "new-release"],
    items: [{ name: "Standard", delivery: "download", price: 490, qty: 999 }],
  },
];

// ───────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  // 1. Rename + image the store.
  const store = await prisma.store.update({
    where: { storeId: STORE_ID },
    data: {
      name: "Pixel Forge Bangkok",
      description:
        "Indie game art, pixel-perfect assets, and battle-tested Unity/Unreal kits — handcrafted in a Bangkok studio. From chiptune boss battles to cyberpunk cityscapes.",
      profileImage:
        "https://api.dicebear.com/8.x/shapes/svg?seed=PixelForge&backgroundColor=22d3ee",
      coverImage:
        "https://picsum.photos/seed/pixelforge-cover/1600/500",
    },
  });
  console.log(`✓ Renamed store ${STORE_ID} → "${store.name}"`);

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
          create: def.items.map((it) => {
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
