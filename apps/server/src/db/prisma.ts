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

if (process.env.NODE_ENV !== "production") {
  globalThis.__metuPrisma = prisma;
}
