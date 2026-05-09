"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Mail, Phone, ArrowLeft } from "lucide-react";
import { FirebasePhoneVerify } from "@/components/auth/FirebasePhoneVerify";

const CHANNEL_COOLDOWN_MS = 30_000;

function formatHM(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

type Channel = { id: "sms" | "email"; hint: string };

// Stage-2 of the two-step login. Receives a `token` (pre-auth) +
// optional `channels` list from the URL. User picks SMS or email,
// gets a 6-digit code, types it back, ticks "trust this device for
// 7 days" if they want, and finishes signing in.
//
// Channels arrive in the URL as `sms:••••1234,email:j***@gmail.com`.
// Empty list → fall back to email-only since service.login enforced
// phoneVerifiedAt before issuing the token (the channel just isn't
// labelled). The server still handles whichever channel the user picks.

// Open-redirect guard: only allow single-leading-slash relative paths.
function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(next)) return "/";
  return next;
}

function parseChannels(raw: string | null): Channel[] {
  if (!raw) return [{ id: "email", hint: "" }];
  return raw
    .split(",")
    .map((part) => {
      const [id, hint] = part.split(":");
      if (id === "sms" || id === "email") {
        return { id, hint: hint ?? "" } as Channel;
      }
      return null;
    })
    .filter((c): c is Channel => c !== null);
}

