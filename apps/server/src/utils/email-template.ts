// HTML email layout helper.
//
// Most email clients (Outlook, Gmail mobile, ProtonMail, etc.) render
// inline styles only - no <style> blocks, no external CSS, limited
// support for flexbox/grid. We use 600px-wide tables, hex colors only,
// and font-family fallbacks.

interface LayoutOptions {
  /** Big headline at the top of the body card. */
  heading: string;
  /** Plain prose paragraph(s) shown above the optional CTA. */
  intro?: string;
  /** Primary action button. */
  cta?: { label: string; url: string };
  /** Tiny fallback URL line shown under the CTA. */
  fallbackUrl?: string;
  /** Inner HTML rendered AFTER the CTA (for receipts: per-store cards). */
  bodyHtml?: string;
  /** Footer copyright. Defaults to current-year METU line. */
  footer?: string;
}

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

export function renderEmailLayout(opts: LayoutOptions): string {
  const year = new Date().getFullYear();
  const footer = opts.footer ?? `&copy; ${year} METU Marketplace`;

  const intro = opts.intro
    ? `<p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #475569;">${opts.intro}</p>`
    : "";

  const cta = opts.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
        <tr>
          <td style="border-radius: 999px; background: linear-gradient(180deg, #FFCC00 0%, #B26800 100%); box-shadow: 0 4px 16px -8px rgba(178, 104, 0, 0.6);">
            <a href="${escapeHtml(opts.cta.url)}"
              style="display: inline-block; padding: 14px 32px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: #1A1919; text-decoration: none; letter-spacing: 0.01em;">
              ${escapeHtml(opts.cta.label)} &rarr;
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const fallback = opts.fallbackUrl
    ? `
      <div style="margin: 16px 0 0; padding: 12px 16px; border-radius: 10px; background: #f8fafc; border-left: 3px solid #6EE7B7;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">
          Or paste this link
        </p>
        <a href="${escapeHtml(opts.fallbackUrl)}" style="font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; color: #047857; word-break: break-all; text-decoration: none;">
          ${escapeHtml(opts.fallbackUrl)}
        </a>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- Header: brand bar -->
          <tr>
            <td style="padding: 0 0 24px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius: 8px; background: linear-gradient(135deg, #FFCC00 0%, #B26800 100%); box-shadow: 0 2px 6px -2px rgba(178, 104, 0, 0.55);">
                      <tr>
                        <td width="34" height="34" align="center" valign="middle" style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 20px; font-weight: 900; color: #1a1919; line-height: 34px; padding: 0; letter-spacing: -0.02em;">
                          M
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #1a1919;">METU</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 8px; font-size: 11px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;">
                Digital Marketplace
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 16px; padding: 36px 36px 32px; box-shadow: 0 4px 24px -8px rgba(15, 23, 42, 0.08);">
              <h1 style="margin: 0 0 16px; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 24px; font-weight: 800; line-height: 1.25; letter-spacing: -0.01em; color: #0f172a;">
                ${escapeHtml(opts.heading)}
              </h1>
              ${intro}
              ${cta}
              ${fallback}
              ${opts.bodyHtml ?? ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 16px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #64748b;">
                ${footer}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                <a href="https://metu.fly.dev" style="color: #94a3b8; text-decoration: none;">metu.fly.dev</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
