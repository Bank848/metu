import { Sparkles, Zap, Store, ShoppingBag, Shield, Wrench, GitCommit, ExternalLink, Palette, Activity, FlaskConical, MessageSquare, Database, Bug, Filter, Wallet, ShieldAlert, AlertTriangle, Layers, KeyRound, ShoppingCart, Mail, Receipt, Star, HelpCircle, Monitor } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";

// Must be dynamic so the parent admin layout's getMe() cookie read
// runs per-request. If we let this prerender at build time the layout
// sees no cookie, redirects to /login, and bakes that redirect into a
// static page that everyone hits.
export const dynamic = "force-dynamic";

/**
 * Admin-only changelog — every batch we ship gets a card here so the
 * team has a single place to point at when asked "what actually changed
 * today?". Server-component, no JS shipped to the browser.
 *
 * Sits behind the admin layout's `me.role !== "admin"` redirect, so
 * non-admins never see it even if they guess the URL.
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
    id: "phase-15-5",
    title: "Phase 15.5 · Admin force-password-reset (Phase 15 complete)",
    subtitle:
      "Last Phase 15 batch. Admins can flag any other user with a force-password-reset from /admin/users → triple-dots → 'Force password reset'. The flagged user gets bounced to /profile/edit on every authed page (admin layout, seller layout) until they successfully change/set their password — which clears the flag server-side as a side effect of the existing changePassword/setPassword services. Banner explains why. Self-toggle forbidden. PLUS a fix for the missing Google button on /login + /register: dropped the NEXT_PUBLIC_GOOGLE_ENABLED build-time env gate that was hiding the button on the live demo.",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "phase-15-5",
    items: [
      { title: "Migration 20260428235733_phase_15_5_require_password_reset: ALTER users ADD require_password_reset BOOLEAN NOT NULL DEFAULT false. Backfills every existing user with false; admins flip on demand" },
      { title: "schema.prisma: User.requirePasswordReset field with @map to the snake_case column" },
      { title: "service.setRequirePasswordReset(targetUserId, actorUserId, value, req): updates the User row + writes 'user.require_password_reset.set|.clear' AuditLog with IP+UA. 400 SelfToggleForbidden when admin tries to flag themselves (would lock themselves into the password-change UI without recourse)" },
      { title: "controller.setRequirePasswordReset + POST /admin/users/:id/require-password-reset (body: { value: boolean }). 400 ValidationError when body shape is wrong" },
      { title: "auth.service: changePassword + setPassword services BOTH clear requirePasswordReset on success. Single line added to the user.update data — idempotent for users who didn't have it set" },
      { title: "GET /auth/me extended with requirePasswordReset: Boolean(user.requirePasswordReset). Old clients pre-15.5 default to false in lib/session.ts (safe default — no false redirects)" },
      { title: "lib/session.ts requireResetGuard(me, currentPath) helper: NextJS redirect() to /profile/edit?must-reset=1 when flag set, allows /profile/edit + /login + /logout through. Wired into apps/web/app/admin/layout.tsx + apps/web/app/seller/layout.tsx" },
      { title: "/profile/edit page: amber banner when me.requirePasswordReset OR ?must-reset=1 — explains the situation and that changing the password will clear the flag automatically" },
      { title: "UserRowActions component: NEW menu item between role-change and remove. Label flips between 'Force password reset' (when not set) and 'Clear forced reset' (when already set). Tone primary/safe matches the action" },
      { title: "BFF: /api/admin/users/[id]/require-password-reset forwarder (~12 LOC)" },
      { title: "Vitest 142 → 147 (5 new): 403 non-admin (with proper user mock so requireAuth gets past the dual-stack lookup), 400 SelfToggleForbidden, 400 ValidationError on bad body, happy SET writes audit row 'user.require_password_reset.set', happy CLEAR writes the .clear variant" },
      { title: "BONUS: dropped NEXT_PUBLIC_GOOGLE_ENABLED gate from LoginForm + RegisterForm. NEXT_PUBLIC_* env vars require a rebuild to flip and were hiding the Google button on the live demo even though Phase 14.2's flow was wired correctly. Always renders now; if Google isn't configured server-side, better-auth surfaces a clean error and our Phase 14.3.5 errorCallbackURL banner explains it. Better UX than 'feature silently invisible'" },
      { title: "Build clean. Web shared First Load JS = 89.8 kB (unchanged). Phase 15 COMPLETE — 5 batches across rate-limit, sessions UI, OTP enforcement, audit IP+UA, force-reset" },
    ],
  },
  {
    id: "phase-15-3",
    title: "Phase 15.3 · Sensitive ops require fresh OTP when phone is verified",
    subtitle:
      "Stolen-session defence in depth. Once a user verifies their phone (Phase 14.4), every password change AND first-time password set require a fresh 6-digit OTP from SMS to confirm. Users WITHOUT a verified phone keep the legacy flow (no OTP needed) — Phase 15.3's gate is opt-in by design. Verification rows consumed on success so the same code can't be replayed against a second sensitive op.",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "36f9de3",
    items: [
      { title: "@metu/shared: changePasswordSchema + setPasswordSchema gain optional otpCode (6-digit regex). Optional in the schema so users without phone verification still pass parse; service-side guard enforces presence + freshness when needed" },
      { title: "auth.service.ensureSensitiveOtpIfVerified() helper — central enforcement point. No-op when phone unset OR phoneVerifiedAt null; otherwise requires + verifies + consumes the verification row. Distinct error codes (OtpRequired / InvalidOtp / NoPendingOtp / OtpExpired) so the UI can render helpful hints" },
      { title: "changePassword + setPassword services both call ensureSensitiveOtpIfVerified() AFTER the existing checks (currentPassword + PasswordAlreadySet) so the user gets useful errors in priority order" },
      { title: "EditProfileForm: when initial.phoneVerified=true, the password section sprouts an SMS-code panel with 'Send code' button + 6-digit input. Reuses the Phase 14.4 /request-otp flow. Hint text: 'SMS code required (phone verified)'. Reset on success" },
      { title: "Helpful error mapping in onFailure: OtpRequired → 'Phone verified — enter a fresh SMS code'; InvalidOtp → 'Wrong code, try again'; OtpExpired → 'Expired, request a new one'; NoPendingOtp → 'Click Send code first'" },
      { title: "Vitest 138 → 142 (4 new): change-password 400 OtpRequired when phone verified but no code, 400 InvalidOtp on wrong code, happy with correct code (verifies verification.delete called → row consumed → can't replay), legacy path still works without otpCode when phone NOT verified" },
      { title: "Build clean, web shared First Load JS = 89.8 kB (unchanged). Existing 138 tests untouched (they all use users without phoneVerifiedAt set, so the Phase 15.3 gate is a no-op in those scenarios)" },
      { title: "Phase 15.5 NEXT: admin force-password-reset (admin clicks button on /admin/users/:id → User.requirePasswordReset=true → login middleware redirects to /profile/edit until cleared)" },
    ],
  },
  {
    id: "phase-15-4",
    title: "Phase 15.4 · Audit log captures IP + User-Agent",
    subtitle:
      "Migration adds nullable ip_address (VARCHAR 45 — IPv6-sized) + user_agent (VARCHAR 255) to audit_log. audit() helper grows an optional `req` argument that extracts both from the Express request when supplied. Five admin destructive flows (user.role_change, user.delete, user.ban, store.delete, transaction.delete, transaction.refund) plumb the request through. Pre-15.4 rows + system actions (cron) stay NULL, surfaced as em-dashes in the new /admin/audit Origin column.",
    icon: Shield,
    tone: "info",
    shippedAt: "today",
    commitSha: "0440c83",
    items: [
      { title: "Migration 20260428233425_phase_15_4_audit_ip_ua: ALTER audit_log ADD ip_address VARCHAR(45) + user_agent VARCHAR(255). Both nullable so pre-15.4 rows + system actions don't violate" },
      { title: "schema.prisma: AuditLog gains ipAddress + userAgent fields with @map to the snake_case columns" },
      { title: "audit() helper signature: new optional `req: Pick<Request, 'ip' | 'headers'> | null` argument. Extracts req.ip (sliced to 45 chars), req.headers['user-agent'] (handles string | string[] | undefined, sliced to 255). Backwards compatible — every existing callsite keeps working without passing req" },
      { title: "Plumbed `req` through 5 high-value admin actions in admin.controller.ts → admin.service.ts: updateUserRole, deleteUser, deleteStore, deleteTransaction, refundTransaction. AuditReq type alias keeps the service signatures clean (no full Request import)" },
      { title: "Other audit() callers (seller.service.ts, reviews/qna admin moderation, etc.) NOT plumbed in this PR — backwards compat lets them migrate gradually as touched. The migration + helper change is the actual infrastructure" },
      { title: "/admin/audit DataTable: new 'Origin' column between Target and When. Renders ip + first 30 chars of UA in monospace. Em-dash placeholder when both are NULL (pre-15.4 rows + system actions). Truncated UA gets a title attr for full hover" },
      { title: "Server tests still 138/138 (zero rewrites — backwards-compat helper signature). app.set('trust proxy', true) from Phase 15.1 already ensures req.ip is the real client IP through Fly's proxy" },
      { title: "Build clean, web shared First Load JS = 89.8 kB (unchanged). Phase 15.3 NEXT: OTP-on-password-change (when phoneVerifiedAt set, change-password requires fresh OTP code)" },
    ],
  },
  {
    id: "phase-15-2",
    title: "Phase 15.2 · Active sessions UI (list + revoke + sign-out-everywhere)",
    subtitle:
      "Users can now see every device signed into their better-auth account from /profile/edit and revoke any of them. The current device gets a 'THIS DEVICE' badge + disabled Revoke button so a user can't accidentally sign themselves out. 'Sign out everywhere else' button revokes every session except the current one. The legacy JWT-cookie path doesn't have rows here (the cookie itself IS the session); for those users the table shows empty + a hint to change password to invalidate.",
    icon: Monitor,
    tone: "info",
    shippedAt: "today",
    commitSha: "2247f9a",
    items: [
      { title: "service: listSessions (filters expiresAt > now, strips token field), revokeSession (ownership-checked via userId predicate, 404 SessionNotFound if no row matches — guards against ID-enumeration attacks), revokeAllOtherSessions (deleteMany except currentSessionId; if null because user is on JWT-cookie path, deletes ALL)" },
      { title: "controller: 3 handlers + readBetterAuthSessionId() helper that calls auth.api.getSession({ headers }) to identify the current row. JWT-cookie users get currentSessionId=null surfaced to the UI" },
      { title: "routes: GET /auth/sessions, DELETE /auth/sessions/all-others (mounted BEFORE /:id so the literal path wins the route match), DELETE /auth/sessions/:id. All requireAuth-gated" },
      { title: "BFF: 3 forwarder routes — /api/auth/sessions, /api/auth/sessions/[id], /api/auth/sessions/all-others (~12 LOC each, standard forwardToApi pattern)" },
      { title: "EditProfileForm: NEW Active sessions section below password. Lazy-loads via useEffect on mount (fast SSR, async hydrate). Renders list of {ua, ip, createdAt, Revoke button}. Current device shown with yellow 'THIS DEVICE' pill + disabled button. 'Sign out everywhere else' appears when there are 2+ sessions" },
      { title: "Vitest 132 → 138 (6 new): GET 401 + happy with currentSessionId null when JWT-auth, DELETE :id 401 + 404 SessionNotFound + happy ownership-checked deleteMany, DELETE all-others happy ALL-revoke when JWT-auth (no current id) + audit row 'user.sessions_revoked' with revoked count + kept=0" },
      { title: "Build clean. Web shared First Load JS = 89.8 kB (unchanged — sessions section is plain JSX + a single useEffect, no new client deps)" },
      { title: "Phase 15.4 NEXT: standardise audit IP+UA capture (small migration adds 2 columns + middleware that attaches req.auditCtx so service functions don't need to touch req directly)" },
    ],
  },
  {
    id: "phase-15-1",
    title: "Phase 15.1 · Rate limit middleware (sliding window, in-memory)",
    subtitle:
      "First Phase 15 batch — closes the credential-stuffing + signup-bot + SMS-spend gaps left by Phase 14. Sliding-window in-memory limiter (Map keyed by IP) mounted on /auth/login (5/min), /auth/register (3/min), /auth/request-otp (3/min), /auth/forgot-password (3/5min). Returns 429 RateLimited + Retry-After header. No Redis — Phase D + Phase 15 plan both voted in-memory for the demo (restart-resets are acceptable). app.set('trust proxy', true) so Fly's X-Forwarded-For surfaces the real client IP via req.ip.",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "68980ea",
    items: [
      { title: "NEW middleware/rate-limit.ts: sliding window (not fixed window — no edge-of-window bursts), per-IP keying via req.ip, prune-on-check + opportunistic 1%-of-requests sweep keeps the Map bounded by traffic not uptime" },
      { title: "Per-route limiters exported as singletons (loginLimiter, registerLimiter, requestOtpLimiter, forgotPasswordLimiter) — fresh rateLimit({...}) per route would build new WeakMap entries every time and counters would never accumulate" },
      { title: "429 RateLimited response carries Retry-After header rounded UP to the nearest second (so curl -i + every HTTP client honours it; some choke on fractional seconds). X-RateLimit-Limit + X-RateLimit-Remaining headers also set on success for debugging" },
      { title: "app.set('trust proxy', true): Fly sits behind a proxy that sets X-Forwarded-For — without trust proxy req.ip = the proxy's IP and every limited request would share the same bucket, blocking legitimate traffic instantly. Local dev: req.ip stays 127.0.0.1 (no proxy header to consult)" },
      { title: "auth.routes.ts mounts: POST /login → loginLimiter, POST /register → registerLimiter, POST /forgot-password → forgotPasswordLimiter, POST /request-otp → requireAuth + requestOtpLimiter (the auth gate runs first; rate-limit only counts authed callers since the catch-all 401 wouldn't have hit prisma anyway)" },
      { title: "Vitest 128 → 132 (4 new): boundary check (Nth ok, N+1 → 429 + Retry-After ≥ 1), per-limiter isolation (separate routes don't share buckets), per-IP isolation (different X-Forwarded-For = separate buckets), window slide (after windowMs the bucket clears + requests are allowed again — uses 50ms window for a sub-second test)" },
      { title: "Build clean. No new deps. Phase 15.2 NEXT: sessions UI (list + revoke active better-auth sessions in /profile/edit + 3 endpoints)" },
    ],
  },
  {
    id: "phase-14-4",
    title: "Phase 14.4 · Phone + OTP scaffold (Phase 14 complete)",
    subtitle:
      "Last batch of Phase 14. Users can set a phone number from /profile/edit, request a 6-digit code, and verify it. OTP storage uses better-auth's verification table from Phase 14.1; transport adapter is pluggable (console-stub for dev, Twilio when env present, hard-disable via OTP_TRANSPORT=disabled). 5-minute TTL, SHA-256 hashed at rest, distinct error codes (NoPendingOtp / OtpExpired / InvalidOtp) so the UI can surface helpful messages. Phase 15 will enforce OTP on sensitive actions; Phase 14.4 is just the scaffold.",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "44ab6d0",
    items: [
      { title: "@metu/shared: 3 new schemas — updatePhoneSchema (liberal phone format, server normalises), requestOtpSchema (empty body, auth proves identity), verifyOtpSchema (6-digit numeric)" },
      { title: "NEW utils/otp.ts: generateCode (crypto.randomInt, no modulo bias), hashCode (SHA-256 of userId:phone:code so leaked codes can't be replayed against a different user/phone), otpIdentifier, expiresAt. deliverCode() routes to console (default) / twilio (env-gated) / disabled" },
      { title: "service.updatePhone: strips non-digits, clamps to length, clears phoneVerifiedAt (phone change invalidates verification). Doesn't auto-trigger OTP — caller hits /request-otp explicitly so SMS cost stays in user's hands" },
      { title: "service.requestOtp: reads User.phone (400 NoPhoneOnFile if missing), generates code, wipes any pending OTP for the user (one active code at a time), inserts hash into verification table, dispatches via transport (502 OtpDeliveryFailed on transport throw)" },
      { title: "service.verifyOtp: looks up pending OTP, distinguishes NoPendingOtp / OtpExpired (sweeps stale row) / InvalidOtp (hash mismatch). Atomic $transaction sets phoneVerifiedAt + deletes verification row. Audit row 'user.phone_verified' with last-4-digits PII guard" },
      { title: "controller + routes: PATCH /auth/phone, POST /auth/request-otp, POST /auth/verify-otp — all requireAuth. requestOtp surfaces transport name in response (helpful for the dev/demo flow to know if code went via SMS vs server logs)" },
      { title: "BFF: 3 new forwarder routes (~12 LOC each) — /api/auth/phone, /api/auth/request-otp, /api/auth/verify-otp" },
      { title: "EditProfileForm: NEW Phone section above the password section. Three-step UI: enter phone → 'Save phone' → 'Send code' button reveals the 6-digit input + 'Verify' button. Verified state shown as a green ✓ pill in the heading. Helpful inline error messages route from the distinct error codes (InvalidOtp → 'Try again or request a new one' etc)" },
      { title: "page.tsx threads me.user.phone + Boolean(me.user.phoneVerifiedAt) into EditProfileForm props" },
      { title: "Vitest 116 → 128 (12 new): updatePhone 401/400 ValidationError/happy-with-normalisation; requestOtp 401/400 NoPhoneOnFile/happy with deleteMany+create both fired and value matches sha256 hex pattern; verifyOtp 401/400 ValidationError/400 NoPendingOtp/400 OtpExpired+row swept/400 InvalidOtp/happy hash-match → $transaction + audit row" },
      { title: "Build clean, web shared First Load JS = 89.8 kB (unchanged — phone section is plain JSX, no new client deps)" },
      { title: "Phase 14 COMPLETE. Phase 15 NEXT: enforce OTP on sensitive actions (password change, email change), session management UI (list active sessions, sign-out everywhere), rate-limit /login + /register + /request-otp, optional 2FA enrolment" },
    ],
  },
  {
    id: "phase-14-3-5",
    title: "Phase 14.3.5 · Linking fork — Google email collision rejected with hint",
    subtitle:
      "Closes the security gap left by Phase 14.2's default behaviour (silently create a new User on every Google sign-in). Now: when a Google sign-in's email matches an existing local account, the OAuth flow is rejected with 409 EmailAlreadyRegistered, the user lands on /login?error=email-exists, and a banner tells them to sign in with their password and link Google from /profile/edit. Plus: better-auth's default User row now satisfies our schema's NOT NULL constraints (firstName + lastName split from Google's name field, unique username derived from email local-part with collision-retry).",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "c54fa62",
    items: [
      { title: "lib/auth.ts: databaseHooks.user.create.before checks for email collision (User.email match where deletedAt:null) and throws APIError('CONFLICT', 'EmailAlreadyRegistered') when found. better-auth surfaces this as the OAuth flow's error and redirects to errorCallbackURL" },
      { title: "Same hook now ALSO populates the NOT NULL fields better-auth doesn't know about: firstName + lastName split from Google's name string (single name → '—' surname placeholder), unique username derived via deriveUsername() helper" },
      { title: "deriveUsername(): take the email's local-part, strip non-alphanumeric, lowercase, slice to 14 chars, append a 4-digit nonce on collision (5 retries before timestamp-suffix fallback). Always fits in our VARCHAR(20) column" },
      { title: "splitName(): Google's name is a single string ('Jane Doe'); split on whitespace, first token → firstName, rest → lastName. Both clamped to VARCHAR(40). Empty surname (single-word names like 'Madonna') → '—' placeholder so NOT NULL is satisfied — user can fix from /profile/edit" },
      { title: "LoginForm: new errorMessage() helper reads the ?error= query param. Renders an amber banner above the form when 'email-exists' (or 'EmailAlreadyRegistered') is present, telling the user to log in with their password and link Google from settings" },
      { title: "Google button now sets errorCallbackURL=/login?error=email-exists alongside the existing callbackURL. better-auth redirects there on the OAuth-flow failure (vs the success URL on happy path)" },
      { title: "Soft-deleted accounts deliberately don't trigger the collision (uses deletedAt:null guard) — admin can re-enable a deleted account, and matching against the ghost would block legitimate fresh signups by the same person" },
      { title: "Server tests still 116/116 (no new tests yet — the better-auth flow needs real Postgres to exercise the hook end-to-end; will add integration coverage in a separate batch). Web tests still 37/37, bundle 89.8 kB unchanged" },
      { title: "Phase 14.4 NEXT: OTP scaffold — phone field already in schema (Phase 14.1), need POST /auth/request-otp + POST /auth/verify-otp + transport adapter (default to console-stub for dev, real SMS via Twilio if budget allows for the live demo)" },
    ],
  },
  {
    id: "phase-14-3",
    title: "Phase 14.3 · Set-password flow for Google-only users",
    subtitle:
      "Google sign-in users have NULL passwords (Phase 14.1 made the column nullable). Phase 14.3 lets them set a first password from /profile/edit so they can also sign in with email + password from then on. New POST /auth/set-password endpoint refuses with 400 PasswordAlreadySet for users who already have one (those should call /change-password instead). EditProfileForm flips between SET-password and CHANGE-password UI based on a new hasPassword boolean surfaced by GET /auth/me. Linking-fork (existing-email collision via Google) deferred to Phase 14.3.5 as a separate batch — needs better-auth's databaseHooks wired up.",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "af72290",
    items: [
      { title: "@metu/shared: new setPasswordSchema = { newPassword + confirmPassword } with the same min(6).max(100) bounds + match refinement as changePasswordSchema, but NO currentPassword field" },
      { title: "auth.service.setPassword(): looks up user.password, throws 400 PasswordAlreadySet if non-null, hashes + updates + writes 'user.set_password' AuditLog row. Same bcrypt rounds as changePassword for hash consistency" },
      { title: "auth.controller.setPassword + POST /auth/set-password (requireAuth gate). Doesn't issue a fresh cookie — caller is already authed via Google when they hit this" },
      { title: "GET /auth/me extended with hasPassword: Boolean(user.password). Older clients pre-14.3 don't break (field is optional in the response shape)" },
      { title: "lib/session.ts getMe() now returns { user, role, hasPassword }. Defaults missing field to true so the legacy change-password flow stays the safe default if a stale Express deploy answers the call" },
      { title: "EditProfileForm: hasPassword prop drives a UI fork — heading 'Change password' vs 'Set a password', explanation paragraph for Google-only users, current-password field hidden in SET mode, button label + busy text + success toast all switch. Hits /api/auth/set-password instead of /api/auth/change-password when hasPassword=false. router.refresh() after success so the next render picks up hasPassword=true and the form switches back" },
      { title: "BFF: /api/auth/set-password forwarder (~12 LOC, mirrors /api/auth/change-password)" },
      { title: "Vitest 112 → 116 (4 new): 401 without auth, 400 PasswordAlreadySet when password exists, happy first-set verifies bcrypt hash + audit row written, 400 ValidationError when newPassword + confirmPassword don't match" },
      { title: "Build clean, web shared First Load JS = 89.8 kB (unchanged — UI fork is small JSX delta)" },
      { title: "Phase 14.3.5 NEXT: linking fork via better-auth databaseHooks.user.create.before — when a Google sign-in's email matches an existing User, return 409 + redirect with hint instead of auto-linking (security: Google email creation is too easy for impersonation auto-link to be safe)" },
    ],
  },
  {
    id: "phase-14-2",
    title: "Phase 14.2 · Google sign-in + dual-stack auth middleware",
    subtitle:
      "Continue with Google now works end-to-end on /login and /register (gated on NEXT_PUBLIC_GOOGLE_ENABLED so dev shows the form-only UX). middleware/auth.ts is now DUAL-STACK: requireAuth() tries the legacy JWT cookie first (every existing test passes unchanged) then falls back to better-auth's session via auth.api.getSession({ headers }). Google users get better-auth's cookie via the OAuth callback; password users keep getting JWTs via /auth/login. Pure Mode A swap (drop the JWT entirely) stays an option for a later phase — dual-stack lets us ship Google login without rewriting any of the 112 existing server tests.",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "02b6035",
    items: [
      { title: "middleware/auth.ts: requireAuth + softAuth now try the JWT cookie first (no DB hit), fall back to readBetterAuthUserId() which wraps auth.api.getSession({ headers }). Synthesises a TokenPayload-shaped req.auth for downstream controllers regardless of which path resolved the user — handlers don't need to know" },
      { title: "Role check changed: uses jwtPayload.role when JWT path resolves, otherwise UserStats.role from the DB. Handles Google sign-in users (no JWT to read role from) and admin demote-mid-session edge cases" },
      { title: "lib/auth.ts: basePath swapped from /auth/better to /api/auth/better. Browser only ever talks to https://metu.fly.dev (BFF host); BFF proxies /api/auth/better/* to Express's catch-all at the same path. better-auth's OAuth callback URL generation matches what Google redirects to" },
      { title: "app.ts: Express catch-all moved from app.all('/auth/better/*') to app.all('/api/auth/better/*'). Still mounted BEFORE express.json() per better-auth Express docs" },
      { title: "NEW BFF catch-all: apps/web/app/api/auth/better/[...all]/route.ts forwards every method (GET/POST/PATCH/DELETE) to Express. Same file shape as Phase 13's per-resource proxies but with [...all] dynamic segment so all better-auth paths resolve through one route handler" },
      { title: "lib/server/proxy.ts: redirect:'manual' on the upstream fetch + Location header passthrough so OAuth 302s survive the BFF hop intact. Critical for the Google flow (sign-in start redirects to Google's authorize URL, callback redirects to the app)" },
      { title: "/login + /register: 'Continue with Google' button rendered only when NEXT_PUBLIC_GOOGLE_ENABLED=true. Plain anchor (top-level navigation) — fetch() wouldn't preserve the cookie set by the OAuth callback. Google brand SVG inline, divider with 'or sign in/up with email' below" },
      { title: "Tests still 112 server / 37 web (zero rewrite cost from the dual-stack approach). Better-auth smoke test path updated from /auth/better/get-session → /api/auth/better/get-session to match the new mount" },
      { title: "Build clean. Web shared First Load JS = 89.8 kB (unchanged — Google button is plain HTML+SVG, no client JS). Production needs flyctl secrets set: BETTER_AUTH_SECRET, BETTER_AUTH_URL=https://metu.fly.dev, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Until those are set, the button is hidden and dual-stack just ignores the better-auth fallback path" },
      { title: "Phase 14.3 NEXT: linking fork (existing-email collision: 409 + hint to log in via password and link from /profile/edit), set-password endpoint for Google-only users, OAuth profile picture sync. databaseHooks.user.create.before is the natural home for the linking logic" },
    ],
  },
  {
    id: "phase-14-1",
    title: "Phase 14.1 · better-auth plumbing (schema + catch-all)",
    subtitle:
      "Foundation for Phase 14's Google login. Pure plumbing — no UI references better-auth yet, no middleware swap. Migration adds the three tables better-auth's Prisma adapter expects (account / session / verification), makes User.password nullable for future Google-only signups, and adds emailVerified + phone + phoneVerifiedAt fields. better-auth instance configured for Mode A (cookie-owned sessions) with serial Int IDs matching our existing User.userId PK + field mapping onto the existing column names. Phase 14.2 swaps middleware/auth.ts to read better-auth's session cookie via Mode A; until then the legacy /auth/login + /auth/register continue to mint our metu_auth JWT cookie unchanged.",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "a49c2ec",
    items: [
      { title: "npm install better-auth in apps/server (v0.x). Two transitive vulnerabilities flagged by audit but they're in dev-only paths; tracked separately, not blocking" },
      { title: "Migration 20260428185803_phase_14_1_better_auth: ALTER users (password DROP NOT NULL + ADD email_verified BOOL + phone VARCHAR(20) + phone_verified_at TIMESTAMP), CREATE 3 tables (account / session / verification) with SERIAL Int PKs + Int FKs to users.user_id (clean Int → Int joins, no string-id pain)" },
      { title: "schema.prisma: User.password is now String? (was String). New Account/Session/Verification models with @map annotations bridging better-auth's camelCase API to our snake_case DB columns" },
      { title: "NEW apps/server/src/lib/auth.ts: betterAuth({...}) instance with prismaAdapter + advanced.database.generateId=false (Postgres serial owns IDs) + user.fields mapping (id→userId, name→firstName, emailVerified→emailVerified, image→profileImage). emailAndPassword.enabled true. Google provider mounts conditionally on GOOGLE_CLIENT_ID env so dev boots without OAuth credentials" },
      { title: "app.ts mount: app.all('/auth/better/*', toNodeHandler(auth)) registered BEFORE express.json() per better-auth's Express docs (handler reads raw body itself; json() would consume the stream first and the handler would hang)" },
      { title: "auth.service.ts: nullable-password guards added at both bcrypt.compare callsites. Login surfaces 401 InvalidCredentials when password is null (no info leak about why); changePassword surfaces 400 NoPasswordSet to direct Google-only users to the future POST /auth/set-password flow (Phase 14.3)" },
      { title: "Vitest 110 → 112 (2 new): GET /auth/better/get-session returns 200 with no session for anonymous request; unknown /auth/better/<random> paths return 404/405 not 500. Real flow tests deferred to 14.2 when middleware swap lands and we can mock the session table" },
      { title: "Build clean (server + web, 89.8 kB shared First Load JS unchanged). Local dev: BETTER_AUTH_SECRET / BETTER_AUTH_URL fall back sensibly; production needs explicit secrets via flyctl secrets set" },
    ],
  },
  {
    id: "phase-13-11",
    title: "Phase 13.11 · Backend separation cleanup — last legacy routers gone",
    subtitle:
      "Closes the Phase 13 migration. Four legacy flat routers deleted (1190 LOC of dead code), their last live endpoints (business-types + countries) replaced by a layered reference module, eight remaining public BFF routes converted to forwardToApi proxies. Every Express route now follows the same routes/controllers/services/models quartet — zero hand-rolled router files remain. Decision documented inline: SSR pages with direct Prisma reads (lib/server/queries.ts) STAY — server components doing direct DB reads is a valid Next pattern, doesn't violate the BFF concept since they never reach the browser anyway.",
    icon: Layers,
    tone: "success",
    shippedAt: "today",
    commitSha: "4954044",
    items: [
      { title: "NEW layered reference module: routes/reference.routes.ts → controllers/reference.controller.ts → services/reference.service.ts → models/reference.model.ts. Two endpoints (GET /business-types + GET /countries) — public reads driving the become-seller + register form dropdowns" },
      { title: "DELETED: apps/server/src/routes/catalog.ts (33 LOC) — last legacy flat router. Replaced by reference.routes.ts" },
      { title: "DELETED: apps/server/src/routes/seller.ts (370 LOC) — superseded by Phase 13.9.1 + 13.9.2 layered seller module" },
      { title: "DELETED: apps/server/src/routes/admin.ts (250 LOC) — superseded by Phase 13.10 layered admin module" },
      { title: "DELETED: apps/server/src/routes/stats.ts (20 LOC) — never mounted; admin/stats lived under admin.ts. Reference module covers no stats" },
      { title: "tsconfig.json exclusions dropped — `src/routes/{seller,admin,stats}.ts` removed from the exclude list now that the files don't exist. tsc compiles the entire src tree clean" },
      { title: "BFF: 8 public routes converted to forwardToApi (~10 LOC each) — /api/business-types, /api/countries, /api/categories, /api/tags, /api/products (browse, with query passthrough), /api/products/[id], /api/stores (with limit passthrough), /api/stores/[id]" },
      { title: "INTENTIONALLY KEPT (documented decision): apps/web/lib/server/queries.ts + every server component that imports @/lib/server/prisma directly (~17 files: product detail, store storefront, seller pages, admin audit, /health, sitemap, etc.). SSR direct-Prisma reads are a valid Next pattern — the BFF mixes some direct DB reads (for SSR) with HTTP API calls (for mutations + client-side data fetching). Migrating these to apiFetch would add an HTTP roundtrip to every page render with no architectural gain since SSR already runs server-side" },
      { title: "INTENTIONALLY DEFERRED: /api/products/by-ids, /api/products/featured, /api/stats, /api/profile/export, /api/health — these need NEW Express endpoints (don't exist yet). Tracked as future work; today they keep working via direct Prisma calls in their current Next route handlers" },
      { title: "Vitest 108 → 110 (2 new) — reference module GET /business-types + GET /countries happy paths" },
      { title: "Server build clean (entire src tree, no exclusions). Web build clean, shared First Load JS = 89.8 kB (unchanged). app.ts banner updated: 'Phase 13.11 — every resource is layered, no flat routers remain'" },
    ],
  },
  {
    id: "phase-13-10",
    title: "Phase 13.10 · Admin module migrated to Express",
    subtitle:
      "All 9 admin endpoints (users list/role/delete-or-ban, stores list/delete, KPI stats, transactions delete/refund, named reports) now live on the layered Express server. Single role gate at the router level (router.use(requireAuth(['admin']))) so every handler can assume admin context. With Phase 13.10 the entire /api/admin/** surface (8 BFF route files) is fully proxied. Combined with 13.7 (favorites/stock), 13.8 (messages), 13.9 (seller), Next now holds zero business logic for any feature module — only rendering + thin proxy forwarders.",
    icon: ShieldAlert,
    tone: "info",
    shippedAt: "today",
    commitSha: "400e95e",
    items: [
      { title: "Layered admin resource: routes/admin.routes.ts → controllers/admin.controller.ts → services/admin.service.ts → models/admin.model.ts. zod schemas for every input (userListQuerySchema, updateUserRoleSchema, deleteUserSchema, ReportName enum)" },
      { title: "GET /admin/users: zod-coerced page/pageSize, pagination meta in response, password STRIPPED from every row even if hashed (admin UI never needs it; accidental log-leak risk too real)" },
      { title: "PATCH /admin/users/:id (role change): captures previous role for the audit trail meta (so we can answer 'what changed?' not just 'what is it now?'). 400 SelfDemoteForbidden when admin tries to remove own admin role (would lock themselves out)" },
      { title: "DELETE /admin/users/:id: TWO behaviours by body — empty body = soft-delete only ('user.delete' audit), `{ reason: 'X' }` = full BAN (deletedAt + bannedAt + bannedReason all set + 'user.ban' audit). Reason capped to VARCHAR(120). Phase 12.2 self-vs-admin distinction preserved" },
      { title: "GET /admin/stores: filters deletedAt:null at the row level AND at the nested _count.products predicate so per-store product counts agree with /browse (Phase 11 / F1, F12, F14, F20 invariant)" },
      { title: "DELETE /admin/stores/:id: soft-delete + 'store.delete' audit" },
      { title: "GET /admin/stats: composite KPI (users/stores/products/reviews/orders + gmv coerced from $queryRaw text + pendingOrders + 30 recent transactions + 14-day daily revenue series). All Promise.all parallelised, daily SQL uses generate_series so empty days still appear in the sparkline" },
      { title: "DELETE /admin/transactions/:id: snapshot BEFORE delete so the audit row keeps amount + type. No deletedAt column on transactions — money records are either there or not" },
      { title: "POST /admin/transactions/:id/refund: $transaction = updateMany linked orders to status:refunded + transaction.create with refund type/same buyer/same amount. 400 NotPurchase if target isn't a purchase (refunding a refund makes no sense)" },
      { title: "GET /admin/reports/:name: five named raw-SQL queries (revenue-by-category, top-stores, orders-by-status, signups-per-day, coupon-usage). Service returns { sql, rows } so the admin page can render 'here's what we ran' for the demo viva" },
      { title: "Vitest 92 → 108 (16 new): 401 sweep + 403 buyer; users list password-strip + pagination; role-change 400 SelfDemote + happy with audit meta; user delete 400 SelfDelete + no-reason audit + with-reason ban audit; stores list deletedAt:null on both query AND _count predicate; store delete audit; stats composite (gmv text→number coercion); transaction delete snapshot audit; refund 400 NotPurchase + happy $transaction + audit; reports 404 UnknownReport + orders-by-status happy" },
      { title: "8 BFF routes converted to forwardToApi proxies (~12 LOC each). Combined with 13.9 + 13.8 + 13.7, Next no longer touches Prisma for any module endpoint — only the legacy /api/auth/sso passthrough + /api/health" },
    ],
  },
  {
    id: "phase-13-9-2",
    title: "Phase 13.9.2 · Seller dashboard writes migrated",
    subtitle:
      "Second half of the largest module migration. All 10 write-side seller endpoints (become-seller, store PATCH, product CRUD, duplicate, variant nudge, coupon create, order status flip, refund) now live on the layered Express server. Combined with Phase 13.9.1 the entire /api/seller/** surface (12 BFF routes) is fully proxied — Next no longer touches Prisma for any seller flow. become-seller is special: it's the one endpoint that needs auth but NOT requireStore (the user doesn't have one yet), mounted with a tier-1 middleware exception in the router.",
    icon: Store,
    tone: "info",
    shippedAt: "today",
    commitSha: "73a33ca",
    items: [
      { title: "POST /seller/become-seller: create store + promote buyer→seller (admin stays admin) in one $transaction. 409 StoreExists if the user already owns one. Mounted BEFORE router.use(requireStore) so the auth-only gate applies; everything below reuses the auth+store stack from 13.9.1" },
      { title: "PATCH /seller/store: partial update — controller only forwards keys the user sent (Prisma treats undefined as no-op). Sending {} returns ok:true noop:true without touching the DB" },
      { title: "POST /seller/products: full create with variants, images, tags. Reuses the existing productInputSchema from @metu/shared so the create form payload doesn't change" },
      { title: "PATCH /seller/products/:id: TWO paths kept — fast-path `{ isActive: boolean }` (single Prisma update, no transaction) for the pause toggle, full-edit path (transactional name/desc/category + delete-and-recreate images/tags + UPDATE-OR-CREATE variants — never deletes existing variants because OrderItem + CartItem FK into ProductItem)" },
      { title: "DELETE /seller/products/:id: soft-delete + AuditLog 'product.delete' with pre-delete name snapshot in meta. Order history + reviews + favourites stay valid" },
      { title: "POST /seller/products/:id/duplicate: clone variants + images + tags, skip reviews + sales history. Created PAUSED so seller can polish before exposing" },
      { title: "PATCH /seller/product-items/:id: targeted variant nudge (price/discountPercent/quantity). 404/403 ownership distinct so bulk-edit page tells stale rows apart from cross-store attempts" },
      { title: "GET + POST /seller/coupons: list (with usage count) + create. The GET was missed in Phase 13.9.1 (lives in the same file as POST); both ship together here" },
      { title: "PATCH /seller/orders/:id: fulfilled/cancelled. Guardrails — 403 Forbidden when no line from this store, 409 AlreadyRefunded, 409 InvalidTransition when fulfilling a non-paid order. Audit row written ('order.fulfilled' or 'order.cancelled')" },
      { title: "POST /seller/orders/:id/refund: $transaction = order.update {status:refunded} + transaction.create {refund + buyer + amount}. Audit row 'order.refund'. Refuses pending/cancelled/already-refunded with 409 InvalidTransition" },
      { title: "Vitest 73 → 92 (19 new): become-seller 401/409/400; store noop + partial-update keys check; product fast-path doesn't open a $transaction; product DELETE 404/403/audit-write; duplicate 404 + 'Copy of ' prefix + isActive:false; variant nudge 403 + only-sent-keys check; coupon create scoped to store; order PATCH 409 AlreadyRefunded + 409 InvalidTransition + happy 'order.fulfilled' audit; refund 403 + happy $transaction + 'order.refund' audit" },
      { title: "BFF: 9 remaining routes converted to forwardToApi proxies. Combined with 13.9.1, /api/seller/** is fully proxied (12 routes total) and Next holds no seller business logic" },
      { title: "Bonus: lib/server/proxy.ts updated in 13.9.1 to forward Content-Disposition + Cache-Control survives unchanged here — POST refund + PATCH endpoints don't need download headers but the change harms nothing" },
    ],
  },
  {
    id: "phase-13-9-1",
    title: "Phase 13.9.1 · Seller dashboard reads migrated",
    subtitle:
      "First half of the largest module migration. All six read-side seller endpoints (store, products list, single product, stats analytics, orders list with status filter, CSV export) now live on the layered Express server. New requireStore() middleware piggybacks on requireAuth() so every read endpoint has a single-line gate at the router level. Phase 13.9.2 follows with the write side (become-seller, store PATCH, product CRUD, duplicate, items DELETE, coupons, order status, refund) so review-ability stays high.",
    icon: Store,
    tone: "info",
    shippedAt: "today",
    commitSha: "0fc388f",
    items: [
      { title: "New middleware/seller.ts: requireStore() reads req.user.store (loaded by requireAuth's include) and returns 403 NoStore if the user hasn't onboarded. Mounted once at the router level via router.use(requireAuth(), requireStore()) — every read endpoint inherits both gates without per-route stacking" },
      { title: "Layered seller resource: routes/seller.routes.ts → controllers/seller.controller.ts → services/seller.service.ts → models/seller.model.ts. Service functions take storeId (not the request) so they're pure + unit-testable" },
      { title: "GET /seller/store: store with businessType + stats" },
      { title: "GET /seller/products: live products only (deletedAt:null) — soft-deleted rows stay out of the seller dashboard, admin /admin/audit can still see them via the audit log" },
      { title: "GET /seller/products/:id: 404 (NotFound) vs 403 (Forbidden — wrong store) deliberately distinct so the dashboard UI can tell stale links apart from bug attempts" },
      { title: "GET /seller/stats: composite analytics — kpi totals, product count, recent reviews, daily orders (30 days), top 5 products by revenue. Three $queryRaw aggregates kept serial because they hit overlapping indexes (Neon free-tier burst friendliness)" },
      { title: "GET /seller/orders?status=: scoped sub-includes — nested items only resolve to lines for THIS store so multi-store orders don't leak competitor product detail" },
      { title: "GET /seller/orders/export: CSV download. Express sets Content-Type + Content-Disposition; proxy.ts updated to forward both (and cache-control) so the file-download UX survives the BFF hop" },
      { title: "Vitest 63 → 73 (auth gates: 401 sweep across all 6 endpoints + 403 NoStore for buyer; store happy; products-list deletedAt:null assertion; product/:id 404, 403, happy; orders happy + status filter passthrough; orders/export CSV body + headers; stats composite payload)" },
      { title: "BFF: 6 routes converted to forwardToApi proxies. PATCH /api/seller/store, POST /api/seller/products, PATCH/DELETE /api/seller/products/:id stay local until Phase 13.9.2 migrates the write side — files are hybrid (proxy GET + local mutation) for one PR" },
    ],
  },
  {
    id: "phase-13-8",
    title: "Phase 13.8 · Messages migrated to Express",
    subtitle:
      "Buyer ↔ seller direct messaging now lives on the layered server. Three endpoints: GET /messages (inbox + thread fork via ?with=N, marks read on thread open), POST /messages (self-send rejected with 400), GET /messages/unread (cheap COUNT for the TopNav dot, polled client-side every few seconds — no realtime infra). Postgres-only path for now; the MongoDB sidecar pilot recommended by Lecture 11 stays a follow-up so we keep zero new infra dependencies + every existing test green.",
    icon: MessageSquare,
    tone: "info",
    shippedAt: "today",
    commitSha: "0cbfa72",
    items: [
      { title: "Layered messages resource: routes/messages.routes.ts → controllers/messages.controller.ts → services/messages.service.ts → models/messages.model.ts" },
      { title: "GET /messages: behaviour fork on the ?with query param. With it = thread between auth user + the partner, plus side-effect 'mark all the partner's messages to me as read'. Without it = inbox view (last message per partner + unread count, sorted by most-recent activity)" },
      { title: "Inbox grouping: pull recent slice (max 200 messages) and group in JS. Fine for the demo dataset; production-grade would push the GROUP BY into raw SQL with a window function" },
      { title: "POST /messages: re-uses the existing @metu/shared sendMessageSchema (zod). Self-send rejected at the controller (returns 400 SelfSend) before the service is called" },
      { title: "GET /messages/unread: single COUNT query, mounted BEFORE the wildcard so the literal /unread path always wins (Express matches by mount order)" },
      { title: "Vitest 54 → 63 (added: inbox 401 + happy grouping with unread, thread happy + verifies updateMany was called for marking-as-read, send 401 + 400 ValidationError + 400 SelfSend + happy create, unread 401 + happy count)" },
      { title: "Next /api/messages/route.ts + /api/messages/unread/route.ts converted to forwardToApi proxies. The inbox route preserves the inbound query string (req.nextUrl.search) so ?with=N still routes correctly to Express" },
      { title: "Service file deliberately small + side-effect-free except for getThread's read marker. A future MongoDB sidecar (the Lecture 11 polyglot pilot) would swap services/messages.service.ts only — controllers, routes, models, and DTOs stay identical, network contract unchanged" },
    ],
  },
  {
    id: "phase-13-7",
    title: "Phase 13.7 · Favorites + Stock alerts migrated",
    subtitle:
      "Two thin join-table resources move to the Express layered server. Both endpoints idempotent via the existing @@unique constraints — re-hearting and re-subscribing are no-ops, and re-subscribing also clears notifiedAt so a buyer can re-arm an alert after they've already been notified once. Recently-viewed stays client-side (localStorage helper in lib/recentlyViewed.ts) — no schema or backend touch needed for that yet.",
    icon: Star,
    tone: "info",
    shippedAt: "today",
    commitSha: "bc5709c",
    items: [
      { title: "Layered favorites resource: routes/favorites.routes.ts → controllers/favorites.controller.ts → services/favorites.service.ts → models/favorites.model.ts" },
      { title: "GET /favorites: auth-only, returns { productIds: number[] } so client components can pre-fill heart icons without hydrating full products" },
      { title: "POST /favorites/:productId: idempotent upsert via the (userId, productId) unique. 404 for soft-deleted/orphan products (same hygiene as reviews + Q&A)" },
      { title: "DELETE /favorites/:productId: silent no-op via deleteMany — re-clicking the heart never errors" },
      { title: "Layered stock-alerts resource: same 4-file shape. POST /stock-alerts/:productItemId subscribes (404 on orphan variant), upsert sets notifiedAt back to null on update so re-subscribers get pinged again next restock. DELETE unsubscribes" },
      { title: "Vitest 42 → 54 (added favorites: 401 list, happy list, 401 add, 404 add, happy add, 401 delete, happy delete; stock-alerts: 401 sub, 404 sub, happy re-arm, 401 unsub, happy unsub)" },
      { title: "Next /api/favorites/route.ts + /api/favorites/[productId]/route.ts + /api/stock-alerts/[productItemId]/route.ts converted to forwardToApi proxies (~12 lines each)" },
    ],
  },
  {
    id: "phase-13-6-5",
    title: "Phase 13.6.5 · CPE241 rubric retrofit (Lecture 10)",
    subtitle:
      "Plugs the four classical RDBMS topics from Lecture 10 (Triggers, Views, Permissions, Check Constraints) that the codebase had zero coverage for. One additive SQL migration — no API change, no test churn, all 42 server tests stay green. Demo viva can now answer 'where do you do X?' for every Lecture 10 slide in one sentence (see docs/rubric-coverage.md).",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "1bdc9bf",
    items: [
      { title: "Trigger 1 — touch_updated_at: BEFORE UPDATE on product, auto-maintains the new product.updated_at column at the database level. Schema annotation explicitly notes the trigger owns the column (no Prisma @updatedAt — the trigger is the only writer)" },
      { title: "Trigger 2 — review_delete_audit: AFTER DELETE on product_review, writes a fallback 'review.delete.trigger' row to audit_log. Two-layer audit — app writes the rich row (with actor + before-snapshot), trigger writes the safety net only when a manual SQL DELETE bypasses the API" },
      { title: "View 1 — live_stores_view: reifies the soft-delete predicate (deleted_at IS NULL) so analytics consumers don't have to remember it. Single source of truth for 'public stores'" },
      { title: "View 2 — product_with_avg_rating_view: denormalised JOIN+AGGREGATE so 'WHERE avg_rating > 4' becomes one clause. Solves the Phase 11 bug #1 minRating problem at the database layer" },
      { title: "Permissions — three-role separation: existing 'metu' (Neon admin, migrations only), new 'metu_app' (runtime SELECT/INSERT/UPDATE/DELETE on app tables), new 'metu_analytics' (read-only + explicitly DENIED audit_log so reporting can't see who did what). Both new roles created NOLOGIN — migration carries no secret; runbook in docs/rubric-coverage.md covers post-migration password rotation" },
      { title: "Check constraints — defence-in-depth bounds: product.name non-empty, product_item.price ≥ 0, product_item.quantity ≥ 0, product_item.discount_percent in 0–100, product_review.rating in 1–5, order_item.quantity > 0. Database refuses garbage even if zod is bypassed" },
      { title: "New file: docs/rubric-coverage.md — one-page matrix mapping every Lecture 9 + 10 topic to file:line. Designed for the demo viva: examiner asks 'where do you do triggers?', you read the row" },
      { title: "schema.prisma: adds Product.updatedAt (DateTime, @default(now()), no @updatedAt — owned by the touch_updated_at trigger). Triggers + views + roles + check constraints all live in the migration SQL only (Prisma-invisible, doesn't introspect them — that's fine)" },
    ],
  },
  {
    id: "phase-13-6",
    title: "Phase 13.6 · Q&A + admin moderation migrated",
    subtitle:
      "Public list / ask / edit / delete / answer all live as a layered Express resource. Field-level permission gates: question body (admin OR asker), answer field via PATCH (admin only — sellers must use the dedicated /answer endpoint so answeredAt + answererId stamp correctly), answer endpoint (product's seller OR admin).",
    icon: HelpCircle,
    tone: "info",
    shippedAt: "today",
    commitSha: "80f60ba",
    items: [
      { title: "Layered q&a resource: routes/qna.routes.ts (TWO routers — productQuestionsRouter for /products/:productId/questions, default for /questions/:id family) → controllers/qna.controller.ts → services/qna.service.ts → models/qna.model.ts" },
      { title: "GET /products/:productId/questions: PUBLIC (no auth). Includes answerer.stats.role so the UI can render 'Admin answered' vs 'Seller answered' without a follow-up call (Phase 10 / F23)" },
      { title: "POST /products/:productId/questions: 404 for soft-deleted/orphan products" },
      { title: "PATCH /questions/:id: field-level gate — admin OR asker for body, admin-only for answer (sellers must use /answer to stamp answeredAt + answererId)" },
      { title: "PATCH /questions/:id/answer: only the product's seller (verified via auth-loaded req.user.store.storeId) OR admin may answer. Stamps answer + answeredAt + answererId together" },
      { title: "DELETE /questions/:id: admin OR asker. Admin deletes write 'question.delete' AuditLog with full snapshot. Admin edits write 'question.edit' with before/after" },
      { title: "@metu/shared: new questionAskSchema + questionEditSchema + questionAnswerSchema (in new packages/shared/src/schemas/qna.ts)" },
      { title: "Vitest 34 → 42 (added public list + 401 + 404 + non-admin/non-asker 403 + non-admin-cant-edit-answer 403 + non-seller cant answer + admin can answer ANY + admin delete writes audit)" },
      { title: "Next /api/products/[id]/questions/route.ts + /api/questions/[id]/route.ts + /api/questions/[id]/answer/route.ts converted to forwardToApi proxies" },
    ],
  },
  {
    id: "phase-13-5",
    title: "Phase 13.5 · Reviews + admin moderation migrated",
    subtitle:
      "Create / edit / delete reviews now live as a layered Express resource. Admin-OR-author gate enforced server-side; admin moderation actions write AuditLog rows with before/after snapshots so the moderation paper trail survives even after a hard delete.",
    icon: Star,
    tone: "info",
    shippedAt: "today",
    commitSha: "9fba3a1",
    items: [
      { title: "Layered reviews resource: routes/reviews.routes.ts (TWO routers — POST nested at /products/:productId/reviews via mergeParams, PATCH/DELETE at /reviews/:id) → controllers/reviews.controller.ts → services/reviews.service.ts → models/reviews.model.ts" },
      { title: "POST /products/:productId/reviews: 404 for soft-deleted / orphan products (store removed). Author + product info included in the response so the moderation UI doesn't need a refetch" },
      { title: "PATCH /reviews/:id + DELETE /reviews/:id: admin OR author can act. Sellers explicitly CANNOT edit reviews on their own products (would be obvious manipulation)" },
      { title: "Audit trail: when admin reaches into someone else's review, services/reviews.service.ts writes 'review.edit' with before/after snapshot OR 'review.delete' with the full row snapshot in meta. Self-edits / self-deletes are NOT audited (not moderation events)" },
      { title: "@metu/shared: new reviewEditSchema (rating + comment both optional; controller rejects 400 when both are undefined — no-op edits aren't useful)" },
      { title: "Vitest 29 → 34 (added 401 + 404 + happy create + 403 non-admin/non-author + admin-delete-writes-audit)" },
      { title: "Next /api/products/[id]/reviews/route.ts + /api/reviews/[id]/route.ts converted to forwardToApi proxies (~12 lines each)" },
    ],
  },
  {
    id: "phase-13-4",
    title: "Phase 13.4 · Orders + checkout migrated to Express",
    subtitle:
      "POST /orders (checkout — pulls cart + coupon + transaction together in one Prisma transaction), GET /orders (history), GET /orders/:id (receipt). Ownership gate via cart.userId join — another user's orderId returns 404, not 403, so we don't leak existence.",
    icon: Receipt,
    tone: "info",
    shippedAt: "today",
    commitSha: "3f63d88",
    items: [
      { title: "Layered orders resource: routes/orders.routes.ts → controllers/orders.controller.ts → services/orders.service.ts → models/orders.model.ts. requireAuth() at the router level — every endpoint authed" },
      { title: "Checkout: 7-step single Prisma transaction — resolve active cart + selected vs unselected lines (partial checkout) → resolve coupon (active + within date window) → Decimal arithmetic for unit price + subtotal + coupon-eligible subtotal (only lines from coupon's store count) → create transaction + order + order_items (couponId stamped only on eligible lines) → flip cart to checked_out + create fresh active cart → re-parent unselected items → record CouponUsage" },
      { title: "Discount cap: coupon discount can never exceed the eligible subtotal (e.g. ฿1000 off ฿200 → capped at ฿200)" },
      { title: "Vitest 25 → 29 (added orders 401, EmptyCart 400, list happy, ownership 404)" },
      { title: "Next /api/orders/route.ts + /api/orders/[id]/route.ts converted to forwardToApi proxies. POST /api/orders still calls revalidatePath('/', '/health', '/admin') BFF-side after a 2xx so the public KPI tiles bump immediately (Express has no notion of Next's data cache)" },
      { title: "Legacy apps/server/src/routes/orders.ts deleted. tsconfig exclusions narrowed to seller/admin/stats only — Phase 13.5+ picks them up" },
    ],
  },
  {
    id: "phase-13-2-1",
    title: "Phase 13.2.1 · forgot/reset password migrated",
    subtitle:
      "Closes the Phase 13.2 deferral — the auth module is complete on the layered server. Tokens hashed with SHA-256 before storage, 30-min TTL, no email enumeration on /forgot-password, single failure code (InvalidToken) on /reset-password so attackers can't tell consumed/expired/missing apart.",
    icon: Mail,
    tone: "info",
    shippedAt: "today",
    commitSha: "accf4bd",
    items: [
      { title: "POST /auth/forgot-password — silent no-op for unknown / soft-deleted emails. Always returns the same generic message so an attacker can't probe whether an account exists" },
      { title: "POST /auth/reset-password — 3-statement transaction marks the consumed token + invalidates other outstanding tokens for the same user (so an attacker who grabbed a separate fresh token can't use it after the password rotates)" },
      { title: "utils/email.ts ported from BFF — console provider by default, Resend when RESEND_API_KEY set, falls back to console on Resend failure" },
      { title: "utils/audit.ts ported — fire-and-forget AuditLog row writes 'auth.password_reset' on a successful reset" },
      { title: "@metu/shared schemas: forgotPasswordSchema, resetPasswordSchema (token min 20 max 200 + newPassword)" },
      { title: "Vitest 23 → 25 (added forgot-password no-enum-leak + reset-password InvalidToken)" },
      { title: "Next /api/auth/forgot-password + /api/auth/reset-password converted to forwardToApi proxies" },
    ],
  },
  {
    id: "phase-13-3",
    title: "Phase 13.3 · Cart + coupons migrated to Express",
    subtitle:
      "GET /cart, POST/PATCH/DELETE /cart/items, and POST /coupons/validate now live as layered Express resources on metu-api. Cart line shape preserved (cartId + items[] with stock + computed unit price + lineTotal + subtotal). The Next /api/cart/** + /api/coupons/validate routes are now thin forwardToApi proxies.",
    icon: ShoppingCart,
    tone: "info",
    shippedAt: "today",
    commitSha: "95b0194",
    items: [
      { title: "Layered cart resource: routes/cart.routes.ts → controllers/cart.controller.ts → services/cart.service.ts → models/cart.model.ts. requireAuth() applied at the router level (every endpoint authed)" },
      { title: "GET /cart returns the same envelope as the legacy BFF: cartId + items[] (with stock snapshot for input-cap UX) + subtotal" },
      { title: "POST /cart/items merges quantity on duplicate productItemId (no row duplication, single row + bumped qty)" },
      { title: "PATCH/DELETE /cart/items/:id enforce ownership server-side — return 404 (not 403) when the item belongs to a different user, so we don't leak whether the id exists" },
      { title: "Layered coupons resource: POST /coupons/validate. Always 200 with { valid, reason? } so the cart UI surfaces the rejection reason inline (not-found / not-active / expired / limit-reached)" },
      { title: "Vitest 16 → 23 (added cart get + cart merge + cart ownership-404 + coupon validate happy / missing / limit-reached)" },
      { title: "Next /api/cart/route.ts, /api/cart/items/route.ts, /api/cart/items/[id]/route.ts, /api/coupons/validate/route.ts converted to ~12-line forwarders via lib/server/proxy.ts" },
      { title: "Legacy apps/server/src/routes/cart.ts + coupons.ts deleted. tsconfig exclusions narrowed — orders/seller/admin/stats are the remaining legacy flat routes (Phase 13.4+)" },
    ],
  },
  {
    id: "phase-13-2",
    title: "Phase 13.2 · Auth migrated to Express + cookie boundary",
    subtitle:
      "Login / register / me / logout / change-password now live as a layered Express resource on metu-api. Express owns the JWT cookie; the Next /api/auth/* routes became thin proxies that forward Set-Cookie back to the browser so the cookie scopes correctly to metu.fly.dev. getMe() in server components delegates to GET /auth/me on the API.",
    icon: KeyRound,
    tone: "info",
    shippedAt: "today",
    commitSha: "0942fcd",
    items: [
      { title: "Layered auth resource: routes/auth.routes.ts → controllers/auth.controller.ts → services/auth.service.ts → models/auth.model.ts (re-exports zod from @metu/shared)" },
      { title: "Endpoints live: POST /auth/login, POST /auth/register, POST /auth/logout, GET /auth/me, PATCH /auth/me, POST /auth/change-password" },
      { title: "middleware/auth.ts rewritten to throw AppError (was returning 401 directly). Server-side helpers preserved: issueToken / clearToken / readToken / requireAuth(roles) / softAuth() / currentUser / currentAuth" },
      { title: "Profanity guard + Turnstile verify ported to apps/server/src/utils — same dictionary as Phase 11/F3, no-op when TURNSTILE_SECRET unset" },
      { title: "Next /api/auth/{login,register,logout,me,change-password} converted to thin forwarders via lib/server/proxy.ts. Set-Cookie passed through using Headers#getSetCookie() so the browser scopes the cookie to metu.fly.dev (not metu-api)" },
      { title: "lib/session.ts getMe() now calls /auth/me on Express via apiFetch (cookie forwarded server-side). Return shape preserved 1:1 — every page that gates on me?.role works unchanged" },
      { title: "Vitest: 5 new auth tests (login happy, login wrong-password, login unknown-email, register dupe-email 409, register profanity 400, /me 401). Server suite 9 → 15 tests" },
      { title: "Deferred to Phase 13.2.1: forgot-password + reset-password (need a tiny email/token module of their own)" },
    ],
  },
  {
    id: "phase-13-1",
    title: "Phase 13.1 · Backend separation — Express API + Next BFF",
    subtitle:
      "Splits the monolith into two Fly apps: metu (Next.js BFF, owns UI + SSR) and metu-api (Express, owns Prisma + routes/controllers/services). Catalog (products, stores, categories, tags, health) is the first vertical slice. Auth, cart, orders, etc. follow in 13.2+.",
    icon: Layers,
    tone: "info",
    shippedAt: "today",
    commitSha: "22b79ba",
    items: [
      { title: "New @metu/server workspace at apps/server with the routes/controllers/services/models/middleware/db/utils layout. One file per resource per layer (products.routes.ts → products.controller.ts → products.service.ts → products.model.ts)" },
      { title: "5 layered resources live: GET /health, GET /products[?…], GET /products/:id, GET /products/featured, GET /stores[?limit=N], GET /stores/:id, GET /categories, GET /tags" },
      { title: "Vitest 14/14 across both workspaces (5 server + 9 web). Server tests mock Prisma + drive supertest(buildApp())" },
      { title: "Next BFF rewired: lib/server/api.ts wraps fetch + cookie forwarding; lib/server/queries.ts catalog functions delegate via apiFetch(). 5 of 6 catalog reads migrated; getProduct stays direct-Prisma until Reviews module ports the soft-delete-cascade selector" },
      { title: "Deploy: apps/server/Dockerfile (multi-stage Node 20) + fly.server.toml. New Fly app metu-api in sin region. release_command runs prisma migrate deploy on every release" },
      { title: "BFF picks API base from INTERNAL_API_URL env (https://metu-api.fly.dev in prod, http://localhost:4000 locally via concurrently)" },
      { title: "Live verified: /, /browse, /browse?sort=price_asc, /browse?category=fonts, /store/18 all served by Next + delegate to metu-api (visible in Fly logs as GET /products?…, /stores/18, /categories, /tags)" },
      { title: "apps/server/README.md documents the why + the 5-step add-an-endpoint template for the next migration" },
    ],
  },
  {
    id: "qa-r3-f1",
    title: "QA round #3 / F1 — silent React hydration errors fixed",
    subtitle:
      "Round #3 of the Phase 11 QA workflow opened DevTools on every persona route and found two minified React errors (#418 + #422) firing on /, /browse, /cart. The pages rendered correctly to users but React was falling back to client-rendering the affected boundaries. Root-caused to Next 14 App Router's documented multi-`<Image priority>` hydration bug — narrowed every route to ≤1 priority image.",
    icon: AlertTriangle,
    tone: "warning",
    shippedAt: "today",
    commitSha: "907ee5b",
    items: [
      { title: "QA round #3: HTTP sweep (23/23 routes correct), Phase 11.2 ฿45.6K compact format verified, F19 mobile sheet trigger DOM verified, Phase 12.2.1 ban metadata re-verified via SSH+Prisma. Report: reports/qa-2026-04-26-r3.md" },
      { title: "F1 root cause: Next 14 fires React #418 + #422 when ≥2 <Image priority fill> render on the same route. The multiple <link rel=\"preload\"> injections post-render don't match the SSR snapshot" },
      { title: "/cart line thumbnails: priority → loading=\"lazy\" (small N at 80×80, no LCP impact)" },
      { title: "/browse first-row tiles: priority={i<4} → priority={i===0} (only the LCP card preloads; the next 3 drop to lazy and arrive a tick later, invisible on 4G/wifi)" },
      { title: "/ trending grid: dropped priority={i<2} entirely. The feature card auto-promotes via ProductCard's eagerLoad logic, so the LCP element stays priority — the grid below drops to lazy" },
      { title: "Defensive: also added suppressHydrationWarning to <html> in app/layout.tsx (themeBootstrapScript modifies className pre-hydration; standard next-themes pattern even though not the actual culprit here)" },
      { title: "Verified post-fix: /, /browse, /browse?sort=price_asc, /browse?category=fonts&minRating=4, /cart all log 0 console errors. Vitest 37/37, build clean (89.8 kB shared)" },
    ],
  },
  {
    id: "phase-12-2",
    title: "Phase 12.2 · User ban metadata",
    subtitle:
      "Schema-level distinction between 'user self-deleted' and 'admin removed for cause'. Today the AuditLog already records the reason in meta JSON, but it's not queryable as a first-class field on User and the moderation UI couldn't see it on the row. Now banned users wear a coral 'Banned' badge with the reason underneath.",
    icon: ShieldAlert,
    tone: "danger",
    shippedAt: "today",
    commitSha: "b787f66",
    items: [
      { title: "New migration: 20260426040000_phase_12_2_user_ban_metadata — adds banned_at + banned_reason columns + index, fully additive (no backfill, all existing rows stay NULL)" },
      { title: "DELETE /api/admin/users/[id] accepts optional { reason } body. With reason → bannedAt + bannedReason populated, audit becomes 'user.ban' + meta. Without reason → unchanged behaviour (deletedAt only, audit stays 'user.delete')" },
      { title: "UserRowActions: 'Delete user' → 'Remove user'. Opens a ConfirmDialog with a 120-char textarea for the reason. Confirm button label flips between 'Remove user' (no reason) and 'Ban user' (reason typed)" },
      { title: "/admin/users rows: banned users get a coral Badge + reason text underneath; soft-deleted-only users get a mist 'Deleted' badge. Hover any badge for full reason" },
      { title: "Convention: bannedAt SET ⇒ admin removal for cause; bannedAt NULL + deletedAt SET ⇒ user self-deleted (or pre-12.2 removal)" },
      { title: "Closes S8's 'User moderation fields (bannedAt / bannedReason)' proposal from Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-f19",
    title: "Phase 11 · F19 — /browse mobile bottom-sheet",
    subtitle:
      "Three layout improvements that the run #2 ux-polish specialist deferred as 'needs real layout work, not a polish pass'. Mobile gets a slide-up filter sheet with active-count badge; sidebar filter toggles preserve scroll position; sticky sidebar caps to viewport height.",
    icon: Filter,
    tone: "info",
    shippedAt: "today",
    commitSha: "aba77ed",
    items: [
      { title: "Mobile gets a 'Filters (N)' pill instead of stacking 4 filter cards above the product grid — opens a slide-up bottom-sheet (max 85vh, ESC + backdrop close, body scroll locked)" },
      { title: "Active-filter count badge on the trigger pill (computed server-side from search params: category + each tag + minRating + delivery)" },
      { title: "Every filter <a> converted to <Link scroll={false}> — toggling a tag/rating no longer slams the user back to the top of the grid" },
      { title: "Sticky sidebar gets max-h:calc(100vh-7rem) + overflow-y-auto so a long tag list doesn't run off-screen on shorter laptops" },
      { title: "Pagination intentionally KEEPS scroll-to-top — moving to a new page should land at the top of the new grid" },
      { title: "New sheet-rise keyframe (220ms platform-feeling cubic-bezier) added to globals.css" },
    ],
  },
  {
    id: "phase-11-2",
    title: "Phase 11.2 · moneyCompact() for KPI revenue cards",
    subtitle:
      "Phase 11.1 capped overflow with truncate but the result still ellipsed mid-number ('฿45,6…'). User asked for K/M abbreviations + smaller font. Now Total revenue / GMV / Lifetime revenue render as '฿45.6K' / '฿1.2M' and stay readable on every viewport.",
    icon: Wallet,
    tone: "warning",
    shippedAt: "today",
    commitSha: "b873994",
    items: [
      { title: "New moneyCompact() helper in lib/format.ts — below ฿1,000 falls through to money(); above uses en-US compact notation (฿45.6K, ฿1.2M, ฿1.5B)" },
      { title: "StatCard gains an optional valueTooltip prop — when value has been compacted, callers pass the precise figure so hover surfaces the exact amount" },
      { title: "StatCard highlight ramp dropped one notch (text-2xl→xl, sm:text-3xl→2xl, md:text-4xl→3xl, xl:text-5xl→4xl) — default + zero variants unchanged" },
      { title: "Wired into /seller (Total revenue), /admin (GMV paid), /seller/analytics (Revenue lifetime)" },
    ],
  },
  {
    id: "phase-12-1",
    title: "Phase 12.1 · Store live-rows partial index",
    subtitle:
      "Schema-only ship. Adds a Postgres partial index on store(created_at DESC) WHERE deleted_at IS NULL — covers every admin / public query that filters by the soft-delete flag (introduced by Phase 11 run #2 fixes F1, F12, F14). Free query-plan upgrade for /admin/stores, /admin/reports leaderboards, /, /health, public store browse. No app code change; Postgres planner picks the partial index automatically.",
    icon: Database,
    tone: "info",
    shippedAt: "today",
    commitSha: "912fc08",
    items: [
      { title: "New migration: 20260426030000_phase_12_1_store_live_partial_index" },
      { title: "CREATE INDEX store_live_idx ON store(created_at DESC) WHERE deleted_at IS NULL" },
      { title: "Existing store_deleted_at_idx preserved for moderation views that need to enumerate soft-deleted rows" },
      { title: "Skipped CONCURRENTLY (Prisma migrations run in a transaction); at current scale (~8 stores) the index builds instantly" },
      { title: "Cost: ~16 KB index storage at current scale, scales linearly with live store count. O(log n) vs O(n) on the live-stores filter" },
      { title: "Closes S8's 'Store index for KPI / soft-delete queries' proposal from Phase 11 run #2" },
    ],
  },
  {
    id: "phase-11-1",
    title: "Phase 11.1 · Post-deploy hotfixes",
    subtitle:
      "Two visual regressions caught after Phase 11 run #2 shipped — both CSS-only, single commit. /browse stopped overflowing the viewport on wide desktops; /seller's Total revenue StatCard stopped clipping when the number got large. Shared First Load JS unchanged (89.8 kB).",
    icon: Bug,
    tone: "warning",
    shippedAt: "today",
    commitSha: "362853d",
    items: [
      { title: "/browse parent grid: 1fr → minmax(0,1fr) so the column honours the viewport (the inner auto-fill product grid was pushing the layout past the right edge)" },
      { title: "StatCard highlight: shrink ramp text-3xl/text-5xl → text-2xl/sm:text-3xl/md:text-4xl/xl:text-5xl + tabular-nums for digit alignment" },
      { title: "StatCard value div: add min-w-0 + truncate + title attr so oversized baht values ellipse inside the card instead of pushing the layout sideways" },
      { title: "Bonus: also dropped the routable /not-found page so the URL falls through to the framework 404 (status code now matches the screen)" },
    ],
  },
  {
    id: "phase-11-run-2",
    title: "Phase 11 · QA workflow run #2",
    subtitle:
      "Second end-to-end QA pass. 22 findings ingested from a fresh live walk (0 P0 / 0 regressions / 17 NEW · 5 carry-over). 20 closed in one session, 1 deferred (user-53 prod soft-delete needs admin shell), 1 deferred (F19 layout restructure out-of-scope). 5 commits, no schema migration.",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "bbf7fdf",
    items: [
      { title: "F1 + F12 + F14 — Surgical deletedAt:null predicate on every admin query that surfaces stores/products (admin/stores, reports, stats, /health). Counts now agree across pages." },
      { title: "F2 — POST /api/orders revalidates / and /health so the homepage trending counts refresh without a manual reload" },
      { title: "F3 — leo-profanity guard wired into POST /api/auth/register + PATCH /api/auth/me (server-only, ~25 kB, zero client bundle impact)" },
      { title: "F4 + F10 — Image priority hints on first 4 /browse cards, first 2 trending cards, and cart line thumbnails — kills the placeholder flash above the fold" },
      { title: "F5 — ImageGallery thumbnail onError fallback (broken thumb URLs swap to placeholder instead of 0×0 gap)" },
      { title: "F6 — Multi-role badges in AuthMenu + /profile (mist Buyer + mint Seller when hasStore=true OR role=seller, yellow Admin override)" },
      { title: "F7 + F16 — DollarSign → Banknote on every baht StatCard ('USD' read by Thai users); equalize home stats grid columns" },
      { title: "F8 — New CartNavIcon (60s poll + cart:update window event) wired into TopNav + dispatched from PDP / cart mutations" },
      { title: "F9 — Coupon hint i18n: placeholder 'e.g. METU10' + 'not found' error now route through useI18n (10 EN + 10 TH new keys total)" },
      { title: "F11 — Sort dropdown's redundant Apply button removed (run #1 wired auto-submit; this rips out the leftover button)" },
      { title: "F13 — /admin/stores skeleton flash gone: getAdminStores helper replaces same-host HTTP hop with a direct Prisma call" },
      { title: "F15 — New <Avatar> primitive (xs/sm/md/lg/xl) with deterministic HSL hue + AA-contrast initials, wired into AuthMenu / admin users / messages / profile" },
      { title: "F17 — /admin/changelog header + TL;DR derive counts from BATCHES.shippedAt='today' (was the entire log) — singular/plural inline" },
      { title: "F18 — UK 'favourites' → US 'favorites' across every user-visible string (full i18n family added; nav.favorites EN value flipped)" },
      { title: "F21 — /not-found now emits HTTP 404 (was 200 OK) via app/not-found/page.tsx → notFound()" },
      { title: "F22 — Seller OrderStatusActions z-index + stopPropagation: Refund / Mark-fulfilled / Cancel buttons no longer get swallowed by the row click handler" },
      { title: "11 new Vitest tests for getInitials + avatarHue (26 → 37) · build clean (89.8 kB shared First Load JS, unchanged)" },
    ],
  },
  {
    id: "phase-11",
    title: "Phase 11 · QA workflow run #1",
    subtitle:
      "First end-to-end run of the user-tester → CEO → 8-specialist QA workflow. 28 findings ingested from a live walk; 27 closed in one session, 1 escalated + resolved (F22 sort/apply). 8 commits, no schema migration.",
    icon: FlaskConical,
    tone: "success",
    shippedAt: "yesterday",
    commitSha: "d8825f5",
    items: [
      { title: "F1 — Soft-deleted offensive review on /product/100 (user 53 + cascade fix on getProduct reviews include)" },
      { title: "F2 — /admin/audit empty-state copy + verified the audit pipeline writes (1 → 6 rows from this run alone)" },
      { title: "F3 — /browse?category=<slug> now resolves slugs (was Number() → NaN → silent drop)" },
      { title: "F5 — Light-theme hero contrast: DIGITAL went from ~1.5:1 to ~17:1 via bg-hero-radial light override" },
      { title: "F6/F14/F23 — Junk-store cleanup (4 stores soft-deleted via admin API; KPIs auto-corrected)" },
      { title: "F8 — admin/stores + admin/users got their own loading.tsx skeletons" },
      { title: "F10 — Counter unify: home / health / admin all read Store.count (CEO Decision · Option A)" },
      { title: "F19 — New <ConfirmDialog> primitive (forms/) replaces window.confirm in 6 callsites; full ARIA contract" },
      { title: "F22 — Sort dropdown auto-submits via SortSelect (CEO Decision · Option A)" },
      { title: "F28 — /profile/edit skeleton-flash killed: route-scoped loading.tsx + cached getCountries" },
      { title: "Plus 6 ux-polish + 4 design-cohesion + 4 content-copy + 2 i18n + 1 a11y findings (full list in qa-2026-04-25.md)" },
    ],
  },
  {
    id: "phase-10",
    title: "Phase 10 · Authoring + messaging follow-ups",
    subtitle:
      "Q&A label bug + admin moderation + dashboard rebrand (every form a seller touches) + admin tables + messaging discoverability for buyers. Ten commits, no schema migration.",
    icon: MessageSquare,
    tone: "info",
    shippedAt: "yesterday",
    commitSha: "55d6aa5",
    items: [
      { title: "Q&A admin replies now show 'Admin answered' (was hard-coded 'Seller answered')" },
      { title: "Admin can edit/delete reviews + Q&A from product pages — coral 'MOD' pip + audit log" },
      { title: "Authoring primitives: FormSection, TextInput / Textarea / Select / NumberInput / PriceInput, VariantRow, PreviewPane, DataTable, ActionRow" },
      { title: "Seller forms rebuilt: NewProduct + EditProduct + EditStore + NewCoupon + BecomeSeller — multi-section layouts, sticky live preview" },
      { title: "Cramped 4-col variant grid → semantic VariantRow (delivery method label above qty/price/discount, not inside it)" },
      { title: "Admin tables: /admin/users + /stores + /reports + /audit consume DataTable + ActionRow with mint/coral tones" },
      { title: "Sidebar tokens unified (brand-yellow → metu-yellow); SellerSidebar unread dot switched amber → mint" },
      { title: "Buyer messaging is finally discoverable: chat icon + unread badge in TopNav, /messages buyer inbox, 'Messages' in AuthMenu" },
      { title: "'Message store' on /store/[id], 'Ask the seller' on /product/[id], 'Message seller about this order' on /orders/[id]" },
      { title: "FileImageInput compact thumbnail (was a giant aspect-5/2 box) — fixes 'ช่องใส่รูปใหญ่ไป' on /seller/products/new" },
    ],
  },
  {
    id: "batch-0",
    title: "Batch 0 · Perf regression hunt",
    subtitle:
      "Killed the cold-start lag the team noticed mid-presentation: keep-warm cron, parallel server fetches, reused Prisma client, dedicated pooled vs unpooled DB URLs.",
    icon: Zap,
    tone: "yellow",
    shippedAt: "04:55",
    commitSha: "fa8f6a7",
    items: [
      { title: "Vercel cron pings /api/health every 4 min — keeps Neon serverless compute warm" },
      { title: "Parallelised /product/[id] data fetches — saved one serial DB roundtrip" },
      { title: "Pinned Prisma client to globalThis on every env (was dev-only)" },
      { title: "Split DATABASE_URL (pooled, runtime) from DATABASE_URL_UNPOOLED (migrate deploy)" },
      { title: "Trimmed backdrop-blur radii + shadow blurs to fix scroll stutter" },
    ],
  },
  {
    id: "batch-a",
    title: "Batch A · Quick wins",
    subtitle:
      "Seven small UX delights that needed no schema changes — the kind of polish reviewers notice immediately.",
    icon: Sparkles,
    tone: "info",
    shippedAt: "08:54",
    commitSha: "e89f01d",
    items: [
      { title: "Recently-viewed products strip on /browse (localStorage, capped at 12)" },
      { title: "Share button on product + store (Web Share API w/ clipboard fallback)" },
      { title: "“X bought this in the last week” social-proof line on product detail" },
      { title: "Keyboard shortcuts: /, g b, g c, g f, ? — with a built-in cheatsheet dialog" },
      { title: "/profile/edit page with avatar, name, email, country, DOB, gender" },
      { title: "Change-password flow with current-password verify + bcrypt hash" },
      { title: "“Save for later” — moves a cart line into favorites in one click" },
    ],
  },
  {
    id: "batch-b",
    title: "Batch B · Seller tools",
    subtitle:
      "Sellers told us the dashboard felt thin. Seven tools to actually run a store — including the seller↔buyer inbox.",
    icon: Store,
    tone: "yellow",
    shippedAt: "09:42",
    commitSha: "4035c9e",
    items: [
      { title: "Duplicate product (one-click clone, paused by default for editing)" },
      { title: "Pause / resume product toggle — Product.isActive column + browse filter" },
      { title: "Seller ↔ buyer inbox at /seller/messages and /messages/[userId] (Message table)" },
      { title: "Coupon performance report at /seller/coupons/[id]/report" },
      { title: "Download sales CSV — /api/seller/orders/export.csv streams a file" },
      { title: "Low-stock banner on the seller dashboard for any variant ≤ 5" },
      { title: "Bulk-edit prices at /seller/products/bulk (apply ±N% to selected rows)" },
    ],
  },
  {
    id: "batch-c",
    title: "Batch C · Buyer growth",
    subtitle:
      "Seven features aimed at conversion + return visits — Q&A, free samples, related products, comparisons, gift checkout, rating filter, restock alerts.",
    icon: ShoppingBag,
    tone: "success",
    shippedAt: "11:19",
    commitSha: "570bb58",
    items: [
      { title: "Product Q&A — buyers ask, seller answers inline (ProductQuestion table)" },
      { title: "Free sample download per variant (sampleUrl on ProductItem)" },
      { title: "“More like this” related-products row at the bottom of /product/[id]" },
      { title: "/compare page — side-by-side comparison of up to 3 products" },
      { title: "Gift checkout (recipient email + message stored on Order)" },
      { title: "Minimum-rating filter on /browse" },
      { title: "“Notify me on restock” buttons + StockAlert table" },
    ],
  },
  {
    id: "fix-admin",
    title: "Fix · Admin role + scroll feel",
    subtitle:
      "Two surface fixes you flagged in chat — admin couldn't open a store without losing their role, and scrolling needed smoothing.",
    icon: Wrench,
    tone: "purple",
    shippedAt: "12:01",
    commitSha: "bfb8abc",
    items: [
      { title: "/api/seller/become-seller no longer demotes admins to seller on store creation" },
      { title: "Prominent “Admin panel” button in TopNav for admin role only" },
      { title: "Smooth scroll behaviour on <html> + scroll-padding-top for sticky nav" },
      { title: "Reduced-motion media query disables both smooth scroll and animations" },
    ],
  },
  {
    id: "batch-g",
    title: "Batch G · Tests",
    subtitle:
      "Two test suites: Vitest for pure helpers (sub-second) and Playwright smoke tests covering all four personas against the live deploy. The pre-deploy regression gate the demo backlog asked for.",
    icon: FlaskConical,
    tone: "yellow",
    shippedAt: "14:39",
    commitSha: "51e520e",
    items: [
      { title: "Vitest + @vitest/coverage-v8 wired with `npm test -w @metu/web`" },
      { title: "26 unit tests across 2 files run in ~500 ms — pure helpers, no jsdom" },
      { title: "Extracted coupon math + maxForLine + subtotal helpers into lib/cart-math.ts" },
      { title: "Extracted cardImage URL transform into lib/utils.ts (now reusable + tested)" },
      { title: "Playwright + Chromium runs against https://metu.fly.dev (override with BASE_URL)" },
      { title: "Four persona smoke specs: guest / buyer / seller / admin — happy path each" },
      { title: "Full e2e suite passes in ~20 s on cold Neon — the pre-deploy regression gate" },
    ],
  },
  {
    id: "batch-f",
    title: "Batch F · Observability",
    subtitle:
      "Production-grade monitoring — Sentry error tracking + Plausible analytics, both env-optional so they only activate when keys are configured. Plus a public /health page anyone can hit.",
    icon: Activity,
    tone: "success",
    shippedAt: "13:55",
    commitSha: "5f7937c",
    items: [
      { title: "@sentry/nextjs v10 wired into instrumentation.ts (server + edge) and instrumentation-client.ts (browser)" },
      { title: "DSN env-gated — no DSN, no init, no requests. Lazy-imported on the client so the SDK only ships when configured." },
      { title: "global-error.tsx captures top-of-tree React render errors that escape per-route boundaries" },
      { title: "Sample rates: 1.0 in dev, 0.2 in prod; releases tagged with the deploy SHA" },
      { title: "Plausible analytics drop-in (NEXT_PUBLIC_PLAUSIBLE_DOMAIN env), cookie-free, no consent banner" },
      { title: "Public /health page — DB ping, uptime, build SHA, region, soft-delete-aware catalogue counts" },
      { title: "Color-graded ping badge (FAST / OK / SLOW / DOWN) so on-call can read status at a glance" },
    ],
  },
  {
    id: "batch-e",
    title: "Batch E · Platform polish",
    subtitle:
      "Seven items aimed at the next layer of polish — discoverability (PWA + sitemap), accessibility (skip-to-content + focus-trap), graceful 404, light mode, and scoped TH/EN i18n.",
    icon: Palette,
    tone: "info",
    shippedAt: "07:57",
    commitSha: "b08c41c",
    items: [
      { title: "PWA manifest at /manifest.webmanifest with branded SVG icons (any + maskable)" },
      { title: "Dynamic /sitemap.xml (top 200 products + all stores) and /robots.txt" },
      { title: "Custom 404 with popular-categories suggestions below the CTAs" },
      { title: "Skip-to-content link + id=\"main\" wired into all 27 pages (WCAG 2.4.1)" },
      { title: "useFocusTrap() hook on WriteReviewDialog + keyboard cheatsheet (WCAG 2.4.3)" },
      { title: "Light mode toggle in TopNav — persists to localStorage, no flash on reload" },
      { title: "TH/EN i18n in TopNav, footer, search placeholder, cart empty state" },
    ],
  },
  {
    id: "batch-d",
    title: "Batch D · Trust & security",
    subtitle:
      "The biggest batch of the day — rate limits, password reset, soft-delete + audit log on every destructive action, Turnstile CAPTCHA, GDPR data export.",
    icon: Shield,
    tone: "danger",
    shippedAt: "12:24",
    commitSha: "1f67c0a",
    items: [
      { title: "Rate-limit middleware (5/min per IP) on login, register, forgot-password" },
      { title: "Password reset flow — /forgot-password and /reset-password pages, SHA-256 hashed tokens, 30-min TTL" },
      { title: "Email facade — picks console (dev) or Resend (when RESEND_API_KEY is set)" },
      { title: "AuditLog table + audit() helper wired into every destructive admin/seller route" },
      { title: "Soft-delete (deletedAt) on User / Store / Product — public surfaces filter immediately" },
      { title: "Cloudflare Turnstile CAPTCHA on /register (no-op without TURNSTILE_SECRET)" },
      { title: "GDPR export — GET /api/profile/export streams a JSON dump of the user's data" },
      { title: "/admin/audit page — paginated, filterable by action + target type" },
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
