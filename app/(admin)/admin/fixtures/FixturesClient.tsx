"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FixtureRow from "./FixtureRow";
import { groupRounds } from "@/lib/rounds";
import DrawRequestsPanel from "@/components/admin/DrawRequestsPanel";
import GenerateDrawForm, { describeDraw, type DrawCompetition, type DrawResult } from "@/components/admin/GenerateDrawForm";
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
type Competition = DrawCompetition & { season: string };

export default function FixturesClient({
  initialFixtures,
  referees,
  pitches,
  competitions,
  selectedCompId,
  breaks,
  teams = [],
}: {
  initialFixtures: Fixture[];
  referees: Referee[];
  pitches: Pitch[];
  competitions: Competition[];
  selectedCompId: string;
  breaks: BreakRange[];
  /** The selected competition's teams, to show who has the bye each round. */
  teams?: { id: string; name: string }[];
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>(initialFixtures);
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

  const handleGenerated = (data: DrawResult) => {
    try {
      sessionStorage.setItem("fixturesNotice", describeDraw(data));
    } catch {}
    window.location.reload();
  };

  // Group by round
  // Rounds in date order, finals under their own headings, with byes.
  const rounds = groupRounds(fixtures, teams);

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

        <Link href="/admin/fixtures/breaks" className="text-sm text-brand font-semibold hover:underline ml-auto">
          Breaks &amp; holidays ({breaks.length}) →
        </Link>
      </div>

      {selectedComp && (
        <div className="bg-white border border-border rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-navy uppercase tracking-wide mb-2">Generate draw</p>
          <GenerateDrawForm competition={selectedComp} onGenerated={handleGenerated} />
          <div className="mt-4 pt-4 border-t border-border">
            <DrawRequestsPanel
              competitionId={selectedComp.id}
              teams={teams}
              onApplied={(m) => {
                try { sessionStorage.setItem("fixturesNotice", m); } catch {}
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}

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
            ? "No fixtures yet. Choose the draw settings above and generate a draft draw."
            : "No fixtures found. Select a competition to generate its draw."}
        </p>
      ) : (
        rounds.map(({ key, label, date, games: roundFixtures, byes }) => {
          return (
            <div key={key} className="mb-6">
              <h2 className="text-sm font-bold text-navy mb-2 uppercase tracking-wide">
                {label}
                <span className="ml-2 font-semibold normal-case text-muted">
                  {new Date(date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                {byes.length > 0 && (
                  <span className="ml-3 normal-case font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-xs">
                    Bye: {byes.map((t) => t.name).join(", ")}
                  </span>
                )}
              </h2>
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
