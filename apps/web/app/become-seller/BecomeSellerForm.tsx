"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type BusinessType = { typeId: number; name: string; description: string };

export function BecomeSellerForm({ businessTypes }: { businessTypes: BusinessType[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    businessTypeId: businessTypes[0]?.typeId ?? 0,
    profileImage: "",
    coverImage: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/seller/become-seller`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          profileImage: form.profileImage || undefined,
          coverImage: form.coverImage || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Failed to create store");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/seller");
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-line bg-space-900 px-4 py-2.5 text-white placeholder:text-ink-dim focus:border-brand-yellow outline-none";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-space-850 p-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-white">Store name</span>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={60}
          required
          placeholder="e.g. Kluay Studio"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-white">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={255}
          required
          placeholder="What do you sell?"
          rows={3}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-white">Business type</span>
        <select
          value={form.businessTypeId}
          onChange={(e) => setForm({ ...form, businessTypeId: Number(e.target.value) })}
          className={inputCls}
        >
          {businessTypes.map((b) => (
            <option key={b.typeId} value={b.typeId}>{b.name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-white">Profile image URL</span>
          <input
            value={form.profileImage}
            onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-white">Cover image URL</span>
          <input
            value={form.coverImage}
            onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating store…" : "Open my store →"}
      </Button>
    </form>
  );
}
