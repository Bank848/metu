import { prisma } from "../db/prisma.js";

/**
 * Phase 13.11 — reference data service. Both endpoints return small
 * static-ish lists that drive form dropdowns (become-seller +
 * register). Sorted alphabetically for deterministic UI.
 */

export async function listBusinessTypes() {
  return prisma.businessType.findMany({ orderBy: { name: "asc" } });
}

export async function listCountries() {
  return prisma.country.findMany({ orderBy: { name: "asc" } });
}
