import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { getMe } from "@/lib/session";
import { apiFetch } from "@/lib/server/api";
import { SessionsList } from "./SessionsList";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: number;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SessionsResponse {
  sessions: SessionRow[];
  currentSessionId: number | null;
}

/**
 * Phase 23.1 — `/profile/sessions`. Surface the better-auth Session
 * table to the user so they can:
 *   • see every device that's logged in
 *   • revoke one stale session
 *   • "Sign out everywhere else" in one shot
 *
 * Backend has been live since Phase 15.2 — this is the missing UI.
 */
export default async function SessionsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/profile/sessions");

  const data = await apiFetch<SessionsResponse>("/auth/sessions");

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <Link
          href="/profile/edit"
          className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>
        <PageHeader
          title="Active sessions"
          subtitle="Each row is a device that's currently signed in. Revoke any session you don't recognise."
        />

        {/* Quick context block — explains what "current session" means
            and reassures the user that revoking a session forces a
            re-login on that device. */}
        <div className="mb-6 rounded-xl border border-mint/30 bg-mint/5 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-mint mt-0.5 shrink-0" />
          <div className="text-sm text-mint">
            <div className="font-semibold mb-0.5">Security tip</div>
            <div className="text-mint/80">
              If you see a session you didn't start, revoke it now and{" "}
              <Link href="/profile/edit" className="underline">change your password</Link>.
              The "current" session is this browser tab — revoking it would sign you out.
            </div>
          </div>
        </div>

        <SessionsList
          initialSessions={data.sessions}
          currentSessionId={data.currentSessionId}
        />
      </main>
      <Footer />
    </>
  );
}
