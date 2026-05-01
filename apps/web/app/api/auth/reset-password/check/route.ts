import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 42 — accept POST so the reset token travels in the request
// body, not the URL. The legacy GET form would land in BFF / Fly
// access logs which is a real leak vector.
export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/reset-password/check");
}
