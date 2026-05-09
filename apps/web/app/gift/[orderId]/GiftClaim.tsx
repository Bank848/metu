"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Loader2,
  Mail,
  AlertCircle,
  Check,
  Download,
  KeyRound,
  LogIn,
  UserPlus,
} from "lucide-react";

type GiftItem = {
  orderItemId: number;
  quantity: number;
  name: string;
  deliveredKey: string | null;
  deliveredUrl: string | null;
};
type GiftStore = {
  storeId: number;
  storeName: string;
  items: GiftItem[];
};
type GiftResult =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "no-gift" }
  | { status: "invalid-token" }
  | { status: "needs-auth"; recipientMasked: string }
  | { status: "wrong-email"; recipientMasked: string }
  | {
      status: "already-owned";
      recipientMasked: string;
      duplicateProductNames: string[];
    }
  | {
      status: "ok";
      orderId: number;
      buyerFirstName: string;
      giftMessage: string | null;
      recipientMasked: string;
      stores: GiftStore[];
    };

export function GiftClaim({ orderId, token }: { orderId: number; token: string }) {
  const [state, setState] = useState<GiftResult>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!Number.isFinite(orderId) || orderId <= 0 || !token) {
        if (!cancelled) setState({ status: "invalid-token" });
        return;
      }
      try {
        const res = await fetch(
          `/api/gift/${orderId}?t=${encodeURIComponent(token)}`,
          { credentials: "include", cache: "no-store" },
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!data || typeof data.status !== "string") {
          setState({ status: "invalid-token" });
          return;
        }
        setState(data as GiftResult);
      } catch {
        if (!cancelled) setState({ status: "invalid-token" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  // Build the same URL the email used so login/register can bounce back here.
  const claimPath = `/gift/${orderId}?t=${encodeURIComponent(token)}`;
  const next = encodeURIComponent(claimPath);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-line bg-space-900 p-8 flex items-center gap-3 text-ink-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your gift…
      </div>
    );
  }

  if (state.status === "not-found" || state.status === "no-gift") {
    return (
      <ErrorPanel
        title="This gift link doesn't exist"
        body="The order may have been cancelled, refunded, or the link was mistyped. Ask the sender to resend their gift."
      />
    );
  }

  if (state.status === "invalid-token") {
    return (
      <ErrorPanel
        title="Link is invalid or expired"
        body="The claim token didn't verify. Ask the sender to forward the original gift email — the link in there is the one we trust."
      />
    );
  }

  if (state.status === "needs-auth") {
    return (
      <ClaimPrompt
        recipientMasked={state.recipientMasked}
        next={next}
        title="Sign in to claim your gift"
      />
    );
  }

  if (state.status === "wrong-email") {
    return (
      <ErrorPanel
        title="Wrong account"
        body={
          <>
            This gift was sent to <strong>{state.recipientMasked}</strong>, but
            you&rsquo;re signed in as a different account. Sign out and sign
            back in with the recipient address to claim it.
          </>
        }
        action={
          <Link
            href={`/login?next=${next}`}
            className="inline-flex items-center gap-2 rounded-full bg-metu-yellow text-space-950 px-4 py-2 text-sm font-bold hover:bg-metu-yellow/90"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in as {state.recipientMasked}
          </Link>
        }
      />
    );
  }

  if (state.status === "already-owned") {
    return (
      <ErrorPanel
        title="You already own this"
        body={
          <>
            Your account already owns{" "}
            <strong>{state.duplicateProductNames.join(", ")}</strong>, so we
            can&rsquo;t add a duplicate. Ask the sender to either pick a
            different product or to request a refund through the seller.
          </>
        }
      />
    );
  }

  // status === "ok" — render the goods.
  return <ClaimedPanel state={state} />;
}

