import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";
import { buildClearedPendingVerifyCookie } from "@/lib/server/pending-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = await forwardToApi(req, "/auth/verify-phone-register");
  // once the OTP is accepted, the verify pages no longer
  // need the email cookie. Clear it so the user can't accidentally
  // bypass the live session next time they land on /verify-phone.
  if (res.status === 200 || res.status === 204) {
    res.headers.append("Set-Cookie", buildClearedPendingVerifyCookie());
  }
  return res;
}
