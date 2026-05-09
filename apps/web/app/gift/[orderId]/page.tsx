import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { GiftClaim } from "./GiftClaim";

export const metadata = { title: "Claim your gift — METU" };
export const dynamic = "force-dynamic";

export default async function GiftPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { t?: string };
}) {
  const orderId = Number(params.orderId);
  const token = searchParams.t ?? "";
  return (
    <>
      <TopNav />
      <main id="main" className="relative mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
        <GiftClaim orderId={Number.isFinite(orderId) ? orderId : -1} token={token} />
      </main>
      <Footer />
    </>
  );
}
