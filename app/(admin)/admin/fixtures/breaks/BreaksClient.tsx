"use client";

import { useState } from "react";

type Break = { id: string; name: string; startDate: string; endDate: string; competition: { id: string; name: string } | null };
type Competition = { id: string; name: string; season: string };

// "2026-12-20" → "Sat 20 Dec 2026"
const fmt = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

export default function BreaksClient({ initialBreaks, competitions }: { initialBreaks: Break[]; competitions: Competition[] }) {
  const [breaks, setBreaks] = useState(initialBreaks);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", competitionId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, endDate: form.endDate || form.startDate, competitionId: form.competitionId || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    setBreaks((prev) =>
      [...prev, { ...data, startDate: data.startDate.slice(0, 10), endDate: data.endDate.slice(0, 10) }].sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      )
    );
    setForm({ name: "", startDate: "", endDate: "", competitionId: form.competitionId });
  };

  const remove = async (b: Break) => {
    if (!confirm(`Remove the break "${b.name}"? Games already moved for it stay where they are.`)) return;
    const res = await fetch(`/api/admin/breaks/${b.id}`, { method: "DELETE" });
    if (res.ok) setBreaks((prev) => prev.filter((x) => x.id !== b.id));
  };

  const field = "border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white";
  const now = today();

  return (
    <>
      <form onSubmit={add} className="bg-white border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-muted">
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Christmas break" className={`${field} block w-56 mt-0.5`} />
          </label>
          <label className="text-xs font-semibold text-muted">
            From
            <input required type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })}
              className={`${field} block mt-0.5`} />
          </label>
          <label className="text-xs font-semibold text-muted">
            To (inclusive)
            <input type="date" value={form.endDate} min={form.startDate || undefined}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`${field} block mt-0.5`} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Applies to
            <select value={form.competitionId} onChange={(e) => setForm({ ...form, competitionId: e.target.value })} className={`${field} block mt-0.5`}>
              <option value="">All competitions</option>
              {competitions.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.season})</option>)}
            </select>
          </label>
          <button type="submit" disabled={saving}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
            {saving ? "Adding…" : "Add break"}
          </button>
        </div>
        <p className="text-[11px] text-muted mt-2">Leave “To” blank for a single day, such as a public holiday.</p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </form>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {breaks.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">No breaks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy text-white">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Break</th>
                <th className="px-4 py-2.5 text-left font-semibold">Dates</th>
                <th className="px-4 py-2.5 text-left font-semibold">Applies to</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {breaks.map((b) => (
                <tr key={b.id} className={b.endDate < now ? "text-muted" : ""}>
                  <td className="px-4 py-2.5 font-semibold text-navy">
                    {b.name}
                    {b.endDate < now && <span className="ml-2 text-[10px] font-normal text-muted">(past)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {fmt(b.startDate)}{b.endDate !== b.startDate && <> – {fmt(b.endDate)}</>}
                  </td>
                  <td className="px-4 py-2.5">{b.competition?.name ?? "All competitions"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(b)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
