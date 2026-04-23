import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password — METU" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";

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
        <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight text-white mb-2">
          Set a new password
        </h1>
        <p className="text-ink-secondary mb-6">
          {token
            ? "Pick something memorable — at least 6 characters."
            : "This link is missing its token. Request a new one."}
        </p>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Link
            href="/forgot-password"
            className="inline-block rounded-xl bg-brand-yellow text-space-black font-semibold px-5 py-2.5"
          >
            Request a new link →
          </Link>
        )}
      </div>
    </main>
  );
}
