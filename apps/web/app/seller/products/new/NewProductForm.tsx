"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Tag as TagIcon } from "lucide-react";
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

const DEFAULT_VARIANT: Variant = {
  deliveryMethod: "download",
  quantity: 999,
  price: 990,
  discountPercent: 0,
  discountAmount: 0,
};

/**
 * Phase 10 / Step 3a — refactored against Step 2 primitives.
 *
 * Structure: 4 `<FormSection>` blocks (Basics / Imagery / Tags / Variants)
 * laid out in a `lg:grid-cols-[1fr_360px]` two-column shell with the live
 * `<PreviewPane variant="product">` sticky on the right. Mobile collapses
 * cleanly to a single column with the preview rendered below.
 *
 * Form state lives in a shared object so the preview can subscribe to
 * every keystroke. POST body shape is unchanged from Phase 9.
 */
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

  // Derived preview state — minPrice/maxPrice across variants so the
  // ProductCard shows the same range a buyer would see in the grid.
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
      setError("Add at least one image.");
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
            // Send empty string as undefined so Zod's optional URL passes.
            sampleUrl: v.sampleUrl?.trim() || undefined,
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
            placeholder="What's the name of your product?"
          />
          <TextareaInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 255))}
            required
            rows={3}
            placeholder="Describe what's included and who it's for"
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

        {/* Imagery — mint accent because it's the section the preview
            mirrors most directly. */}
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
                  <TagIcon className="inline h-3 w-3 mr-1 -mt-0.5" />
                  {t.tagName}
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Variants */}
        <FormSection
          title={`Variants (${variants.length}/5)`}
          description="A product can have multiple SKUs (e.g. download vs license key) at different prices."
        >
          {variants.map((v, i) => (
            <VariantRow
              key={i}
              index={i}
              value={v}
              onChange={(patch) => updateVariant(i, patch)}
              onRemove={() => removeVariant(i)}
              removable={variants.length > 1}
            />
          ))}
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
            {busy ? "Creating…" : "Create product →"}
          </GlassButton>
        </div>
      </div>

      {/* Right column — sticky live preview on desktop, inline below the
          form on mobile. Sticky only kicks in at `lg` because below that
          the preview lives in row 2 of the single-column grid where
          stickiness isn't useful. */}
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
