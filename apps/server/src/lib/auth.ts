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
import { APIError } from "better-auth/api";
// Import the prisma adapter from its own package instead of the
// `better-auth/adapters/prisma` subpath. The subpath form re-exports
// from `@better-auth/prisma-adapter` via better-auth's dist .d.mts
// files; resolving that re-export through Node's module lookup was
// flaky in the Fly Docker build (worked locally, failed under
// `npm ci --ignore-scripts`). Direct import is identical at runtime
// and dodges the resolution chain entirely.
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "../db/prisma.js";

// Phase 14.3.5 — derive a unique username from a Google email so
// the User row satisfies our schema's UNIQUE+NOT NULL username
// constraint. Strategy: take the local-part (before @), strip
// non-alphanumeric, lowercase, append a 4-digit nonce on collision
// (retried up to 5 times before giving up). VARCHAR(20) cap so we
// never exceed the column limit even for long emails.
async function deriveUsername(email: string): Promise<string> {
  const root = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 14) || "user"; // empty input → "user"
  for (let i = 0; i < 5; i++) {
    const nonce = i === 0 ? "" : Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const candidate = (root + nonce).slice(0, 20);
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { userId: true },
    });
    if (!exists) return candidate;
  }
  // Last resort: timestamp-suffixed. Practically never hit but
  // guarantees we never throw a unique-constraint violation here.
  return `${root.slice(0, 10)}${Date.now() % 1_000_000}`.slice(0, 20);
}

// Split better-auth's `name` (a single string from the Google profile,
// e.g. "Jane Doe") into firstName + lastName. Our schema enforces
// NOT NULL on both. Empty surname falls back to a single dash so the
// VARCHAR(40) NOT NULL doesn't reject the insert; the user can fix
// it from /profile/edit later.
function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: "—", lastName: "—" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0].slice(0, 40);
  const lastName = (parts.slice(1).join(" ") || "—").slice(0, 40);
  return { firstName, lastName };
}

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

  // Phase 14.3.5 — linking fork + missing-field defaults.
  //
  // When a Google sign-in completes, better-auth tries to insert a
  // User row using ONLY { name, email, image } from the Google
  // profile. Our schema requires more (firstName, lastName, username
  // — all NOT NULL). The hook fills in those fields AND rejects with
  // 409 EmailAlreadyRegistered if a non-deleted local account exists
  // at the same email (security: anyone can create a Google account
  // with someone else's email, so silently auto-linking would be a
  // free account-takeover vector).
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Email collision check. Soft-deleted accounts don't count
          // (admin can re-enable; matching against a deleted ghost
          // would block legitimate fresh signups by the same person).
          const existing = await prisma.user.findFirst({
            where: { email: user.email, deletedAt: null },
            select: { userId: true },
          });
          if (existing) {
            // 409. better-auth surfaces this as the OAuth flow's
            // error response; the client lands on
            // /login?error=email-exists via the errorCallbackURL
            // query param the Google button sets.
            throw new APIError("CONFLICT", {
              message: "EmailAlreadyRegistered",
            });
          }

          // Fill in our schema's NOT NULL fields that better-auth
          // doesn't know about. better-auth's `name` becomes our
          // firstName via the user.fields mapping; we ALSO populate
          // lastName + username here.
          const { firstName, lastName } = splitName(user.name);
          const username = await deriveUsername(user.email);

          return {
            data: {
              ...user,
              // The mapped `name` field lives in `firstName` per our
              // user.fields config; better-auth's runtime substitutes
              // the column name automatically. We pass firstName too
              // so it survives the round-trip cleanly.
              name: firstName,
              firstName,
              lastName,
              username,
            },
          };
        },
      },
    },
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
