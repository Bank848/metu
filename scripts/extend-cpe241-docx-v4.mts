/**
 * Phase 32 — extend the original CPE241 docx into v4 (scope document).
 *
 * The audience is the CPE241 instructor reviewing the project's
 * declared scope. Submission locks the feature list — anything not
 * listed here cannot be added or removed later. So this document
 * describes the system's COMPLETE final state in forward-looking
 * scope language ("ระบบจะรองรับ..."), not a phase changelog.
 *
 * Reads:  C:/Users/zxcas/AppData/Local/Temp/docx_v4_unpacked/word/document.xml
 * Writes: same file (in-place insert before </w:body>'s sectPr).
 */
import fs from "node:fs/promises";

const DOC_PATH = "C:/Users/zxcas/AppData/Local/Temp/docx_v4_unpacked/word/document.xml";

const RPR = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_BOLD = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_HDR = `<w:rFonts w:ascii="TH Sarabun New" w:eastAsia="Arial" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function para(text: string, bold = false): string {
  return `<w:p><w:pPr><w:rPr>${bold ? RPR_BOLD : RPR}</w:rPr></w:pPr><w:r><w:rPr>${bold ? RPR_BOLD : RPR}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
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
// FUNCTIONAL REQUIREMENTS — sections 5-11. Friend's sections 1-4
// (User / Store / Product / Stock Allocation / Cart / Order /
// Transaction / Review / Coupon) stay above ; this list completes
// the scope so every demo feature is declared up front.
// ─────────────────────────────────────────────────────────────────
const FR_BLOCK = [
  heading("Functional Requirements (ส่วนที่ 5-11)"),
  para("ส่วนนี้ขยาย Functional Requirements เดิมให้ครอบคลุมทุก feature ที่ระบบจะรองรับ — ครอบคลุมระบบ authentication, wishlist, payment, refund, admin moderation, security hardening และ infrastructure"),

  subheading("5. Authentication & Session"),
  bullet("ระบบรองรับการสมัครและเข้าสู่ระบบด้วย email + password (เก็บ password เป็น bcrypt hash, ไม่เก็บ plaintext)"),
  bullet("ระบบรองรับ Google OAuth one-click sign-in — ผู้ใช้คนเดียวกัน link ทั้ง credential และ Google เข้าด้วยกันได้, unlink ได้จากหน้า /profile/edit"),
  bullet("ระบบรองรับ Two-factor Authentication (TOTP) — ผู้ใช้ enrol ผ่าน QR code ด้วย authenticator app (Google Authenticator / Authy / 1Password) ; เมื่อเปิดใช้งาน ทุก login ต้องกรอกรหัส 6 หลักหลังจาก password"),
  bullet("ระบบรองรับ Session management หลายอุปกรณ์ — ผู้ใช้ดู session ที่ login อยู่ทั้งหมดได้ที่ /profile/sessions (browser, IP, last active), revoke per-device หรือ \"sign out everywhere else\" ได้"),
  bullet("ระบบรองรับ Step-up authentication — action ที่ sensitive (admin refund, change password, unlink Google, delete account) ต้องการ TOTP ใหม่ภายใน 15 นาทีก่อนทำ"),
  bullet("ระบบรองรับ Password recovery ผ่าน email reset link — token เก็บแบบ SHA-256 hash, อายุ 30 นาที, ใช้ได้ครั้งเดียว"),
  bullet("ระบบบังคับให้ผู้ใช้รีเซ็ต password ได้ — admin ติดธง require_password_reset → ผู้ใช้ถูก redirect ไป /profile/edit จนกว่าจะเปลี่ยน password"),

  subheading("6. Wishlist (Favorites)"),
  bullet("ผู้ใช้กดปุ่มหัวใจที่หน้า product detail หรือ product card เพื่อเพิ่มสินค้าลง wishlist"),
  bullet("หน้า /favorites แสดงรายการ wishlist ของผู้ใช้แต่ละคน — กดเข้าไปยัง product detail ได้ตรง"),
  bullet("Admin เปิด-ปิด feature ได้ผ่าน /admin/settings (favoritesEnabled flag) — เมื่อปิด heart icon, hover button, /favorites inbox จะหายทั้งหมด แต่ข้อมูลใน DB คงไว้"),

  subheading("7. Payment & Checkout (Stripe Connect)"),
  bullet("ระบบใช้ Stripe Connect Express เป็น payment processor — ทำงานในโหมด test (test mode) สำหรับ academic demo, รองรับการเปลี่ยนเป็น live mode ในอนาคตโดยไม่กระทบ schema"),
  bullet("Seller ทำการ onboard Stripe Express account ผ่านหน้า /seller/onboarding — ระบบ generate Stripe-hosted onboarding link, Stripe เก็บข้อมูล KYC + ธุรกิจ + บัญชีธนาคาร เอง"),
  bullet("Seller ดูสถานะ Stripe Connect ของร้านได้ที่ /seller/onboarding (charges_enabled, payouts_enabled flags ที่ sync จาก Stripe ผ่าน webhook account.updated)"),
  bullet("Buyer ทำการ checkout ผ่าน Stripe Elements PaymentElement — ข้อมูลบัตรไม่ผ่าน server เรา (PCI scope ของ Stripe ทั้งหมด) — รองรับบัตรเครดิต/เดบิต ทุก network ที่ Stripe รองรับ"),
  bullet("ระบบใช้ direct-charge model — buyer จ่ายเข้า platform Stripe account, แล้ว transfer_data.destination route เงินไปบัญชี seller's Connected Account อัตโนมัติพร้อมหัก application_fee_amount (= ราคารวม × platformFeePercent%)"),
  bullet("ระบบรองรับ webhook event 5 ประเภท: payment_intent.succeeded (flip Order → paid), payment_intent.payment_failed (flip Order → cancelled), charge.refunded (update refund amount), account.updated (sync Connect capability flags), payout.paid (audit log)"),
  bullet("Webhook idempotency: ทุก event.id ตรวจ AuditLog ก่อน process — ถ้าเคย process แล้วจะ return 200 ทันที กัน double-process จาก Stripe retries"),
  bullet("Order lifecycle: pending → paid → fulfilled / cancelled / refunded — แต่ละ transition บันทึก timestamp ที่ updated_at"),

  subheading("8. Refund"),
  bullet("Admin เห็น list ของ Stripe-charged orders ที่ refund ได้ที่ /admin/refunds — เลือกได้แค่ order ที่ status='paid' หรือ 'fulfilled'"),
  bullet("การกด refund ต้องผ่าน TOTP step-up (admin ต้องกรอกรหัส 6 หลักภายใน 15 นาทีก่อน)"),
  bullet("ระบบเรียก Stripe Refund API พร้อม reverse_transfer:true (เงินถูก claw back จาก Connected Account ของ seller) + refund_application_fee:true (platform คืน application fee)"),
  bullet("เมื่อ refund สำเร็จ ระบบ update Order.status='refunded', stripe_refund_id, stripe_amount_refunded ; webhook charge.refunded เป็นการ confirm จาก Stripe อีกครั้ง"),
  bullet("ทุกการ refund บันทึก AuditLog row พร้อม actor, refund_id, amount"),

  subheading("9. Admin Panel"),
  bullet("User Management: ban / unban / change role (buyer↔seller↔admin) / force-password-reset toggle"),
  bullet("Store Management: suspend (hide from public, seller ยังเข้าได้) / un-suspend / soft-delete"),
  bullet("Reports: orders by status, revenue per store, top products by units sold + revenue"),
  bullet("Audit Log Viewer: searchable trail (by action, actor, target_type, date range) — ทุก destructive admin action บันทึกที่นี่"),
  bullet("Refund Queue: list orders ที่จ่ายผ่าน Stripe + ปุ่ม refund per row"),
  bullet("System Settings: 2 fields — favoritesEnabled (bool), platformFeePercent (decimal, ใช้คำนวณ Stripe application_fee)"),
  bullet("ER Diagram (/admin/er-diagram): live render ของ schema ปัจจุบัน 27 entities + crow-foot connectors — render โดย in-house renderer (TypeScript + SVG) ที่อ่าน schema.prisma โดยตรงและ update อัตโนมัติทุก migration"),
  bullet("Tech Stack (/admin/tech-stack): list dependency เวอร์ชัน live จาก package.json ทั้ง 5 จุด (root, web, server, db, shared)"),
  bullet("Changelog (/admin/changelog): list การพัฒนาแต่ละ phase พร้อม commit references"),

  subheading("10. Security Hardening"),
  bullet("Helmet middleware: HSTS 180 วัน, X-Frame-Options DENY, X-Content-Type-Options nosniff, Content-Security-Policy ที่ allow-list เฉพาะ origin ที่จำเป็น (Google OAuth, fonts.googleapis.com)"),
  bullet("Better-auth session cookie: sameSite=strict, httpOnly, secure — กัน CSRF + XSS access ของ token"),
  bullet("Rate limiting (in-process sliding-window): login 5/min/IP, register 3/hr/IP, OTP 3/min, forgot-password 3/5min — ตอบ HTTP 429 + Retry-After header"),
  bullet("Audit log: ทุก destructive admin action (user.ban, store.delete, settings.update, role.change, force_password_reset.set/clear, stripe.refund) บันทึก row พร้อม actor / IP / user_agent / meta(diff)"),
  bullet("Password storage: bcrypt hash (cost factor 10) — ไม่เก็บ plaintext, reset token เก็บแบบ SHA-256 hash"),
  bullet("Database query safety: Prisma ORM ใช้ parameterized queries เสมอ — กัน SQL injection ที่ระดับ driver"),
  bullet("Stripe webhook signature verification: ทุก event ตรวจ HMAC-SHA-256 signature ด้วย STRIPE_WEBHOOK_SECRET ก่อน trust payload"),

  subheading("11. Production Infrastructure"),
  bullet("Hosting: Fly.io 2 machines ใน sin region (Singapore) — metu.fly.dev (Next.js BFF) คุยกับ metu-api.fly.dev (Express server) ผ่าน internal network ของ Fly"),
  bullet("Database: Supabase Postgres ใน ap-southeast-1 — region เดียวกับ Fly machine (latency < 5 ms)"),
  bullet("Connection pooling: app runtime ใช้ transaction pooler port 6543 (pgbouncer compatible) ; release_command (Prisma migrate) ใช้ session pooler port 5432 ซึ่งรองรับ DDL + advisory locks"),
  bullet("Auto-stop: ทั้งสอง app ตั้ง min_machines_running=0 — machine hibernate หลัง idle, auto-restart เมื่อมี request — ค่าใช้จ่ายต่ำกว่า Fly free credit ($5/เดือน)"),
  bullet("Database triggers + views + roles: 2 triggers (auto-update store rating, product timestamps), 2 views (live_stores_view, product_with_avg_rating_view), 2 roles (metu_app RW, metu_analytics read-only)"),
  bullet("CHECK constraints: product_review.rating BETWEEN 1 AND 5, product_item.price ≥ 0, system_setting.id = 1 (singleton enforcement)"),
].join("");

