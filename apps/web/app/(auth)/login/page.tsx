import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { LoginForm } from "./LoginForm";
import { DemoChip } from "./DemoChip";
import { safeGetSettings } from "@/lib/settings";

export const metadata = { title: "Log in — METU" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  // .x — only render the "Continue with Google" button when
  // the API actually has Google credentials configured. Otherwise
  // clicking the button takes the user to a hard 404 (better-auth
  // throws PROVIDER_NOT_FOUND) with zero UX indication of what's wrong.
  const settings = await safeGetSettings();
  return (
    <main id="main" className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      {/* gold glow corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      {/* mint accent on the opposite side — Phase 16.3 visual refresh */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, rgba(78,201,176,0.22), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Logo size="lg" />

        <div className="mt-10 grid md:grid-cols-5 gap-8">
          <div className="md:col-span-3">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-white mb-2">
              Welcome back.
            </h1>
            <p className="text-ink-secondary mb-6 max-w-md">
              Sign in to browse the marketplace, manage your store, or check on your orders. Two-factor codes are required after the password if you've turned 2FA on in your profile.
            </p>
            <LoginForm next={searchParams.next} googleEnabled={settings.googleEnabled} />
            <p className="mt-4 text-sm text-ink-secondary">
              New to METU?{" "}
              <Link href="/register" className="font-semibold text-brand-yellow hover:underline">
                Create an account →
              </Link>
            </p>
            <p className="mt-2 text-xs text-ink-dim">
              Forgot your password?{" "}
              <Link href="/forgot-password" className="text-ink-secondary hover:text-metu-yellow underline">
                Reset it
              </Link>
              .
            </p>
          </div>

          <aside className="md:col-span-2">
            <div className="rounded-2xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/10 to-transparent p-6 shadow-pop">
              <div className="inline-block rounded-full bg-brand-yellow px-2.5 py-0.5 text-xs font-bold text-space-black mb-3">
                Sample accounts
              </div>
              <p className="text-sm text-ink-secondary mb-4">
                คลิกเพื่อ pre-fill ฟอร์ม login ของ admin / seller / buyer
              </p>
              <div className="space-y-2">
                <DemoChip label="Admin"  email="admin@metu.dev"  password="Admin#123" />
                <DemoChip label="Seller" email="seller@metu.dev" password="Seller#123" />
                <DemoChip label="Buyer"  email="buyer@metu.dev"  password="Buyer#123" />
              </div>
              <p className="mt-5 text-[11px] text-ink-dim font-mono leading-relaxed">
                Seed script populates buyer ด้วย 2 past orders, seller ด้วย 9 products,
                admin เห็น marketplace overview เต็ม
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-surface-2/60 p-5">
              <h3 className="font-display text-sm font-bold text-white mb-2">
                What's new in your account
              </h3>
              <ul className="text-xs text-ink-secondary space-y-1.5">
                <li>· One-click sign-in with Google</li>
                <li>· Authenticator-app 2FA from your profile page</li>
                <li>· Manage every active session — sign out everywhere with one click</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
