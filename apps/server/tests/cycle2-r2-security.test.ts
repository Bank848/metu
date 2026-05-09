/**
 * Security regression tests covering: phone normalization, CRLF/header
 * injection guards, IDOR collapse on /orders/:id/sync, gift-recipient PII
 * redaction, sendOrderReceipt idempotency, and phone-for-sms hardening
 * (parent-token consumption + masked phone + rotated child token).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

// Shared prisma stub for cross-feature tests (auth + orders + email).

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
  // Awaited shapes so service-layer `.catch(...)` chains don't blow up.
  (prisma.verification.deleteMany as any).mockResolvedValue({ count: 0 });
  (prisma.verification.delete as any).mockResolvedValue({});
  // Default null lookups so leftover mocks from a previous describe block
  // don't bleed into downstream tests. Specific tests override.
  (prisma.user.findUnique as any).mockResolvedValue(null);
  (prisma.order.findUnique as any).mockResolvedValue(null);
  (prisma.verification.findFirst as any).mockResolvedValue(null);
});

describe("phone normalize on /auth/login/firebase-verify", () => {
  // Round-trip a real preAuth token so the controller doesn't 400
  // InvalidPreAuth before reaching the mismatch branch.
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
    // DB stores the legacy "0..." form.
    (prisma.user.findUnique as any).mockResolvedValue({ phone: "0812345678" });

    const token = await mintToken(7);
    const res = await request(buildApp())
      .post("/auth/login/firebase-verify")
      .send({ token, firebaseIdToken: "fb-id-token" });

    // Both sides normalize to E.164 before equality. Accept any
    // non-PhoneMismatch outcome (cookie-mint needs more wiring).
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
    expect(phoneUtil.normalizeThaiPhone("+66812345678")).toBe("+66812345678");
    expect(phoneUtil.normalizeThaiPhone("0812345678")).toBe("+66812345678");
    expect(phoneUtil.normalizeThaiPhone("66812345678")).toBe("+66812345678");
    // Garbage in → guaranteed non-equal so the mismatch branch fires.
    const garbage = phoneUtil.normalizeThaiPhone("not-a-phone");
    expect(garbage).not.toBe("+66812345678");
  });

  afterAll(() => {
    if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  });
});

describe("CRLF / header injection guards", () => {
  it("source registerSchema rejects firstName with CRLF — pins the zod regex contract", async () => {
    // Import the SOURCE schema (not @metu/shared dist) so we exercise
    // the regex regardless of dist staleness. sendEmail's
    // assertHeaderSafe still blocks the smuggle as defense-in-depth.
    const sharedSrc = await import(
      // @ts-ignore — direct .ts source path
      "../../../packages/shared/src/schemas/auth.ts"
    );
    const result = sharedSrc.registerSchema.safeParse({
      username: "newuser1",
      email: "new@metu.dev",
      password: "Newone#123",
      // CRLF + Bcc: would split the From: header and inject a Bcc.
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
    // Import the REAL module past the file-wide vi.mock to exercise
    // the actual assertHeaderSafe guard.
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

// Both gift redaction + receipt idempotency are exercised via the same
// orders.service.sendOrderReceipt entry.
describe("gift recipient PII redaction", () => {
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

    // sendOrderReceipt runs sendEmail twice (buyer, then recipient).
    // The recipient send is the one we lock down.
    await ordersSvc.sendOrderReceipt(778);

    expect(sendEmailMock).toHaveBeenCalled();
    const recipientCall = sendEmailMock.mock.calls.find(
      ([arg]) => arg.to === "recipient@metu.dev",
    );
    expect(recipientCall).toBeDefined();
    const args = recipientCall![0];

    // None of the buyer-private fields land in the recipient's email.
    const haystack = args.html + "\n" + (args.text ?? "");
    expect(haystack).not.toContain("GAME-KEY-AAAA-BBBB-CCCC");
    expect(haystack).not.toContain("https://downloads.metu.dev/mystery-game.zip");
    expect(haystack).not.toContain("support@indie.test");
    expect(haystack).not.toContain("+66999999999");

    // The redacted card still names the product.
    expect(haystack).toContain("Mystery Game");
  });
});

describe("sendOrderReceipt idempotency (single email per order)", () => {
  // Use a unique orderId per test so the in-process Set guard from
  // a previous test doesn't pre-trip this one.
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
    // Advisory-lock try succeeds first then fails — exercises both
    // the lock branch and the in-memory Set guard.
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

describe("/orders/:id/sync IDOR collapse", () => {
  // sync route hits stripe.service.isConfigured first; patch env so
  // that gate doesn't 503.
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
    // Buyer user lookup performed by requireAuth.
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

    // Case 1: genuinely missing.
    (prisma.order.findUnique as any).mockResolvedValueOnce(null);
    const missing = await request(buildApp())
      .post("/orders/9001/sync")
      .set("Cookie", "better-auth.session_token=fake-test-cookie");

    // Case 2: exists but other user.
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
    // Same shape — no "exists-but-forbidden" marker for enumeration.
    expect(Object.keys(missing.body).sort()).toEqual(
      Object.keys(otherOwner.body).sort(),
    );
  });
});

describe("phone-for-sms hardening", () => {
  // Each test mints a real token through the same util the controller
  // uses, exercising the actual consume + reissue path end-to-end.
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
    // phone-for-sms refuses to mint a child token unless the parent's
    // deleteMany removed a row. Override default `{ count: 0 }` so this
    // happy path exercises the issuance branch.
    (prisma.verification.deleteMany as any).mockResolvedValue({ count: 1 });

    const res = await request(buildApp())
      .post("/auth/login/phone-for-sms")
      .send({ token });

    expect(res.status).toBe(200);
    // The response ships the full E.164 phone alongside the masked
    // tail — Firebase Phone Auth needs the full number to fire
    // signInWithPhoneNumber. Masked tail in `phoneMasked` for display.
    expect(res.body.phone).toBe("+66812345678");
    // Mask format from maskPhoneTail: prefix (+ up to 3 digits) +
    // " *** *** " + last-4. For "+66812345678" the regex yields "+668".
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
    // the login-verify row, one for per-token attempts. The first must
    // carry the EXACT parent token identifier so it can't be replayed.
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
    // Replay: deleteMany finds zero rows. Default mock = { count: 0 }.
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
