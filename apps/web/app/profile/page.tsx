import Image from "next/image";
import { redirect } from "next/navigation";
import { Mail, Calendar, Award, ShoppingBag, Store } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiAuth, getMe } from "@/lib/session";
import { money } from "@/lib/format";
import { isDataUrl } from "@/lib/utils";
import { LogoutButton } from "./LogoutButton";

type Order = { orderId: number; status: string; totalPrice: string | number; createdAt: string };

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/profile");

  const orders = (await apiAuth<Order[]>("/orders")) ?? [];
  const role = me.role as "buyer" | "seller" | "admin";
  const isSeller = role === "seller" || me.user?.store;

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-5xl px-6 md:px-8 py-10">
        <PageHeader
          title="Your profile"
          subtitle="Manage your account, orders, and store."
          action={
            <div className="flex items-center gap-2">
              <Button href="/profile/edit" variant="outline" size="sm">Edit profile</Button>
              <LogoutButton />
            </div>
          }
        />

        <div className="grid md:grid-cols-[280px_1fr] gap-8 items-start">
          <aside className="rounded-2xl surface-flat p-6 text-center shadow-flat">
            <div className="relative h-24 w-24 rounded-full bg-brand-yellow overflow-hidden mx-auto ring-4 ring-brand-yellow/20">
              {me.user.profileImage && (
                <Image src={me.user.profileImage} alt="" fill sizes="96px" className="object-cover" unoptimized={isDataUrl(me.user.profileImage)} />
              )}
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-white">
              {me.user.firstName} {me.user.lastName}
            </h2>
            <p className="text-sm text-ink-dim">@{me.user.username}</p>
            <div className="mt-3 flex justify-center">
              <Badge variant={role === "admin" ? "dark" : role === "seller" ? "yellow" : "mist"}>
                {role.toUpperCase()}
              </Badge>
            </div>
            <div className="mt-6 text-left space-y-2 text-sm">
              <div className="flex items-center gap-2 text-ink-secondary">
                <Mail className="h-4 w-4" />
                <span className="truncate">{me.user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-secondary">
                <Calendar className="h-4 w-4" />
                <span>Joined {new Date(me.user.createdDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-secondary">
                <Award className="h-4 w-4" />
                <span>Buyer level {me.user.stats?.buyerLevel ?? 1}</span>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl surface-flat p-6 shadow-flat">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Recent orders
                </h3>
                <Button href="/orders" variant="outline" size="sm">All orders →</Button>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-ink-secondary">No orders yet. <a className="text-brand-yellow font-semibold" href="/browse">Browse marketplace →</a></p>
              ) : (
                <ul className="divide-y divide-line">
                  {orders.slice(0, 5).map((o) => (
                    <li key={o.orderId} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-mono text-ink-dim">ORDER #{o.orderId}</div>
                        <div className="text-xs text-ink-secondary">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={o.status === "paid" ? "success" : o.status === "fulfilled" ? "info" : o.status === "pending" ? "warning" : "danger"} className="uppercase text-[10px]">
                        {o.status}
                      </Badge>
                      <div className="font-display font-bold text-brand-yellow">{money(Number(o.totalPrice))}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl surface-flat p-6 shadow-flat">
              <h3 className="font-display font-bold text-white flex items-center gap-2 mb-3">
                <Store className="h-4 w-4" />
                {isSeller ? "Your store" : "Become a seller"}
              </h3>
              {isSeller ? (
                <div>
                  <p className="text-sm text-ink-secondary mb-3">
                    {me.user.store?.name ? (
                      <>You own <strong className="text-white">{me.user.store.name}</strong>. Manage products, coupons, and orders from the seller dashboard.</>
                    ) : (
                      <>You have seller privileges. Visit the dashboard.</>
                    )}
                  </p>
                  <Button href="/seller" variant="primary">Go to seller dashboard →</Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-ink-secondary mb-3">
                    Start selling your digital products on METU. Create a store to list templates, courses, music, and more.
                  </p>
                  <Button href="/become-seller" variant="primary">Create your store →</Button>
                </div>
              )}
            </section>

            {role === "admin" && (
              <section className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/5 p-6">
                <h3 className="font-display font-bold text-brand-yellow mb-2">You&apos;re an admin</h3>
                <p className="text-sm text-ink-secondary mb-3">Access marketplace-wide reports and manage users & stores.</p>
                <Button href="/admin" variant="primary">Open admin panel →</Button>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
