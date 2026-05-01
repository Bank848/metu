"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Lock, Save, Phone, ShieldCheck, Monitor, Trash2, Smartphone, Copy } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";

// Active session entry from GET /auth/sessions.
type SessionRow = {
  id: number;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type Country = { countryId: number; name: string };

type Initial = {
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  countryId: number | null;
  gender: "male" | "female" | "other" | null;
  dateOfBirth: string; // YYYY-MM-DD or ""
  // false = Google-only; renders the SET-password flow instead of change-password.
  hasPassword: boolean;
  phone: string | null;
  phoneVerified: boolean;
  totpEnabled: boolean;
};

const TODAY = new Date();
const MAX_DOB = new Date(TODAY.getFullYear() - 13, TODAY.getMonth(), TODAY.getDate())
  .toISOString()
  .slice(0, 10);

export function EditProfileForm({
  initial,
  countries,
}: {
  initial: Initial;
  countries: Country[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    null | "profile" | "password" | "phone" | "otp-request" | "otp-verify"
  >(null);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Phone state lives outside the main form so phone updates don't
  // require re-saving every other field.
  const [phoneInput, setPhoneInput] = useState(initial.phone ?? "");
  const [otpCode, setOtpCode] = useState("");
  // Don't auto-show the verify input after a refresh - user must re-request.
  const [otpRequested, setOtpRequested] = useState(false);

  // TOTP enrolment: enroll-start -> scan QR -> enroll-verify.
  const [totpBusy, setTotpBusy] = useState<null | "enroll-start" | "enroll-verify" | "disable">(null);
  const [totpEnrollment, setTotpEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpDisablePw, setTotpDisablePw] = useState("");
  const [totpMsg, setTotpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function totpEnrollStart() {
    setTotpMsg(null);
    setTotpBusy("enroll-start");
    try {
      const res = await fetch("/api/auth/totp/enroll-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTotpMsg({ ok: false, text: data?.message ?? "Failed to start enrolment" });
        return;
      }
      setTotpEnrollment({ secret: data.secret, otpauthUri: data.otpauthUri });
    } catch {
      setTotpMsg({ ok: false, text: "Network error" });
    } finally {
      setTotpBusy(null);
    }
  }

  async function totpEnrollVerify(e: React.FormEvent) {
    e.preventDefault();
    setTotpMsg(null);
    setTotpBusy("enroll-verify");
    try {
      const res = await fetch("/api/auth/totp/enroll-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: totpVerifyCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const hint =
          data?.error === "InvalidTotp"
            ? "Code didn't match. Check your authenticator app's clock + try again."
            : data?.message ?? "Failed to verify";
        setTotpMsg({ ok: false, text: hint });
        return;
      }
      setTotpMsg({ ok: true, text: "2FA enabled. You'll need a code at next sign-in." });
      setTotpEnrollment(null);
      setTotpVerifyCode("");
      router.refresh();
    } catch {
      setTotpMsg({ ok: false, text: "Network error" });
    } finally {
      setTotpBusy(null);
    }
  }

  async function totpDisable(e: React.FormEvent) {
    e.preventDefault();
    setTotpMsg(null);
    setTotpBusy("disable");
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: totpDisablePw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const hint =
          data?.error === "InvalidPassword"
            ? "Wrong password."
            : data?.message ?? "Failed to disable";
        setTotpMsg({ ok: false, text: hint });
        return;
      }
      setTotpMsg({ ok: true, text: "2FA disabled." });
      setTotpDisablePw("");
      router.refresh();
    } catch {
      setTotpMsg({ ok: false, text: "Network error" });
    } finally {
      setTotpBusy(null);
    }
  }

  // Sessions load lazily on mount.
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [sessionsMsg, setSessionsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sessionsBusy, setSessionsBusy] = useState<null | "list" | "revoke" | "revoke-all">(null);

  async function loadSessions() {
    setSessionsBusy("list");
    try {
      const res = await fetch("/api/auth/sessions", { credentials: "include" });
      if (!res.ok) {
        setSessions([]);
        return;
      }
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setCurrentSessionId(data.currentSessionId ?? null);
    } catch {
      setSessions([]);
    } finally {
      setSessionsBusy(null);
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revokeSession(id: number) {
    setSessionsMsg(null);
    setSessionsBusy("revoke");
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSessionsMsg({ ok: false, text: data?.message ?? "Failed to revoke" });
        return;
      }
      setSessionsMsg({ ok: true, text: "Session revoked." });
      await loadSessions();
    } catch {
      setSessionsMsg({ ok: false, text: "Network error" });
    } finally {
      setSessionsBusy(null);
    }
  }

  async function revokeAllOthers() {
    setSessionsMsg(null);
    setSessionsBusy("revoke-all");
    try {
      const res = await fetch("/api/auth/sessions/all-others", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSessionsMsg({ ok: false, text: data?.message ?? "Failed to revoke" });
        return;
      }
      const data = await res.json().catch(() => ({}));
      setSessionsMsg({ ok: true, text: `Revoked ${data.revoked ?? 0} session(s).` });
      await loadSessions();
    } catch {
      setSessionsMsg({ ok: false, text: "Network error" });
    } finally {
      setSessionsBusy(null);
    }
  }
  const [form, setForm] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email,
    profileImage: initial.profileImage,
    countryId: initial.countryId ? String(initial.countryId) : "",
    gender: initial.gender ?? "",
    dateOfBirth: initial.dateOfBirth,
  });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  // OTP code for sensitive password ops. Only surfaced when phoneVerified.
  const [pwOtp, setPwOtp] = useState("");

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none";

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setBusy("profile");
    const payload: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
    };
    if (form.profileImage) payload.profileImage = form.profileImage;
    if (form.countryId) payload.countryId = Number(form.countryId);
    if (form.gender) payload.gender = form.gender;
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProfileMsg({
          ok: false,
          text: data?.field === "email" ? "That email is already taken" : (data?.message ?? "Failed to save"),
        });
        return;
      }
      setProfileMsg({ ok: true, text: "Saved." });
      router.refresh();
    } catch {
      setProfileMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMsg(null);
    setBusy("phone");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPhoneMsg({ ok: false, text: data?.message ?? "Failed to save phone" });
        return;
      }
      setPhoneMsg({
        ok: true,
        text: "Phone saved. Click 'Send code' to verify.",
      });
      setOtpRequested(false); // any prior pending OTP is now invalid
      router.refresh();
    } catch {
      setPhoneMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function requestOtp() {
    setPhoneMsg(null);
    setBusy("otp-request");
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhoneMsg({ ok: false, text: data?.message ?? "Failed to send code" });
        return;
      }
      setOtpRequested(true);
      // Surface where the code went so dev/demo flow is obvious.
      const where =
        data?.transport === "twilio"
          ? "Code sent via SMS — check your phone."
          : "Code printed to server logs (dev mode). Ask the server operator.";
      setPhoneMsg({ ok: true, text: where });
    } catch {
      setPhoneMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMsg(null);
    setBusy("otp-verify");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.error === "InvalidOtp"
            ? "That code didn't match. Try again or request a new one."
            : data?.error === "OtpExpired"
            ? "That code expired. Request a new one."
            : data?.error === "NoPendingOtp"
            ? "No pending code — click 'Send code' first."
            : data?.message ?? "Failed to verify code";
        setPhoneMsg({ ok: false, text: msg });
        return;
      }
      setPhoneMsg({ ok: true, text: "Phone verified! ✓" });
      setOtpRequested(false);
      setOtpCode("");
      router.refresh();
    } catch {
      setPhoneMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (pw.newPassword !== pw.confirmPassword) {
      setPasswordMsg({ ok: false, text: "New passwords don't match" });
      return;
    }
    setBusy("password");
    try {
      // Google-only users use /set-password; existing users /change-password.
      // phoneVerified users must include otpCode.
      const url = initial.hasPassword
        ? "/api/auth/change-password"
        : "/api/auth/set-password";
      const body: Record<string, unknown> = initial.hasPassword
        ? { ...pw }
        : { newPassword: pw.newPassword, confirmPassword: pw.confirmPassword };
      if (initial.phoneVerified && pwOtp) body.otpCode = pwOtp;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fallback = initial.hasPassword
          ? "Failed to change password"
          : "Failed to set password";
        const otpHint =
          data?.error === "OtpRequired"
            ? "Phone verified — enter a fresh SMS code below to confirm this change."
            : data?.error === "InvalidOtp"
            ? "Wrong SMS code. Try again or request a new one."
            : data?.error === "OtpExpired"
            ? "SMS code expired. Request a new one and try again."
            : data?.error === "NoPendingOtp"
            ? "No pending SMS code — click 'Send code' first."
            : null;
        setPasswordMsg({ ok: false, text: otpHint ?? data?.message ?? fallback });
        return;
      }
      const successText = initial.hasPassword
        ? "Password updated."
        : "Password set. You can now sign in with email + password too.";
      setPasswordMsg({ ok: true, text: successText });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwOtp("");
      // Refresh so the next render reads hasPassword=true and the
      // form switches back to the change-password flow.
      router.refresh();
    } catch {
      setPasswordMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ───── Profile fields ───── */}
      <form onSubmit={saveProfile} className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <User className="h-4 w-4 text-metu-yellow" />
          Account details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-white">First name</span>
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              maxLength={40}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">Last name</span>
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              maxLength={40}
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-white">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className={`mt-1 ${inputCls}`}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-white">Date of birth</span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              max={MAX_DOB}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">Gender</span>
            <select
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value as typeof form.gender })
              }
              className={`mt-1 ${inputCls}`}
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-white">Country</span>
          <select
            value={form.countryId}
            onChange={(e) => setForm({ ...form, countryId: e.target.value })}
            className={`mt-1 ${inputCls}`}
          >
            <option value="">Choose a country</option>
            {countries.map((c) => (
              <option key={c.countryId} value={c.countryId}>{c.name}</option>
            ))}
          </select>
        </label>

        <FileImageInput
          label="Profile picture"
          value={form.profileImage}
          onChange={(v) => setForm({ ...form, profileImage: v })}
          recommended={{ w: 400, h: 400, note: "square avatar" }}
          aspect="square"
        />

        {profileMsg && (
          <p className={`text-sm ${profileMsg.ok ? "text-green-400" : "text-red-400"}`}>
            {profileMsg.text}
          </p>
        )}

        <div className="flex justify-end">
          <GlassButton tone="gold" size="lg" type="submit" disabled={busy !== null}>
            <Save className="h-4 w-4" />
            {busy === "profile" ? "Saving…" : "Save profile"}
          </GlassButton>
        </div>
      </form>

      {/* Phone + OTP verification.
          Three-step flow: enter phone → request 6-digit code → enter
          code to verify. Each step is its own button so the user has
          full control (we never auto-trigger SMS sends — those cost
          money in production). */}
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Phone className="h-4 w-4 text-metu-yellow" />
          Phone number
          {initial.phoneVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          )}
        </h2>
        <p className="text-sm text-ink-secondary -mt-2">
          Add a phone number for security alerts and account recovery. We'll send a 6-digit code to verify it.
        </p>

        <form onSubmit={savePhone} className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+66 91 234 5678"
            maxLength={20}
            pattern="[+()\d\s-]+"
            className={`flex-1 ${inputCls}`}
          />
          <GlassButton tone="glass" size="md" type="submit" disabled={busy !== null}>
            {busy === "phone" ? "Saving…" : "Save phone"}
          </GlassButton>
        </form>

        {/* Request + verify only enabled when a phone is on file. */}
        {initial.phone && !initial.phoneVerified && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={requestOtp}
                disabled={busy !== null}
                className="rounded-xl border border-white/15 bg-surface-2 px-4 py-2 text-sm font-semibold text-white hover:border-metu-yellow disabled:opacity-50"
              >
                {busy === "otp-request" ? "Sending…" : otpRequested ? "Resend code" : "Send code"}
              </button>
              {otpRequested && (
                <form onSubmit={verifyOtp} className="flex flex-1 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className={`w-32 text-center font-mono tracking-widest ${inputCls}`}
                  />
                  <GlassButton tone="glass" size="md" type="submit" disabled={busy !== null || otpCode.length !== 6}>
                    {busy === "otp-verify" ? "Verifying…" : "Verify"}
                  </GlassButton>
                </form>
              )}
            </div>
          </div>
        )}

        {phoneMsg && (
          <p className={`text-sm ${phoneMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
            {phoneMsg.text}
          </p>
        )}
      </section>

      {/* Password: SET (Google-only) vs CHANGE based on hasPassword. */}
      {/* Phase 45 follow-up — `id="set-password"` is the scroll target
          for the "Set a password" banner up at the top of the page so
          Google-only users land directly on this form. */}
      <form id="set-password" onSubmit={changePassword} className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-metu-yellow" />
          {initial.hasPassword ? "Change password" : "Set a password"}
        </h2>
        {!initial.hasPassword && (
          <p className="text-sm text-ink-secondary -mt-2">
            You signed up with Google. Set a password here so you can also sign in
            with email + password — both will work from then on.
          </p>
        )}

        {initial.hasPassword && (
          <label className="block">
            <span className="text-sm font-semibold text-white">Current password</span>
            <input
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
              className={`mt-1 ${inputCls}`}
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-semibold text-white">New password</span>
            <input
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-white">Confirm new password</span>
            <input
              type="password"
              value={pw.confirmPassword}
              onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        {/* OTP gate, only shown for phone-verified users. */}
        {initial.phoneVerified && (
          <div className="rounded-xl border border-white/10 bg-surface-2 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                SMS code required (phone verified)
              </span>
              <button
                type="button"
                onClick={requestOtp}
                disabled={busy !== null}
                className="text-xs font-semibold text-metu-yellow hover:underline disabled:opacity-50"
              >
                {busy === "otp-request" ? "Sending…" : "Send code"}
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={pwOtp}
              onChange={(e) => setPwOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`text-center font-mono tracking-widest ${inputCls}`}
            />
          </div>
        )}

        {passwordMsg && (
          <p className={`text-sm ${passwordMsg.ok ? "text-green-400" : "text-red-400"}`}>
            {passwordMsg.text}
          </p>
        )}

        <div className="flex justify-end">
          <GlassButton tone="glass" size="lg" type="submit" disabled={busy !== null}>
            {busy === "password"
              ? (initial.hasPassword ? "Updating…" : "Setting…")
              : (initial.hasPassword ? "Update password" : "Set password")}
          </GlassButton>
        </div>
      </form>

      {/* 2FA: not enrolled / mid-enrolment / enabled. */}
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-metu-yellow" />
          Two-factor authentication
          {initial.totpEnabled && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
              <ShieldCheck className="h-3 w-3" />
              Enabled
            </span>
          )}
        </h2>
        <p className="text-sm text-ink-secondary -mt-2">
          Add a 6-digit code from an authenticator app (Google Authenticator,
          Authy, 1Password, Bitwarden) on top of your password.
        </p>

        {/* State 3 — already enrolled, show Disable form */}
        {initial.totpEnabled && (
          <form onSubmit={totpDisable} className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-xs text-ink-dim">
              To disable 2FA, confirm your current password (defence in depth — even
              a stolen session can't strip 2FA without knowing the password).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={totpDisablePw}
                onChange={(e) => setTotpDisablePw(e.target.value)}
                placeholder="Current password"
                required
                autoComplete="current-password"
                className={`flex-1 ${inputCls}`}
              />
              <GlassButton tone="glass" size="md" type="submit" disabled={totpBusy !== null || !totpDisablePw}>
                {totpBusy === "disable" ? "Disabling…" : "Disable 2FA"}
              </GlassButton>
            </div>
          </form>
        )}

        {/* State 1 — not enrolled, no pending — show Enable button */}
        {!initial.totpEnabled && !totpEnrollment && (
          <button
            type="button"
            onClick={totpEnrollStart}
            disabled={totpBusy !== null}
            className="rounded-xl border border-white/15 bg-surface-2 px-4 py-2 text-sm font-semibold text-white hover:border-metu-yellow disabled:opacity-50"
          >
            {totpBusy === "enroll-start" ? "Loading…" : "Enable 2FA"}
          </button>
        )}

        {/* State 2 — mid-enrolment, show secret + verify form */}
        {!initial.totpEnabled && totpEnrollment && (
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim mb-1">
                Step 1 — add to your authenticator app
              </div>
              <div className="text-sm text-white">
                Open your app and either:
                <ul className="list-disc list-inside text-ink-secondary mt-1 space-y-0.5">
                  <li>
                    Tap the URI on this device:{" "}
                    <a
                      href={totpEnrollment.otpauthUri}
                      className="text-metu-yellow underline hover:no-underline break-all"
                    >
                      open in authenticator
                    </a>
                  </li>
                  <li>
                    Or paste this secret manually:{" "}
                    <code className="font-mono text-xs bg-surface-3 px-2 py-0.5 rounded">
                      {totpEnrollment.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(totpEnrollment.secret)}
                      className="ml-1 inline-flex items-center text-ink-dim hover:text-metu-yellow"
                      title="Copy secret"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <form onSubmit={totpEnrollVerify} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
                Step 2 — enter the first 6-digit code
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpVerifyCode}
                  onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className={`w-32 text-center font-mono tracking-widest ${inputCls}`}
                  required
                />
                <GlassButton tone="glass" size="md" type="submit" disabled={totpBusy !== null || totpVerifyCode.length !== 6}>
                  {totpBusy === "enroll-verify" ? "Verifying…" : "Verify + enable"}
                </GlassButton>
                <button
                  type="button"
                  onClick={() => {
                    setTotpEnrollment(null);
                    setTotpVerifyCode("");
                    setTotpMsg(null);
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-ink-dim hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {totpMsg && (
          <p className={`text-sm ${totpMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
            {totpMsg.text}
          </p>
        )}
      </section>

      {/* Active sessions list. Current session gets a (this device)
          badge and a disabled Revoke button. */}
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Monitor className="h-4 w-4 text-metu-yellow" />
          Active sessions
        </h2>
        <p className="text-sm text-ink-secondary -mt-2">
          Devices currently signed in via Google. Revoke any you don't recognise.
        </p>

        {sessions === null && (
          <p className="text-sm text-ink-dim">Loading sessions…</p>
        )}
        {sessions && sessions.length === 0 && (
          <p className="text-sm text-ink-dim">
            No active Google sessions. (If you signed in with email + password, your
            session is managed via cookie — change your password to invalidate it
            on every device.)
          </p>
        )}
        {sessions && sessions.length > 0 && (
          <ul className="divide-y divide-white/5 -mx-2">
            {sessions.map((s) => {
              const isCurrent = s.id === currentSessionId;
              const ua = s.userAgent ?? "Unknown device";
              const where = s.ipAddress ?? "unknown IP";
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white truncate">
                      <span className="truncate">{ua.slice(0, 60)}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-metu-yellow/20 text-metu-yellow font-bold">
                          THIS DEVICE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-dim font-mono mt-0.5">
                      {where} · created {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeSession(s.id)}
                    disabled={isCurrent || sessionsBusy !== null}
                    className="flex items-center gap-1 rounded-lg border border-coral-400/30 bg-coral-400/5 text-coral-200 px-3 py-1.5 text-xs font-semibold hover:bg-coral-400/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3 w-3" />
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {sessions && sessions.length > 1 && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={revokeAllOthers}
              disabled={sessionsBusy !== null}
              className="rounded-lg border border-white/15 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-white hover:border-coral-400/40 disabled:opacity-50"
            >
              {sessionsBusy === "revoke-all" ? "Revoking…" : "Sign out everywhere else"}
            </button>
          </div>
        )}

        {sessionsMsg && (
          <p className={`text-sm ${sessionsMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
            {sessionsMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
