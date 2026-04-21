import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-24 bg-surface-2 text-white">
      {/* Top gold hairline */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-metu-yellow to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-[0.04]"
      />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo size="md" asLink={false} />
            <p className="mt-4 text-sm text-ink-secondary">
              A digital marketplace for Thai creators. Sell templates, courses, music,
              and art without ever shipping a thing.
            </p>
            <p className="mt-3 text-xs font-mono text-metu-yellow/80">
              CPE241 · KMUTT · Group 8
            </p>
          </div>

          <FooterColumn title="Marketplace" titleHref="/browse">
            <FooterLink href="/browse">Browse</FooterLink>
            <FooterLink href="/browse?sort=rating">Top rated</FooterLink>
            <FooterLink href="/browse?sort=newest">New releases</FooterLink>
          </FooterColumn>

          <FooterColumn title="Sellers" titleHref="/seller">
            <FooterLink href="/seller">Seller dashboard</FooterLink>
            <FooterLink href="/become-seller">Start selling</FooterLink>
          </FooterColumn>

          <FooterColumn title="Demo" titleHref="/login">
            <FooterLink href="/login">Demo accounts</FooterLink>
            <FooterLink href="/admin">Admin panel</FooterLink>
            <FooterLink href="/my-reviews">My reviews</FooterLink>
          </FooterColumn>
        </div>
        <div className="mt-10 pt-6 border-t border-white/8 text-xs text-ink-dim flex items-center justify-between">
          <span>© 2026 METU · Built in Bangkok · CPE241 · KMUTT · Group 8</span>
          <span className="font-mono">Next.js · Prisma · Postgres</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  titleHref,
  children,
}: {
  title: string;
  titleHref?: string;
  children: React.ReactNode;
}) {
  // Header is itself a link (so the "section label" actually goes somewhere
  // when clicked — solves the "looks clickable but isn't" UX nit).
  const heading = (
    <h4 className="font-display font-bold mb-3 text-xs uppercase tracking-wider text-metu-yellow">
      {title}
    </h4>
  );
  return (
    <div>
      {titleHref ? (
        <Link href={titleHref} className="block hover:opacity-80 transition">
          {heading}
        </Link>
      ) : heading}
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-secondary hover:text-metu-yellow inline-flex items-center gap-1 transition">
        {children}
      </Link>
    </li>
  );
}
