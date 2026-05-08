import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { cookieFor } from "./_authMock.js";

vi.mock("../src/db/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      create: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    // Phase 14.4 — OTP storage uses better-auth's verification table.
    verification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Phase 15.2 — sessions UI reads/writes better-auth's session table.
    // Phase 49 — login also calls findFirst (newest session) to scope
    // the single-session deleteMany; default mock returns null so the
    // happy login path doesn't try to drop anything.
    session: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Phase 49 — admin-OTP gate hits trustedDevice.findUnique before
    // deciding whether to send the OTP. Default = no trusted device,
    // so guarded accounts always go through the OTP flow.
    trustedDevice: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      // changePassword + resetPassword nuke every trusted device row
      // for the user; the mock just needs to exist for the call.
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // Phase 16.3 — credential `account` row stays in sync with
    // user.password via syncCredentialAccount(). All four
    // password-write paths (register / changePassword / setPassword
    // / resetPassword) call upsert here.
    account: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../src/lib/auth.js", () => {
  const getSession = vi.fn(async () => null);
  const signInEmail = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=fake; Path=/; HttpOnly; SameSite=Lax");
    return new Response("", { status: 200, headers });
  });
  const signOut = vi.fn(async () => {
    const headers = new Headers();
    headers.append("set-cookie", "better-auth.session_token=; Path=/; Max-Age=0");
    return new Response("", { status: 200, headers });
  });
  const handler = vi.fn(async () => new Response("", { status: 404 }));
  return { auth: { api: { getSession, signInEmail, signOut }, handler } };
});

const { prisma } = await import("../src/db/prisma.js");
const { buildApp } = await import("../src/app.js");

beforeEach(async () => {
    const { signedOut } = await import("./_authMock.js");
    await signedOut();
  vi.clearAllMocks();
});

describe("POST /auth/login", () => {
  it("returns 401 NeedsVerify on valid credentials when device isn't trusted (universal verify gate)", async () => {
    // Behaviour change: every credential login now passes through a
    // second-factor confirmation unless the device is already trusted
    // (cookie + DB row) OR 2FA is on. Without a trust cookie or
    // totpCode, the response is 401 + a preAuthToken the client
    // hands back to /auth/login/verify.
    const hash = await bcrypt.hash("Buyer#123", 4);
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: hash,
      phone: "+66812345678",
      emailVerified: true,
      phoneVerifiedAt: new Date(),
      totpEnabled: false,
      stats: { role: "buyer" },
      carts: [{ cartId: 1 }],
    });
    (prisma.verification.create as any).mockResolvedValue({});

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "buyer@metu.dev", password: "Buyer#123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("NeedsVerify");
    expect(typeof res.body.preAuthToken).toBe("string");
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(res.body.channels.map((c: { id: string }) => c.id)).toContain("email");
  });

  it("returns 401 on wrong password", async () => {
    const hash = await bcrypt.hash("RealPassword", 4);
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: hash,
      stats: { role: "buyer" },
      carts: [],
    });
    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "buyer@metu.dev", password: "WrongPassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("InvalidCredentials");
  });

  it("returns 401 (not 404) on unknown email — doesn't leak account state", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "ghost@metu.dev", password: "anything123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("InvalidCredentials");
  });

  // Phase 49 — guarded admin demo account requires an email-OTP gate
  // before the session cookie is issued. The fingerprint registry in
  // admin-login-otp.ts only matches the prod recipient, so for tests
  // we set ADMIN_OTP_DEV_REVEAL=true which bypasses the registry +
  // returns the code in the response body.
  describe("Phase 49 — admin OTP gate", () => {
    const originalRecipient = process.env.ADMIN_OTP_RECIPIENT_EMAIL;
    const originalReveal = process.env.ADMIN_OTP_DEV_REVEAL;

    beforeEach(() => {
      process.env.ADMIN_OTP_RECIPIENT_EMAIL = "test-recipient@example.com";
      process.env.ADMIN_OTP_DEV_REVEAL = "true";
    });

    it("guarded account → first round returns 401 NeedsAdminOtp + masked recipient", async () => {
      const hash = await bcrypt.hash("Admin#123", 4);
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 1,
        email: "admin@metu.dev",
        password: hash,
        emailVerified: true,
        phoneVerifiedAt: new Date(),
        stats: { role: "admin" },
        carts: [{ cartId: 1 }],
      });

      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "admin@metu.dev", password: "Admin#123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("NeedsAdminOtp");
      expect(typeof res.body.recipientMasked).toBe("string");
      expect(res.body.recipientMasked).toMatch(/\*+/);
      // Verification row written so the second round can find it.
      expect(prisma.verification.create).toHaveBeenCalled();
    });

    it("guarded account → 400 OwnershipNotConfirmed when adminOtp present without confirmOwner", async () => {
      const hash = await bcrypt.hash("Admin#123", 4);
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 1,
        email: "admin@metu.dev",
        password: hash,
        emailVerified: true,
        phoneVerifiedAt: new Date(),
        stats: { role: "admin" },
        carts: [{ cartId: 1 }],
      });

      const res = await request(buildApp())
        .post("/auth/login")
        .send({
          email: "admin@metu.dev",
          password: "Admin#123",
          adminOtp: "123456",
          confirmOwner: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("OwnershipNotConfirmed");
    });

    afterEach(() => {
      if (originalRecipient === undefined) {
        delete process.env.ADMIN_OTP_RECIPIENT_EMAIL;
      } else {
        process.env.ADMIN_OTP_RECIPIENT_EMAIL = originalRecipient;
      }
      if (originalReveal === undefined) {
        delete process.env.ADMIN_OTP_DEV_REVEAL;
      } else {
        process.env.ADMIN_OTP_DEV_REVEAL = originalReveal;
      }
    });
  });
});

