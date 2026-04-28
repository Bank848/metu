/**
 * Cloudflare Turnstile verification (server-side). Mirrors the
 * BFF helper at apps/web/lib/server/turnstile.ts. No-op when
 * `TURNSTILE_SECRET` is unset (local dev / preview).
 */
const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; reason: "no-secret" | "verified" | "network-error" }
  | { ok: false; reason: "missing-token" | "rejected"; codes?: string[] };

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true, reason: "no-secret" };
  if (!token) return { ok: false, reason: "missing-token" };

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true, reason: "verified" };
    return { ok: false, reason: "rejected", codes: data["error-codes"] ?? [] };
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[turnstile] verify request failed; allowing through");
    return { ok: true, reason: "network-error" };
  }
}
