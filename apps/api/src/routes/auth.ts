import { Router } from "express";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema, updateProfileSchema } from "@metu/shared";
import { prisma } from "../lib/prisma.js";
import { clearToken, currentAuth, currentUser, issueToken, requireAuth } from "../lib/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const { username, email, password, firstName, lastName, countryId, gender } = parsed.data;

    const [dupUsername, dupEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { email } }),
    ]);
    if (dupUsername) {
      res.status(409).json({ error: "Conflict", field: "username" });
      return;
    }
    if (dupEmail) {
      res.status(409).json({ error: "Conflict", field: "email" });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username, email, firstName, lastName,
        countryId, gender,
        password: hash,
        stats: { create: { role: "buyer" } },
        carts: { create: { status: "active" } },
      },
      include: { stats: true },
    });

    issueToken(res, { uid: user.userId, role: user.stats?.role ?? "buyer" });
    res.json({
      user: sanitize(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { stats: true },
    });
    if (!user) {
      res.status(401).json({ error: "InvalidCredentials" });
      return;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      res.status(401).json({ error: "InvalidCredentials" });
      return;
    }
    // Ensure the user has an active cart (demo convenience)
    const activeCart = await prisma.cart.findFirst({
      where: { userId: user.userId, status: "active" },
    });
    if (!activeCart) {
      await prisma.cart.create({ data: { userId: user.userId, status: "active" } });
    }

    issueToken(res, { uid: user.userId, role: user.stats?.role ?? "buyer" });
    res.json({ user: sanitize(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth(), (req, res) => {
  const user = currentUser(req);
  res.json({ user: sanitize(user), role: currentAuth(req)?.role });
});

authRouter.patch("/me", requireAuth(), async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
      return;
    }
    const auth = currentAuth(req)!;
    const user = await prisma.user.update({
      where: { userId: auth.uid },
      data: parsed.data,
      include: { stats: true },
    });
    res.json({ user: sanitize(user) });
  } catch (err) {
    next(err);
  }
});

function sanitize(user: any) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}
