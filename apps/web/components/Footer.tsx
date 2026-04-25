import Link from "next/link";
import { Logo } from "./Logo";
import { BrandMark } from "./illustrations/BrandMark";
import { getServerT } from "@/lib/i18n/server";
import { getMe } from "@/lib/session";

export async function Footer() {
  const t = getServerT();
  const me = await getMe();
  // Phase 11 / F4 — the footer's "Admin panel" link was rendered to
  // every visitor. Bouncing guests through /login is harmless but the
  // CTA is noise on a marketing-facing surface. Gate on role so only
  // admins see it (matches the TopNav admin pill in `TopNav.tsx`).
  const isAdmin = me?.role === "admin";
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 bg-surface-2 text-white">
      {/* Top hairline — kept (it's the one editorial moment that pairs
          well with the gold CTA in the row above) but tinted toward
          coral on the right edge so it's not pure-yellow-everywhere. */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-metu-yellow to-coral/40"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-dot-grid opacity-[0.04]"
      />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-8 py-14">
        {/*
          Asymmetric 12-col layout: brand column eats 5 cols, the three
          link columns share the remaining 7. Old layout was a perfect
          4-equal-col grid (the AI tell). On mobile we stack — the
          brand column gets a bit of breathing room then the link
          columns wrap as a 2x2 grid.
        */}
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand column — wider, illustrated, with the wordmark
              given a tiny floating coral spark via BrandMark. */}
          <div className="md:col-span-5 max-w-md">
            <div className="flex items-center gap-3">
              <Logo size="lg" asLink={false} showMark={false} />
              <BrandMark className="h-8 w-8 text-metu-yellow" />
            </div>
            <p className="mt-5 text-base text-ink-secondary leading-relaxed">
              {t("footer.tagline")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* Course / cohort badge — first time the footer
                  surfaces the project context as something other than
                  a footer-bottom afterthought. */}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-mint/10 border border-mint/25 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-mint">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-mint" />
                CPE241 · KMUTT · Group 8
              </span>
              <span className="text-[11px] text-ink-dim font-mono">v0.9 · demo build</span>
            </div>
          </div>

          {/* Link columns — three narrow stacks. Each gets a smaller
              footprint than the brand column so the eye lands on the
              wordmark first. The three headings use mixed weights:
              extrabold display for the first, semibold body for the
              other two — so they're not three identical caps-labels. */}
          <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
            <FooterColumn
              title="Marketplace"
              titleHref="/browse"
              accent="primary"
            >
              <FooterLink href="/browse">Browse</FooterLink>
              <FooterLink href="/browse?sort=rating">Top rated</FooterLink>
              <FooterLink href="/browse?sort=newest">New releases</FooterLink>
            </FooterColumn>

            <FooterColumn title="Sellers" titleHref="/seller" accent="mint">
              <FooterLink href="/seller">Seller dashboard</FooterLink>
              <FooterLink href="/become-seller">Start selling</FooterLink>
            </FooterColumn>

            <FooterColumn title="Demo" titleHref="/login" accent="coral">
              <FooterLink href="/features">Feature tour</FooterLink>
              <FooterLink href="/login">Demo accounts</FooterLink>
              {isAdmin && <FooterLink href="/admin">Admin panel</FooterLink>}
              <FooterLink href="/my-reviews">My reviews</FooterLink>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/8 text-xs text-ink-dim flex flex-wrap items-center justify-between gap-3">
          <span>{t("footer.copyright", { year })}</span>
          <span className="font-mono">Next.js · Prisma · Postgres</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  titleHref,
  accent = "primary",
  children,
}: {
  title: string;
  titleHref?: string;
  // Each column gets a different micro-accent on its heading underline
  // — primary (yellow), mint, or coral. Tiny detail, but it kills the
  // "three identical caps labels" symmetry from the old layout.
  accent?: "primary" | "mint" | "coral";
  children: React.ReactNode;
}) {
  const accentBar =
    accent === "mint"
      ? "bg-mint"
      : accent === "coral"
        ? "bg-coral"
        : "bg-metu-yellow";

  // Headers vary in weight too — first column extrabold display, the
  // other two semibold body. Asymmetric typographic rhythm.
  const headingWeight =
    accent === "primary"
      ? "font-display font-extrabold text-sm"
      : "font-semibold text-xs uppercase tracking-wider";

  // Header is itself a link (so the "section label" actually goes
  // somewhere when clicked — solves the "looks clickable but isn't" UX
  // nit).
  const heading = (
    <h4 className={`mb-4 text-white ${headingWeight}`}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className={`inline-block h-1 w-6 rounded-full ${accentBar}`} />
        {title}
      </span>
    </h4>
  );

  return (
    <div>
      {titleHref ? (
        <Link href={titleHref} className="block hover:opacity-80 transition">
          {heading}
        </Link>
      ) : heading}
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-ink-secondary hover:text-white inline-flex items-center gap-1 transition"
      >
        {children}
      </Link>
    </li>
  );
}
