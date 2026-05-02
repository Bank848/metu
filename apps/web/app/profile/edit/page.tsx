import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, ShieldAlert, Monitor, MailWarning, PhoneCall, KeyRound } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getCountries } from "@/lib/server/queries";
import { EditProfileForm } from "./EditProfileForm";
import { ConnectedAccounts } from "./ConnectedAccounts";
import { DeleteAccountSection } from "./DeleteAccountSection";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams?: { "must-reset"?: string };
}) {
  const mustReset = searchParams?.["must-reset"] === "1";
  // Run the auth check and the cached country list in parallel — countries
  // are reference data that never change within a session, so the cached
  // helper short-circuits the second DB hit on warm requests and removes
  // the blocking serial wait that produced the F28 skeleton flash.
  const [me, countries] = await Promise.all([getMe(), getCountries()]);
  if (!me) redirect("/login?next=/profile/edit");

  // Phase 15.5 — show the must-reset banner whenever the user is
  // here because an admin forced a reset, OR they got bounced here
  // by requireResetGuard from another page (?must-reset=1). Both
  // cases hit me.requirePasswordReset=true; the URL param just
  // affirms the reason if the link came from the redirect.
  const showResetBanner = me.requirePasswordReset || mustReset;
  // Phase 42 — surface the unverified state at the very top of the
  // profile so the user can't keep using the site without finishing
  // verify. The login gate already blocks sensitive actions, but a
  // logged-in OAuth user (Google) skips the password gate, so we need
  // a visible nudge.
  const emailUnverified = !me.user.emailVerified;
  const phoneUnverified = !me.user.phoneVerifiedAt;
  // Phase 45 follow-up — Google sign-up creates an account with no
  // local password (only the OAuth account row). We expose the
  // "Set a password" form further down the page, but users who
  // signed up with Google routinely missed it. A prominent banner
  // up top with an in-page anchor link makes the option discoverable
  // — they keep using Google sign-in by default but now see the
  // pathway to add an email+password fallback.
  const passwordMissing = !me.hasPassword;

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>
        <PageHeader title="Edit profile" subtitle="Update your name, contact, and password." />

        {emailUnverified && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 p-4 flex items-start gap-3">
            <MailWarning className="h-5 w-5 text-red-300 mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-red-100 mb-0.5">
                Email not verified
              </div>
              <div className="text-red-100/80">
                Confirm your email address so you can sign in normally and
                receive purchase receipts. We sent a link to{" "}
                <strong className="text-white">{me.user.email}</strong>.
              </div>
            </div>
            <Link
              href="/verify-pending"
              className="self-center rounded-lg bg-red-400 text-space-950 px-4 py-2 text-sm font-semibold hover:bg-red-300 whitespace-nowrap"
            >
              Resend link →
            </Link>
          </div>
        )}
        {phoneUnverified && (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 flex items-start gap-3">
            <PhoneCall className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-amber-100 mb-0.5">
                Phone not verified
              </div>
              <div className="text-amber-100/80">
                Confirm your phone with a one-time SMS code so we can reach you
                about your purchases. Buying and selling are paused until both
                checks are complete.
              </div>
            </div>
            <Link
              href="/verify-phone"
              className="self-center rounded-lg bg-amber-400 text-space-950 px-4 py-2 text-sm font-semibold hover:bg-amber-300 whitespace-nowrap"
            >
              Verify now →
            </Link>
          </div>
        )}
        {passwordMissing && (
          <div className="mb-4 rounded-xl border border-metu-yellow/40 bg-metu-yellow/10 p-4 flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-metu-yellow mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-metu-yellow mb-0.5">
                Add a password (recommended)
              </div>
              <div className="text-metu-yellow/80">
                You signed up with Google. Set a password so you can also sign in
                with email + password — useful as a backup if your Google account
                is ever unavailable. Both sign-in methods will work side by side.
              </div>
            </div>
            <a
              href="#set-password"
              className="self-center rounded-lg bg-metu-yellow text-space-950 px-4 py-2 text-sm font-semibold hover:bg-amber-300 whitespace-nowrap"
            >
              Set a password →
            </a>
          </div>
        )}

        {showResetBanner && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-amber-100 mb-0.5">
                Password reset required
              </div>
              <div className="text-amber-100/80">
                An administrator has flagged your account for a password reset
                (suspicious sign-in attempt or routine security check). Set a
                new password below to continue using the marketplace.
              </div>
            </div>
          </div>
        )}
        <EditProfileForm
          countries={countries}
          initial={{
            firstName: me.user.firstName,
            lastName: me.user.lastName,
            email: me.user.email,
            profileImage: me.user.profileImage ?? "",
            countryId: me.user.countryId ?? null,
            gender: (me.user.gender as "male" | "female" | "other" | null) ?? null,
            dateOfBirth: me.user.dateOfBirth
              ? new Date(me.user.dateOfBirth).toISOString().slice(0, 10)
              : "",
            hasPassword: me.hasPassword,
            // Phase 14.4 — phone + verification status drive the OTP UI.
            phone: me.user.phone ?? null,
            phoneVerified: Boolean(me.user.phoneVerifiedAt),
            // Phase 16.2 — drives the TOTP section (Disable vs Enrol).
            totpEnabled: me.totpEnabled,
          }}
        />

        {/* Phase 18 — Connected social accounts (Link / Unlink Google).
            Separate card mirroring the data-export pattern below. The
            component fetches from /api/auth/connected-accounts on mount. */}
        <ConnectedAccounts hasPassword={me.hasPassword} />

        {/* Phase 23.1 — Active sessions link. The full list lives on
            its own page so the table can fan out to many rows without
            cluttering the edit form. */}
        <section className="mt-8 rounded-2xl bg-space-850 border border-line p-6">
          <h2 className="font-display text-base font-bold text-white mb-1">
            Active sessions
          </h2>
          <p className="text-sm text-ink-dim mb-4">
            See every device that's currently signed in. Revoke any session you don't recognise.
          </p>
          <Link
            href="/profile/sessions"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-space-900 px-4 py-2 text-sm font-semibold text-white hover:border-brand-yellow/50 hover:text-brand-yellow transition"
          >
            <Monitor className="h-4 w-4" />
            Manage sessions →
          </Link>
        </section>

        {/* GDPR-style data export — separate card so it's visually distinct
            from profile edit fields. The endpoint forces a JSON download. */}
        <section className="mt-8 rounded-2xl bg-space-850 border border-line p-6">
          <h2 className="font-display text-base font-bold text-white mb-1">
            Your data
          </h2>
          <p className="text-sm text-ink-dim mb-4">
            Download a JSON copy of everything METU has stored about you —
            profile, orders, reviews, favorites, messages, and more.
            Right to data portability, no questions asked.
          </p>
          <a
            href="/api/profile/export"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-space-900 px-4 py-2 text-sm font-semibold text-white hover:border-brand-yellow/50 hover:text-brand-yellow transition"
          >
            <Download className="h-4 w-4" />
            Download your data (JSON)
          </a>
        </section>

        {/* Phase 48 — GDPR right-to-erasure. Self-delete blocks until
            the user types their username for confirmation; the API
            then routes through the hybrid path (fresh = hard delete,
            history = anonymise). */}
        <DeleteAccountSection username={me.user.username} />
      </main>
      <Footer />
    </>
  );
}