describe("POST /auth/register", () => {
  it("returns 409 when email is already taken", async () => {
    // First call (username dup check) returns null, second (email
    // dup check) returns a row.
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 99, email: "taken@metu.dev" });
    const res = await request(buildApp())
      .post("/auth/register")
      .send({
        username: "newone",
        email: "taken@metu.dev",
        password: "Newone#123",
        firstName: "New",
        lastName: "One",
        phone: "+66812345678",
      });
    expect(res.status).toBe(409);
    // Phase 43 — error codes split into UsernameTaken / EmailTaken so
    // the frontend can render a tailored message instead of the bare
    // word "email" / "username".
    expect(res.body.error).toBe("EmailTaken");
  });

  it("rejects profanity in display fields", async () => {
    const res = await request(buildApp())
      .post("/auth/register")
      .send({
        username: "niiggaboy",
        email: "boy@metu.dev",
        password: "Boy#1234",
        firstName: "First",
        lastName: "Last",
        phone: "+66812345678",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ProfanityRejected");
  });
});

describe("GET /auth/me", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(buildApp()).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("forgot-password always returns 200 + generic message (no enum leak)", async () => {
    // Email NOT in DB
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res1 = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "ghost@metu.dev" });
    expect(res1.status).toBe(200);
    expect(res1.body.message).toMatch(/if that email is registered/i);

    // Email IS in DB — same response shape, but a token was created
    // server-side (and an email "sent" via the console provider).
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      firstName: "Thana",
    });
    const res2 = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "buyer@metu.dev" });
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe(res1.body.message);
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
  });

  it("reset-password rejects expired/missing token with 400 InvalidToken", async () => {
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: "x".repeat(40), newPassword: "Newpass1!" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("InvalidToken");
  });

  it("never leaks the bcrypt hash on a successful read", async () => {
    // Mint a real cookie so requireAuth() resolves the user, then
    // verify the password field is stripped from the response.
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      email: "buyer@metu.dev",
      password: "$2a$10$shouldNeverEscape",
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .get("/auth/me")
      .set("Cookie", await cookieFor(7));
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(7);
    expect(res.body.user.password).toBeUndefined();
  });
});

