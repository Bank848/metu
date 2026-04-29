"use client";
import type { ErEntity } from "@/lib/admin/er-schema";
import { CATEGORY_STYLE, categoryFor } from "@/lib/admin/er-categories";

/**
 * Phase 24 — single entity card matching the Lucidchart visual:
 * white body + colored header + per-row PK/FK marker + type column.
 */
export function ErEntityCard({
  entity,
  highlight = false,
}: {
  entity: ErEntity;
  highlight?: boolean;
}) {
  const category = categoryFor(entity.table);
  const style = CATEGORY_STYLE[category];
  return (
    <div
      className={
        "absolute select-none rounded-md border bg-white shadow-sm transition " +
        (highlight ? "border-slate-700 shadow-md" : "border-slate-300")
      }
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    >
      {/* Header: colored bar with table name */}
      <div
        className="px-2.5 flex items-center justify-center font-semibold text-[11px] uppercase tracking-wide"
        style={{
          height: 28,
          backgroundColor: style.headerBg,
          color: style.headerText === "white" ? "#ffffff" : "#1e293b",
        }}
      >
        {entity.table}
      </div>
      {/* Body: each field as a 3-col row (PK/FK | name | type) */}
      <div className="text-[10px] font-mono leading-none text-slate-700">
        {entity.fields.map((f, idx) => (
          <div
            key={f.name}
            className={
              "grid items-center px-2 border-t " +
              (idx === 0 ? "border-slate-200" : "border-slate-100")
            }
            style={{
              gridTemplateColumns: "32px 1fr auto",
              height: 22,
              backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff",
            }}
          >
            <span className="text-slate-500 font-bold">
              {f.pk ? "PK" : f.fk ? "FK" : ""}
            </span>
            <span className="text-slate-800 truncate" title={f.name}>
              {f.name}
            </span>
            <span className="text-slate-500 ml-2 truncate" title={f.type}>
              {f.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
