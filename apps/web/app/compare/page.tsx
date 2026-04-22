import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { CompareView } from "./CompareView";

export const dynamic = "force-dynamic";

/**
 * Compare page is fully client-driven — productIds live in localStorage,
 * we fetch full card data via /api/products/by-ids on mount.
 */
export default function ComparePage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1280px] px-6 md:px-8 py-10">
        <PageHeader title="Compare products" subtitle="Up to 3 products side-by-side." />
        <CompareView />
      </main>
      <Footer />
    </>
  );
}
