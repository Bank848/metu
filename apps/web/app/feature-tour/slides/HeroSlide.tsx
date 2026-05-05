"use client";
import { Sparkles } from "lucide-react";
import { LiveCounter } from "../LiveCounter";
import { coinsCompact, thbToCoins } from "@/lib/format";
import type { KioskData } from "@/lib/server/kiosk";

export function HeroSlide({ data, active }: { data: KioskData; active: boolean }) {
  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center px-12 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/5 px-5 py-2 text-sm font-semibold text-mint mb-10">
        <Sparkles className="h-4 w-4" />
        CPE241 · Database Systems · KMUTT G.8
      </div>

      <h1 className="font-display text-7xl md:text-9xl font-extrabold leading-[0.95] tracking-tight">
        METU
      </h1>
      <p className="mt-6 text-2xl md:text-3xl text-ink-secondary max-w-3xl">
        A digital marketplace for Thai creators —
        <br />
        live payments, license keys, and a real database.
      </p>

      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-5 w-full max-w-5xl">
        <HeroStat label="Users" value={data.counts.users} active={active} />
        <HeroStat label="Stores" value={data.counts.stores} active={active} />
        <HeroStat label="Orders" value={data.counts.orders} active={active} />
        <HeroStat
          label="GMV"
          value={Math.round(thbToCoins(data.counts.gmv) / 100)}
          active={active}
          formatter={(n) => coinsCompact(n * 100)}
        />
      </div>

      <p className="mt-12 text-sm uppercase tracking-[0.3em] text-ink-dim">
        metu.online
      </p>
    </div>
  );
}

function HeroStat({
  label,
  value,
  active,
  formatter,
}: {
  label: string;
  value: number;
  active: boolean;
  formatter?: (n: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-6 py-7">
      <div className="text-xs uppercase tracking-wider text-ink-dim">{label}</div>
      <div className="font-display text-5xl md:text-6xl font-extrabold text-white mt-2 leading-none">
        <LiveCounter target={value} active={active} formatter={formatter} />
      </div>
    </div>
  );
}
