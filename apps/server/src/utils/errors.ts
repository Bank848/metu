/**
 * AppError — the one error class controllers + services throw to
 * communicate intent (HTTP status + machine-readable code + human
 * message). Caught by `middleware/error.ts` and serialised to a
 * uniform JSON shape: `{ error: code, message }`.
 *
 * Anything else thrown (raw Error, Prisma errors, etc.) → 500 +
 * full Pino log.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.name = "AppError";
  }
}
