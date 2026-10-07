"use client";

import { useState } from "react";
import AddTeamForm from "./AddTeamForm";
import TeamRow, { teamNeedsReview, type Dispensation, type Player, type Team } from "./TeamRow";

type Competition = { id: string; name: string; season: string };
type Official = { id: string; firstName: string; lastName: string; role: string; teamId: string | null };

export default function TeamsClient({
  initialTeams,
  allPlayers,
  allCompetitions,
  allOfficials,
  initialDispensations,
  canOverride,
}: {
  initialTeams: Team[];
  allPlayers: Player[];
  allCompetitions: Competition[];
  allOfficials: Official[];
  initialDispensations: Dispensation[];
  canOverride: boolean;
}) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [dispensations, setDispensations] = useState<Dispensation[]>(initialDispensations);
  const [reviewOnly, setReviewOnly] = useState(false);

  const handleCreated = (t: Team) => setTeams((prev) => [...prev, t]);
  const handleUpdated = (t: Team) => setTeams((prev) => prev.map((x) => (x.id === t.id ? t : x)));
  const handleDeleted = (id: string) => setTeams((prev) => prev.filter((x) => x.id !== id));
  const handleDispensations = (added: Dispensation[]) =>
    setDispensations((prev) => [
      ...prev.filter((d) => !added.some((a) => a.playerId === d.playerId && a.competitionId === d.competitionId)),
      ...added,
    ]);

  const needsReview = teams.filter((t) => teamNeedsReview(t, allPlayers, dispensations));
  const shown = reviewOnly ? needsReview : teams;

  return (
    <>
      <div className="mb-6">
        {/* New teams start with no competitions, so they satisfy Team. */}
        <AddTeamForm onCreated={(t) => handleCreated(t as Team)} />
      </div>

      {needsReview.length > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <p className="text-xs text-amber-800 font-semibold flex-1">
            {needsReview.length} team{needsReview.length === 1 ? "" : "s"} need{needsReview.length === 1 ? "s" : ""} review
            — pending nominations, or ineligible players to authorise or reject.
          </p>
          <button
            onClick={() => setReviewOnly((v) => !v)}
            className="text-xs font-semibold text-amber-800 border border-amber-300 bg-white px-2.5 py-1 rounded hover:border-amber-500"
          >
            {reviewOnly ? "Show all teams" : "Show only these"}
          </button>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {shown.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">No teams yet.</p>
        ) : (
          shown.map((t) => (
            <TeamRow
              key={t.id}
              team={t}
              allTeams={teams}
              allPlayers={allPlayers}
              allCompetitions={allCompetitions}
              allOfficials={allOfficials}
              dispensations={dispensations}
              canOverride={canOverride}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onDispensations={handleDispensations}
            />
          ))
        )}
      </div>
    </>
  );
}
