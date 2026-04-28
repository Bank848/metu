/**
 * LEGACY flat router — Phase 13.1 migrated `categories` + `tags`
 * out into per-resource layered files (see categories.routes.ts +
 * tags.routes.ts). The remaining endpoints (`business-types`,
 * `countries`) stay here until the Auth / Register migration
 * (Phase 13.2) refactors them into their own layered modules.
 *
 * Mounted at `/` in app.ts so the URLs stay `GET /business-types`
 * + `GET /countries`.
 */
import { Router } from "express";
import { prisma } from "../db/prisma.js";

export const catalogRouter = Router();

catalogRouter.get("/business-types", async (_req, res, next) => {
  try {
    const data = await prisma.businessType.findMany({ orderBy: { name: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/countries", async (_req, res, next) => {
  try {
    const data = await prisma.country.findMany({ orderBy: { name: "asc" } });
    res.json(data);
  } catch (err) {
    next(err);
  }
});
