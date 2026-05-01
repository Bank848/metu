import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";
import { buildPendingVerifyCookie, readPendingVerifyToken } from "@/lib/server/pending-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = await forwardToApi(req, "/auth/resend-phone-otp");
  // Phase 43 — when the API echoes a demo OTP (DEMO_REVEAL_TOKENS),
  // refresh the metu_pv cookie so /verify-phone shows the new code on
  // the next reload.
  if (res.status === 200) {
    try {
      const cloned = res.clone();
      const data = (await cloned.json()) as { demo?: { otp?: string } };
      if (data?.demo?.otp) {
        const cookieValue = req.cookies.get("metu_pv")?.value;
        const existing = readPendingVerifyToken(cookieValue);
        if (existing?.email) {
          res.headers.append(
            "Set-Cookie",
            buildPendingVerifyCookie({
              email: existing.email,
              otp: data.demo.otp,
              emailToken: existing.emailToken,
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
