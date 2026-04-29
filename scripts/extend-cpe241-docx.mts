/**
 * Phase 25 — extend the original CPE241 docx with content covering
 * Phases 14-23 (Auth/Comm/Wallet/Withdraw/Admin/Security).
 *
 * Reads the unpacked document.xml at:
 *   C:/Users/zxcas/AppData/Local/Temp/docx_v1_unpacked/word/document.xml
 *
 * Generates additional paragraphs (FR 5-11, BR 13-22, PJ sections
 * 4-8 with entity tables) and inserts them just before </w:body>.
 *
 * Style matches the original docx:
 *   - TH Sarabun New, size 24 (12pt)
 *   - Bold inline section headings (no Heading 1/2 styles)
 *   - Numbered list using existing numId 1 (Decimal level 0)
 *   - Tables use header bg #1E5AA8 white text, 4 cols
 */
import fs from "node:fs/promises";

const DOC_PATH = "C:/Users/zxcas/AppData/Local/Temp/docx_v1_unpacked/word/document.xml";

// ─────────────────────────────────────────────────────────────────
// XML helpers — keep TH Sarabun New + size 24 consistent everywhere.
// ─────────────────────────────────────────────────────────────────
const RPR = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_BOLD = `<w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
const RPR_HDR = `<w:rFonts w:ascii="TH Sarabun New" w:eastAsia="Arial" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain paragraph with mixed runs (each run = [text, bold?]). */
function para(runs: Array<[string, boolean?]>): string {
  const r = runs
    .map(([t, b]) => `<w:r><w:rPr>${b ? RPR_BOLD : RPR}</w:rPr><w:t xml:space="preserve">${escape(t)}</w:t></w:r>`)
    .join("");
  return `<w:p><w:pPr><w:rPr>${RPR}</w:rPr></w:pPr>${r}</w:p>`;
}

/** Section heading (bold, 14pt — slightly bigger than body). */
function heading(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}

/** Sub-heading (bold, body size). */
function subheading(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="80"/><w:rPr>${RPR_BOLD}</w:rPr></w:pPr><w:r><w:rPr>${RPR_BOLD}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}

/** Numbered list paragraph using existing numId 2 (continuing list). */
function numItem(num: number, text: string): string {
  // Render the number explicitly inline (instead of relying on
  // numbering.xml continuation, which is brittle when extending past
  // the original 22 rules). The original docx mixes manual numbering
  // and ListParagraph; manual is safer here.
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:ind w:left="720" w:hanging="360"/><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${RPR_BOLD}</w:rPr><w:t xml:space="preserve">${num}. </w:t></w:r><w:r><w:rPr>${RPR}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
}

/** Numbered list paragraph with a bold prefix + body. */
function numItemBold(num: number, prefix: string, body: string): string {
  return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:ind w:left="720" w:hanging="360"/><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${RPR_BOLD}</w:rPr><w:t xml:space="preserve">${num}. ${escape(prefix)}: </w:t></w:r><w:r><w:rPr>${RPR}</w:rPr><w:t xml:space="preserve">${escape(body)}</w:t></w:r></w:p>`;
}

/** Bulleted item (manual bullet char). */
function bullet(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:ind w:left="1080" w:hanging="360"/><w:rPr>${RPR}</w:rPr></w:pPr><w:r><w:rPr>${RPR}</w:rPr><w:t xml:space="preserve">• ${escape(text)}</w:t></w:r></w:p>`;
}

