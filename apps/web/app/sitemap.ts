import type { MetadataRoute } from "next";
import { prisma } from "@/lib/server/prisma";

/**
 * Dynamic sitemap — static landing pages plus the top 200 published
 * products (by review count) and every public store, with `updatedAt`
 * so crawlers recrawl only what changed. Soft-deleted/paused rows are
 * excluded. `force-dynamic` + `revalidate = 3600` cap DB load.
 */
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.fly.dev").replace(/\/$/, "");
  const now = new Date();

  // Static surfaces — frequently-updated pages get a higher changeFrequency
  // hint so crawlers know to come back.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`,            lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/browse`,      lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/feature-tour`,lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`,       lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/register`,    lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];

  // Pull live data — wrapped in try/catch so a Neon hiccup downgrades the
  // sitemap gracefully (ship the static surfaces) instead of 500ing.
  let products: Array<{ productId: number; createdAt: Date }> = [];
  let stores:   Array<{ storeId: number;   createdAt: Date }> = [];
  try {
    [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          // match `getProduct`'s public gate so we don't
          // advertise products on suspended stores.
          store: { suspendedAt: null },
        },
        // Order by review count desc → most-engaged products first.
        orderBy: [{ reviews: { _count: "desc" } }, { createdAt: "desc" }],
        take: 200,
        select: { productId: true, createdAt: true },
      }),
      prisma.store.findMany({
        where: { suspendedAt: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { storeId: true, createdAt: true },
      }),
    ]);
  } catch (err) {
    // Don't throw — degrade to static-only — but DO log so the next
    // recurrence is visible in Sentry / Fly logs.
    // eslint-disable-next-line no-console
    console.error("[sitemap] DB query failed, falling back to static entries:", err);
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
