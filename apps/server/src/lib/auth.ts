// better-auth instance, mounted via toNodeHandler() at /auth/better/*.
// Owns the session cookie for both password and Google sign-ins.
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
// Direct import of the adapter dodges a flaky re-export chain that
// fails under Fly's `npm ci --ignore-scripts` Docker build.
import { prismaAdapter } from "@better-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma as realPrisma } from "../db/prisma.js";

/**
 * better-auth hard-codes the user PK field name as `id`. Our schema
 * uses `userId`. We wrap prisma.user with a Proxy that mirrors
 * `userId` -> `id` on reads and rewrites `where: { id }` to
 * `where: { userId }` on the way in. Reads only; no writes touched.
 */
function mirrorUserIdToId<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => mirrorUserIdToId(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("userId" in v && !("id" in v)) {
      return { ...v, id: v.userId } as T;
    }
  }
  return value;
}

// Rewrite `where: { id: ... }` to `where: { userId: ... }` on every
// branch. Walks AND/OR/NOT recursively.
function rewriteIdToUserIdInWhere(where: unknown): unknown {
  if (Array.isArray(where)) return where.map(rewriteIdToUserIdInWhere);
  if (!where || typeof where !== "object") return where;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (key === "id") {
      out.userId = value;
    } else if (key === "AND" || key === "OR" || key === "NOT") {
      out[key] = rewriteIdToUserIdInWhere(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function rewriteUserArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  const a = args as Record<string, unknown>;
  if (!a.where) return a;
  return { ...a, where: rewriteIdToUserIdInWhere(a.where) };
}

const userProxy = new Proxy(realPrisma.user, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === "function" && typeof prop === "string" && /^find/.test(prop)) {
      return (args?: unknown) =>
        (value as (a?: unknown) => Promise<unknown>)
          .call(target, rewriteUserArgs(args))
          .then(mirrorUserIdToId);
    }
    return typeof value === "function" ? value.bind(target) : value;
  },
});

const prisma: typeof realPrisma = new Proxy(realPrisma, {
  get(target, prop, receiver) {
    if (prop === "user" || prop === "User") return userProxy as unknown as typeof realPrisma.user;
    return Reflect.get(target, prop, receiver);
  },
}) as typeof realPrisma;

// Derive a unique username from a Google email (local-part, lowercased,
// alphanumeric only, 4-digit nonce on collision, capped at 20 chars).
async function deriveUsername(email: string): Promise<string> {
  const root = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 14) || "user";
  for (let i = 0; i < 5; i++) {
    const nonce = i === 0 ? "" : Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const candidate = (root + nonce).slice(0, 20);
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { userId: true },
    });
    if (!exists) return candidate;
  }
  // Last resort: never hit in practice.
  return `${root.slice(0, 10)}${Date.now() % 1_000_000}`.slice(0, 20);
}

// Split a Google profile name into NOT-NULL firstName + lastName.
function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: "-", lastName: "-" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0].slice(0, 40);
  const lastName = (parts.slice(1).join(" ") || "-").slice(0, 40);
  return { firstName, lastName };
}

const ENABLE_GOOGLE = Boolean(process.env.GOOGLE_CLIENT_ID);

const SECRET =
  process.env.BETTER_AUTH_SECRET ??
  // Dev fallback. Prod MUST set BETTER_AUTH_SECRET.
  process.env.JWT_SECRET ??
  "dev-only-fallback-secret-change-in-production";

// Base URL is the BFF, not Express. The browser only ever talks to
// the BFF; cookies are scoped to that host.
const BASE_URL =
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: SECRET,
  baseURL: BASE_URL,
  // Same path on the BFF and Express so routes resolve identically.
  basePath: "/api/auth/better",

  // `serial` matches our autoincrement Int PKs.
  advanced: {
    database: {
      generateId: "serial",
    },
    // sameSite: "lax" so OAuth callbacks + Stripe Connect returns
    // keep the session. httpOnly + secure handle the rest.
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },

  // Map better-auth's expected fields onto our columns.
  user: {
    modelName: "User",
    fields: {
      name: "firstName",
      email: "email",
      emailVerified: "emailVerified",
      image: "profileImage",
      createdAt: "createdDate",
      updatedAt: "updatedAt",
    },
  },

  // Bcryptjs adapters so signInEmail can verify our existing hashes
  // (better-auth defaults to scrypt, which would reject every legacy row).
  emailAndPassword: {
    enabled: true,
    // Our /auth/register runs profanity + duplicate checks before signInEmail.
    autoSignIn: false,
    password: {
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
      hash: async (password) => bcrypt.hash(password, 10),
    },
  },

  // Fill in NOT NULL fields better-auth doesn't know about, and reject
  // Google sign-ins that collide with an existing local account
  // (silent auto-linking would be an account-takeover vector).
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const existing = await prisma.user.findFirst({
            where: { email: user.email, deletedAt: null },
            select: { userId: true },
          });
          if (existing) {
            throw new APIError("CONFLICT", {
              message: "EmailAlreadyRegistered",
            });
          }

          const { firstName, lastName } = splitName(user.name);
          const username = await deriveUsername(user.email);

          return {
            data: {
              ...user,
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

  // Google only mounts when credentials are present.
  ...(ENABLE_GOOGLE && {
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
  }),
});
