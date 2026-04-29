/**
 * Phase 24 — derive a typed ER schema constant from
 * `packages/db/prisma/schema.prisma` for the in-house ER diagram
 * renderer at `/admin/er-diagram`.
 *
 * Output: `apps/web/lib/admin/er-schema.ts` exporting:
 *   - `ER_ENTITIES` — array of {table, fields, ...}
 *   - `ER_RELATIONSHIPS` — array of FK edges with cardinality
 *
 * Reuses parsing patterns from scripts/generate-lucidchart-csv.mjs.
 *
 * Usage:
 *   node scripts/generate-er-schema.mjs
 *
 * Run after every Prisma schema change so the diagram stays in sync.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "..", "packages/db/prisma/schema.prisma");
const OUTPUT_PATH = path.resolve(__dirname, "..", "apps/web/lib/admin/er-schema.ts");

const src = fs.readFileSync(SCHEMA_PATH, "utf8");

// ──────────────────────────────────────────────────────────────────
// 1. Parse model blocks
// ──────────────────────────────────────────────────────────────────
const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
const models = [];
for (const m of src.matchAll(modelRe)) {
  const [, name, body] = m;
  models.push({ name, body });
}

function tableNameFor(modelName) {
  const m = models.find((x) => x.name === modelName);
  if (!m) return modelName.toLowerCase();
  const mapMatch = m.body.match(/@@map\s*\(\s*"([^"]+)"\s*\)/);
  return mapMatch ? mapMatch[1] : modelName.toLowerCase();
}

// Resolve scalar field's @map column name on a given model.
function scalarColumnName(modelObj, fieldName) {
  const lineRe = new RegExp(`^\\s*${fieldName}\\s+\\w+[^\\n]*$`, "m");
  const lineMatch = modelObj.body.match(lineRe);
  if (!lineMatch) return fieldName;
  const mapMatch = lineMatch[0].match(/@map\s*\(\s*"([^"]+)"\s*\)/);
  return mapMatch ? mapMatch[1] : fieldName;
}

// Map Prisma type to a short, display-friendly type label (matches the
// way the report PDF formats column types — "INT", "VARCHAR(40)",
// "DECIMAL(10, 2)", "BOOLEAN", "DATETIME", "TEXT", "ENUM").
function mapType(prismaType, dbAttr) {
  const baseType = prismaType.replace(/\?$/, "").replace(/\[\]$/, "");
  if (dbAttr) {
    const varCharMatch = dbAttr.match(/@db\.VarChar\s*\(\s*(\d+)\s*\)/);
    if (varCharMatch) return `VARCHAR(${varCharMatch[1]})`;
    if (/@db\.Text/.test(dbAttr)) return "TEXT";
    const decMatch = dbAttr.match(/@db\.Decimal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (decMatch) return `DECIMAL(${decMatch[1]}, ${decMatch[2]})`;
    if (/@db\.Date/.test(dbAttr)) return "DATE";
  }
  switch (baseType) {
    case "Int":      return "INT";
    case "BigInt":   return "BIGINT";
    case "Float":    return "FLOAT";
    case "Decimal":  return "DECIMAL";
    case "Boolean":  return "BOOLEAN";
    case "DateTime": return "DATETIME";
    case "String":   return "TEXT";
    case "Json":     return "JSONB";
    case "Bytes":    return "BYTES";
    default:
      // If it's another model name → object-typed relation field; skip
      // (we filter these out in the field loop). Otherwise it's an
      // enum — display the enum name.
      return baseType.toUpperCase();
  }
}

// ──────────────────────────────────────────────────────────────────
// 2. Build entity list + relationship list
// ──────────────────────────────────────────────────────────────────
const entities = [];
const relationships = [];

for (const model of models) {
  const tableName = tableNameFor(model.name);
  const fieldLines = model.body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));

  // Collect FK relations declared on object-typed fields so we can
  // attach FK metadata to scalar fields + emit relationship rows.
  const fkScalarMap = new Map();
  for (const line of fieldLines) {
    const relMatch = line.match(
      /^\s*(\w+)\s+(\w+)(\?)?\s+@relation\([^)]*?fields:\s*\[([^\]]+)\][^)]*?references:\s*\[([^\]]+)\]/,
    );
    if (relMatch) {
      const referencedModel = relMatch[2];
      const fkFields = relMatch[4].split(",").map((s) => s.trim());
      const refFields = relMatch[5].split(",").map((s) => s.trim());
      const refTable = tableNameFor(referencedModel);
      const refModelObj = models.find((m) => m.name === referencedModel);
      for (let i = 0; i < fkFields.length; i++) {
        const refColumnName = refModelObj
          ? scalarColumnName(refModelObj, refFields[i])
          : refFields[i];
        fkScalarMap.set(fkFields[i], {
          referencedTable: refTable,
          referencedColumn: refColumnName,
        });
      }
    }
  }

  const fields = [];
  let ordinal = 0;
  for (const line of fieldLines) {
    const scalarMatch = line.match(/^(\w+)\s+([A-Za-z][\w]*)(\??)\s*(.*)$/);
    if (!scalarMatch) continue;
    const [, fieldName, fieldType, optional, attrs] = scalarMatch;
    if (fieldName.startsWith("@")) continue;
    // Skip object-typed relation fields (their type matches another model name).
    if (models.some((m) => m.name === fieldType)) continue;

    ordinal++;
    const colName = (() => {
      const mapMatch = attrs.match(/@map\s*\(\s*"([^"]+)"\s*\)/);
      return mapMatch ? mapMatch[1] : fieldName;
    })();
    const type = mapType(fieldType, attrs);
    const pk = /@id\b/.test(attrs);
    const unique = /@unique\b/.test(attrs);
    const fkRaw = fkScalarMap.get(fieldName) ?? null;
    const fk = fkRaw
      ? { table: fkRaw.referencedTable, column: fkRaw.referencedColumn }
      : null;
    const nullable = optional === "?";

    fields.push({
      name: colName,
      type,
      pk,
      fk,
      unique,
      nullable,
      ordinal,
    });

    if (fk) {
      // Emit relationship: this table's FK column → referenced table's column.
      // Cardinality is left/right-side optional based on nullable + unique flags.
      const fromOptional = nullable;
      // Ref-side optional always false on FK (the parent row must exist when set).
      // Cardinality: if FK is on a unique column → 1:1, else 1:many.
      const cardinality = unique ? "one-to-one" : "one-to-many";
      relationships.push({
        from: tableName,
        fromColumn: colName,
        to: fk.table,
        toColumn: fk.column,
        cardinality,
        fromOptional,
      });
    }
  }

  entities.push({ table: tableName, fields });
}

// ──────────────────────────────────────────────────────────────────
// 3. Emit TypeScript file
// ──────────────────────────────────────────────────────────────────
const header = `/**
 * Phase 24 — auto-generated ER schema constant.
 *
 * DO NOT EDIT BY HAND. Regenerate via:
 *   node scripts/generate-er-schema.mjs
 *
 * Source-of-truth: packages/db/prisma/schema.prisma
 *
 * Consumed by:
 *   - apps/web/components/admin/ErDiagramView.tsx (renders entity cards)
 *   - apps/web/lib/admin/er-layout.ts (dagre auto-layout input)
 */

