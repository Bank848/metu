/**
 * Phase 17.3 — PromptPay QR generation + slip verification.
 *
 * Two responsibilities:
 *
 *   1. `buildTopupQrPayload(promptpayId, amountBaht)` — builds the
 *      EMVCo QR payload string that any Thai banking app can scan
 *      to pre-fill the recipient (PromptPay-registered phone or
 *      national ID) AND the exact amount. Wraps the `promptpay-qr`
 *      npm package so callers don't have to know its API.
 *
 *   2. `verifySlip(slipImageBase64, expected)` — accepts a base64
 *      data URL of a slip the user uploaded, decodes it (PNG or
 *      JPEG), reads the QR with `jsqr`, parses the EMVCo TLV
 *      structure, and verifies the slip matches what we issued
 *      (recipient PromptPay ID + amount). Also extracts the slip's
 *      transaction reference so the caller can dedupe (the topup
 *      table has a UNIQUE constraint on slip_reference — same
 *      reference twice = same slip uploaded twice).
 *
 * Returns a structured result so callers can branch on the failure
 * mode and either auto-credit, queue for admin, or surface an error.
 *
 * Why no OCR? Every modern Thai bank slip ships with a structured
 * QR that contains all the fields we need. Reading text via
 * Tesseract.js would add ~10 MB of binary + 1-2 s of decode time
 * per slip — not worth it when the QR path is fast + deterministic.
 * If a buyer ever uploads a slip without a QR, we fall through to
 * "needs admin review" which is the correct disposition anyway.
 */

import generatePayload from "promptpay-qr";
import * as jsQRModule from "jsqr";
import { PNG } from "pngjs";
import jpegJs from "jpeg-js";

// jsqr publishes both default + named exports; the bundler picks
// different shapes depending on the moduleResolution. Robust
// resolution: prefer the default export, fall back to the namespace.
const jsQR = ((jsQRModule as unknown as { default?: typeof jsQRModule }).default ??
  (jsQRModule as unknown as typeof jsQRModule)) as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

// ─────────────────────────────────────────────────────────────────
// 1. Generate top-up QR
// ─────────────────────────────────────────────────────────────────

export interface TopupQrInput {
  promptpayId: string;   // recipient: phone (10 digits) or national ID (13 digits)
  amountBaht: number;    // baked into the QR so banking apps pre-fill the amount
}

/**
 * Build an EMVCo QR payload string for PromptPay. The output is a
 * raw text string (NOT an image) — the BFF/UI generates the QR
 * image client-side via a JS QR encoder library so there's no
 * round-trip cost for re-rendering.
 */
export function buildTopupQrPayload({ promptpayId, amountBaht }: TopupQrInput): string {
  if (!/^[0-9]{10,15}$/.test(promptpayId)) {
    throw new Error(`Invalid PromptPay ID: ${promptpayId}`);
  }
  if (!Number.isFinite(amountBaht) || amountBaht <= 0) {
    throw new Error(`Invalid amount: ${amountBaht}`);
  }
  return generatePayload(promptpayId, { amount: amountBaht });
}

// ─────────────────────────────────────────────────────────────────
// 2. Decode an uploaded slip image to RGBA pixels for jsQR
// ─────────────────────────────────────────────────────────────────

interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Decode a base64 data URL (PNG or JPG) to RGBA pixel data. jsQR
 * expects a flat Uint8ClampedArray + width + height. We support
 * both formats since SCB exports PNG screenshots and KBank JPGs.
 */
