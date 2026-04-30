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

const COLUMN_GAP = 110;  // horizontal gap between category columns
const ROW_GAP = 60;      // vertical gap between cards inside a column
const CANVAS_PAD = 90;   // generous so highway routes have airspace

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
  /** Map<tableName, columnIndex> after empty categories are dropped — used
   *  by the edge router to compute inter-column gap centres without having
   *  to recount empty columns. */
  colByTable: Map<string, number>;
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
  const colByTable = new Map<string, number>();
  let cursorX = CANVAS_PAD;
  let maxBottom = CANVAS_PAD;
  let colIdx = 0;

  for (const cat of CATEGORY_COLUMN_ORDER) {
    const list = groups.get(cat) ?? [];
    // Phase 26 trim left some categories (notably "wallet") empty —
    // skip them here so the layout doesn't reserve a useless column
    // gap that wastes horizontal real estate + stretches edges.
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
      colByTable.set(e.table, colIdx);
      cursorY += h + ROW_GAP;
    }

    if (cursorY - ROW_GAP > maxBottom) maxBottom = cursorY - ROW_GAP;
    cursorX += NODE_WIDTH + COLUMN_GAP;
    colIdx++;
  }

  // Total canvas size includes padding on the trailing side.
  const width = cursorX - COLUMN_GAP + CANVAS_PAD;
  const height = maxBottom + CANVAS_PAD;
  return { placed, width, height, colByTable };
}

// ─────────────────────────────────────────────────────────────────
// Routing helpers — keep the bend points inside inter-column gaps so
// vertical runs never cut through an unrelated card body. The grid
// has predictable column geometry, so we can compute exact gap
// centres without any collision-detection pass.
// ─────────────────────────────────────────────────────────────────
const COLUMN_PITCH = NODE_WIDTH + COLUMN_GAP;

/** X centre of the gap immediately *after* `colIdx` (0-based). */
function gapCenterX(colIdx: number): number {
  return CANVAS_PAD + colIdx * COLUMN_PITCH + NODE_WIDTH + COLUMN_GAP / 2;
}

/** Approximate column index for an arbitrary x coord. */
function colIndexFor(x: number): number {
  return Math.max(0, Math.round((x - CANVAS_PAD - NODE_WIDTH / 2) / COLUMN_PITCH));
}

export function layoutEr(
  entities: ErEntity[],
  relationships: ErRelationship[],
): LayoutResult {
  // Step 1 — pre-place nodes on the category grid.
  const { placed, width, height, colByTable } = placeOnCategoryGrid(entities);
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

    // Pull endpoints a few px AWAY from the card edge so the
    // crow-foot marker has clean whitespace instead of overlapping
    // the card border. The marker viewBox is 12-14 px wide; 4 px of
    // air keeps the bar/foot legible.
    const STUB = 4;

    if (horizontal) {
      const aOnRight = a.centerX < b.centerX;
      const aSide = aOnRight ? "right" : "left";
      const bSide = aOnRight ? "left" : "right";
      const aIdx = bumpSide(`${r.from}:${aSide}`);
      const bIdx = bumpSide(`${r.to}:${bSide}`);
      // Spread successive ports vertically along the side so multiple
      // FKs from the same entity don't merge into one line. mod 8 ×
      // 14 px = up to ±56 px range, big enough to keep separate
      // markers visually distinct around busy hubs (e.g. USERS gets
      // 11 inbound FKs).
      const aOffset = ((aIdx - 1) % 8) * 14 - 49;
      const bOffset = ((bIdx - 1) % 8) * 14 - 49;
      aPort = {
        x: aOnRight ? a.x + a.width + STUB : a.x - STUB,
        y: a.centerY + aOffset,
      };
      bPort = {
        x: aOnRight ? b.x - STUB : b.x + b.width + STUB,
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
        y: aOnTop ? a.y + a.height + STUB : a.y - STUB,
      };
      bPort = {
        x: b.centerX + bOffset,
        y: aOnTop ? b.y - STUB : b.y + b.height + STUB,
      };
    }

    // Pick a routing strategy based on column distance:
    //   - Adjacent columns (|Δcol| == 1) → simple 4-point Manhattan
    //     polyline. The bend lands in the single gap between source
    //     and target; both horizontal segments stay short, no card
    //     bodies in the way.
    //   - Non-adjacent columns (|Δcol| ≥ 2) → 6-point HIGHWAY route.
    //     Exit source via its adjacent gap, climb to a "highway" row
    //     above all cards (or below — whichever has fewer existing
    //     edges), sweep across in pure whitespace, drop into the gap
    //     immediately before target, enter horizontally. Eliminates
    //     the bug where the long horizontal stretch at aPort.y or
    //     bPort.y crossed unrelated cards in middle columns.
    let points: Array<{ x: number; y: number }>;
    if (horizontal) {
      const aColIdx = colByTable.get(r.from) ?? colIndexFor(a.centerX);
      const bColIdx = colByTable.get(r.to)   ?? colIndexFor(b.centerX);
      const colDelta = Math.abs(aColIdx - bColIdx);

      if (colDelta <= 1) {
        // Adjacent columns: bend in the single gap between them.
        const bendCol = Math.min(aColIdx, bColIdx);
        const bendX = gapCenterX(bendCol);
        points = [
          aPort,
          { x: bendX, y: aPort.y },
          { x: bendX, y: bPort.y },
          bPort,
        ];
      } else {
        // HIGHWAY route. Exit via the gap RIGHT after source's column,
        // sweep along a highway above/below all cards, drop into the
        // gap RIGHT before target's column, enter target.
        const aOnRight = aColIdx < bColIdx;
        // gap immediately on the *outbound* side of source
        const exitGapCol = aOnRight ? aColIdx : aColIdx - 1;
        // gap immediately on the *inbound* side of target
        const enterGapCol = aOnRight ? bColIdx - 1 : bColIdx;
        const exitX = gapCenterX(exitGapCol);
        const enterX = gapCenterX(enterGapCol);
        // Pick top vs bottom highway based on how many edges already
        // routed there — spread the load. Each highway is offset by
        // edge index so parallel highway edges don't overlap.
        const topHits = sideUsage.get("hwy:top") ?? 0;
        const botHits = sideUsage.get("hwy:bot") ?? 0;
        const useTop = topHits <= botHits;
        const lane = bumpSide(useTop ? "hwy:top" : "hwy:bot");
        const laneOffset = ((lane - 1) % 6) * 8;
        const highwayY = useTop
          ? CANVAS_PAD / 2 - laneOffset           // 45..-3 from top edge
          : height - CANVAS_PAD / 2 + laneOffset; // 45.. below cards
        points = [
          aPort,
          { x: exitX, y: aPort.y },     // 1: horizontal stub from source to exit gap
          { x: exitX, y: highwayY },    // 2: vertical climb to highway
          { x: enterX, y: highwayY },   // 3: horizontal sweep along highway
          { x: enterX, y: bPort.y },    // 4: vertical drop from highway to target row
          bPort,                         // 5: horizontal stub into target
        ];
      }
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
