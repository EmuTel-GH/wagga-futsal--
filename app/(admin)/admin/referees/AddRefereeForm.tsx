"use client";

import { useState } from "react";

type Referee = {
  id: string;
  phone: string | null;
  bsb: string | null;
  accountNumber: string | null;
  accountName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user: { id: string; name: string; email: string; role: string } | null;
  _count: { fieldRefGames: number };
};

type Props = { onCreated: (referee: Referee) => void };

export default function AddRefereeForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/referees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to create referee"); return; }
    // The POST returns User with referee nested — reshape for display
    const referee: Referee = {
      id: data.referee.id,
      phone: data.referee.phone,
      bsb: data.referee.bsb ?? null,
      accountNumber: data.referee.accountNumber ?? null,
      accountName: data.referee.accountName ?? null,
      user: { id: data.id, name: data.name, email: data.email, role: data.role },
      _count: { fieldRefGames: 0 },
    };
    onCreated(referee);
    setForm({ name: "", email: "", password: "", phone: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">
        + Add Referee
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-5 mb-6">
      <h2 className="text-base font-bold text-navy mb-4">New Referee</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Full Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Email</label>
          <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Password</label>
          <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            minLength={8} className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : "Create Referee"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="border border-border px-3 py-1.5 rounded text-sm hover:border-brand">Cancel</button>
      </div>
    </form>
  );
}