// =============================================================================
//  Phase 14.3 — POST /auth/set-password
// =============================================================================
describe("POST /auth/set-password (Phase 14.3)", () => {

  it("returns 401 without auth", async () => {
    const res = await request(buildApp())
      .post("/auth/set-password")
      .send({ newPassword: "Newpass1!", confirmPassword: "Newpass1!" });
    expect(res.status).toBe(401);
  });

  it("returns 400 PasswordAlreadySet when user has a password", async () => {
    // requireAuth() resolves the user (with its existing password).
    (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
      // Two findUnique calls happen: one in requireAuth (no select),
      // one in service.setPassword (select: { password: true }).
      if (select?.password)
        return Promise.resolve({ password: "$2a$10$existinghash" });
      return Promise.resolve({
        userId: where.userId,
        stats: { role: "buyer" },
        store: null,
      });
    });
    const res = await request(buildApp())
      .post("/auth/set-password")
      .set("Cookie", await cookieFor(7))
      .send({ newPassword: "Newpass1!", confirmPassword: "Newpass1!" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("PasswordAlreadySet");
  });

  it("happy: hashes + persists + writes audit row when password was NULL (with email OTP)", async () => {
    // OAuth-only first-time set-password now requires SOME second
    // factor — for users with no phone + no 2FA the path is email
    // OTP. The test mocks the verification row that matches the
    // hashed OTP so the happy path completes.
    const code = "123456";
    const cryptoMod = await import("node:crypto");
    const expectedHash = cryptoMod.default
      .createHash("sha256")
      .update(`7:buyer@metu.dev:${code}`)
      .digest("hex");
    (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
      if (select?.password) {
        return Promise.resolve({
          password: null,
          phone: null,
          phoneVerifiedAt: null,
          email: "buyer@metu.dev",
          totpEnabled: false,
          totpSecret: null,
        });
      }
      return Promise.resolve({
        userId: where.userId,
        stats: { role: "buyer" },
        store: null,
      });
    });
    (prisma.verification.findFirst as any).mockResolvedValue({
      id: 99,
      identifier: "phone-otp:7",
      value: expectedHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    (prisma.verification.delete as any).mockResolvedValue({});
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.auditLog.create as any).mockResolvedValue({});

    const res = await request(buildApp())
      .post("/auth/set-password")
      .set("Cookie", await cookieFor(7))
      .send({ newPassword: "Newpass1!", confirmPassword: "Newpass1!", otpCode: code });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // user.update was called with a bcrypt hash (not the raw password).
    const updateCall = (prisma.user.update as any).mock.calls[0][0];
    expect(updateCall.where.userId).toBe(7);
    expect(updateCall.data.password).toMatch(/^\$2[ab]\$/);

    // audit log captures the action.
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "user.set_password",
        targetType: "user",
        targetId: 7,
      }),
    });
  });

  it("400 when newPassword + confirmPassword don't match", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      userId: 7,
      stats: { role: "buyer" },
      store: null,
    });
    const res = await request(buildApp())
      .post("/auth/set-password")
      .set("Cookie", await cookieFor(7))
      .send({ newPassword: "Newpass1!", confirmPassword: "different" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});

