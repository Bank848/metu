"use client";
import type { LayoutedEdge } from "@/lib/admin/er-layout";

/**
 * Phase 24 — single FK relationship rendered as an SVG path with
 * crow-foot markers at both ends. Styling stays minimal so the
 * focus is on the entity cards (Lucidchart aesthetic).
 *
 * Marker convention (matching standard crow's-foot ER notation):
 *   - parent (one) end:  vertical bar  ║  if NOT NULL FK,
 *                        bar+circle    o║ if nullable
 *   - child  (many) end: crow's foot   <  + bar  → "}|"
 *                        crow's foot+o → "}o" if cardinality 1:1
 */
export function ErConnectorPath({
  edge,
  highlighted,
  onMouseEnter,
  onMouseLeave,
}: {
  edge: LayoutedEdge;
  highlighted: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const points = edge.points;
  if (points.length < 2) return null;

  // Build orthogonal-ish SVG path. dagre returns raw bend points;
  // converting to L-segments gives us right-angle look that matches
  // typical ER diagrams.
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const stroke = highlighted ? "#0f172a" : "#64748b";
  const width = highlighted ? 2 : 1.5;

  // Marker IDs include cardinality + optionality so SVG defs can
  // reuse a single set across all edges.
  const childEndId =
    edge.cardinality === "one-to-one" ? "ef-one-zero" : "ef-many";
  const parentEndId = edge.fromOptional ? "ef-one-zero" : "ef-one";

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      style={{ pointerEvents: "stroke", cursor: "pointer" }}
      markerStart={`url(#${parentEndId})`}
      markerEnd={`url(#${childEndId})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

/**
 * SVG `<defs>` with reusable crow-foot markers. Mount once at the top
 * of the diagram's SVG layer.
 */
export function ErMarkers() {
  const stroke = "#64748b";
  return (
    <defs>
      {/* "one and only one" — single vertical bar */}
      <marker
        id="ef-one"
        viewBox="0 0 12 12"
        refX="11"
        refY="6"
        markerWidth="12"
        markerHeight="12"
        orient="auto"
      >
        <line x1="3" y1="0" x2="3" y2="12" stroke={stroke} strokeWidth="1.5" />
      </marker>
      {/* "zero or one" — bar + circle */}
      <marker
        id="ef-one-zero"
        viewBox="0 0 14 12"
        refX="13"
        refY="6"
        markerWidth="14"
        markerHeight="12"
        orient="auto"
      >
        <line x1="3" y1="0" x2="3" y2="12" stroke={stroke} strokeWidth="1.5" />
        <circle cx="9" cy="6" r="2.4" stroke={stroke} strokeWidth="1.2" fill="white" />
      </marker>
      {/* "one or many" — crow's foot + bar */}
      <marker
        id="ef-many"
        viewBox="0 0 14 12"
        refX="13"
        refY="6"
        markerWidth="14"
        markerHeight="12"
        orient="auto"
      >
        <line x1="3" y1="0" x2="3" y2="12" stroke={stroke} strokeWidth="1.5" />
        <path
          d="M 3 6 L 13 0 M 3 6 L 13 12"
          stroke={stroke}
          strokeWidth="1.2"
          fill="none"
        />
      </marker>
    </defs>
  );
}
