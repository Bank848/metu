import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { getMe } from "@/lib/session";
import { getPendingVerifyEmail } from "@/lib/server/pending-verify";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const metadata = { title: "Verify your phone — METU" };

// Phase 41 → 42 — phone-only verify step. Email comes from the active
// session (when signed in) or a short-lived signed `metu_pv` cookie
// (between register and full sign-in). It never sits in the URL.

export default async function VerifyPhonePage() {
  const me = await getMe();
  let email: string | null = null;
  let phoneTail = "your phone";
  let phoneVerified = false;
  let emailVerified = false;
  if (me?.user?.email) {
    email = me.user.email as string;
    phoneVerified = Boolean(me.user.phoneVerifiedAt);
    emailVerified = Boolean(me.user.emailVerified);
    if (typeof me.user.phone === "string" && me.user.phone.length >= 4) {
      phoneTail = `••••${me.user.phone.slice(-4)}`;
    }
  } else {
    email = getPendingVerifyEmail();
  }
  if (!email) redirect("/login");
  if (phoneVerified) {
    redirect(emailVerified ? "/" : "/verify-pending");
  }

  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div className="relative mx-auto max-w-md px-6 py-20">
        <Logo size="lg" />
        <div className="mt-12 rounded-2xl border border-white/10 bg-surface-2 p-8">
          <h1 className="font-display text-2xl font-extrabold text-white mb-2">
            Verify your phone
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            We sent a 6-digit code to{" "}
            <strong className="text-white">{phoneTail}</strong>. Enter it below
            to finish setting up your account.
          </p>
          <VerifyPhoneForm email={email} />

          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-ink-dim">
              Wrong number?{" "}
              <Link href="/profile/edit" className="text-metu-yellow hover:underline">
                Update it from your profile
              </Link>{" "}
              after sign-in.
            </p>
            <p className="text-xs text-ink-dim mt-1">
              Registered the wrong account?{" "}
              <Link href="/register" className="text-metu-yellow hover:underline">
                Start over
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
