import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { humaniseZodError } from "../utils/zod-humanise.js";

// Duck-type ZodError so cross-realm/duplicate-zod copies still match.
function isZodError(err: unknown): err is ZodError {
  if (err instanceof ZodError) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; issues?: unknown };
  return e.name === "ZodError" && Array.isArray(e.issues);
}

/**
 * Express error handler. Maps AppError → status+code, ZodError → 400,
 * anything else → 500 (with a generic message in prod).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    // Spread optional `details` so structured fields reach the frontend.
    const body: Record<string, unknown> = { error: err.code, message: err.message };
    if (err.details) Object.assign(body, err.details);
    res.status(err.status).json(body);
    return;
  }
  if (isZodError(err)) {
    const { message, field } = humaniseZodError(err);
    res.status(400).json({ error: "ValidationError", message, field });
    return;
  }
  // Unknown — log + generic 500. Don't leak raw err.message in prod.
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  const isProd = process.env.NODE_ENV === "production";
  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({
    error: "InternalServerError",
    message: isProd ? "Server error — please try again." : rawMessage,
  });
};