function ClaimPrompt({
  recipientMasked,
  next,
  title,
}: {
  recipientMasked: string;
  next: string;
  title: string;
}) {
  // We pre-fill the email field via ?email=<masked> on /register and /login;
  // the masked tail is enough for the recipient to recognise their address
  // without us disclosing the unmasked value to anyone holding the link.
  const emailParam = `&email=${encodeURIComponent(recipientMasked)}`;
  return (
    <div className="rounded-2xl border border-metu-yellow/30 bg-gradient-to-br from-metu-yellow/8 to-transparent p-7 sm:p-9 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-metu-yellow/20 mb-4">
        <Gift className="h-7 w-7 text-metu-yellow" />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
        {title}
      </h1>
      <p className="text-sm text-ink-secondary max-w-md mx-auto mb-1">
        Someone sent you a digital gift on METU. We sent the link to your inbox
        — sign in or create a free account with that same email to unlock it.
      </p>
      <p className="text-xs text-ink-dim mb-6 inline-flex items-center gap-1.5">
        <Mail className="h-3 w-3" />
        Recipient address ends in <span className="font-mono">{recipientMasked}</span>
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          href={`/login?next=${next}${emailParam}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-metu-yellow text-space-950 px-5 py-2.5 text-sm font-bold hover:bg-metu-yellow/90 transition"
        >
          <LogIn className="h-3.5 w-3.5" />
          I have an account — sign in
        </Link>
        <Link
          href={`/register?next=${next}${emailParam}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-space-900 ring-1 ring-line text-white px-5 py-2.5 text-sm font-semibold hover:ring-metu-yellow/40 transition"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Create account &amp; claim
        </Link>
      </div>
      <p className="mt-5 text-[11px] text-ink-dim">
        After you sign up and verify your phone, head back to the link in your
        gift email — you&rsquo;ll land right back here, signed in.
      </p>
    </div>
  );
}

function ErrorPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-coral/30 bg-coral/5 p-7 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-coral/15 mb-3">
        <AlertCircle className="h-6 w-6 text-coral" />
      </div>
      <h1 className="font-display text-xl sm:text-2xl font-bold text-white mb-2">
        {title}
      </h1>
      <p className="text-sm text-ink-secondary max-w-md mx-auto">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ClaimedPanel({
  state,
}: {
  state: Extract<GiftResult, { status: "ok" }>;
}) {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-metu-yellow/30 bg-gradient-to-br from-metu-yellow/12 via-metu-yellow/4 to-transparent p-7 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-metu-yellow/20 mb-3">
          <Gift className="h-7 w-7 text-metu-yellow" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          A gift from {state.buyerFirstName}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary inline-flex items-center justify-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-mint" />
          Claimed for {state.recipientMasked}
        </p>
        {state.giftMessage && (
          <div className="mt-5 mx-auto max-w-md rounded-xl bg-metu-yellow/10 border-l-4 border-metu-yellow text-left px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-metu-yellow mb-1">
              Note from {state.buyerFirstName}
            </div>
            <p className="text-sm text-white italic leading-relaxed">
              &ldquo;{state.giftMessage}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Goods */}
      {state.stores.map((store) => (
        <section
          key={store.storeId}
          className="rounded-2xl border border-line bg-space-900 p-5"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-metu-yellow/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-metu-yellow mb-4">
            {store.storeName}
          </div>
          <ul className="space-y-3">
            {store.items.map((it) => (
              <li
                key={it.orderItemId}
                className="rounded-xl bg-space-850 ring-1 ring-line/80 p-4"
              >
                <div className="text-sm font-semibold text-white mb-2">
                  {it.quantity}× {it.name}
                </div>
                {it.deliveredKey && (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-metu-yellow mb-1.5 inline-flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      License key
                    </div>
                    <div className="font-mono text-xs text-mint bg-space-950 ring-1 ring-line/60 rounded-lg px-3 py-2 break-all select-all">
                      {it.deliveredKey}
                    </div>
                  </div>
                )}
                {it.deliveredUrl && (
                  <a
                    href={it.deliveredUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-metu-yellow text-space-950 px-4 py-1.5 text-xs font-bold hover:bg-metu-yellow/90 transition"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                )}
                {!it.deliveredKey && !it.deliveredUrl && (
                  <div className="text-xs text-ink-dim italic">
                    Delivery is still being processed — check back in a minute.
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
