"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Mail, Phone, ArrowLeft } from "lucide-react";

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

// PENTEST-001 sister-route: same open-redirect guard as LoginForm.
// `?next=` reaches `router.push(next)` on line ~117. Without this
// helper an attacker crafts /login/verify?next=https://evil.example.com
// and the post-OTP redirect lands on the phishing site. Reject any
// non-relative path.
function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  // Only allow paths that start with a single "/" and are not protocol-
  // relative (//) or backslash-prefixed (/\). Reject absolute URLs.
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Reject newline / control chars that can confuse downstream parsers.
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

  // Auto-request the first OTP on mount so the user lands with the
  // code already on its way. Only fires once per channel switch.
  useEffect(() => {
    if (!token) return;
    requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-coral/30 bg-coral/5 p-6 text-sm text-coral">
        Missing verification token. <a href="/login" className="underline">Go back to sign in</a>.
      </div>
    );
  }

  async function requestCode() {
    setBusy("request");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, channel: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data?.message ?? "Couldn't send the code." });
      } else {
        setRequested(true);
        setMsg({ ok: true, text: chosen === "sms" ? "Code sent — check your messages." : "Code sent — check your email inbox." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(null);
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
        body: JSON.stringify({ token, code: code.trim(), trustDevice }),
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
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setChosen(c.id);
                  setCode("");
                  setRequested(false);
                }}
                className={
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                  (active
                    ? "bg-metu-yellow text-space-950"
                    : "bg-white/5 text-ink-secondary hover:text-white hover:bg-white/10")
                }
              >
                {c.id === "sms" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                {c.id === "sms" ? "SMS" : "Email"}
                {c.hint && <span className="opacity-60 font-mono">{c.hint}</span>}
              </button>
            );
          })}
        </div>
      )}

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
            disabled={busy !== null}
            className="text-metu-yellow hover:underline disabled:opacity-50"
          >
            {busy === "request" ? "Sending…" : requested ? "Resend code" : "Send code"}
          </button>
        </div>
      </form>
    </div>
  );
}
