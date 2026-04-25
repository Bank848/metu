import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/Skeleton";

/**
 * Edit-profile suspense fallback. The parent /profile/loading.tsx renders
 * an avatar + cards layout that doesn't match this page (max-w-3xl, two
 * stacked forms + a data-export card), which made the transition feel
 * like a "skeleton flash" before the form populated (F28).
 *
 * Mirroring the real shape here means the first paint already matches the
 * final paint — the user sees structure, not a jarring layout swap.
 */
export default function EditProfileLoading() {
  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <Skeleton className="h-3.5 w-28 mb-3" />
        <div className="mb-8 space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Account details card */}
        <div className="rounded-2xl glass-morphism p-6 space-y-4 mb-8">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        </div>

        {/* Change-password card */}
        <div className="rounded-2xl glass-morphism p-6 space-y-4 mb-8">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-11 w-44 rounded-full" />
          </div>
        </div>

        {/* GDPR data-export card */}
        <div className="mt-8 rounded-2xl bg-space-850 border border-line p-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-9 w-56 rounded-full" />
        </div>
      </main>
      <Footer />
    </>
  );
}
