"use client";
import { Layers } from "lucide-react";

const STACK = [
  { name: "Next.js", role: "App router · standalone deploy", accent: "white" },
  { name: "Express", role: "REST API + Better-Auth sessions", accent: "mint" },
  { name: "Prisma", role: "Schema · migrations · queryRaw", accent: "blue" },
  { name: "Postgres", role: "Supabase · views · partial indexes", accent: "purple" },
  { name: "Stripe", role: "Connect · live payments · webhooks", accent: "pink" },
  { name: "Firebase", role: "Phone OTP via Auth", accent: "orange" },
  { name: "Tailwind", role: "Design system · 4 themes", accent: "cyan" },
  { name: "Fly.io", role: "Two regions · auto-scale machines", accent: "indigo" },
] as const;

const ACCENT_RING: Record<(typeof STACK)[number]["accent"], string> = {
  white: "ring-white/20 text-white",
  mint: "ring-mint/40 text-mint",
  blue: "ring-blue-400/40 text-blue-300",
  purple: "ring-purple-400/40 text-purple-300",
  pink: "ring-pink-400/40 text-pink-300",
  orange: "ring-orange-400/40 text-orange-300",
  cyan: "ring-cyan-400/40 text-cyan-300",
  indigo: "ring-indigo-400/40 text-indigo-300",
};

export function TechStackSlide() {
  return (
    <div className="relative h-full w-full px-12 py-10 flex flex-col">
      <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-6 self-start">
        <Layers className="h-3.5 w-3.5" />
        Foundation
      </div>

      <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
        Built on a modern stack
      </h2>
      <p className="text-base text-ink-secondary max-w-3xl mb-10">
        No fake screens. Every piece of the marketplace is wired to a real
        database, a real payment processor, and a real CDN — running on the
        same code that powers metu.online.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {STACK.map((s) => (
          <div
            key={s.name}
            className={`rounded-xl ring-1 ${ACCENT_RING[s.accent]} bg-white/[0.03] backdrop-blur px-5 py-5`}
          >
            <div className="font-display text-2xl font-extrabold leading-tight">
              {s.name}
            </div>
            <div className="text-xs text-ink-secondary mt-1">{s.role}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-auto">
        <BigStat n={181} label="Automated tests" tint="text-mint" />
        <BigStat n={42} label="DB migrations" tint="text-blue-300" />
        <BigStat n={29} label="Tracked entities" tint="text-purple-300" />
      </div>
    </div>
  );
}

function BigStat({ n, label, tint }: { n: number; label: string; tint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
      <div className={`font-display text-5xl md:text-6xl font-extrabold tabular-nums leading-none ${tint}`}>
        {n}
      </div>
      <div className="text-xs uppercase tracking-wider text-ink-dim mt-2">
        {label}
      </div>
    </div>
  );
}
