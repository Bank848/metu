import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { getCountries } from "@/lib/server/queries";
import { EditProfileForm } from "./EditProfileForm";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  // Run the auth check and the cached country list in parallel — countries
  // are reference data that never change within a session, so the cached
  // helper short-circuits the second DB hit on warm requests and removes
  // the blocking serial wait that produced the F28 skeleton flash.
  const [me, countries] = await Promise.all([getMe(), getCountries()]);
  if (!me) redirect("/login?next=/profile/edit");

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
            profile, orders, reviews, favourites, messages, and more.
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
