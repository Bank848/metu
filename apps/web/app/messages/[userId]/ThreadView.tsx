"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { isDataUrl } from "@/lib/utils";

type Msg = {
  messageId: number;
  senderId: number;
  body: string;
  createdAt: string;
};

type Other = {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
};

/**
 * Two-column conversation pane. Polls /api/messages every 8s to surface
 * new replies without a websocket. Optimistic send: the bubble appears
 * locally before the server round-trip.
 */
export function ThreadView({
  meId,
  other,
  initialMessages,
}: {
  meId: number;
  other: Other;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Lightweight 8-second poll for new inbound messages.
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?with=${other.userId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const fetched: Msg[] = data.messages.map((m: any) => ({
          messageId: m.messageId,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt,
        }));
        setMessages((prev) => (fetched.length > prev.length ? fetched : prev));
      } catch {
        /* swallow */
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [other.userId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    // Optimistic insert with a temporary negative id.
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { messageId: tempId, senderId: meId, body: text, createdAt: new Date().toISOString() },
    ]);
    setBody("");
    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId: other.userId, body: text }),
      });
      if (!res.ok) {
        // Roll back the optimistic bubble.
        setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
        setBody(text);
      } else {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === tempId
              ? {
                  messageId: data.message.messageId,
                  senderId: data.message.senderId,
                  body: data.message.body,
                  createdAt: data.message.createdAt,
                }
              : m,
          ),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
      setBody(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl glass-morphism overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-gradient-to-r from-metu-yellow/8 via-transparent to-transparent">
        <div className="relative h-10 w-10 shrink-0 rounded-full bg-metu-yellow overflow-hidden">
          {other.profileImage && (
            <Image
              src={other.profileImage}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
              unoptimized={isDataUrl(other.profileImage)}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-white truncate">
            {other.firstName} {other.lastName}
          </div>
          <div className="text-xs text-ink-dim">@{other.username}</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-surface-2/30">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-dim mt-8">
            No messages yet — say hi!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <div key={m.messageId} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[78%] rounded-2xl rounded-br-sm bg-metu-yellow/15 border border-metu-yellow/30 px-4 py-2 text-sm text-white"
                      : "max-w-[78%] rounded-2xl rounded-bl-sm bg-white/5 border border-white/10 px-4 py-2 text-sm text-ink-secondary"
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-[10px] text-ink-dim text-right font-mono">
                    {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex items-end gap-2 px-4 py-3 border-t border-white/8 bg-surface-2/50">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Write a message…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none max-h-32"
        />
        <GlassButton tone="gold" size="md" type="submit" disabled={busy || !body.trim()}>
          <Send className="h-4 w-4" />
          Send
        </GlassButton>
      </form>
    </section>
  );
}
