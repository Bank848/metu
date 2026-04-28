/**
 * Phase 14.1 — better-auth instance.
 *
 * The instance is mounted on Express via toNodeHandler() at
 * `/auth/better/*` (see app.ts). For Phase 14.1 it ships ONLY as
 * plumbing — no UI references it yet, no middleware swap. Smoke
 * test: GET /auth/better/get-session returns `{ session: null,
 * user: null }` for an anonymous request.
 *
 * Phase 14.2 will swap apps/server/src/middleware/auth.ts to read
 * better-auth's session via `auth.api.getSession({ headers })`
 * instead of verifying our hand-rolled JWT cookie. That's Mode A
 * from the plan (better-auth owns the cookie). Until then the
 * legacy /auth/login + /auth/register continue to mint our
 * `metu_auth` JWT cookie unchanged.
 *
 * Critical config notes
 *
 * • `advanced.database.generateId = "serial"` — every PK is Int.
 *   Matches our existing User.userId Int PK so Account.userId +
 *   Session.userId are clean Int → Int FKs. better-auth's runtime
 *   auto-converts string IDs to Int when reading/writing per the
 *   docs.
 *
 * • `user.fields.id = "userId"` — better-auth's notion of `id`
 *   maps to our column `user_id` via Prisma's @map. Same trick
 *   for `image → profile_image` and `emailVerified →
 *   email_verified`.
 *
 * • `user.fields.name = "firstName"` — better-auth wants a single
 *   `name` field; our schema splits firstName + lastName. We map
 *   to firstName for now; Phase 14.2's Google sign-in handler
 *   will populate firstName from the Google profile name.
 *
 * • Google provider only mounts when GOOGLE_CLIENT_ID is set, so
 *   local dev without OAuth credentials still boots cleanly.
 */
import { betterAuth } from "better-auth";
// Import the prisma adapter from its own package instead of the
// `better-auth/adapters/prisma` subpath. The subpath form re-exports
// from `@better-auth/prisma-adapter` via better-auth's dist .d.mts
// files; resolving that re-export through Node's module lookup was
// flaky in the Fly Docker build (worked locally, failed under
// `npm ci --ignore-scripts`). Direct import is identical at runtime
// and dodges the resolution chain entirely.
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "../db/prisma.js";

const ENABLE_GOOGLE = Boolean(process.env.GOOGLE_CLIENT_ID);

const SECRET =
  process.env.BETTER_AUTH_SECRET ??
  // Fall back to the existing JWT secret in dev so we don't need a
  // second env var. Production MUST set BETTER_AUTH_SECRET to a
  // distinct 32+ byte value.
  process.env.JWT_SECRET ??
  "dev-only-fallback-secret-change-in-production";

// Phase 14.2 — base URL is the BFF, not Express. better-auth uses
// this to generate OAuth callback URLs that Google must redirect
// to. The browser only ever talks to https://metu.fly.dev (or
// http://localhost:3000 in dev); the BFF then proxies
// /api/auth/better/* to Express. Cookies set in the response are
// scoped to the BFF host so they're sent on subsequent BFF
// requests (same scoping trick as our JWT cookie from Phase 13.2).
const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  // Local dev: Next on :3000 BFF-proxies to Express on :4000.
  "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: SECRET,
  baseURL: BASE_URL,
  // basePath matches the BFF-side path the browser hits; Express
  // mounts its catch-all at the same path so the routes resolve
  // identically inside better-auth regardless of which side of the
  // proxy hop we're on.
  basePath: "/api/auth/better",

  // Use auto-incrementing Int PKs across all better-auth tables to
  // match our existing User.user_id column type. Per the better-auth
  // docs: "Better-Auth will continue to infer the type of the id field
  // as a string for the database, but will automatically convert it
  // to a numeric type when fetching or inserting data."
  advanced: {
    database: {
      generateId: false,
    },
  },

  // Map better-auth's expected field names onto our existing columns.
  user: {
    modelName: "User",
    fields: {
      id: "userId",
      name: "firstName",
      email: "email",
      emailVerified: "emailVerified",
      image: "profileImage",
    },
  },

  // Email + password sign-in (compat with our existing /login form).
  // Phase 14.2 wires this up to the UI; Phase 14.1 just enables it.
  emailAndPassword: {
    enabled: true,
    // Don't auto-sign-in after signUp — keep the existing two-step UX.
    autoSignIn: false,
  },

  // Google OAuth — only mounts when credentials are present so local
  // dev boots without Google setup.
  ...(ENABLE_GOOGLE && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  }),
});
