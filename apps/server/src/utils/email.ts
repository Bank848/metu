/**
 * Tiny email facade. Two providers:
 *   - "console" (default): logs to stdout.
 *   - "resend"  (when RESEND_API_KEY set): POSTs to Resend's REST API,
 *               falling back to console on any failure.
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

  // Header injection guard — refuse CR/LF in to/from/subject.
  assertHeaderSafe("to", input.to);
  assertHeaderSafe("subject", input.subject);
  assertHeaderSafe("from", from);

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ ...input, from, text });
  }
  return sendViaConsole({ ...input, from, text });
}

function assertHeaderSafe(field: string, value: string): void {
  if (typeof value !== "string") {
    throw new Error(`sendEmail: ${field} must be a string`);
  }
  if (/[\r\n]/.test(value)) {
    throw new Error(`sendEmail: ${field} contains CR/LF — header injection blocked`);
  }
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
