import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { getServerT } from "@/lib/i18n/server";
import { isDataUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Buyer-facing inbox at `/messages`. Mirrors `/seller/messages` but
 * lives outside the seller chrome — wraps in TopNav + Footer instead of
 * the sidebar shell so a buyer who has never visited /seller can still
 * find their threads. Same Prisma grouping as `GET /api/messages` so
 * the empty state, ordering, and unread counts match.
 */
export default async function BuyerMessagesPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/messages");
  const t = getServerT();

  const recent = await prisma.message.findMany({
    where: { OR: [{ senderId: me.user.userId }, { recipientId: me.user.userId }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender:    { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
      recipient: { select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true } },
    },
  });

  type Thread = {
    partner: { userId: number; username: string; firstName: string; lastName: string; profileImage: string | null };
    lastMessage: string;
    lastAt: Date;
    unread: number;
  };
  const partnerMap = new Map<number, Thread>();
  for (const m of recent) {
    const partner = m.senderId === me.user.userId ? m.recipient : m.sender;
    const existing = partnerMap.get(partner.userId);
    if (!existing) {
      partnerMap.set(partner.userId, {
        partner,
        lastMessage: m.body,
        lastAt: m.createdAt,
        unread: m.recipientId === me.user.userId && !m.readAt ? 1 : 0,
      });
    } else if (m.recipientId === me.user.userId && !m.readAt) {
      existing.unread += 1;
    }
  }
  const threads = [...partnerMap.values()].sort(
    (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
  );

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <PageHeader
          title="Messages"
          subtitle={`${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
        />

        {threads.length === 0 ? (
          <EmptyState
            title={t("messages.empty.title")}
            description={t("messages.empty.description")}
            icon={<Mail className="h-8 w-8" />}
            action={<GlassButton tone="gold" href="/browse">Browse marketplace →</GlassButton>}
          />
        ) : (
          <ul className="space-y-2">
            {threads.map((thread) => {
              const hasUnread = thread.unread > 0;
              return (
                <li key={thread.partner.userId}>
                  <Link
                    href={`/messages/${thread.partner.userId}`}
                    className={
                      hasUnread
                        ? "flex items-center gap-4 rounded-2xl surface-flat p-4 lift-on-hover border-l-4 border-l-mint hover:border-metu-yellow/40 transition"
                        : "flex items-center gap-4 rounded-2xl surface-flat p-4 lift-on-hover hover:border-metu-yellow/40 transition"
                    }
                  >
                    <div className="relative h-12 w-12 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                      {thread.partner.profileImage && (
                        <Image
                          src={thread.partner.profileImage}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized={isDataUrl(thread.partner.profileImage)}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display font-bold text-white truncate">
                          {thread.partner.firstName} {thread.partner.lastName}
                          <span className="ml-2 text-xs font-normal text-ink-dim">@{thread.partner.username}</span>
                        </div>
                        <div className="text-[10px] font-mono text-ink-dim shrink-0">
                          {new Date(thread.lastAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div
                        className={
                          hasUnread
                            ? "text-sm text-white truncate mt-0.5 font-medium"
                            : "text-sm text-ink-secondary truncate mt-0.5"
                        }
                      >
                        {thread.lastMessage}
                      </div>
                    </div>
                    {hasUnread && (
                      <span
                        className="inline-flex shrink-0 items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-mint text-mint-deep text-[10px] font-bold"
                        aria-label={`${thread.unread} unread`}
                      >
                        {thread.unread > 99 ? "99+" : thread.unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
