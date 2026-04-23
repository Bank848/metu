import { PageHeader } from "@/components/PageHeader";
import { FormSection } from "@/components/forms/FormSection";
import { apiAuth } from "@/lib/session";
import { ReportCard } from "./ReportCard";

type Report = { sql: string; rows: any[] };

export const dynamic = "force-dynamic";

/**
 * Phase 10 / Step 3b — reports are grouped into three categories so the
 * page reads as "Revenue / Operations / Growth" instead of a flat 5-tile
 * grid. `<FormSection>` provides the accent stripe + title bar; the
 * cards inside are surface-flat so they sit calmly beneath the stripe.
 *
 * Section accents follow the playbook:
 *   - Revenue    → default (yellow)
 *   - Operations → mint (positive ops health register)
 *   - Growth     → coral (warm "trending up" register)
 */
type ReportDef = {
  slug: string;
  title: string;
  description: string;
};

const reportGroups: Array<{
  id: string;
  title: string;
  description: string;
  accent: "default" | "mint" | "coral";
  reports: ReportDef[];
}> = [
  {
    id: "revenue",
    title: "Revenue",
    description: "Where the GMV comes from.",
    accent: "default",
    reports: [
      {
        slug: "revenue-by-category",
        title: "Revenue by category",
        description: "GMV broken down by product category — shows which categories drive the business.",
      },
      {
        slug: "top-stores",
        title: "Top stores by revenue",
        description: "Leaderboard of sellers by total GMV contributed.",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    description: "Day-to-day health of the marketplace.",
    accent: "mint",
    reports: [
      {
        slug: "orders-by-status",
        title: "Orders by status",
        description: "Operational health check — how many orders are in each lifecycle state.",
      },
      {
        slug: "coupon-usage",
        title: "Coupon usage",
        description: "Which coupons are being redeemed and how close they are to their cap.",
      },
    ],
  },
  {
    id: "growth",
    title: "Growth",
    description: "User acquisition trends.",
    accent: "coral",
    reports: [
      {
        slug: "signups-per-day",
        title: "New users per day (60d)",
        description: "User acquisition trend over the past 60 days.",
      },
    ],
  },
];

export default async function AdminReports() {
  // Flatten so we fan out the API requests in a single Promise.all, then
  // re-key by slug for the per-group render.
  const flat = reportGroups.flatMap((g) => g.reports);
  const fetched = await Promise.all(
    flat.map(async (r) => ({
      slug: r.slug,
      data: (await apiAuth<Report>(`/admin/reports/${r.slug}`)) ?? { sql: "-- failed", rows: [] },
    })),
  );
  const byKey = new Map(fetched.map((f) => [f.slug, f.data]));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Raw SQL runs against the warehouse — click “View SQL” on each card to inspect the query."
      />
      <div className="space-y-8">
        {reportGroups.map((group) => (
          <FormSection
            key={group.id}
            title={group.title}
            description={group.description}
            accent={group.accent}
          >
            <div className="grid lg:grid-cols-2 gap-5">
              {group.reports.map((r) => (
                <ReportCard
                  key={r.slug}
                  title={r.title}
                  description={r.description}
                  data={byKey.get(r.slug) ?? { sql: "-- missing", rows: [] }}
                />
              ))}
            </div>
          </FormSection>
        ))}
      </div>
    </>
  );
}
