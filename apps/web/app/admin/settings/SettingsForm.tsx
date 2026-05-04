"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Settings {
  favoritesEnabled: boolean;
  platformFeePercent: number;
  updatedAt: string;
}

/**
 * / 26 — settings form (slimmed down).
 * Toggles + percent input. Submit sends a partial PATCH (only the
 * fields that changed) so the audit log captures a clean diff.
 * dropped: walletEnabled, chatEnabled, promptpayId,
 * withdrawalFeePercent — replaced by Stripe Connect in Phase 27.
 */
export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [favoritesEnabled, setFavoritesEnabled] = useState(initial.favoritesEnabled);
  const [platformFeePercent, setPlatformFeePercent] = useState(initial.platformFeePercent);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty =
    favoritesEnabled !== initial.favoritesEnabled ||
    platformFeePercent !== initial.platformFeePercent;

  async function onSave() {
    setBusy(true);
    setMessage(null);
    try {
      const patch: Record<string, unknown> = {};
      if (favoritesEnabled !== initial.favoritesEnabled) patch.favoritesEnabled = favoritesEnabled;
      if (platformFeePercent !== initial.platformFeePercent) patch.platformFeePercent = platformFeePercent;
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data?.message || data?.error || "Save failed" });
        return;
      }
      setMessage({ kind: "ok", text: "Saved. Changes propagate to the other Fly machine within 30 s." });
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-space-900 p-6">
      <h2 className="font-display text-base font-bold text-white mb-4">
        Configuration
      </h2>

      <div className="space-y-4">
        <Toggle
          label="Favorites enabled"
          description="TopNav heart icon, FavoriteButton on cards, and the /favorites inbox visible."
          checked={favoritesEnabled}
          onChange={setFavoritesEnabled}
        />

        {/* Phase 20.1 / 26 — fee knob. Phase 27 will wire this directly
            into Stripe's `application_fee_amount` parameter at checkout. */}
        <PercentInput
          id="platform-fee-percent"
          label="Platform fee %"
          description="Cut the platform takes from every order at checkout. Sellers receive (100 − this)% per sale via their Stripe Connect account."
          value={platformFeePercent}
          onChange={setPlatformFeePercent}
        />
      </div>

      {message && (
        <p
          role="alert"
          className={`mt-4 text-sm ${
            message.kind === "ok" ? "text-mint" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={busy || !dirty}
          onClick={onSave}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {busy ? "Saving…" : "Save changes"}
        </Button>
        {!dirty && !busy && (
          <span className="text-xs text-ink-dim">No unsaved changes.</span>
        )}
      </div>
    </section>
  );
}

function PercentInput({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pt-2">
      <label htmlFor={id} className="block text-sm font-semibold text-white mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2 max-w-xs">
        <input
          id={id}
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
          className="w-32 rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white font-mono focus:border-metu-yellow outline-none"
        />
        <span className="text-ink-dim text-sm">%</span>
      </div>
      <p className="text-xs text-ink-dim mt-1">{description}</p>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-surface-2 px-4 py-3 text-left hover:border-mint/30 transition"
    >
      <div className="min-w-0">
        <div className="font-semibold text-white">{label}</div>
        <div className="text-xs text-ink-dim mt-0.5">{description}</div>
      </div>
      <div
        className={`relative shrink-0 mt-1 h-6 w-11 rounded-full transition ${
          checked ? "bg-mint" : "bg-white/10"
        }`}
        aria-hidden
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}
