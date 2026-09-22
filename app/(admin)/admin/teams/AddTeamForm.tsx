"use client";

import { useState } from "react";

type Team = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  _count: { players: number };
  competitions: { id: string; teamId: string; competition: { id: string; name: string; season: string } }[];
  players: { id: string; playerId: string; jerseyNumber: number | null; player: { id: string; firstName: string; lastName: string } }[];
};

type Props = { onCreated: (team: Team) => void };

export default function AddTeamForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to create team"); return; }
    onCreated(data);
    setForm({ name: "", contactName: "", contactEmail: "", contactPhone: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">
        + Add Team
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-5 mb-6">
      <h2 className="text-base font-bold text-navy mb-4">New Team</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Team Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. FC Wagga" className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Contact Name</label>
          <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            placeholder="Nominating coach/manager" className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Contact Email</label>
          <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Contact Phone</label>
          <input type="tel" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : "Create Team"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="border border-border px-3 py-1.5 rounded text-sm hover:border-brand">Cancel</button>
      </div>
    </form>
  );
}
