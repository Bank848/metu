import { describe, it, expect } from "vitest";
import { isDataUrl, cardImage, cn, getInitials, avatarHue } from "@/lib/utils";

describe("isDataUrl", () => {
  it("matches base64 data URLs (typed seller uploads)", () => {
    expect(isDataUrl("data:image/png;base64,iVBORw0KGg")).toBe(true);
    expect(isDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
  });

  it("matches DiceBear avatars (return SVG without a .svg extension)", () => {
    expect(isDataUrl("https://api.dicebear.com/7.x/initials/svg?seed=foo")).toBe(true);
  });

  it("matches any URL ending in .svg (with or without query string)", () => {
    expect(isDataUrl("https://example.com/logo.svg")).toBe(true);
    expect(isDataUrl("https://example.com/logo.svg?v=2")).toBe(true);
    // Case-insensitive — matches uppercase extension too.
    expect(isDataUrl("https://example.com/Logo.SVG")).toBe(true);
  });

  it("returns false for plain image URLs that Next can optimise", () => {
    expect(isDataUrl("https://images.unsplash.com/photo-123?w=600")).toBe(false);
    expect(isDataUrl("https://picsum.photos/seed/p1/800/600")).toBe(false);
    expect(isDataUrl("/local/asset.png")).toBe(false);
  });

  it("safely handles null / undefined / non-string input", () => {
    expect(isDataUrl(null)).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
    expect(isDataUrl("" as unknown as string)).toBe(false);
    // Type-cheating callers shouldn't crash the helper.
    expect(isDataUrl(42 as unknown as string)).toBe(false);
  });
});

describe("cardImage", () => {
  it("downsizes Unsplash 1200×800 URLs to 600×400 for thumbnails", () => {
    const original =
      "https://images.unsplash.com/photo-1?ixlib=rb-4.0.3&w=1200&h=800&fit=crop";
    const expected =
      "https://images.unsplash.com/photo-1?ixlib=rb-4.0.3&w=600&h=400&fit=crop";
    expect(cardImage(original)).toBe(expected);
  });

  it("leaves non-Unsplash URLs untouched", () => {
    expect(cardImage("https://picsum.photos/seed/p1/800/600"))
      .toBe("https://picsum.photos/seed/p1/800/600");
    expect(cardImage("data:image/png;base64,iVBORw0KGg"))
      .toBe("data:image/png;base64,iVBORw0KGg");
  });

  it("returns falsy input unchanged so callers can safely chain it", () => {
    expect(cardImage("")).toBe("");
  });
});

describe("getInitials (Phase 11 / F15 avatar fallback)", () => {
  it("returns first letter of the first two words, uppercased", () => {
    expect(getInitials("Mei Huang")).toBe("MH");
    expect(getInitials("kanda chitra")).toBe("KC");
  });

  it("ignores any words past the first two", () => {
    expect(getInitials("Arun Phongchai Extra Word")).toBe("AP");
  });

  it("falls back to a single letter when there's only one word", () => {
    expect(getInitials("madonna")).toBe("M");
  });

  it("strips emoji and punctuation before extracting letters", () => {
    expect(getInitials("👑 Mei  ·  Huang!")).toBe("MH");
  });

  it("handles non-Latin scripts (Thai)", () => {
    // Thai display names should still produce the first character of
    // the first two words rather than collapsing to "?".
    const initials = getInitials("กานดา จิตรา");
    expect(initials).toHaveLength(2);
    expect(initials).toBe(initials.toUpperCase());
  });

  it("uses the email fallback when the name is missing", () => {
    expect(getInitials(undefined, "u@example.dev")).toBe("U");
    expect(getInitials("", "alice@x")).toBe("A");
  });

  it("returns '?' when neither name nor fallback can yield a letter", () => {
    expect(getInitials("", "")).toBe("?");
    expect(getInitials(null, null)).toBe("?");
    expect(getInitials("👋👋👋", "")).toBe("?");
  });
});

describe("avatarHue (Phase 11 / F15 deterministic colour seed)", () => {
  it("returns the same hue for the same input", () => {
    expect(avatarHue("buyer@metu.dev")).toBe(avatarHue("buyer@metu.dev"));
    expect(avatarHue("Mei Huang")).toBe(avatarHue("Mei Huang"));
  });

  it("stays inside the [0, 360) range", () => {
    for (const seed of ["a", "Mei Huang", "really long name string here", ""]) {
      const h = avatarHue(seed);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("yields different hues for different inputs (sanity check)", () => {
    const a = avatarHue("alice");
    const b = avatarHue("bob");
    // Not a strict requirement, but a hash collision on these two
    // strings would mean every user looks identical — flag it.
    expect(a).not.toBe(b);
  });

  it("handles null / undefined without crashing", () => {
    expect(typeof avatarHue(null)).toBe("number");
    expect(typeof avatarHue(undefined)).toBe("number");
  });
});

describe("cn (Tailwind class merger)", () => {
  it("joins string classes", () => {
    expect(cn("p-4", "rounded", "bg-white")).toBe("p-4 rounded bg-white");
  });

  it("dedupes conflicting Tailwind utilities — last one wins", () => {
    // tailwind-merge knows p-2 and p-4 are conflicting padding utilities.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("filters falsy values like clsx does", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("supports the {className: bool} object form", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
});
