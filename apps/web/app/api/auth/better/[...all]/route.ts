/**
 * BFF catch-all for better-auth — forwards /api/auth/better/<...> to
 * the same path on Express so OAuth redirect URLs resolve identically
 * on both sides. Set-Cookie passthrough gives the browser the session
 * cookie scoped to the BFF host. Both GET and POST are needed across
 * better-auth's surface (OAuth redirects vs JSON-body endpoints).
 */
import { type NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function targetPath(allSegments: string[], search: string) {
  const path = allSegments.length ? `/${allSegments.join("/")}` : "";
  return `/api/auth/better${path}${search}`;
}

export async function GET(req: NextRequest, { params }: { params: { all: string[] } }) {
  return forwardToApi(req, targetPath(params.all, req.nextUrl.search || ""));
}
export async function POST(req: NextRequest, { params }: { params: { all: string[] } }) {
  return forwardToApi(req, targetPath(params.all, req.nextUrl.search || ""));
}
export async function PATCH(req: NextRequest, { params }: { params: { all: string[] } }) {
  return forwardToApi(req, targetPath(params.all, req.nextUrl.search || ""));
}
export async function DELETE(req: NextRequest, { params }: { params: { all: string[] } }) {
  return forwardToApi(req, targetPath(params.all, req.nextUrl.search || ""));
}
