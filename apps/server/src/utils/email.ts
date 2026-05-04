/**
 * Tiny email facade — port of apps/web/lib/server/email.ts to the
 * Express server. Two providers:
 *   - "console"  (default): logs the message to stdout. The demo
 *                doesn't have real recipient infra, so this is what
 *                actually runs locally + on Fly. Tokens land in
 *                `flyctl logs -a metu-api`.
 *   - "resend"   (when RESEND_API_KEY is set): hits Resend's REST
 *                endpoint. Free tier covers far more than this demo
 *                will ever send. Falls back to console on any failure
 *                so a flaky API key never hard-blocks a flow.
 * Adding more providers later is a matter of dropping another branch
 * into `sendEmail`. Call sites stay identical.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Falls back to RESEND_FROM env or "no-reply@metu.local". */
  from?: string;
  /** Plain-text alternative — auto-derived from html when omitted. */
  text?: string;
};

export type SendEmailResult = {
  ok: boolean;
  provider: "console" | "resend";
  error?: string;
};

const DEFAULT_FROM = "no-reply@metu.local";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from ?? process.env.RESEND_FROM ?? DEFAULT_FROM;
  const text = input.text ?? stripHtml(input.html);

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ ...input, from, text });
  }
  return sendViaConsole({ ...input, from, text });
}

function sendViaConsole(input: SendEmailInput & { from: string; text: string }): SendEmailResult {
  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      "════════ METU EMAIL (console provider) ════════",
      `from:    ${input.from}`,
      `to:      ${input.to}`,
      `subject: ${input.subject}`,
      "── body ──",
      input.text,
      "════════════════════════════════════════════════",
      "",
    ].join("\n"),
  );
  return { ok: true, provider: "console" };
}

async function sendViaResend(
  input: SendEmailInput & { from: string; text: string },
): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      sendViaConsole(input);
      return { ok: false, provider: "resend", error: `${res.status} ${body.slice(0, 120)}` };
    }
    return { ok: true, provider: "resend" };
  } catch (err) {
    sendViaConsole(input);
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
