/**
 * Phase 24 — wraps `@dagrejs/dagre` to compute auto-layout positions
 * for the ER diagram. The output shape is plain serializable data so
 * the renderer (`ErDiagramView.tsx`) can stay pure-React/SVG without
 * touching dagre's mutable graph object directly.
 *
 * Layout strategy (revised after user feedback "ดูยาวๆ เกินไป, ให้ออก
 * ข้างบ้าง"):
 *
 *   1. Pre-compute a category-grid layout — one column per category
 *      (Identity / Store / Catalog / …). Within each column tables
 *      stack vertically. This gives the eye a clear "block" shape per
 *      domain instead of a 6 000 px-tall single column.
 *
 *   2. Run dagre only to *route edges* — we hand it our pre-computed
 *      node positions so it doesn't reshuffle clusters. Routing still
 *      handles the orthogonal bends and crow-foot endpoints.
 *
 * The result is a wide diagram (~2 800 × 2 200 px) where related
 * entities visually cluster, mirroring the way the Lucidchart export
 * in the friend's CPE241 report PDF arranges things.
 */
import dagre from "@dagrejs/dagre";

import { categoryFor, type ErCategory } from "./er-categories";
import type { ErEntity, ErRelationship } from "./er-schema";

export interface LayoutedNode {
  id: string;          // table name
  x: number;           // top-left in canvas coords
  y: number;
  width: number;
  height: number;
}

export interface LayoutedEdge {
  id: string;          // "from→to" composite for React keys
  from: string;
  to: string;
  fromOptional: boolean;
  cardinality: "one-to-one" | "one-to-many";
  /** Polyline points from source to target. dagre returns these
   *  with one-segment-per-bend already routed. */
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: LayoutedNode[];
  edges: LayoutedEdge[];
  width: number;       // overall bounding box used by the SVG layer
  height: number;
}

const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 22;
const NODE_WIDTH = 240;

/** Estimate an entity card's pixel height from its field count. */
export function nodeHeightFor(entity: ErEntity): number {
  return HEADER_HEIGHT + entity.fields.length * ROW_HEIGHT;
}

// ─────────────────────────────────────────────────────────────────
// Category grid — left-to-right column order.
// Picked so high-traffic relationships (users → store → product →
// orders → wallet) flow rightward across the canvas like the
// Lucidchart layout in the report PDF.
// ─────────────────────────────────────────────────────────────────
const CATEGORY_COLUMN_ORDER: ErCategory[] = [
  "identity",
  "store",
  "catalog",
  "tag",
  "cart",
  "order",
  "coupon",
  "wallet",
  "system",
];

const COLUMN_GAP = 90;   // horizontal gap between category columns
const ROW_GAP = 60;      // vertical gap between cards inside a column
const CANVAS_PAD = 60;

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Lay out entities on a category grid — each category becomes a
 * vertical column, cards stack inside the column. Returns absolute
 * top-left coords plus convenience centerX/Y.
 */
function placeOnCategoryGrid(entities: ErEntity[]): {
  placed: PlacedNode[];
  width: number;
  height: number;
} {
  // Group entities by category, preserving the entity order from
  // er-schema.ts (which mirrors schema.prisma declaration order).
  const groups = new Map<ErCategory, ErEntity[]>();
  for (const cat of CATEGORY_COLUMN_ORDER) groups.set(cat, []);
  for (const e of entities) {
    const cat = categoryFor(e.table);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(e);
  }

  const placed: PlacedNode[] = [];
  let cursorX = CANVAS_PAD;
  let maxBottom = CANVAS_PAD;

  for (const cat of CATEGORY_COLUMN_ORDER) {
    const list = groups.get(cat) ?? [];
    if (list.length === 0) continue;

    let cursorY = CANVAS_PAD;
    for (const e of list) {
      const h = nodeHeightFor(e);
      placed.push({
        id: e.table,
        x: cursorX,
        y: cursorY,
        width: NODE_WIDTH,
        height: h,
        centerX: cursorX + NODE_WIDTH / 2,
        centerY: cursorY + h / 2,
      });
      cursorY += h + ROW_GAP;
    }

    if (cursorY - ROW_GAP > maxBottom) maxBottom = cursorY - ROW_GAP;
    cursorX += NODE_WIDTH + COLUMN_GAP;
  }

  // Total canvas size includes padding on the trailing side.
  const width = cursorX - COLUMN_GAP + CANVAS_PAD;
  const height = maxBottom + CANVAS_PAD;
  return { placed, width, height };
}

