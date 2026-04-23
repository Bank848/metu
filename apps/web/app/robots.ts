import type { MetadataRoute } from "next";

/**
 * robots.txt — allow everything except the API surface and any user-only
 * pages that have no value to a crawler. Points at the dynamic sitemap so
 * Google + friends get an up-to-date URL list on each fetch.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://metu.fly.dev").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/seller/",
          "/profile",
          "/profile/",
          "/cart",
          "/checkout",
          "/orders",
          "/messages",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