function decodeImageDataUrl(dataUrl: string): DecodedImage | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const buf = Buffer.from(match[2], "base64");
  try {
    if (mime === "png") {
      const png = PNG.sync.read(buf);
      return {
        data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
        width: png.width,
        height: png.height,
      };
    }
    // jpeg / jpg
    const jpg = jpegJs.decode(buf, { useTArray: true });
    return {
      data: new Uint8ClampedArray(jpg.data.buffer, jpg.data.byteOffset, jpg.data.byteLength),
      width: jpg.width,
      height: jpg.height,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// 3. Parse an EMVCo TLV payload extracted from the slip's QR
// ─────────────────────────────────────────────────────────────────

interface SlipFields {
  recipient: string | null;   // PromptPay ID (digits)
  amount: number | null;      // baht
  reference: string | null;   // unique transaction reference for dedupe
}

/**
 * Walk an EMVCo TLV string and extract the fields we care about:
 *   - 29 (Merchant Account Information template) → contains
 *     PromptPay ID nested at sub-tag 01 (mobile) or 02 (national ID)
 *   - 54 (Transaction Amount) → top-level numeric amount
 *   - 62 (Additional Data Field Template) → contains a Bill
 *     Reference at sub-tag 05; some banks use sub-tag 07.
 *
 * The slip QRs we've reverse-engineered include the original
 * sender's PromptPay-assigned reference at field 62/01 ("Bill Number")
 * which is unique-per-slip and stable across re-scans of the same
 * slip — exactly the fingerprint we want for deduplication.
 *
 * Returns nulls for any field that wasn't parseable; the caller
 * decides what's mandatory vs optional.
 */
export function parseEmvCoPayload(payload: string): SlipFields {
  const out: SlipFields = { recipient: null, amount: null, reference: null };
  try {
    let i = 0;
    while (i < payload.length - 4) {
      const tag = payload.slice(i, i + 2);
      const len = parseInt(payload.slice(i + 2, i + 4), 10);
      if (!Number.isFinite(len) || len < 0) break;
      const value = payload.slice(i + 4, i + 4 + len);
      i += 4 + len;

      // Tag 29 / 30 / 31 are merchant account templates that carry
      // the PromptPay ID nested inside.
      if (tag === "29" || tag === "30" || tag === "31") {
        let j = 0;
        while (j < value.length - 4) {
          const subTag = value.slice(j, j + 2);
          const subLen = parseInt(value.slice(j + 2, j + 4), 10);
          if (!Number.isFinite(subLen) || subLen < 0) break;
          const subVal = value.slice(j + 4, j + 4 + subLen);
          j += 4 + subLen;
          // sub-tag 01 = mobile (00 + 9 digits = 11 chars total —
          // strip the leading "00" then the country code "66" if
          // present so the result matches our stored 10-digit ID)
          // sub-tag 02 = national ID (13 chars)
          if (subTag === "01" || subTag === "02") {
            out.recipient = normalisePromptpayId(subVal);
          }
        }
      }

      // Tag 54 = transaction amount (string-encoded decimal)
      if (tag === "54") {
        const n = parseFloat(value);
        if (Number.isFinite(n)) out.amount = n;
      }

      // Tag 62 = additional data; sub-tag 01 = bill reference,
      // sub-tag 05 = reference label, sub-tag 07 = transaction ID
      if (tag === "62") {
        let j = 0;
        while (j < value.length - 4) {
          const subTag = value.slice(j, j + 2);
          const subLen = parseInt(value.slice(j + 2, j + 4), 10);
          if (!Number.isFinite(subLen) || subLen < 0) break;
          const subVal = value.slice(j + 4, j + 4 + subLen);
          j += 4 + subLen;
          if ((subTag === "01" || subTag === "05" || subTag === "07") && !out.reference) {
            out.reference = subVal;
          }
        }
      }
    }
  } catch {
    /* fall through with whatever we extracted */
  }
  return out;
}

/**
 * Strip leading "0066" or "66" country code that some banking apps
 * wrap around mobile numbers, and a leading "0" that some store
 * differently. Returns the canonical 10-digit / 13-digit form so
 * comparison with our admin-configured promptpayId is direct.
 */
function normalisePromptpayId(raw: string): string {
  let v = raw.replace(/[^0-9]/g, "");
  if (v.startsWith("0066")) v = "0" + v.slice(4);
  else if (v.startsWith("66") && v.length === 11) v = "0" + v.slice(2);
  return v;
}

// ─────────────────────────────────────────────────────────────────
// 4. Top-level slip verification
// ─────────────────────────────────────────────────────────────────

export interface SlipExpectation {
  promptpayId: string;
  amountBaht: number;
}

export type SlipVerifyResult =
  | {
      ok: true;
      reference: string;     // for dedup; the topup table UNIQUEs on this
      qrPayload: string;     // raw EMVCo string for audit
      amount: number;
      recipient: string;
    }
  | {
      ok: false;
      reason:
        | "image-decode-failed"
        | "no-qr-found"
        | "missing-reference"
        | "recipient-mismatch"
        | "amount-mismatch";
      detail?: string;
      qrPayload?: string;
    };

const AMOUNT_TOLERANCE_BAHT = 1; // accept slip within ±1 baht (some banks round)

export function verifySlip(
  slipImageBase64: string,
  expected: SlipExpectation,
): SlipVerifyResult {
  // Step 1: decode image
  const img = decodeImageDataUrl(slipImageBase64);
  if (!img) {
    return { ok: false, reason: "image-decode-failed" };
  }
  // Step 2: read QR via jsQR
  const qr = jsQR(img.data, img.width, img.height);
  if (!qr) {
    return { ok: false, reason: "no-qr-found" };
  }
  const qrPayload = qr.data;
  const fields = parseEmvCoPayload(qrPayload);

  // Step 3: must have a reference for dedupe; otherwise we can't
  // safely auto-approve (would let the same slip be reused).
  if (!fields.reference) {
    return { ok: false, reason: "missing-reference", qrPayload };
  }

  // Step 4: recipient must match (defends against "user uploads
  // someone else's slip"). We compare normalised IDs both ways.
  const expectedNorm = normalisePromptpayId(expected.promptpayId);
  const slipNorm = fields.recipient ? normalisePromptpayId(fields.recipient) : "";
  if (!slipNorm || slipNorm !== expectedNorm) {
    return {
      ok: false,
      reason: "recipient-mismatch",
      detail: `slip recipient=${slipNorm || "?"}, expected=${expectedNorm}`,
      qrPayload,
    };
  }

  // Step 5: amount must match within tolerance.
  if (fields.amount === null || Math.abs(fields.amount - expected.amountBaht) > AMOUNT_TOLERANCE_BAHT) {
    return {
      ok: false,
      reason: "amount-mismatch",
      detail: `slip=${fields.amount ?? "?"}฿, expected=${expected.amountBaht}฿`,
      qrPayload,
    };
  }

  return {
    ok: true,
    reference: fields.reference,
    qrPayload,
    amount: fields.amount,
    recipient: slipNorm,
  };
}
