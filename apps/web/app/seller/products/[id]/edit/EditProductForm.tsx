"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { TextareaInput } from "@/components/forms/TextareaInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { VariantRow, type VariantRowValue } from "@/components/forms/VariantRow";
import { PreviewPane } from "@/components/forms/PreviewPane";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string };

type Variant = VariantRowValue;

type Initial = {
  name: string;
  description: string;
  categoryId: number;
  images: string[];
  tagIds: number[];
  items: Variant[];
};

const DEFAULT_VARIANT: Variant = {
  deliveryMethod: "download",
  quantity: 999,
  price: 990,
  discountPercent: 0,
  discountAmount: 0,
};

/**
 * Edit form for an existing product. Mirrors NewProductForm so sellers
 * have the same mental model — same FormSection layout, same VariantRow,
 * same sticky live preview. Differences:
 *
 *   - initial state comes from props
 *   - submits via PATCH instead of POST
 *   - existing variants are protected (can't be removed) because
 *     OrderItem / CartItem FK into them
 *   - a mint info banner above Variants explains the lock so sellers
 *     don't wonder why the trash icon is dim. The banner used to render
 *     in coral with an AlertTriangle (F27, QA 2026-04-25) which read as
 *     an error state — the lock is normal product behaviour, not a
 *     warning, so it picked up the brand `info` register: mint
 *     surface-accent + Info icon, matching the success/positive
 *     palette role mint plays elsewhere in the seller flow.
 */
export function EditProductForm({
  productId,
  initial,
  categories,
  tags,
}: {
  productId: number;
  initial: Initial;
  categories: Category[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<number>(initial.categoryId);
  const [images, setImages] = useState<string[]>(initial.images.length ? initial.images : [""]);
  const [tagIds, setTagIds] = useState<number[]>(initial.tagIds);
  const [variants, setVariants] = useState<Variant[]>(initial.items.length ? initial.items : [{ ...DEFAULT_VARIANT }]);
  // Variants that existed at page-load time are protected from in-form
  // deletion because the API can't drop a ProductItem with FKs.
  const existingVariantCount = initial.items.length;

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
    // Only net-new variants (added in this edit session) can be removed.
    if (i < existingVariantCount) return;
    if (variants.length > 1) setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanImages = images.map((u) => u.trim()).filter(Boolean);
  const prices = variants.map((v) => v.price * (1 - v.discountPercent / 100));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const previewDiscount = variants[0]?.discountPercent ?? 0;
  const tagNames = tags
    .filter((t) => tagIds.includes(t.tagId))
    .map((t) => t.tagName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (cleanImages.length === 0) {
      setError("Keep at least one image.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/seller/products/${productId}`, {
        method: "PATCH",
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
            sampleUrl: v.sampleUrl?.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Failed to save changes");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/seller/products");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6 min-w-0">
        {/* Basics */}
        <FormSection title="Basics" description="Name, pitch, and category — what shows up first in search.">
          <TextInput
            label="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
          <TextareaInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 255))}
            required
            rows={3}
            helperText={`${description.length} / 255`}
          />
          <SelectInput
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            options={categories.map((c) => ({
              value: String(c.categoryId),
              label: c.categoryName,
            }))}
          />
        </FormSection>

        {/* Imagery */}
        <FormSection
          title={`Imagery (${images.length}/5)`}
          description="Upload a file or paste a public URL. The first image becomes the cover."
          accent="mint"
          variant="accent"
        >
          {images.map((url, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="font-mono text-[10px] text-ink-dim w-4 pt-2 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <FileImageInput
                  label={`Image ${i + 1}${i === 0 ? " · cover" : ""}`}
                  value={url}
                  onChange={(v) => updateImage(i, v)}
                  recommended={{ w: 1200, h: 800, note: "landscape product shot" }}
                  aspect="wide"
                />
              </div>
              {images.length > 1 && (
                <button type="button" onClick={() => removeImage(i)} className="text-ink-dim hover:text-coral p-2 shrink-0" aria-label="Remove image slot">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {images.length < 5 && (
            <button type="button" onClick={addImage} className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add image
            </button>
          )}
        </FormSection>

        {/* Tags */}
        <FormSection
          title={`Tags (${tagIds.length}/10)`}
          description="Help buyers discover your product through filter chips."
        >
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
                      : "bg-white/5 text-ink-secondary border-white/10 hover:border-mint/40 disabled:opacity-40",
                  )}
                >
                  {t.tagName}
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Variants — coral banner explains the protected (live) variants
            that the API refuses to drop because they have OrderItem /
            CartItem FKs. */}
        <FormSection
          title={`Variants (${variants.length}/5)`}
          accent="coral"
          description="Update price, stock, and discount. Sold variants stay for order history."
        >
          {existingVariantCount > 0 && (
            // F27: this is a normal "informational" banner, not an
            // error — sellers see it on every edit of a product that
            // has any sales history. The mint surface-accent +
            // `Info` icon match the brand info register and stop the
            // lock from reading as a destructive warning.
            <div className="surface-accent rounded-xl px-4 py-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-mint mt-0.5 shrink-0" />
              <p className="text-xs text-ink-secondary leading-relaxed">
                Variants with sales history are <span className="text-mint font-semibold">locked</span> —
                these can be edited but not deleted.
              </p>
            </div>
          )}
          {variants.map((v, i) => {
            const isExisting = i < existingVariantCount;
            return (
              <VariantRow
                key={i}
                index={i}
                value={v}
                onChange={(patch) => updateVariant(i, patch)}
                onRemove={() => removeVariant(i)}
                isProtected={isExisting}
                removable={true}
              />
            );
          })}
          {variants.length < 5 && (
            <button type="button" onClick={addVariant} className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add variant
            </button>
          )}
        </FormSection>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-3 justify-end">
          <GlassButton tone="glass" size="lg" href="/seller/products">Cancel</GlassButton>
          <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes →"}
          </GlassButton>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <PreviewPane
          variant="product"
          state={{
            name,
            description,
            minPrice,
            maxPrice: maxPrice !== minPrice ? maxPrice : undefined,
            image: cleanImages[0] ?? "",
            discountPercent: previewDiscount > 0 ? previewDiscount : undefined,
            tags: tagNames.length > 0 ? tagNames : undefined,
          }}
        />
      </div>
    </form>
  );
}
