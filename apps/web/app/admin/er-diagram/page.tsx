import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ErDiagramView } from "@/components/admin/ErDiagramView";

export const metadata: Metadata = { title: "ER Diagram · Admin · METU" };
// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request — `force-static` would skip the auth check.
export const dynamic = "force-dynamic";

/**
 * Phase 24 — `/admin/er-diagram`.
 *
 * In-house live ER diagram. Renders the current Prisma schema as
 * Lucidchart-style entity cards with auto-layout (dagre) + crow-foot
 * SVG connectors. Pan/zoom + export (SVG/PNG).
 *
 * Source-of-truth chain:
 *   packages/db/prisma/schema.prisma
 *     → scripts/generate-er-schema.mjs (build-time)
 *     → apps/web/lib/admin/er-schema.ts (typed constant)
 *     → ErDiagramView (this client component)
 *
 * Run `node scripts/generate-er-schema.mjs` after every Prisma edit
 * to refresh the rendered diagram.
 */
export default function ErDiagramPage() {
  return (
    <>
      <PageHeader
        title="ER Diagram"
        subtitle="Crow-foot schema · auto-rendered from Prisma · Phase 24"
      />
      <p className="mb-4 text-sm text-ink-dim flex items-center gap-2">
        <Network className="h-4 w-4 text-metu-yellow" />
        Live render — every Prisma migration syncs after running{" "}
        <code className="rounded bg-space-900 px-1.5 py-0.5 text-metu-yellow">
          node scripts/generate-er-schema.mjs
        </code>
        . Pan with drag · zoom with Ctrl+wheel or buttons · export PNG/SVG via the bottom-right buttons.
      </p>
      <ErDiagramView />
    </>
  );
}
