"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { Store as StoreIcon, ImageIcon } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";
import { isDataUrl } from "@/lib/utils";

type BusinessType = { typeId: number; name: string };

type StoreForm = {
  storeId: number;
  name: string;
  description: string;
  businessTypeId: number;
  profileImage: string;
  coverImage: string;
};

export function EditStoreForm({
  store,
  businessTypes,
}: {
  store: StoreForm;
  businessTypes: BusinessType[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState({
    name: store.name,
    description: store.description,
    businessTypeId: store.businessTypeId,
    profileImage: store.profileImage,
    coverImage: store.coverImage,
  });

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/seller/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          businessTypeId: form.businessTypeId,
          profileImage: form.profileImage.trim() || undefined,
          coverImage: form.coverImage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Failed to save store");
        setBusy(false);
        return;
      }
      setOk(true);
      setBusy(false);
      // Refresh server components so the new info shows up across the app
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      {/* Live preview */}
      <section className="rounded-2xl glass-morphism overflow-hidden">
        <div className="relative aspect-[5/2] bg-surface-2 overflow-hidden">
          {form.coverImage ? (
            <Image src={form.coverImage} alt="" fill sizes="100vw" className="object-cover" unoptimized={isDataUrl(form.coverImage)} />
          ) : (
            <div className="absolute inset-0 vibrant-mesh" />
          )}
          <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-metu-yellow to-transparent" />
        </div>
        <div className="p-5 flex items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-metu-yellow overflow-hidden ring-2 ring-surface-1 -mt-12 shadow-pop">
            {form.profileImage ? (
              <Image src={form.profileImage} alt="" fill sizes="64px" className="object-cover" unoptimized={isDataUrl(form.profileImage)} />
            ) : (
              <StoreIcon className="h-6 w-6 m-5 text-surface-1" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-white truncate">
              {form.name || "Your store name"}
            </div>
            <div className="text-sm text-ink-secondary line-clamp-2">
              {form.description || "Your tagline / description shows here."}
            </div>
          </div>
        </div>
      </section>

      {/* Fields */}
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-metu-yellow" />
          Store details
        </h2>

        <label className="block">
          <span className="text-sm font-semibold text-white">Store name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
            maxLength={60}
            className={`mt-1 ${inputCls}`}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-white">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
            required
            rows={3}
            className={`mt-1 ${inputCls} resize-none`}
          />
          <div className="text-[10px] text-ink-dim text-right mt-1">{form.description.length} / 255</div>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-white">Business type</span>
          <select
            value={form.businessTypeId}
            onChange={(e) => setForm({ ...form, businessTypeId: Number(e.target.value) })}
            className={`mt-1 ${inputCls}`}
          >
            {businessTypes.map((b) => (
              <option key={b.typeId} value={b.typeId}>{b.name}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Imagery */}
      <section className="rounded-2xl glass-morphism p-6 space-y-5">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-metu-yellow" />
          Imagery
        </h2>
        <p className="text-xs text-ink-dim">
          Upload from your device or paste a public image URL — preview at the top updates instantly.
        </p>
        <FileImageInput
          label="Profile image"
          value={form.profileImage}
          onChange={(v) => setForm({ ...form, profileImage: v })}
          recommended={{ w: 400, h: 400, note: "square avatar" }}
          aspect="square"
        />
        <FileImageInput
          label="Cover image"
          value={form.coverImage}
          onChange={(v) => setForm({ ...form, coverImage: v })}
          recommended={{ w: 1600, h: 600, note: "5:2 banner" }}
          aspect="wide"
        />
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {ok && (
        <p className="text-sm text-green-400">Saved. Visit your storefront to see the changes.</p>
      )}

      <div className="flex gap-3 justify-end">
        <GlassButton tone="glass" size="lg" href={`/store/${store.storeId}`}>
          View storefront
        </GlassButton>
        <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </GlassButton>
      </div>
    </form>
  );
}
