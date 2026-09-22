"use client";

import { useState } from "react";

type Competition = { id: string; name: string; season: string };

const inputCls =
  "border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand";

export default function TeamNominationForm({ competitions }: { competitions: Competition[] }) {
  const [form, setForm] = useState({
    teamName: "",
    competitionId: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    kitShirt: "",
    kitShorts: "",
    kitSocks: "",
    players: "",
    website: "", // honeypot
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/public/team-nomination", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong — please try again.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="bg-white border border-border rounded-2xl p-10 text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-black text-navy mb-2">Team nominated!</h2>
        <p className="text-muted text-sm max-w-md mx-auto">
          <span className="font-semibold text-navy">{form.teamName}</span> is in. We&apos;ll be in
          touch at {form.contactEmail} — make sure every player completes their own PlayFootball
          registration before kick-off.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-2xl p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Team Name *</label>
          <input required maxLength={60} value={form.teamName} onChange={set("teamName")} className={inputCls} placeholder="e.g. Crowing Emus" />
          <p className="text-xs text-muted mt-1">No rude or offensive team names.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Competition *</label>
          <select required value={form.competitionId} onChange={set("competitionId")} className={inputCls}>
            <option value="">Select competition…</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-navy mb-2">Team contact (coach or manager)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Name *</label>
            <input required value={form.contactName} onChange={set("contactName")} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Email *</label>
            <input required type="email" value={form.contactEmail} onChange={set("contactEmail")} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Mobile</label>
            <input type="tel" value={form.contactPhone} onChange={set("contactPhone")} className={inputCls} />
          </div>
        </div>
        <p className="text-xs text-muted mt-1">
          The contact must be over 18 and registered as a coach/manager with the team on game nights.
        </p>
      </div>

      <div>
        <p className="text-sm font-bold text-navy mb-2">Kit colours</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Shirt</label>
            <input value={form.kitShirt} onChange={set("kitShirt")} className={inputCls} placeholder="Red" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Shorts</label>
            <input value={form.kitShorts} onChange={set("kitShorts")} className={inputCls} placeholder="Black" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Socks</label>
            <input value={form.kitSocks} onChange={set("kitSocks")} className={inputCls} placeholder="Red" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-navy mb-1">Players (one per line)</label>
        <textarea
          rows={8}
          value={form.players}
          onChange={set("players")}
          className={inputCls}
          placeholder={"Harrison Heller\nLoch Wealands\nWhit Wealands\n…"}
        />
        <p className="text-xs text-muted mt-1">
          Teams need 7–10 players. List everyone you expect, even if they haven&apos;t registered on
          PlayFootball yet.
        </p>
      </div>

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        value={form.website}
        onChange={set("website")}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-60"
      >
        {saving ? "Submitting…" : "Nominate Team"}
      </button>
    </form>
  );
}
