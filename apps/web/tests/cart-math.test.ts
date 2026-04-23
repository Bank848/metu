import { describe, it, expect } from "vitest";
import {
  DIGITAL_DELIVERY_METHODS,
  cartTotal,
  discountFromCoupon,
  eligibleSubtotalForStore,
  maxForLine,
  subtotalOf,
} from "@/lib/cart-math";

/** Build a minimal CartLine fixture so tests stay readable. */
function line(overrides: Partial<{
  cartItemId: number;
  storeId: number;
  deliveryMethod: string;
  quantity: number;
  unitPrice: number;
  stock: number;
}>) {
  const base = {
    cartItemId: 1,
    storeId: 1,
    deliveryMethod: "physical",
    quantity: 1,
    unitPrice: 100,
    stock: 10,
  };
  const merged = { ...base, ...overrides };
  return { ...merged, lineTotal: merged.unitPrice * merged.quantity };
}

describe("DIGITAL_DELIVERY_METHODS", () => {
  it("matches the four methods that should cap at qty 1", () => {
    expect(DIGITAL_DELIVERY_METHODS.has("download")).toBe(true);
    expect(DIGITAL_DELIVERY_METHODS.has("email")).toBe(true);
    expect(DIGITAL_DELIVERY_METHODS.has("license_key")).toBe(true);
    expect(DIGITAL_DELIVERY_METHODS.has("streaming")).toBe(true);
  });

  it("does not include physical / unknown methods", () => {
    expect(DIGITAL_DELIVERY_METHODS.has("physical")).toBe(false);
    expect(DIGITAL_DELIVERY_METHODS.has("shipping")).toBe(false);
    expect(DIGITAL_DELIVERY_METHODS.has("")).toBe(false);
  });
});

describe("maxForLine", () => {
  it("caps every digital delivery method at 1 regardless of stock", () => {
    for (const method of DIGITAL_DELIVERY_METHODS) {
      expect(maxForLine({ deliveryMethod: method, stock: 999 })).toBe(1);
    }
  });

  it("returns the stock value for physical lines", () => {
    expect(maxForLine({ deliveryMethod: "physical", stock: 5 })).toBe(5);
    expect(maxForLine({ deliveryMethod: "physical", stock: 100 })).toBe(100);
  });

  it("never returns 0 — even an out-of-stock line allows the 1-step floor", () => {
    expect(maxForLine({ deliveryMethod: "physical", stock: 0 })).toBe(1);
    expect(maxForLine({ deliveryMethod: "physical", stock: -3 })).toBe(1);
  });
});

describe("subtotalOf", () => {
  it("returns 0 for an empty cart", () => {
    expect(subtotalOf([])).toBe(0);
  });

  it("sums lineTotal across all lines", () => {
    expect(
      subtotalOf([
        line({ unitPrice: 100, quantity: 2 }), // 200
        line({ unitPrice: 50, quantity: 3 }),  // 150
        line({ unitPrice: 25, quantity: 1 }),  //  25
      ]),
    ).toBe(375);
  });
});

describe("eligibleSubtotalForStore", () => {
  it("filters to a single store's lines before summing", () => {
    const lines = [
      line({ cartItemId: 1, storeId: 1, unitPrice: 100, quantity: 2 }), // 200 store=1
      line({ cartItemId: 2, storeId: 2, unitPrice: 50,  quantity: 3 }), // 150 store=2
      line({ cartItemId: 3, storeId: 1, unitPrice: 25,  quantity: 4 }), // 100 store=1
    ];
    expect(eligibleSubtotalForStore(lines, 1)).toBe(300);
    expect(eligibleSubtotalForStore(lines, 2)).toBe(150);
    expect(eligibleSubtotalForStore(lines, 99)).toBe(0);
  });
});

describe("discountFromCoupon", () => {
  it("returns 0 for a non-positive eligible subtotal", () => {
    expect(discountFromCoupon(0,   { discountType: "percent", discountValue: 50 })).toBe(0);
    expect(discountFromCoupon(-10, { discountType: "fixed",   discountValue: 50 })).toBe(0);
  });

  it("computes a percent discount as eligibleSubtotal * value/100", () => {
    expect(discountFromCoupon(200, { discountType: "percent", discountValue: 25 })).toBe(50);
    expect(discountFromCoupon(120, { discountType: "percent", discountValue: 10 })).toBe(12);
    // 100 % off → free
    expect(discountFromCoupon(80,  { discountType: "percent", discountValue: 100 })).toBe(80);
  });

  it("caps a fixed discount at the eligible subtotal — never refunds more", () => {
    expect(discountFromCoupon(50,  { discountType: "fixed", discountValue: 100 })).toBe(50);
    expect(discountFromCoupon(100, { discountType: "fixed", discountValue: 30 })).toBe(30);
  });
});

describe("cartTotal", () => {
  it("equals subtotal − discount in the normal case", () => {
    expect(cartTotal(100, 25)).toBe(75);
  });

  it("clamps to 0 if a fixed discount would push the total negative", () => {
    expect(cartTotal(50, 100)).toBe(0);
  });

  it("returns the subtotal unchanged when there's no discount", () => {
    expect(cartTotal(199, 0)).toBe(199);
  });
});
