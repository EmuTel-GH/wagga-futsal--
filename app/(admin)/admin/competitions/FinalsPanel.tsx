"use client";

import { useEffect, useState } from "react";
import type { Venue } from "./CompetitionsClient";

type Side = { id: string; name?: string };
type Game = { id: string; home: Side; away: Side; homeScore: number; awayScore: number; status: string; scheduledAt: string; winnerId?: string | null };
type State = { semis: Game[]; grandFinal: Game | null; planned: { at: string | null; pitchId: string | null } };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const PLAYED = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"];

// Start finals (top 4: 1 v 4, 2 v 3), and follow them through to the grand
// final, which is created automatically once both semis have a winner.
export default function FinalsPanel({ competitionId, status, venues, onStarted }: {
  competitionId: string; status: string; venues: Venue[]; onStarted: () => void;
}) {
  const pitches = venues.flatMap((v) => v.pitches.map((p) => ({ id: p.id, label: `${v.name} – ${p.name}` })));
  const [form, setForm] = useState({ semifinalDate: "", pitchId: pitches[0]?.id ?? "", secondPitchId: pitches[1]?.id ?? "", grandFinalDate: "", grandFinalPitchId: pitches[0]?.id ?? "" });
  const [state, setState] = useState<State | null>(null);
  const [gfPick, setGfPick] = useState<[string, string]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch(`/api/admin/finals?competitionId=${competitionId}`).then((r) => r.json()).then((s: State) => {
      setState(s);
      setGfPick([s.semis[0]?.winnerId ?? "", s.semis[1]?.winnerId ?? ""]);
    });
  useEffect(() => { if (status === "FINALS") load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!form.semifinalDate || !form.pitchId) return setMsg("Set the semi-final date and pitch");
    if (!confirm("Create the semi-finals (1st v 4th, 2nd v 3rd) as drafts? Publish them on the Fixtures page.")) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/finals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId, ...form, secondPitchId: form.secondPitchId === form.pitchId ? "" : form.secondPitchId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Failed");
    setMsg(`Semi-finals created as drafts: ${data.semifinals.join(" and ")}. Publish them on the Fixtures page.${form.grandFinalDate ? " The grand final is created automatically once both semis have a winner." : ""}`);
    onStarted();
    load();
  };

  const createGf = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/finals/grand-final", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId, homeTeamId: gfPick[0], awayTeamId: gfPick[1] }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Failed");
    setMsg(`Grand final created: ${data.homeTeam.name} v ${data.awayTeam.name}.`);
    load();
  };

  const field = "border border-border rounded px-2 py-1.5 text-xs focus:outline-none bg-white";
  const label = "block text-[10px] font-semibold text-muted mb-0.5";
  const pitchSelect = (key: "pitchId" | "secondPitchId" | "grandFinalPitchId") => (
    <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={field}>
      {pitches.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
  const semiTeams = state ? state.semis.flatMap((s) => [s.home, s.away]) : [];

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-navy uppercase tracking-wide">Finals (top 4)</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className={label}>Semi-finals</label>
          <input type="datetime-local" value={form.semifinalDate} onChange={(e) => setForm({ ...form, semifinalDate: e.target.value })} className={field} /></div>
        <div><label className={label}>1st v 4th on</label>{pitchSelect("pitchId")}</div>
        <div><label className={label}>2nd v 3rd on (same pitch = an hour later)</label>{pitchSelect("secondPitchId")}</div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div><label className={label}>Grand final (same night or a later week)</label>
          <input type="datetime-local" value={form.grandFinalDate} onChange={(e) => setForm({ ...form, grandFinalDate: e.target.value })} className={field} /></div>
        <div><label className={label}>Grand final pitch</label>{pitchSelect("grandFinalPitchId")}</div>
        <button onClick={start} disabled={busy}
          className="bg-brand text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {busy ? "Working…" : status === "FINALS" ? "Re-create semi-finals" : "Start finals"}
        </button>
      </div>

      {state && state.semis.length > 0 && (
        <div className="bg-gray-50 border border-border rounded-lg p-3 text-xs space-y-1">
          {state.semis.map((s, i) => (
            <p key={s.id}>
              <span className="font-semibold">Semi {i + 1}:</span> {s.home.name} v {s.away.name} · {when(s.scheduledAt)} ·{" "}
              {PLAYED.includes(s.status) ? `${s.homeScore}–${s.awayScore}` : s.status.toLowerCase()}
              {PLAYED.includes(s.status) && !s.winnerId && <span className="text-amber-700 font-semibold"> · drawn: pick the winner below</span>}
            </p>
          ))}
          {state.grandFinal ? (
            <p className="text-green-800 font-semibold">Grand final: {state.grandFinal.home.name} v {state.grandFinal.away.name} · {when(state.grandFinal.scheduledAt)}</p>
          ) : (
            <>
              <p className="text-muted">
                Grand final: {state.planned.at ? `planned for ${when(state.planned.at)}, created automatically once both semis have a winner.` : "no date set yet: set it above, or create it here."}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                {[0, 1].map((i) => (
                  <select key={i} value={gfPick[i]} onChange={(e) => setGfPick(i === 0 ? [e.target.value, gfPick[1]] : [gfPick[0], e.target.value])} className={field}>
                    <option value="">Finalist {i + 1}…</option>
                    {semiTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                ))}
                <button onClick={createGf} disabled={busy || !gfPick[0] || !gfPick[1] || gfPick[0] === gfPick[1] || !state.planned.at}
                  className="border border-brand text-brand px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50">
                  Create grand final now
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className="text-xs text-navy">{msg}</p>}
    </div>
  );
}
