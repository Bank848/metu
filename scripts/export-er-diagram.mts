/**
 * Phase 24 — offline export of /admin/er-diagram as SVG.
 *
 * Re-implements just enough of the layout pipeline to produce the
 * same SVG output as ErDiagramView.tsx's PNG-export path. Kept self-
 * contained (no cross-package TS imports) because tsx + Node ESM
 * loaders disagree on .ts re-export shapes when paths aliases are
 * involved.
 *
 * Usage:
 *   npx tsx scripts/export-er-diagram.mts
 */
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs");
const SVG_OUT = path.join(OUT_DIR, "er-diagram-v2.svg");

// Load schema + categories at runtime (the schema is plain JSON-ish
// const data once stripped of TS types).
const schemaSrc = await fs.readFile(
  path.resolve(__dirname, "..", "apps/web/lib/admin/er-schema.ts"),
  "utf8",
);
const categoriesSrc = await fs.readFile(
  path.resolve(__dirname, "..", "apps/web/lib/admin/er-categories.ts"),
  "utf8",
);

interface ErField {
  name: string;
  type: string;
  pk: boolean;
  fk: { table: string; column: string } | null;
  unique: boolean;
  nullable: boolean;
  ordinal: number;
}
interface ErEntity { table: string; fields: ErField[]; }
interface ErRelationship {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
  cardinality: "one-to-one" | "one-to-many";
  fromOptional: boolean;
}

