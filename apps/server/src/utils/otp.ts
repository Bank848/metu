import crypto from "node:crypto";

// OTP utilities. 6-digit codes, hashed before storage, 5-minute TTL.
// Transports: console (default), twilio (when env present), disabled.

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

/** Uniformly random 6-digit code. */
export function generateCode(): string {
  return crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

// SHA-256 of "<userId>:<phone>:<code>" so a leaked code can't be
// verified against a different account or after a phone change.
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

// Send the code via the chosen transport.
export async function deliverCode(phone: string, code: string): Promise<void> {
  if (otpTransport === "disabled") {
    throw new Error("OTP transport disabled by env (OTP_TRANSPORT=disabled)");
  }
  if (otpTransport === "twilio") {
    await sendViaTwilio(phone, code);
    return;
  }
  // console transport: log to stdout for dev/CI.
  // eslint-disable-next-line no-console
  console.log(`[otp] code for ${phone} -> ${code} (expires in ${OTP_TTL_MIN}m)`);
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
