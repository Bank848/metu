/**
 * Shared test helpers for the Phase 16.3 Mode A swap.
 *
 * Tests mock `../src/lib/auth.js` so `auth.api.getSession()` returns
 * whatever the test wants. Per-test, they call `signedInAs(uid)` to
 * fake an authenticated request (req.user resolves to that uid via
 * middleware/auth.ts) or `signedOut()` to flip back to anonymous.
 *
 * The cookie value passed to supertest's `.set("Cookie", ...)` is
 * irrelevant — better-auth's getSession is fully mocked so it never
 * reads the actual cookie. We still pass a placeholder so requests
 * look "real" (some middleware paths do branch on cookie presence).
 *
 * Wiring (top of every test file that needs auth):
 *
 *   vi.mock("../src/lib/auth.js", () => {
 *     const getSession  = vi.fn(async () => null);
 *     const signInEmail = vi.fn(async () => new Response("", { status: 200, headers: { "set-cookie": "better-auth.session_token=fake; Path=/; HttpOnly" } }));
 *     const signOut     = vi.fn(async () => new Response("", { status: 200, headers: { "set-cookie": "better-auth.session_token=; Path=/; Max-Age=0" } }));
 *     const handler     = vi.fn(async () => new Response("", { status: 404 }));
 *     return { auth: { api: { getSession, signInEmail, signOut }, handler } };
 *   });
 *
 * Then call `signedInAs(7)` or `signedOut()` from inside an it().
 */
import { vi } from "vitest";

export const FAKE_COOKIE = "better-auth.session_token=fake-test-cookie";

/** Build a Headers.getSetCookie-compatible Web Response so the
 *  controller's `forwardSetCookieHeaders` helper has something to
 *  copy onto Express's response. */
export function buildSignInResponse(): Response {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "better-auth.session_token=fake-test-cookie; Path=/; HttpOnly; SameSite=Lax",
  );
  return new Response("", { status: 200, headers });
}

export function buildSignOutResponse(): Response {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "better-auth.session_token=; Path=/; Max-Age=0",
  );
  return new Response("", { status: 200, headers });
}

/**
 * Flip the auth.api.getSession mock to return a session for `uid`.
 * Caller is responsible for vi.mock'ing the auth module — we just
 * tweak the existing mock's return value.
 */
export async function signedInAs(uid: number, role: "buyer" | "seller" | "admin" = "buyer") {
  void role; // role today still resolves from prisma.user.stats — kept
             // in the signature so callers can document intent.
  const { auth } = await import("../src/lib/auth.js");
  (auth.api.getSession as any).mockResolvedValue({
    user: { id: String(uid) },
    session: {
      id: 1,
      userId: uid,
      token: "fake-test-token",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    },
  });
}

/** Reset getSession to return null (anonymous request). */
export async function signedOut() {
  const { auth } = await import("../src/lib/auth.js");
  (auth.api.getSession as any).mockResolvedValue(null);
}

/**
 * Convenience wrapper that combines signedInAs + returning the
 * standard fake cookie string for `.set("Cookie", cookieFor(7))`.
 */
export async function cookieFor(uid: number, role: "buyer" | "seller" | "admin" = "buyer"): Promise<string> {
  await signedInAs(uid, role);
  return FAKE_COOKIE;
}