// =============================================================================
//  Phase 14.4 — phone + OTP scaffold
// =============================================================================
describe("Phase 14.4 — phone + OTP", () => {

  describe("PATCH /auth/phone", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp())
        .patch("/auth/phone")
        .send({ phone: "+66912345678" });
      expect(res.status).toBe(401);
    });

    it("400 ValidationError for non-phone-shaped string", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      const res = await request(buildApp())
        .patch("/auth/phone")
        .set("Cookie", await cookieFor(7))
        .send({ phone: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("ValidationError");
    });

    it("happy: normalises (strips non-digits) + clears phoneVerifiedAt", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      (prisma.user.update as any).mockResolvedValue({});
      const res = await request(buildApp())
        .patch("/auth/phone")
        .set("Cookie", await cookieFor(7))
        .send({ phone: "+66 (91) 234-5678" });
      expect(res.status).toBe(200);
      const call = (prisma.user.update as any).mock.calls[0][0];
      expect(call.where.userId).toBe(7);
      expect(call.data.phone).toBe("+66912345678"); // normalised
      expect(call.data.phoneVerifiedAt).toBeNull();
    });
  });

  describe("POST /auth/request-otp", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp()).post("/auth/request-otp").send({});
      expect(res.status).toBe(401);
    });

    it("400 NoPhoneOnFile when user hasn't set a phone yet", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone: null });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      const res = await request(buildApp())
        .post("/auth/request-otp")
        .set("Cookie", await cookieFor(7))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("NoPhoneOnFile");
    });

    it("happy: wipes pending OTP + creates fresh row", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone: "+66912345678" });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.verification.deleteMany as any).mockResolvedValue({ count: 0 });
      (prisma.verification.create as any).mockResolvedValue({});
      const res = await request(buildApp())
        .post("/auth/request-otp")
        .set("Cookie", await cookieFor(7))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prisma.verification.deleteMany).toHaveBeenCalledWith({
        where: { identifier: "phone-otp:7" },
      });
      const create = (prisma.verification.create as any).mock.calls[0][0];
      expect(create.data.identifier).toBe("phone-otp:7");
      expect(create.data.value).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
    });
  });

  describe("POST /auth/verify-otp", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .send({ code: "123456" });
      expect(res.status).toBe(401);
    });

    it("400 ValidationError for non-6-digit code", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .set("Cookie", await cookieFor(7))
        .send({ code: "abc" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("ValidationError");
    });

    it("400 NoPendingOtp when nothing was requested", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone: "+66912345678" });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.verification.findFirst as any).mockResolvedValue(null);
      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .set("Cookie", await cookieFor(7))
        .send({ code: "123456" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("NoPendingOtp");
    });

    it("400 OtpExpired + sweeps the stale row", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone: "+66912345678" });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.verification.findFirst as any).mockResolvedValue({
        id: 99,
        identifier: "phone-otp:7",
        value: "deadbeef",
        expiresAt: new Date(Date.now() - 1000), // 1s in the past
      });
      (prisma.verification.delete as any).mockResolvedValue({});
      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .set("Cookie", await cookieFor(7))
        .send({ code: "123456" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("OtpExpired");
      expect(prisma.verification.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    });

    it("400 InvalidOtp on hash mismatch", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone: "+66912345678" });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.verification.findFirst as any).mockResolvedValue({
        id: 99,
        identifier: "phone-otp:7",
        value: "wrong-hash",
        expiresAt: new Date(Date.now() + 60_000),
      });
      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .set("Cookie", await cookieFor(7))
        .send({ code: "123456" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("InvalidOtp");
    });

    // =============================================================
    //  Phase 15.3 — OTP enforcement on sensitive password ops
    // =============================================================
    describe("OTP-on-password-change (Phase 15.3)", () => {
      const phone = "+66912345678";

      it("change-password: 400 OtpRequired when phone is verified but no otpCode in body", async () => {
        // requireAuth findUnique (no select) returns the full user;
        // changePassword's findUnique uses select for password+phone+
        // phoneVerifiedAt. Differentiate by `select`.
        (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
          if (select?.password) {
            return Promise.resolve({
              password: "$2a$10$existinghash",
              phone,
              phoneVerifiedAt: new Date(), // verified
            });
          }
          return Promise.resolve({
            userId: where.userId,
            stats: { role: "buyer" },
            store: null,
          });
        });
        // bcrypt.compare needs to pass for currentPassword check first.
        const bcrypt = await import("bcryptjs");
        vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);

        const res = await request(buildApp())
          .post("/auth/change-password")
          .set("Cookie", await cookieFor(7))
          .send({ currentPassword: "old", newPassword: "Newpass1!", confirmPassword: "Newpass1!" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("OtpRequired");
      });

      it("change-password: 400 InvalidOtp on wrong code (verified phone)", async () => {
        (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
          if (select?.password)
            return Promise.resolve({
              password: "$2a$10$existinghash",
              phone,
              phoneVerifiedAt: new Date(),
            });
          return Promise.resolve({
            userId: where.userId,
            stats: { role: "buyer" },
            store: null,
          });
        });
        (prisma.verification.findFirst as any).mockResolvedValue({
          id: 99,
          identifier: "phone-otp:7",
          value: "wrong-hash",
          expiresAt: new Date(Date.now() + 60_000),
        });
        const bcrypt = await import("bcryptjs");
        vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);

        const res = await request(buildApp())
          .post("/auth/change-password")
          .set("Cookie", await cookieFor(7))
          .send({
            currentPassword: "old",
            newPassword: "Newpass1!",
            confirmPassword: "Newpass1!",
            otpCode: "999999",
          });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("InvalidOtp");
      });

      it("change-password: happy with correct OTP → consumes verification + updates password", async () => {
        const code = "123456";
        const crypto = await import("node:crypto");
        const expected = crypto.default
          .createHash("sha256")
          .update(`7:${phone}:${code}`)
          .digest("hex");
        (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
          if (select?.password)
            return Promise.resolve({
              password: "$2a$10$existinghash",
              phone,
              phoneVerifiedAt: new Date(),
            });
          return Promise.resolve({
            userId: where.userId,
            stats: { role: "buyer" },
            store: null,
          });
        });
        (prisma.verification.findFirst as any).mockResolvedValue({
          id: 99,
          identifier: "phone-otp:7",
          value: expected,
          expiresAt: new Date(Date.now() + 60_000),
        });
        (prisma.verification.delete as any).mockResolvedValue({});
        (prisma.user.update as any).mockResolvedValue({});
        const bcrypt = await import("bcryptjs");
        vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);

        const res = await request(buildApp())
          .post("/auth/change-password")
          .set("Cookie", await cookieFor(7))
          .send({
            currentPassword: "old",
            newPassword: "Newpass1!",
            confirmPassword: "Newpass1!",
            otpCode: code,
          });
        expect(res.status).toBe(200);
        // Verification row consumed so the same code can't be replayed.
        expect(prisma.verification.delete).toHaveBeenCalledWith({ where: { id: 99 } });
      });

      it("change-password: now requires email-OTP when phone is NOT verified (closes the no-second-factor hole)", async () => {
        // Behaviour change: ensureSensitiveOtp now requires SOME second
        // factor on every change-password. When the user has no
        // verified phone and no 2FA, the path falls through to email
        // OTP — which means an empty body returns OtpRequired instead
        // of silently succeeding.
        (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
          if (select?.password)
            return Promise.resolve({
              password: "$2a$10$existinghash",
              phone: null,
              phoneVerifiedAt: null,
              email: "buyer@metu.dev",
              totpEnabled: false,
              totpSecret: null,
            });
          return Promise.resolve({
            userId: where.userId,
            stats: { role: "buyer" },
            store: null,
          });
        });
        (prisma.user.update as any).mockResolvedValue({});
        const bcrypt = await import("bcryptjs");
        vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);
        vi.spyOn(bcrypt.default, "hash").mockResolvedValue("$2a$10$newhash" as any);

        const res = await request(buildApp())
          .post("/auth/change-password")
          .set("Cookie", await cookieFor(7))
          .send({ currentPassword: "old", newPassword: "Newpass1!", confirmPassword: "Newpass1!" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("OtpRequired");
      });
    });

    it("happy: matching code → phoneVerifiedAt set + audit row + verification deleted (atomic)", async () => {
      const phone = "+66912345678";
      const code = "654321";
      // Pre-compute the expected hash so the service comparison passes.
      const crypto = await import("node:crypto");
      const expected = crypto.default
        .createHash("sha256")
        .update(`7:${phone}:${code}`)
        .digest("hex");
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.phone) return Promise.resolve({ phone });
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.verification.findFirst as any).mockResolvedValue({
        id: 99,
        identifier: "phone-otp:7",
        value: expected,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.verification.delete as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});

      const res = await request(buildApp())
        .post("/auth/verify-otp")
        .set("Cookie", await cookieFor(7))
        .send({ code });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // $transaction was called with [user.update, verification.delete] —
      // we mocked it to Promise.all so both inner mocks were invoked.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.phone_verified",
          targetType: "user",
          targetId: 7,
        }),
      });
    });
  });
});

