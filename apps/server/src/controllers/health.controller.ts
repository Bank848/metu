import type { RequestHandler } from "express";
import { prisma } from "../db/prisma.js";

/**
 * GET /health — liveness + DB ping. Mirrors the legacy Next route
 * at `apps/web/app/api/health/route.ts` so we have a per-service
 * probe (Fly machine checks hit this).
 */
export const ping: RequestHandler = async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    const ms = Date.now() - t0;
    res.json({
      status: "ok",
      db: "connected",
      pingMs: ms,
      uptime: process.uptime(),
      sha: process.env.FLY_RELEASE_VERSION ?? process.env.GIT_SHA ?? "local",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
};
