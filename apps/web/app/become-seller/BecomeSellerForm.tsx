"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/forms/FormSection";
import { TextInput } from "@/components/forms/TextInput";
import { TextareaInput } from "@/components/forms/TextareaInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { Camera, ZoomIn, ZoomOut, Check, ImageIcon } from "lucide-react";

// ─── Crop util ───────────────────────────────────────────────────────────────
const MAX_OUTPUT_PX = 1200;
const MAX_MB = 5;

async function getCroppedDataUrl(
  src: string,
  pixels: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const scale = Math.min(1, MAX_OUTPUT_PX / Math.max(pixels.width, pixels.height));
  const w = Math.round(pixels.width * scale);
  const h = Math.round(pixels.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

// ─── Crop modal ──────────────────────────────────────────────────────────────
function CropModal({
  src,
  aspect,
  onConfirm,
  onCancel,
}: {
  src: string;
  aspect: number;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: any, p: any) => setPixels(p), []);

  async function confirm() {
    if (!pixels) return;
    setBusy(true);
    const url = await getCroppedDataUrl(src, pixels);
    onConfirm(url);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 gap-6">
      <div
        className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800"
        style={{ aspectRatio: aspect < 1.5 ? "1/1" : "16/7" }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          showGrid
        />
      </div>
      <div className="flex items-center gap-3 w-full max-w-2xl">
        <ZoomOut className="h-4 w-4 text-zinc-500 shrink-0" />
        <input
          type="range" min={1} max={3} step={0.05} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-amber-400 h-1"
        />
        <ZoomIn className="h-4 w-4 text-zinc-500 shrink-0" />
      </div>
      <div className="flex gap-3 w-full max-w-2xl">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl bg-zinc-800 text-sm font-bold text-zinc-300 hover:bg-zinc-700 transition">
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={busy}
          className="flex-1 py-3.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-bold hover:bg-amber-300 transition shadow-[0_0_24px_rgba(251,191,36,0.25)] flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? "Processing…" : <><Check className="h-4 w-4" /> Confirm Crop</>}
        </button>
      </div>
    </div>
  );
}

// ─── Clickable image zone (no visible input chrome) ──────────────────────────
function ImageZone({
  value,
  onChange,
  aspect,
  className,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  aspect: number;
  className?: string;
  children: React.ReactNode; // placeholder UI
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tempSrc, setTempSrc] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFileError("PNG or JPEG only"); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setFileError(`Max ${MAX_MB} MB`); return; }
    const reader = new FileReader();
    reader.onload = () => setTempSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <>
      <div
        className={`group relative cursor-pointer ${className ?? ""}`}
        onClick={() => fileRef.current?.click()}
      >
        {children}
        {/* hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-[inherit]">
          <Camera className="h-5 w-5 text-white" />
          <span className="text-xs font-bold text-white">{value ? "Replace" : "Upload"}</span>
        </div>
        {fileError && (
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-red-400 bg-black/80 px-2 py-0.5 rounded whitespace-nowrap">
            {fileError}
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFileChange} />
      {tempSrc && (
        <CropModal
          src={tempSrc}
          aspect={aspect}
          onConfirm={(url) => { onChange(url); setTempSrc(null); }}
          onCancel={() => setTempSrc(null)}
        />
      )}
    </>
  );
}

// ─── Inline store preview with embedded image inputs ─────────────────────────
function InlineStorePreview({
  name,
  description,
  profileImage,
  coverImage,
  onProfileChange,
  onCoverChange,
}: {
  name: string;
  description: string;
  profileImage: string;
  coverImage: string;
  onProfileChange: (v: string) => void;
  onCoverChange: (v: string) => void;
}) {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">

      {/* Cover — clickable upload zone */}
      <ImageZone
        value={coverImage}
        onChange={onCoverChange}
        aspect={8 / 3}
        className="relative w-full"
      >
        <div className="w-full" style={{ paddingBottom: "37.5%" /* 8:3 ratio */ }}>
          {coverImage ? (
            <img
              src={coverImage}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-2 border-b border-zinc-800">
              <ImageIcon className="h-8 w-8 text-zinc-700" strokeWidth={1.5} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-600">
                Click to upload cover
              </span>
              <span className="text-[9px] font-mono text-zinc-700">1600×600 · 8:3 banner · PNG/JPEG · max 5 MB</span>
            </div>
          )}
        </div>
      </ImageZone>

      {/* Profile + store info row */}
      <div className="px-6 pb-5">
        <div className="flex items-end gap-4 -mt-8 mb-4">

          {/* Avatar — clickable upload zone */}
          <ImageZone
            value={profileImage}
            onChange={onProfileChange}
            aspect={1}
            className="shrink-0 rounded-xl overflow-hidden border-2 border-zinc-950 bg-zinc-900 h-20 w-20"
          >
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <Camera className="h-5 w-5 text-zinc-600" />
              </div>
            )}
          </ImageZone>

          {/* Hint labels under the avatar */}
          <div className="pb-0.5 flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-zinc-600 leading-none">400×400 · avatar</span>
            <span className="text-[9px] font-mono text-zinc-700 leading-none">PNG/JPEG · max 5 MB</span>
          </div>
        </div>

        {/* Store name */}
        <p className={`font-bold text-lg leading-tight ${name ? "text-white" : "text-zinc-600 italic"}`}>
          {name || "Your store name"}
        </p>

        {/* Description */}
        <p className={`text-sm mt-1 line-clamp-2 ${description ? "text-zinc-400" : "text-zinc-700 italic"}`}>
          {description || "Your store description will appear here…"}
        </p>
      </div>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type BusinessType = { typeId: number; name: string; description: string };

// ─── Main form ───────────────────────────────────────────────────────────────
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
    <form onSubmit={submit} className="flex flex-col gap-6 max-w-6xl mx-auto w-full">

      {/* ── Live preview with embedded image inputs ───────────────────────── */}
      <InlineStorePreview
        name={form.name}
        description={form.description}
        profileImage={form.profileImage}
        coverImage={form.coverImage}
        onProfileChange={(v) => setForm({ ...form, profileImage: v })}
        onCoverChange={(v) => setForm({ ...form, coverImage: v })}
      />

      {/* ── Text / select fields ─────────────────────────────────────────── */}
      <div className="space-y-6">
        <FormSection
          title="Identity"
          description="What you call your store and what kind of business it is."
        >
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
            options={businessTypes.map((b) => ({ value: String(b.typeId), label: b.name }))}
          />
        </FormSection>

        <FormSection
          title="Storefront"
          description="A pitch for your store."
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
        </FormSection>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating store…" : "Open my store →"}
        </Button>
      </div>
    </form>
  );
}