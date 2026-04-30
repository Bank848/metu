/**
 * Phase 29 — extend the original CPE241 docx into v3.
 *
 * Reflects the schema after Phase 26-28:
 *   - 27 entities (8 tables removed in Phase 26 — Message, ProductQuestion,
 *     StockAlert, Wallet, WalletTransaction, Topup, Withdrawal,
 *     StoreTransaction)
 *   - Stripe Connect integration (Phase 27 — columns on Order + Store,
 *     no new tables)
 *   - Supabase Postgres in production (Phase 28 — connection-string
 *     swap only, schema unchanged)
 *
 * Reads:  C:/Users/zxcas/AppData/Local/Temp/docx_v3_unpacked/word/document.xml
 * Writes: same file (in-place insert before </w:body>'s sectPr).
 */
import fs from "node:fs/promises";

const DOC_PATH = "C:/Users/zxcas/AppData/Local/Temp/docx_v3_unpacked/word/document.xml";

const RPR = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_BOLD = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_HDR = `<w:rFonts w:ascii="TH Sarabun New" w:eastAsia="Arial" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function para(runs: Array<[string, boolean?]>): string {
  const r = runs
    .map(([t, b]) => `<w:r><w:rPr>${b ? RPR_BOLD : RPR}</w:rPr><w:t xml:space="preserve">${escape(t)}</w:t></w:r>`)
    .join("");
  return `<w:p><w:pPr><w:rPr>${RPR}</w:rPr></w:pPr>${r}</w:p>`;
}

function heading(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}

function subheading(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="80"/><w:rPr>${RPR_BOLD}</w:rPr></w:pPr><w:r><w:rPr>${RPR_BOLD}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}

function numItemBold(num: number, prefix: string, body: string): string {
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:ind w:left="720" w:hanging="360"/><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${RPR_BOLD}</w:rPr><w:t xml:space="preserve">${num}. ${escape(prefix)}: </w:t></w:r><w:r><w:rPr>${RPR}</w:rPr><w:t xml:space="preserve">${escape(body)}</w:t></w:r></w:p>`;
}

