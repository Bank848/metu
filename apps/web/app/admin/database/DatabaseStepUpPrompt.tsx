"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { TotpStepUpModal } from "@/components/TotpStepUpModal";

export function DatabaseStepUpPrompt() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-6 py-5 max-w-xl">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm text-ink-secondary">
          <p className="font-semibold text-white">Authenticator step-up required</p>
          <p>
            The database inspector reads schema, row counts, and runs read-only
            SQL — gated behind a 2FA challenge that needs renewing every 15
            minutes. Verify a fresh 6-digit code (or a single-use backup code) to
            continue.
          </p>
          <p className="text-xs text-ink-dim">
            If you haven't enrolled an authenticator yet, do that from{" "}
            <a href="/profile/edit" className="underline hover:text-white">
              your profile
            </a>{" "}
            first.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full button-gradient text-surface-1 px-5 py-2 text-sm font-semibold hover:brightness-110"
        >
          Verify with 2FA
        </button>
      </div>
      <TotpStepUpModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
