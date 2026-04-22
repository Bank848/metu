import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { EditProfileForm } from "./EditProfileForm";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/profile/edit");

  const countries = await prisma.country.findMany({
    select: { countryId: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 md:px-8 py-10">
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
      </main>
      <Footer />
    </>
  );
}
