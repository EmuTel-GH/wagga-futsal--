"use client";

import { useState } from "react";

export type DrawCompetition = {
  id: string;
  name: string;
  ageGroup: string;
  drawTimesEach: number | null;
  drawMaxRounds: number | null;
  endDate: Date | string | null;
};

export type DrawResult = {
  fixtures: number;
  rounds: number;
  roundsPerCycle: number;
  fullCycles: number;
  extraRounds: number;
  lastGame: string;
  stoppedAtEndDate: boolean;
  shortOfTarget: boolean;
  skippedWeeks: { weekOf: string; breakName: string }[];
  requests?: { ok: boolean; label: string; reason?: string }[];
};

const TIMES = ["once", "twice", "three times", "four times"];
const times = (n: number) => TIMES[n - 1] ?? `${n} times`;
const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Plain-English summary of a generated draw. */
export function describeDraw(d: DrawResult) {
  const reach =
    d.fullCycles === 0
      ? `${d.rounds} round${d.rounds === 1 ? "" : "s"} (not everyone plays everyone yet: a full round-robin is ${d.roundsPerCycle} rounds)`
      : `each team plays the others ${times(d.fullCycles)}` +
        (d.extraRounds ? `, plus ${d.extraRounds} round${d.extraRounds === 1 ? "" : "s"} of the next round-robin` : "");
  return (
    `Draft draw created: ${d.fixtures} fixtures over ${d.rounds} rounds, last games ${fmtDay(d.lastGame)}. ` +
    `That's ${reach}.` +
    (d.shortOfTarget ? " ⚠ The end date arrived before the round-robins you asked for were finished." : "") +
    (d.skippedWeeks.length
      ? ` Skipped ${d.skippedWeeks.length} week${d.skippedWeeks.length === 1 ? "" : "s"} for breaks: ${d.skippedWeeks.map((s) => `${fmtDay(s.weekOf)} (${s.breakName})`).join(", ")}.`
      : "") +
    (d.requests?.length
      ? ` Draw requests: ${d.requests.filter((r) => r.ok).length} of ${d.requests.length} met` +
        (d.requests.some((r) => !r.ok) ? ` (not met: ${d.requests.filter((r) => !r.ok).map((r) => `${r.label}: ${r.reason}`).join("; ")})` : "") + "."
      : "") +
    " It isn't on the website until you publish it."
  );
}

const dateValue = (d: Date | string | null) => (d ? (typeof d === "string" ? d : d.toISOString()).slice(0, 10) : "");

// Draw settings + "Generate draft draw". Shared by the Fixtures and Competitions pages.
export default function GenerateDrawForm({
  competition,
  onGenerated,
}: {
  competition: DrawCompetition;
  onGenerated: (result: DrawResult) => void;
}) {
  const [mode, setMode] = useState<"times" | "until">(
    competition.drawTimesEach === null && competition.endDate ? "until" : "times"
  );
  const [form, setForm] = useState({
    startDate: "",
    timesEach: String(competition.drawTimesEach ?? (competition.ageGroup === "OPENS" ? 3 : 2)),
    maxRounds: competition.drawMaxRounds ? String(competition.drawMaxRounds) : "",
    endDate: dateValue(competition.endDate),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Generate a draft draw for ${competition.name}? Existing unplayed fixtures for this competition (draft or published) will be replaced. Weeks that fall in a break are skipped.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: competition.id,
        startDate: form.startDate,
        timesEach: mode === "times" ? form.timesEach : null,
        maxRounds: form.maxRounds || null,
        endDate: form.endDate || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed to generate draw");
    onGenerated(data);
  };

  const field = "border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-white";
  const label = "block text-[10px] font-semibold text-muted mb-0.5";

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className={label}>First round from</label>
          <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={field} />
        </div>
        <div>
          <label className={label}>Format</label>
          <div className="flex items-center gap-3 text-xs h-[30px]">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "times"} onChange={() => setMode("times")} />
              Play each other
              <input
                type="number" min={1} max={10} value={form.timesEach} disabled={mode !== "times"}
                onChange={(e) => setForm({ ...form, timesEach: e.target.value })}
                className={`${field} w-14 disabled:opacity-50`}
              />
              time(s)
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "until"} onChange={() => setMode("until")} />
              Keep playing until the end date
            </label>
          </div>
        </div>
        <div>
          <label className={label}>Stop after (rounds, optional)</label>
          <input type="number" min={1} max={200} value={form.maxRounds} placeholder="—"
            onChange={(e) => setForm({ ...form, maxRounds: e.target.value })} className={`${field} w-24`} />
        </div>
        <div>
          <label className={label}>End date {mode === "until" ? "(required)" : "(optional)"}</label>
          <input type="date" required={mode === "until"} min={form.startDate || undefined} value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={field} />
        </div>
        <button type="submit" disabled={busy}
          className="bg-brand text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {busy ? "Generating…" : "Generate draft draw"}
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Whichever limit comes first ends the draw. To split into divisions part-way, set &ldquo;Stop after&rdquo; (a full
        round-robin is one round fewer than the number of teams, or equal to it with an odd number), then use
        <span className="font-semibold"> Split into divisions</span> on the Competitions page.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
