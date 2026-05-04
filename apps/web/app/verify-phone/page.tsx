import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { getMe } from "@/lib/session";
import { getPendingVerify } from "@/lib/server/pending-verify";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const metadata = { title: "Verify your phone — METU" };

// → 42 — phone-only verify step. Email comes from the active
// session (when signed in) or a short-lived signed `metu_pv` cookie
// (between register and full sign-in). It never sits in the URL.

export default async function VerifyPhonePage() {
  const me = await getMe();
  let email: string | null = null;
  let phoneTail = "your phone";
  let phoneVerified = false;
  let emailVerified = false;
  let loggedIn = false;
  let demoOtp: string | undefined;
  let hasPhone = false;
  if (me?.user?.email) {
    email = me.user.email as string;
    phoneVerified = Boolean(me.user.phoneVerifiedAt);
    emailVerified = Boolean(me.user.emailVerified);
    loggedIn = true;
    if (typeof me.user.phone === "string" && me.user.phone.length >= 4) {
      phoneTail = `••••${me.user.phone.slice(-4)}`;
      hasPhone = true;
    }
    demoOtp = getPendingVerify()?.otp;
  } else {
    const pending = getPendingVerify();
    email = pending?.email ?? null;
    demoOtp = pending?.otp;
    // For pre-session register flows we always know the phone exists
    // (register schema requires it).
    hasPhone = true;
  }
  if (!email) redirect("/login");
  if (phoneVerified) {
    redirect(emailVerified ? "/" : "/verify-pending");
  }
  // Google new-user has no phone yet; bounce them back to
  // /profile/edit with a clear note instead of pretending we sent an
  // OTP to "your phone".
  if (loggedIn && !hasPhone) {
    redirect("/profile/edit?need=phone");
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
          {demoOtp && (
            <div className="mb-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="font-bold uppercase tracking-wider text-amber-200 mb-1.5">
                Demo mode · SMS not actually sent
              </div>
              <p className="mb-2 text-amber-100/80">
                Real SMS isn&apos;t wired up for the defense, so we surface
                the code here instead. In production this comes through
                Twilio / similar.
              </p>
              <div className="font-mono text-2xl font-extrabold tracking-[0.4em] text-amber-100 select-all">
                {demoOtp}
              </div>
            </div>
          )}
          <VerifyPhoneForm email={email} />

          {loggedIn ? (
            <div className="mt-6 pt-5 border-t border-white/10">
              <Link href="/profile/edit" className="text-xs text-metu-yellow hover:underline">
                ← Back to profile (you can change your phone there)
              </Link>
            </div>
          ) : (
            <div className="mt-6 pt-5 border-t border-white/10 text-xs text-ink-dim">
              <p>
                You can&apos;t skip this step — we need a working phone before
                sign-in unlocks. Registered the wrong account?{" "}
                <Link href="/register" className="text-metu-yellow hover:underline">
                  Start over
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
