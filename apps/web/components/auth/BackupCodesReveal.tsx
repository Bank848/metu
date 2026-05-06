"use client";
import { useState } from "react";
import { Copy, Download, Check, ShieldAlert } from "lucide-react";

// One-time reveal of TOTP backup codes after enrol-verify or
// regenerate. Codes are NEVER fetched again — the modal must be
// dismissed only once the user confirms they've saved them.
//
// Two save options: "Copy all" (clipboard) and "Download as .txt"
// (named with today's date so multiple downloads don't clobber each
// other). Plus an explicit "I've saved them" button to dismiss; the
// modal can't be closed by clicking the backdrop.

export function BackupCodesReveal({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  function copyAll() {
    navigator.clipboard?.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob(
      [
        `METU 2FA backup codes\n`,
        `Generated: ${new Date().toISOString()}\n\n`,
        `Each code is single-use. Store these somewhere only you can\n`,
        `reach (password manager, printed copy in a safe place). If\n`,
        `you regenerate, every code below stops working.\n\n`,
        ...codes.map((c) => c + "\n"),
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metu-backup-codes-${today}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-2xl bg-space-900 border border-metu-yellow/30 shadow-2xl shadow-black/50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-metu-yellow/20 p-2 shrink-0">
            <ShieldAlert className="h-5 w-5 text-metu-yellow" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-white">
              Save your backup codes
            </h2>
            <p className="text-sm text-ink-secondary mt-0.5">
              Each one works once if you can't reach your authenticator app.
              We&apos;ll never show them again.
            </p>
          </div>
        </div>

        <ol className="grid grid-cols-2 gap-2 rounded-xl bg-space-950 border border-line p-3 font-mono text-sm text-white">
          {codes.map((code) => (
            <li key={code} className="tabular-nums tracking-wide">
              {code}
            </li>
          ))}
        </ol>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyAll}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-space-950 px-4 py-2 text-sm font-semibold text-white hover:border-metu-yellow/50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-mint" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy all"}
          </button>
          <button
            type="button"
            onClick={download}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-space-950 px-4 py-2 text-sm font-semibold text-white hover:border-metu-yellow/50"
          >
            <Download className="h-3.5 w-3.5" />
            Download .txt
          </button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 accent-metu-yellow shrink-0"
          />
          <span>
            I&apos;ve saved my backup codes somewhere safe.
          </span>
        </label>

        <button
          type="button"
          onClick={onClose}
          disabled={!acknowledged}
          className="w-full rounded-full bg-metu-yellow px-4 py-2.5 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
