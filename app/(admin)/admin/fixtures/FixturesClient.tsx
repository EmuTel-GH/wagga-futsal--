"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FixtureRow from "./FixtureRow";
import { breakFor, type BreakRange } from "@/lib/breakDates";

type TeamRef = { id: string; name: string };
type PitchRef = { id: string; name: string };
type RefereeUser = { id: string; name: string };
type RefereeRef = { id: string; user: RefereeUser };

type Fixture = {
  id: string;
  round: number;
  phase: string;
  status: string;
  scheduledAt: string;
  homeScore: number;
  awayScore: number;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  pitch: PitchRef | null;
  fieldReferee: RefereeRef | null;
  scorer: RefereeRef | null;
  competition?: { id: string };
};

type Referee = { id: string; user: { name: string } };
type Pitch = { id: string; name: string; venue: { name: string } };
type Competition = { id: string; name: string; season: string };

export default function FixturesClient({
  initialFixtures,
  referees,
  pitches,
  competitions,
  selectedCompId,
  breaks,
}: {
  initialFixtures: Fixture[];
  referees: Referee[];
  pitches: Pitch[];
  competitions: Competition[];
  selectedCompId: string;
  breaks: BreakRange[];
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>(initialFixtures);
  const [drawDate, setDrawDate] = useState("");
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawMsg, setDrawMsg] = useState("");

  const handleUpdated = (f: Fixture) => setFixtures((prev) => prev.map((x) => (x.id === f.id ? { ...x, ...f } : x)));

  // Unplayed games that fall in a break that applies to their competition.
  const UNPLAYED = ["DRAFT", "SCHEDULED"];
  const breakNameFor = (f: Fixture) =>
    UNPLAYED.includes(f.status)
      ? breakFor(
          new Date(f.scheduledAt),
          breaks.filter((b) => !b.competitionId || b.competitionId === f.competition?.id)
        )?.name ?? null
      : null;
  const inBreak = fixtures.filter((f) => breakNameFor(f));
  const drafts = fixtures.filter((f) => f.status === "DRAFT");
  const selectedComp = competitions.find((c) => c.id === selectedCompId);

  // One-off notice carried across the reload after generating a draw.
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const n = sessionStorage.getItem("fixturesNotice");
      if (n) {
        sessionStorage.removeItem("fixturesNotice");
        setNotice(n); // eslint-disable-line react-hooks/set-state-in-effect -- read once after reload
      }
    } catch {}
  }, []);

  const [publishBusy, setPublishBusy] = useState(false);
  const handlePublish = async () => {
    if (!selectedComp) return;
    const warn = inBreak.some((f) => f.status === "DRAFT")
      ? "\n\nSome of these games fall in a break. Consider \"Move games out of breaks\" first."
      : "";
    if (!confirm(`Publish ${drafts.length} draft fixtures for ${selectedComp.name}? They'll appear on the website and in the referee portal.${warn}`)) return;
    setPublishBusy(true);
    setDrawMsg("");
    const res = await fetch(`/api/admin/competitions/${selectedCompId}/publish`, { method: "POST" });
    const data = await res.json();
    setPublishBusy(false);
    if (!res.ok) return setDrawMsg(data.error ?? "Failed to publish");
    setFixtures((prev) => prev.map((f) => (f.status === "DRAFT" ? { ...f, status: "SCHEDULED" } : f)));
    setNotice(`Published ${data.published} fixtures. They're now on the website.`);
  };

  type Shift = { id: string; match: string; round: number; published: boolean; from: string; to: string; breakName: string | null };
  const [shiftPlan, setShiftPlan] = useState<{ changes: Shift[]; weeksAdded: number } | null>(null);
  const [shiftBusy, setShiftBusy] = useState(false);
  const shift = async (dryRun: boolean) => {
    setShiftBusy(true);
    setDrawMsg("");
    const res = await fetch(`/api/admin/competitions/${selectedCompId}/breaks-shift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const data = await res.json();
    setShiftBusy(false);
    if (!res.ok) return setDrawMsg(data.error ?? "Failed");
    if (dryRun) return setShiftPlan(data);
    const to = new Map<string, string>(data.changes.map((c: Shift) => [c.id, c.to]));
    setFixtures((prev) => prev.map((f) => (to.has(f.id) ? { ...f, scheduledAt: to.get(f.id)! } : f)));
    setShiftPlan(null);
    setNotice(`Moved ${data.changes.length} fixtures out of breaks. The season now runs ${data.weeksAdded} week${data.weeksAdded === 1 ? "" : "s"} longer.`);
  };
  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const handleGenerateDraw = async () => {
    if (!selectedCompId || !drawDate) return;
    const comp = competitions.find((c) => c.id === selectedCompId);
    if (!confirm(`Generate a draft draw for ${comp?.name}? Existing unplayed fixtures for this competition (draft or published) will be replaced. Weeks that fall in a break are skipped.`)) return;
    setDrawBusy(true);
    setDrawMsg("");
    const res = await fetch("/api/admin/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: selectedCompId, startDate: drawDate }),
    });
    const data = await res.json();
    setDrawBusy(false);
    if (!res.ok) {
      setDrawMsg(data.error ?? "Failed to generate draw");
      return;
    }
    const skipped = (data.skippedWeeks ?? []) as { weekOf: string; breakName: string }[];
    try {
      sessionStorage.setItem(
        "fixturesNotice",
        `Draft draw created: ${data.fixtures} fixtures over ${data.rounds} rounds. It isn't on the website until you publish it.` +
          (skipped.length ? ` Skipped ${skipped.length} week${skipped.length === 1 ? "" : "s"} for breaks: ${skipped.map((s) => `${s.weekOf} (${s.breakName})`).join(", ")}.` : "")
      );
    } catch {}
    window.location.reload();
  };

  // Group by round
  const rounds = Array.from(new Set(fixtures.map((f) => f.round))).sort((a, b) => a - b);

  const handleCompChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href);
    url.searchParams.set("comp", e.target.value);
    window.location.href = url.toString();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-sm font-semibold text-navy">Competition:</label>
        <select
          defaultValue={selectedCompId}
          onChange={handleCompChange}
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">All</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
          ))}
        </select>

        {selectedCompId && (
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={drawDate}
              onChange={(e) => setDrawDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              onClick={handleGenerateDraw}
              disabled={drawBusy || !drawDate}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60"
            >
              {drawBusy ? "Generating…" : "Generate Draw"}
            </button>
          </div>
        )}
        <Link
          href="/admin/fixtures/breaks"
          className={`text-sm text-brand font-semibold hover:underline ${selectedCompId ? "" : "ml-auto"}`}
        >
          Breaks &amp; holidays ({breaks.length}) →
        </Link>
      </div>

      {drawMsg && (
        <p className="text-sm text-red-600 mb-4">{drawMsg}</p>
      )}
      {notice && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4">{notice}</p>
      )}

      {selectedCompId && drafts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 flex-1 min-w-[16rem]">
            <span className="font-bold">{drafts.length} draft fixture{drafts.length === 1 ? "" : "s"}</span>: not on the
            website or referee portal yet. Review the draw below, then publish it.
          </p>
          <button
            onClick={handlePublish}
            disabled={publishBusy}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
          >
            {publishBusy ? "Publishing…" : "Publish draw"}
          </button>
        </div>
      )}

      {selectedCompId && inBreak.length > 0 && !shiftPlan && (
        <div className="flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-800 flex-1 min-w-[16rem]">
            <span className="font-bold">{inBreak.length} game{inBreak.length === 1 ? "" : "s"}</span> fall in a break (
            {[...new Set(inBreak.map((f) => breakNameFor(f)))].join(", ")}).
          </p>
          <button
            onClick={() => shift(true)}
            disabled={shiftBusy}
            className="border border-red-300 bg-white text-red-700 px-4 py-2 rounded-lg text-sm font-bold hover:border-red-500 disabled:opacity-60"
          >
            {shiftBusy ? "Checking…" : "Move games out of breaks…"}
          </button>
        </div>
      )}

      {shiftPlan && (
        <div className="bg-white border border-red-300 rounded-xl p-4 mb-4">
          <p className="text-sm text-navy mb-2">
            This moves <span className="font-bold">{shiftPlan.changes.length} games</span> later. Each affected round
            moves to the next clear week on the same day, time and pitch, and every round after it moves by the same
            amount, so the season runs <span className="font-bold">{shiftPlan.weeksAdded} week{shiftPlan.weeksAdded === 1 ? "" : "s"}</span> longer.
            {shiftPlan.changes.some((c) => c.published) && (
              <span className="text-red-700 font-semibold"> Some of these are already published, so the website will show the new dates straight away.</span>
            )}
          </p>
          <div className="max-h-64 overflow-y-auto border border-border rounded-lg mb-3">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border">
                {shiftPlan.changes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-1.5 text-muted">Rd {c.round}</td>
                    <td className="px-3 py-1.5 font-semibold text-navy">{c.match}</td>
                    <td className="px-3 py-1.5 text-muted line-through">{fmtWhen(c.from)}</td>
                    <td className="px-3 py-1.5 text-navy">→ {fmtWhen(c.to)}</td>
                    <td className="px-3 py-1.5 text-muted">{c.published ? "published" : "draft"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => shift(false)}
              disabled={shiftBusy}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
            >
              {shiftBusy ? "Moving…" : `Move ${shiftPlan.changes.length} games`}
            </button>
            <button onClick={() => setShiftPlan(null)} className="border border-border px-3 py-2 rounded-lg text-sm hover:border-brand">
              Cancel
            </button>
          </div>
        </div>
      )}

      {rounds.length === 0 ? (
        <p className="text-muted text-sm">
          {selectedCompId
            ? "No fixtures yet — pick the season start date above and hit Generate Draw (teams play each other twice; Opens three times)."
            : "No fixtures found. Select a competition to generate its draw."}
        </p>
      ) : (
        rounds.map((round) => {
          const roundFixtures = fixtures.filter((f) => f.round === round);
          const label = roundFixtures[0]?.phase !== "REGULAR" ? roundFixtures[0].phase.replace(/_/g, " ") : `Round ${round}`;
          return (
            <div key={round} className="mb-6">
              <h2 className="text-sm font-bold text-navy mb-2 uppercase tracking-wide">{label}</h2>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-navy text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Rd</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Match</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Date/Time</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Pitch</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Ref / Scorer</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                      <th className="px-4 py-2.5 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {roundFixtures.map((f) => (
                      <FixtureRow
                        key={f.id}
                        fixture={f}
                        referees={referees}
                        pitches={pitches}
                        breakName={breakNameFor(f)}
                        onUpdated={handleUpdated}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
