import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-24 bg-space-900 text-white">
      {/* Top gold hairline */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-[0.05]"
      />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo size="md" asLink={false} />
            <p className="mt-4 text-sm text-ink-secondary">
              A digital marketplace for Thai creators. Sell templates, courses, music,
              and art without ever shipping a thing.
            </p>
            <p className="mt-3 text-xs font-mono text-brand-yellow/80">
              CPE241 · KMUTT · Group 8
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-xs uppercase tracking-wider text-ink-dim">
              Marketplace
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/browse" className="text-ink-secondary hover:text-brand-yellow">Browse</Link></li>
              <li><Link href="/browse?sort=rating" className="text-ink-secondary hover:text-brand-yellow">Top rated</Link></li>
              <li><Link href="/browse?sort=newest" className="text-ink-secondary hover:text-brand-yellow">New releases</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-xs uppercase tracking-wider text-ink-dim">
              Sellers
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/seller" className="text-ink-secondary hover:text-brand-yellow">Seller dashboard</Link></li>
              <li><Link href="/become-seller" className="text-ink-secondary hover:text-brand-yellow">Start selling</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-xs uppercase tracking-wider text-ink-dim">
              Demo
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="text-ink-secondary hover:text-brand-yellow">Demo accounts</Link></li>
              <li><Link href="/admin" className="text-ink-secondary hover:text-brand-yellow">Admin panel</Link></li>
              <li><a href="http://localhost:8081" target="_blank" rel="noopener" className="text-ink-secondary hover:text-brand-yellow">Adminer (DB)</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-line text-xs text-ink-dim flex items-center justify-between">
          <span>© 2026 METU · Built in Bangkok · CPE241 · KMUTT · Group 8</span>
          <span className="font-mono">Next.js · Prisma · Postgres</span>
        </div>
      </div>
    </footer>
  );
}
