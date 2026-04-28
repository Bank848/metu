/**
 * Phase 13.2 — thin forwarder to Express `POST /auth/register`.
 * Turnstile + profanity guard now live server-side
 * (`apps/server/src/utils/{turnstile,profanity}.ts`); the BFF no
 * longer needs the legacy in-route logic.
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return forwardToApi(req, "/auth/register");
}
