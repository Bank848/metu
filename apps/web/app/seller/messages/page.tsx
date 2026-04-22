import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GlassButton } from "@/components/visual/GlassButton";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { isDataUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SellerMessagesPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/seller/messages");
  if (!me.user?.store && me.role !== "admin") redirect("/become-seller");

  // Pull recent messages and group by partner — matches the API logic
  // but inlined here so we don't pay an HTTP round-trip from the server
  // component.
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
      <PageHeader
        title="Messages"
        subtitle={`${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
      />

      {threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="When a buyer reaches out about your products you'll see their thread here."
          icon={<Mail className="h-8 w-8" />}
          action={<GlassButton tone="gold" href="/seller">Back to dashboard →</GlassButton>}
        />
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.partner.userId}>
              <Link
                href={`/messages/${t.partner.userId}`}
                className="flex items-center gap-4 rounded-2xl glass-morphism p-4 hover:border-metu-yellow/50 transition"
              >
                <div className="relative h-12 w-12 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
                  {t.partner.profileImage && (
                    <Image
                      src={t.partner.profileImage}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized={isDataUrl(t.partner.profileImage)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold text-white truncate">
                      {t.partner.firstName} {t.partner.lastName}
                      <span className="ml-2 text-xs font-normal text-ink-dim">@{t.partner.username}</span>
                    </div>
                    <div className="text-[10px] font-mono text-ink-dim shrink-0">
                      {new Date(t.lastAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-sm text-ink-secondary truncate mt-0.5">
                    {t.lastMessage}
                  </div>
                </div>
                {t.unread > 0 && (
                  <span className="inline-flex shrink-0 items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-metu-yellow text-surface-1 text-[10px] font-bold">
                    {t.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
