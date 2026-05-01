import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";
import { buildPendingVerifyCookie, readPendingVerifyToken } from "@/lib/server/pending-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = await forwardToApi(req, "/auth/resend-email-verify");
  // Phase 43 — when the API echoes a demo emailToken (DEMO_REVEAL_TOKENS),
  // stamp it back into the metu_pv cookie so /verify-pending shows the
  // updated link without a page reload from a fresh register flow.
  if (res.status === 200) {
    try {
      const cloned = res.clone();
      const data = (await cloned.json()) as { demo?: { emailToken?: string } };
      if (data?.demo?.emailToken) {
        const cookieValue = req.cookies.get("metu_pv")?.value;
        const existing = readPendingVerifyToken(cookieValue);
        if (existing?.email) {
          res.headers.append(
            "Set-Cookie",
            buildPendingVerifyCookie({
              email: existing.email,
              otp: existing.otp,
              emailToken: data.demo.emailToken,
            }),
          );
        }
      }
    } catch {
      // Response wasn't JSON / cookie missing — leave it alone.
    }
  }
  return res;
}
