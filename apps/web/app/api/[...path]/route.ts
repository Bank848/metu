// Catch-all forwarder for /api/* paths that don't need BFF logic.
// More specific routes (login, orders, profile export, etc.) win over
// this catch-all and stay where they are.
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function build(req: NextRequest, segments: string[]): string {
  return "/" + segments.join("/") + req.nextUrl.search;
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return forwardToApi(req, build(req, path));
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
