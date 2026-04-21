import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — lightweight keep-warm + status probe.
 *
 * Hit every 4 minutes by Vercel Cron (see `apps/web/vercel.json`) so
 * Neon's serverless compute never idles long enough to cold-start
 * during demo hours. Also handy for a manual status check:
 *   curl https://metu-web-phi.vercel.app/api/health
 * returns DB ping time + git SHA so we can quickly tell if the deploy
 * is healthy and which commit is live.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      pingMs: Date.now() - started,
      uptime: process.uptime(),
      sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "disconnected",
        pingMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
