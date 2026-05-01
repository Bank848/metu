import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password — METU" };
export const dynamic = "force-dynamic";

// Server-side check so an expired link shows the right state on load
// instead of letting the user fill in the form first.
async function tokenIsValid(token: string): Promise<boolean> {
  if (!token) return false;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(
      `${base}/api/auth/reset-password/check?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Boolean(data?.valid);
  } catch {
    return false;
  }
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  const valid = token ? await tokenIsValid(token) : false;

  return (
    <main id="main" className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-md px-6 py-12">
        <Logo size="lg" />

        {valid ? (
          <>
            <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight text-white mb-2">
              Set a new password
            </h1>
            <p className="text-ink-secondary mb-6">
              Pick something memorable — at least 6 characters.
            </p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <>
            <div className="mt-10 mb-5 inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-400/15 border border-amber-400/30">
              <AlertCircle className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white mb-2">
              Link expired or invalid
            </h1>
            <p className="text-ink-secondary mb-6">
              {token
                ? "Reset links are only valid for 5 minutes. Request a new one and try again."
                : "This page needs a token in the URL. Request a fresh reset link."}
            </p>
            <Link
              href="/forgot-password"
              className="inline-block rounded-xl bg-brand-yellow text-space-black font-semibold px-5 py-2.5 hover:bg-brand-yellow/90 transition"
            >
              Request a new link →
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
