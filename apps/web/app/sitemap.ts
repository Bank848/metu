import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";

/**
 * Dynamic sitemap — emits the static landing pages plus every published
 * product (top 200 by review count) and every public store, with their
 * `updatedAt` so search engines recrawl only what changed.
 *
 * Soft-deleted rows and paused products are excluded so we never advertise
 * a URL that 404s. The list is intentionally capped: 200 products is well
 * inside the 50k URL / 50 MB sitemap budget and keeps the response cheap
 * to render even on a cold Neon compute wake.
 *
 * Next 14 reads this file at /sitemap.xml automatically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.fly.dev").replace(/\/$/, "");
  const now = new Date();

  // Static surfaces — frequently-updated pages get a higher changeFrequency
  // hint so crawlers know to come back.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`,           lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/browse`,     lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/features`,   lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`,      lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/register`,   lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];

  // Pull live data — wrapped in try/catch so a Neon hiccup downgrades the
  // sitemap gracefully (ship the static surfaces) instead of 500ing.
  let products: Array<{ productId: number; createdAt: Date }> = [];
  let stores:   Array<{ storeId: number;   createdAt: Date }> = [];
  try {
    [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, deletedAt: null, store: { deletedAt: null } },
        // Order by review count desc → most-engaged products first.
        orderBy: [{ reviews: { _count: "desc" } }, { createdAt: "desc" }],
        take: 200,
        select: { productId: true, createdAt: true },
      }),
      prisma.store.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { storeId: true, createdAt: true },
      }),
    ]);
  } catch {
    // Swallow — fall through with whatever we got.
  }

  return [
    ...staticEntries,
    ...products.map<MetadataRoute.Sitemap[number]>((p) => ({
      url: `${base}/product/${p.productId}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    ...stores.map<MetadataRoute.Sitemap[number]>((s) => ({
      url: `${base}/store/${s.storeId}`,
      lastModified: s.createdAt,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
  ];
}
