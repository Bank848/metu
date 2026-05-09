import type { RequestHandler } from "express";
import * as service from "../services/orders.service.js";
import { currentUser } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

// GET /gift/:orderId?t=<hmac>
// Public-by-token gift redemption. The /gift page on the web app calls
// this with the URL token. Anyone can hit the route, but license keys
// + download URLs only ship when (a) the token verifies and (b) the
// signed-in user's email matches the recipient on file.
export const getGift: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.orderId);
    if (!Number.isFinite(id) || id <= 0) throw new AppError(400, "BadId");
    const token = typeof req.query.t === "string" ? req.query.t : "";
    if (!token) {
      // Without a token we never even consult the order — deny early.
      res.status(400).json({ status: "invalid-token" });
      return;
    }
    const user = currentUser(req);
    const result = await service.getGiftAccess(id, token, user?.email ?? null);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
