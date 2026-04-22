"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, Lock, Save } from "lucide-react";
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
  const [busy, setBusy] = useState<null | "profile" | "password">(null);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (pw.newPassword !== pw.confirmPassword) {
      setPasswordMsg({ ok: false, text: "New passwords don't match" });
      return;
    }
    setBusy("password");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pw),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPasswordMsg({ ok: false, text: data?.message ?? "Failed to change password" });
        return;
      }
      setPasswordMsg({ ok: true, text: "Password updated." });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
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

        <div className="grid grid-cols-2 gap-4">
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

      {/* ───── Change password ───── */}
      <form onSubmit={changePassword} className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-metu-yellow" />
          Change password
        </h2>

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
            {busy === "password" ? "Updating…" : "Update password"}
          </GlassButton>
        </div>
      </form>
    </div>
  );
}
