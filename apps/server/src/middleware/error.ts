import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { humaniseZodError } from "../utils/zod-humanise.js";

// Duck-type ZodError so we still catch instances coming from a
// duplicated zod copy (test runner / monorepo workspace) where
// `instanceof` would lie.
function isZodError(err: unknown): err is ZodError {
  if (err instanceof ZodError) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; issues?: unknown };
  return e.name === "ZodError" && Array.isArray(e.issues);
}

/**
 * Express error handler — the LAST middleware mounted in `app.ts`.
 * Contract:
 *   - `AppError` instances → `res.status(err.status).json({ error: err.code, message: err.message })`
 *   - `ZodError` instances → 400 + a single human sentence picked from
 *     the first issue (no raw issues array).
 *   - Anything else → 500 + the message logged to stderr (Pino in
 *     prod). Prevents accidentally leaking stack traces / internal
 *     SQL errors to the client.
 * Controllers + services should `throw new AppError(404, "ProductNotFound")`
 * rather than `res.status(404).json(...)` so the layer above stays
 * pure (no Express knowledge in services).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    // spread the optional `details` payload so
    // structured error data (e.g. AlreadyOwned's orderId) reaches
    // the frontend without a follow-up request. Falsy details are
    // skipped so the response shape stays clean for ordinary errors.
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
  // Unknown — log + generic 500.
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  // CRITICAL: don't leak the raw err.message to the client in
  // production. Prisma errors include schema info (table + column
  // names + types), Stripe errors quote internal IDs, native module
  // errors leak file paths. Earlier rev returned `err.message`
  // verbatim, so any unhandled crash surfaced internals to whoever
  // poked at the API. Keep raw messages in dev for debuggability.
  const isProd = process.env.NODE_ENV === "production";
  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({
    error: "InternalServerError",
    message: isProd ? "Server error — please try again." : rawMessage,
  });
};
