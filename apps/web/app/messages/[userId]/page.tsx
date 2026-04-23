import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { getMe } from "@/lib/session";
import { prisma } from "@/lib/server/prisma";
import { ThreadView } from "./ThreadView";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { userId: string } }) {
  const me = await getMe();
  if (!me) redirect(`/login?next=/messages/${params.userId}`);
  const otherId = Number(params.userId);
  if (!Number.isFinite(otherId) || otherId === me.user.userId) return notFound();

  const other = await prisma.user.findUnique({
    where: { userId: otherId },
    select: { userId: true, username: true, firstName: true, lastName: true, profileImage: true },
  });
  if (!other) return notFound();

  // Pull the existing thread and mark inbound messages as read in one go.
  const [messages] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: me.user.userId, recipientId: otherId },
          { senderId: otherId, recipientId: me.user.userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.message.updateMany({
      where: { senderId: otherId, recipientId: me.user.userId, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);

  return (
    <>
      <TopNav />
      <main id="main" className="mx-auto max-w-3xl px-6 md:px-8 py-10">
        <Link
          href="/seller/messages"
          className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-metu-yellow mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to inbox
        </Link>
        <ThreadView
          meId={me.user.userId}
          other={other}
          initialMessages={messages.map((m) => ({
            messageId: m.messageId,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </main>
      <Footer />
    </>
  );
}
