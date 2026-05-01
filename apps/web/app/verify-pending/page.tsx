import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { ResendVerifyButton } from "./ResendVerifyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check your inbox — METU" };

// Phase 41 - bounce target when login is blocked because email isn't
// confirmed yet. Tells the user to click the link we already sent
// and offers a one-click resend.

export default function VerifyPendingPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "";
  return (
    <main className="relative min-h-screen bg-space-black overflow-hidden">
      <StarField />
      <div className="relative mx-auto max-w-md px-6 py-20">
        <Logo size="lg" />
        <div className="mt-12 rounded-2xl border border-white/10 bg-surface-2 p-8">
          <h1 className="font-display text-2xl font-extrabold text-white mb-2">
            Confirm your email
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            ส่ง verify link ไปที่ <strong className="text-white">{email || "your email"}</strong> แล้ว.
            คลิกลิงก์ใน email เพื่อ unlock การ login. ถ้าไม่เห็นใน inbox ลองดูใน spam folder.
          </p>
          <ResendVerifyButton email={email} />
          <div className="mt-6 pt-5 border-t border-white/10">
            <Link href="/login" className="text-xs text-metu-yellow hover:underline">
              ← กลับไปหน้า login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
