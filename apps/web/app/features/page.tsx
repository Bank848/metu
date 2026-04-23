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
  Mail,
  Bell,
  Activity,
  History,
  Zap,
  Languages,
  Sun,
  Smartphone,
  ShieldAlert,
  Map,
  FlaskConical,
  Volume2,
  Layers,
  TrendingUp,
  KeyRound,
  Shield,
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

        {/* ──────────────────────── WHAT'S NEW ────────────────────────
            Editorial spotlight on the most recent features (Phase 9 +
            Phase 10). Sits ABOVE the persona cards so a returning
            visitor immediately sees what changed.                    */}
        <section className="mt-2 mb-12 rounded-3xl surface-editorial p-7 md:p-9 relative overflow-hidden">
          <div className="absolute right-6 top-6 hidden md:flex items-center gap-2 text-[11px] font-mono text-ink-dim">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
            Phase 9 + 10 · live now
          </div>
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-coral" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-coral">
              what's new
            </span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white">
            Visual rebrand + chat + admin moderation
          </h2>
          <p className="mt-2 text-sm md:text-base text-ink-secondary max-w-2xl">
            Two big phases shipped today: a full visual rebrand (mint + coral
            palette, asymmetric grids, new card primitives) and the messaging /
            authoring / moderation work the team flagged in the audit.
          </p>

          <div className="mt-7 grid grid-cols-2 md:grid-cols-3 gap-3">
            <SpotlightCard
              icon={MessageSquare}
              tone="mint"
              title="Buyer messaging"
              body="Chat icon + unread badge in TopNav, /messages inbox, 'Message store' / 'Ask the seller' CTAs everywhere."
              href="/messages"
            />
            <SpotlightCard
              icon={Shield}
              tone="coral"
              title="Admin moderation"
              body="Edit/delete reviews + Q&A from the product page. Coral 'MOD' pip + audit log on every action."
              href="/admin/audit"
            />
            <SpotlightCard
              icon={Layers}
              tone="mint"
              title="Form primitives"
              body="FormSection, TextInput, VariantRow, PreviewPane, DataTable, ActionRow — every dashboard form rebuilt."
              href="/seller/products/new"
            />
            <SpotlightCard
              icon={Palette}
              tone="coral"
              title="Visual rebrand"
              body="Mint + coral secondary accents, surface-flat / accent / editorial variants, asymmetric grids."
              href="/"
            />
            <SpotlightCard
              icon={Languages}
              tone="mint"
              title="TH / EN locale"
              body="Scoped TH/EN i18n in nav, footer, cart. Prompt font wired for Thai-locale strings."
              href="/"
            />
            <SpotlightCard
              icon={Sun}
              tone="coral"
              title="Light mode"
              body="Toggle in TopNav cluster, persisted to localStorage, no flash on hard reload."
              href="/"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-dim">
            <Bell className="h-3.5 w-3.5 text-mint" />
            <span>Browse all batches at</span>
            <Link
              href="/admin/changelog"
              className="font-mono text-mint hover:underline"
            >
              /admin/changelog
            </Link>
            <span>(admin login required)</span>
          </div>
        </section>

        {/* Persona cards — refreshed counts, mint accent on the
            highest-traffic personas (Buyer + Seller). */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <PersonaCard
            icon={Globe}
            tint="text-ink-secondary"
            label="Guest"
            count="8 pages"
            tagline="Browse & discover before signing up"
          />
          <PersonaCard
            icon={ShoppingCart}
            tint="text-mint"
            label="Buyer"
            count="9 pages"
            tagline="Cart, orders, reviews & chat"
            badge="Phase 10"
          />
          <PersonaCard
            icon={StoreIcon}
            tint="text-metu-yellow"
            label="Seller"
            count="11 pages"
            tagline="Products, coupons, store, inbox"
            badge="Refreshed"
          />
          <PersonaCard
            icon={ShieldCheck}
            tint="text-coral"
            label="Admin"
            count="6 pages"
            tagline="Oversight, moderation, audit"
            badge="+ moderation"
          />
        </section>

        {/* ─────────── Visual mockup strip ───────────
            Mini "screenshot" cards rendered with real component
            snippets so the page itself becomes a tour, not just a
            list of bullets. Designed for the user request:
            "ทำให้เห็นภาพมากขึ้น". */}
        <section className="mt-2 mb-12">
          <h2 className="font-display text-xl md:text-2xl font-extrabold text-white mb-1">
            See it in motion
          </h2>
          <p className="text-sm text-ink-secondary mb-5">
            Three patterns the rebrand introduced — try them on the live site.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <MockupCard
              title="Asymmetric homepage grid"
              caption="Lead product = mint feature card spanning 2 cols; the rest fall in around it. Kills the 4-equal-col 'AI grid' tell."
              href="/"
            >
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="col-span-2 row-span-2 rounded-lg surface-accent border border-mint/30 flex items-center justify-center">
                  <Package className="h-8 w-8 text-mint/60" />
                </div>
                <div className="rounded-lg surface-flat border border-white/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-ink-dim" />
                </div>
                <div className="rounded-lg surface-flat border border-white/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-ink-dim" />
                </div>
                <div className="rounded-lg surface-flat border border-white/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-ink-dim" />
                </div>
                <div className="rounded-lg surface-flat border border-white/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-ink-dim" />
                </div>
                <div className="rounded-lg surface-flat border border-white/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-ink-dim" />
                </div>
              </div>
            </MockupCard>

            <MockupCard
              title="TopNav control cluster"
              caption="Sound · Theme · Locale nest in one rounded shell with hairline dividers — three buttons read as one settings unit."
              href="/"
            >
              <div className="flex items-center justify-center h-full gap-3">
                <div className="flex items-center rounded-full border border-white/15 bg-white/[0.04] px-1 py-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary">
                    <Volume2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="mx-0.5 h-3 w-px bg-white/10" />
                  <div className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary">
                    <Sun className="h-3.5 w-3.5" />
                  </div>
                  <span className="mx-0.5 h-3 w-px bg-white/10" />
                  <div className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold uppercase text-white">
                    <span className="inline-block h-1 w-1 rounded-full bg-mint" />
                    EN
                  </div>
                </div>
              </div>
            </MockupCard>

            <MockupCard
              title="Live product preview"
              caption="Sticky <PreviewPane /> on the right of every seller form — see the marketplace card update as you type."
              href="/seller/products/new"
            >
              <div className="grid grid-cols-2 gap-2 h-full">
                <div className="space-y-1.5">
                  <div className="h-2 rounded bg-white/15 w-3/4" />
                  <div className="h-2 rounded bg-white/10 w-1/2" />
                  <div className="h-1.5 rounded bg-white/8 w-2/3 mt-3" />
                  <div className="h-1.5 rounded bg-white/8 w-3/5" />
                  <div className="h-1.5 rounded bg-white/8 w-1/2" />
                  <div className="h-3 rounded-md bg-mint/30 w-12 mt-3" />
                </div>
                <div className="rounded-lg surface-accent border border-mint/30 p-2">
                  <div className="aspect-[4/3] rounded bg-mint/10 mb-1.5 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-mint/50" />
                  </div>
                  <div className="h-1.5 rounded bg-white/15 w-3/4 mb-1" />
                  <div className="h-1.5 rounded bg-mint/40 w-1/3" />
                </div>
              </div>
            </MockupCard>
          </div>
        </section>

        {/* GUEST / PUBLIC */}
        <RoleBlock
          icon={Globe}
          title="Guest & public surface"
          subtitle="No account required. Anyone can browse the catalogue, read reviews, check out stores, and install the PWA."
          accent="sky"
        >
          <FeatureCard
            icon={Sparkles}
            route="/"
            name="Home"
            tag="Rebranded"
            bullets={[
              "Asymmetric trending grid — first product = 2-col mint feature card",
              "Stats strip with one highlighted KPI (mint surface-accent), three flat tiles",
              "Featured creators broken into 1-large + 3-small layout",
              "Category tiles rotate radii (lg / xl / 2xl / 3xl) to break the symmetry",
            ]}
          />
          <FeatureCard
            icon={Search}
            route="/browse"
            name="Browse catalogue"
            bullets={[
              "Full-text search across product name, description, store name, tags",
              "Filter sidebar with descending radii + mint accent on active rows",
              "Rating filter pushed to a $queryRaw HAVING — total/totalPages now correct",
              "Empty state uses the new bespoke <NoResults /> SVG illustration",
            ]}
          />
          <FeatureCard
            icon={Package}
            route="/product/[id]"
            name="Product detail"
            tag="Rebranded"
            bullets={[
              "Buy-box wrapped in mint surface-accent — visual page anchor",
              "'Ask the seller' link opens /messages with productId pre-pinned",
              "Reviews + Q&A panels: edit/delete buttons for owner OR admin (coral MOD pip)",
              "Q&A label correctly reads 'Admin answered' vs 'Seller answered'",
              "Discount chip moved off gold-gradient text → solid coral pill (readable at any size)",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/store/[id]"
            name="Store page"
            tag="+ Message CTA"
            bullets={[
              "surface-hero cover with coral underline on the store name",
              "'Message store' coral pill in the hero next to Share",
              "Store stats: products, rating, response time — first metric uses StatCard variant=highlight",
              "Product grid has 1 mint feature card + rest default for asymmetric rhythm",
            ]}
          />
          <FeatureCard
            icon={LogIn}
            route="/login"
            name="Login"
            bullets={[
              "Demo-account chips (admin / seller / buyer) that pre-fill the form",
              "Rate-limited at 5 attempts/min by middleware (Redis-free, in-memory)",
              "Forgot-password flow with SHA-256 hashed token, 30-min TTL",
              "Live DB role check — no logout/login required after a role change",
            ]}
          />
          <FeatureCard
            icon={UserPlus}
            route="/register"
            name="Register"
            bullets={[
              "Cloudflare Turnstile CAPTCHA (no-op without env, prod-only)",
              "Zod-validated signup → bcrypt → JWT httpOnly cookie",
              "Audit-log row written for every new account",
            ]}
          />
          <FeatureCard
            icon={Activity}
            route="/health"
            name="System health"
            tag="Public"
            bullets={[
              "Live DB ping with mint/coral/red colour-graded badge (FAST/OK/SLOW/DOWN)",
              "Build SHA, Fly region, soft-delete-aware catalogue counts",
              "JSON variant at /api/health — same data for scripts & uptime monitors",
            ]}
          />
          <FeatureCard
            icon={Smartphone}
            route="/manifest.webmanifest"
            name="Install as PWA"
            bullets={[
              "Branded SVG icon (any + maskable) for Android adaptive icons",
              "Standalone display, theme-color #FFD000, start_url /",
              "Sitemap.xml + robots.txt at the root for SEO crawlers",
            ]}
          />
        </RoleBlock>

        {/* BUYER */}
        <RoleBlock
          icon={ShoppingCart}
          title="Buyer (logged-in user)"
          subtitle="Once logged in, any user can buy products, leave reviews, chat with stores, and track their history."
          accent="emerald"
        >
          <FeatureCard
            icon={ShoppingCart}
            route="/cart"
            name="Shopping cart"
            tag="Rebranded"
            bullets={[
              "Multi-store cart, line wrappers in surface-flat, summary card in mint surface-accent",
              "Coupon validation surfaces explicit toast (mint success / coral error)",
              "Save-for-later moves a line into favourites; toast confirms either way",
              "Empty cart uses the new <EmptyCart /> SVG illustration",
              "Checkout busy state guaranteed to reset (was strandable on early throw)",
            ]}
          />
          <FeatureCard
            icon={Mail}
            route="/messages"
            name="Messages inbox"
            tag="NEW"
            bullets={[
              "Buyer-facing inbox at /messages — was 404 before Phase 10",
              "Threads grouped by sender with unread mint accent",
              "Chat icon + unread badge in TopNav fetches /api/messages/unread on mount",
              "'Messages' entry in AuthMenu next to My orders / My reviews",
            ]}
          />
          <FeatureCard
            icon={MessageSquare}
            route="/messages/[userId]"
            name="Conversation thread"
            tag="+ context"
            bullets={[
              "URL ?productId=… or ?orderId=… renders a context pill above compose",
              "Persists Message.productId / Message.orderId on send for thread context",
              "Polls every 8s for new replies",
              "'Back to inbox' link routes by viewer role (buyer → /messages, seller → /seller/messages)",
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
              "'Message seller about this order' inline link — opens /messages with orderId pinned",
            ]}
          />
          <FeatureCard
            icon={Receipt}
            route="/orders"
            name="Order history"
            bullets={[
              "Chronological list with status badge (paid/fulfilled/cancelled/refunded)",
              "Order cards on surface-flat with lift-on-hover",
              "Empty state with CTA to /browse",
            ]}
          />
          <FeatureCard
            icon={Star}
            route="/my-reviews"
            name="My reviews"
            bullets={[
              "'Things to review' — products you bought but haven't rated yet",
              "WriteReviewDialog modal traps focus + restores it on close (a11y)",
              "Edit/delete your own reviews from the product page directly",
            ]}
          />
          <FeatureCard
            icon={UserIcon}
            route="/profile"
            name="Profile"
            bullets={[
              "Avatar, name, email, join date, role badge, country",
              "Summary stats: orders, reviews, store link (if seller)",
              "GDPR data export — download every byte we have on you as JSON",
            ]}
          />
          <FeatureCard
            icon={Pencil}
            route="/profile/edit"
            name="Edit profile"
            bullets={[
              "Update first/last name (responsive grid stacks on mobile)",
              "Avatar upload (file or URL, ≤1 MB)",
              "Change-password section with current-password verify",
              "Two-factor TOTP scaffolded (not enforced — opt-in)",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/become-seller"
            name="Become a seller"
            tag="Refreshed"
            bullets={[
              "Multi-section form: Identity / Storefront with FormSection wrappers",
              "Live <PreviewPane variant='store'> on the right shows your card as you type",
              "Profile (400×400) + cover (1600×600) with compact image inputs",
            ]}
          />
        </RoleBlock>

        {/* SELLER */}
        <RoleBlock
          icon={StoreIcon}
          title="Seller (store owner)"
          subtitle="Sellers get a dedicated /seller/* layout with a sidebar, full inventory control, coupons, and a buyer inbox."
          accent="yellow"
        >
          <FeatureCard
            icon={BarChart3}
            route="/seller"
            name="Seller dashboard"
            tag="Rebranded"
            bullets={[
              "Greeting in surface-editorial; lead StatCard uses variant=highlight",
              "KPIs: paid orders, total revenue, fulfilled, pending",
              "RevenueChart switched to mint with 4-line gridline backdrop",
              "Coral-accented low-stock banner when any variant ≤ 5 units",
            ]}
          />
          <FeatureCard
            icon={Package}
            route="/seller/products"
            name="Product inventory"
            bullets={[
              "Table with thumbnail, category, price, stock, review count",
              "Active vs Paused toggle without page reload",
              "Duplicate product (one-click clone, paused by default)",
              "Bulk-edit prices (apply ±N% to selected rows)",
            ]}
          />
          <FeatureCard
            icon={ImageIcon}
            route="/seller/products/new"
            name="Create product"
            tag="Rebuilt"
            bullets={[
              "4 FormSection blocks: Basics / Imagery / Variants / Review",
              "Cramped 4-col variant grid → semantic <VariantRow /> with delivery label above inputs",
              "Sticky <PreviewPane variant='product'> on the right — live marketplace card",
              "FileImageInput shrunk to compact 64×64 (was a giant 400px box)",
              "PriceInput shows 'Buyer sees: ฿XXX after Y% off' inline",
            ]}
          />
          <FeatureCard
            icon={Pencil}
            route="/seller/products/[id]/edit"
            name="Edit product"
            tag="Rebuilt"
            bullets={[
              "Same primitives as Create — full FormSection + VariantRow + PreviewPane",
              "Coral 'Variants with sales history are locked' banner above Variants",
              "Trash icon visually disabled + tooltip on protected variants",
            ]}
          />
          <FeatureCard
            icon={TagIcon}
            route="/seller/coupons/new"
            name="Create coupon"
            tag="+ live preview"
            bullets={[
              "Coupon details + Schedule + limits in two FormSection blocks",
              "<PreviewPane variant='coupon'> shows how the discount renders",
              "UPPERCASE-only code validation, percent or fixed amount",
              "Per-coupon report at /seller/coupons/[id]/report",
            ]}
          />
          <FeatureCard
            icon={Palette}
            route="/seller/store/edit"
            name="Edit store"
            tag="Refreshed"
            bullets={[
              "FormSection split: Store details / Imagery (mint surface-accent on Imagery)",
              "Live storefront preview synced to form state",
              "Soft-delete via DELETE /api/admin/stores/[id] (admin only)",
            ]}
          />
          <FeatureCard
            icon={Receipt}
            route="/seller/orders"
            name="Orders on your store"
            bullets={[
              "Orders where at least one line item is your product",
              "Mark fulfilled / cancelled inline; refund any paid order",
              "Download CSV: orderId, date, buyer, items, totals, status",
            ]}
          />
          <FeatureCard
            icon={MessageSquare}
            route="/seller/messages"
            name="Buyer inbox"
            bullets={[
              "Threads grouped by sender, unread mint dot",
              "Same view available to buyers at /messages — shared component",
              "Sidebar entry shows unread count (mint, was amber pre-Phase-10)",
            ]}
          />
          <FeatureCard
            icon={TrendingUp}
            route="/seller/analytics"
            name="Analytics"
            bullets={[
              "30-day revenue chart from raw $queryRaw aggregates",
              "Top products, top buyers tables",
              "Order-status distribution",
            ]}
          />
        </RoleBlock>

        {/* ADMIN */}
        <RoleBlock
          icon={ShieldCheck}
          title="Admin (platform operator)"
          subtitle="Marketplace oversight with real management actions, content moderation, and a fully audited paper trail."
          accent="purple"
        >
          <FeatureCard
            icon={BarChart3}
            route="/admin"
            name="Marketplace overview"
            tag="Rebranded"
            bullets={[
              "Hero in surface-editorial, GMV StatCard highlighted in mint",
              "KPI grid: GMV, users, stores, products, orders, pending",
              "RevenueChart in mint with anchored gridlines",
              "Recent transactions feed with row actions (refund / delete) via <ActionRow />",
            ]}
          />
          <FeatureCard
            icon={Shield}
            route="/product/[id]"
            name="Content moderation"
            tag="NEW · Phase 10"
            bullets={[
              "Edit/delete reviews and Q&A from any product page (admin or owner)",
              "Coral 'MOD' pip clearly marks moderation actions vs self-edits",
              "Every admin moderation event written to audit log with before/after snapshot",
              "Admin can edit answer text on Q&A; sellers continue using the answer form",
            ]}
          />
          <FeatureCard
            icon={Users}
            route="/admin/users"
            name="Users management"
            tag="DataTable"
            bullets={[
              "<DataTable /> swap with sticky header, surface-flat row hover",
              "Search by username/email/name + filter by role",
              "Role badges: admin yellow, seller mint, buyer mist (consolidated palette)",
              "<ActionRow /> dropdown: change role, soft-delete; coral on destructive",
            ]}
          />
          <FeatureCard
            icon={StoreIcon}
            route="/admin/stores"
            name="Stores management"
            tag="DataTable"
            bullets={[
              "Card grid → proper <DataTable /> for parity with Users",
              "Per-store 'Products' KPI promoted to StatCard variant=highlight",
              "Soft-delete via deletedAt — public queries filter automatically",
            ]}
          />
          <FeatureCard
            icon={History}
            route="/admin/audit"
            name="Audit log"
            tag="Phase 10 wired"
            bullets={[
              "<DataTable /> with action + targetType filter chips preserved",
              "Action prefix → Badge tone (delete=purple, refund=yellow, fulfilled=mint)",
              "Captures user.delete, store.delete, product.delete, transaction.refund,",
              "review.edit, review.delete, question.edit, question.delete with snapshots",
            ]}
          />
          <FeatureCard
            icon={FileBarChart}
            route="/admin/reports"
            name="SQL reports"
            bullets={[
              "Revenue by category · top stores · orders by status · coupon usage · signups per day",
              "Each card renders result rows as a table",
              "View SQL toggle reveals the raw parameterised query — demo-friendly for DB class",
            ]}
          />
          <FeatureCard
            icon={Sparkles}
            route="/admin/changelog"
            name="What's new"
            bullets={[
              "Per-batch cards (Phase 9, Phase 10, Batches A–G, Batch 0)",
              "Each card lists every shipped feature with commit SHA + ship time",
              "Server-rendered (no JS) — fast and printable",
            ]}
          />
        </RoleBlock>

        {/* ──────────── CROSS-CUTTING ──────────── */}
        <section className="mt-16">
          <div className="h-px bg-gradient-to-r from-transparent via-mint/40 to-coral/40" />
          <h2 className="mt-8 font-display text-2xl font-extrabold text-white flex items-center gap-3">
            <Eye className="h-6 w-6 text-mint" />
            Cross-cutting features
          </h2>
          <p className="mt-1 text-sm text-ink-secondary max-w-3xl">
            Things that aren&apos;t a single page but show up everywhere.
          </p>
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MiniCard icon={Languages} title="TH / EN i18n" body="Scoped dictionary in lib/i18n: TopNav, footer, cart, empty states. Cookie + localStorage persisted; Prompt font wired for Thai." accent="mint" />
            <MiniCard icon={Sun} title="Light / dark theme" body="Toggle in TopNav cluster; html.light overrides bg-space-* / glass / vibrant-mesh. Inline bootstrap script kills the flash on hard reload." accent="mint" />
            <MiniCard icon={Volume2} title="Sound effects" body="Web Audio cues (no asset bytes) for cart pop, review ding, error buzz. Pre-warmed on first gesture so async cues survive Chrome's autoplay policy." accent="mint" />
            <MiniCard icon={Layers} title="Authoring primitives" body="FormSection, TextInput / Textarea / Select / Number / Price, VariantRow, PreviewPane, DataTable, ActionRow — every dashboard form reuses them." accent="mint" />
            <MiniCard icon={ShieldAlert} title="Soft-delete + audit" body="User / Store / Product carry deletedAt; admin destructive routes write before/after snapshots to AuditLog table. Public queries filter out soft-deleted automatically." accent="coral" />
            <MiniCard icon={KeyRound} title="Rate limit + reset + CAPTCHA" body="Login + register + forgot-password rate-limited at 5/min. Password reset via SHA-256 hashed token (30 min TTL). Optional Cloudflare Turnstile on register." accent="coral" />
            <MiniCard icon={Activity} title="Observability" body="@sentry/nextjs (lazy-loaded only when DSN set), Plausible analytics (cookie-free), public /health page with colour-graded ping." accent="coral" />
            <MiniCard icon={Map} title="PWA + sitemap + robots" body="Installable with branded maskable SVG icon. Dynamic /sitemap.xml lists every product + store; /robots.txt blocks /api /admin /seller /messages." accent="mint" />
            <MiniCard icon={Smartphone} title="A11y" body="Skip-to-content link as first focusable, useFocusTrap on modals, color-contrasted accent palette, light-mode parity for surface tokens." accent="mint" />
            <MiniCard icon={FlaskConical} title="Vitest + Playwright" body="26 unit tests for cart math + utils helpers. 4 Playwright persona smoke specs (guest / buyer / seller / admin) run against the live deploy in ~20s." accent="mint" />
            <MiniCard icon={Clock} title="GMT+7 server clock" body="Fly machine pinned to TZ=Asia/Bangkok so server-rendered timestamps (audit log, changelog) match the Thai user's frame. Postgres still stores UTC." accent="coral" />
            <MiniCard icon={Trash2} title="GDPR data export" body="GET /api/profile/export streams a JSON dump of every row a user owns: profile, orders, reviews, favourites, messages, audit entries." accent="coral" />
            <MiniCard icon={Zap} title="Neon keep-warm" body="Vercel cron pings /api/health every 4 min so Neon's serverless compute never cold-starts during demo hours. SELECT 1 + < 100ms." accent="mint" />
            <MiniCard icon={DollarSign} title="Coupon + cart math" body="Pure cart-math helpers extracted to lib/cart-math.ts: maxForLine, subtotalOf, eligibleSubtotalForStore, discountFromCoupon, cartTotal. 100% unit-tested." accent="mint" />
            <MiniCard icon={Settings} title="Demo chips on /login" body="One-click pre-fill for admin@metu.dev / seller@metu.dev / buyer@metu.dev. FormData-safe against React-state races." accent="mint" />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-2xl surface-accent p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold text-white">Try it yourself</h2>
          <p className="mt-2 text-sm text-ink-secondary max-w-xl mx-auto">
            Use the demo chips on the login page to sign in as any role and walk the flows end-to-end.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <GlassButton tone="gold" href="/login">Open demo accounts →</GlassButton>
            <GlassButton tone="mint" href="/messages">Try messaging</GlassButton>
            <GlassButton tone="glass" href="/admin/changelog">All releases</GlassButton>
          </div>
        </section>

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

/**
 * Spotlight card for the "What's new" hero strip — bigger than a
 * MiniCard, with a tinted icon block and a hover scale. Tone selects
 * the accent surface (mint or coral).
 */
function SpotlightCard({
  icon: Icon,
  tone,
  title,
  body,
  href,
}: {
  icon: LucideIcon;
  tone: "mint" | "coral";
  title: string;
  body: string;
  href: string;
}) {
  const ringTone =
    tone === "mint"
      ? "bg-mint/15 text-mint border-mint/30"
      : "bg-coral/15 text-coral border-coral/30";
  return (
    <Link
      href={href}
      className={`group relative rounded-2xl surface-flat p-4 lift-on-hover hover:shadow-raised transition border ${
        tone === "mint" ? "hover:border-mint/40" : "hover:border-coral/40"
      }`}
    >
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border ${ringTone} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-display text-sm font-bold text-white">{title}</div>
      <p className="mt-1 text-xs text-ink-secondary leading-relaxed">{body}</p>
    </Link>
  );
}

/**
 * Mockup card — a small inline visual that hints at what a page looks
 * like, without shipping a screenshot binary. Uses real surface tokens
 * so the mockup itself stays on-brand.
 */
function MockupCard({
  title,
  caption,
  href,
  children,
}: {
  title: string;
  caption: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl surface-flat p-4 lift-on-hover hover:shadow-raised hover:border-metu-yellow/30 block"
    >
      <div className="aspect-[5/3] rounded-xl bg-surface-3 border border-white/8 p-3 mb-3 overflow-hidden">
        {children}
      </div>
      <div className="font-display font-bold text-sm text-white">{title}</div>
      <p className="mt-1 text-xs text-ink-secondary leading-snug">{caption}</p>
    </Link>
  );
}

function PersonaCard({
  icon: Icon,
  tint,
  label,
  count,
  tagline,
  badge,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  count: string;
  tagline: string;
  badge?: string;
}) {
  return (
    <div className="surface-flat rounded-2xl p-5 lift-on-hover hover:shadow-raised relative">
      {badge && (
        <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-coral/15 border border-coral/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-coral">
          {badge}
        </span>
      )}
      <Icon className={`h-6 w-6 ${tint} mb-3`} />
      <div className="font-display text-lg font-bold text-white">{label}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-dim mt-0.5">{count}</div>
      <p className="mt-3 text-sm text-ink-secondary leading-snug">{tagline}</p>
    </div>
  );
}

const ACCENT_RING = {
  sky: "ring-mint/30 bg-mint/10 text-mint",
  emerald: "ring-mint/30 bg-mint/10 text-mint",
  yellow: "ring-metu-yellow/30 bg-metu-yellow/10 text-metu-yellow",
  purple: "ring-coral/30 bg-coral/10 text-coral",
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
  tag,
}: {
  icon: LucideIcon;
  route: string;
  name: string;
  bullets: string[];
  // Optional small badge in the top-right (e.g. "NEW", "Rebranded",
  // "Phase 10"). Coral tone — we use coral as the "new / changed"
  // marker across the whole site now.
  tag?: string;
}) {
  const isConcrete = !route.includes("[");
  const header = (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-metu-yellow shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-white flex items-center gap-2 flex-wrap">
          <span>{name}</span>
          {tag && (
            <span className="inline-flex items-center rounded-md bg-coral/15 border border-coral/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-coral">
              {tag}
            </span>
          )}
        </div>
        <Badge variant="mist" className="mt-1 font-mono text-[10px]">{route}</Badge>
      </div>
    </div>
  );
  const inner = (
    <div className="surface-flat rounded-2xl p-5 h-full lift-on-hover hover:shadow-raised hover:border-metu-yellow/40">
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
  accent = "mint",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: "mint" | "coral";
}) {
  const tint = accent === "mint" ? "text-mint" : "text-coral";
  return (
    <div className="surface-flat rounded-xl p-4 lift-on-hover hover:shadow-raised">
      <Icon className={`h-4 w-4 ${tint} mb-2`} />
      <div className="font-display font-bold text-white text-sm">{title}</div>
      <p className="mt-1 text-xs text-ink-secondary leading-relaxed">{body}</p>
    </div>
  );
}
