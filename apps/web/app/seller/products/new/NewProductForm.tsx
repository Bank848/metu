"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Tag as TagIcon } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

type Variant = {
  deliveryMethod: "download" | "email" | "license_key" | "streaming";
  quantity: number;
  price: number;
  discountPercent: number;
  discountAmount: number;
};

const DEFAULT_VARIANT: Variant = {
  deliveryMethod: "download",
  quantity: 999,
  price: 990,
  discountPercent: 0,
  discountAmount: 0,
};

const DELIVERY_OPTIONS: Variant["deliveryMethod"][] = ["download", "email", "license_key", "streaming"];

export function NewProductForm({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.categoryId ?? 0);
  const [images, setImages] = useState<string[]>([""]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [variants, setVariants] = useState<Variant[]>([{ ...DEFAULT_VARIANT }]);

  const inputCls = "w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none";

  function toggleTag(id: number) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function updateImage(i: number, v: string) {
    setImages((prev) => prev.map((u, idx) => (idx === i ? v : u)));
  }
  function addImage() {
    if (images.length < 5) setImages((prev) => [...prev, ""]);
  }
  function removeImage(i: number) {
    if (images.length > 1) setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, patch: Partial<Variant>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addVariant() {
    if (variants.length < 5) setVariants((prev) => [...prev, { ...DEFAULT_VARIANT }]);
  }
  function removeVariant(i: number) {
    if (variants.length > 1) setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanImages = images.map((u) => u.trim()).filter(Boolean);
    if (cleanImages.length === 0) {
      setError("Add at least one image URL.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          categoryId,
          images: cleanImages,
          tagIds,
          items: variants.map((v) => ({
            ...v,
            discountAmount: (v.price * v.discountPercent) / 100,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Failed to create product");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/seller/products");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Basics */}
      <section className="rounded-2xl glass-morphism p-6 space-y-4">
        <h2 className="font-display font-bold text-white">Basics</h2>
        <label className="block">
          <span className="text-sm font-semibold text-white">Product name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Songkran Social Media Kit 2026"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 255))}
            required
            rows={3}
            placeholder="A short pitch of what's in the pack."
            className={`mt-1 ${inputCls} resize-none`}
          />
          <div className="text-[10px] text-ink-dim text-right mt-1">{description.length} / 255</div>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className={`mt-1 ${inputCls}`}
          >
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Images */}
      <section className="rounded-2xl glass-morphism p-6 space-y-3">
        <h2 className="font-display font-bold text-white flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-metu-yellow" />
          Images <span className="text-xs text-ink-dim font-normal">({images.length}/5)</span>
        </h2>
        <p className="text-xs text-ink-dim">
          Paste public image URLs (e.g. unsplash.com or your own host). The first one becomes the cover.
        </p>
        {images.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="font-mono text-[10px] text-ink-dim w-4">{i + 1}</span>
            <input
              value={url}
              onChange={(e) => updateImage(i, e.target.value)}
              placeholder="https://images.unsplash.com/photo-…"
              className={inputCls}
            />
            {images.length > 1 && (
              <button type="button" onClick={() => removeImage(i)} className="text-ink-dim hover:text-metu-red p-2" aria-label="Remove image">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {images.length < 5 && (
          <button type="button" onClick={addImage} className="inline-flex items-center gap-1.5 text-sm text-metu-yellow hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
        )}
      </section>

      {/* Tags */}
      <section className="rounded-2xl glass-morphism p-6">
        <h2 className="font-display font-bold text-white flex items-center gap-2 mb-3">
          <TagIcon className="h-4 w-4 text-metu-yellow" />
          Tags <span className="text-xs text-ink-dim font-normal">({tagIds.length}/10)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = tagIds.includes(t.tagId);
            return (
              <button
                key={t.tagId}
                type="button"
                onClick={() => toggleTag(t.tagId)}
                disabled={!active && tagIds.length >= 10}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition",
                  active
                    ? "bg-metu-yellow/20 text-metu-yellow border-metu-yellow/40"
                    : "bg-white/5 text-ink-secondary border-white/10 hover:border-metu-yellow/30 disabled:opacity-40",
                )}
              >
                {t.tagName}
              </button>
            );
          })}
        </div>
      </section>

      {/* Variants */}
      <section className="rounded-2xl glass-morphism p-6 space-y-3">
        <h2 className="font-display font-bold text-white">
          Variants <span className="text-xs text-ink-dim font-normal">({variants.length}/5)</span>
        </h2>
        <p className="text-xs text-ink-dim">
          A product can have multiple SKUs (e.g. download vs license key) at different prices.
        </p>
        {variants.map((v, i) => {
          const final = v.price * (1 - v.discountPercent / 100);
          return (
            <div key={i} className="rounded-xl bg-surface-2 border border-white/8 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-dim">Variant {i + 1}</span>
                {variants.length > 1 && (
                  <button type="button" onClick={() => removeVariant(i)} className="text-ink-dim hover:text-metu-red" aria-label="Remove variant">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink-dim uppercase tracking-wider">Delivery</span>
                  <select
                    value={v.deliveryMethod}
                    onChange={(e) => updateVariant(i, { deliveryMethod: e.target.value as Variant["deliveryMethod"] })}
                    className={`mt-1 ${inputCls}`}
                  >
                    {DELIVERY_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o.replace("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink-dim uppercase tracking-wider">Price (฿)</span>
                  <input
                    type="number"
                    value={v.price}
                    onChange={(e) => updateVariant(i, { price: Math.max(0, Number(e.target.value)) })}
                    min={0}
                    step={1}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink-dim uppercase tracking-wider">Discount %</span>
                  <input
                    type="number"
                    value={v.discountPercent}
                    onChange={(e) => updateVariant(i, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    min={0}
                    max={100}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-ink-dim uppercase tracking-wider">Stock</span>
                  <input
                    type="number"
                    value={v.quantity}
                    onChange={(e) => updateVariant(i, { quantity: Math.max(0, Number(e.target.value)) })}
                    min={0}
                    className={`mt-1 ${inputCls}`}
                  />
                </label>
              </div>
              {v.discountPercent > 0 && (
                <div className="text-xs text-ink-secondary">
                  Buyers see: <span className="line-through text-ink-dim">{money(v.price)}</span>{" "}
                  <span className="text-gold-gradient font-bold">{money(final)}</span>
                </div>
              )}
            </div>
          );
        })}
        {variants.length < 5 && (
          <button type="button" onClick={addVariant} className="inline-flex items-center gap-1.5 text-sm text-metu-yellow hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add variant
          </button>
        )}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 justify-end">
        <GlassButton tone="glass" size="lg" href="/seller/products">Cancel</GlassButton>
        <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create product →"}
        </GlassButton>
      </div>
    </form>
  );
}
