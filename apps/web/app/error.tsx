"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[METU error boundary]", error);
  }, [error]);

  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-space-black">
      <StarField />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-2xl px-6 py-20 flex flex-col items-center text-center">
        <Logo size="lg" />
        <div className="mt-12 mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <AlertTriangle className="h-12 w-12" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-black text-white tracking-tighter">
          Something broke.
        </h1>
        <p className="mt-4 max-w-md text-ink-secondary">
          We hit an unexpected error rendering this page. Try again, or head
          back to the marketplace home.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-dim">ref: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button onClick={reset} variant="primary" size="lg">
            Try again
          </Button>
          <Button href="/" variant="ghost" size="lg">
            Back home
          </Button>
        </div>
      </div>
    </main>
  );
}
