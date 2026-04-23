"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, CornerDownRight, CheckCircle2, Pencil, Trash2, Shield } from "lucide-react";
import { GlassButton } from "@/components/visual/GlassButton";
import { isDataUrl } from "@/lib/utils";

type UserSlim = {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
};

// The answerer carries one extra field — UserStats.role — so the UI
// can render "Admin answered" vs "Seller answered" instead of always
// hard-coding "Seller answered" (the original Phase 9 bug).
type AnswererSlim = UserSlim & {
  stats?: { role: "admin" | "seller" | "buyer" } | null;
};

type Question = {
  questionId: number;
  // askerId is needed so the asker can edit their own question body
  // and so admin moderation can distinguish self-edits from admin
  // overrides for the audit-log gate.
  askerId: number;
  body: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  asker: UserSlim;
  answerer: AnswererSlim | null;
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
  isAdmin = false,
  currentUserId,
}: {
  productId: number;
  initialQuestions: Question[];
  canAnswer: boolean;
  isLoggedIn: boolean;
  // Moderation gates — admin can edit/delete any question or answer;
  // the asker can edit their own question body and delete the whole
  // question. Sellers continue to use the existing answer form.
  isAdmin?: boolean;
  currentUserId?: number;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // editingId carries which question is currently in inline-edit mode
  // and which field — body (asker / admin) or answer (admin only).
  const [editingId, setEditingId] = useState<{ id: number; field: "body" | "answer" } | null>(null);

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

  /** Delete a whole question — admin OR original asker. Confirms first
   *  because the question + any attached answer disappear together. */
  async function deleteQuestion(questionId: number) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
    }
  }

  /** Save inline edits to a question body (asker / admin) OR the answer
   *  text (admin only). The single PATCH endpoint figures out the
   *  right permission gate. */
  async function saveEdit(questionId: number, field: "body" | "answer", text: string) {
    const payload = field === "body" ? { body: text } : { answer: text };
    const res = await fetch(`/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const data = await res.json();
    setQuestions((prev) =>
      prev.map((q) =>
        q.questionId === questionId
          ? { ...q, body: data.question.body ?? q.body, answer: data.question.answer ?? q.answer }
          : q,
      ),
    );
    setEditingId(null);
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

      {/* Ask form — Wave-3: surface-flat replaces glass */}
      <form onSubmit={submitQuestion} className="mb-6 rounded-2xl surface-flat p-4 shadow-flat">
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
          {questions.map((q) => {
            const isAsker = currentUserId !== undefined && q.askerId === currentUserId;
            const canModerateQuestion = isAdmin || isAsker;
            const editingBody = editingId?.id === q.questionId && editingId.field === "body";
            const editingAnswer = editingId?.id === q.questionId && editingId.field === "answer";
            return (
              <li key={q.questionId} className="rounded-2xl surface-flat p-5 shadow-flat">
                <div className="flex items-start gap-3">
                  <Avatar user={q.asker} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                      <span>
                        {q.asker.firstName} {q.asker.lastName}{" "}
                        <span className="text-ink-dim font-normal">
                          asked · {new Date(q.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      {/* Moderation cluster on the question — visible to
                          admin (with the coral "mod" pip) or to the
                          original asker. */}
                      {canModerateQuestion && !editingBody && (
                        <span className="inline-flex items-center gap-1 ml-auto">
                          {isAdmin && !isAsker && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-coral/10 border border-coral/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coral"
                              title="Admin moderation — actions are audit-logged"
                            >
                              <Shield className="h-3 w-3" /> mod
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingId({ id: q.questionId, field: "body" })}
                            aria-label="Edit question"
                            title="Edit question"
                            className="p-1 rounded-md text-ink-dim hover:text-metu-yellow hover:bg-white/5 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(q.questionId)}
                            aria-label="Delete question"
                            title="Delete question"
                            className="p-1 rounded-md text-ink-dim hover:text-coral hover:bg-coral/5 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    {editingBody ? (
                      <InlineQuestionEdit
                        initial={q.body}
                        maxLen={500}
                        onCancel={() => setEditingId(null)}
                        onSave={(text) => saveEdit(q.questionId, "body", text)}
                      />
                    ) : (
                      <p className="mt-1 text-sm text-ink-secondary whitespace-pre-line">{q.body}</p>
                    )}
                  </div>
                </div>

                {q.answer ? (
                (() => {
                  // Resolve who actually answered. Admin replies are
                  // common (admins can answer any product's questions
                  // per the answer route). Without this branch the
                  // label was hard-coded to "Seller answered" and
                  // mislabelled every admin reply.
                  const answeredByAdmin = q.answerer?.stats?.role === "admin";
                  const labelTone = answeredByAdmin
                    ? "border-coral/30 bg-coral/5 text-coral"
                    : "border-metu-yellow/20 bg-metu-yellow/5 text-metu-yellow";
                  const arrowTone = answeredByAdmin ? "text-coral" : "text-metu-yellow";
                  return (
                    <div className={`mt-4 ml-8 rounded-xl border p-4 flex items-start gap-3 ${labelTone.split(" ").slice(0, 2).join(" ")}`}>
                      <CornerDownRight className={`h-4 w-4 shrink-0 mt-0.5 ${arrowTone}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold inline-flex items-center gap-1 flex-wrap ${labelTone.split(" ").slice(2).join(" ")}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          {answeredByAdmin ? "Admin answered" : "Seller answered"}
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
                          {/* Admin can edit/delete the answer body
                              inline. Sellers continue to use the
                              answer FORM only when there's no answer
                              yet — once posted, only admin can change. */}
                          {isAdmin && !editingAnswer && (
                            <span className="ml-auto inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingId({ id: q.questionId, field: "answer" })}
                                aria-label="Edit answer"
                                title="Edit answer (admin)"
                                className="p-1 rounded-md text-ink-dim hover:text-metu-yellow hover:bg-white/5 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          )}
                        </div>
                        {editingAnswer ? (
                          <InlineQuestionEdit
                            initial={q.answer ?? ""}
                            maxLen={500}
                            onCancel={() => setEditingId(null)}
                            onSave={(text) => saveEdit(q.questionId, "answer", text)}
                          />
                        ) : (
                          <p className="mt-1 text-sm text-white whitespace-pre-line">{q.answer}</p>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                canAnswer && <AnswerForm onSubmit={(text) => answer(q.questionId, text)} />
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Inline edit textarea used for both the question body and the answer
 * text. Same shape, different `maxLen` per the schema cap (500 chars
 * each in ProductQuestion).
 */
function InlineQuestionEdit({
  initial,
  maxLen,
  onCancel,
  onSave,
}: {
  initial: string;
  maxLen: number;
  onCancel: () => void;
  onSave: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim().length < 3) return;
        setBusy(true);
        await onSave(text.trim());
        setBusy(false);
      }}
      className="mt-2 space-y-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxLen))}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-sm text-white focus:border-metu-yellow outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-ink-dim font-mono mr-auto">{text.length} / {maxLen}</span>
        <GlassButton tone="glass" size="sm" type="button" onClick={onCancel}>
          Cancel
        </GlassButton>
        <GlassButton tone="gold" size="sm" type="submit" disabled={busy || text.trim().length < 3}>
          {busy ? "Saving…" : "Save"}
        </GlassButton>
      </div>
    </form>
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
