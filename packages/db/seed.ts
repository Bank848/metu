// METU Seed — Thai-leaning narrative-driven demo data.
// Run:  npm run db:seed     (additive, idempotent-ish via upserts where practical)
//       npm run db:reset    (drop + migrate + seed)
//
// Story seeded:
//   admin@metu.dev  sees a realistic marketplace at a glance
//   seller@metu.dev owns "Kluay Studio" (Art & Design, Bangkok) with 9 products,
//                   8 orders across all statuses, active coupon METU10
//   buyer@metu.dev  has past orders + an active cart for the demo

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Stable abstract avatars per user (matches Canva's modern minimalist vibe).
const AVATAR = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}`;

// Picsum is reliable but returns RANDOM photos by seed — fine for store covers but
// terrible for product cards (a "Thai-Pop Instrumental" card might show an American
// flag). Reserve IMG() for decorative placement; for products use pickImage() below.
const IMG = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

// Curated Unsplash photo IDs, pooled by product category. Each pool has 5+ themed
// images; pickImage() rotates through them deterministically based on the seed name
// so the same seed always returns the same photo (stable across re-seeds).
const IMAGE_POOLS: Record<string, string[]> = {
  Templates: [
    "1551288049-bebda4e38f71", // dashboard mockup
    "1460925895917-afdab827c52f", // analytics chart
    "1517245386807-bb43f82c33c4", // tablet design
    "1432888622747-4eb9a8f2c293", // notebook plan
    "1467232004584-a241de8bcf5d", // laptop chart
    "1559028012-481c04fa702d", // ui design
  ],
  Fonts: [
    "1453928582365-b6ad33cbcf64", // typewriter
    "1455390582262-044cdead277a", // vintage letters
    "1517059224940-d4af9eec41b7", // typography poster
    "1505682499293-233fb141754c", // handwriting
    "1471107340929-a87cd0f5b5f3", // wood-block type
    "1607706189992-eae578626c86", // letterpress (replaced 404)
  ],
  Illustrations: [
    "1513364776144-60967b0f800f", // paint brushes
    "1460661419201-fd4cecdf8a8b", // artist palette
    "1491637639811-60e2756cc1c7", // sketching hands
    "1452860606245-08befc0ff44b", // watercolour swatches
    "1513475382585-d06e58bcb0e0", // illustration desk
    "1502691876148-a84978e59af8", // botanical art
  ],
  "Stock Music": [
    "1470225620780-dba8ba36b745", // headphones
    "1493225457124-a3eb161ffa5f", // mixing board
    "1511671782779-c97d3d27a1d4", // vinyl records
    "1514525253161-7a46d19cd819", // DJ session
    "1518609878373-06d740f60d8b", // music studio
    "1459749411175-04bf5292ceea", // headphones overhead
  ],
  "Game Assets": [
    "1493711662062-fa541adb3fc8", // game controller
    "1538481199705-c710c4e965fc", // arcade neon
    "1542751371-adc38448a05e", // gaming pc
    "1550745165-9bc0b252726f", // retro game cart
    "1511512578047-dfb367046420", // pixel art screen
    "1556438064-2d7646166914", // pixel art landscape
  ],
  "Online Courses": [
    "1503676260728-1c00da094a0b", // laptop study
    "1456513080510-7bf3a84b82f8", // notebook learning
    "1454165804606-c3d57bc86b40", // online learning
    "1434030216411-0b793f4b4173", // class lecture
    "1571260899304-425eee4c7efc", // e-learning
    "1488190211105-8b0e65b80b4e", // student workspace
  ],
  "3D Models": [
    "1581291518857-4e27b48ff24e", // 3D render abstract
    "1620712943543-bcc4688e7485", // low poly mesh
    "1633899306328-c5e70574aaa2", // 3d sculpt
    "1633265486064-086b219458ec", // geometric render
    "1535378917042-10a22c95931a", // 3d composition
    "1639762681485-074b7f938ba0", // blender scene
  ],
  "E-books": [
    "1481627834876-b7833e8f5570", // open book
    "1524995997946-a1c2e315a42f", // e-reader
    "1495446815901-a7297e633e8d", // books stack
    "1550399105-c4db5fb85c18", // reading
    "1532012197267-da84d127e765", // book pages
    "1456513080510-7bf3a84b82f8", // notebook
  ],
  Photography: [
    "1500051638674-ff996a0ec29e", // camera
    "1452587925148-ce544e77e70d", // lens
    "1542038784456-1ea8e935640e", // dslr body
    "1606144042614-b2417e99c4e3", // photographer
    "1496440737103-cd596325d314", // film camera
  ],
  "Plug-ins": [
    "1487014679447-9f8336841d58", // code editor
    "1555066931-4365d14bab8c", // programming
    "1517694712202-14dd9538aa97", // laptop code
    "1542831371-29b0f74f9713", // coding hands
    "1593720213428-28a5b9e94613", // IDE dark
  ],
};

// Tiny stable hash so the same seed always picks the same photo from its pool.
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickImage(category: string, seed: string, index = 0, w = 1200, h = 800): string {
  const pool = IMAGE_POOLS[category];
  if (!pool || pool.length === 0) return IMG(seed, w, h); // fall back to picsum
  const id = pool[(hashSeed(seed) + index) % pool.length];
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
}

// THB pricing (≈ x35 of USD for plausible Thai marketplace prices).
const baht = (n: number) => new Prisma.Decimal(n);

async function clear() {
  await prisma.couponUsage.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.productNTag.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.storeStats.deleteMany();
  await prisma.store.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.businessType.deleteMany();
  await prisma.country.deleteMany();
  console.log("✓ cleared all tables");
}

async function seedCountries() {
  // Thailand first so it's the default country in dropdowns.
  const data = [
    { countryCode: 66, name: "Thailand" },
    { countryCode: 65, name: "Singapore" },
    { countryCode: 81, name: "Japan" },
    { countryCode: 1,  name: "United States" },
    { countryCode: 44, name: "United Kingdom" },
  ];
  await prisma.country.createMany({ data });
  return prisma.country.findMany({ orderBy: { countryId: "asc" } });
}

async function seedBusinessTypes() {
  const data = [
    { name: "Art & Design", description: "Illustrations, design kits, and creative assets" },
    { name: "Education",    description: "Courses, e-books, and teaching materials" },
    { name: "Software",     description: "Plug-ins, templates, and developer tools" },
    { name: "Music",        description: "Beats, samples, and sound effects" },
    { name: "Writing",      description: "Books, zines, and copywriting templates" },
    { name: "Gaming",       description: "Game assets, mods, and digital goods" },
  ];
  await prisma.businessType.createMany({ data });
  return prisma.businessType.findMany();
}

async function seedCategories() {
  const data = [
    { categoryName: "3D Models",      description: "Ready-to-render 3D assets and meshes" },
    { categoryName: "Online Courses", description: "Video-based structured learning programs" },
    { categoryName: "E-books",        description: "Digital books in PDF and EPUB formats" },
    { categoryName: "Stock Music",    description: "Royalty-free music tracks and loops" },
    { categoryName: "Fonts",          description: "Display, body, and decorative typefaces" },
    { categoryName: "Templates",      description: "Design and document templates" },
    { categoryName: "Game Assets",    description: "Sprites, tilesets, and game-ready packs" },
    { categoryName: "Photography",    description: "High-resolution stock photos" },
    { categoryName: "Plug-ins",       description: "Figma, VS Code, and creative-tool extensions" },
    { categoryName: "Illustrations",  description: "Vector art and illustration packs" },
  ];
  await prisma.category.createMany({ data });
  return prisma.category.findMany();
}

async function seedTags() {
  const names = [
    "beginner", "premium", "new-release", "bestseller", "royalty-free",
    "no-attribution", "commercial-use", "beginner-friendly", "pro", "high-quality",
    "dark-mode", "light-mode", "minimal", "retro", "thai-style",
  ];
  await prisma.productTag.createMany({
    data: names.map((n) => ({
      tagName: n,
      tagDescription: `Tag: ${n.replace(/-/g, " ")}`,
    })),
  });
  return prisma.productTag.findMany();
}

type U = Awaited<ReturnType<typeof seedUsers>>[number];

async function seedUsers(countries: { countryId: number; name: string }[]) {
  const thaiId = countries.find((c) => c.name === "Thailand")!.countryId;
  const sgId   = countries.find((c) => c.name === "Singapore")!.countryId;
  const jpId   = countries.find((c) => c.name === "Japan")!.countryId;

  const pw = async (raw: string) => bcrypt.hash(raw, 10);

  const users: Array<Parameters<typeof prisma.user.create>[0]["data"]> = [
    // --- Admin ---
    {
      username: "admin", email: "admin@metu.dev", password: await pw("Admin#123"),
      firstName: "Pim", lastName: "Ratanapol", gender: "female",
      profileImage: AVATAR("admin-pim"), countryId: thaiId,
      dateOfBirth: new Date("1995-06-12"),
    },
    // --- Sellers ---
    {
      username: "kluay", email: "seller@metu.dev", password: await pw("Seller#123"),
      firstName: "Sarin", lastName: "Chaiyasit", gender: "male",
      profileImage: AVATAR("seller-kluay"), countryId: thaiId,
      dateOfBirth: new Date("1997-09-03"),
    },
    {
      username: "raisound", email: "kanokwan@metu.dev", password: await pw("Pass#123"),
      firstName: "Kanokwan", lastName: "Suttipong", gender: "female",
      profileImage: AVATAR("seller-rai"), countryId: thaiId,
      dateOfBirth: new Date("1994-02-24"),
    },
    {
      username: "cmcode", email: "nontapat@metu.dev", password: await pw("Pass#123"),
      firstName: "Nontapat", lastName: "Wong", gender: "male",
      profileImage: AVATAR("seller-cm"), countryId: thaiId,
      dateOfBirth: new Date("1990-11-08"),
    },
    {
      username: "nokpress", email: "voradol@metu.dev", password: await pw("Pass#123"),
      firstName: "Voradol", lastName: "Ekachai", gender: "male",
      profileImage: AVATAR("seller-nok"), countryId: thaiId,
      dateOfBirth: new Date("1998-03-19"),
    },
    // --- Buyers ---
    {
      username: "demo_buyer", email: "buyer@metu.dev", password: await pw("Buyer#123"),
      firstName: "Thana", lastName: "Siri", gender: "male",
      profileImage: AVATAR("buyer-thana"), countryId: thaiId,
      dateOfBirth: new Date("2000-01-15"),
    },
    {
      username: "khim_w", email: "khim@metu.dev", password: await pw("Pass#123"),
      firstName: "Khim", lastName: "Watcharin", gender: "female",
      profileImage: AVATAR("buyer-khim"), countryId: thaiId,
      dateOfBirth: new Date("1999-07-22"),
    },
    {
      username: "yuki_s", email: "yuki@metu.dev", password: await pw("Pass#123"),
      firstName: "Yuki", lastName: "Sato", gender: "female",
      profileImage: AVATAR("buyer-yuki"), countryId: jpId,
      dateOfBirth: new Date("2001-05-05"),
    },
    {
      username: "linh_n", email: "linh@metu.dev", password: await pw("Pass#123"),
      firstName: "Linh", lastName: "Nguyen", gender: "female",
      profileImage: AVATAR("buyer-linh"), countryId: sgId,
      dateOfBirth: new Date("1996-10-30"),
    },
    {
      username: "arun_p", email: "arun@metu.dev", password: await pw("Pass#123"),
      firstName: "Arun", lastName: "Phongchai", gender: "male",
      profileImage: AVATAR("buyer-arun"), countryId: thaiId,
      dateOfBirth: new Date("2002-04-11"),
    },
    {
      username: "kanda_c", email: "kanda@metu.dev", password: await pw("Pass#123"),
      firstName: "Kanda", lastName: "Chitra", gender: "female",
      profileImage: AVATAR("buyer-kanda"), countryId: thaiId,
      dateOfBirth: new Date("1993-12-02"),
    },
    {
      username: "mei_h", email: "mei@metu.dev", password: await pw("Pass#123"),
      firstName: "Mei", lastName: "Huang", gender: "female",
      profileImage: AVATAR("buyer-mei"), countryId: sgId,
      dateOfBirth: new Date("1998-08-14"),
    },
  ];

  const created = [] as Awaited<ReturnType<typeof prisma.user.create>>[];
  for (const data of users) {
    const u = await prisma.user.create({ data });
    created.push(u);
  }

  const roleMap: Record<number, "buyer" | "seller" | "admin"> = {
    0: "admin", 1: "seller", 2: "seller", 3: "seller", 4: "seller",
  };
  for (let i = 0; i < created.length; i++) {
    const u = created[i];
    const role = roleMap[i] ?? "buyer";
    await prisma.userStats.create({
      data: {
        userId: u.userId,
        role,
        buyerLevel: role === "buyer" ? Math.floor(Math.random() * 5) + 1 : 1,
        sellerLevel: role === "seller" ? Math.floor(Math.random() * 4) + 1 : 0,
      },
    });
    await prisma.cart.create({
      data: { userId: u.userId, status: "active" },
    });
  }

  return created;
}

async function seedStores(sellers: U[], businessTypes: { typeId: number; name: string }[]) {
  const byName = (n: string) => businessTypes.find((b) => b.name === n)!.typeId;

  const defs = [
    {
      seller: sellers[1], // kluay
      name: "Kluay Studio",
      description: "A Bangkok design studio crafting UI kits, dashboard templates, and Thai-styled graphic systems.",
      businessTypeId: byName("Art & Design"),
      cover: IMG("kluay-cover", 1600, 600),
      profile: AVATAR("store-kluay"),
    },
    {
      seller: sellers[2], // raisound
      name: "Rai Sound Lab",
      description: "Lo-fi beats, Thai-pop instrumentals, and cinematic scores recorded in Chiang Mai.",
      businessTypeId: byName("Music"),
      cover: IMG("rai-cover", 1600, 600),
      profile: AVATAR("store-rai"),
    },
    {
      seller: sellers[3], // cmcode
      name: "Chiang Mai Code",
      description: "Online courses in Thai and English on game development, web design, and creative coding.",
      businessTypeId: byName("Education"),
      cover: IMG("cmcode-cover", 1600, 600),
      profile: AVATAR("store-cmcode"),
    },
    {
      seller: sellers[4], // nokpress
      name: "Nok Press",
      description: "Beautifully typeset Thai-bilingual e-books, zines, and hand-lettered typefaces.",
      businessTypeId: byName("Writing"),
      cover: IMG("nok-cover", 1600, 600),
      profile: AVATAR("store-nok"),
    },
  ];

  const stores: Awaited<ReturnType<typeof prisma.store.create>>[] = [];
  for (const d of defs) {
    const s = await prisma.store.create({
      data: {
        ownerId: d.seller.userId,
        businessTypeId: d.businessTypeId,
        name: d.name,
        description: d.description,
        coverImage: d.cover,
        profileImage: d.profile,
      },
    });
    await prisma.storeStats.create({
      data: {
        storeId: s.storeId,
        ctr: Math.floor(Math.random() * 130) + 20,
        rating: Math.floor(Math.random() * 11) + 38,
        responseTime: Math.floor(Math.random() * 2820) + 60,
      },
    });
    stores.push(s);
  }
  return stores;
}

const CATALOG: Record<
  string,
  Array<{
    name: string;
    description: string;
    category: string;
    imageSeeds: string[];
    tags: string[];
    items: Array<{ delivery: "download" | "email" | "license_key" | "streaming"; price: number; qty: number; discountPercent?: number }>;
  }>
> = {
  "Kluay Studio": [
    {
      name: "Figma Dashboard Kit — Glasswave",
      description: "120 components, 40 chart blocks, dark + light variants. Auto-layout everywhere.",
      category: "Templates",
      imageSeeds: ["figma-dashboard-1", "figma-dashboard-2", "figma-dashboard-3"],
      tags: ["premium", "pro", "dark-mode"],
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
      tags: ["premium", "commercial-use", "minimal"],
      items: [
        { delivery: "download", price: 1700, qty: 999 },
        { delivery: "license_key", price: 5200, qty: 100 },
      ],
    },
    {
      name: "Thai Botanical Ink Illustration Pack",
      description: "60 hand-painted Thai botanical pieces (lotus, frangipani, banana leaf) as PNG + SVG + Procreate.",
      category: "Illustrations",
      imageSeeds: ["thai-botanical-1", "thai-botanical-2", "thai-botanical-3", "thai-botanical-4"],
      tags: ["bestseller", "no-attribution", "thai-style"],
      items: [{ delivery: "download", price: 1400, qty: 999, discountPercent: 20 }],
    },
    {
      name: "Notion Productivity OS 2026",
      description: "A complete life OS: goals, habits, journal, projects, and areas. Available in EN + TH.",
      category: "Templates",
      imageSeeds: ["notion-os-1", "notion-os-2"],
      tags: ["new-release"],
      items: [{ delivery: "email", price: 690, qty: 999 }],
    },
    {
      name: "Songkran Social Media Kit 2026",
      description: "Editable Figma + Canva templates for Songkran festival campaigns. 24 layouts, TH/EN.",
      category: "Templates",
      imageSeeds: ["songkran-kit-1", "songkran-kit-2"],
      tags: ["thai-style", "new-release"],
      items: [{ delivery: "download", price: 990, qty: 999 }],
    },
    {
      name: "Midnight Icon Pack — 500 Line Icons",
      description: "Stroke-consistent line icons in 5 styles. SVG, Figma, and Iconify ready.",
      category: "Illustrations",
      imageSeeds: ["midnight-icons-1", "midnight-icons-2"],
      tags: ["minimal", "dark-mode", "pro"],
      items: [{ delivery: "download", price: 1050, qty: 999 }],
    },
    {
      name: "Isometric Workspace Scenes Pack",
      description: "24 editable isometric scenes for pitch decks and marketing sites.",
      category: "Illustrations",
      imageSeeds: ["isometric-1", "isometric-2"],
      tags: ["commercial-use", "high-quality"],
      items: [
        { delivery: "download", price: 2050, qty: 999 },
        { delivery: "license_key", price: 4500, qty: 100 },
      ],
    },
    {
      name: "Brand Guidelines Template — Helix",
      description: "A 42-page Figma + PDF starter for presenting a brand system.",
      category: "Templates",
      imageSeeds: ["helix-brand-1", "helix-brand-2"],
      tags: ["beginner-friendly", "pro"],
      items: [{ delivery: "download", price: 1250, qty: 999 }],
    },
    {
      name: "Pitch Deck Template — Stratos",
      description: "20 slides for early-stage founders. Figma + Keynote + Google Slides.",
      category: "Templates",
      imageSeeds: ["stratos-deck-1", "stratos-deck-2"],
      tags: ["bestseller", "pro", "premium"],
      items: [
        { delivery: "download", price: 1600, qty: 999 },
        { delivery: "email", price: 890, qty: 999 },
      ],
    },
  ],
  "Rai Sound Lab": [
    {
      name: "Bangkok Lo-Fi Nightdrive Pack (48 tracks)",
      description: "48 studio-mixed lo-fi beats inspired by Bangkok nighttime — for vlogs, streams, study sessions.",
      category: "Stock Music",
      imageSeeds: ["bangkok-lofi-1", "bangkok-lofi-2"],
      tags: ["royalty-free", "commercial-use", "bestseller", "thai-style"],
      items: [
        { delivery: "download", price: 2050, qty: 999 },
        { delivery: "streaming", price: 320, qty: 999 },
      ],
    },
    {
      name: "Cinematic Trailer Score Toolkit",
      description: "25 epic stems + 10 stingers for cinematic pitches and trailers.",
      category: "Stock Music",
      imageSeeds: ["cinematic-1", "cinematic-2"],
      tags: ["premium", "high-quality"],
      items: [{ delivery: "download", price: 3100, qty: 500 }],
    },
    {
      name: "Chillhop Sample Pack — 120 Loops",
      description: "Drums, keys, basslines, and vinyl FX at 80–95 BPM. Royalty-free.",
      category: "Stock Music",
      imageSeeds: ["chillhop-1", "chillhop-2", "chillhop-3"],
      tags: ["royalty-free"],
      items: [{ delivery: "download", price: 1400, qty: 999, discountPercent: 15 }],
    },
    {
      name: "Thai-Pop Instrumental Vol. 2",
      description: "16 modern Thai-pop instrumentals — perfect for content creators and indie filmmakers.",
      category: "Stock Music",
      imageSeeds: ["thaipop-1", "thaipop-2"],
      tags: ["thai-style", "royalty-free"],
      items: [{ delivery: "download", price: 1050, qty: 999 }],
    },
    {
      name: "Ambient Nature Field Recordings — Khao Yai",
      description: "12 hours of 96kHz nature ambience recorded in Khao Yai national park.",
      category: "Stock Music",
      imageSeeds: ["khaoyai-1", "khaoyai-2"],
      tags: ["high-quality", "no-attribution", "thai-style"],
      items: [{ delivery: "download", price: 870, qty: 999 }],
    },
    {
      name: "Game UI Sound Effects — 220 SFX",
      description: "Clicks, swooshes, wins, coins, level-ups for indie games.",
      category: "Game Assets",
      imageSeeds: ["game-sfx-1"],
      tags: ["pro", "commercial-use"],
      items: [
        { delivery: "download", price: 1250, qty: 999 },
        { delivery: "license_key", price: 3500, qty: 50 },
      ],
    },
  ],
  "Chiang Mai Code": [
    {
      name: "Python for Data Science — Full Course (TH/EN)",
      description: "42 video lessons in Thai + English subtitles. Numpy basics → pandas → sklearn.",
      category: "Online Courses",
      imageSeeds: ["python-course-1", "python-course-2"],
      tags: ["beginner-friendly", "bestseller", "thai-style"],
      items: [
        { delivery: "streaming", price: 3100, qty: 999 },
        { delivery: "license_key", price: 4500, qty: 200 },
      ],
    },
    {
      name: "Shader Fundamentals with GLSL",
      description: "16 modules on GPU programming: vertex, fragment, compute, and post-fx.",
      category: "Online Courses",
      imageSeeds: ["shader-course-1", "shader-course-2"],
      tags: ["pro", "high-quality"],
      items: [{ delivery: "streaming", price: 4150, qty: 999 }],
    },
    {
      name: "Unity 2D Platformer — Thai Myth Edition",
      description: "Build a full 2D platformer based on Thai myth (Garuda + Naga). Tilemaps, physics, shipping.",
      category: "Online Courses",
      imageSeeds: ["unity-thai-1", "unity-thai-2"],
      tags: ["beginner", "thai-style"],
      items: [
        { delivery: "streaming", price: 2750, qty: 999, discountPercent: 30 },
      ],
    },
    {
      name: "Pixel Art Tileset — Forest & Caves",
      description: "2,400 tiles with 4 biomes, animated water, and decals. 16×16.",
      category: "Game Assets",
      imageSeeds: ["pixel-tileset-1", "pixel-tileset-2"],
      tags: ["retro", "royalty-free", "commercial-use"],
      items: [{ delivery: "download", price: 1600, qty: 999 }],
    },
    {
      name: "3D Low-Poly Fantasy Asset Pack",
      description: "200 GLB/FBX meshes for Unity and Godot — characters, props, and props.",
      category: "3D Models",
      imageSeeds: ["3d-fantasy-1", "3d-fantasy-2"],
      tags: ["premium", "pro"],
      items: [
        { delivery: "download", price: 2400, qty: 999 },
        { delivery: "license_key", price: 5500, qty: 80 },
      ],
    },
    {
      name: "React Performance — Advanced Course",
      description: "Profiling, memoization, concurrent rendering, and Suspense patterns.",
      category: "Online Courses",
      imageSeeds: ["react-perf-1"],
      tags: ["pro", "new-release"],
      items: [{ delivery: "streaming", price: 3450, qty: 999 }],
    },
  ],
  "Nok Press": [
    {
      name: "Essays on Quiet Craft (E-book)",
      description: "A 140-page essay collection on deep work, craft, and rest — bilingual TH/EN.",
      category: "E-books",
      imageSeeds: ["essays-craft-1", "essays-craft-2"],
      tags: ["minimal", "new-release", "thai-style"],
      items: [{ delivery: "email", price: 420, qty: 999 }],
    },
    {
      name: "The Writer's Ideation Notebook — PDF",
      description: "A printable notebook system for fiction writers and journalists.",
      category: "E-books",
      imageSeeds: ["writer-notebook-1", "writer-notebook-2"],
      tags: ["beginner-friendly"],
      items: [{ delivery: "download", price: 490, qty: 999 }],
    },
    {
      name: "Sukhumvit Serif — 6 Editorial Typefaces",
      description: "Six display serifs designed in Bangkok for long-form editorial design.",
      category: "Fonts",
      imageSeeds: ["sukhumvit-serif-1", "sukhumvit-serif-2"],
      tags: ["premium", "pro", "thai-style"],
      items: [
        { delivery: "download", price: 1400, qty: 999 },
        { delivery: "license_key", price: 4150, qty: 60 },
      ],
    },
    {
      name: "Zine Layout Templates for InDesign",
      description: "10 editable zine layouts with grids, masters, and paragraph styles.",
      category: "Templates",
      imageSeeds: ["zine-layout-1", "zine-layout-2"],
      tags: ["beginner-friendly", "minimal"],
      items: [{ delivery: "download", price: 850, qty: 999 }],
    },
    {
      name: "Thai Lettering Brush Pack for Procreate",
      description: "40 brushes covering 5 Thai-script and Latin calligraphy styles. Pressure-tuned.",
      category: "Fonts",
      imageSeeds: ["thai-brushes-1", "thai-brushes-2"],
      tags: ["thai-style", "commercial-use"],
      items: [{ delivery: "download", price: 690, qty: 999 }],
    },
  ],
};

async function seedProducts(
  stores: { storeId: number; name: string }[],
  categories: { categoryId: number; categoryName: string }[],
  tags: { tagId: number; tagName: string }[],
) {
  const catByName = new Map(categories.map((c) => [c.categoryName, c.categoryId]));
  const tagByName = new Map(tags.map((t) => [t.tagName, t.tagId]));

  const products: Array<Awaited<ReturnType<typeof prisma.product.create>>> = [];
  const items: Array<Awaited<ReturnType<typeof prisma.productItem.create>>> = [];

  for (const store of stores) {
    const catalog = CATALOG[store.name] ?? [];
    for (const def of catalog) {
      const product = await prisma.product.create({
        data: {
          storeId: store.storeId,
          categoryId: catByName.get(def.category)!,
          name: def.name,
          description: def.description,
        },
      });
      products.push(product);

      for (let i = 0; i < def.imageSeeds.length; i++) {
        await prisma.productImage.create({
          data: {
            productId: product.productId,
            productImage: pickImage(def.category, def.imageSeeds[i], i, 1200, 800),
            sortOrder: i,
          },
        });
      }

      for (const tagName of def.tags) {
        const tagId = tagByName.get(tagName);
        if (tagId) {
          await prisma.productNTag.create({
            data: { productId: product.productId, tagId },
          });
        }
      }

      for (const it of def.items) {
        const pi = await prisma.productItem.create({
          data: {
            productId: product.productId,
            deliveryMethod: it.delivery,
            quantity: it.qty,
            price: baht(it.price),
            discountPercent: it.discountPercent ?? 0,
            discountAmount: baht(((it.discountPercent ?? 0) * it.price) / 100),
          },
        });
        items.push(pi);
      }
    }
  }

  return { products, items };
}

async function seedReviews(
  products: { productId: number }[],
  buyers: U[],
) {
  const comments = [
    "Really well made. Docs are thorough and delivery was instant.",
    "Exactly what I needed for my project. Highly recommend.",
    "Good value, though the dark variant could use more contrast.",
    "Beautiful design. Saved me hours of work.",
    "Works great, would buy from this seller again.",
    "Mostly good but a few layers weren't organized as I expected.",
    "Perfect quality and easy to customize.",
    "Amazing pack. Way more than I expected for the price.",
    "Great starter resource. A few bugs but fixable.",
    "Love the vibe — feels right for our Bangkok-based brand.",
    "ดีมาก ใช้งานง่าย แนะนำเลย", // a tasteful Thai review for authenticity
    "Clean and modern. Fits perfectly in our Thai-language site.",
  ];
  for (const p of products) {
    const count = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const buyer = buyers[Math.floor(Math.random() * buyers.length)];
      const roll = Math.random();
      let rating = 5;
      if (roll < 0.06) rating = 2;
      else if (roll < 0.25) rating = 3;
      else if (roll < 0.55) rating = 4;
      await prisma.productReview.create({
        data: {
          productId: p.productId,
          userId: buyer.userId,
          rating,
          comment: comments[Math.floor(Math.random() * comments.length)],
        },
      });
    }
  }
}

async function seedCoupons(stores: { storeId: number; name: string }[]) {
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

  const kluay     = stores.find((s) => s.name === "Kluay Studio")!.storeId;
  const rai       = stores.find((s) => s.name === "Rai Sound Lab")!.storeId;
  const cmcode    = stores.find((s) => s.name === "Chiang Mai Code")!.storeId;
  const nok       = stores.find((s) => s.name === "Nok Press")!.storeId;

  const data: Prisma.CouponCreateManyInput[] = [
    { storeId: kluay,  code: "METU10",      discountType: "percent", discountValue: 10, startDate: inDays(-7),  endDate: inDays(60),  usageLimit: 500,  isActive: true },
    { storeId: kluay,  code: "LAUNCH25",    discountType: "percent", discountValue: 25, startDate: inDays(-30), endDate: inDays(-1),  usageLimit: 100,  isActive: false },
    { storeId: rai,    code: "BEATS15",     discountType: "percent", discountValue: 15, startDate: inDays(-3),  endDate: inDays(45),  usageLimit: 200,  isActive: true },
    { storeId: rai,    code: "SAVE100",     discountType: "fixed",   discountValue: 100, startDate: inDays(-14), endDate: inDays(30), usageLimit: 300,  isActive: true },
    { storeId: cmcode, code: "LEARN20",     discountType: "percent", discountValue: 20, startDate: inDays(-1),  endDate: inDays(90),  usageLimit: 1000, isActive: true },
    { storeId: cmcode, code: "BLACKFRIDAY", discountType: "percent", discountValue: 40, startDate: inDays(-60), endDate: inDays(-30), usageLimit: 500,  isActive: false },
    { storeId: nok,    code: "READ50",      discountType: "fixed",   discountValue: 50, startDate: inDays(-10), endDate: inDays(20),  usageLimit: 500,  isActive: true },
    { storeId: nok,    code: "ZINE10",      discountType: "percent", discountValue: 10, startDate: inDays(-2),  endDate: inDays(14),  usageLimit: 100,  isActive: true },
  ];
  await prisma.coupon.createMany({ data });
  return prisma.coupon.findMany();
}

async function seedOrders(
  users: U[],
  items: Array<{ productItemId: number; price: Prisma.Decimal }>,
) {
  const buyers = users.slice(5);
  const demoBuyer = users[5];

  const statuses: Array<"paid" | "fulfilled" | "pending" | "cancelled" | "refunded"> = [
    "paid", "paid", "paid", "paid", "paid",
    "fulfilled", "fulfilled", "fulfilled", "fulfilled",
    "pending", "pending",
    "cancelled", "cancelled",
    "refunded", "refunded",
  ];

  const now = Date.now();

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const buyer = i < 2 ? demoBuyer : buyers[(i * 3) % buyers.length];
    const daysAgo = Math.floor(Math.random() * 28) + 1;
    const createdAt = new Date(now - daysAgo * 86_400_000);

    const cart = await prisma.cart.create({
      data: {
        userId: buyer.userId,
        status: "checked_out",
        createdAt,
        updatedAt: createdAt,
      },
    });

    const lineCount = 1 + Math.floor(Math.random() * 3);
    const lines: { productItemId: number; price: Prisma.Decimal; qty: number }[] = [];
    for (let j = 0; j < lineCount; j++) {
      const it = items[Math.floor(Math.random() * items.length)];
      lines.push({ productItemId: it.productItemId, price: it.price, qty: 1 + Math.floor(Math.random() * 2) });
    }
    const total = lines.reduce(
      (acc, l) => acc.add(new Prisma.Decimal(l.price).mul(l.qty)),
      new Prisma.Decimal(0),
    );

    let transactionId: number | null = null;
    if (status === "paid" || status === "fulfilled") {
      const tx = await prisma.transaction.create({
        data: { transactionType: "purchase", userId: buyer.userId, totalAmount: total, date: createdAt, createdAt },
      });
      transactionId = tx.transactionId;
    } else if (status === "refunded") {
      const tx = await prisma.transaction.create({
        data: { transactionType: "refund", userId: buyer.userId, totalAmount: total, date: createdAt, createdAt },
      });
      transactionId = tx.transactionId;
    }

    await prisma.order.create({
      data: {
        cartId: cart.cartId,
        totalPrice: total,
        status,
        transactionId: transactionId ?? undefined,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: lines.map((l) => ({
            productItemId: l.productItemId,
            quantity: l.qty,
            priceAtPurchase: l.price,
          })),
        },
      },
    });
  }

  // Seller payout transaction
  await prisma.transaction.create({
    data: {
      transactionType: "payout",
      userId: users[1].userId,
      totalAmount: new Prisma.Decimal(43400),
    },
  });
}

// Pre-fill the demo buyer's active cart so /cart isn't empty during the demo.
async function seedActiveCart(demoBuyer: U, items: { productItemId: number }[]) {
  const cart = await prisma.cart.findFirst({
    where: { userId: demoBuyer.userId, status: "active" },
  });
  if (!cart) return;
  // Pick the first 2 items as a starting cart
  await prisma.cartItem.createMany({
    data: [
      { cartId: cart.cartId, productItemId: items[0].productItemId, quantity: 1 },
      { cartId: cart.cartId, productItemId: items[2].productItemId, quantity: 2 },
    ],
  });
}

async function summary() {
  const rows = await Promise.all([
    ["country",        await prisma.country.count()],
    ["user",           await prisma.user.count()],
    ["user_stats",     await prisma.userStats.count()],
    ["business_type",  await prisma.businessType.count()],
    ["store",          await prisma.store.count()],
    ["store_stats",    await prisma.storeStats.count()],
    ["category",       await prisma.category.count()],
    ["product_tag",    await prisma.productTag.count()],
    ["product",        await prisma.product.count()],
    ["product_item",   await prisma.productItem.count()],
    ["product_image",  await prisma.productImage.count()],
    ["product_review", await prisma.productReview.count()],
    ["product_n_tag",  await prisma.productNTag.count()],
    ["cart",           await prisma.cart.count()],
    ["cart_item",      await prisma.cartItem.count()],
    ["order",          await prisma.order.count()],
    ["order_item",     await prisma.orderItem.count()],
    ["transaction",    await prisma.transaction.count()],
    ["coupon",         await prisma.coupon.count()],
    ["coupon_usage",   await prisma.couponUsage.count()],
  ]);
  console.log("\n=== ROW COUNTS ===");
  for (const [t, c] of rows) console.log(`  ${String(t).padEnd(16)} ${c}`);
  console.log("\n=== DEMO ACCOUNTS ===");
  console.log("  admin@metu.dev   / Admin#123");
  console.log("  seller@metu.dev  / Seller#123  (owns Kluay Studio)");
  console.log("  buyer@metu.dev   / Buyer#123   (has past orders + active cart)");
  console.log("\n=== URLS ===");
  console.log("  Web:     http://localhost:3000");
  console.log("  API:     http://localhost:4000");
  console.log("  Adminer: http://localhost:8081\n");
}

async function main() {
  console.log("➤ METU seed starting...");
  await clear();
  const countries = await seedCountries();
  console.log(`✓ ${countries.length} countries`);
  const businessTypes = await seedBusinessTypes();
  console.log(`✓ ${businessTypes.length} business types`);
  const categories = await seedCategories();
  console.log(`✓ ${categories.length} categories`);
  const tags = await seedTags();
  console.log(`✓ ${tags.length} tags`);
  const users = await seedUsers(countries);
  console.log(`✓ ${users.length} users (+ user_stats + carts)`);
  const stores = await seedStores(users, businessTypes);
  console.log(`✓ ${stores.length} stores (+ store_stats)`);
  const { products, items } = await seedProducts(stores, categories, tags);
  console.log(`✓ ${products.length} products, ${items.length} variants (+ images + tags)`);
  await seedReviews(products, users.slice(5));
  console.log(`✓ reviews seeded`);
  const coupons = await seedCoupons(stores);
  console.log(`✓ ${coupons.length} coupons`);
  await seedOrders(users, items);
  console.log(`✓ orders + transactions seeded`);
  await seedActiveCart(users[5], items);
  console.log(`✓ demo buyer cart pre-filled`);
  await summary();
}

main()
  .catch((e) => {
    console.error("SEED FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
