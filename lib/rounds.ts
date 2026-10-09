/**
 * Group a competition's fixtures into rounds for display: regular rounds by
 * number, finals by phase (so the semis don't merge into "Round 1"), in date
 * order, with the teams on a bye in each regular round.
 */
// Server rows have homeTeamId/awayTeamId; client rows have homeTeam/awayTeam objects.
type F = {
  round: number;
  phase: string;
  scheduledAt: Date | string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam?: { id: string };
  awayTeam?: { id: string };
};
const sides = (g: F) => [g.homeTeamId ?? g.homeTeam?.id, g.awayTeamId ?? g.awayTeam?.id];

const PHASE_LABEL: Record<string, string> = { SEMI_FINAL: "Semi-finals", THIRD_PLACE: "3rd place play-off", GRAND_FINAL: "Grand final" };

export function groupRounds<T extends F>(fixtures: T[], teams: { id: string; name: string }[] = []) {
  const groups = new Map<string, T[]>();
  for (const f of [...fixtures].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())) {
    const key = `${f.phase}:${f.round}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()].map(([key, games]) => {
    const phase = games[0].phase;
    const playing = new Set(games.flatMap(sides));
    return {
      key,
      label: phase === "REGULAR" ? `Round ${games[0].round}` : PHASE_LABEL[phase] ?? phase.replace(/_/g, " "),
      date: games[0].scheduledAt,
      games,
      // Only regular rounds have byes; finals involve just the qualifiers.
      byes: phase === "REGULAR" ? teams.filter((t) => !playing.has(t.id)) : [],
    };
  });
}
