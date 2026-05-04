// Forwards POST /auth/login to Express via the BFF proxy.
// when login is blocked by the email-verify or phone-verify
// gate, also set a short-lived signed `metu_pv` cookie on the response
// so the /verify-pending and /verify-phone pages can read the user's
// email without it sitting in a `?email=` query string.
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";
import { buildPendingVerifyCookie } from "@/lib/server/pending-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Read the email up-front so we can stamp it into the cookie even
  // when the API rejects the call. Cloning preserves the body for the
  // forward.
  let pendingEmail: string | null = null;
  try {
    const cloned = req.clone();
    const body = (await cloned.json()) as { email?: unknown };
    if (typeof body?.email === "string" && body.email.includes("@")) {
      pendingEmail = body.email.trim();
    }
  } catch {
    // Body wasn't JSON; ignore — server-side validation will surface it.
  }

  const res = await forwardToApi(req, "/auth/login");

  // Only attach the cookie when the API explicitly told us we need to
  // verify. Avoids stamping it on every successful login.
  if (pendingEmail && (res.status === 403 || res.status === 401)) {
    try {
      const cloned = res.clone();
      const data = (await cloned.json()) as { error?: string };
      if (data?.error === "EmailNotVerified" || data?.error === "PhoneNotVerified") {
        res.headers.append("Set-Cookie", buildPendingVerifyCookie(pendingEmail));
      }
    } catch {
      // No JSON body — leave response untouched.
    }
  }
  return res;
}
