"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Maximize,
  Maximize2,
  Minimize2,
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
 * In-house ER diagram renderer. dagre handles layout; entities render
 * as HTML overlays and FK connectors as SVG paths with crow-foot markers.
 */

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

export function ErDiagramView({ kioskMode = false }: { kioskMode?: boolean } = {}) {
  // Schema is build-time constant; layout never changes after mount.
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

  // Wheel = zoom around cursor; shift+wheel = horizontal pan.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        setTx((prev) => prev - e.deltaY);
        return;
      }
      // Anchor zoom to the cursor position.
      const rect = c.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(prev * factor).toFixed(3)));
        setTx((px) => cx - ((cx - px) * next) / prev);
        setTy((py) => cy - ((cy - py) * next) / prev);
        return next;
      });
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  // fullscreen toggle. Uses the Fullscreen API
  // on the canvas container so the diagram fills the whole viewport.
  // Esc + the F11 key both exit fullscreen via the browser's native
  // handling, but we also expose a button so users discover it.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      c.requestFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard: +/= zoom in, - zoom out, 0 reset, f fit, Ctrl+Enter fullscreen.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when an input/textarea is focused
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomBy(0.8);
      } else if (e.key === "0") {
        e.preventDefault();
        reset();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitToScreen();
      } else if (e.key === "F11" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        // Ctrl/Cmd+Enter toggles fullscreen on the diagram. Easier to
        // remember than F11 (which the browser may swallow).
        e.preventDefault();
        toggleFullscreen();
      }
    };
    c.addEventListener("keydown", onKey);
    return () => c.removeEventListener("keydown", onKey);
  }, [zoomBy, reset, fitToScreen, toggleFullscreen]);

  // 4px threshold so accidental clicks don't register as pans.
  const DRAG_THRESHOLD = 4;
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Pan from anywhere except interactive elements.
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [contenteditable]")) return;
    // Suppress text-selection / native-drag so the pointer pans the canvas
    // instead of dragging ghost text from an entity card.
    e.preventDefault();
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
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    setTx(s.startTx + dx);
    setTy(s.startTy + dy);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Double-click empty canvas to fit-to-screen.
  const onDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-er-entity]") || target.closest("button")) return;
    fitToScreen();
  };

  // Serialize the diagram as inline SVG with foreignObject cards.
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
      const dpr = 2; // high-DPI for crisp PNG/PDF output
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
    // Self-contained SVG used for both download + PNG conversion.
    const W = layout.width;
    const H = layout.height;
    let body = "";

    // crow-foot markers; must mirror ErMarkers for identical export.
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

    // Edges first so cards render on top.
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

    // Pure SVG primitives only - foreignObject taints the canvas
    // and breaks PNG export with SecurityError on toBlob.
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
      tabIndex={0}
      className={`relative w-full ${kioskMode ? "h-full" : "h-[calc(100vh-12rem)] min-h-[600px]"} rounded-2xl border border-line bg-white overflow-hidden focus:outline-none focus:ring-2 focus:ring-mint/40 select-none`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      // Catch native HTML5 drag at the root so a press-and-drag on
      // anything inside the canvas (text in a cell, the connector
      // SVG, the legend) can never spawn a ghost drag-image.
      onDragStart={(e) => e.preventDefault()}
      style={{
        cursor: dragStateRef.current.active ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      } as React.CSSProperties}
      aria-label="ER diagram canvas. Drag to pan, scroll to zoom, double-click to fit."
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
              draggable={false}
              className="absolute select-none"
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                userSelect: "none",
                WebkitUserDrag: "none",
              } as React.CSSProperties}
              // Suppress native HTML5 drag (which would otherwise fire
              // a ghost drag-image and prevent our pan handler from
              // capturing the pointer).
              onDragStart={(e) => e.preventDefault()}
            >
              <ErEntityCard entity={entity} />
            </div>
          );
        })}
      </div>

      {/* legend (top-left) */}
      <CategoryLegend />

      {/* controls (top-right). Hidden in kiosk mode — passers-by don't
          need pan/zoom buttons; the diagram speaks for itself. */}
      {!kioskMode && (
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
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      )}

      {/* export (bottom-right) — also hidden in kiosk mode. */}
      {!kioskMode && (
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
      )}

      {/* zoom indicator (bottom-left) — kiosk mode hides the operator chrome. */}
      {!kioskMode && (
      <div className="absolute bottom-4 left-4 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-mono text-slate-600 shadow-sm">
        {Math.round(scale * 100)}%
      </div>
      )}

      {/* keyboard shortcut hint (bottom-center, fades on hover). */}
      {!kioskMode && (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-slate-300 bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] text-slate-500 shadow-sm pointer-events-none opacity-70">
        <kbd className="font-mono">scroll</kbd> zoom · <kbd className="font-mono">drag anywhere</kbd> pan · <kbd className="font-mono">double-click</kbd> fit · <kbd className="font-mono">+</kbd> <kbd className="font-mono">-</kbd> <kbd className="font-mono">0</kbd> <kbd className="font-mono">f</kbd> · <kbd className="font-mono">Ctrl+Enter</kbd> fullscreen
      </div>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Pure-SVG entity card for export. No foreignObject so the SVG
// stays canvas-safe for PNG conversion and renders in all viewers.
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
  parts += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`;
  // Header is rounded; overlay a square rect on the bottom half.
  parts += `<rect x="${x}" y="${y}" width="${w}" height="${HEADER_H}" fill="${s.headerBg}" rx="6" ry="6" />`;
  parts += `<rect x="${x}" y="${y + HEADER_H / 2}" width="${w}" height="${HEADER_H / 2}" fill="${s.headerBg}" />`;
  const headerCx = x + w / 2;
  const headerBaseline = y + HEADER_H / 2 + 4;
  parts += `<text x="${headerCx}" y="${headerBaseline}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="0.5" fill="${headerColor}">${escapeHtml(entity.table.toUpperCase())}</text>`;

  entity.fields.forEach((f, idx) => {
    const rowY = y + HEADER_H + idx * ROW_H;
    const altBg = idx % 2 === 1 ? "#f8fafc" : "#ffffff";
    parts += `<rect x="${x + 1}" y="${rowY}" width="${w - 2}" height="${ROW_H}" fill="${altBg}" />`;
    if (idx > 0) {
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
