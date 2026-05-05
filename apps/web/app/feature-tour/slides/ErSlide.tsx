"use client";
import { Network } from "lucide-react";
import { ErDiagramView } from "@/components/admin/ErDiagramView";

// The ER diagram lives at full bleed so the auto-pan zoom inside
// ErDiagramView reads cleanly from across a room. Tag bar overlays the
// top so passers-by understand what they're looking at without having
// to read tiny field names.
export function ErSlide() {
  return (
    <div className="relative h-full w-full flex flex-col px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
          <Network className="h-3.5 w-3.5" />
          Live database map
        </div>
        <div className="text-xs text-ink-dim font-mono">
          29 entities · 33 relationships · all derived from schema.prisma
        </div>
      </div>

      <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-1 leading-tight">
        How everything connects
      </h2>
      <p className="text-sm text-ink-secondary mb-4">
        Each box is one kind of thing we keep track of. Each line shows how
        two of them are linked together — drawn straight from the live system.
      </p>

      <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.02] p-2 overflow-hidden">
        <div className="h-full rounded-xl overflow-hidden">
          <ErDiagramView kioskMode />
        </div>
      </div>
    </div>
  );
}
