"use client";

import dynamic from "next/dynamic";

// Lazy-load global UI islands so the layout's server HTML stays light
// and these chunks don't ship in the initial bundle. ssr: false skips
// the wasted server-render pass for components that have no SEO value
// and only matter once JS is interactive (keyboard shortcuts, drawers,
// mobile-only nav).
const KeyboardShortcuts = dynamic(
  () => import("./KeyboardShortcuts").then((m) => m.KeyboardShortcuts),
  { ssr: false },
);
const CompareDrawer = dynamic(
  () => import("./CompareDrawer").then((m) => m.CompareDrawer),
  { ssr: false },
);
const MobileBottomNav = dynamic(
  () => import("./MobileBottomNav").then((m) => m.MobileBottomNav),
  { ssr: false },
);

export function LayoutClientIslands() {
  return (
    <>
      <KeyboardShortcuts />
      <CompareDrawer />
      <MobileBottomNav />
    </>
  );
}
