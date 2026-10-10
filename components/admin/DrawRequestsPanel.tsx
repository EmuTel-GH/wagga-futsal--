"use client";

import { useCallback, useEffect, useState } from "react";

type Req = { id: string; kind: "MATCH_DATE" | "TEAM_BYE"; date: string; teamName: string; opponentName: string | null; note: string | null; met: boolean | null };
type Preview = {
  results: { id: string; ok: boolean; label: string; reason?: string }[];
  roundMoves: { round: number; fromDay: string; toDay: string }[];
  movedGames: number;
  publishedMoved: number;
};

const fmt = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// Fixed points for the draw: "A v B in the week of …" and "A has the bye in
// the week of …". Applied automatically whenever the draw is generated, or to
// the current draw on demand (only unplayed rounds move; whole rounds swap weeks).
export default function DrawRequestsPanel({ competitionId, teams, onApplied }: {
  competitionId: string;
  teams: { id: string; name: string }[];
  onApplied: (message: string) => void;
}) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [form, setForm] = useState({ kind: "MATCH_DATE" as Req["kind"], teamId: "", opponentId: "", date: "", note: "" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const odd = teams.length % 2 === 1;

  const load = useCallback(() => fetch(`/api/admin/competitions/${competitionId}/requests`).then((r) => r.json()).then(setReqs), [competitionId]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/competitions/${competitionId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    setForm({ ...form, teamId: "", opponentId: "", note: "" });
    load();
  };
  const remove = async (id: string) => {
    await fetch(`/api/admin/competitions/${competitionId}/requests?requestId=${id}`, { method: "DELETE" });
    load();
  };
  const apply = async (dryRun: boolean) => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/competitions/${competitionId}/requests/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    if (dryRun) return setPreview(data);
    setPreview(null);
    load();
    onApplied(`Draw requests applied: ${data.roundMoves.length} rounds swapped weeks. ${data.results.filter((r: Preview["results"][number]) => r.ok).length} of ${data.results.length} requests met.`);
  };

  const field = "border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-white";
  const teamSelect = (key: "teamId" | "opponentId", label: string) => (
    <select required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={field}>
      <option value="">{label}</option>
      {sorted.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-navy uppercase tracking-wide">Draw requests</p>
        <p className="text-[11px] text-muted">
          Fix a match to a week, or choose a team&apos;s bye week{odd ? "" : " (byes only exist with an odd number of teams)"}. They&apos;re
          applied every time the draw is generated: whole rounds swap weeks, so everyone still plays the same games.
        </p>
      </div>

      {reqs.length > 0 && (
        <ul className="text-xs space-y-1">
          {reqs.map((r) => (
            <li key={r.id} className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${r.met === true ? "bg-green-50 border-green-200 text-green-700" : r.met === false ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                {r.met === true ? "✓ met" : r.met === false ? "✗ not met" : "no draw that week"}
              </span>
              <span className="font-semibold text-navy">
                {r.kind === "MATCH_DATE" ? `${r.teamName} v ${r.opponentName}` : `${r.teamName}: bye`}
              </span>
              <span className="text-muted">week of {fmt(r.date)}{r.note ? ` · ${r.note}` : ""}</span>
              <button onClick={() => remove(r.id)} className="text-red-500 hover:text-red-700">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap gap-2 items-center">
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Req["kind"] })} className={field}>
          <option value="MATCH_DATE">Match on a date</option>
          <option value="TEAM_BYE" disabled={!odd}>Team&apos;s bye week</option>
        </select>
        {teamSelect("teamId", "Team…")}
        {form.kind === "MATCH_DATE" && <><span className="text-xs text-muted">v</span>{teamSelect("opponentId", "Opponent…")}</>}
        <span className="text-xs text-muted">week of</span>
        <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" className={`${field} w-40`} />
        <button type="submit" disabled={busy} className="bg-brand text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand-dark disabled:opacity-60">
          Add request
        </button>
      </form>

      {reqs.length > 0 && !preview && (
        <button onClick={() => apply(true)} disabled={busy}
          className="border border-brand text-brand px-3 py-1.5 rounded text-xs font-semibold hover:bg-brand/5 disabled:opacity-60">
          {busy ? "Checking…" : "Apply to the current draw…"}
        </button>
      )}

      {preview && (
        <div className="bg-white border border-brand/40 rounded-lg p-3 text-xs space-y-2">
          {preview.roundMoves.length === 0 ? (
            <p>Nothing to change: the current draw already meets every request it can.</p>
          ) : (
            <>
              <p className="text-navy">
                <span className="font-bold">{preview.roundMoves.length} rounds swap weeks</span> ({preview.movedGames} games). Same games, same days and times, just different weeks.
                {preview.publishedMoved > 0 && <span className="text-red-700 font-semibold"> {preview.publishedMoved} of these games are already published: the website and people&apos;s calendars will show the new dates.</span>}
              </p>
              <ul className="space-y-0.5">
                {preview.roundMoves.map((m) => <li key={m.round}>Round {m.round}: {fmt(m.fromDay)} → {fmt(m.toDay)}</li>)}
              </ul>
            </>
          )}
          <ul className="space-y-0.5">
            {preview.results.map((r) => (
              <li key={r.id} className={r.ok ? "text-green-700" : "text-red-700"}>{r.ok ? "✓" : "✗"} {r.label}{r.reason ? `: ${r.reason}` : ""}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            {preview.roundMoves.length > 0 && (
              <button onClick={() => apply(false)} disabled={busy} className="bg-brand text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-60">
                {busy ? "Applying…" : "Apply"}
              </button>
            )}
            <button onClick={() => setPreview(null)} className="border border-border px-3 py-1.5 rounded text-xs">Close</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
