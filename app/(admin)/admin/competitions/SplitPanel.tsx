"use client";

import { useEffect, useState } from "react";
import { defaultAssignment, defaultDivisionNames, distributeSlots, validateSplit, type SplitSlot } from "@/lib/split";

type LadderRow = { teamId: string; name: string; position: number | null; played: number; points: number; goalDifference: number };
type Preview = {
  competition: { id: string; name: string; status: string };
  ladder: LadderRow[];
  pending: string[];
  slots: SplitSlot[];
  unplayed: number;
  played: number;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Split into divisions": ladder-ordered teams dealt into N divisions (each
// team adjustable), names, the time slots each division gets, and what
// happens to unplayed fixtures. Confirm runs the split.
export default function SplitPanel({ competitionId, onClose }: { competitionId: string; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>([]);
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/competitions/${competitionId}/split`)
      .then((r) => r.json())
      .then((p: Preview) => {
        setPreview(p);
        setNames(defaultDivisionNames(p.competition.name, 2));
        setAssign(defaultAssignment(p.ladder.map((t) => t.teamId), 2));
      })
      .catch(() => setError("Couldn't load the ladder"));
  }, [competitionId]);

  if (!preview) return <p className="text-xs text-muted mt-3">{error || "Loading ladder…"}</p>;

  const changeCount = (n: number) => {
    setCount(n);
    setNames(defaultDivisionNames(preview.competition.name, n));
    setAssign(defaultAssignment(preview.ladder.map((t) => t.teamId), n));
  };
  const divisions = names.map((name, i) => ({ name, teamIds: preview.ladder.filter((t) => assign[t.teamId] === i).map((t) => t.teamId) }));
  const problems = [
    ...(preview.pending.length ? [`Approve, merge or delete the pending nominations first: ${preview.pending.join(", ")}.`] : []),
    ...validateSplit(divisions, preview.ladder.map((t) => t.teamId)),
  ];
  const { perDivision, clash } = distributeSlots(preview.slots, count);
  const fmtSlot = (s: SplitSlot) => `${DAY[s.dayOfWeek]} ${s.startTime} ${s.pitchName ?? ""}`.trim();

  const submit = async () => {
    if (!confirm(
      `Split ${preview.competition.name} into ${divisions.map((d) => `${d.name} (${d.teamIds.length})`).join(", ")}?\n\n` +
      `${preview.unplayed ? `${preview.unplayed} unplayed fixtures will be deleted. ` : ""}` +
      `${preview.competition.name} will be marked completed; its results and ladder stay on the website. Each division then needs its own draw.`
    )) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/competitions/${competitionId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ divisions }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Split failed");
    window.location.reload();
  };

  const field = "border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-white";

  return (
    <div className="mt-3 border border-brand/40 bg-brand/5 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-navy">Split into divisions</p>
        <label className="text-xs text-muted flex items-center gap-1">
          Divisions
          <select value={count} onChange={(e) => changeCount(Number(e.target.value))} className={field}>
            {[2, 3, 4].filter((n) => n * 2 <= preview.ladder.length).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted">
          {preview.played} games played · {preview.unplayed} unplayed{preview.unplayed ? " (deleted on split)" : ""}
        </p>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {divisions.map((d, i) => (
          <div key={i} className="bg-white border border-border rounded-lg p-3">
            <input value={names[i]} onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))}
              className={`${field} w-full font-semibold mb-2`} />
            <p className="text-[10px] font-bold text-muted uppercase mb-1">{d.teamIds.length} teams</p>
            <ul className="text-xs space-y-0.5 mb-2">
              {d.teamIds.map((t) => <li key={t}>{preview.ladder.find((x) => x.teamId === t)?.name}</li>)}
            </ul>
            <p className="text-[10px] font-bold text-muted uppercase mb-0.5">Time slots</p>
            <p className="text-[11px] text-navy">{perDivision[i].map(fmtSlot).join(" · ") || "None: add some after splitting"}</p>
          </div>
        ))}
      </div>
      {clash && (
        <p className="text-xs text-red-700">
          ⚠ There are fewer time slots than divisions, so every division gets all of them and their games would clash.
          Adjust the divisions&apos; time slots after splitting.
        </p>
      )}

      <div>
        <p className="text-xs font-bold text-navy uppercase tracking-wide mb-1">Ladder → division</p>
        <table className="text-xs w-full bg-white border border-border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-muted">
            <tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Team</th><th className="px-2 py-1">P</th><th className="px-2 py-1">Pts</th><th className="px-2 py-1">GD</th><th className="px-2 py-1 text-left">Division</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.ladder.map((t) => (
              <tr key={t.teamId}>
                <td className="px-2 py-1 text-muted">{t.position ?? "–"}</td>
                <td className="px-2 py-1 font-semibold text-navy">{t.name}</td>
                <td className="px-2 py-1 text-center">{t.played}</td>
                <td className="px-2 py-1 text-center">{t.points}</td>
                <td className="px-2 py-1 text-center">{t.goalDifference}</td>
                <td className="px-2 py-1">
                  <select value={assign[t.teamId]} onChange={(e) => setAssign({ ...assign, [t.teamId]: Number(e.target.value) })} className={field}>
                    {names.map((n, i) => <option key={i} value={i}>{n || `Division ${i + 1}`}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted mt-1">
          Teams are dealt top-down by ladder position. Change any team&apos;s division as needed. Play-up/down approvals,
          unserved suspensions and this competition&apos;s own breaks carry over to the new divisions.
        </p>
      </div>

      {problems.length > 0 && <ul className="text-xs text-red-700 list-disc ml-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy || problems.length > 0}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
          {busy ? "Splitting…" : `Split into ${count} divisions`}
        </button>
        <button onClick={onClose} className="border border-border px-3 py-2 rounded-lg text-sm hover:border-brand bg-white">Cancel</button>
      </div>
    </div>
  );
}
