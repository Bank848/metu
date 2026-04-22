/**
 * Cloudflare Turnstile server-side verification.
 *
 * The widget on the client posts a one-time `cf-turnstile-response` token
 * along with the form. We POST it back to Cloudflare's siteverify endpoint
 * with our secret to confirm the user actually solved the challenge.
 *
 * In local dev / when `TURNSTILE_SECRET` isn't set, this is a no-op that
 * always returns ok. The widget on the client similarly only renders when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so the whole feature is opt-in
 * via env.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
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
  if (!secret) {
    // Dev / preview without the env — treat every submit as valid so local
    // testing isn't blocked. Production sets the env in Fly secrets.
    return { ok: true, reason: "no-secret" };
  }
  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: form,
      // Cloudflare's endpoint is fast — 5s is plenty.
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true, reason: "verified" };
    return { ok: false, reason: "rejected", codes: data["error-codes"] ?? [] };
  } catch {
    // Don't lock users out if Cloudflare is unreachable — log + accept.
    // For a high-stakes site we'd fail closed; for this demo, fail open.
    // eslint-disable-next-line no-console
    console.warn("[turnstile] verify request failed; allowing through");
    return { ok: true, reason: "network-error" };
  }
}
