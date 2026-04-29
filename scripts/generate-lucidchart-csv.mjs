/**
 * Phase 21+ — emit a CSV that mimics the Lucidchart "Import from SQL"
 * query output, parsed directly from packages/db/prisma/schema.prisma.
 *
 * This sidesteps the need to run a live information_schema query
 * against Neon — we have the source of truth in Prisma already.
 *
 * Output columns (12, in the order Lucidchart's PostgreSQL query
 * returns them):
 *   dbms, table_catalog, table_schema, table_name, column_name,
 *   ordinal_position, data_type, character_maximum_length,
 *   constraint_type, referenced_schema, referenced_table,
 *   referenced_column
 *
 * One row per (table, column). Multiple rows per column when the
 * column is both PK and FK (rare).
 *
 * Run:
 *   node scripts/generate-lucidchart-csv.mjs > /tmp/schema.csv
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "..", "packages/db/prisma/schema.prisma");

const src = fs.readFileSync(SCHEMA_PATH, "utf8");

// ──────────────────────────────────────────────────────────────────
// Parse Prisma model blocks. We only care about `model X { ... }` —
// not enums, not generators. Each model block lasts until the next
// top-level closing brace at column 0.
// ──────────────────────────────────────────────────────────────────
const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
const models = [];
for (const m of src.matchAll(modelRe)) {
  const [, name, body] = m;
  models.push({ name, body });
}

// Map a Prisma type to a PostgreSQL data_type the way information_schema
// would return it. Best-effort — Lucidchart only uses this for display
// in the entity row.
function mapType(prismaType, dbAttr) {
  // dbAttr like "@db.VarChar(40)" or "@db.Decimal(10, 2)" if present.
  if (dbAttr) {
    if (/@db\.VarChar/.test(dbAttr)) return "character varying";
    if (/@db\.Text/.test(dbAttr)) return "text";
    if (/@db\.Decimal/.test(dbAttr)) return "numeric";
    if (/@db\.Date/.test(dbAttr)) return "date";
  }
  switch (prismaType.replace(/\?$/, "").replace(/\[\]$/, "")) {
    case "Int":      return "integer";
    case "BigInt":   return "bigint";
    case "Float":    return "double precision";
    case "Decimal":  return "numeric";
    case "Boolean":  return "boolean";
    case "DateTime": return "timestamp without time zone";
    case "String":   return "text";
    case "Json":     return "jsonb";
    case "Bytes":    return "bytea";
    default:         return prismaType.toLowerCase();
  }
}

function parseCharLen(dbAttr) {
  if (!dbAttr) return "";
  const m = dbAttr.match(/@db\.VarChar\s*\(\s*(\d+)\s*\)/);
  return m ? m[1] : "";
}

// Look up a model's @@map value (table name in DB). Defaults to the
// model name if no @@map.
function tableNameFor(modelName) {
  const m = models.find((x) => x.name === modelName);
  if (!m) return modelName.toLowerCase();
  const mapMatch = m.body.match(/@@map\s*\(\s*"([^"]+)"\s*\)/);
  return mapMatch ? mapMatch[1] : modelName.toLowerCase();
}

// CSV escape — quote anything with comma/quote/newline.
function csv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rows = [];
const HEADER = [
  "dbms",
  "table_catalog",
  "table_schema",
  "table_name",
  "column_name",
  "ordinal_position",
  "data_type",
  "character_maximum_length",
  "constraint_type",
  "referenced_schema",
  "referenced_table",
  "referenced_column",
];
rows.push(HEADER.map(csv).join(","));

for (const model of models) {
  const tableName = tableNameFor(model.name);
  const fieldLines = model.body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));

  // Track FK relations declared on object-typed fields so we can
  // attach FK metadata to the corresponding scalar column rows.
  // Format: scalarField -> { referencedTable, referencedColumn }
  const fkScalarMap = new Map();
  for (const line of fieldLines) {
    // Match: `myStore Store @relation(fields: [storeId], references: [storeId])`
    const relMatch = line.match(
      /^\s*(\w+)\s+(\w+)(\?)?\s+@relation\([^)]*?fields:\s*\[([^\]]+)\][^)]*?references:\s*\[([^\]]+)\]/,
    );
    if (relMatch) {
      const referencedModel = relMatch[2];
      const fkFields = relMatch[4].split(",").map((s) => s.trim());
      const refFields = relMatch[5].split(",").map((s) => s.trim());
      const refTable = tableNameFor(referencedModel);
      // Find each FK field's @map column name on the THIS model's body
      // when we emit those scalar columns later.
      for (let i = 0; i < fkFields.length; i++) {
        // We don't know the @map of the referenced field yet; resolve
        // by looking up the referenced model and finding the field.
        const refModelObj = models.find((m) => m.name === referencedModel);
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

  let ordinal = 0;
  for (const line of fieldLines) {
    // Skip relation fields (object-typed) — they don't map to a DB column.
    // Match scalar fields: `name Type[?] @optional-attrs...`
    const scalarMatch = line.match(/^(\w+)\s+([A-Za-z][\w]*)(\??)\s*(.*)$/);
    if (!scalarMatch) continue;
    const [, fieldName, fieldType, , attrs] = scalarMatch;

    // Skip object-typed relations (referenced model name = fieldType).
    // A heuristic: if fieldType matches another model name, it's a relation.
    if (models.some((m) => m.name === fieldType)) continue;
    // Skip enum types — represented as their backing string column.

    // Skip if the line is actually a `@@unique` or similar (already
    // filtered above, but defensive).
    if (fieldName.startsWith("@")) continue;

    ordinal++;
    const colName = (() => {
      const mapMatch = attrs.match(/@map\s*\(\s*"([^"]+)"\s*\)/);
      return mapMatch ? mapMatch[1] : fieldName;
    })();
    const dataType = mapType(fieldType, attrs);
    const charLen = parseCharLen(attrs);
    const isPk = /@id\b/.test(attrs);
    const fk = fkScalarMap.get(fieldName);

    const baseRow = {
      dbms: "postgresql",
      table_catalog: "metu",
      table_schema: "public",
      table_name: tableName,
      column_name: colName,
      ordinal_position: ordinal,
      data_type: dataType,
      character_maximum_length: charLen,
    };

    if (isPk && !fk) {
      rows.push(emit(baseRow, "PRIMARY KEY", "", "", ""));
    } else if (!isPk && fk) {
      rows.push(emit(baseRow, "FOREIGN KEY", "public", fk.referencedTable, fk.referencedColumn));
    } else if (isPk && fk) {
      rows.push(emit(baseRow, "PRIMARY KEY", "", "", ""));
      rows.push(emit(baseRow, "FOREIGN KEY", "public", fk.referencedTable, fk.referencedColumn));
    } else {
      rows.push(emit(baseRow, "", "", "", ""));
    }
  }
}

function emit(base, constraintType, refSchema, refTable, refCol) {
  return [
    base.dbms,
    base.table_catalog,
    base.table_schema,
    base.table_name,
    base.column_name,
    base.ordinal_position,
    base.data_type,
    base.character_maximum_length,
    constraintType,
    refSchema,
    refTable,
    refCol,
  ]
    .map(csv)
    .join(",");
}

// Resolve the @map column name for a Prisma field on a model.
function scalarColumnName(modelObj, fieldName) {
  const lineRe = new RegExp(`^\\s*${fieldName}\\s+\\w+`, "m");
  const lineMatch = modelObj.body.match(lineRe);
  if (!lineMatch) return fieldName;
  const line = lineMatch[0] + modelObj.body.split(lineMatch[0])[1].split("\n")[0];
  const mapMatch = line.match(/@map\s*\(\s*"([^"]+)"\s*\)/);
  return mapMatch ? mapMatch[1] : fieldName;
}

console.log(rows.join("\n"));
