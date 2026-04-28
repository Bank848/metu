import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, ShieldAlert } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getCountries } from "@/lib/server/queries";
import { EditProfileForm } from "./EditProfileForm";

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
      </main>
      <Footer />
    </>
  );
}
