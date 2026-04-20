import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in — METU" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      {/* gold glow corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Logo size="lg" />

        <div className="mt-10 grid md:grid-cols-5 gap-8">
          <div className="md:col-span-3">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-white mb-2">
              Welcome back.
            </h1>
            <p className="text-ink-secondary mb-6 max-w-md">
              Log in to browse the marketplace, manage your store, or check on your orders.
            </p>
            <LoginForm next={searchParams.next} />
            <p className="mt-4 text-sm text-ink-secondary">
              New to METU?{" "}
              <Link href="/register" className="font-semibold text-brand-yellow hover:underline">
                Create an account →
              </Link>
            </p>
          </div>

          <aside className="md:col-span-2">
            <div className="rounded-2xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/10 to-transparent p-6 shadow-pop">
              <div className="inline-block rounded-full bg-brand-yellow px-2.5 py-0.5 text-xs font-bold text-space-black mb-3">
                Demo accounts
              </div>
              <p className="text-sm text-ink-secondary mb-4">
                Click to pre-fill the login form — useful during live demos.
              </p>
              <div className="space-y-2">
                <DemoChip label="Admin"  email="admin@metu.dev"  password="Admin#123" />
                <DemoChip label="Seller" email="seller@metu.dev" password="Seller#123" />
                <DemoChip label="Buyer"  email="buyer@metu.dev"  password="Buyer#123" />
              </div>
              <p className="mt-5 text-[11px] text-ink-dim font-mono leading-relaxed">
                Seed script creates these accounts with rich story data
                (2 past orders for the buyer, 9 products for the seller,
                a realistic marketplace overview for the admin).
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DemoChip({ label, email, password }: { label: string; email: string; password: string }) {
  return (
    <button
      type="button"
      data-demo-email={email}
      data-demo-password={password}
      className="metu-demo-chip w-full flex items-center justify-between rounded-xl bg-white/5 border border-line px-4 py-3 text-left hover:bg-white/10 hover:border-brand-yellow/40 transition"
    >
      <div>
        <div className="text-xs font-semibold text-brand-yellow">{label}</div>
        <div className="text-sm font-mono text-white">{email}</div>
      </div>
      <span className="text-xs font-mono text-ink-dim">{password}</span>
    </button>
  );
}
