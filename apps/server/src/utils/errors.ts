/**
 * AppError — the one error class controllers + services throw to
 * communicate intent (HTTP status + machine-readable code + human
 * message). Caught by `middleware/error.ts` and serialised to a
 * uniform JSON shape: `{ error: code, message }`.
 * Anything else thrown (raw Error, Prisma errors, etc.) → 500 +
 * full Pino log.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * optional structured payload echoed in the JSON
   * response. Used by the cart's `AlreadyOwned` error to surface
   * the existing `orderId` so the frontend can render a
   * "view your order" CTA without a follow-up round-trip.
   */
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
}
