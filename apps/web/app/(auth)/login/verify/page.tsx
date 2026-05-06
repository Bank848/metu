import { Suspense } from "react";
import { LoginVerifyForm } from "./LoginVerifyForm";

export const metadata = { title: "Verify it's you · METU" };
export const dynamic = "force-dynamic";

// Stage-2 of the universal login verify. Reachable only after
// /auth/login returns 401 NeedsVerify with a pre-auth token; LoginForm
// pushes the user here with the token + channels list in the URL.
//
// The page itself is a thin wrapper because the form is client-rendered
// (URL params + state for OTP code + channel switch). Suspense boundary
// keeps the build happy while useSearchParams runs.

export default function LoginVerifyPage() {
  return (
    <main className="min-h-screen bg-space-black text-white px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-ink-dim text-sm">Loading…</p>}>
          <LoginVerifyForm />
        </Suspense>
      </div>
    </main>
  );
}
