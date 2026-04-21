import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Star, MessageSquare, Pencil } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { getReviewsByUser, getReviewsForStore, getPendingReviewProducts } from "@/lib/server/queries";
import { cn, isDataUrl } from "@/lib/utils";
import { PendingReviewCard } from "./PendingReviewCard";

export const dynamic = "force-dynamic";

export default async function MyReviewsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const me = await getMe();
  if (!me) redirect("/login?next=/my-reviews");

  const isSeller = Boolean(me.user?.store);
  const view = searchParams.view === "seller" && isSeller ? "seller" : "buyer";

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-6 md:px-8 py-10">
        <PageHeader
          title="My reviews"
          subtitle={
            view === "buyer"
              ? "Reviews you've written for products you bought."
              : "Reviews customers have left on your products."
          }
        />

        {/* View toggle (only useful if user is also a seller) */}
        {isSeller && (
          <div className="mb-6 inline-flex gap-1 p-1 rounded-full glass-morphism">
            <Link
              href="/my-reviews?view=buyer"
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-full transition",
                view === "buyer"
                  ? "button-gradient text-surface-1"
                  : "text-ink-secondary hover:text-white",
              )}
            >
              I wrote
            </Link>
            <Link
              href="/my-reviews?view=seller"
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-full transition",
                view === "seller"
                  ? "button-gradient text-surface-1"
                  : "text-ink-secondary hover:text-white",
              )}
            >
              On my store
            </Link>
          </div>
        )}

        {view === "buyer" ? (
          <BuyerReviews userId={me.user.userId} />
        ) : (
          <SellerReviews storeId={me.user.store!.storeId} storeName={me.user.store!.name} />
        )}
      </main>
      <Footer />
    </>
  );
}

async function BuyerReviews({ userId }: { userId: number }) {
  const [reviews, pending] = await Promise.all([
    getReviewsByUser(userId),
    getPendingReviewProducts(userId),
  ]);

  if (reviews.length === 0 && pending.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Buy something from the marketplace and you'll be able to review it here."
        icon={<Pencil className="h-8 w-8" />}
        action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* Pending — products you can still review */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-metu-yellow" />
            Things to review
            <span className="text-ink-dim text-sm font-normal">({pending.length})</span>
          </h2>
          <p className="text-sm text-ink-secondary mb-4">
            Products you've bought but haven't reviewed yet — share what you think.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {pending.map((p) => (
              <PendingReviewCard
                key={p.productId}
                productId={p.productId}
                name={p.name}
                image={p.images[0]?.productImage ?? null}
                storeName={p.store.name}
                storeId={p.store.storeId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Authored */}
      {reviews.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 fill-metu-yellow stroke-metu-yellow" />
            Your reviews
            <span className="text-ink-dim text-sm font-normal">({reviews.length})</span>
          </h2>
          <BuyerReviewsList reviews={reviews} />
        </section>
      ) : (
        <p className="text-sm text-ink-dim text-center py-6">
          You haven't written any reviews yet.
        </p>
      )}
    </div>
  );
}

function BuyerReviewsList({ reviews }: { reviews: Awaited<ReturnType<typeof getReviewsByUser>> }) {
  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li key={r.reviewId} className="rounded-2xl glass-morphism p-5">
          <div className="flex items-start gap-4">
            <Link
              href={`/product/${r.product.productId}`}
              className="relative h-20 w-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 border border-white/8 hover:border-metu-yellow/40 transition"
            >
              {r.product.images[0]?.productImage && (
                <Image
                  src={r.product.images[0].productImage}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={isDataUrl(r.product.images[0].productImage)}
                />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-dim mb-0.5">
                <Link href={`/store/${r.product.store.storeId}`} className="hover:text-metu-yellow">
                  {r.product.store.name}
                </Link>
              </div>
              <Link
                href={`/product/${r.product.productId}`}
                className="font-semibold text-white hover:text-metu-yellow line-clamp-1"
              >
                {r.product.name}
              </Link>
              <Stars rating={r.rating} className="mt-1.5" />
              <p className="mt-2 text-sm text-ink-secondary">{r.comment}</p>
              <div className="mt-2 text-[10px] text-ink-dim font-mono">
                {new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function SellerReviews({ storeId, storeName }: { storeId: number; storeName: string }) {
  const reviews = await getReviewsForStore(storeId);
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews on your products yet"
        description="As soon as buyers leave a review, you'll see it here."
        icon={<MessageSquare className="h-8 w-8" />}
        action={<GlassButton tone="gold" href="/seller/products">Manage products →</GlassButton>}
      />
    );
  }
  // Aggregate
  const total = reviews.length;
  const avg = reviews.reduce((a, b) => a + b.rating, 0) / total;
  return (
    <>
      {/* aggregate strip */}
      <div className="rounded-2xl glass-morphism p-5 mb-6 flex items-center gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">{storeName}</div>
          <div className="font-display text-3xl font-extrabold text-gold-gradient mt-0.5">
            {avg.toFixed(1)}★
          </div>
          <Stars rating={Math.round(avg)} className="mt-1" />
        </div>
        <div className="border-l border-white/10 h-14" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-dim">Total reviews</div>
          <div className="font-display text-3xl font-extrabold text-white mt-0.5">{total.toLocaleString()}</div>
        </div>
      </div>

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.reviewId} className="rounded-2xl glass-morphism p-5">
            <div className="flex items-start gap-4">
              <div className="relative h-10 w-10 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                {r.user.profileImage && (
                  <Image src={r.user.profileImage} alt={r.user.username} fill sizes="40px" className="object-cover" unoptimized={isDataUrl(r.user.profileImage)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  {r.user.firstName} {r.user.lastName}
                  <span className="text-ink-dim font-normal"> · @{r.user.username}</span>
                </div>
                <div className="text-xs text-ink-dim flex items-center gap-2 mt-0.5">
                  <Stars rating={r.rating} small />
                  <span className="font-mono">
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <Link
                  href={`/product/${r.product.productId}`}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/8 px-2 py-1 text-xs text-white hover:border-metu-yellow/40"
                >
                  {r.product.images[0]?.productImage && (
                    <Image src={r.product.images[0].productImage} alt="" width={20} height={20} className="rounded" unoptimized={isDataUrl(r.product.images[0].productImage)} />
                  )}
                  <span className="truncate max-w-[200px]">{r.product.name}</span>
                </Link>
                <p className="mt-3 text-sm text-ink-secondary leading-relaxed">{r.comment}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stars({ rating, className, small }: { rating: number; className?: string; small?: boolean }) {
  const sz = small ? "h-3 w-3" : "h-4 w-4";
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            sz,
            i < rating ? "fill-metu-yellow stroke-metu-yellow" : "fill-white/10 stroke-white/15",
          )}
        />
      ))}
    </div>
  );
}