export interface ErField {
  /** Column name (snake_case, matching Postgres). */
  name: string;
  /** Display type: "INT", "VARCHAR(40)", "DECIMAL(10, 2)", "BOOLEAN", "DATETIME", enum names. */
  type: string;
  /** Primary key marker. */
  pk: boolean;
  /** Foreign key target, or null. */
  fk: { table: string; column: string } | null;
  /** Unique constraint (excluding PK). */
  unique: boolean;
  /** Nullable column (Prisma's \`?\` modifier). */
  nullable: boolean;
  /** 1-based position within its table. */
  ordinal: number;
}

export interface ErEntity {
  /** Postgres table name (snake_case). */
  table: string;
  fields: ErField[];
}

export interface ErRelationship {
  /** Child table (the side that holds the FK). */
  from: string;
  fromColumn: string;
  /** Parent table (the side referenced). */
  to: string;
  toColumn: string;
  /** Cardinality on the child→parent direction. */
  cardinality: "one-to-one" | "one-to-many";
  /** \`true\` when the FK column is nullable (zero-or-one / zero-or-many). */
  fromOptional: boolean;
}
`;

const entitiesJson = JSON.stringify(entities, null, 2);
const relsJson = JSON.stringify(relationships, null, 2);

const output = `${header}
export const ER_ENTITIES: ErEntity[] = ${entitiesJson};

export const ER_RELATIONSHIPS: ErRelationship[] = ${relsJson};
`;

// Ensure target directory exists.
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, output);

console.log(`Wrote ${entities.length} entities + ${relationships.length} relationships → ${OUTPUT_PATH}`);
