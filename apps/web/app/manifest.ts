import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes METU installable as a standalone app on iOS,
 * Android, and desktop Chromium. Next 14 reads this file at the
 * /manifest.webmanifest URL automatically.
 *
 * Icons are vector (SVG) so we get crisp output at every size without
 * shipping a dozen PNG variants. The `purpose: "any maskable"` flag
 * tells Android it's safe to apply the system-wide icon mask.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "METU — Digital Marketplace",
    short_name: "METU",
    description:
      "Digital marketplace for Thai creators — templates, music, courses, art, and more.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E0E0E",
    theme_color: "#FFD000",
    categories: ["shopping", "business"],
    lang: "en",
    icons: [
      // Two entries from the same SVG so Android can pick the maskable
      // variant for adaptive icons while desktop browsers use "any".
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Browse marketplace",
        short_name: "Browse",
        url: "/browse",
      },
      {
        name: "My favorites",
        short_name: "Favorites",
        url: "/favorites",
      },
      {
        name: "Cart",
        short_name: "Cart",
        url: "/cart",
      },
    ],
  };
}
