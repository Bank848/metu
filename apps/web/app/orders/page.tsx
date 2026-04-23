import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Package, Receipt, CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { apiAuth, getMe } from "@/lib/session";
import { money } from "@/lib/format";
import { cn, isDataUrl } from "@/lib/utils";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

type Order = {
  orderId: number;
  totalPrice: string | number;
  status: OrderStatus;
  createdAt: string;
  items: Array<{
    orderItemId: number;
    quantity: number;
    priceAtPurchase: string | number;
    productItem: {
      product: {
        name: string;
        images: Array<{ productImage: string }>;
        store: { name: string };
      };
    };
  }>;
};

export const dynamic = "force-dynamic";

const statusVariant: Record<OrderStatus, "success" | "warning" | "info" | "danger" | "purple"> = {
  paid: "success",
  fulfilled: "info",
  pending: "warning",
  cancelled: "danger",
  refunded: "purple",
};

// Three simplified buckets for buyers — hides the nuance of paid-vs-
// fulfilled and cancelled-vs-refunded without losing information.
type TabKey = "all" | "active" | "completed" | "problems";
const ACTIVE_STATUSES: OrderStatus[] = ["pending", "paid"];
const COMPLETED_STATUSES: OrderStatus[] = ["fulfilled"];
const PROBLEM_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

function bucketFor(status: OrderStatus): Exclude<TabKey, "all"> {
  if (ACTIVE_STATUSES.includes(status)) return "active";
  if (COMPLETED_STATUSES.includes(status)) return "completed";
  return "problems";
}

function tabHref(tab: TabKey) {
  return tab === "all" ? "/orders" : `/orders?tab=${tab}`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login?next=/orders");

  const orders = (await apiAuth<Order[]>("/orders")) ?? [];

  // Bucket counts drive the tab badges — computed once per render.
  const counts = {
    all: orders.length,
    active: orders.filter((o) => bucketFor(o.status) === "active").length,
    completed: orders.filter((o) => bucketFor(o.status) === "completed").length,
    problems: orders.filter((o) => bucketFor(o.status) === "problems").length,
  };

  const raw = (searchParams.tab ?? "all") as TabKey;
  const active: TabKey = (["all", "active", "completed", "problems"] as TabKey[]).includes(raw) ? raw : "all";

  const filtered =
    active === "all" ? orders : orders.filter((o) => bucketFor(o.status) === active);

  const subtitle = `${orders.length} order${orders.length !== 1 ? "s" : ""} total · ${counts.active} in progress · ${counts.completed} completed · ${counts.problems} cancelled/refunded`;

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-5xl px-6 md:px-8 py-10">
        <PageHeader title="My orders" subtitle={subtitle} />

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your purchases will show up here."
            icon={<Package className="h-8 w-8" />}
            action={<GlassButton tone="gold" href="/browse">Start browsing →</GlassButton>}
          />
        ) : (
          <>
            {/* Tab bar */}
            <nav className="mb-6 flex flex-wrap gap-2" aria-label="Order filter">
              <TabLink label="All" icon={Receipt} tab="all" active={active} count={counts.all} />
              <TabLink label="In progress" icon={Clock} tab="active" active={active} count={counts.active} />
              <TabLink label="Completed" icon={CheckCircle2} tab="completed" active={active} count={counts.completed} />
              <TabLink label="Cancelled / Refunded" icon={XCircle} tab="problems" active={active} count={counts.problems} />
            </nav>

            {filtered.length === 0 ? (
              <EmptyState
                title={
                  active === "active"
                    ? "No orders in progress"
                    : active === "completed"
                      ? "No completed orders yet"
                      : "No cancelled or refunded orders"
                }
                description={
                  active === "active"
                    ? "Orders that are pending or paid will show up here."
                    : active === "completed"
                      ? "Once a seller marks an order as fulfilled, it'll land here."
                      : "Hopefully it stays this way."
                }
                icon={
                  active === "active" ? (
                    <Clock className="h-8 w-8" />
                  ) : active === "completed" ? (
                    <CheckCircle2 className="h-8 w-8" />
                  ) : (
                    <RotateCcw className="h-8 w-8" />
                  )
                }
                action={<GlassButton tone="glass" href="/orders">See all orders</GlassButton>}
              />
            ) : (
              <ul className="space-y-4">
                {filtered.map((o) => (
                  <li key={o.orderId}>
                    <Link
                      href={`/orders/${o.orderId}`}
                      className="block rounded-2xl surface-flat p-5 hover:border-metu-yellow/50 transition-all lift-on-hover hover:shadow-raised"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="text-xs font-mono text-ink-dim flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            ORDER #{o.orderId}
                          </div>
                          <div className="text-sm text-ink-secondary mt-0.5">
                            {new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={statusVariant[o.status]} className="uppercase">{o.status}</Badge>
                          <div className="mt-2 font-display text-xl font-extrabold text-gold-gradient">
                            {money(Number(o.totalPrice))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        {o.items.slice(0, 4).map((it) => (
                          <div key={it.orderItemId} className="relative h-14 w-14 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8">
                            {it.productItem.product.images[0]?.productImage && (
                              <Image src={it.productItem.product.images[0].productImage} alt="" fill sizes="56px" className="object-cover" unoptimized={isDataUrl(it.productItem.product.images[0].productImage)} />
                            )}
                          </div>
                        ))}
                        <div className="ml-3 text-sm text-ink-secondary truncate">
                          {o.items.map((i) => i.productItem.product.name).join(" · ")}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function TabLink({
  label,
  icon: Icon,
  tab,
  active,
  count,
}: {
  label: string;
  icon: typeof Receipt;
  tab: TabKey;
  active: TabKey;
  count: number;
}) {
  const isActive = tab === active;
  return (
    <Link
      href={tabHref(tab)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
        isActive
          ? "bg-metu-yellow/15 border-metu-yellow/50 text-metu-yellow"
          : "bg-white/[0.03] border-white/8 text-ink-secondary hover:border-metu-yellow/30 hover:text-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span
        className={cn(
          "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono",
          isActive ? "bg-metu-yellow/20 text-metu-yellow" : "bg-white/5 text-ink-dim",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
