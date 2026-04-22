"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, CornerDownRight, CheckCircle2 } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { isDataUrl } from "@/lib/utils";

type UserSlim = {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
};

type Question = {
  questionId: number;
  body: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  asker: UserSlim;
  answerer: UserSlim | null;
};

/**
 * Buyer-facing Q&A section under the product reviews.
 *  - Anyone signed in can ask (form auth-gates with a redirect to /login).
 *  - The product's seller (or admin) sees an inline "Answer" form per
 *    unanswered question.
 *  - Optimistic insert on ask + answer.
 */
export function ProductQuestions({
  productId,
  initialQuestions,
  canAnswer,
  isLoggedIn,
}: {
  productId: number;
  initialQuestions: Question[];
  canAnswer: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push(`/login?next=/product/${productId}`);
      return;
    }
    const text = ask.trim();
    if (text.length < 3) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to post question");
      } else {
        const data = await res.json();
        setQuestions((prev) => [data.question, ...prev]);
        setAsk("");
      }
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  async function answer(questionId: number, text: string) {
    if (text.trim().length < 3) return;
    try {
      const res = await fetch(`/api/questions/${questionId}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answer: text.trim() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuestions((prev) =>
        prev.map((q) =>
          q.questionId === questionId
            ? {
                ...q,
                answer: data.question.answer,
                answeredAt: data.question.answeredAt,
              }
            : q,
        ),
      );
    } catch {
      /* swallow */
    }
  }

  return (
    <section className="mt-16">
      <div className="flex items-end justify-between mb-6 border-b border-white/8 pb-3">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 text-metu-yellow" />
          Questions
          <span className="text-sm text-ink-dim font-normal">({questions.length})</span>
        </h2>
      </div>

      {/* Ask form */}
      <form onSubmit={submitQuestion} className="mb-6 rounded-2xl glass-morphism p-4">
        <textarea
          value={ask}
          onChange={(e) => setAsk(e.target.value.slice(0, 500))}
          placeholder={
            isLoggedIn
              ? "Ask the seller anything about this product…"
              : "Log in to ask a question"
          }
          rows={2}
          className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-ink-dim font-mono">{ask.length} / 500</span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <GlassButton tone="gold" size="sm" type="submit" disabled={busy || ask.trim().length < 3}>
              {busy ? "Posting…" : "Post question"}
            </GlassButton>
          </div>
        </div>
      </form>

      {questions.length === 0 ? (
        <p className="text-center text-sm text-ink-dim py-6">
          No questions yet — be the first to ask.
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.questionId} className="rounded-2xl glass-morphism p-5">
              <div className="flex items-start gap-3">
                <Avatar user={q.asker} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {q.asker.firstName} {q.asker.lastName}{" "}
                    <span className="text-ink-dim font-normal">
                      asked · {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-secondary whitespace-pre-line">{q.body}</p>
                </div>
              </div>

              {q.answer ? (
                <div className="mt-4 ml-8 rounded-xl border border-metu-yellow/20 bg-metu-yellow/5 p-4 flex items-start gap-3">
                  <CornerDownRight className="h-4 w-4 text-metu-yellow shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-metu-yellow inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Seller answered
                      {q.answerer && (
                        <span className="text-ink-dim font-normal">
                          · {q.answerer.firstName} {q.answerer.lastName}
                        </span>
                      )}
                      {q.answeredAt && (
                        <span className="text-ink-dim font-normal">
                          · {new Date(q.answeredAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white whitespace-pre-line">{q.answer}</p>
                  </div>
                </div>
              ) : (
                canAnswer && <AnswerForm onSubmit={(text) => answer(q.questionId, text)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({ user }: { user: UserSlim }) {
  return (
    <Link
      href={`/messages/${user.userId}`}
      className="relative h-9 w-9 shrink-0 rounded-full bg-metu-yellow overflow-hidden"
      title={`Message @${user.username}`}
    >
      {user.profileImage && (
        <Image
          src={user.profileImage}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
          unoptimized={isDataUrl(user.profileImage)}
        />
      )}
    </Link>
  );
}

function AnswerForm({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim().length < 3) return;
        setBusy(true);
        await onSubmit(text);
        setBusy(false);
        setText("");
      }}
      className="mt-3 ml-8 flex items-end gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        placeholder="Answer this question…"
        rows={1}
        className="flex-1 resize-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-ink-dim focus:border-metu-yellow outline-none"
      />
      <GlassButton tone="glass" size="sm" type="submit" disabled={busy || text.trim().length < 3}>
        {busy ? "…" : "Answer"}
      </GlassButton>
    </form>
  );
}
