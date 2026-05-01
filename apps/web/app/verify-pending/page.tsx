import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { getMe } from "@/lib/session";
import { getPendingVerifyEmail } from "@/lib/server/pending-verify";
import { ResendVerifyButton } from "./ResendVerifyButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const metadata = { title: "Check your inbox — METU" };

// Phase 41 → 42 — bounce target when the user still has an unverified
// email. Reads the address from (a) an active session if the user is
// signed in, otherwise (b) a short-lived signed `metu_pv` cookie set
// by the BFF on register / verify-blocked login. The address never
// appears in the URL or referrer.

export default async function VerifyPendingPage() {
  const me = await getMe();
  let email: string | null = null;
  let emailVerified = false;
  let phoneVerified = false;
  if (me?.user?.email) {
    email = me.user.email as string;
    emailVerified = Boolean(me.user.emailVerified);
    phoneVerified = Boolean(me.user.phoneVerifiedAt);
  } else {
    email = getPendingVerifyEmail();
  }
  if (!email) redirect("/login");
  if (emailVerified) {
    redirect(phoneVerified ? "/" : "/verify-phone");
  }

  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div className="relative mx-auto max-w-md px-6 py-20">
        <Logo size="lg" />
        <div className="mt-12 rounded-2xl border border-white/10 bg-surface-2 p-8">
          <h1 className="font-display text-2xl font-extrabold text-white mb-2">
            Check your email
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            We sent a verification link to{" "}
            <strong className="text-white">{email}</strong>. Click it to unlock
            sign-in. If it isn&apos;t there in a minute or two, check the spam
            folder.
          </p>
          <ResendVerifyButton email={email} />
          <div className="mt-6 pt-5 border-t border-white/10">
            <Link href="/login" className="text-xs text-metu-yellow hover:underline">
              ← Back to sign-in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
