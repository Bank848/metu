"use client";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function ResendVerifyButton({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (!email) {
      setMsg("Email missing from URL.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/resend-email-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMsg("ส่งใหม่แล้ว — check your inbox + spam folder.");
      } else {
        setMsg("ส่งไม่สำเร็จ. ลองอีกที.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={busy || !email}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow px-5 py-2.5 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {busy ? "Sending…" : "Resend verify email"}
      </button>
      {msg && <p className="mt-3 text-xs text-mint">{msg}</p>}
    </>
  );
}
