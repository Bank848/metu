import type { Request } from "express";

/**
 * Resolve the real client IP. Fly.io places 2 reverse proxies in front
 * of the machine; `req.ip` (with `trust proxy = 1`) returns the inner
 * Fly proxy address (`fdaa:*` or `172.x`), not the visitor. Fly emits
 * the canonical header `Fly-Client-IP` containing the real visitor IP.
 * Fall back to req.ip on local dev where the header isn't set.
 */
export function clientIp(req: Pick<Request, "ip" | "headers"> | undefined | null): string | null {
  if (!req) return null;
  const flyIp = req.headers["fly-client-ip"];
  if (typeof flyIp === "string" && flyIp.length > 0) return flyIp.slice(0, 45);
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]!.trim().slice(0, 45);
  return req.ip?.slice(0, 45) ?? null;
}
