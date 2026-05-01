import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StarField } from "@/components/DotGrid";
import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify phone — METU" };

// Phase 41 - post-register verify page. The user reads the OTP from
// the SMS we'd "send" (printed to server logs in this build) and types
// it here. We also tell them to check their email for the verify link.

export default function VerifyPhonePage({
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
            Two quick checks
          </h1>
          <p className="text-sm text-ink-secondary mb-5">
            ส่ง verify link ไปที่ <strong className="text-white">{email || "your email"}</strong> แล้ว ;
            ส่ง OTP 6 หลักไปที่เบอร์โทรของคุณด้วย. ใส่ OTP ด้านล่างและคลิกลิงก์ใน email เพื่อ unlock login.
          </p>
          <VerifyPhoneForm email={email} />

          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-ink-dim">
              เปลี่ยนเบอร์? <Link href="/profile/edit" className="text-metu-yellow hover:underline">แก้ไขใน profile</Link> หลัง login
            </p>
            <p className="text-xs text-ink-dim mt-1">
              ลงทะเบียนผิดบัญชี? <Link href="/register" className="text-metu-yellow hover:underline">เริ่มใหม่</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
