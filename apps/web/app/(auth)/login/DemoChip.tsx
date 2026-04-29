"use client";

/**
 * Phase 16.3 — server-component login page can't dispatch DOM events
 * directly, so the demo-chip is a tiny client component that fires
 * a `metu:prefill-login` CustomEvent. LoginForm listens for it and
 * fills both inputs without scraping `data-*` attributes off the DOM
 * (the previous approach was brittle and hard to read).
 */
export function DemoChip({
  label,
  email,
  password,
}: {
  label: string;
  email: string;
  password: string;
}) {
  function prefill() {
    window.dispatchEvent(
      new CustomEvent("metu:prefill-login", { detail: { email, password } }),
    );
  }
  return (
    <button
      type="button"
      onClick={prefill}
      className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-line px-4 py-3 text-left hover:bg-white/10 hover:border-brand-yellow/40 transition"
    >
      <div>
        <div className="text-xs font-semibold text-brand-yellow">{label}</div>
        <div className="text-sm font-mono text-white">{email}</div>
      </div>
      <span className="text-xs font-mono text-ink-dim">{password}</span>
    </button>
  );
}
