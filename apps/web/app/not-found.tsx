import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { NoResults } from "@/components/illustrations/NoResults";
import { Button } from "@/components/ui/Button";
import { getCategories } from "@/lib/server/queries";

export const metadata = { title: "Not found — METU" };

export default async function NotFound() {
  // Suggest a handful of categories so a confused visitor has somewhere
  // useful to click. Categories are cached for an hour upstream so this
  // doesn't pay a Neon roundtrip per 404.
  const categories = (await getCategories().catch(() => [])).slice(0, 8);

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

        {/* Wave-3 visual: the lucide Compass icon-in-a-circle was the
            generic "we got lost" trope. Swap to the bespoke NoResults
            SVG (coral-tinted) — same emotional register but in our
            palette and not a stock Lucide icon. The headline+number
            sits inside `surface-editorial` so it reads as a typographic
            moment, not just three text lines floating on the page. */}
        <div className="mt-12 mb-6">
          <NoResults className="h-32 w-32 text-coral" title="404 — page not found" />
        </div>

        <div className="surface-editorial rounded-3xl px-8 py-10 w-full max-w-xl">
          <h1 className="font-display text-7xl md:text-8xl font-black text-white tracking-tighter">
            404
          </h1>
          <div
            aria-hidden
            className="mx-auto mt-3 h-[3px] w-14 rounded-full bg-coral"
          />
          <p className="mt-6 text-xl font-display font-bold text-white">
            Lost in space.
          </p>
          <p className="mt-2 max-w-md mx-auto text-ink-secondary">
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

        {categories.length > 0 && (
          <div className="mt-12 w-full">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-dim mb-3">
              Or jump straight into a category
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {categories.map((c) => (
                <li key={c.categoryId}>
                  <Link
                    href={`/browse?category=${c.categoryId}`}
                    className="inline-flex rounded-full border border-line bg-space-850/80 px-3.5 py-1.5 text-sm text-white hover:border-mint/50 hover:text-mint transition"
                  >
                    {c.categoryName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
