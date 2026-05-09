/**
 * Pure utility tests for security-critical helpers:
 *   - generateCode (otp.ts) — crypto.randomInt, 6-digit zero-padded
 *   - hashCode    (otp.ts) — SHA-256 of `<userId>:<phone>:<code>` so a
 *                            leaked code can't be replayed elsewhere
 *   - escapeHtml  (email-template.ts) — neutralises angle brackets
 *   - findFirstProfaneField (profanity.ts) — register/profile gate
 */
import { describe, it, expect } from "vitest";
import { generateCode, hashCode, otpIdentifier } from "../src/utils/otp.js";
import { escapeHtml } from "../src/utils/email-template.js";
import { findFirstProfaneField } from "../src/utils/profanity.js";

describe("otp.generateCode", () => {
  it("returns a 6-digit zero-padded numeric string", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("produces variety across calls (CSPRNG, not deterministic)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateCode());
    // 100 draws from a 1M space — expect virtually no collisions.
    expect(seen.size).toBeGreaterThan(95);
  });
});

describe("otp.hashCode", () => {
  it("produces a stable SHA-256 hex digest", () => {
    const a = hashCode(7, "+66812345678", "123456");
    const b = hashCode(7, "+66812345678", "123456");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("salts by userId + phone so the same code on different accounts is distinct", () => {
    const a = hashCode(7, "+66812345678", "123456");
    const b = hashCode(8, "+66812345678", "123456");
    const c = hashCode(7, "+66987654321", "123456");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("otp.otpIdentifier", () => {
  it("namespaces by user id", () => {
    expect(otpIdentifier(42)).toBe("phone-otp:42");
  });
});

describe("email-template.escapeHtml", () => {
  it("neutralises angle brackets, quotes, ampersands", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(escapeHtml(`"`)).toBe("&quot;");
    expect(escapeHtml(`'`)).toBe("&#39;");
    expect(escapeHtml("&")).toBe("&amp;");
  });

  it("passes plain text through unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("profanity.findFirstProfaneField", () => {
  it("returns null when every value is clean", () => {
    expect(
      findFirstProfaneField({ username: "alice", firstName: "Alice" }),
    ).toBeNull();
  });

  it("rejects an obvious slur in any field", () => {
    // Use a word from the custom Thai blocklist (`kuay`) so the test
    // is stable regardless of leo-profanity dictionary version.
    const result = findFirstProfaneField({ firstName: "kuay" });
    expect(result).not.toBeNull();
    expect(result?.field).toBe("firstName");
  });

  it("is case-insensitive", () => {
    expect(findFirstProfaneField({ username: "KUAY" })).not.toBeNull();
  });

  it("returns null for clean username/name combos", () => {
    expect(
      findFirstProfaneField({
        username: "metu_user_42",
        firstName: "Sitthichai",
        lastName: "Phirompan",
      }),
    ).toBeNull();
  });
});
