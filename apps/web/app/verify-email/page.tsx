import Link from "next/link";
import { CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email — METU" };

// Phase 41 - landing for the email-verify magic link. POSTs token to
// the API on the server side so JS isn't required to confirm.

interface SearchParams {
  token?: string;
}

async function verifyToken(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!token) return { ok: false, reason: "Missing token in URL." };
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, reason: data?.message ?? "Verify link is invalid or expired." };
  } catch {
    return { ok: false, reason: "Network error." };
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = searchParams.token ?? "";
  const result = await verifyToken(token);

  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div className="relative mx-auto max-w-md px-6 py-20">
        <Logo size="lg" />
        <div className="mt-12 rounded-2xl border border-white/10 bg-surface-2 p-8">
          {result.ok ? (
            <>
              <div className="h-14 w-14 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center mb-5">
                <CheckCircle2 className="h-7 w-7 text-mint" />
              </div>
              <h1 className="font-display text-2xl font-extrabold text-white mb-2">
                Email confirmed
              </h1>
              <p className="text-sm text-ink-secondary mb-6">
                One down, one to go. Verify your phone next to finish unlocking sign-in.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-metu-yellow px-5 py-2.5 text-sm font-bold text-surface-1 hover:bg-metu-yellow/90 transition"
              >
                <Mail className="h-4 w-4" />
                Sign in
              </Link>
            </>
          ) : (
            <>
              <div className="h-14 w-14 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mb-5">
                <AlertCircle className="h-7 w-7 text-amber-400" />
              </div>
              <h1 className="font-display text-2xl font-extrabold text-white mb-2">
                Couldn&apos;t verify
              </h1>
              <p className="text-sm text-ink-secondary mb-6">{result.reason}</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
