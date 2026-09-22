"use client";

import { useState } from "react";

type Session = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMins: number;
  capacityMax: number;
  priceCents: number;
  status: string;
  pitch?: { id: string; name: string } | null;
  _count: { bookings: number };
  bookings: { participantCount: number }[];
};

type Pitch = { id: string; name: string };

type Props = { onCreated: (session: Session) => void; pitches: Pitch[] };

export default function AddSessionForm({ onCreated, pitches }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    durationMins: "60",
    capacityMax: "20",
    priceDollars: "20",
    status: "OPEN",
    pitchId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const priceCents = Math.round(parseFloat(form.priceDollars) * 100);
    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        scheduledAt: form.scheduledAt,
        durationMins: Number(form.durationMins),
        capacityMax: Number(form.capacityMax),
        priceCents,
        status: form.status,
        pitchId: form.pitchId || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to create session"); return; }
    onCreated(data);
    setForm({ title: "", description: "", scheduledAt: "", durationMins: "60", capacityMax: "20", priceDollars: "20", status: "OPEN", pitchId: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark">
        + Add Session
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-5 mb-6">
      <h2 className="text-base font-bold text-navy mb-4">New Futsal Session</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted mb-1">Title</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Friday Night Social Futsal"
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted mb-1">Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Date & Time</label>
          <input required type="datetime-local" value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Duration (min)</label>
          <input type="number" required value={form.durationMins} min={15} max={240}
            onChange={(e) => setForm((f) => ({ ...f, durationMins: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Capacity</label>
          <input type="number" required value={form.capacityMax} min={1}
            onChange={(e) => setForm((f) => ({ ...f, capacityMax: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Price (AUD $)</label>
          <input type="number" required value={form.priceDollars} min={0} step={0.01}
            onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Pitch</label>
          <select value={form.pitchId} onChange={(e) => setForm((f) => ({ ...f, pitchId: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">No pitch assigned</option>
            {pitches.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="OPEN">Open</option>
            <option value="FULL">Full</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving…" : "Create Session"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="border border-border px-3 py-1.5 rounded text-sm hover:border-brand">Cancel</button>
      </div>
    </form>
  );
}
