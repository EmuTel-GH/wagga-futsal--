"use client";

import { useState } from "react";
import AddTeamForm from "./AddTeamForm";
import TeamRow from "./TeamRow";

type Player = { id: string; firstName: string; lastName: string };
type TeamPlayer = { id: string; playerId: string; jerseyNumber: number | null; player: Player };
type CompetitionRef = { id: string; name: string; season: string };
type CompetitionTeam = { id: string; teamId: string; competition: CompetitionRef };

type Team = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  _count: { players: number };
  competitions: CompetitionTeam[];
  players: TeamPlayer[];
};

type Competition = { id: string; name: string; season: string };
type Official = { id: string; firstName: string; lastName: string; role: string; teamId: string | null };

export default function TeamsClient({
  initialTeams,
  allPlayers,
  allCompetitions,
  allOfficials,
}: {
  initialTeams: Team[];
  allPlayers: Player[];
  allCompetitions: Competition[];
  allOfficials: Official[];
}) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);

  const handleCreated = (t: Team) => setTeams((prev) => [...prev, t]);
  const handleUpdated = (t: Team) => setTeams((prev) => prev.map((x) => (x.id === t.id ? t : x)));
  const handleDeleted = (id: string) => setTeams((prev) => prev.filter((x) => x.id !== id));

  return (
    <>
      <div className="mb-6">
        <AddTeamForm onCreated={handleCreated} />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {teams.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">No teams yet.</p>
        ) : (
          teams.map((t) => (
            <TeamRow
              key={t.id}
              team={t}
              allPlayers={allPlayers}
              allCompetitions={allCompetitions}
              allOfficials={allOfficials}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>
    </>
  );
}