// =============================================================================
//  Phase 16.2 — TOTP 2FA
// =============================================================================
describe("Phase 16.2 — TOTP 2FA", () => {

  describe("POST /auth/totp/enroll-start", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp())
        .post("/auth/totp/enroll-start")
        .send({});
      expect(res.status).toBe(401);
    });

    it("400 AlreadyEnrolled when totpEnabled=true", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.totpSecret) {
          return Promise.resolve({
            email: "buyer@metu.dev",
            totpSecret: "OLDSECRET",
            totpEnabled: true,
          });
        }
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      const res = await request(buildApp())
        .post("/auth/totp/enroll-start")
        .set("Cookie", await cookieFor(7))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("AlreadyEnrolled");
    });

    it("happy: returns secret + otpauth URI for fresh enrolment", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.totpSecret) {
          return Promise.resolve({
            email: "buyer@metu.dev",
            totpSecret: null,
            totpEnabled: false,
          });
        }
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.user.update as any).mockResolvedValue({});
      const res = await request(buildApp())
        .post("/auth/totp/enroll-start")
        .set("Cookie", await cookieFor(7))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(res.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/METU/);
      // user.update was called to persist the new pending secret.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: 7 },
        data: { totpSecret: expect.any(String) },
      });
    });

    it("resumes pending enrolment (returns existing secret + does NOT re-update)", async () => {
      const existingSecret = "JBSWY3DPEHPK3PXP";
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.totpSecret) {
          return Promise.resolve({
            email: "buyer@metu.dev",
            totpSecret: existingSecret,
            totpEnabled: false,
          });
        }
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      const res = await request(buildApp())
        .post("/auth/totp/enroll-start")
        .set("Cookie", await cookieFor(7))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.secret).toBe(existingSecret);
      // No re-update: idempotent for refresh-during-enrolment.
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/totp/enroll-verify", () => {
    it("400 NoEnrollmentInProgress when totpSecret is null", async () => {
      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.totpSecret) {
          return Promise.resolve({ totpSecret: null, totpEnabled: false });
        }
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      const res = await request(buildApp())
        .post("/auth/totp/enroll-verify")
        .set("Cookie", await cookieFor(7))
        .send({ code: "123456" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("NoEnrollmentInProgress");
    });

    it("happy: matching code → totpEnabled true + audit row", async () => {
      // Use a known seed so we can compute a valid TOTP code.
      const totpUtil = await import("../src/utils/totp.js");
      const secret = totpUtil.generateSecret();
      // otplib doesn't expose a direct "what's the current code"
      // helper from our wrapper, but `verifyCode` is the predicate
      // we trust. Generate a code with the same library directly.
      const otplib = await import("otplib");
      // generate is async in otplib v13.
      const code = await otplib.generate({
        strategy: "totp",
        secret,
        digits: 6,
        period: 30,
      });

      (prisma.user.findUnique as any).mockImplementation(({ select, where }: any) => {
        if (select?.totpSecret) {
          return Promise.resolve({ totpSecret: secret, totpEnabled: false });
        }
        return Promise.resolve({
          userId: where.userId,
          stats: { role: "buyer" },
          store: null,
        });
      });
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});

      const res = await request(buildApp())
        .post("/auth/totp/enroll-verify")
        .set("Cookie", await cookieFor(7))
        .send({ code });
      expect(res.status).toBe(200);
      // Enrol now mints backup codes alongside flipping totpEnabled.
      // Response carries 10 plaintext codes ONCE; DB stores 10 hashes.
      expect(Array.isArray(res.body.backupCodes)).toBe(true);
      expect(res.body.backupCodes).toHaveLength(10);
      const updateArg = (prisma.user.update as any).mock.calls[0][0];
      expect(updateArg.where).toEqual({ userId: 7 });
      expect(updateArg.data.totpEnabled).toBe(true);
      expect(Array.isArray(updateArg.data.totpBackupCodes)).toBe(true);
      expect(updateArg.data.totpBackupCodes).toHaveLength(10);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.totp_enabled",
        }),
      });
    });
  });

  describe("POST /auth/login (Phase 16.2 NeedsTotp gate)", () => {
    it("401 NeedsTotp when password ok + totpEnabled=true + no totpCode in body", async () => {
      const bcrypt = await import("bcryptjs");
      vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        email: "buyer@metu.dev",
        password: "$2a$10$existinghash",
        totpEnabled: true,
        totpSecret: "JBSWY3DPEHPK3PXP",
        stats: { role: "buyer" },
        carts: [],
      });
      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "buyer@metu.dev", password: "rightpw1" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("NeedsTotp");
    });

    it("401 InvalidTotp when password ok + totp wrong", async () => {
      const bcrypt = await import("bcryptjs");
      vi.spyOn(bcrypt.default, "compare").mockResolvedValue(true as any);
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        email: "buyer@metu.dev",
        password: "$2a$10$existinghash",
        totpEnabled: true,
        totpSecret: "JBSWY3DPEHPK3PXP",
        stats: { role: "buyer" },
        carts: [],
      });
      const res = await request(buildApp())
        .post("/auth/login")
        .send({
          email: "buyer@metu.dev",
          password: "rightpw1",
          totpCode: "999999",
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("InvalidTotp");
    });
  });
});

