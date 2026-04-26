import { notFound } from "next/navigation";

/**
 * Phase 11 run #2 / F21 (CEO Decision 4) — convert /not-found to a true
 * HTTP 404.
 *
 * Background: visiting `/not-found` directly used to hit
 * `app/not-found.tsx` as a routable page with status 200, which leaked
 * the placeholder URL into search-engine indices and confused uptime
 * monitors. The previous implementation was a "demo affordance" linked
 * from the changelog so the QA team could see the 404 visual without
 * triggering an actual 404; per CEO Decision 4 the demo affordance is
 * dropped in favour of a strict-status response.
 *
 * Implementation: this page exists ONLY to call `notFound()` on every
 * request. Next.js then renders the sibling `app/not-found.tsx` UI
 * with HTTP status 404. The visual is unchanged — only the response
 * code now matches the screen.
 */
export default function NotFoundRoute(): never {
  notFound();
}