// ─────────────────────────────────────────────────────────────────
// BUSINESS RULES — items 13-22 (continuing friend's 1-12).
// All forward-looking ("ระบบจะ...", "เมื่อ...") to match scope-
// document tone.
// ─────────────────────────────────────────────────────────────────
const BR_BLOCK = [
  heading("Business Rules (ข้อ 13-22)"),
  para("กฎทางธุรกิจที่ขยายจาก 12 ข้อเดิม — ครอบคลุมระบบ authentication, payment ผ่าน Stripe Connect, refund, audit, soft delete และ session management"),
  numItemBold(13, "Single Store per User", "ผู้ใช้แต่ละคนเปิดร้านได้สูงสุด 1 ร้าน — บังคับด้วย Store.owner_id UNIQUE constraint ที่ schema level"),
  numItemBold(14, "TOTP Step-Up Required", "เมื่อผู้ใช้ทำ action sensitive (admin refund, change password, unlink Google, delete account) ระบบต้องการ TOTP ใหม่ภายใน 15 นาที — Session.last_totp_at เก็บ timestamp ที่ผ่าน step-up ล่าสุด"),
  numItemBold(15, "Password Reset Token Expiration", "Password reset token มีอายุ 30 นาที, ใช้ได้ครั้งเดียว, เก็บใน DB เป็น SHA-256 hash — ค่า raw token อยู่ใน email link เท่านั้น"),
  numItemBold(16, "Rate Limiting", "ระบบใช้ in-process sliding-window limiter — login 5/min/IP, register 3/hr/IP, OTP 3/min, forgot-password 3/5min ; เมื่อเกิน limit จะตอบ 429 พร้อม Retry-After header"),
  numItemBold(17, "Stripe Connect Settlement", "ทุก checkout ผ่าน Stripe direct charge พร้อม transfer_data.destination — เงินไหลจากบัตร buyer เข้า platform Stripe account แล้ว Stripe transfer (100 − platformFeePercent)% ของยอดเข้า Connected Account ของ seller อัตโนมัติ"),
  numItemBold(18, "Platform Fee", "SystemSetting.platform_fee_percent (default 5.00%) ถูกแปลงเป็น Stripe application_fee_amount (หน่วย satang) ตอนสร้าง PaymentIntent — แพลตฟอร์มเก็บส่วนนี้ที่บัญชี platform ฝั่ง Stripe"),
  numItemBold(19, "Full Refund Reverses Both Sides", "เมื่อ admin ทำการ refund order ระบบเรียก Stripe Refund API พร้อม reverse_transfer:true และ refund_application_fee:true — เงินคืนทั้ง buyer's card, claw back จาก Connect account ของ seller, และคืน application fee ของ platform"),
  numItemBold(20, "Webhook Idempotency", "ทุก event จาก Stripe ถูก verify HMAC signature ด้วย STRIPE_WEBHOOK_SECRET ก่อน ; ระบบใช้ event.id เป็น dedup key ผ่าน AuditLog meta.eventId — process เคยแล้วจะ return 200 ทันที กัน double-process จาก Stripe retry"),
  numItemBold(21, "Audit Trail for Destructive Actions", "ทุก destructive admin action (user.ban, store.delete, store.suspend, role.change, force_password_reset.set/clear, settings.update, stripe.refund, stripe.event.processed) บันทึก AuditLog row พร้อม actor_id, action, target_type, target_id, meta(JSON diff), ip_address, user_agent"),
  numItemBold(22, "Soft Delete Preserves History", "User, Store, Product ที่ถูก delete ใช้ soft delete (deleted_at column) — ไม่ FK-cascade ลบ Order, Review, OrderItem ที่อ้างถึง ; public surface ซ่อนให้ แต่ history คงอยู่สำหรับ audit"),
].join("");

