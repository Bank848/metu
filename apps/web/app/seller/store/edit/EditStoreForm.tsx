"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Store as StoreIcon } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { FileImageInput } from "@/components/FileImageInput";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { TextareaInput } from "@/components/forms/TextareaInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { PreviewPane } from "@/components/forms/PreviewPane";

type BusinessType = { typeId: number; name: string };

type StoreForm = {
  storeId: number;
  name: string;
  description: string;
  businessTypeId: number;
  profileImage: string;
  coverImage: string;
};

/**
 * Phase 10 / Step 3a — refactored against Step 2 primitives.
 *
 * The original form hand-rolled a live preview block at the top of the
 * page. We now lean on `<PreviewPane variant="store">` (which lifted that
 * exact markup at component-build time) so future changes to the store
 * card propagate automatically.
 *
 * Two `<FormSection>` blocks: Store details (default surface) and Imagery
 * (mint surface-accent — same accent the new product form uses for its
 * imagery block, so the seller flow has a consistent visual language).
 */
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
      {/* Live preview — the same `<PreviewPane variant="store">` the
          become-seller flow uses, so the two screens stay in lockstep. */}
      <PreviewPane
        variant="store"
        state={{
          name: form.name,
          description: form.description,
          profileImage: form.profileImage,
          coverImage: form.coverImage,
        }}
      />

      <FormSection title="Store details" description="What buyers see at the top of your storefront.">
        <TextInput
          label="Store name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          minLength={2}
          maxLength={60}
        />
        <TextareaInput
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
          required
          rows={3}
          helperText={`${form.description.length} / 255`}
        />
        <SelectInput
          label="Business type"
          value={form.businessTypeId}
          onChange={(e) => setForm({ ...form, businessTypeId: Number(e.target.value) })}
          options={businessTypes.map((b) => ({
            value: String(b.typeId),
            label: b.name,
          }))}
        />
      </FormSection>

      <FormSection
        title="Imagery"
        description="Upload from your device or paste a public image URL — preview at the top updates instantly."
        accent="mint"
        variant="accent"
      >
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
      </FormSection>

      {error && <p className="text-sm text-coral">{error}</p>}
      {ok && (
        <p className="text-sm text-mint inline-flex items-center gap-1.5">
          <StoreIcon className="h-3.5 w-3.5" />
          Saved. Visit your storefront to see the changes.
        </p>
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
