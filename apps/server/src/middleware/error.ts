import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/errors.js";

/**
 * Express error handler — the LAST middleware mounted in `app.ts`.
 *
 * Contract:
 *   - `AppError` instances → `res.status(err.status).json({ error: err.code, message: err.message })`
 *   - Anything else → 500 + the message logged to stderr (Pino in
 *     prod). Prevents accidentally leaking stack traces / internal
 *     SQL errors to the client.
 *
 * Controllers + services should `throw new AppError(404, "ProductNotFound")`
 * rather than `res.status(404).json(...)` so the layer above stays
 * pure (no Express knowledge in services).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  // Unknown — log + generic 500.
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  res.status(500).json({
    error: "InternalServerError",
    message: err instanceof Error ? err.message : "Unknown error",
  });
};
