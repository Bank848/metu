"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
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

const DEFAULT_VARIANT: Variant = {
  name: "Unnamed Product",
  deliveryMethod: "download",
  price: 100,
  discountPercent: 0,
  discountAmount: 0,
};

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
  const [details, setDetails] = useState<AdditionalDetail[]>([]);
  const [isStackable, setIsStackable] = useState(false);

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

  function updateDetail(i: number, patch: Partial<AdditionalDetail>) {
    setDetails((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addDetail() {
    if (details.length < 6) setDetails((prev) => [...prev, { detailName: "", detailValue: "" }]);
  }
  function removeVariant(i: number) {
    if (variants.length > 1) setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }
  function removeDetail(i: number) {
    if (details.length > 1) setDetails((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanImages = images.map((u) => u.trim()).filter(Boolean);
  const rawPrices = variants.map((v) => v.price);
  const discountedPrices = variants.map((v) => v.price * (1 - v.discountPercent / 100));
  const minPrice = Math.min(...discountedPrices);
  const maxPrice = Math.max(...discountedPrices);
  const minRaw = Math.min(...rawPrices);
  const maxRaw = Math.max(...rawPrices);

  const previewDiscount = variants.length
    ? Math.max(...variants.map((v) => v.discountPercent))
    : 0;
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
          isStackable,
          details: details
            .filter((d) => d.detailName?.trim() || d.detailValue?.trim())
            .map((d) => ({
              detailName: d.detailName?.trim() ?? "",
              detailValue: d.detailValue?.trim() ?? "",
            })),
          items: variants.map((v) => ({
            name: v.name?.trim() || name.trim(),
            description: v.description?.trim() || undefined,
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
        <FormSection title="Basics" description="Your product information">
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
                {/* Spacer matches the label height from FileImageInput */}
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
            selectedIds={tagIds}
            onChange={setTagIds}
            options={tags}
          />
        </FormSection>

        <FormSection
          title={`Additional Details (${details.length}/6)`}
          description="A product can have multiple SKUs (e.g. download vs license key) at different prices."
        >
          {details.map((v, i) => (
            <AdditionalDetailRow
              key={i}
              index={i}
              value={v}
              onChange={(patch) => updateDetail(i, patch)}
              onRemove={() => removeDetail(i)}
              removable={details.length > 1}
            />
          ))}
          {details.length < 6 && (
            <button type="button" onClick={addDetail} className="inline-flex items-center gap-1.5 text-sm text-mint hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add Detail
            </button>
          )}
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

        <FormSection title="Purchase rules">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isStackable}
              onChange={(e) => setIsStackable(e.target.checked)}
              className="mt-1 h-4 w-4 accent-metu-yellow shrink-0"
            />
            <span className="block">
              <span className="block text-sm font-semibold text-white">
                Allow multiple purchases per order
              </span>
              <span className="block text-xs text-ink-dim mt-0.5">
                Buyers can add more than one of this product. Best for license
                keys or consumables. Single-buy downloads should leave this off.
              </span>
            </span>
          </label>
        </FormSection>

        {error && <p className="text-sm text-coral">{error}</p>}

        <div className="flex gap-3 justify-end">
          <GlassButton tone="glass" size="lg" href="/seller/products">Cancel</GlassButton>
          <GlassButton tone="gold" size="lg" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create product →"}
          </GlassButton>
        </div>
      </div>


      <div className="lg:sticky lg:top-24 lg:self-start">
        <PreviewPane
        variant="product"
        state={{
          name,
          description,
          minPrice,           // 500  (discounted)
          maxPrice: maxPrice !== minPrice ? maxPrice : undefined,  // 1750 (discounted)
          originalMinPrice: minRaw,   // 1000
          originalMaxPrice: maxRaw,   // 2500
          image: cleanImages[0] ?? "",
          discountPercent: previewDiscount > 0 ? previewDiscount : undefined,
          tags: tagNames.length > 0 ? tagNames : undefined,
          details: details.filter(d => d.detailName || d.detailValue),
        }}
      />
      </div>
    </form>
  );
}
