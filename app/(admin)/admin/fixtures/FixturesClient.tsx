"use client";

import { useState } from "react";
import FixtureRow from "./FixtureRow";

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
}: {
  initialFixtures: Fixture[];
  referees: Referee[];
  pitches: Pitch[];
  competitions: Competition[];
  selectedCompId: string;
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>(initialFixtures);
  const [drawDate, setDrawDate] = useState("");
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawMsg, setDrawMsg] = useState("");

  const handleUpdated = (f: Fixture) => setFixtures((prev) => prev.map((x) => (x.id === f.id ? f : x)));

  const handleGenerateDraw = async () => {
    if (!selectedCompId || !drawDate) return;
    const comp = competitions.find((c) => c.id === selectedCompId);
    if (!confirm(`Generate the draw for ${comp?.name}? Existing unplayed scheduled fixtures for this competition will be replaced.`)) return;
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
      </div>

      {drawMsg && (
        <p className="text-sm text-red-600 mb-4">{drawMsg}</p>
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
