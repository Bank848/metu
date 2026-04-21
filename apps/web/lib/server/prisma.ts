import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __metuPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__metuPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Stash the client on globalThis in every environment (not just dev). On
// Vercel each cold lambda is isolated, but several modules import this
// file within a single invocation; caching on globalThis avoids spinning
// up a second PrismaClient per invocation and the extra connection it
// would open against Neon.
globalThis.__metuPrisma = prisma;
