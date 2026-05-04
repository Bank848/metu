import morgan from "morgan";

/**
 * Request logger — `morgan` chosen over `pino-http` to keep the dep
 * footprint identical to the existing scaffold (morgan was already
 * installed). Format flips on NODE_ENV: pretty `dev` lines locally,
 * compact `tiny` (method, url, status, response time) in prod for
 * cheap log aggregation.
 * If we ever need structured JSON logs (Sentry / Datadog), swap in
 * pino-http here — the rest of the app doesn't care.
 */
const FORMAT = process.env.NODE_ENV === "production" ? "tiny" : "dev";

export const loggerMiddleware = morgan(FORMAT);
