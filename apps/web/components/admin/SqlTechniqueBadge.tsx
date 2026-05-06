import { Database, Layers, Sigma, GitBranch, Hash, Filter, Box, Zap } from "lucide-react";

// Tiny "powered by" chip that sits under each /admin section header,
// showing which Postgres technique drives the data. The point is to
// surface the database-course rubric on the page itself — anyone
// scrolling past sees JOIN+GROUP BY, MAT VIEW, generate_series,
// COUNT FILTER … rather than a generic "stats" page.
//
// Kind of acts as a visual EXPLAIN ANALYZE summary: not the actual
// plan, but the strategy. We deliberately keep it compact (10px
// monospace) so the page still reads as "dashboard" first, "demo
// surface" second.

type Technique =
  | "matview"          // Materialized view-backed
  | "generate-series"  // Time-series gap-fill
  | "join-group"       // JOIN + GROUP BY aggregate
  | "count-filter"     // FILTER (WHERE) conditional aggregate
  | "case-bucket"      // CASE WHEN … bucketing
  | "extract"          // EXTRACT(HOUR/DOW FROM …) time bucket
  | "cte"              // WITH … common-table-expression
  | "window"           // window function (RANK/LEAD/SUM OVER)
  | "json-agg"         // jsonb_agg / json_build_object
  | "trigger"          // table populated by trigger
  | "left-join"        // LEFT JOIN + COUNT(DISTINCT)
  | "raw-sql";         // hand-rolled $queryRaw — no ORM

interface Props {
  technique: Technique;
  /** Optional override label. Defaults to the technique's canonical
      short name (e.g. "MAT VIEW"). */
  label?: string;
  /** Extra colour-coding for the surrounding tone. */
  className?: string;
}

const TECHNIQUE_META: Record<Technique, { label: string; tone: string; icon: typeof Database; tooltip: string }> = {
  "matview": {
    label: "MAT VIEW",
    tone: "bg-mint/10 text-mint ring-mint/30",
    icon: Layers,
    tooltip: "Backed by a materialized view (top_stores_30d) — REFRESH MATERIALIZED VIEW CONCURRENTLY.",
  },
  "generate-series": {
    label: "generate_series",
    tone: "bg-info/10 text-info ring-info/30",
    icon: Zap,
    tooltip: "Postgres generate_series() fills zero-revenue days so the chart never has gaps.",
  },
  "join-group": {
    label: "JOIN + GROUP BY",
    tone: "bg-metu-yellow/10 text-metu-yellow ring-metu-yellow/30",
    icon: GitBranch,
    tooltip: "Multi-table JOIN aggregated with GROUP BY + ORDER BY DESC LIMIT.",
  },
  "count-filter": {
    label: "COUNT FILTER",
    tone: "bg-purple-400/10 text-purple-300 ring-purple-400/30",
    icon: Filter,
    tooltip: "Single-pass conditional aggregate via COUNT(*) FILTER (WHERE …).",
  },
  "case-bucket": {
    label: "CASE bucket",
    tone: "bg-coral/10 text-coral ring-coral/30",
    icon: Box,
    tooltip: "CASE WHEN … END buckets rows into named groups for the aggregate.",
  },
  "extract": {
    label: "EXTRACT()",
    tone: "bg-info/10 text-info ring-info/30",
    icon: Hash,
    tooltip: "EXTRACT(HOUR FROM …) / EXTRACT(DOW FROM …) bins timestamps into time buckets.",
  },
  "cte": {
    label: "CTE",
    tone: "bg-mint/10 text-mint ring-mint/30",
    icon: GitBranch,
    tooltip: "Composed with WITH … common-table-expressions for readability.",
  },
  "window": {
    label: "WINDOW",
    tone: "bg-purple-400/10 text-purple-300 ring-purple-400/30",
    icon: Sigma,
    tooltip: "Window function (RANK / LEAD / SUM OVER) — no extra GROUP BY pass.",
  },
  "json-agg": {
    label: "jsonb_agg",
    tone: "bg-info/10 text-info ring-info/30",
    icon: Layers,
    tooltip: "jsonb_agg / json_build_object collapses related rows into a single JSON column.",
  },
  "trigger": {
    label: "TRIGGER",
    tone: "bg-coral/10 text-coral ring-coral/30",
    icon: Zap,
    tooltip: "Maintained by an AFTER INSERT/UPDATE trigger — denormalised on write.",
  },
  "left-join": {
    label: "LEFT JOIN",
    tone: "bg-metu-yellow/10 text-metu-yellow ring-metu-yellow/30",
    icon: GitBranch,
    tooltip: "LEFT JOIN keeps rows with zero matches (categories with no products show up).",
  },
  "raw-sql": {
    label: "$queryRaw",
    tone: "bg-white/5 text-ink-secondary ring-white/10",
    icon: Database,
    tooltip: "Hand-written SQL via Prisma $queryRaw — no ORM round-trip.",
  },
};

export function SqlTechniqueBadge({ technique, label, className = "" }: Props) {
  const meta = TECHNIQUE_META[technique];
  const Icon = meta.icon;
  return (
    <span
      title={meta.tooltip}
      className={`inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${meta.tone} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label ?? meta.label}
    </span>
  );
}

/**
 * Convenience: render a row of techniques.
 * <SqlTechniqueBadgeRow techniques={["join-group", "count-filter"]} />
 */
export function SqlTechniqueBadgeRow({
  techniques,
  className = "",
}: {
  techniques: Technique[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {techniques.map((t) => (
        <SqlTechniqueBadge key={t} technique={t} />
      ))}
    </div>
  );
}
