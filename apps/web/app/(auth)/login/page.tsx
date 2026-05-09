import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { LoginForm } from "./LoginForm";
import { safeGetSettings } from "@/lib/settings";

export const metadata = { title: "Log in — METU" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; email?: string };
}) {
  // Only render the "Continue with Google" button when the API
  // actually has Google credentials configured. Otherwise clicking
  // takes the user to a hard 404 (better-auth throws
  // PROVIDER_NOT_FOUND) with zero UX indication of what's wrong.
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
      {/* mint accent on the opposite side */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, rgba(78,201,176,0.22), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-md px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
        <Logo size="lg" />

        <div
          className="mt-10 sm:mt-12 text-center animate-[stagger-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Welcome back.
          </h1>
          <p className="text-sm text-ink-secondary">
            Sign in to your METU account.
          </p>
        </div>

        <div
          className="mt-7 w-full animate-[stagger-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "120ms" }}
        >
          <LoginForm
            next={searchParams.next}
            googleEnabled={settings.googleEnabled}
            emailHint={typeof searchParams.email === "string" ? searchParams.email : undefined}
          />
        </div>

        <div
          className="mt-6 w-full text-center text-sm text-ink-secondary animate-[stagger-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ animationDelay: "200ms" }}
        >
          New to METU?{" "}
          <Link href="/register" className="font-semibold text-metu-yellow hover:underline">
            Create an account →
          </Link>
        </div>
        <div className="mt-1.5 w-full text-center text-xs text-ink-dim">
          Forgot your password?{" "}
          <Link href="/forgot-password" className="text-ink-secondary hover:text-metu-yellow underline underline-offset-2">
            Reset it
          </Link>
        </div>
      </div>
    </main>
  );
}
