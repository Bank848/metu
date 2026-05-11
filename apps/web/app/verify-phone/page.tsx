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

// Phone-only verify step. Email comes from the active session, or a
// signed `metu_pv` cookie between register and sign-in — never the URL.

function safeNextRedirect(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\r\n]/.test(next)) return null;
  return next;
}

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const me = await getMe();
  const nextSafe = safeNextRedirect(searchParams.next);
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
    // Already verified — honour ?next= when supplied (e.g. gift claim
    // bouncing back through /verify-phone after register).
    redirect(nextSafe ?? (emailVerified ? "/" : "/verify-pending"));
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
          {/* Demo banner only shows when Firebase isn't wired — once the
              client config is present (NEXT_PUBLIC_FIREBASE_API_KEY at
              build time) we route through real SMS and the demo OTP is
              irrelevant. */}
          {demoOtp && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY && (
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
          <VerifyPhoneForm
            email={email}
            defaultPhone={typeof me?.user?.phone === "string" ? me.user.phone : undefined}
            next={nextSafe ?? undefined}
          />

          {/* Skip-to-email escape. Phone verification is optional —
              email is the only mandatory channel — so we always
              offer a "use email instead" path. Email-verified users
              get back into the app on the next sign-in. */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
            <Link
              href={emailVerified ? "/" : "/verify-pending"}
              className="block w-full text-center rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-ink-secondary hover:bg-white/[0.06] transition"
            >
              {emailVerified
                ? "Skip phone verification — go to the marketplace →"
                : "Skip phone — verify by email instead →"}
            </Link>
            {!loggedIn && (
              <p className="text-[11px] text-ink-dim text-center">
                Wrong account?{" "}
                <Link href="/register" className="text-metu-yellow hover:underline">
                  Start over
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
