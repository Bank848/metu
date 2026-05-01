// Forwards POST /auth/register to Express. Turnstile + profanity gate server-side.
//
// Phase 42 → 43: on a successful register, stamp a short-lived signed
// `metu_pv` cookie carrying the email so the verify pages can read it
// without it sitting in `?email=` query strings. When the API echoes
// back demo OTP / email-verify token (DEMO_REVEAL_TOKENS=true on the
// server), include those in the cookie payload so the verify pages
// can show them inline — Resend sandbox sender + console-only SMS
// can't deliver them out-of-band during a live demo.
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";
import { buildPendingVerifyCookie } from "@/lib/server/pending-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let pendingEmail: string | null = null;
  try {
    const cloned = req.clone();
    const body = (await cloned.json()) as { email?: unknown };
    if (typeof body?.email === "string" && body.email.includes("@")) {
      pendingEmail = body.email.trim();
    }
  } catch {
    // Bad body — let the API surface the validation error.
  }

  const res = await forwardToApi(req, "/auth/register");
  if (pendingEmail && (res.status === 200 || res.status === 201)) {
    let demo: { otp?: string; emailToken?: string } | undefined;
    try {
      const cloned = res.clone();
      const data = (await cloned.json()) as { demo?: { otp?: string; emailToken?: string } };
      if (data?.demo) demo = data.demo;
    } catch {
      // Response wasn't JSON — fine, the cookie just carries the email.
    }
    res.headers.append(
      "Set-Cookie",
      buildPendingVerifyCookie({
        email: pendingEmail,
        otp: demo?.otp,
        emailToken: demo?.emailToken,
      }),
    );
  }
  return res;
}
