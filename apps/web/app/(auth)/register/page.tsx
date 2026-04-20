import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Sign up — METU" };

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.35), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-2xl px-6 py-12">
        <Logo size="lg" />
        <h1 className="mt-10 font-display text-4xl font-extrabold tracking-tight text-white mb-2">
          Create your METU account.
        </h1>
        <p className="text-ink-secondary mb-6">
          It takes less than a minute. You can start selling later from your profile.
        </p>
        <RegisterForm />
        <p className="mt-4 text-sm text-ink-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-yellow hover:underline">
            Log in →
          </Link>
        </p>
      </div>
    </main>
  );
}
