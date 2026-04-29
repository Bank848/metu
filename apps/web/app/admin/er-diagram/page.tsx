import type { Metadata } from "next";
import { ExternalLink, Network, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getErDiagramEmbedUrl } from "@/lib/admin/er-diagram";

export const metadata: Metadata = { title: "ER Diagram · Admin · METU" };
// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request — `force-static` would skip the auth check.
export const dynamic = "force-dynamic";

/**
 * Phase 21.1 — `/admin/er-diagram`.
 *
 * Embeds the team's Lucidchart crow-foot diagram via the published
 * "Full document URL" (Lucidchart File → Publish). Single env var
 * `NEXT_PUBLIC_ER_DIAGRAM_EMBED_URL` sources the iframe src so the
 * diagram can be rotated without a code change. When unset, the page
 * renders a "not configured" placeholder instead of a broken iframe.
 *
 * Trade-off vs rendering Mermaid live: Lucidchart is the team's
 * source-of-truth and supports collaborative edits + crow-foot
 * notation natively. Embedding via iframe means we never re-implement
 * the diagram in code — but it also means an offline reviewer can't
 * inspect it. The page exposes the underlying URL as a button so a
 * reviewer can open the canonical source in a new tab.
 */
export default function ErDiagramPage() {
  const embedUrl = getErDiagramEmbedUrl();

  return (
    <>
      <PageHeader
        title="ER Diagram"
        subtitle="Crow-foot schema · maintained in Lucidchart"
      />

      {embedUrl ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink-dim flex items-center gap-2">
              <Network className="h-4 w-4 text-metu-yellow" />
              Live from Lucidchart — pan / zoom inside the frame, or open in a new tab for fullscreen.
            </p>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-space-900 px-4 py-2 text-sm font-semibold text-white hover:border-brand-yellow/50 hover:text-brand-yellow transition"
            >
              Open in Lucidchart
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="w-full h-[calc(100vh-16rem)] min-h-[600px] rounded-2xl border border-line overflow-hidden bg-white">
            {/* Sandbox isolates the embed from our DOM (no shared cookies/
                storage) while still permitting the JS Lucidchart needs to
                run for pan/zoom. The diagram URL is validated to be
                lucid.app-only in getErDiagramEmbedUrl(). */}
            <iframe
              src={embedUrl}
              className="w-full h-full"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups"
              title="METU database ER diagram (crow-foot notation)"
              referrerPolicy="no-referrer"
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-8 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-display font-bold text-base text-amber-100 mb-1">
              ER diagram embed not configured
            </div>
            <div className="text-amber-100/80 mb-3">
              Set <code className="rounded bg-space-900 px-1.5 py-0.5 text-metu-yellow">
                NEXT_PUBLIC_ER_DIAGRAM_EMBED_URL
              </code>{" "}
              to a Lucidchart "Full document URL" (File → Publish in
              Lucidchart, then "Anyone with the link can view"). The
              env var must point at <code className="text-metu-yellow">lucid.app</code>;
              other domains are rejected as a defence against accidentally
              pasted URLs.
            </div>
            <div className="text-amber-100/80">
              Local rebuild after editing <code className="text-metu-yellow">.env</code> —
              the URL is baked into the static page at build time.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