// =============================================================================
//  Phase 15.2 — sessions UI
// =============================================================================
describe("Phase 15.2 — sessions UI", () => {

  describe("GET /auth/sessions", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp()).get("/auth/sessions");
      expect(res.status).toBe(401);
    });

    it("returns sessions ordered + currentSessionId from getSession (Mode A)", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      (prisma.session.findMany as any).mockResolvedValue([
        {
          id: 1,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          ipAddress: "10.0.0.1",
          userAgent: "Test/1",
        },
      ]);
      const res = await request(buildApp())
        .get("/auth/sessions")
        .set("Cookie", await cookieFor(7));
      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      // Phase 16.3 — Mode A: better-auth's getSession resolves the
      // current session row (mocked id=1 by signedInAs). The "current"
      // marker on the UI should match.
      expect(res.body.currentSessionId).toBe(1);
    });
  });

  describe("DELETE /auth/sessions/:id", () => {
    it("401 without auth", async () => {
      const res = await request(buildApp()).delete("/auth/sessions/1");
      expect(res.status).toBe(401);
    });

    it("404 SessionNotFound when no row matches the user", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });
      const res = await request(buildApp())
        .delete("/auth/sessions/999")
        .set("Cookie", await cookieFor(7));
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("SessionNotFound");
    });

    it("happy: deletes the session, ownership-checked via userId predicate", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 1 });
      const res = await request(buildApp())
        .delete("/auth/sessions/42")
        .set("Cookie", await cookieFor(7));
      expect(res.status).toBe(200);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 42, userId: 7 },
      });
    });
  });

  describe("DELETE /auth/sessions/all-others", () => {
    it("revokes all OTHER sessions, keeps current row (Mode A)", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        userId: 7,
        stats: { role: "buyer" },
        store: null,
      });
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 4 });
      (prisma.auditLog.create as any).mockResolvedValue({});
      const res = await request(buildApp())
        .delete("/auth/sessions/all-others")
        .set("Cookie", await cookieFor(7));
      expect(res.status).toBe(200);
      expect(res.body.revoked).toBe(4);
      // Phase 16.3 — Mode A: getSession resolves the current row
      // (mocked id=1). deleteMany filters NOT id=1 so the actor
      // doesn't sign themselves out by accident.
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 7, id: { not: 1 } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.sessions_revoked",
          meta: { revoked: 4, kept: 1 },
        }),
      });
    });
  });
});
