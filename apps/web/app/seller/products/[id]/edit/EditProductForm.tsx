"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { TextareaInput } from "@/components/forms/TextareaInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { VariantRow, type VariantRowValue } from "@/components/forms/VariantRow";
import { AdditionalDetailRow, type AdditionalDetailRowValue } from "@/components/forms/AdditionalDetailRow";
import { PreviewPane } from "@/components/forms/PreviewPane";
import TagInput from "@/components/TagInput";

type Category = { categoryId: number; categoryName: string };
type Tag = { tagId: number; tagName: string; productCount: number };

type Variant = VariantRowValue;
type AdditionalDetail = AdditionalDetailRowValue;

type Initial = {
  name: string;
  description: string;
  categoryId: number;
  images: string[];
  tagNames: string[];
  items: Variant[];
  isStackable: boolean;
  details: { detailName: string; detailValue: string }[];
};

const DEFAULT_VARIANT: Variant = {
  name: "Unnamed Product",
  deliveryMethod: "download",
  price: 100,
  discountPercent: 0,
  discountAmount: 0,
};


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
  mode?: Mode;
  storeId?: number;
}) {

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
  const [tagNames, setTagNames] = useState<string[]>(initial.tagNames);
  const [details, setDetails] = useState<AdditionalDetail[]>(initial.details ?? []);
  const [variants, setVariants] = useState<Variant[]>(initial.items ?? []);
  const [isStackable, setIsStackable] = useState(initial.isStackable);

  const existingVariantCount = initial.items.length;

  // isStackable gates same as the new-product form — only meaningful
  // when every variant is license_key (buyer can collect multiple
  // keys). Anything else and "two copies of the same download" makes
  // no sense, so force-uncheck and disable.
  const allLicenseKey = variants.length > 0 && variants.every(
    (v) => v.deliveryMethod === "license_key",
  );
  useEffect(() => {
    if (!allLicenseKey && isStackable) setIsStackable(false);
  }, [allLicenseKey, isStackable]);

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
    if (i < existingVariantCount) return;
    if (variants.length > 1) setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateDetail(i: number, patch: Partial<AdditionalDetail>) {
    setDetails((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDetail() {
    if (details.length < 6) setDetails((prev) => [...prev, { detailName: "", detailValue: "" }]);
  }
  function removeDetail(i: number) {
    setDetails((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanImages = images.map((u) => u.trim()).filter(Boolean);
  const rawPrices = variants.map((v) => v.price);
  const discountedPrices = variants.map((v) => v.price * (1 - v.discountPercent / 100));
  const minPrice = Math.min(...discountedPrices);
  const maxPrice = Math.max(...discountedPrices);
  const minRaw = Math.min(...rawPrices);
  const maxRaw = Math.max(...rawPrices);
  const previewDiscount = variants.length ? Math.max(...variants.map((v) => v.discountPercent)) : 0;

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
          tags: tagNames,
          isStackable,
          details: details
            .filter((d) => d.detailName?.trim() || d.detailValue?.trim())
            .map((d) => ({
              detailName: d.detailName?.trim().slice(0, 80) ?? "",
              detailValue: d.detailValue?.trim().slice(0, 255) ?? "",
            })),
          items: variants.map((v) => ({
            name: v.name?.trim() || name.trim(),
            description: v.description?.trim() || description.trim(),
            image: v.image && v.image.trim() !== "" ? v.image.trim() : null,
            deliveryMethod: v.deliveryMethod,
            quantity: v.quantity ?? null,
            price: v.price,
            discountPercent: v.discountPercent,
            discountAmount: (v.price * v.discountPercent) / 100,
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

        {/* Imagery — grid layout matching NewProductForm */}
        <FormSection
          title={`Imagery (${images.length}/5)`}
          description="The first image becomes the cover."

        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((url, i) => (
              <div key={i} className="relative group flex flex-col gap-1.5">
                <FileImageInput
                  label={i === 0 ? "Cover" : `Image ${i + 1}`}
                  value={url}
                  onChange={(v) => updateImage(i, v)}
                  aspect="wide"
                  dropZoneClassName="w-full aspect-[3/2]"
                />
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-6 right-1 p-1 rounded-full bg-black/70 text-zinc-400 hover:text-white hover:bg-red-500/80 transition opacity-0 group-hover:opacity-100 z-20"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {images.length < 5 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-transparent select-none">
                  Add
                </span>
                <button
                  type="button"
                  onClick={addImage}
                  className="w-full aspect-[3/2] border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-600 hover:border-mint/50 hover:text-mint transition-colors bg-zinc-950"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">Add</span>
                </button>
              </div>
            )}
          </div>
        </FormSection>

        {/* Tags */}
        <FormSection
          title="Tags"
          description="Type to autocomplete. Suggestions are sorted by popularity."
        >
          <TagInput
            selected={tagNames}
            onChange={setTagNames}
            options={tags}
          />
        </FormSection>

        {/* Additional Details — now uses AdditionalDetailRow component */}
        <FormSection
          title={`Additional Details (${details.length}/6)`}
          description="Optional spec sheet — name + value pairs. Buyers see this on the product page (e.g. Format · PNG/JPG)."
        >
          {details.map((d, i) => (
            <AdditionalDetailRow
              key={i}
              index={i}
              value={d}
              onChange={(patch) => updateDetail(i, patch)}
              onRemove={() => removeDetail(i)}
              removable={details.length > 1}
            />
          ))}
          {details.length < 6 && (
            <button
              type="button"
              onClick={addDetail}
              className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add Detail
            </button>
          )}
        </FormSection>

        {/* Variants */}
        <FormSection
          title={`Variants (${variants.length}/6)`}
          description="A product can have multiple SKUs (e.g. download vs license key) at different prices."
        >
          {existingVariantCount > 0 && (
            <div className="surface-accent rounded-xl px-4 py-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-mint mt-0.5 shrink-0" />
              <p className="text-xs text-ink-secondary leading-relaxed">
                Variants with sales history are{" "}
                <span className="text-mint font-semibold">locked</span> —
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
          {variants.length < 6 && (
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add variant
            </button>
          )}
        </FormSection>

        <FormSection title="Purchase rules">
          <label className={`flex items-start gap-3 ${allLicenseKey ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <input
              type="checkbox"
              checked={isStackable}
              onChange={(e) => setIsStackable(e.target.checked)}
              disabled={!allLicenseKey}
              className="mt-1 h-4 w-4 accent-metu-yellow shrink-0 disabled:cursor-not-allowed"
            />
            <span className="block">
              <span className="block text-sm font-semibold text-white">
                Allow multiple purchases per order
              </span>
              <span className="block text-xs text-ink-dim mt-0.5">
                Only meaningful for <strong>license key</strong> variants —
                buyer collects multiple keys. For downloads / streaming /
                email-attachment, holding two copies of the same file is
                nonsense, so this is locked off.
              </span>
              {!allLicenseKey && (
                <span className="mt-1.5 inline-block text-[11px] text-amber-300/80 font-mono">
                  ⚠ Switch every variant to <span className="font-bold">license_key</span> to enable this.
                </span>
              )}
            </span>
          </label>
        </FormSection>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-3 justify-end">
          <GlassButton tone="glass" size="lg" href={cancelHref}>Cancel</GlassButton>
          <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes →"}
          </GlassButton>
        </div>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <PreviewPane
          variant="product"
          state={{
            name,
            description,
            minPrice,
            maxPrice: maxPrice !== minPrice ? maxPrice : undefined,
            originalMinPrice: minRaw,
            originalMaxPrice: maxRaw,
            image: cleanImages[0] ?? "",
            discountPercent: previewDiscount > 0 ? previewDiscount : undefined,
            tags: tagNames.length > 0 ? tagNames : undefined,
            details: details.filter((d) => d.detailName || d.detailValue),
          }}
        />
      </div>
    </form>
  );
}