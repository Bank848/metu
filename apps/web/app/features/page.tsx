import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Globe,
  Search,
  Package,
  Store as StoreIcon,
  ShoppingCart,
  Receipt,
  MessageSquare,
  User as UserIcon,
  LogIn,
  UserPlus,
    Sparkles,
  Tag as TagIcon,
  Image as ImageIcon,
  Settings,
  BarChart3,
  ShieldCheck,
  Users,
  FileBarChart,
  RotateCcw,
  Trash2,
  Pencil,
  Star,
  Eye,
  DollarSign,
  CreditCard,
  Clock,
  Palette,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { GlassButton } from "@/components/visual/GlassButton";

export const metadata = {
  title: "Features · METU",
  description: "Everything you can do on METU — broken down by buyer, seller, and admin.",
};

export default function FeaturesPage() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-[1280px] px-6 md:px-10 py-10">
        <PageHeader
          title="Feature tour"
          subtitle="Everything the METU marketplace can do, grouped by who's logged in. Click any route to jump to it."
        />

        {/* Persona cards */}
        <section className="grid md:grid-cols-4 gap-4 mb-12">
          <PersonaCard
            icon={Globe}
            tint="text-sky-300"
            label="Guest"
            count="7 pages"
            tagline="Browse & discover before signing up"
          />
          <PersonaCard
            icon={ShoppingCart}
            tint="text-emerald-300"
            label="Buyer"
            count="6 pages"
            tagline="Cart, checkout, orders & reviews"
          />
          <PersonaCard
            icon={StoreIcon}
            tint="text-metu-yellow"
            label="Seller"
            count="7 pages"
            tagline="Products, coupons, store, orders"
          />
          <PersonaCard
            icon={ShieldCheck}
            tint="text-purple-300"
            label="Admin"
            count="4 pages"
            tagline="Oversight + management actions"
          />
        </section>

        {/* GUEST / PUBLIC */}
        <RoleBlock
          icon={Globe}
          title="Guest & public surface"
          subtitle="No account required. Anyone can browse the catalogue, read reviews, and check out stores."
          accent="sky"
        >
          <FeatureCard
            icon={Sparkles}
            route="/"
            name="Home"
            bullets={[
              "Hero with shimmer text and live platform stats (sellers · products · orders · reviews)",
              "Trending products strip sorted by review count",
              "Featured creators carousel with cover photos",
              "Category tiles — click to pre-filter /browse",
            ]}
          />
          <FeatureCard
            icon={Search}
            route="/browse"
            name="Browse catalogue"
            bullets={[
              "Full-text search across product name, description, store name, tags",
              "Filter by category, tag, price range, delivery method",
              "Sort: newest / price ↑ / price ↓ / highest-rated",
              "Skeleton loader while results load; empty state when nothing matches",
            ]}
          />
          <FeatureCard
            icon={Package}
            route="/product/[id]"
            name="Product detail"
            bullets={[
              "Image gallery with thumbnail strip (4:3 hero + 4 thumbs)",
              "Variant picker (download · email · licence key · streaming) with stock + discount",
              "Store owner card with response-time pill, link to /store/[id]",
              "Reviews list with star breakdown + aggregate rating",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/store/[id]"
            name="Store page"
            bullets={[
              "Branded hero (cover + profile ring), business-type badge, verified check",
              "Store stats: product count, aggregate rating, CTR, response time",
              "Full product grid scoped to this seller",
              "Owner info + country + join date",
            ]}
          />
          <FeatureCard
            icon={LogIn}
            route="/login"
            name="Login"
            bullets={[
              "Demo-account chips (admin / seller / buyer) that pre-fill the form",
              "FormData-based submit to survive chip-click races",
              "Auto-redirect to ?next=… after success (e.g. back to /become-seller)",
              "router.refresh() after login so nav updates without F5",
            ]}
          />
          <FeatureCard
            icon={UserPlus}
            route="/register"
            name="Register"
            bullets={[
              "Zod-validated signup (username, email, password, first/last name)",
              "bcrypt hash written to Postgres; JWT httpOnly cookie issued on success",
              "Seeds UserStats row with role=buyer by default",
            ]}
          />
        </RoleBlock>

        {/* BUYER */}
        <RoleBlock
          icon={ShoppingCart}
          title="Buyer (logged-in user)"
          subtitle="Once logged in, any user can buy products, leave reviews, and track their history."
          accent="emerald"
        >
          <FeatureCard
            icon={ShoppingCart}
            route="/cart"
            name="Shopping cart"
            bullets={[
              "Multi-store cart: items grouped by seller with per-store subtotal",
              "Coupon input — validates code server-side, shows green row + discount",
              "Quantity editor, remove item, live recalculation",
              "Auth-gated: redirects to /login?next=/cart for guests",
            ]}
          />
          <FeatureCard
            icon={CreditCard}
            route="/orders/[id]?new=1"
            name="Checkout & receipt"
            bullets={[
              "Single-click checkout converts the active cart to an Order (status=paid)",
              "Confetti animation on the first view (?new=1 flag)",
              "Line-item list with Write-a-review pill per product",
              "Review pill flips to green ✓ Reviewed once submitted",
            ]}
          />
          <FeatureCard
            icon={Receipt}
            route="/orders"
            name="Order history"
            bullets={[
              "Chronological list of past orders with status badge (paid/fulfilled/cancelled/refunded)",
              "Click any order to reopen the receipt",
              "Empty state when no orders yet, with CTA to /browse",
            ]}
          />
          <FeatureCard
            icon={MessageSquare}
            route="/my-reviews"
            name="My reviews"
            bullets={[
              "\"Things to review\" — products you bought but haven't rated yet",
              "One-click Review button opens the WriteReviewDialog modal",
              "\"Your reviews\" — list of reviews you've published with stars + text",
              "Sellers see an aggregate rating card + customer reviews (via ?view=seller)",
            ]}
          />
          <FeatureCard
            icon={UserIcon}
            route="/profile"
            name="Profile"
            bullets={[
              "Avatar, name, email, join date, role badge, country",
              "Summary stats: orders placed, reviews written, store link (if seller)",
              "Log out button — router.refresh() so TopNav updates without F5",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/become-seller"
            name="Become a seller"
            bullets={[
              "Form: store name, description, business type dropdown",
              "Dual-mode image inputs (upload file ≤1 MB OR paste public URL)",
              "Profile (400×400) + cover (1600×600) with live preview + recommended dims",
              "On success: user's role flips to seller, store row created, redirect to /seller",
            ]}
          />
        </RoleBlock>

        {/* SELLER */}
        <RoleBlock
          icon={StoreIcon}
          title="Seller (store owner)"
          subtitle="Sellers get a dedicated sidebar layout at /seller/* with full inventory control over their own store."
          accent="yellow"
        >
          <FeatureCard
            icon={BarChart3}
            route="/seller"
            name="Seller dashboard"
            bullets={[
              "KPI cards: paid orders, total revenue, fulfilled count, pending count",
              "Top products (best-sellers by units sold)",
              "Recent reviews on your store with rating + comment",
              "Shortcut buttons: Edit store, View public page, New product",
            ]}
          />
          <FeatureCard
            icon={Package}
            route="/seller/products"
            name="Product inventory"
            bullets={[
              "Table of your products with thumbnail, category, price, variants, review count",
              "Empty state with CTA to /seller/products/new when starting out",
              "Active vs hidden badge on each row",
            ]}
          />
          <FeatureCard
            icon={ImageIcon}
            route="/seller/products/new"
            name="Create product"
            bullets={[
              "Basics: name, description (255-char counter), category dropdown",
              "Up to 5 images — each slot supports file upload (base64) OR URL paste",
              "Up to 10 tags from curated ProductTag table",
              "Up to 5 variants with delivery method, price, discount%, stock",
              "router.refresh() after save so inventory list updates instantly",
            ]}
          />
          <FeatureCard
            icon={TagIcon}
            route="/seller/coupons"
            name="Coupons"
            bullets={[
              "Active + expired coupon cards with Active/Paused badge",
              "Per-coupon stats: code, percent/fixed, expiry, redemption cap",
              "Shortcut to create a new code",
            ]}
          />
          <FeatureCard
            icon={Sparkles}
            route="/seller/coupons/new"
            name="Create coupon"
            bullets={[
              "UPPERCASE-only code validation (letters/numbers/_/-)",
              "Percent discount OR fixed amount, minimum-spend threshold",
              "Start + end date, max total redemptions",
              "Live preview of what buyers see at checkout",
            ]}
          />
          <FeatureCard
            icon={Palette}
            route="/seller/store/edit"
            name="Edit store"
            bullets={[
              "Change store name, description, business type",
              "Swap profile + cover images with the same dual-mode upload/URL input",
              "Live preview of how the store card will look before saving",
            ]}
          />
          <FeatureCard
            icon={Receipt}
            route="/seller/orders"
            name="Orders on your store"
            bullets={[
              "Orders where at least one line item is your product",
              "Buyer avatar, username, order total, status pill",
              "Line items restricted to your products only (multi-seller isolation)",
            ]}
          />
        </RoleBlock>

        {/* ADMIN */}
        <RoleBlock
          icon={ShieldCheck}
          title="Admin (platform operator)"
          subtitle="Marketplace oversight with real management actions — not just read-only dashboards."
          accent="purple"
        >
          <FeatureCard
            icon={BarChart3}
            route="/admin"
            name="Marketplace overview"
            bullets={[
              "KPI grid: GMV, users, stores, products, orders, pending orders",
              "14-day revenue bar chart (pure inline SVG — no chart library)",
              "Recent transactions feed (30 most recent, scrollable)",
              "Per-row actions: Refund on purchases · delete any transaction record",
            ]}
          />
          <FeatureCard
            icon={Users}
            route="/admin/users"
            name="Users management"
            bullets={[
              "Search by username / email / name + filter by role (buyer/seller/admin)",
              "Role dropdown changes a user's role in-place (buyer ⇄ seller ⇄ admin)",
              "Delete button cascades through store, products, reviews, orders",
              "Self-protect guard: you can't demote or delete your own admin account",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/admin/stores"
            name="Stores management"
            bullets={[
              "Card grid — cover + profile + business type + owner",
              "Per-store KPIs: product count, rating, CTR",
              "Delete store button with confirm; cascades to products + coupons + reviews",
            ]}
          />
          <FeatureCard
            icon={FileBarChart}
            route="/admin/reports"
            name="SQL reports"
            bullets={[
              "Revenue by category · top stores · orders by status · coupon usage · signups per day",
              "Each card renders result rows rendered as a table",
              "View SQL toggle reveals the raw parameterised query — demo-friendly for DB class",
            ]}
          />
        </RoleBlock>

        {/* Cross-cutting */}
        <section className="mt-16">
          <div className="gold-rule" style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(255,204,0,0.5), transparent)" }} />
          <h2 className="mt-8 font-display text-2xl font-extrabold text-white flex items-center gap-3">
            <Eye className="h-6 w-6 text-metu-yellow" />
            Cross-cutting features
          </h2>
          <p className="mt-1 text-sm text-ink-secondary max-w-3xl">
            Things that aren&apos;t a single page but show up everywhere in the app.
          </p>
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MiniCard icon={Clock} title="Skeleton loaders" body="Every major route has a loading.tsx that matches the page shape — no jumpy layout shifts." />
            <MiniCard icon={RotateCcw} title="router.refresh() everywhere" body="After login, logout, register, create, update, delete, and refund — nav and lists always reflect fresh data without F5." />
            <MiniCard icon={Sparkles} title="Glass-morphism + gold theme" body="Consistent dark surfaces, gold gradients, shimmer text, star fields, and a signature button-gradient CTA style." />
            <MiniCard icon={Search} title="Direct Prisma in server components" body="Catalogue reads bypass /api — server components call Prisma directly via lib/server/queries.ts. Fewer round-trips, cached ref data." />
            <MiniCard icon={DollarSign} title="Coupon math server-side" body="Percent or fixed amount, capped at subtotal, validated before checkout; UI total always matches DB total_price." />
            <MiniCard icon={Star} title="Review lifecycle" body="Write-a-review dialog in order receipt + /my-reviews pending list — unified so buyers never forget a review." />
            <MiniCard icon={Pencil} title="Image upload or URL" body="/become-seller, /seller/store/edit, /seller/products/new all accept file uploads (base64, ≤1 MB) OR public URLs." />
            <MiniCard icon={Trash2} title="Admin-only destructive actions" body="Every delete is JWT-role-gated on the server and confirms via window.confirm in the UI." />
            <MiniCard icon={Settings} title="Demo chips on /login" body="One-click pre-fill for admin@metu.dev / seller@metu.dev / buyer@metu.dev — FormData-safe against React state races." />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-2xl glass-morphism p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold text-white">Try it yourself</h2>
          <p className="mt-2 text-sm text-ink-secondary max-w-xl mx-auto">
            Use the demo chips on the login page to sign in as any role and walk the flows end-to-end.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <GlassButton tone="gold" href="/login">Open demo accounts →</GlassButton>
            <GlassButton tone="glass" href="/browse">Start browsing</GlassButton>
            <GlassButton tone="glass" href="/admin">Admin panel</GlassButton>
          </div>
        </section>

        {/* Perf note — sets expectations for the first-request slowness
            caused by Neon's serverless compute cold-starting. */}
        <p className="mt-8 text-center text-xs text-ink-dim max-w-2xl mx-auto">
          First request after an idle period may take a second or two — Neon
          (our managed Postgres) scales compute to zero to save resources
          and needs a moment to wake. A Vercel cron hits{" "}
          <code className="font-mono text-ink-secondary">/api/health</code>{" "}
          every few minutes during demo hours to keep it warm.
        </p>
      </main>
      <Footer />
    </>
  );
}

/* ────────────────────────── helpers ────────────────────────── */

function PersonaCard({
  icon: Icon,
  tint,
  label,
  count,
  tagline,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  count: string;
  tagline: string;
}) {
  return (
    <div className="rounded-2xl glass-morphism p-5">
      <Icon className={`h-6 w-6 ${tint} mb-3`} />
      <div className="font-display text-lg font-bold text-white">{label}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-dim mt-0.5">{count}</div>
      <p className="mt-3 text-sm text-ink-secondary leading-snug">{tagline}</p>
    </div>
  );
}

const ACCENT_RING = {
  sky: "ring-sky-400/30 bg-sky-400/10 text-sky-300",
  emerald: "ring-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  yellow: "ring-metu-yellow/30 bg-metu-yellow/10 text-metu-yellow",
  purple: "ring-purple-400/30 bg-purple-400/10 text-purple-300",
} as const;

function RoleBlock({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: keyof typeof ACCENT_RING;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-start gap-4 mb-5">
        <div className={`rounded-xl p-3 ring-1 ${ACCENT_RING[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">{title}</h2>
          <p className="text-sm text-ink-secondary max-w-3xl">{subtitle}</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  route,
  name,
  bullets,
}: {
  icon: LucideIcon;
  route: string;
  name: string;
  bullets: string[];
}) {
  // Only link when the route is a concrete URL (not a [param] template).
  const isConcrete = !route.includes("[");
  const header = (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-metu-yellow shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-white">{name}</div>
        <Badge variant="mist" className="mt-1 font-mono text-[10px]">{route}</Badge>
      </div>
    </div>
  );
  const inner = (
    <div className="rounded-2xl glass-morphism p-5 h-full transition hover:border-metu-yellow/40">
      {header}
      <ul className="mt-3 space-y-1.5 text-sm text-ink-secondary">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-metu-yellow/70 select-none">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return isConcrete ? (
    <Link href={route} className="block">{inner}</Link>
  ) : (
    inner
  );
}

function MiniCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl glass-morphism p-4">
      <Icon className="h-4 w-4 text-metu-yellow mb-2" />
      <div className="font-display font-bold text-white text-sm">{title}</div>
      <p className="mt-1 text-xs text-ink-secondary leading-relaxed">{body}</p>
    </div>
  );
}
