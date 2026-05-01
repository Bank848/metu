import { prisma } from "../db/prisma.js";

// Reference-data lists for form dropdowns. Sorted alphabetically.

export async function listBusinessTypes() {
  return prisma.businessType.findMany({ orderBy: { name: "asc" } });
}

export async function listCountries() {
  return prisma.country.findMany({ orderBy: { name: "asc" } });
}
