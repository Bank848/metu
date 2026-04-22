import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot password — METU" };

export default function ForgotPasswordPage() {
  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-md px-6 py-12">
        <Logo size="lg" />
        <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight text-white mb-2">
          Forgot password?
        </h1>
        <p className="text-ink-secondary mb-6">
          Enter the email on your account — we'll send a link to set a new password.
        </p>
        <ForgotPasswordForm />
        <p className="mt-4 text-sm text-ink-secondary">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-brand-yellow hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
