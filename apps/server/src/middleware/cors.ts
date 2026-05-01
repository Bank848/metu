import cors from "cors";

// CORS allowlist. Single exact origin only (browsers ignore `*` when
// credentials:true). credentials:true so the auth cookie crosses.
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

export const corsMiddleware = cors({
  origin: ORIGIN,
  credentials: true,
});
