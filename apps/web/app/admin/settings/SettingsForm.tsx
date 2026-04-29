"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Settings {
  walletEnabled: boolean;
  chatEnabled: boolean;
  favoritesEnabled: boolean;
  promptpayId: string;
  updatedAt: string;
}

/**
 * Phase 17.1 — settings form. Three toggles + a text input.
 * Submit sends a partial PATCH (only the fields that changed) so
 * the audit log captures a clean diff.
 */
export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [walletEnabled, setWalletEnabled] = useState(initial.walletEnabled);
  const [chatEnabled, setChatEnabled] = useState(initial.chatEnabled);
  const [favoritesEnabled, setFavoritesEnabled] = useState(initial.favoritesEnabled);
  const [promptpayId, setPromptpayId] = useState(initial.promptpayId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty =
    walletEnabled !== initial.walletEnabled ||
    chatEnabled !== initial.chatEnabled ||
    favoritesEnabled !== initial.favoritesEnabled ||
    promptpayId !== initial.promptpayId;

  async function onSave() {
    setBusy(true);
    setMessage(null);
    try {
      const patch: Record<string, unknown> = {};
      if (walletEnabled !== initial.walletEnabled) patch.walletEnabled = walletEnabled;
      if (chatEnabled !== initial.chatEnabled) patch.chatEnabled = chatEnabled;
      if (favoritesEnabled !== initial.favoritesEnabled) patch.favoritesEnabled = favoritesEnabled;
      if (promptpayId !== initial.promptpayId) patch.promptpayId = promptpayId;
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
          label="Wallet enabled"
          description="Buyers must spend coins at checkout. Top up via PromptPay first."
          checked={walletEnabled}
          onChange={setWalletEnabled}
        />
        <Toggle
          label="Chat enabled"
          description="Buyer ↔ seller messaging surfaces visible everywhere."
          checked={chatEnabled}
          onChange={setChatEnabled}
        />
        <Toggle
          label="Favorites enabled"
          description="TopNav heart icon, FavoriteButton on cards, and the /favorites inbox visible."
          checked={favoritesEnabled}
          onChange={setFavoritesEnabled}
        />

        <div className="pt-2">
          <label
            htmlFor="promptpay-id"
            className="block text-sm font-semibold text-white mb-1"
          >
            PromptPay ID
          </label>
          <input
            id="promptpay-id"
            type="text"
            inputMode="numeric"
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0812345678"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-surface-3 px-4 py-2.5 text-white font-mono focus:border-metu-yellow outline-none"
          />
          <p className="text-xs text-ink-dim mt-1">
            10 digits (mobile) or 13 digits (national ID). Top-up QRs will charge this account.
          </p>
        </div>
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
