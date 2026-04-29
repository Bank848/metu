"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Maximize,
  RotateCcw,
  Download,
  ImageDown,
} from "lucide-react";

import { ER_ENTITIES, ER_RELATIONSHIPS, type ErEntity } from "@/lib/admin/er-schema";
import { layoutEr, type LayoutResult } from "@/lib/admin/er-layout";
import { CATEGORY_STYLE, ENTITY_CATEGORY } from "@/lib/admin/er-categories";
import { ErEntityCard } from "./ErEntityCard";
import { ErConnectorPath, ErMarkers } from "./ErConnectorPath";
import { CategoryLegend } from "./CategoryLegend";

/**
 * Phase 24 — in-house ER diagram renderer.
 *
 * Layout chain:
 *   schema.prisma → er-schema.ts (build-time generator)
 *                 → layoutEr() (dagre wrapper)
 *                 → ErEntityCard (per-table HTML overlay)
 *                 + SVG <path> (FK connectors with crow-foot markers)
 *
 * Pan/zoom via CSS transform. Export via SVG serialization →
 * download (SVG) or canvas blob (PNG).
 */

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

export function ErDiagramView() {
  // Compute layout once — schema is build-time constant so this is
  // deterministic and never changes during the page's lifetime.
  const layout = useMemo<LayoutResult>(
    () => layoutEr(ER_ENTITIES, ER_RELATIONSHIPS),
    [],
  );
  const entityById = useMemo(() => {
    const m = new Map<string, ErEntity>();
    for (const e of ER_ENTITIES) m.set(e.table, e);
    return m;
  }, []);

  // Pan/zoom state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformLayerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  }>({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // Center the diagram on first mount.
  useEffect(() => {
    fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitToScreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const padding = 40;
    const sx = (cw - padding * 2) / Math.max(1, layout.width);
    const sy = (ch - padding * 2) / Math.max(1, layout.height);
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(sx, sy)));
    setScale(s);
    setTx((cw - layout.width * s) / 2);
    setTy((ch - layout.height * s) / 2);
  }, [layout.width, layout.height]);

  const reset = useCallback(() => {
    setScale(1);
    setTx(40);
    setTy(40);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const c = containerRef.current;
      if (!c) return;
      const cx = c.clientWidth / 2;
      const cy = c.clientHeight / 2;
      setScale((prev) => {
        const next = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, +(prev * factor).toFixed(3)),
        );
        // Zoom around viewport center
        setTx((px) => cx - ((cx - px) * next) / prev);
        setTy((py) => cy - ((cy - py) * next) / prev);
        return next;
      });
    },
    [],
  );

  // Mouse wheel zoom (Ctrl required so plain wheel still scrolls page)
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomBy(factor);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // Drag-pan
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Only start a pan if the mousedown originated on the canvas
    // background — clicks on entity cards / buttons should not pan.
    const target = e.target as HTMLElement;
    if (target.closest("[data-er-entity]") || target.closest("button")) return;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTx: tx,
      startTy: ty,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragStateRef.current;
    if (!s.active) return;
    setTx(s.startTx + (e.clientX - s.startX));
    setTy(s.startTy + (e.clientY - s.startY));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Export — serialize the diagram as an SVG with HTML entity cards
  // embedded via <foreignObject>. Saves directly without round-tripping
  // through canvas first (cleaner for SVG, smaller payload).
  const exportSvg = () => {
    const svg = serializeDiagramSvg();
    if (!svg) return;
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "metu-er-diagram.svg");
  };

  const exportPng = () => {
    const svg = serializeDiagramSvg();
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const dpr = 2; // high-DPI export so the PDF render stays crisp
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * dpr;
      canvas.height = layout.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, layout.width, layout.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (!b) return;
        downloadBlob(b, "metu-er-diagram.png");
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const serializeDiagramSvg = (): string | null => {
    // Build a self-contained SVG representation we can hand to
    // either an SVG download or a canvas for PNG conversion.
    const W = layout.width;
    const H = layout.height;
    let body = "";

    // <defs> with crow-foot markers — must mirror ErMarkers exactly so
    // exported SVG/PNG render identically to the on-screen view.
    body += `<defs>
<marker id="ef-one" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto">
  <line x1="3" y1="0" x2="3" y2="12" stroke="#64748b" stroke-width="1.5" />
</marker>
<marker id="ef-one-zero" viewBox="0 0 14 12" refX="13" refY="6" markerWidth="14" markerHeight="12" orient="auto">
  <line x1="3" y1="0" x2="3" y2="12" stroke="#64748b" stroke-width="1.5" />
  <circle cx="9" cy="6" r="2.4" stroke="#64748b" stroke-width="1.2" fill="white" />
</marker>
<marker id="ef-many" viewBox="0 0 14 12" refX="13" refY="6" markerWidth="14" markerHeight="12" orient="auto">
  <line x1="3" y1="0" x2="3" y2="12" stroke="#64748b" stroke-width="1.5" />
  <path d="M 3 6 L 13 0 M 3 6 L 13 12" stroke="#64748b" stroke-width="1.2" fill="none" />
</marker>
</defs>`;

    // Edges first so they sit behind the cards.
    body += '<g fill="none" stroke="#64748b" stroke-width="1.5">';
    for (const edge of layout.edges) {
      if (edge.points.length < 2) continue;
      const d = edge.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(" ");
      const childEnd = edge.cardinality === "one-to-one" ? "ef-one-zero" : "ef-many";
      const parentEnd = edge.fromOptional ? "ef-one-zero" : "ef-one";
      body += `<path d="${d}" marker-start="url(#${parentEnd})" marker-end="url(#${childEnd})" />`;
    }
    body += "</g>";

    // Entity cards as PURE SVG primitives (no <foreignObject>). This
    // is critical for PNG export — canvas marks the bitmap as "tainted"
    // when SVG contains foreign HTML, throwing SecurityError on
    // toBlob/toDataURL. Pure <rect>+<text>+<line> renders cleanly to
    // canvas + matches the on-screen visual.
    for (const node of layout.nodes) {
      const entity = entityById.get(node.id);
      if (!entity) continue;
      body += renderEntityCardSvg(entity, node.x, node.y, node.width, node.height);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#ffffff" />
  ${body}
</svg>`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-12rem)] min-h-[600px] rounded-2xl border border-line bg-white overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ cursor: dragStateRef.current.active ? "grabbing" : "grab", touchAction: "none" }}
    >
      {/* faint dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          opacity: 0.5,
        }}
      />

      {/* zoom + transform layer */}
      <div
        ref={transformLayerRef}
        className="absolute"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG layer: connectors */}
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute top-0 left-0"
          style={{ pointerEvents: "none" }}
        >
          <ErMarkers />
          <g style={{ pointerEvents: "auto" }}>
            {layout.edges.map((edge) => (
              <ErConnectorPath
                key={edge.id}
                edge={edge}
                highlighted={hoveredEdge === edge.id}
                onMouseEnter={() => setHoveredEdge(edge.id)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
            ))}
          </g>
        </svg>

        {/* HTML layer: entity cards */}
        {layout.nodes.map((node) => {
          const entity = entityById.get(node.id);
          if (!entity) return null;
          return (
            <div
              key={node.id}
              data-er-entity={node.id}
              className="absolute"
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
              }}
            >
              <ErEntityCard entity={entity} />
            </div>
          );
        })}
      </div>

      {/* legend (top-left) */}
      <CategoryLegend />

      {/* controls (top-right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 bg-white border border-slate-300 rounded-lg shadow-sm p-1 text-slate-700">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          title="Zoom in"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.8)}
          title="Zoom out"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={fitToScreen}
          title="Fit to screen"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={reset}
          title="Reset (1×)"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* export (bottom-right) */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={exportSvg}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          SVG
        </button>
        <button
          type="button"
          onClick={exportPng}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <ImageDown className="h-3.5 w-3.5" />
          PNG
        </button>
      </div>

      {/* zoom indicator (bottom-left) */}
      <div className="absolute bottom-4 left-4 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-mono text-slate-600 shadow-sm">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers — kept out of the component file to keep the JSX focused.
// ──────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke a beat so older browsers finish the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pure-SVG entity card for export. No <foreignObject> so the resulting
 * SVG renders the same in:
 *   - Standalone SVG viewers (browsers, Inkscape)
 *   - Canvas drawImage → PNG export (foreignObject would taint the
 *     canvas, so we cannot toDataURL/toBlob)
 *   - PDF embed via the docx report
 *
 * Visual matches the live ErEntityCard component: white body, colored
 * header, alternating row stripes, PK/FK marker + field name + type.
 */
function renderEntityCardSvg(
  entity: ErEntity,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const cat = ENTITY_CATEGORY[entity.table] ?? "system";
  const s = CATEGORY_STYLE[cat];
  const headerColor = s.headerText === "white" ? "#ffffff" : "#1e293b";
  const HEADER_H = 28;
  const ROW_H = 22;

  let parts = "";
  // Card background + border (rounded rect)
  parts += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`;
  // Header bar (rounded only at top via clip — for simplicity we
  // overlay a rectangle then redraw a thin border line at the bottom
  // of the header to separate it from the body).
  parts += `<rect x="${x}" y="${y}" width="${w}" height="${HEADER_H}" fill="${s.headerBg}" rx="6" ry="6" />`;
  // Bottom of header rounded → square (overlap a non-rounded rect just below the rounded portion)
  parts += `<rect x="${x}" y="${y + HEADER_H / 2}" width="${w}" height="${HEADER_H / 2}" fill="${s.headerBg}" />`;
  // Header text — centered horizontally, baseline ≈ vertical center
  const headerCx = x + w / 2;
  const headerBaseline = y + HEADER_H / 2 + 4;
  parts += `<text x="${headerCx}" y="${headerBaseline}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="0.5" fill="${headerColor}">${escapeHtml(entity.table.toUpperCase())}</text>`;

  // Each field row
  entity.fields.forEach((f, idx) => {
    const rowY = y + HEADER_H + idx * ROW_H;
    const altBg = idx % 2 === 1 ? "#f8fafc" : "#ffffff";
    parts += `<rect x="${x + 1}" y="${rowY}" width="${w - 2}" height="${ROW_H}" fill="${altBg}" />`;
    if (idx > 0) {
      // separator
      parts += `<line x1="${x + 1}" y1="${rowY}" x2="${x + w - 1}" y2="${rowY}" stroke="#f1f5f9" stroke-width="1" />`;
    }
    const baseline = rowY + ROW_H / 2 + 3;
    const marker = f.pk ? "PK" : f.fk ? "FK" : "";
    parts += `<text x="${x + 8}" y="${baseline}" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#64748b">${marker}</text>`;
    parts += `<text x="${x + 40}" y="${baseline}" font-family="ui-monospace, monospace" font-size="10" fill="#1e293b">${escapeHtml(f.name)}</text>`;
    parts += `<text x="${x + w - 8}" y="${baseline}" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" fill="#64748b">${escapeHtml(f.type)}</text>`;
  });

  return parts;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