// ─────────────────────────────────────────────────────────────────
// PROJECT JUSTIFICATION — sections 4-9. Friend's 1-3 cover
// User/Store, Product/Inventory, Transaction/Promotion. The
// remaining entities are catalogued here in the same table style.
// ─────────────────────────────────────────────────────────────────
const PJ_BLOCK = [
  heading("Project Justification (ส่วนที่ 4-9)"),
  para("ส่วนนี้บันทึก entity ที่เหลือซึ่งไม่ถูกครอบคลุมใน section 1-3 — รวม supporting tables (Country, BusinessType, Category), entity ของระบบ review + wishlist, ตาราง authentication ของ better-auth, และ infrastructure tables ของ Stripe + audit + system config"),

  subheading("4. Supporting Reference Tables"),
  para("ตาราง reference ที่ใช้ normalize ข้อมูลซ้ำซ้อน เช่น country, business type, category — แต่ละ user / store / product อ้างถึงแถว reference แทนการเก็บค่า string ตรง ๆ"),
  entityTable("Country (เลือกประเทศที่ใช้กับ user profile)", [
    ["country_id", "INT", "PK, AUTO_INCREMENT", "Primary key"],
    ["country_code", "INT", "NOT NULL", "ISO numeric code (e.g. 764 for Thailand)"],
    ["name", "VARCHAR(60)", "NOT NULL", "ชื่อประเทศที่แสดงใน UI"],
  ]),
  entityTable("BusinessType (ประเภทร้าน — Sole Proprietor / Company / etc.)", [
    ["type_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["name", "VARCHAR(30)", "NOT NULL", "ชื่อประเภทร้าน"],
    ["description", "VARCHAR(150)", "NOT NULL", "คำอธิบายสั้น ๆ สำหรับ tooltip ใน become-seller form"],
  ]),
  entityTable("Category (หมวดหมู่สินค้า)", [
    ["category_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["category_name", "VARCHAR(40)", "NOT NULL", "ชื่อหมวด เช่น \"3D Mode\", \"Gaming\", \"Services\""],
    ["description", "VARCHAR(150)", "NOT NULL", "คำอธิบายหมวดสำหรับ SEO + tooltip"],
  ]),

  subheading("5. Reviews, Tags & Wishlist"),
  para("ตารางที่ขยายระบบ catalog ให้รองรับการรีวิวจากผู้ซื้อจริง, การติด tag หลาย tag ต่อสินค้า (N:M junction), และ wishlist ของผู้ใช้แต่ละคน"),
  entityTable("ProductReview (รีวิวจากผู้ซื้อ)", [
    ["review_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["product_id", "INT", "FK, NOT NULL", "อ้างถึง product"],
    ["user_id", "INT", "FK, NOT NULL", "ผู้ที่รีวิว"],
    ["rating", "INT", "1-5 (CHECK constraint)", "ดาว 1-5 ; CHECK บังคับช่วง"],
    ["comment", "VARCHAR(255)", "NOT NULL", "เนื้อหารีวิว"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("ProductTag (master list ของ tag)", [
    ["tag_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["tag_name", "VARCHAR(30)", "UNIQUE, NOT NULL", "ชื่อ tag เช่น \"4K\", \"realistic\", \"fast-delivery\""],
    ["tag_description", "VARCHAR(150)", "NOT NULL", "คำอธิบายของ tag (จาก seller ในตอนสร้าง)"],
  ]),
  entityTable("ProductNTag (junction N:M: Product ↔ ProductTag)", [
    ["junction_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["product_id", "INT", "FK, NOT NULL", ""],
    ["tag_id", "INT", "FK, NOT NULL", ""],
    ["", "", "UNIQUE(product_id, tag_id)", "สินค้าหนึ่ง tag เดียวกันได้แค่ครั้งเดียว"],
  ]),
  entityTable("ProductFavorite (wishlist ของ user)", [
    ["favorite_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", ""],
    ["product_id", "INT", "FK, NOT NULL", ""],
    ["", "", "UNIQUE(user_id, product_id)", "user เดียวกัน favorite สินค้าเดียวกันได้แค่ครั้งเดียว — กดซ้ำเป็น toggle off"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("CouponUsage (บันทึกการใช้คูปอง)", [
    ["usage_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["coupon_id", "INT", "FK, NOT NULL", ""],
    ["user_id", "INT", "FK, NOT NULL", "ผู้ใช้ที่ใช้คูปอง"],
    ["created_at", "DATETIME", "DEFAULT now()", "ใช้ตรวจ Coupon.usage_limit ก่อน accept ตอน checkout"],
  ]),

  subheading("6. Authentication & Sessions"),
  para("ระบบ authentication ใช้ better-auth library ซึ่งจัดเก็บข้อมูล provider และ session แยกออกจากตาราง User เพื่อรองรับ multi-provider linking (credential + Google) และ multi-device session ของผู้ใช้คนเดียว"),
  entityTable("Account (provider linking — credential / google)", [
    ["id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", "อ้างถึง users ; CASCADE on delete"],
    ["provider_id", "VARCHAR(40)", "NOT NULL", "ชื่อ provider — \"credential\", \"google\""],
    ["account_id", "VARCHAR(255)", "NOT NULL", "user identity ฝั่ง provider (Google sub สำหรับ google, email สำหรับ credential)"],
    ["password", "TEXT", "NULL", "bcrypt hash — เฉพาะ provider=credential เท่านั้น"],
    ["access_token", "TEXT", "NULL", "OAuth access token (เก็บถ้า provider ส่งมา)"],
    ["refresh_token", "TEXT", "NULL", "OAuth refresh token"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
    ["", "", "UNIQUE(provider_id, account_id)", "provider+identity เดียวกัน link ได้แค่ครั้งเดียว"],
  ]),
  entityTable("Session (อุปกรณ์ที่ login อยู่)", [
    ["id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", ""],
    ["token", "VARCHAR(120)", "UNIQUE, NOT NULL", "Session token เก็บใน httpOnly cookie ฝั่ง browser"],
    ["expires_at", "DATETIME", "NOT NULL", "default 30 วันจาก created"],
    ["ip_address", "VARCHAR(45)", "NULL", "IPv4/IPv6 ของอุปกรณ์ (จาก X-Forwarded-For)"],
    ["user_agent", "VARCHAR(255)", "NULL", "Browser + OS string สำหรับแสดงในหน้า /profile/sessions"],
    ["last_totp_at", "DATETIME", "NULL", "เวลาล่าสุดที่ผ่าน TOTP step-up — ใช้ตรวจ 15-min window สำหรับ sensitive action"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("Verification (email verify / OAuth state token)", [
    ["id", "INT", "PK, AUTO_INCREMENT", ""],
    ["identifier", "VARCHAR(120)", "NOT NULL", "email หรือ user id ที่ verify"],
    ["value", "TEXT", "NOT NULL", "verification code / token"],
    ["expires_at", "DATETIME", "NOT NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("PasswordResetToken (link reset password ทาง email)", [
    ["token_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", ""],
    ["token_hash", "VARCHAR(64)", "UNIQUE, NOT NULL", "SHA-256 ของ raw token — raw value อยู่ใน email link เท่านั้น"],
    ["expires_at", "DATETIME", "NOT NULL", "TTL 30 นาที"],
    ["consumed_at", "DATETIME", "NULL", "เวลา reset สำเร็จ ; null = ใช้ได้"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("7. UserStats & StoreStats"),
  para("ตาราง stat แยกออกจาก main entity เพื่อให้ query รายการที่ไม่ต้องการ stats ทำงานเร็ว — และให้ trigger / materialized view update stat แยกได้โดยไม่กระทบ main row"),
  entityTable("UserStats (1:1 กับ User)", [
    ["user_id", "INT", "PK, FK", "อ้างถึง users"],
    ["buyer_level", "INT", "DEFAULT 1", "ระดับ buyer (อนาคตอาจขยายเป็นระบบ tier)"],
    ["seller_level", "INT", "DEFAULT 0", "ระดับ seller (0 = buyer-only)"],
    ["role", "USERROLE", "ENUM (buyer/seller/admin)", "บทบาทสูงสุดที่ user มี — ใช้ในการ gate /admin /seller routes"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("StoreStats (1:1 กับ Store)", [
    ["stat_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["store_id", "INT", "FK, UNIQUE", ""],
    ["ctr", "INT", "DEFAULT 0", "click-through rate (basis points 0-10000)"],
    ["rating", "INT", "DEFAULT 0", "avg rating × 10 (เช่น 48 = 4.8★) — update ผ่าน trigger หลังเพิ่ม/ลบ ProductReview"],
    ["response_time", "INT", "DEFAULT 0", "เวลาตอบกลับเฉลี่ย (นาที)"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("8. Stripe Payment Integration"),
  para("ระบบไม่สร้างตารางสำหรับ payment / balance / payout / refund ตรง ๆ — Stripe เป็น system of record สำหรับทุก state ของเงิน เราเก็บแค่ ID อ้างอิงไปยัง Stripe object ในรูปคอลัมน์ของ Order และ Store เพื่อ link ผลลัพธ์จาก webhook กลับเข้าสู่ row ของระบบเรา"),
  entityTable("Store (Stripe-related columns)", [
    ["stripe_account_id", "VARCHAR(40)", "UNIQUE, NULL", "Stripe Connect Express account (acct_…) ; null = seller ยังไม่ onboard"],
    ["stripe_payouts_enabled", "BOOLEAN", "DEFAULT false", "Sync จาก Stripe ผ่าน webhook account.updated — true = ถอนเงินไปบัญชีธนาคารได้"],
    ["stripe_charges_enabled", "BOOLEAN", "DEFAULT false", "ต้อง true ก่อนระบบถึงจะ route checkout ผ่าน Connect ได้"],
  ]),
  entityTable("Order (Stripe-related columns)", [
    ["stripe_payment_intent_id", "VARCHAR(40)", "INDEXED, NULL", "Soft FK ไปยัง PaymentIntent (pi_…) — index ทำให้ webhook handler หา Order เจอเร็ว O(log n)"],
    ["stripe_charge_id", "VARCHAR(40)", "NULL", "Charge id (ch_…) ที่ webhook payment_intent.succeeded เก็บไว้"],
    ["stripe_refund_id", "VARCHAR(40)", "NULL", "Last refund id (re_…) จาก /admin/refunds"],
    ["stripe_amount_received", "INT", "NULL", "ยอดที่ Stripe รับจริงในหน่วย satang (1 บาท = 100 satang)"],
    ["stripe_amount_refunded", "INT", "DEFAULT 0", "ยอดที่ refund แล้วในหน่วย satang — bump ผ่าน webhook charge.refunded"],
  ]),

  subheading("9. System Configuration & Audit Log"),
  para("ตาราง singleton สำหรับ feature flag กลาง และ AuditLog สำหรับการตรวจสอบ destructive admin action + Stripe webhook dedupe"),
  entityTable("SystemSetting (singleton, id=1 บังคับด้วย CHECK constraint)", [
    ["id", "INT", "PK, CHECK = 1", "บังคับให้มีได้ 1 row เท่านั้น"],
    ["favorites_enabled", "BOOLEAN", "DEFAULT true", "เปิด-ปิด wishlist surface ทั้งระบบ"],
    ["platform_fee_percent", "DECIMAL(5,2)", "0-100", "% ที่หักจากแต่ละ order ; แปลงเป็น Stripe application_fee_amount ตอน checkout"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("AuditLog (destructive action trail + Stripe event dedupe)", [
    ["log_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["actor_id", "INT", "FK → users, NULL", "null = system action (เช่น Stripe webhook)"],
    ["action", "VARCHAR(60)", "NOT NULL", "dot-notation เช่น user.ban, stripe.refund, stripe.event.processed"],
    ["target_type", "VARCHAR(40)", "NULL", "ประเภท entity เป้าหมาย (user, store, order, …)"],
    ["target_id", "INT", "NULL", "id ของ entity เป้าหมาย"],
    ["meta", "JSONB", "NULL", "diff ก่อน-หลัง / Stripe event.id สำหรับ idempotency check"],
    ["ip_address", "VARCHAR(45)", "NULL", ""],
    ["user_agent", "VARCHAR(255)", "NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("Database-Level Features (Triggers / Views / Roles / Constraints)"),
  para("เพื่อตอบ rubric ของ CPE241 ครบทุกหัวข้อ schema มีของระดับ Postgres ดังนี้:"),
  bullet("Triggers (2 ตัว): auto-update StoreStats.rating หลังเพิ่ม/ลบ ProductReview ; product_touch_updated_at trigger เก็บ Product.updated_at จากฝั่ง DB (Prisma ไม่เขียน column นี้เลย — DB เป็น source of truth)"),
  bullet("Views (2 ตัว): live_stores_view (กรอง deleted_at + suspended_at สำหรับ public surface), product_with_avg_rating_view (join ProductReview, group, avg)"),
  bullet("Roles + GRANT/REVOKE: metu_app (runtime user — RW ทุกตาราง), metu_analytics (read-only, denied audit_log สำหรับการรักษาความเป็นส่วนตัวของ admin action)"),
  bullet("CHECK constraints: product_review.rating BETWEEN 1 AND 5 ; product_item.price ≥ 0 ; system_setting.id = 1 (singleton enforcement)"),
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