export function LoginVerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const next = params.get("next") ?? "/";
  const channels = parseChannels(params.get("channels"));

  const [chosen, setChosen] = useState<Channel["id"]>(
    channels.find((c) => c.id === "sms")?.id ?? "email",
  );
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState<null | "request" | "verify">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Per-channel last-sent timestamp drives the 30s cooldown chip.
  const [sentAt, setSentAt] = useState<Record<Channel["id"], number>>({ sms: 0, email: 0 });
  const [cooldownLeft, setCooldownLeft] = useState(0);
  // Strict-mode + double-click guard so React 18 dev double-mount
  // and rapid tab clicks can't double-fire requestCode.
  const inFlight = useRef(false);
  // Masked-tail hint seeded from the URL so the SMS tab renders without
  // burning the preAuthToken on mount. /phone-for-sms (called when SMS is
  // actually picked) returns the full number + a rotated child token.
  const smsChannelHint = channels.find((c) => c.id === "sms")?.hint ?? "";
  const [smsPhoneHint, setSmsPhoneHint] = useState<string>(smsChannelHint);
  const [smsPhoneError, setSmsPhoneError] = useState<string | null>(null);
  // Rotated preAuthToken returned by /auth/login/phone-for-sms.
  // After the server consumes the original, the next call to
  // /firebase-verify must use this child token.
  const [smsToken, setSmsToken] = useState<string>(token);
  // Have we already exchanged the parent token for a child via
  // phone-for-sms? Tracked separately from smsPhoneHint because the
  // URL-sourced hint pre-populates without consuming anything.
  const [smsTokenRotated, setSmsTokenRotated] = useState<boolean>(false);
  // Full phone returned by /phone-for-sms — handed to FirebasePhoneVerify
  // as defaultPhone so the buyer doesn't have to re-type the number they
  // already proved they own at the password step.
  const [smsPhoneFull, setSmsPhoneFull] = useState<string>("");

  // Lazy phone-for-sms fetch — fires only once when the user picks SMS
  // so email-channel paths never see a pre-burned preAuthToken.
  const hasSmsChannel = channels.some((c) => c.id === "sms");
  useEffect(() => {
    if (!token || !hasSmsChannel) return;
    if (chosen !== "sms") return;
    if (smsTokenRotated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/login/phone-for-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? "Couldn't load phone for SMS.");
        if (!cancelled) {
          // Server returns: phone (full E.164), phoneMasked (display),
          // token (child preAuth). Older builds returned just `phone`
          // as the masked value — fall back to that so a stale BFF
          // doesn't strand the form.
          if (typeof data.phoneMasked === "string" && data.phoneMasked) {
            setSmsPhoneHint(data.phoneMasked);
          } else if (typeof data.phone === "string" && /\*/.test(data.phone)) {
            setSmsPhoneHint(data.phone);
          }
          if (typeof data.phone === "string" && data.phone && !/\*/.test(data.phone)) {
            setSmsPhoneFull(data.phone);
          }
          if (typeof data.token === "string" && data.token) {
            setSmsToken(data.token);
          }
          setSmsTokenRotated(true);
          setSmsPhoneError(null);
        }
      } catch (e: any) {
        if (!cancelled) setSmsPhoneError(e?.message ?? "Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hasSmsChannel, chosen, smsTokenRotated]);

  // Auto-request the first OTP on mount + on channel switch, but
  // never within 30s of the previous send for the same channel.
  // SMS channel skips this — Firebase handles its own SMS round-trip.
  useEffect(() => {
    if (!token || chosen === "sms") return;
    const last = sentAt[chosen] ?? 0;
    if (Date.now() - last < CHANNEL_COOLDOWN_MS) return;
    requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  // Live countdown for the cooldown chip on the active channel.
  useEffect(() => {
    const last = sentAt[chosen] ?? 0;
    const update = () => {
      const left = Math.max(0, CHANNEL_COOLDOWN_MS - (Date.now() - last));
      setCooldownLeft(Math.ceil(left / 1000));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [chosen, sentAt]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-coral/30 bg-coral/5 p-6 text-sm text-coral">
        Missing verification token. <a href="/login" className="underline">Go back to sign in</a>.
      </div>
    );
  }

  // Once phone-for-sms has rotated the parent token, every channel
  // (including email-fallback) must use the child or the server 401s.
  const activeToken = smsTokenRotated ? smsToken : token;

  async function requestCode() {
    if (inFlight.current) return;
    const last = sentAt[chosen] ?? 0;
    if (Date.now() - last < CHANNEL_COOLDOWN_MS) {
      const remaining = Math.ceil((CHANNEL_COOLDOWN_MS - (Date.now() - last)) / 1000);
      setMsg({ ok: false, text: `Wait ${remaining}s before requesting another ${chosen === "sms" ? "SMS" : "email"} code.` });
      return;
    }
    inFlight.current = true;
    setBusy("request");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: activeToken, channel: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data?.message ?? "Couldn't send the code." });
      } else {
        const now = Date.now();
        setSentAt((prev) => ({ ...prev, [chosen]: now }));
        setRequested(true);
        const sentHm = formatHM(new Date(now));
        const validHm = formatHM(new Date(now + 5 * 60_000));
        const where = chosen === "sms" ? "messages" : "email inbox";
        setMsg({ ok: true, text: `Code sent ${sentHm} — valid until ${validHm}. Check your ${where}; use the most recent code.` });
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: activeToken, code: code.trim(), trustDevice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({
          ok: false,
          text:
            data?.error === "InvalidOtp"
              ? "Wrong code. Try again or request a new one."
              : data?.error === "OtpExpired"
                ? "Code expired. Request a new one."
                : data?.error === "NoPendingOtp"
                  ? "Click Send code first."
                  : data?.error === "InvalidPreAuth"
                    ? "Verification expired. Sign in again."
                    : (data?.message ?? "Verification failed."),
        });
        setBusy(null);
        return;
      }
      router.push(safeNextPath(next));
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error." });
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-space-900 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-mint/15 p-2 shrink-0">
          <ShieldCheck className="h-5 w-5 text-mint" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-white">
            Confirm it&apos;s you
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            We need a one-time code before signing you in. Pick where it should land.
          </p>
        </div>
      </div>

      {/* Channel picker — chips */}
      {channels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => {
            const active = chosen === c.id;
            const channelCooldown = Math.max(
              0,
              Math.ceil((CHANNEL_COOLDOWN_MS - (Date.now() - (sentAt[c.id] ?? 0))) / 1000),
            );
            return (
              <button
                key={c.id}
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (chosen === c.id) return;
                  setChosen(c.id);
                  setCode("");
                  setRequested(false);
                }}
                className={
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 " +
                  (active
                    ? "bg-metu-yellow text-space-950"
                    : "bg-white/5 text-ink-secondary hover:text-white hover:bg-white/10")
                }
              >
                {c.id === "sms" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                {c.id === "sms" ? "SMS" : "Email"}
                {c.hint && <span className="opacity-60 font-mono">{c.hint}</span>}
                {channelCooldown > 0 && (
                  <span className="opacity-70 font-mono">{channelCooldown}s</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Trust-device toggle is shared across both channels. */}
      <label className="flex items-start gap-2 cursor-pointer text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="mt-1 h-4 w-4 accent-metu-yellow shrink-0"
        />
        <span>
          Trust this device for 7 days — won&apos;t ask for a code again on this browser.
        </span>
      </label>

      {chosen === "sms" ? (
        <div className="space-y-3">
          {smsPhoneError ? (
            <p className="text-xs text-coral">{smsPhoneError}</p>
          ) : !smsTokenRotated || !smsPhoneFull ? (
            <p className="text-xs text-ink-secondary">Loading SMS verification…</p>
          ) : (
            <>
              <p className="text-xs text-ink-secondary">
                We&rsquo;ll send a 6-digit Firebase SMS code to the phone on
                file{smsPhoneHint ? ` (${smsPhoneHint})` : ""}. The code
                expires in 5 minutes; resend is allowed once every 5 minutes.
              </p>
              <FirebasePhoneVerify
                defaultPhone={smsPhoneFull}
                phoneLabel={smsPhoneHint || undefined}
                hideEnterPhone
                verifyUrl="/api/auth/login/firebase-verify"
                extraBody={{ token: smsToken, trustDevice }}
                onVerified={() => {
                  router.push(safeNextPath(next));
                  router.refresh();
                }}
              />
            </>
          )}
          <a
            href="/login"
            className="inline-flex items-center gap-1 text-xs text-ink-dim hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              6-digit code
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full mt-1 rounded-xl border border-line bg-space-950 px-4 py-3 text-center font-mono tracking-[0.5em] text-2xl text-white focus:border-metu-yellow outline-none"
              autoFocus
            />
          </label>

          {msg && (
            <p className={`text-xs ${msg.ok ? "text-mint" : "text-coral"}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy !== null || code.length !== 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-4 py-2.5 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-50"
          >
            {busy === "verify" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy === "verify" ? "Verifying…" : "Sign in"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <a
              href="/login"
              className="inline-flex items-center gap-1 text-ink-dim hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </a>
            <button
              type="button"
              onClick={requestCode}
              disabled={busy !== null || cooldownLeft > 0}
              className="text-metu-yellow hover:underline disabled:opacity-50"
            >
              {busy === "request"
                ? "Sending…"
                : cooldownLeft > 0
                  ? `Resend in ${cooldownLeft}s`
                  : requested
                    ? "Resend code"
                    : "Send code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