function bullet(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:ind w:left="1080" w:hanging="360"/><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${RPR}</w:rPr><w:t xml:space="preserve">• ${escape(text)}</w:t></w:r></w:p>`;
}

function entityTable(title: string, rows: Array<[string, string, string, string]>): string {
  const cell = (text: string, isHeader: boolean, w: number) => {
    const fill = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="1E5AA8"/>` : "";
    const borders = ["top", "left", "bottom", "right"]
      .map((s) => `<w:${s} w:val="single" w:sz="1" w:space="0" w:color="1E5AA8"/>`)
      .join("");
    const rPr = isHeader ? RPR_HDR : RPR;
    const safe = escape(text);
    return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders>${borders}</w:tcBorders>${fill}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r></w:p></w:tc>`;
  };
  const cols = [1568, 1246, 1811, 3551];
  const headerRow = `<w:tr><w:trPr><w:trHeight w:val="380"/><w:tblHeader/></w:trPr>${cell("Name", true, cols[0])}${cell("Type", true, cols[1])}${cell("Constraints", true, cols[2])}${cell("Description", true, cols[3])}</w:tr>`;
  const bodyRows = rows.map((r) => `<w:tr>${cell(r[0], false, cols[0])}${cell(r[1], false, cols[1])}${cell(r[2], false, cols[2])}${cell(r[3], false, cols[3])}</w:tr>`).join("");
  return `${subheading(title)}<w:tbl><w:tblPr><w:tblW w:w="8176" w:type="dxa"/><w:tblInd w:w="1186" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:left w:w="10" w:type="dxa"/><w:right w:w="10" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="${cols[0]}"/><w:gridCol w:w="${cols[1]}"/><w:gridCol w:w="${cols[2]}"/><w:gridCol w:w="${cols[3]}"/></w:tblGrid>${headerRow}${bodyRows}</w:tbl><w:p><w:pPr><w:rPr>${RPR}</w:rPr></w:pPr></w:p>`;
}

// ─────────────────────────────────────────────────────────────────
// FUNCTIONAL REQUIREMENTS — appended sections 5-9 (sections 1-4 of
// the original FR list cover User/Store/Product/Stock/Cart/Order/
// Transaction/Review/Coupon and stay untouched).
// ─────────────────────────────────────────────────────────────────
const FR_BLOCK = [
  heading("Functional Requirements (เพิ่มเติม Phase 14-28)"),
  para([["ส่วนนี้ต่อยอดจาก Functional Requirements เดิม ครอบคลุม feature ที่เพิ่มขึ้นใน Phase 14-28: ระบบ authentication ผ่าน better-auth + Google OAuth + TOTP, ระบบจ่ายเงินจริงผ่าน Stripe Connect (test mode), wishlist, admin moderation panel, audit trail, และ database ที่ย้ายไป Supabase ใน Phase 28 เพื่อใช้ dashboard + storage / realtime ในอนาคต", false]]),

  subheading("5. Authentication & Security"),
  bullet("Multi-provider sign-in ผ่าน better-auth: รองรับการสมัครและเข้าสู่ระบบทั้งแบบ email + password และผ่าน Google OAuth ; ผู้ใช้ link/unlink Google ได้ผ่าน /profile/edit"),
  bullet("Two-factor authentication (TOTP): ผู้ใช้ enrol ผ่าน QR code → ยืนยันรหัส 6 หลัก → ระบบเก็บ secret + ตรวจทุกครั้งที่ login เมื่อ totp_enabled = true"),
  bullet("Session management: หน้า /profile/sessions แสดงทุก session ที่ login อยู่ (browser, IP, last active) ; revoke per-device ได้, “sign-out everywhere else” คลิกเดียว"),
  bullet("Step-up authentication: action ที่ sensitive (admin refund, change-password, unlink Google, delete account) ต้องการ TOTP ใหม่ภายใน 15 นาทีก่อนทำ"),
  bullet("Password recovery: email reset token (TTL 30 นาที, hash เก็บ) ; ผู้ใช้คลิก link → ตั้งรหัสใหม่"),
  bullet("Rate limiting: in-process sliding-window — login 5/min/IP, register 3/hr/IP, OTP 3/min, forgot-password 3/5min ; ตอบ 429 + Retry-After"),
  bullet("Helmet security headers: HSTS 180 วัน, X-Frame-Options DENY, X-Content-Type-Options nosniff, Content-Security-Policy allow-list"),
  bullet("Session cookie: better-auth ตั้ง sameSite=strict, httpOnly, secure"),

  subheading("6. Wishlist & Notifications"),
  bullet("Product favorites: ผู้ใช้กดหัวใจเก็บสินค้าลง wishlist (ProductFavorite) ; admin toggle favoritesEnabled ผ่าน /admin/settings → 3-layer gate (DB row คงเดิม, route 404, icon ซ่อน) เพื่อให้ปิดได้ทันทีโดยไม่สูญเสียข้อมูล"),

  subheading("7. Stripe Connect Payment (Phase 27)"),
  bullet("Stripe Connect Express onboarding: seller เข้า /seller/onboarding → ระบบสร้าง Stripe Express account + ออก onboarding link ที่ Stripe-hosted → เมื่อกรอกข้อมูลธุรกิจ + ธนาคารเสร็จ Stripe redirect กลับ /seller/onboarding/return + capability flags (charges_enabled, payouts_enabled) update ผ่าน account.updated webhook"),
  bullet("Direct charge (transfer_data.destination): checkout สร้าง PaymentIntent ผ่าน Stripe API พร้อม application_fee_amount = totalPrice × platformFeePercent% ; เงินไหลจากบัตร buyer เข้า platform Stripe account แล้ว Stripe routing ไป Connected Account ของ seller อัตโนมัติ — ไม่มี wallet / coin layer ในฝั่งเรา"),
  bullet("Frontend confirm: หน้า /checkout/[orderId] ใช้ <PaymentElement /> ของ Stripe.js — buyer กรอกบัตรในกรอบ iframe ของ Stripe โดยตรง (PCI scope ของ Stripe ทั้งหมด ไม่มี card data ผ่าน server เรา)"),
  bullet("Webhook idempotency: /api/webhooks/stripe verify signature ด้วย STRIPE_WEBHOOK_SECRET → ตรวจ AuditLog meta.eventId เพื่อ dedupe → process payment_intent.succeeded/.failed, charge.refunded, account.updated, payout.paid ; record success ลง AuditLog เพื่อกัน double-process"),
  bullet("Refund flow: admin คลิกปุ่ม refund ที่ /admin/refunds → call /admin/orders/:id/refund (ต้องผ่าน TOTP step-up 15 นาที) → Stripe Refund API พร้อม reverse_transfer:true + refund_application_fee:true → เงินถูก claw back จาก Connect account + คืน application fee ของ platform ; webhook charge.refunded อัปเดต Order.stripe_amount_refunded"),
  bullet("Seller wallet: หน้า /seller/wallet fetch balance + payouts + recent charges จาก Stripe Balance API + Payouts API live — ไม่ materialise balance ใน DB ของเรา (Stripe เป็น single source of truth สำหรับ payment state)"),
  bullet("Demo mode fallback: เมื่อ STRIPE_SECRET_KEY ไม่ตั้ง / seller ยังไม่ onboard Connect account / cart มีหลายร้าน → checkout fall back ไปสร้าง Order สถานะ paid ทันทีโดยไม่ผ่าน Stripe (ใช้สำหรับ local dev + demo)"),

  subheading("8. Admin Panel"),
  bullet("User management: ban / unban / change role / force-password-reset"),
  bullet("Store management: suspend / un-suspend / soft-delete"),
  bullet("Reports: orders by status, revenue per store, top products"),
  bullet("Refund queue (/admin/refunds): list ทุก order ที่จ่ายผ่าน Stripe + ปุ่ม refund ต่อ row"),
  bullet("Audit log: searchable trail ของ destructive admin action ทุกตัว (actorId + IP + UA + meta diff)"),
  bullet("System settings: 2 fields หลังจาก Phase 26 trim — favoritesEnabled, platformFeePercent (Stripe application_fee)"),
  bullet("ER diagram (/admin/er-diagram): live render schema ปัจจุบัน 27 entities ผ่าน in-house renderer (dagre + SVG) ที่ sync กับ Prisma schema อัตโนมัติทุก migration"),
  bullet("Tech stack (/admin/tech-stack): list dependency เวอร์ชันจาก package.json ทั้ง 5 จุด (root, web, server, db, shared)"),

  subheading("9. Production Infrastructure"),
  bullet("Hosting: Fly.io 2 machines ใน sin region — metu.fly.dev (Next.js BFF) คุยกับ metu-api.fly.dev (Express server) ผ่าน internal network"),
  bullet("Database: Supabase Postgres free tier ใน ap-southeast-1 (Singapore — region เดียวกับ Fly) ; การเชื่อมต่อใช้ 2 endpoint ต่างกัน — transaction pooler (port 6543) สำหรับ runtime + session pooler (port 5432) สำหรับ prisma migrate deploy ใน release_command (direct host db.<ref>.supabase.co เป็น IPv6-only ในแผน free + Fly ใช้ IPv4 จึงไม่ใช้)"),
  bullet("Auto-stop: ทั้งสอง app ตั้ง min_machines_running=0 — machine จะ hibernate หลัง idle และ auto-start เมื่อมี request เข้า ทำให้ค่าใช้จ่ายเหลือใต้ $5/เดือน (Fly free credit)"),
  bullet("Audit trail: ทุก destructive action (user ban, store delete, refund, settings update, role change) เขียน AuditLog row พร้อม actorId / action / target / meta(diff) / ip / user_agent"),
  bullet("Triggers + Views + Roles + GRANT/REVOKE + CHECK constraints (Phase 13.6.5 retrofit ตาม CPE241 rubric — มีอยู่ใน schema จริง)"),
].join("");

// ─────────────────────────────────────────────────────────────────
// BUSINESS RULES — start at 13 to continue from the existing 12.
// ─────────────────────────────────────────────────────────────────
const BR_BLOCK = [
  heading("Business Rules (เพิ่มเติมข้อ 13-19)"),
  para([["ต่อจาก 12 ข้อเดิม ส่วนนี้ครอบคลุม rule ที่มาจาก Phase 14 เป็นต้นไป — เน้น authentication, audit, และระบบจ่ายเงินผ่าน Stripe Connect", false]]),
  numItemBold(13, "TOTP Step-Up", "action sensitive (admin refund, change-password, unlink Google, delete account) ต้องการ TOTP ใหม่ภายใน 15 นาที ; Session.last_totp_at เก็บ timestamp ที่ผ่าน step-up"),
  numItemBold(14, "Rate Limiting", "in-process sliding-window limiter — login 5/min/IP, register 3/hr/IP, OTP 3/min, forgot-password 3/5min ; ตอบ 429 + Retry-After header"),
  numItemBold(15, "Audit Trail", "ทุก destructive admin action (user.ban, store.delete, settings.update, role.change, force_password_reset.set/clear, stripe.refund) เขียน AuditLog row พร้อม actor + IP + user_agent + meta(diff)"),
  numItemBold(16, "Stripe Connect Settlement", "เมื่อ seller มี Connect account active (charges_enabled=true), checkout จะสร้าง PaymentIntent ที่ใช้ transfer_data.destination ตรงเข้าบัญชี seller ; Stripe จัดการ payout schedule (default weekly) + reserve สำหรับ refund อัตโนมัติ — เราไม่ materialise balance ใน DB"),
  numItemBold(17, "Platform Fee", "SystemSetting.platform_fee_percent (default 5.00%) ถูกแปลงเป็น application_fee_amount ตอนสร้าง PaymentIntent ; แพลตฟอร์มเก็บส่วนนี้ที่ฝั่ง platform Stripe account, seller ได้รับ (100 − fee)% ของ totalPrice"),
  numItemBold(18, "Refund Reverses Both Sides", "เมื่อ admin call /admin/orders/:id/refund, Stripe Refund API ถูกเรียกพร้อม reverse_transfer:true + refund_application_fee:true → เงินถูกหักคืนจากทั้ง Connect account ของ seller + application fee ของ platform → buyer ได้คืนเต็มจำนวน"),
  numItemBold(19, "Webhook Idempotency", "ทุก event จาก Stripe ถูก verify signature ด้วย STRIPE_WEBHOOK_SECRET ก่อน ; event.id ถูกใช้เป็น dedup key ผ่าน AuditLog meta.eventId — ถ้าเคย process แล้วจะ return 200 ทันทีโดยไม่ทำซ้ำ"),
].join("");

// ─────────────────────────────────────────────────────────────────
// PROJECT JUSTIFICATION — sections 4-7 (sections 1-3 in the
// original cover User & Store / Product & Inventory / Transaction &
// Promotion and stay untouched).
// ─────────────────────────────────────────────────────────────────
const PJ_BLOCK = [
  heading("Project Justification (เพิ่มเติม section 4-7)"),
  para([["ต่อจาก section 1-3 เดิม ส่วนนี้ครอบคลุม entity ที่มาจาก Phase 14 เป็นต้นไป — Authentication & Sessions, Stripe Connect (column-level เท่านั้น ไม่มี table ใหม่), System Configuration & Audit, และ infrastructure design choice ที่ตอบ rubric ของ CPE241", false]]),

  subheading("4. Authentication & Sessions"),
  para([["ระบบ authentication ใช้ better-auth ซึ่งจัดเก็บข้อมูลผู้ให้บริการ (credential / Google OAuth) และ session แยกออกจากตาราง User เพื่อรองรับ multi-provider linking และการจัดการอุปกรณ์ที่ login พร้อมกันได้หลายเครื่อง ส่วน password reset ใช้ token-based flow เพื่อความปลอดภัย", false]]),
  entityTable("Account (better-auth credential / google providers)", [
    ["id", "INT", "PK, AUTO_INCREMENT", "Primary key ของ row provider record"],
    ["user_id", "INT", "FK, NOT NULL", "อ้างถึง users ; CASCADE on delete"],
    ["provider_id", "VARCHAR(40)", "NOT NULL", "ชื่อ provider เช่น \"credential\", \"google\""],
    ["account_id", "VARCHAR(255)", "NOT NULL", "user id ฝั่ง provider (Google sub หรือ user.id เดิม)"],
    ["access_token", "TEXT", "NULL", "OAuth access token (ถ้า provider ส่งมา)"],
    ["refresh_token", "TEXT", "NULL", "OAuth refresh token"],
    ["password", "TEXT", "NULL", "bcrypt hash สำหรับ provider = credential เท่านั้น"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("Session (better-auth session for active devices)", [
    ["id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", ""],
    ["token", "VARCHAR(120)", "UNIQUE, NOT NULL", "Session token (httpOnly cookie)"],
    ["expires_at", "DATETIME", "NOT NULL", "default 30 วัน"],
    ["ip_address", "VARCHAR(45)", "NULL", "IPv4/IPv6 ของอุปกรณ์"],
    ["user_agent", "VARCHAR(255)", "NULL", "Browser / OS string สำหรับหน้า /profile/sessions"],
    ["last_totp_at", "DATETIME", "NULL", "Phase 23.3 — เวลาล่าสุดที่ผ่าน TOTP step-up"],
  ]),
  entityTable("PasswordResetToken (one-time link to set new password)", [
    ["token_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", "เจ้าของ token"],
    ["token_hash", "VARCHAR(64)", "UNIQUE, NOT NULL", "SHA-256 ของ token จริง (เก็บแค่ hash)"],
    ["expires_at", "DATETIME", "NOT NULL", "TTL 30 นาที"],
    ["consumed_at", "DATETIME", "NULL", "เวลา reset สำเร็จ ; null = ใช้ได้"],
  ]),
  entityTable("Verification (better-auth — email verify / OAuth state)", [
    ["id", "INT", "PK, AUTO_INCREMENT", ""],
    ["identifier", "VARCHAR(120)", "NOT NULL", "email หรือ user id ที่ verify"],
    ["value", "TEXT", "NOT NULL", "verification code / token"],
    ["expires_at", "DATETIME", "NOT NULL", ""],
  ]),

  subheading("5. Stripe Connect Integration (Phase 27)"),
  para([["Phase 27 เลือกใช้ Stripe Connect (test mode) แทนระบบ wallet/coin/PromptPay เดิม โดย design choice สำคัญคือ \"ไม่เพิ่ม table ใหม่\" — แทนที่ทุก state ของ payment / balance / payout / refund จะ duplicate ไว้ใน DB ของเรา จะใช้ column-level reference ไปยัง Stripe ID แล้ว fetch state จาก Stripe API on demand ; Stripe เป็น system of record สำหรับทุกอย่างที่เกี่ยวกับเงิน ลด sync risk + simpler schema", false]]),
  entityTable("Store (Phase 27 columns added)", [
    ["stripe_account_id", "VARCHAR(40)", "UNIQUE, NULL", "Stripe Connect Express account (acct_…). NULL = ยังไม่ onboard"],
    ["stripe_payouts_enabled", "BOOLEAN", "DEFAULT false", "Sync จาก Stripe ผ่าน account.updated webhook"],
    ["stripe_charges_enabled", "BOOLEAN", "DEFAULT false", "ต้อง true ก่อนถึงจะ route checkout ผ่าน Connect ได้"],
  ]),
  entityTable("Order (Phase 27 columns added)", [
    ["stripe_payment_intent_id", "VARCHAR(40)", "INDEXED, NULL", "Soft FK ไปยัง PaymentIntent (pi_…)"],
    ["stripe_charge_id", "VARCHAR(40)", "NULL", "Charge id ที่ webhook payment_intent.succeeded เก็บ"],
    ["stripe_refund_id", "VARCHAR(40)", "NULL", "Last refund id (re_…)"],
    ["stripe_amount_received", "INT", "NULL", "ยอดที่ Stripe รับจริง (satang) — มาจาก webhook"],
    ["stripe_amount_refunded", "INT", "DEFAULT 0", "ยอดที่ refund แล้วรวม — bump ผ่าน charge.refunded webhook"],
  ]),
  para([["หมายเหตุ design rationale: VARCHAR columns ทำหน้าที่เป็น \"soft FK\" ไปยัง external system — Stripe ไม่ใช่ฐานข้อมูลของเรา จึง relationship ทาง Prisma ทำไม่ได้ แต่ index ที่ stripe_payment_intent_id ทำให้ webhook handler หา Order ได้เร็ว O(log n) ; balance / payout history / charge list ทั้งหมด fetch live จาก Stripe API ตอน /seller/wallet render — เป็น talking point ที่ดีเรื่อง \"ไม่ทุก state ต้องอยู่ใน DB เรา\"", false]]),

  subheading("6. System Configuration & Audit"),
  para([["ตาราง singleton สำหรับเก็บ feature flag กลาง และ AuditLog สำหรับการตรวจสอบ destructive admin action — slimmed down หลัง Phase 26 trim", false]]),
  entityTable("SystemSetting (singleton, id = 1, pinned by SQL CHECK)", [
    ["id", "INT", "PK, CHECK = 1", "บังคับให้มีได้ 1 row เท่านั้น"],
    ["favorites_enabled", "BOOLEAN", "DEFAULT true", "เปิด-ปิด wishlist surface ทั้งระบบ"],
    ["platform_fee_percent", "DECIMAL(5,2)", "0-100", "% ที่หักจากแต่ละ order ; แปลงเป็น Stripe application_fee_amount ตอน checkout"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("AuditLog (destructive admin action trail + Stripe webhook dedupe)", [
    ["log_id", "INT", "PK", ""],
    ["actor_id", "INT", "FK → users, NULL", "null = system action (เช่น Stripe webhook)"],
    ["action", "VARCHAR(60)", "NOT NULL", "dot-notation เช่น user.ban, stripe.refund, stripe.event.processed"],
    ["target_type", "VARCHAR(40)", "NULL", "ประเภท entity เป้าหมาย"],
    ["target_id", "INT", "NULL", "id ของ entity เป้าหมาย"],
    ["meta", "JSONB", "NULL", "diff ก่อน-หลัง / Stripe event.id สำหรับ idempotency"],
    ["ip_address", "VARCHAR(45)", "NULL", ""],
    ["user_agent", "VARCHAR(255)", "NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("7. Database & Infrastructure (Phase 28)"),
  para([["Phase 28 ย้าย production database จาก Neon ไป Supabase (ทั้งคู่เป็น Postgres-as-a-service free tier) ใน region ap-southeast-1 / Singapore เดียวกับ Fly machine — เลือก Supabase เพราะ dashboard มี Schema Visualizer + SQL Editor + Table Editor ที่ใช้ defense ตอน demo ได้ดี และ free tier เก็บ DB ไว้ได้ใหญ่กว่า + รองรับ Storage / Realtime / Auth ในอนาคตถ้าจะขยาย", false]]),
  bullet("Connection topology: app runtime ใช้ transaction pooler (port 6543, pgbouncer=true) เพื่อให้แต่ละ machine เปิด connection น้อย ; release_command (prisma migrate deploy) ใช้ session pooler (port 5432) เพราะ prepared statements + advisory locks จำเป็นสำหรับ migration"),
  bullet("Direct host db.<ref>.supabase.co:5432 เป็น IPv6-only บน free tier ; Fly egress เป็น IPv4 — เลย unused ทั้งหมด ใช้ pooler ทั้งสองอย่าง"),
  bullet("Schema migration: 23 migrations ตั้งแต่ init จนถึง phase_27 ถูก replay ผ่าน prisma migrate deploy ครั้งเดียว ; seed data restore จาก packages/db/seed.ts"),
  bullet("Trade-off ที่ defend ได้: Supabase กับ Neon ราคาเท่ากัน (free) latency ใกล้เคียง (sin region เดียวกัน) — เลือก Supabase เพราะ DB Studio + ecosystem (storage, edge functions) ทำให้ project ขยายได้ในอนาคตโดยไม่ต้องย้าย DB อีก"),

  subheading("Normalization — เพิ่มเติม Phase 13.6.5 retrofit"),
  para([["เพื่อให้ตอบ rubric ของ CPE241 ครบทุกหัวข้อ Phase 13.6.5 ได้เพิ่มของต่อไปนี้ลง schema (มีอยู่ใน DB จริง ทั้ง Neon เดิมและ Supabase ใหม่):", false]]),
  bullet("Triggers: auto-update StoreStats.rating หลังเพิ่ม/ลบ ProductReview ; product_touch_updated_at trigger ที่ทำหน้าที่เก็บ updated_at ของ Product จากฝั่ง DB"),
  bullet("Views: live_stores_view (กรอง deleted_at + suspended_at), product_with_avg_rating_view"),
  bullet("Roles + GRANT/REVOKE: metu_app (runtime — RW), metu_analytics (read-only, denied audit_log)"),
  bullet("CHECK constraints: product_review.rating BETWEEN 1 AND 5, product_item.price ≥ 0, SystemSetting.id = 1"),
].join("");

const NEW_BLOCK = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${FR_BLOCK}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${BR_BLOCK}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${PJ_BLOCK}`;

const xml = await fs.readFile(DOC_PATH, "utf8");
const sectPrAnchor = '<w:sectPr w:rsidR="00411BF1" w:rsidRPr="00DA4609">';
const idx = xml.indexOf(sectPrAnchor);
if (idx === -1) {
  console.error("Could not find <w:sectPr> anchor — aborting.");
  process.exit(1);
}
const before = xml.slice(0, idx);
const after = xml.slice(idx);
const out = before + NEW_BLOCK + after;
await fs.writeFile(DOC_PATH, out, "utf8");
console.log(`Inserted ${NEW_BLOCK.length} chars before <w:sectPr>. Total now ${out.length} chars.`);
