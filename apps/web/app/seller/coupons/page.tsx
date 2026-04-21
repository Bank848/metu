import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { apiAuth } from "@/lib/session";
import { money } from "@/lib/format";

type Coupon = {
  couponId: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  isActive: boolean;
  _count: { usages: number };
};

export const dynamic = "force-dynamic";

export default async function SellerCoupons() {
  const coupons = (await apiAuth<Coupon[]>("/seller/coupons")) ?? [];

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle={`${coupons.length} coupons · manage promotions and discounts`}
        action={<GlassButton tone="gold" href="/seller/coupons/new">+ New coupon</GlassButton>}
      />

      <div className="rounded-2xl border border-line bg-space-850 overflow-hidden">
        <table className="w-full">
          <thead className="bg-space-800 text-xs font-semibold uppercase tracking-wider text-ink-dim">
            <tr>
              <th className="text-left px-5 py-3">Code</th>
              <th className="text-left px-5 py-3">Discount</th>
              <th className="text-left px-5 py-3">Window</th>
              <th className="text-left px-5 py-3">Usage</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {coupons.map((c) => {
              const now = Date.now();
              const expired = new Date(c.endDate).getTime() < now;
              const notYet = new Date(c.startDate).getTime() > now;
              return (
                <tr key={c.couponId}>
                  <td className="px-5 py-3 font-mono text-sm font-semibold text-brand-yellow">{c.code}</td>
                  <td className="px-5 py-3 text-sm text-white">
                    {c.discountType === "percent" ? `${c.discountValue}% off` : `${money(c.discountValue)} off`}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-dim">
                    {new Date(c.startDate).toLocaleDateString()} → {new Date(c.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-sm text-white">
                    {c._count.usages}/{c.usageLimit}
                  </td>
                  <td className="px-5 py-3">
                    {expired ? (
                      <Badge variant="danger">Expired</Badge>
                    ) : notYet ? (
                      <Badge variant="warning">Scheduled</Badge>
                    ) : c.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="mist">Paused</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
