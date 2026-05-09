"use client";
import { Layers } from "lucide-react";

// Tech-stack slide — inline-SVG marks (no bundled logos), stagger
// fade-in, and a hover pulse so the kiosk monitor feels alive.

interface StackItem {
  name: string;
  role: string;
  accent: AccentKey;
  /** Inline SVG mark — small, single-colour-ish, dropped via dangerouslySetInnerHTML
      to keep this file declarative. Each mark is the official brand glyph
      simplified down to a single foreground colour we tint via currentColor. */
  mark: React.ReactNode;
}

type AccentKey = "white" | "mint" | "blue" | "purple" | "pink" | "orange" | "cyan" | "indigo";

const ACCENT_RING: Record<AccentKey, string> = {
  white: "ring-white/20 text-white",
  mint: "ring-mint/40 text-mint",
  blue: "ring-blue-400/40 text-blue-300",
  purple: "ring-purple-400/40 text-purple-300",
  pink: "ring-pink-400/40 text-pink-300",
  orange: "ring-orange-400/40 text-orange-300",
  cyan: "ring-cyan-400/40 text-cyan-300",
  indigo: "ring-indigo-400/40 text-indigo-300",
};

// Brand glyphs, all 32×32 viewBox, drawn with currentColor so the
// accent class tints them. Hand-traced so we don't ship 8 different
// PNG/SVG dependencies.
const NextMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 9v14M11 9l10 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M21 9v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ExpressMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M3 13 L16 13 L29 13 M3 13 L11 23 M29 13 L21 23 M11 23 L21 23" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const PrismaMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M16 3 L26 26 L8 28 Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    <path d="M16 3 L8 28" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
  </svg>
);

const PostgresMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <ellipse cx="16" cy="9" rx="10" ry="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
    <path d="M6 9 V22 C6 24 11 26 16 26 C21 26 26 24 26 22 V9" stroke="currentColor" strokeWidth="1.6" fill="none" />
    <path d="M6 15 C6 17 11 19 16 19 C21 19 26 17 26 15" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.6" />
  </svg>
);

const StripeMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M11 9 C11 7 13 6 16 6 C19 6 21 7 21 9 C21 11 19 11 16 12 C13 13 11 14 11 17 C11 20 14 22 17 22 C20 22 22 21 22 19" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const FirebaseMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M7 26 L16 4 L19 12 L25 26 Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    <path d="M7 26 L19 12" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
  </svg>
);

const TailwindMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M4 18 C6 13 10 11 16 13 C19 14 20 16 23 16 C26 16 28 14 28 14 C26 19 22 21 16 19 C13 18 12 16 9 16 C6 16 4 18 4 18 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    <path d="M4 24 C6 19 10 17 16 19 C19 20 20 22 23 22 C26 22 28 20 28 20" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.6" />
  </svg>
);

const FlyMark = (
  <svg viewBox="0 0 32 32" fill="currentColor" className="h-full w-full">
    <path d="M5 22 L11 10 L16 22 L21 12 L27 22" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx="16" cy="6" r="1.5" fill="currentColor" />
  </svg>
);

const STACK: StackItem[] = [
  { name: "Next.js",  role: "App router · standalone deploy",          accent: "white",  mark: NextMark },
  { name: "Express",  role: "REST API + Better-Auth sessions",         accent: "mint",   mark: ExpressMark },
  { name: "Prisma",   role: "Schema · migrations · queryRaw",          accent: "blue",   mark: PrismaMark },
  { name: "Postgres", role: "Supabase · views · matview · partial idx", accent: "purple", mark: PostgresMark },
  { name: "Stripe",   role: "Connect · live payments · webhooks",       accent: "pink",   mark: StripeMark },
  { name: "Firebase", role: "Phone OTP via Auth",                       accent: "orange", mark: FirebaseMark },
  { name: "Tailwind", role: "Design system · 4 themes",                 accent: "cyan",   mark: TailwindMark },
  { name: "Fly.io",   role: "Two regions · auto-scale machines",        accent: "indigo", mark: FlyMark },
];

export function TechStackSlide() {
  return (
    <div className="relative h-full w-full px-12 py-10 flex flex-col">
      <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-6 self-start">
        <Layers className="h-3.5 w-3.5" />
        Foundation
      </div>

      <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
        The pieces that run METU
      </h2>
      <p className="text-base text-ink-secondary max-w-3xl mb-8">
        Eight tools, one codebase. The database is Postgres. The payment
        processor is Stripe. The deploy is Fly. Nothing here is a mock.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {STACK.map((s, i) => (
          <div
            key={s.name}
            className={`group rounded-xl ring-1 ${ACCENT_RING[s.accent]} bg-white/[0.03] backdrop-blur px-5 py-5 hover:bg-white/[0.06] transition-all duration-500`}
            style={{
              animation: `kiosk-stack-in 700ms ease-out both`,
              animationDelay: `${i * 90}ms`,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Brand mark with a soft floating animation. The class
                  varies the float per-card (via animationDelay below)
                  so the row doesn't pulse in lockstep — feels alive. */}
              <div
                className="h-10 w-10 shrink-0 opacity-90 group-hover:opacity-100 transition"
                style={{
                  animation: `kiosk-stack-float 4s ease-in-out infinite`,
                  animationDelay: `${(i * 250) % 1000}ms`,
                }}
              >
                {s.mark}
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl font-extrabold leading-tight">
                  {s.name}
                </div>
                <div className="text-[11px] text-ink-secondary mt-0.5 leading-snug">
                  {s.role}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-auto">
        <BigStat n={181} label="Automated tests" tint="text-mint" delay={800} />
        <BigStat n={43} label="DB migrations" tint="text-blue-300" delay={950} />
        <BigStat n={29} label="Tracked entities" tint="text-purple-300" delay={1100} />
      </div>

      <style jsx>{`
        @keyframes kiosk-stack-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes kiosk-stack-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes kiosk-stat-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function BigStat({
  n,
  label,
  tint,
  delay,
}: {
  n: number;
  label: string;
  tint: string;
  delay: number;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5"
      style={{
        animation: `kiosk-stat-in 600ms ease-out both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className={`font-display text-5xl md:text-6xl font-extrabold tabular-nums leading-none ${tint}`}>
        {n}
      </div>
      <div className="text-xs uppercase tracking-wider text-ink-dim mt-2">
        {label}
      </div>
    </div>
  );
}
