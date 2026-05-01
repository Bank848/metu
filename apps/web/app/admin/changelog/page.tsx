import { Sparkles, Zap, Store, ShoppingBag, Shield, Wrench, GitCommit, ExternalLink, Palette, Activity, FlaskConical, MessageSquare, Database, Bug, Filter, Wallet, ShieldAlert, AlertTriangle, Layers, KeyRound, ShoppingCart, Mail, Receipt, Star, HelpCircle, Monitor } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";

// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request. If we let this prerender at build time the layout
// sees no cookie, redirects to /login, and bakes that redirect into a
// static page that everyone hits.
export const dynamic = "force-dynamic";

/**
 * Admin-only changelog. Server component, no JS shipped.
 * Behind the admin layout's role gate.
 */

type Item = { title: string; detail?: string; commit?: string };

type Batch = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tone: "yellow" | "purple" | "info" | "success" | "warning" | "danger";
  shippedAt: string; // local time, free-form
  commitSha: string;
  items: Item[];
};

const BATCHES: Batch[] = [
  {
    id: "phase-16-3",
    title: "Phase 16.3 · Mode A swap — better-auth owns every cookie",
    subtitle: "ลบ JWT cookie ทิ้ง, ใช้ better-auth session_token อย่างเดียว. Sessions UI เห็นทุก login แล้ว",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "81824cf",
    items: [
      { title: "migration backfill account table จาก legacy users.password เพื่อให้ better-auth signInEmail หา row เจอ" },
      { title: "lib/auth.ts ชี้ password verify/hash ไป bcryptjs (default scrypt จะ reject hash เก่า)" },
      { title: "syncCredentialAccount helper, wire เข้า register/changePassword/setPassword/resetPassword + email change ด้วย" },
      { title: "setPassword + resetPassword เคลียร์ requirePasswordReset ตอน success (เคยลืม)" },
      { title: "controller login/register/logout: service.login เช็ค bcrypt+TOTP ก่อน, แล้ว delegate session ให้ auth.api.signInEmail" },
      { title: "middleware: requireAuth/softAuth อ่าน better-auth session อย่างเดียว, ลบ JWT helpers ทิ้ง ~120 LOC" },
      { title: "tests/_authMock.ts shared helper: cookieFor/signedInAs/signedOut mock better-auth API" },
      { title: "auth.test.ts update assertion จาก metu_auth → better-auth.session_token + prisma.account upsert mock" },
      { title: "better-auth.test.ts ใช้ real auth instance (เทสจุดประสงค์ของไฟล์นี้คือเช็ค catch-all จริง)" },
      { title: "rebuild /login + LoginForm: mint accent + 2-step state machine + autofocus TOTP + back button" },
      { title: "/profile/edit ไม่ต้องแก้ - getMe ผ่าน /auth/me ยัง work ใน Mode A" },
      { title: "post-deploy ปรากฏว่า prod login error 'Credential account not found'. fix 3 ตัว: User.updatedAt + map createdDate, Prisma proxy mirror userId↔id ทั้ง result และ where clause" },
    ],
  },
  {
    id: "phase-16-2",
    title: "Phase 16.2 · TOTP 2FA — authenticator-app two-factor sign-in",
    subtitle: "ใส่ 2FA แบบ TOTP, ใช้ได้ทั้ง password user และ Google user. login จะถาม 6-digit หลัง password ผ่าน",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "e595e17",
    items: [
      { title: "migration เพิ่ม totp_secret + totp_enabled, secret อยู่ NULL จนกว่า verify ครั้งแรกผ่าน" },
      { title: "schema.prisma: User.totpSecret + totpEnabled" },
      { title: "utils/totp.ts wrap otplib v13 (verify เป็น async แล้ว). hide config ทั้งหมดในไฟล์เดียว" },
      { title: "auth.service.login: throw NeedsTotp ถ้าเปิด 2FA แต่ไม่ส่งโค้ด, InvalidTotp ถ้าโค้ดผิด - ก่อน issue cookie" },
      { title: "totpEnrollStart: gen secret, ปฏิเสธถ้า enrolled แล้ว, return otpauthUri สำหรับ QR" },
      { title: "totpEnrollVerify: เช็คโค้ด 6 หลัก, success ก็ flip totpEnabled=true" },
      { title: "totpDisable: ต้องใส่ password ปัจจุบัน (defence in depth - มือถืออย่างเดียวไม่พอ)" },
      { title: "3 routes: enroll-start / enroll-verify / disable. loginSchema เพิ่ม optional totpCode regex 6 digits" },
      { title: "GET /auth/me แถม totpEnabled boolean" },
      { title: "BFF 3 forwarder routes" },
      { title: "/profile/edit: card 2FA 3 state - not enrolled / mid-enrol (QR + secret + copy) / enabled (disable form)" },
      { title: "LoginForm: เจอ NeedsTotp 401 ก็ swap เป็น 2-step UI, lock email/password, โชว์ 6-digit input one-time-code" },
    ],
  },
  {
    id: "phase-16-1",
    title: "Phase 16.1 · Suspended stores — reversible 'freeze' alternative to delete",
    subtitle: "ระงับร้านชั่วคราวแทนการลบถาวร. หน้าสาธารณะมองไม่เห็น แต่ seller dashboard ยังเข้าได้",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "218f0fc",
    items: [
      { title: "migration เพิ่ม suspended_at + partial index store_live_v2_idx" },
      { title: "schema.prisma: Store.suspendedAt (แยกจาก deletedAt - อันนี้ reversible)" },
      { title: "service.setStoreSuspended toggle suspendedAt + audit row store.suspend / store.unsuspend" },
      { title: "POST /admin/stores/:id/suspend body { value: boolean }" },
      { title: "กรอง suspendedAt:null ทุก public query: stores list, products browse + featured + detail, favorites, qna, reviews, stock-alerts" },
      { title: "products.service.findProductById เช็ค post-fetch (Prisma findUnique ไม่รับ relation filter)" },
      { title: "BFF forwarder /api/admin/stores/[id]/suspend" },
      { title: "StoreActions: เพิ่ม menu Suspend/Resume เหนือ Delete, label flip ตาม state" },
      { title: "SellerLayout: amber banner ตอนร้านโดน suspend อธิบายว่า buyer มองไม่เห็น แต่ยัง edit ได้" },
    ],
  },
  {
    id: "phase-15-5",
    title: "Phase 15.5 · Admin force-password-reset (Phase 15 complete)",
    subtitle: "Admin บังคับให้ user reset password ได้, user จะถูก redirect ไป /profile/edit จนกว่าจะเปลี่ยน. แถมแก้ Google button หาย",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "7bc2daf",
    items: [
      { title: "migration เพิ่ม require_password_reset boolean default false" },
      { title: "schema.prisma: User.requirePasswordReset" },
      { title: "service.setRequirePasswordReset + audit, 400 SelfToggleForbidden ถ้า admin flag ตัวเอง" },
      { title: "POST /admin/users/:id/require-password-reset body { value: boolean }" },
      { title: "changePassword + setPassword เคลียร์ flag ตอน success อัตโนมัติ" },
      { title: "GET /auth/me แถม requirePasswordReset boolean" },
      { title: "lib/session requireResetGuard helper, redirect ไป /profile/edit?must-reset=1, allow /profile/edit + /login + /logout" },
      { title: "/profile/edit: amber banner ตอน flag set อธิบายว่าเปลี่ยน password จะ clear flag" },
      { title: "UserRowActions: menu item Force/Clear forced reset, tone flip ตาม state" },
      { title: "BFF forwarder /api/admin/users/[id]/require-password-reset" },
      { title: "BONUS: ลบ NEXT_PUBLIC_GOOGLE_ENABLED gate ออก. env กว่าจะ flip ต้อง rebuild ทำให้ Google button หายบน live demo. แสดงตลอดดีกว่า ถ้าไม่ config server-side better-auth แสดง error เอง" },
    ],
  },
  {
    id: "phase-15-3",
    title: "Phase 15.3 · Sensitive ops require fresh OTP when phone is verified",
    subtitle: "ถ้า user verify phone แล้ว, change/set password ต้องใส่ OTP สดจาก SMS. consume row ทันทีเพื่อกัน replay",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "36f9de3",
    items: [
      { title: "@metu/shared: changePasswordSchema + setPasswordSchema เพิ่ม optional otpCode (6 digit)" },
      { title: "ensureSensitiveOtpIfVerified helper: no-op ถ้า phone ไม่ verify, ไม่งั้น require + verify + consume row" },
      { title: "changePassword + setPassword เรียก helper หลัง check อื่นเสร็จ user จะได้ error ตามลำดับที่ถูก" },
      { title: "EditProfileForm: ถ้า phoneVerified=true จะมี SMS code panel โผล่ใน password section, ใช้ /request-otp เดิม" },
      { title: "error mapping: OtpRequired/InvalidOtp/OtpExpired/NoPendingOtp ฉบับภาษามนุษย์" },
    ],
  },
  {
    id: "phase-15-4",
    title: "Phase 15.4 · Audit log captures IP + User-Agent",
    subtitle: "audit_log เพิ่ม ip_address + user_agent. helper รับ req optional, plumb เข้า 5 admin destructive flows",
    icon: Shield,
    tone: "info",
    shippedAt: "today",
    commitSha: "0440c83",
    items: [
      { title: "migration เพิ่ม ip_address VARCHAR(45) + user_agent VARCHAR(255), nullable ทั้งคู่" },
      { title: "schema.prisma: AuditLog.ipAddress + userAgent" },
      { title: "audit() รับ req optional, extract req.ip + headers['user-agent']. backwards compat ทุก callsite เก่ายัง work" },
      { title: "plumb req เข้า 5 admin actions: updateUserRole, deleteUser, deleteStore, deleteTransaction, refundTransaction" },
      { title: "callsite อื่น (seller, reviews/qna mod) ไม่ touch รอบนี้, migrate เรื่อยๆ ตอนแก้ของอื่น" },
      { title: "/admin/audit: column Origin ใหม่ระหว่าง Target กับ When, em-dash placeholder ตอน NULL" },
    ],
  },
  {
    id: "phase-15-2",
    title: "Phase 15.2 · Active sessions UI (list + revoke + sign-out-everywhere)",
    subtitle: "user เห็นทุก device ที่ login ใน /profile/edit, revoke ได้ทีละอันหรือ sign out ทุกที่ที่เหลือก็ได้",
    icon: Monitor,
    tone: "info",
    shippedAt: "today",
    commitSha: "2247f9a",
    items: [
      { title: "service: listSessions, revokeSession (ownership check กัน id enumeration), revokeAllOtherSessions" },
      { title: "controller: 3 handlers + readBetterAuthSessionId helper. JWT-cookie path = currentSessionId null" },
      { title: "routes: GET /auth/sessions, DELETE all-others (mount ก่อน :id), DELETE :id" },
      { title: "BFF: 3 forwarder routes" },
      { title: "EditProfileForm: section Active sessions, lazy load, current device badge 'THIS DEVICE' + disable revoke ตัวเอง" },
    ],
  },
  {
    id: "phase-15-1",
    title: "Phase 15.1 · Rate limit middleware (sliding window, in-memory)",
    subtitle: "in-memory limiter ใส่บน /login (5/min), /register (3/min), /request-otp (3/min), /forgot-password (3/5min)",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "68980ea",
    items: [
      { title: "middleware/rate-limit.ts sliding window per-IP, prune-on-check + 1% sweep keep map bounded" },
      { title: "limiter เป็น singleton ต่อ route. ถ้าสร้างใหม่ทุกครั้งเคาน์เตอร์จะไม่สะสม" },
      { title: "429 RateLimited + Retry-After ปัดขึ้นวินาที + X-RateLimit headers" },
      { title: "app.set('trust proxy', true) ให้ Fly's X-Forwarded-For = req.ip จริง ไม่งั้นทุก request ใช้ bucket เดียวกัน" },
      { title: "mount loginLimiter/registerLimiter/forgotPasswordLimiter, /request-otp อยู่หลัง requireAuth" },
    ],
  },
  {
    id: "phase-14-4",
    title: "Phase 14.4 · Phone + OTP scaffold (Phase 14 complete)",
    subtitle: "user ใส่ phone, request 6-digit OTP, verify ได้. transport pluggable - console dev / Twilio prod / disable ได้",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "44ab6d0",
    items: [
      { title: "@metu/shared: updatePhoneSchema (loose, server normalise), requestOtpSchema, verifyOtpSchema" },
      { title: "utils/otp.ts: generateCode crypto.randomInt no-bias, hashCode SHA256(uid:phone:code) กัน replay ข้าม user" },
      { title: "service.updatePhone: strip non-digit, clear phoneVerifiedAt, ไม่ trigger OTP เอง" },
      { title: "service.requestOtp: NoPhoneOnFile ถ้าไม่มี, wipe pending แล้วใส่ใหม่, dispatch transport" },
      { title: "service.verifyOtp: distinguish NoPendingOtp / OtpExpired / InvalidOtp, $transaction set verifiedAt + delete row" },
      { title: "routes: PATCH /auth/phone, POST /auth/request-otp, POST /auth/verify-otp" },
      { title: "BFF 3 forwarder routes" },
      { title: "EditProfileForm: section Phone 3-step UI, verified state เป็น green pill" },
    ],
  },
  {
    id: "phase-14-3-5",
    title: "Phase 14.3.5 · Linking fork — Google email collision rejected with hint",
    subtitle: "Google login ที่ email ชนกับ local account จะถูก reject + redirect /login?error=email-exists พร้อม banner",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "c54fa62",
    items: [
      { title: "lib/auth.ts databaseHooks.user.create.before เช็ค email collision throw APIError CONFLICT" },
      { title: "hook เดียวกันใส่ NOT NULL fields: firstName/lastName split จาก Google name, unique username" },
      { title: "deriveUsername: local-part + strip + slice 14 + 4-digit nonce ถ้าชน" },
      { title: "splitName: 'Jane Doe' → first/last. คนชื่อเดียว ('Madonna') → '—' placeholder ให้ผ่าน NOT NULL" },
      { title: "LoginForm: errorMessage helper อ่าน ?error=email-exists แล้วโชว์ amber banner" },
      { title: "Google button set errorCallbackURL=/login?error=email-exists คู่กับ callbackURL" },
      { title: "soft-deleted account ตั้งใจไม่ trigger collision (deletedAt:null guard)" },
    ],
  },
  {
    id: "phase-14-3",
    title: "Phase 14.3 · Set-password flow for Google-only users",
    subtitle: "Google user ตั้ง password ครั้งแรกได้จาก /profile/edit. UI flip ระหว่าง set vs change ตาม hasPassword",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "af72290",
    items: [
      { title: "@metu/shared: setPasswordSchema (newPassword + confirmPassword, ไม่มี currentPassword)" },
      { title: "auth.service.setPassword: 400 PasswordAlreadySet ถ้ามี password อยู่แล้ว, hash + audit user.set_password" },
      { title: "POST /auth/set-password requireAuth, ไม่ออก cookie ใหม่ (มาแบบ Google authed อยู่แล้ว)" },
      { title: "GET /auth/me แถม hasPassword boolean" },
      { title: "lib/session getMe return { user, role, hasPassword }, default true ป้องกัน stale deploy" },
      { title: "EditProfileForm: hasPassword prop fork UI, hit /set-password vs /change-password, router.refresh หลัง success" },
      { title: "BFF forwarder /api/auth/set-password" },
    ],
  },
  {
    id: "phase-14-2",
    title: "Phase 14.2 · Google sign-in + dual-stack auth middleware",
    subtitle: "Continue with Google work แล้ว. middleware dual-stack: ลอง JWT cookie ก่อน fall back better-auth session ทุก test เก่ายังเขียว",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "02b6035",
    items: [
      { title: "middleware/auth.ts: requireAuth + softAuth ลอง JWT ก่อน fall back readBetterAuthUserId, synth req.auth shape เดิม" },
      { title: "role check: jwtPayload.role ถ้า JWT path, ไม่งั้น UserStats.role จาก DB" },
      { title: "lib/auth.ts: basePath /auth/better → /api/auth/better. browser คุยกับ BFF host เดียว BFF proxy ต่อ" },
      { title: "app.ts catch-all ย้าย mount path, ยังก่อน express.json()" },
      { title: "BFF catch-all /api/auth/better/[...all]/route.ts forward ทุก method" },
      { title: "lib/server/proxy.ts: redirect:'manual' + Location passthrough ให้ OAuth 302 รอด BFF hop" },
      { title: "/login + /register: Google button gate NEXT_PUBLIC_GOOGLE_ENABLED, plain anchor ไม่ใช่ fetch (cookie ต้องไป OAuth callback)" },
    ],
  },
  {
    id: "phase-14-1",
    title: "Phase 14.1 · better-auth plumbing (schema + catch-all)",
    subtitle: "ตั้ง schema + instance better-auth Mode A. ยังไม่มี UI ใช้, แค่ปูทาง Phase 14.2 ต่อ",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "a49c2ec",
    items: [
      { title: "npm install better-auth ที่ apps/server" },
      { title: "migration: ALTER users password DROP NOT NULL + email_verified + phone + phone_verified_at, สร้าง 3 tables account/session/verification SERIAL Int FK" },
      { title: "schema.prisma: User.password เป็น String?, model Account/Session/Verification + @map" },
      { title: "lib/auth.ts: betterAuth instance + prismaAdapter + generateId=false (Postgres serial), Google provider gate ตาม env" },
      { title: "app.ts mount app.all('/auth/better/*', toNodeHandler(auth)) ก่อน express.json() (ไม่งั้น handler hang)" },
      { title: "auth.service: nullable-password guard ทั้ง bcrypt.compare callsite, login → InvalidCredentials, changePassword → NoPasswordSet" },
    ],
  },
  {
    id: "phase-13-11",
    title: "Phase 13.11 · Backend separation cleanup — last legacy routers gone",
    subtitle: "ลบ flat router 4 ตัว 1190 LOC, แทนด้วย reference module layered. SSR direct-Prisma reads ตั้งใจเก็บไว้",
    icon: Layers,
    tone: "success",
    shippedAt: "today",
    commitSha: "4954044",
    items: [
      { title: "layered reference module: business-types + countries (driving become-seller + register dropdown)" },
      { title: "ลบ catalog.ts (33), seller.ts (370), admin.ts (250), stats.ts (20)" },
      { title: "tsconfig exclusions ออก, tsc compile ทั้ง src tree clean" },
      { title: "BFF: 8 routes แปลงเป็น forwardToApi - business-types, countries, categories, tags, products (browse + by id), stores (list + by id)" },
      { title: "ตั้งใจเก็บไว้: lib/server/queries.ts + ~17 SSR component อ่าน Prisma ตรง. BFF mix ได้: SSR direct + HTTP สำหรับ mutation. migrate มาเป็น apiFetch จะเพิ่ม HTTP roundtrip ทุก render เปล่าๆ" },
      { title: "ตั้งใจ defer: by-ids, featured, stats, profile/export, health รอ Express endpoint ใหม่" },
    ],
  },
  {
    id: "phase-13-10",
    title: "Phase 13.10 · Admin module migrated to Express",
    subtitle: "9 admin endpoints ย้ายขึ้น layered Express. role gate ที่ router level ครั้งเดียว",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "400e95e",
    items: [
      { title: "layered admin resource ครบ stack + zod schema ทุก input" },
      { title: "GET /admin/users: zod-coerce page, password STRIP ออกทุก row (admin UI ไม่ต้องใช้, log-leak risk)" },
      { title: "PATCH /admin/users/:id role change: capture previous role ใน audit meta. SelfDemoteForbidden ป้องกัน admin lock ตัวเอง" },
      { title: "DELETE /admin/users/:id: empty body = soft-delete, { reason } = ban ทั้ง deletedAt + bannedAt + bannedReason" },
      { title: "GET /admin/stores: filter deletedAt:null ทั้ง row level + nested _count (Phase 11 invariant)" },
      { title: "DELETE /admin/stores/:id soft-delete + audit" },
      { title: "GET /admin/stats: KPI composite Promise.all, daily SQL ใช้ generate_series ให้วันว่างยังโผล่" },
      { title: "DELETE /admin/transactions/:id: snapshot ก่อนลบ, money record ไม่มี deletedAt" },
      { title: "POST /admin/transactions/:id/refund: $transaction updateMany order + create refund tx, NotPurchase ถ้า target ผิด type" },
      { title: "GET /admin/reports/:name: 5 raw SQL queries return { sql, rows } ให้หน้า demo viva โชว์ได้ว่ารัน SQL อะไร" },
      { title: "BFF: 8 routes → forwardToApi. รวมกับ 13.9 + 13.8 + 13.7 ทั้ง /api/admin/** ไม่ touch Prisma แล้ว" },
    ],
  },
  {
    id: "phase-13-9-2",
    title: "Phase 13.9.2 · Seller dashboard writes migrated",
    subtitle: "10 write endpoints (become-seller, store PATCH, product CRUD, duplicate, coupon, order status, refund) ขึ้น Express",
    icon: Store,
    tone: "info",
    shippedAt: "today",
    commitSha: "73a33ca",
    items: [
      { title: "POST /seller/become-seller: $transaction create store + promote buyer→seller (admin คงเดิม), 409 StoreExists. mount ก่อน requireStore" },
      { title: "PATCH /seller/store: partial update, undefined = no-op, body {} return noop:true ไม่ touch DB" },
      { title: "POST /seller/products: create พร้อม variants + images + tags, ใช้ productInputSchema เดิม" },
      { title: "PATCH /seller/products/:id: 2 paths - fast path { isActive } single update, full edit เป็น $transaction. ห้ามลบ variant เก่า (OrderItem + CartItem FK ค้าง)" },
      { title: "DELETE /seller/products/:id soft-delete + audit product.delete พร้อม name snapshot" },
      { title: "POST /seller/products/:id/duplicate: clone variants + images + tags, ข้าม reviews + sales. เริ่มเป็น paused" },
      { title: "PATCH /seller/product-items/:id: nudge price/discount/qty, 404/403 แยกกัน" },
      { title: "GET + POST /seller/coupons: list + create, GET ตกหล่นจาก 13.9.1 พลอยมาด้วย" },
      { title: "PATCH /seller/orders/:id fulfilled/cancelled: 403 ถ้าไม่มี line จากร้านนี้, 409 AlreadyRefunded / InvalidTransition + audit" },
      { title: "POST /seller/orders/:id/refund: $transaction update order + create refund tx + audit. ปฏิเสธ pending/cancelled/already-refunded" },
      { title: "BFF 9 routes → forwardToApi. รวมกับ 13.9.1 ทั้ง /api/seller/** proxy หมด" },
    ],
  },
  {
    id: "phase-13-9-1",
    title: "Phase 13.9.1 · Seller dashboard reads migrated",
    subtitle: "6 read endpoints ขึ้น Express. เพิ่ม requireStore middleware piggyback บน requireAuth. write side รอ 13.9.2",
    icon: Store,
    tone: "info",
    shippedAt: "today",
    commitSha: "0fc388f",
    items: [
      { title: "middleware/seller.ts requireStore: 403 NoStore ถ้ายังไม่ onboard. mount router level ครั้งเดียว" },
      { title: "layered seller resource. service รับ storeId ตรงๆ ไม่รับ req (pure + unit test ง่าย)" },
      { title: "GET /seller/store: store + businessType + stats" },
      { title: "GET /seller/products: deletedAt:null อย่างเดียว (admin audit ดูของลบได้)" },
      { title: "GET /seller/products/:id: 404 vs 403 แยก (stale link vs cross-store)" },
      { title: "GET /seller/stats: KPI + product count + reviews + 30 day orders + top 5 products. 3 raw queries serial (Neon free tier burst friendly)" },
      { title: "GET /seller/orders?status=: nested item filter scope ไม่งั้น multi-store order leak product คู่แข่ง" },
      { title: "GET /seller/orders/export: CSV. proxy.ts forward Content-Disposition + cache-control" },
      { title: "BFF 6 read routes → forwardToApi. write side ยัง local รอ 13.9.2" },
    ],
  },
  {
    id: "phase-13-8",
    title: "Phase 13.8 · Messages migrated to Express",
    subtitle: "buyer↔seller chat ขึ้น Express. 3 endpoints: inbox (?with=N fork thread), send, unread count. ยัง Postgres-only",
    icon: MessageSquare,
    tone: "info",
    shippedAt: "today",
    commitSha: "0cbfa72",
    items: [
      { title: "layered messages resource" },
      { title: "GET /messages fork: ?with=partner = thread + mark partner messages as read, ไม่มี = inbox group last message per partner" },
      { title: "inbox grouping: pull 200 latest, group ใน JS. demo dataset พอ, prod-grade ใช้ window function" },
      { title: "POST /messages: ใช้ sendMessageSchema เดิม, SelfSend reject ที่ controller ก่อนเข้า service" },
      { title: "GET /messages/unread: COUNT เดียว, mount ก่อน wildcard ให้ literal path ชนะ" },
      { title: "BFF: forward ?with=N ผ่าน req.nextUrl.search ให้ thread route ถูก" },
      { title: "service เล็ก side-effect-free ยกเว้น mark-read. Lecture 11 polyglot pilot สลับเป็น MongoDB sidecar ก็แค่เปลี่ยน service ไฟล์เดียว" },
    ],
  },
  {
    id: "phase-13-7",
    title: "Phase 13.7 · Favorites + Stock alerts migrated",
    subtitle: "2 thin join-table resources ขึ้น Express. idempotent ผ่าน @@unique. recently-viewed ยังอยู่ client-side",
    icon: Star,
    tone: "info",
    shippedAt: "today",
    commitSha: "bc5709c",
    items: [
      { title: "layered favorites resource" },
      { title: "GET /favorites return { productIds[] } ให้ client pre-fill heart icon ไม่ต้อง hydrate full product" },
      { title: "POST /favorites/:productId idempotent upsert, 404 ถ้า product soft-deleted/orphan" },
      { title: "DELETE /favorites/:productId silent no-op via deleteMany" },
      { title: "layered stock-alerts resource shape เดียวกัน. POST clear notifiedAt → null ให้ re-arm ได้หลังแจ้งครั้งแรก" },
    ],
  },
  {
    id: "phase-13-6-5",
    title: "Phase 13.6.5 · CPE241 rubric retrofit (Lecture 10)",
    subtitle: "อุด 4 หัวข้อ Lecture 10 (Triggers, Views, Permissions, Check Constraints) ที่ codebase ไม่มีคลุมเลย. additive migration, ไม่กระทบ test",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "1bdc9bf",
    items: [
      { title: "Trigger touch_updated_at: BEFORE UPDATE บน product, maintain product.updated_at column ที่ DB level (no Prisma @updatedAt)" },
      { title: "Trigger review_delete_audit: AFTER DELETE บน product_review, safety net write 'review.delete.trigger' ถ้ามีคน DELETE ผ่าน SQL ตรงๆ" },
      { title: "View live_stores_view: reify deleted_at IS NULL ให้ analytics consumer ไม่ต้องจำ" },
      { title: "View product_with_avg_rating_view: denormalised JOIN+AGG ให้ WHERE avg_rating > 4 เป็น clause เดียว แก้ Phase 11 minRating bug ที่ DB layer" },
      { title: "Permissions 3 role: metu (admin migration), metu_app (runtime CRUD), metu_analytics (read-only + DENY audit_log). ทั้ง 2 role ใหม่ NOLOGIN, runbook ใน docs" },
      { title: "Check constraints: name non-empty, price ≥ 0, qty ≥ 0, discount 0-100, rating 1-5, order qty > 0. DB ปฏิเสธขยะแม้ zod bypass" },
      { title: "docs/rubric-coverage.md: matrix Lecture 9+10 → file:line, สำหรับ demo viva" },
      { title: "schema.prisma เพิ่ม Product.updatedAt (no @updatedAt - trigger เป็นเจ้าของ). triggers/views/roles/checks อยู่ใน migration SQL อย่างเดียว" },
    ],
  },
  {
    id: "phase-13-6",
    title: "Phase 13.6 · Q&A + admin moderation migrated",
    subtitle: "Q&A ขึ้น Express layered. field-level permission - body (admin/asker), answer field (admin), answer endpoint (seller ของ product/admin)",
    icon: HelpCircle,
    tone: "info",
    shippedAt: "today",
    commitSha: "80f60ba",
    items: [
      { title: "layered q&a resource มี 2 router (productQuestionsRouter + default)" },
      { title: "GET /products/:productId/questions PUBLIC, include answerer.stats.role ให้ UI render Admin/Seller answered ได้" },
      { title: "POST /products/:productId/questions: 404 ถ้า product soft-deleted/orphan" },
      { title: "PATCH /questions/:id: body = admin/asker, answer = admin only (seller ใช้ /answer ให้ stamp answeredAt + answererId ถูก)" },
      { title: "PATCH /questions/:id/answer: เฉพาะ seller ของ product (เช็คผ่าน req.user.store.storeId) หรือ admin" },
      { title: "DELETE /questions/:id: admin/asker. admin delete write audit + full snapshot" },
      { title: "@metu/shared: questionAskSchema + EditSchema + AnswerSchema" },
    ],
  },
  {
    id: "phase-13-5",
    title: "Phase 13.5 · Reviews + admin moderation migrated",
    subtitle: "review CRUD ขึ้น Express. admin-OR-author gate. admin moderation write audit row + before/after snapshot",
    icon: Star,
    tone: "info",
    shippedAt: "today",
    commitSha: "9fba3a1",
    items: [
      { title: "layered reviews resource: POST /products/:productId/reviews (mergeParams) + PATCH/DELETE /reviews/:id" },
      { title: "POST: 404 ถ้า product soft-deleted/store gone. response รวม author + product info ให้ moderation UI ไม่ต้อง refetch" },
      { title: "PATCH/DELETE /reviews/:id: admin หรือ author. seller แก้ review ของ product ตัวเอง ไม่ได้ (manipulation ชัดเจน)" },
      { title: "audit: admin reach review คนอื่น write review.edit before/after หรือ review.delete พร้อม full snapshot. self-action ไม่ audit" },
      { title: "@metu/shared: reviewEditSchema (rating + comment optional ทั้งคู่, 400 ถ้าไม่ส่งเลย)" },
    ],
  },
  {
    id: "phase-13-4",
    title: "Phase 13.4 · Orders + checkout migrated to Express",
    subtitle: "POST /orders (checkout 1 transaction), GET /orders, GET /orders/:id. ownership ใช้ 404 ไม่ใช่ 403 ไม่ leak existence",
    icon: Receipt,
    tone: "info",
    shippedAt: "today",
    commitSha: "3f63d88",
    items: [
      { title: "layered orders resource, requireAuth ที่ router level" },
      { title: "checkout 7 step Prisma transaction: resolve cart + selected lines → coupon (active + window) → Decimal arithmetic → create tx + order + items → flip cart checked_out + เปิด cart ใหม่ → re-parent unselected → CouponUsage" },
      { title: "discount cap: discount เกิน eligible subtotal ไม่ได้ (฿1000 off ฿200 → cap ฿200)" },
      { title: "BFF: forwardToApi. POST /api/orders ยัง revalidatePath('/', '/health', '/admin') BFF-side หลัง 2xx (Express ไม่รู้จัก Next data cache)" },
      { title: "ลบ legacy apps/server/src/routes/orders.ts" },
    ],
  },
  {
    id: "phase-13-2-1",
    title: "Phase 13.2.1 · forgot/reset password migrated",
    subtitle: "ปิด defer Phase 13.2. token SHA-256 hash, 30 min TTL, ไม่ leak email enumeration, รหัส error เดียวกันหมด",
    icon: Mail,
    tone: "info",
    shippedAt: "today",
    commitSha: "accf4bd",
    items: [
      { title: "POST /auth/forgot-password silent no-op ถ้า email ไม่มี, return generic message attacker probe ไม่ออก" },
      { title: "POST /auth/reset-password 3-statement transaction: mark consumed + invalidate token อื่นของ user เดียวกัน" },
      { title: "utils/email.ts port จาก BFF: console default, Resend ถ้ามี key, fall back console ถ้า fail" },
      { title: "utils/audit.ts port: write auth.password_reset" },
      { title: "@metu/shared: forgotPasswordSchema + resetPasswordSchema" },
    ],
  },
  {
    id: "phase-13-3",
    title: "Phase 13.3 · Cart + coupons migrated to Express",
    subtitle: "GET /cart, cart items CRUD, POST /coupons/validate ขึ้น Express. envelope shape เดิม, BFF เป็น thin proxy",
    icon: ShoppingCart,
    tone: "info",
    shippedAt: "today",
    commitSha: "95b0194",
    items: [
      { title: "layered cart resource, requireAuth router level" },
      { title: "GET /cart envelope เดิม: cartId + items[] (รวม stock + unit price + lineTotal) + subtotal" },
      { title: "POST /cart/items merge qty ถ้า productItemId ซ้ำ (ไม่สร้าง row ซ้ำ)" },
      { title: "PATCH/DELETE /cart/items/:id: 404 (ไม่ใช่ 403) ถ้าของคนอื่น ไม่ leak ว่า id มีจริง" },
      { title: "POST /coupons/validate ตอบ 200 พร้อม { valid, reason? } ให้ cart UI โชว์เหตุผลไป not-found / not-active / expired / limit-reached" },
      { title: "ลบ legacy cart.ts + coupons.ts" },
    ],
  },
  {
    id: "phase-13-2",
    title: "Phase 13.2 · Auth migrated to Express + cookie boundary",
    subtitle: "login/register/me/logout/change-password ขึ้น Express. Express ออก JWT cookie, BFF forward Set-Cookie ให้ cookie scope ที่ metu.fly.dev",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "0942fcd",
    items: [
      { title: "layered auth resource (model re-export zod จาก @metu/shared)" },
      { title: "endpoints live: POST login/register/logout, GET/PATCH /auth/me, POST /auth/change-password" },
      { title: "middleware/auth.ts rewrite throw AppError แทน return 401 ตรง. helper เดิมรอด: issueToken/clearToken/readToken/requireAuth/softAuth/currentUser/currentAuth" },
      { title: "Profanity guard + Turnstile verify port มา apps/server/src/utils, no-op ถ้าไม่ตั้ง env" },
      { title: "BFF /api/auth/* แปลงเป็น forwarder. Set-Cookie pass ผ่าน Headers#getSetCookie ให้ scope BFF host" },
      { title: "lib/session getMe เรียก /auth/me ผ่าน apiFetch, return shape เดิม 1:1" },
      { title: "defer Phase 13.2.1: forgot/reset (ต้อง email/token module เพิ่ม)" },
    ],
  },
  {
    id: "phase-13-1",
    title: "Phase 13.1 · Backend separation — Express API + Next BFF",
    subtitle: "split monolith เป็น 2 Fly app: metu (Next BFF) + metu-api (Express + Prisma). catalog เป็น vertical slice แรก",
    icon: Layers,
    tone: "info",
    shippedAt: "today",
    commitSha: "22b79ba",
    items: [
      { title: "@metu/server workspace ที่ apps/server: routes/controllers/services/models/middleware/db/utils. 1 file ต่อ resource ต่อ layer" },
      { title: "5 layered resource live: GET /health, /products (+ id + featured), /stores (+ limit + id), /categories, /tags" },
      { title: "BFF rewire: lib/server/api.ts wrap fetch + cookie forward, queries.ts catalog delegate apiFetch. getProduct ยัง direct-Prisma รอ Reviews ports soft-delete cascade selector" },
      { title: "deploy: apps/server/Dockerfile multi-stage Node 20 + fly.server.toml. Fly app metu-api region sin. release_command รัน prisma migrate deploy" },
      { title: "BFF อ่าน API base จาก INTERNAL_API_URL (https://metu-api.fly.dev prod, http://localhost:4000 local)" },
      { title: "live verified: /, /browse, /browse?sort, /browse?category, /store/18 ทุกหน้าเรียก metu-api เห็นใน Fly logs" },
      { title: "apps/server/README.md doc 5-step add-an-endpoint template ให้ migration ถัดไป" },
    ],
  },
  {
    id: "qa-r3-f1",
    title: "QA round #3 / F1 — silent React hydration errors fixed",
    subtitle: "เจอ React #418 + #422 แอบฟ้องบน /, /browse, /cart. Next 14 fire ตอน multi <Image priority> ใน route เดียว. cap เหลืออันละ 1",
    icon: AlertTriangle,
    tone: "warning",
    shippedAt: "today",
    commitSha: "907ee5b",
    items: [
      { title: "QA round #3 sweep: 23/23 routes correct, F19 mobile sheet DOM verified, Phase 12.2.1 ban metadata verified ผ่าน SSH+Prisma" },
      { title: "F1 root cause: Next 14 fire #418+#422 ตอน ≥2 <Image priority fill> render ใน route เดียวกัน. multi <link rel=preload> ที่ inject post-render ไม่ match SSR snapshot" },
      { title: "/cart line thumbnail: priority → loading=lazy (80x80 N เล็ก ไม่กระทบ LCP)" },
      { title: "/browse first row: priority={i<4} → priority={i===0}. มี LCP card อันเดียว preload" },
      { title: "/ trending grid: drop priority={i<2} ทิ้ง. feature card promote เองผ่าน eagerLoad logic" },
      { title: "เผื่อใจ: เพิ่ม suppressHydrationWarning ที่ <html> (themeBootstrapScript pattern next-themes)" },
    ],
  },
  {
    id: "phase-12-2",
    title: "Phase 12.2 · User ban metadata",
    subtitle: "แยก self-delete vs admin ban ที่ schema. user โดน ban ขึ้น coral badge + reason underneath",
    icon: ShieldAlert,
    tone: "danger",
    shippedAt: "today",
    commitSha: "b787f66",
    items: [
      { title: "migration เพิ่ม banned_at + banned_reason + index, additive ไม่ backfill" },
      { title: "DELETE /api/admin/users/[id] รับ optional { reason }. มี reason → ban + audit user.ban, ไม่มี → unchanged" },
      { title: "UserRowActions: 'Delete' → 'Remove'. ConfirmDialog มี textarea 120 char. button label flip Remove/Ban ตามมีไม่มี reason" },
      { title: "/admin/users: banned user coral badge + reason text. self-deleted = mist 'Deleted'. hover เห็น full reason" },
      { title: "convention: bannedAt set = admin ban, bannedAt null + deletedAt set = self-delete หรือ pre-12.2" },
      { title: "ปิด proposal S8 จาก Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-f19",
    title: "Phase 11 · F19 — /browse mobile bottom-sheet",
    subtitle: "mobile slide-up filter sheet พร้อม count badge, sidebar toggle ไม่กระโดด top, sticky cap viewport height",
    icon: Filter,
    tone: "info",
    shippedAt: "today",
    commitSha: "aba77ed",
    items: [
      { title: "mobile pill 'Filters (N)' แทน 4 filter card stack. slide-up bottom sheet max 85vh + ESC + backdrop close + body scroll lock" },
      { title: "active filter count badge บน trigger pill (compute server-side จาก search params)" },
      { title: "filter <a> เป็น <Link scroll={false}> ไม่กระโดด top เวลา toggle tag/rating" },
      { title: "sticky sidebar max-h:calc(100vh-7rem) + overflow-y-auto กัน tag list ยาวล้นจอ" },
      { title: "pagination ตั้งใจคง scroll-to-top - หน้าใหม่ควรเริ่มที่บนสุด" },
      { title: "เพิ่ม sheet-rise keyframe 220ms cubic-bezier ที่ globals.css" },
    ],
  },
  {
    id: "phase-11-2",
    title: "Phase 11.2 · moneyCompact() for KPI revenue cards",
    subtitle: "Phase 11.1 truncate แล้วยังเลขขาดกลาง '฿45,6…'. user ขอ K/M shorthand. ตอนนี้ ฿45.6K / ฿1.2M",
    icon: Wallet,
    tone: "warning",
    shippedAt: "today",
    commitSha: "b873994",
    items: [
      { title: "moneyCompact() ใน lib/format.ts: ต่ำกว่า ฿1000 fall through money(), เกินใช้ en-US compact" },
      { title: "StatCard เพิ่ม valueTooltip prop: caller ส่งเลขเต็มมา hover เห็นจริง" },
      { title: "StatCard highlight ramp ลดลง 1 step (text-2xl→xl etc), default + zero variant คงเดิม" },
      { title: "wire เข้า /seller, /admin GMV, /seller/analytics" },
    ],
  },
  {
    id: "phase-12-1",
    title: "Phase 12.1 · Store live-rows partial index",
    subtitle: "schema-only ship. partial index ใน store(created_at DESC) WHERE deleted_at IS NULL. free query plan upgrade",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "912fc08",
    items: [
      { title: "migration 20260426030000_phase_12_1_store_live_partial_index" },
      { title: "CREATE INDEX store_live_idx ON store(created_at DESC) WHERE deleted_at IS NULL" },
      { title: "store_deleted_at_idx เก่ายังเก็บไว้ moderation views" },
      { title: "ไม่ใช้ CONCURRENTLY (Prisma migration อยู่ใน transaction). 8 store build instant" },
      { title: "cost ~16 KB ตอนนี้ scale linear กับ live store. O(log n) แทน O(n)" },
      { title: "ปิด proposal S8 'Store index for KPI / soft-delete' จาก Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-1",
    title: "Phase 11.1 · Post-deploy hotfixes",
    subtitle: "2 visual regression หลัง Phase 11 run #2 - /browse overflow desktop, /seller revenue StatCard ตัด",
    icon: Bug,
    tone: "warning",
    shippedAt: "today",
    commitSha: "362853d",
    items: [
      { title: "/browse parent grid: 1fr → minmax(0,1fr) ให้ column เคารพ viewport" },
      { title: "StatCard highlight: ramp text-2xl/sm:3xl/md:4xl/xl:5xl + tabular-nums จัดเลข" },
      { title: "StatCard value div: min-w-0 + truncate + title attr ให้ baht ใหญ่ ellipse แทน push layout" },
      { title: "บอนัส: ลบ routable /not-found ให้ตก framework 404 (status code ตรงกับหน้า)" },
    ],
  },
  {
    id: "phase-11-run-2",
    title: "Phase 11 · QA workflow run #2",
    subtitle: "QA pass ครั้งที่ 2: 22 findings (0 P0 / 17 new / 5 carry-over), ปิด 20 ใน session เดียว, defer 2",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "bbf7fdf",
    items: [
      { title: "F1+F12+F14: deletedAt:null predicate ทุก admin query ที่ surface store/product. count ตรงกันทุกหน้า" },
      { title: "F2: POST /api/orders revalidate / + /health ให้ trending count refresh ไม่ต้อง reload" },
      { title: "F3: leo-profanity guard wire เข้า register + PATCH /me (server-only ~25 kB, 0 client bundle)" },
      { title: "F4+F10: image priority hint 4 card แรก /browse, 2 card trending, cart line thumb. ฆ่า placeholder flash" },
      { title: "F5: ImageGallery thumbnail onError fallback (broken thumb URL → placeholder ไม่ใช่ 0×0 gap)" },
      { title: "F6: multi-role badge ใน AuthMenu + /profile (mist Buyer + mint Seller, yellow Admin override)" },
      { title: "F7+F16: DollarSign → Banknote ทุก baht StatCard ('USD' ผู้ใช้ไทยอ่านแล้วงง). equalize home stats grid column" },
      { title: "F8: CartNavIcon (60s poll + cart:update window event) wire TopNav, dispatch จาก PDP/cart mutations" },
      { title: "F9: coupon hint i18n 'e.g. METU10' + 'not found' ผ่าน useI18n (10 EN + 10 TH key ใหม่)" },
      { title: "F11: ลบ Apply button redundant ที่ sort dropdown (run #1 wire auto-submit แล้ว)" },
      { title: "F13: /admin/stores skeleton flash หาย via getAdminStores helper (direct Prisma แทน same-host HTTP)" },
      { title: "F15: <Avatar> primitive (xs/sm/md/lg/xl) deterministic HSL hue + AA-contrast initials, wire AuthMenu/admin users/messages/profile" },
      { title: "F17: /admin/changelog header + TL;DR derive count จาก shippedAt='today' (ไม่ใช่ทั้ง log) + singular/plural" },
      { title: "F18: 'favourites' UK → 'favorites' US ทุก user-visible string (i18n family + nav.favorites EN value)" },
      { title: "F21: /not-found emit HTTP 404 (เคย 200 OK) via app/not-found/page.tsx → notFound()" },
      { title: "F22: seller OrderStatusActions z-index + stopPropagation - Refund/Mark/Cancel ไม่โดน row click handler กิน" },
    ],
  },
  {
    id: "phase-11",
    title: "Phase 11 · QA workflow run #1",
    subtitle: "first run user-tester → CEO → 8 specialist QA workflow. 28 findings, ปิด 27, escalate 1 (F22)",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "d8825f5",
    items: [
      { title: "F1: review หยาบบน /product/100 (user 53 + cascade fix getProduct reviews include)" },
      { title: "F2: /admin/audit empty-state copy + verify audit pipeline เขียนได้ (1 → 6 row จาก run นี้)" },
      { title: "F3: /browse?category=<slug> resolve slug แล้ว (เคย Number() → NaN → silent drop)" },
      { title: "F5: light theme hero contrast - DIGITAL จาก ~1.5:1 เป็น ~17:1 ผ่าน bg-hero-radial light override" },
      { title: "F6/F14/F23: junk store cleanup (4 ร้าน soft-delete ผ่าน admin API, KPI auto-correct)" },
      { title: "F8: admin/stores + admin/users มี loading.tsx skeleton ของตัวเอง" },
      { title: "F10: counter unify - home/health/admin อ่าน Store.count (CEO Decision Option A)" },
      { title: "F19: <ConfirmDialog> primitive แทน window.confirm 6 callsite, full ARIA contract" },
      { title: "F22: sort dropdown auto-submit ผ่าน SortSelect (CEO Option A)" },
      { title: "F28: /profile/edit skeleton flash หาย - route loading.tsx + cached getCountries" },
      { title: "และ 6 ux-polish + 4 design-cohesion + 4 content-copy + 2 i18n + 1 a11y findings (full list ใน qa-2026-04-25.md)" },
    ],
  },
  {
    id: "phase-10",
    title: "Phase 10 · Authoring + messaging follow-ups",
    subtitle: "Q&A label bug + admin moderation + dashboard rebrand + admin tables + buyer messaging discoverability. 10 commits",
    icon: MessageSquare,
    tone: "info",
    shippedAt: "yesterday",
    commitSha: "55d6aa5",
    items: [
      { title: "Q&A admin reply โชว์ 'Admin answered' (เคย hard-code 'Seller answered')" },
      { title: "admin edit/delete review + Q&A จากหน้า product, coral 'MOD' pip + audit log" },
      { title: "authoring primitive: FormSection, TextInput/Textarea/Select/NumberInput/PriceInput, VariantRow, PreviewPane, DataTable, ActionRow" },
      { title: "rebuild seller form ทั้งหมด: NewProduct/EditProduct/EditStore/NewCoupon/BecomeSeller. multi-section + sticky live preview" },
      { title: "4-col variant grid แน่น → semantic VariantRow (delivery method label เหนือ qty/price/discount, ไม่ใช่ในนั้น)" },
      { title: "admin tables /admin/users + /stores + /reports + /audit ใช้ DataTable + ActionRow + mint/coral tone" },
      { title: "sidebar token unify (brand-yellow → metu-yellow), SellerSidebar unread dot amber → mint" },
      { title: "buyer messaging discover ได้แล้ว: chat icon + unread badge ใน TopNav, /messages buyer inbox, 'Messages' ใน AuthMenu" },
      { title: "'Message store' บน /store/[id], 'Ask the seller' บน /product/[id], 'Message seller about this order' บน /orders/[id]" },
      { title: "FileImageInput thumbnail compact (เคย aspect-5/2 ใหญ่). แก้ 'ช่องใส่รูปใหญ่ไป' บน /seller/products/new" },
    ],
  },
  {
    id: "batch-0",
    title: "Batch 0 · Perf regression hunt",
    subtitle: "ฆ่า cold-start lag ที่เจอตอน present: keep-warm cron, parallel fetch, reuse Prisma client, แยก pooled/unpooled DB URL",
    icon: Zap,
    tone: "yellow",
    shippedAt: "04:55",
    commitSha: "fa8f6a7",
    items: [
      { title: "Vercel cron ping /api/health ทุก 4 นาที keep Neon serverless compute warm" },
      { title: "parallel /product/[id] data fetch ประหยัด 1 serial DB roundtrip" },
      { title: "pin Prisma client บน globalThis ทุก env (เคย dev-only)" },
      { title: "แยก DATABASE_URL (pooled, runtime) จาก DATABASE_URL_UNPOOLED (migrate deploy)" },
      { title: "trim backdrop-blur radii + shadow blur แก้ scroll stutter" },
    ],
  },
  {
    id: "batch-a",
    title: "Batch A · Quick wins",
    subtitle: "7 small UX delight ที่ไม่ต้อง schema change. ของแบบที่ reviewer สังเกตเห็นทันที",
    icon: Sparkles,
    tone: "info",
    shippedAt: "08:54",
    commitSha: "e89f01d",
    items: [
      { title: "recently-viewed strip บน /browse (localStorage cap 12)" },
      { title: "share button บน product + store (Web Share API + clipboard fallback)" },
      { title: "'X bought this in the last week' social-proof line บน product detail" },
      { title: "keyboard shortcut: /, g b, g c, g f, ? + cheatsheet dialog" },
      { title: "/profile/edit page: avatar, name, email, country, DOB, gender" },
      { title: "change-password flow ที่ verify current password + bcrypt hash" },
      { title: "'save for later' - ย้าย cart line ไป favorite ในคลิกเดียว" },
    ],
  },
  {
    id: "batch-b",
    title: "Batch B · Seller tools",
    subtitle: "seller บอกว่า dashboard บาง. 7 tool ให้ run ร้านได้จริง รวม inbox seller↔buyer",
    icon: Store,
    tone: "yellow",
    shippedAt: "09:42",
    commitSha: "4035c9e",
    items: [
      { title: "duplicate product (one-click clone, paused default ให้แก้ก่อน)" },
      { title: "pause/resume product toggle - Product.isActive + browse filter" },
      { title: "seller↔buyer inbox /seller/messages + /messages/[userId] (Message table)" },
      { title: "coupon performance report /seller/coupons/[id]/report" },
      { title: "download sales CSV - /api/seller/orders/export.csv stream file" },
      { title: "low-stock banner ใน seller dashboard เมื่อ variant ≤ 5" },
      { title: "bulk-edit price /seller/products/bulk (apply ±N% บน selected row)" },
    ],
  },
  {
    id: "batch-c",
    title: "Batch C · Buyer growth",
    subtitle: "7 feature เน้น conversion + return visit - Q&A, free sample, related, compare, gift checkout, rating filter, restock alert",
    icon: ShoppingBag,
    tone: "success",
    shippedAt: "11:19",
    commitSha: "570bb58",
    items: [
      { title: "product Q&A - buyer ถาม seller ตอบ inline (ProductQuestion table)" },
      { title: "free sample download per variant (sampleUrl บน ProductItem)" },
      { title: "'more like this' related row ที่ล่างของ /product/[id]" },
      { title: "/compare - side-by-side ได้ถึง 3 product" },
      { title: "gift checkout (recipient email + message stored บน Order)" },
      { title: "minimum-rating filter บน /browse" },
      { title: "'notify me on restock' button + StockAlert table" },
    ],
  },
  {
    id: "fix-admin",
    title: "Fix · Admin role + scroll feel",
    subtitle: "2 fix ที่ flag ใน chat - admin เปิดร้านแล้ว role หาย + scroll ต้อง smooth",
    icon: Wrench,
    tone: "purple",
    shippedAt: "12:01",
    commitSha: "bfb8abc",
    items: [
      { title: "/api/seller/become-seller ไม่ demote admin เป็น seller ตอนสร้างร้านแล้ว" },
      { title: "TopNav มีปุ่ม 'Admin panel' โผล่เด่นเฉพาะ admin role" },
      { title: "smooth scroll behavior บน <html> + scroll-padding-top สำหรับ sticky nav" },
      { title: "reduced-motion media query disable ทั้ง smooth scroll + animation" },
    ],
  },
  {
    id: "batch-g",
    title: "Batch G · Tests",
    subtitle: "2 test suite: Vitest helper (sub-second) + Playwright smoke 4 persona บน live deploy. pre-deploy regression gate",
    icon: FlaskConical,
    tone: "yellow",
    shippedAt: "14:39",
    commitSha: "51e520e",
    items: [
      { title: "Vitest + @vitest/coverage-v8 wire ผ่าน `npm test -w @metu/web`" },
      { title: "26 unit test 2 ไฟล์ run ~500ms - pure helper ไม่มี jsdom" },
      { title: "extract coupon math + maxForLine + subtotal helper เป็น lib/cart-math.ts" },
      { title: "extract cardImage URL transform เป็น lib/utils.ts (reusable + testable)" },
      { title: "Playwright + Chromium run บน https://metu.fly.dev (BASE_URL override ได้)" },
      { title: "4 persona smoke spec: guest/buyer/seller/admin happy path" },
      { title: "full e2e suite ผ่าน ~20s บน Neon cold - pre-deploy regression gate" },
    ],
  },
  {
    id: "batch-f",
    title: "Batch F · Observability",
    subtitle: "monitoring prod-grade: Sentry + Plausible (env-optional ทั้งคู่) + public /health page",
    icon: Activity,
    tone: "success",
    shippedAt: "13:55",
    commitSha: "5f7937c",
    items: [
      { title: "@sentry/nextjs v10 wire เข้า instrumentation.ts (server+edge) + instrumentation-client.ts (browser)" },
      { title: "DSN env-gate - ไม่มี DSN ก็ไม่ init ไม่ส่ง request. lazy import client ให้ SDK ขึ้นเฉพาะตอน config" },
      { title: "global-error.tsx capture top-of-tree React error ที่หลุด per-route boundary" },
      { title: "sample rate: 1.0 dev, 0.2 prod, release tag deploy SHA" },
      { title: "Plausible drop-in (NEXT_PUBLIC_PLAUSIBLE_DOMAIN), cookie-free, no consent banner" },
      { title: "public /health: DB ping, uptime, build SHA, region, soft-delete-aware catalogue count" },
      { title: "ping badge 4 ระดับ FAST/OK/SLOW/DOWN ให้ on-call อ่านสถานะแว่บเดียว" },
    ],
  },
  {
    id: "batch-e",
    title: "Batch E · Platform polish",
    subtitle: "7 รายการ polish ชั้นถัดไป: discoverability (PWA + sitemap), a11y (skip + focus trap), 404, light mode, TH/EN i18n",
    icon: Palette,
    tone: "info",
    shippedAt: "07:57",
    commitSha: "b08c41c",
    items: [
      { title: "PWA manifest /manifest.webmanifest + branded SVG icon (any + maskable)" },
      { title: "dynamic /sitemap.xml (top 200 product + ทุก store) + /robots.txt" },
      { title: "custom 404 + popular-categories suggestion ใต้ CTA" },
      { title: "skip-to-content + id='main' wire เข้า 27 หน้า (WCAG 2.4.1)" },
      { title: "useFocusTrap() บน WriteReviewDialog + keyboard cheatsheet (WCAG 2.4.3)" },
      { title: "light mode toggle TopNav, persist localStorage, no flash on reload" },
      { title: "TH/EN i18n ใน TopNav, footer, search placeholder, cart empty state" },
    ],
  },
  {
    id: "batch-d",
    title: "Batch D · Trust & security",
    subtitle: "batch ใหญ่สุดของวัน: rate limit, password reset, soft-delete + audit log, Turnstile, GDPR export",
    icon: Shield,
    tone: "danger",
    shippedAt: "12:24",
    commitSha: "1f67c0a",
    items: [
      { title: "rate-limit middleware (5/min per IP) บน login, register, forgot-password" },
      { title: "password reset flow - /forgot-password + /reset-password page, SHA-256 hashed token, 30 min TTL" },
      { title: "email facade - console (dev) หรือ Resend (มี RESEND_API_KEY)" },
      { title: "AuditLog table + audit() helper wire เข้าทุก destructive admin/seller route" },
      { title: "soft-delete (deletedAt) บน User/Store/Product, public surface filter ทันที" },
      { title: "Cloudflare Turnstile CAPTCHA บน /register (no-op ถ้าไม่มี TURNSTILE_SECRET)" },
      { title: "GDPR export - GET /api/profile/export stream JSON dump ของ user" },
      { title: "/admin/audit page - paginated, filter ตาม action + target type" },
    ],
  },
];

const REPO_URL = "https://github.com/Bank848/metu";

export default function ChangelogPage() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Headline counts only reflect what shipped TODAY — older batches stay
  // in the list as historical record but don't inflate the "shipped
  // today" totals (was the F17 bug: 80 features / 11 batches reported as
  // today's work when only 2 batches actually landed today).
  const todayBatches = BATCHES.filter((b) => b.shippedAt === "today");
  const todayBatchCount = todayBatches.length;
  const todayItemCount = todayBatches.reduce((sum, b) => sum + b.items.length, 0);
  const totalItems = BATCHES.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <>
      <PageHeader
        title="What's new"
        subtitle={`${todayBatchCount} ${todayBatchCount === 1 ? "batch" : "batches"} · ${todayItemCount} ${todayItemCount === 1 ? "item" : "items"} shipped today (${today}) · ${BATCHES.length} batches / ${totalItems} items in the full log`}
      />

      {/* TL;DR strip — for the friend you'll show this to first. */}
      <section className="mb-8 rounded-2xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/10 to-transparent p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-yellow mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          TL;DR
        </div>
        <p className="text-base text-white leading-relaxed">
          Today we shipped <strong className="text-brand-yellow">{todayItemCount} items across {todayBatchCount} {todayBatchCount === 1 ? "batch" : "batches"}</strong>{" "}
          — performance fixes, quick UX wins, seller tools, buyer-growth features, the admin/role fix you noticed,
          and a full trust &amp; security pass (rate limits, password reset, audit log, CAPTCHA, GDPR export).
          Everything is live on{" "}
          <a
            href="https://metu.fly.dev"
            className="text-brand-yellow underline underline-offset-2 hover:text-brand-yellowDark"
            target="_blank"
            rel="noopener noreferrer"
          >
            metu.fly.dev
          </a>
          .
        </p>
      </section>

      {/* Batch cards */}
      <div className="space-y-6">
        {BATCHES.map((batch) => {
          const Icon = batch.icon;
          return (
            <article
              key={batch.id}
              className="rounded-2xl border border-line bg-space-850 overflow-hidden"
            >
              <header className="px-6 py-5 border-b border-line flex items-start gap-4">
                <div className="shrink-0 h-11 w-11 rounded-xl bg-space-900 border border-line flex items-center justify-center">
                  <Icon className="h-5 w-5 text-brand-yellow" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-lg font-bold text-white">
                      {batch.title}
                    </h2>
                    <Badge variant={batch.tone}>{batch.items.length} items</Badge>
                  </div>
                  <p className="text-sm text-ink-secondary mt-1">{batch.subtitle}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-ink-dim">
                    <span>shipped {batch.shippedAt}</span>
                    <span>·</span>
                    <a
                      href={`${REPO_URL}/commit/${batch.commitSha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-brand-yellow"
                    >
                      <GitCommit className="h-3 w-3" />
                      {batch.commitSha}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  </div>
                </div>
              </header>
              <ul className="divide-y divide-line">
                {batch.items.map((it, i) => (
                  <li key={i} className="px-6 py-3 flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-yellow shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{it.title}</p>
                      {it.detail && (
                        <p className="text-xs text-ink-dim mt-1">{it.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-ink-dim text-center">
        See the full commit history on{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-yellow hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </>
  );
}
