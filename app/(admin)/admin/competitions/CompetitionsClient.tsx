"use client";

import { useState } from "react";
import AddCompetitionForm from "./AddCompetitionForm";
import CompetitionCard from "./CompetitionCard";

type SlotPitch = { id: string; name: string; venue: { name: string } };
type VenuePitch = { id: string; name: string };
type TimeSlot = {
  id: string;
  pitchId: string;
  dayOfWeek: number;
  startTime: string;
  durationMins: number;
  pitch: SlotPitch;
};
type CompetitionTeam = { id: string; teamId: string; team: { id: string; name: string } };
export type Competition = {
  id: string;
  name: string;
  season: string;
  ageGroup: string;
  gender: string;
  status: string;
  timeSlots: TimeSlot[];
  teams: CompetitionTeam[];
  _count: { fixtures: number };
  drawTimesEach: number | null;
  drawMaxRounds: number | null;
  endDate: Date | string | null;
  splitFrom?: { name: string } | null;
};
export type Venue = { id: string; name: string; pitches: VenuePitch[] };

export default function CompetitionsClient({
  initialCompetitions,
  venues,
}: {
  initialCompetitions: Competition[];
  venues: Venue[];
}) {
  const [competitions, setCompetitions] = useState<Competition[]>(initialCompetitions);

  const handleCreated = (c: Competition) => {
    setCompetitions((prev) => [c, ...prev]);
  };

  const handleUpdated = (c: Competition) => {
    setCompetitions((prev) => prev.map((x) => (x.id === c.id ? c : x)));
  };

  const handleDeleted = (id: string) => {
    setCompetitions((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <>
      <div className="mb-6">
        <AddCompetitionForm onCreated={handleCreated} />
      </div>

      {competitions.length === 0 ? (
        <p className="text-muted text-sm">No competitions yet.</p>
      ) : (
        competitions.map((c) => (
          <CompetitionCard
            key={c.id}
            competition={c}
            venues={venues}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))
      )}
    </>
  );
}
