import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { getMe } from "@/lib/session";
import { getPendingVerify } from "@/lib/server/pending-verify";
import { ResendVerifyButton } from "./ResendVerifyButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const metadata = { title: "Check your inbox — METU" };

// Bounce target when the user still has an unverified email. Reads the
// address from the session, or a signed `metu_pv` cookie during register.

export default async function VerifyPendingPage() {
  const me = await getMe();
  let email: string | null = null;
  let emailVerified = false;
  let demoEmailToken: string | undefined;
  // `loggedIn` lets the page show "Back to profile" instead of "Back to
  // sign-in", and it disables the start-over escape during a fresh
  // register flow (where only the metu_pv cookie exists, no session).
  let loggedIn = false;
  if (me?.user?.email) {
    email = me.user.email as string;
    emailVerified = Boolean(me.user.emailVerified);
    loggedIn = true;
    // Even logged-in users may have a freshly-set metu_pv cookie when
    // they hit /resend-email-verify — surface it.
    demoEmailToken = getPendingVerify()?.emailToken;
  } else {
    const pending = getPendingVerify();
    email = pending?.email ?? null;
    demoEmailToken = pending?.emailToken;
  }
  if (!email) redirect("/login");
  if (emailVerified) {
    // Phone verification is optional now (email is the floor), so
    // bounce home as soon as the email link is clicked — no more
    // forced detour through /verify-phone.
    redirect("/");
  }
  const demoLink = demoEmailToken
    ? `/verify-email?token=${encodeURIComponent(demoEmailToken)}`
    : null;

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
          {demoLink && (
            <div className="mb-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="font-bold uppercase tracking-wider text-amber-200 mb-1.5">
                Demo mode · email not actually delivered
              </div>
              <p className="mb-2 text-amber-100/80">
                The Resend sandbox sender only delivers to the project
                owner&apos;s mailbox, so during the live walk-through we
                surface the verify link here. Click to confirm:
              </p>
              <Link
                href={demoLink}
                className="inline-flex items-center gap-1 rounded-md bg-amber-400 text-space-950 px-3 py-1.5 text-xs font-bold hover:bg-amber-300"
              >
                Click to verify email →
              </Link>
            </div>
          )}
          <ResendVerifyButton email={email} />
          {loggedIn ? (
            <div className="mt-6 pt-5 border-t border-white/10">
              <Link href="/profile/edit" className="text-xs text-metu-yellow hover:underline">
                ← Back to profile
              </Link>
            </div>
          ) : (
            <div className="mt-6 pt-5 border-t border-white/10 text-xs text-ink-dim">
              <p>
                You can&apos;t skip this step — we need a working email before
                sign-in unlocks. Wrong account?{" "}
                <Link href="/register" className="text-metu-yellow hover:underline">
                  Register again
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
