"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileImageInput } from "@/components/FileImageInput";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { TextareaInput } from "@/components/forms/TextareaInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { PreviewPane } from "@/components/forms/PreviewPane";

type BusinessType = { typeId: number; name: string; description: string };

/**
 * Phase 10 / Step 3a — onboarding form rebuilt against Step 2 primitives.
 *
 * Two `<FormSection>` blocks: Identity (name, business type) and
 * Storefront (description, profile + cover imagery — mint surface so the
 * "this is what shoppers see" section reads as the celebratory part).
 *
 * The right rail mirrors EditStoreForm's preview by using the shared
 * `<PreviewPane variant="store">` so first-time sellers see exactly the
 * card their store will become — same component, same markup as the
 * editing flow they'll use forever after.
 */
export function BecomeSellerForm({ businessTypes }: { businessTypes: BusinessType[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    businessTypeId: businessTypes[0]?.typeId ?? 0,
    profileImage: "",
    coverImage: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seller/become-seller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          profileImage: form.profileImage || undefined,
          coverImage: form.coverImage || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to create store");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/seller");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6 min-w-0">
        <FormSection title="Identity" description="What you call your store and what kind of business it is.">
          <TextInput
            label="Store name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={60}
            required
            placeholder="Your store name…"
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
          title="Storefront"
          description="A pitch and two images. The preview on the right updates as you type."
          accent="mint"
          variant="accent"
        >
          <TextareaInput
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 255) })}
            maxLength={255}
            required
            rows={3}
            placeholder="Tell shoppers what makes your store unique"
            helperText={`${form.description.length} / 255`}
          />
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
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating store…" : "Open my store →"}
        </Button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <PreviewPane
          variant="store"
          state={{
            name: form.name,
            description: form.description,
            profileImage: form.profileImage,
            coverImage: form.coverImage,
          }}
        />
      </div>
    </form>
  );
}