function evalConst<T>(src: string, name: string): T {
  // Strip TS type-only annotations that JS eval can't handle, then
  // evaluate the const declaration as a JS literal. This works for our
  // plain JSON-shaped constants but would fail on anything fancy.
  const re = new RegExp(`export const ${name}\\s*[^=]*=\\s*([\\s\\S]*?);\\s*\\n`, "m");
  const match = src.match(re);
  if (!match) throw new Error(`const ${name} not found`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${match[1]}`)() as T;
}

const ER_ENTITIES: ErEntity[] = evalConst(schemaSrc, "ER_ENTITIES");
const ER_RELATIONSHIPS: ErRelationship[] = evalConst(schemaSrc, "ER_RELATIONSHIPS");
const ENTITY_CATEGORY: Record<string, string> = evalConst(categoriesSrc, "ENTITY_CATEGORY");
const CATEGORY_STYLE: Record<string, { headerBg: string; headerText: "white" | "black"; label: string }> =
  evalConst(categoriesSrc, "CATEGORY_STYLE");

const CATEGORY_COLUMN_ORDER = [
  "identity", "store", "catalog", "tag", "cart", "order", "coupon", "wallet", "system",
];

const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 22;
const NODE_WIDTH = 240;
const COLUMN_GAP = 90;
const ROW_GAP = 60;
const CANVAS_PAD = 60;

function nodeHeight(e: ErEntity): number {
  return HEADER_HEIGHT + e.fields.length * ROW_HEIGHT;
}

interface PlacedNode {
  id: string; x: number; y: number; width: number; height: number;
  centerX: number; centerY: number;
}

function placeOnGrid(entities: ErEntity[]): { placed: PlacedNode[]; width: number; height: number } {
  const groups = new Map<string, ErEntity[]>();
  for (const c of CATEGORY_COLUMN_ORDER) groups.set(c, []);
  for (const e of entities) {
    const cat = ENTITY_CATEGORY[e.table] ?? "system";
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
      const h = nodeHeight(e);
      placed.push({
        id: e.table, x: cursorX, y: cursorY, width: NODE_WIDTH, height: h,
        centerX: cursorX + NODE_WIDTH / 2, centerY: cursorY + h / 2,
      });
      cursorY += h + ROW_GAP;
    }
    if (cursorY - ROW_GAP > maxBottom) maxBottom = cursorY - ROW_GAP;
    cursorX += NODE_WIDTH + COLUMN_GAP;
  }
  return { placed, width: cursorX - COLUMN_GAP + CANVAS_PAD, height: maxBottom + CANVAS_PAD };
}

interface LayoutedEdge {
  id: string; from: string; to: string;
  fromOptional: boolean;
  cardinality: "one-to-one" | "one-to-many";
  points: Array<{ x: number; y: number }>;
}

function routeEdges(placed: PlacedNode[], rels: ErRelationship[]): LayoutedEdge[] {
  const byId = new Map(placed.map((p) => [p.id, p]));
  const sideUsage = new Map<string, number>();
  function bumpSide(k: string): number { const n = (sideUsage.get(k) ?? 0) + 1; sideUsage.set(k, n); return n; }
  const out: LayoutedEdge[] = [];
  for (const r of rels) {
    if (r.from === r.to) continue;
    const a = byId.get(r.from); const b = byId.get(r.to);
    if (!a || !b) continue;
    const horizontal = Math.abs(a.centerX - b.centerX) >= Math.abs(a.centerY - b.centerY);
    let aPort: { x: number; y: number }; let bPort: { x: number; y: number };
    if (horizontal) {
      const aOnRight = a.centerX < b.centerX;
      const aSide = aOnRight ? "right" : "left";
      const bSide = aOnRight ? "left" : "right";
      const aIdx = bumpSide(`${r.from}:${aSide}`);
      const bIdx = bumpSide(`${r.to}:${bSide}`);
      const aOff = ((aIdx - 1) % 5) * 8 - 16;
      const bOff = ((bIdx - 1) % 5) * 8 - 16;
      aPort = { x: aOnRight ? a.x + a.width : a.x, y: a.centerY + aOff };
      bPort = { x: aOnRight ? b.x : b.x + b.width, y: b.centerY + bOff };
    } else {
      const aOnTop = a.centerY < b.centerY;
      const aSide = aOnTop ? "bottom" : "top";
      const bSide = aOnTop ? "top" : "bottom";
      const aIdx = bumpSide(`${r.from}:${aSide}`);
      const bIdx = bumpSide(`${r.to}:${bSide}`);
      const aOff = ((aIdx - 1) % 5) * 12 - 24;
      const bOff = ((bIdx - 1) % 5) * 12 - 24;
      aPort = { x: a.centerX + aOff, y: aOnTop ? a.y + a.height : a.y };
      bPort = { x: b.centerX + bOff, y: aOnTop ? b.y : b.y + b.height };
    }
    let points: Array<{ x: number; y: number }>;
    if (horizontal) {
      const midX = (aPort.x + bPort.x) / 2;
      points = [aPort, { x: midX, y: aPort.y }, { x: midX, y: bPort.y }, bPort];
    } else {
      const midY = (aPort.y + bPort.y) / 2;
      points = [aPort, { x: aPort.x, y: midY }, { x: bPort.x, y: midY }, bPort];
    }
    out.push({
      id: `${r.from}.${r.fromColumn}→${r.to}.${r.toColumn}`,
      from: r.from, to: r.to,
      fromOptional: r.fromOptional, cardinality: r.cardinality,
      points,
    });
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderEntityCard(entity: ErEntity, x: number, y: number, w: number, h: number): string {
  const cat = ENTITY_CATEGORY[entity.table] ?? "system";
  const s = CATEGORY_STYLE[cat];
  const headerColor = s.headerText === "white" ? "#ffffff" : "#1e293b";
  const HEADER_H = 28; const ROW_H = 22;
  let parts = "";
  parts += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`;
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

async function main() {
  const { placed, width: W, height: H } = placeOnGrid(ER_ENTITIES);
  const edges = routeEdges(placed, ER_RELATIONSHIPS);
  const entityById = new Map(ER_ENTITIES.map((e) => [e.table, e]));

  let body = "";
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
  body += '<g fill="none" stroke="#64748b" stroke-width="1.5">';
  for (const edge of edges) {
    const d = edge.points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
    const childEnd = edge.cardinality === "one-to-one" ? "ef-one-zero" : "ef-many";
    const parentEnd = edge.fromOptional ? "ef-one-zero" : "ef-one";
    body += `<path d="${d}" marker-start="url(#${parentEnd})" marker-end="url(#${childEnd})" />`;
  }
  body += "</g>";
  for (const node of placed) {
    const e = entityById.get(node.id);
    if (!e) continue;
    body += renderEntityCard(e, node.x, node.y, node.width, node.height);
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#ffffff" />
  ${body}
</svg>`;

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(SVG_OUT, svg, "utf8");
  console.log(`Wrote ${SVG_OUT} (${W} × ${H}, ${edges.length} edges, ${placed.length} nodes)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
