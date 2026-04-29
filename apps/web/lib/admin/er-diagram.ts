/**
 * Phase 21.1 — ER diagram source-of-truth pointer.
 *
 * The crow-foot diagram lives in Lucidchart (maintained by the team
 * outside the repo). The URL is exposed via NEXT_PUBLIC_ER_DIAGRAM_EMBED_URL
 * so it ships in the client bundle and the admin page renders without an
 * extra fetch. To rotate, regenerate the "Full document URL" via Lucidchart
 * File → Publish and replace the env value.
 *
 * Returns null when the env var is unset so the page can render a
 * "not configured" placeholder rather than a broken iframe.
 */
export function getErDiagramEmbedUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ER_DIAGRAM_EMBED_URL;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Defensive — only allow lucid.app URLs to land in the iframe src so a
  // misconfigured env (typo, accidentally pasted unrelated URL) can't
  // ship a third-party page into our admin chrome.
  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith("lucid.app")) return null;
    return trimmed;
  } catch {
    return null;
  }
}
