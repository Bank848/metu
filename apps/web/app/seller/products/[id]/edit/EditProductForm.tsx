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
  isStackable: boolean;
  // CPE241 Business Rule 4g — up to 7 freeform key/value rows
  // (e.g. "Format" / "PNG/JPG", "License" / "Personal use"). Optional;
  // empty array means the seller didn't fill any in.
  details: { detailName: string; detailValue: string }[];
};

const DEFAULT_VARIANT: Variant = {
  deliveryMethod: "download",
  quantity: 999,
  price: 990,
  discountPercent: 0,
  discountAmount: 0,
};

/**
 * Edit form for an existing product — mirrors NewProductForm. Submits
 * via PATCH; existing variants can't be deleted because OrderItem and
 * CartItem FK into them. A mint info banner above Variants explains
 * the lock to sellers.
 */
type Mode = "seller" | "admin";

export function EditProductForm({
  productId,
  initial,
  categories,
  tags,
  mode = "seller",
  storeId,
}: {
  productId: number;
  initial: Initial;
  categories: Category[];
  tags: Tag[];
  /** "admin" routes through /api/admin/stores/:storeId/products/:productId
      and writes an admin-prefixed audit row; default "seller" hits the
      session-scoped /api/seller/products/:productId. */
  mode?: Mode;
  /** Required when mode="admin" — used to build the admin endpoint URL
      and the cancel-button href. Ignored for seller mode. */
  storeId?: number;
}) {
  // Endpoint + cancel target keyed off mode. The form layout is the
  // same in both contexts; only the API target and the secondary CTA
  // differ.
  const endpoint =
    mode === "admin"
      ? `/api/admin/stores/${storeId}/products/${productId}`
      : `/api/seller/products/${productId}`;
  const cancelHref =
    mode === "admin" ? `/admin/stores/${storeId}` : "/seller/products";
  const onSavedHref =
    mode === "admin" ? `/admin/stores/${storeId}` : "/seller/products";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<number>(initial.categoryId);
  const [images, setImages] = useState<string[]>(initial.images.length ? initial.images : [""]);
  const [tagIds, setTagIds] = useState<number[]>(initial.tagIds);
  const [details, setDetails] = useState<{ detailName: string; detailValue: string }[]>(
    initial.details ?? [],
  );

  function addDetail() {
    if (details.length < 7) {
      setDetails((prev) => [...prev, { detailName: "", detailValue: "" }]);
    }
  }
  function updateDetail(i: number, patch: Partial<{ detailName: string; detailValue: string }>) {
    setDetails((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function removeDetail(i: number) {
    setDetails((prev) => prev.filter((_, idx) => idx !== i));
  }
  const [variants, setVariants] = useState<Variant[]>(initial.items.length ? initial.items : [{ ...DEFAULT_VARIANT }]);
  // when false, buyers can't re-purchase this product.
  // Default seeded from props; the checkbox lets the seller override
  // the delivery-method-based default (license_key = stackable, the
  // rest = single-copy).
  const [isStackable, setIsStackable] = useState<boolean>(initial.isStackable);
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
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          categoryId,
          images: cleanImages,
          tagIds,
          isStackable,
          details: details
            .filter((d) => d.detailName.trim() && d.detailValue.trim())
            .map((d) => ({
              detailName: d.detailName.trim().slice(0, 80),
              detailValue: d.detailValue.trim().slice(0, 255),
            })),
          items: variants.map((v) => ({
            ...v,
            discountAmount: (v.price * v.discountPercent) / 100,
            sampleUrl: v.sampleUrl?.trim() || undefined,
            deliveryUrl: v.deliveryUrl?.trim() || undefined,
            licenseKeyTemplate: v.licenseKeyTemplate?.trim() || undefined,
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
      router.push(onSavedHref);
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

        {/* CPE241 Business Rule 4g — up to 7 freeform key/value rows
            for product specs, license terms, file formats, etc. Empty
            rows are filtered out at submit. */}
        <FormSection
          title={`Additional details (${details.length}/7)`}
          description="Optional spec sheet — name + value pairs. Buyers see this on the product page (e.g. Format · PNG/JPG)."
        >
          {details.length > 0 && (
            <div className="space-y-2">
              {details.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={d.detailName}
                    onChange={(e) => updateDetail(i, { detailName: e.target.value.slice(0, 80) })}
                    placeholder="Format"
                    className="flex-[1] rounded-xl border border-line bg-space-900 px-3 py-2 text-sm text-white outline-none focus:border-metu-yellow"
                    maxLength={80}
                  />
                  <input
                    type="text"
                    value={d.detailValue}
                    onChange={(e) => updateDetail(i, { detailValue: e.target.value.slice(0, 255) })}
                    placeholder="PNG / JPG · 300 DPI · sRGB"
                    className="flex-[2] rounded-xl border border-line bg-space-900 px-3 py-2 text-sm text-white outline-none focus:border-metu-yellow"
                    maxLength={255}
                  />
                  <button
                    type="button"
                    onClick={() => removeDetail(i)}
                    className="text-ink-dim hover:text-coral p-2 shrink-0"
                    aria-label="Remove detail row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {details.length < 7 && (
            <button
              type="button"
              onClick={addDetail}
              className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          )}
        </FormSection>

        {/* Stackable products (license keys etc.) can be re-bought;
            single-copy products are blocked from repeat orders. */}
        <FormSection
          title="Purchase rule"
          description="Whether the same buyer can buy this product more than once."
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isStackable}
              onChange={(e) => setIsStackable(e.target.checked)}
              className="mt-1 h-4 w-4 accent-metu-yellow shrink-0"
            />
            <span className="text-sm text-ink-secondary">
              <span className="font-semibold text-white">
                Allow customers to buy this product more than once
              </span>
              <br />
              Default behaviour is based on delivery method —{" "}
              <code className="text-metu-yellow">license_key</code> products
              are stackable, the rest (download / streaming / email) are
              single-copy. Override here if you sell multi-pack license
              keys, custom briefs, or anything else where a repeat purchase
              from the same buyer is meaningful.
            </span>
          </label>
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
            // Informational banner shown on every edit of a product with
            // sales history; mint surface keeps it from reading destructive.
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
          <GlassButton tone="glass" size="lg" href={cancelHref}>Cancel</GlassButton>
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
