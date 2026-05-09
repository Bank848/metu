"use client";
import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Upload, X, ImageIcon, ZoomIn, ZoomOut, Check } from "lucide-react";
import { cn, isDataUrl } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB upload limit
const MAX_OUTPUT_PX = 1200;         // max dimension after crop

type AspectPreset = "square" | "wide" | "cover" | "portrait";

const ASPECT_MAP: Record<AspectPreset, number> = {
  square:   1,
  wide:     16 / 9,
  cover:    8 / 3,
  portrait: 4 / 5,
};

async function getCroppedDataUrl(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxPx = MAX_OUTPUT_PX,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });

  const scale = Math.min(1, maxPx / Math.max(pixelCrop.width, pixelCrop.height));
  const outW = Math.round(pixelCrop.width * scale);
  const outH = Math.round(pixelCrop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.88);
}

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  aspect?: AspectPreset | number;
  recommended?: { w: number; h: number };
  helperText?: string;
  maxSizeMB?: number;
  dropZoneClassName ?: string,
}

export function FileImageInput({
  label,
  value,
  onChange,
  aspect = "square",
  recommended,
  helperText,
  maxSizeMB = 5,
  dropZoneClassName,
}: Props) {
  const aspectRatio: number =
    typeof aspect === "number"
      ? (isNaN(aspect) || aspect <= 0 ? 1 : aspect)
      : (ASPECT_MAP[aspect] ?? 1);

  const isWide = aspectRatio > 1.2;

  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Cropper state
  const [tempSrc, setTempSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);
  const [cropping, setCropping] = useState(false);

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedPixels(pixels);
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please pick a PNG or JPEG image.");
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMB} MB limit.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTempSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.onerror = () => setError("Couldn't read that file. Try another.");
    reader.readAsDataURL(file);
    // reset so same file can be picked again
    e.target.value = "";
  }

  async function confirmCrop() {
    if (!tempSrc || !croppedPixels) return;
    setCropping(true);
    try {
      const dataUrl = await getCroppedDataUrl(tempSrc, croppedPixels);
      onChange(dataUrl);
      setTempSrc(null);
    } catch {
      setError("Crop failed. Try again.");
    } finally {
      setCropping(false);
    }
  }

  return (
    <>
      <div className="space-y-2 w-full h-full">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</span>
        </div>

        <div
          className={cn(
            "group relative rounded-xl overflow-hidden bg-zinc-950 border-2 border-dashed border-zinc-800",
            "flex items-center justify-center cursor-pointer",
            "hover:border-amber-400/40 transition-all duration-300",
            !dropZoneClassName && (isWide ? "h-32 w-full" : "h-[7.5rem] w-[7.5rem]"),
            dropZoneClassName,
          )}
          onClick={() => fileRef.current?.click()}
        >
          {value ? (
            <>
              <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <Upload className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400">Replace</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-zinc-400 hover:text-white hover:bg-red-500/80 transition z-10"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-3 select-none">
              <ImageIcon className="h-5 w-5 text-zinc-700 group-hover:text-amber-400 transition shrink-0" strokeWidth={1.5} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 group-hover:text-amber-400/80 transition">
                Upload
              </span>
              {recommended && (
                <span className="text-[9px] font-mono text-zinc-600 leading-tight">
                  {recommended.w}×{recommended.h}
                </span>
              )}
              <div className={cn(
                "flex flex-col items-center gap-0.5 text-[9px] font-mono text-zinc-700 leading-tight",
                isWide && "flex-row gap-1.5",
              )}>
                <span>PNG / JPEG</span>
                {isWide && <span className="text-zinc-800">·</span>}
                <span>Max {maxSizeMB} MB</span>
              </div>
              {helperText && (
                <span className="text-[9px] text-zinc-600 text-center leading-tight">{helperText}</span>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFileChange} />
      </div>

      {tempSrc && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 gap-6">
          <div
            className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800"
            style={{ aspectRatio: aspectRatio < 1.5 ? "1/1" : "16/7" }}
          >
            <Cropper
              image={tempSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              showGrid
              style={{ containerStyle: { borderRadius: "1rem" } }}
            />
          </div>

          {/* zoom + actions unchanged */}
                    <div className="flex items-center gap-3 w-full max-w-2xl">
            <ZoomOut className="h-4 w-4 text-zinc-500 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-amber-400 h-1"
            />
            <ZoomIn className="h-4 w-4 text-zinc-500 shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setTempSrc(null)}
              className="flex-1 py-3.5 rounded-xl bg-zinc-800 text-sm font-bold text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={cropping}
              className="flex-1 py-3.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-bold hover:bg-amber-300 transition shadow-[0_0_24px_rgba(251,191,36,0.25)] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {cropping ? (
                "Processing…"
              ) : (
                <>
                  <Check className="h-4 w-4" /> Confirm Crop
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
