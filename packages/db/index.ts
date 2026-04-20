export * from "@prisma/client";
export { PrismaClient } from "@prisma/client";

import { PrismaClient } from "@prisma/client";

// Singleton pattern to prevent exhausting DB connections in dev hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __metuPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__metuPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__metuPrisma = prisma;
}