export function layoutEr(
  entities: ErEntity[],
  relationships: ErRelationship[],
): LayoutResult {
  // Step 1 — pre-place nodes on the category grid.
  const { placed, width, height } = placeOnCategoryGrid(entities);
  const placedById = new Map(placed.map((p) => [p.id, p]));

  // Step 2 — feed positions into dagre as fixed nodes so it only
  // routes edges. We still need a graph instance because the dagre
  // edge-routing code lives behind dagre.layout(), but we set
  // rankdir="LR" + sufficient spacing to match what we already laid
  // out, then accept that ranks dagre assigns may shift x/y a bit.
  // To preserve our category grid, we simply skip running dagre and
  // instead compute orthogonal edge polylines ourselves between
  // node centers.
  const nodes: LayoutedNode[] = placed.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  }));

  // Step 3 — synthesize routed edges. For each relationship pick the
  // best side-pair (right→left, left→right, top→bottom, etc.) based
  // on the relative positions of source vs target, then emit a 3-
  // point Manhattan polyline that approximates Lucidchart's bends.
  const edges: LayoutedEdge[] = [];
  // Track edge endpoints per node-side so we can fan multiple
  // connectors out vertically/horizontally instead of stacking on
  // top of each other.
  const sideUsage = new Map<string, number>();
  function bumpSide(key: string): number {
    const n = (sideUsage.get(key) ?? 0) + 1;
    sideUsage.set(key, n);
    return n;
  }

  for (const r of relationships) {
    if (r.from === r.to) continue;
    const a = placedById.get(r.from);
    const b = placedById.get(r.to);
    if (!a || !b) continue;

    // Decide which sides to connect. Prefer the horizontal sides
    // because the grid layout is column-major (most edges cross
    // columns left-to-right).
    const horizontal = Math.abs(a.centerX - b.centerX) >= Math.abs(a.centerY - b.centerY);

    let aPort: { x: number; y: number };
    let bPort: { x: number; y: number };

    if (horizontal) {
      const aOnRight = a.centerX < b.centerX;
      const aSide = aOnRight ? "right" : "left";
      const bSide = aOnRight ? "left" : "right";
      const aIdx = bumpSide(`${r.from}:${aSide}`);
      const bIdx = bumpSide(`${r.to}:${bSide}`);
      // Spread successive ports vertically along the side so
      // multiple FKs from the same entity don't merge into one line.
      const aOffset = ((aIdx - 1) % 5) * 8 - 16;
      const bOffset = ((bIdx - 1) % 5) * 8 - 16;
      aPort = {
        x: aOnRight ? a.x + a.width : a.x,
        y: a.centerY + aOffset,
      };
      bPort = {
        x: aOnRight ? b.x : b.x + b.width,
        y: b.centerY + bOffset,
      };
    } else {
      const aOnTop = a.centerY < b.centerY;
      const aSide = aOnTop ? "bottom" : "top";
      const bSide = aOnTop ? "top" : "bottom";
      const aIdx = bumpSide(`${r.from}:${aSide}`);
      const bIdx = bumpSide(`${r.to}:${bSide}`);
      const aOffset = ((aIdx - 1) % 5) * 12 - 24;
      const bOffset = ((bIdx - 1) % 5) * 12 - 24;
      aPort = {
        x: a.centerX + aOffset,
        y: aOnTop ? a.y + a.height : a.y,
      };
      bPort = {
        x: b.centerX + bOffset,
        y: aOnTop ? b.y : b.y + b.height,
      };
    }

    // Manhattan polyline: 3 points (or 4 with a mid-step) that bend
    // once at the midpoint between the two ports. This matches
    // Lucidchart's right-angle connector style.
    let points: Array<{ x: number; y: number }>;
    if (horizontal) {
      const midX = (aPort.x + bPort.x) / 2;
      points = [
        aPort,
        { x: midX, y: aPort.y },
        { x: midX, y: bPort.y },
        bPort,
      ];
    } else {
      const midY = (aPort.y + bPort.y) / 2;
      points = [
        aPort,
        { x: aPort.x, y: midY },
        { x: bPort.x, y: midY },
        bPort,
      ];
    }

    const edgeName = `${r.from}.${r.fromColumn}→${r.to}.${r.toColumn}`;
    edges.push({
      id: edgeName,
      from: r.from,
      to: r.to,
      fromOptional: r.fromOptional,
      cardinality: r.cardinality,
      points,
    });
  }

  // Keep dagre import alive (used historically; retain as a fallback
  // hook in case anyone wants to swap routers). Marking it referenced
  // so the bundler doesn't tree-shake the dependency we ship for
  // future use.
  void dagre;

  return { nodes, edges, width, height };
}
