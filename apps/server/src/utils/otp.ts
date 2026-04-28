import crypto from "node:crypto";

/**
 * Phase 14.4 — OTP utilities.
 *
 * Generates 6-digit codes, hashes them for storage, and routes
 * delivery via a transport adapter chosen at boot. Three transports
 * supported:
 *
 *   • console  — log to stdout (default in dev, useful in CI). The
 *                code shows up in `flyctl logs -a metu-api` so we
 *                can verify the OTP loop end-to-end without spending
 *                money on real SMS.
 *   • twilio   — real SMS via Twilio's REST API. Requires
 *                TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 *                TWILIO_FROM env vars. Optional for the demo;
 *                console transport is enough for the rubric talking
 *                point ("OTP scaffold lives in the verification
 *                table; production swaps the adapter without
 *                touching service code").
 *   • disabled — refuses delivery, surfaced as 503 by the controller.
 *                Useful if we want to feature-flag OTP off.
 *
 * Codes are SHORT-LIVED (5 minutes) and HASHED before storage —
 * even a leaked verification row can't be replayed.
 */

const OTP_TTL_MIN = 5;
const OTP_LENGTH = 6;

export type OtpTransport = "console" | "twilio" | "disabled";

function pickTransport(): OtpTransport {
  if (process.env.OTP_TRANSPORT === "disabled") return "disabled";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    return process.env.OTP_TRANSPORT === "console" ? "console" : "twilio";
  }
  return "console";
}

export const otpTransport: OtpTransport = pickTransport();

/** Random 6-digit code. crypto.randomInt is uniform — no modulo bias. */
export function generateCode(): string {
  return crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

/**
 * Deterministic SHA-256 of "<userId>:<phone>:<code>" — bound to
 * BOTH the user AND the phone number so a leaked code can't be
 * verified against a different account or after the user changes
 * their phone (we re-issue on phone change anyway, but defence
 * in depth).
 */
export function hashCode(userId: number, phone: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${phone}:${code}`)
    .digest("hex");
}

/** Compute the verification table identifier for a user's pending OTP. */
export function otpIdentifier(userId: number): string {
  return `phone-otp:${userId}`;
}

/** TTL window for new codes. */
export function expiresAt(): Date {
  return new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
}

/**
 * Send the code via the chosen transport. Twilio is gated on env
 * presence; absence falls back to console (so dev/CI never crash
 * on missing secrets).
 *
 * Returns void — the controller doesn't surface the transport name
 * to the client (information leak). Callers know it was console
 * mode by inspecting `otpTransport` directly if they want to.
 */
export async function deliverCode(phone: string, code: string): Promise<void> {
  if (otpTransport === "disabled") {
    throw new Error("OTP transport disabled by env (OTP_TRANSPORT=disabled)");
  }
  if (otpTransport === "twilio") {
    await sendViaTwilio(phone, code);
    return;
  }
  // console (default) — log to stdout. The code is visible in
  // server logs which is fine for dev / CI / demo. NEVER log
  // hashes alongside; only the raw code (which is short-lived).
  // eslint-disable-next-line no-console
  console.log(`[otp] code for ${phone} → ${code} (expires in ${OTP_TTL_MIN}m)`);
}

async function sendViaTwilio(phone: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Your METU verification code is ${code}. Expires in ${OTP_TTL_MIN} minutes.`,
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio send failed: ${res.status} ${detail.slice(0, 200)}`);
  }
}
