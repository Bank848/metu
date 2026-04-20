import { PageHeader } from "@/components/PageHeader";
import { apiAuth } from "@/lib/session";
import { ReportCard } from "./ReportCard";

type Report = { sql: string; rows: any[] };

export const dynamic = "force-dynamic";

const reports = [
  { slug: "revenue-by-category", title: "Revenue by category", description: "GMV broken down by product category — shows which categories drive the business." },
  { slug: "top-stores",          title: "Top stores by revenue",  description: "Leaderboard of sellers by total GMV contributed." },
  { slug: "orders-by-status",    title: "Orders by status",        description: "Operational health check — how many orders are in each lifecycle state." },
  { slug: "coupon-usage",        title: "Coupon usage",            description: "Which coupons are being redeemed and how close they are to their cap." },
  { slug: "signups-per-day",     title: "New users per day (60d)", description: "User acquisition trend over the past 60 days." },
];

export default async function AdminReports() {
  const results = await Promise.all(
    reports.map(async (r) => ({
      ...r,
      data: (await apiAuth<Report>(`/admin/reports/${r.slug}`)) ?? { sql: "-- failed", rows: [] },
    })),
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Raw SQL runs against the warehouse — click “View SQL” on each card to inspect the query."
      />
      <div className="grid lg:grid-cols-2 gap-5">
        {results.map((r) => (
          <ReportCard key={r.slug} title={r.title} description={r.description} data={r.data} />
        ))}
      </div>
    </>
  );
}
