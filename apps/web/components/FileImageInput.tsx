"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1_000_000; // 1 MB safeguard — DB stores as TEXT (data URL)

/**
 * Image input that accepts EITHER a public URL OR a file upload.
 * On upload, the file is read as a base64 data URL and emitted via onChange
 * so the parent can store it in the DB's TEXT column. No external bucket
 * is required, which keeps the demo deployable on Vercel free tier.
 *
 * Recommended dimensions are surfaced inline so sellers know what to upload.
 */
export function FileImageInput({
  label,
  value,
  onChange,
  recommended,
  aspect = "square",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  recommended: { w: number; h: number; note?: string };
  aspect?: "square" | "wide";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"url" | "upload">(value?.startsWith("data:") ? "upload" : "url");
  const [error, setError] = useState<string | null>(null);

  function pickFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is ${Math.round(file.size / 1024)} KB — please pick one under 1 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.onerror = () => setError("Couldn't read that file. Try another.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-[10px] text-ink-dim font-mono">
          recommended {recommended.w}×{recommended.h}
          {recommended.note ? ` · ${recommended.note}` : ""}
        </span>
      </div>

      {/* Tab toggle */}
      <div className="inline-flex gap-1 p-1 rounded-full bg-surface-3 border border-white/8">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold rounded-full transition inline-flex items-center gap-1",
            mode === "upload" ? "button-gradient text-surface-1" : "text-ink-secondary hover:text-white",
          )}
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold rounded-full transition inline-flex items-center gap-1",
            mode === "url" ? "button-gradient text-surface-1" : "text-ink-secondary hover:text-white",
          )}
        >
          <LinkIcon className="h-3 w-3" /> Paste URL
        </button>
      </div>

      <div className={cn(
        "relative grid gap-3",
        aspect === "wide" ? "grid-cols-1" : "md:grid-cols-[120px_1fr]",
      )}>
        {/* Preview */}
        <div
          className={cn(
            "relative rounded-xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center",
            aspect === "wide" ? "aspect-[5/2]" : "aspect-square",
          )}
        >
          {value ? (
            <>
              <Image src={value} alt="" fill sizes="200px" className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Remove image"
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-surface-1/80 text-white hover:bg-metu-red/30"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImageIcon className="h-8 w-8 text-ink-dim/40" strokeWidth={1.5} />
          )}
        </div>

        {/* Field */}
        <div className="flex-1">
          {mode === "upload" ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-white/15 bg-surface-2 hover:border-metu-yellow/50 hover:bg-white/[0.03] py-6 text-sm text-ink-secondary text-center transition"
              >
                <Upload className="h-5 w-5 mx-auto mb-1 text-metu-yellow" />
                <div className="font-semibold text-white">Click to upload</div>
                <div className="text-[10px] text-ink-dim mt-0.5">
                  PNG, JPG, or WebP · up to 1 MB
                </div>
              </button>
            </>
          ) : (
            <input
              value={value.startsWith("data:") ? "" : value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://images.unsplash.com/photo-…"
              className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
            />
          )}
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>
      </div>
    </div>
  );
}
