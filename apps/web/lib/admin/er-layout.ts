/**
 * Phase 24 — wraps `@dagrejs/dagre` to compute auto-layout positions
 * for the ER diagram. The output shape is plain serializable data so
 * the renderer (`ErDiagramView.tsx`) can stay pure-React/SVG without
 * touching dagre's mutable graph object directly.
 *
 * Layout direction defaults to LR (left-to-right) which approximates
 * the wide layout in the original Lucidchart diagram from the report.
 */
import dagre from "@dagrejs/dagre";

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

export function layoutEr(
  entities: ErEntity[],
  relationships: ErRelationship[],
): LayoutResult {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: "LR",
    // Generous spacing — 35 entities + 47 edges produce a lot of
    // crossing lines on default settings. Bumping nodesep/ranksep
    // gives dagre room to route connectors without overlapping.
    nodesep: 120,
    ranksep: 180,
    edgesep: 40,
    // Spline routing — dagre's default is undirected straight lines,
    // "polyline" produces orthogonal-ish bends that match Lucidchart.
    ranker: "tight-tree",
    marginx: 60,
    marginy: 60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const e of entities) {
    g.setNode(e.table, {
      width: NODE_WIDTH,
      height: nodeHeightFor(e),
    });
  }

  for (const r of relationships) {
    // Skip self-loops on the same table — dagre handles them but they
    // pollute the layout; the renderer can draw them via a small bend
    // arc separately if ever needed (no self-FKs in the current
    // schema, so this is just defensive).
    if (r.from === r.to) continue;
    if (!g.hasNode(r.from) || !g.hasNode(r.to)) continue;
    // Use composite name so multigraph distinguishes parallel FKs
    // (e.g. message has both senderId and recipientId → users).
    const edgeName = `${r.from}.${r.fromColumn}→${r.to}.${r.toColumn}`;
    g.setEdge(r.from, r.to, {}, edgeName);
  }

  dagre.layout(g);

  const nodes: LayoutedNode[] = entities.map((e) => {
    const n = g.node(e.table) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    if (!n) {
      // Defensive fallback — should never happen because we just added it.
      return { id: e.table, x: 0, y: 0, width: NODE_WIDTH, height: nodeHeightFor(e) };
    }
    // dagre centers nodes at (x, y). Convert to top-left for CSS.
    return {
      id: e.table,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    };
  });

  const edges: LayoutedEdge[] = [];
  for (const r of relationships) {
    if (r.from === r.to) continue;
    const edgeName = `${r.from}.${r.fromColumn}→${r.to}.${r.toColumn}`;
    const e = g.edge({ v: r.from, w: r.to, name: edgeName }) as
      | { points: Array<{ x: number; y: number }> }
      | undefined;
    if (!e?.points) continue;
    edges.push({
      id: edgeName,
      from: r.from,
      to: r.to,
      fromOptional: r.fromOptional,
      cardinality: r.cardinality,
      points: e.points,
    });
  }

  // Compute overall canvas bounds. dagre's graph().width/height refer
  // to the inner box; account for marginx/marginy.
  const graph = g.graph() as { width?: number; height?: number };
  const width = graph.width ?? 0;
  const height = graph.height ?? 0;

  return { nodes, edges, width, height };
}
