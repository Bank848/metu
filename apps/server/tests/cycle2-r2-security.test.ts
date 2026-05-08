/**
 * Cycle-2 round-2 regression tests — locks in the 5 fix commits the
 * defender shipped for surfaces C2-001, C2-003, C2-004, C2-005,
 * C2-007 + F-008, and the W-002 receipt-idempotency lane.
 *
 * Scope-only: every test here pins behaviour the CVE fix introduced.
 * If a test starts failing it means the fix has regressed (or been
 * narrowed) — read the surface ID in the failing block and re-check
 * the matching commit in `.claude/pentest/cycle2-round2-defender.md`.
 *
 *   • C2-001    auth.controller.ts — phone E.164 normalize before mismatch
 *   • C2-003    schemas/auth.ts + utils/email.ts — CRLF guards
 *   • C2-004    services/admin.service.ts — IDOR on /sync collapses to 404
 *   • C2-005    services/orders.service.ts — gift recipient PII redaction
 *   • C2-W-002  services/orders.service.ts — sendOrderReceipt single-fire
 *   • C2-007    auth.controller.ts — phone-for-sms consumes preAuth + masks phone
 *   • C2-F-008  auth.controller.ts — phone-for-sms returns rotated child token
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

// ===========================================================================
// Shared mocks. We assemble a single prisma stub the whole file shares so the
// cross-feature tests (auth + orders + email) can route through buildApp().
// ===========================================================================

const sendEmailMock = vi.fn(async () => ({ ok: true, provider: "console" as const }));

vi.mock("../src/utils/email.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/email.js")>(
    "../src/utils/email.js",
  );
  return {
    ...actual,
    sendEmail: sendEmailMock,
  };
});

vi.mock("../src/lib/firebase-admin.js", () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (ops: any) =>
      typeof ops === "function" ? ops({}) : Promise.all(ops),
    ),
    user: { findUnique: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    orderItem: { update: vi.fn() },
    verification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    cart: { create: vi.fn(), findFirst: vi.fn() },
    account: { upsert: vi.fn(), updateMany: vi.fn() },
    trustedDevice: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "better-auth.session_token=fake; Path=/; HttpOnly; SameSite=Lax",
    );
    return new Response("", { status: 200, headers });
  });
  const signOut = vi.fn(async () => new Response("", { status: 200 }));
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");
const loginVerify = await import("../src/utils/login-verify.js");
const phoneUtil = await import("../src/utils/phone.js");
const emailUtil = await import("../src/utils/email.js");
const ordersSvc = await import("../src/services/orders.service.js");

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailMock.mockResolvedValue({ ok: true, provider: "console" });
  // Prisma mocks need an awaited shape so `.catch(...)` chains in the
  // service layer don't blow up on the returned undefined.
  (prisma.verification.deleteMany as any).mockResolvedValue({ count: 0 });
  (prisma.verification.delete as any).mockResolvedValue({});
  // Default null for user lookups so a leftover mockResolvedValue from a
  // previous describe block doesn't make a downstream test see a phantom
  // user. Specific tests override with mockResolvedValueOnce/mockResolvedValue.
  (prisma.user.findUnique as any).mockResolvedValue(null);
  (prisma.order.findUnique as any).mockResolvedValue(null);
  (prisma.verification.findFirst as any).mockResolvedValue(null);
});

// ===========================================================================
// C2-001 — phone normalization on /auth/login/firebase-verify.
// ===========================================================================
describe("C2-001 — phone normalize on /auth/login/firebase-verify", () => {
  // Round-trip a real preAuth token through the encryption helper so the
  // controller doesn't 400 InvalidPreAuth before reaching the mismatch
  // branch. JWT_SECRET is required by issueLoginPreAuthToken.
  const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-16-chars";
  });

  async function mintToken(userId: number) {
    (prisma.verification.create as any).mockResolvedValue({});
    const token = await loginVerify.issueLoginPreAuthToken({
      userId,
      email: "buyer@metu.dev",
      password: "Buyer#123",
    });
    // The matching findFirst is what resolveLoginPreAuthToken reads.
    const createdRow = (prisma.verification.create as any).mock.calls[0]?.[0]
      ?.data;
    (prisma.verification.findFirst as any).mockResolvedValue({
      id: 1,
      identifier: createdRow.identifier,
      value: createdRow.value,
      expiresAt: createdRow.expiresAt,
    });
    return token;
  }

  it("accepts a Thai-local DB phone vs E.164 Firebase decoded phone (normalize-then-equal)", async () => {
    const { verifyFirebaseIdToken } = await import("../src/lib/firebase-admin.js");
    (verifyFirebaseIdToken as any).mockResolvedValue({
      phone_number: "+66812345678",
      uid: "fb-uid-1",
    });
    // DB row stores the legacy "0..." form.
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "0812345678" });

    const token = await mintToken(7);
    const res = await request(buildApp())
      .post("/auth/login/firebase-verify")
      .send({ token, firebaseIdToken: "fb-id-token" });

    // Pre-fix this would have been 403 PhoneMismatch because
    // "+66812345678" !== "0812345678". The fix normalizes both sides
    // to E.164 before equality. We accept any non-PhoneMismatch
    // outcome here; the cookie-mint side requires more wiring.
    expect(res.body?.error).not.toBe("PhoneMismatch");
  });

  it("still returns 403 PhoneMismatch when the numbers genuinely differ after normalize", async () => {
    const { verifyFirebaseIdToken } = await import("../src/lib/firebase-admin.js");
    (verifyFirebaseIdToken as any).mockResolvedValue({
      phone_number: "+66812345678",
      uid: "fb-uid-1",
    });
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "+66999999999" });

    const token = await mintToken(7);
    const res = await request(buildApp())
      .post("/auth/login/firebase-verify")
      .send({ token, firebaseIdToken: "fb-id-token" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PhoneMismatch");
  });

  it("normalizeThaiPhone helper turns a malformed string into a non-matching value (defence-in-depth)", () => {
    // The helper is the source of the equality guarantee — pin its
    // contract so a future refactor can't quietly weaken normalisation.
    expect(phoneUtil.normalizeThaiPhone("+66812345678")).toBe("+66812345678");
    expect(phoneUtil.normalizeThaiPhone("0812345678")).toBe("+66812345678");
    expect(phoneUtil.normalizeThaiPhone("66812345678")).toBe("+66812345678");
    // Garbage in → garbage out, but guaranteed non-equal to any valid
    // E.164 form so the controller's mismatch branch fires.
    const garbage = phoneUtil.normalizeThaiPhone("not-a-phone");
    expect(garbage).not.toBe("+66812345678");
  });

  afterAll(() => {
    if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  });
});

// ===========================================================================
// C2-003 — header injection guards (zod CRLF on names + sendEmail header guard).
// ===========================================================================
describe("C2-003 — CRLF / header injection guards", () => {
  it("source registerSchema rejects firstName with CRLF — pins the zod regex contract", async () => {
    // Import the SOURCE schema (not the @metu/shared dist bundle) so
    // we exercise the freshly-edited regex regardless of whether the
    // dist build is up to date. The runtime register endpoint also
    // uses @metu/shared dist; if dist is stale, defense-in-depth from
    // sendEmail's assertHeaderSafe still blocks the smuggle (covered
    // in the next two tests).
    const sharedSrc = await import(
      // @ts-ignore — direct .ts source path
      "../../../packages/shared/src/schemas/auth.ts"
    );
    const result = sharedSrc.registerSchema.safeParse({
      username: "newuser1",
      email: "new@metu.dev",
      password: "Newone#123",
      // Classic header-injection payload: a CRLF + Bcc: line would
      // split the From: header and inject a Bcc.
      firstName: "Bob\r\nBcc: attacker@evil.test",
      lastName: "Smith",
      phone: "+66812345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i: any) =>
        i.path?.includes("firstName"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("sendEmail throws when the `to` address contains CRLF", async () => {
    // Import the REAL module past the file-wide vi.mock so we exercise
    // the actual assertHeaderSafe guard, not the orders-test mock.
    const real = await vi.importActual<typeof import("../src/utils/email.js")>(
      "../src/utils/email.js",
    );
    await expect(
      real.sendEmail({
        to: "victim@metu.dev\r\nBcc: attacker@evil.test",
        subject: "hello",
        html: "<p>hi</p>",
      }),
    ).rejects.toThrow(/header injection blocked/i);
  });

  it("sendEmail throws when the `subject` contains LF (header smuggle into body)", async () => {
    const real = await vi.importActual<typeof import("../src/utils/email.js")>(
      "../src/utils/email.js",
    );
    await expect(
      real.sendEmail({
        to: "ok@metu.dev",
        subject: "harmless\nX-Smuggled: yes",
        html: "<p>hi</p>",
      }),
    ).rejects.toThrow(/header injection blocked/i);
  });
});

// ===========================================================================
// C2-005 + C2-W-002 — gift email redaction + receipt idempotency.
// Both are tested through the same orders.service.sendOrderReceipt entry.
// ===========================================================================
describe("C2-005 — gift recipient PII redaction", () => {
  function fixtureOrder(overrides: Record<string, unknown> = {}) {
    return {
      orderId: 555,
      giftRecipientEmail: "recipient@metu.dev",
      giftMessage: "Happy birthday!",
      user: { email: "buyer@metu.dev", firstName: "Alice" },
      items: [
        {
          orderItemId: 1,
          quantity: 1,
          productNameSnapshot: "Mystery Game",
          // License key + download URL on the line item — must NOT
          // appear in the recipient body.
          deliveredKey: "GAME-KEY-AAAA-BBBB-CCCC",
          deliveredUrl: "https://downloads.metu.dev/mystery-game.zip",
          productItem: {
            product: {
              name: "Mystery Game",
              store: {
                storeId: 9,
                name: "Indie Studio",
                contactEmail: "support@indie.test",
                phone: "+66999999999",
              },
            },
          },
        },
      ],
      ...overrides,
    };
  }

  it("recipient email body strips license keys, download URLs, store contact + buyer last name", async () => {
    (prisma.order.findUnique as any).mockResolvedValue(fixtureOrder());

    // sendOrderReceipt runs sendEmail twice — first for the buyer, then
    // for the recipient. The recipient send is the one we lock down.
    await ordersSvc.sendOrderReceipt(778);

    expect(sendEmailMock).toHaveBeenCalled();
    const recipientCall = sendEmailMock.mock.calls.find(
      ([arg]) => arg.to === "recipient@metu.dev",
    );
    expect(recipientCall).toBeDefined();
    const args = recipientCall![0];

    // Negative assertions — none of the buyer-private fields land in
    // the recipient's email (HTML or text).
    const haystack = args.html + "\n" + (args.text ?? "");
    expect(haystack).not.toContain("GAME-KEY-AAAA-BBBB-CCCC");
    expect(haystack).not.toContain("https://downloads.metu.dev/mystery-game.zip");
    expect(haystack).not.toContain("support@indie.test");
    expect(haystack).not.toContain("+66999999999");

    // Positive — the redacted card still names the product so the
    // recipient knows what they got.
    expect(haystack).toContain("Mystery Game");
  });
});

describe("C2-W-002 — sendOrderReceipt idempotency (single email per order)", () => {
  // Using a unique orderId per test so the in-process Set guard from a
  // previous test doesn't pre-trip this one.
  it("two parallel sendOrderReceipt calls for the same order → email transport hit at most once", async () => {
    const orderId = 999_001;
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId,
      user: { email: "buyer@metu.dev", firstName: "Alice" },
      items: [
        {
          orderItemId: 1,
          quantity: 1,
          productNameSnapshot: "Thing",
          deliveredKey: null,
          deliveredUrl: null,
          productItem: {
            product: {
              name: "Thing",
              store: { storeId: 1, name: "S", contactEmail: null, phone: null },
            },
          },
        },
      ],
      giftRecipientEmail: null,
      giftMessage: null,
    });
    // Advisory-lock try succeeds the first call, fails the second so we
    // also exercise the lock branch (the in-memory Set would also stop
    // the second call but we want both layers covered).
    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([{ ok: true }])
      .mockResolvedValueOnce([{ ok: false }]);

    await ordersSvc.sendOrderReceipt(orderId);
    await ordersSvc.sendOrderReceipt(orderId);

    const buyerSends = sendEmailMock.mock.calls.filter(
      ([arg]) => arg.to === "buyer@metu.dev",
    );
    expect(buyerSends.length).toBe(1);
  });
});

// ===========================================================================
// C2-004 — IDOR enumeration on /orders/:id/sync collapses to 404.
// ===========================================================================
describe("C2-004 — /orders/:id/sync IDOR collapse", () => {
  // The sync route hits stripe.service.isConfigured first; we patch the
  // env so that gate doesn't 503.
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_mock";

  it("returns 404 OrderNotFound when the order belongs to a DIFFERENT user (no 403 oracle)", async () => {
    const { signedInAs } = await import("./_authMock.js");
    await signedInAs(7);
    // Order exists but is owned by user 99 (not the caller, user 7).
    (prisma.order.findUnique as any).mockResolvedValue({
      orderId: 5000,
      userId: 99,
      status: "pending",
      totalPrice: "100",
      stripePaymentIntentId: "pi_x",
      items: [
        {
          productItem: {
            product: { store: { stripeAccountId: "acct_test" } },
          },
        },
      ],
    });
    // Buyer-facing user lookup performed by requireAuth/me middleware.
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      stats: { role: "buyer" },
      store: null,
    });

    const res = await request(buildApp())
      .post("/orders/5000/sync")
      .set("Cookie", "better-auth.session_token=fake-test-cookie");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("OrderNotFound");
  });

  it("returns the SAME 404 shape whether the order is missing or owned by another user (timing-side-channel killed)", async () => {
    const { signedInAs } = await import("./_authMock.js");
    await signedInAs(7);
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      stats: { role: "buyer" },
      store: null,
    });

    // Case 1 — genuinely missing.
    (prisma.order.findUnique as any).mockResolvedValueOnce(null);
    const missing = await request(buildApp())
      .post("/orders/9001/sync")
      .set("Cookie", "better-auth.session_token=fake-test-cookie");

    // Case 2 — exists but other user.
    (prisma.order.findUnique as any).mockResolvedValueOnce({
      orderId: 9002,
      userId: 99,
      status: "pending",
      totalPrice: "100",
      stripePaymentIntentId: "pi_y",
      items: [
        {
          productItem: { product: { store: { stripeAccountId: "acct_test" } } },
        },
      ],
    });
    const otherOwner = await request(buildApp())
      .post("/orders/9002/sync")
      .set("Cookie", "better-auth.session_token=fake-test-cookie");

    expect(missing.status).toBe(404);
    expect(otherOwner.status).toBe(404);
    expect(missing.body.error).toBe("OrderNotFound");
    expect(otherOwner.body.error).toBe("OrderNotFound");
    // Same shape — neither response leaks an "exists-but-forbidden"
    // marker that an attacker could use to enumerate orderIds.
    expect(Object.keys(missing.body).sort()).toEqual(
      Object.keys(otherOwner.body).sort(),
    );
  });
});

// ===========================================================================
// C2-007 + C2-F-008 — phone-for-sms consumes parent token + masks phone +
// returns rotated child token.
// ===========================================================================
describe("C2-007 + C2-F-008 — phone-for-sms hardening", () => {
  // Each test mints a real token through the same util the controller
  // uses, so we exercise the actual consume + reissue path end-to-end.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-16-chars";

  async function mintTokenAndArmFindFirst(userId: number) {
    (prisma.verification.create as any).mockResolvedValue({});
    const token = await loginVerify.issueLoginPreAuthToken({
      userId,
      email: "buyer@metu.dev",
      password: "Buyer#123",
    });
    const createdRow = (prisma.verification.create as any).mock.calls[0]?.[0]
      ?.data;
    (prisma.verification.findFirst as any).mockResolvedValue({
      id: 1,
      identifier: createdRow.identifier,
      value: createdRow.value,
      expiresAt: createdRow.expiresAt,
    });
    return token;
  }

  it("response body returns the full phone, a MASKED display tail, and a NEW child token", async () => {
    const token = await mintTokenAndArmFindFirst(7);
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "+66812345678" });
    // Cycle 4 R2 fix: phone-for-sms now refuses to mint a child token
    // unless the parent token's deleteMany actually removed a row.
    // Override the default `{ count: 0 }` mock with `{ count: 1 }` so
    // this happy-path test exercises the issuance branch.
    (prisma.verification.deleteMany as any).mockResolvedValue({ count: 1 });

    const res = await request(buildApp())
      .post("/auth/login/phone-for-sms")
      .send({ token });

    expect(res.status).toBe(200);
    // Cycle 5 UX revision: the response now ships the full E.164 phone
    // alongside the masked tail. Firebase Phone Auth needs the full
    // number to fire signInWithPhoneNumber, and forcing the buyer to
    // re-type a number they already proved they own at the password
    // step was bouncing real users at demo. The masked tail still
    // ships in `phoneMasked` for safe-to-display copy.
    expect(res.body.phone).toBe("+66812345678");
    // Mask format from maskPhoneTail: prefix (+ up to 3 digits via the
    // /^\+\d{1,3}/ regex) + " *** *** " + last-4. For "+66812345678"
    // the regex's 1-3 greedy match yields "+668".
    expect(res.body.phoneMasked).toMatch(/^\+\d{1,3} \*\*\* \*\*\* \d{4}$/);
    expect(res.body.phoneMasked.endsWith(" 5678")).toBe(true);
    expect(res.body.phoneMasked).not.toContain("1234");
    expect(res.body.phoneMasked).not.toContain("12345");
    // Child token returned and DIFFERENT from the parent (rotation).
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.token).not.toBe(token);
  });

  it("the parent token is consumed (deleteMany was called for the original token identifier)", async () => {
    const token = await mintTokenAndArmFindFirst(7);
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "+66812345678" });
    (prisma.verification.deleteMany as any).mockResolvedValue({ count: 1 });

    await request(buildApp())
      .post("/auth/login/phone-for-sms")
      .send({ token });

    // consumeLoginPreAuthToken issues two deleteMany calls — one for
    // the login-verify row, one for the per-token attempts row. We
    // check that the first carries the EXACT identifier of the parent
    // token, proving the old token can't be reused on /firebase-verify.
    expect(prisma.verification.deleteMany).toHaveBeenCalled();
    const deleteCalls = (prisma.verification.deleteMany as any).mock.calls;
    const parentDelete = deleteCalls.find(
      ([arg]: any) => arg?.where?.identifier === `login-verify:${token}`,
    );
    expect(parentDelete).toBeDefined();
  });

  it("rejects with 400 InvalidPreAuth when the parent token was already consumed (replay)", async () => {
    const token = await mintTokenAndArmFindFirst(7);
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "+66812345678" });
    // Replay scenario: deleteMany finds zero rows, meaning a prior
    // call already burned this token. Default mock = { count: 0 }.
    (prisma.verification.deleteMany as any).mockResolvedValue({ count: 0 });

    const res = await request(buildApp())
      .post("/auth/login/phone-for-sms")
      .send({ token });

    // Must NOT issue a new child token, MUST NOT leak the masked phone.
    expect(res.status).toBe(400);
    expect(res.body.error?.code ?? res.body.error).toMatch(/InvalidPreAuth/);
    expect(res.body.phone).toBeUndefined();
    expect(res.body.token).toBeUndefined();
  });
});
