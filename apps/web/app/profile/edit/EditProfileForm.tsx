"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, Lock, Save, Phone, ShieldCheck } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";

type Country = { countryId: number; name: string };

type Initial = {
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  countryId: number | null;
  gender: "male" | "female" | "other" | null;
  dateOfBirth: string; // YYYY-MM-DD or ""
  // Phase 14.3 — when false (Google-only signups), the password
  // section renders the SET-password flow instead of the
  // change-password flow (no currentPassword required).
  hasPassword: boolean;
  // Phase 14.4 — phone + verification status drive the OTP UI.
  phone: string | null;
  phoneVerified: boolean;
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
  // Phase 14.4 phone state — independent of the main profile form so
  // the user can update their phone without re-saving every other
  // field.
  const [phoneInput, setPhoneInput] = useState(initial.phone ?? "");
  const [otpCode, setOtpCode] = useState("");
  // Once a code has been requested in this session, show the verify
  // input. The server-side state of "pending OTP" survives reloads,
  // but for UX we don't auto-show the input on a fresh page load —
  // user has to click "Send code" again.
  const [otpRequested, setOtpRequested] = useState(false);
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
      // Phase 14.3 — Google-only users (initial.hasPassword=false)
      // hit /set-password (no currentPassword check); existing users
      // hit /change-password (verifies the current password first).
      const url = initial.hasPassword
        ? "/api/auth/change-password"
        : "/api/auth/set-password";
      const body = initial.hasPassword
        ? pw
        : { newPassword: pw.newPassword, confirmPassword: pw.confirmPassword };
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
        setPasswordMsg({ ok: false, text: data?.message ?? fallback });
        return;
      }
      const successText = initial.hasPassword
        ? "Password updated."
        : "Password set. You can now sign in with email + password too.";
      setPasswordMsg({ ok: true, text: successText });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
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

      {/* ───── Phone + OTP verification (Phase 14.4) ─────
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

      {/* ───── Account & security: password ─────
          Phase 14.3 — UI flips between SET (no current pw required,
          shown to Google-only users) and CHANGE (verifies current
          first) based on the initial.hasPassword flag the page sets
          from the User row's password column. */}
      <form onSubmit={changePassword} className="rounded-2xl glass-morphism p-6 space-y-4">
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
    </div>
  );
}
