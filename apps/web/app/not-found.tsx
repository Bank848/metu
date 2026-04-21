import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Not found — METU" };

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-space-black">
      <StarField />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-2xl px-6 py-20 flex flex-col items-center text-center">
        <Logo size="lg" />
        <div className="mt-12 mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-brand-yellow/15 text-brand-yellow">
          <Compass className="h-12 w-12" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-7xl md:text-8xl font-black text-white tracking-tighter">
          404
        </h1>
        <p className="mt-4 text-xl font-display font-bold text-white">
          Lost in space.
        </p>
        <p className="mt-2 max-w-md text-ink-secondary">
          The page you&rsquo;re looking for drifted off the map. Try browsing the
          marketplace instead — there&rsquo;s a lot to discover.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button href="/browse" variant="primary" size="lg">
            Browse marketplace →
          </Button>
          <Button href="/" variant="ghost" size="lg">
            Back home
          </Button>
        </div>
      </div>
    </main>
  );
}