// 4-col table (Name | Type | Constraints | Description) — header
// shading + body row stripes.
function entityTable(title: string, rows: Array<[string, string, string, string]>): string {
  const cell = (text: string, isHeader: boolean, w: number) => {
    const fill = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="1E5AA8"/>` : "";
    const borderColor = "1E5AA8";
    const borders = ["top", "left", "bottom", "right"]
      .map((s) => `<w:${s} w:val="single" w:sz="1" w:space="0" w:color="${borderColor}"/>`)
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
// Content blocks.
// ─────────────────────────────────────────────────────────────────

const FR_BLOCK = [
  heading("Functional Requirements (เพิ่มเติม Phase 14-23)"),
  para([["ส่วนนี้ต่อยอดจาก Functional Requirements เดิม (User/Store/Product/Stock Allocation/Cart/Order/Transaction/Review/Coupon) ครอบคลุม feature ที่เพิ่มขึ้นใน Phase 14 เป็นต้นมา ได้แก่ ระบบ authentication, การสื่อสาร, wishlist, wallet, การถอนเงินของผู้ขาย, admin panel และ security hardening", false]]),

  subheading("5. Authentication & Security"),
  bullet("Multi-provider sign-in ผ่าน better-auth: รองรับการสมัคร/เข้าสู่ระบบทั้งแบบ email + password และผ่าน Google OAuth (link/unlink ได้ใน /profile/edit)"),
  bullet("Two-factor authentication (TOTP): ผู้ใช้ enrol ผ่าน QR code → ยืนยัน 6 หลัก → ระบบเก็บ secret + ตรวจสอบทุกครั้งที่ login เมื่อ totp_enabled = true"),
  bullet("Session management: ดู session ที่ login อยู่ทั้งหมด (browser, IP, last active) ผ่าน /profile/sessions ; revoke per-device ได้ ; “sign-out everywhere else” คลิกเดียว"),
  bullet("Step-up authentication: action ที่ sensitive (withdraw / change-password / unlink Google / delete account) ต้องการ TOTP ใหม่ภายใน 15 นาทีก่อนทำ"),
  bullet("Password recovery: email reset token (TTL 30 นาที, hash เก็บ) ; ผู้ใช้คลิก link → ตั้งรหัสใหม่"),
  bullet("Rate limiting: in-process sliding-window — login 5/15min/IP+email · register 3/hr/IP · OTP 3/min · message 30/min/user · top-up 10/hr/user · withdrawal 3/hr/user (429 + Retry-After header)"),

  subheading("6. Communication & Engagement"),
  bullet("Buyer ↔ Seller messaging: inbox + thread view + unread badge บน TopNav ; ต่อจาก order/product context"),
  bullet("Chat-enabled toggle: admin ปิด-เปิดได้ทั้งระบบผ่าน /admin/settings → 3-layer gate (route 404, icon hide, API 403)"),
  bullet("Product Q&A: ผู้ซื้อถามใต้สินค้า → seller (หรือ admin) ตอบ ; admin moderation ลบ/แบนผู้ใช้ที่ละเมิด"),
  bullet("Profanity filter: ตรวจ message body, review comment, product question ทุกข้อความ (leo-profanity + Thai blocklist) ก่อน insert ; reject 400 ProfanityRejected"),

  subheading("7. Wishlist & Notifications"),
  bullet("Product favorites: ผู้ใช้กดหัวใจเก็บสินค้าลง wishlist (ProductFavorite) ; favorites-enabled toggle ของ admin → 3-layer gate"),
  bullet("Stock alerts: subscribe ProductItem → email แจ้งเมื่อสต๊อกกลับมา"),

  subheading("8. Wallet & Payment"),
  bullet("Coin system: 1 บาท = 10 coins (canonical) ; ทุกราคาใน UI แสดงทั้ง baht และ coins"),
  bullet("Wallet ledger: per-user balance + WalletTransaction (topup/spend/refund/grant) ; wrap atomic ใน $transaction"),
  bullet("PromptPay top-up: user กรอกจำนวน → generate QR → จ่าย → upload สลิป → ระบบ auto-verify (jsqr decode + EMVCo parse + ตรวจ amount/recipient match) → auto-credit หรือเข้า admin queue ถ้า verify ไม่ผ่าน"),
  bullet("Wallet enforcement at checkout: เมื่อ wallet_enabled = true จะ debit buyer และ credit แต่ละ store (ตาม platform_fee_percent) ใน $transaction เดียวกับการสร้าง Order"),
  bullet("Demo mode: walletEnabled = false → checkout ทำงานปกติ ไม่หักเหรียญ ไม่เครดิตร้านค้า (สำหรับ demo อาจารย์)"),

  subheading("9. Seller Withdrawal"),
  bullet("Seller request: ระบุจำนวน (ขั้นต่ำ 100 coins) + ข้อมูลบัญชีธนาคาร (ชื่อ, เลขที่ 10-12 หลัก, ชื่อบัญชี) → coins ถูกหักจาก store.coin_balance ทันที (escrow)"),
  bullet("Admin queue: review pending requests → โอนเงินจริงเข้าบัญชี → upload สลิป + mark paid หรือ reject พร้อม reason → coins คืนกลับเมื่อ reject"),
  bullet("Fee snapshot: withdrawal_fee_percent ถูก lock ที่เวลา request ลง field fee_percent_bp (basis points) → admin ปรับ rate global ไม่กระทบ open requests"),

  subheading("10. Admin Panel"),
  bullet("User management: ban / unban / change role / force-password-reset"),
  bullet("Store management: suspend / un-suspend / soft-delete"),
  bullet("Reports: orders by status, revenue per store, top products"),
  bullet("Audit log: searchable trail ของทุก destructive action (actorId + IP + UA + meta diff)"),
  bullet("System settings: feature flag toggles + PromptPay ID + platform_fee_percent + withdrawal_fee_percent"),
  bullet("ER diagram (/admin/er-diagram): live-render schema ปัจจุบัน (Phase 24, in-house renderer)"),
  bullet("Tech stack (/admin/tech-stack): list dependency เวอร์ชันจาก package.json"),

  subheading("11. Security Hardening"),
  bullet("Helmet middleware: HSTS 180 วัน, X-Frame-Options DENY, X-Content-Type-Options nosniff, CSP allow-list"),
  bullet("Better-auth session cookie: sameSite = strict, httpOnly, secure"),
  bullet("Audit events: ทุก destructive admin action บันทึก AuditLog row พร้อม actorId + IP + UA + meta(diff)"),
  bullet("Triggers + Views + Roles + GRANT/REVOKE + CHECK constraints (Phase 13.6.5 retrofit ตาม CPE241 rubric — มีใน DB อยู่แล้ว)"),
].join("");

const BR_BLOCK = [
  heading("Business Rules (เพิ่มเติมข้อ 13-22)"),
  para([["ต่อจาก 12 ข้อเดิม (User Profile/Store Ownership/Product Visibility/Stock/Cart Constraint/Order/Transaction/Review/Coupon ฯลฯ) ส่วนนี้ครอบคลุม rule ที่มาจาก Phase 17 เป็นต้นไป", false]]),
  numItemBold(13, "Coin Conversion", "ทุก price ที่แสดงต่อ buyer คำนวณจาก ProductItem.coin_price (= price × 10) ; รองรับการปรับอัตราเหรียญในอนาคตโดยไม่กระทบ baht price"),
  numItemBold(14, "Wallet Spending", "เมื่อ SystemSetting.wallet_enabled = true, checkout จะหัก coin จาก buyer's Wallet (atomic ใน $transaction) + เครดิต Store.coin_balance ของแต่ละ seller (1 - platform_fee_percent / 100) ของยอด store-line"),
  numItemBold(15, "Platform Fee", "SystemSetting.platform_fee_percent (default 5.00%) ; แพลตฟอร์มเก็บจากทุก sale, snapshot เป็น integer basis-points (550 = 5.5%) เพื่อกัน float drift"),
  numItemBold(16, "Withdrawal Minimum", "ขั้นต่ำ 100 coins (≈ ฿10) ต่อ request ; กัน sub-baht request"),
  numItemBold(17, "Withdrawal Fee Snapshot", "SystemSetting.withdrawal_fee_percent ณ ขณะ submit ถูก lock ไว้บน Withdrawal.fee_percent_bp ; admin เปลี่ยน rate global ไม่กระทบ open requests"),
  numItemBold(18, "Withdrawal Escrow", "coin ที่ขอถอนถูกหักจาก Store.coin_balance ทันที (สถานะ pending) ; ถ้า admin reject → คืน coins กลับผ่าน StoreTransaction(type = withdraw_reverse)"),
  numItemBold(19, "TOTP Step-Up", "action sensitive (POST /seller/withdrawals, POST /auth/change-password, DELETE /auth/connected-accounts/google, DELETE /auth/me) ต้องการ TOTP ใหม่ภายใน 15 นาที ; Session.last_totp_at เก็บ timestamp ที่ผ่าน step-up"),
  numItemBold(20, "Rate Limiting", "in-process sliding-window limiter — login 5/15min/IP+email, register 3/hr/IP, OTP 3/min, message 30/min/user, topup 10/hr/user, withdraw 3/hr/user ; ตอบ 429 + Retry-After header"),
  numItemBold(21, "Profanity Filter", "ทุก text user-input (username, first_name, last_name, review.comment, message.body, product_question.body) ตรวจ leo-profanity + Thai blocklist ก่อน insert ; reject 400 ProfanityRejected"),
  numItemBold(22, "Audit Trail", "ทุก destructive admin action (user.ban, store.delete, withdrawal.approve/reject, settings.update, role.change, force_password_reset.set/clear) เขียน AuditLog row พร้อม actorId / action / target_type / target_id / meta(diff) / ip_address / user_agent"),
].join("");

const PJ_BLOCK = [
  heading("Project Justification (เพิ่มเติม section 4-8)"),
  para([["ต่อจาก section 1-3 เดิม (User & Store Management / Product & Inventory / Transaction & Promotion) ส่วนนี้ครอบคลุม entity ที่มาจาก Phase 14-23 ได้แก่ Authentication & Sessions, Communication, Wallet & Payment, Seller Withdrawal และ System Configuration & Audit", false]]),

  subheading("4. Authentication & Sessions"),
  para([["ระบบ authentication ใช้ better-auth ซึ่งจัดเก็บข้อมูลผู้ให้บริการ (credential / Google OAuth) และ session แยกออกจากตาราง User เพื่อรองรับ multi-provider linking และการจัดการอุปกรณ์ที่ login พร้อมกันได้หลายเครื่อง", false]]),
  entityTable("Account (better-auth credential / google providers)", [
    ["id", "INT", "PK, AUTO_INCREMENT", "Primary key ของ row provider record"],
    ["user_id", "INT", "FK, NOT NULL", "อ้างถึง users ; CASCADE on delete"],
    ["provider_id", "VARCHAR(40)", "NOT NULL", "ชื่อ provider เช่น \"credential\", \"google\""],
    ["account_id", "VARCHAR(255)", "NOT NULL", "user id ฝั่ง provider (Google sub หรือ user.id เดิมของ credential)"],
    ["access_token", "TEXT", "NULL", "OAuth access token (เก็บเฉพาะถ้า provider ส่งมา)"],
    ["refresh_token", "TEXT", "NULL", "OAuth refresh token"],
    ["password", "TEXT", "NULL", "bcrypt hash สำหรับ provider = credential เท่านั้น"],
    ["created_at", "DATETIME", "DEFAULT now()", "เวลาที่ link provider"],
  ]),
  entityTable("Session (better-auth session for active devices)", [
    ["id", "INT", "PK, AUTO_INCREMENT", "Primary key ของ session row"],
    ["user_id", "INT", "FK, NOT NULL", "อ้างถึง users"],
    ["token", "VARCHAR(120)", "UNIQUE, NOT NULL", "Session token (sent ผ่าน httpOnly cookie)"],
    ["expires_at", "DATETIME", "NOT NULL", "หมดอายุเมื่อใด (default 30 วัน)"],
    ["ip_address", "VARCHAR(45)", "NULL", "IPv4/IPv6 ของอุปกรณ์"],
    ["user_agent", "VARCHAR(255)", "NULL", "Browser / OS string เพื่อแสดงในหน้า /profile/sessions"],
    ["last_totp_at", "DATETIME", "NULL", "เวลาล่าสุดที่ผ่าน TOTP step-up (Phase 23.3)"],
  ]),
  entityTable("PasswordResetToken (one-time link to set new password)", [
    ["token_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", "เจ้าของ token"],
    ["token_hash", "VARCHAR(64)", "UNIQUE, NOT NULL", "SHA-256 ของ token จริง (เก็บแค่ hash ใน DB)"],
    ["expires_at", "DATETIME", "NOT NULL", "TTL 30 นาที"],
    ["consumed_at", "DATETIME", "NULL", "เวลา reset สำเร็จ ; null = ยังใช้ได้"],
  ]),

  subheading("5. Communication & Engagement"),
  para([["ครอบคลุม messaging แบบ 1-1 ระหว่าง user, Q&A ใต้สินค้า, wishlist และ stock alerts โดยทุก feature ผ่าน feature-flag ของ admin (chat_enabled / favorites_enabled) เพื่อให้ admin ปิดทันทีเมื่อพบปัญหาได้", false]]),
  entityTable("Message (buyer ↔ seller threading)", [
    ["message_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["sender_id", "INT", "FK → users", "ผู้ส่ง"],
    ["recipient_id", "INT", "FK → users", "ผู้รับ"],
    ["body", "VARCHAR(1000)", "NOT NULL", "ข้อความ ; ผ่าน profanity filter ก่อน insert"],
    ["order_id", "INT", "FK → orders, NULL", "context เพิ่มเติม"],
    ["product_id", "INT", "FK → product, NULL", "context เพิ่มเติม"],
    ["read_at", "DATETIME", "NULL", "เวลาผู้รับเปิดอ่าน ; null = unread"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("ProductFavorite (wishlist; product_id + user_id unique)", [
    ["favorite_id", "INT", "PK, AUTO_INCREMENT", ""],
    ["user_id", "INT", "FK, NOT NULL", "ผู้กดถูกใจ"],
    ["product_id", "INT", "FK, NOT NULL", "สินค้าที่บันทึก"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("ProductQuestion (public Q&A under each product)", [
    ["question_id", "INT", "PK", ""],
    ["product_id", "INT", "FK", ""],
    ["asker_id", "INT", "FK → users", "ผู้ตั้งคำถาม"],
    ["body", "VARCHAR(500)", "NOT NULL", "เนื้อหาคำถาม"],
    ["answer", "VARCHAR(500)", "NULL", "คำตอบจาก seller / admin"],
    ["answered_at", "DATETIME", "NULL", ""],
    ["answerer_id", "INT", "FK → users, NULL", "ผู้ตอบ"],
  ]),
  entityTable("StockAlert (subscribe restock notification)", [
    ["alert_id", "INT", "PK", ""],
    ["user_id", "INT", "FK", ""],
    ["product_item_id", "INT", "FK", ""],
    ["notified_at", "DATETIME", "NULL", "ส่ง notification เมื่อใด ; null = ยังไม่แจ้ง"],
  ]),

  subheading("6. Wallet & Payment Ledger"),
  para([["รองรับการเก็บเหรียญใน wallet ของแต่ละ user และระบบ top-up ด้วย PromptPay พร้อมการ verify slip อัตโนมัติ ; การจ่ายเงินใน checkout จะหัก wallet และเครดิต store ใน atomic transaction เดียวกันเพื่อกัน inconsistency", false]]),
  entityTable("Wallet (1:1 user; current coin balance)", [
    ["wallet_id", "INT", "PK", ""],
    ["user_id", "INT", "FK, UNIQUE", "1 user มีได้เพียง 1 wallet"],
    ["balance", "INT", "≥ 0, DEFAULT 0", "ยอดเหรียญปัจจุบัน (CHECK constraint)"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("WalletTransaction (per-user ledger)", [
    ["wallet_tx_id", "INT", "PK", ""],
    ["user_id", "INT", "FK", ""],
    ["type", "WALLETTXTYPE", "ENUM", "topup / spend / refund / grant"],
    ["amount", "INT", "NOT NULL", "จำนวนเหรียญ (signed: + เพิ่ม, − หัก)"],
    ["balance_after", "INT", "NOT NULL", "ยอดหลังบันทึก row นี้ (ledger style)"],
    ["reference", "VARCHAR(80)", "NULL", "อ้างถึง topup/order/withdrawal id"],
    ["meta", "JSONB", "NULL", "ข้อมูลเพิ่มเติม"],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("Topup (PromptPay slip review queue)", [
    ["topup_id", "INT", "PK", ""],
    ["user_id", "INT", "FK", ""],
    ["amount_baht", "INT", "NOT NULL", "ยอดที่ต้องโอน (บาท)"],
    ["coins_expected", "INT", "NOT NULL", "เหรียญที่จะได้ (= amount × 10)"],
    ["status", "TOPUPSTATUS", "ENUM", "pending / paid / rejected / expired"],
    ["promptpay_payload", "TEXT", "NOT NULL", "EMVCo payload ตอน generate QR"],
    ["slip_image", "TEXT", "NULL", "base64 รูปสลิป (≈ 50KB ต่อ row)"],
    ["slip_reference", "VARCHAR(80)", "UNIQUE, NULL", "เลขรายการสลิป (ป้องกัน slip ซ้ำ)"],
    ["slip_qr_payload", "TEXT", "NULL", "QR payload ที่ decode ได้จากสลิป (auto-verify)"],
    ["reviewed_by", "INT", "FK → users, NULL", "admin ที่ review"],
    ["reviewed_at", "DATETIME", "NULL", ""],
    ["rejection_reason", "VARCHAR(200)", "NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("7. Seller Withdrawal"),
  para([["รองรับการขอถอนเงินของแต่ละร้าน โดย admin โอนผ่านระบบธนาคารจริงและ mark paid ในระบบทีหลัง ; coins ถูก escrow ตั้งแต่ submit เพื่อกันการ overspend", false]]),
  entityTable("Withdrawal (per-store payout request)", [
    ["withdrawal_id", "INT", "PK", ""],
    ["store_id", "INT", "FK", ""],
    ["amount_coins", "INT", "> 0", "เหรียญที่ขอถอน"],
    ["fee_percent_bp", "INT", "≥ 0", "snapshot อัตราค่าธรรมเนียม (basis points)"],
    ["fee_coins", "INT", "≥ 0", "ค่าธรรมเนียม (เหรียญ)"],
    ["net_coins", "INT", "≥ 0", "เหรียญสุทธิ (= amount − fee)"],
    ["net_baht", "DECIMAL(10,2)", "≥ 0", "ยอดสุทธิเป็นบาท"],
    ["bank_name", "VARCHAR(60)", "NOT NULL", "ชื่อธนาคาร"],
    ["bank_account_no", "VARCHAR(20)", "NOT NULL", "เลขบัญชี (10-12 หลัก)"],
    ["bank_account_name", "VARCHAR(80)", "NOT NULL", "ชื่อบัญชี"],
    ["status", "WITHDRAWALSTATUS", "ENUM", "pending / paid / rejected"],
    ["requested_at", "DATETIME", "DEFAULT now()", ""],
    ["reviewed_by", "INT", "FK → users, NULL", ""],
    ["reviewed_at", "DATETIME", "NULL", ""],
    ["paid_proof_image", "TEXT", "NULL", "base64 ของสลิปฝั่ง admin"],
    ["rejection_reason", "VARCHAR(200)", "NULL", ""],
  ]),
  entityTable("StoreTransaction (per-store ledger)", [
    ["store_tx_id", "INT", "PK", ""],
    ["store_id", "INT", "FK", ""],
    ["type", "STORETXTYPE", "ENUM", "earn / withdraw / withdraw_reverse / refund_clawback / adjustment"],
    ["amount", "INT", "NOT NULL", "± เหรียญ (signed)"],
    ["balance_after", "INT", "NOT NULL", "ยอดหลัง row"],
    ["reference", "VARCHAR(80)", "NULL", "เช่น withdrawal_id, order_id"],
    ["meta", "JSONB", "NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("8. System Configuration & Audit"),
  para([["ตาราง singleton สำหรับเก็บ feature flag กลาง และ AuditLog สำหรับการตรวจสอบ destructive actions ของ admin", false]]),
  entityTable("SystemSetting (singleton, id = 1, pinned by SQL CHECK)", [
    ["id", "INT", "PK, CHECK = 1", "บังคับให้มีได้ 1 row เท่านั้น"],
    ["wallet_enabled", "BOOLEAN", "DEFAULT true", "เปิด-ปิดระบบเหรียญทั้งระบบ"],
    ["chat_enabled", "BOOLEAN", "DEFAULT true", "เปิด-ปิดระบบแชทระหว่างผู้ใช้"],
    ["favorites_enabled", "BOOLEAN", "DEFAULT true", "เปิด-ปิด wishlist"],
    ["promptpay_id", "VARCHAR(20)", "", "เบอร์โทร / เลข ID พร้อมเพย์ของแพลตฟอร์ม"],
    ["platform_fee_percent", "DECIMAL(5,2)", "0-100", "% ที่หักจากแต่ละ order"],
    ["withdrawal_fee_percent", "DECIMAL(5,2)", "0-100", "% ที่หักจากการถอน"],
    ["updated_at", "DATETIME", "DEFAULT now()", ""],
  ]),
  entityTable("AuditLog (destructive admin action trail)", [
    ["log_id", "INT", "PK", ""],
    ["actor_id", "INT", "FK → users, NULL", "null = system action"],
    ["action", "VARCHAR(60)", "NOT NULL", "dot-notation เช่น user.ban, withdrawal.approve"],
    ["target_type", "VARCHAR(40)", "NULL", "ประเภท entity เป้าหมาย"],
    ["target_id", "INT", "NULL", "id ของ entity เป้าหมาย"],
    ["meta", "JSONB", "NULL", "diff ก่อน-หลัง"],
    ["ip_address", "VARCHAR(45)", "NULL", "IP ของ actor"],
    ["user_agent", "VARCHAR(255)", "NULL", ""],
    ["created_at", "DATETIME", "DEFAULT now()", ""],
  ]),

  subheading("Normalization — เพิ่มเติม Phase 13.6.5 retrofit"),
  para([["เพื่อให้ตอบ rubric ของ CPE241 ครบทุกหัวข้อ Phase 13.6.5 ได้เพิ่มของต่อไปนี้ลง schema (มีอยู่ใน DB จริง):", false]]),
  bullet("Triggers (2 ตัว): auto-update StoreStats.rating หลังเพิ่ม/ลบ ProductReview ; cascade soft-delete Store → Product → ProductItem"),
  bullet("Views: live_stores_view (กรอง deleted_at + suspended_at) , product_with_avg_rating_view"),
  bullet("Roles + GRANT/REVOKE: metu_app (runtime — RW), metu_analytics (read-only, denied audit_log)"),
  bullet("CHECK constraints (8 ข้อ): product_review.rating BETWEEN 1 AND 5 ; product_item.price ≥ 0 ; ProductItem.coin_price = price × 10 (Phase 17.2) ; Store.coin_balance ≥ 0 (Phase 20.1) ; Withdrawal.amount_coins > 0 / fee_coins ≥ 0 / net_coins = amount_coins - fee_coins ; SystemSetting.id = 1"),
].join("");

const NEW_BLOCK = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${FR_BLOCK}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${BR_BLOCK}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${PJ_BLOCK}`;

// ─────────────────────────────────────────────────────────────────
// Patch document.xml.
// ─────────────────────────────────────────────────────────────────
const xml = await fs.readFile(DOC_PATH, "utf8");
const sectPrAnchor = '<w:sectPr w:rsidR="00411BF1" w:rsidRPr="00DA4609">';
const idx = xml.indexOf(sectPrAnchor);
if (idx === -1) {
  console.error("Could not find <w:sectPr> anchor — aborting.");
  process.exit(1);
}
// Insert NEW_BLOCK as a paragraph just before sectPr.
const before = xml.slice(0, idx);
const after = xml.slice(idx);
const out = before + NEW_BLOCK + after;
await fs.writeFile(DOC_PATH, out, "utf8");
console.log(`Inserted ${NEW_BLOCK.length} chars before <w:sectPr>. Total now ${out.length} chars.`);
