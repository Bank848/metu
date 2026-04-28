import cors from "cors";

/**
 * CORS allowlist — production reads `CORS_ORIGIN` (a single origin
 * for the BFF) from env; falls back to localhost:3000 for dev. We
 * keep `credentials: true` so the auth cookie crosses origins when
 * the BFF forwards it (Phase 13.2+).
 *
 * Why a single origin (not a wildcard): cookies + credentials
 * REQUIRE an exact origin echo on Access-Control-Allow-Origin.
 * `*` is silently ignored by the browser when credentials=true.
 */
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

export const corsMiddleware = cors({
  origin: ORIGIN,
  credentials: true,
});
