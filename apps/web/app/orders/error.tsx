"use client";
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[orders error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-2xl border border-line bg-space-850 p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <AlertTriangle className="h-8 w-8" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-3 max-w-md mx-auto text-sm text-ink-secondary">
          We couldn't load your orders right now. Try again, or head back to the marketplace.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-dim">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button onClick={reset} variant="primary" size="md">
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-ink-secondary hover:text-white transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
