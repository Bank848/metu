// Forwards POST /auth/register to Express. Turnstile + profanity gate server-side.
//
// Phase 42: on a successful register, stamp a short-lived signed
// `metu_pv` cookie carrying the email so the verify pages can read it
// without it sitting in `?email=` query strings.
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
    res.headers.append("Set-Cookie", buildPendingVerifyCookie(pendingEmail));
  }
  return res;
}
